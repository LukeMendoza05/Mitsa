import {SetupProgress} from "@/components/site/SetupProgress";
import type {Metadata} from "next";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {AuthLayout} from "@/components/auth/AuthLayout";
import {FormActionGroup,PostForm} from "@/components/site/PostForm";
import {ResendCodeButton} from "@/components/auth/ResendCodeButton";
import {authFlowCookie,openAuthFlow,signupCodeCookie} from "@/lib/security/auth-flow";
import {verificationMessages} from "@/lib/auth/email-verification";
import {emailVerificationCodeLength,emailVerificationCodeLabel} from "@/lib/auth/email-code-settings";
import {componentClient} from "@/lib/supabase/server";
import {registrationContext} from "@/lib/auth/registration";
import {readDevelopmentDeliveryState} from '@/lib/auth/development-registration';
import s from "@/components/auth/auth.module.css";
import site from "@/components/site/site.module.css";
import {EmailDeliveryStatus} from '@/components/auth/EmailDeliveryStatus';
export const metadata:Metadata={title:"Verify Email",description:"Verify your Mitsa account email securely before continuing account setup."};
export default async function VerifyEmail({searchParams}:{searchParams:Promise<{error?:string;sent?:string;resent?:string}>}) {
 const client=await componentClient();if((await client.auth.getUser()).data.user)redirect("/workspaces");
 const [jar,query,context]=await Promise.all([cookies(),searchParams,registrationContext(client)]),key=process.env.AUTH_FLOW_KEY??"";
 const {isTest,isPilot,persistent:readiness}=context;
 const link=openAuthFlow(jar.get(authFlowCookie)?.value,key),code=openAuthFlow(jar.get(signupCodeCookie)?.value,key);
 const linkReady=link?.purpose==="email"&&link.type==="signup",codeReady=code?.purpose==="signup-code";
 const persistent=Boolean(readiness);
 const deliveryState=codeReady?(readiness?(context.emailDeliveryEnabled?'available':readiness.delivery==='available'?'unavailable':readiness.delivery):await readDevelopmentDeliveryState(code.email)):'unmanaged';
 const deliveryAvailable=deliveryState==='available'||deliveryState==='unmanaged';
 const deliveryNotice=codeReady&&!deliveryAvailable?verificationMessages[deliveryState==='closed'?(persistent?'delivery_closed':'testing_closed'):deliveryState==='paused'?'delivery_paused':'unavailable']:null;
 const errorMessage=query.error?query.error==='unavailable'&&deliveryNotice?deliveryNotice:verificationMessages[query.error]??verificationMessages.code:null;
 return <AuthLayout mode="verify"><p className={s.eyebrow}>Your Mitsa account · Email verification</p><h1>Verify your email.</h1><p className={s.description}>{linkReady?"Confirm the verification link you opened to continue securely.":"Enter the verification code from your latest Mitsa email to continue. Keep this page open while you check your inbox."}</p><SetupProgress step={2}/>
  {errorMessage?<p className={s.errorSummary} role="alert">{errorMessage}</p>:null}
  {deliveryNotice&&deliveryNotice!==errorMessage?<p className={s.verificationNotice} role="status">{deliveryNotice}</p>:null}
  {query.resent?<p className={s.verificationNotice} role="status">If this registration is still eligible, a new verification message has been requested. Use the newest code; an earlier code may no longer work.</p>:null}
  <FormActionGroup>{codeReady&&!linkReady?<>
   <PostForm className={site.form} action="/auth/email/code" pendingLabel="Verifying your email…" timeoutMs={30000}><input type="hidden" name="action" value="verify"/><div className={site.field} data-auth-field><label htmlFor="email-verification-code">Verification code</label><input className={s.verificationCode} id="email-verification-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" spellCheck={false} autoCapitalize="none" pattern={`[0-9]{${emailVerificationCodeLength}}`} minLength={emailVerificationCodeLength} maxLength={emailVerificationCodeLength} required aria-describedby="verification-help" aria-invalid={query.error==="code"||query.error==="input"?true:undefined}/><p className={s.smallPrint} id="verification-help">Paste or enter the {emailVerificationCodeLabel} code from your latest email.</p></div><button className={site.button} type="submit">Verify email</button></PostForm>
   <PostForm className={`${site.form} ${s.resendForm}`} action="/auth/email/code" pendingLabel="Requesting a new code…" timeoutMs={30000}><input type="hidden" name="action" value="resend"/>{persistent?<input type="hidden" name="requestKey" value={crypto.randomUUID()}/>:null}<ResendCodeButton availableAt={code.resendAt} deliveryAvailable={deliveryAvailable}/></PostForm>
  </>:!linkReady?<p className={s.verificationNotice}>Start with Sign Up, or return to Sign In if you already have an account. A verification session is needed before you can enter or request a code.</p>:null}
  {persistent&&codeReady&&code.mailRequestId?<EmailDeliveryStatus/>:null}
  {linkReady?<PostForm className={site.form} action="/auth/email" pendingLabel="Verifying your email…"><p className={s.smallPrint}>Opening the link alone does not verify your account. Select Verify email to confirm.</p><button className={site.button} type="submit">Verify email</button></PostForm>:null}</FormActionGroup>
  <p className={s.switch}><a href="/login">Back to sign in</a></p>
  {isTest?<p className={s.testing}><strong>Development preview</strong>External email is disabled. Messages remain in private test capture. {process.env.MITSA_AUTH_CODE_CAPTURE_ENABLED==="true"?"Retrieve your code through the private testing workflow.":"Code messages are not active in this preview yet; use your captured verification link."}{process.env.NODE_ENV==="development"?<> <a href="/testing/registration">Local testing guide</a>.</>:null}</p>:null}
  {isPilot?<p className={s.testing}><strong>Private local pilot</strong>Check the inbox used for registration. Codes already delivered remain verifiable until their provider expiry, even after new registration closes.</p>:null}
 </AuthLayout>;
}
