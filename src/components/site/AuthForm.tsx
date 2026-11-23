"use client";
import {useEffect,useId,useRef,useState,useSyncExternalStore,type FormEvent} from "react";
import {emailSchema} from "@/lib/auth/forms";
import {PasswordField} from "./PasswordField";
import s from "./site.module.css";
const subscribe=()=>()=>{};
export function AuthForm({mode,initialError=""}:{mode:"login"|"logout";initialError?:string}) {
  const login=mode==="login",prefix=useId(),[pending,setPending]=useState(false),[error,setError]=useState(initialError);
  const [fields,setFields]=useState<{email?:string;password?:string}>({}),inFlight=useRef(false),errorMessage=useRef<HTMLParagraphElement>(null);
  const enhanced=useSyncExternalStore(subscribe,()=>true,()=>false);
  const [focusVersion,setFocusVersion]=useState(0);
  useEffect(()=>{if(focusVersion&&!pending)errorMessage.current?.focus();},[focusVersion,pending]);
  const focusError=()=>setFocusVersion(version=>version+1);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(inFlight.current)return;
    const form=event.currentTarget,body=new FormData(form);
    if(login){const invalid={...(!emailSchema.safeParse(body.get("email")).success?{email:"Enter a valid email address."}:{}),...(!body.get("password")?{password:"Enter your password."}:{})};setFields(invalid);if(Object.keys(invalid).length){setError("Review your email and password.");focusError();return;}}
    inFlight.current=true;setPending(true);setError("");let navigating=false;
    try {
      const response=await fetch(form.action,{method:"POST",body,credentials:"same-origin",headers:{"x-mitsa-form":"1"}});
      let url=response.url,enhancedRedirect=false;
      if(response.ok&&response.headers.get("content-type")?.includes("application/json")){const data:unknown=await response.json();if(data&&typeof data==="object"&&"redirect" in data&&typeof data.redirect==="string"){url=data.redirect;enhancedRedirect=true;}}
      const destination=new URL(url,location.origin),allowed=login?["/proof","/workspaces","/settings/account/security","/invitations/accept","/verify-email","/verify-email/renew"]:["/login"];
      if(response.ok&&(response.redirected||enhancedRedirect)&&destination.origin===location.origin&&allowed.includes(destination.pathname)){navigating=true;location.assign(destination.href);return;}
      setError(login?response.status===429?"Too many sign-in attempts. Wait a few minutes before trying again.":"We couldn’t sign you in. Check your email and password, then try again.":"Sign-out could not be confirmed. Please try again.");
    }catch{setError("We couldn’t connect. Check your connection and try again.");}
    finally{if(!navigating){inFlight.current=false;setPending(false);focusError();}}
  }
  function edit(event:FormEvent<HTMLFormElement>){
    setError("");if(!(event.target instanceof HTMLInputElement))return;
    const {name,value}=event.target;
    if(name==='email'&&emailSchema.safeParse(value).success)setFields(previous=>({...previous,email:undefined}));
    if(name==='password'&&value)setFields(previous=>({...previous,password:undefined}));
  }
  return <form className={login?s.form:undefined} action={login?"/auth/login":"/auth/logout"} method="post" onSubmit={submit} onChange={edit} aria-busy={pending} noValidate={enhanced}>
    {error?<p className={s.error} role="alert" tabIndex={-1} ref={errorMessage}>{error}</p>:null}
    {login?<><div className={s.field} data-auth-field><label htmlFor={`${prefix}-email`}>Email</label><input id={`${prefix}-email`} name="email" type="email" inputMode="email" autoComplete="username" spellCheck={false} required maxLength={254} disabled={pending} aria-invalid={fields.email?true:undefined} aria-describedby={fields.email?`${prefix}-email-error`:undefined}/>{fields.email?<p id={`${prefix}-email-error`} className={s.fieldError}>{fields.email}</p>:null}</div><PasswordField name="password" label="Password" autoComplete="current-password" disabled={pending} error={fields.password} labelAside={<a href="/forgot-password">Forgot password?</a>}/></>:null}
    <button className={s.button} type="submit" disabled={pending}>{pending?(login?"Signing in…":"Signing out…"):(login?"Sign in":"Sign out")}</button>
  </form>;
}
