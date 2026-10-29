import type { Metadata } from "next";
import { InteriorShell } from "@/components/site/Site";
import { AuthForm } from "@/components/site/AuthForm";
import s from "@/components/workspace/workspace.module.css";
import site from "@/components/site/site.module.css";
export const metadata: Metadata = { title: "Access Denied" };
export default function AccessDeniedPage() {
  return <InteriorShell><main id="main-content" className={s.main}><div className={s.heading}><h1>This workspace isn’t available.</h1><p>Your current account does not have the access required for this page. Check with the Business Owner or select another workspace.</p></div><div className={s.row}><a className={site.button} href="/workspaces">Choose a workspace</a><AuthForm mode="logout" /></div></main></InteriorShell>;
}
