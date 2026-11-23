// READ ONLY remotely. Produces an encrypted rollback/preservation baseline for
// the disabled candidate. Never applies SQL, activates SMTP or reads credentials.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {parse} from 'dotenv';import pg from 'pg';import assert from 'node:assert/strict';
import {readKey,readPrivateKey,createMessage,encrypt,readMessage,decrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
import {gmailCredentialFilePresent} from './lib/gmail-credentials.mjs';
import {assertClosedPilotEvidence} from './lib/closed-pilot-evidence.mjs';
const approved=JSON.parse(readFileSync('config/test-target.json','utf8')),env=parse(readFileSync('.secrets/operator.env')),
 target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},approved),db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,approved));
const candidate='supabase/prepared/20261014_mitsa_controlled_pilot_relay.sql',reviewed='fb8a76b0ffbb57fe4f378c439e70028a094745c3165099a1235455c23c303dff',hash=v=>createHash('sha256').update(v).digest('hex'),quote=v=>'"'+v.replaceAll('"','""')+'"';
const check=process.argv[2]==='check';
const replacements=[
 ['private.mitsa_registration_intent(text,text,uuid,text,boolean)','private.mitsa_test_recipient_allowed(p_email)','(private.mitsa_test_recipient_allowed(p_email) or private.mitsa_pilot_registration_open())'],
 ['private.mitsa_before_user_created(jsonb)','private.mitsa_test_recipient_allowed(intent.email)','(private.mitsa_test_recipient_allowed(intent.email) or private.mitsa_pilot_registration_open())'],
 ['private.mitsa_isolated_send_email(jsonb)','not private.mitsa_test_recipient_allowed(recipient)',"not (private.mitsa_test_recipient_allowed(recipient) or (event->'email_data'->>'email_action_type'='signup' and private.mitsa_pilot_registration_open()))"],
 ['private.mitsa_registration_policy()',"'publicRegistration',g.registration_enabled","'pilotRegistration',private.mitsa_pilot_registration_open(),'publicRegistration',g.registration_enabled"],
];
let stage='target-and-reviewed-hash';
try {
 assert.equal(hash(readFileSync(candidate)),reviewed);await db.connect();await db.query('begin isolation level repeatable read read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 const installed=(await db.query("select to_regclass('private.pilot_registration_window') is not null or to_regclass('private.pilot_mail_deliveries') is not null installed")).rows[0].installed;
 assert.equal(installed,check,'Do not repeat an existing installation or claim an absent one passed');
 const gates=(await db.query('select * from private.release_gates where singleton')).rows[0];assert(['registration_enabled','external_mail_enabled','eligibility_approved','legal_publication_enabled','disposal_enabled'].every(k=>gates[k]===false));
 const email=JSON.parse(readFileSync('.secrets/developer-registration.json','utf8')).email.trim().toLowerCase(),privateIdentity=(await db.query('select id from auth.users where email=$1',[email])).rows;
 assert.equal(privateIdentity.length,1);assert.equal(privateIdentity[0].id,JSON.parse(readFileSync('.secrets/developer-reset/manifest.json','utf8')).userId);
 // The separately approved sender-self test creates exactly one new synthetic
 // profile on a real dedicated mailbox. Recognize only its recorded provider
 // ID, bound hash, time window, signed intent and zero privilege state.
 let approvedPilotId=null;
 if(check&&existsSync('.secrets/pilot-relay/self-test-identity.json')){
  const pilot=JSON.parse(readFileSync('.secrets/pilot-relay/self-test-identity.json','utf8'));
  assert.equal(pilot.project,target.projectRef);assert.equal(pilot.purpose,'dedicated-sender-self-test');
  const row=(await db.query(`select u.id,encode(sha256(convert_to(u.email,'UTF8')),'hex') email_hash,u.raw_user_meta_data->>'full_name' full_name,u.created_at,
   exists(select 1 from private.registration_intents i where i.provider_user_id=u.id and i.created_at>=$2 and i.created_at<=$3) bound_intent,
   (select count(*)::int from private.memberships where user_id=u.id) memberships,(select count(*)::int from auth.mfa_factors where user_id=u.id) factors
   from auth.users u where u.id=$1`,[pilot.userId,pilot.approvedAt,pilot.expiresAt])).rows[0];
  assert(row);assert.equal(row.email_hash,pilot.emailHash);assert.equal(row.full_name,'Synthetic Mitsa Gmail delivery test');assert(row.created_at.getTime()>=Date.parse(pilot.approvedAt)&&row.created_at.getTime()<=Date.parse(pilot.expiresAt));assert(row.bound_intent);assert.equal(row.memberships,0);assert.equal(row.factors,0);approvedPilotId=row.id;
 }
 const unknownUsers=(await db.query("select count(*)::int n from auth.users where (email is null or email !~ '^foundation-[a-zA-Z0-9-]+@example\\.invalid$') and id<>$1 and ($2::uuid is null or id<>$2)",[privateIdentity[0].id,approvedPilotId])).rows[0].n;
 const unknownBusinesses=(await db.query("select count(*)::int n from private.businesses b where b.name not like 'Synthetic %' and not exists(select 1 from private.memberships m where m.business_id=b.id and m.user_id=$1 and m.role='owner' and m.active)",[privateIdentity[0].id])).rows[0].n;
 assert.equal(unknownUsers,0);assert.equal(unknownBusinesses,0);
 stage='live-function-compatibility';
 const functions=(await db.query("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,pg_get_userbyid(p.proowner) owner,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','api') and p.prokind='f' order by 1")).rows;
 const expectedFunctions=check?[]:functions.map(f=>{
  const change=replacements.find(([signature])=>signature===f.signature);if(!change)return f;
  assert.equal(f.definition.split(change[1]).length-1,1,'Unexpected live definition');
  return {...f,definition:f.definition.replace(change[1],()=>change[2])};
 });
 assert.equal(replacements.filter(([signature])=>functions.some(f=>f.signature===signature)).length,4);
 const tables=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('private','foundation_probe') order by 1,2")).rows,rowHashes={};
 for(const t of tables)rowHashes[`${t.schemaname}.${t.tablename}`]=(await db.query(`select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') hash from ${quote(t.schemaname)}.${quote(t.tablename)} t`)).rows.map(r=>r.hash).sort();
 const security=(await db.query("select n.nspname||'.'||c.relname name,c.relrowsecurity rls,c.relforcerowsecurity forced,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('private','foundation_probe') and c.relkind='r' order by 1")).rows;
 const policies=(await db.query("select to_jsonb(p) policy from pg_policies p where schemaname in ('private','foundation_probe') order by schemaname,tablename,policyname")).rows;
 if(!check&&existsSync('.secrets/pilot-relay/manifest.json')){
  stage='previous-preservation-baseline';
  const manifest=JSON.parse(readFileSync('.secrets/pilot-relay/manifest.json','utf8'));assert.equal(manifest.project,target.projectRef);assert.equal(manifest.marker,target.databaseMarker);assert.equal(manifest.reviewed,reviewed);
  const binary=readFileSync(manifest.snapshot);assert.equal(hash(binary),manifest.ciphertextSha256);
  const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')}),plain=String((await decrypt({message:await readMessage({binaryMessage:binary}),decryptionKeys:key})).data);assert.equal(hash(plain),manifest.payloadSha256);const before=JSON.parse(plain);
  assert.deepEqual(functions,before.functions);assert.deepEqual(security,before.security);assert.deepEqual(policies,before.policies);
  for(const [table,hashes] of Object.entries(before.rowHashes)){
   const available=new Map();for(const value of rowHashes[table]??[])available.set(value,(available.get(value)??0)+1);
   for(const value of hashes){assert((available.get(value)??0)>0);available.set(value,available.get(value)-1);}
  }
 }
 if(check){
  stage='encrypted-baseline-postflight';
  const manifest=JSON.parse(readFileSync('.secrets/pilot-relay/manifest.json','utf8'));assert.equal(manifest.project,target.projectRef);assert.equal(manifest.marker,target.databaseMarker);assert.equal(manifest.reviewed,reviewed);
  const binary=readFileSync(manifest.snapshot);assert.equal(hash(binary),manifest.ciphertextSha256);
  const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')}),plain=String((await decrypt({message:await readMessage({binaryMessage:binary}),decryptionKeys:key})).data);assert.equal(hash(plain),manifest.payloadSha256);const before=JSON.parse(plain);
  const helperSignature='private.mitsa_pilot_registration_open()';assert.deepEqual(functions.filter(f=>f.signature!==helperSignature),before.expectedFunctions);assert.equal(functions.filter(f=>f.signature===helperSignature).length,1);
  const newTables=['private.pilot_registration_window','private.pilot_mail_deliveries'];assert.deepEqual(security.filter(t=>!newTables.includes(t.name)),before.security);assert.deepEqual(policies.filter(p=>!newTables.includes(`${p.policy.schemaname}.${p.policy.tablename}`)),before.policies);
  let preserved=0;for(const [table,hashes] of Object.entries(before.rowHashes)){
   const available=new Map();for(const value of rowHashes[table]??[])available.set(value,(available.get(value)??0)+1);
   for(const value of hashes){assert((available.get(value)??0)>0);available.set(value,available.get(value)-1);preserved++;}
  }
  stage='closed-pilot-window-evidence';
  const window=(await db.query('select *,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton')).rows[0];
  const deliveryReport=existsSync('artifacts/controlled-gmail-test-results.json')?JSON.parse(readFileSync('artifacts/controlled-gmail-test-results.json','utf8')):null;
  const senderHash=deliveryReport?JSON.parse(readFileSync('.secrets/pilot-relay/credential-readiness.json','utf8')).senderSha256:null;
  assertClosedPilotEvidence(window,deliveryReport,senderHash);
  for(const table of newTables){assert(security.find(t=>t.name===table)?.rls&&security.find(t=>t.name===table)?.forced);for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') allowed",[role,table])).rows[0].allowed,false);}
  for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,helperSignature])).rows[0].allowed,false);
  const helper=(await db.query('select prosecdef,proconfig from pg_proc where oid=$1::regprocedure',[helperSignature])).rows[0];assert.equal(helper.prosecdef,false);assert(helper.proconfig.includes('search_path=""')&&helper.proconfig.includes('row_security=on'));
  stage='retained-delivery-ledger-evidence';
  const deliveries=(await db.query('select recipient_hash,state,created_at from private.pilot_mail_deliveries')).rows;
  assert.equal(deliveries.length,deliveryReport?.attempts??0);
  let priorCount=0;
  for(const delivery of deliveries){
   assert.equal(delivery.recipient_hash,senderHash);
   const time=delivery.created_at.getTime(),current=time>=Date.parse(deliveryReport.windowStartedAt)&&time<=Date.parse(deliveryReport.windowExpiresAt);
   if(!current){
    assert.equal(deliveryReport.scope,'dedicated-sender-self-test-finish');
    const prior=JSON.parse(readFileSync('artifacts/history/controlled-gmail-received-before-resend.json','utf8'));
    assert.equal(prior.windowClosed,true);assert.equal(prior.attempts,1);assert.equal(prior.smtpAccepted,true);assert.equal(prior.inboxReceipt,'User confirmed first message');
    assert.equal(deliveryReport.priorWindowStartedAt,prior.windowStartedAt);assert.equal(deliveryReport.priorWindowExpiresAt,prior.windowExpiresAt);
    assert(time>=Date.parse(prior.windowStartedAt)&&time<=Date.parse(prior.windowExpiresAt));assert.equal(delivery.state,'smtp-accepted');priorCount++;
   }
   assert(['claimed','smtp-accepted','unconfirmed'].includes(delivery.state));
  }
  assert.equal(priorCount,deliveryReport?.scope==='dedicated-sender-self-test-finish'?1:0);
  await db.query('commit');const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,reviewedHashVerified:true,onlyReviewedExistingFunctionsChanged:true,originalFunctionOwnersGrantsPreserved:true,originalRlsPoliciesPreserved:true,historicalRowsPreserved:preserved,pilotWindowAndSmtpDisabled:true,privateTablesRestricted:true,globalReleaseGatesClosed:true,unknownRealUsers:unknownUsers,unknownRealBusinesses:unknownBusinesses,remoteChanges:0,privateValuesPrinted:false};writeFileSync('artifacts/pilot-relay-postflight.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
  process.exitCode=0;
 }else{
 stage='provider-read-only';
 const response=await fetch(`${target.url}/auth/v1/settings`,{headers:{apikey:env.TEST_PUBLISHABLE_KEY},signal:AbortSignal.timeout(10000)}),provider=await response.json();assert(response.ok&&provider.disable_signup===false&&provider.mailer_autoconfirm===false&&provider.external?.anonymous_users===false);
 await db.query('commit');stage='encrypted-recovery';
 const bundle={createdAt:new Date().toISOString(),project:target.projectRef,marker:target.databaseMarker,candidate,reviewed,functions,expectedFunctions,rowHashes,security,policies};
 const publicKey=await readKey({armoredKey:readFileSync('.secrets/auth-mail/public.asc','utf8')}),privateKey=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')});assert.equal(publicKey.getFingerprint(),privateKey.getFingerprint());
 const plain=JSON.stringify(bundle),binary=await encrypt({message:await createMessage({text:plain}),encryptionKeys:publicKey,format:'binary'}),directory='.secrets/pilot-relay';mkdirSync(directory,{recursive:true});const path=`${directory}/baseline-${randomUUID()}.pgp`;writeFileSync(path,binary,{flag:'wx',mode:0o600});
 const restored=String((await decrypt({message:await readMessage({binaryMessage:readFileSync(path)}),decryptionKeys:privateKey})).data);assert.equal(hash(restored),hash(plain));assert.deepEqual(JSON.parse(restored),bundle);
 writeFileSync(`${directory}/manifest.json`,JSON.stringify({project:target.projectRef,marker:target.databaseMarker,candidate,reviewed,snapshot:path,ciphertextSha256:hash(readFileSync(path)),payloadSha256:hash(plain),createdAt:bundle.createdAt}),{mode:0o600});
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,markerVerified:true,reviewedHashVerified:true,candidateInstalled:false,liveFunctionsCompatible:4,existingFunctionsAudited:functions.length,applicationTablesFingerprinted:tables.length,historicalRowsFingerprinted:Object.values(rowHashes).reduce((n,a)=>n+a.length,0),encryptedRecoverySnapshotVerified:true,mandatoryEmailConfirmation:true,anonymousSignupDisabled:true,releaseGatesClosed:true,unknownRealUsers:unknownUsers,unknownRealBusinesses:unknownBusinesses,smtpCredentialFilePresent:gmailCredentialFilePresent(),smtpCredentialsRead:false,smtpConnectionsAttempted:0,remoteChanges:0,privateValuesPrinted:false};
 writeFileSync('artifacts/pilot-relay-preflight.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }
}catch{try{await db.query('rollback');}catch{}console.error(JSON.stringify({status:'Read-only pilot preflight stopped',stage,remoteChanges:0,privateValuesPrinted:false}));process.exitCode=1;}finally{await db.end();}
