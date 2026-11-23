import {describe,expect,it} from 'vitest';
import {database,hostedConfig} from '../support/hosted';

// No fixture creation, tokens, SMTP, signup probes, policy changes or writes.
describe('Current isolated registration investigation (read-only)',()=>{
 it('confirms the provider permits signup but still requires confirmation',async()=>{
  const cfg=hostedConfig(),response=await fetch(`${cfg.url}/auth/v1/settings`,{headers:{apikey:cfg.publishableKey},signal:AbortSignal.timeout(10000)});
  expect(response.ok).toBe(true);const settings=await response.json();
  expect(settings.disable_signup).toBe(false);expect(settings.mailer_autoconfirm).toBe(false);expect(settings.external.anonymous_users).toBe(false);
 });
 it('keeps registration, external delivery and the rejected Auth trigger closed',async()=>{
  const db=await database();try{
   await db.query('begin read only');
   const gates=(await db.query('select registration_enabled,external_mail_enabled,eligibility_approved,legal_publication_enabled,disposal_enabled from private.release_gates where singleton')).rows[0];
   expect(Object.values(gates).every(v=>v===false)).toBe(true);
   expect((await db.query('select enabled,smtp_enabled,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton')).rows[0]).toEqual({enabled:false,smtp_enabled:false,open:false});
   expect((await db.query("select count(*)::int n from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal")).rows[0].n).toBe(0);
   await db.query('commit');
  }finally{await db.end();}
 });
 it('restricts private tables and preserves the existing location SELECT policy',async()=>{
  const db=await database();try{
   await db.query('begin read only');
   for(const role of ['anon','authenticated'])for(const table of ['registration_intents','registration_requests','pilot_registration_window','pilot_mail_deliveries','isolated_auth_mail','businesses','memberships']){
    const result=(await db.query("select c.relrowsecurity rls,c.relforcerowsecurity forced,has_table_privilege($1,c.oid,'SELECT,INSERT,UPDATE,DELETE') allowed from pg_class c where c.oid=$2::regclass",[role,`private.${table}`])).rows[0];
    expect(result).toEqual({rls:true,forced:true,allowed:false});
   }
   // Location reads intentionally use authenticated SELECT plus tenant RLS.
   // A table grant is not unrestricted row access; writes remain command-only.
   expect((await db.query("select has_table_privilege('anon','private.shops','SELECT') anon_read,has_table_privilege('authenticated','private.shops','SELECT') authenticated_read,has_table_privilege('authenticated','private.shops','INSERT,UPDATE,DELETE') authenticated_write")).rows[0]).toEqual({anon_read:false,authenticated_read:true,authenticated_write:false});
   const shopPolicy=(await db.query("select cmd,qual from pg_policies where schemaname='private' and tablename='shops' and 'authenticated'=any(roles)")).rows;
   expect(shopPolicy).toEqual([{cmd:'SELECT',qual:"private.has_shop_access(business_id, id, 'view'::text)"}]);
   for(const role of ['anon','authenticated']){
    expect((await db.query("select has_function_privilege($1,'api.mitsa_signed_registration_intent(text,text,uuid,text,boolean,text,timestamptz)','EXECUTE') allowed",[role])).rows[0].allowed).toBe(false);
    for(const name of ['mitsa_before_user_created','mitsa_isolated_send_email'])expect((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,`private.${name}(jsonb)`])).rows[0].allowed).toBe(false);
   }
   await db.query('commit');
  }finally{await db.end();}
 });
});
