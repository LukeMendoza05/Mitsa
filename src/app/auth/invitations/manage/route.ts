import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {routeClient,runtimeConfig} from "@/lib/supabase/server";
import {emailSchema} from "@/lib/auth/forms";
export async function POST(request:NextRequest) {
  const {client,finish}=routeClient(request),form=await request.formData(),slug=z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120).safeParse(form.get("slug"));
  const destination=(path:string)=>finish(NextResponse.redirect(new URL(path,runtimeConfig().origin),303));
  if(!slug.success)return destination("/workspaces");
  const path=`/w/${slug.data}/members`,error=()=>destination(`${path}?error=invitation`);
  const workspace=await client.schema("api").rpc("mitsa_workspace",{p_slug:slug.data});
  const parsed=z.object({id:z.uuid()}).safeParse(workspace.data);
  if(workspace.error||!parsed.success)return destination("/access-denied");
  const p_business=parsed.data.id,action=form.get("action");
  if(action==="revoke") {
    const invite=z.uuid().safeParse(form.get("invitationId"));if(!invite.success)return error();
    const result=await client.schema("api").rpc("mitsa_invite_revoke",{p_business,p_invite:invite.data});return result.error?error():destination(`${path}?updated=invitation`);
  }
  if(process.env.MITSA_AUTH_MAIL_MODE!=="isolated-capture")return error();
  const key=z.uuid().safeParse(form.get("commandKey"));if(!key.success)return error();
  if(action==="resend") {
    const invite=z.uuid().safeParse(form.get("invitationId"));if(!invite.success)return error();
    const result=await client.schema("api").rpc("mitsa_invite_send",{p_business,p_existing:invite.data,p_email:null,p_role:null,p_locations:[],p_key:key.data});return result.error?error():destination(`${path}?updated=captured`);
  }
  const input=z.object({email:emailSchema,role:z.enum(["admin","staff"]),locations:z.array(z.uuid()).max(100)}).safeParse({email:form.get("email"),role:form.get("role"),locations:form.getAll("locations")});
  if(action!=="issue"||!input.success)return error();
  const result=await client.schema("api").rpc("mitsa_invite_send",{p_business,p_existing:null,p_email:input.data.email,p_role:input.data.role,p_locations:input.data.locations,p_key:key.data});return result.error?error():destination(`${path}?updated=captured`);
}
