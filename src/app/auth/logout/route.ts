import { NextRequest, NextResponse } from "next/server";
import { routeClient, runtimeConfig } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { client,finish } = routeClient(request);
  const { error } = await client.auth.signOut({ scope:"local" });
  if (error) return finish(NextResponse.json({ error:"Sign-out unconfirmed" },{ status:503 }));
  return finish(NextResponse.redirect(new URL("/login",runtimeConfig().origin),303));
}
