import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const instrument = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "CanIShadow — clinics that take shadowing students",
  description:
    "Open-source map of NJ/NYC clinics that do or don't take shadowing students. Every green pin is a verified phone call. Free & open source, built by Andrew Poveda · AP MED.",
  metadataBase: new URL("https://canishadow.com"),
  openGraph: {
    title: "CanIShadow",
    description:
      "Open-source map of NJ/NYC clinics that take shadowing students. Every green pin is a verified phone call.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF9F6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrument.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
