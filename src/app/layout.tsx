import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";
import { LanguageProvider } from "@/lib/i18n";

const display = Cormorant_Garamond({
  variable: "--font-display-var",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Inter({
  variable: "--font-body-var",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fairway — Montréal and Toronto tee times",
  description:
    "Compare provider-confirmed tee times across Montréal and Toronto golf courses, then continue to the booking provider.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable}`}>
      <body className="min-h-full antialiased">
        <LanguageProvider>
          <SmoothScroll>{children}</SmoothScroll>
        </LanguageProvider>
      </body>
    </html>
  );
}
