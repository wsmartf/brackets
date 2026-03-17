import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
