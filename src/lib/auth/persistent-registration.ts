import {z} from 'zod';

/** Shared contract, not an activation flag. The database remains authoritative. */
export const registrationProfile=z.enum(['isolated-development','consenting-pilot','production']);
export const policyBundle=z.object({termsId:z.uuid(),privacyId:z.uuid(),termsVersion:z.string().min(1),privacyVersion:z.string().min(1),termsContent:z.string(),privacyContent:z.string(),termsHash:z.string().regex(/^[a-f0-9]{64}$/),privacyHash:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['test','published'])}).strict();
export const registrationAvailability=z.enum(['available','closed','paused','unavailable']);
export const persistentReadiness=z.object({version:z.literal(1),admission:registrationAvailability,delivery:registrationAvailability,policy:policyBundle.nullable()}).strict();
export type PersistentReadiness=z.infer<typeof persistentReadiness>;
export type PolicyBundle=z.infer<typeof policyBundle>;
export const unavailableReadiness:PersistentReadiness={version:1,admission:'unavailable',delivery:'unavailable',policy:null};
export const submissionState=z.enum(['prepared','submitted','pending-verification','uncertain','expired','verified']);
export const submissionInput=z.object({submissionId:z.uuid(),email:z.email().max(254),fullName:z.string().trim().min(1).max(120),termsId:z.uuid(),privacyId:z.uuid(),accepted:z.literal(true)}).strict();
export type SubmissionInput=z.infer<typeof submissionInput>;
export const submissionResult=z.object({submissionId:z.uuid(),intentId:z.uuid(),state:submissionState,creationDeadline:z.iso.datetime({offset:true}),expiresAt:z.iso.datetime({offset:true}),restartAllowed:z.boolean().optional()}).strict();
export type SubmissionResult=z.infer<typeof submissionResult>;
export const mailAction=z.enum(['signup','recovery']);
export const dispatchState=z.enum(['reserved','queued','claimed','smtp-accepted','cancelled','superseded','expired','failed','unconfirmed']);
export type DispatchState=z.infer<typeof dispatchState>;
export const coarseSubmissionStatus=z.enum(['checking','verify-email','sign-in','expired','unavailable']);
export const mailRequestResult=z.object({requestId:z.uuid(),expiresAt:z.iso.datetime({offset:true}),sendAllowed:z.boolean()}).strict();
export const persistentCommand=z.enum(['prepare','claim-signup','submission-status','continue-verification','renew-verification','authorize-mail','mail-status']);

/** Never fingerprint passwords, CAPTCHA proofs or provider tokens. */
export function canonicalSubmission(input:SubmissionInput) {
 const value=submissionInput.parse(input);
 return JSON.stringify([value.submissionId,value.email.trim().toLowerCase(),value.fullName,value.termsId,value.privacyId,value.accepted]);
}
export function correlatedEmailRedirect(origin:string,requestId:string) {
 z.uuid().parse(requestId);
 const url=new URL('/auth/email',origin);
 url.searchParams.set('request',requestId);
 return url.href;
}
/** Reject extra parameters, alternate paths, credentials and noncanonical URLs. */
export function emailRequestCorrelation(value:string,origin:string):string|null {
 try {
  const url=new URL(value),id=url.searchParams.get('request');
  return id&&z.uuid().safeParse(id).success&&value===correlatedEmailRedirect(origin,id)?id:null;
 }catch{return null;}
}
