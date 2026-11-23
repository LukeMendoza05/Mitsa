// Local payload assembly only. No credentials are loaded; no network API exists.
import assert from 'node:assert/strict';
import {materializePreviewBootstrap} from './preview-bootstrap.mjs';
export const previewTarget=Object.freeze({
 organizationId:'zejvpgnesxiwavwgcsme',organizationName:'Luke Perry’s Org',
 backendName:'mitsa-fireworksinventory-preview',region:'ap-southeast-2',
 teamId:'team_C7i6iroBHmpUkM99weoPGnHw',teamSlug:'lukemendoza',
 projectName:'mitsa-fireworksinventory',requestedProductionUrl:'https://mitsa-fireworksinventory.vercel.app',
 repository:'LukeMendoza05/Mitsa',repositoryId:1429313477,
 publishedBase:'4b7fdd29ac3c232ffae96dba6bef74ba1b046f66'
});
export const backendCreate={name:previewTarget.backendName,organization_id:previewTarget.organizationId,region:previewTarget.region};
export const authClose={disable_signup:true,mailer_autoconfirm:false,site_url:'https://inactive.invalid',uri_allow_list:''};
export const authHooksClosed={...authClose,
 hook_before_user_created_enabled:true,hook_before_user_created_uri:'pg-functions://postgres/private/mitsa_before_user_created',
 hook_send_email_enabled:true,hook_send_email_uri:'pg-functions://postgres/private/mitsa_isolated_send_email'};
export const apiPrivate={db_schema:'api'};
export const vercelCreate={name:previewTarget.projectName,framework:'nextjs',rootDirectory:null,
 installCommand:'npm ci --ignore-scripts',buildCommand:'npm run build',outputDirectory:null,
 publicSource:false,previewDeploymentsDisabled:true,ssoProtection:{deploymentType:'all'}};
export const vercelSettings={nodeVersion:'24.x',sourceFilesOutsideRootDirectory:false,
 autoAssignCustomDomains:false,autoExposeSystemEnvs:true,previewDeploymentsDisabled:true,
 ssoProtection:{deploymentType:'all'}};
export function bindBackend(receipt){
 assert(receipt&&receipt.name===previewTarget.backendName&&receipt.organization_id===previewTarget.organizationId&&receipt.region===previewTarget.region,'Preview creation receipt mismatch');
 const bootstrap=materializePreviewBootstrap(receipt.id);
 return {projectRef:receipt.id,marker:bootstrap.marker,sourceTarget:{projectRef:receipt.id},bootstrap};
}
export function deploymentRequest({projectId,commit,backendReceipt,protection,sourceProjectRef}){
 const bound=bindBackend(backendReceipt);
 assert.equal(sourceProjectRef,bound.projectRef,'Source must bind the new dedicated backend');
 assert(/^prj_[A-Za-z0-9]{8,80}$/.test(projectId??''),'Approved Vercel project ID required');
 assert(/^[a-f0-9]{40}$/.test(commit??'')&&commit!==previewTarget.publishedBase,'Reviewed incremental source commit required');
 assert(protection?.deploymentType==='all','All Deployments protection required');
 // Omitting target explicitly selects Preview in the supported deployment API.
 return {teamId:previewTarget.teamId,requestBody:{name:previewTarget.projectName,project:projectId,
  gitSource:{type:'github',repoId:previewTarget.repositoryId,ref:'main',sha:commit},
  withLatestCommit:false,projectSettings:{framework:'nextjs',nodeVersion:'24.x',
   rootDirectory:null,installCommand:'npm ci --ignore-scripts',buildCommand:'npm run build',
   outputDirectory:null,sourceFilesOutsideRootDirectory:false}}};
}
export function previewEnvironment({projectId,commit,backendReceipt,publishableKey,authFlowKey,mfaEnrollmentKey,protection,sourceProjectRef}){
 deploymentRequest({projectId,commit,backendReceipt,protection,sourceProjectRef});
 assert(typeof publishableKey==='string'&&publishableKey.startsWith('sb_publishable_'),'New project publishable key required');
 for(const key of [authFlowKey,mfaEnrollmentKey])assert(typeof key==='string'&&/^[a-f0-9]{64}$/.test(key),'Fresh private 32-byte hex keys required');
 assert.notEqual(authFlowKey,mfaEnrollmentKey,'Independent keys required');
 const values={SUPABASE_URL:'https://'+backendReceipt.id+'.supabase.co',SUPABASE_PUBLISHABLE_KEY:publishableKey,
  AUTH_FLOW_KEY:authFlowKey,MFA_ENROLLMENT_KEY:mfaEnrollmentKey,MITSA_REGISTRATION_ENGINE:'legacy',
  MITSA_REGISTRATION_MODE:'disabled',MITSA_AUTH_MAIL_MODE:'disabled',MITSA_REGISTRATION_SERVICE_ENABLED:'false',
  MITSA_EMAIL_OTP_LENGTH:'6',MITSA_PREVIEW_ORIGIN_MODE:'vercel-deployment-v1',
  MITSA_PREVIEW_VERCEL_PROJECT_ID:projectId,MITSA_PREVIEW_SOURCE_SHA:commit,MITSA_PREVIEW_SUPABASE_PROJECT_REF:backendReceipt.id};
 return {teamId:previewTarget.teamId,idOrName:projectId,upsert:'false',requestBody:Object.entries(values).map(([key,value])=>({
  key,value,type:['AUTH_FLOW_KEY','MFA_ENROLLMENT_KEY'].includes(key)?'sensitive':'encrypted',target:['preview']
 }))};
}
