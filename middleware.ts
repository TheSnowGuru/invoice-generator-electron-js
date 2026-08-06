import { next } from '@vercel/functions';
import { getSessionCookie, verifySessionToken } from './lib/session-edge';

function isPublicPath(pathname: string): boolean {
  if (pathname === '/login.html') return true;
  if (pathname === '/api/auth/login') return true;
  if (pathname === '/api/auth/enabled') return true;
  if (pathname === '/api/auth/status') return true;
  if (pathname.startsWith('/assets/')) return true;
  if (pathname === '/manifest.webmanifest' || pathname === '/sw.js' || pathname.startsWith('/workbox')) {
    return true;
  }
  if (pathname === '/icon-192.png' || pathname === '/icon-512.png' || pathname === '/favicon.ico') {
    return true;
  }
  if (/\.(js|css|png|svg|ico|woff2|webmanifest|map)$/i.test(pathname)) return true;
  return false;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const authed = await verifySessionToken(getSessionCookie(request));

  if (path === '/login.html' && authed) {
    return Response.redirect(new URL('/', request.url));
  }

  if (isPublicPath(path)) {
    return next();
  }

  if (path.startsWith('/api/')) {
    if (!authed) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return next();
  }

  if (!authed) {
    return Response.redirect(new URL('/login.html', request.url));
  }

  return next();
}
