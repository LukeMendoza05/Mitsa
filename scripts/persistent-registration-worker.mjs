// Prepared local operator only. This script never activates a DB control.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parse} from 'dotenv';
import pg from 'pg';
import nodemailer from 'nodemailer';
import {readPrivateKey,readMessage,decrypt} from 'openpgp';
import {z} from 'zod';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
import {gmailCredentialFilePresent,readProtectedGmailCredentials} from './lib/gmail-credentials.mjs';
import {PersistentMailWorker} from './lib/persistent-mail-worker.ts';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const safe=(status,extra={})=>console.log(JSON.stringify({status,...extra,privateValuesPrinted:false}));
const payload=z.object({email:z.email().max(254),userId:z.uuid(),type:z.enum(['signup','recovery']),tokenHash:z.string().regex(/^(pkce_)?[a-f0-9]{32,256}$/),code:z.string().regex(/^\d{6}$/).optional(),origin:z.literal('http://127.0.0.1:3000')}).strict();
/** Existing production-independent operator path, optionally narrowed by a
 * separately approved local test guard. Importing this file performs no work.
 */
export async function persistentRegistrationWorker({readOnly=false,run=false,guardFactory}={}){
let db,worker,timer,guard,stopping=false;
try {
 if(!readOnly&&!run)throw Error('Explicit check or run required');
 const approved=JSON.parse(readFileSync('config/test-target.json','utf8')),operator=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:operator.TEST_PROJECT_REF,url:operator.TEST_SUPABASE_URL,databaseUrl:operator.TEST_DATABASE_URL},approved);
 db=new pg.Client({...testDatabaseConfig(operator.TEST_DATABASE_URL,approved),statement_timeout:15000});await db.connect();
 db.on('error',()=>{stopping=true;process.exitCode=1;});
 if((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0]?.marker!==target.databaseMarker)throw Error('Wrong target');
 if(readOnly)await db.query('begin read only');
 const installed=(await db.query("select to_regclass('private.registration_control') is not null installed")).rows[0].installed;
 if(!installed){safe('Persistent schema not installed',{readOnly:true,smtpConnections:0});}
 else {
  const control=(await db.query('select approval_generation,admission_enabled,delivery_enabled,stopped_at,approved_sender_sha256 from private.registration_control where singleton')).rows[0];
  if(readOnly){safe('Inactive worker preflight',{readOnly:true,schemaInstalled:true,admissionEnabled:control.admission_enabled,deliveryEnabled:control.delivery_enabled,protectedCredentialsPresent:gmailCredentialFilePresent(),smtpConnections:0});}
  else if(!control.delivery_enabled||!control.approval_generation||control.stopped_at||!control.approved_sender_sha256){safe('Delivery is disabled; worker did not acquire ownership',{smtpConnections:0});}
  else {
   const credentials=readProtectedGmailCredentials();
   if(createHash('sha256').update(credentials.sender.trim().toLowerCase()).digest('hex')!==control.approved_sender_sha256)throw Error('Sender not approved');
   const privateKey=await readPrivateKey({armoredKey:readFileSync('.secrets/auth-mail/private.asc','utf8')});
   process.env.MITSA_EMAIL_OTP_LENGTH='6';
   const {deliverSignupCodeWithGmail,deliverRecoveryWithGmail}=await import('../src/lib/mail/smtp.ts');
   const dependencies={db,generation:control.approval_generation,
    // Verification is allowed only AFTER an externally approved DB generation
    // exists. --check and closed controls never connect to SMTP.
    async transportReady(){
     const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:credentials.sender,pass:credentials.appPassword},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},logger:false,debug:false,pool:false,connectionTimeout:8000,greetingTimeout:8000,socketTimeout:8000});
     try{return await transport.verify();}catch{return false;}finally{transport.close();}
    },
    async send(job,stillAuthorized){
     const decrypted=await decrypt({message:await readMessage({binaryMessage:Buffer.from(job.encryptedPayload,'base64')}),decryptionKeys:privateKey});
     const message=payload.parse(JSON.parse(String(decrypted.data)));
     if(message.type!==job.action||createHash('sha256').update(message.email).digest('hex')!==job.recipientHash||job.action==='signup'&&!message.code)throw Error('Message binding mismatch');
     // Refresh DB time after decryption; a slow host or decrypt must not extend
     // the provider lifetime. Keep one minute for transport/inbox handling.
     const databaseNow=(await db.query('select statement_timestamp() now')).rows[0].now.getTime(),issuedAt=Date.parse(job.createdAt);
     if(databaseNow+60000>=Date.parse(job.expiresAt)||issuedAt>databaseNow)throw Error('Message expired');
     const deliver=job.action==='signup'?deliverSignupCodeWithGmail:deliverRecoveryWithGmail;
     await deliver({message:{eventKey:job.id,recipient:message.email,providerCode:message.code,providerTokenHash:message.tokenHash,issuedAt},
      authorization:{externalMailEnabled:true,senderApproved:true,approvedSender:credentials.sender,approvedOrigin:message.origin,providerExpirySeconds:3600},appPassword:credentials.appPassword,
      authorizeAndClaim:async()=>stillAuthorized()},databaseNow);
    },report:event=>{if(event!=='waiting')safe(event);}
   };
   guard=guardFactory?.(dependencies);
   worker=new PersistentMailWorker(guard?{...dependencies,transportReady:guard.transportReady,send:guard.send}:dependencies);
   process.once('SIGINT',()=>{stopping=true;});process.once('SIGTERM',()=>{stopping=true;});
   timer=setInterval(()=>{if(guard&&!guard.isActive()){stopping=true;return;}void worker.pulse();},5000);
   while(!stopping){
    if(guard&&!guard.isActive()){safe('Reviewed test scope ended; worker stopping');break;}
    const result=await worker.tick();
    if(result==='stopped'){
     const latest=(await db.query('select delivery_enabled,approval_generation,stopped_at from private.registration_control where singleton')).rows[0];
     if(latest.delivery_enabled&&latest.approval_generation===control.approval_generation&&!latest.stopped_at)process.exitCode=1;
     break;
    }
    await new Promise(resolve=>setTimeout(resolve,1000));
   }
  }
 }
 if(readOnly)await db.query('commit');
}catch{safe('Worker unavailable; private failure details suppressed');process.exitCode=1;}
finally{if(timer)clearInterval(timer);if(worker)await worker.stop();if(db){try{await db.end();}catch{safe('Worker connection closed; private details suppressed');}}}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const exact=process.argv.length===3;
 await persistentRegistrationWorker({readOnly:exact&&process.argv[2]==='--check',run:exact&&process.argv[2]==='--run'});
}
