/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Stop MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Referrer control
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Force HTTPS (production only — safe to keep on always)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Allow Google Popups for Auth & Razorpay
  { key: 'Cross-Origin-Opener-Policy', value: 'unsafe-none' },
  // Content Security Policy (Relaxed for Razorpay Banking Iframes)
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdnjs.cloudflare.com https://apis.google.com https://www.gstatic.com https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "img-src * data: blob:",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
      "connect-src * wss: data:",
      "frame-src *",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action *",
    ].join('; '),
  },
];

const nextConfig = {
  experimental: {
    // Allow up to 10MB uploads via /api/upload (Next.js default is 4MB)
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i.ibb.co' },
      { protocol: 'https', hostname: 'ibb.co' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },

  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
