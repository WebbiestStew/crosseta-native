import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useApp } from '../context/AppContext';
import { BLUE, waitColor, colors, CROSSING_COORDS } from '../data';

export default function MapScreen({ navigation }) {
  const { crossings, dark } = useApp();
  const mapRef = useRef(null);
  const c = colors(dark);
  const [selected, setSelected] = useState(null);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.navBar, {
        backgroundColor: c.headerBg,
        borderBottomColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={{ color: BLUE, fontSize: 17 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: c.text }]}>Border Map</Text>
        <View style={{ width: 60 }} />
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        userInterfaceStyle={dark ? 'dark' : 'light'}
        initialRegion={{ latitude: 36.5, longitude: -100.0, latitudeDelta: 28, longitudeDelta: 45 }}
      >
        {crossings.map((crossing) => {
          const coords = CROSSING_COORDS[crossing.id];
          if (!coords) return null;
          const pinBg = waitColor(crossing.wait);
          return (
            <Marker
              key={crossing.id}
              coordinate={coords}
              onPress={() => setSelected(crossing)}
            >
              <View style={[styles.pin, { backgroundColor: pinBg }]}>
                <Text style={styles.pinText}>{crossing.wait}m</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Bottom callout card */}
      {selected && (
        <View style={[styles.calloutCard, { backgroundColor: c.card }]}>
          <Text style={styles.calloutFlag}>{selected.flag}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.calloutName, { color: c.text }]} numberOfLines={1}>{selected.name}</Text>
            <Text style={{ fontSize: 12, color: c.subtext }}>{selected.city} · {selected.region}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={[styles.calloutWait, { color: waitColor(selected.wait) }]}>
              {selected.wait} min
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Detail', { crossing: selected })}
              style={[styles.detailBtn, { backgroundColor: BLUE }]}
            >
              <Text style={styles.detailBtnText}>Details →</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setSelected(null)} hitSlop={8} style={styles.closeBtn}>
            <Text style={{ fontSize: 18, color: c.subtext }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  navTitle: { fontSize: 17, fontWeight: '700' },
  map: { flex: 1 },
  pin: {
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, alignItems: 'center', minWidth: 38,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2,
  },
  pinText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  calloutCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, paddingBottom: 28,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  calloutFlag: { fontSize: 32 },
  calloutName: { fontSize: 16, fontWeight: '800' },
  calloutWait: { fontSize: 18, fontWeight: '800' },
  detailBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  detailBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  closeBtn: { position: 'absolute', top: 12, right: 16 },
});
