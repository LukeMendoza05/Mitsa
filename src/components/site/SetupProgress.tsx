import s from './site.module.css';
export function SetupProgress({step}:{step:1|2|3|4}) {
 return <ol className={s.setupProgress} aria-label="Account setup progress">{['Account','Email','Authenticator','Workspace'].map((label,index)=><li key={label} aria-current={index+1===step?'step':undefined}><span aria-hidden="true">{index+1}</span>{label}</li>)}</ol>;
}
