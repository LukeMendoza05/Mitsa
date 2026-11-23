import {AccountNavigation} from "@/components/workspace/PageNavigation";
import type {Metadata} from "next";
import {z} from "zod";
import {accountContext} from "@/lib/workspaces";
import {InteriorShell} from "@/components/site/Site";
import {PostForm} from "@/components/site/PostForm";
import {PasswordField} from "@/components/site/PasswordField";
import {AuthForm} from "@/components/site/AuthForm";
import {ManagementFeedback} from "@/components/workspace/Management";
import s from "@/components/workspace/workspace.module.css";
import site from "@/components/site/site.module.css";
export const metadata:Metadata={title:"Account Settings"};
export default async function AccountSettings({searchParams}:{searchParams:Promise<{error?:string;updated?:string}>}) {
  const {client,identity}=await accountContext();const [result,operator]=await Promise.all([client.schema("api").rpc("mitsa_account_profile"),client.schema("api").rpc("mitsa_operator_context")]);
  if(result.error)throw Error("Your account profile could not be verified.");const profile=z.object({fullName:z.string().nullable()}).parse(result.data);
  return <InteriorShell><main id="main-content" className={s.main}><div className={s.row}><div className={s.heading}><h1>Your account, considered.</h1><p>Manage your personal profile and sign-in security. Workspace permissions are managed separately by each business.</p></div><AuthForm mode="logout"/></div><AccountNavigation operator={!operator.error&&Boolean(operator.data)}/><ManagementFeedback query={await searchParams}/>
    
    <section className={s.section}><h2>Your profile.</h2><PostForm className={s.form} action="/auth/account"><input name="action" type="hidden" value="profile"/><label>Full name<input name="name" autoComplete="name" defaultValue={profile.fullName??""} maxLength={120} required/></label><button className={site.button}>Save profile</button></PostForm><p>Verified sign-in email: <span className={s.identifier}>{identity.email}</span>. Email changes require a separate verified process and are not available in this foundation.</p></section>
    <section className={s.section}><h2>Change your password.</h2><p>Use your current password. If your account has MFA, first confirm your password and a trusted authenticator in <a href="/settings/account/security#recent-title">Security Settings</a>. A successful change signs out every session.</p><PostForm className={s.form} action="/auth/account" pendingLabel="Updating your password…"><input name="action" type="hidden" value="password"/><PasswordField name="currentPassword" label="Current password" autoComplete="current-password"/><PasswordField name="password" label="New password" minLength={8}/><PasswordField name="confirmPassword" label="Confirm new password" minLength={8}/><button className={`${site.button} ${site.secondary}`}>Update password and sign out</button></PostForm></section>
  </main></InteriorShell>;
}
