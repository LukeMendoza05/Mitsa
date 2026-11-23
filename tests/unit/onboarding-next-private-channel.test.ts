import {it,expect,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {nextChildPrivateChannel,nextParentPrivateChannel} from '../../scripts/lib/onboarding-next-private-channel.mjs';
const nonce='a'.repeat(64);
function pair(){
 const a:any=new EventEmitter(),b:any=new EventEmitter(),sent:any[]=[];a.connected=true;b.connected=true;
 a.send=(value:any,done:any)=>{sent.push(value);queueMicrotask(()=>{b.emit('message',structuredClone(value));done?.(null);});};
 b.send=(value:any,done:any)=>{sent.push(value);queueMicrotask(()=>{a.emit('message',structuredClone(value));done?.(null);});};return {a,b,sent};
}
it('exchanges encrypted-manifest references and private provider messages with bounded boolean acknowledgements',async()=>{
 const f=pair(),observe=vi.fn(async()=>true),message=vi.fn(async()=>true),parent=nextParentPrivateChannel({ipc:f.a,nonce,handle:observe}),child=nextChildPrivateChannel({ipc:f.b,nonce,handle:message});
 try{const manifest={path:'OFFLINE/cipher.pgp',cipherSha256:'b'.repeat(64),label:'e-a',sequence:1};expect(await child.request(manifest)).toBe(true);expect(observe).toHaveBeenCalledWith(manifest);expect(await parent.request({label:'e-a',message:{code:'PRIVATE-OFFLINE-CODE'}})).toBe(true);expect(message).toHaveBeenCalledOnce();expect(JSON.stringify(parent.status())).not.toContain('PRIVATE');expect(f.sent.filter(v=>v.kind==='next-private-result').every(v=>v.ok===true&&!v.payload)).toBe(true);}finally{parent.close();child.close();}
 expect(parent.status().pending).toBe(0);expect(f.a.listenerCount('message')).toBe(0);
});
it('does not bypass controller rejection or retry a rejected private observation',async()=>{
 const f=pair(),failure=vi.fn(),parent=nextParentPrivateChannel({ipc:f.a,nonce,handle:async()=>false,onFailure:failure}),child=nextChildPrivateChannel({ipc:f.b,nonce,handle:async()=>true});
 await expect(child.request({path:'wrong'})).rejects.toThrow('request rejected');expect(failure).toHaveBeenCalledOnce();await expect(child.request({path:'wrong'})).rejects.toThrow();expect(parent.status().received).toBe(1);parent.close();child.close();
});
it('fails on missing acknowledgements and unexpected disconnect, clearing owned timers',async()=>{
 const f=pair(),failure=vi.fn(),child=nextChildPrivateChannel({ipc:f.b,nonce,handle:async()=>true,onFailure:failure,timeoutMs:50});await expect(child.request({path:'OFFLINE'})).rejects.toThrow('timed out');expect(child.status()).toMatchObject({closed:true,pending:0,sent:1});expect(failure).toHaveBeenCalledOnce();
 const g=pair(),failed=vi.fn(),parent=nextParentPrivateChannel({ipc:g.a,nonce,handle:async()=>true,onFailure:failed});g.a.emit('disconnect');expect(parent.status().closed).toBe(true);expect(failed).toHaveBeenCalledOnce();
});
it('treats an explicitly expected post-acknowledgement disconnect as normal cleanup',()=>{
 const f=pair(),failure=vi.fn(),parent=nextParentPrivateChannel({ipc:f.a,nonce,handle:async()=>true,onFailure:failure});expect(parent.expectDisconnect()).toBe(true);f.a.emit('disconnect');expect(parent.status().closed).toBe(true);expect(failure).not.toHaveBeenCalled();
});
it('does not declare disconnect safe while an observation is awaiting acknowledgement',async()=>{
 const f=pair(),failure=vi.fn(),child=nextChildPrivateChannel({ipc:f.b,nonce,handle:async()=>true,onFailure:failure,timeoutMs:500}),pending=child.request({path:'OFFLINE'});expect(child.expectDisconnect()).toBe(false);await expect(pending).rejects.toThrow();expect(failure).toHaveBeenCalledOnce();
});
it('rejects foreign nonces, forged results and replayed incoming request identifiers',async()=>{
 for(const value of [{kind:'next-private-result',nonce:'b'.repeat(64),requestId:crypto.randomUUID(),ok:true},{kind:'next-private-result',nonce,requestId:crypto.randomUUID(),ok:true}]){const f=pair(),failure=vi.fn(),parent=nextParentPrivateChannel({ipc:f.a,nonce,handle:async()=>true,onFailure:failure});f.a.emit('message',value);expect(failure).toHaveBeenCalledOnce();expect(parent.status().closed).toBe(true);}
 const f=pair(),handle=vi.fn(async()=>true),failure=vi.fn(),parent=nextParentPrivateChannel({ipc:f.a,nonce,handle,onFailure:failure}),value={kind:'next-private-observation',nonce,requestId:crypto.randomUUID(),payload:{path:'OFFLINE'}};f.a.emit('message',value);await Promise.resolve();f.a.emit('message',value);expect(handle).toHaveBeenCalledOnce();expect(failure).toHaveBeenCalledOnce();parent.close();
});
it('suppresses handler errors and never sends their private details to the other process',async()=>{
 const f=pair(),parent=nextParentPrivateChannel({ipc:f.a,nonce,handle:async()=>{throw Error('PRIVATE-PROVIDER-CREDENTIAL');}}),child=nextChildPrivateChannel({ipc:f.b,nonce,handle:async()=>true});await expect(child.request({path:'OFFLINE'})).rejects.toThrow('Private Next request rejected; no retry');expect(JSON.stringify(f.sent)).not.toContain('PRIVATE-PROVIDER');parent.close();child.close();
});
