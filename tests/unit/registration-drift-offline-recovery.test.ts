import {it,expect} from 'vitest';
import pg from 'pg';
import {preservationDifferences} from '../../scripts/lib/registration-preservation-diff.mjs';
const example=()=>({target:{projectRef:'fixture'},rows:{'private.example':[{id:'hidden-record',name:'hidden-person'}]},identities:{users:[{id:'hidden-account',digest:'old'}],mfa_factors:[]},security:{policies:[]}});
// pg-types' TypeId union omits array OIDs; the runtime registry supports them.
const arrayParser=(oid:number)=>pg.types.getTypeParser(oid as Parameters<typeof pg.types.getTypeParser>[0]);
it('reproduces the real pg name-array parser mismatch with no database connection',()=>{const keys=arrayParser(1003)('{id}');expect(typeof keys).toBe('string');const b=example();expect(()=>preservationDifferences(b,b,{'private.example':keys})).toThrow(TypeError);});
it('the proposed text-array cast supplies the array shape expected by the comparator',()=>{const keys=arrayParser(1009)('{id}');expect(keys).toEqual(['id']);const b=example();expect(preservationDifferences(b,b,{'private.example':keys}).exactSnapshotMatches).toBe(true);});
it('unchanged application rows allow offline Auth fingerprint attribution without a key registry',()=>{const b=example(),a=structuredClone(b);a.identities.users[0].digest='new';const r=preservationDifferences(b,a,{});expect(r.differences).toEqual([{category:'auth-row-digest',table:'users',addedRows:0,removedRows:0,changedRows:1}]);expect(r.representationOrOrderingOnly).toBe(false);expect(JSON.stringify(r)).not.toContain('hidden-');expect(r.replacementBaselineApproved).toBe(false);});
