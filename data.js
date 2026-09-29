import { t } from './i18n';
import { MEXICO_BASE, CANADA_BASE, CROSSING_COORDS } from './crossingsData.mjs';
export { CROSSING_COORDS };
// ─── COLORS & THEME ───────────────────────────────────────────────────────────
export const BLUE = '#007AFF';
export const GREEN = '#30D158';
export const ORANGE = '#FF9F0A';
export const RED = '#FF453A';
export const STAR_COLOR = '#FF9F0A';
export const PURPLE = '#BF5AF2';

// ─── HOURS HELPERS ──────────────────────────────────────────────────────────

/**
 * Parse a crossing hours string like "6am–10pm" and return { openH, closeH }.
 * Returns null if the crossing is 24h or unparseable.
 */
const parseHours = (hoursStr) => {
  if (!hoursStr) return null;
  // Normalize – vs - and various dash variants
  const normalized = hoursStr.replace(/[–—]/g, '-').toLowerCase();
  const m = normalized.match(/(\d+)(?::(\d+))?(am|pm)?-(\d+)(?::(\d+))?(am|pm)?/);
  if (!m) return null;
  const toH = (h, min, ampm) => {
    let hour = parseInt(h, 10) % 12;
    if (ampm === 'pm') hour += 12;
    return hour + (parseInt(min || '0', 10)) / 60;
  };
  // Try to infer AM/PM from context if missing
  const openAmPm  = m[3] ?? (parseInt(m[1]) < 7 ? 'pm' : 'am');
  const closeAmPm = m[6] ?? 'pm';
  return { openH: toH(m[1], m[2], openAmPm), closeH: toH(m[4], m[5], closeAmPm) };
};

/**
 * Returns true when a non-24h crossing is currently open.
 * @param {string|undefined} hoursStr  e.g. "6am–10pm"
 */
export const isOpenNow = (hoursStr) => {
  const parsed = parseHours(hoursStr);
  if (!parsed) return true; // unparseable → assume open
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  if (parsed.closeH < parsed.openH) {
    // Crosses midnight e.g. 6am–2am
    return nowH >= parsed.openH || nowH < parsed.closeH;
  }
  return nowH >= parsed.openH && nowH < parsed.closeH;
};

/**
 * Returns minutes until the crossing closes, or null if 24h / already closed / unparseable.
 * Positive = open and closing in N minutes.
 */
export const getTimeUntilClose = (crossing) => {
  if (crossing.is24h) return null;
  const parsed = parseHours(crossing.hours);
  if (!parsed) return null;
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  let minsUntilClose;
  if (parsed.closeH < parsed.openH) {
    // Crosses midnight
    if (nowH >= parsed.openH) {
      minsUntilClose = (parsed.closeH + 24 - nowH) * 60;
    } else if (nowH < parsed.closeH) {
      minsUntilClose = (parsed.closeH - nowH) * 60;
    } else {
      return null; // closed
    }
  } else {
    if (nowH < parsed.openH || nowH >= parsed.closeH) return null; // closed
    minsUntilClose = (parsed.closeH - nowH) * 60;
  }
  return Math.round(minsUntilClose);
};

export const waitColor = (w) => {
  if (w == null || w < 0) return '#8E8E93';
  if (w <= 15) return GREEN;
  if (w <= 40) return ORANGE;
  return RED;
};

export const waitLevel = (w) => (w == null || w < 0 ? null : w <= 15 ? 'Low' : w <= 40 ? 'Moderate' : 'High');

export const waitLabel = (w) => {
  if (w == null || w < 0) return t('No data');
  if (w <= 15) return t('Low');
  if (w <= 40) return t('Moderate');
  return t('High');
};

export const colors = (dark) => ({
  bg: dark ? '#1C1C1E' : '#F2F2F7',
  card: dark ? '#2C2C2E' : '#FFFFFF',
  text: dark ? '#FFFFFF' : '#000000',
  subtext: '#8E8E93',
  divider: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
  inputBg: dark ? '#3A3A3C' : '#E5E5EA',
  tabBar: dark ? 'rgba(28,28,30,0.95)' : 'rgba(255,255,255,0.95)',
  headerBg: dark ? 'rgba(28,28,30,0.95)' : 'rgba(242,242,247,0.95)',
  chip: dark ? '#3A3A3C' : '#F2F2F7',
  chipText: dark ? '#AAAAAAAA' : '#555555',
  secondaryCard: dark ? '#3A3A3C' : '#F2F2F7',
});

// ─── CROSSING DATA ────────────────────────────────────────────────────────────
// Crossings start with NO wait data. Real values come only from the CBP feed
// (see fetch_cbp in context/AppContext.js); nothing here is simulated.
const generateCrossing = (base, border) => ({
  ...base,
  border,
  flag: border === 'MX' ? '🇲🇽' : '🇨🇦',
  live: false,
  updatedAt: null,
  wait: null,
  sentriWait: null,
  readyWait: null,
  laneStatus: null,
  portStatus: null,
  hoursText: null,
  pedWait: null,
  pedReadyWait: null,
  comWait: null,
  comFastWait: null,
  trend: null,
  predict1h: null,
  predict3h: null,
  sentriPredict1h: null,
  sentriPredict3h: null,
  readyPredict1h: null,
  readyPredict3h: null,
});

