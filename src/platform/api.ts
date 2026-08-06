import { Capacitor } from '@capacitor/core';
import type { MyFinanceApi } from './myfinance-api';
import { createCapacitorApi } from './capacitor-api';

let cached: MyFinanceApi | null = null;

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getMyFinanceApi(): MyFinanceApi {
  if (cached) return cached;

  if (Capacitor.isNativePlatform()) {
    cached = createCapacitorApi();
    return cached;
  }

  if (typeof window !== 'undefined' && window.flowstate) {
    cached = window.flowstate as MyFinanceApi;
    return cached;
  }

  throw new Error('MyFinance API is not available in this environment.');
}
