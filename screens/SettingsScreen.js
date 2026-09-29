import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Linking, Alert, Platform,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { BLUE, GREEN, LANE_KEYS, laneLabel } from '../data';
import { recordedCrossingCount } from '../historyCore.mjs';
import { Toggle, SectionHeader } from '../components/UI';
import { t } from '../i18n';

const VERSION = '1.3.0';

const formatHour = (hour24) => {
  const normalized = ((hour24 % 24) + 24) % 24;
  const ampm = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 || 12;
  return `${hour12}:00 ${ampm}`;
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
    quietHours, setQuietHours,
    langPref, setLangPref,
    laneType, setLaneType,
    clearHistory, getHistory,
    apiAvailable, serverPush, shareTrips, setShareTrips, deleteMyData,
  } = useApp();

  const bg = dark ? '#1C1C1E' : '#F2F2F7';
  const card = dark ? '#2C2C2E' : '#fff';
  const text = dark ? '#fff' : '#000';
  const sub = '#8E8E93';
  const separator = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

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

  const confirmClearHistory = () => {
    Alert.alert(
      t('Clear wait history?'),
      t('This deletes the wait times this device has recorded. Typical-wait charts start over.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Clear'), style: 'destructive', onPress: clearHistory },
      ]
    );
  };

  const recordedCrossings = recordedCrossingCount(getHistory());

  const confirmDeleteMyData = () => {
    Alert.alert(
      t('Delete my community data?'),
      t('This erases your reports, votes, shared trip times and alert settings from the server. Nothing on this phone is deleted.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () => deleteMyData()
            .then(() => Alert.alert(t('Deleted'), t('Your data was erased from the server.')))
            .catch(() => Alert.alert(t('Could not reach the server'), t('Please try again in a moment.'))),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: dark ? 'rgba(28,28,30,0.95)' : 'rgba(242,242,247,0.95)', borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <Text style={[styles.title, { color: text }]}>{t('Settings')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <SectionHeader title={t("Appearance")} dark={dark} />
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

        <SectionHeader title={t("Preferred Lane")} dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          {LANE_KEYS.map((k, i) => (
            <Row
              key={k}
              label={k === 'sentri' ? t('SENTRI / NEXUS') : t(laneLabel(k, 'MX'))}
              sub={i === 0 ? t('Cards, sorting and the best-crossing banner use this lane when it has a reading') : undefined}
              right={<Text style={{ color: BLUE, fontSize: 16 }}>{laneType === k ? '✓' : ''}</Text>}
              onPress={() => setLaneType(k)}
              last={i === LANE_KEYS.length - 1}
            />
          ))}
        </View>

        {apiAvailable && (
          <>
            <SectionHeader title={t("Community & Alerts")} dark={dark} />
            <View style={[styles.card, { backgroundColor: card }]}>
              <Row
                label={t("Alerts when the app is closed")}
                sub={serverPush ? t('On. Alerts for your starred crossings are sent to this phone.') : t('Off. Turn on notifications and star a crossing with alerts enabled.')}
                right={<Text style={{ color: serverPush ? GREEN : sub, fontSize: 14, fontWeight: '700' }}>{serverPush ? t('On') : t('Off')}</Text>}
              />
              <Row
                label={t("Share anonymous trip times")}
                sub={t("When you finish an \"I'm In Line\" trip, the crossing, lane and time it took are shared so others see measured waits. No location or name is sent.")}
                right={<Toggle value={shareTrips} onValueChange={setShareTrips} />}
              />
              <Row
                label={t("Delete my community data")}
                right={<Text style={{ color: '#FF453A', fontSize: 14, fontWeight: '700' }}>{t('Delete')}</Text>}
                onPress={confirmDeleteMyData}
                last
              />
            </View>
          </>
        )}

        <SectionHeader title={t("Quiet Hours")} dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label={t("Quiet Hours")} sub={t("Pause non-critical notifications overnight")} right={<Toggle value={quietHours.enabled} onValueChange={(v) => setQuietHours((p) => ({ ...p, enabled: v }))} />} last={!quietHours.enabled} />
          {quietHours.enabled && (
            <View style={[styles.row, { flexDirection: 'column', alignItems: 'flex-start' }]}>
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
          )}
        </View>

        <SectionHeader title={t("CBP Data")} dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label={t("Data Source")} sub={t("CBP Border Wait Times API")} right={<View style={styles.liveDot}><Text style={styles.liveTxt}>{t('Live')}</Text></View>} />
          <Row label={t("Auto Refresh")} sub={t("Updates every 5 minutes")} right={<Text style={{ color: sub, fontSize: 14 }}>5 min</Text>} />
          <Row
            label={t("Recorded wait history")}
            sub={t('{n} crossings recorded on this device. Never uploaded.', { n: recordedCrossings })}
            right={<Text style={{ color: '#FF453A', fontSize: 14, fontWeight: '700' }}>{t('Clear')}</Text>}
            onPress={confirmClearHistory}
            last
          />
        </View>

        <SectionHeader title={t("About")} dark={dark} />
        <View style={[styles.card, { backgroundColor: card }]}>
          <Row label={t("Version")} right={<Text style={{ color: sub, fontSize: 14 }}>{VERSION}</Text>} />
          <Row label={t("Creator")} right={<Text style={{ color: sub, fontSize: 14 }}>Diego V / Stewy</Text>} />
          <Row label={t("Privacy Policy")} right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('https://crosseta.app/privacy')} />
          <Row label={t("Terms of Service")} right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('https://crosseta.app/terms')} />
          <Row label={t("CBP Data Attribution")} sub={t("U.S. Customs and Border Protection")} right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('https://www.cbp.gov')} />
          <Row label={t("Send Feedback")} right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={() => Linking.openURL('mailto:hello@crosseta.app')} />
          <Row label={t("Rate App")} right={<Text style={{ color: BLUE, fontSize: 20 }}>›</Text>} onPress={rateApp} last />
        </View>

        <Text style={styles.footer}>CrossETA v{VERSION} - Built for border crossers{"\n"}Created by Diego V / Stewy{"\n"}Data: CBP Border Wait Times API - bwt.cbp.gov</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 32, fontWeight: '800' },
  card: { marginHorizontal: 16, borderRadius: 14, marginBottom: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, minHeight: 56 },
  rowLabel: { fontSize: 17, fontWeight: '600' },
  rowSub: { fontSize: 14, color: '#8E8E93', marginTop: 3 },
  liveDot: { backgroundColor: 'rgba(48,209,88,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  liveTxt: { color: '#30D158', fontSize: 14, fontWeight: '700' },
  hourControls: { width: '100%', marginTop: 12, gap: 10 },
  hourStepWrap: { width: '100%', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10 },
  hourStepLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  hourStepRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hourBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hourBtnTxt: { fontSize: 20, fontWeight: '700' },
  hourValue: { fontSize: 16, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 14, color: '#8E8E93', marginTop: 24, lineHeight: 20, paddingHorizontal: 24 },
});
