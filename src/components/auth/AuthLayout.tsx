import type {ReactNode} from "react";
import {Wordmark} from "@/components/site/Site";
import site from "@/components/site/site.module.css";
import s from "./auth.module.css";

function WorkspacePreview() {
  return <figure className={s.preview} aria-label="Illustrative Mitsa workspace interface">
    <div className={s.previewTop}><span className={site.wordmark}>Mitsa</span><span>Workspace overview</span></div>
    <div className={s.previewBody}><div className={s.previewNav}><span className={s.previewSelected}>Overview</span><span>Locations</span><span>Members</span></div>
      <div className={s.previewContent}><p className={s.previewEyebrow}>YOUR WORKSPACE</p><h3>Everything has its place.</h3><div className={s.previewCards}><div><span>Locations</span><strong>A connected business.</strong><p>Shops and warehouses, clearly organized.</p></div><div><span>Team access</span><strong>The right responsibility.</strong><p>Defined roles. Considered permissions.</p></div></div><p className={s.previewFoot}>Inventory and sales capabilities are in development.</p></div>
    </div><figcaption>Interface preview · No live business data</figcaption>
  </figure>;
}

export function AuthLayout({mode,children}:{mode:"login"|"signup"|"verify"|"recovery";children:ReactNode}) {
  return <div className={s.page}><a className={site.skipLink} href="#main-content">Skip to content</a>
    <header className={s.header}><Wordmark/><a className={site.textLink} href="/">Back to overview <span aria-hidden="true">↗</span></a></header>
    <main id="main-content" className={s.layout}>
      <aside className={s.story} aria-label="About Mitsa"><div><p className={s.storyLabel}>A workspace for your business</p><h2>{mode==="login"?<>Every shop.<br/>One clear view.</>:mode==="verify"?<>One small step.<br/>A secure beginning.</>:mode==="recovery"?<>A secure way.<br/>Back to business.</>:<>A clear start.<br/>Room to grow.</>}</h2><p className={s.storyDescription}>Mitsa is a fireworks inventory and business management platform. Bring your team, locations and account access into one considered workspace.</p></div>
        <WorkspacePreview/><p className={s.storyClosing}>Clear access. Shared responsibility. A place to begin.</p>
      </aside>
      <section className={s.formColumn} aria-label={mode==="login"?"Sign in to Mitsa":mode==="verify"?"Verify your Mitsa email":mode==="recovery"?"Recover your Mitsa account":"Create your Mitsa account"}>{children}</section>
    </main>
    <footer className={s.footer}><div><Wordmark/><p>Fireworks inventory and business management.</p></div><nav aria-label="Mitsa account footer"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/cookies">Cookies</a></nav></footer>
  </div>;
}
