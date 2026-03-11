import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Linking,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { BLUE, GREEN } from '../data';
import { Toggle, SectionHeader } from '../components/UI';

const VERSION = '1.0.0';

export default function SettingsScreen() {
  const { dark, haptics, setDark, setHaptics } = useApp();

  const bg = dark ? '#1C1C1E' : '#F2F2F7';
  const card = dark ? '#2C2C2E' : '#fff';
  const text = dark ? '#fff' : '#000';
  const sub = '#8E8E93';
  const separator = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  const Row = ({ label, sub: subText, right, onPress, last }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={[styles.row, !last && { borderBottomWidth: 0.5, borderBottomColor: separator }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: text }]}>{label}</Text>
        {subText ? <Text style={styles.rowSub}>{subText}</Text> : null}
      </View>
      {right}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: dark ? 'rgba(28,28,30,0.95)' : 'rgba(242,242,247,0.95)', borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <Text style={[styles.title, { color: text }]}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Appearance */}
        <SectionHeader title="Appearance" dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label="Dark Mode" right={<Toggle value={dark} onValueChange={setDark} />} />
          <Row label="Haptic Feedback" sub="Vibrations on button taps" right={<Toggle value={haptics} onValueChange={setHaptics} />} last />
        </View>

        {/* Data */}
        <SectionHeader title="CBP Data" dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label="Data Source" sub="CBP Border Wait Times API" right={<View style={styles.liveDot}><Text style={styles.liveTxt}>● Live</Text></View>} />
          <Row label="Auto Refresh" sub="Updates every 5 minutes" right={<Text style={{ color: sub, fontSize: 14 }}>5 min</Text>} />
          <Row label="Cache Duration" sub="Fallback if API unavailable" right={<Text style={{ color: sub, fontSize: 14 }}>24h</Text>} last />
        </View>

        {/* Predictions */}
        <SectionHeader title="Predictions" dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label="Model Type" sub="Historical + live data fusion" right={<Text style={{ color: sub, fontSize: 14 }}>Hybrid</Text>} />
          <Row label="Accuracy Target" sub="Average prediction accuracy" right={<Text style={{ color: GREEN, fontSize: 14, fontWeight: '700' }}>83%</Text>} last />
        </View>

        {/* About */}
        <SectionHeader title="About" dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label="Version" right={<Text style={{ color: sub, fontSize: 14 }}>{VERSION}</Text>} />
          <Row label="Privacy Policy" right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('https://crosseta.app/privacy')} />
          <Row label="Terms of Service" right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('https://crosseta.app/terms')} />
          <Row label="CBP Data Attribution" sub="U.S. Customs and Border Protection" right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('https://www.cbp.gov')} last />
        </View>

        {/* Support */}
        <SectionHeader title="Support" dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label="Send Feedback" right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('mailto:hello@crosseta.app')} />
          <Row label="Rate App" right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => {}} last />
        </View>

        <Text style={styles.footer}>CrossETA v{VERSION} · Built with ❤️ for border crossers{'\n'}Data: CBP Border Wait Times API · bwt.cbp.gov</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 28, fontWeight: '800' },
  card: { marginHorizontal: 16, borderRadius: 14, marginBottom: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, minHeight: 48 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  liveDot: { backgroundColor: 'rgba(48,209,88,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  liveTxt: { color: '#30D158', fontSize: 12, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 12, color: '#8E8E93', marginTop: 24, lineHeight: 18, paddingHorizontal: 24 },
});
