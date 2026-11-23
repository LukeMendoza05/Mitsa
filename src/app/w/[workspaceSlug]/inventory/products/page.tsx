import type { Metadata } from "next";
import Link from "next/link";
import { managementContext } from "@/lib/workspace-management";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { listProducts, listCategories } from "@/lib/inventory/service";
import s from "@/components/workspace/workspace.module.css";
import inv from "@/components/inventory/inventory.module.css";

export const metadata: Metadata = { title: "Product Catalog — Mitsa" };

function formatPhp(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams?: Promise<{ search?: string; category?: string; shop?: string }>;
}) {
  const { workspace, userLabel } = await managementContext(params);
  const sp = await searchParams;
  const search = sp?.search || undefined;
  const categoryId = sp?.category || undefined;
  const shopId = sp?.shop || undefined;

  const [products, categories] = await Promise.all([
    listProducts(workspace.slug, {
      search,
      categoryId,
      shopId,
      activeOnly: false,
    }),
    listCategories(workspace.slug),
  ]);

  const root = `/w/${workspace.slug}/inventory`;

  return (
    <WorkspaceShell workspace={workspace} userLabel={userLabel}>
      <div className={s.heading}>
        <h2>Product Catalog</h2>
        <p>Manage fireworks items, pricing matrices, barcodes, and stock thresholds.</p>
      </div>

      <div className={inv.toolbar}>
        <form method="get" className={inv.toolbarActions} style={{ flex: 1, flexWrap: "wrap" }}>
          <input
            type="search"
            name="search"
            placeholder="Search by name, code, SKU, barcode..."
            defaultValue={search || ""}
            className={inv.searchBox}
            style={{ minHeight: "44px" }}
          />
          <select
            name="category"
            defaultValue={categoryId || ""}
            style={{ minHeight: "44px", width: "auto" }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" style={{ minHeight: "44px" }}>
            Filter
          </button>
          {(search || categoryId) && (
            <Link href={`${root}/products`} style={{ alignSelf: "center", fontSize: "14px" }}>
              Clear
            </Link>
          )}
        </form>

        <div className={inv.toolbarActions}>
          <Link href={`${root}/categories`} className={s.action}>
            Categories
          </Link>
          {workspace.role !== "staff" && (
            <Link href={`${root}/products/new`} className={s.action} style={{ fontWeight: 600 }}>
              + Add Product
            </Link>
          )}
        </div>
      </div>

      {products.length === 0 ? (
        <div className={s.empty}>
          <p>No products found matching your search.</p>
          <Link href={`${root}/products/new`}>Add a new firework product →</Link>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Price (₱)</th>
                {workspace.canViewFinancial && <th>Cost (₱)</th>}
                <th>Stock on Hand</th>
                <th>Hazard</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const isLow = p.minStock > 0 && p.stockQuantity <= p.minStock;
                const isOut = p.stockQuantity === 0;
                return (
                  <tr key={p.id}>
                    <td>
                      <span className={inv.codeBadge}>{p.displayCode}</span>
                      {p.sku && <div className={inv.cartItemMeta}>SKU: {p.sku}</div>}
                    </td>
                    <td>
                      <strong>
                        <Link href={`${root}/products/${p.id}`}>{p.name}</Link>
                      </strong>
                      {p.barcode && <div className={inv.cartItemMeta}>UPC: {p.barcode}</div>}
                    </td>
                    <td>{p.categoryName || "Uncategorized"}</td>
                    <td>{p.unit}</td>
                    <td>
                      <strong>{formatPhp(p.sellingPrice)}</strong>
                    </td>
                    {workspace.canViewFinancial && <td>{formatPhp(p.costPrice)}</td>}
                    <td>
                      <span
                        className={`${inv.pill} ${
                          isOut ? inv.pillDanger : isLow ? inv.pillWarning : inv.pillSuccess
                        }`}
                      >
                        {p.stockQuantity} {p.unit}
                      </span>
                    </td>
                    <td>{p.hazardClass || "—"}</td>
                    <td>
                      <span className={`${inv.pill} ${p.active ? inv.pillSuccess : inv.pillMuted}`}>
                        {p.active ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Link href={`${root}/products/${p.id}`} className={s.role}>
                          View
                        </Link>
                        {workspace.role !== "staff" && (
                          <Link href={`${root}/products/${p.id}/edit`} className={s.role}>
                            Edit
                          </Link>
                        )}
                      </div>
                    </td>
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
