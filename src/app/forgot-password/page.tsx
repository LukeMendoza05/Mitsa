import auth from "@/components/auth/auth.module.css";
import type { Metadata } from "next";
import {AuthLayout} from "@/components/auth/AuthLayout";
import {RecoveryForm} from '@/components/auth/RecoveryForm';
import {persistentRegistrationReadiness,usesPersistentRegistration} from '@/lib/auth/registration-service';
import {signupChallengeConfig} from '@/lib/auth/signup-challenge';
import {headers} from 'next/headers';
import s from "@/components/site/site.module.css";
export const metadata: Metadata = { title:"Forgot Password" };
export default async function ForgotPassword({searchParams}:{searchParams:Promise<{sent?:string;error?:string}>}) {
  const query = await searchParams,persistent=usesPersistentRegistration(),challenge=persistent?signupChallengeConfig():null;
  const readiness=persistent?await persistentRegistrationReadiness():null;
  const enabled=persistent?readiness?.delivery==='available'&&Boolean(challenge):process.env.MITSA_AUTH_MAIL_MODE === "isolated-capture";
  const nonce=challenge?(await headers()).get('x-nonce')??undefined:undefined;
  return <AuthLayout mode="recovery"><p className={auth.eyebrow}>Account recovery</p><h1>A fresh start.</h1><p className={auth.description}>Request a password reset link. Changing your password preserves your authenticator and workspace permissions.</p>
    {!enabled ? <p className={s.notice}>{persistent?'Password-reset email is temporarily unavailable. Your account and authenticator remain unchanged. You can still try signing in.':'Password-reset email is unavailable until isolated mail capture is approved and configured.'}</p> : null}
    {query.sent ? <p role="status">{persistent?'If this account is eligible, a password-reset message has been requested. Check your inbox and Spam, and use only the latest link.':'If this account is eligible, a reset message has been captured for testing. Use its latest link to continue.'}</p> : null}
    {query.error ? <p className={s.error} role="alert">We couldn’t process that request. Check your details and try again.</p> : null}
    <RecoveryForm enabled={enabled} captchaSiteKey={challenge?.siteKey} nonce={nonce} requestKey={persistent?crypto.randomUUID():undefined}/><div className={s.authLinks}><a href="/login">Back to sign in</a><a href="/settings/account/recovery">Lost your authenticator?</a></div></AuthLayout>;
}
