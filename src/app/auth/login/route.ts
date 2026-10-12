import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { routeClient, runtimeConfig } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { client,finish } = routeClient(request);
  const form = await request.formData();
  const parsed = z.object({ email:z.email().max(254), password:z.string().min(1).max(256) }).safeParse({ email:form.get("email"), password:form.get("password") });
  if (!parsed.success) return finish(NextResponse.json({ error:"Invalid sign-in input" },{ status:422 }));
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error) return finish(NextResponse.json({ error:"Sign-in failed" },{ status:401 }));
  return finish(NextResponse.redirect(new URL("/proof",runtimeConfig().origin),303));
}
