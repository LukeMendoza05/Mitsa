"use client";

import { Component, useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useLandingMotion } from "./LandingExperience";
import { heroStage } from "./hero-state";
import type { InventoryCanvasProps } from "./InventoryCanvas";
import { PreviewDisclosure } from "../site/PreviewDisclosure";
import s from "./hero.module.css";

class SceneBoundary extends Component<{ children: ReactNode; onFail: (reason?: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onFail(error.message); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function HeroStory({ stock, sales, orders, workspace }: { stock: ReactNode; sales: ReactNode; orders: ReactNode; workspace: ReactNode }) {
  const motion = useLandingMotion();
  const engine = motion?.engine;
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLDivElement>(null);
  const modelViewport = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const listeners = useRef(new Set<() => void>());
  const [Renderer, setRenderer] = useState<ComponentType<InventoryCanvasProps> | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const enhanced = !!engine?.desktop;
  const compact = engine?.hero === "compact";
  const fail = useCallback((reason?: string) => { setFailed(true); setReady(false); if (stage.current) stage.current.dataset.rendererFailure = reason ?? "Renderer unavailable"; }, []);
  const loaded = useCallback(() => setReady(true), []);
  const subscribe = useCallback((listener: () => void) => { listeners.current.add(listener); return () => { listeners.current.delete(listener); }; }, []);

  useEffect(() => {
    if (!enhanced || failed || !track.current) return;
    let canceled = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      import("./InventoryCanvas").then(module => { if (!canceled) setRenderer(() => module.default); }).catch(error => fail(error instanceof Error ? error.message : "Renderer import"));
    }, { rootMargin: "150px" });
    observer.observe(track.current);
    return () => { canceled = true; observer.disconnect(); setRenderer(null); setReady(false); };
  }, [enhanced, failed, fail]);

