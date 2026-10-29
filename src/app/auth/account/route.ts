import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {z} from "zod";
import {routeClient,runtimeConfig} from "@/lib/supabase/server";
import {resetPasswordSchema} from "@/lib/auth/forms";
import {authFlowCookie,authFlowOptions} from "@/lib/security/auth-flow";
import {enrollmentCookieName} from "@/lib/security/enrollment-cookie";
export async function POST(request:NextRequest) {
  const {client,finish}=routeClient(request),env=runtimeConfig(),form=await request.formData();
  const destination=(path:string)=>finish(NextResponse.redirect(new URL(path,env.origin),303));
  const error=()=>destination("/settings/account?error=unavailable");
  const user=await client.auth.getUser();if(user.error||!user.data.user)return destination("/login");
  if(form.get("action")==="profile") {
    const name=z.string().trim().min(1).max(120).safeParse(form.get("name"));if(!name.success)return error();
    const result=await client.schema("api").rpc("mitsa_account_profile_save",{p_name:name.data});
    return result.error?error():destination("/settings/account?updated=profile");
  }
  if(form.get("action")!=="password"||!user.data.user.email||!user.data.user.email_confirmed_at)return error();
  const input=resetPasswordSchema.safeParse({password:form.get("password"),confirmPassword:form.get("confirmPassword")});
  const current=z.string().min(1).max(256).safeParse(form.get("currentPassword"));
  if(!input.success||!current.success)return error();
  const security=await client.schema("api").rpc("mitsa_security_status");
  const state=z.object({initialized:z.boolean(),ready:z.boolean(),recent:z.boolean()}).safeParse(security.data);
  if(security.error||!state.success||state.data.initialized&&(!state.data.ready||!state.data.recent))return error();
  // Verify the password in a separate short-lived provider session. Never
  // downgrade the caller's AAL2 session by signing it in again in place.
  const verifier=createClient(env.url,env.key,{auth:{persistSession:false,autoRefreshToken:false}});
  const checked=await verifier.auth.signInWithPassword({email:user.data.user.email,password:current.data});
  if(checked.error||checked.data.user?.id!==user.data.user.id)return error();
  if((await verifier.auth.signOut({scope:"local"})).error)return error();
  const updated=await client.auth.updateUser({password:input.data.password,current_password:current.data});
  if(updated.error)return error();
  if((await client.auth.signOut({scope:"global"})).error)return error();
  const response=destination("/login?updated=password");
  for(const name of [authFlowCookie,enrollmentCookieName])response.cookies.set(name,"",{...authFlowOptions(),maxAge:0});
  return response;
}
