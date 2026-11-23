import * as fs from 'node:fs/promises';
import {openSync,writeFileSync,readFileSync,closeSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const sharingCodes=new Set(['EPERM','EACCES','EBUSY']);
function failure(code,error){const safe=sharingCodes.has(error?.code)?error.code:'other',result=new Error(`Stage B checkpoint unavailable (${code}/${safe})`);result.name='CheckpointPublicationError';result.code=code;result.fileSystemCode=safe;return result;}
/** Only local publication retries; never repeat an Auth/API operation.
 * @param {string} path
 * @param {Uint8Array} bytes
 * @param {Pick<typeof fs, 'writeFile'|'rename'>} [io]
 * @param {(ms:number)=>Promise<unknown>} [wait]
 */
export async function writeEncryptedCheckpoint(path,bytes,io=fs,wait=delay){
 const temporary=`${path}.${randomUUID()}.next`;
 try{await io.writeFile(temporary,bytes,{flag:'wx',mode:0o600,flush:true});}catch(error){throw failure('CHECKPOINT_WRITE_FAILED',error);}
 for(let attempt=0;attempt<6;attempt++){
  try{await io.rename(temporary,path);return;}catch(error){
   if(!sharingCodes.has(error?.code)||attempt===5)throw failure('CHECKPOINT_PUBLISH_FAILED',error);
   await wait(100*(attempt+1));
  }
 }
}
/** A stale lock requires reconciliation; never automatically steal it. */
export function acquireStageBRunLock(path,approvalId){
 let fd;try{fd=openSync(path,'wx',0o600);}catch{const error=new Error('Stage B operator already locked');error.code='ACTIVE_RUN_EXISTS';throw error;}
 const nonce=randomUUID();writeFileSync(fd,JSON.stringify({nonce,approvalId,pid:process.pid,startedAt:new Date().toISOString()}));
 return ()=>{try{closeSync(fd);}catch{}try{if(JSON.parse(readFileSync(path,'utf8')).nonce===nonce)unlinkSync(path);}catch{}};
}
/** Deliberately omit message, stack, query, detail, parameters and request body. */
export function boundedStageBFailure(error){
 const allowed=new Set(['CHECKPOINT_WRITE_FAILED','CHECKPOINT_PUBLISH_FAILED','ACTIVE_RUN_EXISTS','ERR_ASSERTION','EPERM','EACCES','EBUSY','ENOENT','ECONNRESET','ETIMEDOUT','57014','08006','53300']);
 return {kind:['CheckpointPublicationError','AssertionError','TypeError','AuthApiError'].includes(error?.name)?error.name:'unclassified',
  code:allowed.has(error?.code)?error.code:'other',fileSystemCode:sharingCodes.has(error?.fileSystemCode)?error.fileSystemCode:null};
}
