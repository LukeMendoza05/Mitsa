"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { productUnitLabels, type Category, type ProductDetail, type ProductUnit } from "@/lib/inventory/types";
import { createProductAction, updateProductAction } from "@/app/w/[workspaceSlug]/inventory/actions";
import s from "@/components/workspace/workspace.module.css";

export function ProductForm({
  workspaceSlug,
  categories,
  product,
}: {
  workspaceSlug: string;
  categories: Category[];
  product?: ProductDetail;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isEdit = Boolean(product);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = isEdit && product
      ? await updateProductAction(workspaceSlug, product.id, formData)
      : await createProductAction(workspaceSlug, formData);

    setLoading(false);

    if (!result.ok) {
      setError(result.error || "An error occurred");
    } else {
      router.push(`/w/${workspaceSlug}/inventory/products`);
      router.refresh();
    }
  }

  return (
    <form className={s.form} onSubmit={handleSubmit} style={{ maxWidth: "600px" }}>
      {error && <div className={s.error}>{error}</div>}

      <fieldset disabled={loading}>
        <label>
          Product Name *
          <input
            type="text"
            name="name"
            required
            defaultValue={product?.name || ""}
            placeholder='e.g. Silver Dragon Sparkler 36"'
            maxLength={200}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <label>
            Unit of Measure *
            <select name="unit" defaultValue={product?.unit || "pc"}>
              {(Object.keys(productUnitLabels) as ProductUnit[]).map((u) => (
                <option key={u} value={u}>
                  {productUnitLabels[u]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Category
            <select name="categoryId" defaultValue={product?.categoryId || ""}>
              <option value="">(None / Uncategorized)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <label>
            Selling Price (₱) *
            <input
              type="number"
              name="sellingPrice"
              step="0.01"
              min="0"
              required
              defaultValue={product?.sellingPrice ?? ""}
              placeholder="0.00"
            />
          </label>

          <label>
            Cost Price (₱)
            <input
              type="number"
              name="costPrice"
              step="0.01"
              min="0"
              defaultValue={product?.costPrice ?? ""}
              placeholder="0.00"
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <label>
            SKU Code (Optional)
            <input
              type="text"
              name="sku"
              defaultValue={product?.sku || ""}
              placeholder="e.g. SPK-36-SLV"
            />
          </label>

          <label>
            Barcode / UPC (Optional)
            <input
              type="text"
              name="barcode"
              defaultValue={product?.barcode || ""}
              placeholder="Scan or enter barcode"
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <label>
            Low Stock Alert Threshold
            <input
              type="number"
              name="minStock"
              min="0"
              defaultValue={product?.minStock ?? 5}
              placeholder="5"
            />
          </label>

          <label>
            Hazard Classification
            <select name="hazardClass" defaultValue={product?.hazardClass || "1.4G"}>
              <option value="">(None)</option>
              <option value="1.4G">1.4G (Consumer Pyrotechnics)</option>
              <option value="1.4S">1.4S (Packaged Devices)</option>
              <option value="1.3G">1.3G (Display Fireworks)</option>
              <option value="1.1G">1.1G (High Explosives)</option>
            </select>
          </label>
        </div>

        <label>
          UN Number (Transport Safety)
          <input
            type="text"
            name="unNumber"
            defaultValue={product?.unNumber || "UN0336"}
            placeholder="e.g. UN0336"
          />
        </label>

        <label>
          Description / Specifications
          <textarea
            name="description"
            rows={3}
            defaultValue={product?.description || ""}
            placeholder="Shots, duration, effect colors, safety distances..."
          />
        </label>

        {isEdit && (
          <div className={s.checkbox}>
            <input
              type="checkbox"
              id="active"
              name="active"
              defaultChecked={product?.active ?? true}
            />
            <label htmlFor="active">Active (available for sales and stocking)</label>
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Update Product" : "Save Product"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            style={{ background: "transparent", border: "1px solid var(--control-border)" }}
          >
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
