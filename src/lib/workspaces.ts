import "server-only";
import { z } from "zod";
import { redirect } from "next/navigation";
import { componentClient } from "@/lib/supabase/server";

export const roleSchema = z.enum(["owner", "admin", "staff"]);
export const roleLabels = { owner: "Business Owner", admin: "Admin", staff: "Staff" } as const;
const workspaceSummary = z.object({ id: z.uuid(), slug: z.string(), name: z.string(), role: roleSchema, requiresMfa: z.boolean() });
const identitySchema = z.object({ userId: z.uuid(), email: z.email(), verified: z.boolean(), mfaReady: z.boolean(), workspaces: z.array(workspaceSummary) });
const workspaceSchema = z.object({ id: z.uuid(), name: z.string(), slug: z.string(), role: roleSchema, locations: z.array(z.object({ id: z.uuid(), name: z.string(), kind: z.enum(["shop", "warehouse"]) })), canViewFinancial: z.boolean(), adminFinancialAccess: z.boolean().nullable(), country: z.string(), currency: z.string(), timezone: z.string() });
export type Workspace = z.infer<typeof workspaceSchema>;

export async function accountContext() {
  const client = await componentClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  const identity = await client.schema("api").rpc("mitsa_identity");
  if(identity.error?.code==="42501")redirect("/login?error=session");
  if (identity.error) throw new Error("Workspace access could not be verified.");
  return { client, user: data.user, identity: identitySchema.parse(identity.data) };
}

export async function workspaceContext(slug: string) {
  const account = await accountContext();
  const membership = account.identity.workspaces.find(workspace => workspace.slug === slug);
  if (!membership) redirect("/access-denied");
  if (membership.requiresMfa) redirect("/settings/account/security");
  const terms = await account.client.schema("api").rpc("mitsa_current_terms");
  if (terms.error) throw new Error("Account agreement could not be verified.");
  if (!terms.data?.accepted) redirect("/settings/account/terms");
  const result = await account.client.schema("api").rpc("mitsa_workspace", { p_slug: slug });
  if (result.error?.code === "42501") redirect("/access-denied");
  if (result.error) throw new Error("Workspace access could not be verified.");
  return { ...account, workspace: workspaceSchema.parse(result.data) };
}
