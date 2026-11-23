// Read-only target/health inspection and public upstream source pinning. No
// credentials, response bodies, JWTs or account information are printed.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';import {parse} from 'dotenv';import pg from 'pg';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
let db;
try {
 const cfg=JSON.parse(readFileSync('config/test-target.json')),env=parse(readFileSync('.secrets/operator.env')),local=parse(readFileSync('.env.local'));
 const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},cfg);assert.equal(target.projectRef,'mjtejwafxriwntweussc');assert.equal(local.SUPABASE_URL,target.url);
 db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,cfg));await db.connect();await db.query('begin read only');assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);await db.query('commit');await db.end();db=null;
 const health=await fetch(`${target.url}/auth/v1/health`,{headers:{apikey:local.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(10000)});
 const body=health.ok?await health.json():{};
 const version=typeof body.version==='string'&&/^v?\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(body.version)?body.version:null;
 const sources=[];let upstreamCommit=null;
 if(version){
  const tag=version.startsWith('v')?version:`v${version}`,headers={'User-Agent':'Mitsa-isolated-auth-review'};
  const reference=await fetch(`https://api.github.com/repos/supabase/auth/git/ref/tags/${tag}`,{headers,signal:AbortSignal.timeout(10000)});
  if(reference.ok){let object=(await reference.json()).object;
   if(object?.type==='tag'&&/^[a-f0-9]{40}$/.test(object.sha)){const annotated=await fetch(`https://api.github.com/repos/supabase/auth/git/tags/${object.sha}`,{headers,signal:AbortSignal.timeout(10000)});if(annotated.ok)object=(await annotated.json()).object;}
   if(object?.type==='commit'&&/^[a-f0-9]{40}$/.test(object.sha))upstreamCommit=object.sha;
  }
  if(upstreamCommit){
   mkdirSync('artifacts/provider-source',{recursive:true});
   for(const path of ['internal/api/token_refresh.go','internal/tokens/service.go','internal/models/refresh_token.go','internal/models/sessions.go']){
    const url=`https://raw.githubusercontent.com/supabase/auth/${upstreamCommit}/${path}`,response=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)continue;
    const source=await response.text(),file=`artifacts/provider-source/${tag}-${path.replaceAll('/','-')}`;writeFileSync(file,source);
    sources.push({path,url,localFile:file,sha256:createHash('sha256').update(source).digest('hex'),containsLegacyFamilyRevocation:source.includes('RevokeTokenFamily'),containsLocalSessionDeletion:source.includes('LogoutSession')});
   }
  }
 }
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,healthHttpStatus:health.status,reportedProviderVersion:version,upstreamReleaseCommit:upstreamCommit,releaseSources:sources,deployedBinaryMatchesUpstreamCommitNotProven:true,remoteChanges:0,emailsSent:0,providerContacted:false,privateValuesPrinted:false};
 writeFileSync('artifacts/auth-provider-version-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{try{await db?.query('rollback');}catch{}console.error('Read-only provider-version review stopped; private details suppressed. No remote changes.');process.exitCode=1;}finally{await db?.end();}
