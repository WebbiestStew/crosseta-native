// Client for the CrossETA server (see /server). Everything here is optional: with no server URL
// configured, `api.available` is false and the app runs entirely on-device.
//
// Configure with EXPO_PUBLIC_API_URL when starting Metro, or expo.extra.apiUrl in app.json.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const raw = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || '';
export const API_URL = String(raw).replace(/\/+$/, '') || null;

const TOKEN_KEY = '@crosseta/apiToken';
let tokenPromise = null;

const register = async () => {
  const res = await fetch(`${API_URL}/v1/register`, { method: 'POST' });
  if (!res.ok) throw new Error(`register failed (${res.status})`);
  const { token } = await res.json();
  await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
  return token;
};

/** The device's anonymous credential, created on first use and kept in AsyncStorage. */
const getToken = () => {
  tokenPromise ??= AsyncStorage.getItem(TOKEN_KEY).then((t) => t || register()).catch((e) => { tokenPromise = null; throw e; });
  return tokenPromise;
};

export const forgetToken = async () => {
  tokenPromise = null;
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
};

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const request = async (method, path, { body, auth = true, timeoutMs = 10000, retried = false } = {}) => {
  if (!API_URL) throw new ApiError(0, 'No server configured');
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = `Bearer ${await getToken()}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && auth && !retried) {
      // The server forgot this device (e.g. its database was reset): register again once.
      await forgetToken();
      return request(method, path, { body, auth, timeoutMs, retried: true });
    }
    if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, e.name === 'AbortError' ? 'Request timed out' : 'Network error');
  } finally {
    clearTimeout(timer);
  }
};

export const api = {
  available: !!API_URL,
  history: (ids) => request('GET', `/v1/history?ids=${encodeURIComponent(ids.join(','))}`, { auth: false }),
  community: () => request('GET', '/v1/community', { auth: false }),
  reports: (crossingId) => request('GET', `/v1/reports${crossingId ? `?crossingId=${encodeURIComponent(crossingId)}` : ''}`),
  postReport: (report) => request('POST', '/v1/reports', { body: report }),
  vote: (id, value) => request('POST', `/v1/reports/${encodeURIComponent(id)}/vote`, { body: { value } }),
  flag: (id) => request('POST', `/v1/reports/${encodeURIComponent(id)}/flag`),
  postTrip: (trip) => request('POST', '/v1/trips', { body: trip }),
  putAlerts: (payload) => request('PUT', '/v1/alerts', { body: payload }),
  deleteAlerts: () => request('DELETE', '/v1/alerts'),
  deleteMe: async () => { await request('DELETE', '/v1/me'); await forgetToken(); },
};
