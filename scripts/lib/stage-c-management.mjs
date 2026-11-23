import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
// Count HTTP attempts directly. No CLI retries, redirects, telemetry or logs.
export function stageCManagement({scope,token,project,fetcher=fetch}){
 assert.equal(project,'mjtejwafxriwntweussc');assert(typeof token==='string'&&token.length>=30&&token.length<=2048&&!/\s/.test(token));
 const request=async(method,body)=>{scope.reserve(['managementRequests']);let r;try{r=await fetcher(`https://api.supabase.com/v1/projects/${project}/secrets`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw Error('Management request unconfirmed');}if(!r.ok)throw Object.assign(Error('Management request rejected'),{safeHttpStatus:r.status});return r;};
 return {
  async assertDisabled(){const rows=await(await request('GET')).json(),matches=rows.filter(r=>r.name==='MITSA_REGISTRATION_SERVICE_ENABLED');assert.equal(matches.length,1);const value=matches[0].digest??matches[0].value;assert(value==='false'||value===createHash('sha256').update('false').digest('hex'),'Service disabled state unconfirmed');},
  async setEnabled(enabled){assert.equal(typeof enabled,'boolean');await request('POST',[{name:'MITSA_REGISTRATION_SERVICE_ENABLED',value:String(enabled)}]);}
 };
}
