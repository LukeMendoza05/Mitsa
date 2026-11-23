"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { transferStockAction } from "@/app/w/[workspaceSlug]/inventory/actions";
import type { ProductListItem } from "@/lib/inventory/types";
import s from "@/components/workspace/workspace.module.css";
import inv from "@/components/inventory/inventory.module.css";

export function TransferForm({
  workspaceSlug,
  locations,
  products,
}: {
  workspaceSlug: string;
  locations: Array<{ id: string; name: string; kind: "shop" | "warehouse" }>;
  products: ProductListItem[];
}) {
  const router = useRouter();
  const [fromShop, setFromShop] = useState(locations[0]?.id || "");
  const [toShop, setToShop] = useState(locations[1]?.id || locations[0]?.id || "");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [quantity, setQuantity] = useState(5);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === productId);

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (fromShop === toShop) {
      setError("Source and destination locations must be different.");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);

    const items = [{ productId, quantity: Number(quantity) }];
    const res = await transferStockAction(workspaceSlug, fromShop, toShop, items, reference);
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "Failed to transfer stock");
    } else {
      setSuccess(`Transferred ${quantity} ${selectedProduct?.unit || "units"} of ${selectedProduct?.name}!`);
      router.refresh();
    }
  }

  return (
    <form className={s.form} onSubmit={handleTransfer} style={{ maxWidth: "600px" }}>
      {error && <div className={s.error}>{error}</div>}
      {success && (
        <div className={inv.pillSuccess} style={{ padding: "16px", borderRadius: "8px", marginBottom: "20px" }}>
          <strong>✓ {success}</strong>
        </div>
      )}

      <fieldset disabled={loading}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <label>
            From (Source) *
            <select value={fromShop} onChange={(e) => setFromShop(e.target.value)}>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            To (Destination) *
            <select value={toShop} onChange={(e) => setToShop(e.target.value)}>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Fireworks Product *
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.displayCode}] {p.name} ({p.unit})
              </option>
            ))}
          </select>
        </label>

        <label>
          Quantity to Transfer *
          <input
            type="number"
            min="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>

        <label>
          Transfer Note / Gate Pass #
          <input
            type="text"
            placeholder="e.g. Restock Bocaue front tent"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>

        <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
          <button type="submit" disabled={loading}>
            {loading ? "Transferring..." : "Complete Transfer"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
