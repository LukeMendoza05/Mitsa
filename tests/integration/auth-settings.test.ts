import { expect,it } from "vitest";
import { database,hostedConfig,publicClient } from "../support/hosted";

it("restricts provider signup to controlled intents and rejects anonymous sign-in",async()=>{
  const cfg=hostedConfig();
  const response=await fetch(`${cfg.url}/auth/v1/settings`,{headers:{apikey:cfg.publishableKey}});
  expect(response.status).toBe(200);
  const settings=await response.json();
  // Separately approved controlled signup is enabled behind strict hooks;
  // public application registration and external delivery remain gated off.
  expect(settings.disable_signup).toBe(false);
  expect(settings.mailer_autoconfirm).toBe(false);
  expect(settings.external.anonymous_users).toBe(false);
  const email=`denied-${crypto.randomUUID()}@example.invalid`;
  const signup=await publicClient().auth.signUp({email,password:`Denied!1${crypto.randomUUID()}`});
  expect(signup.data.session).toBeNull(); expect(Boolean(signup.error)).toBe(true);
  const db=await database();try {
    expect((await db.query("select count(*)::int n from auth.users where email=$1",[email])).rows[0].n).toBe(0);
    expect((await db.query("select registration_enabled or external_mail_enabled or legal_publication_enabled or eligibility_approved or disposal_enabled opened from private.release_gates where singleton")).rows[0].opened).toBe(false);
  }finally{await db.end();}
  expect((await publicClient().auth.signInAnonymously()).error?.code).toBe("anonymous_provider_disabled");
});
