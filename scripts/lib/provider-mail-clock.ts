type Database={query(sql:string):Promise<{rows:Record<string,unknown>[]}>};
/** Provider timestamps and expiry are checked against their database clock.
 * Never clamp issue times or extend OTP lifetime to hide local clock skew. */
export async function providerMailNow(db:Database) {
 const started=performance.now();
 const result=await db.query('select clock_timestamp() as provider_now');
 const elapsed=performance.now()-started,value=result.rows[0]?.provider_now;
 if(!(value instanceof Date)||!Number.isSafeInteger(value.getTime())||elapsed>5000)throw Error('Provider mail clock unavailable');
 // Conservatively include the full measured round trip in the age check.
 return value.getTime()+Math.ceil(elapsed);
}
