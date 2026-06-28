import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Baloo_2 } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TopNav } from "@/components/nav/top-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// Baloo 2 — rounded, friendly, modern. Used for display + headline weights
// to give the platform a warmer, more "made for kids" voice while body
// stays on Geist for legibility + trustworthy tone.
const baloo2 = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Karya Sanga · Anaadi Foundation",
  description:
    "An online workshop and hackathon platform combining AI with ESP32 electronics. Karya Sanga, an initiative of Anaadi Foundation.",
  // Using the Anaadi mark as the favicon. The PNG lives at /public/ so it
  // ships unchanged from whatever the user dropped in.
  icons: {
    icon: "/anaadi-logo-mark.png",
    shortcut: "/anaadi-logo-mark.png",
    apple: "/anaadi-logo-mark.png",
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
      className={`${geistSans.variable} ${jetbrainsMono.variable} ${baloo2.variable} h-full antialiased`}
    >
      <head>
        {/*
          Preconnect lets the browser open the TLS handshake to the Google
          Fonts CDN in parallel with downloading the HTML, instead of
          serializing the work. Saves ~150ms on first paint for users on
          high-RTT networks.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <TopNav />
        {children}
        <Toaster richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
