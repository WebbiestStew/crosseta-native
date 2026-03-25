import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, SafeAreaView, RefreshControl,
} from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../context/AppContext';
import { BLUE, GREEN, ORANGE, waitColor, timeAgo, isOpenNow, CROSSING_COORDS } from '../data';
import { PillBtn, SectionHeader, WaitPill, Sparkline } from '../components/UI';
import CrossingCard from '../components/CrossingCard';
import SkeletonCard from '../components/SkeletonCard';

export default function HomeScreen({ navigation }) {
  const { crossings, favorites, toggleStar, reports, dark, hydrated, fetchCBP, trackEvent } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('default');   // 'default' | 'waitAsc' | 'waitDesc' | 'name' | 'nearMe'
  const [openOnly, setOpenOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nearMeDistances, setNearMeDistances] = useState(null); // { [id]: miles }
  const [loadingNearMe, setLoadingNearMe] = useState(false);
  const regions = [...new Set(crossings.map((c) => c.region))];
  const bg = dark ? '#1C1C1E' : '#F2F2F7';
  const card = dark ? '#2C2C2E' : '#fff';
  const text = dark ? '#fff' : '#000';
  const inputBg = dark ? '#3A3A3C' : '#E5E5EA';

  const haversineKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const toggleNearMe = useCallback(async () => {
    if (sort === 'nearMe') {
      setSort('default');
      setNearMeDistances(null);
      return;
    }
    setLoadingNearMe(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLoadingNearMe(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      const distances = {};
      crossings.forEach((c) => {
        const coords = CROSSING_COORDS[c.id];
        if (coords) {
          distances[c.id] = haversineKm(latitude, longitude, coords.lat, coords.lon) * 0.621371;
        }
      });
      setNearMeDistances(distances);
      setSort('nearMe');
    } catch (e) { /* permission denied silently */ }
    setLoadingNearMe(false);
  }, [sort, crossings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCBP();
    setRefreshing(false);
  }, [fetchCBP]);

  const applySort = (arr) => {
    switch (sort) {
      case 'waitAsc':  return [...arr].sort((a, b) => a.wait - b.wait);
      case 'waitDesc': return [...arr].sort((a, b) => b.wait - a.wait);
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
  const bestCrossing = [...filtered].sort((a, b) => a.wait - b.wait)[0];

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
              <Text style={[styles.reportBtnText, { color: BLUE }]}>📍 Map</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Report', { crossing: null })}
              style={styles.reportBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.reportBtnText}>+ Report</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: inputBg }]}>
          <Text style={{ color: '#8E8E93', fontSize: 16 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search crossings..."
            placeholderTextColor="#8E8E93"
            style={[styles.searchInput, { color: text }]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: '#8E8E93', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
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
            title="Refreshing wait times…"
            titleColor={dark ? '#fff' : '#555'}
          />
        }
      >
        {/* Best Crossing Banner */}
        {!isLoading && bestCrossing && (
          <TouchableOpacity onPress={() => navigation.navigate('Detail', { crossing: bestCrossing })} activeOpacity={0.85} style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 18, overflow: 'hidden' }}>
            <LinearGradient colors={['#007AFF', '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bestBanner}>
              <Text style={styles.bestLabel}>BEST CROSSING RIGHT NOW</Text>
              <View style={styles.bestRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 22 }}>{bestCrossing.flag}</Text>
                  <Text style={styles.bestName}>{bestCrossing.name}</Text>
                </View>
                <View style={styles.bestPill}>
                  <Text style={styles.bestPillText}>{bestCrossing.wait} min</Text>
                </View>
              </View>
              <Text style={styles.bestSub}>{bestCrossing.city} · {bestCrossing.wait} min wait</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Widget Preview */}
        {favorites.length > 0 && (() => {
          const c = crossings.find((x) => x.id === favorites[0]);
          const c2 = favorites.length >= 2 ? crossings.find((x) => x.id === favorites[1]) : null;
          return (
            <>
              <SectionHeader title="Home Screen Widgets" dark={dark} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                {c && (
                  <LinearGradient colors={['#007AFF', '#5AC8FA']} style={styles.widgetSmall} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={{ fontSize: 20 }}>{c.flag}</Text>
                    <Text style={styles.widgetName}>{c.name}</Text>
                    <Text style={styles.widgetWait}>{c.wait}m</Text>
                    <Text style={styles.widgetLevel}>{c.wait <= 15 ? 'Low' : c.wait <= 40 ? 'Moderate' : 'High'}</Text>
                  </LinearGradient>
                )}
                {c && c2 && (
                  <View style={[styles.widgetMedium, { backgroundColor: card }]}>
                    {[c, c2].map((w) => (
                      <View key={w.id} style={styles.widgetMediumRow}>
                        <Text style={{ fontSize: 16 }}>{w.flag}</Text>
                        <Text style={[styles.widgetMediumName, { color: text }]} numberOfLines={1}>{w.name}</Text>
                        <WaitPill wait={w.wait} small />
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </>
          );
        })()}

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 }}>
          {[
            { key: 'All', label: 'All' },
            { key: 'MX', label: '🇲🇽 Mexico' },
            { key: 'CA', label: '🇨🇦 Canada' },
            ...regions.map((r) => ({ key: r, label: r })),
          ].map((f) => (
            <PillBtn key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} dark={dark} />
          ))}
        </ScrollView>

        {/* Sort + Open Now pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 8 }}>
          <PillBtn
            label="🟢 Open Now"
            active={openOnly}
            onPress={() => setOpenOnly((v) => !v)}
            dark={dark}
            activeColor={GREEN}
          />
          <PillBtn label={loadingNearMe ? '…' : '📍 Near Me'} active={sort === 'nearMe'} onPress={toggleNearMe} dark={dark} activeColor={ORANGE} />
          <PillBtn label="Wait ↑" active={sort === 'waitAsc'}  onPress={() => setSort(sort === 'waitAsc'  ? 'default' : 'waitAsc')}  dark={dark} />
          <PillBtn label="Wait ↓" active={sort === 'waitDesc'} onPress={() => setSort(sort === 'waitDesc' ? 'default' : 'waitDesc')} dark={dark} />
          <PillBtn label="A–Z"    active={sort === 'name'}     onPress={() => setSort(sort === 'name'     ? 'default' : 'name')}     dark={dark} />
        </ScrollView>

        {/* Skeleton loading */}
        {isLoading && (
          <>
            <SectionHeader title="Loading…" dark={dark} />
            {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} dark={dark} />)}
          </>
        )}

        {!isLoading && (
          <>
            {/* My Crossings */}
            {favCrossings.length > 0 && (
              <>
                <SectionHeader title="My Crossings" dark={dark} />
                {favCrossings.map((c) => (
                  <CrossingCard key={c.id} crossing={c} isFav={true} onStar={toggleStar} onPress={(c) => navigation.navigate('Detail', { crossing: c })} dark={dark} />
                ))}
              </>
            )}

            {/* All / Other Crossings */}
            <SectionHeader title={favCrossings.length > 0 ? 'Other Crossings' : 'All Crossings'} dark={dark} />
            {otherCrossings.length === 0 && (
              <Text style={{ color: '#8E8E93', textAlign: 'center', marginVertical: 20, fontSize: 14 }}>
                No crossings match your filters.
              </Text>
            )}
            {otherCrossings.map((c) => (
              <CrossingCard key={c.id} crossing={c} isFav={false} onStar={toggleStar} onPress={(c) => navigation.navigate('Detail', { crossing: c })} dark={dark} distanceMi={nearMeDistances?.[c.id]} />
            ))}

            {/* Community feed preview */}
            {reports.filter((r) => !r.hidden).length > 0 && (
              <>
                <SectionHeader title="Recent Community Reports" dark={dark} />
                {reports.filter((r) => !r.hidden).slice(0, 3).map((r) => (
                  <View key={r.id} style={[styles.miniReport, { backgroundColor: card }]}>
                    <View style={[styles.miniAvatar, { backgroundColor: r.avatarColor }]}>
                      <Text style={styles.miniInitials}>{r.initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.miniReportName, { color: text }]}>{r.crossingName} · {r.lane}</Text>
                      <Text style={styles.miniReportTime}>{timeAgo(r.time)}</Text>
                    </View>
                    <WaitPill wait={r.wait} small />
                  </View>
                ))}
              </>
            )}
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
  widgetSmall: { borderRadius: 16, padding: 16, width: 160, justifyContent: 'center' },
  widgetName: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 6 },
  widgetWait: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 6 },
  widgetLevel: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  widgetMedium: { borderRadius: 16, padding: 16, width: 240, justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  widgetMediumRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  widgetMediumName: { flex: 1, fontSize: 13, fontWeight: '600' },
  miniReport: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 12, minHeight: 56, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  miniAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  miniInitials: { color: '#fff', fontSize: 12, fontWeight: '700' },
  miniReportName: { fontSize: 15, fontWeight: '600' },
  miniReportTime: { fontSize: 13, color: '#8E8E93' },
});
