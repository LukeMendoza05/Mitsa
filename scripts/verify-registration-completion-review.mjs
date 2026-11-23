// Local source/budget/privacy audit only. Does not activate any selected section.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const sha=v=>createHash('sha256').update(v).digest('hex'),json=p=>JSON.parse(readFileSync(p));
const walk=path=>readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${path}/${e.name}`):[`${path}/${e.name}`]);
try{
 const path='config/registration-completion-review.json',p=json(path);assert.equal(p.status,'PREPARED_NOT_APPROVED_NOT_ACTIVATED');assert.equal(p.project,'mjtejwafxriwntweussc');
 assert.equal(p.marker,'fireworks-foundation-proof-01a12e38');assert.equal(p.sections.Security.selected,'Strict Option A');assert.equal(p.sections.Security.boundedPolicyAccepted,false);assert.equal(p.sections.Activation.approved,false);
 assert.equal(p.sections.C3B.authRequests+p.sections.E.authRequests+p.sections.F.authRequests,p.aggregate.authRequests);
 assert.equal(p.sections.C3B.externalEmailsWithinD+p.sections.E.externalEmailsWithinD+p.sections.F.externalEmailsWithinD,p.sections.D.externalEmailsAggregate);
 assert.equal(p.aggregate.externalEmails,14);assert.equal(p.aggregate.newAccounts,4);assert.equal(p.aggregate.productionActions,0);assert.equal(p.aggregate.retainedIdentityAuthRequests,0);
 for(const f of p.sources)assert.equal(sha(readFileSync(f.path)),f.sha256);
 const fixturePath=p.privateFixtures.path;assert.equal(fixturePath,'.secrets/registration-completion/fixtures.json');assert.equal(sha(readFileSync(fixturePath)),p.privateFixtures.sha256);
 assert.equal(spawnSync('git',['check-ignore','--quiet','--',fixturePath],{stdio:'ignore'}).status,0);assert.equal(spawnSync('git',['ls-files','--error-unmatch','--',fixturePath],{stdio:'ignore'}).status,1);
 const fixtures=json(fixturePath);assert.equal(fixtures.reviewId,p.reviewId);assert.equal(fixtures.fixtures.length,4);assert.equal(fixtures.createdAccounts,0);assert.equal(fixtures.externalEmails,0);
 const publicPaths=[path,'docs/registration-completion-approval-package.md',...walk('public'),...walk('.next/static')];
 for(const file of publicPaths){const bytes=readFileSync(file);for(const f of fixtures.fixtures){assert(!bytes.includes(Buffer.from(f.email)));assert(!bytes.includes(Buffer.from(encodeURIComponent(f.email))));}}
 const report={checkedAt:new Date().toISOString(),passed:true,sourceHashesMatched:p.sources.length,manifestSha256:sha(readFileSync(path)),documentSha256:sha(readFileSync('docs/registration-completion-approval-package.md')),privateFixturesIgnoredAndUntracked:true,exactRecipientsNotExposed:true,publicFilesScanned:publicPaths.length,allSectionsRemainUnapproved:true,providerRequests:0,databaseWrites:0,emailsSent:0};
 writeFileSync('artifacts/registration-completion-review-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{console.error('Completion review verification failed; private details suppressed. No network or hosted changes.');process.exitCode=1;}
