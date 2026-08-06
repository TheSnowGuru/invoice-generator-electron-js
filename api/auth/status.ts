import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthConfigStatus } from '../_lib/password';

/** Public diagnostics (no secrets). Use when login fails. */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    if (_req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    }
    const status = getAuthConfigStatus();
    return res.status(200).json({
      ok: status.canAuthenticate,
      ...status,
    });
  } catch (e) {
    console.error('status handler error', e);
    return res.status(500).json({
      ok: false,
      error: 'Could not read auth status',
      code: 'SERVER_ERROR',
      hint: e instanceof Error ? e.message : undefined,
    });
  }
}
