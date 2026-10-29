import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import approved from "../config/test-target.json";
import { parseRuntimeConfig } from "./lib/runtime-config";
import {expectedRuntimeProject,authenticationCookieSecure} from './lib/auth/deployment-profile';

export async function proxy(request: NextRequest) {
  const env = parseRuntimeConfig(process.env,expectedRuntimeProject(process.env,approved.projectRef));
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  // React's development debugger requires eval; production keeps the strict
  // nonce policy. This follows this installed Next.js version's CSP guide.
  const development = process.env.NODE_ENV === "development";
  const diagnosticChallenge=development&&process.env.MITSA_REGISTRATION_MODE==='isolated-test'&&process.env.MITSA_AUTH_MAIL_MODE==='isolated-capture'&&request.nextUrl.pathname.startsWith('/testing/registration');
  const publicChallenge=(process.env.MITSA_REGISTRATION_ENGINE==='persistent-v1'||process.env.MITSA_REGISTRATION_MODE==='public'||(development&&process.env.MITSA_REGISTRATION_MODE==='development-open')||diagnosticChallenge)&&process.env.MITSA_PUBLIC_CAPTCHA_PROVIDER==='turnstile'&&Boolean(process.env.MITSA_TURNSTILE_SITE_KEY&&process.env.MITSA_TURNSTILE_SECRET_KEY);
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}; style-src 'self' 'nonce-${nonce}'; img-src 'self' data:; font-src 'self'; connect-src 'self'${publicChallenge?' https://challenges.cloudflare.com':''};${publicChallenge?" frame-src 'self' https://challenges.cloudflare.com;":''} object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  const forwarded = new Headers(request.headers);
  forwarded.set("Content-Security-Policy", csp);
  forwarded.set("x-nonce", nonce);
  const secure = authenticationCookieSecure();
  let response = NextResponse.next({ request: { headers: forwarded } });
  const client = createServerClient(env.url, env.key, {
    cookieOptions: { httpOnly: true, secure, sameSite: "lax", path: "/" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items, headers) {
        for (const item of items) request.cookies.set(item.name,item.value);
        forwarded.set("cookie", request.cookies.toString());
        response = NextResponse.next({ request: { headers: forwarded } });
        for (const item of items) response.cookies.set(item.name,item.value,{ ...item.options, httpOnly:true,secure,sameSite:"lax",path:"/" });
        for (const [name,value] of Object.entries(headers)) response.headers.set(name,value);
      },
    },
  });
  // Check the live provider session, including password-reset/sign-out
  // revocation. A valid JWT signature alone does not prove it still exists.
  await client.auth.getUser();
  if (!["GET","HEAD","OPTIONS"].includes(request.method) && (request.headers.get("origin") !== env.origin || request.headers.get("sec-fetch-site") === "cross-site")) {
    const denied = NextResponse.json({ error: "Request origin rejected" }, { status:403 });
    for (const cookie of response.cookies.getAll()) denied.cookies.set(cookie);
    response = denied;
  }
  response.headers.set("Content-Security-Policy",csp);
  response.headers.set("Cache-Control","private, no-store, max-age=0");
  response.headers.set("Pragma","no-cache");
  response.headers.set("Expires","0");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
