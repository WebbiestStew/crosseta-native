// Tests for the code shared between the app and the server (cbp.mjs, historyCore.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCbpTime, cbpTzOffset, summarizeCrossing } from '../../cbp.mjs';
import { recordSamples, typicalWait, dayProfile, historyDays, waitAdvice, toPortClock, clockFor } from '../../historyCore.mjs';

const feed = JSON.parse(readFileSync(new URL('./fixtures/bwt.json', import.meta.url), 'utf8'));
const ALL = [
  { id: 'EL_PASO', name: 'El Paso', city: 'El Paso, Texas' },
  { id: 'BOTA', name: 'Bridge of the Americas Port of Entry', city: 'El Paso, Texas' },
  { id: 'LAREDO', name: 'Laredo', city: 'Laredo, Texas' },
  { id: 'HIDALGO', name: 'Hidalgo/Pharr', city: 'Hidalgo/Pharr, Texas' },
  { id: 'ANZALDUAS', name: 'Anzalduas International Bridge', city: 'Mission, Texas' },
];

// ─── CBP timestamps ─────────────────────────────────────────────────────────
test('CBP update times parse across zones, noon, and day rollover', () => {
  const now = Date.UTC(2026, 8, 29, 18, 0);   // 2:00 pm EDT
  assert.equal(parseCbpTime('At 11:00 am EDT', now), Date.UTC(2026, 8, 29, 15, 0));
  assert.equal(parseCbpTime('At 1:57 pm EDT', now), Date.UTC(2026, 8, 29, 17, 57));
  assert.equal(parseCbpTime('At Noon EDT', now), Date.UTC(2026, 8, 29, 16, 0));
  assert.equal(parseCbpTime('At 10:00 am PDT', now), Date.UTC(2026, 8, 29, 17, 0));
  assert.equal(parseCbpTime('At 11:00 pm EDT', now), Date.UTC(2026, 8, 29, 3, 0), '11 pm EDT is 03:00 UTC, still earlier today');
  assert.equal(parseCbpTime('At 5:00 pm EDT', now), Date.UTC(2026, 8, 28, 21, 0), 'a future clock time means yesterday');
  assert.equal(parseCbpTime('', now), null);
  assert.equal(parseCbpTime('At 3:00 pm XYZ', now), null);
  assert.equal(cbpTzOffset('At 11:00 am EDT'), -4);
  assert.equal(cbpTzOffset('At Noon PDT'), -7);
  assert.equal(cbpTzOffset(''), null);
});

// ─── Matching multi-bridge ports ────────────────────────────────────────────
test('multi-bridge ports use the shortest open line and list every bridge', () => {
  const ep = summarizeCrossing(feed, ALL[0], ALL);
  assert.equal(ep.std.minutes, 38);
  assert.ok(ep.bridges.length >= 4);
  assert.equal(ep.bridges[0].std, 38, 'sorted shortest first');
  assert.ok(ep.bridges.some((b) => b.std == null && b.note), 'closed/pending bridges are listed with their status');
  assert.equal(typeof ep.tzOffsetH, 'number');
  const laredo = summarizeCrossing(feed, ALL[2], ALL);
  assert.equal(laredo.std.minutes, 20);
  assert.equal(laredo.via, 'Bridge II');
});

test('a bridge that belongs to another crossing is not counted twice', () => {
  const hid = summarizeCrossing(feed, ALL[3], ALL);
  const anz = summarizeCrossing(feed, ALL[4], ALL);
  assert.equal(anz.std.minutes, 15);
  assert.equal(hid.std.minutes, 20, 'Hidalgo shows Hidalgo, not Anzalduas');
  assert.ok(!hid.bridges.some((b) => /Anzalduas/i.test(b.name)));
});

test('placeholder ports resolve to the real bridge row', () => {
  const bota = summarizeCrossing(feed, ALL[1], ALL);
  assert.equal(bota.std.minutes, 60);
});

