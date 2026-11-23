// LOCAL ONLY. No environment secrets, sockets, credentials or database access.
import {readFileSync} from 'node:fs';
import {assessPublicRegistration} from './lib/public-registration-readiness.mjs';
if(process.argv.length!==3||process.argv[2]!=='--check'){
 console.error('Only --check is supported; this command cannot activate or deploy.');process.exitCode=1;
}else{
 const input=JSON.parse(readFileSync('config/public-registration-release.json','utf8'));
 console.log(JSON.stringify(assessPublicRegistration(input),null,2));
}
