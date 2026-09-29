import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { openDb } from '../src/db.js';
import { createFeed } from '../src/feed.js';
import { createPusher } from '../src/push.js';
import { createAlerts } from '../src/alerts.js';
import { createApp } from '../src/app.js';

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/bwt.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(FIXTURE);
const MIN = 60 * 1000;

let clock;
let db; let feed; let alerts; let api; let base; let pushServer; let pushed; let pushReply;

const startHttp = (server) => new Promise((res) => server.listen(0, '127.0.0.1', () => res(`http://127.0.0.1:${server.address().port}`)));

beforeEach(async () => {
  clock = Date.UTC(2026, 8, 29, 18, 0);
  db = openDb(':memory:');
  feed = createFeed({ db, feedUrl: 'unused' });
  pushed = [];
  pushReply = (msgs) => msgs.map(() => ({ status: 'ok' }));
  pushServer = createServer((req, res) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => {
      const msgs = JSON.parse(b);
      pushed.push(...msgs);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: pushReply(msgs) }));
    });
  });
  const pushUrl = await startHttp(pushServer);
  alerts = createAlerts({ db, feed, pusher: createPusher({ pushUrl, log: { warn() {} } }) });
  api = createApp({ db, feed, now: () => clock, log: { error() {} } });
  base = await startHttp(api.server);
});

after(() => {});

const close = async () => { api.server.close(); pushServer.close(); db.close(); };
const afterEachClose = () => close();
import { afterEach } from 'node:test';
afterEach(afterEachClose);

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const newDevice = async () => (await call('POST', '/v1/register')).body.token;

const PUSH_TOKEN = 'ExponentPushToken[abc123_-XYZ]';
const setRules = (token, rules, extra = {}) =>
  call('PUT', '/v1/alerts', { token, body: { pushToken: PUSH_TOKEN, lang: 'en', rules, ...extra } });

// ─── auth ───────────────────────────────────────────────────────────────────
test('protected routes reject missing or forged tokens; register issues a working one', async () => {
  assert.equal((await call('GET', '/v1/reports')).status, 401);
  assert.equal((await call('GET', '/v1/reports', { token: `${'a'.repeat(32)}.${'b'.repeat(64)}` })).status, 401);
  const token = await newDevice();
  assert.equal((await call('GET', '/v1/reports', { token })).status, 200);
  // Right device id, wrong secret.
  const forged = `${token.split('.')[0]}.${'0'.repeat(64)}`;
  assert.equal((await call('GET', '/v1/reports', { token: forged })).status, 401);
  assert.equal((await call('GET', '/health')).body.ok, true);
});

// ─── history ────────────────────────────────────────────────────────────────
test('feed ingest records history by the port clock and needs distinct days to publish', async () => {
  feed.ingest(clone(), new Date(clock));
  const el = feed.latest.get('EL_PASO');
  assert.equal(el.wait, 38, 'shortest open bridge wins');
  const h1 = (await call('GET', '/v1/history/EL_PASO')).body;
  assert.equal(typeof h1.tz, 'number');
  assert.equal(Object.keys(h1.buckets).length, 1);
  // Same day, another sample: still one day.
  feed.ingest(clone(), new Date(clock + 10 * MIN));
  const b = Object.values((await call('GET', '/v1/history/EL_PASO')).body.buckets)[0];
  assert.equal(b[1] + 1, 1, 'one distinct day');
  // Same weekday+hour on three later days.
  for (const d of [7, 14]) feed.ingest(clone(), new Date(clock + d * 24 * 60 * MIN));
  const b3 = Object.values((await call('GET', '/v1/history/EL_PASO')).body.buckets)[0];
  assert.equal(b3[1] + 1, 3);
  assert.equal((await call('GET', '/v1/history/NOPE')).status, 404);
});

test('history survives a restart', () => {
  feed.ingest(clone(), new Date(clock));
  const again = createFeed({ db, feedUrl: 'unused' });
  assert.equal(Object.keys(again.historyFor('EL_PASO').buckets).length, 1);
  assert.equal(again.tz.get('EL_PASO'), feed.tz.get('EL_PASO'));
});

