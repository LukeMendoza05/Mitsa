import type {Metadata} from "next";
import {z} from "zod";
import {managementContext} from "@/lib/workspace-management";
import {WorkspaceShell} from "@/components/workspace/WorkspaceShell";
import s from "@/components/workspace/workspace.module.css";
export const metadata:Metadata={title:"Access History"};
export default async function Audit({params}:{params:Promise<{workspaceSlug:string}>}) {
  const context=await managementContext(params,"management");
  const result=await context.client.schema("api").rpc("mitsa_audit_history",{p_business:context.workspace.id});if(result.error)throw Error("Access history could not be verified.");
  const items=z.array(z.object({id:z.uuid(),actor_id:z.uuid().nullable(),event:z.string(),created_at:z.string()})).parse(result.data);
  return <WorkspaceShell {...context}><div className={s.heading}><h2>A record of responsibility.</h2><p>The latest 100 access-management events for this workspace. Business transaction history remains a planned capability.</p></div><div className={s.tableWrap} tabIndex={0} role="region" aria-label="Workspace access history"><table className={s.table}><caption>Workspace access history</caption><thead><tr><th scope="col">Event</th><th scope="col">Account</th><th scope="col">Time</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.event.replaceAll("."," · ")}</td><td className={s.identifier}>{item.actor_id||"System"}</td><td>{new Date(item.created_at).toLocaleString("en-PH",{timeZone:context.workspace.timezone})}</td></tr>)}</tbody></table></div>{!items.length?<p>No recorded access events are available.</p>:null}</WorkspaceShell>;
}
