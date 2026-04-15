"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function LandingPage() {
  const [loaded, setLoaded] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [navSolid, setNavSolid] = useState(false);

  useEffect(() => {
    setLoaded(true);
    const onScroll = () => {
      setScrollY(window.scrollY);
      setNavSolid(window.scrollY > 60);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* ── Background ── */}
      <div className="luxury-bg">
        <div className="grain" />
      </div>

      <div className="page-content">

        {/* ── Navigation ── */}
        <nav style={{
          ...styles.nav,
          background: navSolid
            ? "rgba(13,13,26,0.96)"
            : "transparent",
          borderBottom: navSolid
            ? "1px solid rgba(201,168,76,0.1)"
            : "1px solid transparent",
          backdropFilter: navSolid ? "blur(24px)" : "none",
        }}>
          <div style={styles.navInner}>
            {/* Left Links */}
            <div style={styles.navLinks}>
              <Link href="/shop" style={styles.navLink}>Collection</Link>
              <Link href="/shop" style={styles.navLink}>Boutiques</Link>
            </div>

            {/* Center Logo */}
            <div style={styles.logo}>
              <div style={styles.logoMark}>D</div>
              <div>
                <span style={styles.logoText}>DRĀP</span>
                <div style={styles.logoTagline}>Maison de Mode</div>
              </div>
            </div>

            {/* Right Links */}
            <div style={styles.navLinks}>
              <Link href="/seller" style={styles.navLink}>Sell</Link>
              <Link href="/delivery" style={styles.navLink}>Deliver</Link>
              <Link href="/admin" style={styles.navLinkAdmin}>
                <i className="fas fa-crown" style={{ marginRight: 6, fontSize: 10 }} />
                Admin
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Ticker Bar ── */}
        <div style={styles.ticker}>
          <div className="marquee-wrapper">
            <div className="marquee-track">
              {[...Array(2)].map((_, r) => (
                <div key={r} style={styles.tickerTrackInner}>
                  {["Free delivery on orders above ₹999", "•", "30-minute express delivery", "•",
                    "500+ boutiques across India", "•", "New Arrivals Every Friday", "•",
                    "Easy 7-day returns", "•", "Exclusive member collections", "•"].map((t, i) => (
                    <span key={i} style={t === "•" ? styles.tickerDot : styles.tickerItem}>{t}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Hero Section ── */}
        <section style={styles.hero}>
          {/* Subtle vertical rule */}
          <div style={styles.heroRule} />

          <div style={styles.heroInner}>
            {/* Left block */}
            <div style={styles.heroLeft}>
              <p
                className={loaded ? "animate-fade-in-up stagger-1" : ""}
                style={styles.heroEyebrow}
              >
                <span style={styles.eyebrowLine} />
                New Season · Spring 2026
              </p>

              <h1
                className={loaded ? "animate-fade-in-up stagger-2" : ""}
                style={styles.heroTitle}
              >
                Fashion<br />
                <em style={{ fontStyle: "italic", fontWeight: 300 }}>Delivered to</em><br />
                <span className="gradient-text">Your Door</span>
              </h1>

              <p
                className={loaded ? "animate-fade-in-up stagger-3" : ""}
                style={styles.heroSubtitle}
              >
                Curated clothing from India's finest boutiques,
                delivered in 30 minutes. Elegance, redefined.
              </p>

              <div
                className={loaded ? "animate-fade-in-up stagger-4" : ""}
                style={styles.heroCTA}
              >
                <Link href="/shop" style={styles.ctaPrimary}>
                  <span>Explore Collection</span>
                  <i className="fas fa-arrow-right" style={{ marginLeft: 12, fontSize: 11 }} />
                </Link>
                <Link href="/seller" style={styles.ctaGhost}>
                  Open Your Store
                </Link>
              </div>

              {/* Stats row */}
              <div
                className={loaded ? "animate-fade-in-up stagger-5" : ""}
                style={styles.statsRow}
              >
                {[
                  { n: "30", u: "min", l: "Delivery" },
                  { n: "500+", u: "", l: "Boutiques" },
                  { n: "50K+", u: "", l: "Styles" },
                ].map((s, i) => (
                  <div key={i} style={styles.stat}>
                    <span style={styles.statNum}>{s.n}<sup style={styles.statUnit}>{s.u}</sup></span>
                    <span style={styles.statLabel}>{s.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Editorial Card Stack */}
            <div
              className={loaded ? "animate-fade-in-up stagger-3" : ""}
              style={styles.heroRight}
            >
              {/* Background card (depth) */}
              <div style={styles.cardBack} />

              {/* Main product card */}
              <div style={styles.mainCard}>
                <div style={styles.mainCardImageArea}>
                  <div style={styles.mainCardFabric}>
                    <i className="fas fa-tshirt" style={{ fontSize: 72, opacity: 0.18, color: "var(--gold-light)" }} />
                  </div>
                  {/* Corner tag */}
                  <div style={styles.expressTag}>
                    <i className="fas fa-bolt" style={{ fontSize: 9, marginRight: 5 }} />
                    30 MIN
                  </div>
                  {/* Season tag */}
                  <div style={styles.seasonTag}>SS 2026</div>
                </div>
                <div style={styles.mainCardBody}>
                  <p style={styles.mainCardBrand}>PREMIUM COLLECTION</p>
                  <h3 style={styles.mainCardName}>Aurora Silk Blazer</h3>
                  <div style={styles.mainCardFooter}>
                    <span style={styles.mainCardPrice}>₹ 2,499</span>
                    <div style={styles.sizeRow}>
                      {["S", "M", "L", "XL"].map(sz => (
                        <span key={sz} style={styles.sizeChip}>{sz}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating accent pills */}
              <div style={{ ...styles.floatPill, top: -18, right: 24, animationDelay: "0s" }} className="animate-float">
                <i className="fas fa-heart" style={{ color: "#E87090", fontSize: 13 }} />
                <span style={styles.pillText}>Wishlist</span>
              </div>
              <div style={{ ...styles.floatPill, bottom: 60, left: -20, animationDelay: "1.2s" }} className="animate-float">
                <i className="fas fa-truck-fast" style={{ color: "var(--gold-light)", fontSize: 13 }} />
                <span style={styles.pillText}>Express</span>
              </div>
              <div style={{ ...styles.floatPill, top: 100, left: -28, animationDelay: "2.4s" }} className="animate-float">
                <i className="fas fa-star" style={{ color: "var(--gold)", fontSize: 13 }} />
                <span style={styles.pillText}>4.9</span>
              </div>
            </div>
          </div>

          {/* Scroll cue */}
          <div style={styles.scrollCue}>
            <div style={styles.scrollLine} />
            <span style={styles.scrollText}>Scroll</span>
          </div>
        </section>

        {/* ── Marquee Brand Strip ── */}
        <section style={styles.brandStrip}>
          <div style={styles.brandStripLine} />
          <div className="marquee-wrapper" style={{ padding: "0 0" }}>
            <div className="marquee-track">
              {[...Array(2)].map((_, r) => (
                <div key={r} style={{ display: "flex", gap: 80, alignItems: "center" }}>
                  {["ELEGANCE", "STYLE", "DRĀP", "QUALITY", "CRAFT", "LUXURY", "MODE", "FASHION"].map((w, i) => (
                    <span key={i} style={i % 2 === 0 ? styles.brandWord : styles.brandDot}>
                      {i % 2 === 0 ? w : "✦"}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={styles.brandStripLine} />
        </section>

        {/* ── Features ── */}
        <section style={styles.featuresSection}>
          <div style={styles.sectionHeader}>
            <p className="section-label">Why DRĀP</p>
            <h2 style={styles.sectionTitle}>The Art of Effortless Shopping</h2>
            <div className="gold-divider gold-divider-left" />
          </div>

          <div style={styles.featuresGrid}>
            {[
              {
                icon: "fa-bolt",
                title: "Lightning Delivery",
                desc: "From boutique to your door in 30 minutes. No compromises, no waiting.",
                num: "01",
              },
              {
                icon: "fa-gem",
                title: "Curated Selection",
                desc: "Hand-picked styles from premium local stores, vetted for quality and taste.",
                num: "02",
              },
              {
                icon: "fa-rotate-left",
                title: "Hassle-Free Returns",
                desc: "Not the perfect fit? Easy 7-day returns with our doorstep pickup service.",
                num: "03",
              },
              {
                icon: "fa-location-dot",
                title: "Hyper-Local",
                desc: "Discover fashion gems from boutiques in your own neighbourhood.",
                num: "04",
              },
            ].map((f, i) => (
              <div
                key={i}
                className={`glass-card ${loaded ? `animate-fade-in-up stagger-${i + 2}` : ""}`}
                style={styles.featureCard}
              >
                <div style={styles.featureNum}>{f.num}</div>
                <div style={styles.featureIconWrap}>
                  <i className={`fas ${f.icon}`} style={{ fontSize: 20, color: "var(--text-gold)" }} />
                </div>
                <h3 style={styles.featureTitle}>{f.title}</h3>
                <p style={styles.featureDesc}>{f.desc}</p>
                <div style={styles.featureArrow}>→</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Categories ── */}
        <section style={styles.categoriesSection}>
          <div style={styles.sectionHeader}>
            <p className="section-label">Collections</p>
            <h2 style={styles.sectionTitle}>Shop by Category</h2>
            <div className="gold-divider gold-divider-left" />
          </div>

          <div style={styles.categoriesGrid}>
            {[
              { name: "Men's Wear",    icon: "fa-person",       sub: "400+ Styles" },
              { name: "Women's Wear",  icon: "fa-person-dress", sub: "600+ Styles" },
              { name: "Kids Wear",     icon: "fa-child",        sub: "200+ Styles" },
              { name: "Ethnic",        icon: "fa-star",         sub: "300+ Styles" },
              { name: "Casual",        icon: "fa-sun",          sub: "350+ Styles" },
              { name: "Formal",        icon: "fa-briefcase",    sub: "180+ Styles" },
            ].map((cat, i) => (
              <Link href="/shop" key={i} style={styles.catCard}>
                <div style={styles.catIconWrap}>
                  <i className={`fas ${cat.icon}`} style={{ fontSize: 26, color: "var(--text-gold)" }} />
                </div>
                <div style={styles.catLine} />
                <span style={styles.catName}>{cat.name}</span>
                <span style={styles.catSub}>{cat.sub}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section style={styles.ctaBannerSection}>
          <div style={styles.ctaBannerBox}>
            {/* Decorative corner */}
            <div style={styles.bannerCornerTL} />
            <div style={styles.bannerCornerBR} />

            <div style={styles.bannerContent}>
              <p className="section-label" style={{ textAlign: "center" }}>For Business</p>
              <h2 style={styles.bannerTitle}>Own a Clothing Boutique?</h2>
              <div className="gold-divider" />
              <p style={styles.bannerSub}>
                Partner with DRĀP and reach thousands of customers in your neighbourhood.
                Start selling online in minutes — no tech knowledge required.
              </p>
              <div style={styles.bannerActions}>
                <Link href="/seller" style={styles.bannerBtn}>
                  Become a Seller
                  <i className="fas fa-arrow-right" style={{ marginLeft: 10, fontSize: 11 }} />
                </Link>
                <Link href="/delivery" style={styles.bannerGhost}>
                  Join as Delivery Partner →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={styles.footer}>
          <div style={styles.footerTop}>
            {/* Brand */}
            <div style={styles.footerBrand}>
              <div style={styles.footerLogo}>
                <div style={styles.logoMark}>D</div>
                <div>
                  <div style={styles.logoText}>DRĀP</div>
                  <div style={styles.logoTagline}>Maison de Mode</div>
                </div>
              </div>
              <p style={styles.footerTagline}>
                Premium quick-commerce for fashion lovers.<br />
                Delivering style in 30 minutes across India.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                {["fa-instagram", "fa-twitter", "fa-pinterest"].map(icon => (
                  <div key={icon} style={styles.socialIcon}>
                    <i className={`fab ${icon}`} style={{ fontSize: 14 }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Links */}
            <div style={styles.footerLinks}>
              {[
                {
                  heading: "Platform",
                  links: [
                    { label: "Shop", href: "/shop" },
                    { label: "Sell with Us", href: "/seller" },
                    { label: "Deliver", href: "/delivery" },
                  ],
                },
                {
                  heading: "Company",
                  links: [
                    { label: "About DRĀP", href: "#" },
                    { label: "Careers", href: "#" },
                    { label: "Press", href: "#" },
                  ],
                },
                {
                  heading: "Support",
                  links: [
                    { label: "Help Centre", href: "#" },
                    { label: "Returns", href: "#" },
                    { label: "Contact Us", href: "#" },
                  ],
                },
              ].map((col) => (
                <div key={col.heading}>
                  <h4 style={styles.footerColHead}>{col.heading}</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {col.links.map((l) =>
                      l.href === "#" ? (
                        <span key={l.label} style={styles.footerLink}>{l.label}</span>
                      ) : (
                        <Link key={l.label} href={l.href} style={styles.footerLink}>{l.label}</Link>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div style={styles.footerBottom}>
            <span style={styles.footerCopy}>© 2026 DRĀP. All rights reserved.</span>
            <div style={{ display: "flex", gap: 24 }}>
              <span style={styles.footerLegal}>Privacy Policy</span>
              <span style={styles.footerLegal}>Terms of Service</span>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}

/* ─────────────────────────────────────────
   Inline Styles — Classic Luxury
───────────────────────────────────────── */
const styles = {

  /* Nav */
  nav: {
    position: "fixed",
    top: 0, left: 0, right: 0,
    zIndex: 100,
    padding: "22px 48px",
    transition: "background 0.45s ease, border-color 0.45s ease, backdrop-filter 0.45s ease",
  },
  navInner: {
    maxWidth: 1400,
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  navLink: {
    padding: "8px 16px",
    fontSize: 12,
    fontFamily: "'Jost', sans-serif",
    fontWeight: 500,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: "var(--text-secondary)",
    textDecoration: "none",
    transition: "color 0.3s",
  },
  navLinkAdmin: {
    padding: "8px 18px",
    fontSize: 11,
    fontFamily: "'Jost', sans-serif",
    fontWeight: 600,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: "var(--text-gold)",
    textDecoration: "none",
    border: "1px solid rgba(201,168,76,0.2)",
    borderRadius: 3,
    transition: "all 0.3s",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    textDecoration: "none",
  },
  logoMark: {
    width: 40, height: 40,
    borderRadius: "50%",
    border: "1px solid rgba(201,168,76,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 22,
    fontWeight: 600,
    color: "var(--gold)",
    flexShrink: 0,
  },
  logoText: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: "6px",
    color: "var(--text-primary)",
    lineHeight: 1,
  },
  logoTagline: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 9,
    fontWeight: 300,
    letterSpacing: "3px",
    color: "var(--text-gold)",
    textTransform: "uppercase",
    marginTop: 3,
  },

  /* Ticker */
  ticker: {
    position: "relative",
    zIndex: 10,
    paddingTop: "90px",
    borderBottom: "1px solid rgba(201,168,76,0.08)",
    background: "rgba(201,168,76,0.03)",
    padding: "90px 0 0 0",
    overflow: "hidden",
  },
  tickerTrackInner: {
    display: "flex",
    alignItems: "center",
    gap: 32,
    padding: "12px 40px",
  },
  tickerItem: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 11,
    fontWeight: 400,
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    whiteSpace: "nowrap",
  },
  tickerDot: {
    color: "var(--gold)",
    fontSize: 14,
    opacity: 0.5,
  },

  /* Hero */
  hero: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "60px 48px 80px",
    position: "relative",
    overflow: "hidden",
  },
  heroRule: {
    position: "absolute",
    left: "50%",
    top: "10%", bottom: "10%",
    width: 1,
    background: "linear-gradient(180deg, transparent, rgba(201,168,76,0.1), transparent)",
  },
  heroInner: {
    maxWidth: 1400,
    margin: "0 auto",
    width: "100%",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 100,
    alignItems: "center",
  },
  heroLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 28,
  },
  heroEyebrow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    fontFamily: "'Jost', sans-serif",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "3px",
    textTransform: "uppercase",
    color: "var(--text-gold)",
  },
  eyebrowLine: {
    display: "inline-block",
    width: 30,
    height: 1,
    background: "var(--gold)",
    flexShrink: 0,
  },
  heroTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 80,
    fontWeight: 400,
    lineHeight: 1.05,
    letterSpacing: "-1px",
    color: "var(--text-primary)",
  },
  heroSubtitle: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 16,
    fontWeight: 300,
    lineHeight: 1.8,
    color: "var(--text-secondary)",
    letterSpacing: "0.3px",
    maxWidth: 420,
  },
  heroCTA: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    marginTop: 4,
  },
  ctaPrimary: {
    display: "inline-flex",
    alignItems: "center",
    padding: "16px 36px",
    background: "linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)",
    color: "var(--obsidian)",
    fontSize: 11,
    fontFamily: "'Jost', sans-serif",
    fontWeight: 700,
    letterSpacing: "2.5px",
    textTransform: "uppercase",
    textDecoration: "none",
    borderRadius: 3,
    transition: "all 0.35s ease",
    boxShadow: "0 8px 28px rgba(201,168,76,0.25)",
  },
  ctaGhost: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 12,
    fontWeight: 400,
    letterSpacing: "1.5px",
    color: "var(--text-secondary)",
    textDecoration: "none",
    borderBottom: "1px solid rgba(255,255,255,0.15)",
    paddingBottom: 2,
    transition: "all 0.3s ease",
  },
  statsRow: {
    display: "flex",
    gap: 40,
    paddingTop: 28,
    borderTop: "1px solid rgba(201,168,76,0.1)",
    marginTop: 8,
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  statNum: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 38,
    fontWeight: 600,
    color: "var(--text-primary)",
    lineHeight: 1,
  },
  statUnit: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 12,
    fontWeight: 400,
    color: "var(--text-gold)",
    verticalAlign: "super",
  },
  statLabel: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  },

  /* Hero Card */
  heroRight: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
  },
  cardBack: {
    position: "absolute",
    top: 24, right: -16,
    width: 300,
    height: 400,
    borderRadius: 12,
    border: "1px solid rgba(201,168,76,0.12)",
    background: "rgba(255,255,255,0.015)",
    zIndex: 0,
  },
  mainCard: {
    width: 310,
    borderRadius: 10,
    overflow: "hidden",
    background: "rgba(22,16,8,0.9)",
    backdropFilter: "blur(40px)",
    border: "1px solid rgba(201,168,76,0.2)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(201,168,76,0.08)",
    position: "relative",
    zIndex: 1,
    animation: "float 7s ease-in-out infinite",
  },
  mainCardImageArea: {
    height: 300,
    background: "linear-gradient(160deg, #180E06 0%, #2A1A0A 60%, #1A1008 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    borderBottom: "1px solid rgba(201,168,76,0.1)",
  },
  mainCardFabric: {
    color: "var(--gold-light)",
    opacity: 0.25,
  },
  expressTag: {
    position: "absolute",
    top: 14, right: 14,
    padding: "5px 11px",
    background: "rgba(201,168,76,0.15)",
    border: "1px solid rgba(201,168,76,0.35)",
    borderRadius: 2,
    fontFamily: "'Jost', sans-serif",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "2px",
    color: "var(--gold-light)",
  },
  seasonTag: {
    position: "absolute",
    bottom: 14, left: 14,
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 12,
    fontStyle: "italic",
    color: "rgba(201,168,76,0.5)",
    letterSpacing: "1px",
  },
  mainCardBody: {
    padding: "20px 22px 22px",
  },
  mainCardBrand: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "3px",
    color: "var(--text-gold)",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  mainCardName: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 22,
    fontWeight: 500,
    color: "var(--text-primary)",
    marginBottom: 16,
  },
  mainCardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mainCardPrice: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 24,
    fontWeight: 600,
    color: "var(--gold-light)",
  },
  sizeRow: {
    display: "flex",
    gap: 5,
  },
  sizeChip: {
    width: 28, height: 28,
    borderRadius: 3,
    border: "1px solid rgba(201,168,76,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Jost', sans-serif",
    fontSize: 10,
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.5px",
  },
  floatPill: {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "8px 14px",
    background: "rgba(18,12,6,0.92)",
    border: "1px solid rgba(201,168,76,0.18)",
    borderRadius: 40,
    backdropFilter: "blur(20px)",
    boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
    zIndex: 2,
  },
  pillText: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 11,
    fontWeight: 500,
    color: "var(--text-secondary)",
    letterSpacing: "0.5px",
  },

  scrollCue: {
    position: "absolute",
    bottom: 32,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    zIndex: 2,
  },
  scrollLine: {
    width: 1,
    height: 40,
    background: "linear-gradient(180deg, rgba(201,168,76,0.5), transparent)",
    animation: "float 2s ease-in-out infinite",
  },
  scrollText: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 9,
    letterSpacing: "3px",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  },

  /* Brand strip */
  brandStrip: {
    padding: "0",
    overflow: "hidden",
    borderTop: "1px solid rgba(201,168,76,0.08)",
  },
  brandStripLine: {
    height: 1,
    background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.15), transparent)",
  },
  brandWord: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "8px",
    textTransform: "uppercase",
    color: "rgba(201,168,76,0.25)",
    whiteSpace: "nowrap",
  },
  brandDot: {
    color: "rgba(201,168,76,0.15)",
    fontSize: 10,
  },

  /* Features */
  featuresSection: {
    padding: "100px 48px",
    maxWidth: 1400,
    margin: "0 auto",
  },
  sectionHeader: {
    marginBottom: 56,
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 42,
    fontWeight: 400,
    color: "var(--text-primary)",
    letterSpacing: "-0.5px",
    marginTop: 10,
  },
  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 20,
  },
  featureCard: {
    padding: "36px 28px 28px",
    position: "relative",
    cursor: "default",
    overflow: "hidden",
  },
  featureNum: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 56,
    fontWeight: 600,
    color: "rgba(201,168,76,0.06)",
    position: "absolute",
    top: 16, right: 20,
    lineHeight: 1,
  },
  featureIconWrap: {
    width: 48, height: 48,
    borderRadius: 4,
    border: "1px solid rgba(201,168,76,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    background: "rgba(201,168,76,0.04)",
  },
  featureTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 20,
    fontWeight: 500,
    color: "var(--text-primary)",
    marginBottom: 10,
    letterSpacing: "0.2px",
  },
  featureDesc: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 13,
    fontWeight: 300,
    lineHeight: 1.7,
    color: "var(--text-secondary)",
    letterSpacing: "0.2px",
  },
  featureArrow: {
    marginTop: 20,
    fontFamily: "'Jost', sans-serif",
    fontSize: 16,
    color: "var(--text-gold)",
    opacity: 0.5,
    transition: "opacity 0.3s",
  },

  /* Categories */
  categoriesSection: {
    padding: "60px 48px 100px",
    maxWidth: 1400,
    margin: "0 auto",
  },
  categoriesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 16,
  },
  catCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "32px 12px 24px",
    borderRadius: 8,
    border: "1px solid rgba(201,168,76,0.1)",
    background: "rgba(255,255,255,0.02)",
    textDecoration: "none",
    transition: "all 0.35s ease",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
  },
  catIconWrap: {
    width: 64, height: 64,
    borderRadius: 4,
    border: "1px solid rgba(201,168,76,0.18)",
    background: "rgba(201,168,76,0.04)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.35s ease",
  },
  catLine: {
    width: 24, height: 1,
    background: "rgba(201,168,76,0.25)",
  },
  catName: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 15,
    fontWeight: 500,
    color: "var(--text-primary)",
    textAlign: "center",
  },
  catSub: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 10,
    fontWeight: 400,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    textAlign: "center",
  },

  /* CTA Banner */
  ctaBannerSection: {
    padding: "0 48px 100px",
    maxWidth: 1400,
    margin: "0 auto",
  },
  ctaBannerBox: {
    position: "relative",
    padding: "80px 60px",
    border: "1px solid rgba(201,168,76,0.18)",
    borderRadius: 10,
    background: "rgba(201,168,76,0.025)",
    textAlign: "center",
    overflow: "hidden",
  },
  bannerCornerTL: {
    position: "absolute",
    top: 16, left: 16,
    width: 50, height: 50,
    borderTop: "1px solid rgba(201,168,76,0.35)",
    borderLeft: "1px solid rgba(201,168,76,0.35)",
  },
  bannerCornerBR: {
    position: "absolute",
    bottom: 16, right: 16,
    width: 50, height: 50,
    borderBottom: "1px solid rgba(201,168,76,0.35)",
    borderRight: "1px solid rgba(201,168,76,0.35)",
  },
  bannerContent: {
    position: "relative",
    zIndex: 1,
  },
  bannerTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 52,
    fontWeight: 400,
    color: "var(--text-primary)",
    letterSpacing: "-0.5px",
    marginTop: 10,
  },
  bannerSub: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 15,
    fontWeight: 300,
    lineHeight: 1.7,
    color: "var(--text-secondary)",
    maxWidth: 480,
    margin: "20px auto 0",
    letterSpacing: "0.3px",
  },
  bannerActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    marginTop: 36,
  },
  bannerBtn: {
    display: "inline-flex",
    alignItems: "center",
    padding: "16px 36px",
    background: "linear-gradient(135deg, var(--gold), var(--gold-deep))",
    color: "var(--obsidian)",
    fontFamily: "'Jost', sans-serif",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "2.5px",
    textTransform: "uppercase",
    textDecoration: "none",
    borderRadius: 3,
    transition: "all 0.3s ease",
    boxShadow: "0 8px 28px rgba(201,168,76,0.22)",
  },
  bannerGhost: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 12,
    fontWeight: 400,
    letterSpacing: "1px",
    color: "var(--text-secondary)",
    textDecoration: "none",
    borderBottom: "1px solid rgba(255,255,255,0.15)",
    paddingBottom: 2,
    transition: "all 0.3s ease",
  },

  /* Footer */
  footer: {
    borderTop: "1px solid rgba(201,168,76,0.1)",
    padding: "64px 48px 32px",
  },
  footerTop: {
    maxWidth: 1400,
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    gap: 80,
    marginBottom: 48,
  },
  footerBrand: {
    flex: "0 0 280px",
  },
  footerLogo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  footerTagline: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 13,
    fontWeight: 300,
    lineHeight: 1.7,
    color: "var(--text-muted)",
    letterSpacing: "0.3px",
  },
  socialIcon: {
    width: 36, height: 36,
    borderRadius: 3,
    border: "1px solid rgba(201,168,76,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-muted)",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  footerLinks: {
    display: "flex",
    gap: 80,
  },
  footerColHead: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "3px",
    textTransform: "uppercase",
    color: "var(--text-gold)",
    marginBottom: 20,
  },
  footerLink: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 13,
    fontWeight: 300,
    color: "var(--text-muted)",
    textDecoration: "none",
    letterSpacing: "0.5px",
    display: "block",
    transition: "color 0.3s",
    cursor: "pointer",
  },
  footerBottom: {
    maxWidth: 1400,
    margin: "0 auto",
    paddingTop: 28,
    borderTop: "1px solid rgba(255,255,255,0.04)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerCopy: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 11,
    color: "var(--text-muted)",
    letterSpacing: "0.5px",
  },
  footerLegal: {
    fontFamily: "'Jost', sans-serif",
    fontSize: 11,
    color: "var(--text-muted)",
    letterSpacing: "0.5px",
    cursor: "pointer",
  },
};
