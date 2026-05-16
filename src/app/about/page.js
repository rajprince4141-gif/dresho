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
          font-size: 36px;
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
          letter-spacing: 2px;
          text-transform: uppercase;
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
          <Link href="/" className="about-back">← Back to Shop</Link>
        </header>

        {/* ── Hero ── */}
        <section className="about-hero">
          <div className="about-hero-eyebrow">
            <div className="about-hero-eyebrow-line" />
            <span>About Dresho</span>
            <div className="about-hero-eyebrow-line" />
          </div>
          <h1>Fast Local Shopping, <em>Delivered</em></h1>
          <p className="about-hero-sub">
            Dresho is a fast local shopping and delivery platform built to make fashion
            and lifestyle shopping quicker, easier, and smarter.
          </p>
        </section>

        {/* ── Content ── */}
        <div className="about-content">

          {/* What is Dresho */}
          <div className="about-section">
            <h2 className="about-section-title"><span className="icon">⚡</span> What is Dresho?</h2>
            <p>
              From accessories and jewellery to outfits, footwear, and trending essentials —
              Dresho connects customers with nearby stores and delivers products in minutes.
            </p>
            <p>
              Our mission is to empower local businesses by bringing them online while giving
              customers a seamless and fast shopping experience.
            </p>
            <p>Built with a vision to redefine local commerce, Dresho focuses on:</p>
            <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, color: "var(--sub, #5A6478)", fontSize: 14, lineHeight: 1.8 }}>
              <li>⚡ Fast delivery</li>
              <li>🏪 Local store empowerment</li>
              <li>💰 Affordable marketplace commissions</li>
              <li>🛍️ Smart and convenient shopping</li>
            </ul>
          </div>

          {/* Stats */}
          <div className="about-stats">
            <div className="about-stat">
              <div className="about-stat-num">30</div>
              <div className="about-stat-label">Min Delivery</div>
            </div>
            <div className="about-stat">
              <div className="about-stat-num">1</div>
              <div className="about-stat-label">City (Growing)</div>
            </div>
            <div className="about-stat">
              <div className="about-stat-num">100%</div>
              <div className="about-stat-label">Local Sellers</div>
            </div>
            <div className="about-stat">
              <div className="about-stat-num">COD</div>
              <div className="about-stat-label">+ UPI Accepted</div>
            </div>
          </div>

          {/* Founding Team */}
          <div className="about-section">
            <h2 className="about-section-title"><span className="icon">👥</span> Founding Team</h2>
            <div className="about-team">
              <div className="about-team-card">
                <div className="about-team-avatar">K</div>
                <div className="about-team-name">Krishna Prakash</div>
                <div className="about-team-role">Founder & CEO</div>
                <p style={{ fontSize: 13, color: "var(--sub, #5A6478)", marginTop: 12, lineHeight: 1.7 }}>
                  Leading the vision, growth, operations, and business strategy behind Dresho.
                </p>
              </div>
              <div className="about-team-card">
                <div className="about-team-avatar">P</div>
                <div className="about-team-name">Prince Kumar</div>
                <div className="about-team-role">Co-Founder & Head of Technology</div>
                <p style={{ fontSize: 13, color: "var(--sub, #5A6478)", marginTop: 12, lineHeight: 1.7 }}>
                  Leading the technology, platform development, and technical innovation powering Dresho.
                </p>
              </div>
            </div>
          </div>

          {/* Vision */}
          <div className="about-section">
            <h2 className="about-section-title"><span className="icon">🎯</span> Our Vision</h2>
            <p>
              To create a modern local commerce ecosystem where customers can discover and receive
              products instantly from trusted nearby stores.
            </p>
          </div>

          {/* How It Works */}
          <div className="about-section">
            <h2 className="about-section-title"><span className="icon">🛵</span> How It Works</h2>
            <div className="about-steps">
              <div className="about-step">
                <div className="about-step-num">01</div>
                <div className="about-step-title">Browse & Select</div>
                <div className="about-step-desc">
                  Explore products from local stores — fashion, accessories, footwear, and more.
                </div>
              </div>
              <div className="about-step">
                <div className="about-step-num">02</div>
                <div className="about-step-title">Place Your Order</div>
                <div className="about-step-desc">
                  Choose your size, add to cart, and checkout with Cash on Delivery or UPI.
                </div>
              </div>
              <div className="about-step">
                <div className="about-step-num">03</div>
                <div className="about-step-title">Instant Dispatch</div>
                <div className="about-step-desc">
                  The nearby seller packs your order immediately and a rider is assigned in seconds.
                </div>
              </div>
              <div className="about-step">
                <div className="about-step-num">04</div>
                <div className="about-step-title">Delivered Fast</div>
                <div className="about-step-desc">
                  Track your rider and receive your order at your doorstep in 30 minutes or less.
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="about-section">
            <h2 className="about-section-title"><span className="icon">📩</span> Contact Us</h2>
            <p>Have questions, feedback, or partnership inquiries? We&apos;d love to hear from you.</p>
            <p>
              <strong>Email:</strong>{" "}
              <a href="mailto:dresho.business@gmail.com" style={{ color: "var(--gold)" }}>dresho.business@gmail.com</a>
              <br />
              <strong>WhatsApp:</strong> +91 9128926837 (10 AM – 8 PM)
            </p>
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="about-cta">
          <h2>Dresho <em>⚡</em></h2>
          <p>Fast Local Shopping &amp; Delivery</p>
          <Link href="/" className="about-cta-btn">Start Shopping</Link>
        </div>

        {/* ── Footer ── */}
        <div className="about-footer">
          © 2026 DRESHO. Fast Local Shopping &amp; Delivery.
        </div>
      </div>
    </>
  );
}
