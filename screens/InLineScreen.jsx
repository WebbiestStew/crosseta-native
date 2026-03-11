import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import { useLineTracker } from '../hooks/useLineTracker';
import { colors, BLUE, GREEN, ORANGE, RED } from '../data';
import { Card, BigSparkline, GlassSurface } from '../components/UI';

/** Format seconds as MM:SS */
function formatTime(totalSecs) {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const LANE_LABELS = { standard: 'Standard', sentri: 'SENTRI / NEXUS', ready: 'Ready Lane' };
const LANE_COLORS = { standard: BLUE, sentri: '#BF5AF2', ready: GREEN };

/** Map tracking status to display label + accent color */
function statusMeta(status, distanceMoved) {
  if (status === 'done')     return { label: 'Cleared!',           color: GREEN,  emoji: '✅' };
  if (status === 'clearing') return { label: 'Almost Through!',    color: GREEN,  emoji: '🏁' };
  if (status === 'moving')   return { label: 'Movement Detected',  color: ORANGE, emoji: '🚗' };
  // queued — distinguish "waiting for GPS" vs confirmed in line
  if (distanceMoved === 0)   return { label: 'In Queue',           color: BLUE,   emoji: '🔵' };
  return                            { label: 'In Queue',           color: BLUE,   emoji: '🔵' };
}

/**
 * Full-screen active-tracking UI.  Shown whenever activeCrossing is non-null.
 * Mounts useLineTracker so the GPS subscription and timer are tied to this screen's lifecycle.
 */
export default function InLineScreen({ navigation }) {
  const { dark, crossings, activeCrossing } = useApp();
  const { currentWait, status, distanceMoved, stopTracking } = useLineTracker();
  const { width } = useWindowDimensions();
  const c = colors(dark);

  const crossing = crossings.find((x) => x.id === activeCrossing?.crossingId) ?? null;
  const laneType = activeCrossing?.laneType ?? 'standard';

  // ─── Pulse animation for the status dot ──────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.45, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // ─── Timer digit entrance animation ──────────────────────────────────────
  const timerOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(timerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const meta = statusMeta(status, distanceMoved);

  const handleCleared = () => {
    stopTracking(false);
    navigation.goBack();
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Tracking',
      'Stop tracking? This session won\'t be saved.',
      [
        { text: 'Keep Tracking', style: 'cancel' },
        {
          text: 'Cancel Session',
          style: 'destructive',
          onPress: () => {
            stopTracking(true);
            navigation.goBack();
          },
        },
      ],
    );
  };

  if (!activeCrossing || !crossing) {
    // Graceful fallback if deep-linked or state cleared
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
        <View style={styles.centred}>
          <Text style={[styles.emptyText, { color: c.text }]}>No active session.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentHour = new Date().getHours();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} hitSlop={12} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: RED }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>I'm In Line</Text>
        <View style={styles.cancelBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Hero gradient card ── */}
        <LinearGradient
          colors={dark ? ['#1C2E4A', '#1C1C1E'] : ['#E8F1FF', '#F2F2F7']}
          style={styles.heroCard}
        >
          {/* Crossing + lane badge */}
          <View style={styles.crossingRow}>
            <Text style={styles.crossingFlag}>{crossing.flag}</Text>
            <View style={styles.crossingInfo}>
              <Text style={[styles.crossingName, { color: c.text }]} numberOfLines={1}>
                {crossing.name}
              </Text>
              <Text style={[styles.crossingCity, { color: c.subtext }]}>
                {crossing.city} → {crossing.country}
              </Text>
            </View>
            <View style={[styles.laneBadge, { backgroundColor: LANE_COLORS[laneType] }]}>
              <Text style={styles.laneText}>{LANE_LABELS[laneType]}</Text>
            </View>
          </View>

          {/* Elapsed timer — the centrepiece */}
          <Animated.View style={[styles.timerContainer, { opacity: timerOpacity }]}>
            <Text style={[styles.timerLabel, { color: c.subtext }]}>TIME IN LINE</Text>
            <Text style={[styles.timer, { color: c.text }]}>{formatTime(currentWait)}</Text>
            <Text style={[styles.timerSub, { color: c.subtext }]}>
              {Math.floor(currentWait / 60)} min {currentWait % 60} sec
            </Text>
          </Animated.View>

          {/* Status pill with pulse */}
          <View style={styles.statusRow}>
            <View style={styles.pulseWrapper}>
              <Animated.View
                style={[
                  styles.pulseDot,
                  { backgroundColor: meta.color, transform: [{ scale: pulseAnim }], opacity: 0.35 },
                ]}
              />
              <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
            </View>
            <Text style={[styles.statusLabel, { color: meta.color }]}>
              {meta.emoji}  {meta.label}
            </Text>
          </View>

          {distanceMoved > 0 && (
            <Text style={[styles.distanceNote, { color: c.subtext }]}>
              {Math.round(distanceMoved)}m from entry point
            </Text>
          )}
        </LinearGradient>

        {/* ── Today's pattern sparkline ── */}
        <Card dark={dark} style={styles.sparkCard}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Today's Pattern</Text>
          <Text style={[styles.cardSub, { color: c.subtext }]}>
            Historical wait times · circle marks now
          </Text>
          <View style={styles.sparklineWrapper}>
            <BigSparkline
              data={crossing.hourlyPattern}
              currentHour={currentHour}
              width={width - 64}
            />
          </View>
          <View style={styles.sparkAxis}>
            <Text style={[styles.axisLabel, { color: c.subtext }]}>12am</Text>
            <Text style={[styles.axisLabel, { color: c.subtext }]}>6am</Text>
            <Text style={[styles.axisLabel, { color: c.subtext }]}>12pm</Text>
            <Text style={[styles.axisLabel, { color: c.subtext }]}>6pm</Text>
            <Text style={[styles.axisLabel, { color: c.subtext }]}>11pm</Text>
          </View>
        </Card>

        {/* ── Predictions snapshot ── */}
        <Card dark={dark} style={styles.predictCard}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Current Lane Estimates</Text>
          <View style={styles.predictRow}>
            {[
              { label: 'Standard now', value: `${crossing.wait} min` },
              { label: 'SENTRI now',   value: `${crossing.sentriWait} min` },
              { label: '+1h standard', value: `${crossing.predict1h} min` },
            ].map(({ label, value }) => (
              <View key={label} style={styles.predictCell}>
                <Text style={[styles.predictValue, { color: c.text }]}>{value}</Text>
                <Text style={[styles.predictLabel, { color: c.subtext }]}>{label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* ── Privacy note ── */}
        <GlassSurface dark={dark} borderRadius={14} style={styles.privacyNote}>
          <Text style={[styles.privacyText, { color: c.subtext }]}>
            🔒  GPS is active only while this screen is open. Your data helps improve
            predictions for everyone — anonymously.
          </Text>
        </GlassSurface>

        {/* ── CTA buttons ── */}
        <TouchableOpacity onPress={handleCleared} activeOpacity={0.85} style={styles.clearedBtn}>
          <LinearGradient colors={['#34C759', '#30D158']} style={styles.clearedGradient}>
            <Text style={styles.clearedBtnText}>✅  I Cleared!</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleCancel} activeOpacity={0.8} style={styles.cancelFooterBtn}>
          <Text style={[styles.cancelFooterText, { color: c.subtext }]}>Cancel Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 17, fontWeight: '500', marginBottom: 20 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: BLUE, borderRadius: 12 },
  backBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  cancelBtn: { width: 64 },
  cancelText: { fontSize: 15, fontWeight: '600' },

  scroll: { paddingBottom: 48 },

  // Hero card
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },
  crossingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  crossingFlag: { fontSize: 36, marginRight: 12 },
  crossingInfo: { flex: 1 },
  crossingName: { fontSize: 17, fontWeight: '700' },
  crossingCity: { fontSize: 13, marginTop: 2 },
  laneBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  laneText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Timer
  timerContainer: { alignItems: 'center', marginVertical: 16 },
  timerLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  timer: { fontSize: 72, fontWeight: '700', fontVariant: ['tabular-nums'], lineHeight: 80 },
  timerSub: { fontSize: 14, marginTop: 4 },

  // Status
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  pulseWrapper: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  pulseDot: { position: 'absolute', width: 20, height: 20, borderRadius: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 15, fontWeight: '600' },
  distanceNote: { textAlign: 'center', fontSize: 12, marginTop: 8 },

  // Cards
  sparkCard: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  predictCard: { paddingHorizontal: 16, paddingVertical: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  cardSub: { fontSize: 12, marginBottom: 12 },
  sparklineWrapper: { alignItems: 'center' },
  sparkAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 8,
  },
  axisLabel: { fontSize: 10 },

  predictRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  predictCell: { flex: 1, alignItems: 'center' },
  predictValue: { fontSize: 17, fontWeight: '700' },
  predictLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' },

  // Privacy note
  privacyNote: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 12,
  },
  privacyText: { fontSize: 12, lineHeight: 18 },

  // Buttons
  clearedBtn: { marginHorizontal: 16, marginTop: 8, borderRadius: 16, overflow: 'hidden' },
  clearedGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  clearedBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  cancelFooterBtn: { alignItems: 'center', marginTop: 16, paddingVertical: 8 },
  cancelFooterText: { fontSize: 14, fontWeight: '500' },
});
