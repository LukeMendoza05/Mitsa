import {AccountNavigation} from "@/components/workspace/PageNavigation";
import type {Metadata} from "next";
import {z} from "zod";
import {accountContext} from "@/lib/workspaces";
import {requestSchema,requestLabels} from "@/lib/privacy/requests";
import {InteriorShell} from "@/components/site/Site";
import {PostForm} from "@/components/site/PostForm";
import {SelectField} from "@/components/workspace/SelectField";
import s from "@/components/workspace/workspace.module.css";
import site from "@/components/site/site.module.css";
export const metadata:Metadata={title:"Privacy Requests"};
export default async function PrivacyRequests({searchParams}:{searchParams:Promise<{error?:string;submitted?:string}>}) {
  const {client}=await accountContext(),query=await searchParams;
  const result=await client.schema("api").rpc("mitsa_account_requests");if(result.error)throw Error("Your requests could not be verified.");const items=z.array(requestSchema).parse(result.data);
  return <InteriorShell><main id="main-content" className={s.main}><div className={s.heading}><h1>Your information. Your requests.</h1><p>Request access, a profile correction or reviewed account deletion. Each request has a visible status. Approval and completion are separate steps.</p></div><AccountNavigation/>
    {query.error?<p className={s.error} role="alert">We couldn’t record that request. Check the details and your current account access.</p>:null}{query.submitted?<p className={s.success} role="status">Your request is recorded for review. Submitting it does not delete data or change workspace access.</p>:null}
    <PostForm className={s.form} action="/auth/privacy/request" pendingLabel="Recording your request…"><input name="commandKey" type="hidden" value={crypto.randomUUID()}/><SelectField id="privacy-request-kind" name="kind" label="Request type" defaultValue="access"><option value="access">Personal data access</option><option value="correction">Profile correction</option><option value="deletion">Account deletion</option></SelectField><label>Corrected full name<input name="fullName" autoComplete="name" maxLength={120}/></label><p className={s.hint}>Fill in the name only for a profile-correction request.</p><label>Additional information (optional)<textarea name="reason" maxLength={2000}/></label><p className={s.hint}>Keep passwords, authenticator keys and identity-document scans out of this form.</p><button className={site.button}>Submit review request</button></PostForm>
    <section className={s.section}><h2>Your request history.</h2>{!items.length?<p>No requests are recorded.</p>:<div className={s.cards}>{items.map(item=><article className={s.card} key={item.id}><h3>{requestLabels[item.kind]}</h3><p>Status: {item.status.replaceAll("-"," ")}</p><p>Submitted {new Date(item.requestedAt).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}.</p>{item.decisionReason?<p>{item.decisionReason}</p>:null}{item.exportAvailable?<><a className={site.textLink} href={`/auth/privacy/export/${item.id}`}>Download your account data <span aria-hidden="true">↗</span></a><p className={s.hint}>Downloads are available for 24 hours after fulfillment. Download expiry does not delete the underlying records.</p></>:null}{item.kind==="deletion"||item.kind==="workspace-closure"?<p className={s.hint}>Ownership, linked records, legal holds and approved disposal/backup rules must be resolved before deletion. Disposal is disabled in this environment.</p>:null}</article>)}</div>}</section>
    <p className={s.note}>Isolated synthetic testing only. Review targets and retention proposals are not published legal commitments.</p>
  </main></InteriorShell>;
}
