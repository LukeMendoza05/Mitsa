import 'server-only';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {z} from 'zod';

export const developmentRegistrationOrigin = 'http://127.0.0.1:3000';
const runtimeSchema=z.object({version:z.literal(1),project:z.literal('mjtejwafxriwntweussc'),origin:z.literal(developmentRegistrationOrigin),
 runId:z.uuid(),phase:z.enum(['controlled','general']),approvedAt:z.iso.datetime(),expiresAt:z.iso.datetime(),recipientHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),registrationAllowed:z.literal(false).optional()}).strict();
const statusSchema=z.object({runId:z.uuid(),checkedAt:z.iso.datetime(),deliveryReady:z.boolean(),capacityAvailable:z.boolean()}).strict();
export type DevelopmentRegistrationRuntime=z.infer<typeof runtimeSchema>;

// These private operator files are not a public activation endpoint. They
// contain no address, SMTP password, CAPTCHA secret, code or session.
export function validDevelopmentRegistration(runtime:unknown,status:unknown,now=Date.now()):DevelopmentRegistrationRuntime|null {
 const r=runtimeSchema.safeParse(runtime),s=statusSchema.safeParse(status);
 if(!r.success||!s.success)return null;
 const start=Date.parse(r.data.approvedAt),end=Date.parse(r.data.expiresAt),checked=Date.parse(s.data.checkedAt);
 if(r.data.runId!==s.data.runId||!s.data.deliveryReady||!s.data.capacityAvailable||start>now||end<=now||end<=start||
  end-start>(r.data.phase==='controlled'?30:120)*60000||checked>now+1000||now-checked>15000||
  (r.data.phase==='controlled')!==Boolean(r.data.recipientHash)||(r.data.phase==='general'&&r.data.registrationAllowed===false))return null;
 return r.data;
}
export async function developmentRegistrationRuntime(origin:string):Promise<DevelopmentRegistrationRuntime|null> {
 if(process.env.NODE_ENV!=='development'||process.env.MITSA_REGISTRATION_MODE!=='development-open'||
  process.env.MITSA_AUTH_MAIL_MODE!=='isolated-capture'||origin!==developmentRegistrationOrigin)return null;
 try {
  const [runtime,status]=await Promise.all(['runtime','status'].map(async name=>JSON.parse(await readFile(`.secrets/isolated-registration/${name}.json`,'utf8'))));
  return validDevelopmentRegistration(runtime,status);
 }catch{return null;}
}
export function developmentRecipientAllowed(runtime:DevelopmentRegistrationRuntime,email:string) {
 return runtime.phase==='general'||createHash('sha256').update(email.trim().toLowerCase()).digest('hex')===runtime.recipientHash;
}
export type DevelopmentDeliveryState='available'|'paused'|'closed'|'unavailable'|'unmanaged';
export function developmentDeliveryState(runtime:unknown,status:unknown,email:string,now=Date.now()):DevelopmentDeliveryState {
 const r=runtimeSchema.safeParse(runtime),s=statusSchema.safeParse(status);
 if(!r.success||!s.success||r.data.runId!==s.data.runId)return 'unavailable';
 if(!developmentRecipientAllowed(r.data,email))return 'paused';
 if(Date.parse(r.data.expiresAt)<=now)return 'closed';
 if(validDevelopmentRegistration(r.data,s.data,now))return 'available';
 return 'paused';
}
export async function readDevelopmentDeliveryState(email:string):Promise<DevelopmentDeliveryState> {
 if(process.env.NODE_ENV!=='development'||process.env.MITSA_REGISTRATION_MODE!=='development-open'||process.env.MITSA_AUTH_MAIL_MODE!=='isolated-capture')return 'unmanaged';
 try {
  const [runtime,status]=await Promise.all(['runtime','status'].map(async name=>JSON.parse(await readFile(`.secrets/isolated-registration/${name}.json`,'utf8'))));
  return developmentDeliveryState(runtime,status,email);
 }catch{return 'unavailable';}
}
