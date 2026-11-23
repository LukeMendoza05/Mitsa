import {InteriorShell} from '@/components/site/Site';
import s from './workspace.module.css';
export function PageLoading({label}:{label:string}) {
 return <InteriorShell><main id="main-content" className={s.main} aria-busy="true"><div className={s.heading}><h1>{label}</h1><p role="status">Loading your authorized information…</p></div></main></InteriorShell>;
}
