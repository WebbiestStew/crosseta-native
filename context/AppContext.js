import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { ALL_CROSSINGS, SEED_REPORTS, SEED_TRIPS, BLUE } from '../data';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const KEYS = {
  favorites:        '@crosseta/favorites',
  dark:             '@crosseta/dark',
  haptics:          '@crosseta/haptics',
  notifSettings:    '@crosseta/notifSettings',
  thresholds:       '@crosseta/thresholds',
  votes:            '@crosseta/votes',
  feedbackDone:     '@crosseta/feedbackDone',
  onboarded:        '@crosseta/onboarded',
  reports:          '@crosseta/reports',
  trips:            '@crosseta/trips',
  activeCrossing:   '@crosseta/activeCrossing',
  completedTrips:   '@crosseta/completedTrips',
  lowAlerts:        '@crosseta/lowAlerts',        // { [crossingId]: boolean }
  checklist:        '@crosseta/checklist',        // { [crossingId]: { [itemId]: boolean } }
  weeklyNotifSent:  '@crosseta/weeklyNotifSent',  // { [crossingId]: ISO date string }
  cachedCrossings:  '@crosseta/cachedCrossings',  // last successful CBP payload merged with seeds
};

// Normalize a string for fuzzy CBP name matching
const normName = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [crossings, setCrossings] = useState(ALL_CROSSINGS);
  const [favorites, setFavorites] = useState([]);
  const [reports, setReports] = useState(SEED_REPORTS);
  const [trips, setTrips] = useState(SEED_TRIPS);
  const [dark, setDark] = useState(false);
  const [haptics, setHaptics] = useState(true);
  const [notifSettings, setNotifSettings] = useState({});
  const [thresholds, setThresholds] = useState({});
  const [votes, setVotes] = useState({});
  const [feedbackDone, setFeedbackDone] = useState({});
  const [onboarded, setOnboarded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  /** @type {[import('../types').ActiveCrossing|null, Function]} */
  const [activeCrossing, setActiveCrossing] = useState(null);
  /** @type {[import('../types').CompletedTrip[], Function]} */
  const [completedTrips, setCompletedTrips] = useState([]);
  /** lowAlerts: per-crossing toggle — alert when wait drops BELOW threshold */
  const [lowAlerts, setLowAlerts] = useState({});
  /** checklist: { [crossingId]: { [itemKey]: boolean } } */
  const [checklist, setChecklist] = useState({});
  /** weeklyNotifSent: tracks the last ISO date we sent a weekly best-time alert per crossing */
  const [weeklyNotifSent, setWeeklyNotifSent] = useState({});
  /** lastFetchTime: unix ms of the most recent successful CBP fetch */
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const notifCooldown = useRef({});
  /** Previous wait values — used by drop-alert logic to detect a decrease */
  const prevWaits = useRef({});

  // ─── Hydrate state from AsyncStorage on mount ─────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet(Object.values(KEYS));
        const stored = Object.fromEntries(
          pairs.filter(([, v]) => v !== null).map(([k, v]) => [k, JSON.parse(v)])
        );
        if (stored[KEYS.favorites])                  setFavorites(stored[KEYS.favorites]);
        if (stored[KEYS.dark]        !== undefined)  setDark(stored[KEYS.dark]);
        if (stored[KEYS.haptics]     !== undefined)  setHaptics(stored[KEYS.haptics]);
        if (stored[KEYS.notifSettings])              setNotifSettings(stored[KEYS.notifSettings]);
        if (stored[KEYS.thresholds])                 setThresholds(stored[KEYS.thresholds]);
        if (stored[KEYS.votes])                      setVotes(stored[KEYS.votes]);
        if (stored[KEYS.feedbackDone])               setFeedbackDone(stored[KEYS.feedbackDone]);
        if (stored[KEYS.onboarded]      !== undefined) setOnboarded(stored[KEYS.onboarded]);
        if (stored[KEYS.reports])                       setReports(stored[KEYS.reports]);
        if (stored[KEYS.trips])                         setTrips(stored[KEYS.trips]);
        // Restore an in-progress tracking session that survived an app restart
        if (stored[KEYS.activeCrossing] !== undefined)  setActiveCrossing(stored[KEYS.activeCrossing]);
        if (stored[KEYS.completedTrips])                setCompletedTrips(stored[KEYS.completedTrips]);
        if (stored[KEYS.lowAlerts])                     setLowAlerts(stored[KEYS.lowAlerts]);
        if (stored[KEYS.checklist])                     setChecklist(stored[KEYS.checklist]);
        if (stored[KEYS.weeklyNotifSent])               setWeeklyNotifSent(stored[KEYS.weeklyNotifSent]);
        // Restore cached crossing wait data so the list isn't all-zero on first open
        if (stored[KEYS.cachedCrossings])               setCrossings(stored[KEYS.cachedCrossings]);
      } catch { /* fall back to defaults silently */ }
      setHydrated(true);
    })();
  }, []);

  // ─── Persist state changes to AsyncStorage ───────────────────────────
  const save = (key, val) => AsyncStorage.setItem(key, JSON.stringify(val)).catch(() => {});
  useEffect(() => { if (hydrated) save(KEYS.favorites,     favorites);     }, [favorites,     hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.dark,          dark);           }, [dark,           hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.haptics,       haptics);        }, [haptics,        hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.notifSettings, notifSettings);  }, [notifSettings,  hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.thresholds,    thresholds);     }, [thresholds,     hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.votes,         votes);          }, [votes,          hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.feedbackDone,  feedbackDone);   }, [feedbackDone,   hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.onboarded,     onboarded);      }, [onboarded,      hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.reports,        reports);         }, [reports,         hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.trips,           trips);            }, [trips,            hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.activeCrossing,  activeCrossing);  }, [activeCrossing,  hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.completedTrips,  completedTrips);  }, [completedTrips,  hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.lowAlerts,       lowAlerts);       }, [lowAlerts,       hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.checklist,       checklist);       }, [checklist,       hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.weeklyNotifSent, weeklyNotifSent); }, [weeklyNotifSent, hydrated]);

  // ─── Request notification permissions on mount ───────────────────────
  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});
  }, []);

  // ─── Fire threshold alerts whenever crossing data updates ────────────
  useEffect(() => {
    if (!hydrated) return;
    crossings.forEach((c) => {
      if (!favorites.includes(c.id) || !notifSettings[c.id]) return;
      const threshold = thresholds[c.id] ?? 20;
      const now = Date.now();
      const cooldownKey = c.id;
      const withinCooldown = now - (notifCooldown.current[cooldownKey] ?? 0) < 15 * 60 * 1000;

      // ── HIGH alert: wait exceeds threshold ──
      if (c.wait > threshold && !withinCooldown) {
        notifCooldown.current[cooldownKey] = now;
        Notifications.scheduleNotificationAsync({
          content: {
            title: `${c.flag} ${c.name} – High Wait`,
            body: `Standard lane is ${c.wait} min (your alert is set to ${threshold} min).`,
            data: { crossingId: c.id },
          },
          trigger: null,
        }).catch(() => {});
      }

      // ── DROP alert: wait just fell below threshold ──
      const prevWait = prevWaits.current[c.id];
      const dropKey = `${c.id}_drop`;
      const dropCooled = now - (notifCooldown.current[dropKey] ?? 0) < 15 * 60 * 1000;
      if (
        lowAlerts[c.id] &&
        prevWait !== undefined &&
        prevWait > threshold &&
        c.wait <= threshold &&
        !dropCooled
      ) {
        notifCooldown.current[dropKey] = now;
        Notifications.scheduleNotificationAsync({
          content: {
            title: `${c.flag} ${c.name} – Wait Just Dropped! 🟢`,
            body: `Now only ${c.wait} min — good time to cross!`,
            data: { crossingId: c.id, type: 'drop' },
          },
          trigger: null,
        }).catch(() => {});
      }

      prevWaits.current[c.id] = c.wait;
    });
  }, [crossings, hydrated]);

  // ─── CBP live data fetch (improved name matching) ────────────────────
  const fetch_cbp = async () => {
    try {
      const res = await fetch('https://bwt.cbp.gov/api/bwtnew');
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;
      setCrossings((prev) => {
        const updated = prev.map((c) => {
          const cn = normName(c.name);
          const cityBase = normName(c.city.split(',')[0]);
          const match = data.find((d) => {
            if (!d.port_name) return false;
            const pn = normName(d.port_name);
            const xn = d.crossing_name ? normName(d.crossing_name) : '';
            return (
              cn.includes(pn) || pn.includes(cn) ||
              cityBase === pn ||
              (xn && (cn.includes(xn) || xn.includes(cn)))
            );
          });
          if (!match) return c;
          return {
            ...c,
            wait: parseInt(match.passenger_vehicle_lanes?.standard_lanes?.delay_minutes) || c.wait,
            sentriWait: parseInt(match.passenger_vehicle_lanes?.NEXUS_SENTRI_lanes?.delay_minutes) || c.sentriWait,
            dataAge: 0,
          };
        });
        // Persist updated crossing data as offline cache
        AsyncStorage.setItem(KEYS.cachedCrossings, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
      setLastFetchTime(Date.now());
    } catch { /* fall back to seed data silently */ }
  };

  useEffect(() => {
    fetch_cbp();
    const interval = setInterval(fetch_cbp, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ─── Weekly predictive best-time alerts ────────────────────────────────────
  // Fires at most once per crossing per week, on Sunday mornings 8–11 AM.
  useEffect(() => {
    if (!hydrated) return;
    const now = new Date();
    if (now.getDay() !== 0) return;                          // Sundays only
    if (now.getHours() < 8 || now.getHours() > 11) return;  // 8–11 AM window
    const todayISO = now.toISOString().slice(0, 10);

    favorites.forEach((id) => {
      const c = crossings.find((x) => x.id === id);
      if (!c || !notifSettings[id]) return;
      if (weeklyNotifSent[id] === todayISO) return; // already sent this Sunday

      const allSlots = (c.weeklyPattern ?? []).flatMap((d) =>
        d.slots.map((s) => ({ day: d.day, slot: s.slot, wait: s.wait }))
      );
      if (!allSlots.length) return;
      const best = allSlots.reduce((a, b) => (b.wait < a.wait ? b : a));

      Notifications.scheduleNotificationAsync({
        content: {
          title: `${c.flag} Heading to ${c.name} this week?`,
          body: `${best.day} ${best.slot} historically has the shortest wait (~${best.wait} min).`,
          data: { crossingId: id, type: 'weekly' },
        },
        trigger: null,
      }).catch(() => {});

      setWeeklyNotifSent((prev) => ({ ...prev, [id]: todayISO }));
    });
  }, [hydrated, favorites]);

  // ─── Actions ─────────────────────────────────────────────────────────
  const toggleStar = (id) =>
    setFavorites((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const addReport = (report) => setReports((prev) => [{
    id: `r_${Date.now()}`,
    author: 'You',
    initials: 'YO',
    avatarColor: BLUE,
    upvotes: 0,
    downvotes: 0,
    time: 0,
    ts: new Date().toISOString(),
    ...report,
  }, ...prev]);

  const vote = (reportId, dir) =>
    setVotes((prev) => ({ ...prev, [reportId]: prev[reportId] === dir ? null : dir }));

  const setFeedback = (reportId, val) =>
    setFeedbackDone((prev) => ({ ...prev, [reportId]: val }));

  const toggleNotif = async (id) => {
    const willEnable = !notifSettings[id];
    if (willEnable) {
      const { status } = await Notifications.requestPermissionsAsync().catch(() => ({ status: 'denied' }));
      if (status !== 'granted') return;
    }
    setNotifSettings((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setThreshold = (id, val) =>
    setThresholds((prev) => ({ ...prev, [id]: val }));

  const clearTrips = () => setTrips([]);

  /**
   * Begin a passive tracking session.
   * @param {string} crossingId
   * @param {'standard'|'sentri'|'ready'} laneType
   */
  const startTracking = (crossingId, laneType) => {
    setActiveCrossing({
      crossingId,
      laneType,
      startTime: Date.now(),
      startCoords: null,
      lastCoords: null,
      estimatedWait: null,
      status: 'queued',
    });
  };

  /**
   * Merge a partial update into activeCrossing (used by useLineTracker to write GPS coords/status).
   * @param {Partial<import('../types').ActiveCrossing>} patch
   */
  const updateActiveCrossing = (patch) =>
    setActiveCrossing((prev) => (prev ? { ...prev, ...patch } : prev));

  /**
   * Finalize the tracking session.
   * @param {{ endTime?: number, exitCoords?: object, cancelled?: boolean }|null} opts
   *   Pass null or { cancelled: true } to discard without saving.
   */
  const stopTracking = (opts) => {
    setActiveCrossing((prev) => {
      if (!prev) return null;

      if (opts && !opts.cancelled) {
        const endTime = opts.endTime ?? Date.now();
        // Clamp to at least 1 minute; store as whole minutes
        const actualWait = Math.max(1, Math.round((endTime - prev.startTime) / 60000));

        const trip = {
          id: `track_${Date.now()}`,
          crossingId: prev.crossingId,
          laneType: prev.laneType,
          startTime: prev.startTime,
          endTime,
          actualWait,
          entryCoords: prev.startCoords,
          exitCoords: opts.exitCoords ?? null,
        };

        setCompletedTrips((pt) => [trip, ...pt]);

        // ── Data contribution: fire-and-forget POST ───────────────────────
        // TODO: replace with real endpoint
        (async () => {
          try {
            await fetch('https://api.crosseta.com/v1/trips', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                crossingId: trip.crossingId,
                laneType:   trip.laneType,
                startTime:  trip.startTime,
                endTime:    trip.endTime,
                actualWaitMinutes: trip.actualWait,
                appVersion: '1.0.0',
              }),
            });
          } catch { /* silent — failure never blocks the user */ }
        })();
      }

      return null;
    });
  };

  const clearCompletedTrips = () => setCompletedTrips([]);

  /** Toggle the "alert when wait drops" flag for a crossing. */
  const toggleLowAlert = (id) =>
    setLowAlerts((prev) => ({ ...prev, [id]: !prev[id] }));

  /**
   * Toggle a single checklist item for a crossing.
   * @param {string} crossingId
   * @param {string} itemKey
   */
  const toggleChecklistItem = (crossingId, itemKey) =>
    setChecklist((prev) => ({
      ...prev,
      [crossingId]: {
        ...(prev[crossingId] ?? {}),
        [itemKey]: !(prev[crossingId]?.[itemKey] ?? false),
      },
    }));

  /** Reset all checklist items for a crossing to unchecked. */
  const resetChecklist = (crossingId) =>
    setChecklist((prev) => ({ ...prev, [crossingId]: {} }));

  const completeOnboarding = async (selectedIds) => {
    setFavorites(selectedIds);
    const ns = {}, nt = {};
    selectedIds.forEach((id) => { ns[id] = true; nt[id] = 20; });
    await Notifications.requestPermissionsAsync().catch(() => {});
    setNotifSettings(ns);
    setThresholds(nt);
    setOnboarded(true);
  };

  return (
    <AppContext.Provider value={{
      crossings, favorites, reports, trips, dark, haptics,
      notifSettings, thresholds, votes, feedbackDone, onboarded,
      setDark, setHaptics,
      toggleStar, addReport, vote, setFeedback,
      toggleNotif, setThreshold, clearTrips, completeOnboarding,
      activeCrossing, completedTrips,
      startTracking, stopTracking, updateActiveCrossing, clearCompletedTrips,
      lowAlerts, toggleLowAlert,
      checklist, toggleChecklistItem, resetChecklist,
      lastFetchTime, hydrated, fetchCBP: fetch_cbp,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
