import type { Metadata } from "next";
import localFont from "next/font/local";
import { brand } from "@/lib/brand";
import "./globals.css";

const display = localFont({
  src: [
    { path: "./fonts/source-serif-regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/source-serif-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-display", display: "swap", fallback: ["Georgia"],
});
const body = localFont({
  src: "./fonts/inter-latin.woff2", weight: "400 500", variable: "--font-body",
  display: "swap", fallback: ["Arial"],
});
export const metadata: Metadata = {
  applicationName: brand.name,
  title: { default: brand.title, template: `%s | ${brand.name}` },
  description: brand.description,
  openGraph: { title: brand.title, description: brand.description, siteName: brand.name, type: "website" },
  twitter: { card: "summary", title: brand.title, description: brand.description },
  icons: { icon: "/icon.svg" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${display.variable} ${body.variable}`}><body>{children}</body></html>;
}
