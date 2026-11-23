export function expiryDiagnosticMessage(status:number,result:unknown) {
 const body=typeof result==='object'&&result!==null?result as Record<string,unknown>:null;
 if(status===403&&body?.error==='Request origin rejected')return 'The request origin was rejected before Cloudflare verification. Reopen http://127.0.0.1:3000/testing/registration and retry. No expiry result was obtained.';
 if(status===404)return 'The local diagnostic is unavailable in the current application mode. No Cloudflare expiry result was obtained.';
 if(status===200&&body?.expiredRejected===true&&body.reason==='provider-expired-or-duplicate')return 'Expired proof was rejected. No account was created.';
 switch(body?.reason){
  case 'provider-invalid-token':return 'Cloudflare rejected the held proof as invalid-input-response (invalid, malformed, or expired). Expiration-specific rejection is not confirmed. No account was created.';
  case 'server-expired':return 'Mitsa rejected the proof using its server expiry check. Cloudflare did not report expiration. No account was created.';
  case 'verified':return 'Cloudflare accepted the held proof. Expiration rejection did not pass. No account was created.';
  case 'provider-network':return 'The server could not reach Cloudflare or the request timed out. Expiration rejection is not confirmed.';
  case 'provider-http':case 'provider-internal':return 'Cloudflare verification was unavailable. Expiration rejection is not confirmed.';
  case 'provider-secret':return 'Cloudflare rejected the server configuration. Expiration rejection is not confirmed.';
  case 'provider-response':return 'Cloudflare returned an unreadable or unexpected response. Expiration rejection is not confirmed.';
  case 'local-input':return 'The server received no usable held proof. No Cloudflare expiry result was obtained.';
  case 'hostname':case 'action':case 'timestamp':return 'Mitsa rejected the proof’s hostname, action or timestamp. Expiration-specific rejection is not confirmed.';
 }
 return `The expiry request returned HTTP ${status}. No explicit Cloudflare expiry rejection was confirmed.`;
}
