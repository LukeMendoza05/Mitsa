"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordStockInAction } from "@/app/w/[workspaceSlug]/inventory/actions";
import type { ProductListItem } from "@/lib/inventory/types";
import s from "@/components/workspace/workspace.module.css";
import inv from "@/components/inventory/inventory.module.css";

export function StockInForm({
  workspaceSlug,
  locations,
  products,
  preselectedProductId,
}: {
  workspaceSlug: string;
  locations: Array<{ id: string; name: string; kind: "shop" | "warehouse" }>;
  products: ProductListItem[];
  preselectedProductId?: string;
}) {
  const router = useRouter();
  const [shopId, setShopId] = useState(locations[0]?.id || "");
  const [productId, setProductId] = useState(preselectedProductId || products[0]?.id || "");
  const [quantity, setQuantity] = useState(10);
  const [unitCost, setUnitCost] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || quantity <= 0) return;
    setError(null);
    setSuccess(null);
    setLoading(true);

    const items = [
      {
        productId,
        quantity: Number(quantity),
        unitCost: unitCost ? Number(unitCost) : undefined,
        batchNumber: batchNumber.trim() || undefined,
        expiryDate: expiryDate || undefined,
      },
    ];

    const res = await recordStockInAction(workspaceSlug, shopId, items, reference);
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "Failed to record stock in");
    } else {
      setSuccess(`Successfully received ${quantity} ${selectedProduct?.unit || "units"} of ${selectedProduct?.name}!`);
      setQuantity(10);
      setBatchNumber("");
      setReference("");
      router.refresh();
    }
  }

  return (
    <form className={s.form} onSubmit={handleSubmit} style={{ maxWidth: "600px" }}>
      {error && <div className={s.error}>{error}</div>}
      {success && (
        <div className={inv.pillSuccess} style={{ padding: "16px", borderRadius: "8px", marginBottom: "20px" }}>
          <strong>✓ {success}</strong>
        </div>
      )}

      <fieldset disabled={loading}>
        <label>
          Receiving Location (Stall / Bodega) *
          <select value={shopId} onChange={(e) => setShopId(e.target.value)}>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.kind === "warehouse" ? "Bodega" : "Stall"})
              </option>
            ))}
          </select>
        </label>

        <label>
          Fireworks Product *
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const p = products.find((x) => x.id === e.target.value);
              if (p && p.costPrice > 0) setUnitCost(String(p.costPrice));
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.displayCode}] {p.name} ({p.unit})
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <label>
            Quantity Received *
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>

          <label>
            Unit Cost (₱)
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={selectedProduct?.costPrice ? String(selectedProduct.costPrice) : "0.00"}
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <label>
            Batch / Lot # (Optional)
            <input
              type="text"
              placeholder="e.g. B26-NOV-01"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
            />
          </label>

          <label>
            Expiry / Shelf-Life Date (Optional)
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </label>
        </div>

        <label>
          Reference / Delivery Receipt # (Optional)
          <input
            type="text"
            placeholder="DR #, Supplier invoice, or delivery note"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>

        <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
          <button type="submit" disabled={loading}>
            {loading ? "Receiving..." : "Confirm Stock In"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            style={{ background: "transparent", border: "1px solid var(--control-border)" }}
          >
            Back
          </button>
        </div>
      </fieldset>
    </form>
  );
}
