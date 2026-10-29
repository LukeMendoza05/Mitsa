"use client";
import {useEffect,useState,useSyncExternalStore} from "react";
import site from "@/components/site/site.module.css";
import s from "./auth.module.css";
const subscribe=()=>()=>{};
export function ResendCodeButton({availableAt,deliveryAvailable=true}:{availableAt:number;deliveryAvailable?:boolean}) {
 const hydrated=useSyncExternalStore(subscribe,()=>true,()=>false),[now,setNow]=useState(0);
 useEffect(()=>{const update=()=>setNow(Date.now());update();const timer=setInterval(update,1000);return()=>clearInterval(timer);},[]);
 const seconds=now?Math.max(0,Math.ceil((availableAt-now)/1000)):0;
 return <><button type="submit" className={`${site.button} ${site.secondary} ${s.resendButton}`} disabled={!deliveryAvailable||hydrated&&(!now||seconds>0)}>Resend code</button>
  <p className={s.smallPrint} aria-live="off">{!deliveryAvailable?"Requesting another code will be available when email delivery resumes.":hydrated&&now?seconds>0?`You can request another code in ${seconds}s.`:"You can request a new code now.":"Wait 60 seconds after your last request before requesting another code."}</p>
  {deliveryAvailable&&hydrated&&now>0&&seconds===0?<span className={site.srOnly} role="status">Resend code is available.</span>:null}
  {deliveryAvailable?<noscript><p className={s.smallPrint}>Wait at least 60 seconds after the last request. The server checks this wait when you select Resend code.</p></noscript>:null}</>;
}
