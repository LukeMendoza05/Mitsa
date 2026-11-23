import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {z} from "zod";
import {accountContext} from "@/lib/workspaces";
import {requestKinds,requestLabels} from "@/lib/privacy/requests";
import {InteriorShell} from "@/components/site/Site";
import {PostForm} from "@/components/site/PostForm";
import {SelectField} from "@/components/workspace/SelectField";
import {AuthForm} from "@/components/site/AuthForm";
import s from "@/components/workspace/workspace.module.css";
import site from "@/components/site/site.module.css";
export const metadata:Metadata={title:"Request Review"};
export default async function OperatorRequests({searchParams}:{searchParams:Promise<{error?:string;updated?:string}>}) {
  const {client,user}=await accountContext(),result=await client.schema("api").rpc("mitsa_operator_context"),query=await searchParams;
  const principal=z.object({scopes:z.array(z.string()),recent:z.boolean()}).safeParse(result.data);if(result.error||!principal.success)redirect("/access-denied");
  let items:{id:string;user_id:string;business_id:string|null;kind:z.infer<typeof requestKinds>;status:string;details:{reason?:string;fullName?:string};decision_reason:string|null}[]=[];
  if(principal.data.recent){const requests=await client.schema("api").rpc("mitsa_operator_requests");if(requests.error)throw Error("Review cases could not be verified.");items=z.array(z.object({id:z.uuid(),user_id:z.uuid(),business_id:z.uuid().nullable(),kind:requestKinds,status:z.string(),details:z.object({reason:z.string().optional(),fullName:z.string().optional()}),decision_reason:z.string().nullable()})).parse(requests.data);}
  return <InteriorShell><main id="main-content" className={s.main}><div className={s.row}><div className={s.heading}><h1>A careful, independent review.</h1><p>Platform support permissions are separate from workspace roles. Review only cases covered by your assigned scope; you cannot approve or execute your own request.</p></div><AuthForm mode="logout"/></div>
    {query.error?<p className={s.error} role="alert">That review action was refused. Check the case, independent evidence, assigned scope and fresh account verification.</p>:null}{query.updated?<p className={s.success} role="status">The authorized case action has been recorded.</p>:null}
    {!principal.data.recent?<div className={s.empty}><p>Confirm your password and a trusted authenticator within five minutes before opening or acting on review cases.</p><a className={site.button} href="/settings/account/security#recent-title">Confirm identity</a></div>:!items.length?<p>No cases are available within your assigned scope.</p>:items.map(item=>{
      const reviewScope=item.kind==="mfa-recovery"?"mfa-recovery-review":"privacy-review",canReview=principal.data.scopes.includes(reviewScope)&&item.user_id!==user.id,canExecute=principal.data.scopes.includes("privacy-execute")&&item.user_id!==user.id;
      return <article className={`${s.card} ${s.section}`} key={item.id}><h2>{requestLabels[item.kind]}</h2><p>Status: {item.status.replaceAll("-"," ")}</p><p className={s.identifier}>Request ID: {item.id}<br/>Subject account: {item.user_id}{item.business_id?<><br/>Workspace ID: {item.business_id}</>:null}</p>{item.details.reason?<p className={s.legalText}>{item.details.reason}</p>:null}{item.details.fullName?<p>Requested profile name: {item.details.fullName}</p>:null}{item.decision_reason?<p>Review note: {item.decision_reason}</p>:null}
        {canReview&&(item.status==="pending"||item.status==="under-review")?<PostForm className={s.form} action="/auth/operator/requests"><input name="action" type="hidden" value="review"/><input name="requestId" type="hidden" value={item.id}/><SelectField id={`decision-${item.id}`} name="decision" label="Review decision" defaultValue="under-review"><option value="under-review">Begin / continue review</option><option value="approved">Approve after independent verification</option><option value="rejected">Reject with explanation</option></SelectField><label>Decision explanation<textarea name="reason" minLength={10} maxLength={1000} required/></label><label>Independent verification reference<input name="evidence" maxLength={1000}/></label><label className={s.checkbox}><input name="verified" type="checkbox"/><span>For approval: I verified identity through an independently approved process. The request text alone is not proof.</span></label><button className={`${site.button} ${site.secondary}`}>Record review decision</button></PostForm>:null}
        {canExecute&&item.status==="approved"&&(item.kind==="access"||item.kind==="correction")?<PostForm className={s.form} action="/auth/operator/requests"><input name="action" type="hidden" value="execute"/><input name="requestId" type="hidden" value={item.id}/><label className={s.checkbox}><input name="confirm" type="checkbox" required/><span>Execute the independently approved {item.kind==="access"?"personal-data export":"profile correction"} for this subject account.</span></label><button className={site.button}>Execute approved request</button></PostForm>:null}
        {item.status==="approved"&&(item.kind==="deletion"||item.kind==="workspace-closure")?<p>Disposal remains disabled. Review approval does not delete records, resolve ownership, clear legal holds or mark this case completed.</p>:null}
        {item.status==="approved"&&item.kind==="mfa-recovery"?<p>An independently authorized recovery executor is required. Review approval alone cannot remove authenticators, restore privileged access or complete this case.</p>:null}
      </article>;
    })}<nav className={s.nav} aria-label="Mitsa support navigation"><a href="/settings/account/security">Confirm account security</a><a href="/settings/account">Account settings</a><a href="/workspaces">Workspaces</a></nav><p className={s.note}>Isolated synthetic cases only. No operator identity or permission is created by visiting this page.</p>
  </main></InteriorShell>;
}
