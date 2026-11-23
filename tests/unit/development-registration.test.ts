import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {validDevelopmentRegistration,developmentRecipientAllowed,developmentRegistrationRuntime,developmentDeliveryState} from '../../src/lib/auth/development-registration';
import {recipientHash,controlledSenderAliasAllowed,developmentMailCapacity,requireRegistrationEvidence} from '../../scripts/lib/development-mail.mjs';
const now=Date.now(),id=crypto.randomUUID(),email='synthetic-controlled@example.com';
const runtime={version:1,project:'mjtejwafxriwntweussc',origin:'http://127.0.0.1:3000',runId:id,phase:'controlled',approvedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+20*60000).toISOString(),recipientHash:recipientHash(email)};
const status={runId:id,checkedAt:new Date(now-100).toISOString(),deliveryReady:true,capacityAvailable:true};
beforeEach(()=>vi.stubEnv('NODE_ENV','test'));
afterEach(()=>vi.unstubAllEnvs());
it('accepts only the bounded current operator run with a fresh healthy delivery heartbeat',()=>{
 expect(validDevelopmentRegistration(runtime,status,now)).toEqual(runtime);
 for(const change of [{runId:crypto.randomUUID()},{deliveryReady:false},{capacityAvailable:false},{checkedAt:new Date(now-15001).toISOString()},{checkedAt:new Date(now+1001).toISOString()}])expect(validDevelopmentRegistration(runtime,{...status,...change},now)).toBeNull();
});
it('fails closed for a different target, origin, expired/oversized window and malformed runtime',()=>{
 for(const change of [{project:'another-project'},{origin:'http://localhost:3000'},{expiresAt:new Date(now-1).toISOString()},{expiresAt:new Date(now+31*60000).toISOString()},{recipientHash:undefined},{extra:'unexpected'}])expect(validDevelopmentRegistration({...runtime,...change},status,now)).toBeNull();
 expect(validDevelopmentRegistration(null,status,now)).toBeNull();
});
it('limits controlled tests to a recipient hash but has no recipient eligibility restriction in general mode',()=>{
 const controlled=validDevelopmentRegistration(runtime,status,now)!;
 expect(developmentRecipientAllowed(controlled,email)).toBe(true);expect(developmentRecipientAllowed(controlled,'different@example.com')).toBe(false);
 const {recipientHash:_,...general}=runtime;
 const parsed=validDevelopmentRegistration({...general,phase:'general',expiresAt:new Date(now+119*60000).toISOString()},status,now)!;
 expect(parsed).not.toBeNull();expect(developmentRecipientAllowed(parsed,'new@example.com')).toBe(true);
 expect(validDevelopmentRegistration({...general,phase:'general',recipientHash:runtime.recipientHash},status,now)).toBeNull();
});
it('distinguishes delivery availability, paused service and a closed window without exposing identity',()=>{
 expect(developmentDeliveryState(runtime,status,email,now)).toBe('available');
 expect(developmentDeliveryState(runtime,{...status,deliveryReady:false},email,now)).toBe('paused');
 expect(developmentDeliveryState(runtime,status,email,Date.parse(runtime.expiresAt)+1)).toBe('closed');
 expect(developmentDeliveryState(runtime,status,'unapproved@example.com',now)).toBe('paused');
 expect(developmentDeliveryState(null,status,email,now)).toBe('unavailable');
 expect(developmentDeliveryState(runtime,{...status,runId:crypto.randomUUID()},email,now)).toBe('unavailable');
 expect(validDevelopmentRegistration({...runtime,registrationAllowed:false},status,now)?.registrationAllowed).toBe(false);
});
it('cannot read or activate a development runtime from production or a different origin',async()=>{
 vi.stubEnv('NODE_ENV','production');vi.stubEnv('MITSA_REGISTRATION_MODE','development-open');vi.stubEnv('MITSA_AUTH_MAIL_MODE','isolated-capture');
 expect(await developmentRegistrationRuntime(runtime.origin)).toBeNull();vi.stubEnv('NODE_ENV','development');expect(await developmentRegistrationRuntime('https://mitsa.vercel.app')).toBeNull();
});
it('enforces conservative project and controlled-run delivery budgets',()=>{
 expect(developmentMailCapacity({hourly:0,daily:0,run:0},'controlled')).toBe(true);
 for(const counts of [{hourly:10,daily:10,run:1},{hourly:1,daily:20,run:1},{hourly:1,daily:1,run:4},{hourly:-1,daily:1,run:1},{hourly:NaN,daily:1,run:1}])expect(developmentMailCapacity(counts,'controlled')).toBe(false);
 expect(developmentMailCapacity({hourly:1,daily:1,run:4},'general')).toBe(true);
});
it('permits only a fresh-format controlled alias of the approved dedicated Gmail sender',()=>{
 expect(controlledSenderAliasAllowed('synthetic.sender@gmail.com','synthetic.sender+onboarding-abcdef123456@gmail.com')).toBe(true);
 for(const value of ['different+onboarding-abcdef123456@gmail.com','synthetic.sender@gmail.com','synthetic.sender+other-abcdef123456@gmail.com','synthetic.sender+onboarding-abcdef123456@other.example','synthetic.sender+onboarding-short@gmail.com'])expect(controlledSenderAliasAllowed('synthetic.sender@gmail.com',value)).toBe(false);
});
it('requires actual server success, replay AND expiration plus security evidence before controlled activation',()=>{
 const live={project:runtime.project,serverVerificationPassed:true,replayRejected:true,expirationRejected:true};
 const security={project:runtime.project,localSecurityTestsPassed:true,preservationPassed:true,directApiBypassRejected:true};
 expect(()=>requireRegistrationEvidence(live,security,'controlled',null)).not.toThrow();
 for(const key of ['serverVerificationPassed','replayRejected','expirationRejected'])expect(()=>requireRegistrationEvidence({...live,[key]:false},security,'controlled',null)).toThrow();
 expect(()=>requireRegistrationEvidence(live,{...security,directApiBypassRejected:false},'controlled',null)).toThrow();
 expect(()=>requireRegistrationEvidence(live,security,'general',null)).toThrow();
 const onboarding={project:runtime.project,newUnallowlistedAccount:true,...Object.fromEntries(['captcha','realInboxReceipt','emailVerification','resend','mfa','workspaceOwner','initialLocation','signOut','returningSignIn','workspacePersistence','tenantIsolation','recovery'].map(key=>[key,true]))};
 expect(()=>requireRegistrationEvidence(live,security,'general',onboarding)).toThrow('Authentication security sign-off incomplete');
 const signoff={...security,sessionSpecificLogoutPassed:true,rotatedRefreshReplayProtected:true,authenticatedTenantIsolationPassed:true};
 expect(()=>requireRegistrationEvidence(live,signoff,'general',onboarding)).not.toThrow();expect(()=>requireRegistrationEvidence(live,signoff,'general',{...onboarding,realInboxReceipt:false})).toThrow();
 for(const key of ['sessionSpecificLogoutPassed','rotatedRefreshReplayProtected','authenticatedTenantIsolationPassed']) {
  expect(()=>requireRegistrationEvidence(live,{...signoff,[key]:false},'general',onboarding)).toThrow('Authentication security sign-off incomplete');
  expect(()=>requireRegistrationEvidence(live,{...signoff,[key]:undefined},'general',onboarding)).toThrow('Authentication security sign-off incomplete');
 }
});
it('never substitutes a generic rejection for expiry without an explicit scoped decision and independent signup/lifecycle evidence',()=>{
 const live={project:runtime.project,serverVerificationPassed:true,replayRejected:true,expirationRejected:false,heldUnusableProofRejected:true,expiryTestProviderCode:'invalid-input-response'};
 const security={project:runtime.project,localSecurityTestsPassed:true,preservationPassed:true,directApiBypassRejected:true,signupEndpointLifecycleTestsPassed:true,originalProofRetentionRegressionsPassed:true};
 const decision={version:1,project:runtime.project,approvedByUser:true,scope:'isolated-development-only',acceptedEvidence:'held-unusable-proof-rejection-and-server-freshness-regressions'};
 expect(()=>requireRegistrationEvidence(live,security,'controlled',null)).toThrow();
 for(const change of [{approvedByUser:false},{scope:'production'},{project:'other-project'},{acceptedEvidence:'frontend-success-only'}])expect(()=>requireRegistrationEvidence(live,security,'controlled',null,{...decision,...change})).toThrow();
 for(const key of ['signupEndpointLifecycleTestsPassed','originalProofRetentionRegressionsPassed'])expect(()=>requireRegistrationEvidence(live,{...security,[key]:false},'controlled',null,decision)).toThrow();
 expect(requireRegistrationEvidence(live,security,'controlled',null,decision)).toEqual({expiryQualification:'explicitly-approved-rejection-and-server-freshness-evidence'});
 expect(live.expirationRejected).toBe(false);
 expect(()=>requireRegistrationEvidence(live,security,'general',null,decision)).toThrow();
});
