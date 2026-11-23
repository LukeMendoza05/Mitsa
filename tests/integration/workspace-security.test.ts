import { beforeAll, describe, expect, it } from "vitest";
import { createSyntheticUser, database, enrollSyntheticMfa, publicClient } from "../support/hosted";
import { securityFixture } from "../support/fixtures";
import { createHash } from "node:crypto";

describe("Mitsa isolated workspace authorization", () => {
  let f: Awaited<ReturnType<typeof securityFixture>>;
  const api = (token: string) => publicClient(token).schema("api");
  beforeAll(async () => { f = await securityFixture(); }, 240000);

  it("grants Owner/Admin every operational location and scopes Staff", async () => {
    const db = await database();
    const slug = (await db.query("select slug from private.businesses where id=$1", [f.business])).rows[0].slug;
    await db.end();
    for (const [user, role, locationCount] of [[f.owner, "owner", 2], [f.manager, "admin", 2], [f.cashier, "staff", 1]] as const) {
      const result = await api(user.session.access_token).rpc("mitsa_workspace", { p_slug: slug });
      expect(result.error).toBeNull();
      expect(result.data.role).toBe(role);
      expect(result.data.locations).toHaveLength(locationCount);
    }
    expect((await api(f.outsider.session.access_token).rpc("mitsa_workspace", { p_slug: slug })).error?.code).toBe("42501");
  });

  it("blocks an Owner's fresh password-only session before MFA", async () => {
    const signedIn = await publicClient().auth.signInWithPassword({ email: f.owner.email, password: f.owner.password });
    expect(signedIn.error).toBeNull();
    const token = signedIn.data.session!.access_token;
    const identity = await api(token).rpc("mitsa_identity");
    expect(identity.data.mfaReady).toBe(false);
    expect((await api(token).rpc("mitsa_members", { p_business: f.business })).error?.code).toBe("42501");
    expect((await api(token).rpc("mitsa_create_workspace", { p_name: "Synthetic denied", p_location: "Main", p_kind: "shop", p_key: crypto.randomUUID() })).error?.code).toBe("42501");
  });

  it("creates once under concurrent replay and preserves the sole Owner", async () => {
    const args = { p_name: "Synthetic additional workspace", p_location: "Main warehouse", p_kind: "warehouse", p_key: crypto.randomUUID() };
    const [first, repeat] = await Promise.all([api(f.owner.session.access_token).rpc("mitsa_create_workspace", args), api(f.owner.session.access_token).rpc("mitsa_create_workspace", args)]);
    expect(first.error).toBeNull(); expect(repeat.error).toBeNull(); expect(repeat.data).toEqual(first.data);
    expect((await api(f.owner.session.access_token).rpc("mitsa_create_workspace", { ...args, p_name: "Different request" })).error?.code).toBe("23505");
    const db = await database();
    try {
      expect((await db.query("select user_id,role from private.memberships where business_id=$1 and active", [first.data.id])).rows).toEqual([{ user_id: f.owner.id, role: "owner" }]);
      expect((await db.query("select count(*)::int n from private.shops where business_id=$1", [first.data.id])).rows[0].n).toBe(1);
      await expect(db.query("update private.memberships set active=false where business_id=$1 and role='owner'", [first.data.id])).rejects.toMatchObject({ code: "23514" });
    } finally { await db.end(); }
  });

  it("allows only the Owner to change the workspace-wide financial setting", async () => {
    const admin = api(f.manager.session.access_token);
    expect((await admin.rpc("mitsa_financial_setting", { p_business: f.business, p_enabled: true })).error?.code).toBe("42501");
    expect((await api(f.cashier.session.access_token).rpc("mitsa_financial_setting", { p_business: f.business, p_enabled: true })).error?.code).toBe("42501");
    expect((await api(f.owner.session.access_token).rpc("mitsa_financial_setting", { p_business: f.business, p_enabled: true })).error).toBeNull();
    const db = await database();
    try { expect((await db.query("select admin_financial_access from private.businesses where id=$1", [f.business])).rows[0].admin_financial_access).toBe(true); }
    finally { await db.end(); }
  });

  it("denies Admin promotion, Owner removal and cross-workspace assignment", async () => {
    const args = { p_business: f.business, p_user: f.cashier.id, p_role: "admin", p_active: true, p_locations: [] };
    expect((await api(f.manager.session.access_token).rpc("mitsa_member_update", args)).error?.code).toBe("42501");
    expect((await api(f.manager.session.access_token).rpc("mitsa_member_update", { ...args, p_user: f.owner.id, p_role: "staff" })).error?.code).toBe("42501");
    expect((await api(f.owner.session.access_token).rpc("mitsa_member_update", { ...args, p_role: "staff", p_locations: [f.otherShop] })).error?.code).toBe("22023");
  });

  it("issues hash-only seven-day invitations and denies Admin invitations by Admin", async () => {
    const hash = createHash("sha256").update(crypto.randomUUID()).digest("hex");
    const args = { p_business: f.business, p_email: "synthetic-recipient@example.invalid", p_role: "staff", p_locations: [f.shop], p_hash: hash };
    expect((await api(f.manager.session.access_token).rpc("mitsa_invite_issue", { ...args, p_role: "admin" })).error?.code).toBe("42501");
    expect((await api(f.cashier.session.access_token).rpc("mitsa_invite_issue", args)).error?.code).toBe("42501");
    const invite = await api(f.owner.session.access_token).rpc("mitsa_invite_issue", args);
    expect(invite.error).toBeNull();
    const db = await database();
    try {
      const row = (await db.query("select token_hash,extract(epoch from expires_at-issued_at)::int duration from private.workspace_invitations where id=$1", [invite.data.id])).rows[0];
      expect(row).toEqual({ token_hash: hash, duration: 604800 });
    } finally { await db.end(); }
    expect((await api(f.cashier.session.access_token).rpc("mitsa_invite_context", { p_hash: hash })).error?.code).toBe("42501");
    expect((await api(f.owner.session.access_token).rpc("mitsa_invite_revoke", { p_business: f.business, p_invite: invite.data.id })).error).toBeNull();
    expect((await api(f.cashier.session.access_token).rpc("mitsa_invite_accept", { p_hash: hash })).error?.code).toBe("42501");
  });

  it("atomically transfers ownership and resets financial access for all Admins", async () => {
    const proposed = await api(f.owner.session.access_token).rpc("mitsa_transfer_propose", { p_business: f.business, p_incoming: f.manager.id, p_remove_outgoing: false });
    expect(proposed.error).toBeNull();
    expect((await api(f.cashier.session.access_token).rpc("mitsa_transfer_confirm", { p_transfer: proposed.data })).error?.code).toBe("42501");
    const confirmed = await api(f.manager.session.access_token).rpc("mitsa_transfer_confirm", { p_transfer: proposed.data });
    expect(confirmed.error).toBeNull(); expect(confirmed.data).toEqual({ completed: true });
    const db = await database();
    try {
      expect((await db.query("select primary_owner_id,admin_financial_access from private.businesses where id=$1", [f.business])).rows[0]).toEqual({ primary_owner_id: f.manager.id, admin_financial_access: false });
      expect((await db.query("select user_id,role from private.memberships where business_id=$1 and user_id in($2,$3) order by role", [f.business, f.owner.id, f.manager.id])).rows).toEqual([{ user_id: f.owner.id, role: "admin" }, { user_id: f.manager.id, role: "owner" }]);
    } finally { await db.end(); }
    expect((await api(f.owner.session.access_token).rpc("mitsa_financial_setting", { p_business: f.business, p_enabled: true })).error?.code).toBe("42501");
  });

  it("does not accept an unapproved newly verified factor after out-of-band removal", async () => {
    const victim = await enrollSyntheticMfa(await createSyntheticUser("mfa-removal"));
    const client = publicClient();
    await client.auth.setSession({ access_token: victim.session.access_token, refresh_token: victim.session.refresh_token });
    expect((await client.auth.mfa.unenroll({ factorId: victim.factorId })).error).toBeNull();
    expect((await api(victim.session.access_token).rpc("mitsa_identity")).data.mfaReady).toBe(false);
    expect((await client.schema("api").rpc("mitsa_prepare_enrollment")).error?.code).toBe("42501");
  }, 120000);
});
