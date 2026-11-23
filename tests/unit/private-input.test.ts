import {it,expect,vi} from 'vitest';
import {fillPrivateInput} from '../support/private-input';
it('passes private input to the browser without altering it',async()=>{const fill=vi.fn().mockResolvedValue(undefined);await fillPrivateInput({fill},'synthetic-private-input');expect(fill).toHaveBeenCalledWith('synthetic-private-input');});
it('suppresses the original browser error and its private arguments',async()=>{const fill=vi.fn().mockRejectedValue(Error('synthetic-private-input'));try{await fillPrivateInput({fill},'synthetic-private-input');throw Error('Expected rejection');}catch(error){expect((error as Error).message).toBe('Private authentication input failed; value suppressed');expect((error as Error).cause).toBeUndefined();}});
