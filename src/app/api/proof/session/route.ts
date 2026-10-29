import { NextRequest, NextResponse } from "next/server";
import { routeClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { client,finish } = routeClient(request);
  const { data:claims,error:claimsError } = await client.auth.getClaims();
  const { data:user,error:userError } = await client.auth.getUser();
  if (claimsError || userError || !claims?.claims.sub || !user.user || claims.claims.sub !== user.user.id) {
    return finish(NextResponse.json({ error:"Authentication required" },{ status:401 }));
  }
  const identity = await client.schema("api").rpc("foundation_identity");
  if (identity.error || !identity.data?.memberships?.length) {
    return finish(NextResponse.json({ error:"Business access denied" },{ status:403 }));
  }
  const records = await client.schema("api").from("foundation_resources").select("id,business_id,shop_id,value");
  if (records.error) return finish(NextResponse.json({ error:"Proof data unavailable" },{ status:503 }));
  return finish(NextResponse.json({ userId:user.user.id, resources:records.data }));
}
