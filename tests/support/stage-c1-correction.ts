import {persistentDatabase} from './persistent-database.ts';
import {readFileSync} from 'node:fs';
export const correctionPath='supabase/prepared/20261023122336_mitsa_registration_identity_boundary.sql';
export const correctionRecoveryPath='supabase/prepared/20261023122341_mitsa_registration_identity_boundary_recovery.sql';
/** Offline only. Models managed Auth ownership and missing custom-role USAGE.
 * PGlite forbids demoting its bootstrap postgres role; hosted NOSUPERUSER is
 * verified separately by read-only catalog, never claimed from this fixture.
 */
export async function recoveredC1Database(){
 const db=await persistentDatabase();
 await db.exec(readFileSync('supabase/prepared/persistent-registration-forward-recovery.sql','utf8'));
 // Fixture administration only, never migration or hosted SQL. The initial
 // PGlite bootstrap role is superuser; retain a fixture role for setup/cleanup.
 await db.exec(`create role c1_test_root superuser nologin;
 create role supabase_admin superuser nologin;
 grant c1_test_root,anon,authenticated,service_role,supabase_auth_admin to postgres with inherit false,set true;
 alter schema auth owner to supabase_admin;
 alter table auth.users owner to supabase_admin;
 grant usage on schema auth to postgres;
 grant select(id,email,email_confirmed_at,deleted_at,banned_until,is_anonymous) on auth.users to postgres;
 revoke all on schema auth from public,app_registration;`);
 return db;
}
