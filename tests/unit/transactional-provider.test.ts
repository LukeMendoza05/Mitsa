import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {submitTransactionalAuthMail} from '../../src/lib/mail/transactional-provider';
const input=()=>({authority:{enabled:true as const,provider:'resend' as const,projectRef:'a'.repeat(20),origin:'https://mitsa.example.com',sender:'security@mail.example.com',verifiedDomain:'mail.example.com',domainVerificationEvidenceSha256:'a'.repeat(64),providerExpirySeconds:3600 as const},
 apiKey:'re_OFFLINE_ONLY_NOT_A_CREDENTIAL',message:{eventId:'10000000-0000-4000-8000-000000000001',projectRef:'a'.repeat(20),action:'signup' as const,recipient:'fixture@example.com',providerCode:'123456',providerTokenHash:'b'.repeat(64),issuedAt:1000,expiresAt:3601000,databaseNow:2000}});
const deps=()=>({submit:vi.fn(async(_request:any)=>({status:200,json:async()=>({id:'10000000-0000-4000-8000-000000000002'})})),claim:vi.fn(async()=>true),stillAuthorized:vi.fn(async()=>true)});
it('submits one provider-issued six-digit branded message with stable idempotency; acceptance is not receipt',async()=>{
 const d=deps(),i=input(),r=await submitTransactionalAuthMail(i,d);expect(r.status).toBe('provider-accepted');expect(r.inboxReceiptConfirmed).toBe(false);expect(d.submit).toHaveBeenCalledTimes(1);
 const request=d.submit.mock.calls[0][0],body=JSON.parse(request.body);expect(request.url).toBe('https://api.resend.com/emails');expect(request.redirect).toBe('error');expect(body.to).toEqual([i.message.recipient]);expect(body.text).toContain('123456');expect(body.text).toContain('60 minutes');expect(body.text).not.toContain('{{');expect(body.from).toBe('Mitsa <security@mail.example.com>');expect(request.headers['idempotency-key']).toMatch(/^mitsa-auth\/[a-f0-9]{64}$/);expect(request.headers['idempotency-key']).not.toContain(i.message.recipient);
 const d2=deps();await submitTransactionalAuthMail(i,d2);expect(d2.submit.mock.calls[0][0].headers['idempotency-key']).toBe(request.headers['idempotency-key']);
});
it('renders provider recovery material through the existing safe template without generating a code',async()=>{
 const i=input(),d=deps();await submitTransactionalAuthMail({...i,message:{...i.message,action:'recovery',providerCode:''}},d);const body=JSON.parse(d.submit.mock.calls[0][0].body);expect(body.text).toContain('/auth/email?type=recovery&token_hash=');expect(body.text).not.toContain('123456');
});
it.each([
 {enabled:false},{verifiedDomain:'gmail.com',sender:'fixture@gmail.com'},{verifiedDomain:'owned.vercel.app',sender:'fixture@owned.vercel.app'},
 {verifiedDomain:'resend.dev',sender:'onboarding@resend.dev'},{sender:'other@unapproved.example.com'},
 {origin:'http://mitsa.example.com'},{origin:'https://127.0.0.1'},{origin:'https://192.168.1.1'},{origin:'https://[::1]'},{origin:'https://app.localhost'},
 {origin:'https://mitsa.example.com/path'},{origin:'https://mitsa.example.com?secret=value'},{domainVerificationEvidenceSha256:''}
])('rejects unapproved authority before claiming or submitting: %j',async change=>{
 const i=input(),d=deps();await expect(submitTransactionalAuthMail({...i,authority:{...i.authority,...change} as any},d)).rejects.toThrow('not authorized');expect(d.claim).not.toHaveBeenCalled();expect(d.submit).not.toHaveBeenCalled();
});
it.each([{projectRef:'b'.repeat(20)},{recipient:'fixture@example.invalid'},{providerCode:'12345678'},{providerCode:'<code>'},{expiresAt:2000},{expiresAt:3602000},{issuedAt:3000},{providerTokenHash:'invalid'}])('rejects mismatched or unusable provider material: %j',async change=>{
 const i=input(),d=deps();await expect(submitTransactionalAuthMail({...i,message:{...i.message,...change}},d)).rejects.toThrow('not authorized');expect(d.claim).not.toHaveBeenCalled();expect(d.submit).not.toHaveBeenCalled();
});
it('denies duplicate claim and emergency closure, including closure after claim',async()=>{
 const d=deps();d.claim.mockResolvedValue(false);await expect(submitTransactionalAuthMail(input(),d)).rejects.toThrow('not authorized');expect(d.submit).not.toHaveBeenCalled();
 const e=deps();e.stillAuthorized.mockResolvedValueOnce(true).mockResolvedValueOnce(false);await expect(submitTransactionalAuthMail(input(),e)).rejects.toThrow('not authorized');expect(e.claim).toHaveBeenCalledTimes(1);expect(e.submit).not.toHaveBeenCalled();
});
it.each([302,401,409,429,503])('retains consumed claim after HTTP %i without retry or response-body disclosure',async status=>{
 const d=deps();d.submit.mockResolvedValue({status,json:async()=>{throw Error('PRIVATE_BODY');}});await expect(submitTransactionalAuthMail(input(),d)).rejects.toThrow('unconfirmed; retain claim');expect(d.submit).toHaveBeenCalledTimes(1);expect(d.claim).toHaveBeenCalledTimes(1);
});
it('sanitizes uncertain transport and authorization exceptions',async()=>{
 const d=deps();d.submit.mockRejectedValue(Error('PRIVATE_CREDENTIAL'));await expect(submitTransactionalAuthMail(input(),d)).rejects.toThrow(/^Transactional delivery unconfirmed; retain claim and do not retry automatically$/);expect(d.submit).toHaveBeenCalledTimes(1);
 const e=deps();e.claim.mockRejectedValue(Error('PRIVATE_RECIPIENT'));await expect(submitTransactionalAuthMail(input(),e)).rejects.toThrow(/^Transactional delivery is not authorized$/);expect(e.submit).not.toHaveBeenCalled();
});
it('refuses an already aborted operation without claiming',async()=>{
 const d=deps();await expect(submitTransactionalAuthMail({...input(),signal:AbortSignal.abort()},d)).rejects.toThrow('not authorized');expect(d.claim).not.toHaveBeenCalled();expect(d.submit).not.toHaveBeenCalled();
});
