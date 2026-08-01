import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { AppShell } from "@/components/ui/AppShell";
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
  title: "Gridiron Franchise",
  description:
    "Gridiron Franchise is a fictional football operations command center: upload custom rosters, rate players 0-100, build depth charts, and simulate seasons.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full">
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#f5a623",
              colorBackground: "#0f1420",
            },
          }}
        >
          <AppShell>{children}</AppShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
