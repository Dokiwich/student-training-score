import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Providers } from "./components/Providers";

export const metadata: Metadata = {
  title: "Hệ Thống Chấm Điểm Rèn Luyện",
  description: "Hệ thống quản lý và chấm điểm rèn luyện sinh viên",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white">
        <Providers>
          <main className="flex-1 min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
