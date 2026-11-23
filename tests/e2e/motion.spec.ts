import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";

test("desktop story stays synchronized forward, backward, through anchors and resize", async ({page}, info) => {
  test.skip(info.project.name !== "desktop");
  await page.setViewportSize({width:1440,height:900});
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/");
  const stage=page.locator("[data-hero-stage]");
  await expect(stage).toHaveAttribute("data-renderer","ready");
  const bounds=await page.locator("[data-hero-track]").evaluate(el=>({start:scrollY+el.getBoundingClientRect().top-76,distance:innerHeight*1.5}));
  mkdirSync("docs/previews/mitsa-motion",{recursive:true});
  for(const p of [0,.25,.5,.75,1,.5,0]) {
    await page.evaluate(y=>scrollTo(0,y),bounds.start+bounds.distance*p);
    await expect.poll(async()=>Number(await stage.getAttribute("data-progress"))).toBeCloseTo(p,2);
    await expect.poll(async()=>Number(await page.locator("canvas").getAttribute("data-assembly"))).toBeCloseTo(p<.58?0:p>.85?1:((p-.58)/.27)**2*(3-2*((p-.58)/.27)),2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if([0,.5,1].includes(p)) await page.screenshot({path:`docs/previews/mitsa-motion/pose-${p}.png`});
  }
  await page.getByRole("navigation",{name:"Main navigation"}).getByRole("link",{name:"Workspace",exact:true}).click();
  await expect.poll(async()=>Number(await stage.getAttribute("data-progress"))).toBeCloseTo(1,2);
  await expect.poll(async()=>Number(await page.locator("canvas").getAttribute("data-assembly"))).toBe(1);
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  const anchor=page.getByRole("navigation",{name:"Main navigation"}).getByRole("link",{name:"Workspace",exact:true});
  await anchor.focus(); await anchor.press("Enter");
  await expect(page.locator("#workspace")).toBeFocused();
  const budget=await page.locator("canvas").evaluate(el=>({... (el as HTMLElement).dataset}));
  expect(Number(budget.drawCalls)).toBeLessThanOrEqual(25);
  expect(Number(budget.triangles)).toBeLessThan(30000);
  const frames=Number(budget.frames);
  await page.waitForTimeout(500);
  expect(Number(await page.locator("canvas").getAttribute("data-frames"))).toBeLessThanOrEqual(frames+2);
  await page.setViewportSize({width:768,height:900});
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await page.setViewportSize({width:1440,height:900});
  await expect(stage).toHaveAttribute("data-renderer","ready");
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await expect(page.locator("#workspace")).toBeVisible();
  expect(errors).toEqual([]);
  writeFileSync(info.outputPath("renderer-budget.json"),JSON.stringify(budget,null,2));
});

test("authored posters survive failed WebGL asset loading",async({page},info)=>{
  test.skip(info.project.name!=="desktop");
  await page.setViewportSize({width:1440,height:900});
  await page.route("**/mitsa-inventory-assembly.glb",r=>r.abort());
  await page.goto("/");
  await expect(page.locator("[data-hero-stage]")).toHaveAttribute("data-renderer","unavailable");
  await expect(page.locator("[data-intro-poster] img")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("wheel scrolling eases, reverses and leaves the pinned scene with a measured frame budget",async({browser},info)=>{
  test.skip(info.project.name!=="desktop");
  test.setTimeout(60000);
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:"docs/previews/mitsa-motion",size:{width:1440,height:900}}});
  const page=await context.newPage();
  const video=page.video()!;
  await page.goto("http://127.0.0.1:3000/");
  const stage=page.locator("[data-hero-stage]");
  await expect(stage).toHaveAttribute("data-renderer","ready");
  const start=await page.locator("[data-hero-track]").evaluate(el=>scrollY+el.getBoundingClientRect().top-76);
  await page.evaluate(y=>scrollTo(0,y),start);
  await page.waitForTimeout(300);
  const measuring=page.evaluate(()=>new Promise<number[]>(resolve=>{
    const deltas:number[]=[]; let last=performance.now(); const end=last+4000;
    function frame(now:number){deltas.push(now-last);last=now;if(now<end)requestAnimationFrame(frame);else resolve(deltas.slice(3));}
    requestAnimationFrame(frame);
  }));
  await page.mouse.move(700,500);
  for(let i=0;i<6;i++){await page.mouse.wheel(0,220);await page.waitForTimeout(200);}
  await expect.poll(async()=>Number(await stage.getAttribute("data-progress"))).toBeGreaterThan(.9);
  await page.waitForTimeout(350);
  for(let i=0;i<4;i++){await page.mouse.wheel(0,-220);await page.waitForTimeout(200);}
  await expect.poll(async()=>Number(await stage.getAttribute("data-progress"))).toBeLessThan(.4);
  const deltas=(await measuring).sort((a,b)=>a-b);
  const p95=deltas[Math.floor(deltas.length*.95)];
  writeFileSync(info.outputPath("motion-performance.json"),JSON.stringify({environment:"Local Edge, unthrottled; not physical-device qualification",frameP95Milliseconds:p95,frames:deltas.length},null,2));
  expect(p95).toBeLessThanOrEqual(20);
  for(let i=0;i<9;i++){await page.mouse.wheel(0,220);await page.waitForTimeout(80);}
  await expect.poll(()=>page.locator("#capabilities").evaluate(el=>el.getBoundingClientRect().top)).toBeLessThan(900);
  await context.close();
  await video.saveAs("docs/previews/mitsa-motion/forward-reverse.webm");
  await video.delete();
});

test("native-size layouts omit WebGL and preserve readable previews",async({page})=>{
  const assets:string[]=[];
  page.on("request",r=>assets.push(r.url()));
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:900});
    await page.goto("/");
    await expect(page.locator("[data-landing-motion]")).toHaveAttribute("data-landing-motion","native");
    await expect(page.locator("canvas,.pin-spacer")).toHaveCount(0);
    await page.locator("header summary").click();
    await page.getByRole("navigation",{name:"Mobile navigation"}).getByRole("link",{name:"Workspace",exact:true}).click();
    await expect.poll(()=>page.locator("#workspace").evaluate(el=>el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(76);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  expect(assets.some(url=>url.endsWith(".glb"))).toBe(false);
});


test("actual WebGL context loss restores the authored fallback",async({page},info)=>{
  test.skip(info.project.name!=="desktop");
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/");
  await expect(page.locator("[data-hero-stage]")).toHaveAttribute("data-renderer","ready");
  await page.locator("canvas").evaluate(el=>(el as HTMLCanvasElement).getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext());
  await expect(page.locator("[data-hero-stage]")).toHaveAttribute("data-renderer","unavailable");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("[data-intro-poster] img")).toBeVisible();
});


