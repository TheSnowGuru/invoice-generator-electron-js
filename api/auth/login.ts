import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getAuthConfigStatus,
  verifyLoginPassword,
} from '../_lib/password';
import { createSessionToken, sessionCookieHeader } from '../_lib/session';
import { readJsonBody } from '../_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
      });
    }

    const { password } = readJsonBody<{ password?: string }>(req);
    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Password is required',
        code: 'MISSING_PASSWORD',
      });
    }

    const config = getAuthConfigStatus();
    if (!config.canAuthenticate) {
      return res.status(503).json({
        error: 'Sign-in is not configured on the server.',
        code: 'AUTH_NOT_CONFIGURED',
        hint: config.hint,
        checks: config.checks,
      });
    }

    const verified = await verifyLoginPassword(password);
    if (!verified.ok) {
      return res.status(401).json({
        error:
          verified.reason === 'kv_mismatch'
            ? 'Incorrect password. (A stored password in Vercel KV may override ACCESS_PASSWORD — update it in Settings → Web access or clear KV.)'
            : 'Incorrect password.',
        code: 'WRONG_PASSWORD',
        passwordSource: verified.passwordSource,
      });
    }

    let token: string;
    try {
      token = createSessionToken();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Session error';
      return res.status(503).json({
        error: 'Could not create a session.',
        code: 'SESSION_SECRET_INVALID',
        hint: message.includes('SESSION_SECRET')
          ? 'Set SESSION_SECRET in Vercel (min 16 characters), redeploy, then try again.'
          : message,
      });
    }

    res.setHeader('Set-Cookie', sessionCookieHeader(token));
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('login handler error', e);
    return res.status(500).json({
      error: 'Sign-in failed due to a server error.',
      code: 'SERVER_ERROR',
      hint:
        e instanceof Error
          ? e.message
          : 'Check Vercel → Project → Logs for this deployment.',
    });
  }
}
