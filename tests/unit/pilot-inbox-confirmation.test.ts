import {it,expect,vi,afterEach} from 'vitest';
import {PassThrough} from 'node:stream';
import {waitForPilotInbox} from '../../scripts/lib/pilot-inbox-confirmation.mjs';
afterEach(()=>vi.useRealTimers());
it('allows a second stage only on the exact non-secret receipt signal',async()=>{const input=new PassThrough(),pending=waitForPilotInbox(input,90000,0);input.write('received\n');expect(await pending).toBe(true);});
it('fails closed on stop, unexpected input and stdin closure',async()=>{for(const line of ['stop\n','unrecognized\n']){const input=new PassThrough(),pending=waitForPilotInbox(input,90000,0);input.write(line);expect(await pending).toBe(false);}const input=new PassThrough(),pending=waitForPilotInbox(input,90000,0);input.end();expect(await pending).toBe(false);});
it('closes before approval expiry without a receipt and refuses invalid deadlines',async()=>{
 vi.useFakeTimers();const input=new PassThrough(),pending=waitForPilotInbox(input,90000,0);await vi.advanceTimersByTimeAsync(60000);expect(await pending).toBe(false);
 for(const expiry of [NaN,30000,-1,31*60000])expect(await waitForPilotInbox(new PassThrough(),expiry,0)).toBe(false);
});
