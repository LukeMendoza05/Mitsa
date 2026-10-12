import { NextRequest, NextResponse } from "next/server";
import { routeClient, runtimeConfig } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { client,finish } = routeClient(request);
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (!token_hash || token_hash.length > 256 || (type !== "invite" && type !== "recovery")) {
    return finish(NextResponse.json({ error:"Invalid authentication link" },{ status:400 }));
  }
  const { error } = await client.auth.verifyOtp({ token_hash,type });
  if (error) return finish(NextResponse.json({ error:"Authentication link expired or invalid" },{ status:400 }));
  // Fixed destination: never accept a caller-supplied redirect.
  return finish(NextResponse.redirect(new URL("/proof",runtimeConfig().origin),303));
}
