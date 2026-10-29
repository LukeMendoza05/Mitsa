import "server-only";
import { z } from "zod";
import { redirect } from "next/navigation";
import { workspaceContext } from "@/lib/workspaces";
export const memberSchema=z.object({userId:z.uuid(),name:z.string().nullable(),role:z.enum(["owner","admin","staff"]),active:z.boolean(),locations:z.array(z.uuid())});
export const locationSchema=z.object({id:z.uuid(),name:z.string(),kind:z.enum(["shop","warehouse"]),active:z.boolean()});
export async function managementContext(params:Promise<{workspaceSlug:string}>,access:"all"|"management"|"owner"="all") {
  const context=await workspaceContext((await params).workspaceSlug);
  if(access==="management"&&context.workspace.role==="staff"||access==="owner"&&context.workspace.role!=="owner")redirect("/access-denied");
  const profile=await context.client.schema("api").rpc("mitsa_account_profile");
  if(profile.error)throw Error("Your account profile could not be verified.");
  const userLabel=z.object({fullName:z.string().nullable()}).parse(profile.data).fullName||context.identity.email;
  return {...context,userLabel};
}
