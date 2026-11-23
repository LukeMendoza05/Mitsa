import {it,expect,vi} from 'vitest';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {writeEncryptedCheckpoint,acquireStageBRunLock,boundedStageBFailure} from '../../scripts/lib/stage-b-checkpoint.mjs';
it('retries only transient local publication with the same encrypted bytes',async()=>{
 const rename=vi.fn().mockRejectedValueOnce({code:'EPERM'}).mockRejectedValueOnce({code:'EBUSY'}).mockResolvedValue(undefined),write=vi.fn().mockResolvedValue(undefined),wait=vi.fn().mockResolvedValue(undefined);
 const bytes=new Uint8Array([1,2,3]);await writeEncryptedCheckpoint('public-fixture.pgp',bytes,{writeFile:write,rename},wait);
 expect(write).toHaveBeenCalledTimes(1);expect(rename).toHaveBeenCalledTimes(3);expect(wait.mock.calls).toEqual([[100],[200]]);
 expect(write.mock.calls[0][1]).toBe(bytes);expect(write.mock.calls[0][2]).toMatchObject({flag:'wx',flush:true});
});
it('fails closed after bounded retries and does not retry unrelated failures',async()=>{
 const writeFile=vi.fn().mockResolvedValue(undefined),rename=vi.fn().mockRejectedValue({code:'EPERM'}),wait=vi.fn().mockResolvedValue(undefined);
 await expect(writeEncryptedCheckpoint('public-fixture.pgp',new Uint8Array([1]),{writeFile,rename},wait)).rejects.toMatchObject({code:'CHECKPOINT_PUBLISH_FAILED',fileSystemCode:'EPERM'});
 expect(rename).toHaveBeenCalledTimes(6);expect(writeFile).toHaveBeenCalledTimes(1);
 const other=vi.fn().mockRejectedValue({code:'ENOSPC'});await expect(writeEncryptedCheckpoint('public-fixture.pgp',new Uint8Array([1]),{writeFile,rename:other},wait)).rejects.toMatchObject({code:'CHECKPOINT_PUBLISH_FAILED',fileSystemCode:'other'});expect(other).toHaveBeenCalledTimes(1);
});
it('prevents simultaneous operator runs and releases only its own lock',()=>{
 const root=mkdtempSync(join(tmpdir(),'mitsa-stage-b-lock-')),path=join(root,'active-run.lock');
 const release=acquireStageBRunLock(path,crypto.randomUUID());
 expect(()=>acquireStageBRunLock(path,crypto.randomUUID())).toThrow();release();expect(existsSync(path)).toBe(false);
 const next=acquireStageBRunLock(path,crypto.randomUUID());next();
});
it('failure evidence never includes private error contents',()=>{
 expect(boundedStageBFailure({name:'AssertionError',code:'ERR_ASSERTION',message:'private',stack:'private',detail:'private'})).toEqual({kind:'AssertionError',code:'ERR_ASSERTION',fileSystemCode:null});
 expect(JSON.stringify(boundedStageBFailure({name:'private',code:'private',message:'private'}))).not.toContain('private');
});
it.skipIf(process.platform!=='win32')('survives an actual Windows sharing lock that breaks immediate replacement',async()=>{
 const root=mkdtempSync(join(tmpdir(),'mitsa-stage-b-windows-')),path=join(root,'public-checkpoint.pgp'),legacy=join(root,'public-legacy.next');
 writeFileSync(path,'old public fixture');writeFileSync(legacy,'legacy public fixture');
 const literal=path.replaceAll("'","''"),script=`$handle=[IO.File]::Open('${literal}',[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);[Console]::WriteLine('locked');[Console]::Out.Flush();[Threading.Thread]::Sleep(900);$handle.Dispose()`;
 const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,NODE_ENV:'test'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 const finished=new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
 try{
  await new Promise<void>((resolve,reject)=>{child.stdout!.once('data',data=>String(data).includes('locked')?resolve():reject(Error('Synthetic lock not established')));child.once('error',reject);});
  let observed='';try{renameSync(legacy,path);}catch(error){observed=(error as NodeJS.ErrnoException).code??'';}
  expect(['EPERM','EACCES','EBUSY']).toContain(observed);
  await writeEncryptedCheckpoint(path,new Uint8Array(Buffer.from('new public fixture')));
  expect(readFileSync(path,'utf8')).toBe('new public fixture');expect(await finished).toBe(0);
 }finally{if(child.exitCode===null)child.kill();}
},15000);
