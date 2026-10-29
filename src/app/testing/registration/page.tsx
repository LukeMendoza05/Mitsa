import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {InteriorShell} from "@/components/site/Site";
import {registrationContext} from "@/lib/auth/registration";
import s from "@/components/auth/auth.module.css";
import {headers} from 'next/headers';
import {signupChallengeConfig} from '@/lib/auth/signup-challenge';
import {ChallengeDiagnostic} from '@/components/auth/ChallengeDiagnostic';
export const metadata:Metadata={title:"Local Registration Guide",robots:{index:false,follow:false}};
export default async function TestingRegistration() {
  if(process.env.NODE_ENV!=="development"||process.env.MITSA_AUTH_MAIL_MODE!=="isolated-capture")notFound();
  const {isTest}=await registrationContext();if(!isTest)notFound();
  const challenge=signupChallengeConfig(),nonce=challenge?(await headers()).get('x-nonce')??undefined:undefined;
  return <InteriorShell><main id="main-content" className={s.guide}><h1>Your local path into Mitsa.</h1><p>Registration is restricted to explicitly approved development accounts. This guide cannot grant access or enable public signup.</p>
    <h2>1. Check your approved account</h2><p>Your developer email stays in the private local configuration. After the reviewed operator activation, check its status from the project terminal:</p><code>npm run auth:developer -- status</code><p>If it is not authorized, complete the scoped activation review first. An address entered in the signup form is never automatically approved.</p>
    <h2>2. Create and verify your account</h2><p>Use your approved email on <a href="/signup">Sign Up</a>, choose your own password and explicitly accept the current isolated test agreement. No verification email is sent externally.</p><code>npm run auth:developer -- inbox</code><p>Open the private latest message file reported by that command. Use its local URL, then choose Verify email in Mitsa. Opening a link alone does not confirm the account. Keep the message file private.</p>
    <h2>3. Protect your account and create a workspace</h2><p>After verification, confirm your password, enroll an authenticator and verify its current code. Then create your workspace using fictitious business details. The trusted operation makes you its sole Business Owner; account registration alone does not assign a role.</p>
    <h2>4. Sign out and return</h2><p>Sign out from the workspace, then sign in with your email and password. Verify your authenticator when prompted and choose your authorized workspace. Never share your password or authenticator setup key in chat or screenshots.</p><p><a href="/signup">Continue to Sign Up ↗</a></p>
    <h2>Check human verification separately</h2><p>This development check tests Turnstile and server validation only. It cannot create an account, authorize an address or enable public registration.</p>
    {challenge?<ChallengeDiagnostic siteKey={challenge.siteKey} nonce={nonce}/>:<p>Turnstile keys are not configured. Run the private PowerShell setup helper before checking the connection.</p>}
  </main></InteriorShell>;
}
