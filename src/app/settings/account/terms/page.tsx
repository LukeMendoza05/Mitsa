import {AccountNavigation} from "@/components/workspace/PageNavigation";
import { PostForm } from "@/components/site/PostForm";
import type { Metadata } from "next";
import { z } from "zod";
import { accountContext } from "@/lib/workspaces";
import { InteriorShell } from "@/components/site/Site";
import { AuthForm } from "@/components/site/AuthForm";
import s from "@/components/workspace/workspace.module.css";
import site from "@/components/site/site.module.css";

export const metadata: Metadata = { title: "Terms Review" };
export default async function AccountTermsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { client } = await accountContext();
  const result = await client.schema("api").rpc("mitsa_current_terms");
  const terms = z.object({ id: z.uuid(), content: z.string(), version: z.string(), status: z.enum(["test", "published"]), accepted: z.boolean() }).nullable().parse(result.data);
  if (result.error) throw new Error("Terms could not be verified.");
  return <InteriorShell><main id="main-content" className={s.main}><div className={s.heading}><h1>Review your agreement.</h1><p>Terms acceptance is recorded separately from privacy notices and optional consent.</p></div><AccountNavigation/>
    {terms ? <><article className={s.card}><span className={s.role}>{terms.status === "test" ? "Synthetic test agreement · Not published legal policy" : "Terms of Use"} · {terms.version}</span><div className={s.legalText}>{terms.content}</div></article>
      {terms.accepted ? <p className={s.note}>You have accepted this version.</p> : <PostForm className={s.form} action="/auth/terms"><input type="hidden" name="versionId" value={terms.id} />{(await searchParams).error ? <p role="alert" className={s.error}>Accept the current Terms to continue, or sign out.</p> : null}<label className={s.checkbox}><input name="accept" type="checkbox" required /><span>I have read and accept this Terms version.</span></label><button className={site.button} type="submit">Accept and continue</button></PostForm>}</> : <div className={s.empty}><p>No approved agreement is available for this environment. Workspace onboarding remains unavailable until an appropriate version is configured.</p><AuthForm mode="logout" /></div>}
    
  </main></InteriorShell>;
}
