"use client";

import { useEffect } from "react";
import { InteriorShell } from "@/components/site/Site";
import s from "@/components/site/site.module.css";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { document.title = "Something Went Wrong | Mitsa"; }, []);
  return <InteriorShell><main id="main-content" className={`${s.interior} ${s.container}`}><div className={s.state}>
    <p className={s.eyebrow}>Mitsa</p><h1>Let’s try that again.</h1><p className={s.intro}>We couldn’t load this page. Try again, or return to the overview.</p><div className={s.actions}><button className={s.button} onClick={retry}>Try again</button><a className={`${s.button} ${s.secondary}`} href="/">Back to overview</a></div>
  </div></main></InteriorShell>;
}
