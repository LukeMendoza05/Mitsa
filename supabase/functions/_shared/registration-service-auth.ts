import {hash,randomNonce,validSigningKey} from './registration-intent-auth.ts';
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
async function key(secret:string) {
 if(!validSigningKey(secret))throw Error('Registration service unavailable');
 return crypto.subtle.importKey('raw',Uint8Array.from(secret.match(/../g)!,v=>parseInt(v,16)),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
function audience(project:string) {
 if(!/^[a-z]{20}$/.test(project))throw Error('Registration target unavailable');
 return `mitsa-registration-service:v1:${project}`;
}
async function message(project:string,body:Uint8Array,time:string,nonce:string) {
 return new TextEncoder().encode(`${audience(project)}\nPOST\n${time}\n${nonce}\n${await hash(body)}`);
}
export async function signRegistrationCommand(secret:string,project:string,body:string,now=Date.now(),nonce=randomNonce()) {
 const time=String(Math.floor(now/1000));
 const signature=hex(await crypto.subtle.sign('HMAC',await key(secret),await message(project,new TextEncoder().encode(body),time,nonce)));
 return {'x-mitsa-time':time,'x-mitsa-nonce':nonce,'x-mitsa-signature':signature};
}
export async function verifyRegistrationCommand(secret:string,project:string,headers:Headers,body:Uint8Array,now=Date.now()) {
 const time=headers.get('x-mitsa-time')??'',nonce=headers.get('x-mitsa-nonce')??'',signature=headers.get('x-mitsa-signature')??'';
 if(!validSigningKey(secret)||!/^\d{10}$/.test(time)||Math.abs(now/1000-Number(time))>60||!(/^[a-f0-9]{64}$/.test(nonce)&&/^[a-f0-9]{64}$/.test(signature)))return null;
 if(!await crypto.subtle.verify('HMAC',await key(secret),Uint8Array.from(signature.match(/../g)!,v=>parseInt(v,16)),await message(project,body,time,nonce)))return null;
 return {requestHash:await hash(nonce),signedAt:new Date(Number(time)*1000).toISOString()};
}
/** Deterministic nonce allows idempotent intent retrieval without raw nonce storage. */
export async function submissionNonce(secret:string,project:string,submissionId:string,fingerprint:string) {
 return hex(await crypto.subtle.sign('HMAC',await key(secret),new TextEncoder().encode(`${audience(project)}\nsubmission-nonce\n${submissionId}\n${fingerprint}`)));
}
