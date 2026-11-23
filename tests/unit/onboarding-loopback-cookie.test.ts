import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {existsSync,writeFileSync} from 'node:fs';
import {chromium} from '@playwright/test';
const edge='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
it.skipIf(!existsSync(edge))('OFFLINE fresh Edge context preserves Secure enrollment cookies on HTTP 127.0.0.1',async()=>{
 let received=false,outside=0;
 const server=createServer((req,res)=>{res.setHeader('content-type','text/html');if(req.url==='/set')res.setHeader('set-cookie','mitsa-offline-enrollment=OFFLINE-SENTINEL; Secure; HttpOnly; SameSite=Strict; Path=/');if(req.url==='/check')received=req.headers.cookie?.includes('mitsa-offline-enrollment=OFFLINE-SENTINEL')===true;res.end('<!doctype html><title>Offline cookie check</title>Local test only');});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('Offline test socket missing');const origin=`http://127.0.0.1:${address.port}`;
 let browser;
 try{
  browser=await chromium.launch({executablePath:edge,headless:true});const context=await browser.newContext();
  await context.route('**/*',async route=>{if(new URL(route.request().url()).origin===origin)await route.continue();else{outside++;await route.abort('blockedbyclient');}});
  const page=await context.newPage();await page.goto(origin+'/set');const stored=(await context.cookies()).some(c=>c.name==='mitsa-offline-enrollment'&&c.secure&&c.httpOnly);await page.goto(origin+'/check');
  writeFileSync(`artifacts/onboarding-loopback-cookie-observation-${Date.now()}.json`,JSON.stringify({offline:true,cookieStored:stored,cookieSent:received,outsidePageRequests:outside,freshBrowserContext:true,hostedAuthRequests:0})+'\n',{flag:'wx'});
  expect(stored).toBe(true);expect(received).toBe(true);expect(outside).toBe(0);await context.close();
 }finally{await browser?.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
},30000);
