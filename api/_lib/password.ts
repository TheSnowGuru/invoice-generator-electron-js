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

async function kvGet(): Promise<string | null> {
  try {
    const { kv } = await import('@vercel/kv');
    return (await kv.get<string>(KV_KEY)) ?? null;
  } catch {
    return null;
  }
}

async function kvSet(hash: string): Promise<boolean> {
  try {
    const { kv } = await import('@vercel/kv');
    await kv.set(KV_KEY, hash);
    return true;
  } catch {
    return false;
  }
}

let envPasswordHash: string | null = null;

async function envFallbackHash(): Promise<string | null> {
  if (envPasswordHash) return envPasswordHash;
  const plain = process.env.ACCESS_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!plain || !secret) return null;
  const salt = (await import('node:crypto')).createHash('sha256').update(secret).digest().subarray(0, 16);
  envPasswordHash = await hashPassword(plain, salt);
  return envPasswordHash;
}

/** Load hash from KV, or derive from ACCESS_PASSWORD + SESSION_SECRET when KV is not linked. */
export async function getPasswordHashRecord(): Promise<string | null> {
  const fromKv = await kvGet();
  if (fromKv) return fromKv;
  return envFallbackHash();
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
