// Inactive bounded test entry point. A new private approval record is required.
// --check is local-only; --run never creates authorization or enables controls.
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {registrationMailTestScope,guardMailTestWorker} from './lib/registration-mail-test-scope.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
try{
 const check=process.argv.length===3&&process.argv[2]==='--check';
 const run=process.argv.length===5&&process.argv[2]==='--run'&&process.argv[3]==='--minutes';
 if(!check&&!run)throw Error('scope');
 const reviewBytes=readFileSync('config/registration-completion-review.json'),review=JSON.parse(String(reviewBytes));
 for(const file of review.sources)if(hash(readFileSync(file.path))!==file.sha256)throw Error('source drift');
 const fixtureBytes=readFileSync('.secrets/registration-completion/fixtures.json');
 if(hash(fixtureBytes)!==review.privateFixtures.sha256)throw Error('fixture drift');
 const path='.secrets/registration-completion/mail-test-authorization.json';
 if(check){console.log(JSON.stringify({status:'Bounded worker source/fixture check passed',authorizationPresent:existsSync(path),networkRequests:0,databaseWrites:0,smtpConnections:0}));}
 else{
  const minutes=Number(process.argv[4]);if(!Number.isInteger(minutes)||minutes<1||minutes>90)throw Error('runtime');
  // Reading a missing/unapproved record stops BEFORE DB, DPAPI or SMTP access.
  const authorization=JSON.parse(readFileSync(path,'utf8'));
  const scope=registrationMailTestScope({root:resolve('.secrets/registration-completion/mail-test-ledger'),reviewBytes,fixtureBytes,authorization});
  const lease=scope.reserveWorker(minutes);
  const {persistentRegistrationWorker}=await import('./persistent-registration-worker.mjs');
  await persistentRegistrationWorker({run:true,guardFactory:dependencies=>{
   if(dependencies.generation!==review.reviewId)throw Error('generation');
   return guardMailTestWorker(scope,lease,{transportReady:dependencies.transportReady,send:dependencies.send,
    sectionForJob:job=>{
     // Private operator mapping must be prepared from the APPROVED dispatch
     // result before its provider request. Missing/mismatched jobs fail closed.
     const jobs=JSON.parse(readFileSync('.secrets/registration-completion/mail-test-jobs.json','utf8'));
     const matches=jobs.filter(value=>value.dispatchId===job.id&&value.recipientHash===job.recipientHash);
     if(matches.length!==1)throw Error('job binding');return matches[0].section;
    }
   });
  }});
 }
}catch{console.error('Bounded worker unavailable; no approval or budget was renewed. Private details suppressed.');process.exitCode=1;}
