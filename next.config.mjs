/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip static export prerendering for all pages
  // Firebase pages need browser environment to run
  output: undefined,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ibb.co" },
      { protocol: "https", hostname: "ibb.co" },
    ],
  },

  // Vercel deploys as Node.js server, so prerendering Firebase pages isn't needed
  experimental: {
    // Prevents SSR from crashing on firebase/auth
  },
};

export default nextConfig;
