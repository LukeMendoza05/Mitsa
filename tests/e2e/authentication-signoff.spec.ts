import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'dotenv';
import { decrypt, readMessage, readPrivateKey } from 'openpgp';
import { database, hostedConfig, publicClient, enrollSyntheticMfa } from '../support/hosted';
import { capturedSignupCode } from '../support/email-code';
import { signIntentRequest } from '../../supabase/functions/_shared/registration-intent-auth';
import { sealAuthFlow } from '../../src/lib/security/auth-flow';
import { fillPrivateInput } from '../support/private-input';
import { totp } from '../support/totp';

// Real provider-issued tokens, encrypted capture and production form handlers.
// Every mutation is restricted to a NEW example.invalid fixture; SMTP remains
// closed. Token-bearing URLs, traces, screenshots and raw provider errors are
// deliberately excluded, including on failure.
test('captured new-user recovery validates expiry/replay, requires existing MFA and preserves workspace access', async ({ browser }, info) => {
 const origin = 'http://127.0.0.1:3000', cfg = hostedConfig(), local = parse(readFileSync('.env.local'));
 const user = { email: `foundation-signoff-recovery-${crypto.randomUUID()}@example.invalid`, password: `M1!${crypto.randomUUID()}`, fullName: 'Synthetic recovery sign-off' };
 const hash = createHash('sha256').update(user.email).digest('hex');
 const db = await database(), context = await browser.newContext(), page = await context.newPage();
 try {
  expect((await db.query('select enabled or smtp_enabled or private.mitsa_pilot_registration_open() opened from private.pilot_registration_window')).rows[0].opened).toBe(false);
  await db.query('insert into private.registration_test_recipients(email,enabled) values($1,true)', [user.email]);
  const policy = (await publicClient().schema('api').rpc('mitsa_registration_policy')).data;
  const body = JSON.stringify({ email: user.email, fullName: user.fullName, termsVersion: policy.id, accepted: true });
  const intentResponse = await fetch(`${cfg.url}/functions/v1/mitsa-registration-intent`, { method: 'POST', body, headers: { apikey: cfg.publishableKey, origin, 'content-type': 'application/json', ...await signIntentRequest(local.MITSA_REGISTRATION_INTENT_KEY, body) } });
  expect(intentResponse.ok).toBe(true); const intent = await intentResponse.json();
  const native = publicClient();
  const signup = await native.auth.signUp({ email: user.email, password: user.password, options: { data: { registration_nonce: intent.nonce, full_name: user.fullName }, emailRedirectTo: `${origin}/auth/email` } });
  expect(Boolean(!signup.error && signup.data.user && !signup.data.session)).toBe(true);
  const confirmed = await native.auth.verifyOtp({ type: 'signup', email: user.email, token: await capturedSignupCode(user) });
  expect(Boolean(!confirmed.error && confirmed.data.session && confirmed.data.user)).toBe(true);
  expect((await native.schema('api').rpc('mitsa_finalize_registration')).data).toBe(true);
  // Email verification alone intentionally cannot authorize factor enrollment.
  // Reproduce the application's required current-password confirmation first.
  const passwordProof = await publicClient().auth.signInWithPassword({ email: user.email, password: user.password });
  expect(Boolean(!passwordProof.error && passwordProof.data.session)).toBe(true);
  const secured = await enrollSyntheticMfa({ ...user, id: confirmed.data.user!.id, session: passwordProof.data.session! });
  const workspace = await publicClient(secured.session.access_token).schema('api').rpc('mitsa_create_workspace', { p_name: 'Synthetic recovery security', p_location: 'Main', p_kind: 'shop', p_key: crypto.randomUUID() });
  expect(workspace.error).toBeNull();

  async function requestRecovery() {
   const response = await publicClient().auth.resetPasswordForEmail(user.email, { redirectTo: `${origin}/auth/email` }); expect(Boolean(response.error)).toBe(false);
   const row = (await db.query("select encrypted_payload from private.isolated_auth_mail where recipient_hash=$1 and action='recovery' order by created_at desc limit 1", [hash])).rows[0]; expect(Boolean(row)).toBe(true);
   const key = await readPrivateKey({ armoredKey: readFileSync('.secrets/auth-mail/private.asc', 'utf8') });
   const mail = JSON.parse(String((await decrypt({ message: await readMessage({ binaryMessage: row.encrypted_payload }), decryptionKeys: key })).data));
   expect(mail.email === user.email && mail.userId === secured.id && mail.type === 'recovery' && mail.origin === origin && typeof mail.tokenHash === 'string').toBe(true);
   return mail.tokenHash as string;
  }
  async function consume(tokenHash: string) {
   const sealed = sealAuthFlow({ purpose: 'email', type: 'recovery', tokenHash, expiresAt: Date.now() + 600000 }, local.AUTH_FLOW_KEY);
   await context.addCookies([{ name: 'mitsa-auth-flow', value: sealed, url: origin, httpOnly: true, sameSite: 'Lax' }]);
   return context.request.post(`${origin}/auth/email`, { headers: { origin }, maxRedirects: 0 });
  }
  const first = await requestRecovery();
  await db.query("update auth.users set recovery_sent_at=statement_timestamp()-interval '3601 seconds' where id=$1 and email=$2", [secured.id, user.email]);
  expect((await consume(first)).headers().location).toContain('/reset-password?error=expired');
  expect((await consume('a'.repeat(64))).headers().location).toContain('/reset-password?error=expired');
  const fresh = await requestRecovery(); expect(first === fresh).toBe(false);
  expect((await consume(fresh)).headers().location).toBe(`${origin}/reset-password`);
  const validRecoveryCookie = (await context.cookies()).find(c => c.name === 'mitsa-auth-flow')!;
  expect((await consume(fresh)).headers().location).toContain('error=expired');
  await context.addCookies([validRecoveryCookie]);
  const changed = `M2!${crypto.randomUUID()}`;
  const bypass = await context.request.post(`${origin}/auth/password/reset`, { headers: { origin }, form: { password: changed, confirmPassword: changed }, maxRedirects: 0 });
  expect(bypass.headers().location).toContain('error=authenticator');
  await page.goto('/reset-password');
  await expect(page.getByRole('button', { name: 'Verify recovery authenticator', exact: true })).toBeVisible();
  await fillPrivateInput(page.getByLabel('Recovery authenticator code', { exact: true }), totp(secured.totpSecret));
  await page.getByRole('button', { name: 'Verify recovery authenticator', exact: true }).click();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await fillPrivateInput(page.getByLabel('New password', { exact: true }), changed);
  await fillPrivateInput(page.getByLabel('Confirm new password', { exact: true }), changed);
  await page.getByRole('button', { name: 'Update password', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/login?updated=password`);
  expect((await publicClient(secured.session.access_token).schema('api').rpc('mitsa_workspace', { p_slug: workspace.data.slug })).error?.code).toBe('42501');
  const oldPassword = await publicClient().auth.signInWithPassword({ email: user.email, password: user.password }); expect(Boolean(oldPassword.error)).toBe(true);
  const returning = publicClient(); expect((await returning.auth.signInWithPassword({ email: user.email, password: changed })).error).toBeNull();
  expect((await returning.schema('api').rpc('mitsa_workspace', { p_slug: workspace.data.slug })).error?.code).toBe('42501');
  expect((await returning.auth.mfa.challengeAndVerify({ factorId: secured.factorId, code: totp(secured.totpSecret) })).error).toBeNull();
  expect((await returning.schema('api').rpc('mitsa_workspace', { p_slug: workspace.data.slug })).data?.role).toBe('owner');
  expect((await db.query("select count(*)::int n from auth.mfa_factors where user_id=$1 and id=$2 and status='verified'", [secured.id, secured.factorId])).rows[0].n).toBe(1);
  expect((await db.query('select count(*)::int n from private.pilot_mail_deliveries where recipient_hash=$1', [hash])).rows[0].n).toBe(0);
  writeFileSync(`artifacts/recovery-security-${info.project.name}.json`, JSON.stringify({ checkedAt: new Date().toISOString(), project: cfg.projectRef, nativeSignupFinalized: true, providerIssuedEncryptedRecoveryCaptured: true, expiredTokenRejected: true, invalidTokenRejected: true, tokenReplayRejected: true, passwordResetWithoutMfaDenied: true, existingMfaRequiredAndPreserved: true, formerBearerDenied: true, oldPasswordRejected: true, returningAccessRequiresMfa: true, sameFixtureWorkspaceReopened: true, liveOrdinaryRecipientHookNotExercised: true, externalEmailsSent: 0, privateValuesPrinted: false }, null, 2) + '\n');
 } finally { await context.close(); await db.end(); }
});
