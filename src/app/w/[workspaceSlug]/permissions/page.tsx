import type {Metadata} from "next";
import {managementContext} from "@/lib/workspace-management";
import {WorkspaceShell} from "@/components/workspace/WorkspaceShell";
import {ManagementFeedback} from "@/components/workspace/Management";
import {PostForm} from "@/components/site/PostForm";
import s from "@/components/workspace/workspace.module.css";
import site from "@/components/site/site.module.css";
export const metadata:Metadata={title:"Roles & Permissions"};
export default async function Permissions({params,searchParams}:{params:Promise<{workspaceSlug:string}>;searchParams:Promise<{error?:string;updated?:string}>}) {
  const context=await managementContext(params),w=context.workspace;
  return <WorkspaceShell {...context}><div className={s.heading}><h2>Responsibility, made explicit.</h2><p>Permissions are checked on the server and in the database for every workspace. A visible control never grants access on its own.</p></div><ManagementFeedback query={await searchParams}/>
    <div className={s.tableWrap} tabIndex={0} role="region" aria-label="Workspace role permissions"><table className={s.table}><caption>Workspace role permissions</caption><thead><tr><th scope="col">Capability</th><th scope="col">Business Owner</th><th scope="col">Admin</th><th scope="col">Staff</th></tr></thead><tbody>{[["Location access","All active locations","All active locations","Assigned locations"],["Manage locations","Yes","Yes","No"],["Invite and manage members","Admin and Staff","Staff only","No"],["Sensitive financial access","Yes","Owner controlled","No"],["Critical settings / transfer ownership","Yes, fresh MFA","No","No"],["Privileged workspace MFA","Required","Required","Optional"]].map(row=><tr key={row[0]}>{row.map((cell,i)=>i===0?<th scope="row" key={i}>{cell}</th>:<td key={i}>{cell}</td>)}</tr>)}</tbody></table></div>
    {w.role==="owner"?<section className={s.section}><h2>Admin financial access.</h2><p>This workspace-level permission applies to Admins. It starts disabled and resets to disabled on ownership transfer. Financial business modules remain planned.</p><PostForm className={s.form} action="/auth/workspace"><input name="action" type="hidden" value="financial"/><input name="slug" type="hidden" value={w.slug}/><label className={s.checkbox}><input name="enabled" type="checkbox" defaultChecked={w.adminFinancialAccess===true}/><span>Allow Admins to view sensitive financial information.</span></label><label className={s.checkbox}><input name="confirm" type="checkbox" required/><span>I confirm this change for this workspace.</span></label><button className={site.button}>Save financial permission</button></PostForm></section>:<p className={s.note}>{w.canViewFinancial?"Your current role is authorized for financial information when those modules become available.":"Sensitive financial information is restricted for your current role."}</p>}
  </WorkspaceShell>;
}
