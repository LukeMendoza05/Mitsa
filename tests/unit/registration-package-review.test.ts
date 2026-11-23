import {it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {assertInactiveRegistrationProposal, assertReviewedRegistrationManifest, assertRegistrationReviewPaths} from '../../scripts/lib/registration-package-review.mjs';

const proposal=()=>JSON.parse(readFileSync('config/persistent-registration-stage-c-proposal.json','utf8'));
const manifest=()=>JSON.parse(readFileSync('artifacts/persistent-registration-stage-c-manifest.json','utf8'));

it('accepts only the existing inactive isolated package',()=>{
 expect(()=>assertInactiveRegistrationProposal(proposal())).not.toThrow();
});
it.each(['admissionEnabled','deliveryEnabled','sessionPolicyReady','transportReady'])('rejects an enabled %s in an installation proposal',field=>{
 const value=proposal();value.initialControls[field]=true;
 expect(()=>assertInactiveRegistrationProposal(value)).toThrow();
});
it('excludes the one-hour proposal and every additional SQL source from installation',()=>{
 const value=proposal();value.migrationOrder.push('supabase/security-proposals/one-hour-development-session.sql.txt');
 expect(()=>assertInactiveRegistrationProposal(value)).toThrow();
});
it('rejects target, worker, redirect and service activation drift',()=>{
 for(const mutate of [
  (value:ReturnType<typeof proposal>)=>{value.projectRef='unapproved';},
  (value:ReturnType<typeof proposal>)=>{value.localRuntimeAtInstallation.persistentWorkerStarted=true;},
  (value:ReturnType<typeof proposal>)=>{value.authProvider.redirectAllowlistAdditionCandidate='**';},
  (value:ReturnType<typeof proposal>)=>{value.privateService.enabled=true;},
 ]){const value=proposal();mutate(value);expect(()=>assertInactiveRegistrationProposal(value)).toThrow();}
});
it('permits only the audit timestamp to differ without replacing the reviewed manifest',()=>{
 const expected=manifest(),actual=structuredClone(expected);actual.checkedAt='2026-10-22T00:00:00.000Z';
 expect(()=>assertReviewedRegistrationManifest(expected,actual)).not.toThrow();
});
it('rejects unexpected or omitted manifest paths before any file read',()=>{
 const expected=manifest(),paths=expected.files.map((file:{path:string})=>file.path);
 expect(()=>assertRegistrationReviewPaths(expected,paths)).not.toThrow();
 const redirected=structuredClone(expected);redirected.files[0].path='.secrets/never-read-fixture';
 expect(()=>assertRegistrationReviewPaths(redirected,paths)).toThrow();
 const omitted=structuredClone(expected);omitted.files.pop();
 expect(()=>assertRegistrationReviewPaths(omitted,paths)).toThrow();
});
it.each(['source','privilege','security','recovery'])('rejects changed %s evidence in the reviewed package',kind=>{
 const expected=manifest(),actual=structuredClone(expected);
 if(kind==='source')actual.files[0].sha256='0'.repeat(64);
 if(kind==='privilege')actual.functions[0].acl='PUBLIC=X';
 if(kind==='security')actual.originalActorUnchanged=false;
 if(kind==='recovery')actual.zeroCohortRecoveryPreservesDefinitionsOwnersAndAcls=false;
 expect(()=>assertReviewedRegistrationManifest(expected,actual)).toThrow();
});
