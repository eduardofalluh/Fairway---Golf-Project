import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import { PageLoader } from "@/components/PageLoader";

const display = Sora({
  variable: "--font-display-var",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const body = Inter({
  variable: "--font-body-var",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fairway — every Montreal tee time, one search",
  description:
    "Search live tee times across every golf course in the Greater Montreal area. Pick a time, set a window, name your price.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-full antialiased">
        <PageLoader />
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
