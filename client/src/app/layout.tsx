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

export const metadata: Metadata = {
  title: "MarkdotIntellect HRM | Team Management & Time Clock Hub",
  description: "Advanced Human Resource Management platform for MarkdotIntellect. Manage Clock In/Out, employee profiles, team communication, task boards, and leave requests in a single, high-performance dark space bento interface.",
  keywords: ["HRM", "Human Resource Management", "MarkdotIntellect", "Time Clock", "Shift Tracking", "Team Messaging", "Kanban Board", "Employee Directory"],
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
