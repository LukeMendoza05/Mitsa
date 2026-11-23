import type { Metadata } from "next";
import { LegalDraft } from "@/components/site/LegalDraft";

export const metadata: Metadata = { title: "Cookies & Local Storage — Draft", description: "Review draft of the essential storage used by Mitsa’s account and security foundation." };
export default function CookiesPage() {
  return <LegalDraft title="Cookies & Local Storage">
    <section><h2>Essential storage</h2><p>Mitsa’s current account foundation uses essential session and security cookies. Authentication is handled on the server; application JavaScript is not given the session or refresh-token values. A cookie may be split into several chunks when necessary.</p>
      <table><caption>Current essential account storage</caption><thead><tr><th scope="col">Storage</th><th scope="col">Purpose and handling</th></tr></thead><tbody>
        <tr><th scope="row">Supabase session cookies</th><td>Maintain and refresh sign-in. HttpOnly, SameSite Lax, and Secure in production. Provider-managed validity, refresh and revocation apply; logout clears the application session.</td></tr>
        <tr><th scope="row">Authenticator setup cookie</th><td>Encrypted, identity/session-bound setup context. HttpOnly and SameSite Strict, with a five-minute limit; cleared after completion or cancellation. Secure in production.</td></tr>
        <tr><th scope="row">Email and recovery context</th><td>Encrypted confirmation context expires after ten minutes. Opening an email link stages it without consuming the provider token. The link context is HttpOnly and SameSite Lax; the confirmed recovery context is HttpOnly and SameSite Strict, bound to the verified account and session. Secure in production.</td></tr>
        <tr><th scope="row">Invitation context</th><td>Encrypted invitation context expires after one hour. HttpOnly, SameSite Lax, and Secure in production. Acceptance still requires the verified invited email, an active invitation and explicit confirmation; the invitation itself expires after seven days.</td></tr>
        <tr><th scope="row">Provider PKCE context</th><td>Supabase uses a temporary code-verifier cookie for verification flows. It receives the same HttpOnly, SameSite Lax and production Secure protections as the provider cookies. Provider validity and cleanup apply.</td></tr>
      </tbody></table>
    </section>
    <section><h2>Local storage and optional technologies</h2><p>No advertising, marketing analytics or optional tracking storage is intentionally enabled in the current application. The landing page’s scrolling and three-dimensional previews do not require consent for an advertising tracker. Fonts and visual assets are served by Mitsa.</p><p>Development tools and test browsers may maintain their own debugging or test state. Their use must not be represented as a production storage commitment. The final production inventory will be checked before release.</p></section>
    <section><h2>Your controls</h2><p>Signing out ends the application session. Browser controls can remove site data, but doing so may sign you out or interrupt a verification flow. Removing local cookies does not delete the provider account or resolve workspace ownership.</p><p>If optional storage is introduced, it must remain disabled until an appropriate choice is made where required. Refusing optional storage must not prevent essential authentication. A consent banner is not added merely to imply that optional tracking exists.</p></section>
    <section><h2>Review before publication</h2><p>The operator must approve the final storage inventory, names, lifetimes, providers and any optional consent arrangements before production publication. This draft does not authorize new tracking, external analytics or a change to privacy settings.</p></section>
  </LegalDraft>;
}
