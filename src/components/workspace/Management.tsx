import s from "./workspace.module.css";
export function ManagementFeedback({query}:{query:{error?:string;updated?:string}}) {
  return <>{query.error?<p className={s.error} role="alert">We couldn’t complete that change. Check the details and your current permissions. Sensitive changes require a <a href="/settings/account/security#recent-title">fresh password and authenticator confirmation</a>.</p>:null}{query.updated?<p className={s.success} role="status">Your change has been saved.</p>:null}</>;
}
export function LocationChoices({locations,selected=[]}:{locations:{id:string;name:string;active?:boolean}[];selected?:string[]}) {
  return <fieldset className={s.choices}><legend>Staff locations</legend>{locations.filter(l=>l.active!==false).map(location=><label className={s.checkbox} key={location.id}><input name="locations" type="checkbox" value={location.id} defaultChecked={selected.includes(location.id)}/><span>{location.name}</span></label>)}{!locations.some(l=>l.active!==false)?<p>No active locations are available. Staff without assignments cannot access locations.</p>:null}</fieldset>;
}
