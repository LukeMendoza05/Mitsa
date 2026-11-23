// Pure package review: no provider client, filesystem reads or secret access.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import ts from 'typescript';

export const c2Paths=Object.freeze([
 'supabase/functions/mitsa-registration-service/index.ts',
 'supabase/functions/mitsa-registration-service/deno.json',
 'supabase/functions/mitsa-registration-service/deno.lock',
 'supabase/functions/_shared/registration-service.ts',
 'supabase/functions/_shared/registration-service-auth.ts',
 'supabase/functions/_shared/registration-intent-auth.ts',
 'src/lib/auth/persistent-registration.ts',
]);
const reviewedHashes=Object.freeze([
 '248965336eda834de507f842487673619dec677cf13d3947c500b22d66d485f0',
 '1b6167a0ee26abd3478ff5918e2de9eb6bc87d7c01f63892e1aeeea5277b6d8f',
 'ce70e91004a0d31208a73048996e177b3adebb246cc1a422ace2c4e247d9b825',
 '8dc648df54856937a6e0cce0b556297fd14b3146a4ddd96ac04abfc3592b452c',
 '74fb4d841f021c5db64856fc638e2268197faee13a22edddcaeba5b8330cca3f',
 '969dab701f69c29f2acc33de991e47fe7c883ba50eddcc849e3aded215e1669b',
 'bbd62568f1b1e6cea779f4efeb60fa1ac89ca35d57202523e8e5c91128341cf3',
]);
export function assertC2Proposal(p){
 assert.equal(p.version,1);assert.equal(p.project,'mjtejwafxriwntweussc');
 assert.equal(p.databaseMarker,'fireworks-foundation-proof-01a12e38');
 assert.equal(p.functionName,'mitsa-registration-service');assert.equal(p.entrypoint,c2Paths[0]);assert.equal(p.importMap,c2Paths[1]);
 assert.equal(p.verifyJwt,false);assert.equal(p.enabled,false);assert.equal(p.localEngine,'legacy');assert.equal(p.origin,'http://127.0.0.1:3000');
 assert.deepEqual(p.smokeMethods,['GET','POST','GET']);
 assert.deepEqual(p.legacy,{name:'mitsa-registration-intent',version:3,verifyJwt:false,bundleSha256:'70003dc2425a7c00b75ffeda59881a752e1dbb8cb1b95f3afcaddc66bd241af5'});
 // Validate the exact allowlist before the caller reads any path.
 assert.deepEqual(p.files.map(f=>f.path),c2Paths);
 assert.deepEqual(p.files.map(f=>f.sha256),reviewedHashes,'approval source hashes changed');
}
export function assertC2SourceGraph(p,sources){
 assertC2Proposal(p);assert.deepEqual(Object.keys(sources).sort(),[...c2Paths].sort());
 for(const f of p.files)assert.equal(createHash('sha256').update(sources[f.path]).digest('hex'),f.sha256,'reviewed source drift');
 const imports=JSON.parse(sources[p.importMap]).imports;
 assert.deepEqual(imports,{'@supabase/supabase-js':'npm:@supabase/supabase-js@2.117.3',zod:'npm:zod@4.6.6'});
 const visited=new Set(),external=new Set();
 function visit(path){
  if(visited.has(path))return;visited.add(path);
  assert(c2Paths.includes(path)&&path.endsWith('.ts'),'unreviewed dependency');
  const ast=ts.createSourceFile(path,sources[path],ts.ScriptTarget.Latest,true);
  function inspect(node){
   if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require'))throw Error('Dynamic dependency is not reviewed');
   if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier){
    assert(ts.isStringLiteral(node.moduleSpecifier));const specifier=node.moduleSpecifier.text;
    if(specifier.startsWith('.')){const target=posix.normalize(posix.join(posix.dirname(path),specifier));assert(c2Paths.includes(target),'unreviewed relative dependency');visit(target);}
    else{assert(Object.hasOwn(imports,specifier),'unreviewed external dependency');external.add(specifier);}
   }
   ts.forEachChild(node,inspect);
  }
  inspect(ast);
 }
 visit(p.entrypoint);
 assert.deepEqual([...visited].sort(),c2Paths.filter(p=>p.endsWith('.ts')).sort());
 assert.deepEqual([...external].sort(),Object.keys(imports).sort());
 return {files:c2Paths.length,typescriptModules:visited.size,externalPackages:external.size};
}
export function assertC2HostedCatalog(catalog,p){
 assertC2Proposal(p);assert.equal(catalog.project,p.project);assert.equal(catalog.marker,p.databaseMarker);
 assert.equal(catalog.correctionVersion,'20261023134011');assert.equal(catalog.controlsDisabled,true);assert.equal(catalog.strictPolicy,true);
 assert.equal(catalog.cohorts,0);assert.equal(catalog.dispatches,0);
 assert.equal(catalog.serviceCommandExecute,true);assert.equal(catalog.servicePrivateCommandExecute,true);
 for(const permission of ['serviceApiUsage','servicePrivateUsage','hookPrivateUsage','beforeHookExecute','emailHookExecute'])assert.equal(catalog[permission],true,'required schema/function access absent');
 assert.equal(catalog.anonCommandExecute,false);assert.equal(catalog.authenticatedCommandExecute,false);assert.equal(catalog.registrationAuthUsage,false);
 assert.equal(catalog.functions.some(f=>f.name===p.functionName),false,'new service already installed: separate deployment review required');
 assert.equal(catalog.functions.length,1,'unexpected Edge service shares the project secret boundary');
 const legacy=catalog.functions.filter(f=>f.name===p.legacy.name);assert.equal(legacy.length,1);
 assert.equal(legacy[0].status,'ACTIVE');assert.equal(legacy[0].version,p.legacy.version);assert.equal(legacy[0].verify_jwt,p.legacy.verifyJwt);assert.equal(legacy[0].ezbr_sha256,p.legacy.bundleSha256);
}
