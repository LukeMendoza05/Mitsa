import {it,expect,vi} from 'vitest';
import {registrationServiceHandler} from '../../supabase/functions/_shared/registration-service';
import {signRegistrationCommand,submissionNonce} from '../../supabase/functions/_shared/registration-service-auth';
import {signIntentRequest} from '../../supabase/functions/_shared/registration-intent-auth';
import {emailRequestCorrelation,correlatedEmailRedirect,canonicalSubmission,submissionResult} from '../../src/lib/auth/persistent-registration';
const project='mjtejwafxriwntweussc',origin='http://127.0.0.1:3000',signingKey='ab'.repeat(32);
const input={submissionId:crypto.randomUUID(),email:'synthetic@example.com',fullName:'Synthetic person',termsId:crypto.randomUUID(),privacyId:crypto.randomUUID(),accepted:true as const};
function setup() {
 const command=vi.fn(async()=>({submissionId:input.submissionId,intentId:crypto.randomUUID(),state:'prepared',creationDeadline:new Date(Date.now()+120000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()}));
 return {command,handler:registrationServiceHandler({enabled:true,project,origin,signingKey,authorizeApiKey:key=>key==='synthetic-public',command})};
}
async function request(payload:unknown={version:1,action:'prepare',payload:input},headers:Record<string,string>={}) {
 const body=JSON.stringify(payload);
 return new Request('https://synthetic.invalid',{method:'POST',body,headers:{'content-type':'application/json',origin,apikey:'synthetic-public',...await signRegistrationCommand(signingKey,project,body),...headers}});
}
it('requires a private signature; public keys and Origin are insufficient',async()=>{
 const f=setup();expect((await f.handler(await request(undefined,{'x-mitsa-signature':'0'.repeat(64)}))).status).toBe(401);expect(f.command).not.toHaveBeenCalled();
});
it('separates the new service audience from legacy signed requests',async()=>{
 const f=setup(),body=JSON.stringify({version:1,action:'prepare',payload:input});
 const signed=await signIntentRequest(signingKey,body);
 expect((await f.handler(await request(undefined,signed))).status).toBe(401);expect(f.command).not.toHaveBeenCalled();
});
it('rejects signed foreign-project requests, expired envelopes and password-bearing payloads',async()=>{
 const f=setup(),body=JSON.stringify({version:1,action:'prepare',payload:input});
 expect((await f.handler(await request(undefined,await signRegistrationCommand(signingKey,'aaaaaaaaaaaaaaaaaaaa',body)))).status).toBe(401);
 expect((await f.handler(await request(undefined,await signRegistrationCommand(signingKey,project,body,Date.now()-61000)))).status).toBe(401);
 expect((await f.handler(await request({version:1,action:'prepare',payload:{...input,password:'never-store-this'}}))).status).toBe(400);
 expect(f.command).not.toHaveBeenCalled();
});
it('derives a stable domain-separated nonce and returns only the private submission contract',async()=>{
 const f=setup(),a=await f.handler(await request()),b=await f.handler(await request());
 const first=await a.json(),second=await b.json();expect(first.nonce).toBe(second.nonce);
 expect(f.command.mock.calls[0]).toHaveLength(3);
 expect(JSON.stringify(f.command.mock.calls)).not.toContain(signingKey);
 expect(canonicalSubmission(input)).not.toContain('password');
 expect(await submissionNonce(signingKey,project,input.submissionId,'a')).not.toBe(await submissionNonce(signingKey,project,input.submissionId,'b'));
 expect(submissionResult.safeParse({...first,nonce:undefined})).toHaveProperty('success',false);
});
it('accepts only the exact callback and one UUID query parameter',()=>{
 const id=crypto.randomUUID(),url=correlatedEmailRedirect(origin,id);
 expect(emailRequestCorrelation(url,origin)).toBe(id);
 // Provider loopback redirect acceptance is broader than Mitsa's exact permit.
 for(const bad of [url+'&extra=1',url+'#fragment',url.replace('127.0.0.1','localhost'),url.replace(':3000',':3001'),url.replace('127.0.0.1','[::1]'),url.replace('http:','https:'),url.replace('/auth/email','/auth/other'),url.replace('request=','request=x'),url.replace('http://','http://user@'),url+`&request=${id}`])expect(emailRequestCorrelation(bad,origin)).toBeNull();
});
it('bounds the input stream and leaves disabled service inert',async()=>{
 const f=setup(),disabled=registrationServiceHandler({enabled:false,project,origin,signingKey,authorizeApiKey:()=>true,command:f.command});
 expect((await disabled(await request())).status).toBe(503);
 expect((await f.handler(await request({padding:'a'.repeat(5000)}))).status).toBe(413);expect(f.command).not.toHaveBeenCalled();
});
