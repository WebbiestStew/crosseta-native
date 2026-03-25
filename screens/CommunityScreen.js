import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { BLUE } from '../data';
import { PillBtn, SectionHeader } from '../components/UI';
import ReportCard from '../components/ReportCard';

const FILTERS = ['All', '🇲🇽 Mexico', '🇨🇦 Canada'];
const SORT_OPTIONS = ['Newest', 'Most Helpful', 'Crossing'];

export default function CommunityScreen({ navigation }) {
  const { dark, reports, votes, feedbackDone, vote, setFeedback, flagReport, restoreReport, adminMode } = useApp();
  const [region, setRegion] = useState('All');
  const [sort, setSort] = useState('Newest');

  const bg = dark ? '#1C1C1E' : '#F2F2F7';
  const text = dark ? '#fff' : '#000';
  const sub = '#8E8E93';
  const card = dark ? '#2C2C2E' : '#fff';

  const visibleReports = reports.filter((r) => !r.hidden);
  const hiddenReports = reports.filter((r) => r.hidden);

  const filtered = visibleReports.filter((r) => {
    if (region === '🇲🇽 Mexico') return r.border === 'MX';
    if (region === '🇨🇦 Canada') return r.border === 'CA';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'Newest') return new Date(b.ts) - new Date(a.ts);
    if (sort === 'Most Helpful') return (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
    return a.crossingName.localeCompare(b.crossingName);
  });

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: dark ? 'rgba(28,28,30,0.95)' : 'rgba(242,242,247,0.95)', borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <Text style={[styles.title, { color: text }]}>Community</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Report', { crossing: null })} style={[styles.addBtn]}>
          <Text style={styles.addBtnText}>+ Report</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Region pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginBottom: 4, paddingLeft: 16 }} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => (
            <PillBtn key={f} label={f} active={region === f} onPress={() => setRegion(f)} dark={dark} />
          ))}
        </ScrollView>

        {/* Sort pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, paddingLeft: 16 }} contentContainerStyle={{ gap: 8 }}>
          {SORT_OPTIONS.map((s) => (
            <PillBtn key={s} label={s} active={sort === s} onPress={() => setSort(s)} dark={dark} />
          ))}
        </ScrollView>

        {/* Stats bar */}
        <View style={[styles.statsBar, { backgroundColor: card }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: text }]}>{reports.length}</Text>
            <Text style={styles.statLbl}>Total Reports</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: dark ? '#48484A' : '#E5E5EA' }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: text }]}>{reports.filter((r) => Date.now() - new Date(r.ts) < 3600000).length}</Text>
            <Text style={styles.statLbl}>Last Hour</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: dark ? '#48484A' : '#E5E5EA' }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: text }]}>{Math.round(reports.reduce((s, r) => s + (r.upvotes / Math.max(r.upvotes + r.downvotes, 1)) * 100, 0) / Math.max(reports.length, 1))}%</Text>
            <Text style={styles.statLbl}>Accuracy</Text>
          </View>
        </View>

        {/* Reports */}
        <SectionHeader title={`${sorted.length} Reports`} dark={dark} />
        {sorted.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 32 }}>🔍</Text>
            <Text style={[styles.emptyTitle, { color: text }]}>No Reports Yet</Text>
            <Text style={{ fontSize: 14, color: sub, textAlign: 'center', marginTop: 6 }}>Be the first to report a wait time!</Text>
          </View>
        ) : (
          sorted.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              allReports={visibleReports}
              myVote={votes[r.id]}
              feedbackDone={feedbackDone[r.id]}
              onVote={vote}
              onFeedback={setFeedback}
              onFlag={flagReport}
              dark={dark}
            />
          ))
        )}

        {adminMode && hiddenReports.length > 0 && (
          <>
            <SectionHeader title={`Hidden Reports (${hiddenReports.length})`} dark={dark} />
            {hiddenReports.map((r) => (
              <View key={r.id} style={[styles.hiddenCard, { backgroundColor: card }]}> 
                <View style={{ flex: 1 }}>
                  <Text style={[styles.hiddenTitle, { color: text }]}>{r.crossingName} · {r.lane}</Text>
                  <Text style={styles.hiddenMeta}>Flags: {r.flags ?? 0} · Trust: {Math.round(r.trustScore ?? 0)}%</Text>
                  {!!r.note && <Text style={[styles.hiddenNote, { color: sub }]} numberOfLines={2}>{r.note}</Text>}
                </View>
                <TouchableOpacity onPress={() => restoreReport(r.id)} style={styles.restoreBtn}>
                  <Text style={styles.restoreTxt}>Restore</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 28, fontWeight: '800' },
  addBtn: { backgroundColor: BLUE, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  statsBar: { marginHorizontal: 16, marginVertical: 8, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLbl: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  statDivider: { width: 1, height: 30 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 12 },
  hiddenCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hiddenTitle: { fontSize: 14, fontWeight: '700' },
  hiddenMeta: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  hiddenNote: { fontSize: 12, marginTop: 4 },
  restoreBtn: { backgroundColor: '#34C75922', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  restoreTxt: { color: '#30D158', fontWeight: '700', fontSize: 12 },
});
