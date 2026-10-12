-- Supabase created this event-trigger helper with PUBLIC EXECUTE. Application
-- callers do not need it; the DDL event trigger continues to run as its owner.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
