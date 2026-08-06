import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myfinance.app',
  appName: 'MyFinance',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    scheme: 'MyFinance',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
