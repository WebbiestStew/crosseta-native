import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { GREEN, ORANGE, RED } from '../data';
import { SectionHeader, Card } from '../components/UI';

const diffColor = (diff) => {
  const abs = Math.abs(diff);
  if (abs <= 5) return GREEN;
  if (abs <= 15) return ORANGE;
  return RED;
};
const diffLabel = (diff) => {
  if (diff === 0) return 'Exact!';
  if (diff > 0) return `+${diff}m longer`;
  return `${diff}m shorter`;
};

export default function TripsScreen({ navigation }) {
  const { dark, trips, clearTrips, completedTrips } = useApp();

  const bg = dark ? '#1C1C1E' : '#F2F2F7';
  const card = dark ? '#2C2C2E' : '#fff';
  const text = dark ? '#fff' : '#000';
  const sub = '#8E8E93';

  const totalTime = trips.reduce((s, t) => s + t.actual, 0);
  const avgAccuracy = trips.length
    ? Math.round(trips.filter((t) => Math.abs(t.diff) <= 5).length / trips.length * 100)
    : 0;

  const handleClear = () => {
    Alert.alert('Clear Trip History', 'This will delete all saved trips. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearTrips },
    ]);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: dark ? 'rgba(28,28,30,0.95)' : 'rgba(242,242,247,0.95)', borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <Text style={[styles.title, { color: text }]}>My Trips</Text>
        {trips.length > 0 && (
          <TouchableOpacity onPress={handleClear}>
            <Text style={{ color: RED, fontSize: 15, fontWeight: '600' }}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Trip Log banner */}
        <TouchableOpacity
          onPress={() => navigation.navigate('TripHistory')}
          activeOpacity={0.8}
          style={[styles.tripLogBanner, { backgroundColor: dark ? '#1C2E4A' : '#E8F1FF' }]}
        >
          <Text style={styles.tripLogEmoji}>📡</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tripLogTitle, { color: dark ? '#fff' : '#000' }]}>
              Tracked Trips  {completedTrips.length > 0 ? `(${completedTrips.length})` : ''}
            </Text>
            <Text style={{ fontSize: 12, color: '#8E8E93' }}>
              Real wait times from "I'm In Line" sessions
            </Text>
          </View>
          <Text style={{ color: '#007AFF', fontSize: 20 }}>›</Text>
        </TouchableOpacity>

        {/* Trip Planner banner */}
        <TouchableOpacity
          onPress={() => navigation.navigate('TripPlan')}
          activeOpacity={0.8}
          style={[styles.tripLogBanner, { backgroundColor: dark ? '#1C2E1C' : '#E8F9ED', marginTop: 0 }]}
        >
          <Text style={styles.tripLogEmoji}>🗺️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tripLogTitle, { color: dark ? '#fff' : '#000' }]}>Trip Planner</Text>
            <Text style={{ fontSize: 12, color: '#8E8E93' }}>
              Pick a crossing → get leave-by time + reminder
            </Text>
          </View>
          <Text style={{ color: '#30D158', fontSize: 20 }}>›</Text>
        </TouchableOpacity>
        {/* Stats */}
        {trips.length > 0 && (
          <View style={[styles.statsRow, { backgroundColor: card }]}>
            {[
              { label: 'Total Trips', value: trips.length, color: text },
              { label: 'Prediction Accuracy', value: `${avgAccuracy}%`, color: text },
              { label: 'Total Wait Time', value: `${totalTime}m`, color: text },
            ].map((s) => (
              <View key={s.label} style={styles.statItem}>
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Trip list */}
        <SectionHeader title={`${trips.length} Saved Trips`} dark={dark} />

        {trips.length === 0 ? (
          <View style={{ padding: 50, alignItems: 'center' }}>
            <Text style={{ fontSize: 40 }}>🗺️</Text>
            <Text style={[styles.emptyTitle, { color: text }]}>No Trips Yet</Text>
            <Text style={{ fontSize: 14, color: sub, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
              After crossing, use the home screen banner to log your actual wait time.
            </Text>
          </View>
        ) : (
          trips.map((trip) => {
            const dc = diffColor(trip.diff);
            return (
              <View key={trip.id} style={[styles.tripCard, { backgroundColor: card }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 28 }}>{trip.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tripName, { color: text }]}>{trip.crossingName}</Text>
                    <Text style={{ fontSize: 12, color: sub }}>{new Date(trip.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={[styles.diffBadge, { backgroundColor: `${dc}22`, borderColor: dc }]}>
                      <Text style={[styles.diffText, { color: dc }]}>{diffLabel(trip.diff)}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.tripStats}>
                  {[
                    { l: 'Predicted', v: `${trip.predicted}m`, c: sub },
                    { l: 'Actual', v: `${trip.actual}m`, c: text },
                    { l: 'Lane', v: trip.lane, c: sub },
                  ].map((s) => (
                    <View key={s.l} style={styles.tripStatItem}>
                      <Text style={[styles.tripStatValue, { color: s.c }]}>{s.v}</Text>
                      <Text style={styles.tripStatLabel}>{s.l}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 28, fontWeight: '800' },
  statsRow: { marginHorizontal: 16, marginVertical: 12, borderRadius: 16, flexDirection: 'row', paddingVertical: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#8E8E93', marginTop: 2, textAlign: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 14 },
  tripCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tripName: { fontSize: 15, fontWeight: '700' },
  diffBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  diffText: { fontSize: 12, fontWeight: '700' },
  tripStats: { flexDirection: 'row', marginTop: 12, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(150,150,150,0.2)' },
  tripStatItem: { flex: 1, alignItems: 'center' },
  tripStatValue: { fontSize: 16, fontWeight: '700' },
  tripStatLabel: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  tripLogBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  tripLogEmoji: { fontSize: 28 },
  tripLogTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
});
