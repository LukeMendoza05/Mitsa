// Local-only audit. Never prints private values or contacts a provider.
import {readFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parse} from 'dotenv';
import assert from 'node:assert/strict';
const walk=path=>readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${path}/${entry.name}`):[`${path}/${entry.name}`]);
try {
 const local=parse(readFileSync('.env.local')),operator=parse(readFileSync('.secrets/operator.env'));
 assert(!local.MITSA_REGISTRATION_ENGINE||local.MITSA_REGISTRATION_ENGINE==='legacy');
 const privatePaths=['.env.local','.secrets/operator.env','.secrets/developer-registration.json','.secrets/onboarding-recipient.json','.secrets/auth-mail/private.asc'];
 for(const path of privatePaths){assert(existsSync(path));assert.equal(spawnSync('git',['check-ignore','--quiet','--',path]).status,0);assert.equal(spawnSync('git',['ls-files','--error-unmatch','--',path],{stdio:'ignore'}).status,1);}
 const secrets=new Set();
 for(const [name,value] of Object.entries({...operator,...local}))if(value.length>=12&&/(SECRET|PASSWORD|TOKEN|DATABASE_URL|AUTH_FLOW_KEY|SERVICE_KEY|ADMIN_KEY|SIGNING_KEY)/i.test(name)&&!/(PUBLISHABLE|ANON|SITE_KEY)/i.test(name))secrets.add(value);
 for(const path of ['.secrets/developer-registration.json','.secrets/onboarding-recipient.json'])secrets.add(JSON.parse(readFileSync(path)).email);
 const privateKey=readFileSync('.secrets/auth-mail/private.asc','utf8');secrets.add(privateKey);assert(secrets.size>=3);
 const publicFiles=[...walk('.next/static'),...walk('public')];
 for(const path of publicFiles){const content=readFileSync(path);for(const value of secrets){assert(!content.includes(Buffer.from(value)));assert(!content.includes(Buffer.from(encodeURIComponent(value))));}assert(!content.includes(Buffer.from('BEGIN PGP PRIVATE KEY BLOCK')));}
 const manifest=JSON.parse(readFileSync('artifacts/persistent-registration-stage-c-manifest.json','utf8'));
 for(const file of manifest.files)assert.equal(createHash('sha256').update(readFileSync(file.path)).digest('hex'),file.sha256);
 const report={checkedAt:new Date().toISOString(),localEngineRemainsLegacy:true,privateFilesIgnoredAndUntracked:true,publicFilesScanned:publicFiles.length,configuredPrivateValuesAndIdentitiesAbsentFromPublicAssets:true,stageCManifestMatchesSources:true,providerRequests:0,smtpConnections:0,liveChanges:0};
 writeFileSync('artifacts/persistent-registration-local-safety.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{console.error('Local Stage A safety audit failed. Details suppressed to protect private configuration. No external request or activation occurred.');process.exitCode=1;}
