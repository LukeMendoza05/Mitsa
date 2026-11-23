import {it,expect,vi} from 'vitest';
import {OnboardingBrowserDriver} from '../../scripts/lib/onboarding-browser-driver.mjs';
function fixture(){
 const origin='http://127.0.0.1:3000',state={path:'/signup',authenticated:false,mfa:false,members:0,recoveryMfa:false,fail:'',filled:[] as string[]};
 const path=(p:string)=>{state.path=p;};
 const field=(name:string)=>({
  fill:vi.fn(async(_value:string)=>{state.filled.push(name);if(state.fail===name)throw Error('PRIVATE-CREDENTIAL-OR-CODE');}),
  check:vi.fn(async()=>{}),selectOption:vi.fn(async()=>{}),inputValue:vi.fn(async()=>name.includes('termsVersion')?'terms-id':'privacy-id'),
  textContent:vi.fn(async()=>'JBSWY3DPEHPK3PXP'),isEnabled:vi.fn(async()=>true),
  waitFor:vi.fn(async()=>{}),
  isVisible:vi.fn(async()=>name!=='Update password'||state.recoveryMfa),
  click:vi.fn(async()=>{
   if(name==='Create account')path('/verify-email');
   if(name==='Verify email'){state.authenticated=true;path('/onboarding');}
   if(name==='Confirm identity')path('/settings/account/security?updated=reauthenticated');
   if(name==='Confirm new authenticator'){state.mfa=true;path('/settings/account/security?updated=enrolled');}
   if(name==='/^Create workspace/'){state.members=1;path('/w/workspace-10000000-0000-4000-8000-000000000001');}
   if(name==='Sign out'){state.authenticated=false;state.mfa=false;path('/login');}
   if(name==='Sign in'){state.authenticated=true;state.mfa=false;path('/workspaces');}
   if(name==='Verify authenticator'){state.mfa=true;path('/workspaces');}
   if(name==='Request reset link')path('/forgot-password?sent=1');
   if(name==='Continue password reset'){state.authenticated=true;state.mfa=false;}
   if(name==='Verify recovery authenticator'){state.mfa=true;state.recoveryMfa=true;}
   if(name==='Update password'){state.authenticated=false;state.mfa=false;path('/login');}
  })
 });
 const page={goto:vi.fn(async(url:string)=>{const u=new URL(url);path(u.pathname==='/auth/email'?'/reset-password':u.pathname==='/workspaces'&&!state.authenticated?'/login':u.pathname);}),
  waitForResponse:vi.fn(async()=>{}),waitForURL:vi.fn(async(check:(url:URL)=>boolean)=>{if(!check(new URL(state.path,origin)))throw Error('PRIVATE-URL');}),url:()=>new URL(state.path,origin).href,
  getByRole:(_role:string,{name}:any)=>field(String(name)),getByLabel:(name:string)=>field(name),getByTestId:(name:string)=>field(name),locator:(name:string)=>field(name)};
 const d={label:'e-a',origin,page,privacy:{screenshots:false,traces:false,videos:false},fixture:{label:'e-a',email:'offline+e-a@gmail.com',password:'PRIVATE-ORIGINAL-PASSWORD',fullName:'Synthetic A',businessName:'Synthetic Business A',locationName:'Synthetic Warehouse A'},notices:{termsId:'terms-id',privacyId:'privacy-id'},recoveryPassword:'PRIVATE-REPLACEMENT-PASSWORD',
  assertRecipient:(label:string,email:string)=>label==='e-a'&&email==='offline+e-a@gmail.com',assertExecutionReady:vi.fn(async()=>true),assertFixtureAbsent:vi.fn(async()=>true),persistPrivate:vi.fn(async(_value:any)=>{}),assertMutationAllowed:vi.fn(async(_kind:string,_label:string)=>{}),now:()=>60000,
  awaitRecoveryCapacity:vi.fn(async()=>true),waitForHumanTurnstile:vi.fn(async()=>{}),confirmInbox:vi.fn(async()=>true),latestDeliveredMessage:vi.fn(async(_label:string,kind:string)=>({recipientBound:true,intentBound:true,providerIssued:true,smtpAccepted:true,code:kind==='signup'?'123456':'',tokenHash:'a'.repeat(64)})),
  inspectRegistration:vi.fn(async()=>({providerUserCreated:true,serverTurnstileVerified:true,signedIntentBound:true,consentMatches:true,noDeveloperAllowlist:true})),
  inspectSession:vi.fn(async()=>({fixtureMatches:true,emailConfirmed:true,mfaReady:state.mfa,aal:state.mfa?'aal2':'aal1',membershipCount:state.members,platformOperator:false,role:'owner',workspaceSlug:'workspace-10000000-0000-4000-8000-000000000001',locationMatches:true})),
  identifyExactSession:vi.fn(async()=>{}),verifyExactLogout:vi.fn(async()=>({sessionRevoked:true,refreshDenied:true,formerBearerDenied:true})),workspaceDeniedAtAal1:vi.fn(async()=>true),snapshotRecoveryInvariants:vi.fn(async()=>{}),recoveryTokenUnusedBeforePost:vi.fn(async()=>true),
  inspectRecoveryEffects:vi.fn(async()=>({passwordChanged:true,factorBindingsUnchanged:true,workspaceOwnershipUnchanged:true,tokenReplayDenied:true,priorSessionDenied:true}))};
 return {d,state,driver:new OnboardingBrowserDriver(d)};
}
async function complete(f:ReturnType<typeof fixture>){await f.driver.signup();await f.driver.verifyEmail();await f.driver.enrollMfa();await f.driver.createWorkspace();await f.driver.logout();await f.driver.returningLogin();}
it('drives actual form selectors through signup/email/MFA/workspace/logout/return using only supplied OFFLINE ports',async()=>{
 const f=fixture();await complete(f);expect(f.driver.status()).toMatchObject({phase:'returning-access',hostedAcceptanceCompleted:false,checks:{signup:true,emailVerified:true,trustedMfa:true,workspaceOwner:true,logout:true,returningMfaLogin:true}});
 expect(f.d.assertMutationAllowed.mock.calls.map(c=>c[0])).toEqual(['newAccounts','newFactors','newWorkspaces','newLocations']);expect(f.d.waitForHumanTurnstile).toHaveBeenCalledWith('e-a','signup');
 const text=JSON.stringify(f.driver.status());for(const secret of [f.d.fixture.email,f.d.fixture.password,'123456','JBSWY3DPEHPK3PXP'])expect(text).not.toContain(secret);
});
it('does not reload the security page already rendered by verification, and still independently checks trusted MFA',async()=>{const f=fixture();await f.driver.signup();await f.driver.verifyEmail();f.state.path='/settings/account/security?updated=email-verified';f.d.page.goto.mockClear();f.d.inspectSession.mockClear();await f.driver.enrollMfa();expect(f.d.page.goto).not.toHaveBeenCalled();expect(f.d.inspectSession.mock.calls.length).toBeGreaterThanOrEqual(2);expect(f.driver.status().checks.trustedMfa).toBe(true);});
it('requires real inbox confirmation rather than treating capture or SMTP as receipt',async()=>{
 const f=fixture();await f.driver.signup();f.d.confirmInbox.mockResolvedValue(false);await expect(f.driver.verifyEmail()).rejects.toThrow('verify-email failed');expect(f.state.filled).not.toContain('Verification code');expect(f.driver.status().phase).toBe('failed');
});
it('denies an existing fixture without creating another identity or recording a refunded creation',async()=>{
 const f=fixture();f.d.assertFixtureAbsent.mockResolvedValue(false);await expect(f.driver.signup()).rejects.toThrow('signup failed');expect(f.d.assertMutationAllowed).not.toHaveBeenCalled();await expect(f.driver.signup()).rejects.toThrow();
});
it('refuses wrong notices and invalid server signup evidence',async()=>{
 const f=fixture();const wrong=new OnboardingBrowserDriver({...f.d,notices:{...f.d.notices,termsId:'wrong'}});await expect(wrong.signup()).rejects.toThrow();expect(f.d.assertMutationAllowed).not.toHaveBeenCalled();
 const g=fixture();g.d.inspectRegistration.mockResolvedValue({providerUserCreated:true,serverTurnstileVerified:false,signedIntentBound:true,consentMatches:true,noDeveloperAllowlist:true});await expect(g.driver.signup()).rejects.toThrow();expect(g.d.assertMutationAllowed).toHaveBeenCalledWith('newAccounts','e-a');
});
it('does not grant MFA trust from successful navigation or allow signup to grant workspace privileges',async()=>{
 const f=fixture();await f.driver.signup();f.state.members=1;await expect(f.driver.verifyEmail()).rejects.toThrow();
 const g=fixture();await g.driver.signup();await g.driver.verifyEmail();g.d.inspectSession.mockImplementation(async()=>({fixtureMatches:true,emailConfirmed:true,mfaReady:false,aal:'aal1',membershipCount:0,platformOperator:false,role:'owner',workspaceSlug:'unused',locationMatches:true}));await expect(g.driver.enrollMfa()).rejects.toThrow();expect(g.driver.status().checks.trustedMfa).toBeUndefined();
});
it('does not claim logout from a redirected page alone',async()=>{
 const f=fixture();await f.driver.signup();await f.driver.verifyEmail();await f.driver.enrollMfa();await f.driver.createWorkspace();f.d.verifyExactLogout.mockResolvedValue({sessionRevoked:true,refreshDenied:false,formerBearerDenied:true});await expect(f.driver.logout()).rejects.toThrow('logout failed');expect(f.driver.status().checks.logout).toBeUndefined();
});
it('preserves failed/uncertain steps and suppresses private field errors without automatic retries',async()=>{
 const f=fixture();f.state.fail='Password';await expect(f.driver.signup()).rejects.toThrow(/^Onboarding signup failed; private values suppressed; no automatic retry$/);expect(f.driver.state.attempted.signup).toBe(true);expect(f.driver.status().phase).toBe('failed');expect(f.d.assertMutationAllowed).not.toHaveBeenCalled();
});
it('requires disabled private recordings and execution authority before browser operations',async()=>{
 const f=fixture();expect(()=>new OnboardingBrowserDriver({...f.d,privacy:{screenshots:true,traces:false,videos:false}})).toThrow();f.d.assertExecutionReady.mockRejectedValue(Error('PRIVATE-KEY'));await expect(f.driver.signup()).rejects.toThrow(/^Onboarding execution unavailable$/);expect(f.d.page.goto).not.toHaveBeenCalled();expect(f.driver.state.attempted.signup).toBeUndefined();
});
it('runs real recovery form steps with retained MFA and a privately persisted replacement before mutation',async()=>{
 const f=fixture();await complete(f);await f.driver.recoverPassword();expect(f.driver.status()).toMatchObject({phase:'recovered-access',checks:{passwordRecovery:true},hostedAcceptanceCompleted:false});expect(f.d.waitForHumanTurnstile).toHaveBeenCalledWith('e-a','recovery');expect(f.d.recoveryTokenUnusedBeforePost).toHaveBeenCalledOnce();expect(f.d.inspectRecoveryEffects).toHaveBeenCalledOnce();expect(JSON.stringify(f.driver.status())).not.toContain(f.d.recoveryPassword);
});
it('does not confirm recovery when an old token replays or factor/ownership invariants change',async()=>{
 const f=fixture();await complete(f);f.d.inspectRecoveryEffects.mockResolvedValue({passwordChanged:true,factorBindingsUnchanged:false,workspaceOwnershipUnchanged:true,tokenReplayDenied:false,priorSessionDenied:true});await expect(f.driver.recoverPassword()).rejects.toThrow('password-recovery failed');expect(f.driver.status().checks.passwordRecovery).toBeUndefined();
});
it('sanitizes evidence-storage failure before creating or verifying anything',async()=>{
 const f=fixture();f.d.persistPrivate.mockRejectedValue(Error('PRIVATE-TOTP-SECRET'));await expect(f.driver.signup()).rejects.toThrow(/^Private onboarding evidence could not be persisted$/);expect(f.d.page.goto).not.toHaveBeenCalled();
});
it('pins the approved recipient and notice references against later input mutation',async()=>{
 const f=fixture();expect(()=>new OnboardingBrowserDriver({...f.d,fixture:{...f.d.fixture,email:'unapproved@example.com'}})).toThrow('recipient binding failed');
 f.d.fixture.email='unapproved@example.com';f.d.notices.termsId='wrong';await f.driver.signup();expect(f.driver.d.fixture.email).toBe('offline+e-a@gmail.com');expect(f.driver.d.notices.termsId).toBe('terms-id');
});
