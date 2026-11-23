/** Fictional public preview only. No operational records or customer data. */
export type ProductId = "roman" | "assortment" | "fountain" | "sparklers" | "carton" | "bundle";
export type ShopId = "main" | "town" | "market";
export type OrderStatus = "Reserved" | "Awaiting delivery" | "Fulfilled";
export type DemoProduct = { id: ProductId; name: string; orderName: string; unit: string; price: number; individualItems?: number; contents: readonly { productId: ProductId; quantity: number }[] };
export type DemoOrder = { id: string; shopId: ShopId; productId: ProductId; quantity: number; status: OrderStatus; placedOn: string; fulfilOn: string };
export type SaleLine = { productId: ProductId; quantity: number };
const products: readonly DemoProduct[] = [
  { id: "roman", name: "Roman candles", orderName: "Roman candles", unit: "items", price: 30, contents: [] },
  { id: "assortment", name: "Assortment packs", orderName: "Assortment pack", unit: "packs", price: 480, contents: [{productId:"roman",quantity:3}] },
  { id: "fountain", name: "Fountain sets", orderName: "Fountain set", unit: "sets", price: 240, individualItems: 3, contents: [] },
  { id: "sparklers", name: "Sparkler packs", orderName: "Sparkler pack", unit: "packs", price: 60, individualItems: 10, contents: [] },
  { id: "carton", name: "Assortment cartons", orderName: "Assortment carton", unit: "cartons", price: 2880, contents: [{productId:"assortment",quantity:6}] },
  { id: "bundle", name: "Celebration bundles", orderName: "Celebration bundle", unit: "bundles", price: 1200, contents: [{productId:"assortment",quantity:2},{productId:"fountain",quantity:1}] },
];
export function demoProduct(id: ProductId) { return products.find(p=>p.id===id)!; }
export function demoItemCount(id: ProductId): number {
  const product=demoProduct(id);
  return product.contents.length?product.contents.reduce((sum,part)=>sum+part.quantity*demoItemCount(part.productId),0):product.individualItems??1;
}
const dates = ["2026-10-05","2026-10-06","2026-10-07","2026-10-08","2026-10-09","2026-10-10","2026-10-11"] as const;
const shops: readonly {id:ShopId;name:string;available:readonly number[];sales:readonly number[]}[] = [
  {id:"main",name:"Main shop",available:[24,12,8,110,18,12],sales:[600,780,540,960,900,1140,1320]},
  {id:"town",name:"Town branch",available:[18,10,6,70,14,10],sales:[360,480,360,600,540,720,780]},
  {id:"market",name:"Market branch",available:[12,6,4,32,10,8],sales:[240,300,180,360,360,420,540]},
];
const selectedProducts: readonly ProductId[] = ["roman","assortment","fountain"];
const selectedOrders = ["001","002","003"] as const;
const orders: readonly DemoOrder[] = [
  {id:"001",shopId:"main",productId:"assortment",quantity:2,status:"Reserved",placedOn:dates[6],fulfilOn:"2026-10-12"},
  {id:"002",shopId:"town",productId:"fountain",quantity:1,status:"Awaiting delivery",placedOn:dates[5],fulfilOn:"2026-10-12"},
  {id:"003",shopId:"market",productId:"roman",quantity:4,status:"Fulfilled",placedOn:dates[4],fulfilOn:dates[5]},
  ...Array.from({length:15},(_,i):DemoOrder=>({id:String(i+4).padStart(3,"0"),shopId:shops[i%shops.length].id,productId:selectedProducts[i%selectedProducts.length],quantity:i%2+1,status:i%2?"Awaiting delivery":"Reserved",placedOn:dates[i%dates.length],fulfilOn:"2026-10-12"})),
];
// The fixed shop/day amounts are expanded into priced sample sale lines.
function saleLines(amount: number): SaleLine[] {
  let remaining=amount;
  return (["assortment","fountain","roman"] as const).flatMap(productId=>{
    const quantity=Math.floor(remaining/demoProduct(productId).price);
    remaining-=quantity*demoProduct(productId).price;
    return quantity?[{productId,quantity}]:[];
  });
}
export function saleTotal(lines: readonly SaleLine[]) { return lines.reduce((sum,line)=>sum+line.quantity*demoProduct(line.productId).price,0); }
const sales=shops.flatMap(shop=>dates.map((date,index)=>({shopId:shop.id,date,lines:saleLines(shop.sales[index])})));
const inventory=shops.flatMap(shop=>products.map((product,index)=>{
  const reserved=orders.filter(o=>o.shopId===shop.id&&o.productId===product.id&&o.status!=="Fulfilled").reduce((sum,o)=>sum+o.quantity,0);
  const sold=sales.filter(s=>s.shopId===shop.id).flatMap(s=>s.lines).filter(l=>l.productId===product.id).reduce((sum,l)=>sum+l.quantity,0);
  const onHand=shop.available[index]+reserved;
  return {shopId:shop.id,productId:product.id,onHand,reserved,available:onHand-reserved,openingOnHand:onHand+sold,sold};
}));
const shopSummary=shops.map(shop=>({id:shop.id,name:shop.name,available:inventory.filter(i=>i.shopId===shop.id).reduce((sum,i)=>sum+i.available,0),sales:sales.filter(s=>s.shopId===shop.id).reduce((sum,s)=>sum+saleTotal(s.lines),0)}));
const dailySales=dates.map(date=>({date,value:sales.filter(s=>s.date===date).reduce((sum,s)=>sum+saleTotal(s.lines),0)}));
const checkout={shopId:"main" as const,date:dates[5],lines:[{productId:"assortment" as const,quantity:2}],cash:1000};
export const landingDemo={
  business:"Sampaguita Fireworks",period:`${new Date(dates[0]).getUTCDate()}–${new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(dates[6]))}`,asOf:dates[6],products,shops:shopSummary,inventory,sales,dailySales,orders,
  selectedStock:inventory.filter(i=>i.shopId==="main"&&selectedProducts.includes(i.productId)),
  selectedOrders:orders.filter(o=>(selectedOrders as readonly string[]).includes(o.id)),
  totals:{available:shopSummary.reduce((sum,s)=>sum+s.available,0),sales:dailySales.reduce((sum,d)=>sum+d.value,0),orders:orders.length},
  checkout:{...checkout,total:saleTotal(checkout.lines),change:checkout.cash-saleTotal(checkout.lines)},
  packaging:{itemsPerPack:demoItemCount("assortment"),packsPerCarton:demoProduct("carton").contents[0].quantity,itemsPerCarton:demoItemCount("carton"),bundle:demoProduct("bundle").contents},
} as const;
export function formatPHP(value:number,decimals=0){return new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(value);}
export function demoDate(date:string){return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(date));}
export function demoAxisLabel(index:number,month=false){const date=new Date(dailySales[index].date);return `${new Intl.DateTimeFormat("en",{weekday:"short",timeZone:"UTC"}).format(date)} ${date.getUTCDate()}${month?` ${new Intl.DateTimeFormat("en",{month:"short",timeZone:"UTC"}).format(date)}`:""}`;}
export function saleChartPath(width:number,height:number){
  const pad=8,max=Math.max(...dailySales.map(d=>d.value));
  const points=dailySales.map((d,i)=>({x:pad+i*(width-pad*2)/(dailySales.length-1),y:height-pad-d.value/max*(height-pad*2)}));
  return points.map((point,i)=>{
    if(!i)return `M${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    const a=points[i-1],before=points[i-2]??a,after=points[i+1]??point;
    return `C${(a.x+(point.x-before.x)/6).toFixed(2)} ${(a.y+(point.y-before.y)/6).toFixed(2)} ${(point.x-(after.x-a.x)/6).toFixed(2)} ${(point.y-(after.y-a.y)/6).toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ");
}
