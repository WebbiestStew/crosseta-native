// On-device persistence for the wait history; the logic lives in historyCore.js.
import AsyncStorage from '@react-native-async-storage/async-storage';

export * from './historyCore.mjs';

export const HISTORY_KEY = '@crosseta/waitHistory_v1';

export const loadHistory = async () => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const saveHistory = (history) =>
  AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history)).catch(() => {});