test('/v1/waits returns matched readings for requested crossings only', async () => {
  feed.ingest(clone(), new Date(clock));
  const res = (await call('GET', '/v1/waits?ids=EL_PASO,LAREDO,NOT_REAL')).body.waits;
  assert.deepEqual(Object.keys(res).sort(), ['EL_PASO', 'LAREDO']);
  assert.equal(res.EL_PASO.wait, 38);
  assert.equal(res.LAREDO.wait, 20);
  assert.equal(typeof res.EL_PASO.updatedAt, 'number');
  assert.deepEqual((await call('GET', '/v1/waits')).body.waits, {});
});

// ─── alerts ─────────────────────────────────────────────────────────────────
test('alert rules are validated and stored', async () => {
  const token = await newDevice();
  const ok = await setRules(token, [
    { crossingId: 'EL_PASO', threshold: 20, lowAlert: true },
    { crossingId: 'NOT_REAL', threshold: 20 },
    { crossingId: 'LAREDO', threshold: 9999 },
  ]);
  assert.equal(ok.body.rules, 1, 'unknown crossings and absurd thresholds are dropped');
  const bad = await call('PUT', '/v1/alerts', { token, body: { pushToken: 'not-a-token', rules: [] } });
  assert.equal(bad.status, 422);
});

test('high alerts fire once per cooldown, drop alerts fire on the crossing back under the threshold', async () => {
  const token = await newDevice();
  await setRules(token, [{ crossingId: 'EL_PASO', threshold: 20, lowAlert: true }]);
  feed.ingest(clone(), new Date(clock));                       // El Paso = 38 > 20
  assert.equal(await alerts.run(clock), 1);
  assert.match(pushed[0].title, /El Paso/);
  assert.equal(pushed[0].to, PUSH_TOKEN);
  assert.equal(await alerts.run(clock + 5 * MIN), 0, 'inside the 15 minute cooldown');
  assert.equal(await alerts.run(clock + 16 * MIN), 1, 'cooldown over');

  const dropped = clone();
  dropped.filter((r) => r.port_name === 'El Paso').forEach((r) => { if (r.passenger_vehicle_lanes.standard_lanes.delay_minutes) r.passenger_vehicle_lanes.standard_lanes.delay_minutes = '10'; });
  feed.ingest(dropped, new Date(clock + 20 * MIN));
  pushed.length = 0;
  assert.equal(await alerts.run(clock + 40 * MIN), 1);
  assert.match(pushed[0].title, /Dropped/);
});

test('quiet hours use the device time zone and suppress alerts', async () => {
  const token = await newDevice();
  // 18:00 UTC is 12:00 in UTC-6; quiet 11-13 covers it.
  await setRules(token, [{ crossingId: 'EL_PASO', threshold: 20 }], { quiet: { enabled: true, start: 11, end: 13 }, tzOffsetMin: -360 });
  feed.ingest(clone(), new Date(clock));
  assert.equal(await alerts.run(clock), 0);
  // Same rule, quiet window elsewhere: fires.
  await setRules(token, [{ crossingId: 'EL_PASO', threshold: 20 }], { quiet: { enabled: true, start: 22, end: 6 }, tzOffsetMin: -360 });
  assert.equal(await alerts.run(clock + MIN), 1);
});

test('Spanish devices get Spanish text; dead push tokens are removed', async () => {
  const token = await newDevice();
  await setRules(token, [{ crossingId: 'EL_PASO', threshold: 20 }], { lang: 'es' });
  feed.ingest(clone(), new Date(clock));
  pushReply = (msgs) => msgs.map(() => ({ status: 'error', details: { error: 'DeviceNotRegistered' } }));
  await alerts.run(clock);
  assert.match(pushed[0].title, /Espera alta/);
  const row = db.prepare('SELECT push_token FROM devices').get();
  assert.equal(row.push_token, null, 'token Expo rejected is cleared so we stop sending to it');
});

test('a push token moves to the newest device (reinstall)', async () => {
  const a = await newDevice(); const b = await newDevice();
  await setRules(a, [{ crossingId: 'EL_PASO', threshold: 20 }]);
  await setRules(b, [{ crossingId: 'EL_PASO', threshold: 20 }]);
  feed.ingest(clone(), new Date(clock));
  assert.equal(await alerts.run(clock), 1, 'only one device holds the token, so only one push');
});

// ─── trips / measured waits ─────────────────────────────────────────────────
const trip = (over = {}) => ({ crossingId: 'EL_PASO', lane: 'standard', startTime: clock - 40 * MIN, endTime: clock, actualWait: 40, ...over });

