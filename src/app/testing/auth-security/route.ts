import { NextRequest, NextResponse } from 'next/server';
import { routeClient } from '@/lib/supabase/server';
import { auditBrowserTenantAccess } from '@/lib/security/session-audit';

export async function GET(request: NextRequest) {
  const { client, finish } = routeClient(request);
  const result = await auditBrowserTenantAccess(client);
  if (!result.passed) {
    const messages: Record<string, string> = {
      'different-authenticated-identity': 'This browser is signed in to a different account. Use the Guest profile signed in as Yuno. No account was changed.',
      'provider-session-unavailable': 'This browser has no confirmed active sign-in. Sign in to the existing Yuno test account, then verify its existing authenticator. Do not register or enroll again.',
      'trusted-mfa-unconfirmed': 'This session needs verification with Yuno’s existing authenticator. Do not enroll a new authenticator.',
      'cross-workspace-denial-unconfirmed': 'Cross-workspace rejection was not confirmed. Stop; do not sign out for this diagnostic.',
    };
    return finish(NextResponse.json({ message: messages[result.reason] ?? 'Session diagnostic unavailable. Stop; the private failure category has been recorded.' }, { status: 404 }));
  }
  return finish(NextResponse.json({ message: 'Current test session identified. Cross-workspace and member access rejected. Return to Workspaces and select Sign out once.' }));
}
