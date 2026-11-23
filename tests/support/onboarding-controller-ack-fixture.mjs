// OFFLINE root-IPC lifecycle fixture. No database, provider or application.
import {awaitControllerResultAck} from '../../scripts/lib/onboarding-controller-channel.mjs';
import {disconnectCompletedTransportChild} from '../../scripts/lib/registration-transport-lifecycle.mjs';
const emergency=()=>{process.exitCode=1;};process.once('disconnect',emergency);
try{
 const [mode]=process.argv.slice(2);if(!['normal','missing','disconnect','wrong','clean-without-ack'].includes(mode))throw Error('OFFLINE mode denied');
 const start=await new Promise(resolve=>process.once('message',resolve));if(start?.kind!=='start'||!/^[a-f0-9]{64}$/.test(start.nonce))throw Error('OFFLINE start denied');
 if(mode!=='clean-without-ack')await awaitControllerResultAck({ipc:process,nonce:start.nonce,timeoutMs:300});
}catch{process.exitCode=1;}
finally{disconnectCompletedTransportChild(process,emergency);}
