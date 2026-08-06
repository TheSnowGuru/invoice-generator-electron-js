import { FormEvent, ReactNode, useState } from 'react';
import { isPwaUnlocked, tryPwaUnlock } from '../lib/pwa-auth';

type Props = {
  children: ReactNode;
};

export function PwaAuthGate({ children }: Props) {
  const [unlocked, setUnlocked] = useState(isPwaUnlocked);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const ok = await tryPwaUnlock(password);
      if (ok) {
        setUnlocked(true);
        setPassword('');
      } else {
        setError('Incorrect password.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="pwa-auth-screen">
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
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}
