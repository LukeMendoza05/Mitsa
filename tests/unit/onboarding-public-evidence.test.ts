import {beforeAll,it,expect,vi} from 'vitest';
import {generateKey,readPrivateKey,readMessage,decrypt} from 'openpgp';
import {mkdtempSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {onboardingPublicEvidence} from '../../scripts/lib/onboarding-public-evidence.mjs';
let keys:any;
beforeAll(async()=>{keys=await generateKey({type:'ecc',curve:'curve25519Legacy',userIDs:[{name:'Offline synthetic evidence'}],format:'armored'});},15000);
const hash=(bytes:any)=>createHash('sha256').update(bytes).digest('hex');
it('writes ciphertext using only the public key, verifies disk integrity, and awaits a private parent acknowledgement',async()=>{
 const root=mkdtempSync(join(tmpdir(),'mitsa-evidence-offline-')),privateKey=await readPrivateKey({armoredKey:keys.privateKey}),observations:any[]=[];
 const ack=vi.fn(async(m:any)=>{const cipher=readFileSync(m.path);expect(hash(cipher)).toBe(m.cipherSha256);const decoded=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:cipher}),decryptionKeys:privateKey})).data));observations.push(decoded);expect(decoded.label).toBe(m.label);expect(decoded.sequence).toBe(m.sequence);return true;});
 const writer=await onboardingPublicEvidence({root,armoredPublicKey:keys.publicKey,onManifest:ack});expect(readdirSync(root)).toEqual([]);
 const manifest=await writer({label:'e-a',sequence:1,accessToken:'PRIVATE-OFFLINE-ACCESS',refreshToken:'PRIVATE-OFFLINE-REFRESH'});
 expect(ack).toHaveBeenCalledOnce();expect(observations[0].refreshToken).toBe('PRIVATE-OFFLINE-REFRESH');expect(JSON.stringify(manifest)).not.toMatch(/PRIVATE-OFFLINE|refreshToken|accessToken/);expect(readFileSync(manifest.path).includes(Buffer.from('PRIVATE-OFFLINE'))).toBe(false);
});
it('rejects private decryption keys before writing any evidence',async()=>{
 const root=mkdtempSync(join(tmpdir(),'mitsa-key-denied-'));await expect(onboardingPublicEvidence({root,armoredPublicKey:keys.privateKey,onManifest:vi.fn()})).rejects.toThrow('Decryption key is forbidden');expect(readdirSync(root)).toEqual([]);
});
it('keeps failed acknowledgements spent and stops later observations instead of replacing ciphertext',async()=>{
 const root=mkdtempSync(join(tmpdir(),'mitsa-ack-failed-')),writer=await onboardingPublicEvidence({root,armoredPublicKey:keys.publicKey,onManifest:async()=>false});
 await expect(writer({label:'e-a',sequence:1,secret:'PRIVATE-OBSERVATION'})).rejects.toThrow(/^Private observation encryption or acknowledgement failed$/);expect(readdirSync(root)).toHaveLength(1);await expect(writer({label:'e-a',sequence:2})).rejects.toThrow();expect(readdirSync(root)).toHaveLength(1);
});
it('serializes concurrent snapshots, preserves every ciphertext and rejects sequence replay',async()=>{
 const root=mkdtempSync(join(tmpdir(),'mitsa-sequence-')),order:number[]=[],writer=await onboardingPublicEvidence({root,armoredPublicKey:keys.publicKey,onManifest:async (m:any)=>{order.push(m.sequence);return true;}});
 await Promise.all([writer({label:'e-a',sequence:1}),writer({label:'e-a',sequence:2})]);expect(order).toEqual([1,2]);expect(readdirSync(root)).toHaveLength(2);await expect(writer({label:'e-a',sequence:1})).rejects.toThrow();expect(readdirSync(root)).toHaveLength(2);
});
it('rejects unapproved fixture labels and oversized evidence before producing a file',async()=>{
 for(const observation of [{label:'retained',sequence:1},{label:'e-a',sequence:1,extra:'x'.repeat(140000)}]){const root=mkdtempSync(join(tmpdir(),'mitsa-observation-denied-')),writer=await onboardingPublicEvidence({root,armoredPublicKey:keys.publicKey,onManifest:async()=>true});await expect(writer(observation)).rejects.toThrow();expect(readdirSync(root)).toEqual([]);}
});
