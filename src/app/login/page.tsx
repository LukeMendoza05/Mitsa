import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthForm } from "@/components/site/AuthForm";
import { brand } from "@/lib/brand";
import auth from "@/components/auth/auth.module.css";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Mitsa account and choose an authorized workspace.",
  openGraph: { title: "Sign In | Mitsa", description: "Sign in to your Mitsa account.", siteName: brand.name },
  twitter: { title: "Sign In | Mitsa", description: "Sign in to your Mitsa account." },
};

export default async function LoginPage({searchParams}:{searchParams:Promise<{error?:string;updated?:string}>}) {
  const query=await searchParams;
  return <AuthLayout mode="login">
    <p className={auth.eyebrow}>Your Mitsa account</p><h1>Welcome back.</h1>
    <p className={auth.description}>Sign in to choose your workspace and pick up where you left off.</p>
    {query.updated==="password"?<p role="status">Your password has changed. Sign in again and verify your authenticator where required.</p>:null}
    <AuthForm mode="login" initialError={query.error?query.error==="session"?"Your session no longer grants account access. Sign in again to continue.":"We couldn’t sign you in. Check your email and password, then try again.":undefined}/>
    <p className={auth.smallPrint}>We’ll ask for your authenticator when your workspace requires it.</p>
    <p className={auth.switch}>New to Mitsa? <a href="/signup">Create an account</a></p>
    {process.env.MITSA_REGISTRATION_MODE==="isolated-test"?<p className={auth.testing}><strong>Development preview</strong>Approved test accounts only. Public registration is closed.</p>:null}
  </AuthLayout>;
}
