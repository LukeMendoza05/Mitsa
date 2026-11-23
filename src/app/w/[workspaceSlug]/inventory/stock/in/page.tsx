import type { Metadata } from "next";
import { managementContext } from "@/lib/workspace-management";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { listProducts } from "@/lib/inventory/service";
import { StockInForm } from "@/components/inventory/StockInForm";
import s from "@/components/workspace/workspace.module.css";

export const metadata: Metadata = { title: "Stock In — Mitsa" };

export default async function StockInPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams?: Promise<{ product?: string }>;
}) {
  const { workspace, userLabel } = await managementContext(params);
  const sp = await searchParams;
  const products = await listProducts(workspace.slug, { activeOnly: true });

  return (
    <WorkspaceShell workspace={workspace} userLabel={userLabel}>
      <div className={s.heading}>
        <h2>Stock In (Receive Inventory)</h2>
        <p>Record stock delivered from suppliers, workshops, or central storage.</p>
      </div>

      <StockInForm
        workspaceSlug={workspace.slug}
        locations={workspace.locations}
        products={products}
        preselectedProductId={sp?.product}
      />
    </WorkspaceShell>
  );
}
