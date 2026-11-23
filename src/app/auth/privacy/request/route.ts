import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {routeClient,runtimeConfig} from "@/lib/supabase/server";
import {requestKinds} from "@/lib/privacy/requests";
export async function POST(request:NextRequest) {
  const {client,finish}=routeClient(request),form=await request.formData();
  const destination=(query:string)=>finish(NextResponse.redirect(new URL(`/settings/account/privacy?${query}`,runtimeConfig().origin),303));
  const input=z.object({kind:requestKinds,reason:z.string().trim().max(2000),fullName:z.string().trim().max(120),key:z.uuid()}).safeParse({kind:form.get("kind"),reason:form.get("reason")??"",fullName:form.get("fullName")??"",key:form.get("commandKey")});if(!input.success)return destination("error=input");
  let business:string|null=null;
  if(input.data.kind==="workspace-closure") {
    const slug=z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120).safeParse(form.get("slug"));if(!slug.success)return destination("error=scope");
    const context=await client.schema("api").rpc("mitsa_workspace",{p_slug:slug.data});const workspace=z.object({id:z.uuid(),role:z.literal("owner")}).safeParse(context.data);if(context.error||!workspace.success)return destination("error=scope");business=workspace.data.id;
  }
  const details={...(input.data.reason?{reason:input.data.reason}:{}),...(input.data.kind==="correction"?{fullName:input.data.fullName}:{})};
  const result=await client.schema("api").rpc("mitsa_request_create",{p_kind:input.data.kind,p_business:business,p_details:details,p_key:input.data.key});return destination(result.error?"error=unavailable":"submitted=1");
}
