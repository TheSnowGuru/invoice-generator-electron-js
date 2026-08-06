import type { VercelRequest, VercelResponse } from '@vercel/node';
import { COOKIE_NAME, verifySessionToken } from '../_lib/session';
import { getCookie } from '../_lib/http';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const token = getCookie(req, COOKIE_NAME);
  if (!verifySessionToken(token)) {
    return res.status(401).json({ authenticated: false });
  }
  return res.status(200).json({ authenticated: true });
}
