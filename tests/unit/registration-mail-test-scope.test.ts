import {it,expect} from 'vitest';
import {mkdtempSync,readFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {registrationMailTestScope,guardMailTestWorker} from '../../scripts/lib/registration-mail-test-scope.mjs';
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
function fixture(sections=['C3B','D','E','F']){
 let now=Date.parse('2026-10-24T00:00:00Z');const root=mkdtempSync(join(tmpdir(),'mitsa-mail-scope-'));
 const project='mjtejwafxriwntweussc',reviewId=randomUUID();
 const fixtureBytes=Buffer.from(JSON.stringify({project,reviewId,fixtures:['c3b-a','c3b-b','e-a','e-b'].map(label=>({label,email:`${label}@example.invalid`}))}));
 const reviewBytes=Buffer.from(JSON.stringify({project,reviewId,privateFixtures:{sha256:sha(fixtureBytes)},sections:{D:{externalEmailsAggregate:14,smtpVerifyConnections:12,workerLaunches:5,workerRuntimeMinutesAggregate:300},C3B:{fixtures:['c3b-a','c3b-b'],externalEmailsWithinD:6},E:{fixtures:['e-a','e-b'],externalEmailsWithinD:6},F:{fixtures:['c3b-b','e-a','e-b'],externalEmailsWithinD:2}}}));
 const authorization={approved:true,project,reviewId,reviewSha256:sha(reviewBytes),sections,notBefore:new Date(now).toISOString(),notAfter:new Date(now+86400000).toISOString()};
 const open=()=>registrationMailTestScope({root,reviewBytes,fixtureBytes,authorization,now:()=>now});
 const mail=(scope:ReturnType<typeof open>,lease:unknown,section='C3B',label='c3b-a',jobId=randomUUID())=>scope.reserveMail(lease,{section,recipientHash:sha(`${label}@example.invalid`),jobId});
 return {root,reviewBytes,fixtureBytes,authorization,open,mail,advance:(ms=61000)=>{now+=ms;}};
}
it('rejects absent approval and source/fixture drift without any network work',()=>{
 const f=fixture();expect(()=>registrationMailTestScope({root:f.root,reviewBytes:f.reviewBytes,fixtureBytes:f.fixtureBytes,authorization:{...f.authorization,approved:false}})).toThrow('SCOPE_NOT_APPROVED');
 expect(()=>registrationMailTestScope({root:f.root,reviewBytes:Buffer.from('{}'),fixtureBytes:f.fixtureBytes,authorization:f.authorization})).toThrow();
});
it('binds every lease to its process instance and respects approval and runtime expiry',()=>{
 const f=fixture(),a=f.open(),lease=a.reserveWorker(1);f.mail(a,lease);const b=f.open();
 expect(()=>f.mail(b,lease)).toThrow('SCOPE_WORKER_LEASE_EXPIRED');f.advance();expect(()=>a.reserveVerification(lease)).toThrow('SCOPE_WORKER_LEASE_EXPIRED');
 f.advance(86400000);expect(()=>f.open()).toThrow('SCOPE_EXPIRED_OR_NOT_STARTED');
});
it('enforces recipients, independently selected sections and sixty-second cooldowns',()=>{
 const f=fixture(['D','C3B']),s=f.open(),lease=s.reserveWorker(20);
 expect(()=>f.mail(s,lease,'E','e-a')).toThrow('SCOPE_SECTION_NOT_APPROVED');
 expect(()=>f.mail(s,lease,'C3B','e-a')).toThrow('SCOPE_RECIPIENT_NOT_APPROVED');
 f.mail(s,lease);expect(()=>f.mail(s,lease)).toThrow('SCOPE_RECIPIENT_COOLDOWN');f.advance();expect(()=>f.mail(s,lease)).not.toThrow();
});
it('retains uncertain claims over restart and refuses exact-job replay after cooldown',()=>{
 const f=fixture(),first=f.open(),job=randomUUID();f.mail(first,first.reserveWorker(10),'C3B','c3b-a',job);
 f.advance();const next=f.open();expect(()=>f.mail(next,next.reserveWorker(10),'C3B','c3b-a',job)).toThrow('SCOPE_JOB_ALREADY_CLAIMED');
});
it('enforces phase caps and the shared fourteen-message ceiling across instances',()=>{
 const f=fixture(),s=f.open(),lease=s.reserveWorker(30);
 for(const [section,label,max] of [['C3B','c3b-a',6],['E','e-a',6],['F','e-b',2]] as const){
  for(let n=0;n<max;n++){f.mail(s,lease,section,label);f.advance();}
  expect(()=>f.mail(s,lease,section,label)).toThrow('SCOPE_BUDGET_EXHAUSTED');
 }
 const other=f.open();expect(()=>f.mail(other,other.reserveWorker(30),'F','e-b')).toThrow('SCOPE_BUDGET_EXHAUSTED');
});
it('bounds transport verification, worker launches and reserved runtime separately',()=>{
 const f=fixture(),s=f.open(),lease=s.reserveWorker(100);
 for(let n=0;n<12;n++)s.reserveVerification(lease);expect(()=>s.reserveVerification(lease)).toThrow('SCOPE_BUDGET_EXHAUSTED');
 s.reserveWorker(100);s.reserveWorker(100);expect(()=>s.reserveWorker(1)).toThrow('SCOPE_RUNTIME_EXHAUSTED');
 const g=fixture(),t=g.open();for(let n=0;n<5;n++)t.reserveWorker(1);expect(()=>t.reserveWorker(1)).toThrow('SCOPE_BUDGET_EXHAUSTED');
});
it('fails closed on incomplete claims and locks instead of silently resetting capacity',()=>{
 const f=fixture();f.open();mkdirSync(join(f.root,'mail-001'));expect(()=>f.open()).toThrow('SCOPE_CLAIM_UNCONFIRMED');
 const g=fixture(),s=g.open(),lease=s.reserveWorker(1);mkdirSync(join(g.root,'mail-reservation-lock'));expect(()=>g.mail(s,lease)).toThrow('SCOPE_BUSY_OR_RECONCILIATION_REQUIRED');
});
it('keeps shared counts when a separately approved section is added to the same review',()=>{
 const f=fixture(['C3B','D']),first=f.open(),lease=first.reserveWorker(20);
 for(let n=0;n<6;n++){f.mail(first,lease);f.advance();}
 f.authorization.sections=['C3B','D','E'];const next=f.open(),nextLease=next.reserveWorker(20);
 expect(()=>f.mail(next,nextLease)).toThrow('SCOPE_BUDGET_EXHAUSTED');
 expect(()=>f.mail(next,nextLease,'E','e-a')).not.toThrow();
 const binding=JSON.parse(readFileSync(join(f.root,'binding.json'),'utf8'));expect(binding).not.toHaveProperty('email');
});
it('wraps actual worker hooks without sending after scope exhaustion or faking SMTP success',async()=>{
 const f=fixture(),scope=f.open(),lease=scope.reserveWorker(30);let probes=0,sends=0;
 const hooks=guardMailTestWorker(scope,lease,{transportReady:async()=>{probes++;return true;},send:async(_job:unknown,authorize:()=>Promise<boolean>)=>{expect(await authorize()).toBe(true);sends++;},sectionForJob:()=> 'C3B'});
 expect(await hooks.transportReady()).toBe(true);
 for(let n=0;n<6;n++){await hooks.send({id:randomUUID(),recipientHash:sha('c3b-a@example.invalid')},async()=>true);f.advance();}
 await expect(hooks.send({id:randomUUID(),recipientHash:sha('c3b-a@example.invalid')},async()=>true)).rejects.toThrow('SCOPE_BUDGET_EXHAUSTED');
 expect(hooks.isActive()).toBe(false);expect(await hooks.transportReady()).toBe(false);expect(probes).toBe(1);expect(sends).toBe(6);
});
