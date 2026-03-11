import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { BLUE, GREEN, waitColor, colors } from '../data';
import { SectionHeader } from '../components/UI';

export default function CrossingComparisonScreen({ route, navigation }) {
  const { crossingId } = route.params;
  const { crossings, dark } = useApp();
  const c = colors(dark);

  const thisCrossing = crossings.find((x) => x.id === crossingId);
  const region = thisCrossing?.region;
  const regionCrossings = crossings
    .filter((x) => x.region === region)
    .sort((a, b) => a.wait - b.wait);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.navBar, {
        backgroundColor: c.headerBg,
        borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={{ color: BLUE, fontSize: 17 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: c.text }]}>Compare</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <SectionHeader
          title={`${region ?? 'Region'} · ${regionCrossings.length} crossings`}
          dark={dark}
        />

        {/* Column header */}
        <View style={[styles.colHeaderRow, { backgroundColor: c.card }]}>
          <Text style={[styles.colHdr, { flex: 2, textAlign: 'left', color: c.subtext }]}>Crossing</Text>
          <Text style={[styles.colHdr, { color: c.subtext }]}>Now</Text>
          <Text style={[styles.colHdr, { color: c.subtext }]}>SENTRI</Text>
          <Text style={[styles.colHdr, { color: c.subtext }]}>+1h</Text>
          <Text style={[styles.colHdr, { color: c.subtext }]}>+3h</Text>
        </View>

        {regionCrossings.map((crossing, i) => {
          const isThis = crossing.id === crossingId;
          return (
            <TouchableOpacity
              key={crossing.id}
              onPress={() => navigation.navigate('Detail', { crossing })}
              activeOpacity={0.75}
              style={[styles.row, {
                backgroundColor: isThis ? (dark ? '#1C2E4A' : '#E8F1FF') : c.card,
                borderLeftColor: isThis ? BLUE : 'transparent',
                borderLeftWidth: 3,
              }]}
            >
              <View style={{ flex: 2 }}>
                <Text style={[styles.rowName, {
                  color: c.text,
                  fontWeight: isThis ? '800' : '600',
                }]} numberOfLines={1}>
                  {crossing.flag} {crossing.name}
                </Text>
                {i === 0 && (
                  <Text style={{ fontSize: 10, color: GREEN, fontWeight: '700', marginTop: 2 }}>
                    SHORTEST ✓
                  </Text>
                )}
                {isThis && (
                  <Text style={{ fontSize: 10, color: BLUE, fontWeight: '700', marginTop: 2 }}>
                    ← This one
                  </Text>
                )}
              </View>
              <Text style={[styles.cell, { color: waitColor(crossing.wait) }]}>{crossing.wait}m</Text>
              <Text style={[styles.cell, { color: waitColor(crossing.sentriWait) }]}>{crossing.sentriWait}m</Text>
              <Text style={[styles.cell, { color: waitColor(crossing.predict1h) }]}>{crossing.predict1h}m</Text>
              <Text style={[styles.cell, { color: waitColor(crossing.predict3h) }]}>{crossing.predict3h}m</Text>
            </TouchableOpacity>
          );
        })}
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
  colHeaderRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 4,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  colHdr: { flex: 1, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 6,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  rowName: { fontSize: 13, flexWrap: 'wrap' },
  cell: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
