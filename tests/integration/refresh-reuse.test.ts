import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createSyntheticUser, database, publicClient, hostedConfig } from '../support/hosted';

it.each([{mode:'inside-post-revocation-interval',delay:0},{mode:'after-post-revocation-interval',delay:12000}])('records provider rotation/reuse and application enforcement: $mode', async ({mode,delay}) => {
 const user = await createSyntheticUser('refresh-reuse-signoff');
 let current = user.session;
 const tokens = new Set([current.refresh_token]);
 for (let index = 0; index < 3; index++) {
  const next = await publicClient().auth.refreshSession({ refresh_token: current.refresh_token });
  expect(Boolean(!next.error && next.data.session)).toBe(true);
  current = next.data.session!; tokens.add(current.refresh_token);
 }
 await new Promise(resolve => setTimeout(resolve, 12000));
 const sessionId = (await publicClient().auth.getClaims(current.access_token)).data?.claims.session_id;
 const db = await database();
 const metadata = async () => (await db.query("select count(*)::int sessions,(select count(*)::int from auth.refresh_tokens r where r.session_id=$1 and not r.revoked) live_refresh,(select count(*)::int from auth.refresh_tokens r where r.session_id=$1) refresh_history from auth.sessions s where s.id=$1 and s.user_id=$2", [sessionId, user.id])).rows[0];
 const beforeReplay = await metadata();
 const replay = await publicClient().auth.refreshSession({ refresh_token: user.session.refresh_token });
 const afterReplay = await metadata();
 const immediatelyProtected = await publicClient(current.access_token).schema('api').rpc('mitsa_identity');
 if(delay)await new Promise(resolve => setTimeout(resolve,delay));
 const stillRefreshes = await publicClient().auth.refreshSession({ refresh_token: current.refresh_token });
 const protectedResult = await publicClient(current.access_token).schema('api').rpc('mitsa_identity');
 try {
  const state = await metadata();
  const classify = (code: string | undefined) => !code ? 'none' : ['refresh_token_already_used','refresh_token_not_found','session_not_found','session_expired','over_request_rate_limit'].includes(code) ? code : 'other';
  const report = { checkedAt: new Date().toISOString(), project: hostedConfig().projectRef,mode,postRevocationDelayMs:delay, distinctRefreshTokensObserved: tokens.size,
   staleReuseRejected: replay.error?.code === 'refresh_token_already_used' && !replay.data.session,
   replayErrorCategory: classify(replay.error?.code), replayHttpStatus: replay.error?.status ?? null,
   newestRefreshRejectedAfterReuse: ['refresh_token_already_used','refresh_token_not_found','session_not_found','session_expired'].includes(stillRefreshes.error?.code ?? '') && !stillRefreshes.data.session,
   newestRefreshErrorCategory: classify(stillRefreshes.error?.code), beforeReplay, immediatelyAfterReplay: afterReplay,
   formerBearerDeniedImmediately: immediatelyProtected.error?.code === '42501',formerBearerDeniedAfterRefreshAttempt:protectedResult.error?.code==='42501', sessionRowsRetained: state.sessions, nonRevokedRefreshRecords: state.live_refresh, refreshHistoryRecords: state.refresh_history, fixtureOnly: true, externalEmailsSent: 0, privateValuesPrinted: false };
  writeFileSync(`artifacts/refresh-reuse-${mode}.json`, JSON.stringify(report, null, 2) + '\n');
  expect(report.staleReuseRejected).toBe(true); expect(report.newestRefreshRejectedAfterReuse).toBe(true);
  expect(report.formerBearerDeniedImmediately).toBe(true);
 } finally { await db.end(); }
}, 60000);