test('trips are validated for plausibility', async () => {
  const token = await newDevice();
  const bad = async (over, status) => assert.equal((await call('POST', '/v1/trips', { token, body: trip(over) })).status, status, JSON.stringify(over));
  await bad({ crossingId: 'NOPE' }, 422);
  await bad({ lane: 'vip' }, 422);
  await bad({ actualWait: 0 }, 422);
  await bad({ actualWait: 999, startTime: clock - 999 * MIN }, 422);
  await bad({ actualWait: 10 }, 422);                       // timestamps say 40 min
  await bad({ endTime: clock + 60 * MIN, startTime: clock + 20 * MIN }, 422);   // future
  await bad({ endTime: clock - 20 * 60 * MIN, startTime: clock - 20 * 60 * MIN - 40 * MIN }, 422);   // too old
  assert.equal((await call('POST', '/v1/trips', { token, body: trip() })).status, 201);
  await bad({}, 429);                                        // same crossing again within 10 minutes
});

test('a measured wait is published only when enough different devices agree, using each device once', async () => {
  const a = await newDevice(); const b = await newDevice(); const c = await newDevice();
  await call('POST', '/v1/trips', { token: a, body: trip({ actualWait: 40 }) });
  assert.deepEqual((await call('GET', '/v1/community')).body.crossings, {}, 'one device is not enough');
  await call('POST', '/v1/trips', { token: b, body: trip({ actualWait: 50, startTime: clock - 50 * MIN }) });
  await call('POST', '/v1/trips', { token: c, body: trip({ actualWait: 90, startTime: clock - 90 * MIN }) });
  const w = (await call('GET', '/v1/community')).body.crossings.EL_PASO.standard;
  assert.equal(w.n, 3);
  assert.equal(w.minutes, 50, 'median, so one outlier does not move it');
  clock += 2 * 60 * MIN;
  assert.deepEqual((await call('GET', '/v1/community')).body.crossings, {}, 'old trips age out');
});

// ─── reports ────────────────────────────────────────────────────────────────
const report = (over = {}) => ({ crossingId: 'EL_PASO', lane: 'Standard', wait: 35, note: 'Moving steadily', author: 'Diego V', ...over });

test('report notes reject links and contact details', async () => {
  const token = await newDevice();
  for (const note of ['see http://x.example', 'go to www.foo.co', 'buy at deals.com', 'call 915-555-1212', 'me@x.com', 'text me on whatsapp']) {
    assert.equal((await call('POST', '/v1/reports', { token, body: report({ note }) })).status, 422, note);
  }
  const ok = await call('POST', '/v1/reports', { token, body: report() });
  assert.equal(ok.status, 201);
});

test('reports: validation, rate limit, duplicate detection', async () => {
  const a = await newDevice(); const b = await newDevice();
  assert.equal((await call('POST', '/v1/reports', { token: a, body: report({ wait: 999 }) })).status, 422);
  assert.equal((await call('POST', '/v1/reports', { token: a, body: report({ lane: 'VIP' }) })).status, 422);
  assert.equal((await call('POST', '/v1/reports', { token: a, body: report() })).status, 201);
  assert.equal((await call('POST', '/v1/reports', { token: a, body: report({ wait: 60 }) })).status, 429, 'same device + crossing within 10 min');
  assert.equal((await call('POST', '/v1/reports', { token: b, body: report({ wait: 37 }) })).status, 409, 'near-duplicate of a fresh report');
  assert.equal((await call('POST', '/v1/reports', { token: b, body: report({ wait: 70 }) })).status, 201);
});