  useEffect(() => {
    if (!engine || !enhanced || !track.current || !stage.current || !intro.current) return;
    const { gsap, ScrollTrigger } = engine;
    const stageElement = stage.current;
    const art = modelViewport.current;
    const cards = stageElement.querySelectorAll<HTMLElement>("[data-floating-preview]");
    const workspaceElement = stageElement.querySelector<HTMLElement>("[data-workspace-composition]")!;
    const dock = workspaceElement.querySelector<HTMLElement>("[data-inventory-dock]")!;
    const introPoster = stageElement.querySelector("[data-intro-poster]");
    const assembledPoster = stageElement.querySelector("[data-assembled-poster]");
    function dockTransform() {
      let targetX = 0, targetY = 0;
      let current: HTMLElement | null = dock;
      while (current && current !== stageElement) { targetX += current.offsetLeft; targetY += current.offsetTop; current = current.offsetParent as HTMLElement | null; }
      const width = art!.offsetWidth, height = art!.offsetHeight;
      const x = art!.offsetLeft, y = art!.offsetTop;
      const scale = Math.min(dock.offsetWidth / width, dock.offsetHeight / height) * 1.25;
      return { scale, x: targetX + dock.offsetWidth/2 - x - width/2, y: targetY + dock.offsetHeight/2 - y - height/2 };
    }
    function syncProgress(value: number) {
      progress.current = value;
      stageElement.dataset.progress = value.toFixed(4);
      stageElement.dataset.phase = heroStage(value);
      stageElement.querySelector("[data-floating-cards]")?.setAttribute("aria-hidden", String(value > 0.66));
      stageElement.querySelector("[data-scene-legend]")?.setAttribute("aria-hidden", String(value > 0.6));
      listeners.current.forEach(listener => listener());
    }
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: track.current, start: "top 76px", end: () => `+=${innerHeight*(compact?0.85:1.5)}`, pin: compact?intro.current:stageElement, pinSpacing: compact, scrub: true, invalidateOnRefresh: true,
          onUpdate: self => syncProgress(self.progress), onRefresh: self => syncProgress(self.progress) },
      });
      if (!compact) gsap.set(workspaceElement, { opacity: 0, y: 24, scale: 0.98 });
      gsap.set(assembledPoster, { opacity: 0 });
      timeline.to(cards[0], { x: -20, y: -6, rotationY: -3, rotationZ: -1.5, duration: 0.3 }, 0.15)
        .to(cards[1], { x: -16, y: 8, rotationY: 3, rotationZ: 1, duration: 0.3 }, 0.15)
        .to(cards[2], { x: 20, y: -8, rotationY: 3, rotationZ: 1.5, duration: 0.3 }, 0.15)
        .to(cards, { opacity: 0, scale: 0.92, y: 32, stagger: 0.02, duration: 0.24 }, 0.38)
        .to(stageElement.querySelector(`.${s.sceneLegend}`), { opacity: 0, duration: 0.2 }, 0.38)
        .to(art, { scale: () => compact?0.88:dockTransform().scale, x: () => compact?0:dockTransform().x, y: () => compact?12:dockTransform().y, ease: "power1.inOut", duration: 0.4 }, 0.43)
        .to(introPoster, { opacity: 0, duration: 0.35 }, 0.35)
        .to(assembledPoster, { opacity: 1, duration: 0.35 }, 0.35)
        .to({}, { duration: 0.15 }, 0.85);
      if (!compact) timeline.to(workspaceElement, { opacity: 1, y: 0, scale: 1, ease: "power1.inOut", duration: 0.24 }, 0.58);
      if (!compact) workspaceElement.querySelectorAll<SVGPathElement>("[data-chart-line]").forEach(line => {
        const length = line.getTotalLength();
        timeline.fromTo(line, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 0.2 }, 0.65);
      });
      if (motion) motion.workspaceTarget.current = () => compact?scrollY+workspaceElement.getBoundingClientRect().top-100:timeline.scrollTrigger!.end;
    }, stage);
    ScrollTrigger.refresh();
    return () => {
      context.revert();
      if (motion) motion.workspaceTarget.current = null;
      progress.current = 0;
      stageElement.querySelector("[data-floating-cards]")?.removeAttribute("aria-hidden");
      stageElement.querySelector("[data-scene-legend]")?.removeAttribute("aria-hidden");
      listeners.current.forEach(listener => listener());
    };
  }, [engine, enhanced, compact, motion?.workspaceTarget]);

  return <div ref={track} className={s.track} data-hero-track data-enhanced={enhanced} data-story={engine?.hero ?? "none"}>
    <div ref={stage} className={s.stage} data-hero-stage data-phase="introduction" data-progress="0" data-renderer={ready && enhanced && !failed ? "ready" : failed ? "unavailable" : "poster"}>
      <div ref={intro} className={s.introSurface} data-hero-intro>
      <div className={s.sceneViewport} ref={modelViewport} aria-hidden="true">
        <div className={s.posters} data-posters-hidden={ready && enhanced && !failed}>
          <picture data-intro-poster><source media="(max-width: 1023px)" srcSet="/mitsa/inventory-intro-mobile.webp" /><img src="/mitsa/inventory-intro.webp" width="1600" height="1100" alt="" loading="lazy" /></picture>
          <picture data-assembled-poster><source media="(max-width: 1023px)" srcSet="/mitsa/inventory-assembled-mobile.webp" /><img src="/mitsa/inventory-assembled.webp" width="1600" height="1100" alt="" loading="lazy" /></picture>
        </div>
        {enhanced && Renderer && !failed && <SceneBoundary onFail={fail}><Renderer progress={progress} subscribe={subscribe} onReady={loaded} onFail={fail} /></SceneBoundary>}
      </div>
      <div className={s.floatingCards} data-floating-cards>
        <div data-floating-preview className={s.stock}>{stock}</div>
        <div data-floating-preview className={s.sales}>{sales}</div>
        <div data-floating-preview className={s.orders}>{orders}</div>
      </div>
      <div className={s.sceneLegend} data-scene-legend><PreviewDisclosure>Fictional figures for the planned workspace.</PreviewDisclosure>{enhanced && <span>Scroll to bring it together ↓</span>}</div>
      </div>
      <section id="workspace" className={s.workspace} data-workspace-composition aria-labelledby="workspace-title">
        <div className={s.workspaceHeading}><p>The Mitsa workspace</p><h2 id="workspace-title">Your day. With a little more clarity.</h2></div>
        {workspace}
        <PreviewDisclosure>Fictional figures for a workspace in development.</PreviewDisclosure>
      </section>
    </div>
  </div>;
}

