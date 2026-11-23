// Offline only: traverse the verified encrypted snapshot, never print identities.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readPrivateKey,readMessage,decrypt} from 'openpgp';
const hash=value=>createHash('sha256').update(value).digest('hex');
try {
 const manifest=JSON.parse(readFileSync('.secrets/developer-reset/manifest.json','utf8'));
 const binary=readFileSync(manifest.snapshot);assert.equal(hash(binary),manifest.snapshotSha256);
 const key=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')});
 const text=String((await decrypt({message:await readMessage({binaryMessage:binary}),decryptionKeys:key})).data);
 assert.equal(hash(text),manifest.payloadSha256);const data=JSON.parse(text);
 assert.equal(data.project,manifest.project);assert.equal(data.account.id,manifest.userId);
 const related=new Map(Object.entries(data.rows).map(([table,rows])=>[table,new Set(rows.filter(row=>
  manifest.ownedIds.includes(row.business_id)||manifest.ownedIds.includes(row.id)&&table==='private.businesses'||
  ['user_id','subject_id','actor_id','target_id','recipient_id','provider_user_id','outgoing_id','incoming_id','invited_by','accepted_by','reviewer_id','executor_id','primary_owner_id'].some(field=>row[field]===manifest.userId||manifest.ownedIds.includes(row[field]))||
  row.email===data.account.email||row.verified_email===data.account.email||row.recipient_hash===manifest.emailHash))]));
 related.set('auth.users',new Set([data.account]));
 const fks=data.fks.filter(fk=>related.has(fk.child)).map(fk=>{
  const match=/FOREIGN KEY \(([^)]+)\) REFERENCES [^(]+\(([^)]+)\)/.exec(fk.definition);
  assert(match,'Unrecognized FK; fail closed rather than omit a dependency');
  return {...fk,childKeys:match[1].split(',').map(s=>s.trim().replaceAll('"','')),parentKeys:match[2].split(',').map(s=>s.trim().replaceAll('"',''))};
 });
 let changed=true;while(changed){changed=false;for(const fk of fks){
  const parents=related.get(fk.parent);if(!parents?.size)continue;
  const childSet=related.get(fk.child);for(const child of data.rows[fk.child]){
   if(childSet.has(child)||fk.childKeys.some(key=>child[key]==null))continue;
   if([...parents].some(parent=>fk.childKeys.every((key,i)=>child[key]===parent[fk.parentKeys[i]]))){childSet.add(child);changed=true;}
  }
 }}
 const counts=Object.fromEntries([...related].filter(([table])=>table!=='auth.users').map(([table,rows])=>[table,rows.size]));
 const crossings=[...related].flatMap(([table,rows])=>[...rows].filter(row=>row.business_id&&!manifest.ownedIds.includes(row.business_id)).map(()=>table));
 assert.equal(crossings.length,0,'Related rows belong to an unapproved workspace');
 const report={checkedAt:new Date().toISOString(),source:'Verified encrypted snapshot; no remote mutation',project:manifest.project,snapshotIntegrityVerified:true,
  dependencyTraversal:'Foreign-key descendants plus explicit identity/business references',tablesAndCounts:counts,
  applicationRowsInScope:Object.values(counts).reduce((a,b)=>a+b,0),crossWorkspaceReferences:crossings.length,
  foreignKeysExamined:fks.length,
  recentRegistrationIntents:[...related.get('private.registration_intents')].filter(row=>new Date(row.created_at).getTime()>Date.now()-3600000).length,
  activeLegalHolds:[...related.get('private.legal_holds')].filter(row=>row.released_at===null).length,
  authProviderInternalBackup:false,privateValuesPrinted:false};
 writeFileSync('artifacts/developer-reset-dependencies.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{console.error('Dependency inspection failed; private details suppressed. No remote operation performed.');process.exitCode=1;}
