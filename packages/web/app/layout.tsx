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
import { SemesterProvider } from "./providers/SemesterProvider";
import { APP_BRANDING } from "../lib/branding";

export const metadata: Metadata = {
  title: APP_BRANDING.englishName,
  description: "Hệ thống quản lý và đánh giá điểm rèn luyện sinh viên",
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
      suppressHydrationWarning
    >
      <body className="min-h-full flex bg-background text-foreground transition-colors duration-200">
        <Providers>
          <SemesterProvider>
            <main className="flex-1 min-h-screen">
              {children}
            </main>
          </SemesterProvider>
        </Providers>
      </body>
    </html>
  );
}
