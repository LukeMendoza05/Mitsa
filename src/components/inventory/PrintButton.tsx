"use client";

export function PrintButton({ label = "Print Label" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{ marginTop: "8px", fontSize: "13px", padding: "6px 12px" }}
    >
      {label}
    </button>
  );
}
