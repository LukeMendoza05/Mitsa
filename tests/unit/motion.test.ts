import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { eligibleForHero, inventoryAssembly, inventoryGroups } from "../../src/components/motion/hero-state";

test("all authored groups assemble in order and reverse without overshoot", () => {
  inventoryGroups.forEach((_, i) => {
    expect(inventoryAssembly(0,i)).toBe(0);
    expect(inventoryAssembly(1,i)).toBe(1);
    const forward = Array.from({length:101},(_,p)=>inventoryAssembly(p/100,i));
    expect(forward.every((v,p)=>v>=0&&v<=1&&(!p||v>=forward[p-1]))).toBe(true);
    expect([...forward].reverse()).toEqual(Array.from({length:101},(_,p)=>inventoryAssembly(1-p/100,i)) .map(v=>expect.closeTo(v,10)));
  });
  expect(eligibleForHero(390,844,false,false)).toBe(false);
  expect(eligibleForHero(1440,900,true,false)).toBe(false);
  expect(eligibleForHero(1440,900,false,true)).toBe(false);
});

test("final Blender export contains every actor within the approved asset budget", () => {
  const bytes=readFileSync("public/mitsa/mitsa-inventory-assembly.glb");
  expect(bytes.length).toBeLessThan(1024*1024);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  for(const group of inventoryGroups) expect(json.nodes.some((n:{name:string})=>n.name===group)).toBe(true);
  expect(json.materials.length).toBeLessThanOrEqual(6);
  expect(json.cameras??[]).toHaveLength(0);
  expect(json.meshes.flatMap((m:{primitives:{indices:number}[]})=>m.primitives).reduce((sum:number,p:{indices:number})=>sum+json.accessors[p.indices].count/3,0)).toBeLessThan(30000);
});
