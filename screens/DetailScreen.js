import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { Svg, Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { BLUE, GREEN, ORANGE, RED, waitColor, waitLabel, getTimeUntilClose, fmtMin, dataAgeMin } from '../data';
import { WaitPill, SectionHeader, BigSparkline, Card } from '../components/UI';
import ReportCard from '../components/ReportCard';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINS = ['00', '15', '30', '45'];

export default function DetailScreen({ route, navigation }) {
  const { crossing } = route.params;
  const { favorites, toggleStar, reports, votes, feedbackDone, vote, setFeedback, flagReport, dark, completedTrips } = useApp();
  const isFav = favorites.includes(crossing.id);
  const [arrHour, setArrHour] = useState('9');
  const [arrMin, setArrMin] = useState('00');
  const [arrAmPm, setArrAmPm] = useState('AM');
  const [notifScheduled, setNotifScheduled] = useState(false);
  const currentHour = new Date().getHours();
  const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];

  const bg = dark ? '#1C1C1E' : '#F2F2F7';
  const card = dark ? '#2C2C2E' : '#fff';
  const text = dark ? '#fff' : '#000';
  const inputBg = dark ? '#3A3A3C' : '#F2F2F7';
  const borderColor = dark ? '#48484A' : '#E5E5EA';

  // Leave-by calc
  const arrH = (parseInt(arrHour) % 12) + (arrAmPm === 'PM' ? 12 : 0);
  const arrTotalMin = arrH * 60 + parseInt(arrMin);
  const totalTrip = (crossing.driveMin || 0) + (crossing.wait ?? 0);
  const leaveByMin = arrTotalMin - totalTrip;
  const lbH = Math.floor(((leaveByMin % 1440) + 1440) % 1440 / 60);
  const lbM = ((leaveByMin % 60) + 60) % 60;
  const leaveByStr = `${lbH % 12 || 12}:${String(lbM).padStart(2, '0')} ${lbH >= 12 ? 'PM' : 'AM'}`;

  const heatColor = (wait) => {
    if (wait <= 15) return { bg: '#1C4A2B', txt: GREEN };
    if (wait <= 35) return { bg: '#4A3A0A', txt: ORANGE };
    return { bg: '#4A1A1A', txt: RED };
  };

  const crossingReports = reports.filter((r) => r.crossingId === crossing.id && !r.hidden);

  // Historical accuracy chart data — up to 10 most recent tracked trips for this crossing
  const myTrips = completedTrips
    .filter((t) => t.crossingId === crossing.id)
    .slice(0, 10)
    .reverse(); // oldest first so x-axis reads left→right
  const chartData = myTrips.map((t) => {
    const hour = new Date(t.startTime).getHours();
    const predicted = crossing.wait;
    return { predicted, actual: t.actualWait, date: new Date(t.startTime) };
  });

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
          title: `🚗 Time to leave for ${crossing.name}!`,
          body: `${crossing.wait != null ? `Wait was ${crossing.wait} min when you set this. ` : ''}Leave now to arrive by ${arrHour}:${arrMin} ${arrAmPm}.`,
          data: { crossingId: crossing.id },
        },
        trigger: { seconds },
      });
      setNotifScheduled(true);
    } catch (_) {}
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      {/* Nav bar */}
      <View style={[styles.navBar, { backgroundColor: dark ? 'rgba(28,28,30,0.95)' : 'rgba(242,242,247,0.95)', borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backBtn}>‹ Crossings</Text>
        </TouchableOpacity>
        <View style={styles.navRight}>
          <TouchableOpacity onPress={() => navigation.navigate('Share', { crossing })} style={{ marginRight: 16 }}>
            <Text style={styles.shareBtn}>Share</Text>
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
          <Text style={styles.heroSub}>{crossing.city} · {crossing.country}</Text>
          <View style={styles.heroBadges}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{crossing.is24h ? 'Open 24/7' : `Limited · ${crossing.hours}`}</Text>
            </View>
            {crossing.driveMin > 0 && (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>🚗 {crossing.driveMin} min drive</Text>
              </View>
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
                <Text style={{ fontSize: 13, color: '#8E8E93', fontWeight: '500' }}>Current Standard Wait</Text>
                <Text style={[styles.bigWait, { color: waitColor(crossing.wait) }]}>
                  {crossing.wait ?? '—'}<Text style={styles.bigWaitUnit}> min</Text>
                </Text>
                <Text style={{ fontSize: 14, color: waitColor(crossing.wait), fontWeight: '700', marginTop: 2 }}>
                  {waitLabel(crossing.wait)} Traffic
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 12, color: '#8E8E93' }}>Source</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: crossing.live ? GREEN : ORANGE }}>{crossing.live ? 'CBP live' : 'No live data'}</Text>
                <Text style={{ fontSize: 11, color: '#8E8E93', marginTop: 4 }}>
                  {dataAgeMin(crossing) != null ? `Updated ${dataAgeMin(crossing)}m ago` : 'Not yet updated'}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Lane breakdown */}
        <SectionHeader title="Lane Breakdown" dark={dark} />
        <View style={styles.laneGrid}>
          {[
            { label: crossing.border === 'MX' ? 'SENTRI' : 'NEXUS', now: crossing.sentriWait, p1: crossing.sentriPredict1h, p3: crossing.sentriPredict3h },
            { label: 'Standard', now: crossing.wait, p1: crossing.predict1h, p3: crossing.predict3h },
            { label: 'Ready Lane', now: crossing.readyWait, p1: crossing.readyPredict1h, p3: crossing.readyPredict3h },
          ].map((lane) => (
            <View key={lane.label} style={[styles.laneCard, { backgroundColor: card }]}>
              <Text style={styles.laneLabel}>{lane.label}</Text>
              <Text style={[styles.laneWait, { color: waitColor(lane.now) }]}>{lane.now ?? '—'}</Text>
              <Text style={styles.laneUnit}>min</Text>
              <Text style={[styles.lanePredict, { color: waitColor(lane.p1) }]}>Est. +1h {fmtMin(lane.p1)}</Text>
              <Text style={[styles.lanePredict, { color: waitColor(lane.p3) }]}>Est. +3h {fmtMin(lane.p3)}</Text>
            </View>
          ))}
        </View>

        {/* Leave-By Calculator */}
        <SectionHeader title="Leave-By Calculator" dark={dark} />
        <Card dark={dark}>
          <View style={{ padding: 18 }}>
            <Text style={{ fontSize: 13, color: '#8E8E93', marginBottom: 12 }}>I want to arrive at:</Text>
            <View style={styles.calcPickers}>
              {[
                { items: HOURS, value: arrHour, set: setArrHour },
                { items: MINS, value: arrMin, set: setArrMin },
                { items: ['AM', 'PM'], value: arrAmPm, set: setArrAmPm },
              ].map((p, i) => (
                <View key={i} style={[styles.pickerWrap, { backgroundColor: inputBg, borderColor }]}>
                  <ScrollView style={{ maxHeight: 40, overflow: 'hidden' }}>
                    {p.items.map((item) => (
                      <TouchableOpacity key={item} onPress={() => { p.set(item); setNotifScheduled(false); }} style={[styles.pickerItem, p.value === item && styles.pickerItemActive]}>
                        <Text style={[styles.pickerItemText, { color: text }, p.value === item && { color: BLUE }]}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    onPress={() => {
                      const idx = p.items.indexOf(p.value);
                      p.set(p.items[(idx + 1) % p.items.length]);
                      setNotifScheduled(false);
                    }}
                    style={[styles.pickerDisplay, { backgroundColor: inputBg, borderColor }]}
                  >
                    <Text style={[{ fontSize: 17, fontWeight: '700' }, { color: text }]}>{p.value}</Text>
                    <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 2 }}>tap to change</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={[styles.calcResult, { backgroundColor: inputBg }]}>
              <View style={styles.calcRow}>
                {[
                  { l: 'Drive Time', v: `${crossing.driveMin || 0} min`, c: text },
                  { l: 'Border Wait', v: fmtMin(crossing.wait, ' min'), c: waitColor(crossing.wait) },
                  { l: 'Total Trip', v: `${totalTrip} min`, c: text },
                  { l: 'Leave By', v: leaveByStr, c: BLUE },
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
                  ? `✓ Reminder set for ${leaveByStr}`
                  : `🔔 Remind me to leave at ${leaveByStr}`}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Quick actions: Compare + Checklist */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Compare', { crossingId: crossing.id })}
            style={[styles.quickActionBtn, { backgroundColor: card }]}
          >
            <Text style={[styles.quickActionText, { color: text }]}>📊 Compare Region</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Checklist', { crossingId: crossing.id })}
            style={[styles.quickActionBtn, { backgroundColor: card }]}
          >
            <Text style={[styles.quickActionText, { color: text }]}>📋 Packing List</Text>
          </TouchableOpacity>
        </View>

        {/* Predictions row */}
        <SectionHeader title="Estimates (rough, from a generic daily pattern)" dark={dark} />
        <View style={styles.predictRow}>
          {[{ label: 'Now', wait: crossing.wait }, { label: 'Est. +1 hour', wait: crossing.predict1h }, { label: 'Est. +3 hours', wait: crossing.predict3h }].map((p) => (
            <View key={p.label} style={[styles.predictCard, { backgroundColor: card }]}>
              <Text style={styles.predictLabel}>{p.label}</Text>
              <WaitPill wait={p.wait} />
            </View>
          ))}
        </View>

        {/* Community reports for this crossing */}
        {crossingReports.length > 0 && (
          <>
            <SectionHeader title="Community Reports" dark={dark} />
            {crossingReports.map((r) => (
              <ReportCard key={r.id} report={r} allReports={crossingReports} myVote={votes[r.id]} feedbackDone={feedbackDone[r.id]} onVote={vote} onFeedback={setFeedback} onFlag={flagReport} dark={dark} />
            ))}
          </>
        )}

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
  confidence: { fontSize: 26, fontWeight: '700' },
  laneGrid: { flexDirection: 'row', gap: 8, marginHorizontal: 16 },
  laneCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  laneLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  laneWait: { fontSize: 24, fontWeight: '800' },
  laneUnit: { fontSize: 10, color: '#8E8E93', marginBottom: 6 },
  lanePredict: { fontSize: 10, fontWeight: '600' },
  calcPickers: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pickerWrap: { flex: 1, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  pickerDisplay: { padding: 10, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  pickerItem: { padding: 8, alignItems: 'center' },
  pickerItemActive: { backgroundColor: 'rgba(0,122,255,0.1)' },
  pickerItemText: { fontSize: 16, fontWeight: '600' },
  calcResult: { borderRadius: 12, padding: 14 },
  calcRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  calcCell: { width: '45%' },
  calcCellLabel: { fontSize: 11, color: '#8E8E93' },
  calcCellValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  predictRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16 },
  predictCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  predictLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '600', marginBottom: 8 },
  heatHeader: { width: 38, textAlign: 'center', fontSize: 9 },
  heatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  heatDay: { width: 34, fontSize: 11 },
  heatCell: { width: 36, height: 28, borderRadius: 6, marginRight: 2, alignItems: 'center', justifyContent: 'center' },
  heatCellText: { fontSize: 10, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 12 },
  statCard: { flex: 1, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '600', marginBottom: 6 },
  statValue: { fontWeight: '800' },
  reportBtn: { padding: 16, alignItems: 'center', borderRadius: 14 },
  reportBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  leaveNotifBtn: {
    marginTop: 12, borderRadius: 10, padding: 12, alignItems: 'center',
  },
  leaveNotifText: { fontSize: 14, fontWeight: '700' },
  quickActionsRow: {
    flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 4,
  },
  quickActionBtn: {
    flex: 1, borderRadius: 12, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  quickActionText: { fontSize: 14, fontWeight: '700' },
});
