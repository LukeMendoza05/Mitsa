// Correlate the actual browser-session fingerprint with Auth metadata only.
// Never fetches bearer, refresh, MFA secret or email values from the database.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';import pg from 'pg';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
let db;
try {
 const cfg=JSON.parse(readFileSync('config/test-target.json')),e=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:e.TEST_PROJECT_REF,url:e.TEST_SUPABASE_URL,databaseUrl:e.TEST_DATABASE_URL},cfg);assert.equal(target.projectRef,'mjtejwafxriwntweussc');
 const actual=JSON.parse(readFileSync('artifacts/security-session-live.json')),checkpoint=JSON.parse(readFileSync('.secrets/isolated-registration/returning-signin-checkpoint.json'));
 assert.equal(actual.project,target.projectRef);assert.equal(actual.userHash,createHash('sha256').update(checkpoint.userId).digest('hex'));assert(/^[a-f0-9]{64}$/.test(actual.sessionHash));
 db=new pg.Client(testDatabaseConfig(e.TEST_DATABASE_URL,cfg));await db.connect();await db.query('begin read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 const remaining=(await db.query("select count(*)::int n from auth.sessions where user_id=$1 and encode(sha256(convert_to(id::text,'UTF8')),'hex')=$2",[checkpoint.userId,actual.sessionHash])).rows[0].n;
 const session=(await db.query("select s.created_at,s.aal::text aal,exists(select 1 from auth.mfa_amr_claims a where a.session_id=s.id and authentication_method='password') password,exists(select 1 from auth.mfa_amr_claims a where a.session_id=s.id and authentication_method='totp') totp from auth.sessions s where s.user_id=$1 and encode(sha256(convert_to(s.id::text,'UTF8')),'hex')=$2",[checkpoint.userId,actual.sessionHash])).rows[0];
 const refresh=(await db.query("select count(*) filter(where not revoked)::int usable,count(*)::int retained from auth.refresh_tokens where user_id=$1::text and encode(sha256(convert_to(session_id::text,'UTF8')),'hex')=$2",[checkpoint.userId,actual.sessionHash])).rows[0];
 const prior=(await db.query("select count(*)::int n from auth.sessions where user_id=$1 and encode(sha256(convert_to(id::text,'UTF8')),'hex')=any($2::text[])",[checkpoint.userId,checkpoint.aal2SessionHashes])).rows[0].n;
 await db.query('commit');
 const passed=actual.logoutObserved===true&&actual.logoutProviderReportedSuccess===true&&actual.formerBearerDenied===true&&remaining===0&&refresh.usable===0;
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,actualTestBrowserSessionIdentified:true,browserSnapshotCheckedAt:actual.checkedAt,actualSessionWasEarlierCheckpoint:checkpoint.aal2SessionHashes.includes(actual.sessionHash),matchedSessionCreatedAt:session?.created_at??null,matchedSessionAal:session?.aal??null,matchedSessionHasPasswordAndTotp:session?.password===true&&session?.totp===true,authenticatedAal2:actual.authenticatedAal2===true,foreignWorkspaceDenied:actual.foreignWorkspaceDenied===true,foreignMembersDenied:actual.foreignMembersDenied===true,logoutObserved:actual.logoutObserved===true,formerBearerDenied:actual.formerBearerDenied===true,actualSessionRowRemoved:remaining===0,actualSessionNonRevokedRefreshRecords:refresh.usable,retainedRefreshHistoryRecords:refresh.retained,otherCheckpointSessionsRemaining:prior,sessionSpecificLogoutPassed:passed,diagnosticRevokedOtherSessions:false,remoteChanges:0,emailsSent:0,privateValuesPrinted:false};
 writeFileSync('artifacts/security-session-correlation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 if(!passed)process.exitCode=1;
}catch{try{await db?.query('rollback');}catch{}console.error('Browser-session correlation pending or failed; private details suppressed. No remote changes.');process.exitCode=1;}finally{await db?.end();}
