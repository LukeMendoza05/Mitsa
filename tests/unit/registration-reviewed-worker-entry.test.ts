import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const entry=resolve('scripts/persistent-registration-worker-review.mjs');
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'mitsa-reviewed-worker-'));
 mkdirSync(join(root,'config'));mkdirSync(join(root,'.secrets/registration-completion'),{recursive:true});
 const fixtures=JSON.stringify({fixtures:[]});writeFileSync(join(root,'.secrets/registration-completion/fixtures.json'),fixtures);
 writeFileSync(join(root,'dummy-source.txt'),'inert fixture');
 writeFileSync(join(root,'config/registration-completion-review.json'),JSON.stringify({sources:[{path:'dummy-source.txt',sha256:hash('inert fixture')}],privateFixtures:{sha256:hash(fixtures)}}));
 return root;
}
it('importing the existing worker does not read credentials or start the operator',()=>{
 const root=fixture(),url=pathToFileURL(resolve('scripts/persistent-registration-worker.mjs')).href;
 const result=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(url)});console.log('import-safe');`],{cwd:root,encoding:'utf8',windowsHide:true,timeout:10000});
 expect(result.status).toBe(0);expect(result.stdout.trim()).toBe('import-safe');expect(result.stderr).not.toContain('Worker unavailable');
});
it('local check verifies files with no authorization, database or SMTP configuration',()=>{
 const root=fixture(),result=spawnSync(process.execPath,[entry,'--check'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:10000});
 expect(result.status).toBe(0);expect(JSON.parse(result.stdout)).toMatchObject({authorizationPresent:false,networkRequests:0,databaseWrites:0,smtpConnections:0});
});
it('run without fresh approval stops before operator credentials or network access',()=>{
 const root=fixture(),result=spawnSync(process.execPath,[entry,'--run','--minutes','1'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:10000});
 expect(result.status).toBe(1);expect(result.stdout).toBe('');expect(result.stderr.trim()).toBe('Bounded worker unavailable; no approval or budget was renewed. Private details suppressed.');
});
it('source drift fails closed before creating a ledger or loading credentials',()=>{
 const root=fixture();writeFileSync(join(root,'dummy-source.txt'),'changed');
 const result=spawnSync(process.execPath,[entry,'--run','--minutes','1'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:10000});
 expect(result.status).toBe(1);expect(result.stdout).toBe('');expect(result.stderr).not.toContain('changed');
});
