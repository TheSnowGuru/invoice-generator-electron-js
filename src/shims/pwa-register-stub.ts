/** No-op when vite-plugin-pwa is not loaded (Electron / Capacitor dev). */
export function registerSW(_options?: {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}) {
  return async (_reloadPage?: boolean) => {};
}
