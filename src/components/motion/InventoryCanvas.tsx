"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AgXToneMapping, Mesh, Object3D, PCFShadowMap, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { easeRange, inventoryAssembly, inventoryGroups } from "./hero-state";

export type InventoryCanvasProps = {
  progress: RefObject<number>;
  subscribe: (listener: () => void) => () => void;
  onReady: () => void;
  onFail: (reason?: string) => void;
};

function InventoryScene({ progress, subscribe, onReady, onFail }: InventoryCanvasProps) {
  const [model, setModel] = useState<Object3D | null>(null);
  const { camera, invalidate, gl } = useThree();
  const visible = useRef(true);
  const firstFrame = useRef(false);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onFail("WebGL context lost"); };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl, onFail]);
  useEffect(() => {
    const controller = new AbortController();
    let loaded: Object3D | null = null;
    fetch("/mitsa/mitsa-inventory-assembly.glb", { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Model unavailable"); return response.arrayBuffer(); })
      .then(buffer => new GLTFLoader().parseAsync(buffer, "/mitsa/"))
      .then(gltf => {
        loaded = gltf.scene;
        if (controller.signal.aborted) { disposeModel(loaded); return; }
        loaded.traverse(object => {
          if (object instanceof Mesh) {
            object.castShadow = ["Carton_folded_shell","Tray_A_formed_tray","Tray_B_formed_tray"].includes(object.name);
            // Thin folded shells produce self-shadow striping. Let them cast
            // contact shadows while non-casting packages receive the shadows.
            object.receiveShadow = !object.castShadow;
          }
        });
        setModel(loaded);
      }).catch(error => { if (!controller.signal.aborted) onFail(error instanceof Error ? error.message : "asset load"); });
    return () => { controller.abort(); if (loaded) disposeModel(loaded); };
  }, [onFail]);

  useEffect(() => {
    if (!model) return;
    const actors = inventoryGroups.map((name, index) => {
      const object = model.getObjectByName(name);
      return object ? { object, index, position: object.position.clone(), offset: new Vector3(object.userData.intro_offset[0], object.userData.intro_offset[2], -object.userData.intro_offset[1]), rotation: object.userData.intro_rotation as number[] } : null;
    });
    if (actors.some(actor => !actor)) { onFail("Missing inventory group"); return; }
    function update() {
      if (!visible.current || document.hidden) return;
      const p = progress.current;
      for (const actor of actors) {
        if (!actor) continue;
        const separation = 1 - inventoryAssembly(p, actor.index);
        actor.object.position.copy(actor.position).addScaledVector(actor.offset, separation);
        actor.object.rotation.set(actor.rotation[0]*separation, actor.rotation[2]*separation, -actor.rotation[1]*separation);
      }
      const movement = 1 - easeRange(p, 0.15, 0.85);
      camera.position.set(7.5 + movement*0.35, 8.2 + movement*0.8, 10.5 + movement*0.35);
      camera.lookAt(0, 0.5 + movement*1.1, 0);
      invalidate();
    }
    const observer = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; if (entry.isIntersecting) update(); });
    observer.observe(gl.domElement);
    const stop = subscribe(update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => { stop(); observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, [model, camera, gl, invalidate, onFail, progress, subscribe]);

  useFrame(() => {
    const canvas = gl.domElement;
    canvas.dataset.frames = String(Number(canvas.dataset.frames ?? 0) + 1);
    canvas.dataset.drawCalls = String(gl.info.render.calls);
    canvas.dataset.triangles = String(gl.info.render.triangles);
    canvas.dataset.assembly = inventoryAssembly(progress.current, 8).toFixed(4);
    if (model && !firstFrame.current) { firstFrame.current = true; requestAnimationFrame(onReady); }
  });
  return <>
    <hemisphereLight args={["#ffffff", "#d0cfc9", 1.2]} />
    <directionalLight position={[-4, 9, 6]} intensity={2} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-normalBias={0.03} shadow-bias={-0.0001} />
    <directionalLight position={[5,4,-3]} intensity={0.9} />
    {model && <primitive object={model} />}
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.04,0]} receiveShadow><planeGeometry args={[30,30]} /><shadowMaterial transparent opacity={0.11} /></mesh>
  </>;
}

function disposeModel(model: Object3D) {
  model.traverse(object => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    }
  });
}

export default function InventoryCanvas(props: InventoryCanvasProps) {
  return <Canvas resize={{ offsetSize: true, scroll: false }} frameloop="demand" dpr={[1,1.5]} shadows camera={{ position: [7.5,9,10.5], fov: 32, near: 0.1, far: 60 }} gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => {
    gl.toneMapping = AgXToneMapping;
    gl.shadowMap.type = PCFShadowMap;
  }}><InventoryScene {...props} /></Canvas>;
}


