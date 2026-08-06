import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { PwaAuthGate } from './components/PwaAuthGate';
import { isPwaAuthRequired } from './lib/pwa-auth';
import './styles.css';

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('capacitor-native');
}

if (import.meta.env.VITE_PWA === 'true') {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}

const app = (
  <HashRouter>
    <App />
  </HashRouter>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPwaAuthRequired() ? <PwaAuthGate>{app}</PwaAuthGate> : app}
  </React.StrictMode>
);
