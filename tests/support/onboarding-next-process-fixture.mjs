// OFFLINE process fixture. No Next app, provider, DB, worker or private data.
import {disconnectCompletedTransportChild} from '../../scripts/lib/registration-transport-lifecycle.mjs';
import {nextChildPrivateChannel} from '../../scripts/lib/onboarding-next-private-channel.mjs';
const mode=process.argv[3];let hold=setInterval(()=>{},1000),nonce,privateChannel;
const emergency=()=>{process.exitCode=1;clearInterval(hold);};process.once('disconnect',emergency);
process.on('message',async message=>{
 if(message?.kind==='start-next'){
  nonce=message.nonce;
  if(mode==='hung-start')return;
  if(mode==='failed-start'){process.exitCode=7;clearInterval(hold);disconnectCompletedTransportChild(process,emergency);return;}
  if(mode==='private-normal'){
   privateChannel=nextChildPrivateChannel({ipc:process,nonce,onFailure:emergency,handle:async payload=>payload.message.jobId!=='reject'});
   try{await privateChannel.request({path:'OFFLINE-CIPHERTEXT-REFERENCE',label:'e-a',sequence:1});}catch{privateChannel.close();clearInterval(hold);process.exitCode=1;process.send({kind:'next-failed'},()=>disconnectCompletedTransportChild(process,emergency));return;}
  }
  process.send({kind:'next-ready',origin:'http://127.0.0.1:3000'});
 }
 if(message?.kind==='stop-next'&&message.nonce===nonce&&mode!=='hung-stop'){
  privateChannel?.close();
  if(mode==='no-stop-ack'){clearInterval(hold);disconnectCompletedTransportChild(process,emergency);return;}
  clearInterval(hold);process.send({kind:'next-stopped'},()=>disconnectCompletedTransportChild(process,emergency));
 }
});