test("complete workspace fits the pinned viewport at supported desktop heights",async({page},info)=>{
  test.skip(info.project.name!=="desktop");
  await page.setViewportSize({width:1440,height:900});
  await page.goto("/#workspace");
  for(const width of [1024,1440]) for(const height of [820,900,1000]){
    await page.setViewportSize({width,height});
    // ScrollTrigger debounces resize refresh; review the settled layout.
    await page.waitForTimeout(250);
    await page.getByRole("navigation",{name:"Main navigation"}).getByRole("link",{name:"Workspace",exact:true}).click();
    await expect.poll(async()=>Number(await page.locator("[data-hero-stage]").getAttribute("data-progress"))).toBeCloseTo(1,2);
    await expect.poll(()=>page.locator("#workspace").evaluate(el=>Math.abs(el.getBoundingClientRect().top-76))).toBeLessThan(2);
    const bounds=await page.locator("#workspace").evaluate(el=>el.getBoundingClientRect().toJSON());
    expect(bounds.top).toBeGreaterThanOrEqual(75);
    expect(bounds.bottom).toBeLessThanOrEqual(height);
    await page.screenshot({path:`docs/previews/mitsa-motion/workspace-${width}-${height}.png`});
  }
  await page.setViewportSize({width:1440,height:680});
  await expect(page.locator("canvas,.pin-spacer")).toHaveCount(0);
});










test("short laptops retain a shorter reversible pin with a readable workspace in document flow",async({page},info)=>{
  test.skip(info.project.name!=="desktop");
  for(const [width,height] of [[1280,800],[1366,768]]){
    await page.setViewportSize({width,height});await page.goto("/");
    const track=page.locator("[data-hero-track]"),intro=page.locator("[data-hero-intro]");
    await expect(track).toHaveAttribute("data-story","compact");
    await expect(page.locator("[data-hero-stage]")).toHaveAttribute("data-renderer","ready");
    const start=await track.evaluate(e=>scrollY+e.getBoundingClientRect().top-76);
    for(const progress of [0,.25,.5,.75,1,.5,0]){
      await page.evaluate(y=>scrollTo(0,y),start+height*.85*progress);
      await expect.poll(async()=>Number(await page.locator("[data-hero-stage]").getAttribute("data-progress"))).toBeCloseTo(progress,2);
      await expect.poll(()=>intro.evaluate(e=>Math.abs(e.getBoundingClientRect().top-76))).toBeLessThan(2);
      const art=await page.locator("canvas").boundingBox();
      expect(art!.y).toBeGreaterThanOrEqual(76);
      expect(art!.y+art!.height).toBeLessThanOrEqual(height+1);
    }
    await page.getByRole("navigation",{name:"Main navigation"}).getByRole("link",{name:"Workspace",exact:true}).click();
    await expect.poll(()=>page.locator("#workspace").evaluate(e=>Math.abs(e.getBoundingClientRect().top-100))).toBeLessThan(2);
    expect(await page.locator("#workspace").evaluate(e=>getComputedStyle(e).position)).toBe("relative");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});

test("one sample scenario supplies visible chart values and static preview affordances",async({page})=>{
  await page.goto("/");
  await expect(page.locator("[data-preview-static]").getByRole("button")).toHaveCount(0);
  await expect(page.locator("[data-preview-static] a,[data-preview-static] input,[data-preview-static] [tabindex]")).toHaveCount(0);
  const chartSeries=await page.locator("[data-sales-values]").evaluateAll(nodes=>nodes.map(e=>e.getAttribute("data-sales-values")));
  expect(new Set(chartSeries).size).toBe(1);
  expect(chartSeries[0]!.split(",").reduce((sum,n)=>sum+Number(n),0)).toBe(12480);
  await expect(page.getByText("3 of 6 products · 44 available").first()).toBeAttached();
  await expect(page.getByText("3 of 18 orders · Includes completed").first()).toBeAttached();
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator("[data-floating-cards]")).toBeHidden();
  await expect(page.locator("#capabilities")).toContainText("Illustrative preview");
  expect(await page.locator("#capabilities [data-preview-disclosure]").count()).toBe(1);
});
