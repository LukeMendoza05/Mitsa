import {it,expect} from 'vitest';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {controllerParentAcknowledgement} from '../../scripts/lib/onboarding-controller-channel.mjs';
import {superviseTransportChild} from '../../scripts/lib/registration-transport-lifecycle.mjs';
it.each(['normal','missing','disconnect','wrong','clean-without-ack'])('OFFLINE root process: %s requires both natural cleanup exit and delivered acknowledgement',async mode=>{
 const startedAt=performance.now(),nonce='a'.repeat(64),child=fork(fileURLToPath(new URL('../support/onboarding-controller-ack-fixture.mjs',import.meta.url)),[mode],{silent:true,windowsHide:true,execArgv:[]} as any),terminal=superviseTransportChild(child,{claimedAt:new Date().toISOString(),notAfter:new Date(Date.now()+5000).toISOString(),startedAt,maximumMs:4000});
 const ack=mode==='normal'?controllerParentAcknowledgement({ipc:child,nonce,assertBody:()=>{}}):null;
 child.on('message',m=>{if((m as any)?.kind==='onboarding-body-complete'){if(mode==='disconnect')child.disconnect();if(mode==='wrong')child.send({kind:'onboarding-ack',nonce:'b'.repeat(64)});}});
 child.send({kind:'start',nonce});const r=await terminal;ack?.close();expect(r).toMatchObject({expired:false,observedExit:true,signal:null,streamsClosed:true,streamError:false});expect(()=>process.kill(child.pid!,0)).toThrow();expect(r.code).toBe(mode==='normal'||mode==='clean-without-ack'?0:1);
 const accepted=r.code===0&&ack?.accepted()===true;expect(accepted).toBe(mode==='normal');
},10000);
