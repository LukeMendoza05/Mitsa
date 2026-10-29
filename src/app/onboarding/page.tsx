import {SetupProgress} from "@/components/site/SetupProgress";
import {SelectField} from "@/components/workspace/SelectField";
import { PostForm } from "@/components/site/PostForm";
import type { Metadata } from "next";
import { accountContext } from "@/lib/workspaces";
import { InteriorShell } from "@/components/site/Site";
import s from "@/components/workspace/workspace.module.css";
import site from "@/components/site/site.module.css";

export const metadata: Metadata = { title: "Create a Workspace" };
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { identity, client } = await accountContext();
  const terms = await client.schema("api").rpc("mitsa_current_terms");
  if (terms.error) throw new Error("Account agreement could not be verified.");
  const error = (await searchParams).error;
  return <InteriorShell><main id="main-content" className={s.main}><div className={s.heading}><h1>A workspace for your business.</h1><p>Start with your business name and first shop or warehouse. Creating this workspace makes you its Business Owner.</p></div><SetupProgress step={4}/>
    {!terms.data?.accepted ? <div className={s.empty}><p>Review and accept the current agreement before creating a workspace.</p><a className={site.button} href="/settings/account/terms">Review agreement</a></div> : !identity.verified || !identity.mfaReady ? <div className={s.empty}><p>A verified email address and a trusted authenticator are required before you can create a workspace.</p><a className={site.button} href="/settings/account/security">Review account security</a></div> : <PostForm className={s.form} action="/auth/workspaces">
      {error ? <p className={s.error} role="alert">The workspace could not be created. Review your details and account security, then try again.</p> : null}
      <input type="hidden" name="commandKey" value={crypto.randomUUID()} />
      <label>Business name<input name="name" autoComplete="organization" maxLength={120} required /></label>
      <label>First location name<input name="location" maxLength={120} required /></label>
      <SelectField id="initial-location-kind" name="kind" label="Location type" defaultValue="shop"><option value="shop">Shop</option><option value="warehouse">Warehouse</option></SelectField>
      <button className={site.button} type="submit">Create workspace <span aria-hidden="true">↗</span></button>
    </PostForm>}
    <p className={s.note}>Isolated test environment · Use synthetic business details only. Workspace creation does not establish licensing or regulatory compliance.</p><a className={site.textLink} href="/workspaces">Back to workspaces</a>
  </main></InteriorShell>;
}
