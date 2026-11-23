-- Close registration/delivery before rollback.
-- Remove only the new Auth write dependency. Keep already-expired sessions
-- expired: restoring revoked access is not a valid rollback. New password
-- sign-in creates an independent session using the existing authenticator.
drop trigger if exists mitsa_refresh_family_revocation on auth.refresh_tokens;
drop function if exists private.mitsa_expire_revoked_refresh_family();
