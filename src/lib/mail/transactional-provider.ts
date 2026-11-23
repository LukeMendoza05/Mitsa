import 'server-only';
import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {z} from 'zod';
import {signupEmailTemplate} from './verification-template';
import {renderAccountMessage} from './messages';

const authoritySchema=z.object({enabled:z.literal(true),provider:z.literal('resend'),projectRef:z.string().regex(/^[a-z]{20}$/),
 origin:z.url(),sender:z.email(),verifiedDomain:z.string().regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/),
 domainVerificationEvidenceSha256:z.string().regex(/^[a-f0-9]{64}$/),providerExpirySeconds:z.literal(3600)}).strict();
const messageSchema=z.object({eventId:z.uuid(),projectRef:z.string(),action:z.enum(['signup','recovery']),recipient:z.email(),
 providerCode:z.string(),providerTokenHash:z.string().regex(/^(?:pkce_)?[a-f0-9]{32,256}$/),
 issuedAt:z.number().int(),expiresAt:z.number().int(),databaseNow:z.number().int()}).strict();
type Authority=z.infer<typeof authoritySchema>;
type Message=z.infer<typeof messageSchema>;
type Submission={url:'https://api.resend.com/emails';method:'POST';redirect:'error';headers:Record<string,string>;body:string;signal:AbortSignal};
type Dependencies={
 // A reviewed production worker must supply the bounded, counted transport.
 // There is deliberately no default fetch, environment read or import effect.
 submit:(request:Submission)=>Promise<{status:number;json:()=>Promise<unknown>}>;
 claim:(eventId:string,recipient:string)=>Promise<boolean>;
 stillAuthorized:()=>Promise<boolean>;
};
const denied=()=>Error('Transactional delivery is not authorized');
const uncertain=()=>Error('Transactional delivery unconfirmed; retain claim and do not retry automatically');

/** Inactive provider port. NOT wired into any worker, hook or web endpoint.
 * Authority comes from reviewed server-only operational state, never form data.
 * A hash is a binding to separately verified DNS evidence, not a DNS check.
 */
export async function submitTransactionalAuthMail(input:{message:Message;authority:Authority;apiKey:string;signal?:AbortSignal},deps:Dependencies){
 const a=authoritySchema.safeParse(input.authority),m=messageSchema.safeParse(input.message);
 if(!a.success||!m.success||!/^re_[A-Za-z0-9_-]{12,}$/.test(input.apiKey))throw denied();
 const authority=a.data,message=m.data;let origin:URL;
 try{origin=new URL(authority.origin);}catch{throw denied();}
 if(origin.origin!==authority.origin||origin.protocol!=='https:'||origin.username||origin.password||origin.hash||
  origin.hostname==='localhost'||Boolean(isIP(origin.hostname.replace(/^\[|\]$/g,'')))||['.localhost','.local','.invalid','.test'].some(s=>origin.hostname.endsWith(s))||
  ['gmail.com','resend.dev','vercel.app'].some(d=>authority.verifiedDomain===d||authority.verifiedDomain.endsWith('.'+d))||
  authority.sender.split('@')[1]!==authority.verifiedDomain||message.projectRef!==authority.projectRef||
  message.recipient.endsWith('.invalid')||message.issuedAt>message.databaseNow||message.expiresAt<=message.databaseNow||
  message.expiresAt-message.issuedAt!==authority.providerExpirySeconds*1000||
  (message.action==='signup'?!/^\d{6}$/.test(message.providerCode):message.providerCode!==''))throw denied();
 const authorized=async()=>{try{return await deps.stillAuthorized();}catch{throw denied();}};
 if(input.signal?.aborted||!await authorized())throw denied();
 const template=message.action==='signup'?signupEmailTemplate(authority.providerExpirySeconds):renderAccountMessage({kind:'recovery',recipient:message.recipient,
  url:new URL('/auth/email?type=recovery&token_hash='+message.providerTokenHash,authority.origin).href},authority.origin);
 const render=(v:string)=>v.replaceAll('{{ .Token }}',message.providerCode).replaceAll('{{ .TokenHash }}',message.providerTokenHash).replaceAll('{{ .SiteURL }}',authority.origin);
 // The durable claim remains spent after timeout, ambiguous response or crash.
 // Provider idempotency (currently 24 hours) is additional protection, not a
 // replacement for permanent local/DB claim retention or resend authorization.
 let claimed=false;try{claimed=await deps.claim(message.eventId,message.recipient);}catch{throw denied();}
 if(!claimed)throw denied();
 if(input.signal?.aborted||!await authorized())throw denied();
 const digest=createHash('sha256').update(JSON.stringify([authority.projectRef,message.eventId,message.action,message.recipient])).digest('hex');
 const signal=AbortSignal.any([AbortSignal.timeout(15000),...(input.signal?[input.signal]:[])]);
 try{
  const response=await deps.submit({url:'https://api.resend.com/emails',method:'POST',redirect:'error',signal,
   headers:{authorization:'Bearer '+input.apiKey,'content-type':'application/json','idempotency-key':'mitsa-auth/'+digest},
   body:JSON.stringify({from:`Mitsa <${authority.sender}>`,to:[message.recipient],subject:template.subject,html:render(template.html),text:render(template.text)})});
  if(response.status!==200)throw uncertain();
  const parsed=z.object({id:z.uuid()}).strict().safeParse(await response.json());if(!parsed.success)throw uncertain();
  return {status:'provider-accepted' as const,providerMessageId:parsed.data.id,inboxReceiptConfirmed:false as const};
 }catch{throw uncertain();}
}
