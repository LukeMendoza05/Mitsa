// Local acceptance only, separately authorized after candidate-result review.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {readJson,sha256,evidenceKeys,loadPrivateEvidence} from './lib/preservation-private-evidence.mjs';
const root='.secrets/registration-final-v1/A';
try{
 assert.equal(process.argv.length,3);assert.equal(process.argv[2],'--accept');assert(!existsSync(root+'/accepted.json'));
 const approval=readJson(root+'/acceptance-approval.json'),result=readJson('artifacts/current-preservation-capture-result.json');
 assert.equal(approval.acceptedByHuman,true);assert.equal(approval.scope,'A-current-preservation-v2-acceptance');assert.equal(approval.allowUnattributedHistoricalAuthDifference,true);assert(approval.evidence?.trim());
 assert.equal(result.status,'CAPTURE_PASSED_NOT_ACCEPTED');assert.equal(result.accepted,false);assert.equal(approval.manifestSha256,sha256(readFileSync(result.encryptedCandidateManifest)));assert.equal(approval.reviewSha256,sha256(readFileSync('config/registration-final-review.json')));
 for(const b of [result.bridge,result.recentBridge]){assert.equal(b.applicationTablesCompared,41);assert.deepEqual(b.tableDifferences,[]);assert.deepEqual(b.securityDifferences,[]);for(const a of b.auth){assert.equal(a.added,0);assert.equal(a.removed,0);if(a.table==='mfa_factors')assert.equal(a.changed,0);}}
 assert.equal(result.bridge.auth.find(r=>r.table==='users').changed,1);assert.equal(result.recentBridge.auth.find(r=>r.table==='users').changed,0);
 await loadPrivateEvidence(result.encryptedCandidateManifest,await evidenceKeys());
 writeFileSync(root+'/accepted.json',JSON.stringify({acceptedByHuman:true,manifest:result.encryptedCandidateManifest,manifestSha256:approval.manifestSha256,reviewSha256:approval.reviewSha256,evidence:approval.evidence,historicalAttribution:'UNRESOLVED',securityPolicy:'strict',strictOptionAPassed:false,acceptedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx',mode:0o600,flush:true});
 console.log(JSON.stringify({status:'CURRENT_REFERENCE_ACCEPTED_BY_EXPLICIT_HUMAN_DECISION',hostedRequests:0,historicalAttribution:'UNRESOLVED',strictOptionA:'BLOCKED_SU-519045',transportRetryApproved:false}));
}catch(error){console.error(JSON.stringify({status:'ACCEPTANCE_STOPPED',category:error.name,hostedRequests:0,privateValuesPrinted:false}));process.exitCode=1;}
