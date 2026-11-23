// Wait BEFORE issuing a recovery request, never after claiming a mail job.
// Read-only durable capacity evidence; no resend, retry or policy override.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {onboardingProbeSql} from './onboarding-probe-sql.mjs';
/** @param {{scope:any,query:Function,label:string,diagnosticClaims:Function,signal?:AbortSignal,wait?:(ms:number)=>Promise<unknown>}} options */
export async function awaitOnboardingRecoveryCapacity({scope,query,label,diagnosticClaims,signal=undefined,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 const recipientHash=createHash('sha256').update(scope.fixture(label).email).digest('hex'),unusedJob=randomUUID();
 for(let attempt=0;attempt<15;attempt++){
  scope.active();assert(!signal?.aborted,'Recovery capacity wait stopped');const row=(await query(onboardingProbeSql.capacity,[recipientHash,unusedJob])).rows[0],now=Date.parse(row?.database_now),prior=await diagnosticClaims();
  assert(Number.isFinite(now)&&Number.isInteger(row.hourly)&&Number.isInteger(row.daily)&&typeof row.recipient_recent==='boolean');assert(prior.every(r=>Number.isFinite(r.at)&&r.at<=now&&/^[a-f0-9]{64}$/.test(r.recipientHash)));
  assert(row.hourly+prior.filter(r=>now-r.at<3600000).length<10&&row.daily+prior.filter(r=>now-r.at<86400000).length<20,'Recovery mail quota is exhausted');
  if(!row.recipient_recent&&!prior.some(r=>r.recipientHash===recipientHash&&now-r.at<60000))return true;
  if(attempt<14)await wait(5000);
 }
 throw Error('Recovery recipient cooldown did not clear; no request was issued');
}
