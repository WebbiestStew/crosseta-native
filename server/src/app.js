// HTTP API. Built as a factory so tests can run it against an in-memory database.
import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createCommunity, HttpError } from './community.js';
import { ALL } from './feed.js';

const KNOWN = new Set(ALL.map((c) => c.id));
const MAX_BODY = 32 * 1024;
const sha = (s) => createHash('sha256').update(s).digest('hex');

/** Sliding-window limiter keyed by string (device id or IP). */
const createLimiter = (limit, windowMs, now) => {
  const hits = new Map();
  return (key) => {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
    if (recent.length >= limit) { hits.set(key, recent); return false; }
    recent.push(t);
    hits.set(key, recent);
    return true;
  };
};

export const createApp = ({ db, feed, community: communityIn, minDevices = 2, trustProxy = false, now = () => Date.now(), log = console }) => {
  const community = communityIn ?? createCommunity({ db, now });
  const allowRegister = createLimiter(20, 60 * 60 * 1000, now);   // per IP
  const allowRequest = createLimiter(240, 60 * 1000, now);        // per device (or IP when anonymous)

  const routes = [];
  const route = (method, pattern, handler, { auth = true } = {}) =>
    routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), handler, auth });

  const readJson = (req) => new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'Body too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'Invalid JSON.')); }
    });
    req.on('error', reject);
  });

  const authenticate = (req) => {
    const m = /^Bearer ([0-9a-f]{32})\.([0-9a-f]{64})$/.exec(req.headers.authorization ?? '');
    if (!m) return null;
    const d = db.prepare('SELECT * FROM devices WHERE id = ?').get(m[1]);
    if (!d) return null;
    const a = Buffer.from(sha(m[2]));
    const b = Buffer.from(d.secret_hash);
    return a.length === b.length && timingSafeEqual(a, b) ? d : null;
  };

  // ── Public ────────────────────────────────────────────────────────────────
  route('GET', '/health', () => ({ ok: true, crossings: feed.latest.size }), { auth: false });

  route('POST', '/v1/register', (_req, _body, ctx) => {
    if (!allowRegister(ctx.ip)) throw new HttpError(429, 'Too many registrations.');
    const id = randomBytes(16).toString('hex');
    const secret = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO devices (id, secret_hash, created_at) VALUES (?, ?, ?)').run(id, sha(secret), now());
    return { status: 201, body: { token: `${id}.${secret}` } };
  }, { auth: false });

  route('GET', '/v1/history/:id', (_req, _body, ctx) => {
    if (!KNOWN.has(ctx.params.id)) throw new HttpError(404, 'Unknown crossing.');
    return feed.historyFor(ctx.params.id);
  }, { auth: false });

  route('GET', '/v1/history', (_req, _body, ctx) => {
    const ids = String(ctx.query.get('ids') ?? '').split(',').filter((i) => KNOWN.has(i)).slice(0, 20);
    return Object.fromEntries(ids.map((i) => [i, feed.historyFor(i)]));
  }, { auth: false });

  // Latest reading per crossing, already matched and folded across bridges. Used by the widget so
  // it does not need its own copy of the CBP matching logic.
  route('GET', '/v1/waits', (_req, _body, ctx) => {
    const ids = String(ctx.query.get('ids') ?? '').split(',').filter((i) => KNOWN.has(i)).slice(0, 30);
    return {
      waits: Object.fromEntries(ids.filter((i) => feed.latest.has(i)).map((i) => {
        const r = feed.latest.get(i);
        return [i, { wait: r.wait, sentri: r.sentri, ready: r.ready, closed: r.closed, updatedAt: r.updatedAt ?? r.fetchedAt }];
      })),
    };
  }, { auth: false });

  route('GET', '/v1/community', (_req, _body, ctx) => ({
    crossings: community.measuredWaits({ minDevices, crossingId: ctx.query.get('crossingId') || undefined }),
  }), { auth: false });

  // ── Authenticated ─────────────────────────────────────────────────────────
  route('PUT', '/v1/alerts', (_req, body, ctx) => {
    const rules = (Array.isArray(body.rules) ? body.rules : []).slice(0, 60).flatMap((r) => {
      const th = Number(r?.threshold);
      if (!KNOWN.has(r?.crossingId) || !Number.isFinite(th) || th < 0 || th > 300) return [];
      return [{ crossingId: r.crossingId, threshold: Math.round(th), lowAlert: !!r.lowAlert, lane: ['standard', 'sentri', 'ready'].includes(r.lane) ? r.lane : 'standard' }];
    });
    const token = typeof body.pushToken === 'string' && /^(Expo|Exponent)PushToken\[[\w-]+\]$/.test(body.pushToken) ? body.pushToken : null;
    if (body.pushToken && !token) throw new HttpError(422, 'Invalid push token.');
    const q = body.quiet;
    const quiet = q && Number.isInteger(q.start) && Number.isInteger(q.end) && q.start >= 0 && q.start < 24 && q.end >= 0 && q.end < 24
      ? JSON.stringify({ enabled: !!q.enabled, start: q.start, end: q.end }) : null;
    const tz = Number.isFinite(Number(body.tzOffsetMin)) ? Math.max(-840, Math.min(840, Math.round(Number(body.tzOffsetMin)))) : 0;
    // A push token belongs to one device at a time (reinstalls re-register with a new device id).
    if (token) db.prepare('UPDATE devices SET push_token = NULL WHERE push_token = ? AND id != ?').run(token, ctx.device.id);
    db.prepare('UPDATE devices SET push_token = ?, lang = ?, quiet_json = ?, rules_json = ?, tz_offset_min = ? WHERE id = ?')
      .run(token, body.lang === 'es' ? 'es' : 'en', quiet, JSON.stringify(rules), tz, ctx.device.id);
    return { ok: true, rules: rules.length };
  });

  route('DELETE', '/v1/alerts', (_req, _body, ctx) => {
    db.prepare("UPDATE devices SET push_token = NULL, rules_json = '[]' WHERE id = ?").run(ctx.device.id);
    return { ok: true };
  });

  route('DELETE', '/v1/me', (_req, _body, ctx) => {
    // Erase everything tied to this device.
    const id = ctx.device.id;
    for (const sql of [
      'DELETE FROM trips WHERE device_id = ?', 'DELETE FROM report_votes WHERE device_id = ?', 'DELETE FROM report_flags WHERE device_id = ?',
      'DELETE FROM alert_state WHERE device_id = ?', 'DELETE FROM reports WHERE device_id = ?', 'DELETE FROM devices WHERE id = ?',
    ]) db.prepare(sql).run(id);
    return { ok: true };
  });

  route('POST', '/v1/trips', (_req, body, ctx) => {
    community.addTrip(ctx.device.id, body);
    return { status: 201, body: { ok: true } };
  });

  route('GET', '/v1/reports', (_req, _body, ctx) => ({
    reports: community.listReports(ctx.device.id, { crossingId: ctx.query.get('crossingId') || undefined, limit: Number(ctx.query.get('limit')) || 50 }),
  }));

  route('POST', '/v1/reports', (_req, body, ctx) => ({ status: 201, body: community.addReport(ctx.device.id, body) }));

  route('POST', '/v1/reports/:id/vote', (_req, body, ctx) => {
    community.vote(ctx.device.id, ctx.params.id, body.value ?? null);
    return { ok: true };
  });

  route('POST', '/v1/reports/:id/flag', (_req, _body, ctx) => community.flag(ctx.device.id, ctx.params.id));

  // ── Server ────────────────────────────────────────────────────────────────
  const server = createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    try {
      const url = new URL(req.url, 'http://x');
      // Only believe X-Forwarded-For when running behind a proxy you control (TRUST_PROXY=1);
      // otherwise any client could spoof it and dodge the per-IP limits.
      const forwarded = trustProxy ? req.headers['x-forwarded-for'] : undefined;
      const ip = String(forwarded ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
      const match = routes.map((r) => ({ r, m: r.method === req.method ? r.re.exec(url.pathname) : null })).find((x) => x.m);
      if (!match) {
        const known = routes.some((r) => r.re.test(url.pathname));
        return send(known ? 405 : 404, { error: known ? 'Method not allowed.' : 'Not found.' });
      }
      let device = null;
      if (match.r.auth) {
        device = authenticate(req);
        if (!device) return send(401, { error: 'Unauthorized.' });
      }
      if (!allowRequest(device?.id ?? ip)) return send(429, { error: 'Too many requests.' });
      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readJson(req) : {};
      const out = await match.r.handler(req, body, { device, ip, query: url.searchParams, params: match.m.groups ?? {} });
      if (out && typeof out === 'object' && 'status' in out && 'body' in out) return send(out.status, out.body);
      return send(200, out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return send(e.status, { error: e.message });
      log.error?.(e);
      return send(500, { error: 'Server error.' });
    }
  });

  return { server, community };
};
