// Source/offline-only package verifier. Never imports operator/hosted settings.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {persistentDatabase} from '../tests/support/persistent-database.ts';
import {assertInactiveRegistrationProposal,assertReviewedRegistrationManifest,assertRegistrationReviewPaths} from './lib/registration-package-review.mjs';
const proposal=JSON.parse(readFileSync('config/persistent-registration-stage-c-proposal.json','utf8'));
const baseline=JSON.parse(readFileSync('config/persistent-registration-function-baseline.json','utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
const files=[...proposal.migrationOrder,'supabase/prepared/persistent-registration-forward-recovery.sql','supabase/security-proposals/one-hour-development-session.sql.txt','config/persistent-registration-stage-c-proposal.json','config/persistent-registration-function-baseline.json','supabase/functions/mitsa-registration-service/index.ts','supabase/functions/mitsa-registration-service/deno.json','supabase/functions/mitsa-registration-service/deno.lock','supabase/functions/_shared/registration-service.ts','supabase/functions/_shared/registration-service-auth.ts'];
let db;
try {
 const args=process.argv.slice(2);
 assert(args.length===0 || args.length===1&&args[0]==='--check');
 const checkOnly=args[0]==='--check';
 assertInactiveRegistrationProposal(proposal);
 const reviewed=checkOnly?JSON.parse(readFileSync('artifacts/persistent-registration-stage-c-manifest.json','utf8')):null;
 if(reviewed){assertRegistrationReviewPaths(reviewed,files);for(const file of reviewed.files)assert.equal(hash(readFileSync(file.path)),file.sha256);}
 db=await persistentDatabase();
 const controls=(await db.query('select admission_enabled,delivery_enabled,session_policy_ready,approval_generation,worker_id,transport_ready,terms_id,privacy_id from private.registration_control')).rows[0];
 assert.deepEqual(controls,{admission_enabled:false,delivery_enabled:false,session_policy_ready:false,approval_generation:null,worker_id:null,transport_ready:false,terms_id:null,privacy_id:null});
 assert.equal((await db.query('select count(*)::int n from private.account_registration_policy')).rows[0].n,0);
 const functions=(await db.query(`select n.nspname as schema,p.proname as name,pg_get_userbyid(p.proowner) as owner,p.prosecdef as definer,p.proconfig as settings,p.proacl::text as acl,
 pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('api','private') and (p.proname like 'mitsa_persistent_%' or p.proname like 'mitsa_worker_%' or p.proname in ('mitsa_registration_command','mitsa_registration_stop','mitsa_before_user_created','mitsa_isolated_send_email','mitsa_current_terms','mitsa_finalize_registration')) order by n.nspname,p.proname`)).rows.map(({definition,...row})=>({...row,sha256:hash(definition)}));
 const actor=(await db.query("select pg_get_functiondef('private.current_actor()'::regprocedure) definition")).rows[0].definition;
 assert.equal(hash(actor),baseline.functions.find(f=>f.name==='current_actor').sha256);
 const tables=(await db.query("select c.relname as name,c.relrowsecurity as rls,c.relforcerowsecurity as forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('registration_control','account_registration_policy','auth_mail_dispatch') order by c.relname")).rows;
 assert.equal(tables.length,3);assert(tables.every(t=>t.rls&&t.forced));
 // Zero-cohort rollback restores the exact original definitions and ACLs.
 await db.exec(readFileSync('supabase/prepared/persistent-registration-forward-recovery.sql','utf8'));
 for(const expected of baseline.functions){
  const actual=(await db.query("select pg_get_functiondef(p.oid) definition,pg_get_userbyid(p.proowner) owner,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname=$1",[expected.name])).rows[0];
  assert.equal(hash(actual.definition),expected.sha256);assert.equal(actual.owner,expected.owner);assert.equal(actual.acl,expected.acl);
 }
 const manifest={checkedAt:new Date().toISOString(),status:'prepared-not-installed',scope:'offline PGlite; encryption is a policy-test stub, not hosted cryptographic verification',project:proposal.projectRef,databaseMarker:proposal.databaseMarker,files:files.map(path=>({path,sha256:hash(readFileSync(path))})),functions,tables,
  initialControlsDisabled:true,noCohortBackfill:true,originalActorUnchanged:true,zeroCohortRecoveryPreservesDefinitionsOwnersAndAcls:true,nonemptyCohortRecovery:'covered separately by persistent-registration-sql.test.ts',databaseNetworkConnections:0,smtpConnections:0,liveChanges:0};
 if(checkOnly)assertReviewedRegistrationManifest(reviewed,manifest);
 else writeFileSync('artifacts/persistent-registration-stage-c-manifest.json',JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({status:manifest.status,mode:checkOnly?'check-existing-manifest':'generate-manifest',files:files.length,functions:functions.length,offlineRecoveryVerified:true,reviewedManifestUnchanged:checkOnly,liveChanges:0}));
}catch{console.error('Offline Stage C package verification failed. No provider or live database change occurred.');process.exitCode=1;}finally{await db?.close();}
