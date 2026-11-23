// Local process lifecycle only. No database query, SMTP operation or activation.
import assert from 'node:assert/strict';

// Call only after transport/database cleanup has completed. Remove only our
// emergency handler: normal IPC closure must not become a false failure.
export function disconnectCompletedTransportChild(ipc, emergencyDisconnect) {
  assert.equal(typeof emergencyDisconnect, 'function');
  ipc.removeListener('disconnect', emergencyDisconnect);
  if (ipc.connected) ipc.disconnect();
}

// Process startup consumes the same overall budget; it cannot earn a fresh
// five-minute timer after fork() returns.
/** @param {{claimedAt:string,notAfter:string,now?:number,startedAt?:number,monotonicNow?:number,maximumMs?:number}} options */
export function remainingTransportRuntime({claimedAt, notAfter, now = Date.now(), startedAt, monotonicNow=performance.now(), maximumMs=300000}) {
  const start = Date.parse(claimedAt), approvalEnd = Date.parse(notAfter);
  assert([start, approvalEnd, now].every(Number.isFinite));
  assert(approvalEnd > start && now >= start);
  const wallRemaining=Math.min(start + maximumMs, approvalEnd)-now;
  if(startedAt===undefined)return Math.max(0,wallRemaining);
  assert(Number.isFinite(startedAt)&&Number.isFinite(monotonicNow)&&monotonicNow>=startedAt);
  return Math.max(0,Math.min(wallRemaining,maximumMs-(monotonicNow-startedAt)));
}

export function installTransportDisconnect({ipc=process,getTransport,getDatabase,clearTimers=()=>{}}) {
  const handler=()=>{
    ipc.exitCode=1;
    try{getTransport()?.close();}catch{/* Never print provider errors. */}
    try{getDatabase()?.connection?.stream?.destroy();}catch{/* The supervisor must confirm termination. */}
    clearTimers();
  };
  ipc.once('disconnect',handler);
  return handler;
}

export async function cleanupTransportResources({transport,database,clearTimers=()=>{},timeoutMs=8000}) {
  let timer,transportCloseReturned=false,databaseEndCompleted=false;
  try {
    transport?.close();transportCloseReturned=true;
    await Promise.race([
      Promise.resolve().then(()=>database?.end()),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Database cleanup deadline exceeded')),timeoutMs);})
    ]);
    databaseEndCompleted=true;
    return {transportCloseReturned,databaseEndCompleted};
  }catch{
    try{database?.connection?.stream?.destroy();}catch{/* Failure remains a failure. */}
    throw Error('Transport resource cleanup failed');
  }finally{clearTimeout(timer);clearTimers();}
}

// Exit and stdio closure are observed, rather than inferred from a body result.
// The 240-second hard stop leaves 60 seconds inside the overall 300-second cap.
export async function superviseTransportChild(worker,{claimedAt,notAfter,startedAt,maximumMs=240000}) {
  let expired=false,observedExit=false,exitCode=null,exitSignal=null,timer;
  const elapsedStart=startedAt??performance.now();
  const outcome=await new Promise(resolve=>{
    const pipes=[worker.stdout,worker.stderr].filter(Boolean),ended=new Set();let streamError=false;
    // On Windows, parent-initiated IPC disconnect can omit ChildProcess.close
    // even after exit and both pipes end. Observe those prerequisites directly.
    const complete=()=>{if(observedExit&&ended.size===pipes.length)resolve({observedExit,code:exitCode,signal:exitSignal,streamsClosed:true,streamError});};
    for(const pipe of pipes){
      pipe.once('end',()=>{ended.add(pipe);complete();});
      pipe.once('error',()=>{streamError=true;});
      pipe.once('close',()=>{ended.add(pipe);complete();});
      if(pipe.readableEnded||pipe.destroyed)ended.add(pipe);
    }
    worker.once('exit',(code,signal)=>{observedExit=true;exitCode=code;exitSignal=signal;complete();});
    worker.once('error',()=>{if(!worker.pid)resolve({spawnError:true});});
    timer=setTimeout(()=>{expired=true;worker.kill('SIGKILL');},remainingTransportRuntime({claimedAt,notAfter,startedAt:elapsedStart,maximumMs}));
    worker.stdout?.resume();worker.stderr?.resume();
  });
  clearTimeout(timer);
  return {expired,...outcome};
}
