// Polls the CBP feed, keeps the latest reading per crossing, and records real history.
import { summarizeCrossing } from '../../cbp.mjs';
import { recordSamples, toPortClock } from '../../historyCore.mjs';
import { MEXICO_BASE, CANADA_BASE } from '../../crossingsData.mjs';

export const ALL = [...MEXICO_BASE, ...CANADA_BASE];

export const createFeed = ({ db, feedUrl, fetchImpl = fetch }) => {
  /** id -> { wait, sentri, ready, closed, updatedAt, fetchedAt } */
  const latest = new Map();
  /** id -> { [bucket]: [priorSum, priorDays, dayKey, dayMean, daySamples] } (mirrors the DB) */
  const history = {};
  const tz = new Map();

  // Load what earlier runs recorded so history survives restarts.
  for (const r of db.prepare('SELECT * FROM history').all()) {
    (history[r.crossing_id] ??= {})[r.bucket] = [r.prior_sum, r.prior_days, r.day_key, r.day_mean, r.day_n];
  }
  for (const r of db.prepare('SELECT * FROM crossing_meta').all()) tz.set(r.crossing_id, r.tz_offset_h);

  const upsertBucket = db.prepare(`
    INSERT INTO history (crossing_id, bucket, prior_sum, prior_days, day_key, day_mean, day_n)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(crossing_id, bucket) DO UPDATE SET
      prior_sum = excluded.prior_sum, prior_days = excluded.prior_days,
      day_key = excluded.day_key, day_mean = excluded.day_mean, day_n = excluded.day_n`);
  const upsertTz = db.prepare(`INSERT INTO crossing_meta (crossing_id, tz_offset_h) VALUES (?, ?)
    ON CONFLICT(crossing_id) DO UPDATE SET tz_offset_h = excluded.tz_offset_h`);

  const ingest = (rows, now = new Date()) => {
    let recorded = 0;
    db.exec('BEGIN');
    try {
      for (const c of ALL) {
        const s = summarizeCrossing(rows, c, ALL);
        if (!s) continue;
        if (s.tzOffsetH != null && tz.get(c.id) !== s.tzOffsetH) {
          tz.set(c.id, s.tzOffsetH);
          upsertTz.run(c.id, s.tzOffsetH);
        }
        latest.set(c.id, {
          wait: s.std.minutes, closed: s.std.closed, sentri: s.sentri.minutes, ready: s.ready.minutes,
          updatedAt: s.cbpUpdatedAt ?? null, fetchedAt: now.getTime(),
        });
        if (s.std.minutes == null) continue;
        // Bucket by the port's own wall clock so "8 AM" means 8 AM at the border.
        const offset = tz.get(c.id);
        if (offset == null) continue;
        const clock = toPortClock(now, offset);
        recordSamples(history, [{ id: c.id, wait: s.std.minutes }], clock);
        const key = clock.getDay() * 24 + clock.getHours();
        const b = history[c.id][key];
        upsertBucket.run(c.id, key, b[0], b[1], b[2], b[3], b[4]);
        recorded++;
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return recorded;
  };

  const poll = async () => {
    const res = await fetchImpl(feedUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('feed was not an array');
    return ingest(rows);
  };

  /** Recorded buckets plus the port's UTC offset, in the shape the app's history code reads. */
  const historyFor = (id) => ({ id, tz: tz.get(id) ?? null, buckets: history[id] ?? {} });

  return { latest, poll, ingest, historyFor, tz };
};
