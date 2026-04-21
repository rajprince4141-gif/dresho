"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  const [loaded, setLoaded] = useState(false);
  const [navSolid, setNavSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setLoaded(true);
    const onScroll = () => setNavSolid(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="luxury-bg"><div className="grain" /></div>
      <div className="page-content lp-light">

        {/* ── NAV ── */}
        <nav style={{
          ...s.nav,
          background: navSolid ? "rgba(248,247,244,0.96)" : "transparent",
          borderBottom: navSolid ? "1px solid rgba(0,0,0,0.08)" : "1px solid transparent",
          backdropFilter: navSolid ? "blur(24px)" : "none",
        }}>
          <div style={s.navInner}>
            {/* Desktop left links */}
            <div className="lp-nav-links">
              <Link href="/shop" style={s.navLink}>Collection</Link>
              <Link href="/shop" style={s.navLink}>Boutiques</Link>
            </div>

            {/* Center logo */}
            <Link href="/" style={s.logoWrap}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <Image src="/logo.jpeg" alt="Dresho" width={110} height={36} style={{ objectFit:"contain", borderRadius:6 }} priority />
                <span style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:400, letterSpacing:"2px", color:"rgba(13,12,26,0.40)", fontStyle:"italic", whiteSpace:"nowrap" }}>
                  drāp &mdash; French for &ldquo;cloth&rdquo;
                </span>
              </div>
            </Link>

            {/* Desktop right links */}
            <div className="lp-nav-links">
              <Link href="/seller" style={s.navLink}>Sell</Link>
              <Link href="/delivery" style={s.navLink}>Deliver</Link>
              <Link href="/admin" style={s.navLinkAdmin}>
                <i className="fas fa-shield-halved" style={{ marginRight:6, fontSize:10 }} />Admin
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button style={s.hamburger} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
              <i className={`fas ${menuOpen ? "fa-xmark" : "fa-bars"}`} style={{ fontSize:20 }} />
            </button>
          </div>

          {/* Mobile dropdown */}
          {menuOpen && (
            <div style={s.mobileMenu}>
              {[
                { label:"Collection", href:"/shop" },
                { label:"Boutiques", href:"/shop" },
                { label:"Sell", href:"/seller" },
                { label:"Deliver", href:"/delivery" },
                { label:"Admin", href:"/admin" },
              ].map(item => (
                <Link key={item.label} href={item.href} style={s.mobileLink} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* ── TICKER ── */}
        <div style={s.ticker}>
          <div className="marquee-wrapper">
            <div className="marquee-track">
              {[...Array(2)].map((_, r) => (
                <div key={r} style={s.tickerInner}>
                  {["Free delivery above ₹999","⚡","30-min delivery","⚡","500+ boutiques","⚡","Easy 7-day returns","⚡","New Arrivals Weekly","⚡"].map((t, i) => (
                    <span key={i} style={t==="⚡" ? s.tickerDot : s.tickerItem}>{t}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── HERO ── */}
        <section style={s.hero}>
          <div className="lp-hero-inner">
            {/* Left */}
            <div style={s.heroLeft}>
              <p className={loaded ? "animate-fade-in-up stagger-1" : ""} style={s.eyebrow}>
                <span style={s.eyebrowLine}/> New Season · Spring 2026
              </p>
              <h1 className={`lp-hero-title ${loaded ? "animate-fade-in-up stagger-2" : ""}`}>
                Fashion<br/>
                <em style={{ fontStyle:"italic", fontWeight:300 }}>Delivered to</em><br/>
                <span className="gradient-text">Your Door</span>
              </h1>
              <p className={loaded ? "animate-fade-in-up stagger-3" : ""} style={s.heroSub}>
                Fashion, Delivered instantly. From India's finest boutiques to your doorstep in 30 minutes.
              </p>
              <div className={loaded ? "animate-fade-in-up stagger-4" : ""} style={s.heroCTA}>
                <Link href="/shop" style={s.ctaPrimary}>
                  <i className="fas fa-bolt" style={{ marginRight:8, fontSize:12 }}/>Explore Collection
                </Link>
                <Link href="/seller" style={s.ctaGhost}>Open Your Store →</Link>
              </div>
              <div className={`lp-stats-row ${loaded ? "animate-fade-in-up stagger-5" : ""}`}>
                {[{n:"30",u:"min",l:"Delivery"},{n:"500+",u:"",l:"Boutiques"},{n:"50K+",u:"",l:"Styles"}].map((st,i)=>(
                  <div key={i} style={s.stat}>
                    <span style={s.statNum}>{st.n}<sup style={s.statUnit}>{st.u}</sup></span>
                    <span style={s.statLabel}>{st.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right card (hidden on mobile via CSS) */}
            <div className={`lp-hero-right ${loaded ? "animate-fade-in-up stagger-3" : ""}`}>
              <div style={s.cardBack}/>
              <div style={s.mainCard}>
                <div style={s.cardImage}>
                  <i className="fas fa-tshirt" style={{ fontSize:72, opacity:0.12, color:"#6B7FFF" }}/>
                  <div style={s.expressTag}><i className="fas fa-bolt" style={{ fontSize:9, marginRight:4 }}/>30 MIN</div>
                  <div style={s.seasonTag}>SS 2026</div>
                </div>
                <div style={s.cardBody}>
                  <p style={s.cardBrand}>PREMIUM COLLECTION</p>
                  <h3 style={s.cardName}>Aurora Silk Blazer</h3>
                  <div style={s.cardFooter}>
                    <span style={s.cardPrice}>₹ 2,499</span>
                    <div style={{ display:"flex", gap:5 }}>
                      {["S","M","L","XL"].map(sz=>(
                        <span key={sz} style={s.sizeChip}>{sz}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ ...s.pill, top:-18, right:24 }} className="animate-float">
                <i className="fas fa-heart" style={{ color:"#FB7185", fontSize:13 }}/><span style={s.pillText}>Wishlist</span>
              </div>
              <div style={{ ...s.pill, bottom:60, left:-20, animationDelay:"1.2s" }} className="animate-float">
                <i className="fas fa-bolt" style={{ color:"#6B7FFF", fontSize:13 }}/><span style={s.pillText}>Express</span>
              </div>
              <div style={{ ...s.pill, top:100, left:-28, animationDelay:"2.4s" }} className="animate-float">
                <i className="fas fa-star" style={{ color:"#FCD34D", fontSize:13 }}/><span style={s.pillText}>4.9</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── BRAND STRIP ── */}
        <section style={s.brandStrip}>
          <div style={s.stripLine}/>
          <div className="marquee-wrapper" style={{ padding:"14px 0" }}>
            <div className="marquee-track">
              {[...Array(2)].map((_,r)=>(
                <div key={r} style={{ display:"flex", gap:64, alignItems:"center" }}>
                  {["SPEED","STYLE","DRESHO","QUALITY","FASHION","INDIA","EXPRESS","BOUTIQUE"].map((w,i)=>(
                    <span key={i} style={i%2===0 ? s.brandWord : s.brandStar}>{i%2===0 ? w : "⚡"}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={s.stripLine}/>
        </section>

        {/* ── FEATURES ── */}
        <section className="lp-section">
          <div style={s.sectionHeader}>
            <p className="section-label">Why Dresho</p>
            <h2 style={s.sectionTitle}>The Art of Effortless Shopping</h2>
            <div className="gold-divider gold-divider-left"/>
          </div>
          <div className="lp-feat-grid">
            {[
              { icon:"fa-bolt",        title:"Lightning Delivery",  desc:"From boutique to your door in 30 minutes. No compromises.", num:"01" },
              { icon:"fa-gem",         title:"Curated Selection",   desc:"Hand-picked styles from premium local stores, vetted for quality.", num:"02" },
              { icon:"fa-rotate-left", title:"Easy Returns",        desc:"7-day hassle-free returns with doorstep pickup.", num:"03" },
              { icon:"fa-location-dot",title:"Hyper-Local",         desc:"Discover fashion gems from boutiques in your neighbourhood.", num:"04" },
            ].map((f,i)=>(
              <div key={i} className={`glass-card ${loaded ? `animate-fade-in-up stagger-${i+2}` : ""}`} style={s.featCard}>
                <div style={s.featNum}>{f.num}</div>
                <div style={s.featIcon}><i className={`fas ${f.icon}`} style={{ fontSize:20, color:"var(--aurora-8)" }}/></div>
                <h3 style={s.featTitle}>{f.title}</h3>
                <p style={s.featDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CATEGORIES ── */}
        <section className="lp-section" style={{ paddingTop:0 }}>
          <div style={s.sectionHeader}>
            <p className="section-label">Collections</p>
            <h2 style={s.sectionTitle}>Shop by Category</h2>
            <div className="gold-divider gold-divider-left"/>
          </div>
          <div className="lp-cat-grid">
            {[
              { name:"Men's Wear",   icon:"fa-person",       sub:"400+ Styles" },
              { name:"Women's Wear", icon:"fa-person-dress",  sub:"600+ Styles" },
              { name:"Kids Wear",    icon:"fa-child",         sub:"200+ Styles" },
              { name:"Ethnic",       icon:"fa-star",          sub:"300+ Styles" },
              { name:"Casual",       icon:"fa-sun",           sub:"350+ Styles" },
              { name:"Formal",       icon:"fa-briefcase",     sub:"180+ Styles" },
            ].map((cat,i)=>(
              <Link href="/shop" key={i} style={s.catCard}>
                <div style={s.catIcon}><i className={`fas ${cat.icon}`} style={{ fontSize:22, color:"var(--aurora-8)" }}/></div>
                <div style={s.catLine}/>
                <span style={s.catName}>{cat.name}</span>
                <span style={s.catSub}>{cat.sub}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── CTA BANNER ── */}
        <section className="lp-section" style={{ paddingTop:0 }}>
          <div style={s.bannerBox}>
            <div style={s.bannerCornerTL}/><div style={s.bannerCornerBR}/>
            <div style={{ position:"relative", zIndex:1 }}>
              <p className="section-label" style={{ textAlign:"center" }}>For Business</p>
              <h2 className="lp-banner-title">Own a Clothing Boutique?</h2>
              <div className="gold-divider"/>
              <p style={s.bannerSub}>Partner with Dresho and reach thousands of customers. Start selling online in minutes — no tech knowledge required.</p>
              <div style={s.bannerActions}>
                <Link href="/seller" style={s.bannerBtn}>
                  Become a Seller <i className="fas fa-arrow-right" style={{ marginLeft:10, fontSize:11 }}/>
                </Link>
                <Link href="/delivery" style={s.bannerGhost}>Join as Delivery Partner →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={s.footer}>
          <div className="lp-footer-top">
            <div style={s.footerBrand}>
              <div style={{ marginBottom:14 }}>
                <Image src="/logo.jpeg" alt="Dresho" width={100} height={33} style={{ objectFit:"contain", borderRadius:6 }}/>
              </div>
              <p style={s.footerTagline}>Fashion, Delivered instantly.<br/>From local boutiques to your door in 30 min.</p>
              <div style={{ display:"flex", gap:10, marginTop:16 }}>
                {["fa-instagram","fa-twitter","fa-pinterest"].map(ic=>(
                  <div key={ic} style={s.socialIcon}><i className={`fab ${ic}`} style={{ fontSize:14 }}/></div>
                ))}
              </div>
            </div>
            <div className="lp-footer-links">
              {[
                { heading:"Platform", links:[{label:"Shop",href:"/shop"},{label:"Sell with Us",href:"/seller"},{label:"Deliver",href:"/delivery"}]},
                { heading:"Company",  links:[{label:"About Dresho",href:"#"},{label:"Careers",href:"#"},{label:"Press",href:"#"}]},
                { heading:"Support",  links:[{label:"Help Centre",href:"#"},{label:"Returns",href:"#"},{label:"Contact Us",href:"#"}]},
              ].map((col)=>(
                <div key={col.heading}>
                  <h4 style={s.footerHead}>{col.heading}</h4>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {col.links.map(l=> l.href==="#"
                      ? <span key={l.label} style={s.footerLink}>{l.label}</span>
                      : <Link key={l.label} href={l.href} style={s.footerLink}>{l.label}</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={s.footerBottom}>
            <span style={s.footerCopy}>© 2026 Dresho. All rights reserved.</span>
            <div style={{ display:"flex", gap:20 }}>
              <span style={s.footerCopy}>Privacy Policy</span>
              <span style={s.footerCopy}>Terms of Service</span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}

const s = {
  nav: { position:"fixed", top:0, left:0, right:0, zIndex:100, padding:"16px 32px", transition:"background 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease" },
  navInner: { maxWidth:1400, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", position:"relative" },
  navLink: { padding:"8px 12px", fontSize:12, fontFamily:"'Inter',sans-serif", fontWeight:500, letterSpacing:"0.5px", color:"var(--white-65)", textDecoration:"none" },
  navLinkAdmin: { padding:"7px 14px", fontSize:11, fontFamily:"'Inter',sans-serif", fontWeight:600, color:"var(--text-blue-lt)", textDecoration:"none", border:"1px solid rgba(107,127,255,0.25)", borderRadius:6 },
  logoWrap: { textDecoration:"none", position:"absolute", left:"50%", transform:"translateX(-50%)" },
  hamburger: { display:"none", background:"none", border:"none", color:"var(--white)", cursor:"pointer", padding:8, "@media(maxWidth:768px)": { display:"block" } },
  mobileMenu: { background:"rgba(248,247,244,0.99)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(0,0,0,0.08)", display:"flex", flexDirection:"column", padding:"8px 16px 16px" },
  mobileLink: { padding:"14px 12px", fontSize:15, fontWeight:600, color:"rgba(13,12,26,0.85)", textDecoration:"none", borderBottom:"1px solid rgba(0,0,0,0.07)", fontFamily:"'Inter',sans-serif" },

  ticker: { position:"relative", zIndex:10, paddingTop:"72px", borderBottom:"1px solid var(--border-subtle)", background:"rgba(26,13,220,0.03)", overflow:"hidden" },
  tickerInner: { display:"flex", alignItems:"center", gap:28, padding:"10px 40px" },
  tickerItem: { fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:400, letterSpacing:"1.5px", textTransform:"uppercase", color:"var(--text-muted)", whiteSpace:"nowrap" },
  tickerDot: { color:"var(--blue-glow)", fontSize:12, opacity:0.6 },

  hero: { minHeight:"100vh", display:"flex", flexDirection:"column", justifyContent:"center", padding:"60px 48px 80px", position:"relative", overflow:"hidden" },
  heroLeft: { display:"flex", flexDirection:"column", gap:24 },
  eyebrow: { display:"flex", alignItems:"center", gap:12, fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, letterSpacing:"2px", textTransform:"uppercase", color:"var(--text-blue-lt)" },
  eyebrowLine: { display:"inline-block", width:24, height:2, background:"var(--blue-glow)", flexShrink:0, borderRadius:2 },
  heroSub: { fontFamily:"'Inter',sans-serif", fontSize:15, fontWeight:400, lineHeight:1.8, color:"var(--white-65)", maxWidth:400 },
  heroCTA: { display:"flex", alignItems:"center", gap:16, marginTop:4, flexWrap:"wrap" },
  ctaPrimary: { display:"inline-flex", alignItems:"center", padding:"14px 28px", background:"linear-gradient(135deg, var(--blue-electric), var(--blue-vivid))", color:"#fff", fontSize:13, fontFamily:"'Inter',sans-serif", fontWeight:700, textDecoration:"none", borderRadius:8, boxShadow:"0 8px 28px rgba(26,13,220,0.35)" },
  ctaGhost: { fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:500, color:"var(--white-65)", textDecoration:"none", borderBottom:"1px solid rgba(255,255,255,0.2)", paddingBottom:2 },

  stat: { display:"flex", flexDirection:"column", gap:4 },
  statNum: { fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:34, fontWeight:800, color:"var(--white)", lineHeight:1 },
  statUnit: { fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:500, color:"var(--text-blue-lt)", verticalAlign:"super" },
  statLabel: { fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:600, letterSpacing:"1.5px", textTransform:"uppercase", color:"var(--text-muted)" },

  cardBack: { position:"absolute", top:24, right:-16, width:300, height:400, borderRadius:16, border:"1px solid var(--border-subtle)", background:"rgba(255,255,255,0.015)", zIndex:0 },
  mainCard: { width:300, borderRadius:14, overflow:"hidden", background:"rgba(12,10,26,0.92)", backdropFilter:"blur(40px)", border:"1px solid rgba(107,127,255,0.2)", boxShadow:"0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(26,13,220,0.12)", position:"relative", zIndex:1, animation:"float 6s ease-in-out infinite" },
  cardImage: { height:280, background:"linear-gradient(160deg, #0C0820 0%, #160E3A 60%, #0A0618 100%)", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden", borderBottom:"1px solid rgba(107,127,255,0.1)" },
  expressTag: { position:"absolute", top:14, right:14, padding:"5px 10px", background:"rgba(26,13,220,0.2)", border:"1px solid rgba(107,127,255,0.4)", borderRadius:4, fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:800, letterSpacing:"2px", color:"var(--text-blue-lt)" },
  seasonTag: { position:"absolute", bottom:14, left:14, fontFamily:"'Inter',sans-serif", fontSize:12, fontStyle:"italic", color:"rgba(107,127,255,0.5)" },
  cardBody: { padding:"18px 20px 20px" },
  cardBrand: { fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:800, letterSpacing:"2.5px", color:"var(--text-blue-lt)", marginBottom:6, textTransform:"uppercase" },
  cardName: { fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:19, fontWeight:700, color:"var(--white)", marginBottom:14 },
  cardFooter: { display:"flex", justifyContent:"space-between", alignItems:"center" },
  cardPrice: { fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:20, fontWeight:800, color:"#6B7FFF" },
  sizeChip: { width:26, height:26, borderRadius:4, border:"1px solid rgba(107,127,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:600, color:"var(--text-muted)" },
  pill: { position:"absolute", display:"flex", alignItems:"center", gap:7, padding:"7px 12px", background:"rgba(10,8,28,0.94)", border:"1px solid var(--border-medium)", borderRadius:40, backdropFilter:"blur(20px)", boxShadow:"0 8px 30px rgba(0,0,0,0.3)", zIndex:2 },
  pillText: { fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, color:"var(--white-65)" },

  brandStrip: { overflow:"hidden", borderTop:"1px solid var(--border-subtle)" },
  stripLine: { height:1, background:"linear-gradient(90deg, transparent, rgba(107,127,255,0.2), transparent)" },
  brandWord: { fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:11, fontWeight:800, letterSpacing:"5px", textTransform:"uppercase", color:"rgba(26,13,220,0.18)", whiteSpace:"nowrap" },
  brandStar: { color:"rgba(26,13,220,0.22)", fontSize:14 },

  sectionHeader: { marginBottom:40 },
  sectionTitle: { fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:36, fontWeight:800, color:"var(--white)", marginTop:10, letterSpacing:"-0.5px" },

  featCard: { padding:"28px 20px 22px", position:"relative", cursor:"default", overflow:"hidden" },
  featNum: { fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:48, fontWeight:900, color:"rgba(26,13,220,0.08)", position:"absolute", top:14, right:16, lineHeight:1 },
  featIcon: { width:44, height:44, borderRadius:8, border:"1px solid rgba(107,127,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16, background:"rgba(26,13,220,0.06)" },
  featTitle: { fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:16, fontWeight:700, color:"var(--white)", marginBottom:8 },
  featDesc: { fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:400, lineHeight:1.7, color:"var(--white-65)" },

  catCard: { display:"flex", flexDirection:"column", alignItems:"center", gap:10, padding:"22px 8px 18px", borderRadius:12, border:"1px solid rgba(0,0,0,0.08)", background:"rgba(255,255,255,0.75)", textDecoration:"none", transition:"all 0.3s ease", boxShadow:"0 2px 12px rgba(0,0,0,0.05)" },
  catIcon: { width:52, height:52, borderRadius:8, border:"1px solid rgba(107,127,255,0.18)", background:"rgba(26,13,220,0.06)", display:"flex", alignItems:"center", justifyContent:"center" },
  catLine: { width:20, height:2, background:"rgba(107,127,255,0.3)", borderRadius:2 },
  catName: { fontFamily:"'Plus Jakarta Sans',sans-serif", fontSize:13, fontWeight:700, color:"var(--white)", textAlign:"center" },
  catSub: { fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:500, letterSpacing:"1px", textTransform:"uppercase", color:"var(--text-muted)", textAlign:"center" },

  bannerBox: { position:"relative", padding:"60px 40px", border:"1px solid rgba(107,127,255,0.2)", borderRadius:16, background:"rgba(26,13,220,0.04)", textAlign:"center", overflow:"hidden" },
  bannerCornerTL: { position:"absolute", top:14, left:14, width:40, height:40, borderTop:"1px solid rgba(107,127,255,0.4)", borderLeft:"1px solid rgba(107,127,255,0.4)" },
  bannerCornerBR: { position:"absolute", bottom:14, right:14, width:40, height:40, borderBottom:"1px solid rgba(107,127,255,0.4)", borderRight:"1px solid rgba(107,127,255,0.4)" },
  bannerSub: { fontFamily:"'Inter',sans-serif", fontSize:14, fontWeight:400, lineHeight:1.7, color:"var(--white-65)", maxWidth:440, margin:"16px auto 0" },
  bannerActions: { display:"flex", alignItems:"center", justifyContent:"center", gap:24, marginTop:28, flexWrap:"wrap" },
  bannerBtn: { display:"inline-flex", alignItems:"center", padding:"14px 28px", background:"linear-gradient(135deg, var(--blue-electric), var(--blue-vivid))", color:"#fff", fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:700, textDecoration:"none", borderRadius:8, boxShadow:"0 8px 28px rgba(26,13,220,0.35)" },
  bannerGhost: { fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:500, color:"var(--white-65)", textDecoration:"none", borderBottom:"1px solid rgba(255,255,255,0.18)", paddingBottom:2 },

  footer: { borderTop:"1px solid var(--border-subtle)", padding:"56px 48px 28px" },
  footerBrand: { flex:"0 0 240px" },
  footerTagline: { fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:400, lineHeight:1.7, color:"var(--text-muted)" },
  socialIcon: { width:34, height:34, borderRadius:6, border:"1px solid var(--border-subtle)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-muted)", cursor:"pointer" },
  footerHead: { fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:800, letterSpacing:"2px", textTransform:"uppercase", color:"var(--text-blue-lt)", marginBottom:18 },
  footerLink: { fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:400, color:"var(--text-muted)", textDecoration:"none", display:"block", cursor:"pointer" },
  footerBottom: { maxWidth:1400, margin:"0 auto", paddingTop:24, borderTop:"1px solid var(--border-subtle)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 },
  footerCopy: { fontFamily:"'Inter',sans-serif", fontSize:11, color:"var(--text-muted)" },
};
