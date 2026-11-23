// Read-only LOCAL publication review. Never stages, commits, adds a remote,
// contacts GitHub, rewrites history, or changes files selected for publication.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
let phase='worktree';
const git=(...args)=>{const r=spawnSync('git',args,{windowsHide:true,encoding:'utf8',maxBuffer:32*1024*1024});assert(r.status===0,'Read-only Git inspection failed');return r.stdout;};
const excluded=p=>/^(?:\.env(?:\.|$)|\.secrets\/|\.tools\/|\.aws\/|\.codex\/|\.agents\/|\.superpowers\/|\.vercel\/|artifacts\/|docs\/|assets\/|node_modules\/|\.next\/|coverage\/|test-results\/|playwright-report\/|supabase\/\.temp\/)/i.test(p)||/\.(?:pgp|gpg|pem|key|pfx|dpapi|log|tsbuildinfo)$/i.test(p);
const eligible=p=>!excluded(p)&&(/^(?:src\/|public\/|supabase\/functions\/_shared\/)/.test(p)||/^(?:package(?:-lock)?\.json|next\.config\.ts|next-env\.d\.ts|tsconfig\.json|\.gitignore|\.vercelignore|eslint\.config\.mjs|postcss\.config\.mjs)$/.test(p));
const rules=[
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY/],
 ['provider-secret',/\b(?:sb_secret_|sbp_|ghp_|github_pat_|AKIA)[A-Za-z0-9_]{16,}/],
 ['jwt-value',/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{10,}/],
 ['credential-url',/(?:postgres(?:ql)?|https?):\/\/[^\s/"'<>:@]+:[^\s/"'<>@]+@/],
 ['isolated-project-reference',/mjtejwafxriwntweussc|zejvpgnesxiwavwgcsme|fireworks-foundation-proof-01a12e38/],
 ['retained-business-reference',/D Extacy Fireworks|L\.F Fireworks|D Extacy|L\.F\. Fireworks/i],
 ['private-machine-path',/C:[\\/]+Users[\\/]+Luke[\\/]/i],
 ['private-auth-material',/\b(?:refresh_token|access_token|appPassword|password|secret)\s*[:=]\s*["'][A-Za-z0-9+\/_=-]{24,}["']/]
];
try{
 assert(process.argv.length===2);const tracked=git('ls-files','-z').split('\0').filter(Boolean),untracked=git('ls-files','--others','--exclude-standard','-z').split('\0').filter(Boolean),worktree=[...new Set([...tracked,...untracked])].filter(existsSync).sort();
 const inventory=[],findings=[];for(const path of worktree){const bytes=readFileSync(path),categories=rules.filter(([,pattern])=>pattern.test(bytes.toString('utf8'))).map(([name])=>name);inventory.push({path,sha256:hash(bytes),tracked:tracked.includes(path),candidate:eligible(path),categories});if(categories.length)findings.push({path,categories});}
 const objects=git('rev-list','--objects','--all').trim().split(/\r?\n/).filter(Boolean),historyFindings=[];let blobs=0;
 phase='history';for(const entry of objects){const space=entry.indexOf(' '),id=space===-1?entry:entry.slice(0,space),path=space===-1?null:entry.slice(space+1);if(!path||git('cat-file','-t',id).trim()!=='blob')continue;blobs++;const size=Number(git('cat-file','-s',id).trim());if(size>16*1024*1024){historyFindings.push({object:id,path,categories:['large-history-blob-manual-review-required'],size});continue;}const bytes=git('cat-file','blob',id),categories=rules.filter(([,pattern])=>pattern.test(bytes)).map(([name])=>name);if(categories.length||excluded(path))historyFindings.push({object:id,path,categories:[...categories,...(excluded(path)?['excluded-history-path']:[])]});}
 const candidates=inventory.filter(f=>f.candidate),allowlist=candidates.filter(f=>!f.categories.length).map(({path,sha256})=>({path,sha256})),remote=git('remote','-v').trim(),head=git('rev-parse','HEAD').trim(),branch=git('branch','--show-current').trim(),commits=Number(git('rev-list','--all','--count').trim());
 const dependencyBlockers=['config/test-target.json','config/registration-deployments.json'].filter(p=>existsSync(p));
 const result={status:'PUBLICATION_BLOCKED_REQUIRES_REVIEWED_SANITIZED_EXPORT',head,branch,commits,trackedFiles:tracked.length,untrackedFiles:untracked.length,historyBlobsScanned:blobs,remoteConfigured:remote.length>0,existingRepository:'https://github.com/LukeMendoza05/Mitsa',remoteEmpty:'USER_REPORTED_REVERIFY_BEFORE_PUSH',historyMayBePublished:false,privateRepositoryRecommended:true,historyFindings,worktreeFindings:findings,explicitCleanSourceAllowlist:allowlist,candidateFilesRequiringReview:candidates.filter(f=>f.categories.length),unpublishedConfigDependencies:dependencyBlockers,completeDependencyClosureVerified:false,secretsAbsentClaimed:false,pushed:false,staged:false,committed:false,networkRequests:0};
 const path='artifacts/publication-review-'+Date.now()+'.json';writeFileSync(path,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,report:path,commits,historyBlobsScanned:blobs,historyFindings:historyFindings.length,candidateFiles:candidates.length,cleanAllowlistFiles:allowlist.length,flaggedCandidateFiles:candidates.length-allowlist.length,networkRequests:0,gitMutations:0}));
}catch{console.error(JSON.stringify({status:'LOCAL_PUBLICATION_REVIEW_FAILED',phase,gitMutations:0,networkRequests:0,privateValuesPrinted:false}));process.exitCode=1;}
