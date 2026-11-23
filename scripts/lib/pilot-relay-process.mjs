import {execFileSync} from 'node:child_process';
const stages=new Set(['read-only-target','private-configuration','bound-provider-message','approved-delivery']);
const statuses=new Set(['Pilot window closed','Approved window open; explicit send flag required','No eligible unsent pilot message','smtp-accepted','Pilot relay stopped; no automatic retry']);
export function safeRelayFailure(error) {
 // Raw child output can contain a provider message or credential. Only known
 // bounded values may enter the parent report, never exception.message.
 const result={kind:'child-failed'};
 if(error?.code==='ETIMEDOUT')result.kind='child-timeout';
 for(const output of [error?.stdout,error?.stderr]){
  if(typeof output!=='string')continue;
  for(const line of output.split(/\r?\n/)){
   try{const value=JSON.parse(line);if(stages.has(value.stage))result.stage=value.stage;if(statuses.has(value.status))result.status=value.status;
    if(value.smtpConnectionsAttempted===0||value.smtpConnectionsAttempted===1)result.smtpConnectionsAttempted=value.smtpConnectionsAttempted;
    if(['window','approved-test-scope','intent','latest-message','limits','claim'].includes(value.authorizationStage))result.authorizationStage=value.authorizationStage;
    if(['authentication','timeout','tls','connection','unconfirmed'].includes(value.deliveryFailure))result.deliveryFailure=value.deliveryFailure;
    if(Number.isInteger(value.smtpResponseCode)&&value.smtpResponseCode>=100&&value.smtpResponseCode<=599)result.smtpResponseCode=value.smtpResponseCode;
   }catch{/* Unstructured diagnostics are discarded. */}
  }
  for(const code of ['ERR_MODULE_NOT_FOUND','ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING','ERR_UNKNOWN_FILE_EXTENSION','EACCES','EPERM'])if(output.includes(code))result.kind=code;
 }
 return result;
}
export function invokePilotRelay(send=false) {
 try{
  const output=execFileSync(process.execPath,['--conditions=react-server','scripts/pilot-mail-relay.mjs',...(send?['--send-approved-pilot']:[])],{cwd:process.cwd(),encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:16384});
  const value=JSON.parse(output.trim());
  if(!statuses.has(value.status))return {ok:false,failure:{kind:'unexpected-child-response'}};
  return {ok:true,status:value.status,smtpConnectionsAttempted:value.smtpConnectionsAttempted===1?1:0};
 }catch(error){return {ok:false,failure:safeRelayFailure(error)};}
}
