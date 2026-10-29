import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {routeClient,runtimeConfig} from "@/lib/supabase/server";
const slugSchema=z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120);
const idSchema=z.uuid(),nameSchema=z.string().trim().min(1).max(120);
export async function POST(request:NextRequest) {
  const {client,finish}=routeClient(request),form=await request.formData();
  const destination=(path:string)=>finish(NextResponse.redirect(new URL(path,runtimeConfig().origin),303));
  const slug=slugSchema.safeParse(form.get("slug")),action=form.get("action");
  if(!slug.success)return destination("/workspaces");
  const sections:Record<string,string>={"workspace-profile":"settings","location":"locations","member":"members","financial":"permissions","transfer-propose":"ownership","transfer-confirm":"ownership","transfer-cancel":"ownership"};
  const section=typeof action==="string"?sections[action]:null;
  if(!section)return destination("/workspaces");
  const path=`/w/${slug.data}/${section}`,error=()=>destination(`${path}?error=unavailable`);
  const workspace=await client.schema("api").rpc("mitsa_workspace",{p_slug:slug.data});
  const context=z.object({id:z.uuid()}).safeParse(workspace.data);
  if(workspace.error||!context.success)return destination("/access-denied");
  const p_business=context.data.id;
  let result:{error:{code?:string}|null;data?:unknown};
  if(action==="workspace-profile") {
    const name=nameSchema.safeParse(form.get("name"));if(!name.success)return error();
    result=await client.schema("api").rpc("mitsa_workspace_profile_save",{p_business,p_name:name.data});
  } else if(action==="location") {
    const input=z.object({id:idSchema.nullable(),name:nameSchema,kind:z.enum(["shop","warehouse"]),active:z.enum(["active","inactive"])}).safeParse({id:form.get("id")||null,name:form.get("name"),kind:form.get("kind"),active:form.get("active")});if(!input.success)return error();
    result=await client.schema("api").rpc("mitsa_location_save",{p_business,p_id:input.data.id,p_name:input.data.name,p_kind:input.data.kind,p_active:input.data.active==="active"});
  } else if(action==="member") {
    const input=z.object({user:idSchema,role:z.enum(["admin","staff"]),active:z.enum(["active","inactive"]),locations:z.array(idSchema).max(100)}).safeParse({user:form.get("userId"),role:form.get("role"),active:form.get("active"),locations:form.getAll("locations")});if(!input.success)return error();
    result=await client.schema("api").rpc("mitsa_member_update",{p_business,p_user:input.data.user,p_role:input.data.role,p_active:input.data.active==="active",p_locations:input.data.locations});
  } else if(action==="financial") {
    if(form.get("confirm")!=="on")return error();
    result=await client.schema("api").rpc("mitsa_financial_setting",{p_business,p_enabled:form.get("enabled")==="on"});
  } else if(action==="transfer-propose") {
    const incoming=idSchema.safeParse(form.get("incomingId"));if(!incoming.success||form.get("confirm")!=="on")return error();
    result=await client.schema("api").rpc("mitsa_transfer_propose",{p_business,p_incoming:incoming.data,p_remove_outgoing:form.get("removeOutgoing")==="on"});
  } else {
    const transfer=idSchema.safeParse(form.get("transferId"));if(!transfer.success)return error();
    if(action==="transfer-confirm") {
      if(form.get("confirm")!=="on")return error();
      result=await client.schema("api").rpc("mitsa_transfer_confirm",{p_transfer:transfer.data});
      if(!result.error&&z.object({completed:z.literal(true)}).safeParse(result.data).success)return destination("/workspaces");
    } else result=await client.schema("api").rpc("mitsa_transfer_cancel",{p_business,p_transfer:transfer.data});
  }
  return result.error?error():destination(`${path}?updated=1`);
}
