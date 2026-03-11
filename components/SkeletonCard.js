import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

/**
 * Animated placeholder card shown while crossing data is loading.
 */
export default function SkeletonCard({ dark }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const bg = dark ? '#2C2C2E' : '#FFFFFF';
  const shimmer = dark ? '#3A3A3C' : '#E5E5EA';

  return (
    <Animated.View style={[styles.card, { backgroundColor: bg, opacity }]}>
      {/* Flag bubble */}
      <View style={[styles.bubble, { backgroundColor: shimmer }]} />
      <View style={styles.lines}>
        {/* Name line */}
        <View style={[styles.line, { width: '55%', backgroundColor: shimmer }]} />
        {/* Sub line */}
        <View style={[styles.line, { width: '40%', marginTop: 8, backgroundColor: shimmer }]} />
        {/* Chips row */}
        <View style={[styles.chipsRow]}>
          <View style={[styles.chip, { backgroundColor: shimmer }]} />
          <View style={[styles.chip, { backgroundColor: shimmer }]} />
          <View style={[styles.chip, { backgroundColor: shimmer }]} />
        </View>
      </View>
      {/* Right pill */}
      <View style={[styles.pill, { backgroundColor: shimmer }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  bubble: { width: 44, height: 44, borderRadius: 14 },
  lines: { flex: 1 },
  line: { height: 14, borderRadius: 7 },
  chipsRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  chip: { height: 20, width: 52, borderRadius: 8 },
  pill: { width: 60, height: 28, borderRadius: 10 },
});
