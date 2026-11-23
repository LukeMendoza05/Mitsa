// The private test credential is added ONLY to the loopback application origin.
// Never use BrowserContext.extraHTTPHeaders: it also reaches third-party frames.
export async function bindOnboardingBrowser({context,fixture,authorization,scope,onFailure=()=>{}}){
 if(!['e-a','e-b'].includes(fixture)||!/^[a-f0-9]{64}$/.test(authorization))throw Error('Private browser binding unavailable');
 await context.route('**/*',async route=>{
  let stage='budget';
  try{
   scope.reserve('browserRequests',{fixture});
   stage='request';
   const request=route.request(),url=new URL(request.url()),headers={...await request.allHeaders()};
   for(const key of Object.keys(headers))if(key.toLowerCase().startsWith('x-mitsa-test-'))delete headers[key];
   if(url.origin==='http://127.0.0.1:3000'&&!url.username&&!url.password&&!url.hash){
    headers['x-mitsa-test-fixture']=fixture;headers['x-mitsa-test-authorization']=authorization;stage='forward';await route.continue({headers});return;
   }
   if(url.origin==='https://challenges.cloudflare.com'&&!url.username&&!url.password){stage='forward';await route.continue({headers});return;}
   onFailure('unreviewed-browser-destination');await route.abort('blockedbyclient');
  }catch(error){const category=stage==='budget'&&error?.message==='Onboarding journal lock unavailable'?'browser-journal-contention':'browser-'+stage+'-failed';try{onFailure(category);}catch{}try{await route.abort('blockedbyclient');}catch{}}
 });
}
