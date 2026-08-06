import { FormEvent, useEffect, useState } from 'react';
import {
  type BeforeInstallPromptEvent,
  isAndroidDevice,
  isBeforeInstallPromptEvent,
  isInstalledPwa,
  isIosDevice,
} from '../lib/pwa-install';

type Props = {
  variant?: 'login' | 'panel';
  onToast?: (message: string) => void;
};

export function PwaInstallPrompt({ variant = 'panel', onToast }: Props) {
  const [installed, setInstalled] = useState(isInstalledPwa);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(variant === 'login');
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const compact = variant === 'login';

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
    if (compact) return null;
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>Install app</h3>
        </div>
        <p className="pwa-install-lead">
          <strong>MyFinance is installed.</strong> You opened it from your Home Screen.
        </p>
      </div>
    );
  }

  const steps = isIosDevice() ? (
    <ol className="pwa-install-steps">
      <li>
        Use <strong>Safari</strong> (required on iPad/iPhone).
      </li>
      <li>
        Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> → <strong>Add</strong>.
      </li>
      <li>Open <strong>MyFinance</strong> from your Home Screen.</li>
    </ol>
  ) : isAndroidDevice() && installEvent ? (
    <form onSubmit={onAndroidInstall}>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Installing…' : 'Install MyFinance'}
      </button>
    </form>
  ) : (
    <ol className="pwa-install-steps">
      <li>On iPad: Safari → Share → Add to Home Screen.</li>
      <li>On Android: use the browser’s Install app option when offered.</li>
    </ol>
  );

  const body = (
    <>
      {!compact && (
        <p className="pwa-install-lead">
          Add MyFinance to your Home Screen for a full-screen app (no browser bar).
        </p>
      )}
      {steps}
      {!compact && (
        <>
          <div className="pwa-install-url">
            <label className="field">
              <span>App link</span>
              <div className="pwa-install-url-row">
                <input readOnly value={appUrl} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn btn-sm" onClick={() => void copyUrl()}>
                  Copy
                </button>
              </div>
            </label>
          </div>
          <p className="pwa-install-note">
            Apple does not allow websites to add the icon automatically — use the steps above once
            per device.
          </p>
        </>
      )}
    </>
  );

  if (compact) {
    return (
      <div className="pwa-install-login">
        <button
          type="button"
          className="pwa-install-login-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? 'Hide' : 'Install app on iPad / phone'}
        </button>
        {open ? <div className="pwa-install-login-body">{body}</div> : null}
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Install app on iPad / phone</h3>
      </div>
      {body}
    </div>
  );
}
