import {describe,it,expect} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {database,hostedConfig,createSyntheticUser,enrollSyntheticMfa,acceptSyntheticTerms,publicClient} from '../support/hosted';
import {prepareArchivedDeveloperReset} from '../../scripts/lib/developer-reset-plan';

describe('Disposable isolated reset rehearsal; never selects the private developer identity',()=>{
 it('revokes only its synthetic identity, preserves a closed archive and prevents old-session or new-identity inheritance',async()=>{
  let stage='target';
  try {
   const config=hostedConfig(),db=await database();await db.end();
   const user=await enrollSyntheticMfa(await createSyntheticUser('reset-rehearsal'));await acceptSyntheticTerms(user);
   if(!/^foundation-reset-rehearsal-[a-f0-9-]+@example\.invalid$/.test(user.email))throw Error('Synthetic boundary');
   const client=publicClient(user.session.access_token),created=await client.schema('api').rpc('mitsa_create_workspace',{p_name:'Synthetic archived reset rehearsal',p_location:'Synthetic reset location',p_kind:'shop',p_key:crypto.randomUUID()});
   if(created.error||!created.data?.id)throw Error('Synthetic workspace creation failed');
   const business=created.data.id;stage='synthetic-application-archive';
   const archiveDb=await database();try{
    await archiveDb.query('begin');await prepareArchivedDeveloperReset(archiveDb,user.id,business);await archiveDb.query('set constraints all immediate');await archiveDb.query('commit');
   }catch{await archiveDb.query('rollback');throw Error('Synthetic application archive failed');}finally{await archiveDb.end();}
   stage='synthetic-auth-revocation';
   const admin=createClient(config.url,config.adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
   // Do not sign out first: prove supported deletion itself invalidates the
   // provider session/factor state, without collecting a real user's JWT.
   if((await admin.auth.admin.deleteUser(user.id)).error)throw Error('Synthetic provider deletion failed');
   stage='synthetic-postflight';
   const check=await database();try{
    for(const table of ['auth.users','auth.sessions','auth.mfa_factors','private.memberships','private.factor_bindings','private.account_security','private.account_profiles','private.security_permits']) {
     const column=table==='auth.users'?'id':'user_id';expect((await check.query(`select count(*)::int n from ${table} where ${column}=$1`,[user.id])).rows[0].n).toBe(0);
    }
    const archived=(await check.query('select status,primary_owner_id from private.businesses where id=$1',[business])).rows[0];expect(archived).toEqual({status:'closed',primary_owner_id:null});
    expect((await check.query('select count(*)::int n from private.shops where business_id=$1',[business])).rows[0].n).toBe(1);
    for(const [table,column,id] of [['legal_acceptances','user_id',user.id],['access_commands','actor_id',user.id],['access_audit','business_id',business]])expect((await check.query(`select count(*)::int n from private.${table} where ${column}=$1`,[id])).rows[0].n).toBeGreaterThan(0);
   }finally{await check.end();}
   expect(Boolean((await publicClient().auth.refreshSession({refresh_token:user.session.refresh_token})).error)).toBe(true);
   const oldWorkspace=await client.schema('api').rpc('mitsa_workspace',{p_slug:created.data.slug});expect(Boolean(oldWorkspace.error)||oldWorkspace.data==null).toBe(true);
   // Supported admin API exercises same-address reuse only; this is NOT a
   // substitute for the later real signup/OTP/inbox/MFA journey.
   const fresh=await admin.auth.admin.createUser({email:user.email,password:`Synthetic!${crypto.randomUUID()}`,email_confirm:false});
   if(fresh.error||!fresh.data.user)throw Error('Synthetic same-address reuse failed');
   expect(fresh.data.user.id===user.id).toBe(false);expect(Boolean(fresh.data.user.email_confirmed_at)).toBe(false);
   const finalDb=await database();try{for(const table of ['auth.mfa_factors','private.memberships','private.legal_acceptances'])expect((await finalDb.query(`select count(*)::int n from ${table} where user_id=$1`,[fresh.data.user.id])).rows[0].n).toBe(0);}finally{await finalDb.end();}
   if((await admin.auth.admin.deleteUser(fresh.data.user.id)).error)throw Error('Synthetic replacement cleanup failed');
   stage='synthetic-same-name-onboarding';
   const replacement=await enrollSyntheticMfa(await createSyntheticUser('reset-name-reuse'));await acceptSyntheticTerms(replacement);
   const replacementClient=publicClient(replacement.session.access_token),onboarded=await replacementClient.schema('api').rpc('mitsa_create_workspace',{p_name:'Synthetic archived reset rehearsal',p_location:'Synthetic fresh location',p_kind:'shop',p_key:crypto.randomUUID()});
   if(onboarded.error||!onboarded.data?.id)throw Error('Synthetic same-name workspace creation failed');
   expect(onboarded.data.id===business).toBe(false);
   const identity=await replacementClient.schema('api').rpc('mitsa_identity');if(identity.error)throw Error('Synthetic workspace selection failed');
   expect(identity.data.workspaces.length).toBe(1);expect(identity.data.workspaces[0].id===onboarded.data.id).toBe(true);
   const denied=await replacementClient.schema('api').rpc('mitsa_workspace',{p_slug:created.data.slug});expect(Boolean(denied.error)||denied.data==null).toBe(true);
   const restoredWorkspace=await replacementClient.schema('api').rpc('mitsa_workspace',{p_slug:onboarded.data.slug});if(restoredWorkspace.error)throw Error('Synthetic replacement workspace unavailable');
   expect(restoredWorkspace.data.locations.length).toBe(1);expect(restoredWorkspace.data.locations[0].name).toBe('Synthetic fresh location');
  }catch{throw Error(`Disposable reset rehearsal stopped at ${stage}; private details suppressed. No developer account was selected.`);}
 },120000);
});
