import {cookies,headers} from 'next/headers';
import {AuthLayout} from '@/components/auth/AuthLayout';
import {VerificationRenewalForm} from '@/components/auth/VerificationRenewalForm';
import {openAuthFlow,signupCodeCookie} from '@/lib/security/auth-flow';
import {persistentRegistrationReadiness,usesPersistentRegistration} from '@/lib/auth/registration-service';
import {signupChallengeConfig} from '@/lib/auth/signup-challenge';
import s from '@/components/auth/auth.module.css';
export const metadata={title:'Continue Email Verification'};
export default async function RenewVerification({searchParams}:{searchParams:Promise<{error?:string}>}) {
 const flow=openAuthFlow((await cookies()).get(signupCodeCookie)?.value,process.env.AUTH_FLOW_KEY??'');
 const readiness=usesPersistentRegistration()?await persistentRegistrationReadiness():null,config=signupChallengeConfig(),query=await searchParams;
 const ready=flow?.purpose==='signup-code'&&flow.passwordProvenAt!==undefined&&Date.now()-flow.passwordProvenAt<600000&&readiness?.policy&&config;
 return <AuthLayout mode='verify'><p className={s.eyebrow}>Continue your Mitsa account</p><h1>Pick up where you left off.</h1><p className={s.description}>Your pending account is preserved. Review the same versioned agreement and complete a fresh human verification. This does not create another account or send an email.</p>
  {query.error?<p className={s.errorSummary} role='alert'>Verification could not be renewed. Sign in again to confirm your password, or try again after the service returns.</p>:null}
  {ready?<><details className={s.policyReview} open><summary>Agreement and Privacy Notice</summary><h2>Agreement · {readiness.policy!.termsVersion}</h2><p>{readiness.policy!.termsContent}</p><h2>Privacy Notice · {readiness.policy!.privacyVersion}</h2><p>{readiness.policy!.privacyContent}</p></details><VerificationRenewalForm termsId={readiness.policy!.termsId} privacyId={readiness.policy!.privacyId} siteKey={config!.siteKey} nonce={(await headers()).get('x-nonce')??undefined}/></>:<p className={s.verificationNotice}>Sign in with your email and password to confirm your identity before continuing. Registration does not need to be open.</p>}
  <p className={s.switch}><a href='/login'>Back to sign in</a></p>
 </AuthLayout>;
}
