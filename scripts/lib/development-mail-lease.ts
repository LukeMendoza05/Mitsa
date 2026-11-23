type Database={query(sql:string,parameters?:unknown[]):Promise<{rows:Record<string,unknown>[]}>};
/** A revoked/expired lease must never be revived by a still-running worker. */
export async function renewDevelopmentMailLease(db:Database,runtime:{approvedAt:string;expiresAt:string},capacity:boolean) {
 const result=await db.query("update private.pilot_registration_window set enabled=$3,smtp_enabled=$3,expires_at=least($2::timestamptz,statement_timestamp()+interval '60 seconds') where singleton and approved_at=$1 and expires_at>statement_timestamp() returning singleton",[runtime.approvedAt,runtime.expiresAt,capacity]);
 return result.rows.length===1;
}
