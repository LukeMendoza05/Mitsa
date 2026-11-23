import {it,expect} from 'vitest';
import {approvedRegistrationDeployment,authenticationCookieSecure,expectedRuntimeProject} from '../../src/lib/auth/deployment-profile';
const env={MITSA_REGISTRATION_ENGINE:'persistent-v1',MITSA_DEPLOYMENT_PROFILE:'isolated-development',APP_ORIGIN:'http://127.0.0.1:3000',SUPABASE_URL:'https://mjtejwafxriwntweussc.supabase.co',NODE_ENV:'production'};
it('supports an isolated production build without treating it as production deployment',()=>{
 expect(approvedRegistrationDeployment(env).name).toBe('isolated-development');expect(authenticationCookieSecure(env)).toBe(false);expect(expectedRuntimeProject(env,'legacy')).toBe('mjtejwafxriwntweussc');
});
it('refuses absent/unapproved deployment profiles and origins',()=>{
 for(const change of [{MITSA_DEPLOYMENT_PROFILE:'production'},{MITSA_DEPLOYMENT_PROFILE:''},{APP_ORIGIN:'https://unapproved.invalid'},{SUPABASE_URL:'https://wrong.invalid'}])expect(()=>approvedRegistrationDeployment({...env,...change})).toThrow();
});
it('retains legacy cookie behavior while the new engine is inactive',()=>{
 expect(authenticationCookieSecure({NODE_ENV:'production'})).toBe(true);expect(authenticationCookieSecure({NODE_ENV:'development'})).toBe(false);
 expect(expectedRuntimeProject({},'legacy')).toBe('legacy');
});
