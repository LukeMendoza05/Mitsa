import {SelectField} from "@/components/workspace/SelectField";
import type {Metadata} from "next";
import {z} from "zod";
import {managementContext,memberSchema} from "@/lib/workspace-management";
import {WorkspaceShell} from "@/components/workspace/WorkspaceShell";
import {ManagementFeedback} from "@/components/workspace/Management";
import {PostForm} from "@/components/site/PostForm";
import s from "@/components/workspace/workspace.module.css";
import site from "@/components/site/site.module.css";
export const metadata:Metadata={title:"Ownership Transfer"};
const transferSchema=z.object({id:z.uuid(),incomingId:z.uuid(),outgoingId:z.uuid(),removeOutgoing:z.boolean(),status:z.string(),expiresAt:z.string(),outgoingConfirmedAt:z.string().nullable(),incomingConfirmedAt:z.string().nullable()});
export default async function Ownership({params,searchParams}:{params:Promise<{workspaceSlug:string}>;searchParams:Promise<{error?:string;updated?:string}>}) {
  const context=await managementContext(params,"management"),w=context.workspace;
  const transfers=await context.client.schema("api").rpc("mitsa_transfers",{p_business:w.id});if(transfers.error)throw Error("Ownership transfers could not be verified.");
  const items=z.array(transferSchema).parse(transfers.data);
  let admins:z.infer<typeof memberSchema>[]=[];
  if(w.role==="owner") {const members=await context.client.schema("api").rpc("mitsa_members",{p_business:w.id});if(members.error)throw Error("Transfer recipients could not be verified.");admins=z.array(memberSchema).parse(members.data).filter(m=>m.active&&m.role==="admin");}
  return <WorkspaceShell {...context}><div className={s.heading}><h2>A considered handover.</h2><p>The current Business Owner and an active Admin must each confirm with fresh password and MFA. Both confirmations must overlap within five minutes. Every active workspace retains exactly one Business Owner.</p></div><ManagementFeedback query={await searchParams}/>
    {w.role==="owner"?<section className={s.section}><h2>Propose a transfer.</h2>{admins.length?<PostForm className={s.form} action="/auth/workspace"><input name="action" type="hidden" value="transfer-propose"/><input name="slug" type="hidden" value={w.slug}/><SelectField id="incoming-owner" name="incomingId" label="Incoming Business Owner">{admins.map(m=><option key={m.userId} value={m.userId}>{m.name||m.userId}</option>)}</SelectField><label className={s.checkbox}><input name="removeOutgoing" type="checkbox"/><span>Remove my membership after the transfer. Otherwise I become an Admin.</span></label><label className={s.checkbox}><input name="confirm" type="checkbox" required/><span>I understand that Admin financial access resets to disabled. The incoming Owner must independently confirm.</span></label><button className={site.button}>Propose ownership transfer</button></PostForm>:<p>An active Admin is required before a transfer can be proposed.</p>}</section>:null}
    <section className={s.section}><h2>Your transfer requests.</h2>{!items.length?<p>No ownership transfer involves your account.</p>:items.map(tr=><article className={s.card} key={tr.id}><h3>{tr.incomingId===context.user.id?"Incoming ownership":"Outgoing ownership"}</h3><p>Status: {tr.status}. Expires {new Date(tr.expiresAt).toLocaleString("en-PH",{timeZone:w.timezone})}.</p><p>Current Owner confirmation: {tr.outgoingConfirmedAt?"Recorded":"Waiting"}. Incoming Owner confirmation: {tr.incomingConfirmedAt?"Recorded":"Waiting"}.</p>{tr.status==="pending"?<><PostForm className={s.form} action="/auth/workspace"><input name="action" type="hidden" value="transfer-confirm"/><input name="slug" type="hidden" value={w.slug}/><input name="transferId" type="hidden" value={tr.id}/><label className={s.checkbox}><input name="confirm" type="checkbox" required/><span>I confirm this ownership transfer after verifying my password and authenticator.</span></label><button className={site.button}>Confirm my part of transfer</button></PostForm>{w.role==="owner"?<PostForm className={s.form} action="/auth/workspace"><input name="action" type="hidden" value="transfer-cancel"/><input name="slug" type="hidden" value={w.slug}/><input name="transferId" type="hidden" value={tr.id}/><button className={`${site.button} ${site.secondary}`}>Cancel transfer</button></PostForm>:null}</>:null}</article>)}</section>
  </WorkspaceShell>;
}
