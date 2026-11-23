import { InteriorShell } from "./Site";
import s from "./site.module.css";

/** Renders one of the immutable, published legal versions. */
export function LegalPublished({ title, text, version }: { title: string; text: string; version: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return <InteriorShell><main id="main-content" className={`${s.interior} ${s.legalPage}`}>
    <p className={s.eyebrow}>Mitsa · Published policy · {version}</p>
    <h1>{title}</h1>
    {blocks.map((block, i) => {
      const lines = block.split("\n");
      if (lines[0].startsWith("## ")) {
        return <section key={i}><h2>{lines[0].slice(3)}</h2>{lines.slice(1).filter(Boolean).map((line, j) => <p key={j}>{line.replace(/\*\*/g, "")}</p>)}</section>;
      }
      if (lines[0].startsWith("# ")) return <p key={i}><strong>{lines[0].slice(2).replace(/\*\*/g, "")}</strong></p>;
      return <p key={i}>{lines.filter(Boolean).map((line) => line.replace(/\*\*/g, "")).join(" ")}</p>;
    })}
    <nav className={s.authLinks} aria-label="Mitsa policies"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Use</a><a href="/cookies">Cookies & Local Storage</a><a href="/login">Sign in</a></nav>
  </main></InteriorShell>;
}
