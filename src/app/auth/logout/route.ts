import { NextRequest, NextResponse } from "next/server";
import { routeClient, runtimeConfig } from "@/lib/supabase/server";
import { enrollmentCookieName } from "@/lib/security/enrollment-cookie";
import {signupCodeCookie,authFlowOptions} from "@/lib/security/auth-flow";
import { inspectBrowserSession, auditBrowserLogout } from '@/lib/security/session-audit';

export async function POST(request: NextRequest) {
  const { client,finish } = routeClient(request);
  // Optional, short-lived loopback diagnostic. It never changes logout scope.
  const audit = await inspectBrowserSession(client).catch(() => null);
  const { error } = await client.auth.signOut({ scope:"local" });
  await auditBrowserLogout(audit, Boolean(error));
  if (error) return finish(NextResponse.json({ error:"Sign-out unconfirmed" },{ status:503 }));
  const response = finish(NextResponse.redirect(new URL("/login",runtimeConfig().origin),303));
  response.cookies.set(enrollmentCookieName,"",{path:"/",maxAge:0,httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict"});
  response.cookies.set(signupCodeCookie,"",{...authFlowOptions(),maxAge:0});
  return response;
}
