import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), rpc: vi.fn(), formerRpc: vi.fn(), user: vi.fn(), claims: vi.fn(), session: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('node:fs', () => ({ readFileSync: mocks.read, writeFileSync: mocks.write }));
vi.mock('@/lib/supabase/server', () => ({ runtimeConfig: () => ({ origin: 'http://127.0.0.1:3000', url: 'https://mjtejwafxriwntweussc.supabase.co', key: 'synthetic-public-key' }), routeClient: () => ({ client, finish: (response: Response) => response }) }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ schema: () => ({ rpc: mocks.formerRpc }) }) }));
import { inspectBrowserSession, auditBrowserLogout, auditBrowserTenantAccess } from '../../src/lib/security/session-audit';
import { GET } from '../../src/app/testing/auth-security/route';
const id = crypto.randomUUID(), sessionId = crypto.randomUUID(), hash = (value: string) => createHash('sha256').update(value).digest('hex');
const client = { auth: { getUser: mocks.user, getSession: mocks.session, getClaims: mocks.claims }, schema: () => ({ rpc: mocks.rpc }) } as never;
const config = () => ({ project: 'mjtejwafxriwntweussc', userHash: hash(id), foreignBusiness: crypto.randomUUID(), foreignSlug: `workspace-${crypto.randomUUID()}`, expiresAt: Date.now() + 60000 });
beforeEach(() => {
 vi.clearAllMocks(); vi.stubEnv('NODE_ENV', 'development');
 mocks.read.mockReturnValue(JSON.stringify(config())); mocks.user.mockResolvedValue({ data: { user: { id } } });
 mocks.session.mockResolvedValue({ data: { session: { access_token: 'synthetic-private-bearer', refresh_token: 'synthetic-private-refresh' } }, error: null });
 mocks.claims.mockResolvedValue({ data: { claims: { sub: id, session_id: sessionId } }, error: null });
 mocks.rpc.mockImplementation(async (name: string) => name === 'mitsa_identity' ? { data: { userId: id, mfaReady: true }, error: null } : { error: { code: '42501' } });
 mocks.formerRpc.mockResolvedValue({ error: { code: '42501' } });
});
afterEach(() => vi.unstubAllEnvs());
it('is disabled in production without reading the private control or provider', async () => {
 vi.stubEnv('NODE_ENV', 'production'); expect(await inspectBrowserSession(client)).toBeNull(); expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.user).not.toHaveBeenCalled();
});
it('rejects expired control and an unrelated account without inspecting its token', async () => {
 mocks.read.mockReturnValueOnce(JSON.stringify({ ...config(), expiresAt: Date.now() - 1 })); expect(await inspectBrowserSession(client)).toBeNull();
 mocks.user.mockResolvedValue({ data: { user: { id: crypto.randomUUID() } } }); expect(await inspectBrowserSession(client)).toBeNull(); expect(mocks.session).not.toHaveBeenCalled();
});
it('requires live database identity, matching claims and trusted MFA', async () => {
 mocks.rpc.mockResolvedValueOnce({ error: { code: '42501' } }); expect(await inspectBrowserSession(client, true)).toBeNull();
 mocks.claims.mockResolvedValue({ data: { claims: { sub: crypto.randomUUID(), session_id: sessionId } } }); expect(await inspectBrowserSession(client, true)).toBeNull();
 expect(mocks.write.mock.calls.every(call => call[0] === 'artifacts/security-session-diagnostic.json')).toBe(true);
 expect(JSON.parse(mocks.write.mock.calls.at(-1)![1]).stage).toBe('session-claims-unconfirmed');
});
it('records only fingerprints and actual tenant denial, never bearer, refresh, raw user or session IDs', async () => {
 expect(await auditBrowserTenantAccess(client)).toEqual({passed:true,reason:'verified'});
 const output = mocks.write.mock.calls[0][1] as string;
 expect(output.includes(hash(sessionId))).toBe(true);
 for (const secret of [id, sessionId, 'synthetic-private-bearer', 'synthetic-private-refresh']) expect(output.includes(secret)).toBe(false);
 mocks.rpc.mockImplementation(async (name: string) => name === 'mitsa_identity' ? { data: { userId: id, mfaReady: true } } : { data: {} });
 expect(await auditBrowserTenantAccess(client)).toEqual({passed:false,reason:'cross-workspace-denial-unconfirmed'});
});
it('retains failed logout evidence and never labels an accepted bearer as denied', async () => {
 const scope = await inspectBrowserSession(client); mocks.formerRpc.mockResolvedValue({ data: {} });
 await auditBrowserLogout(scope, false);
 expect(JSON.parse(mocks.write.mock.calls.at(-1)![1]).formerBearerDenied).toBe(false);
 await auditBrowserLogout(scope, true);
 expect(JSON.parse(mocks.write.mock.calls.at(-1)![1]).logoutProviderReportedSuccess).toBe(false);
});
it('explains a different signed-in account and does not inspect its bearer or run tenant probes', async () => {
 mocks.user.mockResolvedValue({ data: { user: { id: crypto.randomUUID() } } });
 const response = await GET(new NextRequest('http://127.0.0.1:3000/testing/auth-security'));
 expect(response.status).toBe(404); expect((await response.json()).message).toContain('different account');
 expect(mocks.session).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
});
it('distinguishes a missing session from trusted MFA verification without suggesting enrollment', async () => {
 mocks.user.mockResolvedValueOnce({ data: { user: null }, error: { status: 401 } });
 const missing = await GET(new NextRequest('http://127.0.0.1:3000/testing/auth-security'));
 expect((await missing.json()).message).toContain('no confirmed active sign-in');
 mocks.rpc.mockResolvedValueOnce({ data: { userId: id, mfaReady: false } });
 const mfa = await GET(new NextRequest('http://127.0.0.1:3000/testing/auth-security'));
 expect((await mfa.json()).message).toContain('Do not enroll a new authenticator');
});
it('suppresses provider exceptions and records a bounded service-failure category', async () => {
 mocks.user.mockRejectedValue(Error('synthetic-private-provider-detail'));
 const response = await GET(new NextRequest('http://127.0.0.1:3000/testing/auth-security'));
 expect(response.status).toBe(404); expect(JSON.stringify(await response.json())).not.toContain('synthetic-private-provider-detail');
 expect(JSON.parse(mocks.write.mock.calls.at(-1)![1]).stage).toBe('diagnostic-service-unavailable');
});
