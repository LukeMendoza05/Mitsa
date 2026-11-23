// Operator-only restriction for the first real delivery test. The private
// manifest is created only after human approval; it does not open DB gates.
export function pilotTestApproval(value:unknown,window:{approved_at:unknown;expires_at:unknown;approved_sender_sha256:unknown},senderHash:string,codeLength:number,now=Date.now()) {
 const a=value as Record<string,unknown>|null;
 const start=Date.parse(String(a?.approvedAt)),end=Date.parse(String(a?.expiresAt));
 const timestamp=(value:unknown)=>value instanceof Date?value.getTime():Date.parse(String(value));
 const existing=a?.existingIdentity as {userId?:unknown;intentId?:unknown}|undefined;
 const finish=a?.purpose==='dedicated-sender-self-test-finish',resumed=a?.purpose==='dedicated-sender-self-test-resume'||finish;
 const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
 if(!a||a.project!=="mjtejwafxriwntweussc"||a.origin!=="http://127.0.0.1:3000"||
  (resumed?(!existing||!uuid(existing.userId)||!uuid(existing.intentId)):(a.purpose!=="dedicated-sender-self-test"||existing!==undefined))||a.maxAttempts!==3||a.codeLength!==codeLength||a.expirySeconds!==3600||
  (finish?(a.remainingAttempts!==1||typeof a.previousCaptureId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(a.previousCaptureId)):(a.remainingAttempts!==undefined||a.previousCaptureId!==undefined))||
  !/^[a-f0-9]{64}$/.test(senderHash)||a.senderHash!==senderHash||a.recipientHash!==senderHash||
  window.approved_sender_sha256!==senderHash||!Number.isFinite(start)||!Number.isFinite(end)||
  start>now||end<=now+30000||end-start>30*60000||end<=start||
  timestamp(window.approved_at)!==start||timestamp(window.expires_at)!==end)throw Error("Controlled delivery approval unavailable");
 return {recipientHash:senderHash,maxAttempts:3 as const,approvedAtMs:start,expiresAtMs:end,...(resumed?{existingIdentity:{userId:existing!.userId as string,intentId:existing!.intentId as string}}:{}),...(finish?{remainingAttempts:1 as const,previousCaptureId:a.previousCaptureId as string}:{})};
}
