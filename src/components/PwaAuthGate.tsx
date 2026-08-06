import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { fetchSession, detectHostedAuth, login } from '../lib/hosted-auth';
import { isPwaInstallAvailable } from '../lib/pwa-install';
import { PwaInstallPrompt } from './PwaInstallPrompt';

type Props = {
  children: ReactNode;
};

/** Fallback gate when middleware allows the SPA shell (e.g. local preview). */
export function PwaAuthGate({ children }: Props) {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const hosted = await detectHostedAuth();
      if (cancelled) return;
      if (!hosted) {
        setAuthed(true);
        setChecked(true);
        return;
      }
      const ok = await fetchSession();
      if (!cancelled) {
        setAuthed(ok);
        setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await login(password);
      if (result.ok) {
        setAuthed(true);
        setPassword('');
      } else {
        setError(result.error || 'Incorrect password.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!checked) {
    return (
      <div className="pwa-auth-screen">
        <p className="pwa-auth-lead">Checking session…</p>
      </div>
    );
  }

  if (authed) return <>{children}</>;

  return (
    <div className="pwa-auth-screen">
      <div className="pwa-auth-layout">
        <div className="pwa-auth-card">
          <div className="brand-mark" style={{ margin: '0 auto 16px' }}>
            MF
          </div>
          <h1>MyFinance</h1>
          <p className="pwa-auth-lead">Enter the access password to continue.</p>
          <form onSubmit={onSubmit} className="pwa-auth-form">
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
                required
              />
            </label>
            {error ? <p className="pwa-auth-error">{error}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
        {isPwaInstallAvailable() ? <PwaInstallPrompt variant="login" /> : null}
      </div>
    </div>
  );
}
