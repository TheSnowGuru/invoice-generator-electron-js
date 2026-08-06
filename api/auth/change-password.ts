import { hashPassword, updatePasswordHash, verifyLoginPassword } from '../_lib/password';
import { COOKIE_NAME, verifySessionToken } from '../_lib/session';
import { getCookie, jsonResponse, readJsonBody } from '../_lib/http';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
  }

  const token = getCookie(request, COOKIE_NAME);
  if (!verifySessionToken(token)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const { currentPassword, newPassword } = await readJsonBody<{
    currentPassword?: string;
    newPassword?: string;
  }>(request);

  if (!currentPassword || !newPassword || typeof newPassword !== 'string') {
    return jsonResponse({ error: 'Current and new password are required' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return jsonResponse({ error: 'New password must be at least 6 characters' }, { status: 400 });
  }

  const verified = await verifyLoginPassword(currentPassword);
  if (!verified.ok) {
    return jsonResponse({ error: 'Current password is incorrect', code: 'WRONG_PASSWORD' }, { status: 401 });
  }

  const nextHash = await hashPassword(newPassword);
  const updated = await updatePasswordHash(nextHash);
  if (!updated.ok) {
    return jsonResponse({ error: updated.error }, { status: 503 });
  }

  return jsonResponse({ ok: true });
}
