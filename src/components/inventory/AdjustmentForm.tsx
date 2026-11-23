"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adjustStockAction } from "@/app/w/[workspaceSlug]/inventory/actions";
import type { ProductListItem } from "@/lib/inventory/types";
import s from "@/components/workspace/workspace.module.css";
import inv from "@/components/inventory/inventory.module.css";

export function AdjustmentForm({
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
  const [newQuantity, setNewQuantity] = useState(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === productId);

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a specific reason for the count adjustment.");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    const res = await adjustStockAction(
      workspaceSlug,
      shopId,
      productId,
      Number(newQuantity),
      reason.trim()
    );
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "Failed to adjust stock");
    } else {
      setSuccess(`Adjusted ${selectedProduct?.name} stock count to ${newQuantity} ${selectedProduct?.unit}!`);
      setReason("");
      router.refresh();
    }
  }

  return (
    <form className={s.form} onSubmit={handleAdjust} style={{ maxWidth: "600px" }}>
      {error && <div className={s.error}>{error}</div>}
      {success && (
        <div className={inv.pillSuccess} style={{ padding: "16px", borderRadius: "8px", marginBottom: "20px" }}>
          <strong>✓ {success}</strong>
        </div>
      )}

      <fieldset disabled={loading}>
        <label>
          Stall / Bodega Location *
          <select value={shopId} onChange={(e) => setShopId(e.target.value)}>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Fireworks Product *
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.displayCode}] {p.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          New Count on Hand (Actual physical count) *
          <input
            type="number"
            min="0"
            required
            value={newQuantity}
            onChange={(e) => setNewQuantity(Number(e.target.value))}
          />
        </label>

        <label>
          Reason for Adjustment (Audit Mandatory) *
          <textarea
            required
            rows={3}
            placeholder="e.g. Month-end physical inventory recount; Disposed water-damaged sparklers; Corrected cashier count entry."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
          <button type="submit" disabled={loading}>
            {loading ? "Adjusting..." : "Record Count Adjustment"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
