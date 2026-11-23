import {it,expect} from 'vitest';
import {safeRelayFailure} from '../../scripts/lib/pilot-relay-process.mjs';
it('retains only known safe child failure fields',()=>{
 const result=safeRelayFailure({stdout:'',stderr:JSON.stringify({stage:'approved-delivery',status:'Pilot relay stopped; no automatic retry',smtpConnectionsAttempted:0,email:'private@example.invalid',code:'654321',password:'private-secret'})});
 expect(result).toEqual({kind:'child-failed',stage:'approved-delivery',status:'Pilot relay stopped; no automatic retry',smtpConnectionsAttempted:0});expect(JSON.stringify(result)).not.toContain('private');
});
it('suppresses arbitrary errors, unknown stages and leaked values',()=>{
 const result=safeRelayFailure({message:'private password',stderr:'private address\n'+JSON.stringify({stage:'private password',status:'private code',smtpConnectionsAttempted:999})});expect(result).toEqual({kind:'child-failed'});
});
it('classifies bounded runtime/timeout errors without printing their contents',()=>{expect(safeRelayFailure({code:'ETIMEDOUT'})).toEqual({kind:'child-timeout'});expect(safeRelayFailure({stderr:'ERR_MODULE_NOT_FOUND at private path'})).toEqual({kind:'ERR_MODULE_NOT_FOUND'});});
