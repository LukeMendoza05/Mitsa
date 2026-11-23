// Read-only catalog assertion for the historical legal-content safeguard.
import assert from 'node:assert/strict';
export const legalTriggerDefinition='CREATE TRIGGER legal_version_immutable BEFORE INSERT OR UPDATE ON private.legal_versions FOR EACH ROW EXECUTE FUNCTION private.mitsa_legal_immutable()';
export function legalTriggerBodyFromMigration(source){
 const match=source.match(/create function private\.mitsa_legal_immutable\(\) returns trigger\s+language plpgsql security invoker set search_path='' as \$\$([\s\S]*?)\$\$;/);
 assert(match,'historical legal trigger source missing');return match[1];
}
export function assertLegalNoticeInstallationSafety(observed,historicalSource){
 assert.equal(observed.can_insert,true,'notice INSERT permission missing');
 assert.equal(observed.rules,0,'unexpected legal notice rule');
 assert.equal(observed.triggers,1,'expected exactly the historical content-hash trigger');
 assert.equal(observed.trigger_details.length,1);
 const t=observed.trigger_details[0];
 assert.equal(t.trigger,'legal_version_immutable');assert.equal(t.enabled,'O');
 assert.equal(t.function,'private.mitsa_legal_immutable()');assert.equal(t.definition,legalTriggerDefinition);
 const match=t.functionDefinition.match(/AS \$function\$([\s\S]*?)\$function\$/);
 assert(match,'trigger function format differs');
 assert.equal(match[1],legalTriggerBodyFromMigration(historicalSource),'historical trigger body differs');
 assert.equal(t.owner,'postgres');assert.equal(t.definer,false);assert.deepEqual(t.settings,['search_path=""']);
 assert.equal(t.publicExecute,false);assert.equal(t.anonExecute,false);assert.equal(t.authenticatedExecute,false);
 return {historicalContentHashTriggerVerified:true,unexpectedTriggers:0,unexpectedRules:0};
}
