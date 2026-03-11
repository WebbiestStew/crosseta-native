import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { BLUE, GREEN, colors } from '../data';
import { SectionHeader } from '../components/UI';

const ITEMS = [
  { key: 'passport',      label: 'Passport / Photo ID', icon: '📘', required: true },
  { key: 'vehicle_reg',   label: 'Vehicle Registration', icon: '📄', required: true },
  { key: 'insurance',     label: 'Auto Insurance Card',  icon: '🛡️', required: true },
  { key: 'sentri',        label: 'SENTRI / NEXUS Card',  icon: '💳', required: false },
  { key: 'cash',          label: 'Cash / Pesos',         icon: '💵', required: false },
  { key: 'pet_cert',      label: 'Pet Health Certificate', icon: '🐾', required: false },
  { key: 'import_permit', label: 'Vehicle Import Permit', icon: '📋', required: false },
  { key: 'return_docs',   label: 'Return Ticket / Docs', icon: '🎫', required: false },
];

function ProgressRing({ progress, size = 80, stroke = 7, color = BLUE }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, Math.max(0, progress));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="#3A3A3C" strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function ChecklistScreen({ route, navigation }) {
  const { crossingId } = route.params;
  const { crossings, dark, checklist, toggleChecklistItem, resetChecklist } = useApp();
  const c = colors(dark);

  const crossing = crossings.find((x) => x.id === crossingId);
  const state = checklist[crossingId] ?? {};
  const checkedCount = ITEMS.filter((i) => state[i.key]).length;
  const progress = checkedCount / ITEMS.length;
  const allDone = checkedCount === ITEMS.length;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.navBar, {
        backgroundColor: c.headerBg,
        borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={{ color: BLUE, fontSize: 17 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: c.text }]}>Packing List</Text>
        <TouchableOpacity onPress={() => resetChecklist(crossingId)} hitSlop={8}>
          <Text style={{ color: '#FF453A', fontSize: 15, fontWeight: '600' }}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Progress card */}
        <View style={[styles.progressCard, { backgroundColor: c.card }]}>
          <View style={{ width: 80, height: 80 }}>
            <ProgressRing progress={progress} color={allDone ? GREEN : BLUE} />
            <View style={styles.progressPctOverlay}>
              <Text style={[styles.progressPct, { color: allDone ? GREEN : c.text }]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          </View>
          <View style={{ marginLeft: 20, flex: 1 }}>
            <Text style={[styles.progressTitle, { color: c.text }]}>
              {allDone ? '✓ All set!' : `${checkedCount} of ${ITEMS.length} ready`}
            </Text>
            <Text style={[styles.progressSub, { color: c.subtext }]}>
              {crossing ? `${crossing.flag} ${crossing.name}` : 'Travel documents'}
            </Text>
            {allDone && (
              <Text style={{ fontSize: 12, color: GREEN, fontWeight: '700', marginTop: 6 }}>
                Have a smooth crossing! 🚗
              </Text>
            )}
          </View>
        </View>

        <SectionHeader title="Required" dark={dark} />
        {ITEMS.filter((i) => i.required).map((item) => (
          <CheckRow
            key={item.key}
            item={item}
            checked={!!state[item.key]}
            onToggle={() => toggleChecklistItem(crossingId, item.key)}
            dark={dark}
            c={c}
          />
        ))}

        <SectionHeader title="Nice to Have" dark={dark} />
        {ITEMS.filter((i) => !i.required).map((item) => (
          <CheckRow
            key={item.key}
            item={item}
            checked={!!state[item.key]}
            onToggle={() => toggleChecklistItem(crossingId, item.key)}
            dark={dark}
            c={c}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function CheckRow({ item, checked, onToggle, dark, c }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      style={[styles.row, {
        backgroundColor: checked ? (dark ? '#0D2A0D' : '#F0FFF2') : c.card,
        borderLeftColor: checked ? GREEN : 'transparent',
        borderLeftWidth: 3,
      }]}
    >
      <Text style={styles.rowIcon}>{item.icon}</Text>
      <Text style={[styles.rowLabel, {
        color: checked ? (dark ? '#7FBA7F' : '#4AA45A') : c.text,
        textDecorationLine: checked ? 'line-through' : 'none',
      }]}>
        {item.label}
      </Text>
      <View style={[styles.checkbox, {
        backgroundColor: checked ? GREEN : 'transparent',
        borderColor: checked ? GREEN : (dark ? '#555' : '#C7C7CC'),
      }]}>
        {checked && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  navTitle: { fontSize: 17, fontWeight: '700' },
  progressCard: {
    flexDirection: 'row', alignItems: 'center', margin: 16, borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
    position: 'relative',
  },
  progressPctOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  progressPct: { fontSize: 13, fontWeight: '800' },
  progressTitle: { fontSize: 17, fontWeight: '800' },
  progressSub: { fontSize: 13, marginTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, padding: 14, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  rowIcon: { fontSize: 22 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  checkbox: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
});
