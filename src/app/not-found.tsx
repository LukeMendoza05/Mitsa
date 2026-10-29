import { InteriorShell } from "@/components/site/Site";
import s from "@/components/site/site.module.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "This Mitsa page is not available.",
  openGraph: { title: "Page Not Found | Mitsa", description: "This Mitsa page is not available.", siteName: "Mitsa" },
  twitter: { title: "Page Not Found | Mitsa", description: "This Mitsa page is not available." },
};

export default function NotFound() {
  return <InteriorShell><main id="main-content" className={`${s.interior} ${s.container}`}><div className={s.state}>
    <p className={s.eyebrow}>404 · Mitsa</p><h1>A little off course.</h1><p className={s.intro}>This page isn’t available. Return to the overview or sign in to your invited account.</p><div className={s.actions}><a className={s.button} href="/">Back to overview</a><a className={`${s.button} ${s.secondary}`} href="/login">Sign In</a></div>
  </div></main></InteriorShell>;
}
