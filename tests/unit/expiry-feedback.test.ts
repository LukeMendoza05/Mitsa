import {expect,it} from 'vitest';
import {expiryDiagnosticMessage} from '../../src/lib/auth/expiry-feedback';
it('reports only an explicit provider expiry rejection as the passing expiry result',()=>{
 expect(expiryDiagnosticMessage(200,{expiredRejected:true,reason:'provider-expired-or-duplicate'})).toBe('Expired proof was rejected. No account was created.');
 for(const value of [null,{expiredRejected:true},{expiredRejected:true,reason:'provider-invalid-token'},{expiredRejected:false,reason:'server-expired'}])expect(expiryDiagnosticMessage(200,value)).not.toBe('Expired proof was rejected. No account was created.');
 expect(expiryDiagnosticMessage(503,{expiredRejected:true,reason:'provider-expired-or-duplicate'})).not.toBe('Expired proof was rejected. No account was created.');
});
it('distinguishes provider invalidity, server freshness, local input loss, network and HTTP errors without echoing raw data',()=>{
 expect(expiryDiagnosticMessage(403,{reason:'provider-invalid-token'})).toContain('invalid-input-response');
 expect(expiryDiagnosticMessage(403,{reason:'server-expired'})).toContain('server expiry check');
 expect(expiryDiagnosticMessage(403,{reason:'local-input'})).toContain('no usable held proof');
 expect(expiryDiagnosticMessage(503,{reason:'provider-network'})).toContain('could not reach Cloudflare');
 expect(expiryDiagnosticMessage(403,{error:'private value'})).toBe('The expiry request returned HTTP 403. No explicit Cloudflare expiry rejection was confirmed.');
});
