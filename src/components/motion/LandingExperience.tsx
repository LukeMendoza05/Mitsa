"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { gsap as Gsap } from "gsap";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";
import type Lenis from "lenis";
import { heroMode, type HeroMode } from "./hero-state";
import "lenis/dist/lenis.css";

type MotionEngine = { gsap: typeof Gsap; ScrollTrigger: typeof ScrollTriggerType; desktop: boolean; hero: HeroMode; lenis: Lenis | null };
type LandingContext = { engine: MotionEngine | null; workspaceTarget: { current: (() => number) | null } };
const MotionContext = createContext<LandingContext | null>(null);
export function useLandingMotion() { return useContext(MotionContext); }

export function LandingExperience({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const workspaceTarget = useRef<(() => number) | null>(null);
  const [engine, setEngine] = useState<MotionEngine | null>(null);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = matchMedia("(min-width: 1024px) and (min-height: 720px)");
    const tall = matchMedia("(min-height: 820px)");
    const finePointer = matchMedia("(pointer: fine)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    let dispose: (() => void) | undefined;
    let generation = 0;
    async function initialize() {
      const token = ++generation;
      dispose?.(); dispose = undefined; setEngine(null);
      if (reduced.matches || connection?.saveData) return;
      await document.fonts.ready;
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (token !== generation) return;
      gsap.registerPlugin(ScrollTrigger);
      const hero = heroMode(innerWidth, innerHeight, reduced.matches, !!connection?.saveData, finePointer.matches);
      const enhanced = hero !== "none";
      let lenis: Lenis | null = null;
      let tick: ((time: number) => void) | undefined;
      if (enhanced && matchMedia("(pointer: fine)").matches) {
        const { default: LenisClass } = await import("lenis");
        if (token !== generation) return;
        lenis = new LenisClass({ autoRaf: false, lerp: 0.12, wheelMultiplier: 1, smoothWheel: true, syncTouch: false, anchors: false, stopInertiaOnNavigate: true,
          prevent: node => !!node.closest("[data-native-scroll]"),
          virtualScroll: ({ event }) => !(event instanceof WheelEvent && (event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY))),
        });
        lenis.on("scroll", ScrollTrigger.update);
        tick = time => lenis?.raf(time * 1000);
        gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0);
      }
      const activeEngine = { gsap, ScrollTrigger, desktop: enhanced, hero, lenis };
      setEngine(activeEngine);
      function navigate(hash: string, immediate = false, focus = false) {
        const target = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (!target) return;
        // A click can precede ScrollTrigger's debounced resize refresh.
        ScrollTrigger.refresh();
        lenis?.resize();
        const position = hash === "#workspace" && workspaceTarget.current ? workspaceTarget.current() : scrollY + target.getBoundingClientRect().top - 100;
        if (lenis) lenis.scrollTo(position, { immediate, lock: false });
        else scrollTo({ top: position, behavior: immediate ? "instant" : "smooth" });
        if (focus) {
          if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
      }
      function click(event: MouseEvent) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
        if (!link || link.target || link.hasAttribute("download")) return;
        const url = new URL(link.href);
        if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash || !document.getElementById(decodeURIComponent(url.hash.slice(1)))) return;
        event.preventDefault();
        if (location.hash !== url.hash) history.pushState(null, "", url.hash);
        navigate(url.hash, false, event.detail === 0);
      }
      const pop = () => { if (location.hash) navigate(location.hash, true); };
      document.addEventListener("click", click); window.addEventListener("popstate", pop);
      const visibility = () => { if (document.hidden) lenis?.stop(); else lenis?.start(); };
      document.addEventListener("visibilitychange", visibility);
      const sync = requestAnimationFrame(() => { ScrollTrigger.refresh(); if (location.hash) navigate(location.hash, true); });
      dispose = () => {
        cancelAnimationFrame(sync);
        document.removeEventListener("click", click); window.removeEventListener("popstate", pop);
        document.removeEventListener("visibilitychange", visibility);
        if (tick) gsap.ticker.remove(tick);
        lenis?.off("scroll", ScrollTrigger.update); lenis?.destroy();
        gsap.ticker.lagSmoothing(500, 33);
      };
    }
    const update = () => { void initialize().catch(() => { dispose?.(); dispose = undefined; setEngine(null); }); };
    const media=[reduced,desktop,tall,finePointer];
    update(); media.forEach(query=>query.addEventListener("change",update)); connection?.addEventListener("change", update);
    return () => { generation++; dispose?.(); media.forEach(query=>query.removeEventListener("change",update)); connection?.removeEventListener("change", update); };
  }, []);

  useEffect(() => {
    if (!engine || !root.current) return;
    const { gsap } = engine;
    const context = gsap.context(() => {
      const headingRestores: Array<() => void> = [];
      root.current?.querySelectorAll<HTMLElement>("[data-motion-heading], main > section h2").forEach(heading => {
        const original = heading.innerHTML;
        const originalLabel = heading.getAttribute("aria-label");
        const label = heading.innerText.replace(/\s+/g, " ").trim();
        heading.setAttribute("aria-label", label);
        const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        while (walker.nextNode()) nodes.push(walker.currentNode as Text);
        for (const node of nodes) {
          const fragment = document.createDocumentFragment();
          for (const part of node.data.split(/(\s+)/)) {
            if (!part.trim()) { fragment.append(document.createTextNode(part)); continue; }
            const word = document.createElement("span"); word.dataset.motionWord = ""; word.setAttribute("aria-hidden", "true"); word.textContent = part; fragment.append(word);
          }
          node.replaceWith(fragment);
        }
        const inView = heading.getBoundingClientRect().top < innerHeight;
        gsap.from(heading.querySelectorAll("[data-motion-word]"), { yPercent: inView ? 20 : 100, opacity: inView ? 1 : 0, duration: 0.6, stagger: 0.035, ease: "power3.out", ...(inView ? {} : { scrollTrigger: { trigger: heading, start: "top 88%", once: true } }) });
        headingRestores.push(() => { heading.innerHTML = original; if (originalLabel === null) heading.removeAttribute("aria-label"); else heading.setAttribute("aria-label", originalLabel); });
      });
      root.current?.querySelectorAll<HTMLElement>("[data-reveal]").forEach(element => {
        const items = element.querySelectorAll<HTMLElement>("[data-reveal-item]");
        gsap.from(items.length ? items : element, { y: 24, opacity: 0, duration: 0.5, stagger: 0.07, ease: "power2.out", scrollTrigger: { trigger: element, start: "top 88%", once: true } });
      });
      root.current?.querySelectorAll<SVGPathElement>("[data-chart-line]").forEach(line => {
        if (engine.hero === "full" && line.closest("[data-workspace-composition]")) return;
        const length = line.getTotalLength();
        gsap.fromTo(line, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 0.7, ease: "power2.out", scrollTrigger: { trigger: line, start: "top 90%", once: true } });
      });
      if (engine.desktop) root.current?.querySelectorAll<HTMLElement>("[data-depth]").forEach(element => {
        gsap.fromTo(element, { y: 12 }, { y: -12, ease: "none", scrollTrigger: { trigger: element, start: "top bottom", end: "bottom top", scrub: true } });
      });
      const tilts: Array<() => void> = [];
      if (engine.desktop && matchMedia("(pointer: fine)").matches) root.current?.querySelectorAll<HTMLElement>("[data-tilt]").forEach(card => {
        const rotateX = gsap.quickTo(card, "rotationX", { duration: 0.22, ease: "power2.out" });
        const rotateY = gsap.quickTo(card, "rotationY", { duration: 0.22, ease: "power2.out" });
        gsap.set(card, { transformPerspective: 1000 });
        const move = (event: PointerEvent) => { const rect = card.getBoundingClientRect(); rotateX(-(event.clientY-rect.top-rect.height/2)/rect.height*4); rotateY((event.clientX-rect.left-rect.width/2)/rect.width*4); };
        const leave = () => { rotateX(0); rotateY(0); };
        card.addEventListener("pointermove", move); card.addEventListener("pointerleave", leave);
        tilts.push(() => { card.removeEventListener("pointermove", move); card.removeEventListener("pointerleave", leave); });
      });
      root.current?.querySelectorAll<SVGElement>("[data-packaging-diagram]").forEach(diagram => {
        gsap.from(diagram.querySelectorAll("g"), { y: -12, opacity: 0, duration: 0.4, stagger: 0.045, ease: "power2.out", scrollTrigger: { trigger: diagram, start: "top 88%", once: true } });
      });
      return () => { tilts.forEach(dispose => dispose()); headingRestores.forEach(restore => restore()); };
    }, root);
    return () => context.revert();
  }, [engine]);

  return <MotionContext.Provider value={{ engine, workspaceTarget }}><div ref={root} data-landing-motion={engine ? (engine.desktop ? "desktop" : "native") : "static"}>{children}</div></MotionContext.Provider>;
}



