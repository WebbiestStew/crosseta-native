import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { estimateWait, ALL_CROSSINGS, SEED_REPORTS, SEED_TRIPS, BLUE } from '../data';
import { t, resolveLanguage, setLanguage } from '../i18n';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Anonymous trip-duration upload. Keep false until https://api.crosseta.com/v1/trips is live;
// enabling it also requires updating PrivacyInfo.xcprivacy and the App Store privacy answers.
const CONTRIBUTE_TRIPS = false;

const KEYS = {
  lang:             '@crosseta/lang',
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
  cachedCrossings:  '@crosseta/cachedCrossings_v2',  // last successful CBP payload merged with seeds
  profile:          '@crosseta/profile',          // { displayName, initials }
  reportMeta:       '@crosseta/reportMeta',       // { lastPostedByCrossing: { [id]: ts } }
  quietHours:       '@crosseta/quietHours',       // { enabled, start, end }
  analytics:        '@crosseta/analytics',        // local event log
  adminMode:        '@crosseta/adminMode',        // lightweight local moderator mode
  accessibility:    '@crosseta/accessibility',    // { fontSizeMultiplier: 1.0, highContrast: false }
  uiPrefs:          '@crosseta/uiPrefs',          // { simpleMode: boolean, showHelpTips: boolean }
  notificationProfile: '@crosseta/notificationProfile', // calm | balanced | always
  savedTripTemplates: '@crosseta/savedTripTemplates',   // [{ id, name, crossingId, laneType, threshold, arrival }]
};

// Normalize a string for fuzzy CBP name matching
// CBP lane block -> { minutes: number|null, closed: bool }. "no delay" is a real 0,
// not a missing value; blank/unavailable/closed lanes are null (never a stale number).
const readLane = (lane) => {
  if (!lane) return { minutes: null, closed: false };
  const status = String(lane.operational_status ?? '').toLowerCase();
  if (status.includes('closed')) return { minutes: null, closed: true };
  if (status.includes('no delay')) return { minutes: 0, closed: false };
  const n = parseInt(lane.delay_minutes, 10);
  return { minutes: Number.isFinite(n) ? n : null, closed: false };
};

const normName = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

