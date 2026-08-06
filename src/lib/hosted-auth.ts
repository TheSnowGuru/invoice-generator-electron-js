/** Client helpers for Vercel-hosted auth (no secrets in the browser bundle). */

let hostedAuthDetected: boolean | null = null;

export function isHostedAuth(): boolean {
  if (import.meta.env.VITE_HOSTED_AUTH === 'true') return true;
  if (hostedAuthDetected === true) return true;
  return false;
}

/** Detect hosted auth API (Vercel). Caches result for the session. */
export async function detectHostedAuth(): Promise<boolean> {
  if (import.meta.env.VITE_HOSTED_AUTH === 'true') {
    hostedAuthDetected = true;
    return true;
  }
  if (hostedAuthDetected !== null) return hostedAuthDetected;

  try {
    const res = await fetch('/api/auth/enabled', { credentials: 'include' });
    if (res.ok) {
      const data = (await res.json()) as { enabled?: boolean };
      hostedAuthDetected = Boolean(data.enabled);
      return hostedAuthDetected;
    }
  } catch {
    // Not on Vercel / no API
  }
  hostedAuthDetected = false;
  return false;
}

export async function fetchSession(): Promise<boolean> {
  const res = await fetch('/api/auth/session', { credentials: 'include' });
  return res.ok;
}

export async function login(password: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, error: data.error || 'Incorrect password.' };
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, error: data.error || 'Could not change password.' };
}
