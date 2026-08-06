import { FormEvent, useState } from 'react';
import { changePassword, logout } from '../lib/hosted-auth';

type Props = {
  onToast: (message: string) => void;
};

export function HostedAccessSettings({ onToast }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      onToast('New passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.ok) {
        onToast('Access password updated');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        onToast(result.error || 'Could not change password');
      }
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await logout();
    window.location.href = '/login.html';
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Web access</h3>
        <p className="subtitle" style={{ margin: 0 }}>
          Password is verified on the server (Vercel). It is never stored in the app bundle.
        </p>
      </div>
      <form className="form-grid" onSubmit={onSubmit}>
        <div className="field full">
          <label>Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div className="field">
          <label>New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <div className="field">
          <label>Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <div className="field full" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Updating…' : 'Update access password'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void signOut()}>
            Sign out everywhere
          </button>
        </div>
      </form>
    </div>
  );
}
