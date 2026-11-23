import type { Metadata } from "next";
import { LegalPublished } from "@/components/site/LegalPublished";
import { TERMS_TEXT } from "@/lib/legal/published";

export const metadata: Metadata = { title: "Terms of Use", description: "Published Terms of Use for Mitsa." };
export default function TermsPage() {
  return <LegalPublished title="Terms of Use" text={TERMS_TEXT} version="2026-11-23.1" />;
}
