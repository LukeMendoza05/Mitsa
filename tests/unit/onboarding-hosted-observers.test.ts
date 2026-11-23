import {it,expect,vi} from 'vitest';
import {createOnboardingObservers} from '../../scripts/lib/onboarding-hosted-observers.mjs';
import {onboardingProbeSql as sql} from '../../scripts/lib/onboarding-probe-sql.mjs';
const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'];
const sessions=['20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002'];
const labels=['e-a','e-b'];
function fixture(){
 const state:any={live:true,aal:'aal2',trusted:true,expired:false,wrongUser:false,operator:false,missing:false,authorized:true,forbidden:true,denyCode:'42501',refreshAccepted:false,replayAccepted:false,changedFactor:false};
 const work=(n:number)=>({id:ids[n],slug:'workspace-'+ids[n],role:'owner',active:true,primaryOwner:true,locationMatches:true,digest:'protected-business'});
 const row=(n:number)=>({id:ids[n],email_confirmed:true,active:true,super_admin:false,is_anonymous:false,platform_operator:state.operator,intent_id:ids[n],terms_id:'terms',privacy_id:'privacy',session_policy:'strict',emergency_blocked:false,intent_bound:true,generation_bound:true,profile_bound:true,memberships:1});
 const token=(n:number)=>'offline.'+Buffer.from(JSON.stringify({sub:state.wrongUser?ids[1-n]:ids[n],session_id:sessions[n],exp:state.expired?1000:9000})).toString('base64url')+'.not-a-signature';
 const privateState=vi.fn(async(label:string)=>{const n=labels.indexOf(label);return {userId:ids[n],accessToken:token(n),refreshToken:'PRIVATE-REFRESH-'+n,intentId:ids[n],signupServerChallenge:true,usedDeveloperAllowlist:false,lastRecoveryTokenHash:'a'.repeat(64),recoveryVerifyAttempts:0,passwordUpdateAccepted:true};});
 const query=vi.fn(async(text:string,args:any[]):Promise<{rows:any[]} >=>{
  if(text===sql.absent)return {rows:state.missing?[]:[{id:ids[0]}]};
  if(text===sql.registration)return {rows:[row(String(args[0]).includes('e-b')?1:0)]};
  if(text===sql.session)return {rows:[{live:state.live,aal:state.aal,database_seconds:1000}]};
  if(text===sql.mfa)return {rows:[{factors:[{id:ids[0],type:'totp',status:'verified',trusted:state.trusted,protected:state.changedFactor?'changed':'protected-factor'}]}]};
  if(text===sql.workspace)return {rows:[{workspaces:[work(args[0]===ids[0]?0:1)]}]};
  throw Error('PRIVATE-DB-ERROR');
 });
 const reserve=vi.fn(),scope={active:vi.fn(),reserve,wrapSql:(q:any,{readOnlySql}:any)=>async(text:string,args:any[])=>{expect(readOnlySql.has(text)).toBe(true);reserve('sqlRequests');return q(text,args);},assertRecipient:(label:string,email:string)=>labels.includes(label)&&email==='offline+'+label+'@gmail.com'};
 const fetcher=vi.fn(async(input:any,init:any)=>{
  const u=new URL(String(input)),body=JSON.parse(init.body),claims=JSON.parse(Buffer.from(new Headers(init.headers).get('authorization')!.split('.')[1]??'e30','base64url').toString()),n=ids.indexOf(claims.sub);
  if(u.pathname==='/auth/v1/token')return Response.json(state.refreshAccepted?{access_token:'PRIVATE-UNEXPECTED-SESSION'}:{error_code:'refresh_token_not_found'},{status:state.refreshAccepted?200:400});
  if(u.pathname==='/auth/v1/verify')return Response.json(state.replayAccepted?{access_token:'PRIVATE-REPLAY-SESSION'}:{error_code:'otp_expired'},{status:state.replayAccepted?200:403});
  if(u.pathname.endsWith('mitsa_identity'))return state.live?Response.json({userId:ids[n],mfaReady:state.aal==='aal2'&&state.trusted}):Response.json({code:state.denyCode},{status:403});
  const own=body.p_business===ids[n]||body.p_slug===work(n).slug;
  return !own&&state.forbidden||state.aal==='aal1'||!state.authorized?Response.json({code:state.denyCode},{status:403}):Response.json({authorized:true});
 });
 const d={publicKey:'sb_publishable_OFFLINE',comparisonKey:Buffer.alloc(32,1),db:{query},scope,generation:ids[0],notices:{termsId:'terms',privacyId:'privacy'},assertExecutionReady:vi.fn(async(label:string)=>{if(!state.authorized&&label==='blocked')throw Error('no');}),fixture:(label:string)=>({email:'offline+'+label+'@gmail.com',locationName:'Synthetic Warehouse'}),privateState,fetcher,persistPrivate:vi.fn(async(_value:any)=>{}),expectedWorkspaceSlug:vi.fn(async(label:string)=>work(labels.indexOf(label)).slug)};
 return {state,d,query,fetcher,observer:createOnboardingObservers(d)};
}
it('uses bound identity/consent/session/factor/workspace probes, without exposing private values in public results',async()=>{
 const f=fixture();expect(await f.observer.inspectRegistration('e-a')).toEqual({providerUserCreated:true,serverTurnstileVerified:true,signedIntentBound:true,consentMatches:true,noDeveloperAllowlist:true});
 const s=await f.observer.inspectSession('e-a');expect(s).toMatchObject({fixtureMatches:true,emailConfirmed:true,aal:'aal2',mfaReady:true,membershipCount:1,role:'owner',locationMatches:true});
 expect(JSON.stringify(s)).not.toMatch(/PRIVATE|offline\+|protected-factor/);expect(f.fetcher).toHaveBeenCalledOnce();
});
it('requires execution authority and exact fixtures before issuing probes',async()=>{
 const f=fixture();await expect(f.observer.inspectSession('retained')).rejects.toThrow('Unapproved observer fixture');expect(f.query).not.toHaveBeenCalled();
 f.d.assertExecutionReady.mockRejectedValue(Error('not approved'));await expect(f.observer.inspectSession('e-a')).rejects.toThrow('not approved');expect(f.fetcher).not.toHaveBeenCalled();
});
it('does not treat a decoded JWT, stale session, operator identity, or expired bearer as verified',async()=>{
 for(const property of ['wrongUser','expired','operator']){const f=fixture();f.state[property]=true;await expect(f.observer.inspectSession('e-a')).rejects.toThrow();expect(f.fetcher).not.toHaveBeenCalled();}
 const f=fixture();f.state.live=false;await expect(f.observer.inspectSession('e-a')).rejects.toThrow('not currently usable');
});
it('does not report trusted MFA merely because a provider session is AAL2',async()=>{
 const f=fixture();f.state.trusted=false;expect((await f.observer.inspectSession('e-a')).mfaReady).toBe(false);
});
it('requires exact-session logout, bearer denial before expiration and refresh rejection, and avoids repeating the spent refresh probe',async()=>{
 const f=fixture();await f.observer.identifyExactSession('e-a');f.state.live=false;
 expect(await f.observer.verifyExactLogout('e-a')).toEqual({sessionRevoked:true,formerBearerDenied:true,refreshDenied:true});
 const count=f.fetcher.mock.calls.length;expect(await f.observer.verifyExactLogout('e-a')).toMatchObject({refreshDenied:true});expect(f.fetcher).toHaveBeenCalledTimes(count);
 expect(f.d.persistPrivate).toHaveBeenCalledWith(expect.objectContaining({kind:'logout-witness'}));
});
it('records an unexpected renewal privately and fails the logout evidence',async()=>{
 const f=fixture();await f.observer.identifyExactSession('e-a');f.state.live=false;f.state.refreshAccepted=true;expect((await f.observer.verifyExactLogout('e-a')).refreshDenied).toBe(false);
 expect(f.d.persistPrivate).toHaveBeenCalledWith(expect.objectContaining({kind:'unexpected-refresh-session'}));
});
it('does not equate generic forbidden or an already expired JWT with revocation proof',async()=>{
 const f=fixture();await f.observer.identifyExactSession('e-a');f.state.live=false;f.state.denyCode='unknown';expect((await f.observer.verifyExactLogout('e-a')).formerBearerDenied).toBe(false);
 const g=fixture();await g.observer.identifyExactSession('e-a');g.query.mockImplementation(async()=>({rows:[{live:false,database_seconds:9000}]}));await expect(g.observer.verifyExactLogout('e-a')).rejects.toThrow('expired');expect(g.fetcher).not.toHaveBeenCalled();
});
it('checks AAL1 denial against a known existing workspace instead of passing when the target is missing',async()=>{
 const f=fixture();f.state.aal='aal1';expect(await f.observer.workspaceDeniedAtAal1('e-a')).toBe(true);
 f.d.expectedWorkspaceSlug.mockResolvedValue('');await expect(f.observer.workspaceDeniedAtAal1('e-a')).rejects.toThrow('Known synthetic workspace');
});
it('compares protected MFA and ownership invariants and rejects recovery-token replay',async()=>{
 const f=fixture();await f.observer.snapshotRecoveryInvariants('e-a');await f.observer.identifyExactSession('e-a');f.state.live=false;
 expect(await f.observer.inspectRecoveryEffects('e-a')).toEqual({passwordChanged:true,factorBindingsUnchanged:true,workspaceOwnershipUnchanged:true,tokenReplayDenied:true,priorSessionDenied:true});
 f.state.changedFactor=true;f.state.replayAccepted=true;expect(await f.observer.inspectRecoveryEffects('e-a')).toMatchObject({factorBindingsUnchanged:false,tokenReplayDenied:false});
});
it('proves both tenants can access their own routes before testing six actual cross-tenant denials',async()=>{
 const f=fixture();const result=await f.observer.crossTenantDenials();expect(result).toHaveLength(6);expect(result.every(r=>r.denied)).toBe(true);expect(f.fetcher).toHaveBeenCalledTimes(14);
 f.state.forbidden=false;await expect(f.observer.crossTenantDenials()).rejects.toThrow('denial unconfirmed');
});
it('does not turn a blanket RPC outage or denial into a tenant-isolation pass',async()=>{
 const f=fixture();f.state.authorized=false;await expect(f.observer.crossTenantDenials()).rejects.toThrow('Positive workspace authorization witness');
});
it('suppresses database error detail rather than exposing private bound parameters',async()=>{
 const f=fixture();f.query.mockRejectedValue(Error('PRIVATE-EMAIL-AND-QUERY'));await expect(f.observer.inspectSession('e-a')).rejects.toThrow(/^Private observer database probe failed; details suppressed$/);
});
