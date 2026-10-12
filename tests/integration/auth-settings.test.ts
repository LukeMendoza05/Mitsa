import { expect,it } from "vitest";
import { hostedConfig,publicClient } from "../support/hosted";

it("disables public signup and anonymous sign-in at the actual Auth boundary",async()=>{
  const cfg=hostedConfig();
  const response=await fetch(`${cfg.url}/auth/v1/settings`,{headers:{apikey:cfg.publishableKey}});
  expect(response.status).toBe(200);
  const settings=await response.json();
  expect(settings.disable_signup).toBe(true);
  expect(settings.external.anonymous_users).toBe(false);
  const signup=await publicClient().auth.signUp({email:`denied-${crypto.randomUUID()}@example.invalid`,password:`Denied!1${crypto.randomUUID()}`});
  expect(signup.data.session).toBeNull(); expect(signup.error?.code).toBe("signup_disabled");
  expect((await publicClient().auth.signInAnonymously()).error?.code).toBe("anonymous_provider_disabled");
});
