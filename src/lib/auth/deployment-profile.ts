import approved from '../../../config/registration-deployments.json';
type Environment=Record<string,string|undefined>;
type Manifest={version:number;profiles:Record<string,{projectRef:string;databaseMarker:string;origins:string[]}|null>};
/** Deployment stage is independent of Next's build mode. No production target is invented. */
export function approvedRegistrationDeployment(env:Environment,manifest:Manifest=approved) {
 const name=env.MITSA_DEPLOYMENT_PROFILE??'',profile=manifest.version===1?manifest.profiles[name]:null;
 if(!profile||!['isolated-development','consenting-pilot','production'].includes(name)||!profile.origins.includes(env.APP_ORIGIN??'')
  ||env.SUPABASE_URL!==`https://${profile.projectRef}.supabase.co`)throw Error('Registration deployment is not approved');
 const origin=new URL(env.APP_ORIGIN!);
 if(name==='production'&&origin.protocol!=='https:')throw Error('Production registration requires HTTPS');
 return {name,...profile,origin:origin.origin};
}
export function expectedRuntimeProject(env:Environment,legacyProject:string) {
 if(env.MITSA_REGISTRATION_ENGINE!==undefined&&!['legacy','persistent-v1'].includes(env.MITSA_REGISTRATION_ENGINE))throw Error('Registration engine is unavailable');
 return env.MITSA_REGISTRATION_ENGINE==='persistent-v1'?approvedRegistrationDeployment(env).projectRef:legacyProject;
}
export function authenticationCookieSecure(env:Environment=process.env) {
 if(env.MITSA_REGISTRATION_ENGINE==='persistent-v1')return new URL(approvedRegistrationDeployment(env).origin).protocol==='https:';
 return env.NODE_ENV==='production';
}
