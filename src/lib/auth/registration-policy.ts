/** Public mode never relies on an email allowlist. The database policy must
 * explicitly authorize publication, eligibility and registration first. */
export function registrationPolicyMode(mode: string, policy: {
 status: "test" | "published"; publicRegistration: boolean; pilotRegistration?: boolean;
} | null, origin?: string, development = false) {
 const isTest = mode === "isolated-test" && policy?.status === "test" && !policy.publicRegistration;
 const isPublic = mode === "public" && policy?.status === "published" && policy.publicRegistration;
 const isPilot = mode === "controlled-pilot" && origin === "http://127.0.0.1:3000" && policy?.status === "test" && !policy.publicRegistration && policy.pilotRegistration === true;
 const isDevelopmentOpen = development && mode === "development-open" && origin === "http://127.0.0.1:3000" && policy?.status === "test" && !policy.publicRegistration && policy.pilotRegistration === true;
 return {isTest: Boolean(isTest), isDevelopmentOpen: Boolean(isDevelopmentOpen), allowed: Boolean(isTest || isPublic || isPilot || isDevelopmentOpen)};
}

// Presentation classification only. This never grants registration permission.
export function registrationIntentionallyClosed(mode:string,policy:{status:'test'|'published';publicRegistration:boolean;pilotRegistration?:boolean}|null,origin:string) {
 if(mode==='disabled')return true;
 if(!policy)return false;
 if(mode==='public')return policy.status==='published'&&!policy.publicRegistration;
 return ['development-open','controlled-pilot'].includes(mode)&&origin==='http://127.0.0.1:3000'&&policy.status==='test'&&!policy.publicRegistration&&policy.pilotRegistration===false;
}
