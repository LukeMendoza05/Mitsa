import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {assertC2Proposal,assertC2SourceGraph,assertC2HostedCatalog} from '../../scripts/lib/stage-c2-review.mjs';
const proposal=()=>JSON.parse(readFileSync('config/stage-c2-disabled-service-proposal.json','utf8'));
const sources=()=>Object.fromEntries(proposal().files.map((f:{path:string})=>[f.path,readFileSync(f.path,'utf8')]));
function catalog(){const p=proposal();return {project:p.project,marker:p.databaseMarker,correctionVersion:'20261023134011',controlsDisabled:true,strictPolicy:true,cohorts:0,dispatches:0,serviceCommandExecute:true,servicePrivateCommandExecute:true,serviceApiUsage:true,servicePrivateUsage:true,hookPrivateUsage:true,beforeHookExecute:true,emailHookExecute:true,anonCommandExecute:false,authenticatedCommandExecute:false,registrationAuthUsage:false,functions:[{name:p.legacy.name,status:'ACTIVE',version:p.legacy.version,verify_jwt:p.legacy.verifyJwt,ezbr_sha256:p.legacy.bundleSha256}]};}
it('accepts the exact seven-file source closure without packaging private or unrelated files',()=>{
 expect(assertC2SourceGraph(proposal(),sources())).toEqual({files:7,typescriptModules:5,externalPackages:2});
});
it.each(['.secrets/private.env','../outside.ts','C:/private.ts','supabase/functions/mitsa-registration-intent/index.ts'])('rejects unapproved package path %s before file access',path=>{
 const p=proposal();p.files[0].path=path;expect(()=>assertC2Proposal(p)).toThrow();
});
it('rejects omitted, duplicated and appended source entries',()=>{
 for(const mutate of [(p:ReturnType<typeof proposal>)=>p.files.pop(),(p:ReturnType<typeof proposal>)=>p.files.push(p.files[0]),(p:ReturnType<typeof proposal>)=>p.files[1]=p.files[0]]){const p=proposal();mutate(p);expect(()=>assertC2Proposal(p)).toThrow();}
});
it('rejects source drift even when an operator tries to rebaseline the proposal',()=>{
 const p=proposal(),s=sources();s[p.entrypoint]+='\n// unreviewed';expect(()=>assertC2SourceGraph(p,s)).toThrow();
 p.files[0].sha256='0'.repeat(64);expect(()=>assertC2Proposal(p)).toThrow();
});
it.each(['project','databaseMarker','functionName','entrypoint','importMap','origin'])('rejects target or deployment %s drift',field=>{
 const p=proposal();p[field]='unapproved';expect(()=>assertC2Proposal(p)).toThrow();
});
it('rejects activation, engine changes and an expanded smoke-request budget',()=>{
 for(const mutate of [(p:ReturnType<typeof proposal>)=>p.enabled=true,(p:ReturnType<typeof proposal>)=>p.localEngine='persistent-v1',(p:ReturnType<typeof proposal>)=>p.verifyJwt=true,(p:ReturnType<typeof proposal>)=>p.smokeMethods.push('POST')]){const p=proposal();mutate(p);expect(()=>assertC2Proposal(p)).toThrow();}
});
it('accepts catalog evidence only for the inactive corrected target and unchanged legacy deployment',()=>{
 expect(()=>assertC2HostedCatalog(catalog(),proposal())).not.toThrow();
});
it.each(['controlsDisabled','strictPolicy','serviceCommandExecute','servicePrivateCommandExecute','serviceApiUsage','servicePrivateUsage','hookPrivateUsage','beforeHookExecute','emailHookExecute'])('rejects missing hosted prerequisite %s',field=>{
 const c:Record<string,unknown>=catalog();c[field]=false;expect(()=>assertC2HostedCatalog(c,proposal())).toThrow();
});
it.each(['anonCommandExecute','authenticatedCommandExecute','registrationAuthUsage'])('rejects unintended hosted privilege %s',field=>{
 const c:Record<string,unknown>=catalog();c[field]=true;expect(()=>assertC2HostedCatalog(c,proposal())).toThrow();
});
it('rejects legacy changes, a preexisting new service, or admitted cohort state',()=>{
 const p=proposal();
 for(const mutate of [(c:ReturnType<typeof catalog>)=>c.functions[0].version++,(c:ReturnType<typeof catalog>)=>c.functions[0].ezbr_sha256='0'.repeat(64),(c:ReturnType<typeof catalog>)=>c.functions.push({...c.functions[0],name:p.functionName}),(c:ReturnType<typeof catalog>)=>c.functions.push({...c.functions[0],name:'unreviewed-other-function'}),(c:ReturnType<typeof catalog>)=>c.cohorts++,(c:ReturnType<typeof catalog>)=>c.dispatches++]){const c=catalog();mutate(c);expect(()=>assertC2HostedCatalog(c,p)).toThrow();}
});
