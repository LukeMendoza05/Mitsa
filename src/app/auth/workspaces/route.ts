import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { routeClient, runtimeConfig } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { client, finish } = routeClient(request);
  const form = await request.formData();
  const parsed = z.object({ name: z.string().trim().min(1).max(120), location: z.string().trim().min(1).max(120), kind: z.enum(["shop", "warehouse"]), commandKey: z.uuid() }).safeParse(Object.fromEntries(form));
  const destination = (path: string) => finish(NextResponse.redirect(new URL(path, runtimeConfig().origin), 303));
  if (!parsed.success) return destination("/onboarding?error=invalid");
  const result = await client.schema("api").rpc("mitsa_create_workspace", { p_name: parsed.data.name, p_location: parsed.data.location, p_kind: parsed.data.kind, p_key: parsed.data.commandKey });
  if (result.error) return destination("/onboarding?error=unavailable");
  const output = z.object({ slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/) }).safeParse(result.data);
  if (!output.success) return destination("/onboarding?error=unavailable");
  return destination(`/w/${output.data.slug}`);
}
