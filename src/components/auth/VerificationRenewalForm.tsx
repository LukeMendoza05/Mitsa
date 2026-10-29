'use client';
import {useState} from 'react';
import {PostForm} from '@/components/site/PostForm';
import {SignupChallenge} from './SignupChallenge';
import s from '@/components/site/site.module.css';
export function VerificationRenewalForm({termsId,privacyId,siteKey,nonce}:{termsId:string;privacyId:string;siteKey:string;nonce?:string}) {
 const [token,setToken]=useState('');
 return <PostForm className={s.form} action='/auth/email/renew' pendingLabel='Preparing secure verification…'>
  <input type='hidden' name='termsVersion' value={termsId}/><input type='hidden' name='privacyVersion' value={privacyId}/><input type='hidden' name='captchaToken' value={token}/>
  <SignupChallenge siteKey={siteKey} nonce={nonce} resetVersion={0} onToken={setToken}/>
  <label className={s.checkField}><input type='checkbox' name='accepted' required/><span>I have reviewed the agreement and Privacy Notice above.</span></label>
  <button className={s.button} disabled={!token}>Continue to email verification</button>
 </PostForm>;
}
