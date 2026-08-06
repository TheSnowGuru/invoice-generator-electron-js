import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearSessionCookieHeader } from '../_lib/session';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  if (_req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Set-Cookie', clearSessionCookieHeader());
  return res.status(200).json({ ok: true });
}
