"use client";
import {useEffect,useId,useRef,useState,useSyncExternalStore,type FormEvent} from "react";
import {z} from "zod";
import {PasswordField} from "@/components/site/PasswordField";
import {registrationErrorCode,registrationMessages,signupFieldErrors,signupFieldNames,type SignupErrors,type SignupField} from "@/lib/auth/feedback";
import site from "@/components/site/site.module.css";
import s from "./auth.module.css";
import {SignupChallenge} from './SignupChallenge';
const subscribe=()=>()=>{};
const responseError=z.object({error:z.object({code:registrationErrorCode,fields:z.record(z.string(),z.string()).optional()})});
export function SignupForm({enabled,termsId,isTest,initialError,captchaSiteKey,nonce,privacyId,initialSubmissionId,resumeSubmission=false}:{enabled:boolean;termsId:string;isTest:boolean;initialError?:string;captchaSiteKey?:string;nonce?:string;privacyId?:string;initialSubmissionId?:string;resumeSubmission?:boolean}) {
  const prefix=useId(),id=(name:string)=>`${prefix}-${name}`;
  const [errors,setErrors]=useState<SignupErrors>({}),[message,setMessage]=useState(initialError??""),[pending,setPending]=useState(false);
  const enhanced=useSyncExternalStore(subscribe,()=>true,()=>false),summary=useRef<HTMLDivElement>(null),inFlight=useRef(false);
  const [focusVersion,setFocusVersion]=useState(0);
  const [challengeToken,setChallengeToken]=useState(''),[challengeReset,setChallengeReset]=useState(0);
  const [submissionId,setSubmissionId]=useState(initialSubmissionId??''),[uncertain,setUncertain]=useState(initialError===registrationMessages.submission_pending),[checking,setChecking]=useState(false);
  const [identityLocked,setIdentityLocked]=useState(initialError===registrationMessages.submission_pending),[restartAllowed,setRestartAllowed]=useState(initialError===registrationMessages.submission_empty_expired);
  useEffect(()=>{if(!initialSubmissionId)return;try{const prior=sessionStorage.getItem('mitsa-registration-submission');if(!resumeSubmission&&z.uuid().safeParse(prior).success)setSubmissionId(prior!);else sessionStorage.setItem('mitsa-registration-submission',initialSubmissionId);}catch{/* Stable hidden field still supports native submission. */}},[initialSubmissionId,resumeSubmission]);
  useEffect(()=>{if(focusVersion&&!pending)summary.current?.focus();},[focusVersion,pending]);
  const focusSummary=()=>setFocusVersion(version=>version+1);
  function validateField(event:FormEvent<HTMLFormElement>) {
    if(!(event.target instanceof HTMLInputElement))return;
    const name=event.target.getAttribute("name") as SignupField;
    if(!signupFieldNames.includes(name))return;
    if(!uncertain)setMessage("");
    const all=signupFieldErrors(Object.fromEntries(new FormData(event.currentTarget)));
    // Update feedback while the user edits an already flagged field. Removing
    // errors on blur can move the next control during the pointer click.
    setErrors(previous=>previous[name]?{...previous,[name]:all[name],...(name==="password"&&previous.confirmPassword?{confirmPassword:all.confirmPassword}:{})}:previous);
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(inFlight.current||uncertain||restartAllowed)return;
    const body=new FormData(event.currentTarget),invalid=signupFieldErrors(Object.fromEntries(body));setErrors(invalid);
    if(Object.keys(invalid).length){setMessage(registrationMessages.input);focusSummary();return;}
    if(captchaSiteKey&&!challengeToken){setMessage(registrationMessages.challenge);focusSummary();return;}
    inFlight.current=true;setPending(true);setMessage("");let navigating=false;
    try {
      const response=await fetch("/auth/register",{method:"POST",body,credentials:"same-origin",headers:{"x-mitsa-form":"1","accept":"application/json"},signal:AbortSignal.timeout(30000)});
      // The shared server helper returns JSON destinations for enhanced forms.
      // Also recognize a safe followed 303 before attempting to parse errors.
      if(response.ok&&response.redirected){const destination=new URL(response.url);if(destination.origin===location.origin&&["/verify-email","/workspaces","/login"].includes(destination.pathname)){navigating=true;try{sessionStorage.removeItem('mitsa-registration-submission');}catch{/* no sensitive storage */}location.assign(destination.href);return;}}
      const payload:unknown=await response.json();
      const success=z.object({redirect:z.string()}).safeParse(payload);
      if(response.ok&&success.success){const destination=new URL(success.data.redirect,location.origin);if(destination.origin===location.origin&&["/verify-email","/workspaces","/login"].includes(destination.pathname)){navigating=true;try{sessionStorage.removeItem('mitsa-registration-submission');}catch{/* no sensitive storage */}location.assign(destination.href);return;}}
      const failure=responseError.safeParse(payload);setMessage(failure.success?registrationMessages[failure.data.error.code]:registrationMessages.unavailable);
      if(initialSubmissionId&&failure.success&&failure.data.error.code==='submission_pending'){setUncertain(true);setIdentityLocked(true);}
      if(initialSubmissionId&&failure.success&&failure.data.error.code==='submission_empty_expired'){setRestartAllowed(true);setUncertain(true);}
      if(initialSubmissionId&&failure.success&&failure.data.error.code==='password'){const next=crypto.randomUUID();setSubmissionId(next);setIdentityLocked(false);try{sessionStorage.setItem('mitsa-registration-submission',next);}catch{/* no sensitive storage */}}
      if(failure.success&&failure.data.error.fields){const safe:SignupErrors={};for(const name of signupFieldNames)if(failure.data.error.fields[name])safe[name]=failure.data.error.fields[name];setErrors(safe);}
    }catch {setMessage(initialSubmissionId?registrationMessages.submission_pending:registrationMessages.network);if(initialSubmissionId){setUncertain(true);setIdentityLocked(true);}}
    finally{if(!navigating){inFlight.current=false;setPending(false);if(captchaSiteKey){setChallengeToken('');setChallengeReset(version=>version+1);}focusSummary();}}
  }
  async function checkStatus() {
    if(checking)return;setChecking(true);
    try{const response=await fetch('/auth/registration/status',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});
      const value=z.object({state:z.enum(['checking','verify-email','sign-in','expired','unavailable']),redirect:z.string().optional(),restartAllowed:z.boolean().optional()}).safeParse(await response.json());
      if(response.ok&&value.success&&value.data.state==='verify-email'&&value.data.redirect==='/verify-email'){location.assign('/verify-email');return;}
      if(response.ok&&value.success&&value.data.state==='sign-in'&&value.data.redirect==='/login'){location.assign('/login');return;}
      const empty=value.success&&value.data.state==='expired'&&value.data.restartAllowed===true;setRestartAllowed(empty);
      setMessage(empty?registrationMessages.submission_empty_expired:value.success&&value.data.state==='expired'?'This request has expired. Return to Sign In to resume a pending account securely.':registrationMessages.submission_pending);
    }catch{setMessage('The registration status could not be checked. Your details remain here. Try the status check again when your connection returns.');}
    finally{setChecking(false);focusSummary();}
  }
  return <form className={site.form} action="/auth/register" method="post" onSubmit={submit} onChange={validateField} noValidate={enhanced} aria-busy={pending}>
    {message?<div className={s.errorSummary} role="alert" tabIndex={-1} ref={summary}><p>{message}</p>{Object.entries(errors).some(([,error])=>error)?<ul>{signupFieldNames.filter(name=>errors[name]).map(name=><li key={name}><a href={`#${id(name)}`}>{errors[name]}</a></li>)}</ul>:null}</div>:null}
    <fieldset disabled={!enabled||pending}>
      <div className={site.field} data-auth-field><label htmlFor={id("fullName")}>Full name</label><input id={id("fullName")} name="fullName" autoComplete="name" maxLength={120} required readOnly={identityLocked} aria-invalid={errors.fullName?true:undefined} aria-describedby={errors.fullName?`${id("fullName")}-error`:undefined}/>{errors.fullName?<p id={`${id("fullName")}-error`} className={s.fieldError}>{errors.fullName}</p>:null}</div>
      <div className={site.field} data-auth-field><label htmlFor={id("email")}>Email</label><input id={id("email")} name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} maxLength={254} required readOnly={identityLocked} aria-invalid={errors.email?true:undefined} aria-describedby={errors.email?`${id("email")}-error`:undefined}/>{errors.email?<p id={`${id("email")}-error`} className={s.fieldError}>{errors.email}</p>:null}</div>
      <PasswordField name="password" label="Password" minLength={8} inputId={id("password")} error={errors.password} describedBy={id("password-hint")}/>
      <p id={id("password-hint")} className={`${s.smallPrint} ${site.hint}`}>Use at least eight characters. A long, unique password is best; your account provider may require additional strength.</p>
      <PasswordField name="confirmPassword" label="Confirm password" minLength={8} inputId={id("confirmPassword")} error={errors.confirmPassword}/>
      <input name="termsVersion" type="hidden" value={termsId}/>
      {initialSubmissionId?<input name="submissionId" type="hidden" value={submissionId}/>:null}
      {privacyId?<input name="privacyVersion" type="hidden" value={privacyId}/>:null}
      {captchaSiteKey?<><input name="captchaToken" type="hidden" value={challengeToken}/><SignupChallenge siteKey={captchaSiteKey} nonce={nonce} resetVersion={challengeReset} onToken={setChallengeToken}/></>:null}
      <label className={site.checkField}><input id={id("accepted")} name="accepted" type="checkbox" required aria-invalid={errors.accepted?true:undefined} aria-describedby={errors.accepted?`${id("accepted")}-error`:undefined}/><span>I have read and accept the {isTest?"development agreement":"Terms of Use"}{privacyId?' and acknowledge the Privacy Notice':''}.</span></label>
      {errors.accepted?<p id={`${id("accepted")}-error`} className={s.fieldError}>{errors.accepted}</p>:null}
      <div className={`${site.authLinks} ${s.agreementLinks}`}><a href={isTest?'/terms#test-agreement':'/terms'}>Read the agreement</a><a href="/privacy">Privacy Policy draft</a></div>
      <button className={site.button} type="submit" disabled={uncertain||restartAllowed||Boolean(captchaSiteKey&&!challengeToken)}> {pending?"Creating account…":"Create account"}</button>
      {captchaSiteKey&&!challengeToken&&enabled?<p className={s.smallPrint}>Complete human verification to enable Create account.</p>:null}
    </fieldset>
    {pending?<p className={s.smallPrint} role="status">Preparing your account and verification message…</p>:null}
    {uncertain?<button className={s.challengeRetry} type="button" disabled={checking} onClick={checkStatus}>{checking?'Checking registration…':'Check registration status'}</button>:null}
    {uncertain&&!restartAllowed?<button className={s.challengeRetry} type="button" disabled={checking} onClick={()=>{setUncertain(false);setMessage('Your original name and email are retained. Retrying this request cannot change an existing account password. Complete a fresh human verification to continue.');}}>Retry this same request</button>:null}
    {restartAllowed?<button className={s.challengeRetry} type="button" disabled={!enabled||checking} onClick={()=>{const next=crypto.randomUUID();setSubmissionId(next);setUncertain(false);setIdentityLocked(false);setRestartAllowed(false);setMessage('A new request is ready. Review your details and complete a fresh human verification.');setChallengeToken('');setChallengeReset(v=>v+1);try{sessionStorage.setItem('mitsa-registration-submission',next);}catch{/* UUID only */}}}>Start a new request</button>:null}
  </form>;
}
