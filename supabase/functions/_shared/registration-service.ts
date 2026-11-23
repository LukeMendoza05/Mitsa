import {z} from 'zod';
import {canonicalSubmission,submissionInput,persistentCommand} from '../../../src/lib/auth/persistent-registration.ts';
import {hash,validSigningKey} from './registration-intent-auth.ts';
import {submissionNonce,verifyRegistrationCommand} from './registration-service-auth.ts';
const common={email:z.email().max(254)};
const payloads={
 prepare:submissionInput,
 'claim-signup':z.object({...common,submissionId:z.uuid()}).strict(),
 'submission-status':z.object({...common,submissionId:z.uuid()}).strict(),
 'continue-verification':z.object({...common,passwordProven:z.literal(true)}).strict(),
 'renew-verification':z.object({...common,intentId:z.uuid(),termsId:z.uuid(),privacyId:z.uuid(),accepted:z.literal(true),passwordProven:z.literal(true)}).strict(),
 'authorize-mail':z.object({...common,intentId:z.uuid().optional(),requestKey:z.uuid(),action:z.enum(['signup','recovery'])}).strict(),
 'mail-status':z.object({...common,requestId:z.uuid()}).strict(),
};
const envelope=z.object({version:z.literal(1),action:persistentCommand,payload:z.unknown()}).strict();
type Dependencies={enabled:boolean;project:string;origin:string;signingKey:string;authorizeApiKey:(value:string)=>boolean;
 command:(action:string,payload:Record<string,unknown>,proof:{requestHash:string;signedAt:string})=>Promise<unknown>};
export function registrationServiceHandler(deps:Dependencies) {
 const answer=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 return async(request:Request)=>{
  if(!deps.enabled||!validSigningKey(deps.signingKey))return answer(503,{error:'unavailable'});
  if(request.method!=='POST')return answer(405,{error:'unavailable'});
  if(request.headers.get('origin')!==deps.origin||!deps.authorizeApiKey(request.headers.get('apikey')??''))return answer(403,{error:'unavailable'});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return answer(400,{error:'input'});
  // Stream limit applies even without Content-Length. Never retain/log body.
  const chunks:Uint8Array[]=[];let size=0;
  const reader=request.body?.getReader();if(!reader)return answer(400,{error:'input'});
  try {
   for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096){await reader.cancel();return answer(413,{error:'input'});}chunks.push(part.value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   const proof=await verifyRegistrationCommand(deps.signingKey,deps.project,request.headers,bytes);
   if(!proof)return answer(401,{error:'unavailable'});
   const parsed=envelope.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
   if(!parsed.success)return answer(400,{error:'input'});
   const {action}=parsed.data,payload=payloads[action].safeParse(parsed.data.payload);
   if(!payload.success)return answer(400,{error:'input'});
   let input:Record<string,unknown>={...payload.data,email:payload.data.email.toLowerCase()};let nonce:string|undefined;
   if(action==='prepare'){
    const value=submissionInput.parse(input),fingerprint=await hash(canonicalSubmission(value));
    nonce=await submissionNonce(deps.signingKey,deps.project,value.submissionId,fingerprint);
    input={...value,fingerprint,nonceHash:await hash(nonce)};
   }
   const result=await deps.command(action,input,proof);
   if(result===null)return answer(200,null);
   return answer(200,action==='prepare'?{...(result as Record<string,unknown>),nonce}:result);
  }catch(error){
   const code=(error as {code?:string})?.code;
   return answer(code==='54000'?429:503,{error:code==='54000'?'rate_limited':'unavailable'});
  }
 };
}
