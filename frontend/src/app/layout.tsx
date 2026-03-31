import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Infinity Cloud — Облачный VPS-хостинг",
  description: "Надёжный облачный хостинг с мгновенным развёртыванием VPS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
