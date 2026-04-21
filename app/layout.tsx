import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alex — Deal Ledger",
  description: "Private deal tracking",
  applicationName: "Alex Deal Ledger",
  manifest: "/manifest.webmanifest",
  themeColor: "#34413b",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Alex Ledger",
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&family=Fraunces:ital,opsz,wght,SOFT@0,9..144,400..600,0..100&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
