// Read-only operator preparation. No bearer, refresh token or factor secret is
// selected. The ordinary application receives only fixed IDs and hashes.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parse} from 'dotenv';
import pg from 'pg';
import {assertTestTarget} from './test-target.mjs';
import {testDatabaseConfig} from './postgres-config.mjs';
let db;
try {
 const cfg=JSON.parse(readFileSync('config/test-target.json')),env=parse(readFileSync('.secrets/operator.env'));
 const target=assertTestTarget({projectRef:env.TEST_PROJECT_REF,url:env.TEST_SUPABASE_URL,databaseUrl:env.TEST_DATABASE_URL},cfg);assert.equal(target.projectRef,'mjtejwafxriwntweussc');
 db=new pg.Client(testDatabaseConfig(env.TEST_DATABASE_URL,cfg));await db.connect();await db.query('begin read only');
 assert.equal((await db.query('select marker from foundation_probe.environment_identity where singleton')).rows[0].marker,target.databaseMarker);
 const email=JSON.parse(readFileSync('.secrets/onboarding-recipient.json')).email.trim().toLowerCase();
 const checkpoint=JSON.parse(readFileSync('.secrets/isolated-registration/returning-signin-checkpoint.json'));
 const user=(await db.query('select id from auth.users where email=$1 and email_confirmed_at is not null and deleted_at is null',[email])).rows;assert.equal(user.length,1);assert.equal(user[0].id,checkpoint.userId);
 const foreign=(await db.query("select b.id,b.slug from private.businesses b where name='D Extacy Fireworks' and status='active' and not exists(select 1 from private.memberships m where m.business_id=b.id and m.user_id=$1)",[user[0].id])).rows;assert.equal(foreign.length,1);
 await db.query('commit');
 writeFileSync('.secrets/auth-security-audit.json',JSON.stringify({project:target.projectRef,userHash:createHash('sha256').update(user[0].id).digest('hex'),foreignBusiness:foreign[0].id,foreignSlug:foreign[0].slug,expiresAt:Date.now()+3600000})+'\n',{mode:0o600});
 console.log(JSON.stringify({project:target.projectRef,markerVerified:true,diagnosticPrepared:true,durationMinutes:60,remoteChanges:0,emailsSent:0,privateValuesPrinted:false}));
}catch{try{await db?.query('rollback');}catch{}console.error('Session diagnostic preparation stopped; private details suppressed.');process.exitCode=1;}finally{await db?.end();}
