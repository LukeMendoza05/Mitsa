import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {assertCurrentSecurity} from '../../scripts/lib/current-preservation-security.mjs';
const baseline=JSON.parse(readFileSync('config/stage-c1-identity-boundary-baseline.json','utf8')),manifest=JSON.parse(readFileSync('artifacts/stage-c1-identity-boundary-manifest.json','utf8'));
function fixture(){return {security:{functions:manifest.functions.map((f:any)=>({...f,digest:f.sha256})),roles:[{name:'app_registration',superuser:false,bypassrls:false,login:false,createrole:false,createdb:false,inherit:false}],relations:[...['registration_control','account_registration_policy','auth_mail_dispatch'].map(name=>({schema:'private',name,rls:true,forced:true})),{schema:'auth',name:'users',...baseline.managedAuth.users}],schemaGrants:[{grants:{schemas:[{name:'auth',...baseline.managedAuth.schema}]}}],columnAcls:baseline.managedAuth.userColumnAcls.map((r:any)=>({schema:'auth',name:'users',...r})),migrations:Array.from({length:24},(_,n)=>({name:n===23?'mitsa_registration_identity_boundary':'fixture'}))}};}
it('checks installed C1 hashes, owners, ACLs, forced RLS, managed Auth privileges and migration checkpoint',()=>{
 expect(assertCurrentSecurity(fixture(),baseline,manifest)).toMatchObject({c1FunctionsVerified:manifest.functions.length,managedAuthPrivilegesMatch:true,customRoleNotElevated:true});
});
it.each(['function','role','rls','schema','column','migration'])('fails closed on %s drift',kind=>{
 const f=fixture();if(kind==='function')f.security.functions[0].digest='changed';if(kind==='role')f.security.roles[0].bypassrls=true;if(kind==='rls')f.security.relations[0].forced=false;if(kind==='schema')f.security.schemaGrants[0].grants.schemas[0].acl='changed';if(kind==='column')f.security.columnAcls[0].acl='changed';if(kind==='migration')f.security.migrations.pop();expect(()=>assertCurrentSecurity(f,baseline,manifest)).toThrow();
});
