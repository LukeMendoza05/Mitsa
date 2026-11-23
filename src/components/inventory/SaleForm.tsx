"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordSaleAction } from "@/app/w/[workspaceSlug]/inventory/actions";
import {
  paymentMethodLabels,
  type PaymentMethod,
  type ProductListItem,
} from "@/lib/inventory/types";
import s from "@/components/workspace/workspace.module.css";
import inv from "@/components/inventory/inventory.module.css";

interface CartItem {
  productId: string;
  name: string;
  displayCode: string;
  unit: string;
  unitPrice: number;
  availableStock: number;
  quantity: number;
}

function formatPhp(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function SaleForm({
  workspaceSlug,
  locations,
  products,
}: {
  workspaceSlug: string;
  locations: Array<{ id: string; name: string; kind: "shop" | "warehouse" }>;
  products: ProductListItem[];
}) {
  const router = useRouter();
  const [shopId, setShopId] = useState(locations[0]?.id || "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<{ total: number; totalQuantity: number } | null>(null);

  // Filter products by search and available stock
  const filteredProducts = products.filter((p) => {
    if (!p.active) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.displayCode.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  });

  function addToCart(p: ProductListItem) {
    setError(null);
    setLastSale(null);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === p.id);
      if (existing) {
        if (existing.quantity >= p.stockQuantity) {
          setError(`Cannot add more: only ${p.stockQuantity} ${p.unit} in stock.`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === p.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      if (p.stockQuantity <= 0) {
        setError(`${p.name} is out of stock at this location.`);
        return prev;
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          displayCode: p.displayCode,
          unit: p.unit,
          unitPrice: p.sellingPrice,
          availableStock: p.stockQuantity,
          quantity: 1,
        },
      ];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const next = item.quantity + delta;
            if (next <= 0) return null;
            if (next > item.availableStock) {
              setError(`Maximum available: ${item.availableStock} ${item.unit}.`);
              return item;
            }
            return { ...item, quantity: next };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  const grandTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  async function handleCheckout() {
    if (cart.length === 0) return;
    setError(null);
    setLoading(true);

    const payload = cart.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    const res = await recordSaleAction(workspaceSlug, shopId, payload, payment, reference);
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "Checkout failed");
    } else {
      setLastSale({ total: grandTotal, totalQuantity: totalItems });
      setCart([]);
      setReference("");
      setSearch("");
      router.refresh();
    }
  }

  return (
    <div>
      {/* Location Bar */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
        <label style={{ fontSize: "14px", fontWeight: 600 }}>Active Stall / Location:</label>
        <select
          value={shopId}
          onChange={(e) => {
            setShopId(e.target.value);
            setCart([]);
          }}
          style={{ minHeight: "40px", width: "auto" }}
        >
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name} ({loc.kind === "warehouse" ? "Bodega" : "Stall"})
            </option>
          ))}
        </select>
      </div>

      {error && <div className={s.error}>{error}</div>}

      {lastSale && (
        <div className={inv.pillSuccess} style={{ padding: "16px", borderRadius: "12px", marginBottom: "20px" }}>
          <strong style={{ fontSize: "16px" }}>✓ Sale Recorded Successfully!</strong>
          <p style={{ margin: "4px 0 0" }}>
            Total: {formatPhp(lastSale.total)} · {lastSale.totalQuantity} items sold.
          </p>
        </div>
      )}

      <div className={inv.posLayout}>
        {/* Left: Product Picker & Search */}
        <div>
          <div style={{ marginBottom: "16px" }}>
            <input
              type="search"
              placeholder="🔍 Search product or barcode scan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", minHeight: "48px", fontSize: "16px" }}
              autoFocus
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "12px",
              maxHeight: "550px",
              overflowY: "auto",
              paddingRight: "4px",
            }}
          >
            {filteredProducts.map((p) => {
              const inStock = p.stockQuantity > 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  disabled={!inStock}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    textAlign: "left",
                    padding: "12px",
                    background: inStock ? "var(--fog)" : "var(--paper)",
                    border: "1px solid var(--control-border)",
                    borderRadius: "10px",
                    opacity: inStock ? 1 : 0.5,
                    cursor: inStock ? "pointer" : "not-allowed",
                  }}
                >
                  <span className={inv.codeBadge}>{p.displayCode}</span>
                  <strong style={{ marginBlock: "6px", fontSize: "14px", lineHeight: 1.3 }}>
                    {p.name}
                  </strong>
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "baseline", marginTop: "auto" }}>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>
                      {formatPhp(p.sellingPrice)}
                    </span>
                    <span style={{ fontSize: "12px", color: inStock ? "var(--muted)" : "#b5382e" }}>
                      {inStock ? `${p.stockQuantity} left` : "Out of stock"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Cart & Checkout */}
        <div className={inv.posCart}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Current Order</h3>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                style={{ background: "transparent", border: "none", color: "#b5382e", cursor: "pointer", fontSize: "13px" }}
              >
                Clear Cart
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <p style={{ color: "var(--muted)", textAlign: "center", marginBlock: "40px" }}>
              Cart is empty. Tap products on the left or scan a barcode to begin.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto" }}>
              {cart.map((item) => (
                <div key={item.productId} className={inv.cartItem}>
                  <div className={inv.cartItemDetails}>
                    <span className={inv.cartItemName}>{item.name}</span>
                    <span className={inv.cartItemMeta}>
                      {formatPhp(item.unitPrice)} / {item.unit}
                    </span>
                  </div>

                  <div className={inv.cartItemControls}>
                    <button
                      type="button"
                      className={inv.qtyBtn}
                      onClick={() => updateQty(item.productId, -1)}
                    >
                      −
                    </button>
                    <span style={{ minWidth: "24px", textAlign: "center", fontWeight: 600 }}>
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className={inv.qtyBtn}
                      onClick={() => updateQty(item.productId, 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", marginLeft: "4px" }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Payment Selection */}
          <div style={{ marginTop: "12px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
              Payment Method:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
              {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayment(m)}
                  style={{
                    padding: "8px 4px",
                    fontSize: "13px",
                    fontWeight: payment === m ? 700 : 400,
                    background: payment === m ? "var(--ink)" : "var(--paper)",
                    color: payment === m ? "var(--paper)" : "var(--ink)",
                    border: "1px solid var(--control-border)",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  {paymentMethodLabels[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <input
              type="text"
              placeholder="Note / Customer / GCash Ref # (Optional)"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              style={{ width: "100%", minHeight: "40px", fontSize: "13px" }}
            />
          </div>

          <div className={inv.cartTotal}>
            <span className={inv.cartTotalLabel}>Total Due:</span>
            <span className={inv.cartTotalAmount}>{formatPhp(grandTotal)}</span>
          </div>

          <button
            type="button"
            disabled={cart.length === 0 || loading}
            onClick={handleCheckout}
            style={{
              minHeight: "52px",
              fontSize: "18px",
              fontWeight: 700,
              background: cart.length > 0 ? "var(--ink)" : "var(--hairline)",
              color: "var(--paper)",
              cursor: cart.length > 0 ? "pointer" : "not-allowed",
              borderRadius: "8px",
              marginTop: "8px",
            }}
          >
            {loading ? "Processing..." : `Record Sale ${formatPhp(grandTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
