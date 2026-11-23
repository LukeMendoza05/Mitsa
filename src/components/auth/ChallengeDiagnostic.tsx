'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {SignupChallenge} from './SignupChallenge';
import site from '@/components/site/site.module.css';
import s from './auth.module.css';
import {expiryDiagnosticMessage} from '@/lib/auth/expiry-feedback';
export function ChallengeDiagnostic({siteKey,nonce}:{siteKey:string;nonce?:string}) {
 const [token,setToken]=useState(''),[reset,setReset]=useState(0),[pending,setPending]=useState(false),[message,setMessage]=useState(''),[deadline,setDeadline]=useState(0),[now,setNow]=useState(0),[confirmCancel,setConfirmCancel]=useState(false);
 const inFlight=useRef(false),heldProof=useRef('');
 useEffect(()=>{if(!deadline)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[deadline]);
 useEffect(()=>()=>{heldProof.current='';},[]);
 const check=useCallback(async(proof:string,expiry=false)=>{
  if(inFlight.current)return;
  if(!proof){setMessage('The held proof was cleared locally. No server expiry check was sent.');setDeadline(0);return;}
  inFlight.current=true;setPending(true);setMessage('');
  try{
   const body=new FormData();body.set('captchaToken',proof);body.set('check',expiry?'expiry':'verification');
   const response=await fetch('/testing/registration/challenge',{method:'POST',body,credentials:'same-origin',signal:AbortSignal.timeout(22000)});
   const result:unknown=await response.json().catch(()=>null),valid=response.ok&&typeof result==='object'&&result!==null;
   if(expiry)setMessage(expiryDiagnosticMessage(response.status,result));
   else setMessage(valid&&'verified' in result&&result.verified===true&&'replayRejected' in result&&result.replayRejected===true?'Server verification and replay protection passed. No account was created.':'Server verification did not pass. Complete a new challenge and try again.');
  }catch{setMessage(expiry?'The browser could not complete the server request. No Cloudflare expiry result was obtained.':'Server verification could not complete. Check your connection and try again.');}
  finally{setToken('');heldProof.current='';setDeadline(0);setConfirmCancel(false);setReset(version=>version+1);setPending(false);inFlight.current=false;}
 },[]);
 useEffect(()=>{if(deadline&&now>=deadline)void check(heldProof.current,true);},[deadline,now,check]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!deadline)await check(token);
 }
 const seconds=Math.max(0,Math.ceil((deadline-now)/1000));
 function hold(){if(inFlight.current||!token||deadline)return;heldProof.current=token;setToken('');const time=Date.now();setNow(time);setDeadline(time+301000);setConfirmCancel(false);setMessage('Expiry test started. Keep this page open. Mitsa will check the held proof automatically after five minutes.');}
 function cancel(){if(inFlight.current)return;heldProof.current='';setDeadline(0);setConfirmCancel(false);setMessage('Expiry test cancelled. The held proof was cleared.');setToken('');setReset(version=>version+1);}
 return <form onSubmit={submit} aria-busy={pending}>
  <div inert={Boolean(deadline)} aria-hidden={Boolean(deadline)}><SignupChallenge siteKey={siteKey} nonce={nonce} resetVersion={reset} onToken={setToken} diagnostic frozen={Boolean(deadline)}/></div>
  {!deadline?<>
   <div className={site.actions}>
    <button className={site.button} disabled={pending||!token} type="submit">{pending?'Checking…':'Check server verification'}</button>
    <button className={`${site.button} ${site.secondary}`} disabled={pending||!token} type="button" onClick={hold}>Start expiry test</button>
   </div></>:<>
   <p className={s.smallPrint}>{pending?'Checking the expired proof with the server…':`Automatic expiry check in ${seconds}s. No further click is needed. Keep this page open; refreshing clears the held proof.`}</p>
   {!confirmCancel?<button className={`${site.button} ${site.secondary}`} disabled={pending} type="button" onClick={()=>setConfirmCancel(true)}>Cancel expiry test…</button>:<>
    <p className={s.smallPrint}>Discard the held proof and stop this expiry test?</p>
    <div className={site.actions}>
     <button className={`${site.button} ${site.secondary}`} disabled={pending} type="button" onClick={cancel}>Discard held proof</button>
     <button className={site.button} disabled={pending} type="button" onClick={()=>setConfirmCancel(false)}>Keep waiting</button>
    </div>
   </>}
  </>}
  <p className={s.smallPrint} role="status">{message}</p>
 </form>;
}
