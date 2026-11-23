// OFFLINE: referenced timers model owned connections. No sockets or credentials.
import {installTransportDisconnect,cleanupTransportResources,disconnectCompletedTransportChild} from '../../scripts/lib/registration-transport-lifecycle.mjs';
const mode=process.argv[2],events=[];
const smtpTimer=setInterval(()=>{},1000),dbTimer=setInterval(()=>{},1000);
const transport={close(){clearInterval(smtpTimer);events.push('smtp-close');}};
const db={connection:{stream:{destroy(){clearInterval(dbTimer);events.push('db-destroy');}}},
 async end(){events.push('db-end-start');if(mode==='hung-db')return new Promise(()=>{});await new Promise(resolve=>setTimeout(resolve,5));clearInterval(dbTimer);events.push('db-end-complete');}};
const emergency=installTransportDisconnect({getTransport:()=>transport,getDatabase:()=>db});
if(mode==='disconnect')process.send({ready:true});
else {
 try{await cleanupTransportResources({transport,database:db,timeoutMs:30});}
 catch{process.exitCode=3;events.push('cleanup-failed');}
 const resources=process.getActiveResourcesInfo();
 process.send({ready:true,events,timeoutHandles:resources.filter(t=>t==='Timeout').length},()=>{
   disconnectCompletedTransportChild(process,emergency);
   if(mode==='leak')setInterval(()=>{},1000); // Parent watchdog must reject it.
 });
}
