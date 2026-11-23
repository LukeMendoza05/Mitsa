import {id} from './data';
export const authFlowCookie='flow',signupCodeCookie='signup-code',invitationCookie='invitation',signupAttemptCookie='attempt';
export function openAuthFlow(value:string){
 if(location.pathname==='/verify-email'||location.pathname==='/verify-email/renew')return {purpose:'signup-code',email:'ui-fixture@example.invalid',intentId:id(15),mailRequestId:id(16),passwordProvenAt:Date.now(),issuedAt:Date.now(),expiresAt:Date.now()+86400000,resendAt:Date.now()+(new URLSearchParams(location.search).get('state')==='cooldown'?60000:-1000)};
 if(location.pathname==='/reset-password')return {purpose:'recovery',userId:id(1),sessionId:id(3)};
 if(value==='invitation')return {purpose:'invitation',token:'visual-fixture-not-a-real-proof'};
 return null;
}
