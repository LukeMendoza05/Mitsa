import 'server-only';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runtimeConfig } from '@/lib/supabase/server';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const controlSchema = z.object({ project: z.literal('unconfiguredpreviewx'), userHash: z.string().regex(/^[a-f0-9]{64}$/), foreignBusiness: z.uuid(), foreignSlug: z.string().regex(/^workspace-[a-f0-9-]+$/), expiresAt: z.number() }).strict();
const reportPath = 'artifacts/security-session-live.json';
function unavailable(stage: string) {
  try { writeFileSync('artifacts/security-session-diagnostic.json', JSON.stringify({ checkedAt: new Date().toISOString(), source: 'testing-auth-security', stage, passed: false, privateValuesPrinted: false }) + '\n', { mode: 0o600 }); } catch {}
  return null;
}
function control(recordFailure: boolean) {
  const fail = recordFailure ? unavailable : () => null;
  // This diagnostic is unavailable in production and outside exact loopback.
  if (process.env.NODE_ENV !== 'development') return null;
  try {
    const env = runtimeConfig();
    if (env.origin !== 'http://127.0.0.1:3000') return fail('runtime-origin');
    const config = controlSchema.parse(JSON.parse(readFileSync('.secrets/auth-security-audit.json', 'utf8')));
    if (config.expiresAt <= Date.now() || config.expiresAt > Date.now() + 3600000) return fail('diagnostic-window');
    return config;
  } catch { return fail('diagnostic-configuration'); }
}
function save(report: Record<string, unknown>) {
  try { writeFileSync(reportPath, JSON.stringify({ ...report, privateValuesPrinted: false }, null, 2) + '\n', { mode: 0o600 }); }
  catch { /* Diagnostic failure must never interfere with sign-out. */ }
}

export async function inspectBrowserSession(client: SupabaseClient, recordFailure = false, onFailure?: (stage: string) => void) {
  const fail = (stage: string) => { onFailure?.(stage); return recordFailure ? unavailable(stage) : null; };
  const config = control(recordFailure); if (!config) return null;
  const user = await client.auth.getUser();
  if (user.error || !user.data.user) return fail('provider-session-unavailable');
  if (digest(user.data.user.id) !== config.userHash) return fail('different-authenticated-identity');
  const session = await client.auth.getSession();
  if (session.error || !session.data.session) return fail('session-cookie-unavailable');
  const claims = await client.auth.getClaims(session.data.session.access_token);
  const id = claims.data?.claims.session_id;
  if (claims.error || typeof id !== 'string' || claims.data?.claims.sub !== user.data.user.id) return fail('session-claims-unconfirmed');
  const identity = await client.schema('api').rpc('mitsa_identity');
  if (identity.error || identity.data?.userId !== user.data.user.id) return fail('database-session-unconfirmed');
  if (identity.data?.mfaReady !== true) return fail('trusted-mfa-unconfirmed');
  return { config, session: session.data.session, sessionHash: digest(id), userHash: config.userHash };
}

export async function auditBrowserTenantAccess(client: SupabaseClient) {
  try {
  let reason = 'diagnostic-configuration';
  const scope = await inspectBrowserSession(client, true, stage => { reason = stage; }); if (!scope) return { passed: false, reason };
  const workspace = await client.schema('api').rpc('mitsa_workspace', { p_slug: scope.config.foreignSlug });
  const members = await client.schema('api').rpc('mitsa_members', { p_business: scope.config.foreignBusiness });
  const denied = workspace.error?.code === '42501' && members.error?.code === '42501';
  if (!denied) unavailable('cross-workspace-denial-unconfirmed');
  save({ checkedAt: new Date().toISOString(), project: scope.config.project, userHash: scope.userHash, sessionHash: scope.sessionHash, authenticatedAal2: true, foreignWorkspaceDenied: workspace.error?.code === '42501', foreignMembersDenied: members.error?.code === '42501', logoutObserved: false });
  return { passed: denied, reason: denied ? 'verified' : 'cross-workspace-denial-unconfirmed' };
  } catch {
    unavailable('diagnostic-service-unavailable');
    return { passed: false, reason: 'diagnostic-service-unavailable' };
  }
}

export async function auditBrowserLogout(scope: Awaited<ReturnType<typeof inspectBrowserSession>>, logoutError: boolean) {
  if (!scope) return;
  // The old bearer stays only in server memory. No refresh is attempted on a
  // human session, and no other sessions or factors are revoked by this audit.
  try {
    const env = runtimeConfig();
    const former = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${scope.session.access_token}` }, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) } });
    const result = await former.schema('api').rpc('mitsa_identity');
    let previous: Record<string, unknown> = {};
    try { const existing = JSON.parse(readFileSync(reportPath, 'utf8')); if (existing.sessionHash === scope.sessionHash && existing.userHash === scope.userHash) previous = existing; } catch {}
    save({ ...previous, checkedAt: new Date().toISOString(), project: scope.config.project, userHash: scope.userHash, sessionHash: scope.sessionHash, authenticatedAal2: true, logoutObserved: true, logoutProviderReportedSuccess: !logoutError, formerBearerDenied: result.error?.code === '42501', otherSessionsRevokedByDiagnostic: false });
  } catch { save({ checkedAt: new Date().toISOString(), project: scope.config.project, userHash: scope.userHash, sessionHash: scope.sessionHash, logoutObserved: true, logoutVerificationUnavailable: true }); }
}
