import type { Metadata } from "next";
import { accountContext, roleLabels } from "@/lib/workspaces";
import { InteriorShell } from "@/components/site/Site";
import { AuthForm } from "@/components/site/AuthForm";
import s from "@/components/workspace/workspace.module.css";
import site from "@/components/site/site.module.css";

export const metadata: Metadata = { title: "Workspaces", description: "Choose your authorized Mitsa workspace." };
export default async function WorkspacesPage() {
  const { identity } = await accountContext();
  return <InteriorShell><main id="main-content" className={s.main}>
    <div className={s.row}><div className={s.heading}><h1>Your workspaces.</h1><p>{identity.email}</p><p>Choose a business to continue. Your role and location access are separate in each workspace.</p></div><AuthForm mode="logout" /></div>
    <nav className={s.nav} aria-label="Mitsa account navigation"><a href="/settings/account/security">Account security</a><a href="/onboarding">Create a workspace</a></nav>
    {identity.workspaces.length === 0 ? <div className={s.empty}><p>No active workspace membership is available. Create your own workspace or open an invitation sent to your verified email address.</p><a className={site.button} href="/onboarding">Create a workspace</a></div> : <div className={s.cards}>{identity.workspaces.map(workspace => <section className={s.card} key={workspace.id}>
      <span className={s.role}>{roleLabels[workspace.role]}</span><h2>{workspace.name}</h2><p>{workspace.requiresMfa ? "Verify your authenticator to access this workspace." : workspace.role === "staff" ? "Access is limited to your assigned locations." : "Operational access across this workspace’s locations."}</p>
      <a className={site.button} href={workspace.requiresMfa ? "/settings/account/security" : `/w/${workspace.slug}`}>{workspace.requiresMfa ? "Verify authenticator" : "Open workspace"}<span aria-hidden="true">↗</span></a>
    </section>)}</div>}
    <p className={s.note}>Isolated test environment · Synthetic identities only. No business membership is created automatically.</p>
  </main></InteriorShell>;
}
