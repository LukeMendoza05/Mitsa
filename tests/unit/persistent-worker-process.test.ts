import {it,expect} from 'vitest';
import {fork,type ChildProcess} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {persistentDatabase} from '../support/persistent-database';
it('survives a real worker-process crash after claiming without sending that job again',async()=>{
 const db=await persistentDatabase(),children:ChildProcess[]=[];let attempts=0;
 const generation=crypto.randomUUID(),capture=crypto.randomUUID(),dispatch=crypto.randomUUID();
 try {
  await db.query('update private.registration_control set approval_generation=$1,delivery_enabled=true',[generation]);
  await db.query("insert into private.isolated_auth_mail(id,recipient_hash,action,encrypted_payload) values($1,repeat('a',64),'signup',convert_to('{}','UTF8'))",[capture]);
  await db.query("insert into private.auth_mail_dispatch(id,request_key,action,recipient_hash,intent_id,generation,state,capture_id,consumed_at) values($1,$2,'signup',repeat('a',64),$3,$4,'queued',$5,statement_timestamp())",[dispatch,crypto.randomUUID(),crypto.randomUUID(),generation,capture]);
  function launch(mode:string) {
   const child=fork(fileURLToPath(new URL('../support/persistent-worker-process.mjs',import.meta.url)),[generation,crypto.randomUUID(),mode],{silent:true,execArgv:[]});children.push(child);
   let signal!:(message:{kind:string;result?:string})=>void;
   const event=new Promise<{kind:string;result?:string}>((resolve,reject)=>{signal=resolve;child.once('error',()=>reject(Error('Synthetic worker could not start')));child.once('exit',code=>{if(code)reject(Error('Synthetic worker exited unexpectedly'));});});
   child.on('message',async(message:unknown)=>{
    const value=message as {kind:string;id:number;sql:string;parameters:unknown[];result?:string};
    if(value.kind==='sql'){try{const result=await db.query(value.sql,value.parameters);if(child.connected)child.send({kind:'sql-result',id:value.id,ok:true,rows:result.rows});}catch{if(child.connected)child.send({kind:'sql-result',id:value.id,ok:false});}}
    else if(value.kind==='send-started'){attempts++;if(mode==='hang-after-claim')signal(value);}
    else if(value.kind==='finished'||value.kind==='failed')signal(value);
   });
   return {child,event};
  }
  const first=launch('hang-after-claim');expect((await first.event).kind).toBe('send-started');
  const exited=new Promise(resolve=>first.child.once('exit',resolve));first.child.kill();await exited;
  expect((await db.query<{state:string}>('select state from private.auth_mail_dispatch where id=$1',[dispatch])).rows[0].state).toBe('claimed');
  await db.exec("update private.registration_control set worker_until=statement_timestamp()-interval '1 second'"); // Offline clock boundary only.
  const second=launch('complete');expect(await second.event).toMatchObject({kind:'finished',result:'waiting'});
  expect(attempts).toBe(1);expect((await db.query<{state:string}>('select state from private.auth_mail_dispatch where id=$1',[dispatch])).rows[0].state).toBe('unconfirmed');
 }finally{for(const child of children)if(child.exitCode===null&&!child.killed)child.kill();await db.close();}
},30000);
