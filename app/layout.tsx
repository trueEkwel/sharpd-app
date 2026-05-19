import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const serif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Sharpd — Every pick is public. Every result is permanent.",
  description:
    "Sharpd gives serious sports predictors a verified, timestamped track record that can't be edited, deleted, or faked. Build real reputation.",
  openGraph: {
    title: "Sharpd — Every pick is public. Every result is permanent.",
    description:
      "The reputation layer for sports predictions. Timestamped. Tamper-proof. Public forever.",
    url: "https://sharpd.bet",
    siteName: "Sharpd",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sharpd — Every pick is public. Every result is permanent.",
    description: "Every pick is public. Every result is permanent.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${serif.variable} ${sans.variable} ${mono.variable}`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
