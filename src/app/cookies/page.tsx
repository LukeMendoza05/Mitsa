import type { Metadata } from "next";
import { LegalPublished } from "@/components/site/LegalPublished";
import { COOKIES_TEXT } from "@/lib/legal/published";

export const metadata: Metadata = { title: "Cookies & Local Storage", description: "Published cookie and local-storage notice for Mitsa." };
export default function CookiesPage() {
  return <LegalPublished title="Cookies & Local Storage" text={COOKIES_TEXT} version="2026-11-23.1" />;
}
