import type { Metadata } from "next";
import { managementContext } from "@/lib/workspace-management";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { listProducts } from "@/lib/inventory/service";
import { TransferForm } from "@/components/inventory/TransferForm";
import s from "@/components/workspace/workspace.module.css";

export const metadata: Metadata = { title: "Stock Transfer — Mitsa" };

export default async function TransferPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspace, userLabel } = await managementContext(params, "management");
  const products = await listProducts(workspace.slug, { activeOnly: true });

  return (
    <WorkspaceShell workspace={workspace} userLabel={userLabel}>
      <div className={s.heading}>
        <h2>Stock Transfer</h2>
        <p>Shift fireworks inventory between bodegas, bunkers, and retail branches.</p>
      </div>

      {workspace.locations.length < 2 ? (
        <div className={s.empty}>
          <p>You need at least 2 locations to perform stock transfers.</p>
        </div>
      ) : (
        <TransferForm
          workspaceSlug={workspace.slug}
          locations={workspace.locations}
          products={products}
        />
      )}
    </WorkspaceShell>
  );
}
