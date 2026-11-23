// Immutable published legal text (version 2026-11-23.1).
export const TERMS_TEXT = `# Mitsa Terms of Use

**Operator:** D Extacy Fireworks  
**Contact:** mitsa.transactional.support@gmail.com  
**Effective:** 23 November 2026  
**Version:** 2026-11-23.1  
**Governing law:** Philippines

## 1. Service
Mitsa is a fireworks inventory and business management web application provided free of charge for an evaluation stage. It provides accounts, workspaces, role-based access, and inventory features for products, stock movements, sales, transfers, adjustments and reports. Demonstration figures on the public pages are fictional. The service is provided "as is" during this evaluation stage; no uptime, warranty, compliance or commercial guarantee is made.

## 2. Eligibility
You must be at least 18 years old and authorized to act for the business whose workspace you create or manage. Mitsa does not grant fireworks licences, business permits or regulatory compliance. You remain responsible for all permissions, records and legal obligations applicable to your activities.

## 3. Accounts and security
Keep your credentials private and provide accurate information. Accounts are not shared. A workspace has one primary Business Owner; Admin and Staff access is granted through authorized membership flows. Business Owners and Admins must enroll an authenticator before privileged workspace access. Staff access is limited to assigned locations. Password recovery does not bypass multi-factor authentication or grant workspace membership.

## 4. Acceptable use
Use only workspaces and records you are authorized to access. Do not attempt to bypass security controls, elevate roles, access unrelated businesses, interfere with availability, or submit unlawful content. Do not use the service to store real customer or operational data unless your use is authorized and you have completed your own compliance review.

## 5. Business records and closure
Ownership transfers require independently verified confirmations and an atomic change. Account or workspace closure must resolve ownership and linked records first. Necessary business or audit history may be retained under the adopted retention schedule. A deletion request does not promise immediate erasure of every linked or backed-up record.

## 6. Email and processing
Account emails (verification codes, sign-in links, invitations and security notices) are sent through Brevo (Sendinblue SAS, France) on our behalf. Service infrastructure is hosted by Supabase and Vercel. See the Privacy Policy for details.

## 7. Liability and disputes
To the maximum extent permitted by law, the service is provided without warranties and D Extacy Fireworks is not liable for indirect or consequential loss arising from evaluation use. These Terms are governed by the laws of the Philippines. Contact us at the address above with any dispute; we will attempt to resolve it in good faith before formal proceedings.

## 8. Acceptance and changes
Registration records the exact version and hash of the Terms you accept; acceptance is explicit and never preselected. Material changes are published as a new immutable version. Continued use after a new version takes effect constitutes acceptance of that version where permitted by law.
`;

export const PRIVACY_TEXT = `# Mitsa Privacy Policy

**Operator:** D Extacy Fireworks  
**Privacy contact:** mitsa.transactional.support@gmail.com  
**Effective:** 23 November 2026  
**Version:** 2026-11-23.1  
**Governing law:** Philippines

## 1. What Mitsa is
Mitsa is a free evaluation-stage fireworks inventory and business management application. Its foundation covers accounts, workspaces, access control, multi-factor authentication and inventory records. Demonstration figures shown publicly are fictional.

## 2. Information we handle
We process: names, email addresses, authentication identifiers, workspace memberships, roles, location assignments, agreement acceptances, security events, and inventory records you enter (products, batches, stock movements, sales, transfers, adjustments and reports). Passwords and authenticator secrets are managed by Supabase Auth; Mitsa does not store them. Temporary authenticator setup context is encrypted in a short-lived cookie.

## 3. Why we process it
Account data is used to create and secure your account, verify email, sign you in, select workspaces, manage authorized memberships, recover accounts and handle privacy requests. Security records help investigate abuse and establish who authorized a change. Workspace and location restrictions limit access to the relevant business. Inventory records are used to provide the features you request. Processing is necessary to deliver the service and protect accounts; where consent is required we ask for it separately.

## 4. Service providers and location
Supabase hosts authentication and PostgreSQL data in Sydney, Australia. Vercel hosts the web application. Brevo (Sendinblue SAS, France) processes transactional email on our behalf. Fonts and visual assets are self-hosted. We do not use advertising or marketing analytics providers.

## 5. Retention
We apply the adopted retention schedule (\`config/retention-proposals.json\`, version 2026-10-14) approved for this release. Key periods: unverified signups 14 days; ordinary account profile 30 days after executable closure; authentication logs 90 days and raw IPs 30 days; invitations 30–90 days; registration intents 1 day; MFA recovery cases 2 years with evidence 30 days; privacy cases 3 years with evidence 30 days and exports 7 days; administrative audit 5 years; Terms acceptance evidence 10 years; backup snapshots 30 days; statutory accounting records under an approved manual classification. Deletion is applied only after ownership, legal holds, linked records and backup restoration are resolved; expiry of a credential does not prove every provider log or backup copy is erased.

## 6. Your requests
You may request access, correction, deletion or workspace closure by emailing the privacy contact. We verify identity and review independently where necessary. A request is completed only after the approved action is actually carried out. Do not send identity documents or other sensitive evidence through an unapproved channel.

## 7. Security
Mitsa uses server-managed sessions, workspace authorization, location restrictions, mandatory MFA for privileged access, signed registration intents, replay protection and protected audit records. These controls reduce risk but cannot guarantee against every incident.

## 8. Cookies and local storage
Only essential session and security cookies are used. They are HttpOnly, SameSite Lax or Strict as appropriate, and Secure in production. No advertising, marketing analytics or optional tracking storage is enabled. Removing cookies may sign you out or interrupt a verification flow but does not delete the provider account.

## 9. Changes
Material policy changes are published as a new version with a new effective date; renewed Terms acceptance may be required.
`;
