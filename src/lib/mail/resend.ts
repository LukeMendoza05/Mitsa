import "server-only";
import {createHash} from "node:crypto";
import {Resend} from "resend";
import {z} from "zod";
import {renderAccountMessage,type AccountMessage} from "./messages";

type ReleaseAuthorization={externalMailEnabled:boolean;senderVerified:boolean;approvedSender:string;approvedOrigin:string};
/** Future privileged outbox worker adapter. There is deliberately no public
 * send endpoint, runtime admin key, active worker or inferred release gate.
 * The worker must obtain authorization from its trusted database, never a form. */
export async function deliverWithResend(input:{message:AccountMessage;eventKey:string;createdAt:number;authorization:ReleaseAuthorization;apiKey:string},now=Date.now()) {
  const {authorization:a}=input;
  if(!a.externalMailEnabled||!a.senderVerified||!input.apiKey.startsWith("re_")||!z.email().safeParse(a.approvedSender).success||a.approvedSender.endsWith(".invalid"))throw Error("External mail is not authorized");
  // Resend's deduplication window is 24 hours. Never silently retry beyond it.
  if(!/^[a-zA-Z0-9/_-]{1,200}$/.test(input.eventKey)||!Number.isFinite(input.createdAt)||input.createdAt>now||now-input.createdAt>=23*60*60*1000)throw Error("Delivery attempt outside bounded retry window");
  const message=renderAccountMessage(input.message,a.approvedOrigin);
  const result=await new Resend(input.apiKey).emails.send({from:`Mitsa <${a.approvedSender}>`,...message},{idempotencyKey:`mitsa/${input.eventKey}`});
  if(result.error||!result.data?.id)throw Error("Email delivery unconfirmed");
  return {providerId:result.data.id};
}

const deliverySchema=z.object({type:z.enum(["email.sent","email.delivered","email.delivery_delayed","email.failed","email.bounced","email.complained","email.suppressed"]),created_at:z.iso.datetime(),data:z.object({email_id:z.uuid()})});
export type DeliveryEvent={eventId:string;providerId:string;type:z.infer<typeof deliverySchema>["type"];occurredAt:string;payloadHash:string};
/** Verify the original raw body before parsing; never retain tokens, recipient
 * lists, click IPs or message bodies in delivery audit metadata. No mutation is
 * authorized by a signature until a transactional outbox match is established. */
export function verifyResendDelivery(raw:string,headers:Headers,secret:string):DeliveryEvent {
  const id=headers.get("svix-id"),timestamp=headers.get("svix-timestamp"),signature=headers.get("svix-signature");
  if(!secret.startsWith("whsec_")||!id||id.length>200||!timestamp||!signature||Buffer.byteLength(raw)>65536)throw Error("Invalid delivery webhook");
  const verified=new Resend("verification-only").webhooks.verify({payload:raw,headers:{id,timestamp,signature},webhookSecret:secret});
  const event=deliverySchema.parse(verified);
  return {eventId:id,providerId:event.data.email_id,type:event.type,occurredAt:event.created_at,payloadHash:createHash("sha256").update(raw).digest("hex")};
}

/** A future activated receiver must supply a durable transaction: unique event
 * ID + payload hash, known provider/outbox ID, terminal-state ordering and audit
 * commit together. Do not acknowledge an event before that commit succeeds. */
export async function recordResendDelivery(raw:string,headers:Headers,secret:string,commit:(event:DeliveryEvent)=>Promise<"recorded"|"duplicate">) {
  return commit(verifyResendDelivery(raw,headers,secret));
}
