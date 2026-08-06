import { Capacitor } from '@capacitor/core';

export function isPwaInstallAvailable(): boolean {
  if (Capacitor.isNativePlatform()) return false;
  return import.meta.env.VITE_PWA === 'true';
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function isAndroidDevice(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

export function isInstalledPwa(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function isBeforeInstallPromptEvent(e: Event): e is BeforeInstallPromptEvent {
  return 'prompt' in e && typeof (e as BeforeInstallPromptEvent).prompt === 'function';
}
