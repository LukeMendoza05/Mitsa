import {z} from 'zod';
export const stageBProject='mjtejwafxriwntweussc';
export const stageBMarker='fireworks-foundation-proof-01a12e38';
export type Fixture='plain'|'mfa';
const proof=z.object({approved:z.literal(true),approvalId:z.uuid(),projectRef:z.literal(stageBProject),databaseMarker:z.literal(stageBMarker),
 proposalSha256:z.string().regex(/^[a-f0-9]{64}$/),runnerSha256:z.string().regex(/^[a-f0-9]{64}$/),protocolSha256:z.string().regex(/^[a-f0-9]{64}$/),
 providerObservedAt:z.iso.datetime(),providerVersion:z.literal('v2.197.0'),sendEmailHook:z.literal('private.mitsa_isolated_send_email'),
 sendEmailHookEnabled:z.literal(true),beforeUserHook:z.literal('private.mitsa_before_user_created'),beforeUserHookEnabled:z.literal(true),
 currentPasswordRequired:z.literal(false),securePasswordChange:z.literal(false),globalCaptchaEnabled:z.literal(false),
 emailConfirmationRequired:z.literal(true),smtpClosed:z.literal(true),registrationClosed:z.literal(true)}).strict();
export function validateStageBProposal(value:unknown){return z.object({
 status:z.literal('prepared-unapproved-not-executed'),projectRef:z.literal(stageBProject),databaseMarker:z.literal(stageBMarker),
 phase:z.literal('provider-security-baseline-with-settings-unchanged'),maxNewSyntheticUsers:z.literal(2),
 identityPattern:z.literal('foundation-session-review-<random>@example.invalid'),maxNewVerifiedTotpFactors:z.literal(2),
 maxPasswordUpdates:z.literal(4),maxAdminRecoveryLinks:z.literal(2),maxPasswordSignins:z.literal(12),maxRefreshRequests:z.literal(12),maxExternalEmails:z.literal(0),
 emailRequestPath:z.string(),allowedApplicationWrites:z.array(z.string()),fixtureCredentialStorage:z.string(),completion:z.string(),
 providerSettingsChanged:z.literal(false),migrationsAllowed:z.literal(false),hookChangesAllowed:z.literal(false),
 workspaceOrMembershipCreationAllowed:z.literal(false),registrationActivationAllowed:z.literal(false),smtpOrWorkerActivationAllowed:z.literal(false),riskAcceptanceIncluded:z.literal(false)
}).strict().parse(value);}
export function validateStageBApproval(value:unknown,expected:{proposalSha256:string;runnerSha256:string;protocolSha256:string},now=Date.now()) {
 const approved=proof.parse(value),observed=Date.parse(approved.providerObservedAt);
 if(observed>now+5000||now-observed>900000||Object.entries(expected).some(([key,hash])=>approved[key as keyof typeof expected]!==hash))throw Error('Stage B approval or provider observation changed');
 return approved;
}
export function validateStageBResumeProposal(value:unknown){return z.object({
 status:z.literal('prepared-unapproved-not-executed'),projectRef:z.literal(stageBProject),databaseMarker:z.literal(stageBMarker),
 maxNewSyntheticUsers:z.literal(0),maxAdditionalVerifiedTotpFactors:z.literal(1),maxAdditionalPasswordUpdates:z.literal(3),
 cumulativeMaxPasswordUpdates:z.literal(5),maxAdditionalAdminRecoveryLinks:z.literal(2),cumulativeMaxPasswordSignins:z.literal(12),cumulativeMaxRefreshRequests:z.literal(12),maxExternalEmails:z.literal(0),
 priorCheckpointSha256:z.string().regex(/^[a-f0-9]{64}$/),priorCounts:z.object({create:z.literal(2),password:z.literal(2),recovery:z.literal(0),signin:z.literal(4),refresh:z.literal(1),enroll:z.literal(1),verifyNewFactor:z.literal(1)}).strict(),
 providerSettingsChanged:z.literal(false),migrationsAllowed:z.literal(false),hookChangesAllowed:z.literal(false),workspaceOrMembershipCreationAllowed:z.literal(false),registrationActivationAllowed:z.literal(false),smtpOrWorkerActivationAllowed:z.literal(false),riskAcceptanceIncluded:z.literal(false)
}).strict().parse(value);}
export function validateStageBResumeApproval(value:unknown,expected:{proposalSha256:string;runnerSha256:string;protocolSha256:string;checkpointSha256:string},now=Date.now()){
 const approved=proof.extend({resumeOnly:z.literal(true),checkpointSha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(value);
 if(approved.checkpointSha256!==expected.checkpointSha256)throw Error('Stage B checkpoint changed');
 const {resumeOnly:_,checkpointSha256:__,...baseline}=approved;
 validateStageBApproval(baseline,{proposalSha256:expected.proposalSha256,runnerSha256:expected.runnerSha256,protocolSha256:expected.protocolSha256},now);return approved;
}
export function validateStageBHardeningProposal(value:unknown){return z.object({
 status:z.literal('prepared-unapproved-not-executed'),projectRef:z.literal(stageBProject),databaseMarker:z.literal(stageBMarker),
 providerSetting:z.literal('Require current password when updating'),previousValue:z.literal(false),testValue:z.literal(true),
 maxNewSyntheticUsers:z.literal(0),maxNewVerifiedTotpFactors:z.literal(0),maxAdditionalPasswordUpdates:z.literal(10),maxAdditionalAdminRecoveryLinks:z.literal(2),maxAdditionalPasswordSignins:z.literal(8),maxAdditionalRefreshRequests:z.literal(8),maxExternalEmails:z.literal(0),
 priorCheckpointSha256:z.string().regex(/^[a-f0-9]{64}$/),priorCounts:z.object({create:z.literal(2),password:z.literal(5),recovery:z.literal(1),signin:z.literal(6),refresh:z.literal(1),enroll:z.literal(3),verifyNewFactor:z.literal(2)}).strict(),
 retainSettingOnSuccess:z.literal(true),restorePreviousSettingOnFailure:z.literal(true),migrationsAllowed:z.literal(false),hookChangesAllowed:z.literal(false),workspaceOrMembershipCreationAllowed:z.literal(false),registrationActivationAllowed:z.literal(false),smtpOrWorkerActivationAllowed:z.literal(false),riskAcceptanceIncluded:z.literal(false)
}).strict().parse(value);}
export function validateStageBHardeningApproval(value:unknown,expected:{proposalSha256:string;runnerSha256:string;protocolSha256:string;checkpointSha256:string},now=Date.now()){
 const approved=proof.extend({currentPasswordRequired:z.literal(true),hardeningOnly:z.literal(true),checkpointSha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(value),observed=Date.parse(approved.providerObservedAt);
 if(observed>now+5000||now-observed>900000||Object.entries(expected).some(([key,hash])=>approved[key as keyof typeof expected]!==hash))throw Error('Stage B hardening approval or observation changed');return approved;
}
export function validateStageBHardeningContinuationProposal(value:unknown){return z.object({
 status:z.literal('within-existing-approved-hardening-limits'),projectRef:z.literal(stageBProject),databaseMarker:z.literal(stageBMarker),
 stoppedCheckpointSha256:z.string().regex(/^[a-f0-9]{64}$/),originalProposalSha256:z.string().regex(/^[a-f0-9]{64}$/),
 priorHardeningCounts:z.object({create:z.literal(0),password:z.literal(6),recovery:z.literal(1),signin:z.literal(3),refresh:z.literal(0),enroll:z.literal(0),verifyNewFactor:z.literal(0)}).strict(),
 remainingPasswordAttempts:z.literal(4),cumulativeHardeningPasswordLimit:z.literal(10),cumulativeHardeningRecoveryLimit:z.literal(2),cumulativeHardeningSigninLimit:z.literal(8),cumulativeHardeningRefreshLimit:z.literal(8),newAccounts:z.literal(0),newFactors:z.literal(0),externalEmails:z.literal(0)
}).strict().parse(value);}
export function validateStageBHardeningContinuationAuthorization(value:unknown,expected:{proposalSha256:string;runnerSha256:string;protocolSha256:string;checkpointSha256:string;checkpointWriterSha256:string;originalApprovalId:string},now=Date.now()){
 const record=proof.extend({currentPasswordRequired:z.literal(true),hardeningOnly:z.literal(true),continueOnly:z.literal(true),
  authorizationSource:z.literal('existing-approved-hardening-scope'),originalApprovalId:z.uuid(),checkpointSha256:z.string().regex(/^[a-f0-9]{64}$/),checkpointWriterSha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(value),observed=Date.parse(record.providerObservedAt);
 if(observed>now+5000||now-observed>900000||Object.entries(expected).some(([key,value])=>record[key as keyof typeof expected]!==value))throw Error('Hardening continuation authorization changed');return record;
}
export function stageBProviderCode(error:unknown){
 const candidate=typeof error==='object'&&error!==null&&'code'in error?error.code:null;
 return typeof candidate==='string'&&['insufficient_aal','current_password_required','current_password_invalid','42501','PGRST301','otp_expired','session_not_found','refresh_token_not_found','refresh_token_already_used','session_expired','bad_jwt','no_authorization','user_banned','validation_failed','request_timeout','over_request_rate_limit'].includes(candidate)?candidate:'other';
}
/** A failed RPC is not evidence of an authenticated AAL1 readiness result. */
export function assertStageBReadiness(result:{data:unknown;error:unknown},expected:boolean,allowSessionDenial=false){
 if(result.error){
  if(!expected&&allowSessionDenial&&['42501','PGRST301'].includes(stageBProviderCode(result.error)))return;
  throw Error('Stage B readiness result unconfirmed');
 }
 if(typeof result.data!=='object'||result.data===null||!('ready'in result.data)||result.data.ready!==expected)throw Error('Unexpected Stage B readiness');
}
const limits={create:2,password:4,recovery:2,signin:12,refresh:12,enroll:3,verifyNewFactor:2} as const;
type Operation=keyof typeof limits;
const rpcNames=new Set(['mitsa_current_terms','mitsa_accept_terms','mitsa_prepare_enrollment','mitsa_bind_factor','mitsa_security_status','mitsa_identity']);
/** Restrict the operator SDK to this fixed protocol; count actual HTTP attempts. */
export function stageBRequestOperation(address:string,method:string):Operation|null {
 const url=new URL(address);
 if(url.origin!==`https://${stageBProject}.supabase.co`||url.username||url.password||url.hash)throw Error('Unexpected Stage B API target');
 const path=url.pathname,verb=method.toUpperCase();
 if(path.startsWith('/rest/v1/rpc/')&&verb==='POST'&&rpcNames.has(path.slice('/rest/v1/rpc/'.length)))return null;
 if(path==='/auth/v1/admin/users'&&verb==='POST')return 'create';
 if(path==='/auth/v1/admin/generate_link'&&verb==='POST')return 'recovery';
 if(path==='/auth/v1/user'&&verb==='PUT')return 'password';
 if(path==='/auth/v1/user'&&verb==='GET')return null;
 if(path==='/auth/v1/token'&&verb==='POST'){
  if(url.searchParams.get('grant_type')==='password')return 'signin';
  if(url.searchParams.get('grant_type')==='refresh_token')return 'refresh';
 }
 if(path==='/auth/v1/factors'&&verb==='POST')return 'enroll';
 if(/^\/auth\/v1\/factors\/[a-f0-9-]{36}(\/(challenge|verify))?$/.test(path)&&['POST','DELETE'].includes(verb))return null;
 if(path==='/auth/v1/verify'&&verb==='POST'||path==='/auth/v1/logout'&&verb==='POST')return null;
 throw Error('Unexpected Stage B API operation');
}
/** Reserve before the side effect; failed/uncertain operations keep their slot. */
export class StageBBudget {
 readonly counts:Record<Operation,number>={create:0,password:0,recovery:0,signin:0,refresh:0,enroll:0,verifyNewFactor:0};
 private readonly persist:(counts:Record<Operation,number>)=>Promise<void>;
 private readonly ceilings:Record<Operation,number>;
 private queue:Promise<void>=Promise.resolve();
 constructor(persist:(counts:Record<Operation,number>)=>Promise<void>,mode?:{counts:Record<Operation,number>;additionalPasswordAttemptApproved:true}|{hardeningOnly:true;counts?:Record<Operation,number>}){
  const hardening=mode&&'hardeningOnly'in mode;
  if(hardening&&mode.hardeningOnly!==true||mode&&!hardening&&mode.additionalPasswordAttemptApproved!==true)throw Error('Additional Stage B operations not approved');
  this.persist=persist;this.ceilings=hardening?{...limits,create:0,password:10,signin:8,refresh:8,enroll:0,verifyNewFactor:0}:mode?{...limits,password:5}:limits;
  if(mode?.counts){for(const operation of Object.keys(limits) as Operation[]){const count=mode.counts[operation];if(!Number.isInteger(count)||count<0||count>(hardening?this.ceilings:limits)[operation])throw Error('Invalid prior Stage B budget');this.counts[operation]=count;}}
 }
 async reserve(operation:Operation){
  if(!(operation in limits)||this.counts[operation]>=this.ceilings[operation])throw Error('Stage B operation budget exhausted');
  this.counts[operation]++;const snapshot={...this.counts};
  this.queue=this.queue.then(()=>this.persist(snapshot));await this.queue;
 }
}
export type BaselineAdapter={
 create(f:Fixture):Promise<void>;signIn(f:Fixture,keepOther?:boolean):Promise<void>;acceptTestAgreement():Promise<void>;
 password(f:Fixture,expected:'allowed'|'insufficient_aal'|'current_password_required'|'current_password_invalid',current?:'missing'|'wrong'|'correct'):Promise<void>;otherSessionProbe():Promise<{bearerDenied:boolean;refreshDenied:boolean}>;
 prepareFactor():Promise<void>;enrollFactor(which:'primary'|'secondary',expected:'allowed'|'insufficient_aal'):Promise<void>;
 verifyFactor(which:'primary'|'secondary'):Promise<void>;bindFactor(which:'primary'|'secondary',withPermit:boolean,expected:'allowed'|'denied'):Promise<void>;
 ready(expected:boolean,allowSessionDenial?:boolean):Promise<void>;removeFactor(which:'primary'|'secondary',expected:'allowed'|'insufficient_aal'):Promise<void>;
 recover(f?:Fixture):Promise<void>;replayRecovery(f?:Fixture):Promise<void>;signOut(f:Fixture):Promise<void>;
};
/** No credentials or provider code lives here; all subjects are fixed fixtures. */
async function reviewMfaAndRecovery(d:BaselineAdapter){
 await d.enrollFactor('secondary','insufficient_aal');await d.removeFactor('primary','insufficient_aal');
 await d.verifyFactor('primary');await d.ready(true);await d.prepareFactor();
 await d.enrollFactor('secondary','allowed');await d.verifyFactor('secondary');await d.ready(false);
 await d.bindFactor('secondary',false,'denied');await d.bindFactor('secondary',true,'allowed');await d.ready(true);
 await d.removeFactor('secondary','allowed');await d.ready(false,true);
 await d.recover();await d.replayRecovery();await d.password('mfa','insufficient_aal');
 await d.verifyFactor('primary');await d.ready(true);await d.password('mfa','allowed');
 await d.signOut('mfa');await d.signIn('mfa');await d.ready(false);await d.verifyFactor('primary');await d.ready(true);
 await d.signOut('mfa');
}
export async function runStageBBaseline(d:BaselineAdapter) {
 await d.create('plain');await d.create('mfa');
 await d.signIn('plain',true);await d.signIn('plain');await d.password('plain','allowed');
 const otherSession=await d.otherSessionProbe();
 await d.signIn('mfa');await d.acceptTestAgreement();await d.prepareFactor();
 await d.enrollFactor('primary','allowed');await d.verifyFactor('primary');await d.bindFactor('primary',true,'allowed');await d.ready(true);
 await d.signIn('mfa');await d.ready(false);await d.password('mfa','insufficient_aal');
 await reviewMfaAndRecovery(d);await d.signOut('plain');
 return {status:'baseline-observed',ordinaryUpdateWithoutCurrentPasswordObserved:true,providerMfaAndRecoverySequenceCompleted:true,
  recentAal2FactorBindingObserved:true,otherSession,strictRefreshReuseResolved:false,securityRiskAccepted:false,externalEmailsRequested:0};
}
/** Separately approved continuation; never create or initialize another identity. */
export async function resumeStageBBaseline(d:BaselineAdapter){
 await d.signIn('mfa');await d.ready(false);await d.password('mfa','insufficient_aal');
 await reviewMfaAndRecovery(d);
 return {status:'baseline-remainder-observed',initialBaselineWasPartial:true,providerMfaAndRecoverySequenceCompleted:true,
  recentAal2FactorBindingObserved:true,strictRefreshReuseResolved:false,securityRiskAccepted:false,externalEmailsRequested:0};
}
/** Requires a separate provider-setting and fixture-test approval. */
export async function runStageBHardening(d:BaselineAdapter){
 await d.signIn('plain');
 await d.password('plain','current_password_required');await d.password('plain','current_password_invalid','wrong');await d.password('plain','allowed','correct');
 await d.signOut('plain');await d.recover('plain');await d.replayRecovery('plain');await d.password('plain','allowed');await d.signOut('plain');await d.signIn('plain');await d.signOut('plain');
 await d.signIn('mfa');await d.ready(false);await d.password('mfa','insufficient_aal','correct');await d.verifyFactor('primary');await d.ready(true);
 await d.password('mfa','current_password_required');await d.password('mfa','current_password_invalid','wrong');await d.password('mfa','allowed','correct');await d.signOut('mfa');
 await d.recover('mfa');await d.replayRecovery('mfa');await d.password('mfa','insufficient_aal');await d.verifyFactor('primary');await d.ready(true);await d.password('mfa','allowed');
 await d.signOut('mfa');await d.signIn('mfa');await d.ready(false);await d.verifyFactor('primary');await d.ready(true);await d.signOut('mfa');
 return {status:'provider-current-password-compatibility-observed',currentPasswordEnforcementVerified:true,recoveryWithoutOldPasswordVerified:true,existingFixtureMfaRetained:true,strictRefreshReuseResolved:false,securityRiskAccepted:false,externalEmailsRequested:0};
}
/** Only steps 7–10; the six settled requests are never refunded or repeated. */
export async function continueStageBHardening(d:BaselineAdapter){
 await d.signIn('mfa');await d.ready(false);await d.verifyFactor('primary');await d.ready(true);
 await d.password('mfa','current_password_invalid','wrong');await d.password('mfa','allowed','correct');await d.signOut('mfa');
 await d.recover('mfa');await d.replayRecovery('mfa');await d.password('mfa','insufficient_aal');await d.verifyFactor('primary');await d.ready(true);await d.password('mfa','allowed');
 await d.signOut('mfa');await d.signIn('mfa');await d.ready(false);await d.verifyFactor('primary');await d.ready(true);await d.signOut('mfa');
 return {status:'provider-current-password-compatibility-observed',resumedSettledBoundary:true,currentPasswordEnforcementVerified:true,recoveryWithoutOldPasswordVerified:true,existingFixtureMfaRetained:true,strictRefreshReuseResolved:false,securityRiskAccepted:false,externalEmailsRequested:0};
}
