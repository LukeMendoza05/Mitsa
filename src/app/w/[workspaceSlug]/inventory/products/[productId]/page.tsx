import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { managementContext } from "@/lib/workspace-management";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { getProduct } from "@/lib/inventory/service";
import { PrintButton } from "@/components/inventory/PrintButton";
import s from "@/components/workspace/workspace.module.css";
import inv from "@/components/inventory/inventory.module.css";

export const metadata: Metadata = { title: "Product Details — Mitsa" };

function formatPhp(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; productId: string }>;
}) {
  const { workspace, userLabel } = await managementContext(params);
  const { workspaceSlug, productId } = await params;

  let product;
  try {
    product = await getProduct(workspaceSlug, productId);
  } catch {
    notFound();
  }

  // Generate QR code data URL for this product
  const qrData = `mitsa://p/${workspace.id}/${product.id}`;
  const qrCodeUrl = await QRCode.toDataURL(qrData, { width: 180, margin: 1 });

  const root = `/w/${workspaceSlug}/inventory`;

  return (
    <WorkspaceShell workspace={workspace} userLabel={userLabel}>
      <div className={s.heading}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className={inv.codeBadge}>{product.displayCode}</span>
          <span className={`${inv.pill} ${product.active ? inv.pillSuccess : inv.pillMuted}`}>
            {product.active ? "Active" : "Archived"}
          </span>
          {product.hazardClass && <span className={inv.pill}>{product.hazardClass}</span>}
        </div>
        <h2 style={{ marginTop: "8px" }}>{product.name}</h2>
        <p>{product.description || "No description provided."}</p>
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <Link href={`${root}/stock/in?product=${product.id}`} className={s.action}>
          + Stock In This Product
        </Link>
        {workspace.role !== "staff" && (
          <>
            <Link href={`${root}/stock/adjust?product=${product.id}`} className={s.role} style={{ alignSelf: "center" }}>
              Adjust Count
            </Link>
            <Link href={`${root}/products/${product.id}/edit`} className={s.role} style={{ alignSelf: "center" }}>
              Edit Product
            </Link>
          </>
        )}
      </div>

      <div className={s.cards}>
        {/* Specifications & Pricing */}
        <section className={s.card}>
          <span className={s.role}>Pricing & Codes</span>
          <dl className={s.facts} style={{ marginTop: "12px" }}>
            <div>
              <dt>Selling Price</dt>
              <dd><strong>{formatPhp(product.sellingPrice)}</strong> / {product.unit}</dd>
            </div>
            {workspace.canViewFinancial && (
              <div>
                <dt>Cost Price</dt>
                <dd>{formatPhp(product.costPrice)} / {product.unit}</dd>
              </div>
            )}
            <div>
              <dt>Category</dt>
              <dd>{product.categoryName || "Uncategorized"}</dd>
            </div>
            <div>
              <dt>SKU</dt>
              <dd>{product.sku || "—"}</dd>
            </div>
            <div>
              <dt>Barcode</dt>
              <dd>{product.barcode || "—"}</dd>
            </div>
            <div>
              <dt>UN Number</dt>
              <dd>{product.unNumber || "—"}</dd>
            </div>
            <div>
              <dt>Min Stock Alert</dt>
              <dd>{product.minStock} {product.unit}</dd>
            </div>
          </dl>
        </section>

        {/* Total Stock & QR Label */}
        <section className={s.card}>
          <span className={s.role}>Stock Summary & Label</span>
          <div style={{ marginTop: "12px" }}>
            <span className={inv.metricTitle}>Total Available Inventory</span>
            <div className={inv.metricValue} style={{ marginBlock: "8px" }}>
              {product.totalQuantity} {product.unit}
            </div>
          </div>

          <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "16px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCodeUrl} alt={`QR for ${product.name}`} width={120} height={120} style={{ borderRadius: "8px", border: "1px solid var(--hairline)" }} />
            <div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
                Scannable mobile label. Embeds product identity and quick cashier lookup.
              </p>
              <PrintButton />
            </div>
          </div>
        </section>
      </div>

      {/* Breakdown per location */}
      <div className={s.section}>
        <h2>Stock by Location</h2>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Location / Stall</th>
                <th>Type</th>
                <th>Quantity on Hand</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {product.locations.map((loc) => {
                const isOut = loc.quantity === 0;
                const isLow = product.minStock > 0 && loc.quantity <= product.minStock;
                return (
                  <tr key={loc.shopId}>
                    <td><strong>{loc.shopName}</strong></td>
                    <td>{loc.shopKind === "warehouse" ? "Bodega / Warehouse" : "Retail Stall / Branch"}</td>
                    <td>
                      <strong>{loc.quantity} {product.unit}</strong>
                    </td>
                    <td>
                      <span className={`${inv.pill} ${isOut ? inv.pillDanger : isLow ? inv.pillWarning : inv.pillSuccess}`}>
                        {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </WorkspaceShell>
  );
}
