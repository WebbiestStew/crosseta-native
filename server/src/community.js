// Community data: measured waits from tracked trips, and moderated wait reports.
//
// Privacy: trips store only crossing, lane and start/end times (no coordinates). The device id
// is kept for rate-limiting and de-duplication and is never returned to other devices.
// Abuse controls: plausibility checks on trips, per-device rate limits, a minimum number of
// distinct devices before a measured wait is published, URL/contact-info filtering on notes,
// and auto-hiding of reports once three different devices flag them.
import { randomBytes } from 'node:crypto';
import { ALL } from './feed.js';
import { MEXICO_BASE } from '../../crossingsData.mjs';

const BY_ID = new Map(ALL.map((c) => [c.id, c]));
const MEXICO_IDS = new Set(MEXICO_BASE.map((c) => c.id));
const LANES = new Set(['standard', 'sentri', 'ready']);
const REPORT_LANES = new Set(['Standard', 'SENTRI / NEXUS', 'Ready Lane']);
const COLORS = ['#007AFF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF453A', '#5AC8FA', '#FF375F', '#64D2FF'];
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

// ─── Notes ──────────────────────────────────────────────────────────────────
const URLISH = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|mx|ca|us|app|me|ly)\b)/i;
const CONTACT = /(\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b|[\w.+-]+@[\w-]+\.[\w.]+|whatsapp|telegram)/i;

export const cleanNote = (raw) => {
  const note = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (URLISH.test(note)) throw new HttpError(422, 'Links are not allowed in reports.');
  if (CONTACT.test(note)) throw new HttpError(422, 'Please leave contact details out of reports.');
  return note;
};

const cleanName = (raw) => String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24) || 'Traveler';
const initialsOf = (name) => {
  const parts = name.split(' ').filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
};
const colorFor = (deviceId) => COLORS[parseInt(deviceId.slice(0, 4), 16) % COLORS.length];

