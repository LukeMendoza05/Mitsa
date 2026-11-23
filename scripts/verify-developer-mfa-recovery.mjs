// Read-only operator postflight. Private values and preservation digests stay local.
import {readFileSync,writeFileSync} from 'node:fs';
import {parse} from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
const env=parse(readFileSync('.secrets/operator.env')),approved=JSON.parse(readFileSync('config/test-target.json','utf8'));
const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},approved);
const db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,approved));
try{
 await db.connect();assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 const email=JSON.parse(readFileSync('.secrets/developer-registration.json','utf8')).email.trim().toLowerCase();
 const manifest=JSON.parse(readFileSync('.secrets/developer-mfa-repair.json','utf8')),before=JSON.parse(readFileSync('.secrets/developer-mfa-preservation.json','utf8'));
 assert.equal(manifest.project,target.projectRef);assert.equal(manifest.marker,target.databaseMarker);assert(manifest.completedAt);
 const after=(await db.query("select encode(sha256(convert_to(jsonb_build_object('id',u.id,'email',u.email,'password',u.encrypted_password,'confirmed',u.email_confirmed_at,'banned',u.banned_until,'deleted',u.deleted_at,'terms',(select jsonb_agg(to_jsonb(a) order by a.version_id) from private.legal_acceptances a where a.user_id=u.id),'profile',(select to_jsonb(p) from private.account_profiles p where p.user_id=u.id))::text,'UTF8')),'hex') account_integrity,(select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object('id',f.id,'user',f.user_id,'type',f.factor_type,'status',f.status,'created',f.created_at) order by f.id)::text,'[]'),'UTF8')),'hex') from auth.mfa_factors f where f.id<>$2::uuid) other_factors_integrity,(select count(*)::int from private.access_audit) audit_count from auth.users u where u.email=$1 and u.id=$3::uuid",[email,manifest.factor.id,manifest.userId])).rows[0];
 assert(after);assert.equal(after.account_integrity,before.account_integrity);assert.equal(after.other_factors_integrity,before.other_factors_integrity);assert(after.audit_count>=before.audit_count+2);
 const state=(await db.query("select u.deleted_at is null and (u.banned_until is null or u.banned_until<now()) active,u.email_confirmed_at is not null verified,length(u.encrypted_password)>0 password_present,(select count(*)::int from auth.sessions s where s.user_id=u.id) sessions,(select count(*)::int from auth.mfa_factors f where f.user_id=u.id) factors,(select count(*)::int from private.factor_bindings b where b.user_id=u.id) bindings,(select count(*)::int from private.memberships m where m.user_id=u.id) memberships,(select count(*)::int from private.access_audit a where a.target_id=$2 and a.event in ('mfa.incomplete-recovery-started','mfa.incomplete-recovery-completed')) recovery_events,(select registration_enabled or eligibility_approved or external_mail_enabled or legal_publication_enabled or disposal_enabled from private.release_gates where singleton) open_gate from auth.users u where u.id=$1",[manifest.userId,manifest.factor.id])).rows[0];
 assert(state.active&&state.verified&&state.password_present);assert.equal(state.sessions,0);assert.equal(state.factors,0);assert.equal(state.bindings,0);assert.equal(state.memberships,0);assert(state.recovery_events>=2);assert.equal(state.open_gate,false);
 const admin=createClient(target.url,env.TEST_AUTH_ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const listed=await admin.auth.admin.mfa.listFactors({userId:manifest.userId});assert(!listed.error);assert.equal(listed.data.factors.length,0);
 const result={verifiedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,exactPrivateIdentity:true,accountPasswordEmailTermsProfilePreserved:true,otherAccountFactorsPreserved:true,auditHistoryPreserved:true,recoveryAuditRecorded:true,accountActive:true,emailVerified:true,oldFactorAbsentFromProvider:true,remainingFactors:0,remainingSessions:0,trustedBindings:0,workspaceMemberships:0,publicRegistrationOpen:false,externalMailEnabled:false,privateValuesPrinted:false,personalSignInTested:false};
 writeFileSync('artifacts/developer-mfa-recovery-postflight.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch{console.error('Scoped recovery postflight failed; private details omitted.');process.exitCode=1;}finally{await db.end();}
