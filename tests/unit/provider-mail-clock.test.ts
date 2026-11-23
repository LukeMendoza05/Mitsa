import {afterEach,expect,it,vi} from 'vitest';
const transport=vi.hoisted(()=>vi.fn());vi.mock('server-only',()=>({}));vi.mock('nodemailer',()=>({default:{createTransport:transport}}));
import {providerMailNow} from '../../scripts/lib/provider-mail-clock';
import {deliverSignupCodeWithGmail} from '../../src/lib/mail/smtp';
afterEach(()=>{vi.restoreAllMocks();transport.mockClear();});
it('uses database time when the worker is behind, without changing issue time or reaching SMTP without a claim',async()=>{
 const local=Date.now(),provider=local+4048,issued=local+1068,claim=vi.fn().mockResolvedValue(false);
 vi.spyOn(performance,'now').mockReturnValue(0);
 const db={query:vi.fn().mockResolvedValue({rows:[{provider_now:new Date(provider)}]})};
 const input={message:{eventKey:'synthetic-skew-capture',recipient:'synthetic-clock@example.com',providerCode:'123456',providerTokenHash:'a'.repeat(64),issuedAt:issued},authorization:{externalMailEnabled:true,senderApproved:true,approvedSender:'synthetic-clock@gmail.com',approvedOrigin:'http://127.0.0.1:3000',providerExpirySeconds:3600},appPassword:'a'.repeat(16),authorizeAndClaim:claim};
 await expect(deliverSignupCodeWithGmail(input,local)).rejects.toThrow('Invalid or expired provider message');expect(claim).not.toHaveBeenCalled();
 const now=await providerMailNow(db);expect(now).toBe(provider);expect(db.query).toHaveBeenCalledWith('select clock_timestamp() as provider_now');
 await expect(deliverSignupCodeWithGmail(input,now)).rejects.toThrow('Delivery is not authorized or was already claimed');expect(claim).toHaveBeenCalledOnce();expect(transport).not.toHaveBeenCalled();expect(input.message.issuedAt).toBe(issued);
 claim.mockClear();
 for(const issueTime of [provider+1,provider-3600000])await expect(deliverSignupCodeWithGmail({...input,message:{...input.message,issuedAt:issueTime}},now)).rejects.toThrow('Invalid or expired provider message');
 expect(claim).not.toHaveBeenCalled();expect(transport).not.toHaveBeenCalled();
});
it('fails closed for missing, invalid or excessively delayed database clock results',async()=>{
 for(const rows of [[],[{provider_now:'2026-10-15T09:00:00Z'}],[{provider_now:new Date(NaN)}]])await expect(providerMailNow({query:vi.fn().mockResolvedValue({rows})})).rejects.toThrow('Provider mail clock unavailable');
 vi.spyOn(performance,'now').mockReturnValueOnce(0).mockReturnValueOnce(5001);
 await expect(providerMailNow({query:vi.fn().mockResolvedValue({rows:[{provider_now:new Date()}]})})).rejects.toThrow('Provider mail clock unavailable');
});
