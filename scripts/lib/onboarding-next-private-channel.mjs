// Owned-child IPC only. Never logs payloads, starts processes or creates ports.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const kinds=new Set(['next-private-observation','next-private-provider-message','next-private-result']);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
function channel({ipc,nonce,incoming,outgoing,handle,onFailure=()=>{},timeoutMs=10000}){
 assert(/^[a-f0-9]{64}$/.test(nonce)&&typeof ipc.send==='function'&&typeof handle==='function');assert(Number.isInteger(timeoutMs)&&timeoutMs>=50&&timeoutMs<=10000);
 let closed=false,disconnectExpected=false,sent=0,received=0;const pending=new Map(),seen=new Set();
 const close=()=>{if(closed)return;closed=true;ipc.removeListener('message',message);ipc.removeListener('disconnect',disconnected);for(const row of pending.values()){clearTimeout(row.timer);row.reject(Error('Private Next channel unavailable; no retry'));}pending.clear();};
 const fail=()=>{close();try{onFailure();}catch{/* Never print a private message. */}};
 const send=body=>{assert(!closed&&ipc.connected,'Private Next channel disconnected');ipc.send({...body,nonce},error=>{if(error)fail();});};
 const message=value=>{
  if(!kinds.has(value?.kind))return;
  if(closed||value.nonce!==nonce||!uuid(value.requestId)){fail();return;}
  if(value.kind==='next-private-result'){
   const row=pending.get(value.requestId);if(!row||typeof value.ok!=='boolean'){fail();return;}pending.delete(value.requestId);clearTimeout(row.timer);
   if(value.ok)row.resolve(true);else{row.reject(Error('Private Next request rejected; no retry'));fail();}return;
  }
  if(value.kind!==incoming||seen.has(value.requestId)||++received>2000){fail();return;}
  seen.add(value.requestId);
  Promise.resolve().then(()=>handle(value.payload)).then(ok=>{if(!closed)send({kind:'next-private-result',requestId:value.requestId,ok:ok===true});if(ok!==true)fail();}).catch(()=>{try{if(!closed)send({kind:'next-private-result',requestId:value.requestId,ok:false});}catch{/* Channel failure is already terminal. */}fail();});
 };
 const disconnected=()=>{if(disconnectExpected&&pending.size===0)close();else fail();};ipc.on('message',message);ipc.once('disconnect',disconnected);
 return {close,expectDisconnect(){if(pending.size){fail();return false;}disconnectExpected=true;return true;},async request(payload){assert(!closed&&pending.size<8&&++sent<=2000,'Private Next request limit reached');const requestId=randomUUID();return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('Private Next acknowledgement timed out; no retry'));fail();},timeoutMs);pending.set(requestId,{resolve,reject,timer});try{send({kind:outgoing,requestId,payload});}catch{fail();}
  });},status(){return {closed,pending:pending.size,sent,received};}};
}
/** Only encrypted manifest references travel child -> parent. */
export const nextChildPrivateChannel=options=>channel({...options,incoming:'next-private-provider-message',outgoing:'next-private-observation'});
/** The parent supplies only a bound, privately handled provider message. No
 * parent/client transport response may be used as proof of inbox receipt. */
export const nextParentPrivateChannel=options=>channel({...options,incoming:'next-private-observation',outgoing:'next-private-provider-message'});
