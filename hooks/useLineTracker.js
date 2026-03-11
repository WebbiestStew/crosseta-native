import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useApp } from '../context/AppContext';

/** Distance (metres) the user must travel from start before auto-completion triggers. */
const COMPLETION_DISTANCE_M = 200;
/** Speed threshold (m/s) — 15 km/h — indicating the user has cleared the port. */
const COMPLETION_SPEED_MS = 15 / 3.6;

/**
 * Compute the great-circle distance between two GPS coordinates (Haversine formula).
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in metres.
 */
function haversineMetres(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Derives the queue status from metres moved.
 * @param {number} metres
 * @returns {'queued'|'moving'|'clearing'|'done'}
 */
function statusFromDistance(metres) {
  if (metres >= 150) return 'clearing';
  if (metres >= 50)  return 'moving';
  return 'queued';
}

/**
 * Drive the active line-tracking session.
 *
 * Mount this hook inside InLineScreen (or any component rendered while tracking
 * is active). The elapsed timer is computed from activeCrossing.startTime so
 * it survives screen unmount/remount — navigation away and back always shows
 * the correct total elapsed time.
 *
 * GPS runs only while the hook is mounted (foreground-only, privacy-safe).
 *
 * @returns {{
 *   isTracking: boolean,
 *   currentWait: number,       // seconds elapsed since startTime
 *   status: 'queued'|'moving'|'clearing'|'done',
 *   distanceMoved: number,     // metres from entry coords
 *   stopTracking: (cancelled?: boolean) => Promise<void>,
 * }}
 */
export function useLineTracker() {
  const { activeCrossing, stopTracking: ctxStop, updateActiveCrossing, crossings } = useApp();

  const [currentWait, setCurrentWait] = useState(0);
  const [status, setStatus]           = useState('queued');
  const [distanceMoved, setDistanceMoved] = useState(0);

  // Stable refs so location callback never reads stale closure values
  const startCoordsRef    = useRef(activeCrossing?.startCoords ?? null);
  const activeCrossingRef = useRef(activeCrossing);
  const crossingRef       = useRef(null);
  const locationSubRef    = useRef(null);
  const autoCompletedRef  = useRef(false);

  const isTracking = activeCrossing !== null;

  // Keep refs fresh on each render
  useEffect(() => {
    activeCrossingRef.current = activeCrossing;
    // If context already has a start coord (restored from AsyncStorage), sync it
    if (activeCrossing?.startCoords && !startCoordsRef.current) {
      startCoordsRef.current = activeCrossing.startCoords;
    }
    crossingRef.current = crossings.find((c) => c.id === activeCrossing?.crossingId) ?? null;
  });

  // ─── Elapsed-time timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isTracking) {
      setCurrentWait(0);
      setStatus('queued');
      setDistanceMoved(0);
      autoCompletedRef.current = false;
      return;
    }
    const startTime = activeCrossing.startTime;
    // Immediately sync to avoid a 1-second blank
    setCurrentWait(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    const interval = setInterval(() => {
      setCurrentWait(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTracking, activeCrossing?.startTime]);

  // ─── GPS subscription ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isTracking) {
      locationSubRef.current?.remove();
      locationSubRef.current = null;
      return;
    }

    autoCompletedRef.current = false;
    startCoordsRef.current = activeCrossing?.startCoords ?? null;

    let cancelled = false;

    (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'denied' }));
      if (perm !== 'granted' || cancelled) return;

      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10_000,   // ms between updates
          distanceInterval: 10,   // metres between updates (whichever fires first)
        },
        (loc) => {
          const { latitude, longitude, speed } = loc.coords;

          // ── Establish start coords on first GPS fix ──
          if (!startCoordsRef.current) {
            startCoordsRef.current = { latitude, longitude };
            updateActiveCrossing({
              startCoords: { latitude, longitude },
              lastCoords:  { latitude, longitude },
            });
          } else {
            updateActiveCrossing({ lastCoords: { latitude, longitude } });
          }

          // ── Distance & status ──
          const dist = haversineMetres(
            startCoordsRef.current.latitude,
            startCoordsRef.current.longitude,
            latitude,
            longitude,
          );
          setDistanceMoved(dist);
          const newStatus = statusFromDistance(dist);
          setStatus(newStatus);
          updateActiveCrossing({ status: newStatus });

          // ── Auto-completion detection ──
          const spd = speed ?? 0; // speed can be null on some devices
          if (
            !autoCompletedRef.current &&
            dist >= COMPLETION_DISTANCE_M &&
            spd >= COMPLETION_SPEED_MS
          ) {
            autoCompletedRef.current = true;
            handleAutoComplete({ latitude, longitude });
          }
        },
      );
    })();

    return () => {
      cancelled = true;
      locationSubRef.current?.remove();
      locationSubRef.current = null;
    };
  // Only re-run when tracking starts/stops, not on every activeCrossing update
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking]);

  // ─── Auto-completion (called from inside location callback via stable ref) ─
  /**
   * @param {{ latitude: number, longitude: number }} exitCoords
   */
  const handleAutoComplete = useCallback(async (exitCoords) => {
    const ac = activeCrossingRef.current;
    const crossing = crossingRef.current;
    if (!ac) return;

    const endTime = Date.now();
    ctxStop({ endTime, exitCoords, cancelled: false });

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    if (crossing) {
      const minutes = Math.max(1, Math.round((endTime - ac.startTime) / 60_000));
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${crossing.flag} Crossing Complete! 🎉`,
          body: `You cleared ${crossing.name} in ${minutes} min.`,
          data: { crossingId: crossing.id },
        },
        trigger: null,
      }).catch(() => {});
    }
  }, [ctxStop]);

  /**
   * Manually stop tracking.
   * @param {boolean} [cancelled=false] — true = discard session, false = save trip.
   */
  const stopTracking = useCallback(async (cancelled = false) => {
    const ac = activeCrossingRef.current;
    const crossing = crossingRef.current;

    if (cancelled) {
      ctxStop({ cancelled: true });
      return;
    }

    const endTime = Date.now();
    ctxStop({ endTime, cancelled: false });

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    if (crossing && ac) {
      const minutes = Math.max(1, Math.round((endTime - ac.startTime) / 60_000));
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${crossing.flag} Crossing Complete! 🎉`,
          body: `You cleared ${crossing.name} in ${minutes} min.`,
          data: { crossingId: crossing.id },
        },
        trigger: null,
      }).catch(() => {});
    }
  }, [ctxStop]);

  return { isTracking, currentWait, status, distanceMoved, stopTracking };
}
