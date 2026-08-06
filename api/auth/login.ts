import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPasswordHashRecord, verifyPassword } from '../_lib/password';
import { createSessionToken, sessionCookieHeader } from '../_lib/session';
import { readJsonBody } from '../_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = readJsonBody<{ password?: string }>(req);
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required' });
  }

  const stored = await getPasswordHashRecord();
  if (!stored) {
    return res.status(503).json({
      error: 'Server access is not configured. Set ACCESS_PASSWORD and SESSION_SECRET in Vercel.',
    });
  }

  const ok = await verifyPassword(password, stored);
  if (!ok) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const token = createSessionToken();
  res.setHeader('Set-Cookie', sessionCookieHeader(token));
  return res.status(200).json({ ok: true });
}
