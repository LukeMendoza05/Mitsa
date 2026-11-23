// Six matches the approved, persisted provider configuration. Eight remains
// an explicit rollback setting, coordinated with the provider before use.
// This server setting never changes Supabase or Google Authenticator MFA.
export function emailCodeSettings(value: string | undefined) {
 if(value!==undefined&&value!=="6"&&value!=="8")throw Error("Unsupported email verification configuration");
 const length=value==="8"?8:6;
 return {length,label:length===6?"six-digit":"eight-digit",expirySeconds:3600} as const;
}
const settings=emailCodeSettings(process.env.MITSA_EMAIL_OTP_LENGTH);
export const emailVerificationCodeLength = settings.length;
export const emailVerificationCodeLabel = settings.label;
export const emailVerificationExpirySeconds = 3600;
