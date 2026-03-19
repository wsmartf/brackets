import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "March Madness 2026 — 1 Billion Brackets",
  description: "Tracking 1 billion generated March Madness brackets against reality",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "153123376590415396bb4ec655392d4a"}'
        />
      </body>
    </html>
  );
}