const getInitials = (name = 'You') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'YO';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

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
  const [profile, setProfile] = useState({ displayName: 'You', initials: 'YO' });
  const [reportMeta, setReportMeta] = useState({ lastPostedByCrossing: {} });
  const [quietHours, setQuietHours] = useState({ enabled: false, start: 22, end: 7 });
  const [analytics, setAnalytics] = useState([]);
  const [adminMode, setAdminMode] = useState(false);
  const [accessibility, setAccessibilityState] = useState({ fontSizeMultiplier: 1.0, highContrast: false });
  const [uiPrefs, setUiPrefs] = useState({ simpleMode: false, showHelpTips: true });
  const [notificationProfile, setNotificationProfileState] = useState('balanced');
  const [savedTripTemplates, setSavedTripTemplates] = useState([]);
  /** lastFetchTime: unix ms of the most recent successful CBP fetch */
  const [lastFetchTime, setLastFetchTime] = useState(null);
  /** langPref: 'auto' | 'en' | 'es'; lang: the resolved language actually in use */
  const [langPref, setLangPrefState] = useState('auto');
  const [lang, setLangState] = useState(() => {
    const l = resolveLanguage('auto');
    setLanguage(l);
    return l;
  });
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
        if (stored[KEYS.lang]) {
          const l = resolveLanguage(stored[KEYS.lang]);
          setLanguage(l);
          setLangPrefState(stored[KEYS.lang]);
          setLangState(l);
        }
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
        if (stored[KEYS.profile])                       setProfile(stored[KEYS.profile]);
        if (stored[KEYS.reportMeta])                    setReportMeta(stored[KEYS.reportMeta]);
        if (stored[KEYS.quietHours])                    setQuietHours(stored[KEYS.quietHours]);
        if (stored[KEYS.analytics])                     setAnalytics(stored[KEYS.analytics]);
        if (stored[KEYS.adminMode] !== undefined)       setAdminMode(stored[KEYS.adminMode]);
        if (stored[KEYS.accessibility])                 setAccessibilityState(stored[KEYS.accessibility]);
        if (stored[KEYS.uiPrefs])                       setUiPrefs(stored[KEYS.uiPrefs]);
        if (stored[KEYS.notificationProfile])           setNotificationProfileState(stored[KEYS.notificationProfile]);
        if (stored[KEYS.savedTripTemplates])            setSavedTripTemplates(stored[KEYS.savedTripTemplates]);
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
  useEffect(() => { if (hydrated) save(KEYS.profile,         profile);         }, [profile,         hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.reportMeta,      reportMeta);      }, [reportMeta,      hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.quietHours,      quietHours);      }, [quietHours,      hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.analytics,       analytics);       }, [analytics,       hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.adminMode,       adminMode);       }, [adminMode,       hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.accessibility,   accessibility);   }, [accessibility,   hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.uiPrefs,         uiPrefs);         }, [uiPrefs,         hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.notificationProfile, notificationProfile); }, [notificationProfile, hydrated]);
  useEffect(() => { if (hydrated) save(KEYS.savedTripTemplates,  savedTripTemplates);  }, [savedTripTemplates,  hydrated]);

  const trackEvent = (name, payload = {}) => {
    setAnalytics((prev) => {
      const next = [{ id: `e_${Date.now()}`, name, payload, ts: new Date().toISOString() }, ...prev];
      return next.slice(0, 500);
    });
  };

  const isInQuietHours = (now = new Date()) => {
    if (!quietHours.enabled) return false;
    const h = now.getHours();
    const { start, end } = quietHours;
    if (start === end) return true;
    if (start < end) return h >= start && h < end;
    return h >= start || h < end;
  };

  // ─── Request notification permissions on mount ───────────────────────
  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});
  }, []);

  // ─── Fire threshold alerts whenever crossing data updates ────────────
  useEffect(() => {
    if (!hydrated) return;
    crossings.forEach((c) => {
      if (!favorites.includes(c.id) || !notifSettings[c.id] || c.wait == null) return;
      const threshold = thresholds[c.id] ?? 20;
      const now = Date.now();
      const cooldownKey = c.id;
      const withinCooldown = now - (notifCooldown.current[cooldownKey] ?? 0) < 15 * 60 * 1000;

      // ── HIGH alert: wait exceeds threshold ──
      if (c.wait > threshold && !withinCooldown && !isInQuietHours()) {
        notifCooldown.current[cooldownKey] = now;
        Notifications.scheduleNotificationAsync({
          content: {
            title: t('{flag} {name} – High Wait', { flag: c.flag, name: c.name }),
            body: t('Standard lane is {n} min (your alert is set to {th} min).', { n: c.wait, th: threshold }),
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
        !dropCooled &&
        !isInQuietHours()
      ) {
        notifCooldown.current[dropKey] = now;
        Notifications.scheduleNotificationAsync({
          content: {
            title: t('{flag} {name} – Wait Just Dropped! 🟢', { flag: c.flag, name: c.name }),
            body: t('Now only {n} min — good time to cross!', { n: c.wait }),
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
      const now = Date.now();
      setCrossings((prev) => {
        const updated = prev.map((c) => {
          const cn = normName(c.name);
          const cityBase = normName(c.city.split(',')[0]);
          const isExact = (d) => d.port_name && normName(d.port_name) === cn;
          const isFuzzy = (d) => {
            if (!d.port_name) return false;
            const pn = normName(d.port_name);
            const xn = d.crossing_name ? normName(d.crossing_name) : '';
            return (
              cn.includes(pn) || pn.includes(cn) ||
              cityBase === pn ||
              (xn && (cn.includes(xn) || xn.includes(cn)))
            );
          };
          const match = data.find(isExact) ?? data.find(isFuzzy);
          if (!match) return c;
          const lanes = match.passenger_vehicle_lanes ?? {};
          const std = readLane(lanes.standard_lanes);
          const sentri = readLane(lanes.NEXUS_SENTRI_lanes);
          const ready = readLane(lanes.ready_lanes);
          const ped = readLane(match.pedestrian_lanes?.standard_lanes);
          const pedReady = readLane(match.pedestrian_lanes?.ready_lanes);
          const com = readLane(match.commercial_vehicle_lanes?.standard_lanes);
          const comFast = readLane(match.commercial_vehicle_lanes?.FAST_lanes);
          const wait = std.minutes;
          return {
            ...c,
            live: wait != null,
            updatedAt: now,
            wait,
            sentriWait: sentri.minutes,
            readyWait: ready.minutes,
            laneStatus: std.closed ? 'Lanes closed' : null,
            portStatus: match.port_status ?? null,
            hoursText: match.hours ?? null,
            pedWait: ped.minutes,
            pedReadyWait: pedReady.minutes,
            comWait: com.minutes,
            comFastWait: comFast.minutes,
            trend: wait == null || c.wait == null ? null : wait > c.wait ? 'up' : wait < c.wait ? 'down' : 'stable',
            // Rough estimates from a generic time-of-day curve, not per-crossing history.
            predict1h: estimateWait(wait, 1),
            predict3h: estimateWait(wait, 3),
            sentriPredict1h: estimateWait(sentri.minutes, 1),
            sentriPredict3h: estimateWait(sentri.minutes, 3),
            readyPredict1h: estimateWait(ready.minutes, 1),
            readyPredict3h: estimateWait(ready.minutes, 3),
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

  // ─── Actions ─────────────────────────────────────────────────────────
  const toggleStar = (id) =>
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      trackEvent('toggle_favorite', { crossingId: id, nowFavorite: next.includes(id) });
      return next;
    });

  const addReport = (report) => {
    const now = Date.now();
    const cooldownMs = 10 * 60 * 1000;
    const lastPostTs = reportMeta.lastPostedByCrossing?.[report.crossingId] ?? 0;
    if (now - lastPostTs < cooldownMs) {
      const minsLeft = Math.ceil((cooldownMs - (now - lastPostTs)) / 60000);
      return { ok: false, error: t('Please wait {n} min before posting another report for this crossing.', { n: minsLeft }) };
    }

    const isDuplicate = reports.some((r) =>
      r.crossingId === report.crossingId &&
      r.lane === report.lane &&
      Math.abs((r.wait ?? 0) - (report.wait ?? 0)) <= 5 &&
      (now - new Date(r.ts).getTime()) < 15 * 60 * 1000
    );
    if (isDuplicate) {
      return { ok: false, error: t('A very similar report was just posted. Upvote it instead.') };
    }

    const created = {
      id: `r_${Date.now()}`,
      author: profile.displayName || 'You',
      initials: profile.initials || 'YO',
      avatarColor: BLUE,
      upvotes: 0,
      downvotes: 0,
      flags: 0,
      hidden: false,
      trustScore: report.note?.trim() ? 68 : 60,
      time: 0,
      ts: new Date().toISOString(),
      ...report,
    };

    setReports((prev) => [created, ...prev]);
    setReportMeta((prev) => ({
      ...prev,
      lastPostedByCrossing: {
        ...(prev.lastPostedByCrossing ?? {}),
        [report.crossingId]: now,
      },
    }));
    trackEvent('submit_report', { crossingId: report.crossingId, lane: report.lane, wait: report.wait });
    return { ok: true, id: created.id };
  };

  const vote = (reportId, dir) =>
    setVotes((prev) => {
      const nextVal = prev[reportId] === dir ? null : dir;
      trackEvent('vote_report', { reportId, vote: nextVal });
      return { ...prev, [reportId]: nextVal };
    });

  const setFeedback = (reportId, val) =>
    {
      setFeedbackDone((prev) => ({ ...prev, [reportId]: val }));
      setReports((prev) => prev.map((r) =>
        r.id === reportId
          ? { ...r, trustScore: Math.max(0, Math.min(100, (r.trustScore ?? 60) + (val === 'yes' ? 5 : -8))) }
          : r
      ));
      trackEvent('report_feedback', { reportId, value: val });
    };

  const flagReport = (reportId) => {
    setReports((prev) => prev.map((r) => {
      if (r.id !== reportId) return r;
      const flags = (r.flags ?? 0) + 1;
      return {
        ...r,
        flags,
        hidden: flags >= 3,
        trustScore: Math.max(0, (r.trustScore ?? 60) - 12),
      };
    }));
    trackEvent('flag_report', { reportId });
  };

  const setDisplayName = (displayName) => {
    const clean = displayName.trim().slice(0, 24) || 'You';
    setProfile({ displayName: clean, initials: getInitials(clean) });
    trackEvent('set_display_name', { length: clean.length });
  };

  const toggleNotif = async (id) => {
    const willEnable = !notifSettings[id];
    if (willEnable) {
      const { status } = await Notifications.requestPermissionsAsync().catch(() => ({ status: 'denied' }));
      if (status !== 'granted') return;
    }
    setNotifSettings((prev) => ({ ...prev, [id]: !prev[id] }));
    trackEvent('toggle_alert', { crossingId: id, enabled: willEnable });
  };

  const setThreshold = (id, val) =>
    {
      setThresholds((prev) => ({ ...prev, [id]: val }));
      trackEvent('set_threshold', { crossingId: id, threshold: val });
    };

  const clearTrips = () => setTrips([]);

  /**
   * Begin a passive tracking session.
   * @param {string} crossingId
   * @param {'standard'|'sentri'|'ready'} laneType
   */
  const startTracking = (crossingId, laneType) => {
    trackEvent('start_trip', { crossingId, laneType });
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
        trackEvent('complete_trip', { crossingId: trip.crossingId, laneType: trip.laneType, actualWait: trip.actualWait });

        // ── Data contribution: fire-and-forget POST ───────────────────────
        // Disabled until the backend endpoint exists (see CONTRIBUTE_TRIPS).
        if (CONTRIBUTE_TRIPS) (async () => {
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
                appVersion: '1.3.0',
              }),
            });
          } catch { /* silent — failure never blocks the user */ }
        })();
      }

      return null;
    });
  };

  const restoreReport = (reportId) => {
    setReports((prev) => prev.map((r) =>
      r.id === reportId ? { ...r, hidden: false, flags: Math.max(0, (r.flags ?? 0) - 1), trustScore: Math.max(r.trustScore ?? 60, 45) } : r
    ));
    trackEvent('restore_report', { reportId });
  };

  const clearAnalytics = () => {
    setAnalytics([]);
  };

  const getAnalyticsExport = () => JSON.stringify({
    exportedAt: new Date().toISOString(),
    appVersion: '1.3.0',
    eventCount: analytics.length,
    events: analytics,
  }, null, 2);

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

  const setSimpleMode = (enabled) => {
    setUiPrefs((prev) => ({ ...prev, simpleMode: enabled }));
    trackEvent('set_simple_mode', { enabled });
  };

  const setShowHelpTips = (enabled) => {
    setUiPrefs((prev) => ({ ...prev, showHelpTips: enabled }));
    trackEvent('set_help_tips', { enabled });
  };

  const applyNotificationProfile = (profileName) => {
    const next = profileName === 'calm'
      ? { threshold: 35, quietHours: { enabled: true, start: 21, end: 8 } }
      : profileName === 'always'
        ? { threshold: 12, quietHours: { enabled: false, start: 22, end: 7 } }
        : { threshold: 20, quietHours: { enabled: true, start: 22, end: 7 } };

    setNotificationProfileState(profileName);
    setQuietHours(next.quietHours);
    setThresholds((prev) => {
      const updated = { ...prev };
      crossings.forEach((c) => { updated[c.id] = next.threshold; });
      return updated;
    });
    trackEvent('set_notification_profile', { profile: profileName, threshold: next.threshold });
  };

  const saveTripTemplate = (template) => {
    const created = {
      id: template.id || `tpl_${Date.now()}`,
      name: (template.name || 'Saved Trip').slice(0, 40),
      crossingId: template.crossingId,
      laneType: template.laneType || 'standard',
      threshold: template.threshold ?? 20,
      arrival: template.arrival || '9:00 AM',
      createdAt: new Date().toISOString(),
    };
    setSavedTripTemplates((prev) => [created, ...prev.filter((x) => x.id !== created.id)].slice(0, 20));
    trackEvent('save_trip_template', { crossingId: created.crossingId, laneType: created.laneType });
    return created;
  };

  const deleteTripTemplate = (id) => {
    setSavedTripTemplates((prev) => prev.filter((x) => x.id !== id));
    trackEvent('delete_trip_template', { templateId: id });
  };

  // Needs real per-crossing history, which the app doesn't collect yet.
  const getWeeklyInsight = () => null;

  const setLangPref = (pref) => {
    const l = resolveLanguage(pref);
    setLanguage(l);
    setLangPrefState(pref);
    setLangState(l);
    AsyncStorage.setItem(KEYS.lang, JSON.stringify(pref)).catch(() => {});
  };

  const setAccessibility = (val) => {
    setAccessibilityState(val);
    if (hydrated) AsyncStorage.setItem(KEYS.accessibility, JSON.stringify(val));
  };

  const setFontSizeMultiplier = (mult) => {
    const clamped = Math.max(1.0, Math.min(1.5, mult));
    const updated = { ...accessibility, fontSizeMultiplier: clamped };
    setAccessibility(updated);
  };

  const setHighContrast = (val) => {
    const updated = { ...accessibility, highContrast: val };
    setAccessibility(updated);
  };

  return (
    <AppContext.Provider value={{
      crossings, favorites, reports, trips, dark, haptics,
      notifSettings, thresholds, votes, feedbackDone, onboarded,
      setDark, setHaptics,
      toggleStar, addReport, vote, setFeedback,
      flagReport,
      restoreReport,
      toggleNotif, setThreshold, clearTrips, completeOnboarding,
      activeCrossing, completedTrips,
      startTracking, stopTracking, updateActiveCrossing, clearCompletedTrips,
      lowAlerts, toggleLowAlert,
      checklist, toggleChecklistItem, resetChecklist,
      lastFetchTime, hydrated, fetchCBP: fetch_cbp,
      profile, setDisplayName,
      quietHours, setQuietHours,
      analytics, trackEvent,
      clearAnalytics, getAnalyticsExport,
      adminMode, setAdminMode,
      accessibility, setAccessibility, setFontSizeMultiplier, setHighContrast,
      uiPrefs, setSimpleMode, setShowHelpTips,
      notificationProfile, applyNotificationProfile,
      savedTripTemplates, saveTripTemplate, deleteTripTemplate,
      getWeeklyInsight,
      lang, langPref, setLangPref,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
