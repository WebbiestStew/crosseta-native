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

export const waitLabel = (w) => {
  if (w == null || w < 0) return 'No data';
  if (w <= 15) return 'Low';
  if (w <= 40) return 'Moderate';
  return 'High';
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
const MEXICO_BASE = [
  { id: 'ANDRADE', name: 'Andrade', city: 'Andrade, Texas', country: 'Andrade', region: 'TX', is24h: false, hours: '6am–10pm', driveMin: 0 },
  { id: 'ANZALDUAS', name: 'Anzalduas International Bridge', city: 'Mission, Texas', country: 'Reynosa, Tamaulipas', region: 'TX', is24h: false, hours: '6am–10pm', driveMin: 0 },
  { id: 'BRIDGE_OF_THE_AMERICAS_PORT_OF_ENTRY', name: 'Bridge of the Americas Port of Entry', city: 'Bridge of the Americas Port of Entry, Texas', country: 'Bridge of the Americas Port of Entry', region: 'TX', is24h: true, driveMin: 0 },
  { id: 'BROWNSVILLE', name: 'Brownsville', city: 'Brownsville, Texas', country: 'Brownsville', region: 'TX', is24h: true, driveMin: 0 },
  { id: 'CALEXICO', name: 'Calexico', city: 'Calexico, California', country: 'Calexico', region: 'CA', is24h: true, driveMin: 0 },
  { id: 'COLUMBUS', name: 'Columbus', city: 'Columbus, New Mexico', country: 'Columbus', region: 'NM', is24h: true, driveMin: 0 },
  { id: 'DECONCINI', name: 'Deconcini', city: 'Deconcini, Arizona', country: 'Deconcini', region: 'AZ', is24h: true, driveMin: 0 },
  { id: 'DEL_RIO', name: 'Del Rio', city: 'Del Rio, Texas', country: 'Del Rio', region: 'TX', is24h: true, driveMin: 0 },
  { id: 'DOUGLAS_RAUL_HECTOR_CASTRO', name: 'Douglas (Raul Hector Castro)', city: 'Douglas (Raul Hector Castro), Arizona', country: 'Douglas (Raul Hector Castro)', region: 'AZ', is24h: true, driveMin: 0 },
  { id: 'EAGLE_PASS', name: 'Eagle Pass', city: 'Eagle Pass, Texas', country: 'Eagle Pass', region: 'TX', is24h: true, driveMin: 0 },
  { id: 'EL_PASO', name: 'El Paso', city: 'El Paso, Texas', country: 'El Paso', region: 'TX', is24h: true, driveMin: 0 },
  { id: 'FORT_HANCOCK', name: 'Fort Hancock', city: 'Fort Hancock, Texas', country: 'Fort Hancock', region: 'TX', is24h: false, hours: '6am–6pm', driveMin: 0 },
  { id: 'GATEWAY', name: 'Gateway', city: 'Gateway, Texas', country: 'Gateway', region: 'TX', is24h: true, driveMin: 0 },
  { id: 'HIDALGO_PHARR', name: 'Hidalgo/Pharr', city: 'Hidalgo/Pharr, Texas', country: 'Hidalgo/Pharr', region: 'TX', is24h: true, driveMin: 0 },
  { id: 'LAREDO', name: 'Laredo', city: 'Laredo, Texas', country: 'Laredo', region: 'TX', is24h: true, driveMin: 0 },
  { id: 'LUKEVILLE', name: 'Lukeville', city: 'Lukeville, Arizona', country: 'Lukeville', region: 'AZ', is24h: false, hours: '6am–8pm', driveMin: 0 },
  { id: 'MARIPOSA', name: 'Mariposa', city: 'Mariposa, Arizona', country: 'Mariposa', region: 'AZ', is24h: false, hours: '6am–10pm', driveMin: 0 },
  { id: 'MARCELINO_SERNA', name: 'Marcelino Serna', city: 'Marcelino Serna, Texas', country: 'Marcelino Serna', region: 'TX', is24h: false, hours: '6am–10pm', driveMin: 0 },
  { id: 'MORLEY_GATE', name: 'Morley Gate', city: 'Morley Gate, Arizona', country: 'Morley Gate', region: 'AZ', is24h: false, hours: '10am–6pm', driveMin: 0 },
  { id: 'NACO', name: 'Naco', city: 'Naco, Arizona', country: 'Naco', region: 'AZ', is24h: false, hours: '6am–10pm', driveMin: 0 },
  { id: 'OTAY_MESA', name: 'Otay Mesa', city: 'Otay Mesa, California', country: 'Otay Mesa', region: 'CA', is24h: true, driveMin: 0 },
  { id: 'PASO_DEL_NORTE', name: 'Paso Del Norte', city: 'Paso Del Norte, Texas', country: 'Paso Del Norte', region: 'TX', is24h: true, driveMin: 0 },
  { id: 'PRESIDIO', name: 'Presidio', city: 'Presidio, Texas', country: 'Presidio', region: 'TX', is24h: true, driveMin: 0 },
  { id: 'PROGRESO', name: 'Progreso', city: 'Progreso, Texas', country: 'Progreso', region: 'TX', is24h: false, hours: '6am–10pm', driveMin: 0 },
  { id: 'ROMA_TEXAS', name: 'ROMA TEXAS', city: 'ROMA TEXAS, Texas', country: 'ROMA TEXAS', region: 'TX', is24h: true, driveMin: 0 },
  { id: 'RIO_GRANDE_CITY', name: 'Rio Grande City', city: 'Rio Grande City, Texas', country: 'Rio Grande City', region: 'TX', is24h: false, hours: '7am–12am', driveMin: 0 },
  { id: 'ROMA', name: 'Roma', city: 'Roma, Texas', country: 'Roma', region: 'TX', is24h: true, driveMin: 0 },
  { id: 'SAN_LUIS', name: 'San Luis', city: 'San Luis, Arizona', country: 'San Luis', region: 'AZ', is24h: true, driveMin: 0 },
  { id: 'SAN_YSIDRO', name: 'San Ysidro', city: 'San Ysidro, California', country: 'San Ysidro', region: 'CA', is24h: true, driveMin: 0 },
  { id: 'SANTA_TERESA', name: 'Santa Teresa', city: 'Santa Teresa, Texas', country: 'Santa Teresa', region: 'TX', is24h: false, hours: '6am–10pm', driveMin: 0 },
  { id: 'TECATE', name: 'Tecate', city: 'Tecate, California', country: 'Tecate', region: 'CA', is24h: false, hours: '6am–10pm', driveMin: 0 },
];

const CANADA_BASE = [
  { id: 'ALEXANDRIA_BAY', name: 'Alexandria Bay', city: 'Alexandria Bay, Idaho', country: 'Alexandria Bay', region: 'ID', is24h: true, driveMin: 0 },
  { id: 'BLAINE', name: 'Blaine', city: 'Blaine, Washington', country: 'Blaine', region: 'WA', is24h: true, driveMin: 0 },
  { id: 'BUFFALO_NIAGARA_FALLS', name: 'Buffalo/Niagara Falls', city: 'Buffalo/Niagara Falls, New York', country: 'Buffalo/Niagara Falls', region: 'NY', is24h: true, driveMin: 0 },
  { id: 'CALAIS', name: 'Calais', city: 'Calais, Maine', country: 'Calais', region: 'ME', is24h: true, driveMin: 0 },
  { id: 'CHAMPLAIN', name: 'Champlain', city: 'Champlain, USA', country: 'Champlain', region: 'US', is24h: true, driveMin: 0 },
  { id: 'DERBY_LINE', name: 'Derby Line', city: 'Derby Line, Vermont', country: 'Derby Line', region: 'VT', is24h: true, driveMin: 0 },
  { id: 'DETROIT', name: 'Detroit', city: 'Detroit, Michigan', country: 'Detroit', region: 'MI', is24h: true, driveMin: 0 },
  { id: 'HIGHGATE_SPRINGS', name: 'Highgate Springs', city: 'Highgate Springs, Vermont', country: 'Highgate Springs', region: 'VT', is24h: true, driveMin: 0 },
  { id: 'HOULTON', name: 'Houlton', city: 'Houlton, Maine', country: 'Houlton', region: 'ME', is24h: true, driveMin: 0 },
  { id: 'INTERNATIONAL_FALLS', name: 'International Falls', city: 'International Falls, Minnesota', country: 'International Falls', region: 'MN', is24h: true, driveMin: 0 },
  { id: 'JACKMAN', name: 'Jackman', city: 'Jackman, Maine', country: 'Jackman', region: 'ME', is24h: true, driveMin: 0 },
  { id: 'LYNDEN', name: 'Lynden', city: 'Lynden, Washington', country: 'Lynden', region: 'WA', is24h: false, hours: '8am–12am', driveMin: 0 },
  { id: 'MADAWASKA', name: 'Madawaska', city: 'Madawaska, Maine', country: 'Madawaska', region: 'ME', is24h: true, driveMin: 0 },
  { id: 'MASSENA', name: 'Massena', city: 'Massena, New York', country: 'Massena', region: 'NY', is24h: true, driveMin: 0 },
  { id: 'NORTON', name: 'Norton', city: 'Norton, USA', country: 'Norton', region: 'US', is24h: true, driveMin: 0 },
  { id: 'OGDENSBURG', name: 'Ogdensburg', city: 'Ogdensburg, New York', country: 'Ogdensburg', region: 'NY', is24h: true, driveMin: 0 },
  { id: 'PEMBINA', name: 'Pembina', city: 'Pembina, North Dakota', country: 'Pembina', region: 'ND', is24h: true, driveMin: 0 },
  { id: 'PORT_HURON', name: 'Port Huron', city: 'Port Huron, Idaho', country: 'Port Huron', region: 'ID', is24h: true, driveMin: 0 },
  { id: 'SAULT_STE_MARIE', name: 'Sault Ste. Marie', city: 'Sault Ste. Marie, Michigan', country: 'Sault Ste. Marie', region: 'MI', is24h: true, driveMin: 0 },
  { id: 'SUMAS', name: 'Sumas', city: 'Sumas, Washington', country: 'Sumas', region: 'WA', is24h: true, driveMin: 0 },
  { id: 'SWEETGRASS', name: 'Sweetgrass', city: 'Sweetgrass, Montana', country: 'Sweetgrass', region: 'MT', is24h: true, driveMin: 0 },
];

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

export const dataAgeMin = (c) =>
  c?.updatedAt ? Math.max(0, Math.round((Date.now() - c.updatedAt) / 60000)) : null;

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
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
};

