// Optional future operator setup. No provider request, credential creation or activation.
import assert from 'node:assert/strict';
import {mkdirSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {evidenceKeys,savePrivateEvidence,sha256} from './lib/preservation-private-evidence.mjs';
try{
 assert.deepEqual(process.argv.slice(2),['--stdin']);const root='.secrets/registration-stage-c/management',ref='.secrets/registration-stage-c/management-ref.json';assert(!existsSync(ref),'Existing installation must not be overwritten');
 assert.equal(spawnSync('git',['check-ignore','--quiet',ref],{stdio:'ignore',windowsHide:true}).status,0);
 let token='';for await(const chunk of process.stdin){token+=chunk.toString();assert(token.length<=2048);}token=token.trim();assert(token.length>=30&&!/\s/.test(token));
 mkdirSync(root,{recursive:true,mode:0o700});const manifest=await savePrivateEvidence(root,{token},await evidenceKeys());writeFileSync(ref,JSON.stringify({manifest,sha256:sha256(readFileSync(manifest))}),{flag:'wx',mode:0o600,flush:true});token='';
 console.log('Private encrypted Stage C credential saved. No network or configuration change was made.');
}catch{console.error('Stage C credential setup stopped. No private values were printed or existing configuration overwritten.');process.exitCode=1;}
