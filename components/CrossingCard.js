import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WaitPill, Sparkline } from './UI';
import { waitColor, BLUE, GREEN, ORANGE, RED, getTimeUntilClose } from '../data';

export default function CrossingCard({ crossing, isFav, onStar, onPress, dark, distanceMi }) {
  const trendIcon = crossing.trend === 'up' ? '↑' : crossing.trend === 'down' ? '↓' : '→';
  const trendColor = crossing.trend === 'up' ? RED : crossing.trend === 'down' ? GREEN : '#8E8E93';
  const stale = crossing.dataAge > 8;
  const card = dark ? '#2C2C2E' : '#FFFFFF';
  const text = dark ? '#FFFFFF' : '#000000';

  // Hours countdown — show amber chip when closing within 2 hours
  const minsUntilClose = getTimeUntilClose(crossing);
  const closingSoon = minsUntilClose !== null && minsUntilClose <= 120;
  const closeLabel = minsUntilClose !== null
    ? minsUntilClose >= 60
      ? `Closes in ${Math.floor(minsUntilClose / 60)}h ${minsUntilClose % 60}m`
      : `Closes in ${minsUntilClose}m`
    : null;

  return (
    <TouchableOpacity onPress={() => onPress(crossing)} activeOpacity={0.8} style={[styles.card, { backgroundColor: card }]}>
      <View style={styles.row}>
        {/* Flag bubble */}
        <View style={[styles.flagBubble, { backgroundColor: crossing.border === 'MX' ? 'rgba(0,122,255,0.12)' : 'rgba(48,209,88,0.12)' }]}>
          <Text style={{ fontSize: 24 }}>{crossing.flag}</Text>
        </View>

        {/* Center info */}
        <View style={styles.centerInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: text }]} numberOfLines={1}>{crossing.name}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: trendColor, marginLeft: 4 }}>{trendIcon}</Text>
            {!crossing.is24h && (
              <View style={styles.limitedBadge}>
                <Text style={styles.limitedText}>Limited</Text>
              </View>
            )}
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {crossing.city} · {crossing.country}
            {crossing.driveMin > 0 ? ` · ${crossing.driveMin}m drive` : ''}
            {distanceMi != null ? ` · ${distanceMi < 10 ? distanceMi.toFixed(1) : Math.round(distanceMi)} mi` : ''}
          </Text>
          {/* Chips */}
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: dark ? '#3A3A3C' : '#F2F2F7' }]}>
              <Text style={[styles.chipLabel, { color: dark ? '#aaa' : '#555' }]}>
                +1h <Text style={{ color: waitColor(crossing.predict1h), fontWeight: '700' }}>{crossing.predict1h}m</Text>
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: dark ? '#3A3A3C' : '#F2F2F7' }]}>
              <Text style={[styles.chipLabel, { color: dark ? '#aaa' : '#555' }]}>
                +3h <Text style={{ color: waitColor(crossing.predict3h), fontWeight: '700' }}>{crossing.predict3h}m</Text>
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: stale ? 'rgba(255,159,10,0.15)' : (dark ? '#3A3A3C' : '#F2F2F7') }]}>
              <Text style={[styles.chipLabel, { color: stale ? ORANGE : (dark ? '#aaa' : '#555') }]}>
                {crossing.dataAge}m ago
              </Text>
            </View>
            {closingSoon && (
              <View style={[styles.chip, { backgroundColor: 'rgba(255,159,10,0.15)' }]}>
                <Text style={[styles.chipLabel, { color: ORANGE, fontWeight: '700' }]}>⏰ {closeLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Right side */}
        <View style={styles.rightSide}>
          <WaitPill wait={crossing.wait} />
          <View style={{ marginTop: 6 }}>
            <Sparkline data={crossing.sparkline} color={waitColor(crossing.wait)} width={70} height={24} />
          </View>
          <View style={styles.starRow}>
            <TouchableOpacity onPress={() => onStar(crossing.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 20 }}>{isFav ? '⭐' : '☆'}</Text>
            </TouchableOpacity>
            <Text style={{ color: '#C7C7CC', fontSize: 16, marginLeft: 8 }}>›</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18, marginHorizontal: 16, marginBottom: 10,
    padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flagBubble: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  centerInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  name: { fontSize: 15, fontWeight: '700' },
  limitedBadge: { backgroundColor: 'rgba(255,159,10,0.15)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  limitedText: { fontSize: 10, fontWeight: '700', color: ORANGE },
  subtitle: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  chips: { flexDirection: 'row', gap: 5, marginTop: 7, flexWrap: 'wrap', alignItems: 'center' },
  chip: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  chipLabel: { fontSize: 11 },
  rightSide: { alignItems: 'flex-end', gap: 4 },
  starRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
});
