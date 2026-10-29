import {it,expect} from 'vitest';
import {registrationIntentionallyClosed,registrationPolicyMode} from '../../src/lib/auth/registration-policy';
it('labels explicitly disabled registration as closed on an empty backend',()=>{
 expect(registrationIntentionallyClosed('disabled',null,'https://preview.example.invalid')).toBe(true);
 expect(registrationPolicyMode('disabled',null).allowed).toBe(false);
});
it('keeps a missing policy unavailable in modes that could admit users',()=>{
 for(const mode of ['public','isolated-test','development-open','controlled-pilot']){
  expect(registrationIntentionallyClosed(mode,null,'https://preview.example.invalid')).toBe(false);
  expect(registrationPolicyMode(mode,null).allowed).toBe(false);
 }
});
