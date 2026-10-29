import {transactionalEmail} from "./frame.ts";
/** Local Supabase Go-template artifact. No code generation or delivery occurs here.
 * Publish only together with the explicitly approved matching OTP lifetime. */
export function signupEmailTemplate(expiresInSeconds?:number) {
 if(expiresInSeconds!==undefined&&(!Number.isInteger(expiresInSeconds)||expiresInSeconds<60||expiresInSeconds>86400))throw Error("Explicit provider OTP lifetime required");
 const duration=expiresInSeconds===undefined?null:expiresInSeconds%60===0?`${expiresInSeconds/60} minutes`:`${expiresInSeconds} seconds`;
 // Never advertise an unverified provider lifetime in a preview or message.
 const expiry=duration?`This code expires in ${duration}. If you request a new code, use the latest message.`:"Verification codes expire. If you request a new code, use the latest message.";
 const link="{{ .SiteURL }}/auth/email?type=signup&amp;token_hash={{ .TokenHash }}";
 const rendered=transactionalEmail({title:"Verify your email.",description:"Enter this code in Mitsa to confirm your email address and finish setting up your account.",bodyHtml:`<p class="mitsa-code" style="margin:0;padding:24px 12px;border:1px solid #ececec;border-radius:16px;background:#fafafb;text-align:center;font:40px/1.3 Inter,'Segoe UI',Arial,Helvetica,sans-serif;letter-spacing:6px;font-variant-numeric:tabular-nums;color:#17191c">{{ .Token }}</p>
<p class="mitsa-muted" style="margin:20px 0 24px;color:#626773;font-size:14px">${expiry}</p>
<p class="mitsa-muted" style="margin:0;font-size:14px;color:#626773">Prefer a link? <a class="mitsa-link" style="color:#17191c;text-decoration:underline" href="${link}">Verify your email in Mitsa</a>. Opening the link alone does not confirm your account.</p>`,bodyText:`Verification code: {{ .Token }}\n\n${expiry}\n\nPrefer a link? {{ .SiteURL }}/auth/email?type=signup&token_hash={{ .TokenHash }}\nOpening the link alone does not confirm your account.`,securityNotice:"Didn't request this? You can safely ignore this email. Do not share your code or forward this message."});
 return {subject:"Verify your Mitsa email address",...rendered};
}
