import {createHash} from "node:crypto";
import {z} from "zod";
import {emailVerificationCodeLength,emailVerificationCodeLabel} from './email-code-settings';

export const verificationCode = z.string().trim().regex(new RegExp(`^[0-9]{${emailVerificationCodeLength}}$`));
export const resendCooldownMs = 60_000;
export const verificationMessages:Record<string,string> = {
 input:`Enter the ${emailVerificationCodeLabel} verification code from your latest email.`,
 code:"That code is invalid or has expired. Check your latest message, or request a new code.",
 expired:"This verification session has expired. Return to sign in, enter your email and password, and continue verification.",
 cooldown:"Please wait before requesting another code. Use the latest message you already received.",
 rate_limited:"Too many attempts. Wait a few minutes before trying again.",
 delivery:"We couldn’t request another verification message. Your account remains pending verification. Wait before trying again; no verification step has been bypassed.",
 testing_closed:"The controlled email-delivery window is closed. A code you already received can still be verified until it expires. Another message requires an approved continuation window.",
 delivery_paused:"Verification email delivery is paused. Your pending account is preserved. A valid code you already received can still be verified.",
 delivery_closed:"Verification email delivery is currently closed. Your pending account is preserved, and a valid code already received can still be verified.",
 registration_expired:"This account needs a renewed verification request. Return to Sign In, enter your password, and review the agreement to continue without creating another account.",
 unavailable:"The verification service couldn’t complete this request. Your email has not been verified. Try again when the service is available.",
 registration:"We couldn’t complete account setup. Return to sign in to continue securely.",
};
export function verificationFailure(code:string|undefined,status:number|undefined):string {
 if(status===429||["over_email_send_rate_limit","over_request_rate_limit","email_send_rate_limit"].includes(code??""))return "rate_limited";
 if(["otp_expired","access_denied"].includes(code??""))return "code";
 return "unavailable";
}

// Local defense against concurrent requests/cookie replay. Provider frequency,
// verification/IP limits and the strict hook's locked 10/recipient/hour and
// 100/project/hour limits remain authoritative across processes and restarts.
const entries=new Map<string,{verify:number[];resend:number[]}>();
export function emailActionLimit(email:string,action:"verify"|"resend",now=Date.now()) {
 const key=createHash("sha256").update(email).digest("hex"),window=action==="verify"?60_000:resendCooldownMs;
 if(entries.size>=5000){for(const [key,value] of entries)if([...value.verify,...value.resend].every(t=>t<=now-60_000))entries.delete(key);if(entries.size>=5000)return false;}
 const entry=entries.get(key)??{verify:[],resend:[]};entry[action]=entry[action].filter(t=>t>now-window);
 if(entry[action].length>=(action==="verify"?5:1))return false;
 entry[action].push(now);entries.set(key,entry);return true;
}
