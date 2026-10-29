export function challengeDiagnosticAllowed(env:Record<string,string|undefined>,origin:string) {
 return env.NODE_ENV==='development'&&env.MITSA_REGISTRATION_MODE==='isolated-test'&&env.MITSA_AUTH_MAIL_MODE==='isolated-capture'&&origin==='http://127.0.0.1:3000';
}
