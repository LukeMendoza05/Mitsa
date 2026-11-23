import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
/** In-memory PostgreSQL only. No hosted config, provider account or SMTP client. */
export async function persistentDatabase({installPrepared=true}:{installPrepared?:boolean}={}) {
 const db=new PGlite();
 await db.exec(`create role authenticator login noinherit;create role authenticated nologin;create role anon nologin;create role supabase_auth_admin nologin;create role service_role nologin;
 grant authenticated to authenticator;create schema auth;create schema extensions;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean not null default false,deleted_at timestamptz,banned_until timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz,factor_id uuid,aal text,created_at timestamptz not null default now());
 create table auth.mfa_factors(id uuid primary key,user_id uuid references auth.users,status text,factor_type text);
 create table auth.refresh_tokens(id bigint primary key,session_id uuid,revoked boolean);
 alter table auth.sessions enable row level security;
 create function auth.uid() returns uuid language sql as $$select(current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select current_setting('request.jwt.claims',true)::jsonb$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;
 -- Policy-only encryption stubs; never imported by any runtime or migration.
 create function extensions.dearmor(text) returns bytea language sql as $$select convert_to($1,'UTF8')$$;
 create function extensions.pgp_pub_encrypt(text,bytea,text) returns bytea language sql as $$select convert_to($1,'UTF8')$$;
 create function extensions.gen_random_bytes(integer) returns bytea language sql as $$select decode(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),'hex')$$;`);
 const files=['20261012053948_foundation_security_proof.sql','20261012054416_foundation_identity.sql','20261012060403_foundation_membership_lock_policy.sql','20261012060628_foundation_current_session_policy.sql','20261012070606_foundation_verified_actor_adapter.sql','20261013181012_mitsa_workspace_foundation.sql','20261013181135_mitsa_membership_commands.sql','20261013185440_mitsa_account_security_terms.sql','20261013223908_mitsa_registration_boundary.sql','20261014001000_mitsa_reenrollment_session.sql','20261014014343_mitsa_account_workspace_interfaces.sql','20261014015632_mitsa_isolated_auth_mail_capture.sql','20261014021816_mitsa_capture_pkce_compatibility.sql','20261014034721_mitsa_captured_invitations.sql','20261014044022_mitsa_reviewed_requests.sql','20261014055453_mitsa_developer_registration.sql','20261014094354_mitsa_capture_verification_codes.sql'];
 for(const file of files){
  if(file.includes('foundation_verified_actor_adapter'))await db.exec('revoke usage on schema auth from app_authz,app_command');
  await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
 }
 await db.exec(readFileSync('supabase/prepared/20261014_mitsa_controlled_pilot_relay.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261015072934_mitsa_development_recovery_eligibility.sql','utf8'));
 for(const file of installPrepared?['20261016004927_mitsa_persistent_registration_inactive.sql','20261016005221_mitsa_persistent_registration_hooks_inactive.sql']:[]) {
  const sql=readFileSync(`supabase/prepared/${file}`,'utf8');
  await db.exec(sql);
 }
 return db;
}
