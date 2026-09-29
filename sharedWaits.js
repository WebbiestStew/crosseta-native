// Publishes the user's starred crossings to the iOS home-screen widget (see ios/CrossETAWidget).
// A no-op on Android and in builds that do not include the SharedWaits native module.
import { NativeModules, Platform } from 'react-native';
import { API_URL } from './api';

const native = Platform.OS === 'ios' ? NativeModules.SharedWaits : null;

export const pushWidgetSnapshot = ({ favorites, crossings, lane, lang }) => {
  if (!native) return;
  const items = favorites
    .map((id) => crossings.find((c) => c.id === id))
    .filter(Boolean)
    .slice(0, 6)
    .map((c) => ({
      id: c.id,
      name: c.name,
      flag: c.flag,
      wait: c.wait ?? null,
      sentri: c.sentriWait ?? null,
      ready: c.readyWait ?? null,
      updatedAt: c.cbpUpdatedAt ?? c.updatedAt ?? null,
    }));
  try {
    native.save(JSON.stringify({ savedAt: Date.now(), lane, lang, apiUrl: API_URL, items }));
  } catch { /* the widget is optional; never let it affect the app */ }
};
