import {z} from "zod";
import {signupSchema} from "./forms";
export const registrationErrorCode=z.enum(["input","testing_access","controlled_recipient","already_signed_in","agreement_updated","password","rate_limited","request_expired","mail_unavailable","network","unavailable","registration_closed","delivery_paused","challenge","submission_pending","submission_empty_expired"]);
export type RegistrationErrorCode=z.infer<typeof registrationErrorCode>;
export const registrationMessages:Record<RegistrationErrorCode,string>={
  submission_pending:"Your registration result is not confirmed yet. Check its status before submitting again. Do not request another account.",
  submission_empty_expired:"This request expired before account creation. Start a new request when registration is available.",
  registration_closed:"New account registration is currently closed. No account was created. Sign in if you already have an account.",
  delivery_paused:"Registration is paused while verification email is unavailable. No account was created. Try again when registration reopens.",
  challenge:"Complete human verification and try again. If it expired, use the new verification challenge.",
  input:"Review the highlighted details and try again.",
  testing_access:"This email is not approved for development testing. Follow the local testing guide to authorize your account.",
  controlled_recipient:"This controlled test accepts only its approved test address. Copy the address again using the private testing instructions and replace the Email field. Do not add it to a developer allowlist.",
  already_signed_in:"This browser is already signed in to Mitsa. No new account was created. Use a separate browser profile, or sign out from Your workspaces before registering another account.",
  agreement_updated:"The account agreement has changed. Reload this page, review the current version and accept it before continuing.",
  password:"Your password does not meet the account requirements. Use at least eight characters and choose a stronger password.",
  rate_limited:"Too many attempts. Wait before trying again; repeated registration attempts may require an hour before they become available.",
  request_expired:"This registration request has expired or was already used. Submit the form again to start a fresh request.",
  mail_unavailable:"Verification email could not be prepared. Check your request status, or try again when email delivery resumes.",
  network:"We couldn’t reach the account service. Check your connection and try again.",
  unavailable:"Registration is temporarily unavailable. Try again shortly. If this continues, check the local testing setup.",
};
export const signupFieldNames=["fullName","email","password","confirmPassword","accepted"] as const;
export type SignupField=typeof signupFieldNames[number];
export type SignupErrors=Partial<Record<SignupField,string>>;
const fieldMessages:Record<SignupField,string>={fullName:"Enter your full name (up to 120 characters).",email:"Enter a valid email address.",password:"Use a password with 8–256 characters.",confirmPassword:"Enter the same password in both fields.",accepted:"Read and accept the current account agreement to continue."};
export function signupFieldErrors(input:Record<string,unknown>):SignupErrors {
  const parsed=signupSchema.safeParse(input);if(parsed.success)return {};
  const errors:SignupErrors={};for(const issue of parsed.error.issues){const name=issue.path[0];if(signupFieldNames.includes(name as SignupField))errors[name as SignupField]=fieldMessages[name as SignupField];}
  // A non-continuable agreement error must not suppress useful confirmation
  // feedback for the other fields in the same submission.
  if(typeof input.password==="string"&&typeof input.confirmPassword==="string"&&input.password!==input.confirmPassword)errors.confirmPassword=fieldMessages.confirmPassword;
  return errors;
}
export function providerRegistrationFailure(code:string|undefined,status:number|undefined):RegistrationErrorCode {
  if(code==="weak_password")return "password";
  if(status===429||code==="over_email_send_rate_limit"||code==="over_request_rate_limit")return "rate_limited";
  if(code==="flow_state_expired"||code==="otp_expired")return "request_expired";
  if(code==="email_address_not_authorized"||code?.startsWith("hook_"))return "mail_unavailable";
  if(code==="email_address_invalid")return "input";
  return "unavailable";
}
