// Local-only review. No provider client, network, clipboard or authentication.
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parse} from 'dotenv';
import {inspectSupportText,inspectSupportFollowUpStructure} from './lib/support-request-privacy.mjs';

try {
 const args=process.argv.slice(2);
 if (args.length>1 || args.length===1&&args[0]!=='--follow-up') throw Error('Unsupported arguments');
 const followUp=args[0]==='--follow-up';
 const sources = ['.env.local', '.secrets/operator.env', '.secrets/developer-registration.json', '.secrets/onboarding-recipient.json'];
 const privateValues = ['mjtejwafxriwntweussc', 'fireworks-foundation-proof-01a12e38', 'D Extacy Fireworks', 'L.F Fireworks'];
 let readable = 0;
 for (const path of sources) {
  if (!existsSync(path)) continue;
  const raw = readFileSync(path, 'utf8');
  if (path.endsWith('.json')) {
   const value = JSON.parse(raw);
   if (typeof value.email !== 'string' || value.email.length < 8) throw Error('Private context malformed');
   privateValues.push(value.email);
  } else {
   for (const [key, value] of Object.entries(parse(raw))) {
    if (/key|secret|password|token|email|database|supabase_url|project_ref/i.test(key) && value.length >= 8) privateValues.push(value);
   }
  }
  readable++;
 }
 const paths=followUp?['docs/support/supabase-refresh-reuse-follow-up.txt']:['docs/support/supabase-refresh-reuse-request.txt', 'docs/supabase-refresh-reuse-reproduction.md'];
 const files = paths.map(path => {
  const raw = readFileSync(path, 'utf8');
  return {path, sha256: createHash('sha256').update(raw).digest('hex'), ...inspectSupportText(raw, privateValues)};
 });
 const structure=followUp?inspectSupportFollowUpStructure(readFileSync(paths[0],'utf8')):null;
 const completePrivateContext = readable === sources.length;
 const passed = completePrivateContext && files.every(file => file.passed) && (!structure||structure.passed);
 console.log(JSON.stringify({checkedAt: new Date().toISOString(), passed, completePrivateContext, files,structure,
  scope: 'Known local values and bounded patterns only; manual review still required. Not an upload authorization.',
  networkRequests: 0, providerChanges: 0, externalSubmissions: 0, privateValuesPrinted: false}));
 if (!passed) process.exitCode = 1;
} catch {
 console.error('Support request review unavailable. No private details printed; no submission or provider change.');
 process.exitCode = 1;
}
