import {beforeAll,it,expect,vi} from 'vitest';
import {mkdtempSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {generateKey,readPrivateKey,readMessage,decrypt} from 'openpgp';
import {onboardingObservationReceiver} from '../../scripts/lib/onboarding-observation-receiver.mjs';
import {onboardingPublicEvidence} from '../../scripts/lib/onboarding-public-evidence.mjs';
const uidA='10000000-0000-4000-8000-000000000001',uidB='10000000-0000-4000-8000-000000000002',session='20000000-0000-4000-8000-000000000001';
let keys:any,privateKey:any;beforeAll(async()=>{keys=await generateKey({type:'ecc',curve:'curve25519Legacy',userIDs:[{name:'Offline receiver'}],format:'armored'});privateKey=await readPrivateKey({armoredKey:keys.privateKey});},15000);
const token=(sub:string)=>'OFFLINE.'+Buffer.from(JSON.stringify({sub,session_id:session})).toString('base64url')+'.SIGNATURE';
function observation(label='e-a',uid:string|null=uidA){return {kind:'fixture-provider-observation',label,userId:uid??undefined,signupServerChallenge:true,passwordUpdateAccepted:false,recoveryVerifyAttempts:0,knownAccessTokens:uid?[token(uid)]:[],knownRefreshTokens:uid?['PRIVATE-REFRESH-'+label]:[],factorIds:[],workspaceIds:[],requestHashes:[],accessToken:uid?token(uid):undefined,refreshToken:uid?'PRIVATE-REFRESH-'+label:undefined};}
async function fixture(){
 const root=mkdtempSync(join(tmpdir(),'mitsa-receiver-')),d={root,decryptCipher:vi.fn(async(cipher:any)=>JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:cipher}),decryptionKeys:privateKey})).data))),assertNewIdentity:vi.fn(async(_label:string,_uid:string)=>true),assertPersistentAdmission:vi.fn(async(_label:string)=>true),persistPrivate:vi.fn(async(_value:any)=>{}),assertExecutionReady:vi.fn(async()=>{})};
 const receiver=onboardingObservationReceiver(d),counter=new Map(),writer=await onboardingPublicEvidence({root:join(root,'next-evidence'),armoredPublicKey:keys.publicKey,onManifest:(m:any)=>receiver.accept(m)});
 const publish=(value:any)=>{const sequence=(counter.get(value.label)??0)+1;counter.set(value.label,sequence);return writer({...value,sequence});};return {root,d,receiver,publish};
}
it('decrypts owned ciphertext and requires independent new-identity/admission proof before accepting the fixture state',async()=>{
 const f=await fixture();await f.publish(observation('e-a',null));await f.publish({kind:'persistent-admission-check',label:'e-a'});await f.publish({kind:'fixture-identity-candidate',label:'e-a',userId:uidA});await f.publish(observation());
 expect(f.d.assertNewIdentity).toHaveBeenCalledWith('e-a',uidA);expect(f.d.assertPersistentAdmission).toHaveBeenCalledWith('e-a');expect(f.receiver.privateState('e-a').refreshToken).toBe('PRIVATE-REFRESH-e-a');expect(f.receiver.status()).toMatchObject({failed:false,observedFixtures:1,encryptedManifests:4,hostedAcceptanceCompleted:false});expect(JSON.stringify(f.receiver.status())).not.toMatch(/PRIVATE|10000000/);expect(f.d.persistPrivate).toHaveBeenCalledTimes(4);
});
it('fails closed if the controller cannot prove an identity is new',async()=>{
 const f=await fixture();f.d.assertNewIdentity.mockResolvedValue(false);await expect(f.publish({kind:'fixture-identity-candidate',label:'e-a',userId:uidA})).rejects.toThrow('encryption or acknowledgement');expect(f.receiver.status()).toMatchObject({failed:true,encryptedManifests:1});expect(readdirSync(join(f.root,'next-evidence'))).toHaveLength(1);expect(f.d.persistPrivate).not.toHaveBeenCalled();
});
it('rejects a private path outside the owned evidence directory before reading/decrypting it',async()=>{
 const f=await fixture();await expect(f.receiver.accept({label:'e-a',sequence:1,path:join(f.root,'unowned.pgp'),cipherSha256:'a'.repeat(64)})).rejects.toThrow('Private Next evidence rejected; no retry');expect(f.d.decryptCipher).not.toHaveBeenCalled();
});
it('detects ciphertext tampering and preserves the failed file instead of accepting it',async()=>{
 const f=await fixture(),writer=await onboardingPublicEvidence({root:join(f.root,'next-evidence'),armoredPublicKey:keys.publicKey,onManifest:async (m:any)=>{writeFileSync(m.path,'OFFLINE-TAMPER');return f.receiver.accept(m);}});
 await expect(writer({label:'e-a',sequence:1,kind:'persistent-admission-check'})).rejects.toThrow();expect(f.d.decryptCipher).not.toHaveBeenCalled();expect(readdirSync(join(f.root,'next-evidence'))).toHaveLength(1);
});
it('does not accept an observed retained/unapproved user or a bearer for another identity',async()=>{
 const f=await fixture();await expect(f.publish(observation())).rejects.toThrow();expect(f.d.assertNewIdentity).not.toHaveBeenCalled();
 const g=await fixture();await g.publish({kind:'fixture-identity-candidate',label:'e-a',userId:uidA});const value=observation();value.accessToken=token(uidB);value.knownAccessTokens=[value.accessToken];await expect(g.publish(value)).rejects.toThrow();
});
it('keeps observation history monotonic and rejects replayed sequence/file references',async()=>{
 const f=await fixture();await f.publish({kind:'fixture-identity-candidate',label:'e-a',userId:uidA});const manifest=await f.publish(observation());await expect(f.receiver.accept(manifest)).rejects.toThrow();expect(f.d.persistPrivate).toHaveBeenCalledTimes(2);
 const g=await fixture();await g.publish({kind:'fixture-identity-candidate',label:'e-a',userId:uidA});await g.publish(observation());await expect(g.publish(observation('e-a',null))).rejects.toThrow();
});
it('rejects credentials or private objects duplicated across the two synthetic fixtures',async()=>{
 const f=await fixture();await f.publish({kind:'fixture-identity-candidate',label:'e-a',userId:uidA});await f.publish(observation());await f.publish({kind:'fixture-identity-candidate',label:'e-b',userId:uidB});const value=observation('e-b',uidB);value.refreshToken='PRIVATE-REFRESH-e-a';value.knownRefreshTokens=[value.refreshToken];await expect(f.publish(value)).rejects.toThrow();
});
it('rejects unexpected private fields and never records plaintext credential material as an accepted observation',async()=>{
 const f=await fixture();await expect(f.publish({...observation('e-a',null),password:'PRIVATE-UNAPPROVED-PASSWORD'})).rejects.toThrow();expect(f.d.persistPrivate).not.toHaveBeenCalled();const cipher=readFileSync(join(f.root,'next-evidence',readdirSync(join(f.root,'next-evidence'))[0]));expect(cipher.includes(Buffer.from('PRIVATE-UNAPPROVED'))).toBe(false);
});
