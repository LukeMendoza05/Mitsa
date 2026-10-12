import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import approved from "../config/test-target.json";
import { parseRuntimeConfig } from "./lib/runtime-config";

export async function proxy(request: NextRequest) {
  const env = parseRuntimeConfig(process.env, approved.projectRef);
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'nonce-${nonce}'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  const forwarded = new Headers(request.headers);
  forwarded.set("Content-Security-Policy", csp);
  forwarded.set("x-nonce", nonce);
  const secure = process.env.NODE_ENV === "production";
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
  await client.auth.getClaims();
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
