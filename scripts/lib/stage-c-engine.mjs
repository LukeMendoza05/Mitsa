// Actual protocol, dependencies injected only by the reviewed operator adapter.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
const sha=v=>createHash('sha256').update(v).digest('hex');
export class StageCEngine {
 constructor(d){this.d=d;this.fixtures=new Map();this.receipts=new Set();this.sentJobs=new Set();this.requests=[];this.dispatches=[];this.captures=[];this.checks=/** @type {Record<string,boolean>} */({});this.failed=false;}
 async signup(label,proof,accepted){
  assert(accepted===true);assert(!this.fixtures.has(label),'Submission already attempted');const f=this.d.fixture(label);assert(f);
  assert(await this.d.challenge(proof),'Turnstile rejected');
  const state={label,email:f.email,fullName:f.fictionalName,password:randomBytes(32).toString('base64url')+'aA1!',submissionId:randomUUID(),codes:[],providerAttempted:false};this.fixtures.set(label,state);await this.d.persist(this);
  const payload={submissionId:state.submissionId,email:state.email,fullName:state.fullName,termsId:this.d.termsId,privacyId:this.d.privacyId,accepted:true};
  const prepared=await this.d.command('prepare',payload,label);assert(prepared?.intentId&&/^[a-f0-9]{64}$/.test(prepared.nonce));state.intentId=prepared.intentId;state.nonce=prepared.nonce;await this.d.persist(this);
  const same=await this.d.command('prepare',payload,label);assert.equal(same.intentId,state.intentId);assert.equal(same.nonce,state.nonce);this.checks.durableSubmission=true;
  const permit=await this.d.command('authorize-mail',{email:state.email,intentId:state.intentId,requestKey:state.submissionId,action:'signup'},label);assert(permit?.sendAllowed);state.dispatchId=permit.requestId;this.dispatches.push(permit.requestId);await this.d.persist(this);
  await this.d.pulse();assert.equal((await this.d.command('claim-signup',{email:state.email,submissionId:state.submissionId},label))?.claimed,true);
  assert.equal((await this.d.command('claim-signup',{email:state.email,submissionId:state.submissionId},label))?.claimed,false);this.checks.singleCreationClaim=true;
  state.providerAttempted=true;await this.d.persist(this);const result=await this.d.signup(state);if(result.error)throw Object.assign(Error('Provider signup rejected'),{safeProviderCode:result.error.code,safeHttpStatus:result.error.status});assert(result.data.user&&!result.data.session,'Signup failed or confirmation not required');state.userId=result.data.user.id;this.checks.beforeUserCreated=true;
  await this.d.persist(this);return {pendingVerification:true};
 }
 async resend(label){const f=this.fixtures.get(label);assert(label==='c3b-a'&&f?.userId&&!f.verified&&f.codes.length===1&&this.receipts.has(f.dispatchId));await this.d.pulse();
  const permit=await this.d.command('authorize-mail',{email:f.email,intentId:f.intentId,requestKey:randomUUID(),action:'signup'},label);assert(permit?.sendAllowed,'Resend denied');
  f.dispatchId=permit.requestId;this.dispatches.push(f.dispatchId);await this.d.persist(this);const result=await this.d.resend(f);assert(!result.error);await this.d.persist(this);return {resendRequested:true};
 }
 async capture(job){
  const f=[...this.fixtures.values()].find(f=>f.intentId===job.intentId);assert(f?.userId,'Unknown job');this.d.assertRecipient(f.label,job.email);
  assert.equal(job.userId,f.userId);assert.equal(job.recipientHash,sha(f.email));assert.equal(job.action,'signup');assert.equal(job.origin,'http://127.0.0.1:3000');assert(/^\d{6}$/.test(job.code));assert(/^(pkce_)?[a-f0-9]{32,256}$/.test(job.tokenHash));
  assert(this.dispatches.includes(job.id));if(!f.codes.some(c=>c.dispatchId===job.id))f.codes.push({dispatchId:job.id,code:job.code,issuedAt:job.issuedAt,expiresAt:job.expiresAt});
  if(!this.captures.includes(job.captureId))this.captures.push(job.captureId);this.checks.sixDigitProviderCapture=true;this.checks.recipientIntentBinding=true;await this.d.persist(this);return f;
 }
 receipt(label){const f=this.fixtures.get(label);assert(f&&this.sentJobs.has(f.dispatchId)&&f.codes.some(c=>c.dispatchId===f.dispatchId));this.receipts.add(f.dispatchId);return {receipt:'HUMAN_CONFIRMED',smtpAloneIsNotReceipt:true};}
 async rejectCode(f,code){const result=await this.d.verify(f,code);if(result.data?.session){assert.equal(result.data.user?.id,f.userId);await this.d.signout(f);throw Error('Rejected code established session');}assert.equal(result.error?.code,'otp_expired','Not an explicit unusable-OTP rejection');}
 async verify(label){const f=this.fixtures.get(label);assert(label==='c3b-a'&&f&&!f.verified&&f.codes.length===2&&this.receipts.has(f.dispatchId),'Inbox receipt not confirmed');const current=f.codes.at(-1);assert(current?.dispatchId===f.dispatchId);
  let wrong='000000';while(f.codes.some(c=>c.code===wrong))wrong=String(Number(wrong)+1).padStart(6,'0');await this.rejectCode(f,wrong);this.checks.wrongCode=true;
  if(f.codes.length>1){await this.rejectCode(f,f.codes[0].code);this.checks.supersededCode=true;}
  const result=await this.d.verify(f,current.code);assert(!result.error&&result.data.user?.id===f.userId&&result.data.session,'Verification failed');
  await this.d.signout(f);f.verified=true;await this.rejectCode(f,current.code);this.checks.replayedCode=true;this.checks.emailVerified=true;await this.d.persist(this);return {emailVerified:true,mfaOrWorkspaceTested:false};
 }
 async expire(label){const f=this.fixtures.get(label),c=f?.codes.at(-1);assert(label==='c3b-b'&&c&&!f.verified&&this.receipts.has(c.dispatchId));assert(await this.d.databaseNow()>=c.expiresAt,'Provider lifetime has not elapsed');await this.rejectCode(f,c.code);this.checks.expiredCode=true;await this.d.persist(this);return {expiredProviderCodeRejected:true};}
 async cooldown(label){const f=this.fixtures.get(label);assert(f);const denied=await this.d.deniedMail(f);assert(denied===true);this.checks.serverCooldown=true;return {cooldownRejected:true};}
 async close(){this.failed=true;await this.d.stop();}
 status(){return {checks:this.checks,fixtures:[...this.fixtures.values()].map(f=>({label:f.label,pending:!f.verified,providerAttempted:f.providerAttempted,inboxConfirmed:this.receipts.has(f.dispatchId),capturedMessages:f.codes.length})),containsSecrets:false};}
}