// ─── History ────────────────────────────────────────────────────────────────
const day = (d, hour) => new Date(2026, 8, d, hour, 5);

test('history counts distinct days, not samples', () => {
  const h = {};
  recordSamples(h, [{ id: 'X', wait: 10 }], day(1, 8));
  recordSamples(h, [{ id: 'X', wait: 30 }], day(1, 8));
  assert.equal(historyDays(h, 'X'), 1);
  assert.equal(typicalWait(h, 'X', day(1, 8)), null, 'one day is not enough');
  recordSamples(h, [{ id: 'X', wait: 40 }], day(8, 8));
  recordSamples(h, [{ id: 'X', wait: 60 }], day(15, 8));
  assert.equal(typicalWait(h, 'X', day(22, 8)), 40, '(20 + 40 + 60) / 3');
  assert.equal(typicalWait(h, 'X', day(22, 9)), null);
  assert.equal(typicalWait(h, 'X', day(2, 8)), null, 'other weekday');
  recordSamples(h, [{ id: 'X', wait: null }], day(22, 8));
  assert.equal(historyDays(h, 'X'), 3, 'null waits are ignored');
  assert.equal(Math.round(dayProfile(h, 'X', day(1, 8).getDay())[8].mean), 40);
});

test('server history is read on the port clock, not the phone clock', () => {
  // Port is UTC-6; the server bucketed "Tuesday 8 AM port time" with 3 days of data.
  const key = 2 * 24 + 8;
  const h = { __server: { EL_PASO: { tz: -6, buckets: { [key]: [40, 2, 1, 20, 1] } } } };
  // 14:30 UTC on a Tuesday is 08:30 at the port, whatever timezone this test machine is in.
  const tueEightAtPort = new Date(Date.UTC(2026, 8, 29, 14, 30));
  assert.equal(typicalWait(h, 'EL_PASO', tueEightAtPort), 20, '(40 + 20) / 3');
  assert.equal(typicalWait(h, 'EL_PASO', new Date(Date.UTC(2026, 8, 29, 15, 30))), null, 'an hour later has no data');
  const clock = clockFor(h, 'EL_PASO', tueEightAtPort);
  assert.equal(clock.getDay(), 2); assert.equal(clock.getHours(), 8);
  assert.equal(historyDays(h, 'EL_PASO'), 3);
  // A crossing with no server data falls back to local buckets on the device clock.
  const local = {}; recordSamples(local, [{ id: 'Y', wait: 5 }], day(1, 8));
  assert.equal(clockFor(local, 'Y', day(1, 8)).getTime(), day(1, 8).getTime());
});

test('toPortClock shifts wall-clock readings by the port offset', () => {
  const t = new Date(Date.UTC(2026, 8, 29, 18, 0));
  const pdt = toPortClock(t, -7);
  assert.equal(pdt.getHours(), 11);
  assert.equal(toPortClock(t, -4).getHours(), 14);
});

test('advice: good / wait / high / later / none', () => {
  const h = {};
  const now = new Date(2026, 8, 29, 10, 10);
  const typ = { 10: 20, 11: 20, 12: 15, 13: 10, 14: 8, 15: 8, 16: 30 };
  for (const back of [7, 14, 21]) for (const [hr, w] of Object.entries(typ)) recordSamples(h, [{ id: 'X', wait: w }], new Date(2026, 8, 29 - back, Number(hr), 5));
  assert.equal(waitAdvice(h, 'X', null, now), null);
  assert.equal(waitAdvice(h, 'X', 10, now).kind, 'good');
  assert.equal(waitAdvice(h, 'X', 20, now).kind, 'later');
  const w = waitAdvice(h, 'X', 45, now);
  assert.deepEqual([w.kind, w.diff, w.best.wait, w.best.hours], ['wait', 25, 8, 4]);
  assert.equal(waitAdvice(h, 'X', 60, new Date(2026, 8, 29, 16, 10)).kind, 'high');
  assert.equal(waitAdvice({}, 'X', 20, now), null, 'no history means no advice');
});
