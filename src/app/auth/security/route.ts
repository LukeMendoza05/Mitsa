import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { routeClient, runtimeConfig } from "@/lib/supabase/server";
import { enrollmentCookieName, openEnrollment, sealEnrollment } from "@/lib/security/enrollment-cookie";
import {classifyFactors,enrollmentDeadline,enrollmentSafetyMs,passwordDeadline,securityStateSchema} from "@/lib/security/mfa-state";

export async function POST(request: NextRequest) {
  const { client, finish } = routeClient(request);
  const form = await request.formData();
  const destination = (query = "") => finish(NextResponse.redirect(new URL(`/settings/account/security${query}`, runtimeConfig().origin), 303));
  const error = (code="security") => destination(`?error=${code}`);
  const diagnostic=crypto.randomUUID();
  const providerError=(stage:string,failure:{code?:string;status?:number})=>{
    console.warn("Mitsa security action refused",{diagnostic,stage,code:failure.code??"unavailable",status:failure.status});
    return error(failure.status===429?"rate_limited":"provider");
  };
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) return finish(NextResponse.redirect(new URL("/login", runtimeConfig().origin), 303));
  const claims = await client.auth.getClaims();
  const sessionId = claims.data?.claims.session_id;
  if (claims.error || typeof sessionId !== "string") return error();
  const key = process.env.MFA_ENROLLMENT_KEY ?? "";
  const context = openEnrollment(request.cookies.get(enrollmentCookieName)?.value, key, user.data.user.id, sessionId);
  const clear = (response: NextResponse) => { response.cookies.set(enrollmentCookieName, "", { path: "/", maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" }); return response; };
  const code = z.string().regex(/^[0-9]{6}$/).safeParse(form.get("code"));
  const action = form.get("action");

  if (action === "reauthenticate") {
    const password = z.string().min(1).max(256).safeParse(form.get("password"));
    if (!password.success || !user.data.user.email) return error("password_input");
    const signedIn = await client.auth.signInWithPassword({ email: user.data.user.email, password: password.data });
    if (signedIn.error) return clear(signedIn.error.code==="invalid_credentials"?error("password"):providerError("password",signedIn.error));
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) return clear(providerError("factor-list",factors.error));
    const security=await client.schema("api").rpc("mitsa_security_status"),state=securityStateSchema.safeParse(security.data);
    if(security.error||!state.success)return clear(error("provider"));
    const classified=classifyFactors(factors.data.all,state.data);
    if(classified.needsReview)return clear(error("trusted"));
    if (classified.verified.length) {
      const factor = z.uuid().safeParse(form.get("factorId"));
      if (!factor.success || !code.success||!classified.trusted.some(item=>item.id===factor.data)) return clear(error("current_code"));
      const verified = await client.auth.mfa.challengeAndVerify({ factorId: factor.data, code: code.data });
      if (verified.error) return clear(verified.error.status===429?error("rate_limited"):error("current_code"));
      if(!(await client.schema("api").rpc("mitsa_identity")).data?.mfaReady)return clear(error("trusted"));
    }
    const refreshed=await client.auth.getClaims();
    if(refreshed.error||passwordDeadline(refreshed.data?.claims)===null)return clear(error("recent"));
    return clear(destination("?updated=reauthenticated"));
  }

  if (action === "enroll") {
    if (context) return destination();
    const label = z.string().trim().min(1).max(50).safeParse(form.get("label"));
    if (!label.success || !/^[A-Za-z0-9_-]{43}$/.test(key)) return error();
    const factors=await client.auth.mfa.listFactors(),security=await client.schema("api").rpc("mitsa_security_status"),state=securityStateSchema.safeParse(security.data);
    if(factors.error||security.error||!state.success)return error("provider");
    const classified=classifyFactors(factors.data.all,state.data);
    if(classified.needsReview)return error("trusted");
    if(classified.pending.length)return error("pending");
    const requestedAt=Date.now(),deadline=enrollmentDeadline(claims.data?.claims,requestedAt);
    if(deadline===null)return error("recent");
    const permit = await client.schema("api").rpc("mitsa_prepare_enrollment");
    if (permit.error || typeof permit.data !== "string") return destination("?error=recent");
    const factor = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: label.data, issuer: "Mitsa" });
    if (factor.error) return providerError("enroll",factor.error);
    if(!factor.data.totp)return error("provider");
    if(deadline-Date.now()<=enrollmentSafetyMs){await client.auth.mfa.unenroll({factorId:factor.data.id});return error("recent");}
    const sealed = sealEnrollment({ userId: user.data.user.id, sessionId, factorId: factor.data.id, permitId: permit.data, secret: factor.data.totp.secret, uri: factor.data.totp.uri, expiresAt: deadline }, key);
    if (sealed.length > 3500) { await client.auth.mfa.unenroll({ factorId: factor.data.id }); return error(); }
    const response = destination();
    response.cookies.set(enrollmentCookieName, sealed, { path: "/", maxAge: Math.max(1,Math.floor((deadline-Date.now())/1000)), httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });
    return response;
  }

  if (action === "verify-enrollment") {
    if (!context||context.expiresAt-Date.now()<=enrollmentSafetyMs||passwordDeadline(claims.data?.claims)===null) return clear(error("expired"));
    if(!code.success)return error("code_input");
    const verified = await client.auth.mfa.challengeAndVerify({ factorId: context.factorId, code: code.data });
    if (verified.error) return verified.error.status===429?error("rate_limited"):error("code");
    const bound = await client.schema("api").rpc("mitsa_bind_factor", { p_factor: context.factorId, p_permit: context.permitId });
    if (bound.error) {console.warn("Mitsa security action refused",{diagnostic,stage:"factor-bind",code:bound.error.code});return clear(error("trusted"));}
    return clear(destination("?updated=enrolled"));
  }

  if (action === "cancel-enrollment" || action === "cancel-unverified") {
    const id = action === "cancel-enrollment" ? context?.factorId : form.get("factorId");
    const factorId = z.uuid().safeParse(id);
    const factors = await client.auth.mfa.listFactors();
    if (!factorId.success || factors.error || !factors.data.all.some(factor => factor.factor_type === "totp" && factor.id === factorId.data && factor.status === "unverified")) return clear(error("cancelled"));
    const removed = await client.auth.mfa.unenroll({ factorId: factorId.data });
    return clear(removed.error ? providerError("cancel-pending",removed.error) : destination("?updated=cancelled"));
  }

  if (action === "remove" || action === "disable" || action === "retry-removal") {
    let permitId: string;
    let target: string;
    let disable: boolean;
    if (action === "retry-removal") {
      const permit = z.uuid().safeParse(form.get("permitId"));
      const status = await client.schema("api").rpc("mitsa_security_status");
      const permits = z.array(z.object({ id: z.uuid(), targetId: z.uuid(), action: z.enum(["remove", "disable"]) })).safeParse(status.data?.pendingRemovals);
      const pending = permit.success && permits.success ? permits.data.find(item => item.id === permit.data) : undefined;
      if (status.error || !pending) return error();
      permitId = pending.id; target = pending.targetId; disable = pending.action === "disable";
    } else {
      if (form.get("confirm") !== "on") return error();
      const factorId = z.uuid().safeParse(form.get("factorId"));
      if (!factorId.success) return error();
      target = factorId.data; disable = action === "disable";
      const permit = await client.schema("api").rpc("mitsa_begin_factor_removal", { p_factor: target, p_disable: disable });
      if (permit.error || typeof permit.data !== "string") return destination("?error=recent");
      permitId = permit.data;
    }
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) return error();
    const status = await client.schema("api").rpc("mitsa_security_status");
    if (status.error) return error();
    const selected = factors.data.totp.filter(factor => disable || factor.id === target).sort((a,b) => Number(a.id === status.data.currentFactorId) - Number(b.id === status.data.currentFactorId));
    for (const factor of selected) if ((await client.auth.mfa.unenroll({ factorId: factor.id })).error) return destination("?error=removal");
    const completed = await client.schema("api").rpc("mitsa_finish_factor_removal", { p_permit: permitId });
    if (completed.error) return destination("?error=removal");
    await client.auth.refreshSession();
    return clear(destination("?updated=removed"));
  }
  return error();
}
