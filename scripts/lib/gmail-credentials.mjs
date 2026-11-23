// Local Windows operator only. DPAPI data never enters Next, a command-line
// argument, an environment variable, a report or source-controlled file.
import {execFileSync} from 'node:child_process';
import {join,resolve,sep} from 'node:path';
import {existsSync} from 'node:fs';
export function gmailCredentialFilePresent() {
 if(process.platform!=='win32'||!process.env.LOCALAPPDATA)return false;
 const path=resolve(join(process.env.LOCALAPPDATA,'Mitsa','Private','gmail-smtp.dpapi'));
 if(path.toLowerCase().startsWith((resolve('.')+sep).toLowerCase()))throw Error('SMTP credential storage must be outside the checkout');
 return existsSync(path);
}
export function readProtectedGmailCredentials() {
 if(!gmailCredentialFilePresent())throw Error('Protected SMTP configuration unavailable');
 const command=`$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $taskPath=Join-Path $env:LOCALAPPDATA 'Mitsa\\Private\\gmail-smtp.dpapi'; $taskData=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($taskPath),[Text.Encoding]::UTF8.GetBytes('Mitsa Gmail SMTP v1'),[Security.Cryptography.DataProtectionScope]::CurrentUser); try { [Console]::Out.Write([Text.Encoding]::UTF8.GetString($taskData)) } finally { [Array]::Clear($taskData,0,$taskData.Length) }`;
 try {
  const raw=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:16384});
  const value=JSON.parse(raw);
  if(value.version!==1||typeof value.sender!=='string'||typeof value.appPassword!=='string'||!/^[a-z]{16}$/i.test(value.appPassword))throw Error('Invalid protected configuration');
  return {sender:value.sender,appPassword:value.appPassword};
 }catch{throw Error('Protected SMTP configuration unavailable; private details suppressed');}
}
