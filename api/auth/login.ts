import { getAuthConfigStatus, verifyLoginPassword } from '../_lib/password';
import { createSessionToken, sessionCookieHeader } from '../_lib/session';
import { jsonResponse, readJsonBody } from '../_lib/http';

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, {
        status: 405,
        headers: { Allow: 'POST' },
      });
    }

    const { password } = await readJsonBody<{ password?: string }>(request);
    if (!password || typeof password !== 'string') {
      return jsonResponse({ error: 'Password is required', code: 'MISSING_PASSWORD' }, { status: 400 });
    }

    const config = getAuthConfigStatus();
    if (!config.canAuthenticate) {
      return jsonResponse({
        error: 'Sign-in is not configured on the server.',
        code: 'AUTH_NOT_CONFIGURED',
        hint: config.hint,
        checks: config.checks,
      }, { status: 503 });
    }

    const verified = await verifyLoginPassword(password);
    if (!verified.ok) {
      return jsonResponse({
        error:
          verified.reason === 'kv_mismatch'
            ? 'Incorrect password. (A stored password in Vercel KV may override ACCESS_PASSWORD — update it in Settings → Web access or clear KV.)'
            : 'Incorrect password.',
        code: 'WRONG_PASSWORD',
        passwordSource: verified.passwordSource,
      }, { status: 401 });
    }

    let token: string;
    try {
      token = createSessionToken();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Session error';
      return jsonResponse({
        error: 'Could not create a session.',
        code: 'SESSION_SECRET_INVALID',
        hint: message.includes('SESSION_SECRET')
          ? 'Set SESSION_SECRET in Vercel (min 16 characters), redeploy, then try again.'
          : message,
      }, { status: 503 });
    }

    return jsonResponse({ ok: true }, {
      headers: { 'Set-Cookie': sessionCookieHeader(token) },
    });
  } catch (e) {
    console.error('login handler error', e);
    return jsonResponse({
      error: 'Sign-in failed due to a server error.',
      code: 'SERVER_ERROR',
      hint:
        e instanceof Error
          ? e.message
          : 'Check Vercel → Project → Logs for this deployment.',
    }, { status: 500 });
  }
}
