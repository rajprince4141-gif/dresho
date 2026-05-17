import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://www.dresho.in"),
  alternates: {
    canonical: "/",
  },
  title: "Dresho — Fashion Delivered in 30 Minutes | Hazaribagh, Jharkhand",
  description:
    "Dresho is Hazaribagh's first quick-commerce fashion platform. Order trending clothes, kurtas, ethnic wear & more from local boutiques — delivered to your door in just 30 minutes. Fast. Fresh. Local.",
  keywords:
    "Dresho, dresho.in, fashion delivery Hazaribagh, 30 minute delivery Hazaribagh, quick commerce fashion Jharkhand, online clothes Hazaribagh, kurta delivery, ethnic wear delivery, local boutique Hazaribagh, fast fashion delivery India",
  icons: {
    icon: [
      { url: "/logo.jpeg", type: "image/jpeg" },
    ],
    apple: [
      { url: "/logo.jpeg", type: "image/jpeg" },
    ],
    shortcut: "/logo.jpeg",
  },
  openGraph: {
    title: "Dresho — Fashion Delivered in 30 Minutes | Hazaribagh, Jharkhand",
    description:
      "Order trending clothes from Hazaribagh's top local boutiques and get them delivered in 30 minutes. Kurtas, ethnic wear, western fashion & more — all at your doorstep, fast. Shop at dresho.in.",
    url: "https://www.dresho.in",
    siteName: "Dresho",
    images: [{ url: "/logo.jpeg", width: 1024, height: 1024, alt: "Dresho — Quick Fashion Delivery Hazaribagh" }],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dresho — Fashion Delivered in 30 Minutes | Hazaribagh",
    description:
      "Hazaribagh's first quick-commerce fashion app. Get clothes from local boutiques delivered to your door in 30 minutes. Shop at dresho.in.",
    images: ["/logo.jpeg"],
  },
  alternates: {
    canonical: "https://www.dresho.in",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
};

export const viewport = {
  themeColor: "#14213D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Font Awesome */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          crossOrigin="anonymous"
        />
        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Favicon */}
        <link rel="icon" href="/logo.jpeg" type="image/jpeg" />
        <link rel="shortcut icon" href="/logo.jpeg" type="image/jpeg" />
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Dresho" />
        <link rel="apple-touch-icon" href="/logo.jpeg" />
        <meta name="application-name" content="Dresho" />
        <meta name="msapplication-TileColor" content="#1A0DDC" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
