// Synthetic IPC harness only. No credentials, sockets, SMTP or hosted clients.
import {PersistentMailWorker} from '../../scripts/lib/persistent-mail-worker.ts';
const [generation,workerId,mode]=process.argv.slice(2);
let sequence=0;const pending=new Map();
process.on('message',message=>{if(message.kind==='sql-result'){const entry=pending.get(message.id);pending.delete(message.id);if(message.ok)entry?.resolve({rows:message.rows});else entry?.reject(Error('Synthetic database unavailable'));}});
const db={query(sql,parameters){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});process.send?.({kind:'sql',id,sql,parameters});});}};
const worker=new PersistentMailWorker({db,generation,workerId,transportReady:async()=>true,
 async send(_job,authorize){if(!await authorize())throw Error('Fence rejected');process.send?.({kind:'send-started'});if(mode==='hang-after-claim')await new Promise(()=>{});}
});
try{const result=await worker.tick();await worker.stop();process.send?.({kind:'finished',result});process.disconnect();}
catch{process.send?.({kind:'failed'});process.disconnect();process.exitCode=1;}
