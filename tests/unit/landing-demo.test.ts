import {expect,test} from 'vitest';
import {landingDemo as demo,demoProduct,demoItemCount,saleTotal} from '../../src/lib/landing-demo';

test('the fictional scenario preserves and reconciles approved totals',()=>{
  expect(demo.shops.map(s=>s.available)).toEqual([184,128,72]);
  expect(demo.shops.map(s=>s.sales)).toEqual([6240,3840,2400]);
  expect(demo.totals).toEqual({available:384,sales:12480,orders:18});
  expect(demo.selectedStock.reduce((s,r)=>s+r.available,0)).toBe(44);
  expect(demo.dailySales.map(d=>d.value)).toEqual([1200,1560,1080,1920,1800,2280,2640]);
  expect(demo.checkout.total).toBe(960);expect(demo.checkout.change).toBe(40);
});

test('stock, reservations, package contents, dates and sale lines form one consistent scenario',()=>{
  for(const row of demo.inventory){
    const reservations=demo.orders.filter(o=>o.shopId===row.shopId&&o.productId===row.productId&&o.status!=='Fulfilled').reduce((s,o)=>s+o.quantity,0);
    expect(row.reserved).toBe(reservations);
    expect(row.available).toBe(row.onHand-reservations);
    expect(row.openingOnHand-row.sold).toBe(row.onHand);
    expect(row.available).toBeGreaterThanOrEqual(0);
  }
  for(const order of demo.orders){
    expect(demo.shops.some(s=>s.id===order.shopId)).toBe(true);
    expect(demoProduct(order.productId)).toBeDefined();
    expect(order.placedOn<=demo.asOf).toBe(true);
    expect(order.placedOn<=order.fulfilOn).toBe(true);
    expect(order.status==='Fulfilled'?order.fulfilOn<=demo.asOf:order.fulfilOn>demo.asOf).toBe(true);
  }
  expect(new Set(demo.orders.map(o=>o.id)).size).toBe(demo.orders.length);
  expect(demoItemCount('carton')).toBe(demo.packaging.packsPerCarton*demo.packaging.itemsPerPack);
  expect(demoItemCount('bundle')).toBe(9);
  expect(demo.packaging.itemsPerCarton).toBe(18);
  const day=demo.sales.find(s=>s.shopId===demo.checkout.shopId&&s.date===demo.checkout.date)!;
  expect(saleTotal(day.lines)).toBeGreaterThanOrEqual(demo.checkout.total);
  expect(day.lines.find(l=>l.productId==='assortment')!.quantity).toBeGreaterThanOrEqual(2);
  const fulfilled=demo.orders.find(o=>o.status==='Fulfilled')!;
  const fulfilmentSale=demo.sales.find(s=>s.shopId===fulfilled.shopId&&s.date===fulfilled.fulfilOn)!;
  expect(fulfilmentSale.lines.find(l=>l.productId===fulfilled.productId)!.quantity).toBeGreaterThanOrEqual(fulfilled.quantity);
});
