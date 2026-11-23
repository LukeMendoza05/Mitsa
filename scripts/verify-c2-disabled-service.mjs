// Local-only review. Cannot deploy, set secrets, call Auth or connect to SMTP.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {parse} from 'dotenv';
import assert from 'node:assert/strict';
import {assertC2Proposal,assertC2SourceGraph,assertC2HostedCatalog} from './lib/stage-c2-review.mjs';
let stage='proposal';
try{
 assert(process.argv.length===2||process.argv.length===3&&process.argv[2]==='--with-saved-catalog');
 const p=JSON.parse(readFileSync('config/stage-c2-disabled-service-proposal.json','utf8'));assertC2Proposal(p);
 stage='sources';const graph=assertC2SourceGraph(p,Object.fromEntries(p.files.map(f=>[f.path,readFileSync(f.path,'utf8')])));
 stage='local-boundaries';const local=existsSync('.env.local')?parse(readFileSync('.env.local')):{};
 assert(!local.MITSA_REGISTRATION_ENGINE||local.MITSA_REGISTRATION_ENGINE==='legacy');
 assert(local.MITSA_REGISTRATION_SERVICE_ENABLED!=='true');
 assert(!Object.keys(local).some(k=>k.startsWith('NEXT_PUBLIC_')&&/REGISTRATION.*(SECRET|SIGNING|SERVICE_KEY)/i.test(k)));
 const signer=local.MITSA_REGISTRATION_SERVICE_KEY;
 if(signer)assert.match(signer,/^[a-f0-9]{64}$/);
 for(const path of ['.env.local','.secrets/operator.env']){
  assert.equal(spawnSync('git',['check-ignore','--quiet','--',path],{stdio:'ignore'}).status,0);
  assert.equal(spawnSync('git',['ls-files','--error-unmatch','--',path],{stdio:'ignore'}).status,1);
 }
 let catalogCheckedAt=null;
 if(process.argv[2]){
  stage='saved-catalog';const evidence=JSON.parse(readFileSync('artifacts/stage-c2-readonly-catalog.json','utf8'));
  assertC2HostedCatalog(evidence,p);catalogCheckedAt=evidence.checkedAt;
 }
 const report={checkedAt:new Date().toISOString(),status:'local-preflight-passed-not-deployed',...graph,project:p.project,sourceHashesMatched:true,completeStaticImportGraph:true,localEngineLegacy:true,localServiceDisabled:true,localSignerConfigured:Boolean(signer),privateFilesIgnoredAndUntracked:true,savedCatalogCheckedAt:catalogCheckedAt,savedCatalogIsNotLiveRecheck:Boolean(catalogCheckedAt),providerRequests:0,databaseWrites:0,deployments:0,secretsConfigured:0,smtpConnections:0};
 writeFileSync('artifacts/stage-c2-local-preflight.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{
 console.error(JSON.stringify({status:'C2 local review stopped',stage,privateDetailsSuppressed:true,providerRequests:0,deployments:0,secretsConfigured:0}));process.exitCode=1;
}
