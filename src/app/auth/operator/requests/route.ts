import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {routeClient,runtimeConfig} from "@/lib/supabase/server";
export async function POST(request:NextRequest) {
  const {client,finish}=routeClient(request),form=await request.formData();
  const destination=(query:string)=>finish(NextResponse.redirect(new URL(`/operator/requests?${query}`,runtimeConfig().origin),303));
  const id=z.uuid().safeParse(form.get("requestId"));if(!id.success)return destination("error=input");
  if(form.get("action")==="review") {
    const input=z.object({decision:z.enum(["under-review","approved","rejected"]),reason:z.string().trim().min(10).max(1000),evidence:z.string().trim().max(1000)}).safeParse({decision:form.get("decision"),reason:form.get("reason"),evidence:form.get("evidence")??""});
    if(!input.success||input.data.decision==="approved"&&form.get("verified")!=="on")return destination("error=evidence");
    const result=await client.schema("api").rpc("mitsa_request_review",{p_request:id.data,p_status:input.data.decision,p_reason:input.data.reason,p_evidence:input.data.evidence||null});return destination(result.error?"error=authorization":"updated=review");
  }
  if(form.get("action")==="execute"&&form.get("confirm")==="on") {
    const result=await client.schema("api").rpc("mitsa_request_execute",{p_request:id.data});return destination(result.error?"error=execution":"updated=execution");
  }
  return destination("error=input");
}
