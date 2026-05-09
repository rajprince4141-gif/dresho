import { NextResponse } from 'next/server';

// ── Rate Limiting Storage (Edge Memory) ─────────────────────────────────
// Protects APIs from brute-force and DDoS attacks per edge node isolate.
const rateLimitMap = new Map();
const RATE_LIMIT = 60;         // Max 60 requests
const TIME_WINDOW = 60 * 1000; // Per 1 minute

export function middleware(request) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // ── 1. API Rate Limiting (Throttle Spammers) ─────────────────────────
  if (pathname.startsWith('/api/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    
    if (ip !== 'unknown') {
      const now = Date.now();
      const userStatus = rateLimitMap.get(ip);
      
      if (!userStatus) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + TIME_WINDOW });
      } else {
        if (now > userStatus.resetTime) {
          // Reset their limit window
          rateLimitMap.set(ip, { count: 1, resetTime: now + TIME_WINDOW });
        } else {
          userStatus.count++;
          if (userStatus.count > RATE_LIMIT) {
            console.warn(`[Rate Limit] Blocked IP: ${ip} for spamming ${pathname}`);
            return new NextResponse(JSON.stringify({ error: 'Too Many Requests', message: 'Please slow down. You have been temporarily blocked.' }), { 
              status: 429,
              headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
            });
          }
        }
      }

      // Memory Leak Protection: Keep Map from growing infinitely
      if (rateLimitMap.size > 2000) {
        for (const [key, val] of rateLimitMap.entries()) {
          if (now > val.resetTime) rateLimitMap.delete(key);
        }
      }
    }
  }

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
