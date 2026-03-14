import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RotaPlan - Okul Servis Planlayıcı",
  description: "Günlük öğrenci rota planlama aracı",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="bg-dark-900 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
