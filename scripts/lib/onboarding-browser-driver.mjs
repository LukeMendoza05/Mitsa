// Browser driver port; importing never launches a browser, Auth call or worker.
import assert from 'node:assert/strict';
import {totp} from '../../tests/support/totp.ts';
const privateFill=async(field,value)=>{try{await field.fill(value);}catch{throw Error('Private onboarding input failed; value suppressed');}};
const publicPhases=new Set(['new','pending-verification','verified','mfa-ready','workspace-ready','signed-out','returning-access','recovered-access','failed']);
/** Uses normal application forms. Never creates allowlist records, verifies an
 * account administratively, binds factors directly, or creates a workspace RPC
 * outside the app's trusted transaction. Dependencies must be reviewed/bounded
 * by the future execution shell; this port itself grants NO execution authority.
 */
export class OnboardingBrowserDriver {
 constructor(d){
  assert(['e-a','e-b'].includes(d.label),'Unapproved onboarding fixture');
  assert(d.origin==='http://127.0.0.1:3000','Unapproved onboarding origin');
  assert(d.privacy?.screenshots===false&&d.privacy?.traces===false&&d.privacy?.videos===false,'Private browser recording must be disabled');
  assert(d.fixture?.label===d.label&&typeof d.fixture.email==='string'&&typeof d.fixture.password==='string','Missing immutable fixture');
  try{assert(d.assertRecipient(d.label,d.fixture.email)===true);}catch{throw Error('Approved onboarding recipient binding failed');}
  this.d={...d,fixture:Object.freeze({...d.fixture}),notices:Object.freeze({...d.notices})};this.state={label:d.label,phase:'new',attempted:/** @type {Record<string,boolean>} */({}),checks:/** @type {Record<string,boolean>} */({})};
 }
 async step(name,phases,operation){
  assert(phases.includes(this.state.phase),'Onboarding step is out of order');
  assert(!this.state.attempted[name],'Onboarding step already attempted; no automatic retry');
  try{await this.d.assertExecutionReady(this.d.label);}catch{throw Error('Onboarding execution unavailable');} // strict approval and all transports counted
  this.state.attempted[name]=true;await this.persist();
  try{const result=await operation();await this.persist();return result;}
  catch(error){this.state.phase='failed';this.state.failure=name;
   // Private evidence only: the concrete entry encrypts this before disk/IPC.
   // Never forward Playwright/provider details into the public result or logs.
   this.state.privateFailure={category:error?.name??'Error',detail:String(error?.message??'Unavailable').slice(0,4096)};
   await this.persist();throw Error(`Onboarding ${name} failed; private values suppressed; no automatic retry`);}
 }
 async persist(){try{await this.d.persistPrivate(this.state);}catch{throw Error('Private onboarding evidence could not be persisted');}}
 async path(pattern){await this.d.page.waitForURL(url=>url.origin===this.d.origin&&pattern.test(url.pathname));}
 async session({verified=true,mfaReady,empty=false}={}){
  const s=await this.d.inspectSession(this.d.label);
  assert(s.fixtureMatches===true&&s.emailConfirmed===verified,'Fixture identity or verification mismatch');
  if(mfaReady!==undefined)assert(s.mfaReady===mfaReady&&(mfaReady?s.aal==='aal2':true),'MFA assurance mismatch');
  if(empty)assert(s.membershipCount===0&&s.platformOperator===false,'New fixture has unexpected privileges');
  return s;
 }
 async signup(){return this.step('signup',['new'],async()=>{
  const {page,fixture}=this.d;assert(await this.d.assertFixtureAbsent(this.d.label),'Fixture already exists');
  await page.goto(this.d.origin+'/signup');assert(await page.getByRole('heading',{name:'Make room for your business.',exact:true}).isVisible(),'Signup unavailable or wrong browser session');
  assert(await page.locator('input[name="termsVersion"]').inputValue()===this.d.notices.termsId,'Terms mismatch');
  assert(await page.locator('input[name="privacyVersion"]').inputValue()===this.d.notices.privacyId,'Privacy mismatch');
  await privateFill(page.getByLabel('Full name',{exact:true}),fixture.fullName);await privateFill(page.getByLabel('Email',{exact:true}),fixture.email);
  await privateFill(page.getByLabel('Password',{exact:true}),fixture.password);await privateFill(page.getByLabel('Confirm password',{exact:true}),fixture.password);
  await this.d.waitForHumanTurnstile(this.d.label,'signup'); // widget only; server proof is checked below
  await page.locator('input[name="accepted"]').check();
  const submit=page.getByRole('button',{name:'Create account',exact:true});assert(await submit.isEnabled(),'Signup disabled');
  await this.d.assertMutationAllowed('newAccounts',this.d.label);await submit.click();await this.path(/^\/verify-email$/);
  const proof=await this.d.inspectRegistration(this.d.label);
  assert(proof.providerUserCreated&&proof.serverTurnstileVerified&&proof.signedIntentBound&&proof.consentMatches&&proof.noDeveloperAllowlist,'Registration authorization unconfirmed');
  this.state.phase='pending-verification';this.state.checks.signup=true;
 });}
 async verifyEmail(){return this.step('verify-email',['pending-verification'],async()=>{
  assert(await this.d.confirmInbox(this.d.label,'signup')===true,'Human inbox receipt missing');
  const message=await this.d.latestDeliveredMessage(this.d.label,'signup');
  assert(message.recipientBound&&message.intentBound&&message.providerIssued&&message.smtpAccepted&&/^\d{6}$/.test(message.code),'Provider message binding unconfirmed');
  await privateFill(this.d.page.getByLabel('Verification code',{exact:true}),message.code);
  await this.d.page.getByRole('button',{name:'Verify email',exact:true}).click();await this.path(/^\/(?:onboarding|settings\/account\/security|workspaces)$/);
  await this.session({mfaReady:false,empty:true});this.state.phase='verified';this.state.checks.emailVerified=true;
 });}
 async enrollMfa(){return this.step('enroll-mfa',['verified'],async()=>{
  const {page,fixture}=this.d;await this.session({mfaReady:false,empty:true});
  // Successful email verification already renders this page. Preserve its
  // verified identity checks without a second identical SSR navigation.
  if(new URL(page.url()).pathname!=='/settings/account/security')await page.goto(this.d.origin+'/settings/account/security');
  await privateFill(page.getByLabel('Current password',{exact:true}),fixture.password);await page.getByRole('button',{name:'Confirm identity',exact:true}).click();
  await page.waitForURL(url=>url.origin===this.d.origin&&url.pathname==='/settings/account/security'&&url.searchParams.get('updated')==='reauthenticated');
  await this.d.assertMutationAllowed('newFactors',this.d.label);await page.getByRole('button',{name:'Start authenticator setup',exact:true}).click();
  const secret=await page.getByTestId('mfa-manual-key').textContent();assert(typeof secret==='string'&&/^[A-Z2-7]{16,}$/.test(secret),'Synthetic MFA secret unavailable');
  this.state.totpSecret=secret;await this.persist(); // encrypt before attempting verification
  await privateFill(page.getByLabel('New authenticator code',{exact:true}),totp(secret,this.d.now()));await page.getByRole('button',{name:'Confirm new authenticator',exact:true}).click();
  await page.waitForURL(url=>url.origin===this.d.origin&&url.pathname==='/settings/account/security'&&url.searchParams.get('updated')==='enrolled');
  await this.session({mfaReady:true,empty:true});this.state.phase='mfa-ready';this.state.checks.trustedMfa=true;
 });}
 async createWorkspace(){return this.step('create-workspace',['mfa-ready'],async()=>{
  const {page,fixture}=this.d;await this.session({mfaReady:true,empty:true});await page.goto(this.d.origin+'/onboarding');
  await privateFill(page.getByLabel('Business name',{exact:true}),fixture.businessName);await privateFill(page.getByLabel('First location name',{exact:true}),fixture.locationName);
  await page.getByLabel('Location type',{exact:true}).selectOption('warehouse');
  await this.d.assertMutationAllowed('newWorkspaces',this.d.label);await this.d.assertMutationAllowed('newLocations',this.d.label);
  await page.getByRole('button',{name:/^Create workspace/}).click();await this.path(/^\/w\/workspace-[a-f0-9-]+$/);
  const s=await this.session({mfaReady:true});assert(s.membershipCount===1&&s.role==='owner'&&s.platformOperator===false&&s.locationMatches===true,'Workspace ownership unconfirmed');
  assert(s.workspaceSlug===new URL(page.url()).pathname.split('/')[2],'Workspace identity mismatch');
  this.state.workspaceSlug=s.workspaceSlug;this.state.phase='workspace-ready';this.state.checks.workspaceOwner=true;
 });}
 async logout(){return this.step('logout',['workspace-ready'],async()=>{
  const {page}=this.d;await this.d.identifyExactSession(this.d.label);await page.goto(this.d.origin+'/workspaces');await page.getByRole('button',{name:'Sign out',exact:true}).click();await this.path(/^\/login$/);
  await page.goto(this.d.origin+'/workspaces');await this.path(/^\/login$/);
  const denied=await this.d.verifyExactLogout(this.d.label);assert(denied.sessionRevoked&&denied.refreshDenied&&denied.formerBearerDenied,'Exact-session logout unconfirmed');
  this.state.phase='signed-out';this.state.checks.logout=true;
 });}
 async signInAndReopen(password){
  const {page,fixture}=this.d;await page.goto(this.d.origin+'/login');await privateFill(page.getByLabel('Email',{exact:true}),fixture.email);await privateFill(page.getByLabel('Password',{exact:true}),password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await this.path(/^\/(?:workspaces|settings\/account\/security)$/);
  await this.session({mfaReady:false});assert(await this.d.workspaceDeniedAtAal1(this.d.label),'AAL1 workspace access unexpectedly allowed');
  await page.goto(this.d.origin+'/settings/account/security');await privateFill(page.getByLabel('Authenticator code',{exact:true}),totp(this.state.totpSecret,this.d.now()));
  await page.getByRole('button',{name:'Verify authenticator',exact:true}).click();await this.path(/^\/workspaces$/);
  const s=await this.session({mfaReady:true});assert(s.role==='owner'&&s.membershipCount===1&&s.workspaceSlug===this.state.workspaceSlug&&s.locationMatches===true,'Returning workspace changed');
  await page.goto(this.d.origin+'/w/'+this.state.workspaceSlug);await this.path(/^\/w\/workspace-[a-f0-9-]+$/);
 }
 async returningLogin(){return this.step('returning-login',['signed-out'],async()=>{
  await this.signInAndReopen(this.d.fixture.password);this.state.phase='returning-access';this.state.checks.returningMfaLogin=true;
 });}
 async recoverPassword(){return this.step('password-recovery',['returning-access'],async()=>{
  const {page,fixture}=this.d;
  assert(typeof this.d.recoveryPassword==='string'&&this.d.recoveryPassword!==fixture.password,'Fresh private fixture password required');
  assert(await this.d.awaitRecoveryCapacity(this.d.label)===true,'Durable recovery capacity unavailable');
  await this.d.snapshotRecoveryInvariants(this.d.label);
  await this.d.identifyExactSession(this.d.label);await page.goto(this.d.origin+'/workspaces');await page.getByRole('button',{name:'Sign out',exact:true}).click();await this.path(/^\/login$/);
  const logout=await this.d.verifyExactLogout(this.d.label);assert(logout.sessionRevoked&&logout.refreshDenied&&logout.formerBearerDenied,'Pre-recovery logout unconfirmed');
  await page.goto(this.d.origin+'/forgot-password');await privateFill(page.getByLabel('Email',{exact:true}),fixture.email);
  await this.d.waitForHumanTurnstile(this.d.label,'recovery');await page.getByRole('button',{name:'Request reset link',exact:true}).click();
  await page.waitForURL(url=>url.origin===this.d.origin&&url.pathname==='/forgot-password'&&url.searchParams.get('sent')==='1');
  assert(await this.d.confirmInbox(this.d.label,'recovery')===true,'Recovery inbox receipt missing');
  const message=await this.d.latestDeliveredMessage(this.d.label,'recovery');
  assert(message.recipientBound&&message.intentBound&&message.providerIssued&&message.smtpAccepted&&/^(pkce_)?[a-f0-9]{32,256}$/.test(message.tokenHash),'Recovery binding unconfirmed');
  const link=new URL('/auth/email',this.d.origin);link.searchParams.set('type','recovery');link.searchParams.set('token_hash',message.tokenHash);
  await page.goto(link.href);await this.path(/^\/reset-password$/);
  assert(await this.d.recoveryTokenUnusedBeforePost(this.d.label),'Scanner GET consumed recovery');
  // This POST redirects back to the SAME pathname. waitForURL alone can
  // resolve before the POST even starts and inspect the old logged-out token.
  await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&r.url()===this.d.origin+'/auth/email'&&[200,303].includes(r.status())),page.getByRole('button',{name:'Continue password reset',exact:true}).click()]);
  await page.getByRole('button',{name:'Verify recovery authenticator',exact:true}).waitFor({state:'visible'});await this.path(/^\/reset-password$/);
  await this.session({mfaReady:false});assert(await this.d.workspaceDeniedAtAal1(this.d.label),'Recovery AAL1 reached workspace');
  assert(await page.getByRole('button',{name:'Verify recovery authenticator',exact:true}).isVisible(),'Recovery did not require retained MFA');
  assert(!await page.getByRole('button',{name:'Update password',exact:true}).isVisible(),'Password update available before MFA');
  await privateFill(page.getByLabel('Recovery authenticator code',{exact:true}),totp(this.state.totpSecret,this.d.now()));
  await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&r.url()===this.d.origin+'/auth/password/challenge'&&[200,303].includes(r.status())),page.getByRole('button',{name:'Verify recovery authenticator',exact:true}).click()]);
  await page.getByRole('button',{name:'Update password',exact:true}).waitFor({state:'visible'});await this.session({mfaReady:true});
  this.state.updatedPassword=this.d.recoveryPassword;await this.persist(); // retain privately before uncertain password mutation
  await privateFill(page.getByLabel('New password',{exact:true}),this.state.updatedPassword);await privateFill(page.getByLabel('Confirm new password',{exact:true}),this.state.updatedPassword);
  await page.getByRole('button',{name:'Update password',exact:true}).click();await this.path(/^\/login$/);
  const effects=await this.d.inspectRecoveryEffects(this.d.label);
  assert(effects.passwordChanged&&effects.factorBindingsUnchanged&&effects.workspaceOwnershipUnchanged&&effects.tokenReplayDenied&&effects.priorSessionDenied,'Recovery effects unconfirmed');
  await this.signInAndReopen(this.state.updatedPassword);this.state.phase='recovered-access';this.state.checks.passwordRecovery=true;
 });}
 status(){assert(publicPhases.has(this.state.phase));return {fixture:this.d.label,phase:this.state.phase,checks:{...this.state.checks},hostedAcceptanceCompleted:false,privateValuesPrinted:false};}
}
