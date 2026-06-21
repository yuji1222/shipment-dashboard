import { next } from '@vercel/functions';

export const config = {
  matcher: '/(.*)',
};

function unauthorized() {
  return new Response('認証が必要です。', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="TORQ", charset="UTF-8"' },
  });
}

export default function middleware(request) {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Basic ')) return unauthorized();

  let user = '', pass = '';
  try {
    const decoded = atob(auth.slice(6));
    const idx = decoded.indexOf(':');
    user = decoded.slice(0, idx);
    pass = decoded.slice(idx + 1);
  } catch {
    return unauthorized();
  }

  if (user !== process.env.BASIC_AUTH_USER || pass !== process.env.BASIC_AUTH_PASS) {
    return unauthorized();
  }

  return next();
}
