import {it,expect} from 'vitest';
import {spawnSync,fork} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const entry=fileURLToPath(new URL('../../scripts/onboarding-next-child.mjs',import.meta.url));
it('denies standalone invocation before private state, Next imports or hosted work',()=>{
 const result=spawnSync(process.execPath,[entry,'--child'],{encoding:'utf8',windowsHide:true,timeout:10000});
 expect(result.status).toBe(1);expect(result.stdout).toBe('');expect(result.stderr).toContain('ONBOARDING_NEXT_START_DENIED_NO_RETRY');expect(result.stderr).not.toContain('SUPABASE_PUBLISHABLE_KEY');
});
it('rejects even an IPC child with the wrong private root before creating state',async()=>{
 const root=mkdtempSync(join(tmpdir(),'mitsa-next-denied-')),child=fork(entry,['--child'],{env:{...process.env,MITSA_ONBOARDING_NEXT_ROOT:root},silent:true,windowsHide:true} as any);
 child.stdout!.resume();child.stderr!.resume();const [code,signal]=await once(child,'exit');expect(code).toBe(1);expect(signal).toBeNull();expect(readdirSync(root)).toEqual([]);expect(()=>process.kill(child.pid!,0)).toThrow();
},10000);
