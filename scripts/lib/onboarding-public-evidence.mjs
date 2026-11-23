// Test-server encryption-only writer. Decryption authority stays in controller.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {readKey,createMessage,encrypt} from 'openpgp';
const hash=v=>createHash('sha256').update(v).digest('hex');
export async function onboardingPublicEvidence({root,armoredPublicKey,onManifest}){
 assert(typeof root==='string'&&typeof armoredPublicKey==='string'&&typeof onManifest==='function','Private encryption writer unavailable');
 const publicKey=await readKey({armoredKey:armoredPublicKey});assert(!publicKey.isPrivate(),'Decryption key is forbidden in Next');
 let failed=false,tail=Promise.resolve();const sequences=new Map();
 return async observation=>{
  const operation=tail.then(async()=>{
   assert(!failed&&['e-a','e-b'].includes(observation?.label)&&Number.isSafeInteger(observation.sequence)&&observation.sequence>(sequences.get(observation.label)??0),'Private observation sequence unavailable');
   sequences.set(observation.label,observation.sequence);
   const raw=JSON.stringify(observation);assert(Buffer.byteLength(raw)<=131072,'Private observation too large');const cipher=await encrypt({message:await createMessage({text:raw}),encryptionKeys:publicKey,format:'binary'});
   mkdirSync(root,{recursive:true,mode:0o700});const path=join(root,'observation-'+randomUUID()+'.pgp');writeFileSync(path,cipher,{flag:'wx',mode:0o600,flush:true});
   const manifest={path,cipherSha256:hash(cipher),label:observation.label,sequence:observation.sequence};assert.equal(hash(readFileSync(path)),manifest.cipherSha256,'Private ciphertext storage unconfirmed');
   // Parent decrypts, checks the same label/sequence and ACKs before Next may
   // return the provider response. No secret is placed in IPC or a manifest.
   assert(await onManifest(manifest)===true,'Controller evidence acknowledgement unavailable');return manifest;
  });
  tail=operation.then(()=>{},()=>{failed=true;});
  try{return await operation;}catch{failed=true;throw Error('Private observation encryption or acknowledgement failed');}
 };
}
