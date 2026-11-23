// Local response gate only. No network, cleanup, deployment or provider writes.
const projectId='prj_kd0rBsWC3pzvbY6LGeTUGUEwxiDD',sha='ec4a96bef0ea77e3553513b37931076f288cc204';
export function classifyPreviewReceipt(input){
 const d=input?.deployment??input;
 if(!d||typeof d.id!=='string'||!d.id.startsWith('dpl_'))return{accepted:false,action:'STOP_RECONCILE_READONLY',reason:'MISSING_DEPLOYMENT_ID'};
 if(d.project?.id!==projectId&&d.projectId!==projectId)return{accepted:false,action:'STOP_RECONCILE_READONLY',reason:'WRONG_PROJECT'};
 const state=d.readyState??d.state,active=['INITIALIZING','QUEUED','BUILDING'].includes(state);
 const fail=reason=>({accepted:false,action:active?'CANCEL_IF_SEPARATELY_APPROVED':'STOP_RECONCILE_READONLY',reason});
 const actualSha=d.gitSource?.sha??d.meta?.githubCommitSha;if(actualSha!==sha)return fail('WRONG_OR_MISSING_SOURCE_SHA');
 if(!Object.hasOwn(d,'target'))return fail('MISSING_TARGET_EVIDENCE');
 // The API documents null as Preview. Unknown/custom/production/staging are not accepted here.
 if(d.target!==null&&d.target!=='preview')return fail('NOT_PREVIEW');
 if(typeof d.url!=='string'||!/^mitsa-fireworksinventory-[a-z0-9]+-lukemendoza\.vercel\.app$/.test(d.url))return fail('UNEXPECTED_DEPLOYMENT_HOST');
 if(state!=='READY')return{accepted:false,action:active?'OBSERVE_EXISTING_HANDLE_ONLY':'STOP_RECONCILE_READONLY',reason:'NOT_READY'};
 return{accepted:true,action:'RUN_SEPARATELY_AUTHORIZED_ACCEPTANCE_CHECKS',reason:'READY_PREVIEW_RECEIPT_ONLY_NOT_FULL_ACCEPTANCE'};
}
export function nonProductionBranchCandidate(original){
 if(original?.teamId!=='team_C7i6iroBHmpUkM99weoPGnHw'||original.requestBody?.project!==projectId||original.requestBody?.gitSource?.sha!==sha||Object.hasOwn(original.requestBody,'target'))throw Error('Reviewed original deployment request required');
 const candidate=structuredClone(original);candidate.requestBody.gitSource.ref='codex/protected-preview-ec4a96b';
 return{approved:false,hostedSelectionProven:false,branchCreation:{ref:'refs/heads/codex/protected-preview-ec4a96b',sha},deployment:candidate};
}
