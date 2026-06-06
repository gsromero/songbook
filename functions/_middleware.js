import { jwtVerify } from 'jose';

const PUBLIC_PATHS = [
  '/login',
  '/favicon.svg',
];

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const parts = cookie.split(';').map((part) => part.trim());
  const prefix = `${name}=`;
  const found = parts.find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : '';
}

async function isAuthenticated(request, env) {
  const token = getCookie(request, 'token');
  const secret = (env.JWT_SECRET || '').trim();
  if (!token || !secret) return false;

  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/\/$/, '') || '/';

  if (
    path.startsWith('/api/') ||
    path.startsWith('/_astro/') ||
    PUBLIC_PATHS.includes(path) ||
    path.match(/\.(css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/)
  ) {
    return context.next();
  }

  if (!(await isAuthenticated(context.request, context.env))) {
    return Response.redirect(new URL('/login', url), 302);
  }

  return context.next();
}
