import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {assertC1IdentityPreflight,assertC1IdentityPostflight} from '../../scripts/lib/c1-identity-preflight.mjs';
const baseline=JSON.parse(readFileSync('config/stage-c1-identity-boundary-baseline.json','utf8'));
const valid=()=>({marker:baseline.marker,currentUser:'postgres',operator:baseline.operator,managedAuth:baseline.managedAuth,schemas:baseline.schemas,functions:baseline.functions,identityColumns:baseline.identityColumns,ownerCanReplaceFunctions:true,registrationPrivateCreate:false,helperCollisions:0,cohorts:0,dispatches:0,persistentIntents:0,refreshTriggers:0,registrationRole:{superuser:false,bypassRls:false,login:false,createrole:false,createdb:false,inherit:false},controls:{admission_enabled:false,delivery_enabled:false,transport_ready:false,session_policy_ready:false,approval_generation:null,worker_id:null,worker_until:null,heartbeat_at:null,terms_id:null,privacy_id:null,approved_sender_sha256:null,stopped_at:'2026-10-23T12:09:21Z',session_policy:'strict'},gatesClosed:true,pilotClosed:true,newTablesForcedRls:true,migrations:Array.from({length:20},(_,i)=>({name:'existing-'+i})).concat(['mitsa_persistent_registration_inactive','mitsa_persistent_registration_hooks_inactive','mitsa_persistent_registration_c1_forward_recovery'].map(name=>({name}))) });
it('accepts the verified owner-read design without requiring an unavailable Auth grant option',()=>{
 expect(valid().schemas.find((s:{schema:string})=>s.schema==='auth').operatorGrantOption).toBe(false);
 expect(()=>assertC1IdentityPreflight(valid(),baseline)).not.toThrow();
});
it('stops on missing or unknown owner identity-read privileges',()=>{
 for(const permission of [false,undefined]){const value=structuredClone(valid());value.identityColumns[0].operatorSelect=permission;expect(()=>assertC1IdentityPreflight(value,baseline)).toThrow();}
 const missing=structuredClone(valid());missing.identityColumns.pop();expect(()=>assertC1IdentityPreflight(missing,baseline)).toThrow();
});
it('stops if managed schema permissions, owner, function definitions or role capabilities drift',()=>{
 for(const mutate of [(v:ReturnType<typeof valid>)=>{v.schemas[0].registrationUsage=true;},(v:ReturnType<typeof valid>)=>{v.operator.name='unapproved';},(v:ReturnType<typeof valid>)=>{v.functions[0].sha256='f'.repeat(64);},(v:ReturnType<typeof valid>)=>{v.registrationRole.bypassRls=true;}]){
  const value=structuredClone(valid());mutate(value);expect(()=>assertC1IdentityPreflight(value,baseline)).toThrow();
 }
});
it('stops on target, collision, RLS, generation, cohort or activation drift',()=>{
 for(const mutate of [(v:ReturnType<typeof valid>)=>{v.marker='wrong';},(v:ReturnType<typeof valid>)=>{v.helperCollisions=1;},(v:ReturnType<typeof valid>)=>{v.newTablesForcedRls=false;},(v:ReturnType<typeof valid>)=>{v.cohorts=1;},(v:ReturnType<typeof valid>)=>{v.controls.admission_enabled=true;}]){
  const value=structuredClone(valid());mutate(value);expect(()=>assertC1IdentityPreflight(value,baseline)).toThrow();
 }
});
it('requires exact installed helper/function grants and unchanged managed ACLs for postflight',()=>{
 const manifest=JSON.parse(readFileSync('artifacts/stage-c1-identity-boundary-manifest.json','utf8'));
 const observed=structuredClone(valid());observed.helperCollisions=1;observed.functions=manifest.functions.map(({result,...f}:Record<string,unknown>)=>f);observed.migrations.push({name:'mitsa_registration_identity_boundary'});
 expect(()=>assertC1IdentityPostflight(observed,baseline,manifest)).not.toThrow();
 const changed=structuredClone(observed);changed.managedAuth.schema.acl='unexpected';expect(()=>assertC1IdentityPostflight(changed,baseline,manifest)).toThrow();
 const exposed=structuredClone(observed);exposed.functions.find((f:{name:string})=>f.name==='mitsa_registration_identity').acl='PUBLIC';expect(()=>assertC1IdentityPostflight(exposed,baseline,manifest)).toThrow();
});
