import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {database,publicClient,createSyntheticUser} from '../support/hosted';

it('keeps the approved recovery helper private and fails closed outside its isolated lease',async()=>{
 const db=await database();try{
  expect((await db.query('select private.mitsa_pilot_registration_open() open')).rows[0].open).toBe(false);
  for(const role of ['anon','authenticated','service_role','app_workspace','supabase_auth_admin'])expect((await db.query("select has_function_privilege($1,'private.mitsa_development_recovery_allowed(uuid,text)','EXECUTE') allowed",[role])).rows[0].allowed).toBe(role==='supabase_auth_admin');
  for(const role of ['anon','authenticated','service_role']){
   await db.query('begin');try{await db.query(`set local role ${role}`);let denied=false;
    try{await db.query("select private.mitsa_development_recovery_allowed(gen_random_uuid(),'synthetic-unknown@example.invalid')");}catch(error){denied=(error as {code?:string}).code==='42501';}
    expect(denied).toBe(true);
   }finally{await db.query('rollback');}
  }
 }finally{await db.end();}
});

it('denies direct recovery delivery to a verified synthetic account without allowlisting or a finalized intent, retaining the account',async()=>{
 const user=await createSyntheticUser('recovery-denial'),hash=createHash('sha256').update(user.email).digest('hex');
 const db=await database();try{
  expect((await db.query('select private.mitsa_test_recipient_allowed($1) allowed',[user.email])).rows[0].allowed).toBe(false);
  const before=(await db.query('select count(*)::int n from private.isolated_auth_mail where recipient_hash=$1',[hash])).rows[0].n;
  const result=await publicClient().auth.resetPasswordForEmail(user.email,{redirectTo:'http://127.0.0.1:3000/auth/email'});
  expect(Boolean(result.error)).toBe(true);
  expect((await db.query('select count(*)::int n from private.isolated_auth_mail where recipient_hash=$1',[hash])).rows[0].n).toBe(before);
  expect((await db.query('select count(*)::int n from private.pilot_mail_deliveries where recipient_hash=$1',[hash])).rows[0].n).toBe(0);
  expect((await db.query('select count(*)::int n from private.memberships where user_id=$1',[user.id])).rows[0].n).toBe(0);
  expect((await db.query('select count(*)::int n from auth.users where id=$1 and deleted_at is null and email_confirmed_at is not null',[user.id])).rows[0].n).toBe(1);
 }finally{await db.end();}
});
