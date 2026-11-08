import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RugShield \u2014 Token Risk Scanner",
  description: "Clean, fast token risk and honeypot detection",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
