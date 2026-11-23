// Read-only scoped proof. Never reads bearer/refresh tokens, MFA secrets, QR,
// passwords or raw user metadata. Private identities/IDs are never printed.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';import assert from 'node:assert/strict';import {parse} from 'dotenv';import pg from 'pg';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
let db,stage='target';
try {
 const cfg=JSON.parse(readFileSync('config/test-target.json')),e=parse(readFileSync('.secrets/operator.env')),baseline=JSON.parse(readFileSync('.secrets/isolated-registration/pending-onboarding.json'));
 const target=assertTestTarget({projectRef:e.TEST_PROJECT_REF,url:e.TEST_SUPABASE_URL,databaseUrl:e.TEST_DATABASE_URL},cfg);assert.equal(target.projectRef,'mjtejwafxriwntweussc');assert.equal(baseline.project,target.projectRef);
 const email=JSON.parse(readFileSync('.secrets/onboarding-recipient.json')).email.trim().toLowerCase(),developer=JSON.parse(readFileSync('.secrets/developer-registration.json')).email.trim().toLowerCase();
 db=new pg.Client(testDatabaseConfig(e.TEST_DATABASE_URL,cfg));await db.connect();await db.query('begin isolation level repeatable read read only');assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 stage='identity';const users=(await db.query('select id,email_confirmed_at,created_at,deleted_at,banned_until from auth.users where email=$1',[email])).rows;assert.equal(users.length,1);const user=users[0];assert.equal(user.id,baseline.userId);assert(user.email_confirmed_at&&user.deleted_at===null);
 const original=(await db.query('select id from auth.users where email=$1',[developer])).rows[0];assert(original&&original.id!==user.id);
 const profile=(await db.query('select full_name=$2 matches from private.account_profiles where user_id=$1',[user.id,'Yuno'])).rows[0];assert(profile?.matches);
 const intent=(await db.query('select provider_user_id,terms_id,finalized_at from private.registration_intents where id=$1',[baseline.intentId])).rows[0];assert(intent.provider_user_id===user.id&&intent.terms_id===baseline.termsId&&intent.finalized_at);
 stage='workspace';const memberships=(await db.query("select m.business_id,m.role,b.name,b.slug,b.primary_owner_id,b.created_at,(select count(*)::int from private.memberships other where other.business_id=b.id and other.active and other.role='owner') owners from private.memberships m join private.businesses b on b.id=m.business_id where m.user_id=$1 and m.active and b.status='active'",[user.id])).rows;assert.equal(memberships.length,1);const workspace=memberships[0];assert(workspace.name==='L.F Fireworks'&&workspace.role==='owner'&&workspace.primary_owner_id===user.id&&workspace.owners===1&&workspace.created_at>=user.created_at);
 const locations=(await db.query('select id,name,kind from private.shops where business_id=$1 and active',[workspace.business_id])).rows;assert.equal(locations.length,1);assert(locations[0].name==='Bulacan'&&locations[0].kind==='warehouse');
 const audit=(await db.query("select count(*)::int n from private.access_audit where business_id=$1 and actor_id=$2 and event='workspace.created'",[workspace.business_id,user.id])).rows[0];assert.equal(audit.n,1);
 stage='MFA';const factors=(await db.query("select f.id,b.bound_at from auth.mfa_factors f join private.factor_bindings b on b.factor_id=f.id and b.user_id=f.user_id join private.account_security a on a.user_id=b.user_id and a.generation=b.generation where f.user_id=$1 and f.status='verified' and f.factor_type='totp' and b.revoked_at is null and a.initialized and not a.recovery_locked",[user.id])).rows;assert.equal(factors.length,1);
 const sessions=(await db.query("select s.id,s.created_at,s.updated_at,s.aal::text aal,s.factor_id,exists(select 1 from auth.mfa_amr_claims a where a.session_id=s.id and a.authentication_method='totp') has_totp,exists(select 1 from auth.mfa_amr_claims a where a.session_id=s.id and a.authentication_method='password') has_password from auth.sessions s where s.user_id=$1 and (s.not_after is null or s.not_after>statement_timestamp()) order by s.updated_at desc nulls last,s.created_at desc",[user.id])).rows;
 const verifiedSession=sessions.find(s=>s.aal==='aal2'&&s.factor_id===factors[0].id&&s.has_totp&&s.has_password);assert(verifiedSession);
 stage='tenant-metadata';const otherMemberships=(await db.query('select count(*)::int n from private.memberships where user_id=$1 and business_id<>$2',[user.id,workspace.business_id])).rows[0].n;assert.equal(otherMemberships,0);
 stage='tenant-developer-membership';const developerInTest=(await db.query('select count(*)::int n from private.memberships where user_id=$1 and business_id=$2',[original.id,workspace.business_id])).rows[0].n;assert.equal(developerInTest,0);
 const crossOwnership=(await db.query('select count(*)::int n from private.businesses b join private.memberships m on m.business_id=b.id where b.primary_owner_id=$1 and m.user_id=$2',[original.id,user.id])).rows[0].n;assert.equal(crossOwnership,0);
 stage='tenant-RLS';const protectedTables=['businesses','shops','memberships','shop_assignments','account_security','factor_bindings'];
 const tables=(await db.query("select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname=any($1::text[])",[protectedTables])).rows;assert.equal(tables.length,protectedTables.length);assert(tables.every(t=>t.relrowsecurity&&t.relforcerowsecurity));
 // Verify exposed clients cannot read private tenant tables directly. Do not
 // impersonate authenticator or manufacture a bearer token to bypass the
 // current_actor connection check. Role changes remain transaction-local.
 stage='tenant-direct-reads';const directChecks=[];
 for(const role of ['anon','authenticated']){
  await db.query('savepoint role_probe');await db.query(`set local role ${role}`);
  for(const table of ['businesses','shops','memberships']){
   await db.query('savepoint denied_read');let denied=false,mode;
   try{const result=await db.query(`select 1 from private.${table} limit 1`);denied=result.rows.length===0;mode=denied?'rls-empty':'data-visible';}catch(error){denied=error?.code==='42501';mode='permission-denied';await db.query('rollback to savepoint denied_read');}
   assert(denied);directChecks.push({role,table,denied:true,mode});
  }
  await db.query('rollback to savepoint role_probe');
 }
 stage='tenant-function-predicates';const definitions=(await db.query("select pg_get_functiondef('private.mitsa_role(uuid)'::regprocedure) role,pg_get_functiondef('private.mitsa_require(uuid,text,uuid)'::regprocedure) require,pg_get_functiondef('private.current_actor()'::regprocedure) actor")).rows[0];
 assert(definitions.role.includes('m.user_id=private.current_actor()')&&definitions.role.includes('m.business_id=p_business')&&definitions.require.includes("r is null")&&definitions.require.includes('private.mitsa_mfa_ready()')&&definitions.actor.includes("session_user <> 'authenticator'"));
 await db.query('commit');
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,newTestIdentityMatchesOriginalPrivateBinding:true,distinctFromOriginalDeveloper:true,emailVerified:true,originalIntentFinalized:true,displayNameMatchesUserReport:true,workspaceNameMatchesUserReport:true,locationMatchesUserReport:true,workspaceCreatedByNewIdentity:true,activeMemberships:1,role:'Business Owner',primaryOwnerMatches:true,soleOwnerInvariant:true,initialActiveLocations:1,verifiedTrustedFactors:1,providerAal:'aal2',activeSessionHasPasswordAndTotp:true,trustedCurrentGenerationBinding:true,recoveryLocked:false,unrelatedWorkspaceMemberships:0,originalDeveloperHasNoTestWorkspaceMembership:true,testIdentityHasNoOriginalWorkspaceMembership:true,forcedRlsTables:protectedTables.length,directPrivateReads:directChecks,apiMembershipAndMfaPredicatesVerified:true,browserBearerOrCookieInspected:false,actualBrowserCrossTenantRequestTested:false,returningSignInStillPending:true,remoteChanges:0,privateValuesPrinted:false};
 writeFileSync('artifacts/controlled-workspace-authorization.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 // A private session-ID digest is used only to distinguish a genuinely new
 // returning sign-in later; no token, factor secret or raw session ID is saved.
 const {createHash}=await import('node:crypto');const digest=value=>createHash('sha256').update(value).digest('hex');
 const file='.secrets/isolated-registration/returning-signin-checkpoint.json',checkpoint={version:1,project:target.projectRef,userId:user.id,businessId:workspace.business_id,workspaceSlug:workspace.slug,locationIds:locations.map(l=>l.id),factorId:factors[0].id,sessionHashes:sessions.map(s=>digest(s.id)),aal2SessionHashes:sessions.filter(s=>s.aal==='aal2'&&s.factor_id===factors[0].id).map(s=>digest(s.id)),checkedAt:new Date().toISOString()};
 if(!existsSync(file))writeFileSync(file,JSON.stringify(checkpoint)+'\n',{mode:0o600,flag:'wx'});
 else{const previous=JSON.parse(readFileSync(file));assert(previous.project===target.projectRef&&previous.userId===user.id&&previous.businessId===workspace.business_id&&previous.factorId===factors[0].id);
  if(!previous.aal2SessionHashes||!previous.locationIds)writeFileSync(file,JSON.stringify({...previous,locationIds:previous.locationIds??checkpoint.locationIds,aal2SessionHashes:previous.aal2SessionHashes??checkpoint.aal2SessionHashes.filter(hash=>previous.sessionHashes.includes(hash))})+'\n',{mode:0o600});
 }
}catch(error){try{await db?.query('rollback');}catch{}console.error(JSON.stringify({stage,status:'Controlled workspace audit stopped; private details suppressed',remoteChanges:0}));process.exitCode=1;}finally{await db?.end();}
