/** Client helpers for Vercel-hosted auth (no secrets in the browser bundle). */

export type LoginErrorDetails = {
  ok: false;
  error: string;
  code?: string;
  hint?: string;
  checks?: Record<string, boolean>;
  passwordSource?: string;
  httpStatus?: number;
};

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

export async function fetchAuthStatus(): Promise<{
  ok: boolean;
  hint?: string;
  checks?: Record<string, boolean>;
}> {
  try {
    const res = await fetch('/api/auth/status', { credentials: 'include' });
    const data = (await res.json()) as {
      ok?: boolean;
      hint?: string;
      checks?: Record<string, boolean>;
    };
    return { ok: Boolean(data.ok), hint: data.hint, checks: data.checks };
  } catch {
    return { ok: false, hint: 'Could not reach /api/auth/status (network or server error).' };
  }
}

export async function fetchSession(): Promise<boolean> {
  const res = await fetch('/api/auth/session', { credentials: 'include' });
  return res.ok;
}

function formatLoginError(data: Record<string, unknown>, httpStatus: number): string {
  const parts: string[] = [];
  if (typeof data.error === 'string') parts.push(data.error);
  if (typeof data.code === 'string') parts.push(`[${data.code}]`);
  if (typeof data.hint === 'string') parts.push(data.hint);
  if (data.checks && typeof data.checks === 'object') {
    const checks = data.checks as Record<string, boolean>;
    const bad = Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (bad.length) parts.push(`Missing/failed: ${bad.join(', ')}`);
  }
  if (httpStatus >= 500) parts.push(`(HTTP ${httpStatus})`);
  return parts.join(' ') || `Sign-in failed (HTTP ${httpStatus}).`;
}

export async function login(
  password: string
): Promise<{ ok: true } | LoginErrorDetails> {
  let res: Response;
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  } catch {
    return {
      ok: false,
      error: 'Network error — could not reach the server.',
      code: 'NETWORK_ERROR',
      hint: 'Check your connection and that the Vercel deployment is live.',
    };
  }

  if (res.ok) return { ok: true };

  let data: Record<string, unknown> = {};
  const text = await res.text();
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: text.includes('FUNCTION_INVOCATION_FAILED')
        ? 'Server function crashed (often missing SESSION_SECRET or @vercel/node).'
        : text.slice(0, 200) || 'Sign-in failed.',
      code: 'INVALID_RESPONSE',
      httpStatus: res.status,
      hint: 'Open /api/auth/status in the browser or check Vercel → Logs.',
    };
  }

  return {
    ok: false,
    error: formatLoginError(data, res.status),
    code: typeof data.code === 'string' ? data.code : undefined,
    hint: typeof data.hint === 'string' ? data.hint : undefined,
    checks: data.checks as Record<string, boolean> | undefined,
    passwordSource: typeof data.passwordSource === 'string' ? data.passwordSource : undefined,
    httpStatus: res.status,
  };
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
  const data = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
  return { ok: false, error: [data.error, data.hint].filter(Boolean).join(' ') || 'Could not change password.' };
}
