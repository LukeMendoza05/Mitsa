import { redirect } from "next/navigation";
import { accountContext } from "@/lib/workspaces";
import {cookies} from "next/headers";
import {invitationCookie,openAuthFlow} from "@/lib/security/auth-flow";

export default async function ProofPage() {
  // Preserve the fixed login/callback destination as a compatibility bridge.
  await accountContext();
  const invitation=openAuthFlow((await cookies()).get(invitationCookie)?.value,process.env.AUTH_FLOW_KEY??"");
  if(invitation?.purpose==="invitation")redirect("/invitations/accept");
  redirect("/workspaces");
}
