import {createInterface} from 'node:readline';
// Operator stdin only; never accepts an OTP, token, address or credential.
export async function waitForPilotInbox(input, expiresAt, now=Date.now()) {
 const remaining=expiresAt-now-30000;
 if(!Number.isFinite(remaining)||remaining<=0||remaining>30*60000)return false;
 return new Promise(resolve=>{
  let finished=false;const lines=createInterface({input,terminal:false});
  const finish=value=>{if(finished)return;finished=true;clearTimeout(timer);lines.close();resolve(value);};
  const timer=setTimeout(()=>finish(false),remaining);
  lines.once('line',line=>finish(line==='received'));
  lines.once('close',()=>finish(false));
  lines.once('error',()=>finish(false));
 });
}
