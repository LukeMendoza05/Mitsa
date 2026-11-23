import type { Metadata } from "next";
import Link from "next/link";
import { managementContext } from "@/lib/workspace-management";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getDashboardSummary, getMovementHistory } from "@/lib/inventory/service";
import { movementTypeLabels } from "@/lib/inventory/types";
import s from "@/components/workspace/workspace.module.css";
import inv from "@/components/inventory/inventory.module.css";

export const metadata: Metadata = { title: "Inventory Dashboard — Mitsa" };

function formatPhp(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default async function InventoryDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams?: Promise<{ shop?: string }>;
}) {
  const { workspace, userLabel } = await managementContext(params);
  const sp = await searchParams;
  const selectedShop = sp?.shop || undefined;

  const summary = await getDashboardSummary(workspace.slug, selectedShop);
  const recentMovements = await getMovementHistory(workspace.slug, {
    shopId: selectedShop,
    limit: 8,
  });

  const root = `/w/${workspace.slug}/inventory`;

  return (
    <WorkspaceShell workspace={workspace} userLabel={userLabel}>
      <div className={s.heading}>
        <h2>Fireworks Inventory & Sales</h2>
        <p>Real-time retail tracking, explosive product catalog, and daily sales overview.</p>
      </div>

      {/* Hero Metric Cards */}
      <div className={inv.dashboardGrid}>
        <div className={inv.metricCard}>
          <span className={inv.metricTitle}>Today&apos;s Sales</span>
          <div className={inv.metricValue}>{formatPhp(summary.todaySales)}</div>
          <span className={inv.metricSub}>
            {summary.todayTransactions} transaction{summary.todayTransactions === 1 ? "" : "s"} · {summary.todayItemsSold} item{summary.todayItemsSold === 1 ? "" : "s"}
          </span>
        </div>

        <div className={`${inv.metricCard} ${summary.activeAlerts > 0 ? inv.metricAlert : ""}`}>
          <span className={inv.metricTitle}>Stock Alerts</span>
          <div className={inv.metricValue}>{summary.activeAlerts}</div>
          <span className={inv.metricSub}>
            {summary.activeAlerts === 0 ? "All items sufficiently stocked" : "Low or out-of-stock items require restocking"}
          </span>
        </div>

        <div className={inv.metricCard}>
          <span className={inv.metricTitle}>Active Products</span>
          <div className={inv.metricValue}>{summary.totalProducts}</div>
          <span className={inv.metricSub}>Pyrotechnic & firecracker catalog</span>
        </div>

        {workspace.canViewFinancial && (
          <div className={inv.metricCard}>
            <span className={inv.metricTitle}>Total Stock Value (Cost)</span>
            <div className={inv.metricValue}>{formatPhp(summary.totalStockValue)}</div>
            <span className={inv.metricSub}>Estimated wholesale cost basis</span>
          </div>
        )}
      </div>

      {/* Quick Operations Bar */}
      <div className={s.section}>
        <h2>Quick Actions</h2>
        <div className={inv.actionGrid}>
          <Link href={`${root}/stock/out`} className={inv.actionBtn}>
            <strong>⚡ Quick Sale (POS)</strong>
            <span>Record walk-in sale or retail transaction</span>
          </Link>
          <Link href={`${root}/stock/in`} className={inv.actionBtn}>
            <strong>📦 Stock In</strong>
            <span>Receive goods from bodega or supplier</span>
          </Link>
          <Link href={`${root}/products/new`} className={inv.actionBtn}>
            <strong>➕ New Product</strong>
            <span>Add fireworks item to catalog</span>
          </Link>
          {workspace.role !== "staff" && (
            <>
              <Link href={`${root}/stock/transfer`} className={inv.actionBtn}>
                <strong>🔄 Transfer Stock</strong>
                <span>Move items between stalls/bunkers</span>
              </Link>
              <Link href={`${root}/stock/adjust`} className={inv.actionBtn}>
                <strong>⚖️ Adjust Count</strong>
                <span>Physical count recount or scrap</span>
              </Link>
              <Link href={`${root}/reports`} className={inv.actionBtn}>
                <strong>📑 BIR Inventory</strong>
                <span>Annual digital inventory export</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className={s.section}>
        <div className={inv.toolbar}>
          <h2>Recent Movements</h2>
          <Link href={`${root}/movements`} className={s.role}>
            View full ledger →
          </Link>
        </div>

        {recentMovements.length === 0 ? (
          <div className={s.empty}>
            <p>No inventory movements recorded yet.</p>
            <Link href={`${root}/stock/in`}>Receive your first stock →</Link>
          </div>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Location</th>
                  <th>Total</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.map((m) => {
                  const meta = movementTypeLabels[m.movementType] || { label: m.movementType, sign: "" };
                  const isPositive = m.quantity > 0;
                  return (
                    <tr key={m.id}>
                      <td>{new Date(m.createdAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td>
                        <span className={`${inv.pill} ${isPositive ? inv.pillSuccess : inv.pillMuted}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        <strong>{m.productName}</strong>
                        <div className={inv.cartItemMeta}>{m.productCode}</div>
                      </td>
                      <td>
                        <strong style={{ color: isPositive ? "#1a7f45" : "#b5382e" }}>
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.unit}
                        </strong>
                      </td>
                      <td>{m.shopName}</td>
                      <td>{m.totalAmount != null ? formatPhp(m.totalAmount) : "—"}</td>
                      <td>{m.reference || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
