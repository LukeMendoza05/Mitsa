// Local human-receipt bridge. SMTP acceptance NEVER creates a receipt.
import assert from 'node:assert/strict';
import {mkdirSync,readdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
const valid=(label,action)=>['e-a','e-b'].includes(label)&&['signup','recovery'].includes(action);
export function onboardingReceipts({root,scope,persistPrivate,notAfter,emit=()=>{},now=Date.now,pollMs=250}){
 const dir=join(root,'inbox-requests');assert(typeof persistPrivate==='function'&&pollMs>=10&&pollMs<=1000);
 return {async wait(label,action,message,signal){
  scope.active();assert(valid(label,action)&&message.fixture===label&&message.action===action&&message.smtpAccepted===true&&message.providerIssued===true,'Completed provider dispatch required');
  mkdirSync(dir,{recursive:true,mode:0o700});const id=randomUUID(),path=join(dir,'inbox-'+id+'.json'),key=randomBytes(32).toString('hex'),request={id,label,action,jobHash:hash(message.jobId),challenge:key,issuedAt:now(),notAfter:Date.parse(notAfter),reviewSha256:scope.reviewSha256};assert(request.notAfter>now());
  writeFileSync(path,JSON.stringify(request),{flag:'wx',mode:0o600,flush:true});let timer,ok=false;
  try{await persistPrivate({kind:'human-inbox-wait',label,action,jobId:message.jobId,requestId:id});await emit({kind:'receipt-needed',label,action});for(;;){scope.active();assert(!signal?.aborted&&now()<request.notAfter,'Inbox receipt wait stopped');const response=path+'.receipt';if(existsSync(response)){const value=JSON.parse(readFileSync(response));assert(value.requestSha256===hash(readFileSync(path))&&value.challenge===key&&value.humanConfirmed===true&&value.at>=request.issuedAt&&value.at<=now(),'Human receipt binding mismatch');await persistPrivate({kind:'human-inbox-confirmed',label,action,jobId:message.jobId,requestId:id});ok=true;return true;}
    await new Promise(resolve=>{timer=setTimeout(resolve,pollMs);});
   }}finally{clearTimeout(timer);writeFileSync(path+'.closed',JSON.stringify({completed:ok}),{flag:'wx',mode:0o600,flush:true});}
 }};
}
export function recordOnboardingReceipt({root,scope,label,action,now=Date.now}){
 scope.active();assert(valid(label,action),'Unapproved inbox receipt label/action');const dir=join(root,'inbox-requests'),paths=readdirSync(dir).filter(n=>/^inbox-[a-f0-9-]{36}\.json$/.test(n)).map(n=>join(dir,n)).filter(p=>!existsSync(p+'.closed')&&!existsSync(p+'.receipt'));
 const matches=paths.map(path=>({path,raw:readFileSync(path)})).map(r=>({...r,value:JSON.parse(r.raw)})).filter(r=>r.value.label===label&&r.value.action===action);assert(matches.length===1,'Expected exactly one active inbox request');const {path,raw,value}=matches[0];assert(value.reviewSha256===scope.reviewSha256&&now()>=value.issuedAt&&now()<value.notAfter&&/^[a-f0-9]{64}$/.test(value.challenge),'Inbox request expired or changed');
 scope.reserve('operatorRequests',{fixture:label});writeFileSync(path+'.receipt',JSON.stringify({requestSha256:hash(raw),challenge:value.challenge,humanConfirmed:true,at:now()}),{flag:'wx',mode:0o600,flush:true});return {receiptRecorded:true,label,action};
}
