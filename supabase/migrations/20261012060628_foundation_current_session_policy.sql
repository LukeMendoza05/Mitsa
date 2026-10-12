-- Supabase enables RLS on auth.sessions. Column grants alone provide no rows
-- to our NOBYPASSRLS helper. Do not change ownership, RLS flags or Auth grants.
-- This policy adds visibility only for the current JWT's actor/session pair.
create policy foundation_current_session on auth.sessions
for select to app_authz
using (
  user_id = (select auth.uid())
  and id = nullif((select auth.jwt())->>'session_id','')::uuid
);
