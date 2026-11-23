import type { ReactNode } from "react";
import { InteriorShell } from "./Site";
import s from "./site.module.css";

export function LegalDraft({ title, children }: { title: string; children: ReactNode }) {
  return <InteriorShell><main id="main-content" className={`${s.interior} ${s.legalPage}`}>
    <p className={s.eyebrow}>Mitsa · Review draft</p><h1>{title}</h1>
    <aside className={s.draftNotice}><strong>Draft for review.</strong><p>This document describes the isolated development environment. It is not an approved production policy. Operator details, legal decisions and release arrangements must be confirmed before publication.</p></aside>
    {children}
    <nav className={s.authLinks} aria-label="Mitsa policy drafts"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Use</a><a href="/cookies">Cookies & Local Storage</a><a href="/login">Sign in</a></nav>
  </main></InteriorShell>;
}
