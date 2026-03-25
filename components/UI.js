import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Svg, Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { waitColor, BLUE, GREEN, ORANGE, RED } from '../data';

// ─── WAIT PILL ────────────────────────────────────────────────────────────────
export const WaitPill = ({ wait, small }) => (
  <View style={[styles.pill, { backgroundColor: waitColor(wait) }, small && styles.pillSmall]}>
    <Text style={[styles.pillText, small && styles.pillTextSmall]}>
      {wait == null || wait < 0 ? 'N/A' : `${wait} min`}
    </Text>
  </View>
);

// ─── PILL BUTTON ─────────────────────────────────────────────────────────────
export const PillBtn = ({ label, active, onPress, dark, activeColor }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.pillBtn, { backgroundColor: active ? (activeColor ?? BLUE) : (dark ? '#3A3A3C' : '#E5E5EA') }]}
    activeOpacity={0.7}    accessible={true}
    accessibilityLabel={label}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}  >
    <Text style={[styles.pillBtnText, { color: active ? '#fff' : (dark ? '#fff' : '#000') }]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ─── TOGGLE ───────────────────────────────────────────────────────────────────
export const Toggle = ({ value, onValueChange, dark }) => (
  <TouchableOpacity
    onPress={() => onValueChange(!value)}
    activeOpacity={0.8}
    style={[styles.toggle, { backgroundColor: value ? GREEN : (dark ? '#3A3A3C' : '#E5E5EA') }]}
  >
    <View style={[styles.toggleThumb, { transform: [{ translateX: value ? 21 : 2 }] }]} />
  </TouchableOpacity>
);

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
export const SectionHeader = ({ title, dark }) => (
  <Text style={[styles.sectionHeader, { color: dark ? '#8E8E93' : '#6C6C70' }]}>
    {title}
  </Text>
);

// ─── MINI SPARKLINE ──────────────────────────────────────────────────────────
export const Sparkline = ({ data, color, width = 80, height = 28 }) => {
  if (!data || data.length < 2) return <View style={{ width, height }} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const d = `M ${pts.join(' L ')}`;
  return (
    <Svg width={width} height={height}>
      <Path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

// ─── BIG SPARKLINE (24h) ─────────────────────────────────────────────────────
export const BigSparkline = ({ data, currentHour, width = 320 }) => {
  const H = 90;
  if (!data || data.length < 2) return <View style={{ width, height: H }} />;
  const max = Math.max(...data);
  const range = max || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    H - (v / range) * (H - 12) - 4,
  ]);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  const fill = line + ` L ${width} ${H} L 0 ${H} Z`;
  const cur = pts[Math.min(currentHour, pts.length - 1)] || [0, H / 2];
  return (
    <Svg width={width} height={H}>
      <Defs>
        <SvgLinearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={BLUE} stopOpacity="0.3" />
          <Stop offset="1" stopColor={BLUE} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <Path d={fill} fill="url(#sg)" />
      <Path d={line} fill="none" stroke={BLUE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={cur[0]} cy={cur[1]} r={5} fill={BLUE} stroke="#fff" strokeWidth={2} />
    </Svg>
  );
};

// ─── DRAG HANDLE ─────────────────────────────────────────────────────────────
export const DragHandle = ({ dark }) => (
  <View style={styles.dragHandleContainer}>
    <View style={[styles.dragHandle, { backgroundColor: dark ? '#48484A' : '#D1D1D6' }]} />
  </View>
);

// ─── GLASS SURFACE ────────────────────────────────────────────────────────────
export const GlassSurface = ({ children, style, dark, intensity = 60, borderRadius = 0, onLayout }) => {
  if (Platform.OS !== 'ios') {
    return (
      <View onLayout={onLayout} style={[{ backgroundColor: dark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)' }, style]}>
        {children}
      </View>
    );
  }
  return (
    <BlurView onLayout={onLayout} intensity={intensity} tint={dark ? 'dark' : 'extraLight'} style={[{ overflow: 'hidden', borderRadius }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(28,28,30,0.18)' : 'rgba(255,255,255,0.28)' }]} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 0.5, backgroundColor: dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,1)' }} />
      {children}
    </BlurView>
  );
};

// ─── CARD WRAPPER ─────────────────────────────────────────────────────────────
export const Card = ({ children, style, dark }) => (
  <View style={[
    styles.card,
    {
      backgroundColor: dark ? '#2C2C2E' : '#FFFFFF',
      borderWidth: 0.5,
      borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.95)',
    },
    style,
  ]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  pill: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  pillSmall: { paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pillTextSmall: { fontSize: 13 },
  pillBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 20, minHeight: 50 },
  pillBtnText: { fontSize: 16, fontWeight: '600' },
  toggle: { width: 60, height: 40, borderRadius: 20, justifyContent: 'center' },
  toggleThumb: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 3 },
  sectionHeader: { fontSize: 15, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 10 },
  dragHandleContainer: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  dragHandle: { width: 40, height: 5, borderRadius: 2.5 },
  card: { borderRadius: 18, marginHorizontal: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
});
