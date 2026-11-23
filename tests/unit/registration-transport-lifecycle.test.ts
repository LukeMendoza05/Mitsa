import {expect,it,vi} from 'vitest';
import {fork,type ForkOptions} from 'node:child_process';
import {once,EventEmitter} from 'node:events';
import {fileURLToPath} from 'node:url';
import {disconnectCompletedTransportChild,remainingTransportRuntime,cleanupTransportResources,superviseTransportChild} from '../../scripts/lib/registration-transport-lifecycle.mjs';
import pg from 'pg';
import nodemailer from 'nodemailer';

async function fixture(mode:string, examine:(child:ReturnType<typeof fork>, exited:Promise<[number|null,NodeJS.Signals|null]>)=>Promise<void>) {
  const options:ForkOptions & {windowsHide:boolean}={silent:true,windowsHide:true};
  const child=fork(fileURLToPath(new URL('../support/transport-ipc-fixture.mjs',import.meta.url)),[mode],options);
  child.stdout!.resume();child.stderr!.resume();
  const exited=new Promise<[number|null,NodeJS.Signals|null]>(resolve=>child.once('exit',(code,signal)=>resolve([code,signal])));
  try {expect((await once(child,'message'))[0]).toEqual({bodyComplete:true});await examine(child,exited);}
  finally {if(child.exitCode===null&&child.signalCode===null)child.kill();await exited;}
}

it('OFFLINE reproduces a completed child staying alive with its disconnect listener',async()=>{
  await fixture('legacy',async(child)=>{
    await new Promise(resolve=>setTimeout(resolve,100));
    expect(child.exitCode).toBeNull();expect(child.signalCode).toBeNull();expect(child.connected).toBe(true);
  });
});
it('OFFLINE candidate closes IPC and exits normally after completed cleanup',async()=>{
  await fixture('corrected',async(_child,exited)=>{expect(await exited).toEqual([0,null]);});
});
it('OFFLINE candidate preserves an existing failure exit code',async()=>{
  await fixture('failed',async(_child,exited)=>{expect(await exited).toEqual([7,null]);});
});
it('removes only the owned emergency handler and disconnects once',()=>{
  const ipc=Object.assign(new EventEmitter(),{connected:true,disconnect(){ipc.connected=false;ipc.emit('disconnect');}});
  let emergency=0,other=0;const handler=()=>emergency++;
  ipc.once('disconnect',handler);ipc.once('disconnect',()=>other++);
  disconnectCompletedTransportChild(ipc,handler);disconnectCompletedTransportChild(ipc,handler);
  expect(emergency).toBe(0);expect(other).toBe(1);
});
it('counts fork startup time and respects an earlier approval deadline',()=>{
  const claimedAt='2026-10-27T00:00:00Z';
  expect(remainingTransportRuntime({claimedAt,notAfter:'2026-10-27T00:30:00Z',now:Date.parse(claimedAt)+5610})).toBe(294390);
  expect(remainingTransportRuntime({claimedAt,notAfter:'2026-10-27T00:02:00Z',now:Date.parse(claimedAt)+5610})).toBe(114390);
  expect(remainingTransportRuntime({claimedAt,notAfter:'2026-10-27T00:30:00Z',now:Date.parse(claimedAt)+300001})).toBe(0);
});
it('rejects malformed or backward lifecycle clocks',()=>{
  expect(()=>remainingTransportRuntime({claimedAt:'bad',notAfter:'bad'})).toThrow();
  expect(()=>remainingTransportRuntime({claimedAt:'2026-10-27T00:00:00Z',notAfter:'2026-10-27T00:30:00Z',now:0})).toThrow();
});

async function cleanupFixture(mode:string,maximumMs=5000,disconnect=false) {
  const startedAt=performance.now(),claimedAt=new Date().toISOString();
  const options:ForkOptions & {windowsHide:boolean}={silent:true,windowsHide:true};
  const child=fork(fileURLToPath(new URL('../support/transport-cleanup-fixture.mjs',import.meta.url)),[mode],options);
  const ready=once(child,'message');
  const supervision=superviseTransportChild(child,{claimedAt,notAfter:new Date(Date.now()+10000).toISOString(),startedAt,maximumMs});
  const [message]=await ready;
  if(disconnect)child.disconnect();
  const outcome=await supervision;
  expect(outcome.observedExit).toBe(true);expect(outcome.streamsClosed).toBe(true);
  expect(()=>process.kill(child.pid!,0)).toThrow();
  return {outcome,message,elapsedMs:performance.now()-startedAt};
}
it('OFFLINE actual supervised child releases owned timer handles and exits naturally',async()=>{
  const r=await cleanupFixture('normal');
  expect(r.outcome).toMatchObject({expired:false,code:0,signal:null});
  expect(r.message.events).toEqual(['smtp-close','db-end-start','db-end-complete']);
  expect(r.message.timeoutHandles).toBe(0);expect(r.elapsedMs).toBeLessThan(5000);
});
it('OFFLINE hung database cleanup destroys the connection and exits with failure',async()=>{
  const r=await cleanupFixture('hung-db');
  expect(r.outcome).toMatchObject({expired:false,code:3,signal:null});
  expect(r.message.events).toContain('db-destroy');expect(r.message.events).toContain('cleanup-failed');
  expect(r.message.timeoutHandles).toBe(0);
});
it('OFFLINE unexpected parent IPC loss closes owned resources and fails naturally',async()=>{
  const r=await cleanupFixture('disconnect',5000,true);
  expect(r.outcome).toMatchObject({expired:false,code:1,signal:null});
});
it('OFFLINE watchdog rejects a child that leaks a handle after cleanup',async()=>{
  const r=await cleanupFixture('leak',1200);
  expect(r.outcome.expired).toBe(true);expect(r.outcome.code===0&&r.outcome.signal===null).toBe(false);
});
it('cleanup errors do not disclose SMTP or database exception text',async()=>{
  const destroy=vi.fn(),clearTimers=vi.fn();
  await expect(cleanupTransportResources({transport:{close(){}},database:{end(){throw Error('private-credential-sentinel');},connection:{stream:{destroy}}},clearTimers})).rejects.toThrow('Transport resource cleanup failed');
  expect(destroy).toHaveBeenCalledOnce();expect(clearTimers).toHaveBeenCalledOnce();
});
it('wall-clock rollback cannot extend the monotonic supervisor deadline',()=>{
  const claimedAt='2026-10-27T00:00:00Z',now=Date.parse(claimedAt);
  expect(remainingTransportRuntime({claimedAt,notAfter:'2026-10-27T00:30:00Z',now,startedAt:100,monotonicNow:1100,maximumMs:240000})).toBe(239000);
  expect(remainingTransportRuntime({claimedAt,notAfter:'2026-10-27T00:30:00Z',now,startedAt:100,monotonicNow:240100,maximumMs:240000})).toBe(0);
});
it('closes actual installed pg/nodemailer clients without ever connecting',async()=>{
  const database=new pg.Client({host:'offline.invalid'});
  const transport=nodemailer.createTransport({host:'offline.invalid',port:465,secure:true,pool:false});
  const close=vi.spyOn(transport,'close');
  expect(await cleanupTransportResources({transport,database})).toEqual({transportCloseReturned:true,databaseEndCompleted:true});
  expect(close).toHaveBeenCalledOnce();expect(Reflect.get(database,'_ending')).toBe(true);
  expect(Reflect.get(database,'_connected')).toBe(false);
});
