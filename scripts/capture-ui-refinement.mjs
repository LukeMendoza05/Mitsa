import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const phase=process.argv[2];if(!['before','after'].includes(phase))throw Error('Choose before or after.');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage();const report=[];mkdirSync(`docs/previews/ui-refinement/${phase}`,{recursive:true});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:3107'?route.continue():route.abort());
 for(const [name,path] of [['signup','/signup'],['members','/w/visual-workspace/members'],['security','/settings/account/security'],['account','/settings/account']]){
  await page.goto('http://127.0.0.1:3107'+path);await page.locator('h1').waitFor({timeout:20000});await page.evaluate(()=>document.fonts.ready);
  for(const width of phase==='after'?[390,768,1440]:[390,1440]){await page.setViewportSize({width,height:900});await page.screenshot({path:`docs/previews/ui-refinement/${phase}/${name}-${width}.png`,fullPage:true});report.push({name,width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
 }
 writeFileSync(`artifacts/ui-refinement-${phase}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
