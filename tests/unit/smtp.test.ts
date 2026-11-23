import {describe,it,expect,beforeEach,vi} from "vitest";
const mocks=vi.hoisted(()=>({transport:vi.fn(),send:vi.fn(),close:vi.fn()}));
vi.mock('server-only',()=>({}));vi.mock('nodemailer',()=>({default:{createTransport:mocks.transport}}));
import {deliverSignupCodeWithGmail,deliverRecoveryWithGmail} from '../../src/lib/mail/smtp';
import {emailVerificationCodeLength} from '../../src/lib/auth/email-code-settings';
const now=Date.now(),recipient='synthetic-smtp@example.com';
const input=()=>({message:{eventKey:'synthetic-event',recipient,providerCode:'1'.repeat(emailVerificationCodeLength),providerTokenHash:'a'.repeat(64),issuedAt:now-1000},
 authorization:{externalMailEnabled:true,senderApproved:true,approvedSender:'synthetic-sender@gmail.com',approvedOrigin:'http://127.0.0.1:3000',providerExpirySeconds:3600},
 appPassword:'a'.repeat(16),authorizeAndClaim:vi.fn().mockResolvedValue(true)});
beforeEach(()=>{vi.clearAllMocks();mocks.transport.mockReturnValue({sendMail:mocks.send,close:mocks.close});mocks.send.mockResolvedValue({accepted:[recipient],rejected:[]});});
describe('Inactive Gmail SMTP adapter; all SMTP is mocked',()=>{
 it('fails closed before authorization or transport for closed gates and missing credentials',async()=>{
  for(const change of [{externalMailEnabled:false},{senderApproved:false},{approvedSender:'other@example.com'}]){const value=input();value.authorization={...value.authorization,...change};await expect(deliverSignupCodeWithGmail(value,now)).rejects.toThrow('External mail is not authorized');expect(value.authorizeAndClaim).not.toHaveBeenCalled();}
  await expect(deliverSignupCodeWithGmail({...input(),appPassword:''},now)).rejects.toThrow();expect(mocks.transport).not.toHaveBeenCalled();
 });
 it('rejects alternate-length/expired codes, injected links and capture-only recipients',async()=>{
  for(const change of [{providerCode:'1'.repeat(emailVerificationCodeLength===6?8:6)},{providerCode:'<script>'},{issuedAt:now-3600000},{recipient:'foundation-capture@example.invalid'},{providerTokenHash:'a&injected=1'}])await expect(deliverSignupCodeWithGmail({...input(),message:{...input().message,...change}},now)).rejects.toThrow();
  await expect(deliverSignupCodeWithGmail({...input(),authorization:{...input().authorization,approvedOrigin:'https://example.com/path'}},now)).rejects.toThrow();expect(mocks.transport).not.toHaveBeenCalled();
 });
 it('requires durable authorization/claim before any network connection',async()=>{
  for(const callback of [vi.fn().mockResolvedValue(false),vi.fn().mockRejectedValue(Error('private DB detail'))])await expect(deliverSignupCodeWithGmail({...input(),authorizeAndClaim:callback},now)).rejects.toThrow(/Delivery/);
  expect(mocks.transport).not.toHaveBeenCalled();
 });
 it('uses validated provider values, actual supplied expiry, branded MIME parts and TLS without logging',async()=>{
  const value=input();expect(await deliverSignupCodeWithGmail(value,now)).toEqual({status:'smtp-accepted'});
  expect(value.authorizeAndClaim).toHaveBeenCalledWith('synthetic-event',recipient);
  expect(mocks.transport).toHaveBeenCalledWith(expect.objectContaining({host:'smtp.gmail.com',port:465,secure:true,logger:false,debug:false,transactionLog:false,disableFileAccess:true,disableUrlAccess:true,maxRecipients:1,tls:expect.objectContaining({rejectUnauthorized:true,minVersion:'TLSv1.2'})}));
  const mail=mocks.send.mock.calls[0][0];expect(mail.from).toEqual({name:'Mitsa',address:'synthetic-sender@gmail.com'});expect(mail.envelope.to).toEqual([recipient]);expect(mail.html).toContain('1'.repeat(emailVerificationCodeLength));expect(mail.text).toContain('60 minutes');expect(mail.html).not.toContain('{{ .Token }}');expect(mocks.close).toHaveBeenCalledOnce();
 });
 it('suppresses private SMTP errors, closes transport and never automatically retries uncertainty',async()=>{
  mocks.send.mockRejectedValue(Error('private email and authentication detail'));
  await expect(deliverSignupCodeWithGmail(input(),now)).rejects.toThrow('Email delivery unconfirmed; automatic retry is unsafe');expect(mocks.send).toHaveBeenCalledOnce();expect(mocks.close).toHaveBeenCalledOnce();
 });
 it('retains only bounded SMTP categories and response codes for private failures',async()=>{
  mocks.send.mockRejectedValue(Object.assign(Error('private email password and provider detail'),{code:'EAUTH',responseCode:535,response:'private response'}));
  let caught:unknown;try{await deliverSignupCodeWithGmail(input(),now);}catch(error){caught=error;}
  expect(caught).toMatchObject({message:'Email delivery unconfirmed; automatic retry is unsafe',deliveryFailure:'authentication',smtpResponseCode:535});expect(JSON.stringify(caught)).not.toContain('private');
 });
 it('renders a purpose-bound Mitsa recovery link only after the same durable claim, without weakening signup code validation',async()=>{
  const value=input();expect(await deliverRecoveryWithGmail(value,now)).toEqual({status:'smtp-accepted'});
  expect(value.authorizeAndClaim).toHaveBeenCalledOnce();const mail=mocks.send.mock.calls[0][0];
  expect(mail.subject).toBe('Reset your Mitsa password');expect(mail.text).toContain('type=recovery');expect(mail.text).toContain('Your authenticator is still required');
  expect(mail.text).not.toContain('1'.repeat(emailVerificationCodeLength));
 });
});
