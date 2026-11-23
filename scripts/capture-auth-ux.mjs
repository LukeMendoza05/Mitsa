import {chromium} from "@playwright/test";
import {mkdirSync,writeFileSync} from "node:fs";
const phase=process.argv[2],origin="http://127.0.0.1:3000";
if(!["before","after"].includes(phase))throw Error("Choose before or after");
const sizes=[[320,568],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080]];
const browser=await chromium.launch({channel:"msedge",headless:true});
const results=[];
try {
  const context=await browser.newContext({reducedMotion:"reduce"}),page=await context.newPage();
  mkdirSync(`docs/previews/auth-refresh/${phase}`,{recursive:true});
  for(const route of ["login","signup"])for(const [width,height] of sizes){
    await page.setViewportSize({width,height});const response=await page.goto(`${origin}/${route}`);if(response?.status()!==200)throw Error("Authentication page unavailable");await page.evaluate(()=>document.fonts.ready);
    const path=`docs/previews/auth-refresh/${phase}/${route}-${width}x${height}.png`;
    await page.screenshot({path,fullPage:true});results.push({route,width,height,path,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),title:await page.title()});
  }
  writeFileSync(`docs/previews/auth-refresh/${phase}/manifest.json`,JSON.stringify({capturedAt:new Date().toISOString(),origin,phase,results},null,2));
  console.log(JSON.stringify({phase,captures:results.length,overflowing:results.filter(r=>r.overflow).length,credentialsEntered:false}));
}finally{await browser.close();}
