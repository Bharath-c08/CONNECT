import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PWARegister from "../components/PWARegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Markdot Dotcore | Team Management & Time Clock Hub",
  description: "Advanced Human Resource Management platform by Markdot Dotcore. Manage Clock In/Out, employee profiles, team communication, task boards, and leave requests in a single, high-performance dark space bento interface.",
  keywords: ["HRM", "Human Resource Management", "Markdot Dotcore", "Time Clock", "Shift Tracking", "Team Messaging", "Kanban Board", "Employee Directory"],
  manifest: "/manifest.json",
  icons: {
    icon: "/images/favicon.ico",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ef4444" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-full flex flex-col">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
