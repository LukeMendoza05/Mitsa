// Local browser regression only. No Supabase, SMTP, accounts or credentials.
import {createServer} from 'node:http';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {submitPilotResend} from './lib/pilot-browser-resend.mjs';
let posts=0,completed=0,mode='enhanced',deny=false,disabled=false,browser;
const server=createServer(async(req,res)=>{
 if(req.method==='POST'){
  posts++;await new Promise(resolve=>setTimeout(resolve,400));completed++;
  if(mode==='enhanced'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({redirect:deny?'/verify-email?error=cooldown':'/verify-email?resent=1'}));}
  else{res.writeHead(303,{location:deny?'/verify-email?error=cooldown':'/verify-email?resent=1'});res.end();}return;
 }
 res.writeHead(200,{'content-type':'text/html'});
 res.end(`<form action="/auth/email/code" method="post"><input type="hidden" name="action" value="resend"><button ${disabled?'disabled':''}>Resend code</button></form>${disabled?`<script>setTimeout(()=>document.querySelector('button').disabled=false,200);</script>`:''}${mode==='enhanced'?`<script>document.querySelector('form').onsubmit=async event=>{event.preventDefault();const response=await fetch('/auth/email/code',{method:'POST',body:new FormData(event.target)});location.assign((await response.json()).redirect);};</script>`:''}`);
});
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();page.setDefaultTimeout(5000);
 // Reproduce the old wait: same URL is already satisfied while POST is delayed.
 await page.goto(`${origin}/verify-email?resent=1`);await page.getByRole('button',{name:'Resend code',exact:true}).click();
 await page.waitForURL(url=>url.pathname==='/verify-email'&&url.searchParams.get('resent')==='1');
 assert.equal(completed,0);await page.waitForEvent('framenavigated',{predicate:frame=>frame===page.mainFrame()});await page.waitForLoadState('load');assert.equal(completed,1);
 let checks=1;
 for(mode of ['enhanced','native']){
  for(let repeat=0;repeat<2;repeat++){
   await page.goto(`${origin}/verify-email?resent=1`);const before=completed;await submitPilotResend(page);assert.equal(completed,before+1);checks++;
  }
  deny=true;await page.goto(`${origin}/verify-email?resent=1`);await assert.rejects(()=>submitPilotResend(page),/Resend did not complete/);deny=false;checks++;
 }
 assert.equal(posts,completed);
 disabled=true;mode='enhanced';await page.goto(`${origin}/verify-email?resent=1`);const before=completed;await submitPilotResend(page);assert.equal(completed,before+1);checks++;
 const report={checkedAt:new Date().toISOString(),checksPassed:checks,oldSameUrlRaceReproduced:true,enhancedAndNativeRepeatedResendWaitsPassed:true,cooldownDestinationRejected:true,providerCalls:0,smtpAttempts:0,privateValuesUsed:false};
 writeFileSync('artifacts/pilot-resend-browser-regression.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch{console.error('Local resend browser regression failed; details suppressed');process.exitCode=1;}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
