// Parent-side adapter. Decryption and hosted checks are explicit bounded ports.
// Importing or constructing this receiver opens no database or network client.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(v).digest('hex');
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const labels=['e-a','e-b'];
const allowed=new Set(['kind','label','sequence','sourceSequence','userId','intentId','accessToken','refreshToken','signupServerChallenge','usedDeveloperAllowlist','lastRecoveryTokenHash','recoveryVerifyAttempts','passwordUpdateAccepted','knownAccessTokens','knownRefreshTokens','factorIds','workspaceIds','requestHashes']);
export function onboardingObservationReceiver(d){
 for(const key of ['decryptCipher','assertNewIdentity','assertPersistentAdmission','persistPrivate','assertExecutionReady'])assert(typeof d[key]==='function','Private receiver port missing');
 const root=resolve(d.root,'next-evidence'),states=new Map(),users=new Map(),sequences=new Map(),seen=new Set();let failed=false,tail=Promise.resolve();
 const receive=async manifest=>{
  assert(!failed,'Private receiver already failed');await d.assertExecutionReady();
  assert(manifest&&labels.includes(manifest.label)&&Number.isSafeInteger(manifest.sequence)&&manifest.sequence===(sequences.get(manifest.label)??0)+1&&/^[a-f0-9]{64}$/.test(manifest.cipherSha256),'Private manifest binding failed');
  const path=resolve(manifest.path);assert(dirname(path)===root&&/^observation-[a-f0-9-]{36}\.pgp$/.test(basename(path)),'Private evidence path not owned');
  assert(lstatSync(path).isFile()&&!lstatSync(path).isSymbolicLink()&&realpathSync(path)===resolve(realpathSync(root),basename(path)),'Private evidence is not an owned regular file');
  const size=lstatSync(path).size;assert(size>0&&size<=262144,'Private evidence size rejected');const cipher=readFileSync(path);assert(hash(cipher)===manifest.cipherSha256&&!seen.has(manifest.cipherSha256),'Private ciphertext integrity/replay failure');
  seen.add(manifest.cipherSha256);sequences.set(manifest.label,manifest.sequence); // failures never refund this observation
  const value=await d.decryptCipher(cipher);assert(value&&value.label===manifest.label&&value.sequence===manifest.sequence&&Object.keys(value).every(k=>allowed.has(k)),'Private observation mismatch');
  const label=value.label,previous=states.get(label),userId=users.get(label);let next=previous;
  if(value.kind==='fixture-identity-candidate'){
   assert(uuid(value.userId)&&!userId&&![...users.values()].includes(value.userId),'New identity collision');assert(await d.assertNewIdentity(label,value.userId)===true,'New identity not proven');
  }else if(value.kind==='persistent-admission-check')assert(await d.assertPersistentAdmission(label)===true,'Persistent admission not proven');
  else{
   assert(value.kind==='fixture-provider-observation','Unknown private observation');
   if(value.userId!==undefined)assert(value.userId===userId,'Unapproved observed identity');
   if(value.intentId!==undefined)assert(uuid(value.intentId)&&(!previous?.intentId||previous.intentId===value.intentId),'Observed intent changed');
   assert(typeof value.signupServerChallenge==='boolean'&&typeof value.passwordUpdateAccepted==='boolean'&&Number.isSafeInteger(value.recoveryVerifyAttempts)&&value.recoveryVerifyAttempts>=0&&value.recoveryVerifyAttempts<=200,'Observed flow evidence invalid');
   assert(value.usedDeveloperAllowlist===undefined||value.usedDeveloperAllowlist===false,'Unexpected developer allowlist evidence');
   assert(value.lastRecoveryTokenHash===undefined||typeof value.lastRecoveryTokenHash==='string'&&/^(pkce_)?[a-f0-9]{32,256}$/.test(value.lastRecoveryTokenHash),'Observed recovery proof invalid');
   for(const key of ['knownAccessTokens','knownRefreshTokens','factorIds','workspaceIds','requestHashes'])assert(Array.isArray(value[key])&&value[key].length<=(key==='requestHashes'?120:200),'Private observation list invalid');
   assert(value.requestHashes.every(v=>/^[a-f0-9]{64}$/.test(v)),'Invalid request fingerprint');
   for(const token of value.knownAccessTokens){assert(typeof token==='string'&&token.length<=16384);let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{throw Error('Invalid observed fixture bearer');}assert(claims.sub===userId&&uuid(claims.session_id),'Observed bearer identity mismatch');}
   for(const token of value.knownRefreshTokens)assert(typeof token==='string'&&token.length>0&&token.length<=16384,'Observed refresh value invalid');
   assert(value.accessToken===undefined||value.knownAccessTokens.includes(value.accessToken));assert(value.refreshToken===undefined||value.knownRefreshTokens.includes(value.refreshToken));
   for(const key of ['factorIds','workspaceIds'])assert(value[key].every(uuid),'Private object identity invalid');
   for(const key of ['knownAccessTokens','knownRefreshTokens','factorIds','workspaceIds'])for(const [other,stored] of states)if(other!==label)assert(!value[key].some(v=>stored[key].includes(v)),'Cross-fixture credential/object collision');
   if(previous){for(const key of ['knownAccessTokens','knownRefreshTokens','factorIds','workspaceIds','requestHashes'])assert(previous[key].every(v=>value[key].includes(v)),'Private observation history lost');assert(!previous.signupServerChallenge||value.signupServerChallenge,'Challenge evidence lost');assert(!previous.passwordUpdateAccepted||value.passwordUpdateAccepted,'Password-change evidence lost');if(previous.lastRecoveryTokenHash===value.lastRecoveryTokenHash)assert(value.recoveryVerifyAttempts>=previous.recoveryVerifyAttempts,'Recovery attempt count lost');}
   next=structuredClone(value);
  }
  await d.persistPrivate({kind:'next-observation-accepted',manifest,observation:value});
  if(value.kind==='fixture-identity-candidate')users.set(label,value.userId);
  if(next)states.set(label,next);return true;
 };
 return {async accept(manifest){const work=tail.then(()=>receive(manifest));tail=work.then(()=>{},()=>{failed=true;});try{return await work;}catch{failed=true;throw Error('Private Next evidence rejected; no retry');}},
  privateState(label){assert(labels.includes(label));return structuredClone(states.get(label)??{});},
  status(){return {failed,observedFixtures:states.size,encryptedManifests:seen.size,hostedAcceptanceCompleted:false};}
 };
}
