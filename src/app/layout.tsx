import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RotaPlan - Okul Servis Planlayıcı",
  description: "Günlük öğrenci rota planlama aracı",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-dark-900 text-gray-100 antialiased min-h-dvh overflow-x-hidden">{children}</body>
    </html>
  );
}
