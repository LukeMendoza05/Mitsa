'use client';
import {useState,useId} from 'react';
import {SignupChallenge} from './SignupChallenge';
import {PostForm} from '@/components/site/PostForm';
import s from '@/components/site/site.module.css';
import auth from './auth.module.css';
export function RecoveryForm({enabled,captchaSiteKey,nonce,requestKey}:{enabled:boolean;captchaSiteKey?:string;nonce?:string;requestKey?:string}) {
 const id=useId(),[token,setToken]=useState(''),[reset,setReset]=useState(0);
 return <PostForm className={s.form} action='/auth/password/request' pendingLabel='Requesting a reset…' timeoutMs={30000} onFailure={()=>{setToken('');setReset(v=>v+1);}}>
  <fieldset disabled={!enabled}><div className={s.field} data-auth-field><label htmlFor={id}>Email</label><input id={id} type='email' name='email' autoComplete='email' maxLength={254} required aria-describedby={`${id}-help`}/><p id={`${id}-help`} className={auth.smallPrint}>Use the address associated with your Mitsa account.</p></div>
  {requestKey?<input type='hidden' name='requestKey' value={requestKey}/>:null}
  {captchaSiteKey?<><input type='hidden' name='captchaToken' value={token}/><SignupChallenge siteKey={captchaSiteKey} nonce={nonce} resetVersion={reset} onToken={setToken} action='recovery'/></>:null}
  <button className={s.button} disabled={Boolean(captchaSiteKey&&!token)}>Request reset link</button>
  {captchaSiteKey&&!token&&enabled?<p className={auth.smallPrint}>Complete human verification to request a reset link.</p>:null}</fieldset>
 </PostForm>;
}
