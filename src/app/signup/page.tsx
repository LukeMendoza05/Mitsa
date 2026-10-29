import {SetupProgress} from "@/components/site/SetupProgress";
import type {Metadata} from "next";
import {AuthLayout} from "@/components/auth/AuthLayout";
import {SignupForm} from "@/components/auth/SignupForm";
import {registrationContext} from "@/lib/auth/registration";
import {registrationErrorCode,registrationMessages} from "@/lib/auth/feedback";
import s from "@/components/auth/auth.module.css";
import {headers,cookies} from 'next/headers';
import {openAuthFlow,signupAttemptCookie} from '@/lib/security/auth-flow';
import {componentClient} from '@/lib/supabase/server';
export const metadata:Metadata={title:"Sign Up",description:"Create your Mitsa account, verify your email and set up an authorized business workspace.",openGraph:{title:"Sign Up | Mitsa",siteName:"Mitsa",description:"Create your Mitsa account and verify your email."}};
export default async function SignupPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const {data:{user}}=await (await componentClient()).auth.getUser();
  if(user)return <AuthLayout mode="signup"><p className={s.eyebrow}>Your Mitsa account</p><h1>You’re already signed in.</h1><p className={s.description}>No new account has been created. To register another account, use a separate browser profile or sign out from Your workspaces first.</p><p className={s.switch}><a href="/workspaces">Go to Your workspaces</a></p><p className={s.testing}>Private windows in the same browser can share a session. A separate Guest profile lets you test registration while keeping your existing account signed in.</p></AuthLayout>;
  const [{persistent,policy,enabled,availability,isTest,isPilot,isDevelopmentOpen,captchaSiteKey},query]=await Promise.all([registrationContext(),searchParams]);
  const nonce=captchaSiteKey?(await headers()).get('x-nonce')??undefined:undefined;
  const attempt=persistent?openAuthFlow((await cookies()).get(signupAttemptCookie)?.value,process.env.AUTH_FLOW_KEY??''):null;
  const error=registrationErrorCode.safeParse(query.error),guide=process.env.NODE_ENV==="development"&&isTest;
  return <AuthLayout mode="signup"><p className={s.eyebrow}>Your Mitsa account</p><h1>Make room for your business.</h1><p className={s.description}>Create your account, verify your email, then set up your workspace.</p><SetupProgress step={1}/>
    {!enabled?<p className={s.testing} role="status"><strong>{availability==='closed'?'Registration is closed':availability==='paused'?'Registration is paused':'Registration unavailable'}</strong>{availability==='closed'?'New account registration is currently closed in this development environment. Existing accounts can still sign in.':availability==='paused'?'New account registration is paused while verification email is unavailable. Wait for registration to reopen before trying again. Existing accounts can still sign in.':'The current account setup could not be verified. Existing accounts can still sign in.'}</p>:null}
    {persistent?.policy?<details className={s.policyReview}><summary>Review the agreement and privacy notice</summary><h2>{persistent.policy.status==='test'?'Development agreement':'Terms of Use'} · {persistent.policy.termsVersion}</h2><p>{persistent.policy.termsContent}</p><h2>Privacy Notice · {persistent.policy.privacyVersion}</h2><p>{persistent.policy.privacyContent}</p></details>:null}
    <SignupForm enabled={enabled} termsId={policy?.id??""} isTest={policy?.status==="test"} captchaSiteKey={captchaSiteKey} nonce={nonce}
     privacyId={persistent?.policy?.privacyId} initialSubmissionId={persistent?(attempt?.purpose==='signup-attempt'?attempt.submissionId:crypto.randomUUID()):undefined} resumeSubmission={attempt?.purpose==='signup-attempt'}
     initialError={(enabled||persistent&&attempt?.purpose==='signup-attempt')&&query.error?registrationMessages[error.success?error.data:"unavailable"]:undefined}/>
    <p className={s.switch}>Already have an account? <a href="/login">Sign in</a></p>
    {isTest?<p className={s.testing}><strong>Development preview</strong>Use your explicitly approved test email. Verification messages stay local.{guide?<> <a href="/testing/registration">Local testing guide</a></>:null}</p>:null}
    {isPilot?<p className={s.testing}><strong>Private local pilot</strong>Registration is available during the approved testing window. Use an inbox you control and complete setup on this device.</p>:null}
    {isDevelopmentOpen?<p className={s.testing}><strong>Isolated development environment</strong>Use an inbox you control. Mitsa will send a verification email. This environment uses the development testing agreement; workspace access requires verified email and MFA.</p>:null}
    {persistent?<p className={s.testing}><strong>{policy?.status==='test'?'Development environment':'Mitsa account setup'}</strong>Registration availability and email delivery are managed separately. Creating an account does not grant access to an existing business. Verified email and MFA are required before workspace onboarding.</p>:null}
  </AuthLayout>;
}
