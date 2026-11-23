// Root supervisor completion acknowledgement. No process launch or network.
import assert from 'node:assert/strict';
const valid=n=>typeof n==='string'&&/^[a-f0-9]{64}$/.test(n);
export async function awaitControllerResultAck({ipc,nonce,timeoutMs=10000}){
 assert(valid(nonce)&&ipc?.connected&&typeof ipc.send==='function');assert(timeoutMs>=20&&timeoutMs<=10000);let timer,receive,disconnect;
 try{return await new Promise((resolve,reject)=>{
  receive=m=>{if(m?.kind!=='onboarding-ack')return;if(m.nonce!==nonce){reject(Error('Controller acknowledgement binding failed'));return;}resolve(true);};disconnect=()=>reject(Error('Controller parent disconnected before acknowledgement'));
  ipc.on('message',receive);ipc.once('disconnect',disconnect);timer=setTimeout(()=>reject(Error('Controller result acknowledgement missing')),timeoutMs);
  try{ipc.send({kind:'onboarding-body-complete',nonce},error=>{if(error)reject(Error('Controller result communication failed'));});}catch{reject(Error('Controller result communication failed'));}
 });}finally{clearTimeout(timer);ipc.removeListener('message',receive);ipc.removeListener('disconnect',disconnect);}
}
export function controllerParentAcknowledgement({ipc,nonce,assertBody,onFailure=()=>{}}){
 assert(valid(nonce)&&typeof ipc?.send==='function'&&typeof assertBody==='function');let sent=false,accepted=false,failed=false;
 const fail=()=>{failed=true;accepted=false;try{onFailure();}catch{}};
 const receive=m=>{if(m?.kind!=='onboarding-body-complete')return;if(sent||m.nonce!==nonce){fail();return;}sent=true;try{assertBody();if(!ipc.connected){fail();return;}ipc.send({kind:'onboarding-ack',nonce},error=>{if(error)fail();else if(!failed)accepted=true;});}catch{fail();}};
 ipc.on('message',receive);return {accepted:()=>accepted&&!failed,close(){ipc.removeListener('message',receive);}};
}
