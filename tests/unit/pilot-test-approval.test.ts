import {describe,it,expect} from 'vitest';
import {pilotTestApproval} from '../../scripts/lib/pilot-test-approval';
const now=Date.UTC(2026,9,14,0,0,0,123),senderHash='a'.repeat(64),start=new Date(now-1000).toISOString(),end=new Date(now+20*60000).toISOString();
const approval={project:'mjtejwafxriwntweussc',origin:'http://127.0.0.1:3000',purpose:'dedicated-sender-self-test',maxAttempts:3,codeLength:6,expirySeconds:3600,senderHash,recipientHash:senderHash,approvedAt:start,expiresAt:end};
const window={approved_at:start,expires_at:end,approved_sender_sha256:senderHash};
describe('First controlled Gmail test scope; no SMTP connections',()=>{
 it('requires the one-message completion limit and exact previous capture in its distinct scope',()=>{
  const a={...approval,purpose:'dedicated-sender-self-test-finish',existingIdentity:{userId:crypto.randomUUID(),intentId:crypto.randomUUID()},remainingAttempts:1,previousCaptureId:'exact-prior-capture'};
  expect(pilotTestApproval(a,window,senderHash,6,now).remainingAttempts).toBe(1);
  for(const change of [{remainingAttempts:2},{remainingAttempts:undefined},{previousCaptureId:undefined},{previousCaptureId:'bad value'},{purpose:'dedicated-sender-self-test-resume'},{existingIdentity:undefined}])expect(()=>pilotTestApproval({...a,...change},window,senderHash,6,now)).toThrow();
 });
 it('requires a matching bounded approval and binds delivery to the dedicated sender itself',()=>{expect(pilotTestApproval(approval,window,senderHash,6,now)).toEqual({recipientHash:senderHash,maxAttempts:3,approvedAtMs:Date.parse(start),expiresAtMs:Date.parse(end)});});
 it('preserves millisecond precision when pg returns Date objects for the approved window',()=>{expect(pilotTestApproval(approval,{...window,approved_at:new Date(start),expires_at:new Date(end)},senderHash,6,now)).toEqual({recipientHash:senderHash,maxAttempts:3,approvedAtMs:Date.parse(start),expiresAtMs:Date.parse(end)});});
 it('fails closed for missing approval, wrong project/recipient/length, excess scope and expiry',()=>{
  for(const value of [null,{},...([{project:'other'},{origin:'https://attacker.invalid'},{recipientHash:'b'.repeat(64)},{senderHash:'b'.repeat(64)},{maxAttempts:4},{codeLength:8},{expirySeconds:600},{approvedAt:new Date(now+1000).toISOString()},{expiresAt:new Date(now+31*60000).toISOString()},{expiresAt:new Date(now-1).toISOString()}].map(change=>({...approval,...change})))])expect(()=>pilotTestApproval(value,window,senderHash,6,now)).toThrow('Controlled delivery approval unavailable');
 });
 it('rejects a changed database window or sender even with a previously valid manifest',()=>{for(const change of [{approved_at:new Date(now-2000).toISOString()},{expires_at:new Date(now+25*60000).toISOString()},{approved_sender_sha256:'b'.repeat(64)}])expect(()=>pilotTestApproval(approval,{...window,...change},senderHash,6,now)).toThrow();});
 it('requires a distinct explicit resume scope with both exact synthetic identity and intent IDs',()=>{
  const existingIdentity={userId:crypto.randomUUID(),intentId:crypto.randomUUID()},resumed={...approval,purpose:'dedicated-sender-self-test-resume',existingIdentity};
  expect(pilotTestApproval(resumed,window,senderHash,6,now).existingIdentity).toEqual(existingIdentity);
  for(const value of [{...approval,existingIdentity},{...resumed,existingIdentity:undefined},{...resumed,existingIdentity:{...existingIdentity,intentId:'invalid'}}])expect(()=>pilotTestApproval(value,window,senderHash,6,now)).toThrow();
 });
});
