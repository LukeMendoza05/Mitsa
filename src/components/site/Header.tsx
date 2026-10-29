"use client";

import { useEffect, useRef, useState } from "react";
import { navigation, Wordmark } from "./Site";
import s from "./site.module.css";

export function Header() {
  const menu = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update(); window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return <header className={`${s.header} ${scrolled ? s.scrolled : ""}`} onKeyDown={event => {
    if (event.key === "Escape" && menu.current?.open) { menu.current.open = false; summary.current?.focus(); }
  }}><div className={`${s.container} ${s.navInner}`}>
    <Wordmark />
    <nav className={s.desktopNav} aria-label="Main navigation">{navigation.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
    <details className={s.mobileMenu} ref={menu}><summary ref={summary}>Menu</summary><nav className={s.mobileNav} aria-label="Mobile navigation">{navigation.map(([label, href]) => <a key={href} href={href} onClick={() => { if (menu.current) menu.current.open = false; }}>{label}</a>)}<a className={s.button} href="/login">Sign In</a></nav></details>
    <a className={`${s.button} ${s.small}`} href="/login">Sign In</a>
  </div></header>;
}
