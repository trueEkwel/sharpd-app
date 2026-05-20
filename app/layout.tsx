import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Sharpd — Every pick is public. Every result is permanent.",
  description: "Sharpd gives serious sports predictors a verified, timestamped track record that can't be edited, deleted, or faked. Build real reputation.",
  openGraph: {
    title: "Sharpd — Every pick is public. Every result is permanent.",
    description: "The reputation layer for sports predictions. Timestamped. Tamper-proof. Public forever.",
    url: "https://sharpd.bet",
    siteName: "Sharpd",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sharpd — Every pick is public. Every result is permanent.",
    description: "Every pick is public. Every result is permanent.",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              var theme = localStorage.getItem('theme') || 'dark';
              document.documentElement.setAttribute('data-theme', theme);
            } catch(e) {}
          `
        }} />
      </head>
      <body className={`${geist.variable} ${geistMono.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}