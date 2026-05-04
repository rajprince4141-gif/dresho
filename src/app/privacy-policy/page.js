"use client";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <>
      <style>{`
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
        body{background:#FAF7F2;color:#14213D;font-family:'DM Sans',sans-serif;}
        :root{--navy:#14213D;--gold:#B07D3A;--gold2:#C99A52;--ivory:#FAF7F2;--border:#E5DDD1;--sub:#5A6478;}
        .pp-nav{background:#fff;border-bottom:1px solid var(--border);padding:16px 32px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:100;}
        .pp-logo{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:500;letter-spacing:4px;color:var(--navy);text-decoration:none;}
        .pp-logo span{color:var(--gold);}
        .pp-back{font-size:13px;color:var(--sub);text-decoration:none;padding:8px 14px;border:1px solid var(--border);transition:all .2s;}
        .pp-back:hover{border-color:var(--gold);color:var(--gold);}
        .pp-wrap{max-width:800px;margin:0 auto;padding:48px 24px 80px;}
        .pp-eyebrow{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;}
        .pp-title{font-family:'Cormorant Garamond',serif;font-size:clamp(32px,5vw,48px);font-weight:400;color:var(--navy);margin-bottom:8px;}
        .pp-updated{font-size:13px;color:var(--sub);margin-bottom:40px;}
        .pp-section{margin-bottom:32px;}
        .pp-h2{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:500;color:var(--navy);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border);}
        .pp-p{font-size:14px;line-height:1.8;color:var(--sub);margin-bottom:12px;}
        .pp-list{padding-left:20px;margin-bottom:12px;}
        .pp-list li{font-size:14px;line-height:1.8;color:var(--sub);margin-bottom:4px;}
      `}</style>

      <nav className="pp-nav">
        <Link href="/shop" className="pp-logo">DRES<span>H</span>O</Link>
        <Link href="/shop" className="pp-back">← Back to Shop</Link>
      </nav>

      <div className="pp-wrap">
        <div className="pp-eyebrow">Legal</div>
        <h1 className="pp-title">Privacy Policy</h1>
        <p className="pp-updated">Last updated: May 2026</p>

        <div className="pp-section">
          <h2 className="pp-h2">1. Information We Collect</h2>
          <p className="pp-p">When you use Dresho, we may collect the following types of information:</p>
          <ul className="pp-list">
            <li><strong>Personal Information:</strong> Name, email address, phone number, and delivery address provided during registration or checkout.</li>
            <li><strong>Order Information:</strong> Details of products purchased, payment method, and delivery preferences.</li>
            <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers for improving your experience.</li>
            <li><strong>Location Data:</strong> With your consent, we collect location data to enable delivery services.</li>
          </ul>
        </div>

        <div className="pp-section">
          <h2 className="pp-h2">2. How We Use Your Information</h2>
          <p className="pp-p">We use the collected information to:</p>
          <ul className="pp-list">
            <li>Process and deliver your orders</li>
            <li>Communicate with you about your orders and account</li>
            <li>Improve our platform and services</li>
            <li>Send promotional offers and updates (with your consent)</li>
            <li>Ensure the security and integrity of our platform</li>
          </ul>
        </div>

        <div className="pp-section">
          <h2 className="pp-h2">3. Information Sharing</h2>
          <p className="pp-p">We do not sell your personal information. We may share your data with:</p>
          <ul className="pp-list">
            <li><strong>Delivery Partners:</strong> To fulfill your orders</li>
            <li><strong>Payment Processors:</strong> To process transactions securely</li>
            <li><strong>Sellers:</strong> To prepare and dispatch your orders</li>
            <li><strong>Legal Authorities:</strong> When required by law</li>
          </ul>
        </div>

        <div className="pp-section">
          <h2 className="pp-h2">4. Data Security</h2>
          <p className="pp-p">We implement industry-standard security measures to protect your personal information. All payment transactions are processed through secure, encrypted channels. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.</p>
        </div>

        <div className="pp-section">
          <h2 className="pp-h2">5. Your Rights</h2>
          <p className="pp-p">You have the right to:</p>
          <ul className="pp-list">
            <li>Access and review your personal data</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your account and data</li>
            <li>Opt out of promotional communications</li>
          </ul>
        </div>

        <div className="pp-section">
          <h2 className="pp-h2">6. Contact Us</h2>
          <p className="pp-p">If you have any questions about this Privacy Policy, please contact us at:</p>
          <p className="pp-p"><strong>Email:</strong> <a href="mailto:prinxadmin29@gmail.com" style={{ color: "var(--gold)" }}>prinxadmin29@gmail.com</a></p>
        </div>
      </div>
    </>
  );
}
