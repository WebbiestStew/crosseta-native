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
  { id: 'SAN_YSIDRO', name: 'San Ysidro', city: 'San Diego, CA', country: 'Tijuana, BC', region: 'California', is24h: true, driveMin: 0 },
  { id: 'OTAY_MESA', name: 'Otay Mesa', city: 'San Diego, CA', country: 'Tijuana, BC', region: 'California', is24h: true, driveMin: 8 },
  { id: 'TECATE', name: 'Tecate', city: 'Tecate, CA', country: 'Tecate, BC', region: 'California', is24h: false, hours: '6am–2am', driveMin: 45 },
  { id: 'ANDRADE', name: 'Andrade / Los Algodones', city: 'Andrade, CA', country: 'Los Algodones, BC', region: 'California', is24h: false, hours: '6am–10pm', driveMin: 92 },
  { id: 'SAN_LUIS_I', name: 'San Luis I', city: 'San Luis, AZ', country: 'San Luis, Son.', region: 'Arizona', is24h: true, driveMin: 18 },
  { id: 'SAN_LUIS_II', name: 'San Luis II', city: 'San Luis, AZ', country: 'San Luis, Son.', region: 'Arizona', is24h: false, hours: '8am–12am', driveMin: 21 },
  { id: 'LUKEVILLE', name: 'Lukeville / Sonoyta', city: 'Lukeville, AZ', country: 'Sonoyta, Son.', region: 'Arizona', is24h: false, hours: '6am–12am', driveMin: 74 },
  { id: 'SASABE', name: 'Sasabe', city: 'Sasabe, AZ', country: 'Sásabe, Son.', region: 'Arizona', is24h: false, hours: '8am–8pm', driveMin: 65 },
  { id: 'DOUGLAS', name: 'Douglas / Agua Prieta', city: 'Douglas, AZ', country: 'Agua Prieta, Son.', region: 'Arizona', is24h: true, driveMin: 0 },
  { id: 'NACO', name: 'Naco', city: 'Naco, AZ', country: 'Naco, Son.', region: 'Arizona', is24h: false, hours: '8am–12am', driveMin: 12 },
  { id: 'SANTA_TERESA', name: 'Santa Teresa', city: 'Santa Teresa, NM', country: 'San Jerónimo, Chih.', region: 'New Mexico', is24h: true, driveMin: 25 },
  { id: 'COLUMBUS', name: 'Columbus / Puerto Palomas', city: 'Columbus, NM', country: 'Puerto Palomas, Chih.', region: 'New Mexico', is24h: false, hours: '6am–10pm', driveMin: 32 },
  { id: 'BOTA', name: 'Bridge of the Americas', city: 'El Paso, TX', country: 'Cd. Juárez, Chih.', region: 'Texas West', is24h: true, driveMin: 5 },
  { id: 'PASO_DEL_NORTE', name: 'Paso del Norte', city: 'El Paso, TX', country: 'Cd. Juárez, Chih.', region: 'Texas West', is24h: true, driveMin: 2 },
  { id: 'YSLETA', name: 'Ysleta / Zaragoza', city: 'El Paso, TX', country: 'Cd. Juárez, Chih.', region: 'Texas West', is24h: true, driveMin: 10 },
  { id: 'PRESIDIO', name: 'Presidio / Ojinaga', city: 'Presidio, TX', country: 'Ojinaga, Chih.', region: 'Texas West', is24h: false, hours: '8am–12am', driveMin: 0 },
  { id: 'DEL_RIO', name: 'Del Rio / Cd. Acuña', city: 'Del Rio, TX', country: 'Cd. Acuña, Coah.', region: 'Texas South', is24h: true, driveMin: 0 },
  { id: 'EAGLE_PASS_I', name: 'Eagle Pass I', city: 'Eagle Pass, TX', country: 'Piedras Negras, Coah.', region: 'Texas South', is24h: true, driveMin: 3 },
  { id: 'EAGLE_PASS_II', name: 'Eagle Pass II', city: 'Eagle Pass, TX', country: 'Piedras Negras, Coah.', region: 'Texas South', is24h: false, hours: '6am–12am', driveMin: 5 },
  { id: 'LAREDO_I', name: 'Laredo I (Gateway)', city: 'Laredo, TX', country: 'Nuevo Laredo, Tamp.', region: 'Texas South', is24h: true, driveMin: 0 },
  { id: 'LAREDO_II', name: 'Laredo II (World Trade)', city: 'Laredo, TX', country: 'Nuevo Laredo, Tamp.', region: 'Texas South', is24h: false, hours: '6am–12am', driveMin: 8 },
  { id: 'MCALLEN_HIDALGO', name: 'McAllen-Hidalgo', city: 'Hidalgo, TX', country: 'Cd. Reynosa, Tamp.', region: 'Texas Valley', is24h: true, driveMin: 4 },
  { id: 'PROGRESO', name: 'Progreso / Nuevo Progreso', city: 'Progreso, TX', country: 'Nuevo Progreso, Tamp.', region: 'Texas Valley', is24h: false, hours: '8am–12am', driveMin: 0 },
  { id: 'BROWNSVILLE', name: 'Brownsville / Veterans', city: 'Brownsville, TX', country: 'Matamoros, Tamp.', region: 'Texas Valley', is24h: true, driveMin: 2 },
  { id: 'CALEXICO_WEST', name: 'Calexico West', city: 'Calexico, CA', country: 'Mexicali, BC', region: 'California', is24h: true, driveMin: 0 },
  { id: 'CALEXICO_EAST', name: 'Calexico East', city: 'Calexico, CA', country: 'Mexicali, BC', region: 'California', is24h: false, hours: '6am–12am', driveMin: 4 },
];

