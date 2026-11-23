import type { ReactNode } from "react";
import { brand } from "@/lib/brand";
import s from "./site.module.css";

export const navigation = [["Workspace", "#workspace"], ["Capabilities", "#capabilities"], ["Access", "#access"]] as const;

export function Wordmark() {
  return <a className={s.wordmark} href="/" aria-label={`${brand.name} home`}>{brand.name}</a>;
}

export function Footer({application=false}:{application?:boolean}={}) {
  return <footer className={s.footer}><div className={s.container}>
    <div className={s.footerTop}><div><Wordmark /><p>{brand.category}.</p></div>
      <nav className={s.footerNav} aria-label="Footer navigation">{application?<><a href="/workspaces">Workspaces</a><a href="/settings/account">Account settings</a><a href="/privacy">Privacy draft</a><a href="/terms">Terms draft</a></>:<>{navigation.map(([label, href]) => <a href={`/${href}`} key={href}>{label}</a>)}<a href="/login">Sign In</a></>}</nav>
    </div>
    <div className={s.footerBottom}><p>Product preview · Business workflows are in development.</p><p>Considered software. Clearer days.</p></div>
  </div></footer>;
}

export function InteriorShell({ children }: { children: ReactNode }) {
  return <><a className={s.skipLink} href="#main-content">Skip to content</a><header className={`${s.container} ${s.interiorHeader}`}><Wordmark /><a className={s.textLink} href="/workspaces">Your workspaces <span aria-hidden="true">↗</span></a></header>{children}<Footer application/></>;
}

export function Actions() {
  return <div className={s.actions}><a className={s.button} href="/login">Sign In <span aria-hidden="true">↗</span></a><a className={`${s.button} ${s.secondary}`} href="#workspace">Explore the Workspace</a></div>;
}
