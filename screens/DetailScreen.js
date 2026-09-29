import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useApp } from '../context/AppContext';
import { BLUE, GREEN, ORANGE, RED, waitColor, waitLabel, waitLevel, getTimeUntilClose, fmtMin, dataAgeMin, crossingTo, isStale, timeAgo } from '../data';
import { WaitPill, SectionHeader, Card } from '../components/UI';
import { dayProfile, historyDays, waitAdvice, clockFor, MIN_DAYS } from '../history';
import ReportCard from '../components/ReportCard';
import { t } from '../i18n';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINS = ['00', '15', '30', '45'];

export default function DetailScreen({ route, navigation }) {
  const { crossings, favorites, toggleStar, reports, votes, feedbackDone, vote, setFeedback, flagReport, dark, driveMinFor, locate, userPos, getHistory, communityWaits, loadServerHistory } = useApp();
  // Route params are a snapshot; read the live record so the 5-minute refresh shows up here.
  const crossing = crossings.find((x) => x.id === route.params.crossing.id) ?? route.params.crossing;
  // Pull the server's recorded history for this crossing (no-op without a server; cached for 6h).
  useEffect(() => { loadServerHistory?.([crossing.id]); }, [crossing.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const isFav = favorites.includes(crossing.id);
  const [arrHour, setArrHour] = useState('9');
  const [arrMin, setArrMin] = useState('00');
  const [arrAmPm, setArrAmPm] = useState('AM');
  const [notifScheduled, setNotifScheduled] = useState(false);

  const bg = dark ? '#1C1C1E' : '#F2F2F7';
  const card = dark ? '#2C2C2E' : '#fff';
  const text = dark ? '#fff' : '#000';
  const inputBg = dark ? '#3A3A3C' : '#F2F2F7';
  const borderColor = dark ? '#48484A' : '#E5E5EA';

  // Leave-by calc
  const arrH = (parseInt(arrHour) % 12) + (arrAmPm === 'PM' ? 12 : 0);
  const arrTotalMin = arrH * 60 + parseInt(arrMin);
  const driveMin = driveMinFor(crossing);
  const totalTrip = (driveMin ?? 0) + (crossing.wait ?? 0);
  const leaveByMin = arrTotalMin - totalTrip;
  const lbH = Math.floor(((leaveByMin % 1440) + 1440) % 1440 / 60);
  const lbM = ((leaveByMin % 60) + 60) % 60;
  const leaveByStr = `${lbH % 12 || 12}:${String(lbM).padStart(2, '0')} ${lbH >= 12 ? 'PM' : 'AM'}`;

  const crossingReports = reports.filter((r) => r.crossingId === crossing.id && !r.hidden);

  // Typical wait by hour for today's weekday, from this device's recorded history
  const history = getHistory();
  const nowDate = new Date();
  const portNow = clockFor(history, crossing.id, nowDate);   // the port's wall clock, not the phone's
  const profile = dayProfile(history, crossing.id, portNow.getDay());
  const usable = profile.map((p) => (p && p.days >= MIN_DAYS ? Math.round(p.mean) : null));
  const hasHistory = usable.some((v) => v != null);
  const chartMax = Math.max(15, ...usable.filter((v) => v != null));
  const bestHour = usable.reduce((best, v, h) => (v != null && (best == null || v < usable[best]) ? h : best), null);
  const hourLabel = (h) => `${h % 12 || 12}${h >= 12 ? 'PM' : 'AM'}`;
  const advice = waitAdvice(history, crossing.id, crossing.wait, nowDate);
  const stale = isStale(crossing);
  const measured = ['standard', 'sentri', 'ready'].flatMap((lane) => {
    const m = communityWaits?.[crossing.id]?.[lane];
    if (!m) return [];
    const posted = lane === 'sentri' ? crossing.sentriWait : lane === 'ready' ? crossing.readyWait : crossing.wait;
    return [{ lane, label: lane === 'sentri' ? (crossing.border === 'MX' ? 'SENTRI' : 'NEXUS') : lane === 'ready' ? 'Ready Lane' : 'Standard', minutes: m.minutes, n: m.n, posted }];
  });
  const ADVICE = {
    good:    { color: GREEN,     text: (a) => t('Lower than usual for this hour (~{n} min). Good time to go.', { n: a.usual }) },
    wait:    { color: ORANGE,    text: (a) => t('{d} min above usual. It usually drops to ~{n} min around {time}.', { d: a.diff, n: a.best.wait, time: hourLabel(clockFor(history, crossing.id, a.best.at).getHours()) }) },
    high:    { color: RED,       text: (a) => t('{d} min above usual for this hour (~{n} min), with no relief expected soon.', { d: a.diff, n: a.usual }) },
    later:   { color: BLUE,      text: (a) => t('Usually lower around {time} (~{n} min).', { time: hourLabel(clockFor(history, crossing.id, a.best.at).getHours()), n: a.best.wait }) },
    typical: { color: '#8E8E93', text: (a) => t('About typical for this hour (~{n} min).', { n: a.usual }) },
  };

  // Hours countdown for the hero
  const minsUntilClose = getTimeUntilClose(crossing);
  const closingSoon = minsUntilClose !== null && minsUntilClose <= 120;
  const closeLabel = minsUntilClose !== null
    ? minsUntilClose >= 60
      ? `Closes in ${Math.floor(minsUntilClose / 60)}h ${minsUntilClose % 60}m`
      : `Closes in ${minsUntilClose}m`
    : null;

  const scheduleLeaveByNotif = async () => {
    try {
      const now = new Date();
      const trigger = new Date(now);
      trigger.setHours(lbH, lbM, 0, 0);
      if (trigger <= now) trigger.setDate(trigger.getDate() + 1);
      const seconds = Math.round((trigger.getTime() - now.getTime()) / 1000);
      if (seconds < 5) return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('🚗 Time to leave for {name}!', { name: crossing.name }),
          body: `${crossing.wait != null ? t('Wait was {n} min when you set this.', { n: crossing.wait }) + ' ' : ''}${t('Leave now to arrive by {time}.', { time: `${arrHour}:${arrMin} ${arrAmPm}` })}`,
          data: { crossingId: crossing.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
      });
      setNotifScheduled(true);
    } catch (_) {}
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      {/* Nav bar */}
      <View style={[styles.navBar, { backgroundColor: dark ? 'rgba(28,28,30,0.95)' : 'rgba(242,242,247,0.95)', borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backBtn}>‹ {t('Crossings')}</Text>
        </TouchableOpacity>
        <View style={styles.navRight}>
          <TouchableOpacity onPress={() => navigation.navigate('Share', { crossing })} style={{ marginRight: 16 }}>
            <Text style={styles.shareBtn}>{t('Share')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => toggleStar(crossing.id)}>
            <Text style={{ fontSize: 24 }}>{isFav ? '⭐' : '☆'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero */}
        <LinearGradient colors={['#007AFF', '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={{ fontSize: 52 }}>{crossing.flag}</Text>
          <Text style={styles.heroName}>{crossing.name}</Text>
          <Text style={styles.heroSub}>{crossing.city} · {crossingTo(crossing)}</Text>
          <View style={styles.heroBadges}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{crossing.is24h ? t('Open 24/7') : `${t('Limited')} · ${crossing.hours}`}</Text>
            </View>
            {driveMin != null ? (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>🚗 {t('~{n} min drive', { n: driveMin })}</Text>
              </View>
            ) : !userPos && (
              <TouchableOpacity style={styles.heroBadge} onPress={() => locate({ prompt: true })}>
                <Text style={styles.heroBadgeText}>📍 {t('Enable location for drive time')}</Text>
              </TouchableOpacity>
            )}
            {closingSoon && (
              <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,159,10,0.35)' }]}>
                <Text style={[styles.heroBadgeText, { color: '#FFD60A' }]}>⏰ {closeLabel}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Current wait */}
        <Card dark={dark} style={{ marginTop: 12 }}>
          <View style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 13, color: '#8E8E93', fontWeight: '500' }}>{t('Current Standard Wait')}</Text>
                <Text style={[styles.bigWait, { color: waitColor(crossing.wait) }]}>
                  {crossing.wait ?? '—'}<Text style={styles.bigWaitUnit}> {t('min')}</Text>
                </Text>
                <Text style={{ fontSize: 14, color: waitColor(crossing.wait), fontWeight: '700', marginTop: 2 }}>
                  {waitLevel(crossing.wait) ? t(`${waitLevel(crossing.wait)} Traffic`) : t('No data')}
                </Text>
                {crossing.via ? (
                  <Text style={{ fontSize: 12, color: '#8E8E93', marginTop: 4 }}>{t('Shortest line: {bridge}', { bridge: crossing.via })}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 12, color: '#8E8E93' }}>{t('Source')}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: crossing.live ? GREEN : ORANGE }}>{crossing.live ? t('CBP live') : /pending/i.test(crossing.feedNote ?? '') ? t('CBP: update pending') : t('No live data')}</Text>
                <Text style={{ fontSize: 11, color: '#8E8E93', marginTop: 4 }}>
                  {dataAgeMin(crossing) != null ? t('Updated {when}', { when: timeAgo(dataAgeMin(crossing)) }) : t('Not yet updated')}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {stale && (
          <View style={[styles.noticeBox, { backgroundColor: 'rgba(255,159,10,0.15)' }]}>
            <Text style={{ color: ORANGE, fontSize: 13, fontWeight: '700' }}>
              ⚠️ {t("CBP last updated this reading {when}. It may be out of date.", { when: timeAgo(dataAgeMin(crossing)) })}
            </Text>
          </View>
        )}
        {advice && (
          <View style={[styles.noticeBox, { backgroundColor: card, borderLeftWidth: 4, borderLeftColor: ADVICE[advice.kind].color }]}>
            <Text style={{ color: text, fontSize: 14, fontWeight: '600', lineHeight: 20 }}>{ADVICE[advice.kind].text(advice)}</Text>
          </View>
        )}

        {measured.length > 0 && (
          <View style={[styles.noticeBox, { backgroundColor: card, borderLeftWidth: 4, borderLeftColor: BLUE }]}>
            <Text style={{ color: '#8E8E93', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>👥 {t('MEASURED BY DRIVERS · LAST HOUR')}</Text>
            {measured.map((m) => (
              <Text key={m.lane} style={{ color: text, fontSize: 14, fontWeight: '600', lineHeight: 20 }}>
                {t(m.label)}: {t('{n} min', { n: m.minutes })} · {t('{n} drivers', { n: m.n })}
                {m.posted != null ? `  (${t('CBP posts')} ${m.posted})` : ''}
              </Text>
            ))}
          </View>
        )}

        {/* Lane breakdown */}
        <SectionHeader title={t('Lane Breakdown')} dark={dark} />
        <View style={styles.laneGrid}>
          {[
            { label: crossing.border === 'MX' ? 'SENTRI' : 'NEXUS', now: crossing.sentriWait, p1: crossing.sentriPredict1h, p3: crossing.sentriPredict3h },
            { label: 'Standard', now: crossing.wait, p1: crossing.predict1h, p3: crossing.predict3h },
            { label: 'Ready Lane', now: crossing.readyWait, p1: crossing.readyPredict1h, p3: crossing.readyPredict3h },
          ].map((lane) => (
            <View key={lane.label} style={[styles.laneCard, { backgroundColor: card }]}>
              <Text style={styles.laneLabel} numberOfLines={1} adjustsFontSizeToFit>{t(lane.label)}</Text>
              <Text style={[styles.laneWait, { color: waitColor(lane.now) }]}>{lane.now ?? '—'}</Text>
              <Text style={styles.laneUnit}>{t('min')}</Text>
              <Text style={[styles.lanePredict, { color: waitColor(lane.p1) }]}>{t('Est. +1h')} {fmtMin(lane.p1)}</Text>
              <Text style={[styles.lanePredict, { color: waitColor(lane.p3) }]}>{t('Est. +3h')} {fmtMin(lane.p3)}</Text>
            </View>
          ))}
        </View>

        {/* One row per bridge for multi-bridge ports */}
        {crossing.bridges?.length > 1 && (
          <>
            <SectionHeader title={t('Bridges')} dark={dark} />
            <Card dark={dark}>
              {crossing.bridges.map((b, i) => {
                const best = i === 0 && b.std != null;
                return (
                  <View key={b.id || i} style={[styles.bridgeRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: text, fontSize: 15, fontWeight: '700' }}>
                        {b.name || t('Main crossing')}{best ? `  ✓ ${t('Shortest')}` : ''}
                      </Text>
                      <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }}>
                        {[
                          b.sentri != null ? `${crossing.border === 'MX' ? 'SENTRI' : 'NEXUS'} ${b.sentri}m` : null,
                          b.ready != null ? `${t('Ready')} ${b.ready}m` : null,
                          b.ped != null ? `${t('Ped.')} ${b.ped}m` : null,
                          b.hours ? b.hours : null,
                        ].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    {b.std != null
                      ? <WaitPill wait={b.std} small />
                      : <Text style={{ color: ORANGE, fontSize: 12, fontWeight: '700' }}>{b.stdClosed ? t('Lanes Closed') : b.note ? t(b.note) : t('No data')}</Text>}
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* Other lanes + port status (CBP) */}
        {[crossing.pedWait, crossing.pedReadyWait, crossing.comWait, crossing.comFastWait].some((v) => v != null) && (
          <>
            <SectionHeader title={t('Pedestrian & Commercial')} dark={dark} />
            <View style={styles.laneGrid}>
              {[
                { label: 'Pedestrian', now: crossing.pedWait },
                { label: 'Ped. Ready', now: crossing.pedReadyWait },
                { label: 'Commercial', now: crossing.comWait },
                { label: 'FAST', now: crossing.comFastWait },
              ].map((lane) => (
                <View key={lane.label} style={[styles.laneCard, { backgroundColor: card }]}>
                  <Text style={styles.laneLabel} numberOfLines={1} adjustsFontSizeToFit>{t(lane.label)}</Text>
                  <Text style={[styles.laneWait, { color: waitColor(lane.now) }]}>{lane.now ?? '—'}</Text>
                  <Text style={styles.laneUnit}>{t('min')}</Text>
                </View>
              ))}
            </View>
            {(crossing.portStatus || crossing.hoursText) && (
              <Text style={{ fontSize: 12, color: '#8E8E93', marginHorizontal: 16, marginTop: 8 }}>
                {crossing.portStatus ? t('Port {status}', { status: t(crossing.portStatus) }) : ''}
                {crossing.portStatus && crossing.hoursText ? ' · ' : ''}
                {crossing.hoursText ? t('Hours: {h}', { h: crossing.hoursText }) : ''}
              </Text>
            )}
          </>
        )}

        {/* Leave-By Calculator */}
        <SectionHeader title={t('Leave-By Calculator')} dark={dark} />
        <Card dark={dark}>
          <View style={{ padding: 18 }}>
            <Text style={{ fontSize: 13, color: '#8E8E93', marginBottom: 12 }}>{t('I want to arrive at:')}</Text>
            <View style={styles.calcPickers}>
              {[
                { items: HOURS, value: arrHour, set: setArrHour },
                { items: MINS, value: arrMin, set: setArrMin },
                { items: ['AM', 'PM'], value: arrAmPm, set: setArrAmPm },
              ].map((p, i) => (
                <View key={i} style={[styles.pickerWrap, { backgroundColor: inputBg, borderColor }]}>
                  <TouchableOpacity
                    onPress={() => {
                      const idx = p.items.indexOf(p.value);
                      p.set(p.items[(idx + 1) % p.items.length]);
                      setNotifScheduled(false);
                    }}
                    style={[styles.pickerDisplay, { backgroundColor: inputBg, borderColor }]}
                  >
                    <Text style={[{ fontSize: 17, fontWeight: '700' }, { color: text }]}>{p.value}</Text>
                    <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }}>{t('tap to change')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={[styles.calcResult, { backgroundColor: inputBg }]}>
              <View style={styles.calcRow}>
                {[
                  { l: t('Drive Time'), v: driveMin != null ? t('~{n} min', { n: driveMin }) : '—', c: text },
                  { l: t('Border Wait'), v: fmtMin(crossing.wait, ` ${t('min')}`), c: waitColor(crossing.wait) },
                  { l: t('Total Trip'), v: t('{n} min', { n: totalTrip }), c: text },
                  { l: t('Leave By'), v: leaveByStr, c: BLUE },
                ].map((item) => (
                  <View key={item.l} style={styles.calcCell}>
                    <Text style={styles.calcCellLabel}>{item.l}</Text>
                    <Text style={[styles.calcCellValue, { color: item.c }]}>{item.v}</Text>
                  </View>
                ))}
              </View>
            </View>
            <TouchableOpacity
              onPress={notifScheduled ? undefined : scheduleLeaveByNotif}
              activeOpacity={notifScheduled ? 1 : 0.8}
              style={[styles.leaveNotifBtn, {
                backgroundColor: notifScheduled ? 'rgba(48,209,88,0.15)' : 'rgba(0,122,255,0.1)',
              }]}
            >
              <Text style={[styles.leaveNotifText, { color: notifScheduled ? GREEN : BLUE }]}>
                {notifScheduled
                  ? t('✓ Reminder set for {time}', { time: leaveByStr })
                  : t('🔔 Remind me to leave at {time}', { time: leaveByStr })}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Predictions row */}
        <SectionHeader title={crossing.predBasis === 'history' ? t('Estimates (from your recorded history)') : t('Estimates (rough, from a generic daily pattern)')} dark={dark} />
        <View style={styles.predictRow}>
          {[{ label: t('Now'), wait: crossing.wait }, { label: t('Est. +1 hour'), wait: crossing.predict1h }, { label: t('Est. +3 hours'), wait: crossing.predict3h }].map((p) => (
            <View key={p.label} style={[styles.predictCard, { backgroundColor: card }]}>
              <Text style={styles.predictLabel}>{p.label}</Text>
              <WaitPill wait={p.wait} />
            </View>
          ))}
        </View>

        {/* Typical wait by hour — built from waits this device has recorded */}
        <SectionHeader title={t('Typical wait today')} dark={dark} />
        <Card dark={dark}>
          <View style={{ padding: 16 }}>
            {hasHistory ? (
              <>
                <View style={styles.histBars}>
                  {usable.map((v, h) => (
                    <View key={h} style={styles.histCol}>
                      <View style={[styles.histBar, {
                        height: v == null ? 3 : Math.max(4, (v / chartMax) * 70),
                        backgroundColor: v == null ? (dark ? '#48484A' : '#E5E5EA') : waitColor(v),
                        opacity: h === portNow.getHours() ? 1 : 0.7,
                        borderWidth: h === portNow.getHours() ? 1.5 : 0,
                        borderColor: text,
                      }]} />
                    </View>
                  ))}
                </View>
                <View style={styles.histAxis}>
                  {[0, 6, 12, 18].map((h) => <Text key={h} style={styles.histAxisText}>{hourLabel(h)}</Text>)}
                </View>
                {bestHour != null && (
                  <Text style={{ color: text, fontSize: 14, fontWeight: '600', marginTop: 10 }}>
                    {t('Usually quickest around {time} (~{n} min)', { time: hourLabel(bestHour), n: usable[bestHour] })}
                  </Text>
                )}
              </>
            ) : (
              <Text style={{ color: '#8E8E93', fontSize: 14, lineHeight: 20 }}>
                {t('Building history. The app records waits each time it refreshes, and typical patterns appear once an hour has been seen on {n} different days.', { n: MIN_DAYS })}
              </Text>
            )}
            <Text style={{ color: '#8E8E93', fontSize: 11, marginTop: 8 }}>
              {historyDays(history, crossing.id) === 1
                ? t('Based on 1 day recorded on this device')
                : t('Based on {n} days recorded on this device', { n: historyDays(history, crossing.id) })}
            </Text>
          </View>
        </Card>

        {/* Community reports for this crossing */}
        {crossingReports.length > 0 && (
          <>
            <SectionHeader title={t('Community Reports')} dark={dark} />
            {crossingReports.map((r) => (
              <ReportCard key={r.id} report={r} allReports={crossingReports} myVote={votes[r.id]} feedbackDone={feedbackDone[r.id]} onVote={vote} onFeedback={setFeedback} onFlag={flagReport} dark={dark} />
            ))}
          </>
        )}


        {/* Report button */}
        <TouchableOpacity onPress={() => navigation.navigate('Report', { crossing })} activeOpacity={0.85} style={{ marginHorizontal: 16, marginTop: 20, borderRadius: 14, overflow: 'hidden' }}>
          <LinearGradient colors={[BLUE, '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.reportBtn}>
            <Text style={styles.reportBtnText}>📝 {t('Report Wait Time')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  backBtn: { color: BLUE, fontSize: 17 },
  navRight: { flexDirection: 'row', alignItems: 'center' },
  shareBtn: { color: BLUE, fontSize: 17 },
  hero: { padding: 24, margin: 16, borderRadius: 20 },
  heroName: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 8 },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  heroBadges: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  bigWait: { fontSize: 48, fontWeight: '800', lineHeight: 52 },
  bigWaitUnit: { fontSize: 20, fontWeight: '400' },
  laneGrid: { flexDirection: 'row', gap: 8, marginHorizontal: 16 },
  laneCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  laneLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  laneWait: { fontSize: 24, fontWeight: '800' },
  laneUnit: { fontSize: 10, color: '#8E8E93', marginBottom: 6 },
  lanePredict: { fontSize: 10, fontWeight: '600' },
  calcPickers: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pickerWrap: { flex: 1, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  pickerDisplay: { padding: 10, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  calcResult: { borderRadius: 12, padding: 14 },
  calcRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  calcCell: { width: '45%' },
  calcCellLabel: { fontSize: 11, color: '#8E8E93' },
  calcCellValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  predictRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16 },
  predictCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  predictLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '600', marginBottom: 8 },
  reportBtn: { padding: 16, alignItems: 'center', borderRadius: 14 },
  reportBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  leaveNotifBtn: {
    marginTop: 12, borderRadius: 10, padding: 12, alignItems: 'center',
  },
  leaveNotifText: { fontSize: 14, fontWeight: '700' },
  noticeBox: { marginHorizontal: 16, marginTop: 10, borderRadius: 12, padding: 12 },
  bridgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  histBars: { flexDirection: 'row', alignItems: 'flex-end', height: 74, gap: 2 },
  histCol: { flex: 1, justifyContent: 'flex-end' },
  histBar: { borderRadius: 2 },
  histAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  histAxisText: { fontSize: 10, color: '#8E8E93' },
});
