// Shared by the inactive local operator relay and offline PostgreSQL tests.
type Database={query(sql:string,parameters?:unknown[]):Promise<{rows:Record<string,unknown>[]}>};
export type DevelopmentMailScope={phase:'controlled'|'general';approvedAtMs:number;runExpiresAtMs:number;recipientHash?:string;maxAttempts:2|4|20;existingIdentity?:{userId:string;intentId:string}};
export async function claimPilotMailDelivery(db:Database,input:{captureId:string;recipientHash:string;recipient:string;userId:string;captureCreatedAt:Date;senderHash:string;expirySeconds:number;action?:'signup'|'recovery';developmentScope?:DevelopmentMailScope;approvedScope?:{recipientHash:string;maxAttempts:3;approvedAtMs:number;expiresAtMs:number;existingIdentity?:{userId:string;intentId:string};remainingAttempts?:1;previousCaptureId?:string}}) {
 let stage='window';
 await db.query('begin');
 try {
  await db.query('select pg_advisory_xact_lock(8418,1)');await db.query('select pg_advisory_xact_lock(8417,1)');
  const window=(await db.query('select *,private.mitsa_pilot_registration_open() open from private.pilot_registration_window where singleton for update')).rows[0];
  if(window?.open!==true||new Date(window.expires_at as string).getTime()<=Date.now()+30000||window.approved_sender_sha256!==input.senderHash||window.provider_otp_expiry_seconds!==input.expirySeconds)throw Error('Pilot window unavailable');
  const development=input.developmentScope,action=input.action??'signup';
  if(action==='recovery'&&!development)throw Error('Recovery outside delivery scope');
  if(development){
   stage='approved-test-scope';
   const start=new Date(window.approved_at as string).getTime(),now=Date.now();
   if(input.approvedScope||start!==development.approvedAtMs||development.runExpiresAtMs<=now||
    (development.existingIdentity&&(development.phase!=='controlled'||development.existingIdentity.userId!==input.userId))||
    development.runExpiresAtMs-start>(development.phase==='controlled'?30:120)*60000||
    new Date(window.expires_at as string).getTime()>development.runExpiresAtMs||
    (development.phase==='controlled'?(development.recipientHash!==input.recipientHash||![2,4].includes(development.maxAttempts)):(development.recipientHash!==undefined||development.maxAttempts!==20)))throw Error('Invalid development delivery scope');
   const count=(await db.query('select count(*)::int n from private.pilot_mail_deliveries where created_at >= $1',[window.approved_at])).rows[0];
   if(Number(count.n)>=development.maxAttempts){await db.query('rollback');return false;}
  }
  if(input.approvedScope){
   stage='approved-test-scope';
   if(input.approvedScope.recipientHash!==input.recipientHash||input.approvedScope.maxAttempts!==3)throw Error('Recipient outside approved scope');
   // Recheck the exact approved window while holding the row/advisory locks.
   // A later operator change cannot extend a previously read approval.
   if(new Date(window.approved_at as string).getTime()!==input.approvedScope.approvedAtMs||new Date(window.expires_at as string).getTime()!==input.approvedScope.expiresAtMs)throw Error('Approved window changed');
   const attempts=(await db.query('select count(*)::int n from private.pilot_mail_deliveries where created_at >= $1',[window.approved_at])).rows[0];
   if(input.approvedScope.remainingAttempts!==undefined){
    if(input.approvedScope.remainingAttempts!==1||!input.approvedScope.existingIdentity||!input.approvedScope.previousCaptureId)throw Error('Invalid completion scope');
    const prior=(await db.query('select capture_id,recipient_hash,state from private.pilot_mail_deliveries where created_at<$1',[window.approved_at])).rows;
    if(prior.length!==1||prior[0].capture_id!==input.approvedScope.previousCaptureId||prior[0].recipient_hash!==input.recipientHash||prior[0].state!=='smtp-accepted')throw Error('Prior delivery changed');
   }else if(input.approvedScope.previousCaptureId!==undefined)throw Error('Invalid completion scope');
   if(Number(attempts.n)>=(input.approvedScope.remainingAttempts??input.approvedScope.maxAttempts)){await db.query('rollback');return false;}
  }
  stage='intent';
  const existing=input.approvedScope?.existingIdentity;
  if(existing&&existing.userId!==input.userId)throw Error('Unapproved existing identity');
  const bound=(await db.query("select 1 from auth.users u join private.registration_intents i on i.provider_user_id=u.id and i.email=u.email join private.isolated_auth_mail m on m.id=$3 where u.id=$1 and ($10::uuid is null or (u.id=$10::uuid and i.id=$11::uuid)) and u.email=$2 and u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp()) and (($9='signup' and u.email_confirmed_at is null and i.finalized_at is null and i.expires_at>statement_timestamp()) or ($8 and $9='recovery' and u.email_confirmed_at is not null and i.finalized_at is not null)) and (($8 and $6::uuid is null) or ($6::uuid is null and i.created_at>=$4) or (u.id=$6::uuid and i.id=$7::uuid and not exists(select 1 from private.memberships where user_id=u.id) and not exists(select 1 from auth.mfa_factors where user_id=u.id))) and m.created_at>=$4 and m.recipient_hash=$5 and m.action=$9",[input.userId,input.recipient,input.captureId,window.approved_at,input.recipientHash,existing?.userId??null,existing?.intentId??null,Boolean(development),action,development?.existingIdentity?.userId??null,development?.existingIdentity?.intentId??null])).rows;
  if(bound.length!==1)throw Error('Pilot intent unavailable');
  stage='latest-message';
  // Compare native PostgreSQL timestamps. Passing pg's millisecond Date here
  // truncates microseconds and can classify this capture itself as newer.
  if((await db.query("select 1 from private.isolated_auth_mail where recipient_hash=$1 and action=$3 and created_at>(select created_at from private.isolated_auth_mail where id=$2) limit 1",[input.recipientHash,input.captureId,action])).rows.length)throw Error('Newer message exists');
  stage='limits';
  const limits=(await db.query("select count(*) filter(where created_at>statement_timestamp()-interval '1 hour')::int as hourly_count,count(*)::int as daily_count,count(*) filter(where recipient_hash=$1 and created_at>statement_timestamp()-interval '1 minute')::int as recipient_minute_count from private.pilot_mail_deliveries where created_at>statement_timestamp()-interval '24 hours'",[input.recipientHash])).rows[0];
  if(Number(limits.hourly_count)>=10||Number(limits.daily_count)>=20||Number(limits.recipient_minute_count)>=1){await db.query('rollback');return false;}
  stage='claim';
  const claim=await db.query('insert into private.pilot_mail_deliveries(capture_id,recipient_hash) values($1,$2) on conflict do nothing returning capture_id',[input.captureId,input.recipientHash]);await db.query('commit');return claim.rows.length===1;
 }catch{await db.query('rollback');throw Error(`Pilot delivery authorization unavailable (${stage})`);}
}
