// Invoked by the protected PowerShell prompt. No network or provider changes.
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'dotenv';
import {prepareTurnstileConfig} from './lib/turnstile-local-config.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),path=resolve(root,'.env.local'),temporary=resolve(root,'.env.local.turnstile-tmp');let createdTemporary=false;
try {
 if(process.platform!=='win32'||existsSync(temporary))throw Error('Local setup unavailable');
 execFileSync('git',['check-ignore','--quiet','.env.local'],{cwd:root,stdio:'ignore',windowsHide:true});
 execFileSync('git',['check-ignore','--quiet','.env.local.turnstile-tmp'],{cwd:root,stdio:'ignore',windowsHide:true});
 const text=readFileSync(path,'utf8'),env=parse(text),target=JSON.parse(readFileSync(resolve(root,'config/test-target.json'),'utf8'));
 if(env.SUPABASE_URL!==`https://${target.projectRef}.supabase.co`||env.APP_ORIGIN!=='http://127.0.0.1:3000')throw Error('Isolated loopback target required');
 let input='';for await(const part of process.stdin){input+=part;if(input.length>4096)throw Error('Invalid input');}
 const keys=JSON.parse(input),next=prepareTurnstileConfig(text,keys.siteKey,keys.secretKey);
 if(readFileSync(path,'utf8')!==text)throw Error('Configuration changed during setup');
 writeFileSync(temporary,next,{flag:'wx',mode:0o600});createdTemporary=true;renameSync(temporary,path);
 console.log('Private Turnstile configuration saved. Registration remains isolated-test. No network or Supabase change was made.');
}catch{
 console.error('Turnstile configuration was not saved; private details suppressed. Check local mode, Git exclusions and widget keys.');process.exitCode=1;
}finally{if(createdTemporary&&existsSync(temporary))unlinkSync(temporary);}
