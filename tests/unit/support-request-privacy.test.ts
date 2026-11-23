import {it, expect} from 'vitest';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectSupportText,inspectSupportFollowUpStructure} from '../../scripts/lib/support-request-privacy.mjs';

const followUp=readFileSync(new URL('../../docs/support/supabase-refresh-reuse-follow-up.txt',import.meta.url),'utf8');
it('the prepared follow-up uses all nine sections and stays below 300 words',()=>{
 expect(inspectSupportFollowUpStructure(followUp)).toMatchObject({passed:true,categories:[]});
 expect(inspectSupportText(followUp)).toEqual({passed:true,categories:[]});
});
it.each([
 (text:string)=>text.replace('Impact\n',''),
 (text:string)=>text.replace('Summary\n','Request\n'),
 (text:string)=>`${text}\nEvidence\nDuplicate section.`,
])('rejects missing, reordered or duplicated support sections (%#)',mutate=>{
 expect(inspectSupportFollowUpStructure(mutate(followUp))).toMatchObject({passed:false,categories:['section-order']});
});
it('rejects empty sections and an overlong follow-up',()=>{
 expect(inspectSupportFollowUpStructure(followUp.replace(/Impact\n[\s\S]*?\nExpected behaviour/u,'Impact\n\nExpected behaviour'))).toMatchObject({passed:false,categories:['empty-section']});
 expect(inspectSupportFollowUpStructure(`${followUp}\n${'extra '.repeat(300)}`)).toMatchObject({passed:false,categories:['word-limit']});
});

it('accepts conceptual labels, public source commits and non-secret settings', () => {
 expect(inspectSupportText('R0 -> R3; HTTP 400; 3600 seconds; reuse 10 seconds; commit 4eee58f296d9698a1c2c0ae14d7a0b379c7622d3')).toEqual({passed: true, categories: []});
});
it.each([
 'fixture@example.invalid',
 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.syntheticSignatureFixture',
 'sb_secret_syntheticFixtureKey',
 '12345678-1234-1234-1234-123456789abc',
 '123456',
 'a'.repeat(64),
 'fixture.supabase.co',
 '-----BEGIN PGP PRIVATE KEY BLOCK-----',
 'postgres://fixture:syntheticPassword@localhost/db',
])('rejects sensitive patterns without returning matched content (%#)', value => {
 const result = inspectSupportText(value);
 expect(result.passed).toBe(false);
 expect(JSON.stringify(result)).not.toContain(value);
});
it('catches known private values despite case or invisible-character changes', () => {
 const secret = 'SyntheticPrivateValue';
 for (const text of ['SYNTHETICPRIVATEVALUE', 'Synthetic\u200bPrivateValue']) {
  expect(inspectSupportText(text, [secret])).toEqual({passed: false, categories: ['known-private-value']});
 }
});
it('the actual CLI fails closed without private context and never prints injected values', () => {
 const root = mkdtempSync(join(tmpdir(), 'mitsa-support-review-'));
 mkdirSync(join(root, 'docs', 'support'), {recursive: true});
 writeFileSync(join(root, 'docs', 'support', 'supabase-refresh-reuse-request.txt'), 'Synthetic public report.');
 writeFileSync(join(root, 'docs', 'supabase-refresh-reuse-reproduction.md'), 'Synthetic public evidence.');
 const script = fileURLToPath(new URL('../../scripts/verify-supabase-support-request.mjs', import.meta.url));
 const run = () => spawnSync(process.execPath, [script], {cwd: root, encoding: 'utf8', env: {PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'test'}});
 let result = run();
 expect(result.status).toBe(1); expect(JSON.parse(result.stdout).completePrivateContext).toBe(false);
 mkdirSync(join(root, '.secrets'));
 const key = 'synthetic-private-operator-key';
 writeFileSync(join(root, '.env.local'), 'AUTH_FLOW_KEY=synthetic-private-flow-key\n');
 writeFileSync(join(root, '.secrets', 'operator.env'), `TEST_SERVICE_KEY=${key}\n`);
 writeFileSync(join(root, '.secrets', 'developer-registration.json'), JSON.stringify({email: 'developer@example.invalid'}));
 writeFileSync(join(root, '.secrets', 'onboarding-recipient.json'), JSON.stringify({email: 'onboarding@example.invalid'}));
 result = run(); expect(result.status).toBe(0); expect(JSON.parse(result.stdout).passed).toBe(true);
 const original = readFileSync(join(root, '.env.local'), 'utf8');
 const followUpPath=join(root,'docs','support','supabase-refresh-reuse-follow-up.txt');
 const runFollowUp=()=>spawnSync(process.execPath,[script,'--follow-up'],{cwd:root,encoding:'utf8',env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,NODE_ENV:'test'}});
 writeFileSync(followUpPath,followUp);
 result=runFollowUp();expect(result.status).toBe(0);expect(JSON.parse(result.stdout).structure.passed).toBe(true);
 writeFileSync(followUpPath,`${followUp}\n${key}`);
 result=runFollowUp();expect(result.status).toBe(1);expect(JSON.parse(result.stdout).files[0].categories).toContain('known-private-value');expect(result.stdout+result.stderr).not.toContain(key);
 writeFileSync(join(root, 'docs', 'support', 'supabase-refresh-reuse-request.txt'), `Synthetic report ${key}`);
 result = run(); expect(result.status).toBe(1); expect(JSON.parse(result.stdout).files[0].categories).toContain('known-private-value');
 expect(result.stdout + result.stderr).not.toContain(key);
 expect(readFileSync(join(root, '.env.local'), 'utf8')).toBe(original);
 writeFileSync(join(root, '.secrets', 'developer-registration.json'), '{malformed-private-fixture');
 result = run(); expect(result.status).toBe(1); expect(result.stdout + result.stderr).not.toContain('malformed-private-fixture');
});