export const createCommunity = ({ db, now = () => Date.now() }) => {
  // ─── Trips ────────────────────────────────────────────────────────────────
  const insertTrip = db.prepare('INSERT INTO trips (device_id, crossing_id, lane, start_ms, end_ms, wait_min) VALUES (?, ?, ?, ?, ?, ?)');

  const addTrip = (deviceId, body) => {
    const c = BY_ID.get(body.crossingId);
    if (!c) throw new HttpError(422, 'Unknown crossing.');
    const lane = LANES.has(body.lane) ? body.lane : null;
    if (!lane) throw new HttpError(422, 'Unknown lane.');
    const start = Number(body.startTime);
    const end = Number(body.endTime);
    const wait = Number(body.actualWait);
    const t = now();
    if (![start, end, wait].every(Number.isFinite)) throw new HttpError(422, 'Invalid trip.');
    if (end > t + 2 * MIN || end < t - 12 * HOUR) throw new HttpError(422, 'Trip time out of range.');
    if (wait < 1 || wait > 360) throw new HttpError(422, 'Wait out of range.');
    // The reported wait must agree with the timestamps (within a minute of rounding).
    if (Math.abs((end - start) / MIN - wait) > 1.5) throw new HttpError(422, 'Trip times do not match the wait.');
    const recent = db.prepare('SELECT COUNT(*) n FROM trips WHERE device_id = ? AND crossing_id = ? AND end_ms > ?').get(deviceId, c.id, t - 10 * MIN);
    if (recent.n > 0) throw new HttpError(429, 'Trip already recorded.');
    const perDay = db.prepare('SELECT COUNT(*) n FROM trips WHERE device_id = ? AND end_ms > ?').get(deviceId, t - 24 * HOUR);
    if (perDay.n >= 12) throw new HttpError(429, 'Too many trips today.');
    insertTrip.run(deviceId, c.id, lane, start, end, Math.round(wait));
  };

  /** Median measured wait per crossing/lane over the last 90 min, only when enough devices agree. */
  const measuredWaits = ({ minDevices, crossingId } = {}) => {
    const since = now() - 90 * MIN;
    const rows = db.prepare(`SELECT crossing_id, lane, device_id, wait_min, end_ms FROM trips WHERE end_ms > ?${crossingId ? ' AND crossing_id = ?' : ''}`)
      .all(...(crossingId ? [since, crossingId] : [since]));
    const groups = new Map();
    for (const r of rows) {
      const k = `${r.crossing_id}|${r.lane}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const out = {};
    for (const [k, list] of groups) {
      // One vote per device: its most recent trip.
      const perDevice = new Map();
      for (const r of list) if (!perDevice.has(r.device_id) || perDevice.get(r.device_id).end_ms < r.end_ms) perDevice.set(r.device_id, r);
      if (perDevice.size < minDevices) continue;
      const [cid, lane] = k.split('|');
      const picks = [...perDevice.values()];
      (out[cid] ??= {})[lane] = { minutes: median(picks.map((r) => r.wait_min)), n: picks.length, at: Math.max(...picks.map((r) => r.end_ms)) };
    }
    return out;
  };

  // ─── Reports ──────────────────────────────────────────────────────────────
  const addReport = (deviceId, body) => {
    const c = BY_ID.get(body.crossingId);
    if (!c) throw new HttpError(422, 'Unknown crossing.');
    if (!REPORT_LANES.has(body.lane)) throw new HttpError(422, 'Unknown lane.');
    const wait = Math.round(Number(body.wait));
    if (!Number.isFinite(wait) || wait < 0 || wait > 300) throw new HttpError(422, 'Wait out of range.');
    const note = cleanNote(body.note);
    const t = now();
    const last = db.prepare('SELECT MAX(created_at) at FROM reports WHERE device_id = ? AND crossing_id = ?').get(deviceId, c.id);
    if (last.at && t - last.at < 10 * MIN) {
      throw new HttpError(429, `Please wait ${Math.ceil((10 * MIN - (t - last.at)) / MIN)} min before posting another report for this crossing.`);
    }
    const day = db.prepare('SELECT COUNT(*) n FROM reports WHERE device_id = ? AND created_at > ?').get(deviceId, t - 24 * HOUR);
    if (day.n >= 10) throw new HttpError(429, 'Daily report limit reached.');
    const dup = db.prepare(`SELECT 1 FROM reports WHERE crossing_id = ? AND lane = ? AND hidden = 0 AND created_at > ? AND ABS(wait_min - ?) <= 5 LIMIT 1`)
      .get(c.id, body.lane, t - 15 * MIN, wait);
    if (dup) throw new HttpError(409, 'A very similar report was just posted. Upvote it instead.');
    const author = cleanName(body.author);
    const id = `r_${randomBytes(8).toString('hex')}`;
    db.prepare(`INSERT INTO reports (id, device_id, crossing_id, crossing_name, border, lane, wait_min, note, author, initials, color, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, deviceId, c.id, c.name, MEXICO_IDS.has(c.id) ? 'MX' : 'CA', body.lane, wait, note, author, initialsOf(author), colorFor(deviceId), t);
    return { id };
  };

  const shape = (r, viewer) => {
    const votes = db.prepare('SELECT device_id, value FROM report_votes WHERE report_id = ?').all(r.id);
    const mine = votes.find((v) => v.device_id === viewer)?.value ?? 0;
    // Counts exclude the viewer's own vote: the app adds it back locally (see ReportCard).
    const others = votes.filter((v) => v.device_id !== viewer);
    const up = others.filter((v) => v.value > 0).length;
    const down = others.filter((v) => v.value < 0).length;
    const flags = db.prepare('SELECT COUNT(*) n FROM report_flags WHERE report_id = ?').get(r.id).n;
    const trust = Math.max(0, Math.min(100, 60 + (r.note ? 8 : 0) + 3 * (up + (mine > 0 ? 1 : 0)) - 5 * (down + (mine < 0 ? 1 : 0)) - 12 * flags));
    return {
      id: r.id, crossingId: r.crossing_id, crossingName: r.crossing_name, border: r.border,
      lane: r.lane, wait: r.wait_min, note: r.note, author: r.author, initials: r.initials, avatarColor: r.color,
      upvotes: up, downvotes: down, flags, hidden: false, trustScore: trust,
      time: Math.max(0, Math.round((now() - r.created_at) / MIN)), ts: new Date(r.created_at).toISOString(),
      myVote: mine > 0 ? 'up' : mine < 0 ? 'down' : null, mine: r.device_id === viewer,
    };
  };

  const listReports = (viewer, { crossingId, limit = 50 } = {}) => {
    const since = now() - 48 * HOUR;
    const rows = db.prepare(`SELECT * FROM reports WHERE hidden = 0 AND created_at > ?${crossingId ? ' AND crossing_id = ?' : ''} ORDER BY created_at DESC LIMIT ?`)
      .all(...(crossingId ? [since, crossingId, Math.min(limit, 100)] : [since, Math.min(limit, 100)]));
    return rows.map((r) => shape(r, viewer));
  };

  const vote = (deviceId, reportId, value) => {
    const r = db.prepare('SELECT * FROM reports WHERE id = ? AND hidden = 0').get(reportId);
    if (!r) throw new HttpError(404, 'Report not found.');
    if (r.device_id === deviceId) throw new HttpError(403, 'You cannot vote on your own report.');
    if (value === null || value === 0 || value === 'none') {
      db.prepare('DELETE FROM report_votes WHERE report_id = ? AND device_id = ?').run(reportId, deviceId);
    } else {
      const v = value === 'up' || value === 1 ? 1 : value === 'down' || value === -1 ? -1 : null;
      if (v === null) throw new HttpError(422, 'Invalid vote.');
      db.prepare(`INSERT INTO report_votes (report_id, device_id, value) VALUES (?, ?, ?)
        ON CONFLICT(report_id, device_id) DO UPDATE SET value = excluded.value`).run(reportId, deviceId, v);
    }
  };

  const flag = (deviceId, reportId) => {
    const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
    if (!r) throw new HttpError(404, 'Report not found.');
    if (r.device_id === deviceId) throw new HttpError(403, 'You cannot flag your own report.');
    db.prepare('INSERT OR IGNORE INTO report_flags (report_id, device_id) VALUES (?, ?)').run(reportId, deviceId);
    const n = db.prepare('SELECT COUNT(*) n FROM report_flags WHERE report_id = ?').get(reportId).n;
    if (n >= 3) db.prepare('UPDATE reports SET hidden = 1 WHERE id = ?').run(reportId);
    return { flags: n, hidden: n >= 3 };
  };

  const purge = () => {
    const t = now();
    return {
      trips: db.prepare('DELETE FROM trips WHERE end_ms < ?').run(t - 30 * 24 * HOUR).changes,
      reports: db.prepare('DELETE FROM reports WHERE created_at < ?').run(t - 14 * 24 * HOUR).changes,
    };
  };

  return { addTrip, measuredWaits, addReport, listReports, vote, flag, purge };
};
