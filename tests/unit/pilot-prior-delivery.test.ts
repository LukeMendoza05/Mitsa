import {it,expect} from 'vitest';
import {priorPilotDeliveryBinding} from '../../scripts/lib/pilot-prior-delivery.mjs';
const senderHash='a'.repeat(64),userId=crypto.randomUUID(),now=Date.now();
const report={project:'mjtejwafxriwntweussc',scope:'dedicated-sender-self-test-resume',windowClosed:true,failureStage:'normal-browser-resend',attempts:1,smtpAccepted:true,inboxReceipt:'User confirmed first message',actualProviderCodeVerified:false,personalAccountModified:false,publicRegistrationEnabled:false,windowStartedAt:new Date(now-10000).toISOString(),windowExpiresAt:new Date(now+10000).toISOString()};
const row={capture_id:'approved-capture',recipient_hash:senderHash,user_id:userId,state:'smtp-accepted',action:'signup',created_at:new Date(now)};
it('binds only the single received, accepted, closed prior synthetic delivery',()=>{expect(priorPilotDeliveryBinding([row],report,senderHash,userId)).toBe('approved-capture');});
it('rejects uncertainty, another identity, extra attempts and missing receipt',()=>{
 for(const change of [{state:'claimed'},{state:'unconfirmed'},{recipient_hash:'b'.repeat(64)},{user_id:crypto.randomUUID()},{action:'recovery'},{created_at:new Date(now-20000)}])expect(()=>priorPilotDeliveryBinding([{...row,...change}],report,senderHash,userId)).toThrow();
 for(const change of [{windowClosed:false},{attempts:2},{smtpAccepted:false},{inboxReceipt:'Awaiting user confirmation'},{actualProviderCodeVerified:true},{personalAccountModified:true},{publicRegistrationEnabled:true},{failureStage:'unknown'}])expect(()=>priorPilotDeliveryBinding([row],{...report,...change},senderHash,userId)).toThrow();
 for(const rows of [[],[row,row]])expect(()=>priorPilotDeliveryBinding(rows,report,senderHash,userId)).toThrow();
});
