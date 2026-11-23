// Operator-local, separately approved recovery for the exact isolated developer.
// Never import into Next.js. Never fetch or print a TOTP secret or password.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parse} from 'dotenv';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
const approved=JSON.parse(readFileSync('config/test-target.json','utf8')),env=parse(readFileSync('.secrets/operator.env'));
const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},approved),path='.secrets/developer-mfa-repair.json';
const db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,approved));let stage='preflight';
try{
 await db.connect();assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 const email=JSON.parse(readFileSync('.secrets/developer-registration.json','utf8')).email.trim().toLowerCase();
 const state=(await db.query("select u.id,u.email_confirmed_at is not null verified,d.enabled approved,coalesce(s.initialized,false) initialized,coalesce(s.recovery_locked,false) locked,s.reset_at,s.generation,(select count(*)::int from private.factor_bindings b where b.user_id=u.id) bindings,(select count(*)::int from private.memberships m where m.user_id=u.id) memberships,(select count(*)::int from private.security_permits p where p.user_id=u.id and p.action='enroll' and p.expires_at<=now() and p.consumed_at is null) expired_permits,(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'type',f.factor_type,'status',f.status,'createdAt',f.created_at,'updatedAt',f.updated_at)),'[]') from auth.mfa_factors f where f.user_id=u.id) factors from auth.users u join private.developer_registration_recipients d on d.email=u.email left join private.account_security s on s.user_id=u.id where u.email=$1 and d.approval_reference='mitsa-developer-registration-isolated-v1'",[email])).rows[0];
 assert(state?.verified&&state.approved&&!state.initialized&&!state.locked&&!state.reset_at&&state.bindings===0&&state.memberships===0&&state.expired_permits>0);
 const gates=(await db.query('select registration_enabled or eligibility_approved or external_mail_enabled or legal_publication_enabled or disposal_enabled opened from private.release_gates where singleton')).rows[0];assert.equal(gates?.opened,false);
 const command=process.argv[2]??'prepare';
 if(command==='prepare'){
  assert.equal(state.factors.length,1);assert.equal(state.factors[0].type,'totp');assert.equal(state.factors[0].status,'verified');
  const manifest={project:target.projectRef,marker:target.databaseMarker,preparedAt:new Date().toISOString(),userId:state.id,emailHash:createHash('sha256').update(email).digest('hex'),factor:state.factors[0],generation:state.generation,approvalReference:'mitsa-incomplete-developer-mfa-recovery-v1'};
  mkdirSync('.secrets',{recursive:true});const content=JSON.stringify(manifest);writeFileSync(path,content,{mode:0o600});
  console.log(JSON.stringify({project:target.projectRef,prepared:true,verifiedIncompleteFactors:1,pendingFactors:0,bindings:0,memberships:0,privateManifestSha256:createHash('sha256').update(content).digest('hex'),factorsChanged:0,sessionsChanged:0,privateValuesPrinted:false}));
 }else if(command==='apply-reviewed'){
  assert.equal(process.argv[3],'--approved-incomplete-developer-recovery');const manifest=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(manifest.project,target.projectRef);assert.equal(manifest.marker,target.databaseMarker);assert.equal(manifest.userId,state.id);assert.equal(manifest.emailHash,createHash('sha256').update(email).digest('hex'));assert.equal(manifest.generation,state.generation);assert.equal(manifest.approvalReference,'mitsa-incomplete-developer-mfa-recovery-v1');
  assert(state.factors.length<=1);if(state.factors.length){assert.deepEqual(state.factors[0],manifest.factor);}
  // Explicitly authorized transient-session revocation, before deleting the
  // exposed factor. Hosted admin deletion alone left AAL1 sessions intact.
  stage='session-revocation';await db.query('begin');let revoked;
  try{revoked=(await db.query('delete from auth.sessions where user_id=$1',[state.id])).rowCount;await db.query("insert into private.access_audit(event,target_id,detail) values('mfa.incomplete-recovery-started',$1,$2)",[manifest.factor.id,JSON.stringify({approval:manifest.approvalReference,revokedSessions:revoked})]);await db.query('commit');}catch{await db.query('rollback');throw Error('revocation failed');}
  stage='provider-factor-removal';if(state.factors.length){const admin=createClient(target.url,env.TEST_AUTH_ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const result=await admin.auth.admin.mfa.deleteFactor({userId:state.id,id:manifest.factor.id});assert(!result.error);}
  stage='postflight';assert.equal((await db.query('select count(*)::int n from auth.mfa_factors where user_id=$1',[state.id])).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from auth.sessions where user_id=$1',[state.id])).rows[0].n,0);
  await db.query("insert into private.access_audit(event,target_id,detail) values('mfa.incomplete-recovery-completed',$1,$2)",[manifest.factor.id,JSON.stringify({approval:manifest.approvalReference,verifiedFlagsWritten:false,workspaceRolesGranted:0})]);
  writeFileSync(path,JSON.stringify({...manifest,completedAt:new Date().toISOString()}),{mode:0o600});
  console.log(JSON.stringify({project:target.projectRef,completed:true,removedIncompleteFactors:state.factors.length,revokedSessions:revoked,verifiedFlagsWritten:false,workspaceRolesGranted:0,publicRegistrationOpen:false,externalMailEnabled:false,privateValuesPrinted:false}));
 }else throw Error('unsupported command');
}catch{console.error(JSON.stringify({status:'Scoped recovery stopped; no bypass',stage,privateDetailsPrinted:false}));process.exitCode=1;}finally{await db.end();}
