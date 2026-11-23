import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {assertLegalNoticeInstallationSafety,legalTriggerDefinition,legalTriggerBodyFromMigration} from '../../scripts/lib/test-notice-installation-safety.mjs';
const source=readFileSync('supabase/migrations/20261013185440_mitsa_account_security_terms.sql','utf8');
function catalog(){return {can_insert:true,rules:0,triggers:1,trigger_details:[{trigger:'legal_version_immutable',enabled:'O',function:'private.mitsa_legal_immutable()',definition:legalTriggerDefinition,functionDefinition:'CREATE OR REPLACE FUNCTION private.mitsa_legal_immutable()\nAS $function$'+legalTriggerBodyFromMigration(source)+'$function$\n',owner:'postgres',definer:false,settings:['search_path=""'],publicExecute:false,anonExecute:false,authenticatedExecute:false}]};}
it('accepts the exact existing invoker content-hash safeguard',()=>{expect(assertLegalNoticeInstallationSafety(catalog(),source).historicalContentHashTriggerVerified).toBe(true);});
it('reproduces the previous zero-trigger guard failure without changing the database',()=>{const c=catalog();expect(c.can_insert&&c.triggers===0&&c.rules===0).toBe(false);expect(()=>assertLegalNoticeInstallationSafety(c,source)).not.toThrow();});
it.each(['missing','extra','rule','disabled','body','definer','owner','path','public','anon','authenticated','permission'])('fails closed for unsafe trigger catalog: %s',kind=>{
 const c=catalog(),t=c.trigger_details[0];
 if(kind==='missing')c.triggers=0;
 if(kind==='extra')c.triggers=2;
 if(kind==='rule')c.rules=1;
 if(kind==='disabled')t.enabled='D';
 if(kind==='body')t.functionDefinition=t.functionDefinition.replace('return new;','return null;');
 if(kind==='definer')t.definer=true;
 if(kind==='owner')t.owner='other';
 if(kind==='path')t.settings=['search_path=public'];
 if(kind==='public')t.publicExecute=true;
 if(kind==='anon')t.anonExecute=true;
 if(kind==='authenticated')t.authenticatedExecute=true;
 if(kind==='permission')c.can_insert=false;
 expect(()=>assertLegalNoticeInstallationSafety(c,source)).toThrow();
});
