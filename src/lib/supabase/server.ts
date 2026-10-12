import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import approved from "../../../config/test-target.json";
import { parseRuntimeConfig } from "../runtime-config";

export function runtimeConfig() { return parseRuntimeConfig(process.env, approved.projectRef); }

function cookieOptions(options: CookieOptions): CookieOptions {
  return { ...options, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" };
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
    cookies: { getAll: () => jar.getAll(), setAll() { throw new Error("Session refresh must complete in proxy before rendering"); } },
  });
}
