// Local rendering only. Uses an illustrative code; never reads captured mail.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {parse} from 'dotenv';import {chromium} from 'playwright';
import {signupEmailTemplate} from '../src/lib/mail/verification-template.ts';import {sealAuthFlow,signupCodeCookie} from '../src/lib/security/auth-flow.ts';
process.env.MITSA_EMAIL_OTP_LENGTH??=parse(readFileSync('.env.local')).MITSA_EMAIL_OTP_LENGTH??'6';
const {emailVerificationCodeLength,emailVerificationExpirySeconds}=await import('../src/lib/auth/email-code-settings.ts');
const candidate=process.argv.includes('--six-digit-candidate');
if(candidate&&emailVerificationCodeLength!==6)throw Error('Explicit six-digit preview runtime required');
const observed=JSON.parse(readFileSync('artifacts/provider-otp-dashboard-review.json','utf8'));
if(!candidate&&observed.emailOtpLength!==emailVerificationCodeLength)throw Error('Preview/provider configuration mismatch');
const template=signupEmailTemplate(emailVerificationExpirySeconds),directory=candidate?'docs/previews/email-verification-six-digit':'docs/previews/email-verification',templateDirectory=candidate?'docs/templates/six-digit':'docs/templates';mkdirSync(directory,{recursive:true});mkdirSync(templateDirectory,{recursive:true});
writeFileSync(`${templateDirectory}/supabase-confirm-signup.html`,template.html+'\n');writeFileSync(`${templateDirectory}/supabase-confirm-signup.txt`,template.text+'\n');
writeFileSync(`${templateDirectory}/supabase-confirm-signup.json`,JSON.stringify({subject:template.subject,observedProviderCodeLength:observed.emailOtpLength,requiredOtpLength:emailVerificationCodeLength,previewIllustrativeCodeLength:emailVerificationCodeLength,providerOtpValiditySeconds:emailVerificationExpirySeconds,configurationEvidence:'Persisted dashboard review and encrypted hosted capture',proposedOtpLength:6,providerChangeApproved:observed.settingsSaved===true,published:false},null,2)+'\n');
const illustrative='12345678'.slice(0,emailVerificationCodeLength),preview=template.html.replaceAll('{{ .Token }}',illustrative).replaceAll('{{ .SiteURL }}','http://127.0.0.1:3000').replaceAll('{{ .TokenHash }}','0'.repeat(64));
writeFileSync(`${directory}/email-preview.html`,preview+'\n');writeFileSync(`${directory}/email-preview.txt`,template.text.replaceAll('{{ .Token }}',illustrative).replaceAll('{{ .SiteURL }}','http://127.0.0.1:3000').replaceAll('{{ .TokenHash }}','0'.repeat(64))+'\n');
const browser=await chromium.launch({channel:'msedge',headless:true}),checks=[],appOrigin=process.env.MITSA_PREVIEW_ORIGIN??'http://127.0.0.1:3000';
if(!['http://127.0.0.1:3000','http://127.0.0.1:3001','http://127.0.0.1:3002'].includes(appOrigin))throw Error('Local preview origin required');
try {
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]])for(const theme of ['light','dark']) {
  const context=await browser.newContext({viewport:{width,height},colorScheme:theme,reducedMotion:'reduce'}),page=await context.newPage();
  try {await page.route('http://127.0.0.1:3000/email-preview',route=>route.fulfill({contentType:'text/html',body:preview}));await page.goto('http://127.0.0.1:3000/email-preview');if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Email preview overflow');await page.screenshot({path:`${directory}/email-${name}-${theme}.png`,fullPage:true});checks.push({surface:'email',name,theme,overflow:false});}finally{await context.close();}
 }
 const key=parse(readFileSync('.env.local')).AUTH_FLOW_KEY;
 for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844]]) {
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage(),now=Date.now();
   try{await context.addCookies([{name:signupCodeCookie,value:sealAuthFlow({purpose:'signup-code',email:'foundation-layout-preview@example.invalid',issuedAt:now,resendAt:now+60000,expiresAt:now+3600000},key),url:appOrigin,httpOnly:true,sameSite:'Strict'}]);await page.goto(`${appOrigin}/verify-email`);await page.evaluate(()=>document.fonts.ready);const input=page.getByLabel('Verification code',{exact:true});if(await input.inputValue())throw Error('Preview input must be empty');if(await input.getAttribute('maxlength')!==String(emailVerificationCodeLength))throw Error('Preview runtime/provider candidate mismatch');await page.screenshot({path:`${directory}/${name}.png`,fullPage:true,style:'nextjs-portal { visibility: hidden !important; }'});checks.push({surface:'application',name,emptyCodeInput:true,codeLength:emailVerificationCodeLength});}finally{await context.close();}
 }
 writeFileSync(candidate?'artifacts/six-digit-preview-verification.json':'artifacts/email-preview-verification.json',JSON.stringify({checkedAt:new Date().toISOString(),candidateOnly:candidate,illustrativeCodeOnly:true,actualEmailClientsTested:false,checks},null,2)+'\n');console.log(JSON.stringify({previewsRendered:checks.length,candidateOnly:candidate,illustrativeCodeOnly:true,externalEmailsSent:0,actualEmailClientsTested:false}));
}finally{await browser.close();}
