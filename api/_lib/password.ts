import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KV_KEY = 'auth:password_hash';

export async function hashPassword(password: string, salt?: Buffer): Promise<string> {
  const s = salt ?? randomBytes(16);
  const derived = (await scryptAsync(password, s, 64)) as Buffer;
  return `scrypt:${s.toString('base64url')}:${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts[0] !== 'scrypt' || parts.length !== 3) return false;
  const salt = Buffer.from(parts[1], 'base64url');
  const expected = Buffer.from(parts[2], 'base64url');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function hasKvEnv(): boolean {
  return Boolean(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
      (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

async function kvGet(): Promise<string | null> {
  if (!hasKvEnv()) return null;
  try {
    const { kv } = await import('@vercel/kv');
    return (await kv.get<string>(KV_KEY)) ?? null;
  } catch (e) {
    console.error('KV read failed', e);
    return null;
  }
}

async function kvSet(hash: string): Promise<boolean> {
  if (!hasKvEnv()) return false;
  try {
    const { kv } = await import('@vercel/kv');
    await kv.set(KV_KEY, hash);
    return true;
  } catch (e) {
    console.error('KV write failed', e);
    return false;
  }
}

let envPasswordHash: string | null = null;

export function getAuthConfigStatus(): {
  canAuthenticate: boolean;
  checks: {
    accessPassword: boolean;
    sessionSecret: boolean;
    sessionSecretLengthOk: boolean;
    kvLinked: boolean;
  };
  hint: string;
} {
  const accessPassword = Boolean(process.env.ACCESS_PASSWORD);
  const sessionSecret = Boolean(process.env.SESSION_SECRET);
  const sessionSecretLengthOk = Boolean(
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
  );
  const kvLinked = hasKvEnv();

  let hint = '';
  if (!accessPassword && !kvLinked) {
    hint = 'Add ACCESS_PASSWORD in Vercel → Settings → Environment Variables, then redeploy.';
  } else if (!sessionSecretLengthOk) {
    hint =
      'Add SESSION_SECRET (random string, at least 16 characters) in Vercel, then redeploy.';
  } else if (kvLinked) {
    hint =
      'KV is linked: login uses the password hash in KV if present, otherwise ACCESS_PASSWORD.';
  } else {
    hint = 'Using ACCESS_PASSWORD from environment variables.';
  }

  return {
    canAuthenticate: (accessPassword || kvLinked) && sessionSecretLengthOk,
    checks: {
      accessPassword,
      sessionSecret,
      sessionSecretLengthOk,
      kvLinked,
    },
    hint,
  };
}

async function envFallbackHash(): Promise<string | null> {
  if (envPasswordHash) return envPasswordHash;
  const plain = process.env.ACCESS_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!plain || !secret || secret.length < 16) return null;
  const salt = (await import('node:crypto'))
    .createHash('sha256')
    .update(secret)
    .digest()
    .subarray(0, 16);
  envPasswordHash = await hashPassword(plain, salt);
  return envPasswordHash;
}

/** Load hash from KV, or derive from ACCESS_PASSWORD + SESSION_SECRET when KV is not linked. */
export async function getPasswordHashRecord(): Promise<string | null> {
  const fromKv = await kvGet();
  if (fromKv) return fromKv;
  return envFallbackHash();
}

export async function verifyLoginPassword(password: string): Promise<{
  ok: boolean;
  reason?: 'wrong_password' | 'kv_mismatch';
  passwordSource?: 'kv' | 'env' | 'both';
}> {
  const kvHash = await kvGet();
  const envHash = await envFallbackHash();

  if (kvHash && (await verifyPassword(password, kvHash))) {
    return { ok: true, passwordSource: envHash ? 'both' : 'kv' };
  }
  if (envHash && (await verifyPassword(password, envHash))) {
    return { ok: true, passwordSource: 'env' };
  }
  if (kvHash && envHash) {
    return { ok: false, reason: 'kv_mismatch' };
  }
  return { ok: false, reason: 'wrong_password' };
}

export async function updatePasswordHash(newHash: string): Promise<{ ok: boolean; error?: string }> {
  const stored = await kvSet(newHash);
  if (!stored) {
    return {
      ok: false,
      error:
        'Password storage is not configured. Link a Vercel KV database to this project (Storage → KV).',
    };
  }
  return { ok: true };
}
