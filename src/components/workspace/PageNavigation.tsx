"use client";
import {usePathname} from 'next/navigation';
import {useRef,type KeyboardEvent,type ReactNode} from 'react';
import s from './workspace.module.css';
export type NavigationItem={label:string;href:string};
export function PageNavigation({items,label,disclosure=false,children}:{items:NavigationItem[];label:string;disclosure?:boolean;children?:ReactNode}) {
 const pathname=usePathname(),details=useRef<HTMLDetailsElement>(null);
 const links=<nav className={disclosure?s.sideLinks:s.nav} aria-label={label}>{items.map(item=><a key={item.href} href={item.href} aria-current={pathname===item.href?'page':undefined} onClick={()=>{if(disclosure&&details.current)details.current.open=false;}}>{item.label}</a>)}</nav>;
 function escape(event:KeyboardEvent<HTMLDetailsElement>){if(event.key==='Escape'&&details.current?.open){event.preventDefault();details.current.open=false;details.current.querySelector('summary')?.focus();}}
 return disclosure?<><div className={s.desktopLinks}>{links}{children}</div><details className={s.workspaceMenu} ref={details} onKeyDown={escape}><summary>Workspace menu<span aria-hidden="true">⌄</span></summary>{links}{children}</details></>:links;
}
export function AccountNavigation({operator=false}:{operator?:boolean}) {
 return <PageNavigation label="Mitsa account navigation" items={[{label:'Workspaces',href:'/workspaces'},{label:'Account settings',href:'/settings/account'},{label:'Security settings',href:'/settings/account/security'},{label:'Your agreement',href:'/settings/account/terms'},{label:'Privacy requests',href:'/settings/account/privacy'},{label:'Authenticator recovery',href:'/settings/account/recovery'},...(operator?[{label:'Assigned request review',href:'/operator/requests'}]:[])]}/>;
}
