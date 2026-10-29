// Closed-preview server origin and dedicated-backend binding.
// No request headers, network operations or provider/session changes.
/**
 * @param {Readonly<Record<string,string|undefined>>} env
 * @param {{projectId?:string,sourceSha?:string,projectName?:string,backendRef?:string}|undefined} approved
 */
export function previewRuntimeEnvironment(env,approved){
 const mode=env.MITSA_PREVIEW_ORIGIN_MODE;
 if(mode===undefined||mode==='disabled')return env;
 const deny=()=>{throw Error('Preview origin is not authorized');};
 if(mode!=='vercel-deployment-v1'||!approved||
  !/^prj_[A-Za-z0-9]{8,80}$/.test(approved.projectId??'')||
  !/^[a-f0-9]{40}$/.test(approved.sourceSha??'')||
  !/^[a-z]{20}$/.test(approved.backendRef??'')||approved.backendRef==='unconfiguredpreviewx'||
  env.MITSA_PREVIEW_SUPABASE_PROJECT_REF!==approved.backendRef||
  env.SUPABASE_URL!=='https://'+approved.backendRef+'.supabase.co'||
  approved.projectName!=='mitsa-fireworksinventory')return deny();
 if(env.VERCEL!=='1'||env.VERCEL_ENV!=='preview'||env.VERCEL_TARGET_ENV!=='preview'||
  env.VERCEL_PROJECT_ID!==approved.projectId||env.VERCEL_PROJECT_NAME!==approved.projectName||
  env.VERCEL_GIT_PROVIDER!=='github'||env.VERCEL_GIT_REPO_OWNER!=='LukeMendoza05'||
  env.VERCEL_GIT_REPO_SLUG!=='Mitsa'||env.VERCEL_GIT_COMMIT_SHA!==approved.sourceSha||
  !/^dpl_[A-Za-z0-9]{8,80}$/.test(env.VERCEL_DEPLOYMENT_ID??''))return deny();
 // This optional mechanism is for the closed website Preview only.
 if(env.MITSA_REGISTRATION_MODE!=='disabled'||env.MITSA_AUTH_MAIL_MODE!=='disabled'||
  env.MITSA_REGISTRATION_SERVICE_ENABLED!=='false'||env.MITSA_REGISTRATION_ENGINE!=='legacy')return deny();
 const host=env.VERCEL_URL??'';
 if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/.test(host)||
  !host.startsWith(approved.projectName+'-'))return deny();
 const origin='https://'+host;
 if(env.APP_ORIGIN!==undefined&&env.APP_ORIGIN!==origin)return deny();
 // Actual parseRuntimeConfig still enforces the exact approved Supabase target
 // and rejects admin credentials. This function does not authorize that target.
 return {...env,APP_ORIGIN:origin};
}

/** Selects the separately provisioned target only after the full closed Preview
 * binding has passed. Ordinary and production modes retain their static target.
 * @param {Readonly<Record<string,string|undefined>>} env
 * @param {string} ordinaryRef
 */
export function previewRuntimeProject(env,ordinaryRef){
 if(env.MITSA_PREVIEW_ORIGIN_MODE===undefined||env.MITSA_PREVIEW_ORIGIN_MODE==='disabled')return ordinaryRef;
 previewRuntimeEnvironment(env,{projectId:env.MITSA_PREVIEW_VERCEL_PROJECT_ID,
  sourceSha:env.MITSA_PREVIEW_SOURCE_SHA,projectName:'mitsa-fireworksinventory',backendRef:env.MITSA_PREVIEW_SUPABASE_PROJECT_REF});
 return /** @type {string} */(env.MITSA_PREVIEW_SUPABASE_PROJECT_REF);
}
