import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import { BLUE, GREEN, waitColor, colors } from '../data';
import { SectionHeader, Card } from '../components/UI';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINS = ['00', '15', '30', '45'];

export default function TripPlanningScreen({ navigation }) {
  const { crossings, dark, savedTripTemplates, saveTripTemplate, deleteTripTemplate } = useApp();
  const c = colors(dark);

  const [selectedId, setSelectedId] = useState(null);
  const [arrHour, setArrHour] = useState('9');
  const [arrMin, setArrMin] = useState('00');
  const [arrAmPm, setArrAmPm] = useState('AM');
  const [notifScheduled, setNotifScheduled] = useState(false);

  const crossing = selectedId ? crossings.find((x) => x.id === selectedId) : null;

  const arrH = (parseInt(arrHour) % 12) + (arrAmPm === 'PM' ? 12 : 0);
  const arrTotalMin = arrH * 60 + parseInt(arrMin);
  const totalTrip = crossing ? (crossing.driveMin || 0) + crossing.wait : 0;
  const leaveByMin = arrTotalMin - totalTrip;
  const lbH = Math.floor(((leaveByMin % 1440) + 1440) % 1440 / 60);
  const lbM = ((leaveByMin % 60) + 60) % 60;
  const leaveByStr = `${lbH % 12 || 12}:${String(lbM).padStart(2, '0')} ${lbH >= 12 ? 'PM' : 'AM'}`;

  const scheduleNotif = async () => {
    if (!crossing) return;
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
          body: `Current wait: ${crossing.wait} min. Leave now to arrive by ${arrHour}:${arrMin} ${arrAmPm}.`,
          data: { crossingId: crossing.id },
        },
        trigger: { seconds },
      });
      setNotifScheduled(true);
    } catch (_) {}
  };

  const cycleValue = (items, current, set) => {
    const idx = items.indexOf(current);
    set(items[(idx + 1) % items.length]);
    setNotifScheduled(false);
  };

  const laneType = laneFromCrossing(crossing);

  function laneFromCrossing(selCrossing) {
    if (!selCrossing) return 'standard';
    if ((selCrossing.sentriWait ?? 999) < selCrossing.wait) return 'sentri';
    return 'standard';
  }

  const loadTemplate = (tpl) => {
    setSelectedId(tpl.crossingId);
    const [hm, ap] = (tpl.arrival || '9:00 AM').split(' ');
    const [h, m] = hm.split(':');
    setArrHour(h || '9');
    setArrMin(m || '00');
    setArrAmPm(ap || 'AM');
    setNotifScheduled(false);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.navBar, {
        backgroundColor: c.headerBg,
        borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={{ color: BLUE, fontSize: 17 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: c.text }]}>Trip Planner</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Crossing picker */}
        {savedTripTemplates.length > 0 && (
          <>
            <SectionHeader title="Saved Trips" dark={dark} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {savedTripTemplates.map((tpl) => (
                <TouchableOpacity key={tpl.id} onPress={() => loadTemplate(tpl)} style={[styles.crossingChip, { backgroundColor: c.card, borderWidth: 1, borderColor: c.divider, minWidth: 160 }]}> 
                  <Text style={[styles.chipText, { color: c.text }]} numberOfLines={1}>{tpl.name}</Text>
                  <Text style={{ fontSize: 11, color: c.subtext, marginTop: 2 }}>{tpl.arrival}</Text>
                  <TouchableOpacity onPress={() => deleteTripTemplate(tpl.id)} style={{ marginTop: 6 }}>
                    <Text style={{ color: '#FF453A', fontSize: 11, fontWeight: '700' }}>Delete</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <SectionHeader title="Select Crossing" dark={dark} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4, gap: 8 }}
        >
          {crossings.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => { setSelectedId(item.id); setNotifScheduled(false); }}
              style={[styles.crossingChip, {
                backgroundColor: selectedId === item.id ? BLUE : c.chip,
                borderWidth: 1,
                borderColor: selectedId === item.id ? BLUE : c.divider,
              }]}
            >
              <Text style={{ fontSize: 20 }}>{item.flag}</Text>
              <Text style={[styles.chipText, {
                color: selectedId === item.id ? '#fff' : c.text,
              }]} numberOfLines={1}>
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Arrival time pickers */}
        <SectionHeader title="I Want to Arrive At" dark={dark} />
        <Card dark={dark}>
          <View style={{ padding: 16 }}>
            <View style={styles.pickerRow}>
              {[
                { items: HOURS, value: arrHour, set: setArrHour },
                { items: MINS, value: arrMin, set: setArrMin },
                { items: ['AM', 'PM'], value: arrAmPm, set: setArrAmPm },
              ].map((p, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => cycleValue(p.items, p.value, p.set)}
                  style={[styles.pickerBtn, { backgroundColor: c.inputBg }]}
                >
                  <Text style={[styles.pickerValue, { color: c.text }]}>{p.value}</Text>
                  <Text style={{ fontSize: 10, color: c.subtext, marginTop: 2 }}>tap to change</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        {/* Results */}
        {crossing ? (
          <>
            <SectionHeader title="Your Leave-By Plan" dark={dark} />
            <Card dark={dark}>
              <View style={{ padding: 16 }}>
                <View style={styles.planGrid}>
                  {[
                    { l: 'Drive Time', v: `${crossing.driveMin || 0} min`, color: c.text },
                    { l: 'Border Wait', v: `${crossing.wait} min`, color: waitColor(crossing.wait) },
                    { l: 'Total Trip', v: `${totalTrip} min`, color: c.text },
                    { l: '🚗 Leave By', v: leaveByStr, color: BLUE },
                  ].map((item) => (
                    <View key={item.l} style={styles.planCell}>
                      <Text style={[styles.planLabel, { color: c.subtext }]}>{item.l}</Text>
                      <Text style={[styles.planValue, { color: item.color }]}>{item.v}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Card>

            <TouchableOpacity
              onPress={notifScheduled ? undefined : scheduleNotif}
              activeOpacity={notifScheduled ? 1 : 0.85}
              style={{ marginHorizontal: 16, marginTop: 16, borderRadius: 14, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={notifScheduled ? [GREEN, '#25A244'] : [BLUE, '#5AC8FA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.notifBtn}
              >
                <Text style={styles.notifBtnText}>
                  {notifScheduled
                    ? `✓ Reminder set for ${leaveByStr}`
                    : `🔔 Remind Me to Leave at ${leaveByStr}`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Detail', { crossing })}
              style={[styles.secondaryBtn, { backgroundColor: c.card, marginTop: 10 }]}
            >
              <Text style={[styles.secondaryBtnText, { color: BLUE }]}>
                📊 View Full Details for {crossing.name}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                saveTripTemplate({
                  name: `${crossing.name} Trip`,
                  crossingId: crossing.id,
                  laneType,
                  threshold: crossing.wait,
                  arrival: `${arrHour}:${arrMin} ${arrAmPm}`,
                });
              }}
              style={[styles.secondaryBtn, { backgroundColor: c.card, marginTop: 10 }]}
            >
              <Text style={[styles.secondaryBtnText, { color: GREEN }]}>💾 Save As Trip Template</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyBlock}>
            <Text style={{ fontSize: 40 }}>🗺️</Text>
            <Text style={[styles.emptyText, { color: c.subtext }]}>
              Select a crossing above to plan your trip
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  navTitle: { fontSize: 17, fontWeight: '700' },
  crossingChip: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    alignItems: 'center', minWidth: 90, maxWidth: 140,
  },
  chipText: { fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  pickerRow: { flexDirection: 'row', gap: 8 },
  pickerBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  pickerValue: { fontSize: 20, fontWeight: '700' },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  planCell: { width: '45%' },
  planLabel: { fontSize: 11 },
  planValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  notifBtn: { padding: 16, alignItems: 'center', borderRadius: 14 },
  notifBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondaryBtn: {
    marginHorizontal: 16, borderRadius: 14, padding: 14, minHeight: 52, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  emptyBlock: { paddingTop: 60, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 15, textAlign: 'center', paddingHorizontal: 40 },
});
