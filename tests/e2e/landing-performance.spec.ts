import { expect, test } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";

test("records Mitsa loading and total JavaScript transfer", async ({ page }, info) => {
  const reads: Promise<void>[] = [], bundles = new Map<string, Buffer>();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  page.on("response", response => {
    if (/\/_next\/static\/.*\.js$/.test(response.url())) reads.push(response.body().then(body => { bundles.set(response.url(), body); }));
  });
  await page.addInitScript(() => {
    const metrics = { lcp: 0, cls: 0 };
    Object.defineProperty(window, "mitsaMetrics", { value: metrics });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) metrics.lcp = entry.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) { const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }; if (!shift.hadRecentInput) metrics.cls += shift.value; } }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  // Observer delivery is asynchronous; wait for a measured paint rather than sampling its initial zero.
  await expect.poll(() => page.evaluate(() => (window as unknown as { mitsaMetrics: { lcp: number } }).mitsaMetrics.lcp)).toBeGreaterThan(0);
  await Promise.all(reads);
  const metrics = await page.evaluate(() => (window as unknown as { mitsaMetrics: { lcp: number; cls: number } }).mitsaMetrics);
  const gzipBytes = [...bundles.values()].reduce((sum, body) => sum + gzipSync(body).length, 0);
  writeFileSync(info.outputPath("performance.json"), JSON.stringify({ environment: "Local Edge, unthrottled laboratory; not field performance", ...metrics, totalInitialJavaScriptGzipBytes: gzipBytes }, null, 2));
  expect(metrics.lcp).toBeGreaterThan(0);
  expect(metrics.lcp).toBeLessThanOrEqual(2500);
  expect(metrics.cls).toBeLessThanOrEqual(.1);
  expect(gzipBytes).toBeLessThan(250 * 1024);
  await expect(page.locator("canvas")).toHaveCount(0);
});


test("enhanced desktop loads within its deferred budget without shifting content",async({page},info)=>{
  test.skip(info.project.name!=="desktop");
  await page.setViewportSize({width:1440,height:900});
  const reads:Promise<void>[]=[]; const bundles=new Map<string,Buffer>();
  page.on("response",r=>{if(/\/_next\/static\/.*\.js$/.test(r.url())) reads.push(r.body().then(b=>{bundles.set(r.url(),b);}));});
  await page.addInitScript(()=>{
    const metrics={lcp:0,cls:0}; Object.defineProperty(window,"mitsaMetrics",{value:metrics});
    new PerformanceObserver(list=>{for(const e of list.getEntries()) metrics.lcp=e.startTime;}).observe({type:"largest-contentful-paint",buffered:true});
    new PerformanceObserver(list=>{for(const e of list.getEntries()){const s=e as PerformanceEntry&{hadRecentInput:boolean;value:number};if(!s.hadRecentInput)metrics.cls+=s.value;}}).observe({type:"layout-shift",buffered:true});
  });
  await page.goto("/");
  await expect(page.locator("[data-hero-stage]")).toHaveAttribute("data-renderer","ready");
  await Promise.all(reads);
  const metrics=await page.evaluate(()=>(window as unknown as {mitsaMetrics:{lcp:number;cls:number}}).mitsaMetrics);
  const totalJavaScriptGzipBytes=[...bundles.values()].reduce((s,b)=>s+gzipSync(b).length,0);
  const modelBytes=await page.evaluate(()=>performance.getEntriesByType("resource").filter(r=>r.name.endsWith(".glb")).reduce((s,r)=>s+(r as PerformanceResourceTiming).decodedBodySize,0));
  writeFileSync(info.outputPath("enhanced-performance.json"),JSON.stringify({environment:"Local Edge, unthrottled laboratory; not field performance",...metrics,totalJavaScriptGzipBytes,modelBytes},null,2));
  expect(metrics.lcp).toBeGreaterThan(0); expect(metrics.lcp).toBeLessThanOrEqual(2500); expect(metrics.cls).toBeLessThanOrEqual(.1);
  expect(totalJavaScriptGzipBytes).toBeLessThan(650*1024); expect(modelBytes).toBeGreaterThan(0); expect(modelBytes).toBeLessThan(1024*1024);
});
