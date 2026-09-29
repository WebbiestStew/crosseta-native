import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Linking, TextInput, Share, Alert, Platform,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { BLUE, GREEN } from '../data';
import { Toggle, SectionHeader } from '../components/UI';
import { t } from '../i18n';

const VERSION = '1.3.0';

const formatHour = (hour24) => {
  const normalized = ((hour24 % 24) + 24) % 24;
  const ampm = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 || 12;
  return `${hour12}:00 ${ampm}`;
};

const includesQuery = (query, ...values) => {
  if (!query) return true;
  return values.some((v) => String(v || '').toLowerCase().includes(query));
};

const HourStepper = ({ label, value, onChange, dark, text }) => (
  <View style={[styles.hourStepWrap, { backgroundColor: dark ? '#3A3A3C' : '#F2F2F7' }]}>
    <Text style={[styles.hourStepLabel, { color: dark ? '#D1D1D6' : '#6C6C70' }]}>{label}</Text>
    <View style={styles.hourStepRow}>
      <TouchableOpacity
        onPress={() => onChange(value - 1)}
        style={[styles.hourBtn, { backgroundColor: dark ? '#2C2C2E' : '#E5E5EA' }]}
        accessibilityLabel={`${t('Decrease')} ${label}`}
      >
        <Text style={[styles.hourBtnTxt, { color: text }]}>−</Text>
      </TouchableOpacity>
      <Text style={[styles.hourValue, { color: text }]}>{formatHour(value)}</Text>
      <TouchableOpacity
        onPress={() => onChange(value + 1)}
        style={[styles.hourBtn, { backgroundColor: dark ? '#2C2C2E' : '#E5E5EA' }]}
        accessibilityLabel={`${t('Increase')} ${label}`}
      >
        <Text style={[styles.hourBtnTxt, { color: text }]}>+</Text>
      </TouchableOpacity>
    </View>
  </View>
);

