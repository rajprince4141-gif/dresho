/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Stop MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Referrer control
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restrict browser APIs
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(self), geolocation=(self)' },
  // Force HTTPS (production only — safe to keep on always)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Allow Google Popups for Auth
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // React needs unsafe-inline for hydration; Razorpay SDK + Font Awesome + Vercel
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdnjs.cloudflare.com https://apis.google.com https://www.gstatic.com https://vercel.live",
      // Google Fonts + Font Awesome CDN
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      // Product images from Unsplash, ImgBB, Firebase Storage
      "img-src 'self' data: blob: https://images.unsplash.com https://i.ibb.co https://ibb.co https://firebasestorage.googleapis.com https://*.googleusercontent.com",
      // Fonts
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
      // Firebase Realtime + Firestore + Auth + ImgBB uploads
      "connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.imgbb.com https://api.razorpay.com",
      // Razorpay checkout iframe + Firebase login popup + Google Sign-In
      "frame-src 'self' https://checkout.razorpay.com https://dresho-421b7.firebaseapp.com https://accounts.google.com",
      // Block <object> and <embed>
      "object-src 'none'",
      // Prevent base tag hijacking
      "base-uri 'self'",
      // Form submissions only to same origin
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig = {
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
