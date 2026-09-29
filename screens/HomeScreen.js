import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, SafeAreaView, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import { BLUE, GREEN, ORANGE, waitColor, timeAgo, isOpenNow, CROSSING_COORDS, distanceMi, isStale, laneWait, laneLabel, LANE_KEYS } from '../data';
import { PillBtn, SectionHeader, WaitPill, Sparkline } from '../components/UI';
import CrossingCard from '../components/CrossingCard';
import SkeletonCard from '../components/SkeletonCard';
import { t } from '../i18n';

export default function HomeScreen({ navigation }) {
  const {
    crossings, favorites, toggleStar, reports, dark, hydrated, fetchCBP, trackEvent,
    lastFetchTime, userPos, locate, driveMinFor, laneType, setLaneType, communityWaits,
  } = useApp();
  // Measured wait (from drivers' tracked trips) for the user's lane, else standard.
  const measuredFor = (c) => communityWaits?.[c.id]?.[laneType] ?? communityWaits?.[c.id]?.standard ?? null;
  const lw = (c) => laneWait(c, laneType).wait;
  const byLaneWait = (a, b) => (lw(a) ?? Infinity) - (lw(b) ?? Infinity);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('default');   // 'default' | 'waitAsc' | 'waitDesc' | 'name' | 'nearMe'
  const [openOnly, setOpenOnly] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingNearMe, setLoadingNearMe] = useState(false);
  const regions = [...new Set(crossings.map((c) => c.region))];
  const bg = dark ? '#1C1C1E' : '#F2F2F7';
  const card = dark ? '#2C2C2E' : '#fff';
  const text = dark ? '#fff' : '#000';
  const inputBg = dark ? '#3A3A3C' : '#E5E5EA';

  const nearMeDistances = useMemo(() => {
    if (sort !== 'nearMe' || !userPos) return null;
    const d = {};
    crossings.forEach((c) => {
      const coords = CROSSING_COORDS[c.id];
      if (coords) d[c.id] = distanceMi(userPos, coords);
    });
    return d;
  }, [sort, userPos, crossings]);

  const toggleNearMe = useCallback(async () => {
    if (sort === 'nearMe') { setSort('default'); return; }
    setLoadingNearMe(true);
    const pos = userPos ?? await locate({ prompt: true });
    setLoadingNearMe(false);
    if (pos) setSort('nearMe');
  }, [sort, userPos, locate]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCBP();
    setRefreshing(false);
  }, [fetchCBP]);

  const applySort = (arr) => {
    switch (sort) {
      case 'waitAsc':  return [...arr].sort(byLaneWait);
      case 'waitDesc': return [...arr].sort((a, b) => (lw(b) ?? -1) - (lw(a) ?? -1));
      case 'name':     return [...arr].sort((a, b) => a.name.localeCompare(b.name));
      case 'nearMe':   return nearMeDistances
        ? [...arr].sort((a, b) => (nearMeDistances[a.id] ?? 99999) - (nearMeDistances[b.id] ?? 99999))
        : arr;
      default:         return arr;
    }
  };

  const filtered = applySort(
    crossings
      .filter((c) => {
        if (filter === 'All') return true;
        if (filter === 'MX') return c.border === 'MX';
        if (filter === 'CA') return c.border === 'CA';
        return c.region === filter;
      })
      .filter((c) => !openOnly || c.is24h || isOpenNow(c.hours))
      .filter((c) => search === '' ? true :
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.city.toLowerCase().includes(search.toLowerCase()) ||
        c.country.toLowerCase().includes(search.toLowerCase())
      )
  );

  const favCrossings = filtered.filter((c) => favorites.includes(c.id));
  const otherCrossings = filtered.filter((c) => !favorites.includes(c.id));
  // With a known position, "best" means shortest drive + wait among open crossings within
  // 250 miles; without one it is simply the lowest current wait.
  const bestCrossing = useMemo(() => {
    // Skip readings CBP hasn't refreshed in 3 hours: a stale 0 shouldn't be crowned "best".
    const live = filtered.filter((c) => lw(c) != null && (c.is24h || isOpenNow(c.hours)) && !isStale(c, 180));
    if (userPos) {
      const near = live
        .map((c) => ({ c, drive: driveMinFor(c), miles: CROSSING_COORDS[c.id] ? distanceMi(userPos, CROSSING_COORDS[c.id]) : Infinity }))
        .filter((x) => x.drive != null && x.miles <= 250)
        .sort((a, b) => (a.drive + lw(a.c)) - (b.drive + lw(b.c)))[0];
      if (near) return { ...near.c, _drive: near.drive };
    }
    return [...live].sort(byLaneWait)[0];
  }, [filtered, userPos, laneType]);

  const isLoading = !hydrated;

  useEffect(() => {
    trackEvent?.('open_app', { screen: 'Home' });
  }, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: bg, borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: text }]}>CrossETA</Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Map')}
              style={[styles.reportBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: BLUE, paddingHorizontal: 10 }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.reportBtnText, { color: BLUE }]}>📍 {t('Map')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Report', { crossing: null })}
              style={styles.reportBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.reportBtnText}>+ {t('Report')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: inputBg }]}>
          <Text style={{ color: '#8E8E93', fontSize: 16 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('Search crossings...')}
            placeholderTextColor="#8E8E93"
            style={[styles.searchInput, { color: text }]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Text style={{ color: '#8E8E93', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowAdvanced((v) => !v)}
            hitSlop={8}
            accessibilityLabel={showAdvanced ? t('Hide Advanced Filters') : t('Show Advanced Filters')}
            style={[styles.filterBtn, showAdvanced && { backgroundColor: BLUE }]}
          >
            <Text style={{ fontSize: 15, color: showAdvanced ? '#fff' : BLUE }}>⚙︎</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BLUE}
            title={t('Refreshing wait times…')}
            titleColor={dark ? '#fff' : '#555'}
          />
        }
      >
        {/* Best Crossing Banner */}
        {!isLoading && bestCrossing && (
          <TouchableOpacity onPress={() => navigation.navigate('Detail', { crossing: bestCrossing })} activeOpacity={0.85} style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 18, overflow: 'hidden' }}>
            <LinearGradient colors={['#007AFF', '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bestBanner}>
              <Text style={styles.bestLabel}>{bestCrossing._drive != null ? t('BEST CROSSING NEAR YOU') : t('BEST CROSSING RIGHT NOW')}</Text>
              <View style={styles.bestRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 22 }}>{bestCrossing.flag}</Text>
                  <Text style={styles.bestName}>{bestCrossing.name}</Text>
                </View>
                <View style={styles.bestPill}>
                  <Text style={styles.bestPillText}>{t('{n} min', { n: lw(bestCrossing) })}</Text>
                </View>
              </View>
              <Text style={styles.bestSub}>
                {bestCrossing.city} · {bestCrossing._drive != null
                  ? t('~{d} min drive + {n} min wait', { d: bestCrossing._drive, n: lw(bestCrossing) })
                  : t('{n} min wait', { n: lw(bestCrossing) })}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Filter pills */}
        {showAdvanced && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 }}>
          {[
            { key: 'All', label: t('All') },
            { key: 'MX', label: t('🇲🇽 Mexico') },
            { key: 'CA', label: t('🇨🇦 Canada') },
            ...regions.map((r) => ({ key: r, label: t(r) })),
          ].map((f) => (
            <PillBtn key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} dark={dark} />
          ))}
        </ScrollView>}

        {/* Preferred lane */}
        {showAdvanced && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, gap: 8 }}>
          {LANE_KEYS.map((k) => (
            <PillBtn key={k} label={t(k === 'sentri' ? 'SENTRI / NEXUS' : laneLabel(k, 'MX'))} active={laneType === k} onPress={() => setLaneType(k)} dark={dark} />
          ))}
        </ScrollView>}

        {/* Sort + Open Now pills */}
        {showAdvanced && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 8 }}>
          <PillBtn
            label={t('🟢 Open Now')}
            active={openOnly}
            onPress={() => setOpenOnly((v) => !v)}
            dark={dark}
            activeColor={GREEN}
          />
          <PillBtn label={loadingNearMe ? '…' : t('📍 Near Me')} active={sort === 'nearMe'} onPress={toggleNearMe} dark={dark} activeColor={ORANGE} />
          <PillBtn label={t('Wait ↑')} active={sort === 'waitAsc'}  onPress={() => setSort(sort === 'waitAsc'  ? 'default' : 'waitAsc')}  dark={dark} />
          <PillBtn label={t('Wait ↓')} active={sort === 'waitDesc'} onPress={() => setSort(sort === 'waitDesc' ? 'default' : 'waitDesc')} dark={dark} />
          <PillBtn label={t('A–Z')} active={sort === 'name'}     onPress={() => setSort(sort === 'name'     ? 'default' : 'name')}     dark={dark} />
        </ScrollView>}

        {/* Skeleton loading */}
        {isLoading && (
          <>
            <SectionHeader title={t('Loading…')} dark={dark} />
            {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} dark={dark} />)}
          </>
        )}

        {!isLoading && (
          <>
            {/* My Crossings */}
            {favCrossings.length > 0 && (
              <>
                <SectionHeader title={t('My Crossings')} dark={dark} />
                {favCrossings.map((c) => (
                  <CrossingCard key={c.id} crossing={c} isFav={true} onStar={toggleStar} onPress={(c) => navigation.navigate('Detail', { crossing: c })} dark={dark} driveMin={driveMinFor(c)} lane={laneType} measured={measuredFor(c)} />
                ))}
              </>
            )}

            {/* All / Other Crossings */}
            <SectionHeader title={favCrossings.length > 0 ? t('Other Crossings') : t('All Crossings')} dark={dark} />
            {otherCrossings.length === 0 && (
              <View style={[styles.emptyStateCard, { backgroundColor: card }]}>
                <Text style={{ color: text, fontSize: 16, fontWeight: '700' }}>{t('No crossings found')}</Text>
                <Text style={{ color: '#8E8E93', textAlign: 'center', marginTop: 6, fontSize: 14 }}>
                  {t('Try changing filters or clear search.')}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setFilter('All');
                    setSort('default');
                    setOpenOnly(false);
                    setSearch('');
                  }}
                  style={[styles.emptyActionBtn, { backgroundColor: BLUE }]}
                >
                  <Text style={styles.emptyActionText}>{t('Reset Filters')}</Text>
                </TouchableOpacity>
              </View>
            )}
            {otherCrossings.map((c) => (
              <CrossingCard key={c.id} crossing={c} isFav={false} onStar={toggleStar} onPress={(c) => navigation.navigate('Detail', { crossing: c })} dark={dark} distanceMi={nearMeDistances?.[c.id]} driveMin={driveMinFor(c)} lane={laneType} measured={measuredFor(c)} />
            ))}

            {/* Community feed preview */}
            {reports.filter((r) => !r.hidden).length > 0 && (
              <>
                <SectionHeader title={t('Recent Community Reports')} dark={dark} />
                {reports.filter((r) => !r.hidden).slice(0, 3).map((r) => (
                  <View key={r.id} style={[styles.miniReport, { backgroundColor: card }]}>
                    <View style={[styles.miniAvatar, { backgroundColor: r.avatarColor }]}>
                      <Text style={styles.miniInitials}>{r.initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.miniReportName, { color: text }]}>{r.crossingName} · {t(r.lane)}</Text>
                      <Text style={styles.miniReportTime}>{timeAgo(r.time)}</Text>
                    </View>
                    <WaitPill wait={r.wait} small />
                  </View>
                ))}
              </>
            )}

            <View style={[styles.snapshotCard, { backgroundColor: card }]}> 
              <Text style={[styles.snapshotTitle, { color: text }]}>{t('Offline Snapshot')}</Text>
              <Text style={styles.snapshotSub}>
                {t('Last live update: {when}', { when: lastFetchTime ? t('{n} min ago', { n: Math.max(0, Math.round((Date.now() - lastFetchTime) / 60000)) }) : t('Not yet fetched') })}
              </Text>
              <Text style={styles.snapshotSub}>{t('If service drops, cached waits remain visible.')}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, borderBottomWidth: 0.5 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 36, fontWeight: '800', letterSpacing: -0.6 },
  reportBtn: { backgroundColor: BLUE, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44 },
  reportBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 17 },
  bestBanner: { padding: 18, borderRadius: 18 },
  bestLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  bestRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  bestName: { fontSize: 20, fontWeight: '800', color: '#fff', marginLeft: 10, flex: 1 },
  bestPill: { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  bestPillText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  bestSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 6 },
  miniReport: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 12, minHeight: 56, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  miniAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  miniInitials: { color: '#fff', fontSize: 12, fontWeight: '700' },
  miniReportName: { fontSize: 15, fontWeight: '600' },
  miniReportTime: { fontSize: 13, color: '#8E8E93' },
  snapshotCard: { marginHorizontal: 16, marginTop: 12, marginBottom: 8, borderRadius: 12, padding: 14 },
  snapshotTitle: { fontSize: 15, fontWeight: '800' },
  snapshotSub: { marginTop: 4, fontSize: 13, color: '#8E8E93' },
  filterBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  emptyStateCard: { marginHorizontal: 16, marginVertical: 16, borderRadius: 12, padding: 16, alignItems: 'center' },
  emptyActionBtn: { marginTop: 12, minHeight: 44, paddingHorizontal: 16, borderRadius: 10, justifyContent: 'center' },
  emptyActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
