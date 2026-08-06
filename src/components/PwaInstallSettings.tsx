import { FormEvent, useEffect, useState } from 'react';
import {
  type BeforeInstallPromptEvent,
  isAndroidDevice,
  isBeforeInstallPromptEvent,
  isInstalledPwa,
  isIosDevice,
} from '../lib/pwa-install';

type Props = {
  onToast?: (message: string) => void;
};

export function PwaInstallSettings({ onToast }: Props) {
  const [installed, setInstalled] = useState(isInstalledPwa);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    setInstalled(isInstalledPwa());

    const onInstallable = (e: Event) => {
      if (!isBeforeInstallPromptEvent(e)) return;
      e.preventDefault();
      setInstallEvent(e);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onInstallable);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function onAndroidInstall(e: FormEvent) {
    e.preventDefault();
    if (!installEvent) return;
    setBusy(true);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
      setInstalled(isInstalledPwa());
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      onToast?.('Link copied');
    } catch {
      // ignore
    }
  }

  if (installed) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>Install app</h3>
        </div>
        <p className="pwa-install-lead">
          <strong>MyFinance is installed.</strong> You opened it from your Home Screen or as an
          installed app.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Install app on iPad / phone</h3>
        <p className="subtitle" style={{ margin: 0 }}>
          Add MyFinance to your Home Screen for a full-screen app (no browser bar).
        </p>
      </div>

      {isIosDevice() ? (
        <ol className="pwa-install-steps">
          <li>
            Use <strong>Safari</strong> — Chrome on iOS cannot install home-screen apps the same way.
          </li>
          <li>
            Tap the <strong>Share</strong> button{' '}
            <span className="pwa-install-icon" aria-hidden>
              ⎋
            </span>{' '}
            at the top or bottom of the screen.
          </li>
          <li>
            Scroll the share sheet and tap <strong>Add to Home Screen</strong>{' '}
            <span className="pwa-install-icon" aria-hidden>
              ＋
            </span>
            .
          </li>
          <li>
            Confirm the name <strong>MyFinance</strong>, then tap <strong>Add</strong>.
          </li>
          <li>Open MyFinance from your Home Screen like any other app.</li>
        </ol>
      ) : isAndroidDevice() && installEvent ? (
        <form onSubmit={onAndroidInstall}>
          <p className="pwa-install-lead">Your browser supports installing this app directly.</p>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Installing…' : 'Install MyFinance'}
          </button>
        </form>
      ) : (
        <ol className="pwa-install-steps">
          <li>Open this page in your mobile browser.</li>
          <li>Use the browser menu to <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</li>
          <li>On iPad, use Safari and Share → Add to Home Screen.</li>
        </ol>
      )}

      <div className="pwa-install-url">
        <label className="field">
          <span>App link (bookmark or open on another device)</span>
          <div className="pwa-install-url-row">
            <input readOnly value={appUrl} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-sm" onClick={() => void copyUrl()}>
              Copy
            </button>
          </div>
        </label>
      </div>

      <p className="pwa-install-note">
        Apple does not allow websites to add the icon for you — these steps are required once per
        device.
      </p>
    </div>
  );
}
