import "./globals.css";

export const metadata = {
  title: "Dresho — Fashion, Delivered instantly.",
  description:
    "Shop premium clothing from India's best local boutiques and get it delivered to your doorstep in 30 minutes. Quick-commerce fashion by Dresho.",
  keywords:
    "quick commerce fashion, clothing delivery, 30 minute delivery, fashion app India, boutiques, Dresho, dresho.in",
  openGraph: {
    title: "Dresho — Fashion, Delivered instantly.",
    description:
      "Premium clothing from local boutiques, delivered in 30 minutes. Discover Dresho.",
    url: "https://www.dresho.in",
    siteName: "Dresho",
    images: [{ url: "/logo.jpeg", width: 1024, height: 1024, alt: "Dresho Logo" }],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dresho — Fashion, Delivered instantly.",
    description: "Premium clothing from local boutiques, delivered in 30 minutes.",
    images: ["/logo.jpeg"],
  },
  icons: {
    icon: "/logo.jpeg",
    shortcut: "/logo.jpeg",
    apple: "/logo.jpeg",
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
