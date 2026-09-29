// Evaluates each device's alert rules against the latest readings and sends pushes.
// Mirrors the on-device logic (context/AppContext.js) so behaviour is the same with the app closed.
import { ALL } from './feed.js';

const COOLDOWN_MS = 15 * 60 * 1000;
const NAME = new Map(ALL.map((c) => [c.id, c.name]));

const TEXT = {
  en: {
    highTitle: (n) => `${n} – High Wait`,
    highBody: (w, th) => `Standard lane is ${w} min (your alert is set to ${th} min).`,
    dropTitle: (n) => `${n} – Wait Just Dropped! 🟢`,
    dropBody: (w) => `Now only ${w} min — good time to cross!`,
  },
  es: {
    highTitle: (n) => `${n} – Espera alta`,
    highBody: (w, th) => `El carril estándar tiene ${w} min (tu alerta está en ${th} min).`,
    dropTitle: (n) => `${n} – ¡La espera bajó! 🟢`,
    dropBody: (w) => `Ahora solo ${w} min — ¡buen momento para cruzar!`,
  },
};

export const laneMinutes = (reading, lane) => {
  if (!reading) return null;
  const own = lane === 'sentri' ? reading.sentri : lane === 'ready' ? reading.ready : reading.wait;
  return own ?? (lane === 'standard' ? null : reading.wait);   // fall back to standard like the app does
};

export const inQuietHours = (quiet, nowMs, tzOffsetMin) => {
  if (!quiet?.enabled) return false;
  const localHour = new Date(nowMs + tzOffsetMin * 60000).getUTCHours();
  const { start, end } = quiet;
  if (start === end) return true;
  return start < end ? localHour >= start && localHour < end : localHour >= start || localHour < end;
};

export const createAlerts = ({ db, feed, pusher }) => {
  const getState = db.prepare('SELECT * FROM alert_state WHERE device_id = ? AND crossing_id = ?');
  const putState = db.prepare(`INSERT INTO alert_state (device_id, crossing_id, prev_wait, last_high, last_drop)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(device_id, crossing_id) DO UPDATE SET
    prev_wait = excluded.prev_wait, last_high = excluded.last_high, last_drop = excluded.last_drop`);
  const dropToken = db.prepare('UPDATE devices SET push_token = NULL WHERE push_token = ?');

  /** Evaluate every rule once; returns how many notifications were sent. */
  const run = async (nowMs = Date.now()) => {
    const devices = db.prepare("SELECT * FROM devices WHERE push_token IS NOT NULL AND rules_json != '[]'").all();
    const messages = [];
    for (const d of devices) {
      const rules = JSON.parse(d.rules_json);
      const quiet = d.quiet_json ? JSON.parse(d.quiet_json) : null;
      const quietNow = inQuietHours(quiet, nowMs, d.tz_offset_min);
      const t = TEXT[d.lang] ?? TEXT.en;
      for (const rule of rules) {
        const wait = laneMinutes(feed.latest.get(rule.crossingId), rule.lane ?? 'standard');
        if (wait == null) continue;
        const st = getState.get(d.id, rule.crossingId) ?? { prev_wait: null, last_high: 0, last_drop: 0 };
        let lastHigh = st.last_high;
        let lastDrop = st.last_drop;
        const name = NAME.get(rule.crossingId) ?? rule.crossingId;

        if (wait > rule.threshold && nowMs - lastHigh >= COOLDOWN_MS && !quietNow) {
          lastHigh = nowMs;
          messages.push({ to: d.push_token, title: t.highTitle(name), body: t.highBody(wait, rule.threshold), data: { crossingId: rule.crossingId, type: 'high' } });
        }
        if (rule.lowAlert && st.prev_wait != null && st.prev_wait > rule.threshold && wait <= rule.threshold
            && nowMs - lastDrop >= COOLDOWN_MS && !quietNow) {
          lastDrop = nowMs;
          messages.push({ to: d.push_token, title: t.dropTitle(name), body: t.dropBody(wait), data: { crossingId: rule.crossingId, type: 'drop' } });
        }
        putState.run(d.id, rule.crossingId, wait, lastHigh, lastDrop);
      }
    }
    if (messages.length) {
      for (const token of await pusher.send(messages)) dropToken.run(token);
    }
    return messages.length;
  };

  return { run };
};
