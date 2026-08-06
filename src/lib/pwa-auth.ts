const SESSION_KEY = 'myfinance-pwa-session';

export function isPwaAuthRequired(): boolean {
  return (
    import.meta.env.VITE_PWA === 'true' &&
    Boolean(import.meta.env.VITE_PWA_PASSWORD_HASH)
  );
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isPwaUnlocked(): boolean {
  if (!isPwaAuthRequired()) return true;
  return sessionStorage.getItem(SESSION_KEY) === import.meta.env.VITE_PWA_PASSWORD_HASH;
}

export async function tryPwaUnlock(password: string): Promise<boolean> {
  const hash = await hashPassword(password);
  const expected = import.meta.env.VITE_PWA_PASSWORD_HASH;
  if (!expected || hash !== expected) return false;
  sessionStorage.setItem(SESSION_KEY, hash);
  return true;
}
