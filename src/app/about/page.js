"use client";
import Link from "next/link";

export default function AboutPage() {
  return (
    <>
      <style>{`
        .about-page {
          min-height: 100vh;
          background: var(--ivory, #FAF7F2);
          color: var(--navy, #14213D);
          font-family: 'DM Sans', 'Poppins', sans-serif;
        }

        /* ── Top bar ── */
        .about-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 40px;
          border-bottom: 1px solid var(--border, #E5DDD1);
          background: var(--white, #FFFFFF);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .about-logo {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28px;
          font-weight: 500;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: var(--navy, #14213D);
          text-decoration: none;
        }
        .about-logo span { color: var(--gold, #B07D3A); }
        .about-back {
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--gold, #B07D3A);
          text-decoration: none;
          border-bottom: 1px solid rgba(176,125,58,0.3);
          padding-bottom: 2px;
          transition: all 0.3s;
        }
        .about-back:hover { color: var(--navy, #14213D); border-color: var(--navy, #14213D); }

        /* ── Hero ── */
        .about-hero {
          text-align: center;
          padding: 80px 40px 60px;
          position: relative;
          overflow: hidden;
        }
        .about-hero::before {
          content: '';
          position: absolute;
          top: -120px;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(176,125,58,0.06) 0%, transparent 70%);
          pointer-events: none;
        }
        .about-hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .about-hero-eyebrow-line {
          width: 24px;
          height: 2px;
          background: var(--gold, #B07D3A);
        }
        .about-hero-eyebrow span {
          font-size: 11px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: var(--gold, #B07D3A);
          font-weight: 500;
        }
        .about-hero h1 {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(36px, 5vw, 56px);
          font-weight: 300;
          line-height: 1.15;
          margin-bottom: 20px;
          color: var(--navy, #14213D);
        }
        .about-hero h1 em { font-style: italic; color: var(--gold, #B07D3A); }
        .about-hero-sub {
          font-size: 15px;
          color: var(--sub, #5A6478);
          line-height: 1.9;
          max-width: 560px;
          margin: 0 auto;
        }

        /* ── Content sections ── */
        .about-content {
          max-width: 900px;
          margin: 0 auto;
          padding: 0 40px 80px;
        }

        .about-section {
          margin-bottom: 56px;
        }
        .about-section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28px;
          font-weight: 400;
          color: var(--navy, #14213D);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .about-section-title .icon { font-size: 24px; }
        .about-section p {
          font-size: 14px;
          color: var(--sub, #5A6478);
          line-height: 1.9;
          margin-bottom: 12px;
        }

        /* ── How it works grid ── */
        .about-steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 24px;
        }
        .about-step {
          background: var(--white, #FFFFFF);
          border: 1px solid var(--border, #E5DDD1);
          padding: 28px 24px;
          position: relative;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .about-step:hover {
          border-color: var(--gold, #B07D3A);
          box-shadow: 0 8px 32px rgba(20,33,61,0.08);
        }
        .about-step-num {
          font-family: 'Cormorant Garamond', serif;
          font-size: 48px;
          font-weight: 300;
          color: rgba(176,125,58,0.12);
          line-height: 1;
          margin-bottom: 12px;
        }
        .about-step-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--navy, #14213D);
          margin-bottom: 8px;
        }
        .about-step-desc {
          font-size: 13px;
          color: var(--sub, #5A6478);
          line-height: 1.7;
        }

        /* ── Stats bar ── */
        .about-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: var(--border, #E5DDD1);
          margin: 48px 0;
        }
        .about-stat {
          background: var(--white, #FFFFFF);
          padding: 32px 20px;
          text-align: center;
        }
        .about-stat-num {
          font-family: 'Cormorant Garamond', serif;
          font-size: 36px;
          font-weight: 400;
          color: var(--gold, #B07D3A);
          margin-bottom: 4px;
        }
        .about-stat-label {
          font-size: 11px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--muted, #9CA3AF);
        }

        /* ── Team ── */
        .about-team {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 20px;
          margin-top: 24px;
        }
        .about-team-card {
          text-align: center;
          padding: 32px 16px;
          background: var(--white, #FFFFFF);
          border: 1px solid var(--border, #E5DDD1);
          transition: border-color 0.3s;
        }
        .about-team-card:hover { border-color: var(--gold, #B07D3A); }
        .about-team-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--ivory2, #F3EDE3);
          border: 2px solid var(--border, #E5DDD1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Cormorant Garamond', serif;
          font-size: 24px;
          color: var(--gold, #B07D3A);
          margin: 0 auto 14px;
        }
        .about-team-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--navy, #14213D);
          margin-bottom: 2px;
        }
        .about-team-role {
          font-size: 11px;
          letter-spacing: 1px;
          color: var(--muted, #9CA3AF);
          text-transform: uppercase;
        }

        /* ── CTA ── */
        .about-cta {
          background: var(--navy, #14213D);
          padding: 56px 40px;
          text-align: center;
          margin-top: 48px;
          position: relative;
          overflow: hidden;
        }
        .about-cta::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 60% 40%, rgba(176,125,58,0.08) 0%, transparent 60%);
        }
        .about-cta h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 32px;
          font-weight: 300;
          color: #FAF7F2;
          margin-bottom: 12px;
          position: relative;
        }
        .about-cta h2 em { color: var(--gold2, #C99A52); font-style: italic; }
        .about-cta p {
          font-size: 13px;
          color: rgba(234,224,210,0.55);
          margin-bottom: 28px;
          position: relative;
        }
        .about-cta-btn {
          display: inline-block;
          background: var(--gold, #B07D3A);
          color: #fff;
          border: none;
          padding: 14px 40px;
          font-size: 12px;
          letter-spacing: 2px;
          text-transform: uppercase;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.3s;
          position: relative;
        }
        .about-cta-btn:hover { background: var(--gold2, #C99A52); }

        /* ── Footer (mini) ── */
        .about-footer {
          text-align: center;
          padding: 28px 40px;
          border-top: 1px solid var(--border, #E5DDD1);
          font-size: 11px;
          color: var(--muted, #9CA3AF);
          background: var(--ivory2, #F3EDE3);
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .about-topbar { padding: 14px 20px; }
          .about-hero { padding: 48px 20px 36px; }
          .about-content { padding: 0 20px 48px; }
          .about-stats { grid-template-columns: repeat(2, 1fr); }
          .about-steps { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="about-page">
        {/* ── Top bar ── */}
        <header className="about-topbar">
          <Link href="/" className="about-logo">Dres<span>h</span>o</Link>
          <Link href="/" className="about-back">\u2190 Back to Shop</Link>
        </header>

        {/* ── Hero ── */}
        <section className="about-hero">
          <div className="about-hero-eyebrow">
            <div className="about-hero-eyebrow-line" />
            <span>Our Story</span>
            <div className="about-hero-eyebrow-line" />
          </div>
          <h1>Fashion, Delivered <em>Instantly</em></h1>
          <p className="about-hero-sub">
            Dresho is India\u2019s first luxury quick-commerce fashion platform. We bring premium clothing
            from curated boutiques and top brands straight to your doorstep — in 30 minutes or less.
          </p>
        </section>

        {/* ── Content ── */}
        <div className="about-content">

          {/* What is Dresho */}
          <div className="about-section">
            <h2 className="about-section-title"><span className="icon">\u2728</span> What is Dresho?</h2>
            <p>
              Dresho is a premium quick-commerce clothing platform designed to revolutionize the way
              India shops for fashion. Think of it as \u201CInstant Fashion Delivery\u201D \u2014 a curated marketplace
              where customers can browse handpicked collections from top designers, local boutiques,
              and trending brands, then receive their order at their doorstep in as little as 30 minutes.
            </p>
            <p>
              Unlike traditional e-commerce platforms that take days to deliver, Dresho leverages a
              hyper-local network of seller partners and delivery riders to ensure your outfit arrives
              in time \u2014 whether it\u2019s for a last-minute party, a spontaneous date night, or a festival
              celebration.
            </p>
          </div>

          {/* How It Works */}
          <div className="about-section">
            <h2 className="about-section-title"><span className="icon">\u26A1</span> How It Works</h2>
            <div className="about-steps">
              <div className="about-step">
                <div className="about-step-num">01</div>
                <div className="about-step-title">Browse & Select</div>
                <div className="about-step-desc">
                  Explore curated collections across ethnic wear, western wear, casual, and formal categories.
                  Filter by brand, size, and price.
                </div>
              </div>
              <div className="about-step">
                <div className="about-step-num">02</div>
                <div className="about-step-title">Place Your Order</div>
                <div className="about-step-desc">
                  Choose your size, add to cart, and checkout with Cash on Delivery or UPI payment via Razorpay.
                </div>
              </div>
              <div className="about-step">
                <div className="about-step-num">03</div>
                <div className="about-step-title">Instant Dispatch</div>
                <div className="about-step-desc">
                  Our nearby seller partner packs your order immediately. A delivery rider is assigned within seconds.
                </div>
              </div>
              <div className="about-step">
                <div className="about-step-num">04</div>
                <div className="about-step-title">30-Min Delivery</div>
                <div className="about-step-desc">
                  Track your rider in real-time. Verify with your delivery OTP and enjoy your new outfit!
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="about-stats">
            <div className="about-stat">
              <div className="about-stat-num">30</div>
              <div className="about-stat-label">Min Delivery</div>
            </div>
            <div className="about-stat">
              <div className="about-stat-num">500+</div>
              <div className="about-stat-label">Brands</div>
            </div>
            <div className="about-stat">
              <div className="about-stat-num">5</div>
              <div className="about-stat-label">Cities</div>
            </div>
            <div className="about-stat">
              <div className="about-stat-num">10K+</div>
              <div className="about-stat-label">Happy Customers</div>
            </div>
          </div>

          {/* Mission */}
          <div className="about-section">
            <h2 className="about-section-title"><span className="icon">\uD83C\uDFAF</span> Our Mission</h2>
            <p>
              We believe fashion should be accessible, instant, and delightful. Our mission is to
              eliminate the wait between \u201CI want this outfit\u201D and \u201CI\u2019m wearing it\u201D by building
              India\u2019s fastest fashion delivery infrastructure.
            </p>
            <p>
              We empower local sellers and boutique owners by providing them with a powerful digital
              storefront and access to a growing customer base \u2014 all while ensuring customers receive
              authentic, premium-quality fashion at fair prices.
            </p>
          </div>

          {/* For Sellers */}
          <div className="about-section">
            <h2 className="about-section-title"><span className="icon">\uD83D\uDCBC</span> For Sellers & Brand Partners</h2>
            <p>
              Dresho offers a dedicated Seller Dashboard where boutique owners and fashion brands can
              list products, manage inventory, track orders, and receive payments — all from one place.
              Sellers retain 85% of every sale, with Dresho taking a 15% platform fee that covers
              technology, logistics coordination, and customer support.
            </p>
            <p>
              Interested in selling on Dresho? Visit our{" "}
              <Link href="/seller" style={{ color: "var(--gold)", borderBottom: "1px solid var(--gold)" }}>Seller Portal</Link>{" "}
              to get started.
            </p>
          </div>

          {/* Technology */}
          <div className="about-section">
            <h2 className="about-section-title"><span className="icon">\uD83D\uDEE0\uFE0F</span> Built With</h2>
            <p>
              Dresho is built on modern, scalable technology to ensure a blazing-fast experience:
            </p>
            <p>
              <strong>Frontend:</strong> Next.js (React) with Turbopack for near-instant page loads.
              <br />
              <strong>Backend:</strong> Firebase (Authentication, Firestore, Cloud Functions) for real-time data sync.
              <br />
              <strong>Payments:</strong> Razorpay for secure UPI and card payments; Cash on Delivery also supported.
              <br />
              <strong>Hosting:</strong> Vercel for edge-deployed, globally fast delivery.
              <br />
              <strong>Delivery:</strong> GPS-powered rider assignment with OTP verification for secure handoff.
            </p>
          </div>

          {/* Contact */}
          <div className="about-section">
            <h2 className="about-section-title"><span className="icon">\uD83D\uDCE9</span> Contact Us</h2>
            <p>
              Have questions, feedback, or partnership inquiries? We\u2019d love to hear from you.
            </p>
            <p>
              <strong>Email:</strong>{" "}
              <a href="mailto:dresho.business@gmail.com" style={{ color: "var(--gold)" }}>dresho.business@gmail.com</a>
              <br />
              <strong>WhatsApp:</strong> +91 9128926837 (10 AM \u2013 8 PM)
              <br />
              <strong>Will be Registered as:</strong> DRESHO
            </p>
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="about-cta">
          <h2>Ready to Experience <em>Instant Fashion</em>?</h2>
          <p>Join thousands of customers already shopping with 30-minute delivery.</p>
          <Link href="/" className="about-cta-btn">Start Shopping</Link>
        </div>

        {/* ── Footer ── */}
        <div className="about-footer">
          \u00A9 2026 DRESHO.
        </div>
      </div>
    </>
  );
}
