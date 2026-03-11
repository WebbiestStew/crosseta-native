import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  StyleSheet,
  Animated,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useApp } from '../context/AppContext';
import { colors, BLUE, GREEN, RED, ORANGE } from '../data';
import { DragHandle, PillBtn } from './UI';

const LANE_OPTIONS = [
  { key: 'standard', label: 'Standard',       color: BLUE },
  { key: 'sentri',   label: 'SENTRI / NEXUS',  color: '#BF5AF2' },
  { key: 'ready',    label: 'Ready Lane',      color: GREEN },
];

/**
 * Floating Action Button that drives the tracking session start flow.
 *
 * When no session is active: renders a ＋ FAB that opens a bottom sheet
 * to pick a crossing & lane type then calls startTracking().
 *
 * When a session IS active: renders a pulsing red "● LIVE" chip that
 * navigates directly to InLineScreen.
 *
 * @param {{ navigation: object, dark: boolean }} props
 */
export function TrackingFAB({ navigation, dark }) {
  const { crossings, favorites, activeCrossing, startTracking } = useApp();
  const c = colors(dark);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState(null);   // crossing object
  const [lane,      setLane]      = useState('standard');

  // ─── Entrance animation (Reanimated) ───────────────────────────────────────
  const fabTranslateY = useSharedValue(120);
  useEffect(() => {
    fabTranslateY.value = withSpring(0, { damping: 14, stiffness: 140 });
  }, []);
  const fabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: fabTranslateY.value }],
  }));

  // ─── Pulse animation for LIVE badge (Reanimated) ───────────────────────────
  const liveScale = useSharedValue(1);
  useEffect(() => {
    if (activeCrossing) {
      liveScale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 550 }),
          withTiming(1,    { duration: 550 }),
        ),
        -1,
        true,
      );
    } else {
      liveScale.value = withTiming(1, { duration: 200 });
    }
  }, [!!activeCrossing]);
  const liveAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: liveScale.value }],
  }));

  // ─── Sheet backdrop fade ────────────────────────────────────────────────────
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(backdropOpacity, {
      toValue: sheetOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [sheetOpen]);

  // ─── Crossing list ──────────────────────────────────────────────────────────
  const favCrossings = crossings.filter((x) => favorites.includes(x.id));
  const query = search.toLowerCase();
  const filteredCrossings = query.length > 0
    ? crossings.filter(
        (x) =>
          x.name.toLowerCase().includes(query) ||
          x.city.toLowerCase().includes(query),
      )
    : crossings;

  const handleOpen = useCallback(() => {
    setSelected(null);
    setLane('standard');
    setSearch('');
    setSheetOpen(true);
  }, []);

  const handleStart = useCallback(() => {
    if (!selected) return;
    setSheetOpen(false);
    startTracking(selected.id, lane);
    // Navigate to InLineScreen after a tick so context state settles
    setTimeout(() => navigation.navigate('InLine'), 80);
  }, [selected, lane, navigation, startTracking]);

  // ─── LIVE button (session active) ──────────────────────────────────────────
  if (activeCrossing) {
    const activeCr = crossings.find((x) => x.id === activeCrossing.crossingId);
    return (
      <Reanimated.View style={[styles.liveWrapper, fabAnimStyle]}>
        <Reanimated.View style={liveAnimStyle}>
          <TouchableOpacity
            onPress={() => navigation.navigate('InLine')}
            activeOpacity={0.85}
            style={styles.liveBtn}
          >
            <View style={styles.liveDot} />
            <Text style={styles.liveBtnText}>LIVE</Text>
            {activeCr && (
              <Text style={styles.liveSubText} numberOfLines={1}>
                {activeCr.flag} {activeCr.name}
              </Text>
            )}
          </TouchableOpacity>
        </Reanimated.View>
      </Reanimated.View>
    );
  }

  // ─── FAB (no session) ───────────────────────────────────────────────────────
  return (
    <>
      <Reanimated.View style={[styles.fabWrapper, fabAnimStyle]}>
        <TouchableOpacity onPress={handleOpen} activeOpacity={0.85} style={styles.fab}>
          <Text style={styles.fabIcon}>🚗</Text>
          <Text style={styles.fabText}>I'm In Line</Text>
        </TouchableOpacity>
      </Reanimated.View>

      {/* ─── Bottom Sheet Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalFlex}
        >
          {/* Backdrop */}
          <Animated.View
            style={[styles.backdrop, { opacity: backdropOpacity }]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setSheetOpen(false)}
            />
          </Animated.View>

          {/* Sheet */}
          <SafeAreaView style={[styles.sheet, { backgroundColor: c.card }]}>
            <DragHandle dark={dark} />

            <Text style={[styles.sheetTitle, { color: c.text }]}>Start Tracking</Text>
            <Text style={[styles.sheetSub, { color: c.subtext }]}>
              Select your crossing and lane type
            </Text>

            {/* Lane selector */}
            <View style={styles.laneRow}>
              {LANE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setLane(opt.key)}
                  style={[
                    styles.laneChip,
                    {
                      backgroundColor: lane === opt.key ? opt.color : (dark ? '#3A3A3C' : '#E5E5EA'),
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.laneChipText, { color: lane === opt.key ? '#fff' : c.text }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Crossing search */}
            <View style={[styles.searchBar, { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' }]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search crossings..."
                placeholderTextColor="#8E8E93"
                style={[styles.searchInput, { color: c.text }]}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>

            {/* Favorites section (only when no search) */}
            {search.length === 0 && favCrossings.length > 0 && (
              <Text style={[styles.sectionLabel, { color: c.subtext }]}>FAVORITES</Text>
            )}

            <FlatList
              data={search.length === 0 ? filteredCrossings : filteredCrossings}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.crossingList}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                search.length === 0 && favCrossings.length > 0 ? (
                  <>
                    {favCrossings.map((item) => (
                      <CrossingRow
                        key={item.id}
                        crossing={item}
                        selected={selected?.id === item.id}
                        onPress={() => setSelected(item)}
                        dark={dark}
                      />
                    ))}
                    <Text style={[styles.sectionLabel, { color: c.subtext, marginTop: 4 }]}>
                      ALL CROSSINGS
                    </Text>
                  </>
                ) : null
              }
              renderItem={({ item }) =>
                // Don't double-render favorites when no search
                search.length === 0 && favorites.includes(item.id) ? null : (
                  <CrossingRow
                    crossing={item}
                    selected={selected?.id === item.id}
                    onPress={() => setSelected(item)}
                    dark={dark}
                  />
                )
              }
            />

            {/* Start button */}
            <TouchableOpacity
              onPress={handleStart}
              activeOpacity={selected ? 0.85 : 1}
              style={[styles.startBtn, { backgroundColor: selected ? BLUE : (dark ? '#3A3A3C' : '#C7C7CC') }]}
              disabled={!selected}
            >
              <Text style={[styles.startBtnText, { color: selected ? '#fff' : '#8E8E93' }]}>
                {selected ? `Track  ${selected.flag}  ${selected.name}` : 'Select a crossing above'}
              </Text>
            </TouchableOpacity>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

/** Single row in the crossing picker. */
function CrossingRow({ crossing, selected, onPress, dark }) {
  const c = colors(dark);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.crossingRow,
        {
          backgroundColor: selected ? (dark ? '#1C3A5E' : '#E8F1FF') : 'transparent',
          borderColor: selected ? BLUE : 'transparent',
        },
      ]}
    >
      <Text style={styles.crossingFlag}>{crossing.flag}</Text>
      <View style={styles.crossingMeta}>
        <Text style={[styles.crossingName, { color: c.text }]}>{crossing.name}</Text>
        <Text style={[styles.crossingCity, { color: c.subtext }]}>{crossing.city}</Text>
      </View>
      <Text style={[styles.crossingWait, { color: selected ? BLUE : c.subtext }]}>
        {crossing.wait} min
      </Text>
      {selected && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // FAB
  fabWrapper: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    zIndex: 50,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BLUE,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIcon: { fontSize: 20, marginRight: 8 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // LIVE chip
  liveWrapper: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    zIndex: 50,
  },
  liveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RED,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    shadowColor: RED,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
    gap: 8,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  liveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  liveSubText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500', maxWidth: 160 },

  // Modal / sheet
  modalFlex: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  sheet: {
    marginTop: 'auto',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 12,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginTop: 6, marginBottom: 2 },
  sheetSub: { fontSize: 14, marginBottom: 14 },

  // Lane selector
  laneRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  laneChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 20,
    alignItems: 'center',
  },
  laneChipText: { fontSize: 12, fontWeight: '700' },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginBottom: 8,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },

  // Crossing rows
  crossingList: { maxHeight: 300 },
  crossingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 4,
  },
  crossingFlag: { fontSize: 26, marginRight: 12 },
  crossingMeta: { flex: 1 },
  crossingName: { fontSize: 15, fontWeight: '600' },
  crossingCity: { fontSize: 12, marginTop: 1 },
  crossingWait: { fontSize: 13, fontWeight: '600', marginRight: 4 },
  checkmark: { fontSize: 16, color: BLUE, fontWeight: '800' },

  // Start button
  startBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  startBtnText: { fontSize: 16, fontWeight: '700' },
});
