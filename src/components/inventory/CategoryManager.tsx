"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCategoryAction } from "@/app/w/[workspaceSlug]/inventory/actions";
import type { Category } from "@/lib/inventory/types";
import s from "@/components/workspace/workspace.module.css";
import inv from "@/components/inventory/inventory.module.css";

export function CategoryManager({
  workspaceSlug,
  categories,
}: {
  workspaceSlug: string;
  categories: Category[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await createCategoryAction(workspaceSlug, formData);

    setLoading(false);
    if (!res.ok) {
      setError(res.error || "Failed to create category");
    } else {
      (e.target as HTMLFormElement).reset();
      router.refresh();
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px", maxWidth: "800px" }}>
      <form onSubmit={handleAdd} className={s.form} style={{ margin: 0 }}>
        {error && <div className={s.error}>{error}</div>}
        <fieldset disabled={loading} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <label style={{ flex: 1, margin: 0 }}>
            Category Name
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. Roman Candles, Sparklers, Cakes..."
              maxLength={100}
            />
          </label>
          <label style={{ width: "100px", margin: 0 }}>
            Order
            <input type="number" name="sortOrder" defaultValue={0} />
          </label>
          <button type="submit" style={{ minHeight: "44px" }}>
            {loading ? "Adding..." : "+ Add Category"}
          </button>
        </fieldset>
      </form>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Category Name</th>
              <th>Order</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "var(--muted)" }}>
                  No categories created yet.
                </td>
              </tr>
            ) : (
              categories.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.sortOrder}</td>
                  <td>
                    <span className={`${inv.pill} ${c.active ? inv.pillSuccess : inv.pillMuted}`}>
                      {c.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
