import type { Metadata } from "next";
import { managementContext } from "@/lib/workspace-management";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { listProducts } from "@/lib/inventory/service";
import { AdjustmentForm } from "@/components/inventory/AdjustmentForm";
import s from "@/components/workspace/workspace.module.css";

export const metadata: Metadata = { title: "Stock Adjustment — Mitsa" };

export default async function AdjustmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams?: Promise<{ product?: string }>;
}) {
  const { workspace, userLabel } = await managementContext(params, "management");
  const sp = await searchParams;
  const products = await listProducts(workspace.slug, { activeOnly: true });

  return (
    <WorkspaceShell workspace={workspace} userLabel={userLabel}>
      <div className={s.heading}>
        <h2>Manual Stock Adjustment</h2>
        <p>Correct count discrepancies, record shrinkage, or write off damaged pyrotechnics.</p>
      </div>

      <AdjustmentForm
        workspaceSlug={workspace.slug}
        locations={workspace.locations}
        products={products}
        preselectedProductId={sp?.product}
      />
    </WorkspaceShell>
  );
}
