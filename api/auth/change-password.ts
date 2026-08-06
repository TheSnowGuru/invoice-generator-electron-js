import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getPasswordHashRecord,
  hashPassword,
  updatePasswordHash,
  verifyPassword,
} from '../_lib/password';
import { COOKIE_NAME, verifySessionToken } from '../_lib/session';
import { getCookie, readJsonBody } from '../_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getCookie(req, COOKIE_NAME);
  if (!verifySessionToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { currentPassword, newPassword } = readJsonBody<{
    currentPassword?: string;
    newPassword?: string;
  }>(req);

  if (!currentPassword || !newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const stored = await getPasswordHashRecord();
  if (!stored) {
    return res.status(503).json({ error: 'Password storage is not configured' });
  }

  const ok = await verifyPassword(currentPassword, stored);
  if (!ok) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const nextHash = await hashPassword(newPassword);
  const updated = await updatePasswordHash(nextHash);
  if (!updated.ok) {
    return res.status(503).json({ error: updated.error });
  }

  return res.status(200).json({ ok: true });
}
