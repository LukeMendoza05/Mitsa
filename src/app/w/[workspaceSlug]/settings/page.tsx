import type {Metadata} from "next";
import {managementContext} from "@/lib/workspace-management";
import {WorkspaceShell} from "@/components/workspace/WorkspaceShell";
import {ManagementFeedback} from "@/components/workspace/Management";
import {PostForm} from "@/components/site/PostForm";
import s from "@/components/workspace/workspace.module.css";
import site from "@/components/site/site.module.css";
export const metadata:Metadata={title:"Workspace Settings"};
export default async function Settings({params,searchParams}:{params:Promise<{workspaceSlug:string}>;searchParams:Promise<{error?:string;updated?:string}>}) {
  const context=await managementContext(params),w=context.workspace;
  return <WorkspaceShell {...context}><div className={s.heading}><h2>Workspace settings.</h2><p>The details behind your business workspace. Critical changes belong to the Business Owner.</p></div><ManagementFeedback query={await searchParams}/>
    {w.role==="owner"?<PostForm className={s.form} action="/auth/workspace"><input name="action" type="hidden" value="workspace-profile"/><input name="slug" type="hidden" value={w.slug}/><label>Business name<input name="name" autoComplete="organization" defaultValue={w.name} maxLength={120} required/></label><p className={s.hint}>Confirm your password and authenticator in Account Security before saving.</p><button className={site.button}>Save business name</button></PostForm>:<p>Business name: {w.name}. Ask your Business Owner to make changes.</p>}
    <section className={s.section}><h2>Workspace defaults.</h2><dl className={s.facts}><div><dt>Country</dt><dd>{w.country}</dd></div><div><dt>Currency</dt><dd>{w.currency}</dd></div><div><dt>Time zone</dt><dd>{w.timezone}</dd></div></dl><p>These established defaults are read-only in this foundation.</p></section>
    {w.role==="owner"?<section className={s.section}><h2>Request workspace closure.</h2><p>Closure requires independent review of ownership, linked records, legal holds and disposal/backup approval. This records a request; it does not close the workspace or delete records.</p><PostForm className={s.form} action="/auth/privacy/request"><input name="kind" type="hidden" value="workspace-closure"/><input name="slug" type="hidden" value={w.slug}/><input name="commandKey" type="hidden" value={crypto.randomUUID()}/><label>Additional information (optional)<textarea name="reason" maxLength={2000}/></label><button className={`${site.button} ${site.secondary}`}>Submit closure review request</button></PostForm></section>:null}
  </WorkspaceShell>;
}
