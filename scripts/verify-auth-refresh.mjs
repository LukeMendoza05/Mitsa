// Read-only artifact/public-bundle audit. Never print a secret or email value.
import {readFileSync,readdirSync,statSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {parse} from "dotenv";
const baseline=JSON.parse(readFileSync("artifacts/landing-preservation-baseline.json","utf8"));
const fingerprints=Object.fromEntries(Object.keys(baseline.files).map(path=>[path,createHash("sha256").update(readFileSync(path)).digest("hex")]));
const landingChanged=Object.keys(fingerprints).filter(path=>fingerprints[path]!==baseline.files[path]);
function files(root){return readdirSync(root).flatMap(name=>{const path=`${root}/${name}`;return statSync(path).isDirectory()?files(path):[path];});}
const env=parse(readFileSync(".env.local")),operator=parse(readFileSync(".secrets/operator.env"));
const email=JSON.parse(readFileSync(".secrets/developer-registration.json","utf8")).email.trim().toLowerCase();
const privateValues=[email,env.MITSA_REGISTRATION_INTENT_KEY,env.MFA_ENROLLMENT_KEY,env.AUTH_FLOW_KEY,env.MITSA_DEVELOPER_EMAIL_SHA256,operator.TEST_AUTH_ADMIN_KEY,operator.TEST_DATABASE_URL].filter(value=>typeof value==="string"&&value.length>10);
const examined=[...files(".next/static").filter(path=>/\.(js|css|map)$/.test(path)),...files("src"),...files("docs"),...files("artifacts")].filter(path=>/\.(js|css|map|ts|tsx|md|json|mjs|sql)$/.test(path));
const secretMatches=examined.filter(path=>{const content=readFileSync(path,"utf8").toLowerCase();return privateValues.some(value=>content.includes(value.toLowerCase()));});
const pages=[];
for(const path of ["/login","/signup","/verify-email","/testing/registration"]){
  const response=await fetch(`http://127.0.0.1:3000${path}`,{signal:AbortSignal.timeout(20000)}),body=(await response.text()).toLowerCase();
  pages.push({path,status:response.status,privateValueExposed:privateValues.some(value=>body.includes(value.toLowerCase())),uncacheable:response.headers.get("cache-control")?.includes("no-store")===true});
}
const productionGuide=await fetch("http://127.0.0.1:3001/testing/registration",{signal:AbortSignal.timeout(20000)});
const passed=landingChanged.length===0&&secretMatches.length===0&&pages.every(page=>page.status===200&&!page.privateValueExposed&&page.uncacheable)&&productionGuide.status===404;
writeFileSync("artifacts/auth-refresh-audit.json",JSON.stringify({executedAt:new Date().toISOString(),landingFilesPreserved:Object.keys(fingerprints).length,landingChanged,examinedFiles:examined.length,secretMatchFiles:secretMatches,publicPages:pages,productionGuideStatus:productionGuide.status,passed},null,2));
console.log(JSON.stringify({landingFilesPreserved:Object.keys(fingerprints).length,landingChanged:landingChanged.length,examinedFiles:examined.length,privateValuesExposed:secretMatches.length+pages.filter(p=>p.privateValueExposed).length,productionGuideStatus:productionGuide.status,passed}));
if(!passed)process.exitCode=1;
