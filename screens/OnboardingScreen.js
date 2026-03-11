import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ALL_CROSSINGS, BLUE, GREEN, ORANGE, waitColor } from '../data';
import { PillBtn, WaitPill } from '../components/UI';
import { useApp } from '../context/AppContext';

const FEATURES = [
  { icon: '⏱', title: 'Live Wait Times', desc: 'CBP-sourced data refreshed every 5 minutes' },
  { icon: '🔮', title: 'Smart Predictions', desc: '+1h and +3h lane-specific forecasts with confidence scores' },
  { icon: '📅', title: 'Leave-By Calculator', desc: "Pick your arrival time, we'll tell you when to leave" },
  { icon: '🔥', title: 'Weekly Heatmap', desc: 'See patterns across all days and time slots' },
  { icon: '👥', title: 'Community Reports', desc: 'Real reports from real travelers, verified by votes' },
];

const TIMES = ['Early Morning (4–7am)', 'Morning (7–10am)', 'Midday (10am–1pm)', 'Afternoon (1–5pm)', 'Evening (5–9pm)', 'I vary'];

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState([]);
  const [borderFilter, setBorderFilter] = useState('All');
  const [crossingTime, setCrossingTime] = useState('');
  const { dark } = useApp();

  const bg = dark ? '#1C1C1E' : '#F2F2F7';
  const card = dark ? '#2C2C2E' : '#fff';
  const text = dark ? '#fff' : '#000';

  const filtered = ALL_CROSSINGS.filter((c) =>
    borderFilter === 'All' ? true : borderFilter === 'MX' ? c.border === 'MX' : c.border === 'CA'
  );

  const toggle = (id) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  // Step 0: Features
  if (step === 0) return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
        {/* Dots */}
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, { width: i === 0 ? 20 : 8, backgroundColor: i === 0 ? BLUE : '#C7C7CC' }]} />
          ))}
        </View>
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ fontSize: 60, marginBottom: 12 }}>🛂</Text>
          <Text style={[styles.heroTitle, { color: text }]}>CrossETA</Text>
          <Text style={{ fontSize: 16, color: '#8E8E93', marginTop: 4 }}>Real-time border crossing intelligence</Text>
        </View>
        {FEATURES.map((f) => (
          <View key={f.icon} style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: dark ? '#3A3A3C' : '#F2F2F7' }]}>
              <Text style={{ fontSize: 24 }}>{f.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.featureTitle, { color: text }]}>{f.title}</Text>
              <Text style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>{f.desc}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={() => setStep(1)} style={styles.primaryBtn} activeOpacity={0.85}>
          <LinearGradient colors={[BLUE, '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGrad}>
            <Text style={styles.primaryBtnText}>Get Started</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  // Step 1: Pick crossings
  if (step === 1) return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      <View style={{ padding: 24, paddingBottom: 8 }}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, { width: i === 1 ? 20 : 8, backgroundColor: i === 1 ? BLUE : '#C7C7CC' }]} />
          ))}
        </View>
        <Text style={[styles.stepTitle, { color: text }]}>Pick Your Crossings</Text>
        <Text style={{ fontSize: 14, color: '#8E8E93', marginTop: 4 }}>Select at least one crossing to save.</Text>
      </View>
      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 4 }} contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center' }}>
        {['All', 'MX', 'CA'].map((f) => (
          <View key={f} style={{ marginRight: 8 }}>
            <PillBtn label={f === 'All' ? 'All' : f === 'MX' ? '🇲🇽 Mexico' : '🇨🇦 Canada'} active={borderFilter === f} onPress={() => setBorderFilter(f)} dark={dark} />
          </View>
        ))}
      </ScrollView>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {filtered.map((c) => {
          const sel = selected.includes(c.id);
          return (
            <TouchableOpacity key={c.id} onPress={() => toggle(c.id)} style={[styles.pickRow, { borderBottomColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} activeOpacity={0.7}>
              <View style={[styles.checkbox, { borderColor: sel ? BLUE : '#C7C7CC', backgroundColor: sel ? BLUE : 'transparent' }]}>
                {sel && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
              </View>
              <Text style={{ fontSize: 20, marginHorizontal: 8 }}>{c.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickName, { color: text }]}>{c.name}</Text>
                <Text style={{ fontSize: 12, color: '#8E8E93' }}>{c.city}</Text>
              </View>
              <WaitPill wait={c.wait} small />
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>
      <View style={[styles.stickyBottom, { backgroundColor: bg }]}>
        <TouchableOpacity onPress={() => selected.length > 0 && setStep(2)} activeOpacity={0.85} style={[styles.primaryBtn, { marginHorizontal: 0 }]}>
          {selected.length > 0 ? (
            <LinearGradient colors={[BLUE, '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGrad}>
              <Text style={styles.primaryBtnText}>Continue ({selected.length} selected)</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.primaryBtnGrad, { backgroundColor: '#C7C7CC' }]}>
              <Text style={styles.primaryBtnText}>Continue ({selected.length} selected)</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // Step 2: Crossing time
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, { width: i === 2 ? 20 : 8, backgroundColor: i === 2 ? BLUE : '#C7C7CC' }]} />
          ))}
        </View>
        <Text style={[styles.stepTitle, { color: text }]}>When do you usually cross?</Text>
        <Text style={{ fontSize: 14, color: '#8E8E93', marginTop: 4, marginBottom: 24 }}>
          We'll tune predictions to your typical crossing time.
        </Text>
        {TIMES.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setCrossingTime(t)}
            style={[
              styles.timeOption,
              {
                backgroundColor: crossingTime === t ? 'rgba(0,122,255,0.1)' : card,
                borderColor: crossingTime === t ? BLUE : 'transparent',
              },
            ]}
            activeOpacity={0.7}
          >
            <Text style={[{ fontSize: 15, fontWeight: '600', flex: 1 }, { color: text }]}>{t}</Text>
            {crossingTime === t && <Text style={{ color: BLUE, fontSize: 18 }}>✓</Text>}
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => crossingTime && onComplete(selected)}
          activeOpacity={0.85}
          style={[styles.primaryBtn, { marginTop: 16 }]}
        >
          {crossingTime ? (
            <LinearGradient colors={[BLUE, '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGrad}>
              <Text style={styles.primaryBtnText}>Start Using CrossETA</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.primaryBtnGrad, { backgroundColor: '#C7C7CC' }]}>
              <Text style={styles.primaryBtnText}>Start Using CrossETA</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 },
  dot: { height: 8, borderRadius: 4 },
  heroTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  featureRow: { flexDirection: 'row', gap: 14, marginBottom: 20, alignItems: 'flex-start' },
  featureIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontWeight: '700', fontSize: 15 },
  primaryBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 8, marginBottom: 16 },
  primaryBtnGrad: { padding: 16, alignItems: 'center', borderRadius: 14 },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  stepTitle: { fontSize: 26, fontWeight: '800' },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pickName: { fontSize: 14, fontWeight: '600' },
  stickyBottom: { padding: 16, paddingBottom: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.08)' },
  timeOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, marginBottom: 10, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
});
