import {beforeAll,describe,expect,it} from "vitest";
import {createHash,randomUUID} from "node:crypto";
import {securityFixture} from "../support/fixtures";
import {acceptSyntheticTerms,createSyntheticUser,database,publicClient} from "../support/hosted";
const hash=()=>createHash("sha256").update(randomUUID()).digest("hex");
describe("isolated existing-account invitation lifecycle",()=>{
  let f:Awaited<ReturnType<typeof securityFixture>>,recipient:Awaited<ReturnType<typeof createSyntheticUser>>;
  const api=(token:string)=>publicClient(token).schema("api");
  beforeAll(async()=>{f=await securityFixture();recipient=await createSyntheticUser("existing-invite");await acceptSyntheticTerms(recipient);},240000);
  it("requires the verified recipient, rotates resends and accepts concurrent retries once",async()=>{
    const old=hash(),current=hash(),owner=api(f.owner.session.access_token),target=api(recipient.session.access_token);
    const issued=await owner.rpc("mitsa_invite_issue",{p_business:f.business,p_email:recipient.email,p_role:"staff",p_locations:[f.shop],p_hash:old});expect(issued.error).toBeNull();
    expect((await api(f.outsider.session.access_token).rpc("mitsa_invite_context",{p_hash:old})).error?.code).toBe("42501");
    expect((await owner.rpc("mitsa_invite_resend",{p_business:f.business,p_invite:issued.data.id,p_hash:current})).error).toBeNull();
    expect((await target.rpc("mitsa_invite_accept",{p_hash:old})).error?.code).toBe("42501");
    const responses=await Promise.all([target.rpc("mitsa_invite_accept",{p_hash:current}),target.rpc("mitsa_invite_accept",{p_hash:current})]);
    expect(responses.every(r=>!r.error&&r.data.accepted===true)).toBe(true);
    const db=await database();try {
      expect((await db.query("select role,active from private.memberships where business_id=$1 and user_id=$2",[f.business,recipient.id])).rows).toEqual([{role:"staff",active:true}]);
      expect((await db.query("select shop_id from private.shop_assignments where business_id=$1 and user_id=$2",[f.business,recipient.id])).rows).toEqual([{shop_id:f.shop}]);
      expect((await db.query("select count(*)::int n from private.access_audit where event='invitation.accepted' and target_id=$1",[issued.data.id])).rows[0].n).toBe(1);
    }finally{await db.end();}
  });
  it("rejects revoked and expired invites without assigning another membership",async()=>{
    const owner=api(f.outsider.session.access_token),target=api(recipient.session.access_token),db=await database();
    try {
      for(const state of ["revoked","expired"]){
        const token=hash(),issued=await owner.rpc("mitsa_invite_issue",{p_business:f.otherBusiness,p_email:recipient.email,p_role:"staff",p_locations:[f.otherShop],p_hash:token});expect(issued.error).toBeNull();
        if(state==="revoked")expect((await owner.rpc("mitsa_invite_revoke",{p_business:f.otherBusiness,p_invite:issued.data.id})).error).toBeNull();
        else await db.query("update private.workspace_invitations set issued_at=now()-interval '8 days',expires_at=now()-interval '1 day' where id=$1",[issued.data.id]);
        expect((await target.rpc("mitsa_invite_accept",{p_hash:token})).error?.code).toBe("42501");
      }
      expect((await db.query("select count(*)::int n from private.memberships where business_id=$1 and user_id=$2",[f.otherBusiness,recipient.id])).rows[0].n).toBe(0);
    }finally{await db.end();}
  });
  it("supports explicit outgoing-Owner removal without breaking sole ownership",async()=>{
    const owner=api(f.owner.session.access_token),incoming=api(f.manager.session.access_token);
    const created=await owner.rpc("mitsa_create_workspace",{p_name:"Synthetic transfer removal",p_location:"Main shop",p_kind:"shop",p_key:randomUUID()});expect(created.error).toBeNull();
    const db=await database();try {
      await db.query("insert into private.memberships(business_id,user_id,role) values($1,$2,'admin')",[created.data.id,f.manager.id]);
      const transfer=await owner.rpc("mitsa_transfer_propose",{p_business:created.data.id,p_incoming:f.manager.id,p_remove_outgoing:true});expect(transfer.error).toBeNull();
      expect((await incoming.rpc("mitsa_transfer_confirm",{p_transfer:transfer.data})).data).toEqual({completed:true});
      expect((await db.query("select user_id,role,active from private.memberships where business_id=$1 order by role",[created.data.id])).rows).toEqual([{user_id:f.owner.id,role:"admin",active:false},{user_id:f.manager.id,role:"owner",active:true}]);
      expect((await owner.rpc("mitsa_workspace",{p_slug:created.data.slug})).error?.code).toBe("42501");
      expect((await incoming.rpc("mitsa_workspace",{p_slug:created.data.slug})).data.role).toBe("owner");
    }finally{await db.end();}
  });
});