const CANADA_BASE = [
  { id: 'PEACE_ARCH', name: 'Peace Arch / Blaine', city: 'Blaine, WA', country: 'Surrey, BC', region: 'Pacific Northwest', is24h: true, driveMin: 0 },
  { id: 'PACIFIC_HWY', name: 'Pacific Highway / Blaine', city: 'Blaine, WA', country: 'Surrey, BC', region: 'Pacific Northwest', is24h: true, driveMin: 3 },
  { id: 'LYNDEN', name: 'Lynden / Aldergrove', city: 'Lynden, WA', country: 'Aldergrove, BC', region: 'Pacific Northwest', is24h: false, hours: '8am–12am', driveMin: 22 },
  { id: 'SUMAS', name: 'Sumas / Huntingdon', city: 'Sumas, WA', country: 'Huntingdon, BC', region: 'Pacific Northwest', is24h: false, hours: '8am–12am', driveMin: 34 },
  { id: 'EASTPORT', name: 'Eastport / Kingsgate', city: 'Eastport, ID', country: 'Kingsgate, BC', region: 'Mountain West', is24h: false, hours: '7am–11pm', driveMin: 0 },
  { id: 'SWEETGRASS', name: 'Sweetgrass / Coutts', city: 'Sweetgrass, MT', country: 'Coutts, AB', region: 'Mountain West', is24h: true, driveMin: 0 },
  { id: 'ROOSVILLE', name: 'Roosville / Grasmere', city: 'Roosville, MT', country: 'Grasmere, BC', region: 'Mountain West', is24h: true, driveMin: 5 },
  { id: 'PORTAL', name: 'Portal / North Portal', city: 'Portal, ND', country: 'North Portal, SK', region: 'Great Plains', is24h: true, driveMin: 0 },
  { id: 'INTL_FALLS', name: 'International Falls', city: "Int'l Falls, MN", country: 'Fort Frances, ON', region: 'Great Lakes', is24h: true, driveMin: 0 },
  { id: 'GRAND_PORTAGE', name: 'Grand Portage / Pigeon River', city: 'Grand Portage, MN', country: 'Thunder Bay, ON', region: 'Great Lakes', is24h: true, driveMin: 5 },
  { id: 'AMBASSADOR', name: 'Ambassador Bridge / Detroit', city: 'Detroit, MI', country: 'Windsor, ON', region: 'Great Lakes', is24h: true, driveMin: 0 },
  { id: 'BLUE_WATER', name: 'Blue Water Bridge', city: 'Port Huron, MI', country: 'Sarnia, ON', region: 'Great Lakes', is24h: true, driveMin: 0 },
  { id: 'SSM', name: 'Sault Ste. Marie', city: 'Sault Ste. Marie, MI', country: 'Sault Ste. Marie, ON', region: 'Great Lakes', is24h: true, driveMin: 0 },
  { id: 'RAINBOW', name: 'Rainbow Bridge / Niagara Falls', city: 'Niagara Falls, NY', country: 'Niagara Falls, ON', region: 'Niagara / Northeast', is24h: true, driveMin: 0 },
  { id: 'LEWISTON', name: 'Lewiston-Queenston Bridge', city: 'Lewiston, NY', country: 'Queenston, ON', region: 'Niagara / Northeast', is24h: true, driveMin: 6 },
  { id: 'PEACE_BRIDGE', name: 'Peace Bridge / Buffalo', city: 'Buffalo, NY', country: 'Fort Erie, ON', region: 'Niagara / Northeast', is24h: true, driveMin: 3 },
  { id: 'THOUSAND_ISLANDS', name: 'Thousand Islands Bridge', city: 'Alexandria Bay, NY', country: 'Lansdowne, ON', region: 'Niagara / Northeast', is24h: true, driveMin: 0 },
  { id: 'CHAMPLAIN', name: 'Champlain / Lacolle', city: 'Champlain, NY', country: 'Saint-Bernard, QC', region: 'New England', is24h: true, driveMin: 0 },
  { id: 'DERBY_LINE', name: 'Derby Line / Rock Island', city: 'Derby Line, VT', country: 'Rock Island, QC', region: 'New England', is24h: false, hours: '7am–11pm', driveMin: 0 },
  { id: 'HOULTON', name: 'Houlton / Woodstock', city: 'Houlton, ME', country: 'Woodstock, NB', region: 'New England', is24h: true, driveMin: 0 },
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
  // Mexico crossings
  SAN_YSIDRO:      { latitude: 32.5424,  longitude: -117.0291 },
  OTAY_MESA:       { latitude: 32.5529,  longitude: -116.9278 },
  TECATE:          { latitude: 32.5718,  longitude: -116.6261 },
  ANDRADE:         { latitude: 32.7208,  longitude: -114.7204 },
  SAN_LUIS_I:      { latitude: 32.4853,  longitude: -114.7947 },
  SAN_LUIS_II:     { latitude: 32.4925,  longitude: -114.7875 },
  LUKEVILLE:       { latitude: 31.8898,  longitude: -112.8176 },
  SASABE:          { latitude: 31.4836,  longitude: -111.5334 },
  DOUGLAS:         { latitude: 31.3444,  longitude: -109.5459 },
  NACO:            { latitude: 31.3345,  longitude: -109.9479 },
  SANTA_TERESA:    { latitude: 31.8650,  longitude: -106.6917 },
  COLUMBUS:        { latitude: 31.8264,  longitude: -107.6429 },
  BOTA:            { latitude: 31.7478,  longitude: -106.4849 },
  PASO_DEL_NORTE:  { latitude: 31.7569,  longitude: -106.4893 },
  YSLETA:          { latitude: 31.6847,  longitude: -106.3679 },
  PRESIDIO:        { latitude: 29.5604,  longitude: -104.3670 },
  DEL_RIO:         { latitude: 29.3616,  longitude: -100.8956 },
  EAGLE_PASS_I:    { latitude: 28.7076,  longitude: -100.4953 },
  EAGLE_PASS_II:   { latitude: 28.7059,  longitude: -100.4944 },
  LAREDO_I:        { latitude: 27.5035,  longitude: -99.5075  },
  LAREDO_II:       { latitude: 27.5060,  longitude: -99.5143  },
  MCALLEN_HIDALGO: { latitude: 26.1012,  longitude: -98.2583  },
  PROGRESO:        { latitude: 26.0756,  longitude: -97.9640  },
  BROWNSVILLE:     { latitude: 25.9119,  longitude: -97.4875  },
  CALEXICO_WEST:   { latitude: 32.6690,  longitude: -115.4986 },
  CALEXICO_EAST:   { latitude: 32.6758,  longitude: -115.4742 },
  // Canada crossings
  PEACE_ARCH:        { latitude: 48.9921, longitude: -122.7536 },
  PACIFIC_HWY:       { latitude: 49.0008, longitude: -122.7486 },
  LYNDEN:            { latitude: 48.9468, longitude: -122.4552 },
  SUMAS:             { latitude: 49.0005, longitude: -122.2672 },
  EASTPORT:          { latitude: 48.9984, longitude: -116.1849 },
  SWEETGRASS:        { latitude: 48.9998, longitude: -111.5217 },
  ROOSVILLE:         { latitude: 48.9998, longitude: -115.0503 },
  PORTAL:            { latitude: 48.9999, longitude: -102.5445 },
  INTL_FALLS:        { latitude: 48.5955, longitude: -93.3992  },
  GRAND_PORTAGE:     { latitude: 47.9634, longitude: -89.6785  },
  AMBASSADOR:        { latitude: 42.3249, longitude: -83.0684  },
  BLUE_WATER:        { latitude: 42.9920, longitude: -82.4252  },
  SSM:               { latitude: 46.4882, longitude: -84.3543  },
  RAINBOW:           { latitude: 43.0962, longitude: -79.0612  },
  LEWISTON:          { latitude: 43.1797, longitude: -79.0503  },
  PEACE_BRIDGE:      { latitude: 42.8991, longitude: -78.9061  },
  THOUSAND_ISLANDS:  { latitude: 44.2987, longitude: -75.9754  },
  CHAMPLAIN:         { latitude: 44.9843, longitude: -73.4451  },
  DERBY_LINE:        { latitude: 45.0047, longitude: -72.1024  },
  HOULTON:           { latitude: 46.1196, longitude: -67.8441  },
};
