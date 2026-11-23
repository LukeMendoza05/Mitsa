import type {Metadata} from "next";
import {cookies} from "next/headers";
import {createHash} from "node:crypto";
import {z} from "zod";
import {componentClient} from "@/lib/supabase/server";
import {invitationCookie,openAuthFlow} from "@/lib/security/auth-flow";
import {InteriorShell} from "@/components/site/Site";
import {PostForm} from "@/components/site/PostForm";
import {AuthForm} from "@/components/site/AuthForm";
import s from "@/components/site/site.module.css";
export const metadata:Metadata={title:"Workspace Invitation"};
export default async function AcceptInvitation({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const flow=openAuthFlow((await cookies()).get(invitationCookie)?.value,process.env.AUTH_FLOW_KEY??""),client=await componentClient();
  const user=await client.auth.getUser();let invitation:{businessName:string;role:"admin"|"staff";expiresAt:string}|null=null,termsReady=false;
  if(user.data.user&&flow?.purpose==="invitation") {
    const [context,terms]=await Promise.all([client.schema("api").rpc("mitsa_invite_context",{p_hash:createHash("sha256").update(flow.token).digest("hex")}),client.schema("api").rpc("mitsa_current_terms")]);
    const parsed=z.object({businessName:z.string(),role:z.enum(["admin","staff"]),expiresAt:z.string()}).safeParse(context.data);
    if(!context.error&&parsed.success)invitation=parsed.data;termsReady=!terms.error&&terms.data?.accepted===true;
  }
  return <InteriorShell><main id="main-content" className={s.interior}><div className={s.auth}><p className={s.eyebrow}>Your Mitsa invitation</p><h1>A place in the workspace.</h1>
    {(await searchParams).error?<p className={s.error} role="alert">This invitation could not be accepted. Check its expiry, recipient account and current agreement.</p>:null}
    {flow?.purpose!=="invitation"?<p className={s.notice}>Open your invitation’s original link to continue. Invitations expire after seven days; a resend replaces the earlier link.</p>:!user.data.user?<><p className={s.intro}>Sign in with the invited email address, or create and verify an account using that address. Workspace details are shown only to the verified recipient.</p><div className={s.authLinks}><a className={s.button} href="/login">Sign in</a><a className={`${s.button} ${s.secondary}`} href="/signup">Create an account</a></div></>:!invitation?<><p className={s.notice}>This invitation is unavailable for your account. It may have expired, been replaced or been sent to a different email address.</p><AuthForm mode="logout"/></>:!termsReady?<><p className={s.intro}>Review your current account agreement before joining {invitation.businessName}.</p><a className={s.button} href="/settings/account/terms">Review agreement</a></>:<><p className={s.intro}>Join {invitation.businessName} as {invitation.role==="admin"?"an Admin":"Staff"}. {invitation.role==="admin"?"A trusted authenticator is required before privileged workspace access.":"Your workspace access is limited to your assigned locations."}</p><p className={s.notice}>Expires {new Date(invitation.expiresAt).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}.</p><PostForm className={s.form} action="/auth/invitations/accept" pendingLabel="Joining the workspace…"><label className={s.checkField}><input name="confirm" type="checkbox" required/><span>I confirm that I want to join this workspace with the invited role.</span></label><button className={s.button}>Accept invitation</button></PostForm></>}
    <div className={s.authLinks}><a href="/workspaces">Your workspaces</a><a href="/login">Back to sign in</a></div></div></main></InteriorShell>;
}
