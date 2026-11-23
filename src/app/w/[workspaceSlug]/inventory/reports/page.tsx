import type { Metadata } from "next";
import { managementContext } from "@/lib/workspace-management";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getBirInventoryReport } from "@/lib/inventory/service";
import { InventoryExport } from "@/components/inventory/InventoryExport";
import s from "@/components/workspace/workspace.module.css";
import inv from "@/components/inventory/inventory.module.css";

export const metadata: Metadata = { title: "BIR Inventory Report — Mitsa" };

function formatPhp(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default async function InventoryReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams?: Promise<{ shop?: string }>;
}) {
  const { workspace, userLabel } = await managementContext(params, "management");
  const sp = await searchParams;
  const shopId = sp?.shop || undefined;

  const items = await getBirInventoryReport(workspace.slug, shopId);

  const grandCost = items.reduce((sum, i) => sum + i.totalCost, 0);
  const grandRetail = items.reduce((sum, i) => sum + i.totalRetailValue, 0);
  const totalUnits = items.reduce((sum, i) => sum + i.quantityOnHand, 0);

  return (
    <WorkspaceShell workspace={workspace} userLabel={userLabel}>
      <div className={s.heading}>
        <h2>BIR Annual Inventory Report</h2>
        <p>Year-end inventory list format compliant with Bureau of Internal Revenue (BIR) RMC 57-2015.</p>
      </div>

      <div className={inv.toolbar}>
        <InventoryExport businessName={workspace.name} items={items} />
      </div>

      <div className={inv.dashboardGrid}>
        <div className={inv.metricCard}>
          <span className={inv.metricTitle}>Total Quantity on Hand</span>
          <div className={inv.metricValue}>{totalUnits.toLocaleString()}</div>
          <span className={inv.metricSub}>Across {items.length} stocked SKUs</span>
        </div>

        <div className={inv.metricCard}>
          <span className={inv.metricTitle}>Total Inventory Cost</span>
          <div className={inv.metricValue}>{formatPhp(grandCost)}</div>
          <span className={inv.metricSub}>Balance sheet valuation</span>
        </div>

        <div className={inv.metricCard}>
          <span className={inv.metricTitle}>Estimated Retail Value</span>
          <div className={inv.metricValue}>{formatPhp(grandRetail)}</div>
          <span className={inv.metricSub}>Potential retail gross proceeds</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className={s.empty}>
          <p>No active stock on hand found to declare.</p>
        </div>
      ) : (
        <div className={`${s.tableWrap} ${inv.printable}`}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Product Description</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Qty on Hand</th>
                <th>Unit Cost</th>
                <th>Total Cost</th>
                <th>Retail Price</th>
                <th>Total Retail</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.displayCode}>
                  <td>
                    <span className={inv.codeBadge}>{i.displayCode}</span>
                  </td>
                  <td><strong>{i.productName}</strong></td>
                  <td>{i.category}</td>
                  <td>{i.unit}</td>
                  <td>{i.quantityOnHand}</td>
                  <td>{formatPhp(i.unitCost)}</td>
                  <td><strong>{formatPhp(i.totalCost)}</strong></td>
                  <td>{formatPhp(i.unitPrice)}</td>
                  <td>{formatPhp(i.totalRetailValue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--fog)", fontWeight: 700 }}>
                <td colSpan={4}>TOTALS:</td>
                <td>{totalUnits.toLocaleString()}</td>
                <td>—</td>
                <td>{formatPhp(grandCost)}</td>
                <td>—</td>
                <td>{formatPhp(grandRetail)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </WorkspaceShell>
  );
}
