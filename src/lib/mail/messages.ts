import {z} from "zod";
import {transactionalEmail} from "./frame.ts";
const message=z.object({kind:z.enum(["signup","recovery","invitation"]),recipient:z.email(),url:z.url(),workspaceName:z.string().max(160).optional()}).strict();
export type AccountMessage=z.infer<typeof message>;
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);

/** Render only a trusted, already-authorized message. Rendering grants no
 * recipient permission and never submits a provider authentication action. */
export function renderAccountMessage(input:AccountMessage,approvedOrigin:string) {
  const data=message.parse(input),url=new URL(data.url),origin=new URL(approvedOrigin);
  if(origin.origin!==approvedOrigin||url.origin!==approvedOrigin||url.username||url.password||url.hash)throw Error("Unapproved email destination");
  if(origin.protocol!=="https:"&&!(origin.protocol==="http:"&&["localhost","127.0.0.1"].includes(origin.hostname)))throw Error("Secure email origin required");
  const invitation=data.kind==="invitation";
  if(invitation ? url.pathname!=="/invitations/open"||!/^[a-f0-9]{64}$/.test(url.searchParams.get("token")??"") : url.pathname!=="/auth/email"||url.searchParams.get("type")!==data.kind||!/^(pkce_)?[a-f0-9]{32,256}$/.test(url.searchParams.get("token_hash")??""))throw Error("Invalid account email link");
  const subject=data.kind==="signup"?"Verify your Mitsa email address":data.kind==="recovery"?"Reset your Mitsa password":"Your Mitsa workspace invitation";
  const title=data.kind==="signup"?"Verify your email.":data.kind==="recovery"?"Reset your password.":"Join your workspace.";
  const description=data.kind==="signup"?"Confirm your email to continue setting up your account.":data.kind==="recovery"?"Continue your password reset. Your authenticator is still required if MFA is enabled.":`You have been invited to ${data.workspaceName??"a Mitsa workspace"}. Sign in with this email address and confirm your membership. The invitation expires after seven days.`;
  const action=data.kind==="signup"?"Verify email":data.kind==="recovery"?"Continue password reset":"Review invitation";
  const rendered=transactionalEmail({title,description,bodyHtml:`<p style="margin:0"><a class="mitsa-action" href="${escape(url.href)}" style="display:inline-block;padding:14px 24px;background:#17191c;color:#ffffff;border-radius:32px;text-decoration:none;font-weight:500">${action}</a></p>`,bodyText:`${action}: ${url.href}\n\nOpening this link does not confirm a change. Complete the explicit confirmation in Mitsa.`,securityNotice:"Didn't request this? You can safely ignore this email. Opening the link alone does not confirm a change."});
  return {to:data.recipient,subject,...rendered};
}
