// Wait-time history logic. Pure (no React Native imports) so the server can share it.
//
// CBP only publishes the *current* wait, so history is built by folding every live reading
// into a weekday×hour bucket per crossing. A bucket stores one mean per calendar day (not
// per sample), so opening the app for 15 minutes can't masquerade as a pattern; predictions
// only use a bucket once it has MIN_DAYS distinct days.
//
// Bucket layout: [priorSum, priorDays, dayKey, dayMean, daySamples]
//   history = { [crossingId]: { [weekday*24 + hour]: bucket } }
//
// Two sources feed the same shape:
//   - recorded on this device (history[id]), bucketed by the device's clock
//   - downloaded from the server (history.__server[id] = { tz, buckets }), which has months of
//     samples and buckets by the *port's* clock; `tz` is the port's UTC offset in hours.
// A crossing with server data uses it in preference to the local record.

export const MIN_DAYS = 3;

const bucketKey = (d) => d.getDay() * 24 + d.getHours();
const dayKey = (d) => d.getFullYear() * 1000 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);

/** A Date whose local getters (getDay/getHours) read as the wall clock at UTC offset `tzHours`. */
export const toPortClock = (date, tzHours) =>
  new Date(date.getTime() + tzHours * 3600000 + date.getTimezoneOffset() * 60000);

/** Fold the current standard-lane waits into `history` (mutates and returns it). */
export const recordSamples = (history, crossings, now = new Date()) => {
  const key = bucketKey(now);
  const today = dayKey(now);
  crossings.forEach((c) => {
    if (c.wait == null) return;
    const perCrossing = (history[c.id] ??= {});
    const b = perCrossing[key];
    if (!b) {
      perCrossing[key] = [0, 0, today, c.wait, 1];
    } else if (b[2] !== today) {
      perCrossing[key] = [b[0] + b[3], b[1] + 1, today, c.wait, 1];
    } else {
      const n = b[4];
      b[3] = (b[3] * n + c.wait) / (n + 1);
      b[4] = n + 1;
    }
  });
  return history;
};

const summarize = (b) => (b ? { mean: (b[0] + b[3]) / (b[1] + 1), days: b[1] + 1 } : null);

/** Which buckets to read for `id`, and the clock to read them on. */
const source = (history, id, date) => {
  const server = history?.__server?.[id];
  if (server?.buckets && Object.keys(server.buckets).length) {
    return { buckets: server.buckets, clock: toPortClock(date, server.tz ?? 0) };
  }
  return { buckets: history?.[id], clock: date };
};

/** Typical wait for a crossing at `date`, or null until enough days are recorded. */
export const typicalWait = (history, id, date) => {
  const { buckets, clock } = source(history, id, date);
  const s = summarize(buckets?.[bucketKey(clock)]);
  return s && s.days >= MIN_DAYS ? Math.round(s.mean) : null;
};

/** 24 entries (hour 0-23) for one weekday: { mean, days } or null where there is no data. */
export const dayProfile = (history, id, weekday) => {
  const { buckets } = source(history, id, new Date());
  return Array.from({ length: 24 }, (_, h) => summarize(buckets?.[weekday * 24 + h]));
};

/** The clock (Date whose getters read as the port's wall clock) to use with dayProfile. */
export const clockFor = (history, id, date = new Date()) => source(history, id, date).clock;

/** How many distinct days back the best-covered bucket goes (for the "based on N days" label). */
export const historyDays = (history, id) => {
  const { buckets } = source(history, id, new Date());
  return Object.values(buckets ?? {}).reduce((m, b) => Math.max(m, b[1] + 1), 0);
};

/** Crossings that have any recorded local history (ignores the server cache entry). */
export const recordedCrossingCount = (history) =>
  Object.keys(history ?? {}).filter((k) => k !== '__server').length;

/**
 * "Leave now or wait?" — compares the current wait with the recorded pattern.
 * Returns null when there is no basis for advice (no wait, or not enough history yet).
 *   kind: good (below usual) | wait (above usual, usually drops later) | high (above usual, no relief soon)
 *         later (near usual now, but usually lower soon) | typical
 */
export const waitAdvice = (history, id, wait, now = new Date()) => {
  if (wait == null) return null;
  const usual = typicalWait(history, id, now);
  let best = null;
  for (let h = 1; h <= 6; h++) {
    const at = new Date(now.getTime() + h * 3600000);
    const v = typicalWait(history, id, at);
    if (v != null && (best == null || v < best.wait)) best = { wait: v, hours: h, at };
  }
  const relief = best && best.wait <= wait - 10;
  if (usual == null && !best) return null;
  if (usual != null) {
    if (wait <= usual - 5) return { kind: 'good', usual };
    if (wait >= usual + 10) return relief ? { kind: 'wait', usual, diff: wait - usual, best } : { kind: 'high', usual, diff: wait - usual };
  }
  if (relief) return { kind: 'later', best };
  return usual != null ? { kind: 'typical', usual } : null;
};