// Generic time-of-day shape used ONLY for rough "+1h / +3h" estimates. It is not
// measured per-crossing history; any UI showing its output must say "Est.".
const TYPICAL_HOURLY = Array.from({ length: 24 }, (_, h) =>
  8 + (h >= 6 && h <= 9 ? 40 : 0) + (h >= 16 && h <= 19 ? 45 : 0) + (h >= 11 && h <= 13 ? 25 : 0));

export const estimateWait = (wait, hoursAhead, from = new Date()) => {
  if (wait == null) return null;
  const h = from.getHours();
  const ratio = TYPICAL_HOURLY[(h + hoursAhead) % 24] / TYPICAL_HOURLY[h];
  return Math.max(0, Math.round(wait * Math.min(2, Math.max(0.5, ratio))));
};

// Where the crossing leads. `country` holds the far-side city when we know it;
// otherwise it just repeats the port name, so fall back to the country.
export const crossingTo = (c) => {
  const other = (c.country || '').trim().toLowerCase();
  const base = (c.city || '').split(',')[0].trim().toLowerCase();
  if (other && other !== base && other !== (c.name || '').toLowerCase()) return c.country;
  return c.border === 'MX' ? t('Mexico') : t('Canada');
};

// ─── DISTANCE / DRIVE TIME ────────────────────────────────────────────────────
export const distanceMi = (a, b) => {
  const R = 3958.8;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// Rough drive estimate: straight-line distance × 1.3 for road winding, at a speed that
// depends on trip length. Always shown as an estimate — it is not routed.
export const estimateDriveMin = (pos, crossing) => {
  const coords = CROSSING_COORDS[crossing?.id];
  if (!pos || !coords) return null;
  const miles = distanceMi(pos, coords) * 1.3;
  if (miles > 600) return null;
  const mph = miles <= 30 ? 30 : miles <= 100 ? 45 : 60;
  return Math.max(1, Math.round((miles / mph) * 60));
};

// Age of the reading itself: CBP's own timestamp when the feed gave one, otherwise the
// time we fetched it (which can only overstate freshness).
export const dataAgeMin = (c) => {
  const at = c?.cbpUpdatedAt ?? c?.updatedAt;
  return at ? Math.max(0, Math.round((Date.now() - at) / 60000)) : null;
};

export const STALE_AFTER_MIN = 90;
/** True when there is a wait but CBP's reading is older than `afterMin`. */
export const isStale = (c, afterMin = STALE_AFTER_MIN) => {
  const age = dataAgeMin(c);
  return c?.wait != null && age != null && age > afterMin;
};

// ─── LANE PREFERENCE ──────────────────────────────────────────────────────────
export const LANE_KEYS = ['standard', 'sentri', 'ready'];
export const laneLabel = (lane, border) =>
  lane === 'sentri' ? (border === 'MX' ? 'SENTRI' : 'NEXUS') : lane === 'ready' ? 'Ready Lane' : 'Standard';

/** Wait for the user's preferred lane, falling back to standard when that lane has no reading. */
export const laneWait = (c, lane = 'standard') => {
  const own = lane === 'sentri' ? c.sentriWait : lane === 'ready' ? c.readyWait : c.wait;
  if (own != null || lane === 'standard') return { wait: own ?? null, lane, fellBack: false };
  return { wait: c.wait ?? null, lane: 'standard', fellBack: c.wait != null };
};
export const lanePredict = (c, lane, hours) => {
  const k = hours === 1 ? '1h' : '3h';
  if (lane === 'sentri' && c.sentriWait != null) return c[`sentriPredict${k}`];
  if (lane === 'ready' && c.readyWait != null) return c[`readyPredict${k}`];
  return c[`predict${k}`];
};

export const fmtMin = (v, suffix = 'm') => (v == null ? '—' : `${v}${suffix}`);

// Ascending by wait; crossings with no data sort last.
export const byWaitAsc = (a, b) =>
  (a.wait ?? Infinity) === (b.wait ?? Infinity) ? 0 : (a.wait ?? Infinity) - (b.wait ?? Infinity);

export const ALL_CROSSINGS = [
  ...MEXICO_BASE.map((c) => generateCrossing(c, 'MX')),
  ...CANADA_BASE.map((c) => generateCrossing(c, 'CA')),
];

export const SEED_REPORTS = [];

export const SEED_TRIPS = [];

export const timeAgo = (minutes) => {
  if (minutes < 60) return t('{n}m ago', { n: minutes });
  return t('{n}h ago', { n: Math.floor(minutes / 60) });
};

export const MEXICO_BASE_LIST = MEXICO_BASE;
export const CANADA_BASE_LIST = CANADA_BASE;

