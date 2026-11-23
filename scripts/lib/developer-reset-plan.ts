/** Prepared application phase, NOT a runnable reset command.
 * Caller must obtain the separate final account + archive approvals, revalidate
 * the private identity/snapshot/target, and own a transaction. No Auth API call,
 * session revocation, COMMIT, release gate or mail operation occurs here. */
type Database = {query(sql: string, parameters?: unknown[]): Promise<{rows: Record<string, unknown>[]}>};
export async function prepareArchivedDeveloperReset(db: Database, userId: string, businessId: string) {
 const marker=(await db.query("select marker from foundation_probe.environment_identity where singleton")).rows[0]?.marker;
 if(marker!=="fireworks-foundation-proof-01a12e38")throw Error("Unapproved environment");
 const gates=(await db.query("select * from private.release_gates where singleton for update")).rows[0];
 if(!gates||['registration_enabled','external_mail_enabled','legal_publication_enabled','eligibility_approved','disposal_enabled'].some(k=>gates[k]!==false))throw Error("Release gates changed");
 const business=(await db.query("select * from private.businesses where id=$1 for update",[businessId])).rows[0];
 const memberships=(await db.query("select * from private.memberships where business_id=$1 or user_id=$2 order by business_id,user_id for update",[businessId,userId])).rows;
 if(!business||business.status!=="active"||business.primary_owner_id!==userId||memberships.length!==1||
  memberships[0].user_id!==userId||memberships[0].business_id!==businessId||memberships[0].role!=="owner"||memberships[0].active!==true)throw Error("Owner or membership baseline changed");
 if((await db.query("select 1 from private.operator_principals where user_id=$1",[userId])).rows.length)throw Error("Unexpected platform operator");
 // This reviewed plan is restricted to the current single-location, no-employee
 // workspace. Any new dependency requires an updated assessment and approval.
 for(const table of ['workspace_invitations','ownership_transfers','shop_assignments']) {
  if((await db.query(`select 1 from private.${table} where business_id=$1 limit 1`,[businessId])).rows.length)throw Error("Workspace dependencies changed");
 }
 if((await db.query("select 1 from private.account_requests where user_id=$1 or business_id=$2 limit 1",[userId,businessId])).rows.length)throw Error("Requests require separate retention review");
 if((await db.query("select 1 from private.legal_holds where subject_id in ($1,$2) and released_at is null limit 1",[userId,businessId])).rows.length)throw Error("Legal hold requires separate review");
 // Close the workspace first. The existing invariant still protects every
 // active workspace; no trigger, FK or RLS policy is disabled.
 await db.query("update private.businesses set status='closed',primary_owner_id=null where id=$1",[businessId]);
 await db.query("delete from private.memberships where business_id=$1 and user_id=$2",[businessId,userId]);
 await db.query("delete from private.security_permits where user_id=$1",[userId]);
 await db.query("delete from private.factor_bindings where user_id=$1",[userId]);
 await db.query("delete from private.account_security where user_id=$1",[userId]);
 await db.query("delete from private.account_profiles where user_id=$1",[userId]);
 await db.query("insert into private.access_audit(business_id,actor_id,event,target_id,detail) values($1,$2,'developer.reset.application-prepared',$2,'{\"scope\":\"isolated-approved-archive\"}')",[businessId,userId]);
 // User still exists here. Provider deletion must use the supported admin API
 // only after its own approval; failure requires compensation from the snapshot.
}

/** Compensation only if the supported provider deletion did NOT occur.
 * Caller must verify the encrypted snapshot digest and own a transaction.
 * Never recreates an Auth user, session, factor or historical acceptance. */
export async function restoreArchivedDeveloperApplication(db: Database, userId: string, businessId: string,
 snapshot: Record<string, Record<string, unknown>[]>) {
 if((await db.query("select marker from foundation_probe.environment_identity where singleton")).rows[0]?.marker!=="fireworks-foundation-proof-01a12e38")throw Error("Unapproved environment");
 const gates=(await db.query("select * from private.release_gates where singleton for update")).rows[0];
 if(!gates||['registration_enabled','external_mail_enabled','legal_publication_enabled','eligibility_approved','disposal_enabled'].some(k=>gates[k]!==false))throw Error("Release gates changed");
 if((await db.query("select 1 from auth.users where id=$1 and deleted_at is null for update",[userId])).rows.length!==1)throw Error("Auth identity no longer exists; do not compensate");
 const business=(await db.query("select status,primary_owner_id from private.businesses where id=$1 for update",[businessId])).rows[0];
 if(business?.status!=='closed'||business.primary_owner_id!==null)throw Error("Archive changed");
 const savedBusiness=snapshot['private.businesses']?.filter(row=>row.id===businessId);
 if(savedBusiness?.length!==1||savedBusiness[0].status!=='active'||savedBusiness[0].primary_owner_id!==userId)throw Error("Snapshot ownership mismatch");
 if((await db.query("select 1 from private.memberships where business_id=$1 or user_id=$2",[businessId,userId])).rows.length)throw Error("Memberships changed");
 const tables=['account_profiles','account_security','factor_bindings','security_permits','memberships'];
 for(const table of tables){
  const rows=snapshot[`private.${table}`]?.filter(row=>row.user_id===userId);if(!rows)throw Error("Incomplete recovery snapshot");
  if(table==='memberships'&&(rows.length!==1||rows[0].business_id!==businessId||rows[0].role!=='owner'||rows[0].active!==true))throw Error("Snapshot membership mismatch");
  if(table==='factor_bindings')for(const row of rows){
   if((await db.query("select 1 from auth.mfa_factors where id=$1 and user_id=$2 and status='verified'",[row.factor_id,userId])).rows.length!==1)throw Error("Provider factors changed; do not restore trust");
  }
  if((await db.query(`select 1 from private.${table} where user_id=$1 limit 1`,[userId])).rows.length)throw Error("Application state changed");
  for(const row of rows)await db.query(`insert into private.${table} select * from jsonb_populate_record(null::private.${table},$1::jsonb)`,[JSON.stringify(row)]);
 }
 await db.query("update private.businesses set status='active',primary_owner_id=$2 where id=$1",[businessId,userId]);
 await db.query("insert into private.access_audit(business_id,actor_id,event,target_id) values($1,$2,'developer.reset.compensated',$2)",[businessId,userId]);
}
