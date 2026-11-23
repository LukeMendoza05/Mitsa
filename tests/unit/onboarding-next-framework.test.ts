import {it,expect} from 'vitest';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {existsSync,writeFileSync} from 'node:fs';
import {superviseTransportChild} from '../../scripts/lib/registration-transport-lifecycle.mjs';
it.skipIf(!existsSync('.next/BUILD_ID'))('OFFLINE actual built Next signup rendering uses counted SSR transport and child exits naturally',async()=>{
 const startedAt=performance.now(),claimedAt=new Date().toISOString();
 const child=fork(fileURLToPath(new URL('../support/onboarding-next-offline-fixture.mjs',import.meta.url)),[],{silent:true,windowsHide:true} as any);
 const messages:any[]=[],first=once(child,'message');child.on('message',m=>messages.push(m));
 const terminal=superviseTransportChild(child,{claimedAt,notAfter:new Date(Date.now()+30000).toISOString(),startedAt,maximumMs:25000});
 let stopped:any;
 try{
  const [ready]=await Promise.race([first,once(child,'exit').then(()=>{throw Error('Offline child exited before readiness');})]);expect(ready.kind,JSON.stringify(messages)).toBe('ready');expect(ready.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  const response=await fetch(ready.origin+'/signup',{headers:{'x-mitsa-test-fixture':'e-a','x-mitsa-test-authorization':'c'.repeat(64)},redirect:'error',signal:AbortSignal.timeout(15000)});
  expect(response.status).toBe(200);const html=await response.text();expect(html).toContain('Registration is closed');
  const last=once(child,'message');child.send({kind:'stop'});[stopped]=await Promise.race([last,once(child,'exit').then(()=>{throw Error('Offline child exited before cleanup acknowledgement');})]);
 }finally{if(child.connected&&!stopped)child.send({kind:'stop'});const outcome=await terminal;writeFileSync(`artifacts/onboarding-next-framework-observation-${Date.now()}.json`,JSON.stringify({messages,outcome,offline:true,providerCallsAreMocks:true})+'\n',{flag:'wx'});}
 const result=await terminal;
 expect(stopped).toMatchObject({kind:'stopped',counts:{nextInboundRequests:1,authRequests:1,resourceRequests:1},failures:[],outsideAttempts:0,privateObservations:2,credentialGuardStopped:true});
 expect(result).toMatchObject({expired:false,observedExit:true,code:0,signal:null,streamsClosed:true});expect(()=>process.kill(child.pid!,0)).toThrow();
},30000);
