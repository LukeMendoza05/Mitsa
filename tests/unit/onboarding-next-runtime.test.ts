import {it,expect,vi} from 'vitest';
import {startOnboardingNext} from '../../scripts/lib/onboarding-next-runtime.mjs';
const provider='https://mjtejwafxriwntweussc.supabase.co',keyA='a'.repeat(64),keyB='b'.repeat(64);
const fixture=()=>{
 const scope={active:vi.fn(),reserve:vi.fn()},network=vi.fn(async(_input:any,_init:any)=>new Response('{"ok":true}'));
 const original=vi.fn(),globals={fetch:original},prepare=vi.fn(async()=>{}),close=vi.fn(async()=>{}),seen:any[]=[];
 const createApplication=vi.fn(async()=>({prepare,close,getRequestHandler:()=>async(req:any,res:any)=>{
  seen.push({privateHeaderPresent:Object.keys(req.headers).some(k=>k.startsWith('x-mitsa-test-'))});
  if(req.url==='/parallel')await Promise.all([globals.fetch(provider+'/auth/v1/user'),globals.fetch(provider+'/rest/v1/rpc/mitsa_identity',{method:'POST'})]);
  else await globals.fetch(provider+'/auth/v1/user');
  res.setHeader('content-type','application/json');res.end('{"rendered":true}');
 }}));
 return {scope,network,original,globals,prepare,close,seen,createApplication,assertOwnedLaunch:vi.fn(async()=>{}),bindings:[{label:'e-a',authorization:keyA},{label:'e-b',authorization:keyB}],port:0,cleanupMs:1000};
};
const headers=(label='e-a',key=keyA)=>({'x-mitsa-test-fixture':label,'x-mitsa-test-authorization':key});
const start=(f:ReturnType<typeof fixture>)=>startOnboardingNext({...f,fetcher:f.network});
it('routes SSR through the bound producer transport without charging requests twice',async()=>{
 const f=fixture(),guarded=vi.fn(async()=>new Response('{}')),factory=vi.fn((_label:string,_signal:AbortSignal)=>guarded),server=await startOnboardingNext({...f,fetcher:f.network,fixtureTransportFactory:factory});
 try{expect((await fetch(server.origin,{headers:headers()})).status).toBe(200);expect(factory).toHaveBeenCalledWith('e-a',expect.any(AbortSignal));expect(guarded).toHaveBeenCalledOnce();expect(f.network).not.toHaveBeenCalled();expect(f.scope.reserve.mock.calls.map(c=>c[0])).toEqual(['nextInboundRequests']);}finally{await server.stop();}
});
it('counts outbound SSR work before provider I/O and strips private browser headers',async()=>{
 const f=fixture(),server=await start(f);
 try{const r=await fetch(server.origin+'/parallel',{headers:headers()});expect(r.status).toBe(200);expect(await r.json()).toEqual({rendered:true});
  expect(f.seen).toEqual([{privateHeaderPresent:false}]);expect(f.scope.reserve.mock.calls).toEqual([['nextInboundRequests',{fixture:'e-a'}],['authRequests',{fixture:'e-a'}],['resourceRequests',{fixture:'e-a'}]]);expect(f.network).toHaveBeenCalledTimes(2);
 }finally{expect(await server.stop()).toMatchObject({httpClosed:true,appClosed:true,pendingRequests:0,fetchRestored:true});}
 expect(f.globals.fetch).toBe(f.original);expect(f.close).toHaveBeenCalledOnce();
});
it('keeps parallel fixture requests isolated across asynchronous rendering',async()=>{
 const f=fixture(),server=await start(f);
 try{await Promise.all([fetch(server.origin,{headers:headers()}),fetch(server.origin,{headers:headers('e-b',keyB)})]);expect(f.scope.reserve.mock.calls.filter(c=>c[0]==='authRequests').map(c=>c[1].fixture).sort()).toEqual(['e-a','e-b']);}finally{await server.stop();}
});
it('rejects absent/wrong/retained browser bindings without contacting the provider',async()=>{
 const f=fixture(),server=await start(f);
 try{for(const h of [{},headers('e-a',keyB),headers('Yuno',keyA)]){const r=await fetch(server.origin,{headers:h});expect(r.status).toBe(403);}expect(f.network).not.toHaveBeenCalled();}finally{await server.stop();}
});
it('refuses startup before app preparation or sockets if execution ownership is absent',async()=>{
 const f=fixture();f.assertOwnedLaunch.mockRejectedValue(Error('PRIVATE-AUTHORITY'));await expect(start(f)).rejects.toThrow(/^Isolated Next execution is not authorized$/);expect(f.createApplication).not.toHaveBeenCalled();expect(f.globals.fetch).toBe(f.original);
});
it('does not allow background provider work outside a bound HTTP request',async()=>{
 const f=fixture(),server=await start(f);try{await expect(server.outsideContextProbe(provider+'/auth/v1/token',{method:'POST'})).rejects.toThrow('Unbound');expect(f.network).not.toHaveBeenCalled();}finally{await server.stop();}
});
it('fails closed on exhausted budgets, sanitizes renderer failures and never retries',async()=>{
 const f=fixture(),failure=vi.fn();f.scope.reserve.mockImplementation((kind:string)=>{if(kind==='authRequests')throw Error('PRIVATE-PROVIDER-DETAIL');});const server=await startOnboardingNext({...f,fetcher:f.network,onFailure:failure});
 try{const r=await fetch(server.origin,{headers:headers()});expect(r.status).toBe(503);expect(await r.text()).toBe('Test unavailable');expect(f.network).not.toHaveBeenCalled();expect(failure).toHaveBeenCalledWith('provider-or-budget');}finally{await server.stop();}
});
it('restores global interception after failed startup and is idempotent on normal shutdown',async()=>{
 const f=fixture();f.prepare.mockRejectedValue(Error('PRIVATE-STARTUP-DETAIL'));await expect(start(f)).rejects.toThrow(/^Isolated Next startup failed; no automatic retry$/);expect(f.globals.fetch).toBe(f.original);expect(f.close).toHaveBeenCalledOnce();
 const g=fixture(),server=await start(g);const a=server.stop(),b=server.stop();expect(a).toBe(b);await a;expect(g.close).toHaveBeenCalledOnce();
});
it('leaves deny-all installed after unconfirmed app cleanup instead of allowing unbounded network',async()=>{
 const f=fixture(),server=await start(f);f.close.mockRejectedValue(Error('PRIVATE-CLEANUP-DETAIL'));await expect(server.stop()).rejects.toThrow(/^Isolated Next cleanup unconfirmed$/);expect(f.globals.fetch).not.toBe(f.original);await expect(f.globals.fetch(provider+'/auth/v1/user')).rejects.toThrow('stopped');expect(f.network).not.toHaveBeenCalled();
});
it('drains an already bound request and its acknowledgement-dependent follow-up before cancelling transports',async()=>{const f=fixture();let release:any;const gate=new Promise<void>(resolve=>{release=resolve;});f.network.mockImplementationOnce(async()=>{await gate;return new Response('{}');});const server=await start(f),request=fetch(server.origin+'/parallel',{headers:headers()});await vi.waitFor(()=>expect(f.network).toHaveBeenCalled());const closing=server.stop();release();expect((await request).status).toBe(200);expect(await closing).toMatchObject({httpClosed:true,appClosed:true,pendingRequests:0,fetchRestored:true});expect(f.network).toHaveBeenCalledTimes(2);expect(f.close).toHaveBeenCalledOnce();});
it('rejects provider work retained by a finished HTTP context rather than granting background authority',async()=>{const f=fixture();let release:any,background:any;const gate=new Promise<void>(resolve=>{release=resolve;});f.createApplication.mockImplementation(async()=>({prepare:f.prepare,close:f.close,getRequestHandler:()=>async(_req:any,res:any)=>{background=gate.then(()=>f.globals.fetch(provider+'/auth/v1/user'));res.end('OFFLINE');}}));const server=await start(f);try{await (await fetch(server.origin,{headers:headers()})).text();release();await expect(background).rejects.toThrow('Finished request');expect(f.network).not.toHaveBeenCalled();}finally{await server.stop();}});
