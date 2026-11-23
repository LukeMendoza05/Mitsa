import type { ReactNode } from "react";
import { InteriorShell } from "@/components/site/Site";
import { AuthForm } from "@/components/site/AuthForm";
import type { Workspace } from "@/lib/workspaces";
import { roleLabels } from "@/lib/workspaces";
import s from "./workspace.module.css";
import {PageNavigation} from './PageNavigation';

export function WorkspaceShell({ workspace, userLabel, children }: { workspace: Workspace; userLabel: string; children: ReactNode }) {
  const root=`/w/${workspace.slug}`;
  const items=[
    {label:'Overview',href:root},
    {label:'Inventory Dashboard',href:`${root}/inventory`},
    {label:'Products',href:`${root}/inventory/products`},
    {label:'Quick Sale (POS)',href:`${root}/inventory/stock/out`},
    {label:'Stock In',href:`${root}/inventory/stock/in`},
    ...(workspace.role!=='staff'?[
      {label:'Stock Transfer',href:`${root}/inventory/stock/transfer`},
      {label:'Stock Adjustment',href:`${root}/inventory/stock/adjust`},
      {label:'Categories',href:`${root}/inventory/categories`},
    ]:[]),
    {label:'Movement Ledger',href:`${root}/inventory/movements`},
    ...(workspace.role!=='staff'?[
      {label:'BIR Inventory Report',href:`${root}/inventory/reports`},
    ]:[]),
    {label:'Locations',href:`${root}/locations`},
    {label:'Workspace settings',href:`${root}/settings`},
    ...(workspace.role!=='staff'?[{label:'Members & invitations',href:`${root}/members`},{label:'Ownership',href:`${root}/ownership`},{label:'Access history',href:`${root}/audit`}]:[]),
    {label:'Roles & permissions',href:`${root}/permissions`}
  ];
  return <InteriorShell><div className={s.workspaceLayout}>
    <aside className={s.sidebar} aria-label="Workspace controls"><p className={s.sidebarLabel}>Workspace</p><PageNavigation items={items} label="Mitsa workspace navigation" disclosure>
      <div className={s.sidebarAccount}><PageNavigation label="Mitsa account navigation" items={[{label:'Switch workspace',href:'/workspaces'},{label:'Account settings',href:'/settings/account'},{label:'Security settings',href:'/settings/account/security'}]}/><AuthForm mode="logout" /></div>
    </PageNavigation></aside><main id="main-content" className={s.workspaceContent}>
    <div className={s.workspaceHeading}><span className={s.role}>{roleLabels[workspace.role]}</span><h1>{workspace.name}</h1><p className={s.accountIdentity}>Signed in as {userLabel}</p></div>
    {children}
    <p className={s.note}>Isolated test environment · Synthetic identities and records only. Inventory, checkout, customer orders, and reports remain planned capabilities.</p>
  </main></div></InteriorShell>;
}
