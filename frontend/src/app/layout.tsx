import type { Metadata } from "next";
import { Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/context/WalletProvider";
import { ToastProvider } from "@/context/ToastContext";
import { getSiteUrl } from "@/lib/site-url";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Quid | On-Chain Verified QA & UX Testing",
    template: "%s | Quid",
  },
  description:
    "The On-Chain Verified QA & UX Testing Platform for Stellar & Soroban Builders",
  applicationName: "Quid",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Quid",
    url: "/",
    title: "Quid | On-Chain Verified QA & UX Testing",
    description:
      "Find paid testing missions and build verifiable proof of work on Stellar.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quid | On-Chain Verified QA & UX Testing",
    description: "Paid testing missions with verifiable on-chain proof.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground brutal-grid-bg`}
      >
        <ToastProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
