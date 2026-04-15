import "./globals.css";

export const metadata = {
  title: "DRĀP — Fashion Delivered in 30 Minutes",
  description:
    "Curated clothing from India's finest boutiques, delivered to your doorstep in just 30 minutes. Experience the future of fashion shopping with DRĀP — Maison de Mode.",
  keywords:
    "quick commerce, fashion, clothing delivery, 30 minute delivery, online shopping, boutiques, luxury fashion",
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
        {/* Preconnect for Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Load Cormorant Garamond (serif) + Jost (sans) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,600&family=Jost:wght@200;300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0D0D1A" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
