// Turns the CBP border-wait feed into per-crossing values.
//
// The feed is one row per *lane group*, and a busy port has several rows (El Paso alone has
// five: an empty "Update Pending" parent plus BOTA, PDN, Stanton, Ysleta). Reading only the
// first matching row hides real waits, so every row that belongs to a crossing is folded
// together: the shortest open line wins, and `via` names the bridge it belongs to.

export const normName = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

// Lane block -> { minutes, closed }. "no delay" is a real 0; blank/pending/N/A is null.
export const readLane = (lane) => {
  if (!lane) return { minutes: null, closed: false };
  const status = String(lane.operational_status ?? '').toLowerCase();
  if (status.includes('closed')) return { minutes: null, closed: true };
  if (status.includes('no delay')) return { minutes: 0, closed: false };
  const n = parseInt(lane.delay_minutes, 10);
  return { minutes: Number.isFinite(n) ? n : null, closed: false };
};

const TZ_OFFSET_H = {
  EST: -5, EDT: -4, CST: -6, CDT: -5, MST: -7, MDT: -6, PST: -8, PDT: -7,
  AKST: -9, AKDT: -8, HST: -10, AST: -4, ADT: -3,
};

/** UTC offset (hours) named by a CBP update_time such as "At 11:00 am EDT", or null. */
export const cbpTzOffset = (str) => {
  const m = /([A-Za-z]{2,4})\s*$/.exec(String(str ?? '').trim());
  return m && TZ_OFFSET_H[m[1].toUpperCase()] != null ? TZ_OFFSET_H[m[1].toUpperCase()] : null;
};

/** "At 11:00 am EDT" / "At Noon EDT" -> epoch ms of the most recent such time, or null. */
export const parseCbpTime = (str, nowMs = Date.now()) => {
  const m = /^\s*At\s+(noon|midnight|(\d{1,2}):(\d{2})\s*(am|pm))\s*([A-Za-z]{2,4})?/i.exec(String(str ?? ''));
  if (!m) return null;
  let hh; let mm;
  if (/^noon$/i.test(m[1])) { hh = 12; mm = 0; }
  else if (/^midnight$/i.test(m[1])) { hh = 0; mm = 0; }
  else {
    hh = parseInt(m[2], 10) % 12 + (/pm/i.test(m[4]) ? 12 : 0);
    mm = parseInt(m[3], 10);
  }
  const off = TZ_OFFSET_H[(m[5] ?? '').toUpperCase()];
  if (off == null) return null;
  // Build "today at hh:mm in that zone", then step back a day if that lands in the future.
  const zoneNow = new Date(nowMs + off * 3600000);
  let ts = Date.UTC(zoneNow.getUTCFullYear(), zoneNow.getUTCMonth(), zoneNow.getUTCDate(), hh, mm) - off * 3600000;
  if (ts > nowMs + 30 * 60000) ts -= 86400000;
  return ts;
};

const stripPoe = (n) => n.replace(/ port of entry$/, '');

/** Feed rows that belong to `crossing`, without rows claimed by a more specific crossing. */
export const rowsFor = (feed, crossing, allCrossings) => {
  const cn = normName(crossing.name);
  const cnShort = stripPoe(cn);
  const cityBase = normName(String(crossing.city ?? '').split(',')[0]);

  // A row whose bridge name exactly equals another crossing (Anzalduas, Deconcini, …)
  // belongs to that crossing, not to the port it is filed under.
  const claimedByOther = (row) => {
    const xn = normName(row.crossing_name);
    return !!xn && xn !== cn && allCrossings.some((o) => o.id !== crossing.id && normName(o.name) === xn);
  };

  const byPort = feed.filter((r) => r.port_name && normName(r.port_name) === cn);
  const byBridge = feed.filter((r) => {
    const xn = normName(r.crossing_name);
    return xn && (xn.includes(cnShort) || (cnShort.includes(xn) && xn.length > 3));
  });
  let rows = [...byPort, ...byBridge.filter((r) => !byPort.includes(r))];

  if (!rows.length) {
    rows = feed.filter((r) => {
      if (!r.port_name) return false;
      const pn = normName(r.port_name);
      return cn.includes(pn) || pn.includes(cn) || cityBase === pn;
    });
  }
  return rows.filter((r) => !claimedByOther(r));
};

