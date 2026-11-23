// Read-only public-output audit. No account/session/SMTP action.
import {readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {parse} from 'dotenv';
import {gmailCredentialFilePresent,readProtectedGmailCredentials} from './lib/gmail-credentials.mjs';
function files(root){return readdirSync(root).flatMap(name=>{const path=`${root}/${name}`;return statSync(path).isDirectory()?files(path):[path];});}
const env=parse(readFileSync('.env.local')),operator=parse(readFileSync('.secrets/operator.env')),email=JSON.parse(readFileSync('.secrets/developer-registration.json','utf8')).email.trim().toLowerCase();
const privateValues=[email,env.MITSA_REGISTRATION_INTENT_KEY,env.MFA_ENROLLMENT_KEY,env.AUTH_FLOW_KEY,env.MITSA_DEVELOPER_EMAIL_SHA256,env.MITSA_TURNSTILE_SECRET_KEY,operator.TEST_AUTH_ADMIN_KEY,operator.TEST_DATABASE_URL].filter(v=>typeof v==='string'&&v.length>10);
try{const controlled=JSON.parse(readFileSync('.secrets/onboarding-recipient.json','utf8')).email;if(typeof controlled==='string')privateValues.push(controlled);}catch{/* A controlled recipient is optional before preparation. */}
// Protected SMTP values are checked only in memory, never reported or saved.
const smtpCredentialsChecked=gmailCredentialFilePresent();
if(smtpCredentialsChecked){const smtp=readProtectedGmailCredentials();privateValues.push(smtp.sender,smtp.appPassword);}
const examined=['.next/static','src','docs','artifacts','scripts'].flatMap(files).filter(p=>/\.(js|css|map|ts|tsx|md|json|mjs|sql|html|txt)$/.test(p));
const matches=examined.filter(p=>{const c=readFileSync(p,'utf8').toLowerCase();return privateValues.some(v=>c.includes(v.toLowerCase()));});
const baseline=JSON.parse(readFileSync('artifacts/landing-preservation-baseline.json','utf8')),changed=Object.entries(baseline.files).filter(([p,h])=>createHash('sha256').update(readFileSync(p)).digest('hex')!==h).map(([p])=>p);
const checks=[];for(const [port,path,status] of [[3000,'/verify-email',200],[3001,'/verify-email',200],[3001,'/testing/registration',404]]){
 const response=await fetch(`http://127.0.0.1:${port}${path}`,{signal:AbortSignal.timeout(20000)}),body=(await response.text()).toLowerCase();checks.push({port,path,status:response.status,expected:status,noPrivateValue:!privateValues.some(v=>body.includes(v.toLowerCase())),uncacheable:response.headers.get('cache-control')?.includes('no-store')===true});
}
const origin='http://127.0.0.1:3001';const missing=await fetch(`${origin}/auth/email/code`,{method:'POST',headers:{origin},body:new URLSearchParams({action:'resend'}),redirect:'manual'}),cross=await fetch(`${origin}/auth/email/code`,{method:'POST',headers:{origin:'https://attacker.invalid'},body:new URLSearchParams({action:'verify',code:'123456'}),redirect:'manual'});
const ignore=readFileSync('.vercelignore','utf8'),excluded=['.secrets/','.env*','docs/','scripts/','tests/','artifacts/'].every(p=>ignore.split(/\r?\n/).includes(p));
const result={checkedAt:new Date().toISOString(),examinedFiles:examined.length,privateValueMatchFiles:matches,protectedSmtpCredentialsChecked:smtpCredentialsChecked,landingFilesPreserved:Object.keys(baseline.files).length,landingChanged:changed,publicPages:checks,productionMissingContextRejected:missing.status===303&&missing.headers.get('location')?.endsWith('/verify-email?error=expired'),productionCsrfRejected:cross.status===403,privateDeploymentExclusionsPresent:excluded};
result.passed=matches.length===0&&changed.length===0&&checks.every(c=>c.status===c.expected&&c.noPrivateValue&&c.uncacheable)&&result.productionMissingContextRejected&&result.productionCsrfRejected&&excluded;
writeFileSync('artifacts/email-public-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({examinedFiles:examined.length,privateValueMatches:matches.length,landingFilesPreserved:result.landingFilesPreserved,landingChanged:changed.length,productionMissingContextRejected:result.productionMissingContextRejected,productionCsrfRejected:result.productionCsrfRejected,privateDeploymentExclusionsPresent:excluded,passed:result.passed}));if(!result.passed)process.exitCode=1;
