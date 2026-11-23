import {it,expect,vi} from 'vitest';
import {createServerClient} from '@supabase/ssr';
import {onboardingFixtureTransport} from '../../scripts/lib/onboarding-fixture-transport.mjs';
const base='https://mjtejwafxriwntweussc.supabase.co',origin='http://127.0.0.1:3000',publicKey='sb_publishable_OFFLINE';
const ids={user:'10000000-0000-4000-8000-000000000001',session:'20000000-0000-4000-8000-000000000001',factor:'30000000-0000-4000-8000-000000000001',challenge:'40000000-0000-4000-8000-000000000001',intent:'50000000-0000-4000-8000-000000000001',dispatch:'60000000-0000-4000-8000-000000000001',permit:'70000000-0000-4000-8000-000000000001',business:'80000000-0000-4000-8000-000000000001'};
const token=(aal='aal1',sub=ids.user,session=ids.session)=>Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub,session_id:session,aal,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.OFFLINE-SIGNATURE';
function fixture(){
 const fixtures:any={'e-a':{label:'e-a',email:'offline+e-a@gmail.com',password:'PRIVATE-A',fullName:'Synthetic A',businessName:'Synthetic A Business',locationName:'Synthetic A Warehouse'},'e-b':{label:'e-b',email:'offline+e-b@gmail.com',password:'PRIVATE-B',fullName:'Synthetic B',businessName:'Synthetic B Business',locationName:'Synthetic B Warehouse'}};
 const state:any={action:'signup',factorStatus:null,confirmed:false,sessionAal:'aal1',sessionId:ids.session,badUser:false,fail:false,recovery:false};
 const user=()=>({id:state.badUser?'99999999-0000-4000-8000-000000000001':ids.user,email:fixtures['e-a'].email,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-10-27T00:00:00Z',email_confirmed_at:state.confirmed?'2026-10-27T00:00:00Z':undefined,factors:state.factorStatus?[{id:ids.factor,factor_type:'totp',status:state.factorStatus}]:[]});
 const session=()=>({access_token:token(state.sessionAal,ids.user,state.sessionId),refresh_token:'PRIVATE-OBSERVED-REFRESH',token_type:'bearer',expires_in:3600,user:user()});
 const fetcher=vi.fn(async(input:any,init:any)=>{if(state.fail)throw Error('PRIVATE-HTTP-ERROR');const url=new URL(input instanceof Request?input.url:String(input)),body=typeof init.body==='string'?JSON.parse(init.body):{};
  if(url.hostname==='challenges.cloudflare.com')return Response.json({success:true,hostname:'127.0.0.1',action:state.action,challenge_ts:new Date().toISOString()});
  if(url.pathname.endsWith('mitsa-registration-service')){
   if(body.action==='prepare')return Response.json({intentId:ids.intent,nonce:'a'.repeat(64),state:'prepared'});
   if(body.action==='authorize-mail')return Response.json({requestId:ids.dispatch,sendAllowed:true});
   if(body.action==='claim-signup')return Response.json({claimed:true});return Response.json({state:'sent'});
  }
  if(url.pathname==='/auth/v1/signup')return Response.json(user());
  if(url.pathname==='/auth/v1/verify'){state.confirmed=true;if(body.type==='recovery'){state.sessionId='20000000-0000-4000-8000-000000000002';state.sessionAal='aal1';}return Response.json(session());}
  if(url.pathname==='/auth/v1/token'){if(url.searchParams.get('grant_type')==='password')state.sessionAal='aal1';return Response.json(session());}
  if(url.pathname==='/auth/v1/user')return Response.json(user());
  if(url.pathname==='/auth/v1/logout')return new Response(null,{status:204});
  if(url.pathname==='/auth/v1/factors'){state.factorStatus='unverified';return Response.json({id:ids.factor,type:'totp',totp:{secret:'JBSWY3DPEHPK3PXP',uri:'otpauth://OFFLINE',qr_code:'<svg />'}});}
  if(url.pathname.endsWith('/challenge'))return Response.json({id:ids.challenge,type:'totp',expires_at:Math.floor(Date.now()/1000)+300});
  if(url.pathname.endsWith('/verify')){state.sessionAal='aal2';state.factorStatus='verified';return Response.json(session());}
  if(url.pathname.endsWith('mitsa_prepare_enrollment'))return Response.json(ids.permit);
  if(url.pathname.endsWith('mitsa_create_workspace'))return Response.json({id:ids.business,slug:'workspace-'+ids.business});
  return Response.json({ok:true});
 });
 const scope={fixture:(label:string)=>fixtures[label],assertRecipient:(label:string,email:string)=>fixtures[label]?.email===email,active:vi.fn(),reserve:vi.fn((_kind:string,_options:any)=>{})};
 const d={scope,publicKey,fetcher,notices:{termsId:ids.intent,privacyId:ids.dispatch},recoveryPasswords:{'e-a':'PRIVATE-REPLACEMENT-A','e-b':'PRIVATE-REPLACEMENT-B'},persistPrivate:vi.fn(async(_observation:any)=>{}),assertNewIdentity:vi.fn(async(_label:string,_id:string)=>true),assertExecutionReady:vi.fn(async(_label:string)=>{}),assertPersistentAdmission:vi.fn(async()=>{}),now:()=>Date.now()};
 const fence=onboardingFixtureTransport(d),send=fence.forFixture('e-a');
 const call=(path:string,body:any={},options:any={})=>send(base+path,{method:options.method??'POST',headers:{apikey:publicKey,authorization:'Bearer '+(options.token??publicKey),'content-type':'application/json',...(path.endsWith('mitsa-registration-service')?{'x-mitsa-nonce':Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex'),'x-mitsa-signature':'b'.repeat(64),'x-mitsa-time':String(Math.floor(Date.now()/1000))}:{})},body:options.method==='GET'?undefined:JSON.stringify(body)});
 const command=(action:string,payload:any)=>call('/functions/v1/mitsa-registration-service',{version:1,action,payload:{email:fixtures['e-a'].email,...payload}});
 const captcha=async()=>{await send('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:'OFFLINE-SECRET',response:'OFFLINE-PROOF'})});};
 const prime=async()=>{await captcha();await command('prepare',{submissionId:ids.intent,fullName:fixtures['e-a'].fullName,termsId:ids.intent,privacyId:ids.dispatch,accepted:true});await command('authorize-mail',{intentId:ids.intent,action:'signup',requestKey:ids.intent});await command('claim-signup',{submissionId:ids.intent});};
 const redirect='/auth/v1/signup?redirect_to='+encodeURIComponent(origin+'/auth/email?request='+ids.dispatch);
 const signupBody=()=>({email:fixtures['e-a'].email,password:fixtures['e-a'].password,data:{full_name:fixtures['e-a'].fullName,registration_nonce:'a'.repeat(64)}});
 const signup=async()=>{await prime();await call(redirect,signupBody());};
 const verify=async()=>{await signup();await fence.registerProviderMessage('e-a',{fixture:'e-a',jobId:ids.dispatch,action:'signup',recipientBound:true,intentBound:true,providerIssued:true,smtpAccepted:true,code:'123456'});await call('/auth/v1/verify',{type:'signup',email:fixtures['e-a'].email,token:'123456'});};
 return {fixtures,state,d,scope,fetcher,fence,send,call,command,captcha,prime,redirect,signupBody,signup,verify};
}
it('has no provider or evidence effects until explicitly invoked',()=>{const f=fixture();expect(f.fetcher).not.toHaveBeenCalled();expect(f.d.persistPrivate).not.toHaveBeenCalled();expect(f.scope.reserve).not.toHaveBeenCalled();});
it('binds server CAPTCHA, notices, intent, claim, recipient, real provider identity and captured OTP before accepting the fixture session',async()=>{
 const f=fixture();await f.verify();expect(f.fence.privateState('e-a')).toMatchObject({userId:ids.user,intentId:ids.intent,signupServerChallenge:true,usedDeveloperAllowlist:false,accessToken:token()});expect(f.d.assertNewIdentity).toHaveBeenCalledWith('e-a',ids.user);expect(f.scope.reserve.mock.calls.filter(c=>c[0]==='newAccounts')).toEqual([['newAccounts',{fixture:'e-a'}]]);expect(JSON.stringify(f.fence.status())).not.toMatch(/PRIVATE|offline\+|123456|eyJ/);
});
it('rejects retained bearer and refresh credentials before any network operation',async()=>{
 for(const run of [(f:any)=>f.call('/auth/v1/user',{}, {method:'GET',token:token()}),(f:any)=>f.call('/auth/v1/token?grant_type=refresh_token',{refresh_token:'PRIVATE-RETAINED-REFRESH'})]){const f=fixture();await expect(run(f)).rejects.toThrow('private values suppressed');expect(f.fetcher).not.toHaveBeenCalled();expect(f.scope.reserve).not.toHaveBeenCalled();}
});
it('does not let one fixture borrow another fixture session',async()=>{
 const f=fixture();await f.verify();const count=f.fetcher.mock.calls.length;await expect(f.fence.forFixture('e-b')(base+'/auth/v1/user',{headers:{apikey:publicKey,authorization:'Bearer '+token()}})).rejects.toThrow();expect(f.fetcher).toHaveBeenCalledTimes(count);
});
it('rejects wrong email, password, unsigned signup, foreign redirect and unapproved account fields before forwarding',async()=>{
 for(const mutate of [(f:any)=>({...f.signupBody(),email:'retained@example.com'}),(f:any)=>({...f.signupBody(),password:'WRONG'}),(f:any)=>({...f.signupBody(),data:{...f.signupBody().data,role:'owner'}})]){const f=fixture();await f.prime();const count=f.fetcher.mock.calls.length;await expect(f.call(f.redirect,mutate(f))).rejects.toThrow();expect(f.fetcher).toHaveBeenCalledTimes(count);}
 const f=fixture();await expect(f.call(f.redirect,f.signupBody())).rejects.toThrow();expect(f.fetcher).not.toHaveBeenCalled();
 const g=fixture();await g.prime();const count=g.fetcher.mock.calls.length;await expect(g.call('/auth/v1/signup?redirect_to='+encodeURIComponent('https://foreign.example'),g.signupBody())).rejects.toThrow();expect(g.fetcher).toHaveBeenCalledTimes(count);
});
it('fails when the controller does not prove the newly returned identity is absent from retained accounts',async()=>{
 const f=fixture();f.d.assertNewIdentity.mockResolvedValue(false);await expect(f.signup()).rejects.toThrow();expect(f.fence.status().stopped).toBe(true);expect(f.scope.reserve.mock.calls.filter(c=>c[0]==='newAccounts')).toHaveLength(1);
});
it('persists private observations before returning and keeps attempted provider operations spent on storage failure',async()=>{
 const f=fixture();await f.prime();f.d.persistPrivate.mockRejectedValue(Error('PRIVATE-STORAGE'));await expect(f.call(f.redirect,f.signupBody())).rejects.toThrow();expect(f.scope.reserve.mock.calls.filter(c=>c[0]==='newAccounts')).toHaveLength(1);const count=f.fetcher.mock.calls.length;await expect(f.call(f.redirect,f.signupBody())).rejects.toThrow();expect(f.fetcher).toHaveBeenCalledTimes(count);
});
it('does not accept synthetic or unregistered verification and recovery material',async()=>{
 const f=fixture();await f.signup();const count=f.fetcher.mock.calls.length;await expect(f.call('/auth/v1/verify',{email:f.fixtures['e-a'].email,type:'signup',token:'123456'})).rejects.toThrow();expect(f.fetcher).toHaveBeenCalledTimes(count);
 const g=fixture();await g.verify();const n=g.fetcher.mock.calls.length;await expect(g.call('/auth/v1/verify',{type:'recovery',token_hash:'b'.repeat(64)})).rejects.toThrow();expect(g.fetcher).toHaveBeenCalledTimes(n);
});
it('reserves factor/workspace/location attempts at actual provider calls and permits only bound targets',async()=>{
 const f=fixture();await f.verify();const auth=token();await f.call('/rest/v1/rpc/mitsa_prepare_enrollment',{}, {token:auth});await f.call('/auth/v1/factors',{factor_type:'totp'}, {token:auth});await f.call('/auth/v1/factors/'+ids.factor+'/challenge',{}, {token:auth});await f.call('/auth/v1/factors/'+ids.factor+'/verify',{challenge_id:ids.challenge,code:'123456'}, {token:auth});
 await f.call('/rest/v1/rpc/mitsa_bind_factor',{p_factor:ids.factor,p_permit:ids.permit},{token:token('aal2')});await f.call('/rest/v1/rpc/mitsa_create_workspace',{p_name:f.fixtures['e-a'].businessName,p_location:f.fixtures['e-a'].locationName,p_kind:'warehouse',p_key:ids.intent},{token:token('aal2')});
 expect(f.scope.reserve.mock.calls.filter(c=>['newFactors','newWorkspaces','newLocations'].includes(c[0])).map(c=>c[0])).toEqual(['newFactors','newWorkspaces','newLocations']);const count=f.fetcher.mock.calls.length;await expect(f.call('/rest/v1/rpc/mitsa_workspace',{p_slug:'workspace-'+ids.user},{token:token('aal2')})).rejects.toThrow();expect(f.fetcher).toHaveBeenCalledTimes(count);
});
it('does not allow profile, role or verified factor mutations outside the approved journey',async()=>{
 for(const run of [(f:any)=>f.call('/auth/v1/user',{email:'other@example.com'},{method:'PUT',token:token()}),(f:any)=>f.call('/auth/v1/factors/'+ids.factor,{}, {method:'DELETE',token:token()}),(f:any)=>f.call('/rest/v1/rpc/mitsa_member_update',{p_role:'owner'},{token:token()})]){const f=fixture();await f.verify();const count=f.fetcher.mock.calls.length;await expect(run(f)).rejects.toThrow();expect(f.fetcher).toHaveBeenCalledTimes(count);}
});
it('keeps fixture, replacement-password and notice inputs immutable after construction',async()=>{
 const f=fixture();f.fixtures['e-a'].password='CHANGED';f.d.recoveryPasswords['e-a']='CHANGED';f.d.notices.termsId='CHANGED';await f.captcha();await f.command('prepare',{submissionId:ids.intent,fullName:'Synthetic A',termsId:ids.intent,privacyId:ids.dispatch,accepted:true});expect(f.d.assertPersistentAdmission).toHaveBeenCalledOnce();
});
it('allows only the exact public GET key discovery path and preserves unknown-method denial',async()=>{
 const f=fixture();await f.call('/auth/v1/.well-known/jwks.json',{}, {method:'GET'});expect(f.scope.reserve).toHaveBeenCalledWith('authRequests',{fixture:'e-a'});const count=f.fetcher.mock.calls.length;await expect(f.call('/auth/v1/.well-known/jwks.json')).rejects.toThrow();expect(f.fetcher).toHaveBeenCalledTimes(count);
});
it('integrates the installed SSR/PKCE client with real signup, OTP and MFA request shapes using mock transport only',async()=>{
 const f=fixture(),jar:any[]=[];await f.prime();const client=createServerClient(base,publicKey,{global:{fetch:f.send as any},cookies:{getAll:()=>jar,setAll:(items:any[])=>{for(const item of items){const old=jar.find(i=>i.name===item.name);if(old)Object.assign(old,item);else jar.push({...item});}}}});
 const signed=await client.auth.signUp({email:f.fixtures['e-a'].email,password:f.fixtures['e-a'].password,options:{emailRedirectTo:origin+'/auth/email?request='+ids.dispatch,data:{full_name:f.fixtures['e-a'].fullName,registration_nonce:'a'.repeat(64)}}});expect(signed.error).toBeNull();expect(signed.data.session).toBeNull();
 await f.fence.registerProviderMessage('e-a',{fixture:'e-a',jobId:ids.dispatch,action:'signup',recipientBound:true,intentBound:true,providerIssued:true,smtpAccepted:true,code:'123456'});
 const verified=await client.auth.verifyOtp({type:'signup',email:f.fixtures['e-a'].email,token:'123456'});expect(verified.error).toBeNull();
 const enrollment=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Synthetic',issuer:'Mitsa'});expect(enrollment.error).toBeNull();const mfa=await client.auth.mfa.challengeAndVerify({factorId:ids.factor,code:'123456'});expect(mfa.error).toBeNull();expect(f.fence.privateState('e-a').factorIds).toEqual([ids.factor]);
 const signup=f.fetcher.mock.calls.find(([input])=>new URL(String(input)).pathname==='/auth/v1/signup')!;expect(new URL(String(signup[0])).searchParams.get('redirect_to')).toBe(origin+'/auth/email?request='+ids.dispatch);expect(JSON.parse(signup[1].body).code_challenge).toBeTruthy();client.auth.stopAutoRefresh();
});
it('supports installed-SDK recovery and password update only after the known recovery session completes retained TOTP',async()=>{
 const f=fixture(),jar:any[]=[];await f.prime();const client=createServerClient(base,publicKey,{global:{fetch:f.send as any},cookies:{getAll:()=>jar,setAll:(items:any[])=>{for(const item of items){const old=jar.find(i=>i.name===item.name);if(old)Object.assign(old,item);else jar.push({...item});}}}});
 await client.auth.signUp({email:f.fixtures['e-a'].email,password:f.fixtures['e-a'].password,options:{emailRedirectTo:origin+'/auth/email?request='+ids.dispatch,data:{full_name:f.fixtures['e-a'].fullName,registration_nonce:'a'.repeat(64)}}});
 await f.fence.registerProviderMessage('e-a',{fixture:'e-a',jobId:ids.dispatch,action:'signup',recipientBound:true,intentBound:true,providerIssued:true,smtpAccepted:true,code:'123456'});await client.auth.verifyOtp({type:'signup',email:f.fixtures['e-a'].email,token:'123456'});
 await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Synthetic',issuer:'Mitsa'});await client.auth.mfa.challengeAndVerify({factorId:ids.factor,code:'123456'});await client.auth.signOut({scope:'local'});
 f.state.action='recovery';await f.captcha();await f.command('authorize-mail',{action:'recovery',requestKey:ids.challenge});const requested=await client.auth.resetPasswordForEmail(f.fixtures['e-a'].email,{redirectTo:origin+'/auth/email?request='+ids.dispatch});expect(requested.error).toBeNull();
 await f.fence.registerProviderMessage('e-a',{fixture:'e-a',jobId:ids.challenge,action:'recovery',recipientBound:true,intentBound:true,providerIssued:true,smtpAccepted:true,tokenHash:'b'.repeat(64)});expect(f.fence.privateState('e-a').recoveryVerifyAttempts).toBe(0);
 const verified=await client.auth.verifyOtp({type:'recovery',token_hash:'b'.repeat(64)});expect(verified.error).toBeNull();expect(f.fence.privateState('e-a').recoveryVerifyAttempts).toBe(1);
 await client.auth.mfa.challengeAndVerify({factorId:ids.factor,code:'123456'});const updated=await client.auth.updateUser({password:'PRIVATE-REPLACEMENT-A'});expect(updated.error).toBeNull();expect(f.fence.privateState('e-a').passwordUpdateAccepted).toBe(true);client.auth.stopAutoRefresh();
});
it('preserves observed renewal attempts and forwards known fixture tokens to the provider instead of fabricating a local revocation guarantee',async()=>{
 const f=fixture();await f.verify();const count=f.fetcher.mock.calls.length;await f.call('/auth/v1/token?grant_type=refresh_token',{refresh_token:'PRIVATE-OBSERVED-REFRESH'});expect(f.fetcher).toHaveBeenCalledTimes(count+1);expect(f.fence.status().policyRelaxed).toBe(false);
});
it('permits the actual workspace shell own-account profile read but keeps profile mutations denied',async()=>{const f=fixture();await f.verify();await f.call('/rest/v1/rpc/mitsa_account_profile',{}, {token:token()});expect(f.fetcher.mock.calls.some(([input])=>String(input).endsWith('/rpc/mitsa_account_profile'))).toBe(true);const count=f.fetcher.mock.calls.length;await expect(f.call('/rest/v1/rpc/mitsa_account_profile_save',{p_name:'unapproved'},{token:token()})).rejects.toThrow();expect(f.fetcher).toHaveBeenCalledTimes(count);});
it('propagates the runtime stop signal before another bound provider request can begin',async()=>{
 const f=fixture(),abort=new AbortController(),send=f.fence.forFixture('e-a',abort.signal);abort.abort();await expect(send(base+'/auth/v1/settings',{headers:{apikey:publicKey}})).rejects.toThrow();expect(f.fetcher).not.toHaveBeenCalled();
});
