import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {z} from "zod";
import {routeClient,runtimeConfig} from "@/lib/supabase/server";
import {authFlowOptions,invitationCookie,openAuthFlow} from "@/lib/security/auth-flow";
export async function POST(request:NextRequest) {
  const {client,finish}=routeClient(request),destination=(path:string)=>finish(NextResponse.redirect(new URL(path,runtimeConfig().origin),303));
  const flow=openAuthFlow(request.cookies.get(invitationCookie)?.value,process.env.AUTH_FLOW_KEY??"");
  if(flow?.purpose!=="invitation"||(await request.formData()).get("confirm")!=="on")return destination("/invitations/accept?error=unavailable");
  const result=await client.schema("api").rpc("mitsa_invite_accept",{p_hash:createHash("sha256").update(flow.token).digest("hex")});
  const parsed=z.object({slug:z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),accepted:z.literal(true)}).safeParse(result.data);
  if(result.error||!parsed.success)return destination("/invitations/accept?error=unavailable");
  const response=destination(`/w/${parsed.data.slug}`);response.cookies.set(invitationCookie,"",{...authFlowOptions(),maxAge:0});return response;
}