export default function SettingsScreen() {
  const {
    dark, haptics, setDark, setHaptics,
    profile, setDisplayName,
    quietHours, setQuietHours,
    langPref, setLangPref,
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
    about: true,
    support: false,
  });
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  const KEYWORDS = {
    appearance: 'appearance, dark mode, haptic, theme, language, idioma',
    easyUse: 'easy use, simple mode, help tips, ui',
    alerts: 'alert profile, notification profile, calm, balanced, always informed',
    accessibility: 'accessibility, text size, contrast, senior, kid',
    community: 'profile, display name, quiet hours, quiet window',
    data: 'cbp, data source, refresh, cache',
    about: 'about, version, privacy, terms, attribution',
    support: 'support, feedback, rate app',
  };
  const sectionKeywords = useMemo(() => Object.fromEntries(
    Object.entries(KEYWORDS).map(([id, en]) => [id, [...en.split(', '), ...t(en).split(', ')]])
  ), []);

  const sectionVisible = (id) => includesQuery(normalizedQuery, ...(sectionKeywords[id] || []));

  const visibleSections = [
    sectionVisible('appearance'),
    sectionVisible('easyUse'),
    sectionVisible('alerts'),
    sectionVisible('accessibility'),
    sectionVisible('community'),
    sectionVisible('data'),
    sectionVisible('about'),
    sectionVisible('support'),
  ].some(Boolean);

  const quietSummary = `${formatHour(quietHours.start)} - ${formatHour(quietHours.end)}`;

  const Row = ({ label, sub: subText, right, onPress, last }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      style={[styles.row, !last && { borderBottomWidth: 0.5, borderBottomColor: separator }]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: text }]}>{label}</Text>
        {subText ? <Text style={styles.rowSub}>{subText}</Text> : null}
      </View>
      {right}
    </TouchableOpacity>
  );

  const ToggleSection = ({ id, title, children }) => {
    const open = normalizedQuery ? true : !!openSections[id];
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
      Alert.alert(t('Unable to open store'), t('Please try again in a moment.'));
    }
  };

  const resetPersonalization = () => {
    Alert.alert(
      t('Reset personalization?'),
      t('This restores display name, alert profile, accessibility, and UI preferences to default.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Reset'),
          style: 'destructive',
          onPress: () => {
            setDisplayName('You');
            applyNotificationProfile('balanced');
            setFontSizeMultiplier(1.0);
            setHighContrast(false);
            setSimpleMode(false);
            setShowHelpTips(true);
            setQuietHours({ enabled: true, start: 22, end: 7 });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: dark ? 'rgba(28,28,30,0.95)' : 'rgba(242,242,247,0.95)', borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}> 
        <Text style={[styles.title, { color: text }]}>{t('Settings')}</Text>
        <View style={[styles.searchWrap, { backgroundColor: dark ? '#2C2C2E' : '#FFFFFF', borderColor: separator }]}> 
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("Search settings")}
            placeholderTextColor="#8E8E93"
            style={[styles.searchInput, { color: text }]}
            returnKeyType="done"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <SectionHeader title={t("Quick Actions")} dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}> 
          <Row label={t("Use Balanced Profile")} sub={t("Recommended alerts for most users")} right={<Text style={{ color: BLUE, fontSize: 14 }}>{notificationProfile === 'balanced' ? t('Active') : t('Apply')}</Text>} onPress={() => applyNotificationProfile('balanced')} />
          <Row label={t("Apply Senior Friendly Preset")} sub={t("140% text size with high contrast")} right={<Text style={{ color: BLUE, fontSize: 14 }}>{t('Apply')}</Text>} onPress={() => { setFontSizeMultiplier(1.4); setHighContrast(true); }} />
          <Row label={t("Reset Personalization")} sub={t("Restore your default app experience")} right={<Text style={{ color: '#FF453A', fontSize: 12, fontWeight: '700' }}>{t('Reset')}</Text>} onPress={resetPersonalization} last />
        </View>

        {sectionVisible('appearance') ? <SectionHeader title={t("Appearance")} dark={dark} /> : null}
        {sectionVisible('appearance') ? (
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label={t("Dark Mode")} right={<Toggle value={dark} onValueChange={setDark} />} />
          <Row label={t("Haptic Feedback")} sub={t("Vibrations on button taps")} right={<Toggle value={haptics} onValueChange={setHaptics} />} />
          {[['auto', t('Auto')], ['en', 'English'], ['es', 'Español']].map(([k, name], i) => (
            <Row
              key={k}
              label={i === 0 ? `${t('Language')}: ${name}` : name}
              sub={i === 0 ? t('Follows your phone language') : undefined}
              right={<Text style={{ color: BLUE, fontSize: 16 }}>{langPref === k ? '✓' : ''}</Text>}
              onPress={() => setLangPref(k)}
              last={i === 2}
            />
          ))}
        </View>
        ) : null}

        {sectionVisible('easyUse') ? <SectionHeader title={t("Easy Use")} dark={dark} /> : null}
        {sectionVisible('easyUse') ? (
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label={t("Simple Mode")} sub={t("Bigger UI and fewer advanced controls")} right={<Toggle value={uiPrefs.simpleMode} onValueChange={setSimpleMode} />} />
          <Row label={t("Help Tips")} sub={t("Show quick explanations in screens")} right={<Toggle value={uiPrefs.showHelpTips} onValueChange={setShowHelpTips} />} last />
        </View>
        ) : null}

        {sectionVisible('alerts') ? <SectionHeader title={t("Alert Profiles")} dark={dark} /> : null}
        {sectionVisible('alerts') ? (
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label={t("Calm")} sub={t("Fewer alerts, higher threshold")} right={<Text style={{ color: notificationProfile === 'calm' ? BLUE : sub, fontSize: 14 }}>{notificationProfile === 'calm' ? t('Active') : t('Use')}</Text>} onPress={() => applyNotificationProfile('calm')} />
          <Row label={t("Balanced")} sub={t("Recommended default alerts")} right={<Text style={{ color: notificationProfile === 'balanced' ? BLUE : sub, fontSize: 14 }}>{notificationProfile === 'balanced' ? t('Active') : t('Use')}</Text>} onPress={() => applyNotificationProfile('balanced')} />
          <Row label={t("Always Informed")} sub={t("More alerts, lower threshold")} right={<Text style={{ color: notificationProfile === 'always' ? BLUE : sub, fontSize: 14 }}>{notificationProfile === 'always' ? t('Active') : t('Use')}</Text>} onPress={() => applyNotificationProfile('always')} last />
        </View>
        ) : null}

        {sectionVisible('accessibility') ? <SectionHeader title={t("Accessibility")} dark={dark} /> : null}
        {sectionVisible('accessibility') ? (
        <View style={[styles.card, { backgroundColor: card }]}>
          <View style={[styles.row, { borderBottomWidth: 0.5, borderBottomColor: separator, flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={[styles.rowLabel, { color: text }]}>{t('Text Size')}</Text>
            <Text style={styles.rowSub}>{t('Adjust font sizes for readability')}</Text>
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
          <Row label={t("High Contrast Mode")} sub={t("Better color contrast for visibility")} right={<Toggle value={accessibility.highContrast} onValueChange={setHighContrast} />} />
          <Row label={t("Preset: Default")} sub={t("100% text, standard contrast")} right={<Text style={{ color: BLUE, fontSize: 14 }}>{t('Apply')}</Text>} onPress={() => { setFontSizeMultiplier(1.0); setHighContrast(false); }} />
          <Row label={t("Preset: Kid Friendly")} sub={t("115% text, playful readability")} right={<Text style={{ color: BLUE, fontSize: 14 }}>{t('Apply')}</Text>} onPress={() => { setFontSizeMultiplier(1.15); setHighContrast(false); }} />
          <Row label={t("Preset: Senior Friendly")} sub={t("140% text, high contrast")} right={<Text style={{ color: BLUE, fontSize: 14 }}>{t('Apply')}</Text>} onPress={() => { setFontSizeMultiplier(1.4); setHighContrast(true); }} last />
        </View>
        ) : null}

        {sectionVisible('community') ? <SectionHeader title={t("Profile & Quiet Hours")} dark={dark} /> : null}
        {sectionVisible('community') ? (
        <View style={[styles.card, { backgroundColor: card }]}>
          <View style={[styles.row, { borderBottomWidth: 0.5, borderBottomColor: separator, alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: text }]}>{t('Display Name')}</Text>
              <Text style={styles.rowSub}>{t('Used on your community wait reports')}</Text>
              <TextInput
                value={profile.displayName}
                onChangeText={setDisplayName}
                maxLength={24}
                placeholder={t("Your name")}
                placeholderTextColor="#8E8E93"
                style={[styles.nameInput, { backgroundColor: dark ? '#3A3A3C' : '#F2F2F7', color: text }]}
              />
            </View>
          </View>
          <Row label={t("Quiet Hours")} sub={t("Pause non-critical notifications overnight")} right={<Toggle value={quietHours.enabled} onValueChange={(v) => setQuietHours((p) => ({ ...p, enabled: v }))} />} />
          <View style={[styles.row, { borderBottomWidth: 0.5, borderBottomColor: separator, flexDirection: 'column', alignItems: 'flex-start' }]}> 
            <View style={styles.quietHeaderRow}>
              <Text style={[styles.rowLabel, { color: text }]}>{t('Quiet Window')}</Text>
              <View style={[styles.statusPill, { backgroundColor: quietHours.enabled ? 'rgba(48,209,88,0.16)' : (dark ? '#3A3A3C' : '#E5E5EA') }]}>
                <Text style={[styles.statusPillTxt, { color: quietHours.enabled ? '#30D158' : sub }]}>{quietHours.enabled ? t('Active') : t('Off')}</Text>
              </View>
            </View>
            <Text style={styles.rowSub}>{t('Current: {range}', { range: quietSummary })}</Text>
            <View style={styles.hourControls}>
              <HourStepper
                label={t("Start")}
                value={quietHours.start}
                onChange={(next) => setQuietHours((p) => ({ ...p, start: (next + 24) % 24 }))}
                dark={dark}
                text={text}
              />
              <HourStepper
                label={t("End")}
                value={quietHours.end}
                onChange={(next) => setQuietHours((p) => ({ ...p, end: (next + 24) % 24 }))}
                dark={dark}
                text={text}
              />
            </View>
          </View>
        </View>
        ) : null}

        {sectionVisible('data') ? (
        <ToggleSection id="data" title={t("CBP Data")}>
          <View style={[styles.card, { backgroundColor: card }]}>
            <Row label={t("Data Source")} sub={t("CBP Border Wait Times API")} right={<View style={styles.liveDot}><Text style={styles.liveTxt}>{t('Live')}</Text></View>} />
            <Row label={t("Auto Refresh")} sub={t("Updates every 5 minutes")} right={<Text style={{ color: sub, fontSize: 14 }}>5 min</Text>} />
            <Row label={t("Cache Duration")} sub={t("Fallback if API unavailable")} right={<Text style={{ color: sub, fontSize: 14 }}>24h</Text>} last />
          </View>
        </ToggleSection>
        ) : null}

        {sectionVisible('about') ? (
        <ToggleSection id="about" title={t("About")}>
          <View style={[styles.card, { backgroundColor: card }]}>
            <Row label={t("Version")} right={<Text style={{ color: sub, fontSize: 14 }}>{VERSION}</Text>} />
            <Row label={t("Creator")} right={<Text style={{ color: sub, fontSize: 14 }}>Diego V / Stewy</Text>} />
            <Row label={t("Privacy Policy")} right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('https://crosseta.app/privacy')} />
            <Row label={t("Terms of Service")} right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('https://crosseta.app/terms')} />
            <Row label={t("CBP Data Attribution")} sub={t("U.S. Customs and Border Protection")} right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('https://www.cbp.gov')} last />
          </View>
        </ToggleSection>
        ) : null}

        {sectionVisible('support') ? (
        <ToggleSection id="support" title={t("Support")}>
          <View style={[styles.card, { backgroundColor: card }]}>
            <Row label={t("Send Feedback")} right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('mailto:hello@crosseta.app')} />
            <Row label={t("Rate App")} right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={rateApp} last />
          </View>
        </ToggleSection>
        ) : null}

        {!visibleSections ? (
          <View style={[styles.emptyState, { backgroundColor: card, borderColor: separator }]}> 
            <Text style={[styles.emptyTitle, { color: text }]}>{t('No results')}</Text>
            <Text style={styles.emptySub}>{t('Try searching for terms like "privacy", "quiet", or "dark mode".')}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>CrossETA v{VERSION} - Built for border crossers{"\n"}Created by Diego V / Stewy{"\n"}Data: CBP Border Wait Times API - bwt.cbp.gov</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 32, fontWeight: '800' },
  subtitle: { fontSize: 14, color: '#8E8E93', marginTop: 4 },
  searchWrap: { marginTop: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchIcon: { fontSize: 16, color: '#8E8E93', marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16 },
  card: { marginHorizontal: 16, borderRadius: 14, marginBottom: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, minHeight: 56 },
  rowLabel: { fontSize: 17, fontWeight: '600' },
  rowSub: { fontSize: 14, color: '#8E8E93', marginTop: 3 },
  releaseCard: { marginHorizontal: 16, marginTop: 18, marginBottom: 4, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 },
  releaseTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  releasePoint: { color: '#8E8E93', fontSize: 14, lineHeight: 21 },
  sizeBtn: { width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  liveDot: { backgroundColor: 'rgba(48,209,88,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  liveTxt: { color: '#30D158', fontSize: 14, fontWeight: '700' },
  nameInput: { marginTop: 12, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  collapseHeader: { marginHorizontal: 16, marginTop: 14, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  collapseTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  collapseChevron: { fontSize: 22, fontWeight: '400', lineHeight: 22 },
  quietHeaderRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillTxt: { fontSize: 12, fontWeight: '700' },
  hourControls: { width: '100%', marginTop: 12, gap: 10 },
  hourStepWrap: { width: '100%', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10 },
  hourStepLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  hourStepRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hourBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hourBtnTxt: { fontSize: 20, fontWeight: '700' },
  hourValue: { fontSize: 16, fontWeight: '700' },
  emptyState: { marginHorizontal: 16, marginTop: 14, borderWidth: 1, borderRadius: 14, padding: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { marginTop: 6, color: '#8E8E93', fontSize: 14, lineHeight: 20 },
  footer: { textAlign: 'center', fontSize: 14, color: '#8E8E93', marginTop: 24, lineHeight: 20, paddingHorizontal: 24 },
});