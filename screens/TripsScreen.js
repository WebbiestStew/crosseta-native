import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';

export default function TripsScreen({ navigation }) {
  const { dark, completedTrips } = useApp();

  const bg = dark ? '#1C1C1E' : '#F2F2F7';
  const card = dark ? '#2C2C2E' : '#fff';
  const text = dark ? '#fff' : '#000';
  const sub = '#8E8E93';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: dark ? 'rgba(28,28,30,0.95)' : 'rgba(242,242,247,0.95)', borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <Text style={[styles.title, { color: text }]}>{t('My Trips')}</Text>
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
              {t('Tracked Trips')}  {completedTrips.length > 0 ? `(${completedTrips.length})` : ''}
            </Text>
            <Text style={{ fontSize: 12, color: '#8E8E93' }}>
              {t('Real wait times from "I\'m In Line" sessions')}
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
            <Text style={[styles.tripLogTitle, { color: dark ? '#fff' : '#000' }]}>{t('Trip Planner')}</Text>
            <Text style={{ fontSize: 12, color: '#8E8E93' }}>
              {t('Pick a crossing → get leave-by time + reminder')}
            </Text>
          </View>
          <Text style={{ color: '#30D158', fontSize: 20 }}>›</Text>
        </TouchableOpacity>
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
