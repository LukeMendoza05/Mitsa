// SELECT-only reconciliation. No Auth API, fixture sign-in or mutation.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {parse} from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
import {readPrivateKey,readMessage,decrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
let db;
try {
 const approved=JSON.parse(readFileSync('config/test-target.json','utf8')),operator=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:operator.TEST_PROJECT_REF,url:operator.TEST_SUPABASE_URL,databaseUrl:operator.TEST_DATABASE_URL},approved);
 assert.equal(target.projectRef,'mjtejwafxriwntweussc');
 const checkpoint=JSON.parse(String((await decrypt({message:await readMessage({binaryMessage:readFileSync('.secrets/persistent-registration-security/checkpoint.pgp')}),
  decryptionKeys:await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')})})).data));
 db=new pg.Client(testDatabaseConfig(operator.TEST_DATABASE_URL,approved));await db.connect();await db.query('begin read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 const fixtures={};
 for(const name of ['plain','mfa']){
  const fixture=checkpoint.fixtures[name];assert(fixture.id&&new RegExp(`^foundation-session-review-${name}-[a-f0-9-]{36}@example\\.invalid$`).test(fixture.email));
  const rows=(await db.query(`select email_confirmed_at is not null verified,deleted_at is null active,
   (select count(*)::int from auth.sessions where user_id=u.id) sessions,
   (select count(*)::int from auth.mfa_factors where user_id=u.id and status='verified') verified_factors,
   (select count(*)::int from private.factor_bindings where user_id=u.id and revoked_at is null) nonrevoked_binding_rows,
   (select count(*)::int from private.factor_bindings b join auth.mfa_factors f on f.user_id=b.user_id and f.id=b.factor_id and f.status='verified'
    join private.account_security s on s.user_id=b.user_id and s.generation=b.generation and s.initialized and not s.recovery_locked
    where b.user_id=u.id and b.revoked_at is null) live_trusted_factors,
   (select count(*)::int from private.memberships where user_id=u.id) memberships,
   extensions.crypt($3,encrypted_password)=encrypted_password known_password_matches,
   case when $4::text is null then null else extensions.crypt($4,encrypted_password)=encrypted_password end pending_password_matches
   from auth.users u where id=$1 and email=$2`,[fixture.id,fixture.email,fixture.password,
   checkpoint.pending?.action==='password'&&checkpoint.pending.fixture===name?checkpoint.pending.replacement:null])).rows;
  assert.equal(rows.length,1);fixtures[name]=rows[0];
 }
 const mail=(await db.query(`select (select count(*)::int from private.isolated_auth_mail) captures,
  (select count(*)::int from private.pilot_mail_deliveries) claims,
  (select not(registration_enabled or external_mail_enabled or eligibility_approved or legal_publication_enabled or disposal_enabled) from private.release_gates where singleton) gates_closed,
  (select not(enabled or smtp_enabled or private.mitsa_pilot_registration_open()) from private.pilot_registration_window where singleton) pilot_closed`)).rows[0];
 await db.query('commit');
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,phase:checkpoint.phase,lastOperation:checkpoint.lastOperation,counts:checkpoint.counts,hardeningCounts:checkpoint.hardeningCounts??null,pendingAction:checkpoint.pending?.action??null,lastPasswordOutcome:checkpoint.lastPasswordOutcome??null,fixtures,
  capturesUnchanged:mail.captures===checkpoint.mailBefore.captures,smtpClaimsUnchanged:mail.claims===checkpoint.mailBefore.claims,
  registrationAndDeliveryClosed:mail.gates_closed&&mail.pilot_closed,databaseWrites:0,authApiCalls:0,privateValuesPrinted:false};
 writeFileSync(`artifacts/stage-b-baseline-reconciliation-${Date.now()}-${randomUUID()}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
}catch{try{await db?.query('rollback');}catch{}console.error('Read-only Stage B reconciliation failed; private details suppressed. No fixture was changed.');process.exitCode=1;}
finally{try{await db?.end();}catch{}}
