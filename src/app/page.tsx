import { brand } from "@/lib/brand";
import { Header } from "@/components/site/Header";
import { Actions, Footer } from "@/components/site/Site";
import { Icon, PreviewDisclosure, ProductPreview, ShopsPreview, WorkspacePreview } from "@/components/site/ProductPreview";
import { landingDemo as demo, demoProduct } from "@/lib/landing-demo";
import ui from "@/components/site/site.module.css";
import s from "./landing.module.css";
import { LandingExperience } from "@/components/motion/LandingExperience";
import { HeroStory } from "@/components/motion/HeroStory";
import hero from "@/components/motion/hero.module.css";

const features = [
  { kind: "stock", label: "Inventory", title: "Know what’s on hand.", copy: "Available, reserved, and moving stock. Clear counts for each item and package." },
  { kind: "checkout", label: "Checkout", title: "Every sale, considered.", copy: "Products, payment, and a clear receipt. The details of a sale, together." },
  { kind: "orders", label: "Customer orders", title: "Keep every promise in view.", copy: "From reservation to handover, a clearer view of each customer order." },
] as const;
const access = [
  { icon: "shield", title: "Access with intention.", copy: "Sign in by invitation, with access limited to your assigned shops and role.", status: "Existing access foundation" },
  { icon: "history", title: "A history that holds.", copy: "Planned records and linked corrections will keep each transaction’s history clear.", status: "Planned workflow" },
  { icon: "balance", title: "Numbers that connect.", copy: "Planned checks will compare stock movements and sales with your balances, so differences are easier to review.", status: "Planned workflow" },
] as const;

export default function LandingPage() {
  return <LandingExperience>
    <a className={ui.skipLink} href="#main-content">Skip to content</a>
    <Header />
    <main id="main-content">
      <section className={`${s.hero} ${ui.container}`} aria-labelledby="hero-title">
        <div className={s.heroCopy}><p className={s.eyebrow}>A more considered way to work</p>
          <h1 id="hero-title" data-motion-heading>A <em>clearer view</em><br />{" "}of every shop.</h1>
          <p className={s.heroDescription}>Mitsa is a fireworks inventory and business management platform for a clearer view of stock, sales, and customer orders across your shops.</p>
          <Actions /><p className={s.invitation}>A workspace in development. Access by invitation.</p>
        </div>
      </section>
      <HeroStory stock={<ProductPreview kind="stock" />} sales={<ProductPreview kind="sales" />} orders={<ProductPreview kind="orders" />} workspace={<WorkspacePreview inventoryVisual={<div className={hero.inventoryDock} data-inventory-dock><img src="/mitsa/inventory-assembled-mobile.webp" width="900" height="619" alt="" loading="lazy" /></div>} />} />

      <section id="capabilities" className={s.section} aria-labelledby="capabilities-title"><div className={ui.container}>
        <div className={s.splitIntro}><div><p className={s.eyebrow}>Planned capabilities</p><h2 id="capabilities-title">Less to untangle.<br />More room to work.</h2></div><p>The everyday details of a fireworks business, thoughtfully brought together.</p></div>
        <div className={s.featureGrid} data-reveal>{features.map(feature => <article className={s.featureCard} key={feature.kind} data-reveal-item data-tilt>
          <p className={s.category}>{feature.label}</p><h3>{feature.title}</h3><p className={s.featureDescription}>{feature.copy}</p><figure><ProductPreview kind={feature.kind} /></figure>
        </article>)}</div>
        <PreviewDisclosure>Sample figures for the inventory, checkout, and order tools in development.</PreviewDisclosure>
      </div></section>

      <section className={`${s.section} ${s.fog}`} aria-labelledby="locations-title"><div className={`${ui.container} ${s.locations}`}>
        <div className={s.locationCopy}><p className={s.eyebrow}>Connected locations</p><h2 id="locations-title">Each shop, distinct.<br />Your business, together.</h2><p>Keep the details close and the bigger picture clear. Mitsa’s planned multi-shop workspace brings local stock and combined reporting into one perspective.</p><a className={ui.textLink} href="#access">Built on considered access <span aria-hidden="true">→</span></a></div>
        <figure data-depth><ShopsPreview /></figure>
      </div></section>

      <section className={s.section} aria-labelledby="packaging-title"><div className={ui.container}><div className={s.peach}>
        <div><p className={s.category}>The details make the difference</p><h2 id="packaging-title">A pack is more<br />than a number.</h2><p>An individual item, a pack, a carton, a bundle. Mitsa’s planned inventory tracking connects each through its defined contents.</p></div>
        <div className={s.packaging}><svg className={s.packDiagram} data-packaging-diagram viewBox="0 0 480 200" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
          <g transform="rotate(-7 105 100)"><rect x="16" y="25" width="180" height="150" rx="12" />{Array.from({ length: demo.packaging.packsPerCarton }, (_, i) => <g key={i} transform={`translate(${32 + (i % 2) * 80} ${42 + Math.floor(i / 2) * 42})`}><rect width="66" height="34" rx="4" />{Array.from({length:demo.packaging.itemsPerPack},(_,item)=><rect key={item} x={12+item*16} y="7" width="9" height="20" rx="2" />)}</g>)}</g>
          <path d="M215 100h38M360 100h38" opacity=".4" /><g transform="rotate(6 304 100)"><rect x="274" y="66" width="66" height="68" rx="6" />{Array.from({length:demo.packaging.itemsPerPack},(_,item)=><rect key={item} x={286+item*16} y="80" width="9" height="40" rx="2" />)}</g><rect x="430" y="70" width="14" height="60" rx="3" />
        </svg><div className={s.packLabels}><span>Carton</span><span>Pack</span><span>Individual item</span></div><p>Sample assortment: {demo.packaging.packsPerCarton} packs per carton · {demo.packaging.itemsPerPack} items per pack.</p><p>A sample bundle combines {demo.packaging.bundle.map(part=>`${part.quantity} ${part.quantity===1?demoProduct(part.productId).orderName.toLowerCase():demoProduct(part.productId).name.toLowerCase()}`).join(" + ")}. Contents vary by product.</p></div>
      </div></div></section>

      <section id="access" className={s.section} aria-labelledby="access-title"><div className={ui.container}>
        <div className={s.splitIntro}><div><p className={s.eyebrow}>Access & accountability</p><h2 id="access-title">Confidence starts<br />with a clear foundation.</h2></div><p>Careful access today. Traceable business workflows as Mitsa develops.</p></div>
        <div className={s.accessGrid} data-reveal>{access.map(item => <article key={item.icon} data-reveal-item><Icon kind={item.icon} /><h3>{item.title}</h3><p>{item.copy}</p><span>{item.status}</span></article>)}</div>
        <p className={s.accessNote}>Access is demonstrated in a test workspace. Business workflows are still in development.</p>
      </div></section>

      <section className={`${s.section} ${s.closing}`} aria-labelledby="closing-title"><div className={ui.container}><p className={s.eyebrow}>{brand.name}</p><h2 id="closing-title">Bring every location<br />into view.</h2><p>A clearer perspective on the business you’re building.</p><Actions /><p className={s.invitation}>For invited team members.</p></div></section>
    </main>
    <Footer />
  </LandingExperience>;
}
