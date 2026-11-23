import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {readKey,readPrivateKey,readMessage,createMessage,encrypt,decrypt} from 'openpgp';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const readJson=path=>JSON.parse(readFileSync(path));
export async function evidenceKeys(){return {publicKey:await readKey({armoredKey:readFileSync('.secrets/auth-mail/public.asc','utf8')}),privateKey:await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')})};}
export async function loadPrivateEvidence(path,keys){const m=readJson(path),cipher=readFileSync(m.snapshot);assert.equal(sha256(cipher),m.cipherSha256);const raw=String((await decrypt({message:await readMessage({binaryMessage:cipher}),decryptionKeys:keys.privateKey})).data);assert.equal(sha256(raw),m.payloadSha256);return JSON.parse(raw);}
export async function savePrivateEvidence(root,payload,keys){
 const raw=JSON.stringify(payload),cipher=await encrypt({message:await createMessage({text:raw}),encryptionKeys:keys.publicKey,format:'binary'}),prefix=root+'/capture-'+randomUUID();
 writeFileSync(prefix+'.pgp',cipher,{flag:'wx',mode:0o600,flush:true});const manifest={snapshot:prefix+'.pgp',cipherSha256:sha256(cipher),payloadSha256:sha256(raw),capturedAt:new Date().toISOString(),candidateOnly:true,accepted:false};
 writeFileSync(prefix+'.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600,flush:true});assert.deepEqual(await loadPrivateEvidence(prefix+'.json',keys),payload);return prefix+'.json';
}
