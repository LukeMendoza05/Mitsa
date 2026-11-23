// LOCAL ONLY: clone already-public clean history, change one proposed binding,
// and create a reviewable local commit. No provider, fetch, push or deployment.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, symlinkSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const review=resolve('artifacts/free-only-site-review-20261031-v1');
const repo=resolve('artifacts/free-only-site-source-20261031-v1');
const parent=resolve('artifacts/phase3-preview-publication-20261029-v1');
const approved='ec4a96bef0ea77e3553513b37931076f288cc204';
const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(args,cwd=repo,binary=false)=>{
  const r=spawnSync('git',args,{cwd,windowsHide:true,encoding:binary?undefined:'utf8',maxBuffer:8*1024*1024});
  assert.equal(r.status,0,'Local Git operation failed'); return r.stdout;
};
assert.equal(git(['rev-parse','HEAD'],parent).trim(),approved);
assert.equal(git(['status','--porcelain'],parent).trim(),'');
assert(!existsSync(repo),'Never overwrite a candidate');
if(existsSync(review)) assert(readdirSync(review).every(p=>p==='local-clone-failure.json'),'Never overwrite a review');
else mkdirSync(review);
git(['clone','--local','--no-hardlinks','--no-checkout',parent,repo],process.cwd());
mkdirSync(resolve(review,'empty-hooks'));
git(['config','core.hooksPath',resolve(review,'empty-hooks')]);
git(['config','core.autocrlf','false']); git(['config','commit.gpgSign','false']);
git(['config','user.name','LukeMendoza05']);
git(['config','user.email','297411820+LukeMendoza05@users.noreply.github.com']);
git(['checkout','-b','codex/free-only-closed-site',approved]);
// A local-only candidate must not accidentally push through its inherited remote.
git(['remote','remove','origin']);
writeFileSync(resolve(repo,'config/test-target.json'),JSON.stringify({projectRef:'geuttbanjqdapcubjrnn'},null,2)+'\n');
assert.equal(git(['diff','--name-only']).trim(),'config/test-target.json');
writeFileSync(resolve(review,'source-change.patch'),git(['diff','--binary']),{flag:'wx'});
git(['add','--','config/test-target.json']);
git(['commit','-m','Prepare explicit closed-site binding to existing Free test backend']);
const files=git(['ls-tree','-r','HEAD']).trim().split('\n').map(line=>{
  const [meta,path]=line.split('\t'),[mode,,blob]=meta.split(' ');
  assert(!/(?:^|\/)(?:\.env[^/]*|\.secrets|artifacts|\.tools|\.codex|\.agents)(?:\/|$)/.test(path));
  const bytes=git(['cat-file','blob',blob],repo,true);
  if(!bytes.includes(0))assert(!/-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY|\b(?:sb_secret_|sbp_|ghp_|github_pat_)[A-Za-z0-9_]{16,}|mjtejwafxriwntweussc|fireworks-foundation-proof-01a12e38/.test(bytes.toString()),'Private material selected');
  return {path,mode,blobSha1:blob,sha256:hash(bytes)};
});
assert.equal(files.length,172);
const history=git(['rev-list','--reverse','HEAD']).trim().split('\n');
assert.deepEqual(history.slice(0,3),['149ffb9cfc8c1bda908550419fdceb9d689892fe','4b7fdd29ac3c232ffae96dba6bef74ba1b046f66',approved]);
assert.equal(history.length,4); assert(!existsSync(resolve(repo,'.git/objects/info/alternates')));
assert.equal(git(['remote','-v']).trim(),'');
git(['fsck','--full','--strict']);
const inventory={status:'LOCAL_CANDIDATE_NOT_APPROVED_OR_PUSHED',directory:repo,commit:git(['rev-parse','HEAD']).trim(),tree:git(['rev-parse','HEAD^{tree}']).trim(),parent:approved,history,files,pushed:false,deployed:false,backendAdopted:false};
writeFileSync(resolve(review,'inventory.json'),JSON.stringify(inventory,null,2)+'\n',{flag:'wx'});
// Local dependency mount only; excluded by .gitignore and inventory. No install.
symlinkSync(resolve('artifacts/phase3-preview-source-20261029-v2/node_modules'),resolve(repo,'node_modules'),'junction');
console.log(JSON.stringify({status:inventory.status,commit:inventory.commit,tree:inventory.tree,files:files.length,changedFiles:1,hostedRequests:0}));
