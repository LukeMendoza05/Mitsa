// Read-only preservation; only encrypted local snapshots are written.
// Never retrieves Auth passwords/TOTP secrets or executes application functions.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {parse} from 'dotenv';import pg from 'pg';import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readKey,readPrivateKey,createMessage,encrypt,readMessage,decrypt} from 'openpgp';
import {assertTestTarget} from './test-target.mjs';import {testDatabaseConfig} from './postgres-config.mjs';
const folder='.secrets/stage-c1-identity-boundary',artifact='artifacts/stage-c1-identity-boundary-preservation.json';
const hash=v=>createHash('sha256').update(v).digest('hex'),json=p=>JSON.parse(readFileSync(p,'utf8'));
const quote=v=>'"'+v.replaceAll('"','""')+'"';let db,stage='mode';
try{
 const mode=process.argv[2];assert(['--snapshot','--verify','--recovery-verify'].includes(mode)&&process.argv.length===3);
 const op=parse(readFileSync('.secrets/operator.env')),approved=json('config/test-target.json');
 const target=assertTestTarget({projectRef:op.TEST_PROJECT_REF,url:op.TEST_SUPABASE_URL,databaseUrl:op.TEST_DATABASE_URL},approved);assert.equal(target.projectRef,'mjtejwafxriwntweussc');
 db=new pg.Client({...testDatabaseConfig(op.TEST_DATABASE_URL,approved),statement_timeout:15000});stage='readonly-snapshot';await db.connect();await db.query('begin isolation level repeatable read read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker,target.databaseMarker);
 const rows={};for(const t of (await db.query("select schemaname,tablename from pg_tables where schemaname in ('private','foundation_probe') order by 1,2")).rows)rows[t.schemaname+'.'+t.tablename]=(await db.query(`select to_jsonb(t) r from ${quote(t.schemaname)}.${quote(t.tablename)} t order by to_jsonb(t)::text`)).rows.map(r=>r.r);
 const identities={};for(const table of ['users','mfa_factors'])identities[table]=(await db.query(`select id::text,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') digest from auth.${table} t order by id`)).rows;
 const security={policies:(await db.query("select to_jsonb(p) p from pg_policies p where schemaname in ('private','foundation_probe','auth') order by schemaname,tablename,policyname")).rows,relations:(await db.query("select n.nspname schema,c.relname name,pg_get_userbyid(c.relowner) owner,c.relacl::text acl,c.relrowsecurity rls,c.relforcerowsecurity forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('private','foundation_probe','auth') and c.relkind in ('r','p') order by 1,2")).rows,columnAcls:(await db.query("select n.nspname schema,c.relname name,a.attname column,a.attacl::text acl from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('private','foundation_probe','auth') and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped order by 1,2,a.attnum")).rows};
 const gates=rows['private.release_gates'][0],control=rows['private.registration_control'][0];
 for(const k of ['registration_enabled','external_mail_enabled','eligibility_approved','legal_publication_enabled','disposal_enabled'])assert.equal(gates[k],false);
 for(const k of ['admission_enabled','delivery_enabled','transport_ready','session_policy_ready'])assert.equal(control[k],false);
 assert.equal(rows['private.account_registration_policy'].length,0);assert.equal(rows['private.auth_mail_dispatch'].length,0);
 await db.query('commit');const payload=JSON.stringify({target,rows,identities,security});
 const privateKey=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')});stage='encrypted-local-proof';
 let privateManifest;
 if(mode==='--snapshot'){
  const key=await readKey({armoredKey:readFileSync('.secrets/auth-mail/public.asc','utf8')});assert.equal(key.getFingerprint(),privateKey.getFingerprint());
  mkdirSync(folder,{recursive:true});const id=randomUUID(),snapshot=`${folder}/preservation-${id}.pgp`;privateManifest=`${folder}/baseline-${id}.json`;
  const cipher=await encrypt({message:await createMessage({text:payload}),encryptionKeys:key,format:'binary'});writeFileSync(snapshot,cipher,{flag:'wx',mode:0o600});
  const recovered=String((await decrypt({message:await readMessage({binaryMessage:readFileSync(snapshot)}),decryptionKeys:privateKey})).data);assert.equal(hash(recovered),hash(payload));
  writeFileSync(privateManifest,JSON.stringify({project:target.projectRef,snapshot,cipherSha256:hash(cipher),payloadSha256:hash(payload)}),{flag:'wx',mode:0o600});
 }else{
  privateManifest=json(artifact).privateManifest;
  assert(/^\.secrets\/stage-c1-identity-boundary\/baseline-[0-9a-f-]{36}\.json$/.test(privateManifest));const m=json(privateManifest);assert.equal(m.project,target.projectRef);
  assert(/^\.secrets\/stage-c1-identity-boundary\/preservation-[0-9a-f-]{36}\.pgp$/.test(m.snapshot));const cipher=readFileSync(m.snapshot);assert.equal(hash(cipher),m.cipherSha256);
  const text=String((await decrypt({message:await readMessage({binaryMessage:cipher}),decryptionKeys:privateKey})).data);assert.equal(hash(text),m.payloadSha256);
  const expected=JSON.parse(text),observed=JSON.parse(payload);
  if(mode==='--recovery-verify')for(const data of [expected,observed])for(const row of data.rows['private.registration_control'])delete row.stopped_at;
  assert.deepEqual(observed,expected);
 }
 const report={checkedAt:new Date().toISOString(),project:target.projectRef,mode,passed:true,privateManifest,encryptedSnapshotVerified:true,applicationTables:Object.keys(rows).length,scope:'All existing private/foundation rows, Auth account/factor digests and relation/policy/column ACLs; no credentials or session-token snapshot',preservationCompared:mode!=='--snapshot',controlsDisabled:true,databaseWrites:0,authRequests:0,smtpConnections:0,privateValuesPrinted:false};
 writeFileSync(artifact,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,privateManifest:undefined}));
}catch{try{await db?.query('rollback');}catch{}console.error(JSON.stringify({status:'C1 preservation stopped',stage,privateDetailsSuppressed:true,databaseWrites:0}));process.exitCode=1;}finally{await db?.end();}
