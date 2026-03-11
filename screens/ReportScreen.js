import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import { BLUE, GREEN, waitColor, waitLabel, ALL_CROSSINGS } from '../data';
import { WaitPill, SectionHeader, PillBtn } from '../components/UI';

const LANES = ['Standard', 'SENTRI / NEXUS', 'Ready Lane'];

export default function ReportScreen({ route, navigation }) {
  const { crossing: initialCrossing } = route.params ?? {};
  const { dark, addReport, crossings } = useApp();

  const [step, setStep] = useState(initialCrossing ? 1 : 0);
  const [selectedCrossing, setSelectedCrossing] = useState(initialCrossing);
  const [lane, setLane] = useState('Standard');
  const [wait, setWait] = useState(20);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const bg = dark ? '#1C1C1E' : '#F2F2F7';
  const card = dark ? '#2C2C2E' : '#fff';
  const text = dark ? '#fff' : '#000';
  const inputBg = dark ? '#3A3A3C' : '#F2F2F7';
  const sub = '#8E8E93';

  const mxList = crossings.filter((c) => c.border === 'MX');
  const caList = crossings.filter((c) => c.border === 'CA');

  const handleSubmit = () => {
    if (!selectedCrossing) return;
    addReport({
      crossingId: selectedCrossing.id,
      crossingName: selectedCrossing.name,
      border: selectedCrossing.border,
      flag: selectedCrossing.flag,
      lane,
      wait,
      note: note.trim(),
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={{ fontSize: 50 }}>✅</Text>
          </View>
          <Text style={[styles.successTitle, { color: text }]}>Report Submitted!</Text>
          <Text style={{ fontSize: 15, color: sub, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
            Thank you for helping fellow travelers. Your report for {selectedCrossing?.name} has been added.
          </Text>
          <WaitPill wait={wait} style={{ marginTop: 16 }} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.doneBtn, { marginTop: 32 }]}>
            <LinearGradient colors={[BLUE, '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.doneBtnInner}>
              <Text style={styles.doneBtnText}>Done</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.navBar, { backgroundColor: dark ? 'rgba(28,28,30,0.95)' : 'rgba(242,242,247,0.95)', borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: sub, fontSize: 17 }}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: text }]}>Report Wait Time</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Step 0: pick crossing */}
        {step === 0 && (
          <>
            <SectionHeader title="🇲🇽 Mexico Crossings" dark={dark} />
            {mxList.map((c) => (
              <TouchableOpacity key={c.id} onPress={() => { setSelectedCrossing(c); setStep(1); }} style={[styles.crossingItem, { backgroundColor: card }]}>
                <Text style={{ fontSize: 20 }}>{c.flag}</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.crossingName, { color: text }]}>{c.name}</Text>
                  <Text style={{ fontSize: 12, color: sub }}>{c.city}</Text>
                </View>
                <Text style={{ color: BLUE, fontSize: 20 }}>›</Text>
              </TouchableOpacity>
            ))}
            <SectionHeader title="🇨🇦 Canada Crossings" dark={dark} />
            {caList.map((c) => (
              <TouchableOpacity key={c.id} onPress={() => { setSelectedCrossing(c); setStep(1); }} style={[styles.crossingItem, { backgroundColor: card }]}>
                <Text style={{ fontSize: 20 }}>{c.flag}</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.crossingName, { color: text }]}>{c.name}</Text>
                  <Text style={{ fontSize: 12, color: sub }}>{c.city}</Text>
                </View>
                <Text style={{ color: BLUE, fontSize: 20 }}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Step 1: details */}
        {step === 1 && selectedCrossing && (
          <>
            {/* Selected crossing header */}
            <View style={[styles.chosenCrossing, { backgroundColor: dark ? '#2C2C2E' : '#E5F0FF' }]}>
              <Text style={{ fontSize: 28 }}>{selectedCrossing.flag}</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.crossingName, { color: text }]}>{selectedCrossing.name}</Text>
                <Text style={{ fontSize: 12, color: sub }}>{selectedCrossing.city}</Text>
              </View>
              {!initialCrossing && (
                <TouchableOpacity onPress={() => { setSelectedCrossing(null); setStep(0); }}>
                  <Text style={{ color: BLUE }}>Change</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Lane */}
            <SectionHeader title="Which Lane?" dark={dark} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 16, marginBottom: 8 }} contentContainerStyle={{ gap: 8 }}>
              {LANES.map((l) => (
                <PillBtn key={l} label={l} active={lane === l} onPress={() => setLane(l)} dark={dark} />
              ))}
            </ScrollView>

            {/* Wait slider */}
            <SectionHeader title={`Wait Time: ${wait} minutes`} dark={dark} />
            <View style={[styles.waitSection, { backgroundColor: card }]}>
              <View style={styles.waitDisplay}>
                <Text style={[styles.waitBig, { color: waitColor(wait) }]}>{wait}</Text>
                <Text style={styles.waitUnit}>min</Text>
                <View style={[styles.waitLabelBadge, { backgroundColor: `${waitColor(wait)}22` }]}>
                  <Text style={[styles.waitLabelTxt, { color: waitColor(wait) }]}>{waitLabel(wait)}</Text>
                </View>
              </View>
              {/* Manual increment/decrement */}
              <View style={styles.waitControls}>
                {[0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 120].map((v) => (
                  <TouchableOpacity key={v} onPress={() => setWait(v)} style={[styles.waitChip, { backgroundColor: wait === v ? waitColor(v) : inputBg, borderColor: wait === v ? waitColor(v) : 'transparent', borderWidth: 1 }]}>
                    <Text style={[styles.waitChipText, { color: wait === v ? '#fff' : sub }]}>{v}m</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Note */}
            <SectionHeader title="Optional Note" dark={dark} />
            <View style={{ marginHorizontal: 16 }}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Officers processing quickly, CBX open..."
                placeholderTextColor="#8E8E93"
                multiline
                numberOfLines={3}
                maxLength={200}
                style={[styles.noteInput, { backgroundColor: card, color: text, borderColor: dark ? '#48484A' : '#E5E5EA' }]}
              />
              <Text style={{ fontSize: 12, color: sub, textAlign: 'right', marginTop: 4 }}>{note.length}/200</Text>
            </View>

            {/* Submit */}
            <TouchableOpacity onPress={handleSubmit} activeOpacity={0.85} style={{ marginHorizontal: 16, marginTop: 24, borderRadius: 14, overflow: 'hidden' }}>
              <LinearGradient colors={[BLUE, '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
                <Text style={styles.submitText}>Submit Report</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  navTitle: { fontSize: 17, fontWeight: '700' },
  crossingItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  crossingName: { fontSize: 15, fontWeight: '700' },
  chosenCrossing: { margin: 16, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center' },
  waitSection: { marginHorizontal: 16, borderRadius: 14, padding: 16 },
  waitDisplay: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 16 },
  waitBig: { fontSize: 52, fontWeight: '800' },
  waitUnit: { fontSize: 18, color: '#8E8E93' },
  waitLabelBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 6 },
  waitLabelTxt: { fontSize: 14, fontWeight: '700' },
  waitControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  waitChip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  waitChipText: { fontSize: 13, fontWeight: '600' },
  noteInput: { borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, minHeight: 90, textAlignVertical: 'top' },
  submitBtn: { padding: 17, alignItems: 'center', borderRadius: 14 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  successIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(48,209,88,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  doneBtn: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  doneBtnInner: { padding: 17, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