test('reports list shape matches the app, hides other devices\' identity, and excludes the viewer\'s own vote from counts', async () => {
  const a = await newDevice(); const b = await newDevice(); const c = await newDevice();
  const { id } = (await call('POST', '/v1/reports', { token: a, body: report() })).body;
  assert.equal((await call('POST', `/v1/reports/${id}/vote`, { token: a, body: { value: 'up' } })).status, 403, 'no voting on your own report');
  await call('POST', `/v1/reports/${id}/vote`, { token: b, body: { value: 'up' } });
  await call('POST', `/v1/reports/${id}/vote`, { token: c, body: { value: 'down' } });

  const asB = (await call('GET', '/v1/reports?crossingId=EL_PASO', { token: b })).body.reports[0];
  assert.equal(asB.upvotes, 0, 'b sees others only; the app adds b\'s own vote back');
  assert.equal(asB.downvotes, 1);
  assert.equal(asB.myVote, 'up');
  const asA = (await call('GET', '/v1/reports', { token: a })).body.reports[0];
  assert.equal(asA.upvotes, 1); assert.equal(asA.downvotes, 1); assert.equal(asA.mine, true);
  for (const k of ['id', 'crossingId', 'crossingName', 'border', 'lane', 'wait', 'note', 'author', 'initials', 'avatarColor', 'trustScore', 'time', 'ts']) assert.ok(k in asA, k);
  assert.equal(asA.border, 'MX');
  assert.equal(JSON.stringify(asA).includes(a.split('.')[0]), false, 'device id never leaks');

  await call('POST', `/v1/reports/${id}/vote`, { token: b, body: { value: null } });
  assert.equal((await call('GET', '/v1/reports', { token: c })).body.reports[0].upvotes, 0, 'vote removed');
});

test('a report is hidden once three different devices flag it; one device cannot flag repeatedly', async () => {
  const author = await newDevice();
  const { id } = (await call('POST', '/v1/reports', { token: author, body: report() })).body;
  const [x, y, z] = [await newDevice(), await newDevice(), await newDevice()];
  assert.equal((await call('POST', `/v1/reports/${id}/flag`, { token: author })).status, 403);
  await call('POST', `/v1/reports/${id}/flag`, { token: x });
  await call('POST', `/v1/reports/${id}/flag`, { token: x });
  assert.equal((await call('POST', `/v1/reports/${id}/flag`, { token: x })).body.flags, 1, 'same device counts once');
  await call('POST', `/v1/reports/${id}/flag`, { token: y });
  assert.equal((await call('GET', '/v1/reports', { token: z })).body.reports.length, 1);
  const last = await call('POST', `/v1/reports/${id}/flag`, { token: z });
  assert.equal(last.body.hidden, true);
  assert.equal((await call('GET', '/v1/reports', { token: z })).body.reports.length, 0);
});

test('reports older than 48 hours are not listed', async () => {
  const t = await newDevice();
  await call('POST', '/v1/reports', { token: t, body: report() });
  clock += 49 * 60 * MIN;
  assert.equal((await call('GET', '/v1/reports', { token: t })).body.reports.length, 0);
});

// ─── privacy ────────────────────────────────────────────────────────────────
test('DELETE /v1/me erases the device and everything it contributed', async () => {
  const a = await newDevice(); const b = await newDevice();
  await setRules(a, [{ crossingId: 'EL_PASO', threshold: 20 }]);
  await call('POST', '/v1/trips', { token: a, body: trip() });
  const { id } = (await call('POST', '/v1/reports', { token: a, body: report() })).body;
  await call('POST', `/v1/reports/${id}/vote`, { token: b, body: { value: 'up' } });
  assert.equal((await call('DELETE', '/v1/me', { token: a })).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM trips').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM reports').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM devices WHERE id = ?').get(a.split('.')[0]).n, 0);
  assert.equal((await call('GET', '/v1/reports', { token: a })).status, 401);
});

test('registration is rate-limited per IP, and X-Forwarded-For is ignored unless the proxy is trusted', async () => {
  const reg = (xff) => fetch(`${base}/v1/register`, { method: 'POST', headers: xff ? { 'X-Forwarded-For': xff } : {} }).then((r) => r.status);
  for (let i = 0; i < 20; i++) assert.equal(await reg(`9.9.9.${i}`), 201, 'spoofed headers do not create new buckets');
  assert.equal(await reg('1.2.3.4'), 429, 'the real client address is what is limited');
});

test('oversized and malformed bodies are rejected', async () => {
  const token = await newDevice();
  const huge = await fetch(`${base}/v1/reports`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ note: 'x'.repeat(40000) }) }).then((r) => r.status).catch(() => 'reset');
  assert.ok(huge === 413 || huge === 'reset');
  const res = await fetch(`${base}/v1/reports`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: '{not json' });
  assert.equal(res.status, 400);
});

test('purge removes old trips and reports', async () => {
  const t = await newDevice();
  await call('POST', '/v1/trips', { token: t, body: trip() });
  await call('POST', '/v1/reports', { token: t, body: report() });
  clock += 31 * 24 * 60 * MIN;
  const out = api.community.purge();
  assert.equal(out.trips, 1); assert.equal(out.reports, 1);
});
