// Local preparation only: no Supabase client, database, SMTP or Auth requests.
// Exact future fixture addresses remain ignored and are never printed.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const hash=v=>createHash('sha256').update(v).digest('hex');
const json=p=>JSON.parse(readFileSync(p));
const walk=path=>readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${path}/${e.name}`):[`${path}/${e.name}`]);
try{
 assert.deepEqual(process.argv.slice(2),['--prepare']);
 const folder='.secrets/registration-completion',privateFile=`${folder}/fixtures.json`;
 assert.equal(spawnSync('git',['check-ignore','--quiet','--',privateFile],{stdio:'ignore'}).status,0);
 assert.equal(spawnSync('git',['ls-files','--error-unmatch','--',privateFile],{stdio:'ignore'}).status,1);
 const original=json('.secrets/onboarding-recipient.json').email;
 assert(typeof original==='string'&&/^[^\s@]+\+[^\s@]+@gmail\.com$/.test(original));
 // Reuse only the already-consented dedicated inbox base, not Yuno's alias.
 // Do not decrypt Gmail's App Password to prepare addresses.
 const base=original.split('@')[0].split('+')[0];
 if(!existsSync(privateFile)){
  mkdirSync(folder,{recursive:true});const id=randomUUID();
  const fixtures=['c3b-a','c3b-b','e-a','e-b'].map(label=>({label,email:`${base}+mitsa-${label}-${id.slice(0,8)}@gmail.com`,fictionalName:`Mitsa Fixture ${label.toUpperCase()}`}));
  writeFileSync(privateFile,JSON.stringify({version:1,reviewId:id,project:'mjtejwafxriwntweussc',fixtures,createdAccounts:0,externalEmails:0},null,2)+'\n',{flag:'wx',mode:0o600});
 }
 const fixture=json(privateFile);assert.equal(fixture.project,'mjtejwafxriwntweussc');assert.equal(fixture.createdAccounts,0);assert.equal(fixture.externalEmails,0);
 assert.deepEqual(fixture.fixtures.map(f=>f.label),['c3b-a','c3b-b','e-a','e-b']);assert.equal(new Set(fixture.fixtures.map(f=>f.email)).size,4);
 for(const f of fixture.fixtures){assert(f.email!==original&&f.email.split('@')[0].split('+')[0]===base&&f.email.endsWith('@gmail.com')&&f.email.length<=254);}
 const selected=[...['src/lib/auth','src/lib/security','src/lib/supabase','src/app/auth','src/lib/mail'].flatMap(walk),
 'src/lib/workspaces.ts','src/lib/workspace-management.ts',
 'scripts/persistent-registration-worker.mjs','scripts/lib/persistent-mail-worker.ts','scripts/lib/gmail-credentials.mjs','scripts/supervise-registration-worker.ps1',
 'scripts/persistent-registration-worker-review.mjs','scripts/lib/registration-mail-test-scope.mjs',
 'config/registration-deployments.json','config/stage-c2-disabled-service-proposal.json','config/stage-c1-identity-boundary-baseline.json',
 'supabase/prepared/20261023122336_mitsa_registration_identity_boundary.sql','supabase/security-proposals/one-hour-development-session.sql.txt',
 'supabase/security-proposals/persistent-registration-test-notices.sql.txt',
 'supabase/security-proposals/persistent-registration-delivery-controls.sql.txt',
 'supabase/security-proposals/persistent-registration-admission-controls.sql.txt',
 'supabase/security-proposals/persistent-registration-operational-stop.sql.txt',
 'package.json','package-lock.json','next.config.ts',...json('config/stage-c2-disabled-service-proposal.json').files.map(f=>f.path)];
 // Every selected file must exist; no silent incomplete source snapshot.
 const sources=[...new Set(selected)].sort().map(path=>({path,sha256:hash(readFileSync(path))}));
 const review={version:1,preparedAt:new Date().toISOString(),reviewId:fixture.reviewId,status:'PREPARED_NOT_APPROVED_NOT_ACTIVATED',project:fixture.project,marker:'fireworks-foundation-proof-01a12e38',origin:'http://127.0.0.1:3000',
 privateFixtures:{path:privateFile,sha256:hash(readFileSync(privateFile)),labels:fixture.fixtures.map(f=>f.label),accountsCreated:0,addressesPrinted:false},sources,
 prerequisites:{strictOptionA:'UNRESOLVED; readiness remains false',C1:'installed',C2:'deployed disabled',C3A:'eight slots passed; budget exhausted',authHookSelectors:'unchanged',providerChanges:[]},
 sections:{
  C3B:{dependsOn:['Security accepted and enforced','D transport/generation authorization'],fixtures:['c3b-a','c3b-b'],newTestNoticeRows:2,newAccounts:2,authRequests:30,signup:5,resend:4,verifyOtp:8,recovery:4,passwordUpdates:2,signIn:4,signOut:2,refresh:1,externalEmailsWithinD:6,newMfaFactors:0,newWorkspaces:0,signedCommands:48},
  D:{dependsOn:['Security accepted and enforced','explicit delivery authorization'],fixtures:['c3b-a','c3b-b','e-a','e-b'],newAccounts:0,authRequests:0,externalEmailsAggregate:14,c3bEmails:6,eEmails:6,fEmails:2,hourlyMaximum:10,rollingDayMaximum:20,recipientMinimumSeconds:60,smtpVerifyConnections:12,workerRuntimeMinutesAggregate:300,workerLaunches:5,generations:1,newWindowsStartupTasks:0},
  E:{dependsOn:['C3B passed','D delivery authorization','Security passed or separately accepted exact policy'],fixtures:['e-a','e-b'],newAccounts:2,authRequests:60,signup:4,resend:4,verifyOtp:8,recovery:4,passwordUpdates:4,signIn:8,signOut:6,mfaOperations:12,refresh:2,getUser:8,externalEmailsWithinD:6,newMfaFactors:2,newWorkspaces:2,newLocations:2,newOwnerMemberships:2,signedCommands:80,resourceAuthorizationRequests:48},
  F:{dependsOn:['E passed','D runtime/delivery authorization'],fixtures:['e-a','e-b','c3b-b'],newAccounts:0,newMfaFactors:0,newWorkspaces:0,authRequests:12,signIn:2,mfaOperations:4,refresh:2,signOut:2,resend:1,verifyOtp:1,externalEmailsWithinD:2,nextRestarts:2,workerCrashRestarts:2,simulatedLocalOutages:2,signedCommands:48,resourceAuthorizationRequests:24},
  Security:{selected:'Strict Option A',providerTicket:'SU-519045',newLiveTestsAuthorized:false,boundedPolicyAccepted:false,managedAuthWritesAllowed:false,exactProviderTestBudget:'requires provider guidance; not invented or preapproved'},
  Activation:{dependsOn:['C3B','D','E','F','Security','reviewed policy applicability'],approved:false,ordinaryAddresses:true,developerAllowlist:false,recurringSignupLease:false,profile:'isolated-development',productionAllowed:false}
 },aggregate:{newAccounts:4,newVerifiedMfaFactors:2,newWorkspaces:2,newLocations:2,newOwnerMemberships:2,authRequests:102,signedCommands:176,resourceAuthorizationRequests:72,externalEmails:14,productionActions:0,retainedIdentityAuthRequests:0},
 exclusions:['provider changes','Auth-managed-table changes','retained identity mutation','invitation delivery','bulk email','production','public hosting','one-hour policy acceptance'],
 notYetProven:['provider redirect query preservation','actual persistent-engine hook/capture/worker round trip','new persistent-engine user onboarding','real worker outage and restart','Strict Option A']};
 for(const [key,fields] of [['C3B',['signup','resend','verifyOtp','recovery','passwordUpdates','signIn','signOut','refresh']],['E',['signup','resend','verifyOtp','recovery','passwordUpdates','signIn','signOut','mfaOperations','refresh','getUser']],['F',['signIn','mfaOperations','refresh','signOut','resend','verifyOtp']]])assert.equal(fields.reduce((n,f)=>n+review.sections[key][f],0),review.sections[key].authRequests);
 mkdirSync('config',{recursive:true});writeFileSync('config/registration-completion-review.json',JSON.stringify(review,null,2)+'\n');
 console.log(JSON.stringify({status:review.status,reviewId:review.reviewId,sourceHashes:sources.length,privateFixturesPrepared:4,accountsCreated:0,providerRequests:0,emailsSent:0,credentialsRead:false,privateValuesPrinted:false}));
}catch{console.error('Completion review preparation stopped; no network requests or live changes. Private details suppressed.');process.exitCode=1;}