export const MEXICO_BASE_LIST = MEXICO_BASE;
export const CANADA_BASE_LIST = CANADA_BASE;

// ─── GPS COORDINATES ──────────────────────────────────────────────────────────
// Approximate lat/lon for each crossing — used by MapScreen
export const CROSSING_COORDS = {
  // Mexico crossings (30 ports)
  ANDRADE:                              { latitude: 25.8871, longitude: -97.1886 },
  ANZALDUAS:                            { latitude: 26.0694, longitude: -98.3002 },
  BRIDGE_OF_THE_AMERICAS_PORT_OF_ENTRY: { latitude: 31.7613, longitude: -106.4959 },
  BROWNSVILLE:                          { latitude: 25.9119, longitude: -97.4875 },
  CALEXICO:                             { latitude: 32.6721, longitude: -115.4898 },
  COLUMBUS:                             { latitude: 31.8264, longitude: -107.6429 },
  DECONCINI:                            { latitude: 31.9449, longitude: -110.9627 },
  DEL_RIO:                              { latitude: 29.3616, longitude: -100.8956 },
  DOUGLAS_RAUL_HECTOR_CASTRO:           { latitude: 31.3444, longitude: -109.5459 },
  EAGLE_PASS:                           { latitude: 28.7069, longitude: -100.4956 },
  EL_PASO:                              { latitude: 31.7567, longitude: -106.4876 },
  FORT_HANCOCK:                         { latitude: 31.3769, longitude: -105.9558 },
  GATEWAY:                              { latitude: 29.2725, longitude: -100.8892 },
  HIDALGO_PHARR:                        { latitude: 26.1038, longitude: -98.2617 },
  LAREDO:                               { latitude: 27.5305, longitude: -99.5074 },
  LUKEVILLE:                            { latitude: 31.8898, longitude: -112.8176 },
  MARIPOSA:                             { latitude: 31.9340, longitude: -110.9579 },
  MARCELINO_SERNA:                      { latitude: 31.4425, longitude: -106.9489 },
  MORLEY_GATE:                          { latitude: 31.9325, longitude: -110.9614 },
  NACO:                                 { latitude: 31.3345, longitude: -109.9479 },
  OTAY_MESA:                            { latitude: 32.5559, longitude: -116.9919 },
  PASO_DEL_NORTE:                       { latitude: 31.7650, longitude: -106.4950 },
  PRESIDIO:                             { latitude: 29.5604, longitude: -104.3670 },
  PROGRESO:                             { latitude: 26.0756, longitude: -97.9640 },
  ROMA_TEXAS:                           { latitude: 26.4161, longitude: -99.0284 },
  RIO_GRANDE_CITY:                      { latitude: 26.3745, longitude: -98.8174 },
  ROMA:                                 { latitude: 26.4161, longitude: -99.0284 },
  SAN_LUIS:                             { latitude: 32.4890, longitude: -114.7910 },
  SAN_YSIDRO:                           { latitude: 32.5424, longitude: -117.0291 },
  SANTA_TERESA:                         { latitude: 31.8650, longitude: -106.6917 },
  TECATE:                               { latitude: 32.5718, longitude: -116.6261 },
  // Canada crossings (21 ports)
  ALEXANDRIA_BAY:                       { latitude: 44.2987, longitude: -75.9754 },
  BLAINE:                               { latitude: 48.9921, longitude: -122.7536 },
  BUFFALO_NIAGARA_FALLS:                { latitude: 43.0829, longitude: -79.0849 },
  CALAIS:                               { latitude: 45.1848, longitude: -67.2786 },
  CHAMPLAIN:                            { latitude: 44.9843, longitude: -73.4451 },
  DERBY_LINE:                           { latitude: 45.0047, longitude: -72.1024 },
  DETROIT:                              { latitude: 42.3249, longitude: -83.0684 },
  HIGHGATE_SPRINGS:                     { latitude: 44.9875, longitude: -72.9540 },
  HOULTON:                              { latitude: 46.1196, longitude: -67.8441 },
  INTERNATIONAL_FALLS:                  { latitude: 48.5955, longitude: -93.3992 },
  JACKMAN:                              { latitude: 45.6234, longitude: -70.2854 },
  LYNDEN:                               { latitude: 48.9468, longitude: -122.4552 },
  MADAWASKA:                            { latitude: 47.2484, longitude: -68.3868 },
  MASSENA:                              { latitude: 45.0049, longitude: -74.9166 },
  NORTON:                               { latitude: 45.0065, longitude: -71.7981 },
  OGDENSBURG:                           { latitude: 44.6769, longitude: -75.7044 },
  PEMBINA:                              { latitude: 48.9727, longitude: -97.2396 },
  PORT_HURON:                           { latitude: 42.9920, longitude: -82.4252 },
  SAULT_STE_MARIE:                      { latitude: 46.4882, longitude: -84.3543 },
  SUMAS:                                { latitude: 49.0005, longitude: -122.2672 },
  SWEETGRASS:                           { latitude: 48.9998, longitude: -111.5217 },
};
