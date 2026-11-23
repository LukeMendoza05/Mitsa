import {it,expect} from 'vitest';
import pg from 'pg';
import {normalizePolicyRoles,expectedC1MembershipDelta,assertC1AuthGrantCapability} from '../../scripts/lib/stage-c1-catalog.mjs';

it('compares the real pg name-array result with the PGlite array without changing policy semantics',()=>{
 // pg supports name[] at runtime; its TypeId union omits array OID 1003.
 const nameArrayOid=1003 as Parameters<typeof pg.types.getTypeParser>[0];
 const postgres=pg.types.getTypeParser(nameArrayOid)('{app_registration}');
 expect(typeof postgres).toBe('string');
 const policy={cmd:'ALL',qual:'true',with_check:'true'};
 expect(normalizePolicyRoles([{...policy,roles:postgres}])).toEqual(normalizePolicyRoles([{...policy,roles:['app_registration']}]));
});
it('preserves quoted role identifiers, multiple roles and PUBLIC exactly',()=>{
 expect(normalizePolicyRoles([{roles:'{"role,one","role\\"two",public}'}])).toEqual([{roles:['role,one','role"two','public']}]);
});
it('does not hide a genuinely changed principal or policy predicate',()=>{
 const prior=[{roles:['app_registration'],qual:'true',with_check:'true'}];
 expect(normalizePolicyRoles([{...prior[0],roles:'{authenticated}'}])).not.toEqual(prior);
 expect(normalizePolicyRoles([{...prior[0],roles:'{app_registration}',qual:'false'}])).not.toEqual(prior);
 expect(normalizePolicyRoles(prior)).toEqual(prior);
});
it('accounts only for the documented creator ADMIN grant in the hosted non-superuser case',()=>{
 const delta={removed:[],added:[{role:'app_registration',member:'postgres',admin:false}]};
 expect(expectedC1MembershipDelta([{name:'postgres',superuser:false,createrole:true}],delta)).toEqual({removed:[],added:[...delta.added,{role:'app_registration',member:'postgres',admin:true}]});
 expect(expectedC1MembershipDelta([{name:'postgres',superuser:true,createrole:true}],delta)).toEqual(delta);
 expect(expectedC1MembershipDelta([{name:'postgres',superuser:false,createrole:false}],delta)).toEqual(delta);
});
it('blocks an incapable or unknown Auth-schema grantor before installation',()=>{
 expect(()=>assertC1AuthGrantCapability(false)).toThrow('stop before installation');
 expect(()=>assertC1AuthGrantCapability(undefined)).toThrow('stop before installation');
 expect(()=>assertC1AuthGrantCapability(true)).not.toThrow();
});
