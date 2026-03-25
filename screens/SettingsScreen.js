import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Linking, TextInput, Share, Alert, Platform,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { BLUE, GREEN } from '../data';
import { Toggle, SectionHeader } from '../components/UI';

const VERSION = '1.2.1';

export default function SettingsScreen() {
  const {
    dark, haptics, setDark, setHaptics,
    profile, setDisplayName,
    quietHours, setQuietHours,
    analytics, clearAnalytics, getAnalyticsExport,
    adminMode, setAdminMode,
    accessibility, setFontSizeMultiplier, setHighContrast,
    uiPrefs, setSimpleMode, setShowHelpTips,
    notificationProfile, applyNotificationProfile,
  } = useApp();

  const bg = dark ? '#1C1C1E' : '#F2F2F7';
  const card = dark ? '#2C2C2E' : '#fff';
  const text = dark ? '#fff' : '#000';
  const sub = '#8E8E93';
  const separator = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const [openSections, setOpenSections] = useState({
    data: false,
    analytics: false,
    moderation: false,
    predictions: false,
    about: true,
    support: false,
  });

  const Row = ({ label, sub: subText, right, onPress, last }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={[styles.row, !last && { borderBottomWidth: 0.5, borderBottomColor: separator }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: text }]}>{label}</Text>
        {subText ? <Text style={styles.rowSub}>{subText}</Text> : null}
      </View>
      {right}
    </TouchableOpacity>
  );

  const ToggleSection = ({ id, title, children }) => {
    const open = !!openSections[id];
    return (
      <>
        <TouchableOpacity
          onPress={() => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))}
          style={styles.collapseHeader}
          activeOpacity={0.8}
        >
          <Text style={[styles.collapseTitle, { color: dark ? '#8E8E93' : '#6C6C70' }]}>{title}</Text>
          <Text style={[styles.collapseChevron, { color: dark ? '#8E8E93' : '#6C6C70' }]}>{open ? '−' : '+'}</Text>
        </TouchableOpacity>
        {open ? children : null}
      </>
    );
  };

  const exportAnalytics = async () => {
    try {
      await Share.share({
        title: 'CrossETA Analytics Export',
        message: getAnalyticsExport(),
      });
    } catch (_) {}
  };

  const rateApp = async () => {
    const iosUrl = 'https://apps.apple.com/us/search?term=CrossETA';
    const androidUrl = 'https://play.google.com/store/search?q=CrossETA&c=apps';
    const fallback = 'https://crosseta.app';
    const url = Platform.OS === 'ios' ? iosUrl : androidUrl;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return;
      }
      await Linking.openURL(fallback);
    } catch (_) {
      Alert.alert('Unable to open store', 'Please try again in a moment.');
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: dark ? 'rgba(28,28,30,0.95)' : 'rgba(242,242,247,0.95)', borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <Text style={[styles.title, { color: text }]}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <SectionHeader title="Appearance" dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label="Dark Mode" right={<Toggle value={dark} onValueChange={setDark} />} />
          <Row label="Haptic Feedback" sub="Vibrations on button taps" right={<Toggle value={haptics} onValueChange={setHaptics} />} last />
        </View>

        <SectionHeader title="Easy Use" dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label="Simple Mode" sub="Bigger UI and fewer advanced controls" right={<Toggle value={uiPrefs.simpleMode} onValueChange={setSimpleMode} />} />
          <Row label="Help Tips" sub="Show quick explanations in screens" right={<Toggle value={uiPrefs.showHelpTips} onValueChange={setShowHelpTips} />} last />
        </View>

        <SectionHeader title="Alert Profiles" dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label="Calm" sub="Fewer alerts, higher threshold" right={<Text style={{ color: notificationProfile === 'calm' ? BLUE : sub, fontSize: 14 }}>{notificationProfile === 'calm' ? 'Selected' : 'Use'}</Text>} onPress={() => applyNotificationProfile('calm')} />
          <Row label="Balanced" sub="Recommended default alerts" right={<Text style={{ color: notificationProfile === 'balanced' ? BLUE : sub, fontSize: 14 }}>{notificationProfile === 'balanced' ? 'Selected' : 'Use'}</Text>} onPress={() => applyNotificationProfile('balanced')} />
          <Row label="Always Informed" sub="More alerts, lower threshold" right={<Text style={{ color: notificationProfile === 'always' ? BLUE : sub, fontSize: 14 }}>{notificationProfile === 'always' ? 'Selected' : 'Use'}</Text>} onPress={() => applyNotificationProfile('always')} last />
        </View>

        <SectionHeader title="Accessibility" dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          <View style={[styles.row, { borderBottomWidth: 0.5, borderBottomColor: separator, flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={[styles.rowLabel, { color: text }]}>Text Size</Text>
            <Text style={styles.rowSub}>Adjust font sizes for readability</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 12, justifyContent: 'space-between', paddingHorizontal: 8 }}>
              <TouchableOpacity onPress={() => setFontSizeMultiplier(accessibility.fontSizeMultiplier - 0.1)} style={[styles.sizeBtn, { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' }]}>
                <Text style={{ fontSize: 18, color: text }}>A-</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, height: 8, backgroundColor: BLUE, marginHorizontal: 12, borderRadius: 4, opacity: 0.3 }} />
              <TouchableOpacity onPress={() => setFontSizeMultiplier(accessibility.fontSizeMultiplier + 0.1)} style={[styles.sizeBtn, { backgroundColor: dark ? '#3A3A3C' : '#E5E5EA' }]}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: text }}>A+</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.rowSub, { marginTop: 10, alignSelf: 'center' }]}>{Math.round(accessibility.fontSizeMultiplier * 100)}%</Text>
          </View>
          <Row label="High Contrast Mode" sub="Better color contrast for visibility" right={<Toggle value={accessibility.highContrast} onValueChange={setHighContrast} />} />
          <Row label="Preset: Default" sub="100% text, standard contrast" right={<Text style={{ color: BLUE, fontSize: 14 }}>Apply</Text>} onPress={() => { setFontSizeMultiplier(1.0); setHighContrast(false); }} />
          <Row label="Preset: Kid Friendly" sub="115% text, playful readability" right={<Text style={{ color: BLUE, fontSize: 14 }}>Apply</Text>} onPress={() => { setFontSizeMultiplier(1.15); setHighContrast(false); }} />
          <Row label="Preset: Senior Friendly" sub="140% text, high contrast" right={<Text style={{ color: BLUE, fontSize: 14 }}>Apply</Text>} onPress={() => { setFontSizeMultiplier(1.4); setHighContrast(true); }} last />
        </View>

        <SectionHeader title="Community" dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          <View style={[styles.row, { borderBottomWidth: 0.5, borderBottomColor: separator, alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: text }]}>Display Name</Text>
              <Text style={styles.rowSub}>Used on your community wait reports</Text>
              <TextInput
                value={profile.displayName}
                onChangeText={setDisplayName}
                maxLength={24}
                placeholder="Your name"
                placeholderTextColor="#8E8E93"
                style={[styles.nameInput, { backgroundColor: dark ? '#3A3A3C' : '#F2F2F7', color: text }]}
              />
            </View>
          </View>
          <Row label="Quiet Hours" sub="Pause non-critical notifications overnight" right={<Toggle value={quietHours.enabled} onValueChange={(v) => setQuietHours((p) => ({ ...p, enabled: v }))} />} />
          <Row label="Quiet Window" sub="Current: 10 PM - 7 AM" right={<Text style={{ color: sub, fontSize: 14 }}>{quietHours.enabled ? 'Active' : 'Off'}</Text>} last />
        </View>

        <ToggleSection id="data" title="CBP Data">
          <View style={[styles.card, { backgroundColor: card }]}>
            <Row label="Data Source" sub="CBP Border Wait Times API" right={<View style={styles.liveDot}><Text style={styles.liveTxt}>Live</Text></View>} />
            <Row label="Auto Refresh" sub="Updates every 5 minutes" right={<Text style={{ color: sub, fontSize: 14 }}>5 min</Text>} />
            <Row label="Cache Duration" sub="Fallback if API unavailable" right={<Text style={{ color: sub, fontSize: 14 }}>24h</Text>} last />
          </View>
        </ToggleSection>

        <ToggleSection id="analytics" title="Analytics">
          <View style={[styles.card, { backgroundColor: card }]}>
            <Row label="Events Tracked (local)" sub="Used to guide product decisions" right={<Text style={{ color: sub, fontSize: 14 }}>{analytics.length}</Text>} />
            <Row label="Export Analytics" sub="Share JSON snapshot" right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={exportAnalytics} />
            <Row label="Clear Analytics" sub="Reset local event history" right={<Text style={{ color: '#FF453A', fontSize: 12, fontWeight: '700' }}>Clear</Text>} onPress={clearAnalytics} last />
          </View>
        </ToggleSection>

        <ToggleSection id="moderation" title="Moderation">
          <View style={[styles.card, { backgroundColor: card }]}>
            <Row label="Admin Mode" sub="Review and restore hidden reports in Community" right={<Toggle value={adminMode} onValueChange={setAdminMode} />} last />
          </View>
        </ToggleSection>

        <ToggleSection id="predictions" title="Predictions">
          <View style={[styles.card, { backgroundColor: card }]}>
            <Row label="Accuracy Target" sub="Average prediction accuracy" right={<Text style={{ color: GREEN, fontSize: 14, fontWeight: '700' }}>83%</Text>} last />
          </View>
        </ToggleSection>

        <ToggleSection id="about" title="About">
          <View style={[styles.card, { backgroundColor: card }]}>
            <Row label="Version" right={<Text style={{ color: sub, fontSize: 14 }}>{VERSION}</Text>} />
            <Row label="Creator" right={<Text style={{ color: sub, fontSize: 14 }}>Diego V / Stewy</Text>} />
            <Row label="Privacy Policy" right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('https://crosseta.app/privacy')} />
            <Row label="Terms of Service" right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('https://crosseta.app/terms')} />
            <Row label="CBP Data Attribution" sub="U.S. Customs and Border Protection" right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('https://www.cbp.gov')} last />
          </View>
        </ToggleSection>

        <ToggleSection id="support" title="Support">
          <View style={[styles.card, { backgroundColor: card }]}>
            <Row label="Send Feedback" right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('mailto:hello@crosseta.app')} />
            <Row label="Rate App" right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={rateApp} last />
          </View>
        </ToggleSection>

        <Text style={styles.footer}>CrossETA v{VERSION} - Built for border crossers{"\n"}Created by Diego V / Stewy{"\n"}Data: CBP Border Wait Times API - bwt.cbp.gov</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5 },
  title: { fontSize: 32, fontWeight: '800' },
  card: { marginHorizontal: 16, borderRadius: 14, marginBottom: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, minHeight: 56 },
  rowLabel: { fontSize: 17, fontWeight: '600' },
  rowSub: { fontSize: 14, color: '#8E8E93', marginTop: 3 },
  sizeBtn: { width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  liveDot: { backgroundColor: 'rgba(48,209,88,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  liveTxt: { color: '#30D158', fontSize: 14, fontWeight: '700' },
  nameInput: { marginTop: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  collapseHeader: { marginHorizontal: 16, marginTop: 14, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  collapseTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  collapseChevron: { fontSize: 22, fontWeight: '400', lineHeight: 22 },
  footer: { textAlign: 'center', fontSize: 14, color: '#8E8E93', marginTop: 24, lineHeight: 20, paddingHorizontal: 24 },
});