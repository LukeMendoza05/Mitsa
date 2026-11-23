import type { Metadata } from "next";
import { LegalPublished } from "@/components/site/LegalPublished";
import { PRIVACY_TEXT } from "@/lib/legal/published";

export const metadata: Metadata = { title: "Privacy Policy", description: "Published Privacy Policy for Mitsa." };
export default function PrivacyPage() {
  return <LegalPublished title="Privacy Policy" text={PRIVACY_TEXT} version="2026-11-23.1" />;
}
