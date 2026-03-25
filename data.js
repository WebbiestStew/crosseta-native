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
  if (w == null || w < 0) return 'Closed';
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

const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateCrossing = (base, border) => {
  const hour = new Date().getHours();
  const isPeak = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18);
  const wait = rnd(isPeak ? 25 : 5, isPeak ? 70 : 50);
  const trend = Math.random() > 0.6 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable';
  const predict1h = Math.max(0, wait + (trend === 'up' ? 12 : trend === 'down' ? -8 : 2) + rnd(0, 5));
  const predict3h = Math.max(0, wait + (trend === 'up' ? 22 : trend === 'down' ? -15 : 5) + rnd(0, 10));

  const hourlyPattern = Array.from({ length: 24 }, (_, h) => {
    const morning = h >= 6 && h <= 9 ? 40 : 0;
    const evening = h >= 16 && h <= 19 ? 45 : 0;
    const midday = h >= 11 && h <= 13 ? 25 : 0;
    return Math.max(0, 8 + morning + evening + midday + rnd(0, 15));
  });

  const weeklyPattern = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => ({
    day,
    slots: ['6am', '9am', '12pm', '3pm', '6pm', '9pm'].map((slot) => {
      const isWeekend = day === 'Sat' || day === 'Sun';
      const isEveningFri = day === 'Fri' && (slot === '3pm' || slot === '6pm');
      let w = rnd(5, 35);
      if (isWeekend && (slot === '9am' || slot === '12pm')) w += 30;
      if (isEveningFri) w += 20;
      return { slot, wait: w };
    }),
  }));

  const allSlots = weeklyPattern.flatMap((d) => d.slots.map((s) => ({ ...s, day: d.day })));
  const best = allSlots.sort((a, b) => a.wait - b.wait)[0];

  return {
    ...base,
    border,
    flag: border === 'MX' ? '🇲🇽' : '🇨🇦',
    wait,
    sentriWait: Math.max(0, Math.floor(wait * 0.35)),
    readyWait: Math.max(0, Math.floor(wait * 0.65)),
    trend,
    predict1h,
    predict3h,
    sentriPredict1h: Math.max(0, Math.floor(predict1h * 0.35)),
    sentriPredict3h: Math.max(0, Math.floor(predict3h * 0.35)),
    readyPredict1h: Math.max(0, Math.floor(predict1h * 0.65)),
    readyPredict3h: Math.max(0, Math.floor(predict3h * 0.65)),
    confidence: rnd(78, 97),
    dataAge: rnd(1, 12),
    predictionAccuracy: rnd(82, 96),
    hourlyPattern,
    weeklyPattern,
    bestTimeToday: `${best.day} ${best.slot} (~${best.wait} min)`,
    sparkline: Array.from({ length: 10 }, () => rnd(5, 65)),
  };
};

export const ALL_CROSSINGS = [
  ...MEXICO_BASE.map((c) => generateCrossing(c, 'MX')),
  ...CANADA_BASE.map((c) => generateCrossing(c, 'CA')),
];

const _now = Date.now();
export const SEED_REPORTS = [
  { id: 'r1', crossingId: 'SAN_YSIDRO', crossingName: 'San Ysidro', border: 'MX', lane: 'Standard', wait: 55, note: 'Really backed up, construction in lanes 4–6.', author: 'Maria G.', initials: 'MG', avatarColor: BLUE, time: 12, upvotes: 14, downvotes: 1, region: 'California', ts: new Date(_now - 12 * 60000).toISOString() },
  { id: 'r2', crossingId: 'OTAY_MESA', crossingName: 'Otay Mesa', border: 'MX', lane: 'SENTRI', wait: 8, note: 'SENTRI flying through, under 10 min!', author: 'James R.', initials: 'JR', avatarColor: GREEN, time: 28, upvotes: 9, downvotes: 0, region: 'California', ts: new Date(_now - 28 * 60000).toISOString() },
  { id: 'r3', crossingId: 'AMBASSADOR', crossingName: 'Ambassador Bridge', border: 'CA', lane: 'NEXUS', wait: 12, note: 'Nexus lane open, went smooth.', author: 'Sarah T.', initials: 'ST', avatarColor: ORANGE, time: 45, upvotes: 7, downvotes: 1, region: 'Great Lakes', ts: new Date(_now - 45 * 60000).toISOString() },
  { id: 'r4', crossingId: 'LAREDO_I', crossingName: 'Laredo I', border: 'MX', lane: 'Standard', wait: 78, note: 'Massive backup, accident near bridge approach.', author: 'Carlos M.', initials: 'CM', avatarColor: RED, time: 67, upvotes: 22, downvotes: 2, region: 'Texas South', ts: new Date(_now - 67 * 60000).toISOString() },
  { id: 'r5', crossingId: 'PEACE_ARCH', crossingName: 'Peace Arch / Blaine', border: 'CA', lane: 'Ready Lane', wait: 18, note: 'Ready Lane moving well.', author: 'Priya K.', initials: 'PK', avatarColor: PURPLE, time: 90, upvotes: 5, downvotes: 0, region: 'Pacific Northwest', ts: new Date(_now - 90 * 60000).toISOString() },
  { id: 'r6', crossingId: 'MCALLEN_HIDALGO', crossingName: 'McAllen-Hidalgo', border: 'MX', lane: 'Standard', wait: 42, note: 'Moderate wait, extra agents on duty.', author: 'Luis F.', initials: 'LF', avatarColor: ORANGE, time: 110, upvotes: 3, downvotes: 1, region: 'Texas Valley', ts: new Date(_now - 110 * 60000).toISOString() },
  { id: 'r7', crossingId: 'RAINBOW', crossingName: 'Rainbow Bridge', border: 'CA', lane: 'NEXUS', wait: 5, note: 'NEXUS basically empty right now.', author: 'Dave W.', initials: 'DW', avatarColor: GREEN, time: 135, upvotes: 11, downvotes: 0, region: 'Niagara / Northeast', ts: new Date(_now - 135 * 60000).toISOString() },
];

export const SEED_TRIPS = [
  { id: 't1', crossingId: 'SAN_YSIDRO', crossingName: 'San Ysidro', lane: 'SENTRI', flag: '🇲🇽', actual: 12, predicted: 10, diff: 2, ts: new Date('2026-03-01T09:30:00').toISOString() },
  { id: 't2', crossingId: 'AMBASSADOR', crossingName: 'Ambassador Bridge', lane: 'NEXUS', flag: '🇨🇦', actual: 35, predicted: 28, diff: 7, ts: new Date('2026-02-27T14:00:00').toISOString() },
  { id: 't3', crossingId: 'OTAY_MESA', crossingName: 'Otay Mesa', lane: 'Standard', flag: '🇲🇽', actual: 48, predicted: 45, diff: 3, ts: new Date('2026-02-24T08:15:00').toISOString() },
  { id: 't4', crossingId: 'PEACE_ARCH', crossingName: 'Peace Arch / Blaine', lane: 'Ready Lane', flag: '🇨🇦', actual: 22, predicted: 38, diff: -16, ts: new Date('2026-02-20T11:00:00').toISOString() },
];

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
