import {it,expect} from 'vitest';
import {mkdtempSync,existsSync,mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {acceptanceProtocol} from '../../scripts/lib/registration-acceptance-protocol.mjs';
import {finalAcceptanceBudget} from '../../scripts/lib/registration-final-budget.mjs';
function fixture(){const root=join(mkdtempSync(join(tmpdir(),'mitsa-final-budget-')),'ledger'),reviewBytes=Buffer.from(JSON.stringify({project:'mjtejwafxriwntweussc'})),now=Date.now();return {root,stage:'C',reviewBytes,authorization:{approved:true,project:'mjtejwafxriwntweussc',reviewSha256:createHash('sha256').update(reviewBytes).digest('hex'),stage:'C',limits:acceptanceProtocol.C,evidence:'OFFLINE simulated approval only',notBefore:new Date(now-1000).toISOString(),notAfter:new Date(now+60000).toISOString()},preconditions:{security:'strict-proven',transport:true,baseline:true,notices:true,actualRunnerReviewed:true}};}
it('restart cannot refund a failed request, and private request arguments are never journaled',async()=>{
 const f=fixture(),scope=finalAcceptanceBudget(f),call=scope.wrapRequest('authRequests','c3b-a',async()=>{throw Error('fixture failure');});await expect(call('PRIVATE-PASSWORD')).rejects.toThrow();expect(finalAcceptanceBudget(f).counts().authRequests).toBe(1);const contents=readdirSync(f.root).filter(n=>n.endsWith('.json')).map(n=>readFileSync(join(f.root,n),'utf8')).join('');expect(contents).not.toContain('PRIVATE-PASSWORD');
});
it('SQL defaults to write-capable unless its exact reviewed text is certified read-only',async()=>{
 const f=fixture(),scope=finalAcceptanceBudget(f),sql=scope.wrapSql(async()=>({rows:[]}),{reviewedReadOnlySql:new Set(['select 1'])});await sql('select 1');await sql('select private.mutating_function()');expect(scope.counts()).toMatchObject({sqlRequests:2,sqlWriteCalls:1});
});
it('incomplete security or runner prerequisites fail before creating local authority state',()=>{
 const f=fixture();expect(()=>finalAcceptanceBudget({...f,preconditions:{...f.preconditions,security:'strict-unresolved'}})).toThrow();expect(existsSync(f.root)).toBe(false);
});
it('source drift and concurrent or stale locks fail closed without extra reservations',()=>{
 const f=fixture(),scope=finalAcceptanceBudget(f);expect(()=>finalAcceptanceBudget({...f,reviewBytes:Buffer.from('{}')})).toThrow();mkdirSync(join(f.root,'reservation.lock'));expect(()=>scope.reserve('authRequests',{fixture:'c3b-a'})).toThrow();expect(scope.counts()).toEqual({});
});
it('per-stage quota persists across fresh wrapper instances and cannot authorize retained users',()=>{
 const f=fixture();for(let i=0;i<6;i++)finalAcceptanceBudget(f).reserve('emails',{fixture:'c3b-a'});expect(()=>finalAcceptanceBudget(f).reserve('emails',{fixture:'c3b-a'})).toThrow();expect(()=>finalAcceptanceBudget(f).reserve('authRequests',{fixture:'Yuno'})).toThrow();expect(finalAcceptanceBudget(f).counts().emails).toBe(6);
});
