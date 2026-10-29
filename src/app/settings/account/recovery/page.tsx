import {AccountNavigation} from "@/components/workspace/PageNavigation";
import type {Metadata} from "next";
import {accountContext} from "@/lib/workspaces";
import {InteriorShell} from "@/components/site/Site";
import {PostForm} from "@/components/site/PostForm";
import s from "@/components/workspace/workspace.module.css";
import site from "@/components/site/site.module.css";
export const metadata:Metadata={title:"Authenticator Recovery"};
export default async function RecoveryRequest() {
  await accountContext();
  return <InteriorShell><main id="main-content" className={s.main}><div className={s.heading}><h1>Lost your authenticator?</h1><p>Use a trusted backup if you have one. Otherwise, request an independent recovery review. Your password or workspace role alone cannot authorize an MFA reset.</p></div><AccountNavigation/><PostForm className={s.form} action="/auth/privacy/request" pendingLabel="Recording your recovery request…"><input name="kind" type="hidden" value="mfa-recovery"/><input name="commandKey" type="hidden" value={crypto.randomUUID()}/><label>Additional information (optional)<textarea name="reason" maxLength={2000}/></label><p className={s.hint}>Do not include passwords, authenticator setup keys or identity-document scans. Identity verification requires a separate approved process.</p><button className={site.button}>Request independent recovery review</button></PostForm><p className={s.note}>A request does not restore privileged access. An approved operator and the authorized recovery executor must complete the required checks. Password recovery preserves MFA requirements.</p></main></InteriorShell>;
}
