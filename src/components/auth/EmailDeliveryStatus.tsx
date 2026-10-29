'use client';
import {useState} from 'react';
import {z} from 'zod';
import s from './auth.module.css';
const result=z.object({state:z.enum(['requested','processing','sent','unconfirmed','unavailable'])}).strict();
const messages={requested:'Your request is recorded. The verification message is being prepared.',processing:'Your verification message is being processed.',sent:'The email service accepted the message. Check your inbox and Spam; inbox receipt is not confirmed here.',unconfirmed:'Delivery could not be confirmed. Your pending account is preserved. Wait for the cooldown before explicitly requesting a fresh code.',unavailable:'Delivery status is temporarily unavailable. A valid code already received can still be verified.'};
export function EmailDeliveryStatus() {
 const [pending,setPending]=useState(false),[message,setMessage]=useState('');
 async function check(){if(pending)return;setPending(true);try{const response=await fetch('/auth/email/status',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(10000)});const parsed=result.safeParse(await response.json());setMessage(response.ok&&parsed.success?messages[parsed.data.state]:messages.unavailable);}catch{setMessage(messages.unavailable);}finally{setPending(false);}}
 return <div><button className={s.challengeRetry} type='button' disabled={pending} onClick={check}>{pending?'Checking delivery…':'Check delivery status'}</button>{message?<p className={s.smallPrint} role='status'>{message}</p>:null}</div>;
}
