// Local materialization ONLY after an approved creation receipt exists.
// Never creates a project, accesses provider credentials, or executes SQL.
import assert from'node:assert/strict';import{readFileSync,writeFileSync,mkdirSync,existsSync}from'node:fs';import{resolve}from'node:path';import{createHash}from'node:crypto';
import{bindBackend}from'./lib/phase3-preview-package.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
try{
 assert.equal(process.argv.length,3,'Provide one private reviewed project-creation receipt path');
 const manifest=JSON.parse(readFileSync('config/phase3-dedicated-preview-review.json','utf8'));
 for(const f of manifest.sources)assert.equal(hash(readFileSync(f.path)),f.sha256,'Source review no longer matches');
 const receipt=JSON.parse(readFileSync(process.argv[2],'utf8')),bound=bindBackend(receipt);
 assert.equal(receipt.scope,'P3-B-empty-preview-backend');assert.equal(receipt.costMonthly,0);assert.equal(receipt.creationAuthorized,true);assert.equal(receipt.authSignupClosedVerified,true);
 const out=resolve('.secrets/phase3-preview-bindings/'+bound.projectRef);assert(!existsSync(out),'Never overwrite a materialized project binding');mkdirSync(out,{recursive:true});
 writeFileSync(resolve(out,'20261029060326_mitsa_empty_preview_bootstrap.sql'),bound.bootstrap.sql,{flag:'wx'});
 const template='artifacts/phase3-backend-package-20261029-v1/';
 for(const [name,source]of [['close','auth-close.toml'],['hooks','auth-hooks-closed.toml'],['api','api-private.toml']]){
  const dir=resolve(out,name,'supabase');mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,'config.toml'),readFileSync(template+source),{flag:'wx'});
 }
 writeFileSync(resolve(out,'binding.json'),JSON.stringify({scope:receipt.scope,receiptSha256:hash(readFileSync(process.argv[2])),projectRef:bound.projectRef,marker:bound.marker,sqlSha256:bound.bootstrap.sha256,reviewSha256:hash(readFileSync('config/phase3-dedicated-preview-review.json')),executed:false},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'MATERIALIZED_NOT_EXECUTED',sqlSha256:bound.bootstrap.sha256,hostedRequests:0,privateBindingWritten:true}));
}catch(e){console.error(JSON.stringify({status:'FAILED_LOCAL_BINDING',category:e instanceof assert.AssertionError?'review-or-receipt-mismatch':'local-file-failure',hostedRequests:0}));process.exitCode=1;}
