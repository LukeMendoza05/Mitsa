-- SELECT FOR SHARE also evaluates UPDATE USING, even though it changes no data.
-- Permit the command role to lock its current active membership; actual UPDATE
-- remains forbidden by WITH CHECK(false). No application role can assume this role.
create policy command_membership_lock on private.memberships
for update to app_command
using (user_id = (select auth.uid()) and active and (select private.session_is_active()))
with check (false);