const bestOf = (rows, pick) => {
  const lanes = rows.map((r) => ({ row: r, lane: readLane(pick(r)) }));
  const open = lanes.filter((l) => l.lane.minutes != null).sort((a, b) => a.lane.minutes - b.lane.minutes);
  if (open.length) return { minutes: open[0].lane.minutes, closed: false, row: open[0].row };
  return { minutes: null, closed: lanes.some((l) => l.lane.closed), row: null };
};

/** Fold every row of a crossing into one record, or null if the feed has nothing for it. */
export const summarizeCrossing = (feed, crossing, allCrossings) => {
  const rows = rowsFor(feed, crossing, allCrossings);
  if (!rows.length) return null;

  const std = bestOf(rows, (r) => r.passenger_vehicle_lanes?.standard_lanes);
  const sentri = bestOf(rows, (r) => r.passenger_vehicle_lanes?.NEXUS_SENTRI_lanes);
  const ready = bestOf(rows, (r) => r.passenger_vehicle_lanes?.ready_lanes);
  const ped = bestOf(rows, (r) => r.pedestrian_lanes?.standard_lanes);
  const pedReady = bestOf(rows, (r) => r.pedestrian_lanes?.ready_lanes);
  const com = bestOf(rows, (r) => r.commercial_vehicle_lanes?.standard_lanes);
  const comFast = bestOf(rows, (r) => r.commercial_vehicle_lanes?.FAST_lanes);

  const bridges = rows.map((r) => {
    const g = (pick) => readLane(pick(r));
    const stdLane = g((x) => x.passenger_vehicle_lanes?.standard_lanes);
    return {
      id: String(r.port_number ?? ''),
      name: String(r.crossing_name ?? '').trim(),
      std: stdLane.minutes,
      stdClosed: stdLane.closed,
      sentri: g((x) => x.passenger_vehicle_lanes?.NEXUS_SENTRI_lanes).minutes,
      ready: g((x) => x.passenger_vehicle_lanes?.ready_lanes).minutes,
      ped: g((x) => x.pedestrian_lanes?.standard_lanes).minutes,
      com: g((x) => x.commercial_vehicle_lanes?.standard_lanes).minutes,
      note: String(r.passenger_vehicle_lanes?.standard_lanes?.operational_status ?? '').trim(),
      hours: r.hours ?? null,
      updatedAt: parseCbpTime(r.passenger_vehicle_lanes?.standard_lanes?.update_time),
    };
  }).sort((a, b) => (a.std ?? Infinity) - (b.std ?? Infinity));

  // Status/hours come from the row that supplied the wait; otherwise the first row.
  const lead = std.row ?? rows[0];
  const note = String(lead.passenger_vehicle_lanes?.standard_lanes?.operational_status ?? '').trim();
  const via = rows.length > 1 && std.row ? String(std.row.crossing_name ?? '').trim() : '';

  return {
    std, sentri, ready, ped, pedReady, com, comFast,
    portStatus: lead.port_status ?? null,
    hoursText: lead.hours ?? null,
    via: via || null,
    // What CBP itself says when there is no number (e.g. "Update Pending"), so the UI can explain it.
    feedNote: std.minutes == null && note && !/^n\/a$/i.test(note) ? note : null,
    rowCount: rows.length,
    bridges: rows.length > 1 ? bridges : [],
    // When CBP itself last updated the standard-lane reading (not when we fetched it).
    cbpUpdatedAt: parseCbpTime(lead.passenger_vehicle_lanes?.standard_lanes?.update_time),
    // The port's UTC offset, taken from whichever row names a time zone (for port-local history buckets).
    tzOffsetH: rows.map((r) => cbpTzOffset(r.passenger_vehicle_lanes?.standard_lanes?.update_time)).find((v) => v != null) ?? null,
  };
};
