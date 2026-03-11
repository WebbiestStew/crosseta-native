import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { colors, BLUE, GREEN, ORANGE, RED } from '../data';
import { SectionHeader, Card, Sparkline } from '../components/UI';

const LANE_LABELS = { standard: 'Standard', sentri: 'SENTRI', ready: 'Ready' };
const LANE_COLORS = { standard: BLUE, sentri: '#BF5AF2', ready: GREEN };

/**
 * Format a Unix timestamp (ms) as a human-readable date/time string.
 * @param {number} ts
 * @returns {string}
 */
function formatDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format elapsed minutes into a readable duration.
 * @param {number} minutes
 * @returns {string}
 */
function formatWait(minutes) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes} min`;
}

/**
 * Colour-aware wait badge: green ≤15, orange ≤40, red >40.
 */
function WaitBadge({ minutes }) {
  const bg = minutes <= 15 ? GREEN : minutes <= 40 ? ORANGE : RED;
  return (
    <View style={[styles.waitBadge, { backgroundColor: bg }]}>
      <Text style={styles.waitBadgeText}>{formatWait(minutes)}</Text>
    </View>
  );
}

/**
 * Screen showing all user-tracked completed trips, sorted newest-first.
 * Separate from the prediction-based TripsScreen; these are ground-truth sessions.
 */
export default function TripHistoryScreen({ navigation }) {
  const { dark, completedTrips, clearCompletedTrips, crossings } = useApp();
  const { width } = useWindowDimensions();
  const c = colors(dark);

  const sorted = [...completedTrips].sort((a, b) => b.startTime - a.startTime);

  // ── Personal analytics ────────────────────────────────────────────────
  const analytics = (() => {
    if (sorted.length === 0) return null;
    // Most visited crossing
    const cCounts = sorted.reduce((acc, t) => { acc[t.crossingId] = (acc[t.crossingId] || 0) + 1; return acc; }, {});
    const topId = Object.keys(cCounts).sort((a, b) => cCounts[b] - cCounts[a])[0];
    const topCrossing = crossings.find((c) => c.id === topId);
    // best day of week
    const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayStats = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
    sorted.forEach((t) => { const d = new Date(t.startTime).getDay(); dayStats[d].total += t.actualWait; dayStats[d].count++; });
    const bestDayIdx = dayStats.reduce((bi, d, i, arr) => {
      if (d.count === 0) return bi;
      if (bi === -1) return i;
      return (d.total / d.count) < (arr[bi].total / arr[bi].count) ? i : bi;
    }, -1);
    const bestDay = bestDayIdx >= 0 ? DAY[bestDayIdx] : null;
    const bestDayAvg = bestDayIdx >= 0 ? Math.round(dayStats[bestDayIdx].total / dayStats[bestDayIdx].count) : null;
    // avg wait + personal best
    const avgWait = Math.round(sorted.reduce((s, t) => s + t.actualWait, 0) / sorted.length);
    const bestWait = Math.min(...sorted.map((t) => t.actualWait));
    return { topCrossing, topCount: cCounts[topId], bestDay, bestDayAvg, avgWait, bestWait };
  })();

  const handleClear = () => {
    Alert.alert(
      'Clear Trip History',
      'Delete all tracked trips? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete All', style: 'destructive', onPress: clearCompletedTrips },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, {
        backgroundColor: c.headerBg,
        borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: BLUE }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>Trip Log</Text>
        {sorted.length > 0 ? (
          <TouchableOpacity onPress={handleClear} hitSlop={8}>
            <Text style={[styles.clearText, { color: RED }]}>Clear</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.clearPlaceholder} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* How does this help? */}
        <View style={[styles.infoBanner, { backgroundColor: dark ? '#1C2E4A' : '#E8F1FF' }]}>
          <Text style={styles.infoEmoji}>📡</Text>
          <View style={styles.infoTextBlock}>
            <Text style={[styles.infoTitle, { color: c.text }]}>How does this help?</Text>
            <Text style={[styles.infoBody, { color: c.subtext }]}>
              Every trip you track is anonymously contributed to CrossETA's prediction
              model — giving everyone more accurate wait-time forecasts over time.
              No personal data is ever stored.
            </Text>
          </View>
        </View>

        {/* Stats row */}
        {sorted.length > 0 && (
          <>
            <SectionHeader title="Summary" dark={dark} />
            <View style={[styles.statsRow, { backgroundColor: c.card }]}>
              {[
                { label: 'Trips Tracked', value: String(sorted.length) },
                {
                  label: 'Total Wait',
                  value: formatWait(sorted.reduce((s, t) => s + t.actualWait, 0)),
                },
                {
                  label: 'Avg Wait',
                  value: sorted.length
                    ? formatWait(Math.round(sorted.reduce((s, t) => s + t.actualWait, 0) / sorted.length))
                    : '—',
                },
              ].map(({ label, value }) => (
                <View key={label} style={styles.statCell}>
                  <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
                  <Text style={[styles.statLabel, { color: c.subtext }]}>{label}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Personal analytics */}
        {analytics && (
          <>
            <SectionHeader title="My Patterns" dark={dark} />
            <View style={[styles.analyticsGrid, { backgroundColor: c.card }]}>
              {[
                {
                  label: 'Fav Crossing',
                  value: analytics.topCrossing ? analytics.topCrossing.flag : '🚗',
                  sub: analytics.topCrossing ? analytics.topCrossing.name : '—',
                  color: BLUE,
                },
                {
                  label: 'Best Day',
                  value: analytics.bestDay ?? '—',
                  sub: analytics.bestDayAvg != null ? `avg ${analytics.bestDayAvg} min` : '',
                  color: GREEN,
                },
                {
                  label: 'Avg Wait',
                  value: `${analytics.avgWait}m`,
                  sub: `best: ${analytics.bestWait} min`,
                  color: ORANGE,
                },
              ].map(({ label, value, sub, color }) => (
                <View key={label} style={styles.analyticsCell}>
                  <Text style={[styles.analyticsValue, { color }]}>{value}</Text>
                  <Text style={[styles.analyticsLabel, { color: c.subtext }]}>{label}</Text>
                  {sub ? <Text style={[styles.analyticsSub, { color: c.subtext }]}>{sub}</Text> : null}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Trip list */}
        <SectionHeader title={`Trips (${sorted.length})`} dark={dark} />

        {sorted.length === 0 ? (
          <EmptyState dark={dark} />
        ) : (
          sorted.map((trip) => {
            const crossing = crossings.find((x) => x.id === trip.crossingId);
            return (
              <TripRow
                key={trip.id}
                trip={trip}
                crossing={crossing}
                dark={dark}
                chartWidth={width - 64}
              />
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Trip row ─────────────────────────────────────────────────────────────────

/**
 * @param {{ trip: object, crossing: object|undefined, dark: boolean, chartWidth: number }} props
 */
function TripRow({ trip, crossing, dark, chartWidth }) {
  const c = colors(dark);
  const laneColor = LANE_COLORS[trip.laneType] ?? BLUE;

  // Determine which hour they crossed to highlight on sparkline
  const crossingHour = new Date(trip.startTime).getHours();

  return (
    <Card dark={dark} style={styles.tripCard}>
      {/* Top row: flag + name + wait */}
      <View style={styles.tripTop}>
        <Text style={styles.tripFlag}>{crossing?.flag ?? '🚗'}</Text>

        <View style={styles.tripInfo}>
          <Text style={[styles.tripName, { color: c.text }]} numberOfLines={1}>
            {crossing?.name ?? trip.crossingId}
          </Text>
          <Text style={[styles.tripMeta, { color: c.subtext }]}>
            {formatDateTime(trip.startTime)}
          </Text>
        </View>

        <View style={styles.tripRight}>
          <WaitBadge minutes={trip.actualWait} />
          <View style={[styles.lanePill, { backgroundColor: laneColor }]}>
            <Text style={styles.lanePillText}>{LANE_LABELS[trip.laneType] ?? trip.laneType}</Text>
          </View>
        </View>
      </View>

      {/* Sparkline — today's pattern with a dot at the crossed hour */}
      {crossing?.hourlyPattern && (
        <View style={styles.sparkRow}>
          <Sparkline
            data={crossing.hourlyPattern}
            color={laneColor}
            width={chartWidth}
            height={32}
          />
          <View style={styles.sparkLegend}>
            <View style={[styles.legendDot, { backgroundColor: laneColor }]} />
            <Text style={[styles.legendText, { color: c.subtext }]}>
              {new Date(trip.startTime).toLocaleString(undefined, { weekday: 'short', hour: 'numeric' })}
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ dark }) {
  const c = colors(dark);
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🚗</Text>
      <Text style={[styles.emptyTitle, { color: c.text }]}>No trips yet</Text>
      <Text style={[styles.emptyBody, { color: c.subtext }]}>
        Tap "I'm In Line" on the home screen to start tracking a crossing. Your wait
        times will appear here and help improve predictions for everyone.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  backBtn: { width: 64 },
  backBtnText: { fontSize: 17, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700' },
  clearText: { fontSize: 15, fontWeight: '600' },
  clearPlaceholder: { width: 64 },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  infoEmoji: { fontSize: 28, marginTop: 2 },
  infoTextBlock: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  infoBody: { fontSize: 13, lineHeight: 19 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 8,
    paddingVertical: 16,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' },

  // Trip card
  tripCard: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  tripTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  tripFlag: { fontSize: 30, marginRight: 12 },
  tripInfo: { flex: 1 },
  tripName: { fontSize: 15, fontWeight: '700' },
  tripMeta: { fontSize: 12, marginTop: 2 },
  tripRight: { alignItems: 'flex-end', gap: 5 },
  waitBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  waitBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  lanePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  lanePillText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Sparkline
  sparkRow: { marginTop: 2 },
  sparkLegend: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  legendText: { fontSize: 11 },

  // Analytics
  analyticsGrid: {
    flexDirection: 'row', marginHorizontal: 16, borderRadius: 16,
    marginBottom: 8, paddingVertical: 16,
  },
  analyticsCell: { flex: 1, alignItems: 'center' },
  analyticsValue: { fontSize: 20, fontWeight: '800' },
  analyticsLabel: { fontSize: 11, marginTop: 2, textAlign: 'center', fontWeight: '600' },
  analyticsSub: { fontSize: 10, marginTop: 1, textAlign: 'center' },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 48 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  emptyBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
