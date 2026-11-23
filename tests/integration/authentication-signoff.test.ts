import { beforeAll, describe, expect, it } from 'vitest';
import { createServerClient } from '@supabase/ssr';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { securityFixture, resource } from '../support/fixtures';
import { database, hostedConfig, publicClient } from '../support/hosted';

// Only newly-created example.invalid fixtures are changed. Existing human
// identities, memberships, factors and business records are never mutated.
describe('Isolated authentication security sign-off', () => {
  let f: Awaited<ReturnType<typeof securityFixture>>;
  const checks: Record<string, boolean> = {};
  beforeAll(async () => { f = await securityFixture(); }, 240000);
  const api = (token: string) => publicClient(token).schema('api');

  it('denies authenticated workspace/member/identifier switching and protects both retained workspaces', async () => {
    const db = await database();
    try {
      const own = (await db.query('select slug from private.businesses where id=$1', [f.business])).rows[0].slug;
      expect((await api(f.owner.session.access_token).rpc('mitsa_workspace', { p_slug: own })).error).toBeNull();
      expect((await api(f.outsider.session.access_token).rpc('mitsa_workspace', { p_slug: own })).error?.code).toBe('42501');
      expect((await api(f.outsider.session.access_token).rpc('mitsa_members', { p_business: f.business })).error?.code).toBe('42501');
      const retained = (await db.query("select id,slug from private.businesses where name in ('D Extacy Fireworks','L.F Fireworks') and status='active'")).rows;
      expect(retained.length >= 2).toBe(true);
      for (const workspace of retained) {
        expect((await api(f.owner.session.access_token).rpc('mitsa_workspace', { p_slug: workspace.slug })).error?.code).toBe('42501');
        expect((await api(f.owner.session.access_token).rpc('mitsa_members', { p_business: workspace.id })).error?.code).toBe('42501');
      }
      expect((await publicClient(f.owner.session.access_token).schema('private').from('memberships').select('user_id')).error?.code).toBe('PGRST106');
      checks.authenticatedCrossTenantDenial = true;
      checks.retainedWorkspacesDeniedToUnrelatedIdentity = true;
    } finally { await db.end(); }
  });

  it('enforces Owner/Admin/Staff location, financial and role boundaries through real signed requests', async () => {
    const allowed = await resource(f.business, f.shop), unassigned = await resource(f.business, f.secondShop), other = await resource(f.otherBusiness, f.otherShop);
    for (const [user, visible] of [[f.owner, [allowed, unassigned]], [f.manager, [allowed, unassigned]], [f.cashier, [allowed]]] as const) {
      const rows = await api(user.session.access_token).from('foundation_resources').select('id').in('id', [allowed, unassigned, other]);
      expect(rows.error).toBeNull(); expect(rows.data?.map(row => row.id).sort()).toEqual([...visible].sort());
    }
    const command = (business: string, id: string) => api(f.cashier.session.access_token).rpc('foundation_increment', { p_business: business, p_resource: id, p_delta: 1, p_key: crypto.randomUUID() });
    expect((await command(f.business, unassigned)).error?.code).toBe('42501');
    expect((await command(f.otherBusiness, other)).error?.code).toBe('42501');
    expect((await command(f.business, other)).error?.code).toBe('42501');
    for (const user of [f.manager, f.cashier]) expect((await api(user.session.access_token).rpc('mitsa_financial_setting', { p_business: f.business, p_enabled: true })).error?.code).toBe('42501');
    expect((await api(f.manager.session.access_token).rpc('mitsa_member_update', { p_business: f.business, p_user: f.cashier.id, p_role: 'admin', p_active: true, p_locations: [] })).error?.code).toBe('42501');
    const db = await database();
    try { expect((await db.query('select bool_and(value=0) unchanged from foundation_probe.resources where id=any($1::uuid[])', [[allowed, unassigned, other]])).rows[0].unchanged).toBe(true); }
    finally { await db.end(); }
    checks.locationRlsAndIdentifierManipulationDenied = true; checks.rbacAndFinancialDenial = true;
  });

  it('rejects stale rotated-refresh reuse and revokes only that synthetic session', async () => {
    const signed = await publicClient().auth.signInWithPassword({ email: f.cashier.email, password: f.cashier.password });
    expect(Boolean(!signed.error && signed.data.session)).toBe(true);
    const original = signed.data.session!;
    let current = original;
    for (let index = 0; index < 3; index++) {
      const next = await publicClient().auth.refreshSession({ refresh_token: current.refresh_token });
      expect(Boolean(!next.error && next.data.session)).toBe(true);
      current = next.data.session!;
    }
    // Outside the documented default 10-second reuse interval; the original
    // is also no longer the immediate parent of the current refresh token.
    await new Promise(resolve => setTimeout(resolve, 12000));
    const replay = await publicClient().auth.refreshSession({ refresh_token: original.refresh_token });
    expect(replay.error?.code === 'refresh_token_already_used' && replay.data.session === null).toBe(true);
    expect((await api(current.access_token).rpc('mitsa_identity')).error?.code).toBe('42501');
    expect((await api(f.cashier.session.access_token).rpc('mitsa_identity')).error).toBeNull();
    checks.rotatedRefreshReplayRejected = true; checks.reuseRevokesAffectedSessionOnly = true;
  });

  it('revokes the exact cookie session with native local logout, denies its bearer and refresh, preserves a second session', async () => {
    const origin = 'http://127.0.0.1:3000', cfg = hostedConfig();
    const login = await fetch(`${origin}/auth/login`, { method: 'POST', redirect: 'manual', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: f.cashier.email, password: f.cashier.password }) });
    expect(login.status).toBe(303);
    const cookies = login.headers.getSetCookie().map(value => { const pair = value.split(';')[0], split = pair.indexOf('='); return { name: pair.slice(0, split), value: pair.slice(split + 1) }; });
    const ssr = createServerClient(cfg.url, cfg.publishableKey, { cookies: { getAll: () => cookies, setAll: () => {} } });
    const current = await ssr.auth.getSession(); expect(Boolean(current.data.session)).toBe(true);
    const session = current.data.session!, claims = await ssr.auth.getClaims();
    const sessionId = claims.data?.claims.session_id; expect(typeof sessionId === 'string').toBe(true);
    expect((await api(session.access_token).rpc('mitsa_identity')).error).toBeNull();
    const logout = await fetch(`${origin}/auth/logout`, { method: 'POST', redirect: 'manual', headers: { origin, cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ') } });
    expect(logout.status).toBe(303); expect(logout.headers.get('location')).toBe(`${origin}/login`);
    expect(logout.headers.getSetCookie().some(c => c.startsWith('sb-') && c.includes('Max-Age=0'))).toBe(true);
    expect((await api(session.access_token).rpc('mitsa_identity')).error?.code).toBe('42501');
    expect((await api(session.access_token).rpc('foundation_identity')).error?.code).toBe('42501');
    const reused = await publicClient().auth.refreshSession({ refresh_token: session.refresh_token });
    expect(Boolean(reused.error) && reused.data.session === null).toBe(true);
    expect((await api(f.cashier.session.access_token).rpc('mitsa_identity')).error).toBeNull();
    const db = await database();
    try {
      expect((await db.query('select count(*)::int n from auth.sessions where id=$1 and user_id=$2', [sessionId, f.cashier.id])).rows[0].n).toBe(0);
      expect((await db.query('select count(*)::int n from auth.refresh_tokens where session_id=$1 and not revoked', [sessionId])).rows[0].n).toBe(0);
    } finally { await db.end(); }
    checks.exactCookieSessionRevoked = true; checks.formerBearerDenied = true; checks.revokedRefreshDenied = true; checks.otherSessionPreserved = true;
    writeFileSync('artifacts/authentication-signoff-hosted.json', JSON.stringify({ checkedAt: new Date().toISOString(), project: cfg.projectRef, ...checks, sessionFingerprint: createHash('sha256').update(String(sessionId)).digest('hex'), fixtureScope: 'new-example.invalid-identities-only', humanSessionCorrelation: false, externalEmailsSent: 0, privateValuesPrinted: false }, null, 2) + '\n');
  });
});
