import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { BLUE, waitColor } from '../data';
import { Toggle, SectionHeader, Card } from '../components/UI';
import { t } from '../i18n';

const THRESHOLDS = [10, 15, 20, 30];

export default function AlertsScreen() {
  const { dark, crossings, favorites, notifSettings, thresholds, lowAlerts, toggleNotif, setThreshold, toggleLowAlert } = useApp();

  const bg = dark ? '#1C1C1E' : '#F2F2F7';
  const card = dark ? '#2C2C2E' : '#fff';
  const text = dark ? '#fff' : '#000';
  const sub = '#8E8E93';

  const saved = crossings.filter((c) => favorites.includes(c.id));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: dark ? 'rgba(28,28,30,0.95)' : 'rgba(242,242,247,0.95)', borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <Text style={[styles.title, { color: text }]}>{t('Alerts')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Saved crossings notifications */}
        <SectionHeader title={t('My Crossings')} dark={dark} />
        {saved.length === 0 ? (
          <Card dark={dark} style={{ margin: 0 }}>
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 32 }}>☆</Text>
              <Text style={[styles.emptyTitle, { color: text }]}>{t('No Saved Crossings')}</Text>
              <Text style={{ fontSize: 14, color: sub, textAlign: 'center', marginTop: 6 }}>{t('Star crossings on the home screen to set up alerts.')}</Text>
            </View>
          </Card>
        ) : (
          saved.map((crossing) => {
            const enabled = notifSettings[crossing.id] ?? false;
            const threshold = thresholds[crossing.id] ?? 15;
            return (
              <View key={crossing.id} style={[styles.crossingRow, { backgroundColor: card }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 22 }}>{crossing.flag}</Text>
                    <View>
                      <Text style={[styles.crossingName, { color: text }]}>{crossing.name}</Text>
                      <Text style={{ fontSize: 12, color: sub }}>{crossing.city}</Text>
                    </View>
                  </View>
                  {enabled && (
                    <View>
                      <View style={styles.thresholdRow}>
                        <Text style={{ fontSize: 12, color: sub, marginRight: 8 }}>{t('Alert when over:')}</Text>
                        {THRESHOLDS.map((th) => (
                          <TouchableOpacity
                            key={th}
                            onPress={() => setThreshold(crossing.id, th)}
                            style={[styles.thresholdBtn, { backgroundColor: threshold === th ? BLUE : (dark ? '#3A3A3C' : '#F2F2F7'), borderColor: threshold === th ? BLUE : 'transparent' }]}
                          >
                            <Text style={[styles.thresholdText, { color: threshold === th ? '#fff' : (dark ? '#aaa' : '#555') }]}>{th}m</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={styles.dropAlertRow}>
                        <Text style={{ fontSize: 12, color: sub }}>🟢 {t('Also alert when wait drops')}</Text>
                        <Toggle value={!!lowAlerts[crossing.id]} onValueChange={() => toggleLowAlert(crossing.id)} />
                      </View>
                    </View>
                  )}
                </View>
                <Toggle value={enabled} onValueChange={() => toggleNotif(crossing.id)} />
              </View>
            );
          })
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 28, fontWeight: '800' },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 12 },
  crossingRow: { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  crossingName: { fontSize: 15, fontWeight: '700' },
  thresholdRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, flexWrap: 'wrap' },
  dropAlertRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  thresholdBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, borderWidth: 1 },
  thresholdText: { fontSize: 12, fontWeight: '600' },
  activityCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  activityDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', opacity: 0.9 },
  activityTitle: { fontSize: 14, fontWeight: '700', flex: 1, flexWrap: 'wrap' },
});
