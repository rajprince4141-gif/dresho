"use client";
import Link from "next/link";

export default function PartnerPage() {
  return (
    <>
      <style>{`
        .pp-page{font-family:'DM Sans','Segoe UI',sans-serif;background:#FAF7F2;color:#14213D;min-height:100vh;}
        .pp-nav{background:#fff;border-bottom:2px solid #EAE0D0;display:flex;align-items:center;justify-content:space-between;padding:0 40px;height:64px;position:sticky;top:0;z-index:100;box-shadow:0 2px 12px rgba(20,33,61,.06);}
        .pp-logo{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#14213D;text-decoration:none;}
        .pp-logo span{color:#B07D3A;}
        .pp-back{font-size:13px;font-weight:600;color:#5A6478;text-decoration:none;padding:8px 16px;border-radius:8px;transition:color .2s,background .2s;display:flex;align-items:center;gap:6px;}
        .pp-back:hover{color:#B07D3A;background:#fdf5ea;}

        .pp-hero{background:linear-gradient(135deg,#fff9f0 0%,#fdf3e3 100%);border-bottom:2px solid #EAE0D0;padding:64px 40px 56px;text-align:center;position:relative;overflow:hidden;}
        .pp-hero::before{content:'';position:absolute;top:-60px;right:-60px;width:240px;height:240px;background:radial-gradient(circle,rgba(176,125,58,.12) 0%,transparent 70%);border-radius:50%;}
        .pp-hero::after{content:'';position:absolute;bottom:-40px;left:-40px;width:180px;height:180px;background:radial-gradient(circle,rgba(176,125,58,.08) 0%,transparent 70%);border-radius:50%;}
        .pp-badge{background:#B07D3A;color:#fff;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:5px 14px;border-radius:14px;display:inline-block;margin-bottom:18px;}
        .pp-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(28px,4vw,46px);font-weight:700;color:#14213D;line-height:1.2;margin-bottom:12px;}
        .pp-title em{color:#B07D3A;font-style:normal;}
        .pp-sub{font-size:15px;color:#5A6478;max-width:500px;margin:0 auto;line-height:1.7;}

        .pp-cards{padding:56px 40px 80px;max-width:1200px;margin:0 auto;}
        .pp-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:48px;}
        .pp-card{background:#fff;border-radius:20px;border:2px solid #E8D8BE;overflow:hidden;box-shadow:0 4px 20px rgba(160,100,30,.07);transition:transform .2s,box-shadow .2s;}
        .pp-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(160,100,30,.13);}
        .pp-card-head{padding:32px 32px 24px;border-bottom:1.5px solid #F5ECE0;position:relative;}
        .pp-card-head.seller{background:linear-gradient(135deg,#fff8ef 0%,#fdf2e0 100%);}
        .pp-card-head.rider{background:linear-gradient(135deg,#f0f8ff 0%,#e8f4fd 100%);}
        .pp-icon-big{width:64px;height:64px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:30px;margin-bottom:16px;box-shadow:0 4px 14px rgba(0,0,0,.08);}
        .seller .pp-icon-big{background:#fff4e0;}
        .rider .pp-icon-big{background:#e8f4fd;}
        .pp-type{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;}
        .seller .pp-type{color:#B07D3A;}
        .rider .pp-type{color:#1a7abf;}
        .pp-name{font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;font-weight:700;color:#14213D;margin-bottom:8px;}
        .pp-tagline{font-size:14px;color:#5A6478;line-height:1.6;}
        .pp-earning{position:absolute;top:28px;right:28px;background:#fff;border:1.5px solid #E8D8BE;border-radius:12px;padding:10px 16px;text-align:center;}
        .pp-earn-num{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:700;color:#B07D3A;}
        .rider .pp-earn-num{color:#1a7abf;}
        .pp-earn-lbl{font-size:10.5px;color:#5A6478;font-weight:500;}

        .pp-card-body{padding:28px 32px 32px;}
        .pp-sec-label{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#5A6478;margin-bottom:14px;margin-top:24px;}
        .pp-sec-label:first-child{margin-top:0;}
        .pp-checklist{list-style:none;display:flex;flex-direction:column;gap:10px;padding:0;}
        .pp-checklist li{display:flex;align-items:flex-start;gap:10px;font-size:13.5px;color:#14213D;font-weight:500;line-height:1.5;}
        .pp-chk{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;margin-top:1px;}
        .seller .pp-chk{background:#fff3df;color:#B07D3A;}
        .rider .pp-chk{background:#e0f0ff;color:#1a7abf;}

        .pp-docs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px;}
        .pp-doc{display:flex;align-items:center;gap:7px;padding:8px 12px;background:#FAF7F2;border:1.5px solid #E8D8BE;border-radius:10px;font-size:12.5px;font-weight:500;color:#14213D;}
        .pp-doc span{font-size:14px;}

        .pp-policy{background:#fffbf5;border:1.5px solid #f0dfc0;border-radius:12px;padding:16px;font-size:13px;color:#5A6478;line-height:1.65;margin-top:4px;}
        .rider .pp-policy{background:#f3f9ff;border-color:#c8dff0;}

        .pp-cta{width:100%;margin-top:28px;padding:14px 24px;border-radius:50px;border:none;font-size:14.5px;font-weight:700;cursor:pointer;letter-spacing:.02em;transition:transform .18s,box-shadow .18s;display:flex;align-items:center;justify-content:center;gap:8px;}
        .seller .pp-cta{background:#B07D3A;color:#fff;box-shadow:0 6px 20px rgba(176,125,58,.28);}
        .seller .pp-cta:hover{background:#9a5808;transform:translateY(-1px);box-shadow:0 10px 28px rgba(154,88,8,.3);}
        .rider .pp-cta{background:#1a7abf;color:#fff;box-shadow:0 6px 20px rgba(26,122,191,.25);}
        .rider .pp-cta:hover{background:#155f96;transform:translateY(-1px);box-shadow:0 10px 28px rgba(26,122,191,.3);}

        .pp-compare{background:#fff;border:2px solid #E8D8BE;border-radius:16px;padding:28px 36px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;}
        .pp-compare-items{display:flex;gap:16px;flex-wrap:wrap;}
        .pp-chip{display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:12px;font-size:13px;font-weight:600;}
        .pp-chip.s{background:#fff4e0;color:#9a5808;border:1.5px solid #f0dfc0;}
        .pp-chip.r{background:#e8f4fd;color:#1a6ca8;border:1.5px solid #c0d8f0;}
        .pp-compare-text h3{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;color:#14213D;margin-bottom:4px;}
        .pp-compare-text p{font-size:13.5px;color:#5A6478;}
        .pp-contact{font-size:13.5px;font-weight:700;color:#B07D3A;text-decoration:none;border-bottom:2px solid rgba(176,125,58,.4);white-space:nowrap;}

        @keyframes ppFadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .pp-anim{animation:ppFadeUp .6s ease both;}
        .pp-anim-d1{animation-delay:.1s;}
        .pp-anim-d2{animation-delay:.2s;}

        @media(max-width:768px){
          .pp-nav{padding:0 20px;height:56px;}
          .pp-hero{padding:40px 20px 32px;}
          .pp-cards{padding:32px 16px 60px;}
          .pp-grid{grid-template-columns:1fr;gap:20px;}
          .pp-card-head{padding:24px 20px 20px;}
          .pp-card-body{padding:20px;}
          .pp-earning{position:static;margin-top:16px;display:inline-block;}
          .pp-name{font-size:22px;}
          .pp-docs{grid-template-columns:1fr;}
          .pp-compare{flex-direction:column;padding:20px;text-align:center;gap:16px;}
          .pp-compare-items{justify-content:center;}
        }
      `}</style>

      <div className="pp-page">
        {/* NAVBAR */}
        <nav className="pp-nav">
          <Link href="/shop" className="pp-logo">Dres<span>h</span>o</Link>
          <Link href="/shop" className="pp-back">← Back to Shop</Link>
        </nav>

        {/* HERO */}
        <div className="pp-hero">
          <div className="pp-badge pp-anim">Partner Program</div>
          <h1 className="pp-title pp-anim pp-anim-d1">Grow with <em>Dresho</em></h1>
          <p className="pp-sub pp-anim pp-anim-d2">
            Join thousands of sellers and riders already earning with India's fastest-growing quick commerce fashion platform.
          </p>
        </div>

        {/* CARDS */}
        <div className="pp-cards">
          <div className="pp-grid">

            {/* SELLER CARD */}
            <div className="pp-card seller pp-anim">
              <div className="pp-card-head seller">
                <div className="pp-icon-big">🏪</div>
                <div className="pp-type">For Businesses & Boutiques</div>
                <div className="pp-name">Become a Seller</div>
                <p className="pp-tagline">List your products and reach lakhs of customers in your city. Sell kurtas, sarees, streetwear, and more.</p>
                <div className="pp-earning">
                  <div className="pp-earn-num">₹80K+</div>
                  <div className="pp-earn-lbl">Avg monthly<br/>earnings</div>
                </div>
              </div>
              <div className="pp-card-body">
                <div className="pp-sec-label">✦ Why become a Seller?</div>
                <ul className="pp-checklist">
                  <li><span className="pp-chk">✓</span>Zero listing fees — list unlimited products for free</li>
                  <li><span className="pp-chk">✓</span>Get orders from customers within 5–10 km instantly</li>
                  <li><span className="pp-chk">✓</span>Weekly payouts directly to your bank account</li>
                  <li><span className="pp-chk">✓</span>Dedicated seller support in Hindi & English</li>
                  <li><span className="pp-chk">✓</span>Access to analytics dashboard & sales reports</li>
                  <li><span className="pp-chk">✓</span>Run your own discount campaigns & flash sales</li>
                </ul>

                <div className="pp-sec-label">📋 Documents Required</div>
                <div className="pp-docs">
                  <div className="pp-doc"><span>🪪</span>Aadhaar Card</div>
                  <div className="pp-doc"><span>🏦</span>Bank Details</div>
                  <div className="pp-doc"><span>📄</span>GST Number</div>
                  <div className="pp-doc"><span>🏪</span>Shop Photo</div>
                  <div className="pp-doc"><span>📱</span>PAN Card</div>
                  <div className="pp-doc"><span>📍</span>Address Proof</div>
                </div>

                <div className="pp-sec-label">📜 Seller Policy</div>
                <div className="pp-policy">
                  Dresho charges a <strong>8–12% commission</strong> per order depending on category. No hidden fees. Sellers must maintain a <strong>4.0+ rating</strong> and fulfil orders within <strong>15 minutes</strong> of acceptance. Accounts with repeated cancellations may be temporarily suspended. All disputes are resolved within 5 working days.
                </div>

                <Link href="/seller" style={{textDecoration:'none'}}><button className="pp-cta">Start Selling Today →</button></Link>
              </div>
            </div>

            {/* RIDER CARD */}
            <div className="pp-card rider pp-anim pp-anim-d1">
              <div className="pp-card-head rider">
                <div className="pp-icon-big">🛵</div>
                <div className="pp-type">For Delivery Partners</div>
                <div className="pp-name">Become a Rider</div>
                <p className="pp-tagline">Earn on your own time. Deliver fashion orders on your bike or scooter and get paid daily.</p>
                <div className="pp-earning">
                  <div className="pp-earn-num">₹35K+</div>
                  <div className="pp-earn-lbl">Avg monthly<br/>earnings</div>
                </div>
              </div>
              <div className="pp-card-body">
                <div className="pp-sec-label">✦ Why become a Rider?</div>
                <ul className="pp-checklist">
                  <li><span className="pp-chk">✓</span>Work anytime — morning, evening, or weekends</li>
                  <li><span className="pp-chk">✓</span>Daily earnings withdrawal via UPI / bank transfer</li>
                  <li><span className="pp-chk">✓</span>Earn extra incentives during peak hours & festivals</li>
                  <li><span className="pp-chk">✓</span>Free accident insurance coverage while on duty</li>
                  <li><span className="pp-chk">✓</span>Performance bonuses for top delivery partners</li>
                  <li><span className="pp-chk">✓</span>Fuel allowance during surge delivery zones</li>
                </ul>

                <div className="pp-sec-label">📋 Documents Required</div>
                <div className="pp-docs">
                  <div className="pp-doc"><span>🪪</span>Aadhaar Card</div>
                  <div className="pp-doc"><span>🪪</span>Driving Licence</div>
                  <div className="pp-doc"><span>🏍️</span>Vehicle RC Book</div>
                  <div className="pp-doc"><span>🏦</span>Bank / UPI Details</div>
                  <div className="pp-doc"><span>📱</span>PAN Card</div>
                  <div className="pp-doc"><span>📸</span>Passport Photo</div>
                </div>

                <div className="pp-sec-label">📜 Rider Policy</div>
                <div className="pp-policy">
                  Riders must be <strong>18+ years</strong> with a valid driving licence and two-wheeler. You are required to maintain a <strong>4.2+ delivery rating</strong>. Dresho provides <strong>accident insurance</strong> while on active duty. Repeated late deliveries or order rejections may affect incentive eligibility. All earnings are settled within <strong>24 hours</strong>.
                </div>

                <Link href="/delivery" style={{textDecoration:'none'}}><button className="pp-cta">Start Riding Today →</button></Link>
              </div>
            </div>
          </div>

          {/* COMPARE BANNER */}
          <div className="pp-compare pp-anim pp-anim-d2">
            <div className="pp-compare-items">
              <div className="pp-chip s">🏪 Seller — Earn up to ₹80K/mo</div>
              <div className="pp-chip r">🛵 Rider — Earn up to ₹35K/mo</div>
            </div>
            <div className="pp-compare-text">
              <h3>Not sure which fits you?</h3>
              <p>Our team will guide you in choosing the right path.</p>
            </div>
            <a className="pp-contact" href="mailto:prinxadmin29@gmail.com">Talk to us →</a>
          </div>
        </div>
      </div>
    </>
  );
}
