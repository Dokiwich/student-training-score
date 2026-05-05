import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
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
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-white">
        <Providers>
          <main className="flex-1 min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
