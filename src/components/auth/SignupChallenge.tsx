'use client';
import Script from 'next/script';
import {useEffect,useRef,useState} from 'react';
import s from './auth.module.css';
type WidgetOptions={sitekey:string;action:'signup'|'recovery';theme:'light';size:'compact'|'flexible';'response-field':false;'refresh-expired'?:'never';'refresh-timeout'?:'never';callback:(token:string)=>void;'expired-callback':()=>void;'error-callback':()=>void};
declare global {interface Window {turnstile?:{render(container:HTMLElement,options:WidgetOptions):string;remove(id:string):void}}}
export function SignupChallenge({siteKey,nonce,resetVersion,onToken,diagnostic=false,frozen=false,action='signup'}:{siteKey:string;nonce?:string;resetVersion:number;onToken:(token:string)=>void;diagnostic?:boolean;frozen?:boolean;action?:'signup'|'recovery'}) {
 const container=useRef<HTMLDivElement>(null),[loaded,setLoaded]=useState(false),[status,setStatus]=useState('Loading human verification…');
 const [retry,setRetry]=useState(0),[failed,setFailed]=useState(false);
 const frozenRef=useRef(frozen);useEffect(()=>{frozenRef.current=frozen;},[frozen]);
 useEffect(()=>{if(loaded)return;const timeout=setTimeout(()=>{setFailed(true);setStatus('Human verification is taking longer than expected. Check your connection, then retry.');},15000);return()=>clearTimeout(timeout);},[loaded,retry]);
 useEffect(()=>{
  if(!loaded||!container.current||!window.turnstile)return;
  let active=true,widget:string|undefined,generation=0;const target=container.current,api=window.turnstile;
  const remove=()=>{if(widget){try{api.remove(widget);}catch{/* Token is cleared before any replacement. */}widget=undefined;}};
  const render=()=>{
   const current=++generation;onToken('');remove();setStatus('Checking human verification. You may be verified automatically.');
   setFailed(false);try{widget=api.render(target,{sitekey:siteKey,action,theme:'light',size:diagnostic||target.clientWidth<300?'compact':'flexible','response-field':false,
    ...(diagnostic?{'refresh-expired':'never' as const,'refresh-timeout':'never' as const}:{}),
    callback:token=>{if(active&&current===generation){onToken(token);setFailed(false);setStatus('Human verification complete.');}},
    'expired-callback':()=>{if(active&&current===generation){onToken('');setStatus('Verification expired. Wait for automatic verification or complete the prompt.');}},
    'error-callback':()=>{if(active&&current===generation){onToken('');setFailed(true);setStatus('Human verification could not load. Check your connection and retry.');}}
   });}catch{onToken('');setFailed(true);setStatus('Human verification could not load. Check your connection and retry.');}
  };
  render();let compact=target.clientWidth<300;
  const observer=new ResizeObserver(()=>{const next=target.clientWidth<300;if(active&&!diagnostic&&!frozenRef.current&&next!==compact){compact=next;render();}});observer.observe(target);
  return()=>{active=false;observer.disconnect();remove();};
 },[loaded,siteKey,resetVersion,onToken,diagnostic,action,retry]);
 function retryChallenge() {
  onToken('');setFailed(false);setStatus('Loading human verification…');
  if(window.turnstile){setLoaded(true);setRetry(v=>v+1);return;}
  // Next Script caches rejected downloads. An explicit user retry uses the
  // same canonical script URL and nonce, without reloading or losing fields.
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
  if(nonce)script.nonce=nonce;
  script.onload=()=>{if(window.turnstile)setLoaded(true);script.remove();};
  script.onerror=()=>{setFailed(true);setStatus('Human verification could not load. Check your connection and retry.');script.remove();};
  document.head.appendChild(script);setRetry(v=>v+1);
 }
 return <div className={s.challenge}>
  <Script id="mitsa-signup-challenge" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" nonce={nonce} strategy="afterInteractive" onReady={()=>setLoaded(true)} onError={()=>{setFailed(true);setStatus('Human verification could not load. Check your connection and retry.');}}/>
  <div ref={container} role="group" aria-label="Human verification"/>
  <p className={s.smallPrint} role="status">{status}</p>
  {failed&&!diagnostic&&!frozen?<button type="button" className={s.challengeRetry} onClick={retryChallenge}>Retry human verification</button>:null}
  <noscript><p className={s.smallPrint}>Enable JavaScript to complete human verification. Existing accounts can still sign in.</p></noscript>
 </div>;
}
