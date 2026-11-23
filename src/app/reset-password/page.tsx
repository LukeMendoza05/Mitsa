import auth from "@/components/auth/auth.module.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import {z} from "zod";
import {AuthLayout} from "@/components/auth/AuthLayout";
import { PostForm } from "@/components/site/PostForm";
import { PasswordField } from "@/components/site/PasswordField";
import {SelectField} from "@/components/workspace/SelectField";
import { componentClient } from "@/lib/supabase/server";
import { authFlowCookie, openAuthFlow } from "@/lib/security/auth-flow";
import s from "@/components/site/site.module.css";
export const metadata: Metadata = { title:"Reset Password" };
export default async function ResetPassword({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const flow = openAuthFlow((await cookies()).get(authFlowCookie)?.value,process.env.AUTH_FLOW_KEY ?? "");
  const client = await componentClient();
  const [user,claims]=await Promise.all([client.auth.getUser(),client.auth.getClaims()]);
  const ready = flow?.purpose === "recovery" && flow.userId === user.data.user?.id && flow.sessionId === claims.data?.claims.session_id;
  let needsMfa=false,hasMfa=false,trusted:{id:string;name:string}[]=[];
  if(ready) {
    const [provider,security]=await Promise.all([client.auth.mfa.listFactors(),client.schema("api").rpc("mitsa_security_status")]);
    const state=z.object({initialized:z.boolean(),ready:z.boolean(),factors:z.array(z.object({id:z.uuid(),active:z.boolean()}))}).safeParse(security.data);
    if(provider.error||security.error||!state.success)throw Error("Recovery security could not be verified.");
    needsMfa=state.data.initialized||provider.data.totp.some(f=>f.status==="verified");hasMfa=state.data.ready;
    trusted=provider.data.totp.filter(f=>f.status==="verified"&&state.data.factors.some(b=>b.id===f.id&&b.active)).map((f,i)=>({id:f.id,name:f.friendly_name||`Authenticator ${i+1}`}));
  }
  const query = await searchParams;
  return <AuthLayout mode="recovery"><p className={auth.eyebrow}>Account recovery</p><h1>Choose a new password.</h1><p className={auth.description}>Your workspace role and MFA requirements stay in place. You’ll sign in again after the change.</p>
    {query.error ? <p className={s.error} role="alert">The reset could not be completed. Check your passwords or request a fresh link.</p> : null}
    {ready&&needsMfa&&!hasMfa ? trusted.length?<PostForm className={s.form} action="/auth/password/challenge" pendingLabel="Verifying your authenticator…"><p>Verify a trusted authenticator before changing this account’s password.</p><SelectField id="recovery-factor" name="factorId" label="Recovery authenticator">{trusted.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</SelectField><label className={s.field}>Recovery authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required/></label><button className={s.button}>Verify recovery authenticator</button></PostForm>:<p className={s.notice}>A trusted authenticator is unavailable. <a href="/settings/account/recovery">Request independent recovery review</a>. Password recovery cannot remove MFA.</p> : ready ? <PostForm className={s.form} action="/auth/password/reset" pendingLabel="Updating your password…"><PasswordField name="password" label="New password" minLength={8}/><PasswordField name="confirmPassword" label="Confirm new password" minLength={8}/><button className={s.button}>Update password</button></PostForm> : flow?.purpose === "email" && flow.type === "recovery" ? <PostForm className={s.form} action="/auth/email"><p>Confirm that you want to use this password-reset link.</p><button className={s.button}>Continue password reset</button></PostForm> : <p className={s.notice}>A valid, unused recovery link is required. <a href="/forgot-password">Request a new reset link</a>.</p>}
    <div className={s.authLinks}><a href="/login">Back to sign in</a></div></AuthLayout>;
}
