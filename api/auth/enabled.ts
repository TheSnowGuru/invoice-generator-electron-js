import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Public: tells the SPA that server-side auth is available (no secrets). */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    if (_req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return res.status(200).json({ enabled: true });
  } catch (e) {
    console.error('enabled handler error', e);
    return res.status(500).json({
      enabled: false,
      error: 'Server error',
      hint: e instanceof Error ? e.message : undefined,
    });
  }
}
