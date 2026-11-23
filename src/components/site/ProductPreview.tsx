import { brand } from "@/lib/brand";
import type { ReactNode } from "react";
import s from "./preview.module.css";
import { landingDemo as demo, demoProduct, formatPHP, saleChartPath, demoDate, demoAxisLabel } from "@/lib/landing-demo";

export type PreviewKind = "stock" | "sales" | "orders" | "checkout";

export function Icon({ kind }: { kind: "stock" | "receipt" | "shops" | "shield" | "history" | "balance" }) {
  const paths = {
    stock: <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5" /></>,
    receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 7h6M9 11h6M9 15h3" /></>,
    shops: <><path d="M3 10h18l-2-6H5l-2 6Zm2 0v10h14V10M9 20v-6h6v6M3 10v2h4v-2m0 0v2h5v-2m0 0v2h5v-2m0 0v2h4v-2" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    history: <><path d="M4 8a9 9 0 1 1-1 7M4 3v5h5M12 7v5l3 2" /></>,
    balance: <><path d="M12 3v18M5 21h14M3 7h18M6 7l-4 7h8L6 7Zm12 0-4 7h8l-4-7Z" /></>,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

export { PreviewDisclosure } from "./PreviewDisclosure";

export function SalesChart({ compact = false }: { compact?: boolean }) {
  const width=compact?400:640,height=compact?130:170;
  return <svg className={s.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Sample sales, ${demo.period}: ${formatPHP(demo.totals.sales)} across ${demo.shops.length} shops.`} preserveAspectRatio="none" data-sales-values={demo.dailySales.map(d=>d.value).join(",")}>
    <desc>{demo.dailySales.map(d=>`${d.date}: ${formatPHP(d.value)}`).join("; ")}. Fictional demonstration data.</desc>
    <path d={`M0 ${height-25}H${width}M0 ${height/2}H${width}M0 25H${width}`} stroke="#ececec" strokeWidth="1" />
    <path data-chart-line d={saleChartPath(width,height)} fill="none" stroke="#17191c" strokeWidth="2" />
  </svg>;
}

export function ProductPreview({ kind }: { kind: PreviewKind }) {
  const selectedTotal=demo.selectedStock.reduce((sum,row)=>sum+row.available,0);
  return <div className={s.fragment} data-preview-static>
    <div className={s.fragmentTop}><span>{kind === "stock" ? "Stock at a glance" : kind === "sales" ? "Sales overview" : kind === "checkout" ? "A sample sale" : "Customer orders"}</span><span className={s.quiet}>{kind === "sales" ? demo.period : kind === "orders" ? "Across all shops" : demo.shops[0].name}</span></div>
    {kind === "stock" ? <><div className={s.rowLabel}><span>Selected products</span><span>Available</span></div>{demo.selectedStock.map(row=>{const product=demoProduct(row.productId);return <div className={s.stockRow} key={row.productId}><span>{product.name}</span><strong>{row.available}<small>{product.unit}</small></strong></div>;})}<p className={s.scope}>{demo.selectedStock.length} of {demo.products.length} products · {selectedTotal} available</p></>
      : kind === "sales" ? <><div className={s.metric}>{formatPHP(demo.totals.sales)}<span>Across {demo.shops.length} sample shops</span></div><SalesChart compact /><div className={s.axis}><span>{demoAxisLabel(0)}</span><span>{demoAxisLabel(6,true)}</span></div></>
      : kind === "checkout" ? <div className={s.receipt}>{demo.checkout.lines.map(line=><div key={line.productId}><span>{demoProduct(line.productId).orderName} × {line.quantity}</span><span>{formatPHP(line.quantity*demoProduct(line.productId).price,2)}</span></div>)}<div className={s.total}><span>Total</span><strong>{formatPHP(demo.checkout.total,2)}</strong></div><div><span>Cash received</span><span>{formatPHP(demo.checkout.cash,2)}</span></div><div><span>Change</span><span>{formatPHP(demo.checkout.change,2)}</span></div><p>{demoDate(demo.checkout.date)} · Cash example</p></div>
      : <><div>{demo.selectedOrders.map(order=><div className={s.orderRow} key={order.id}><span className={s.orderNumber}>{order.id}</span><div><span>{demoProduct(order.productId).orderName}</span><small>{order.quantity} {demoProduct(order.productId).unit} · {order.status}</small></div></div>)}</div><p className={s.scope}>{demo.selectedOrders.length} of {demo.totals.orders} orders · Includes completed</p></>}
  </div>;
}

export function WorkspacePreview({ inventoryVisual }: { inventoryVisual?: ReactNode } = {}) {
  return <div className={s.workspace} data-preview-static>
    <div className={s.appBar}><span className={s.appBrand}>{brand.name}<span> / Workspace</span></span><span className={s.quiet}>{demo.business} · Sample business</span></div>
    <div className={s.appBody}><aside className={s.sidebar} aria-label="Sections in this workspace concept"><span className={s.sideLabel}>Your workspace</span><span className={s.active}><Icon kind="shops" />Overview</span><span><Icon kind="stock" />Inventory</span><span><Icon kind="receipt" />Checkout</span><span>Customer orders</span><span>Reports</span><p>Planned workspace<br />Fictional figures</p></aside>
      <div className={s.appContent}><div className={s.appTitle}><div><p>Across your locations</p><h3>A little more perspective.</h3></div><span className={s.period}>{demo.period}</span></div>
        <div className={s.metrics}>{[["Sample sales",formatPHP(demo.totals.sales),`Across ${demo.shops.length} shops`],["Available stock",String(demo.totals.available),"Items & packages"],["Customer orders",String(demo.totals.orders),"Including completed"]].map(([label,value,caption])=><div key={label}><span>{label}</span><strong>{value}</strong><small>{caption}</small></div>)}</div>
        <div className={inventoryVisual ? s.chartAndInventory : undefined}><div className={s.chartPanel}><div className={s.panelHeading}><span>Sales across your shops</span><span className={s.quiet}>PHP · Sample week</span></div><SalesChart /><div className={s.axis}>{[0,2,4,6].map(index=><span key={index}>{demoAxisLabel(index,index===6)}</span>)}</div></div>{inventoryVisual && <div className={s.inventoryPanel}><span>Inventory, organized</span>{inventoryVisual}<small>Packaging concept</small></div>}</div>
        <div className={s.workspaceBottom}><span><span className={s.dot} />{demo.shops.length} sample locations</span><span>One connected perspective</span></div>
      </div>
    </div>
  </div>;
}

export function ShopsPreview() {
  return <div className={s.shops} data-preview-static>
    <div className={s.panelHeading}><span>Every shop, together.</span><span className={s.quiet}>{demo.period}</span></div>
    <div className={s.shopHeading}><span>Location</span><span>Available</span><span>Sales</span></div>
    {demo.shops.map((shop,index)=><div className={s.shopRow} key={shop.id}><span><small>{String(index+1).padStart(2,"0")}</small>{shop.name}</span><span>{shop.available}</span><span>{formatPHP(shop.sales)}</span></div>)}
    <div className={s.shopTotal}><span>All locations</span><strong>{demo.totals.available}</strong><strong>{formatPHP(demo.totals.sales)}</strong></div>
    <p className={s.shopNote}>Available counts items and packages in their selling units. Fictional sample figures.</p>
  </div>;
}

