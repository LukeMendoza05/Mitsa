import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Loopback-only operator console. No codes, passwords, identities or keys in UI.
export async function stageCPanel({selection,siteKey='',agreement='',operate,status,reserve,port=3301}){
 const csrf=randomBytes(32).toString('hex');let boundPort=port;const origin=()=>`http://127.0.0.1:${boundPort}`;
 const server=createServer(async(req,res)=>{
  res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');
  res.setHeader('content-security-policy',"default-src 'none'; script-src https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  if(req.headers.host!==`127.0.0.1:${boundPort}`){res.writeHead(403).end();return;}
  try{
   reserve();
   if(req.method==='GET'&&req.url==='/'){
    res.setHeader('content-type','text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Mitsa Stage C operator</title><h1>Mitsa Stage C ${selection}</h1><p>Private operator test. No general registration. Never share codes, keys or screenshots.</p><pre>${escape(JSON.stringify(status(),null,2))}</pre><form method="post" action="/control"><input type="hidden" name="csrf" value="${csrf}"><label>Fixture <select name="label"><option>c3b-a</option>${selection==='B'?'<option>c3b-b</option>':''}</select></label><p>${escape(agreement)}</p><label><input type="checkbox" name="accepted" value="yes">I accept these unpublished synthetic-test notices.</label>${selection==='B'?`<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script><div class="cf-turnstile" data-sitekey="${escape(siteKey)}" data-action="signup"></div>`:''}<p><select name="action">${(selection==='A'?['send-diagnostic','receipt','finish']:['signup','resend','cooldown','receipt','verify','expire','finish','stop']).map(a=>`<option>${a}</option>`).join('')}</select> <button>Execute selected test step</button></p></form><p>Receipt means you checked the dedicated inbox for the selected fixture's latest message. Expire is available only after the actual provider lifetime. Refresh this page for updated status; challenges are one-use.</p></html>`);return;
   }
   if(req.method!=='POST'||req.url!=='/control'||req.headers.origin!==origin()){res.writeHead(403).end();return;}
   let body='';for await(const chunk of req){body+=chunk.toString('utf8');if(Buffer.byteLength(body)>4096)throw Error('Input too large');}
   const values=new URLSearchParams(body),given=Buffer.from(values.get('csrf')??'');if(given.length!==64||!timingSafeEqual(given,Buffer.from(csrf))){res.writeHead(403).end();return;}
   await operate({action:values.get('action'),label:values.get('label'),accepted:values.get('accepted')==='yes',proof:values.get('cf-turnstile-response')??''});
   res.writeHead(303,{location:'/'}).end();
  }catch{res.writeHead(409,{'content-type':'text/plain'}).end('Step unavailable or refused. Check the sanitized operator status. No automatic retry occurred.');}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 const address=server.address();if(address&&typeof address!=='string')boundPort=address.port;
 return {url:origin(),async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
