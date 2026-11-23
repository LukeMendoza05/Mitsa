"use client";

import type { BirInventoryItem } from "@/lib/inventory/types";

export function InventoryExport({
  businessName,
  items,
}: {
  businessName: string;
  items: BirInventoryItem[];
}) {
  function downloadCsv() {
    const headers = [
      "Item Code",
      "Product Description",
      "Category",
      "Unit of Measure",
      "Quantity on Hand",
      "Unit Cost (PHP)",
      "Total Cost (PHP)",
      "Retail Unit Price (PHP)",
      "Total Retail Value (PHP)",
    ];

    const rows = items.map((i) => [
      `"${i.displayCode}"`,
      `"${i.productName.replace(/"/g, '""')}"`,
      `"${i.category.replace(/"/g, '""')}"`,
      `"${i.unit}"`,
      i.quantityOnHand,
      i.unitCost.toFixed(2),
      i.totalCost.toFixed(2),
      i.unitPrice.toFixed(2),
      i.totalRetailValue.toFixed(2),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `BIR_Inventory_Report_${businessName.replace(/\s+/g, "_")}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div style={{ display: "flex", gap: "12px" }}>
      <button
        type="button"
        onClick={downloadCsv}
        disabled={items.length === 0}
        style={{ minHeight: "44px", fontWeight: 600 }}
      >
        📥 Export BIR CSV
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        disabled={items.length === 0}
        style={{ minHeight: "44px", background: "transparent", border: "1px solid var(--control-border)" }}
      >
        🖨️ Print Report
      </button>
    </div>
  );
}
