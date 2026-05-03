import { NextResponse } from 'next/server';

export function middleware(request) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // ── Block path traversal / injection attempts ──────────────────────────
  const suspicious = /(\.\.\/|\.\.\\|<script|%3Cscript|%00|eval\(|javascript:)/i;
  if (suspicious.test(pathname) || suspicious.test(request.nextUrl.search)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // ── Security Headers (applied to every response) ───────────────────────
  // Prevent site from being embedded in iframes (clickjacking)
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');

  // Stop MIME-type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // XSS protection for older browsers
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Restrict browser features
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), payment=(self), geolocation=(self)'
  );

  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  return response;
}

// Run on ALL routes including API
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
