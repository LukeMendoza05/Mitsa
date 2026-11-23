import type { Metadata } from "next";
import { managementContext } from "@/lib/workspace-management";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import s from "@/components/workspace/workspace.module.css";

export const metadata: Metadata = { title: "Workspace" };
export default async function WorkspacePage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspace, userLabel } = await managementContext(params);
  return <WorkspaceShell workspace={workspace} userLabel={userLabel}><div className={s.heading}><h2>One business. A clear view.</h2><p>Your workspace access has been checked against your current membership and account security.</p></div>
    <div className={s.cards}><section className={s.card}><span className={s.role}>Your locations</span><h2>{workspace.locations.length === 1 ? "One assigned location" : `${workspace.locations.length} available locations`}</h2>{workspace.locations.length ? <ul>{workspace.locations.map(location => <li key={location.id}>{location.name} · {location.kind === "warehouse" ? "Warehouse" : "Shop"}</li>)}</ul> : <p>No locations are assigned. Ask your Business Owner or Admin to review your access.</p>}</section>
      <section className={s.card}><span className={s.role}>Workspace permissions</span><h2>Access with accountability.</h2><p>{workspace.role === "staff" ? "You can access assigned locations. Membership management and sensitive financial information are restricted." : workspace.role === "admin" ? "You can administer Staff and operational locations. Ownership and critical business settings remain with the Business Owner." : "You control membership, critical settings, and verified ownership transfer."}</p><p>{workspace.canViewFinancial ? "Your role is authorized for sensitive financial information when those modules become available." : "Sensitive financial information is restricted for your role."}</p></section></div>
  </WorkspaceShell>;
}
