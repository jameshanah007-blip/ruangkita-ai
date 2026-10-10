import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "./components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "RuangKita AI",
    template: "%s | RuangKita AI",
  },
  description:
    "RuangKita AI adalah ruang digital untuk bertanya, mencari informasi, dan menemukan game 2D gratis dari berbagai portal.",
  applicationName: "RuangKita AI",
  keywords: [
    "RuangKita AI",
    "Tanya Saya",
    "Fun Zone",
    "Game 2D Gratis",
    "Game Discovery",
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}