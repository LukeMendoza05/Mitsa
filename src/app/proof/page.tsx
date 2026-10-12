import { redirect } from "next/navigation";
import { componentClient } from "@/lib/supabase/server";

export default async function ProofPage() {
  const client = await componentClient();
  const { data,error } = await client.auth.getUser();
  if (error || !data.user) redirect("/login");
  const identity = await client.schema("api").rpc("foundation_identity");
  if (identity.error || !identity.data?.memberships?.length) return <main><h1>Business access denied</h1><p>No active membership is available.</p></main>;
  return <main><h1>Signed-in authentication proof</h1>
    <p>Identity verified by the server and database.</p>
    <p>{data.user.email}</p>
    <p>Product management, inventory and checkout remain awaiting approval.</p>
    <form action="/auth/logout" method="post"><button type="submit">Sign out</button></form>
  </main>;
}
