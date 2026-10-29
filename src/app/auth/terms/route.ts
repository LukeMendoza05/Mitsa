import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { routeClient, runtimeConfig } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { client, finish } = routeClient(request);
  const form = await request.formData();
  const version = z.uuid().safeParse(form.get("versionId"));
  const destination = (path: string) => finish(NextResponse.redirect(new URL(path, runtimeConfig().origin), 303));
  if (!version.success || form.get("accept") !== "on") return destination("/settings/account/terms?error=required");
  const result = await client.schema("api").rpc("mitsa_accept_terms", { p_version: version.data });
  if (result.error) return destination("/settings/account/terms?error=unavailable");
  return destination("/workspaces");
}
