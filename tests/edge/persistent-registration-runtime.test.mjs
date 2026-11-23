// Actual inactive entrypoint under Deno. No credentials, listener or provider IO.
const names=['MITSA_REGISTRATION_SERVICE_ENABLED','SUPABASE_URL','MITSA_APP_ORIGIN','SUPABASE_SERVICE_ROLE_KEY','MITSA_PUBLISHABLE_KEY','MITSA_REGISTRATION_SERVICE_KEY'];
const complete={MITSA_REGISTRATION_SERVICE_ENABLED:'true',SUPABASE_URL:'https://mjtejwafxriwntweussc.supabase.co',MITSA_APP_ORIGIN:'http://127.0.0.1:3000',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key',MITSA_PUBLISHABLE_KEY:'synthetic-public-key',MITSA_REGISTRATION_SERVICE_KEY:'ab'.repeat(32)};
const cases=[
 ['disabled',{}],
 ['missing-private-configuration',{MITSA_REGISTRATION_SERVICE_ENABLED:'true',SUPABASE_URL:complete.SUPABASE_URL,MITSA_APP_ORIGIN:complete.MITSA_APP_ORIGIN}],
 ['disabled-with-complete-configuration',{...complete,MITSA_REGISTRATION_SERVICE_ENABLED:'false'}],
 ['noncanonical-enable-flag',{...complete,MITSA_REGISTRATION_SERVICE_ENABLED:'TRUE'}],
 ['wrong-project',{...complete,SUPABASE_URL:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co'}],
 ['wrong-origin',{...complete,MITSA_APP_ORIGIN:'http://localhost:3000'}],
 ['missing-service-key',{...complete,SUPABASE_SERVICE_ROLE_KEY:''}],
 ['missing-public-key',{...complete,MITSA_PUBLISHABLE_KEY:''}],
 ['missing-signer',{...complete,MITSA_REGISTRATION_SERVICE_KEY:''}],
 ['malformed-signer',{...complete,MITSA_REGISTRATION_SERVICE_KEY:'synthetic-invalid'}],
];
for(const [mode,environment] of cases)Deno.test(`Edge entrypoint fails closed: ${mode}`,async()=>{
 for(const name of names)Deno.env.delete(name);
 for(const [name,value] of Object.entries(environment))Deno.env.set(name,value);
 const original=Deno.serve;let handler;
 Deno.serve=value=>{handler=value;return {};};
 try {
  await import(new URL(`../../supabase/functions/mitsa-registration-service/index.ts?case=${mode}`,import.meta.url).href);
  if(typeof handler!=='function')throw Error('Entrypoint did not register its handler');
  for(const method of ['GET','POST']){
   const response=await handler(new Request('http://127.0.0.1/inactive',{method}));
   if(response.status!==503||JSON.stringify(await response.json())!==JSON.stringify({error:'unavailable'})||response.headers.get('cache-control')!=='no-store')throw Error('Inactive entrypoint did not fail closed');
  }
 }finally{Deno.serve=original;}
});
