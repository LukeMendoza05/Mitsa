import "server-only";
import nodemailer from "nodemailer";
import {z} from "zod";
import {signupEmailTemplate} from "./verification-template.ts";
import {renderAccountMessage} from './messages.ts';
import {emailVerificationCodeLength} from '../auth/email-code-settings.ts';

export type SignupCodeDelivery={eventKey:string;recipient:string;providerCode:string;providerTokenHash:string;issuedAt:number};
type Authorization={externalMailEnabled:boolean;senderApproved:boolean;approvedSender:string;approvedOrigin:string;providerExpirySeconds:number};
function safeSmtpFailure(error:unknown) {
 const value=error as {code?:unknown;responseCode?:unknown}|null,code=value?.code;
 const category=code==='EAUTH'?'authentication':code==='ETIMEDOUT'?'timeout':
  ['CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(String(code))?'tls':
  ['ECONNECTION','EDNS','ESOCKET'].includes(String(code))?'connection':'unconfirmed';
 return {deliveryFailure:category,...(Number.isInteger(value?.responseCode)&&Number(value?.responseCode)>=100&&Number(value?.responseCode)<=599?{smtpResponseCode:Number(value?.responseCode)}:{})};
}
/** Inactive worker adapter; there is no public endpoint or running worker.
 * A future authenticated Supabase hook must verify the provider event and bind
 * it to a valid registration intent. Its DB transaction must authorize/claim
 * delivery, enforce durable limits and retain the claim after uncertain SMTP
 * outcomes. A publishable API key or Origin is never delivery authorization.
 * Codes/hashes must come from Supabase, not an independent generator. */
async function deliverAuthenticationWithGmail(input:{message:SignupCodeDelivery;authorization:Authorization;action:'signup'|'recovery';
 appPassword:string;authorizeAndClaim:(eventKey:string,recipient:string)=>Promise<boolean>},now=Date.now()) {
 const {message:m,authorization:a}=input;
 if(!a.externalMailEnabled||!a.senderApproved||!z.email().safeParse(a.approvedSender).success||
  !a.approvedSender.endsWith("@gmail.com")||!/^[a-z]{16}$/i.test(input.appPassword))throw Error("External mail is not authorized");
 if(!z.email().safeParse(m.recipient).success||m.recipient.endsWith(".invalid")||
  !/^[a-zA-Z0-9_-]{1,100}$/.test(m.eventKey)||(input.action==='signup'&&!new RegExp(`^\\d{${emailVerificationCodeLength}}$`).test(m.providerCode))||
  !/^(pkce_)?[a-f0-9]{32,256}$/.test(m.providerTokenHash)||!Number.isSafeInteger(m.issuedAt)||m.issuedAt>now||
  !Number.isInteger(a.providerExpirySeconds)||a.providerExpirySeconds<60||a.providerExpirySeconds>86400||
  now-m.issuedAt>=a.providerExpirySeconds*1000)throw Error("Invalid or expired provider message");
 let origin:URL;try{origin=new URL(a.approvedOrigin);}catch{throw Error("Unapproved email destination");}
 if(origin.origin!==a.approvedOrigin||origin.username||origin.password||
  origin.protocol!=="https:"&&!(origin.protocol==="http:"&&["localhost","127.0.0.1"].includes(origin.hostname)))throw Error("Unapproved email destination");
 const recoveryUrl=new URL('/auth/email',a.approvedOrigin);
 recoveryUrl.searchParams.set('type','recovery');recoveryUrl.searchParams.set('token_hash',m.providerTokenHash);
 const template=input.action==='signup'?signupEmailTemplate(a.providerExpirySeconds):renderAccountMessage({kind:'recovery',recipient:m.recipient,url:recoveryUrl.href},a.approvedOrigin);
 // Every replacement is a validated provider value or canonical approved
 // origin. User names, HTML and arbitrary URLs cannot enter the template.
 const render=(value:string)=>value.replaceAll("{{ .Token }}",m.providerCode).replaceAll("{{ .TokenHash }}",m.providerTokenHash).replaceAll("{{ .SiteURL }}",a.approvedOrigin);
 let claimed=false;try{claimed=await input.authorizeAndClaim(m.eventKey,m.recipient);}catch{throw Error("Delivery authorization unavailable");}
 if(!claimed)throw Error("Delivery is not authorized or was already claimed");
 const transport=nodemailer.createTransport({host:"smtp.gmail.com",port:465,secure:true,
  auth:{user:a.approvedSender,pass:input.appPassword},tls:{minVersion:"TLSv1.2",rejectUnauthorized:true,servername:"smtp.gmail.com"},
  logger:false,debug:false,transactionLog:false,pool:false,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
  disableFileAccess:true,disableUrlAccess:true,maxRecipients:1});
 try {
  const result=await transport.sendMail({from:{name:"Mitsa",address:a.approvedSender},to:[{address:m.recipient,name:""}],
   envelope:{from:a.approvedSender,to:[m.recipient]},subject:template.subject,html:render(template.html),text:render(template.text),
   messageId:`<mitsa.${m.eventKey}@gmail.com>`,disableFileAccess:true,disableUrlAccess:true});
  const accepted=result.accepted;
  if(result.rejected.length||accepted.length!==1||accepted[0]!==m.recipient)throw Error("Unconfirmed recipient");
  // SMTP acceptance is not proof of inbox delivery. SMTP has no provider
  // idempotency key: keep the claim; uncertain outcomes need manual review or
  // an explicit new Supabase resend event, never a blind automatic retry.
  return {status:"smtp-accepted" as const};
 } catch(error) {throw Object.assign(Error("Email delivery unconfirmed; automatic retry is unsafe"),safeSmtpFailure(error));}
 finally {transport.close();}
}
export function deliverSignupCodeWithGmail(input:{message:SignupCodeDelivery;authorization:Authorization;appPassword:string;authorizeAndClaim:(eventKey:string,recipient:string)=>Promise<boolean>},now=Date.now()) {
 return deliverAuthenticationWithGmail({...input,action:'signup'},now);
}
export function deliverRecoveryWithGmail(input:{message:Omit<SignupCodeDelivery,'providerCode'>;authorization:Authorization;appPassword:string;authorizeAndClaim:(eventKey:string,recipient:string)=>Promise<boolean>},now=Date.now()) {
 return deliverAuthenticationWithGmail({...input,message:{...input.message,providerCode:''},action:'recovery'},now);
}
