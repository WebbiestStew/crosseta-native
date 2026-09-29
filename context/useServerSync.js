// Everything that talks to the CrossETA server, kept out of AppContext.
// With no server configured (api.available === false) every effect here is a no-op.
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../api';
import { saveHistory } from '../history';

const SHARE_TRIPS_KEY = '@crosseta/shareTrips';
const HISTORY_TTL_MS = 6 * 60 * 60 * 1000;
const REFRESH_MS = 5 * 60 * 1000;

const getPushToken = async () => {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return null;   // Expo push needs an EAS project id
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;   // simulators and unsigned builds cannot get a push token
  }
};

export function useServerSync({
  hydrated, favorites, notifSettings, thresholds, lowAlerts, quietHours, lang,
  historyRef, setReports, setVotes,
}) {
  const [communityWaits, setCommunityWaits] = useState({});
  const [serverPush, setServerPush] = useState(false);
  const [shareTrips, setShareTripsState] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const historyFetchedAt = useRef({});
  const uploaded = useRef(new Set());

  useEffect(() => {
    AsyncStorage.getItem(SHARE_TRIPS_KEY).then((v) => setShareTripsState(v === 'true')).catch(() => {});
  }, []);

  const setShareTrips = (on) => {
    setShareTripsState(on);
    AsyncStorage.setItem(SHARE_TRIPS_KEY, String(on)).catch(() => {});
  };

  // ─── Server-side history (real months of samples, port-local clock) ─────────
  const loadServerHistory = useCallback(async (ids) => {
    if (!api.available) return;
    const now = Date.now();
    const stale = ids.filter((id) => now - (historyFetchedAt.current[id] ?? historyRef.current.__server?.[id]?.fetchedAt ?? 0) > HISTORY_TTL_MS);
    if (!stale.length) return;
    stale.forEach((id) => { historyFetchedAt.current[id] = now; });
    try {
      for (let i = 0; i < stale.length; i += 20) {
        const res = await api.history(stale.slice(i, i + 20));
        historyRef.current.__server ??= {};
        for (const [id, h] of Object.entries(res)) {
          if (h?.buckets && Object.keys(h.buckets).length) {
            historyRef.current.__server[id] = { tz: h.tz ?? 0, buckets: h.buckets, fetchedAt: now };
          }
        }
      }
      saveHistory(historyRef.current);
      setHistoryTick((n) => n + 1);
    } catch {
      stale.forEach((id) => { delete historyFetchedAt.current[id]; });   // retry next time
    }
  }, [historyRef]);

  // ─── Community: measured waits + reports ────────────────────────────────────
  const refreshCommunity = useCallback(async () => {
    if (!api.available) return;
    try { setCommunityWaits((await api.community()).crossings ?? {}); } catch { /* keep last */ }
  }, []);

  const refreshReports = useCallback(async () => {
    if (!api.available) return;
    try {
      const { reports } = await api.reports();
      setReports(reports);
      // The server is the source of truth for what this device has voted.
      setVotes((prev) => ({ ...prev, ...Object.fromEntries(reports.map((r) => [r.id, r.myVote])) }));
    } catch { /* keep last */ }
  }, [setReports, setVotes]);

  useEffect(() => {
    if (!api.available || !hydrated) return undefined;
    loadServerHistory(favorites);
    refreshCommunity();
    refreshReports();
    const id = setInterval(() => { refreshCommunity(); refreshReports(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [hydrated]);   // eslint-disable-line react-hooks/exhaustive-deps

  const submitReport = async (report, author) => {
    try {
      const lane = report.lane;
      await api.postReport({ crossingId: report.crossingId, lane, wait: report.wait, note: report.note, author });
      refreshReports();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const voteRemote = (reportId, value) => api.vote(reportId, value).catch(refreshReports);
  const flagRemote = (reportId) => api.flag(reportId).then(refreshReports).catch(() => {});

  // ─── Trips (opt-in) ─────────────────────────────────────────────────────────
  const uploadTrip = (trip) => {
    if (!api.available || !shareTrips || uploaded.current.has(trip.id)) return;
    uploaded.current.add(trip.id);
    api.postTrip({
      crossingId: trip.crossingId, lane: trip.laneType, startTime: trip.startTime, endTime: trip.endTime, actualWait: trip.actualWait,
    }).then(refreshCommunity).catch(() => {});
  };

  // ─── Push alerts: keep the server's copy of this device's rules in sync ────
  useEffect(() => {
    if (!api.available || !hydrated) return undefined;
    const timer = setTimeout(async () => {
      const rules = favorites
        .filter((id) => notifSettings[id])
        .map((id) => ({ crossingId: id, threshold: thresholds[id] ?? 20, lowAlert: !!lowAlerts[id], lane: 'standard' }));
      const pushToken = await getPushToken();
      try {
        await api.putAlerts({ pushToken, lang, quiet: quietHours, tzOffsetMin: -new Date().getTimezoneOffset(), rules });
        setServerPush(!!pushToken);
      } catch {
        setServerPush(false);   // server unreachable: fall back to on-device alerts
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [hydrated, favorites, notifSettings, thresholds, lowAlerts, quietHours, lang]);

  const deleteMyData = async () => {
    await api.deleteMe();
    setShareTrips(false);
    setServerPush(false);
    setCommunityWaits({});
  };

  return {
    communityWaits, serverPush, shareTrips, setShareTrips, historyTick,
    loadServerHistory, refreshCommunity, refreshReports, submitReport, voteRemote, flagRemote, uploadTrip, deleteMyData,
  };
}
