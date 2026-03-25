import React, { useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Share,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import { BLUE, GREEN, ORANGE, RED, waitColor, waitLabel } from '../data';

export default function ShareScreen({ route, navigation }) {
  const { crossing } = route.params;
  const cardRef = useRef(null);

  const handleShareText = async () => {
    const message = `🚦 Border Wait: ${crossing.name}\n📍 ${crossing.city}\n⏱ Current Wait: ${crossing.wait} min (${waitLabel(crossing.wait)})\n\n📱 Check live times → CrossETA app`;
    await Share.share({ message, title: `CrossETA – ${crossing.name}` });
  };

  const handleShareImage = async () => {
    try {
      const uri = await captureRef(cardRef, { format: 'jpg', quality: 0.92 });
      await Share.share({ url: uri, title: `CrossETA – ${crossing.name}` });
    } catch (_) {
      await handleShareText();
    }
  };

  const color = waitColor(crossing.wait);

  return (
    <SafeAreaView style={styles.root}>
      {/* Nav */}
      <View style={styles.navBar}>
        <View style={{ width: 60 }} />
        <Text style={styles.navTitle}>Share Crossing</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 60, alignItems: 'flex-end' }}>
          <Text style={{ color: BLUE, fontSize: 17, fontWeight: '600' }}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.center}>
        {/* Share card preview */}
        <View ref={cardRef} collapsable={false}>
          <LinearGradient colors={['#000', '#111']} style={styles.shareCard}>
          <LinearGradient colors={[BLUE, '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardHeader}>
            <Text style={styles.cardHeaderText}>🚦 CrossETA</Text>
            <Text style={styles.cardHeaderSub}>Live Border Wait Times • Diego V / Stewy</Text>
          </LinearGradient>

          <View style={styles.cardBody}>
            <View style={styles.cardLeft}>
              <Text style={{ fontSize: 40 }}>{crossing.flag}</Text>
              <Text style={styles.cardName}>{crossing.name}</Text>
              <Text style={styles.cardCity}>{crossing.city}, {crossing.country}</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={[styles.cardWait, { color }]}>{crossing.wait}</Text>
              <Text style={styles.cardMin}>min</Text>
              <View style={[styles.cardBadge, { backgroundColor: `${color}33` }]}>
                <Text style={[styles.cardBadgeText, { color }]}>{waitLabel(crossing.wait)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardFooter}>
            {[
              { l: 'SENTRI', v: crossing.sentriWait },
              { l: '+1h', v: crossing.predict1h },
              { l: '+3h', v: crossing.predict3h },
            ].map((p) => (
              <View key={p.l} style={styles.cardFooterItem}>
                <Text style={styles.cardFooterLabel}>{p.l}</Text>
                <Text style={[styles.cardFooterValue, { color: waitColor(p.v) }]}>{p.v}m</Text>
              </View>
            ))}
            <View style={styles.cardFooterItem}>
              <Text style={styles.cardFooterLabel}>Updated</Text>
              <Text style={styles.cardFooterValue}>{crossing.dataAge}m ago</Text>
            </View>
          </View>
          </LinearGradient>
        </View>

        {/* Share buttons */}
        <TouchableOpacity onPress={handleShareImage} activeOpacity={0.85} style={styles.shareBtn}>
          <LinearGradient colors={[BLUE, '#5AC8FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.shareBtnInner}>
            <Text style={styles.shareBtnText}>📸 Share as Image</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleShareText} activeOpacity={0.85} style={styles.moreBtn}>
          <Text style={styles.moreBtnText}>Share as Text</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1C1C1E' },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)' },
  navTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  center: { flex: 1, padding: 24, justifyContent: 'center' },
  shareCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 28 },
  cardHeader: { paddingHorizontal: 20, paddingVertical: 14 },
  cardHeaderText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  cardHeaderSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  cardLeft: {},
  cardName: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 8 },
  cardCity: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  cardWait: { fontSize: 52, fontWeight: '900' },
  cardMin: { color: 'rgba(255,255,255,0.6)', fontSize: 16, textAlign: 'right' },
  cardBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  cardBadgeText: { fontSize: 12, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 12 },
  cardFooterItem: { flex: 1, alignItems: 'center' },
  cardFooterLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', marginBottom: 4 },
  cardFooterValue: { color: '#fff', fontSize: 13, fontWeight: '700' },
  shareBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  shareBtnInner: { padding: 17, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  moreBtn: { padding: 14, alignItems: 'center' },
  moreBtnText: { color: BLUE, fontSize: 16, fontWeight: '600' },
});
