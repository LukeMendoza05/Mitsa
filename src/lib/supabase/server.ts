import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import approved from "../../../config/test-target.json";
import { parseRuntimeConfig } from "../runtime-config";
import {expectedRuntimeProject,authenticationCookieSecure} from '../auth/deployment-profile';

export function runtimeConfig() { return parseRuntimeConfig(process.env, expectedRuntimeProject(process.env,approved.projectRef)); }

function cookieOptions(options: CookieOptions): CookieOptions {
  return { ...options, httpOnly: true, secure: authenticationCookieSecure(), sameSite: "lax", path: "/" };
}

export function routeClient(request: NextRequest) {
  const env = runtimeConfig();
  const pending: { name: string; value: string; options: CookieOptions }[] = [];
  const cacheHeaders: Record<string, string> = {};
  const client = createServerClient(env.url, env.key, {
    cookieOptions: cookieOptions({}),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items, headers) {
        for (const item of items) { request.cookies.set(item.name, item.value); pending.push(item); }
        Object.assign(cacheHeaders, headers);
      },
    },
  });
  return { client, finish(response: NextResponse) {
    // Enhanced forms need only a validated destination, not a full SSR page
    // followed by a second navigation. Native clients retain the original 303.
    if(request.method==="POST"&&request.headers.get("x-mitsa-form")==="1"&&response.status===303) {
      const location=response.headers.get("location");
      if(location) {
        const target=new URL(location,env.origin);
        if(target.origin===env.origin) {
          const original=response;response=NextResponse.json({redirect:target.pathname+target.search});
          for(const cookie of original.cookies.getAll())response.cookies.set(cookie);
          for(const [name,value] of original.headers)if(!["location","content-type","content-length","set-cookie"].includes(name.toLowerCase()))response.headers.set(name,value);
        }
      }
    }
    for (const item of pending) response.cookies.set(item.name, item.value, cookieOptions(item.options));
    for (const [name,value] of Object.entries(cacheHeaders)) response.headers.set(name,value);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  } };
}

export async function componentClient() {
  const env = runtimeConfig();
  const jar = await cookies();
  return createServerClient(env.url, env.key, {
    cookieOptions: cookieOptions({}),
    cookies: { getAll: () => jar.getAll(), setAll() {
      // Proxy persists refresh/removal cookies. A provider revocation racing
      // rendering must return a signed-out result, not throw a render error.
      // Server Components cannot write response cookies.
    } },
  });
}
