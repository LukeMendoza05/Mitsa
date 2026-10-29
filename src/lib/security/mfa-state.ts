import {z} from "zod";

export const sensitiveWindowMs=300000;
export const enrollmentSafetyMs=10000;
const claimsSchema=z.object({amr:z.array(z.object({method:z.string(),timestamp:z.number().int()})).optional()});
export function passwordDeadline(claims:unknown,now=Date.now()):number|null {
  const parsed=claimsSchema.safeParse(claims);if(!parsed.success)return null;
  const timestamps=(parsed.data.amr??[]).filter(item=>item.method==="password"&&item.timestamp*1000<=now+5000).map(item=>item.timestamp*1000);
  if(!timestamps.length)return null;
  const deadline=Math.max(...timestamps)+sensitiveWindowMs;
  return deadline>now?deadline:null;
}
export function enrollmentDeadline(claims:unknown,permitRequestedAt:number,now=Date.now()):number|null {
  const password=passwordDeadline(claims,now);if(password===null)return null;
  const deadline=Math.min(password,permitRequestedAt+sensitiveWindowMs);
  return deadline-now>enrollmentSafetyMs?deadline:null;
}
export const securityStateSchema=z.object({ready:z.boolean(),recent:z.boolean(),initialized:z.boolean(),factors:z.array(z.object({id:z.uuid(),active:z.boolean()})),pendingRemovals:z.array(z.object({id:z.uuid(),targetId:z.uuid().optional(),action:z.string()})),currentFactorId:z.uuid().nullable().optional()});
export type SecurityState=z.infer<typeof securityStateSchema>;
type Factor={id:string;factor_type:string;status:string};
export function classifyFactors<T extends Factor>(all:T[],state:SecurityState){
  const verified=all.filter(f=>f.factor_type==="totp"&&f.status==="verified");
  const trusted=verified.filter(f=>state.factors.some(binding=>binding.id===f.id&&binding.active));
  const pending=all.filter(f=>f.factor_type==="totp"&&f.status==="unverified");
  return {verified,trusted,pending,unbound:verified.filter(f=>!trusted.some(t=>t.id===f.id)),needsReview:verified.length>0&&trusted.length===0};
}
export const securityMessages:Record<string,string>={
  password:"Password confirmation failed. Re-enter your current Mitsa password and try again.",
  password_input:"Enter your current Mitsa password to continue.",
  rate_limited:"Too many security attempts. Wait a few minutes before trying again.",
  recent:"Your five-minute identity confirmation has expired. Confirm your password again before starting a new setup.",
  expired:"Authenticator setup has expired. Cancel the unfinished setup, confirm your identity and generate a new QR code.",
  code:"That authenticator code could not be verified. Use the current six-digit code from the new Mitsa entry and check your device’s automatic time setting.",
  code_input:"Enter the current six-digit code in New authenticator code.",
  current_code:"Verify a current code from an existing trusted authenticator to confirm your identity.",
  trusted:"An authenticator was verified, but its Mitsa setup did not finish. Use a trusted backup or request a recovery review. Existing verified factors have been preserved.",
  pending:"An unfinished authenticator setup already exists. Cancel it before generating a fresh QR code.",
  cancelled:"Only an unfinished, unverified setup can be canceled here. Verified authenticators require trusted confirmation or recovery.",
  provider:"The account service could not complete this step. Try again shortly; no authenticator has been marked trusted by Mitsa.",
  removal:"Removal is not yet complete. Retry the pending removal below.",
  security:"This security action could not be validated. Refresh the page and try again.",
};
