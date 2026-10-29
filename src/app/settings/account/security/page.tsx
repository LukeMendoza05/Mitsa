import {PasswordField} from "@/components/site/PasswordField";
import {SetupProgress} from "@/components/site/SetupProgress";
import {AccountNavigation} from "@/components/workspace/PageNavigation";
import { FormActionGroup,PostForm } from "@/components/site/PostForm";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { accountContext } from "@/lib/workspaces";
import { InteriorShell } from "@/components/site/Site";
import { AuthForm } from "@/components/site/AuthForm";
import s from "@/components/workspace/workspace.module.css";
import site from "@/components/site/site.module.css";
import { enrollmentCookieName, openEnrollment } from "@/lib/security/enrollment-cookie";
import {classifyFactors,passwordDeadline,securityMessages,securityStateSchema} from "@/lib/security/mfa-state";

export const metadata: Metadata = { title: "Account Security" };
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string }> }) {
  const { client, identity } = await accountContext();
  const [provider, security, claims, jar, query] = await Promise.all([client.auth.mfa.listFactors(), client.schema("api").rpc("mitsa_security_status"), client.auth.getClaims(), cookies(), searchParams]);
  if (provider.error || security.error || claims.error) throw new Error("Account security could not be verified.");
  const state=securityStateSchema.parse(security.data),{verified,trusted,pending,unbound,needsReview}=classifyFactors(provider.data.all,state);
  const sessionId=claims.data?.claims.session_id;
  const stored=typeof sessionId==="string"?openEnrollment(jar.get(enrollmentCookieName)?.value,process.env.MFA_ENROLLMENT_KEY??"",identity.userId,sessionId):null;
  const enrollment=stored&&pending.some(f=>f.id===stored.factorId)&&passwordDeadline(claims.data?.claims)!==null?stored:null;
  const confirmed=passwordDeadline(claims.data?.claims)!==null&&(!state.initialized||state.recent)&&!needsReview;
  const qr=enrollment?`data:image/svg+xml,${encodeURIComponent(await QRCode.toString(enrollment.uri,{type:"svg",margin:2,width:224}))}`:null;
  const expired=pending.length>0&&!enrollment;
  return <InteriorShell><FormActionGroup><main id="main-content" className={s.main}>
    <div className={s.heading}><h1>Keep your account protected.</h1><p>{trusted.length?"Verify an existing authenticator to return to your workspace. Confirm your identity before adding or replacing a device.":"Confirm your password, connect Google Authenticator or another TOTP app, then verify its code. Business Owner access opens after setup is complete."}</p></div><AccountNavigation/>{!state.initialized?<SetupProgress step={3}/>:null}
    {query.error?<p className={s.error} role="alert">{securityMessages[query.error]??securityMessages.security}</p>:null}
    {query.updated==="email-verified"?<p className={s.success} role="status">Email verified. Set up your authenticator before creating your Business Owner workspace.</p>:null}
    {query.updated==="reauthenticated"&&confirmed?<p className={s.success} role="status">Identity confirmed. Complete your security change within five minutes of password confirmation.</p>:null}
    {query.updated==="cancelled"?<p className={s.success} role="status">The unfinished setup was canceled. A new setup generates a different QR code and secret.</p>:null}
    {identity.mfaReady?<div className={s.empty}><p>Your current session has verified MFA.</p><a className={site.button} href="/workspaces">Continue to workspaces</a><a className={site.textLink} href="/onboarding">Create your workspace</a></div>:trusted.length>0?<section className={s.section} aria-labelledby="challenge-title"><h2 id="challenge-title">Verify your existing authenticator.</h2><p>Use the code from your previously verified Mitsa entry. This does not create a new authenticator.</p><PostForm className={s.form} action="/auth/mfa" pendingLabel="Verifying authenticator…">
      <label>Authenticator<select name="factorId">{trusted.map((factor,index)=><option key={factor.id} value={factor.id}>{factor.friendly_name||`Authenticator ${index+1}`}</option>)}</select></label>
      <label>Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/></label><button className={site.button} type="submit">Verify authenticator</button>
    </PostForm></section>:!verified.length?<p>No verified authenticator is currently available.</p>:null}
    {needsReview?<section className={s.section} aria-labelledby="review-title"><h2 id="review-title">Authenticator setup needs review.</h2><p>An authenticator was verified by the account service, but its Mitsa setup did not finish. It has been preserved. A password alone cannot replace it or grant workspace access.</p><p>Use a trusted backup if available, or request an independent recovery review. If the old QR code or setup key was exposed, do not reuse that authenticator for a new setup.</p><a className={site.textLink} href="/settings/account/recovery">Request recovery review</a><AuthForm mode="logout"/></section>:<>
      <section className={s.section} id="identity-confirmation" aria-labelledby="recent-title"><h2 id="recent-title">{trusted.length?"Confirm a sensitive change.":"1. Confirm your identity."}</h2><p>{trusted.length?"Adding, replacing or removing an authenticator requires your current password and a trusted authenticator code within five minutes.":"Enter your current Mitsa account password. First-time setup does not require an existing authenticator."}</p>
        {confirmed?<p className={s.hint} role="status">Recent identity confirmation is available. Setup and verification must finish before it expires.</p>:null}
        <PostForm className={s.form} action="/auth/security" pendingLabel="Confirming your identity…"><input type="hidden" name="action" value="reauthenticate"/><PasswordField name="password" label="Current password" autoComplete="current-password"/>
          {trusted.length?<><label>Current authenticator<select name="factorId">{trusted.map((factor,index)=><option key={factor.id} value={factor.id}>{factor.friendly_name||`Authenticator ${index+1}`}</option>)}</select></label><label>Current authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required/></label></>:null}
          <button className={`${site.button} ${site.secondary}`} type="submit">Confirm identity</button>
        </PostForm>
      </section>
      {enrollment?<section className={s.section} aria-labelledby="enrollment-title"><h2 id="enrollment-title">{trusted.length?"Connect your new authenticator.":"2. Connect your authenticator."}</h2><p>Scan this newly generated QR code in Google Authenticator or another TOTP app. Enter the code from this new Mitsa entry in New authenticator code below. Keep the QR code and setup key private.</p><p>Setup expires with your five-minute password confirmation. A code from an older QR code will not verify this setup.</p>{qr?<img className={s.qr} src={qr} width={224} height={224} alt="Mitsa authenticator setup QR code"/>:null}<div className={s.form}><span>Manual setup key</span><code className={s.secret} data-testid="mfa-manual-key">{enrollment.secret}</code></div>
        <PostForm className={s.form} action="/auth/security" pendingLabel="Verifying your new authenticator…"><input type="hidden" name="action" value="verify-enrollment"/><label>New authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/></label><button className={site.button} type="submit">Confirm new authenticator</button></PostForm>
        <PostForm className={s.form} action="/auth/security" pendingLabel="Canceling setup…"><input type="hidden" name="action" value="cancel-enrollment"/><button className={`${site.button} ${site.secondary}`} type="submit">Cancel setup</button></PostForm>
      </section>:<section className={s.section} aria-labelledby="add-title"><h2 id="add-title">{state.initialized?"Add a backup authenticator.":"2. Set up your authenticator."}</h2><p>{pending.length?"Cancel your unfinished setup below before creating a new QR code. This prevents accidental reuse of old or exposed secrets.":confirmed?"Start a new setup, then scan and verify its code before your identity confirmation expires.":"Complete password confirmation above before starting a new setup."}</p>
        <PostForm className={s.form} action="/auth/security" pendingLabel="Preparing your authenticator…"><input type="hidden" name="action" value="enroll"/><label>Authenticator name<input name="label" maxLength={50} defaultValue={state.initialized?"Backup authenticator":"My authenticator"} required/></label><button className={site.button} type="submit" disabled={!confirmed||pending.length>0}>Start authenticator setup</button></PostForm>
      </section>}
    </>}
    {pending.filter(f=>f.id!==enrollment?.factorId).map(factor=><section className={s.section} key={factor.id} aria-label="Unfinished authenticator setup"><h2>Unfinished setup</h2><p>{expired?"This setup has expired or is no longer connected to this session. It has not been verified. Cancel it to discard the old secret, then confirm your identity and create a fresh setup.":"This setup has not been verified. Cancel it if its QR code or setup key was exposed."}</p><PostForm className={s.form} action="/auth/security" pendingLabel="Canceling unfinished setup…"><input type="hidden" name="action" value="cancel-unverified"/><input type="hidden" name="factorId" value={factor.id}/><button className={`${site.button} ${site.secondary}`} type="submit">Cancel unfinished setup</button></PostForm></section>)}
    {trusted.length?<section className={s.section} aria-labelledby="manage-title"><h2 id="manage-title">Your verified authenticators.</h2><p>Verify a replacement before removing an old device. Removing your last authenticator blocks Business Owner and Admin access until safe reenrollment.</p>{trusted.map((factor,index)=><PostForm className={s.form} action="/auth/security" key={factor.id}><input type="hidden" name="action" value="remove"/><input type="hidden" name="factorId" value={factor.id}/><label className={s.checkbox}><input type="checkbox" name="confirm" required/><span>Remove {factor.friendly_name||`Authenticator ${index+1}`}.</span></label><button className={`${site.button} ${site.secondary}`} type="submit">Remove authenticator</button></PostForm>)}
      {unbound.length?<p>An additional verified authenticator has an incomplete Mitsa setup. It is preserved and needs review before use.</p>:null}
      <PostForm className={s.form} action="/auth/security"><input type="hidden" name="action" value="disable"/><input type="hidden" name="factorId" value={trusted[0].id}/><label className={s.checkbox}><input type="checkbox" name="confirm" required/><span>I understand that disabling all authenticators blocks Business Owner and Admin access until reenrollment.</span></label><button className={`${site.button} ${site.secondary}`} type="submit">Disable MFA</button></PostForm>
    </section>:null}
    {state.pendingRemovals.map(permit=><PostForm className={s.form} action="/auth/security" key={permit.id}><input type="hidden" name="action" value="retry-removal"/><input type="hidden" name="permitId" value={permit.id}/><p>A previously authorized removal is pending.</p><button className={site.button} type="submit">Retry pending removal</button></PostForm>)}
    <p className={s.note}>Isolated test environment · Password recovery does not remove MFA requirements.</p>
  </main></FormActionGroup></InteriorShell>;
}
