"use client";

import { createContext,useContext,useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import s from './site.module.css';

const ActionGroup=createContext<{pending:boolean;start:()=>boolean;finish:()=>void}|null>(null);
export function FormActionGroup({children}:{children:ReactNode}) {
  const [pending,setPending]=useState(false),locked=useRef(false);
  return <ActionGroup.Provider value={{pending,start:()=>{if(locked.current)return false;locked.current=true;setPending(true);return true;},finish:()=>{locked.current=false;setPending(false);}}}>{children}</ActionGroup.Provider>;
}

// Progressive enhancement only: the same action/method work without JavaScript.
export function PostForm({ action, children, className, pendingLabel = "Saving…",timeoutMs,onFailure }: { action: string; children: ReactNode; className?: string; pendingLabel?: string;timeoutMs?:number;onFailure?:()=>void }) {
  const [pending, setPending] = useState(false);
  const group=useContext(ActionGroup);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [focusVersion,setFocusVersion]=useState(0);
  useEffect(()=>{if(focusVersion&&!pending)errorRef.current?.focus();},[focusVersion,pending]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current||group?.pending) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    if(group&&!group.start())return;
    inFlight.current = true; setPending(true); setError(false);
    let navigating=false;
    try {
      // A hidden input named "action" shadows HTMLFormElement.action.
      // Use the explicit component destination, never the named DOM property.
      const response = await fetch(action, { method: "POST", body, credentials: "same-origin", headers:{"x-mitsa-form":"1"},...(timeoutMs?{signal:AbortSignal.timeout(timeoutMs)}:{}) });
      let destination=response.url,enhancedRedirect=false;
      if(response.ok&&response.headers.get("content-type")?.includes("application/json")) {
        const data:unknown=await response.json();
        if(data&&typeof data==="object"&&"redirect" in data&&typeof data.redirect==="string"){destination=data.redirect;enhancedRedirect=true;}
      }
      const url = new URL(destination,location.origin);
      const safe = ["/workspaces", "/onboarding", "/login", "/signup", "/forgot-password", "/access-denied", "/invitations/accept", "/operator/requests", "/settings/account", "/settings/account/security", "/settings/account/terms", "/settings/account/recovery", "/settings/account/privacy", "/verify-email", "/verify-email/renew", "/reset-password"].includes(url.pathname) || /^\/w\/[a-z0-9]+(-[a-z0-9]+)*(\/(settings|members|locations|permissions|ownership|audit))?$/.test(url.pathname);
      if (response.ok && (response.redirected||enhancedRedirect) && url.origin === location.origin && safe) { navigating=true;location.assign(url.href); return; }
      setError(true);
    } catch { setError(true); }
    finally { if(!navigating){inFlight.current = false; setPending(false);group?.finish();setFocusVersion(version=>version+1);onFailure?.();} }
  }
  return <form className={className} action={action} method="post" onSubmit={submit} onChange={()=>setError(false)} aria-busy={pending}>
    <fieldset disabled={pending||group?.pending}>{children}</fieldset>
    {pending ? <p className={s.pendingFeedback} role="status">{pendingLabel}</p> : null}
    {error ? <p className={s.errorFeedback} role="alert" tabIndex={-1} ref={errorRef}>We couldn’t complete that request. Check your connection and try again.</p> : null}
  </form>;
}
