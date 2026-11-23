// Test-adapter port only. No default fetch, environment access or import effect.
const project='mjtejwafxriwntweussc';
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const authPaths=new Set(['/auth/v1/settings','/auth/v1/signup','/auth/v1/token','/auth/v1/user','/auth/v1/logout','/auth/v1/recover','/auth/v1/verify','/auth/v1/resend','/auth/v1/reauthenticate','/auth/v1/factors']);
const factorPath=new RegExp(`^/auth/v1/factors/${uuid}(?:/(?:challenge|verify))?$`);
export function onboardingRequestKind(input,init={}){
 let url;try{url=new URL(typeof input==='string'||input instanceof URL?input:input.url);}catch{throw Error('Unapproved onboarding request');}
 const method=String(init.method??input?.method??'GET').toUpperCase();
 if(url.username||url.password||url.hash||!['GET','POST','PUT','DELETE'].includes(method))throw Error('Unapproved onboarding request');
 if(url.origin===`https://${project}.supabase.co`){
  if(url.pathname==='/auth/v1/.well-known/jwks.json'&&method==='GET'&&!url.search)return 'authRequests';
  if(authPaths.has(url.pathname)||factorPath.test(url.pathname))return 'authRequests';
  if(url.pathname==='/functions/v1/mitsa-registration-service'&&method==='POST'&&!url.search)return 'signedCommands';
  if(/^\/rest\/v1\/rpc\/mitsa_[a-z_]+$/.test(url.pathname))return 'resourceRequests';
  if(url.pathname==='/rest/v1/businesses'&&method==='GET'&&url.search===`?select=id&id=eq.${url.searchParams.get('id')?.slice(3)}`&&new RegExp(`^eq\\.${uuid}$`).test(url.searchParams.get('id')??''))return 'resourceRequests';
 }
 if(url.href==='https://challenges.cloudflare.com/turnstile/v0/siteverify'&&method==='POST')return 'captchaRequests';
 throw Error('Unapproved onboarding request');
}
/** Future Next/Supabase test adapters must use this port for EVERY outbound
 * provider operation, including SSR refreshes. Browser actions alone cannot
 * account for Auth calls made inside Next. Not installed globally by this file.
 */
/** @param {{fixture:string,scope:{reserve:(kind:string,options:{fixture:string})=>unknown},fetcher:any,signal?:AbortSignal}} options */
export function countedOnboardingFetch({fixture,scope,fetcher,signal=undefined}){
 if(!['e-a','e-b'].includes(fixture)||typeof fetcher!=='function'||typeof scope?.reserve!=='function')throw Error('Onboarding transport unavailable');
 return async(input,init={})=>{
  const kind=onboardingRequestKind(input,init);if(signal?.aborted||init.signal?.aborted||input?.signal?.aborted)throw Error('Onboarding request stopped');
  // Durable reservation occurs before transport. Exceptions keep the slot.
  scope.reserve(kind,{fixture});
  const combined=AbortSignal.any([AbortSignal.timeout(15000),...([signal,init.signal,input?.signal].filter(Boolean))]);
  try{return await fetcher(input,{...init,redirect:'error',signal:combined});}
  catch{throw Error('Onboarding provider response unconfirmed; no automatic retry');}
 };
}
