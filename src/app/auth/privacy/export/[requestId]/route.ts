import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {routeClient} from "@/lib/supabase/server";
export async function GET(request:NextRequest,{params}:{params:Promise<{requestId:string}>}) {
  const {client,finish}=routeClient(request),id=z.uuid().safeParse((await params).requestId);
  if(!id.success)return finish(NextResponse.json({error:"Export unavailable"},{status:404}));
  const result=await client.schema("api").rpc("mitsa_request_export",{p_request:id.data});
  if(result.error||!result.data)return finish(NextResponse.json({error:"Export unavailable"},{status:404}));
  return finish(NextResponse.json(result.data,{headers:{"Content-Disposition":'attachment; filename="mitsa-account-export.json"'}}));
}
