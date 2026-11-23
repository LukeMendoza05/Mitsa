import type { Metadata } from "next";
import Link from "next/link";
import { managementContext } from "@/lib/workspace-management";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getMovementHistory } from "@/lib/inventory/service";
import { movementTypeLabels } from "@/lib/inventory/types";
import s from "@/components/workspace/workspace.module.css";
import inv from "@/components/inventory/inventory.module.css";

export const metadata: Metadata = { title: "Stock Movements — Mitsa" };

function formatPhp(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default async function MovementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams?: Promise<{ shop?: string }>;
}) {
  const { workspace, userLabel } = await managementContext(params);
  const sp = await searchParams;
  const shopId = sp?.shop || undefined;

  const movements = await getMovementHistory(workspace.slug, {
    shopId,
    limit: 100,
  });

  const root = `/w/${workspace.slug}/inventory`;

  return (
    <WorkspaceShell workspace={workspace} userLabel={userLabel}>
      <div className={s.heading}>
        <h2>Stock Movement Ledger</h2>
        <p>Immutable audit trail of all fireworks received, sold, transferred, and adjusted.</p>
      </div>

      <div className={inv.toolbar}>
        <form method="get" className={inv.toolbarActions}>
          <select
            name="shop"
            defaultValue={shopId || ""}
            style={{ minHeight: "44px" }}
          >
            <option value="">All Locations</option>
            {workspace.locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <button type="submit" style={{ minHeight: "44px" }}>
            Filter
          </button>
          {shopId && (
            <Link href={`${root}/movements`} style={{ alignSelf: "center", fontSize: "14px" }}>
              Clear
            </Link>
          )}
        </form>
      </div>

      {movements.length === 0 ? (
        <div className={s.empty}>
          <p>No inventory movements recorded for this filter.</p>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Type</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Location</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Batch</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const meta = movementTypeLabels[m.movementType] || { label: m.movementType, sign: "" };
                const isPositive = m.quantity > 0;
                return (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {new Date(m.createdAt).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
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
                    <td>{m.paymentMethod ? m.paymentMethod.toUpperCase() : "—"}</td>
                    <td>{m.batchNumber || "—"}</td>
                    <td>{m.reference || m.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </WorkspaceShell>
  );
}
