// Local-only provenance check: source inspection is not a provider runtime test.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const commit='4eee58f296d9698a1c2c0ae14d7a0b379c7622d3';
const root=`.tools/supabase-auth-v2.197.0/auth-${commit}`;
const hash=value=>createHash('sha256').update(value).digest('hex');
try {
 const old=JSON.parse(readFileSync('artifacts/persistent-registration-stage-a-manifest-reference.json','utf8'));
 const proposal=JSON.parse(readFileSync('config/persistent-registration-stage-c-proposal.json','utf8'));
 const sql=[...proposal.migrationOrder,'supabase/prepared/persistent-registration-forward-recovery.sql','supabase/security-proposals/one-hour-development-session.sql.txt'];
 for(const path of sql)assert.equal(hash(readFileSync(path)),old.files.find(f=>f.path===path)?.sha256);
 const selected={
  'internal/api/user.go':['UpdatePasswordRequireReauthentication','UpdatePasswordRequireCurrentPassword','session.IsRecovery()','session.IsAAL2()'],
  'internal/api/user_test.go':['TestUserUpdatePasswordViaRecovery'],
  'internal/tokens/service.go':['token.Revoked','reuseUntil :=','models.RevokeTokenFamily'],
  'internal/models/refresh_token.go':['func RevokeTokenFamily','updated_at = now()'],
  'internal/models/sessions.go':['func (s *Session) IsRecovery()'],
  'internal/api/mfa.go':['AAL2 required to enroll a new factor','AAL2 required to unenroll verified factor'],
  'internal/api/mail.go':['RedirectTo:      referrerURL','if config.Hook.SendEmail.Enabled','return a.hooksMgr.InvokeHook'],
  'internal/utilities/request.go':['func IsRedirectURLValid','base.Hostname() == refurl.Hostname()','base.Scheme == refurl.Scheme'],
 };
 const sources=Object.entries(selected).map(([path,needles])=>{
  const body=readFileSync(`${root}/${path}`,'utf8'),lines=body.split('\n');
  return {path,sha256:hash(body),references:needles.map(condition=>{const index=lines.findIndex(line=>line.includes(condition));assert(index>=0);return {condition,line:index+1};})};
 });
 const report={recordedAt:new Date().toISOString(),version:'v2.197.0',commit,archiveSha256:hash(readFileSync('.tools/supabase-auth-v2.197.0.zip')),scope:'official pinned source inspected; upstream Go tests not executed; not hosted behavior verification',sources,reviewedSqlSourcesUnchanged:true,networkRequests:0,providerChanges:0};
 writeFileSync('artifacts/persistent-registration-provider-source.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pinnedSourceVerified:true,reviewedSqlSourcesUnchanged:true,sourceFiles:sources.length,providerChanges:0}));
}catch{console.error('Local provider-source review failed. No provider or database change was made.');process.exitCode=1;}
