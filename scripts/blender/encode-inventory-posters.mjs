import sharp from 'sharp';
import fs from 'node:fs';
for(const name of ['inventory-intro','inventory-assembled']){
  const input=`assets/source/mitsa-inventory/${name}.png`;
  await sharp(input).webp({quality:85,effort:5}).toFile(`public/mitsa/${name}.webp`);
  await sharp(input).resize({width:900}).webp({quality:85,effort:5}).toFile(`public/mitsa/${name}-mobile.webp`);
}
const bytes=fs.readFileSync('public/mitsa/mitsa-inventory-assembly.glb');
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
const report={bytes:bytes.length,triangles:gltf.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+gltf.accessors[p.indices].count/3,0),meshes:gltf.meshes.length,materials:gltf.materials.length,groups:gltf.nodes.filter(n=>n.extras?.assembly_role).map(n=>n.name),cameras:gltf.cameras?.length||0,extensions:gltf.extensionsUsed};
fs.writeFileSync('assets/source/mitsa-inventory/validation.json',JSON.stringify(report,null,2));
console.log(report);
