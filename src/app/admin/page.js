"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { auth, db, IMGBB_API_KEY } from "@/lib/firebase";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, collection, onSnapshot, updateDoc, deleteDoc,
} from "firebase/firestore";
import dynamicImport from "next/dynamic";

const LiveMap = dynamicImport(() => import("@/components/LiveMap"), { ssr: false });

// ── Revenue Formula Helpers ──────────────────────────────────────────────
const calcCommission = (orderTotal) => {
  if (orderTotal < 500) return Math.round(orderTotal * 0.10);
  if (orderTotal <= 1500) return Math.round(orderTotal * 0.12);
  return Math.round(orderTotal * 0.15);
};
const calcDeliveryFee = (distKm) => {
  if (!distKm || distKm <= 3) return 29;
  if (distKm <= 6) return 39;
  return 49;
};
const calcRiderPayout = (distKm) => {
  if (!distKm || distKm <= 3) return 22;
  if (distKm <= 6) return 32;
  return 40;
};

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [tab, setTab] = useState("dash");
  const [stats, setStats] = useState({ revenue: 0, active: 0, sellers: 0, fleet: 0, delivered: 0, pending: 0, shipped: 0 });
  const [revenueStats, setRevenueStats] = useState({ totalCommission: 0, totalDeliveryFees: 0, totalRiderPayouts: 0, netProfit: 0, pendingSettlements: 0, sellerBreakdown: [] });
  const [sellers, setSellers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [deliveryAgents, setDeliveryAgents] = useState([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [selectedRider, setSelectedRider] = useState(null);
  const [showMessages, setShowMessages] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Banner Management State
  const [banners, setBanners] = useState({});
  const [bannerRequests, setBannerRequests] = useState([]);
  const [editingBanner, setEditingBanner] = useState(null);
  const [bannerForm, setBannerForm] = useState({ imageUrl: "", title: "", subtitle: "", tag: "", cta: "", linkUrl: "", expiry: "" });
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerUploadErr, setBannerUploadErr] = useState("");

  useEffect(() => {
    const AUTHORIZED = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase());

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 1️⃣ Email whitelist — first line of defence
        if (!AUTHORIZED.includes(user.email?.toLowerCase())) {
          await signOut(auth);
          alert("Unauthorized: this email is not an admin.");
          return;
        }
        // 2️⃣ Firestore role check — second line of defence
        let snap = await getDoc(doc(db, "admin_roles", user.uid));

        // Race condition fix
        if (!snap.exists()) {
          await new Promise(r => setTimeout(r, 2000));
          snap = await getDoc(doc(db, "admin_roles", user.uid));
        }

        if (snap.exists() && snap.data().role === "admin") {
          setAuthenticated(true);
        } else if (snap.exists()) {
          await signOut(auth);
          alert("Unauthorized access");
        }
      } else { setAuthenticated(false); }
    });
    return () => unsub();
  }, []);

  // Push Notification state
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushTarget, setPushTarget] = useState("all"); // 'all', 'customers', 'sellers', 'riders', 'specific'
  const [pushSpecificId, setPushSpecificId] = useState("");
  const [pushSending, setPushSending] = useState(false);

  const [feedbacks, setFeedbacks] = useState([]);
  useEffect(() => {
    if (!authenticated) return;
    const unsubs = [];

    // Orders + Revenue Calculation
    unsubs.push(onSnapshot(collection(db, "orders"), (snap) => {
      let revenue = 0, active = 0, delivered = 0, pending = 0, shipped = 0;
      let totalCommission = 0, totalDeliveryFees = 0, totalRiderPayouts = 0, pendingSettlements = 0;
      const sellerMap = {};
      const o = [];
      snap.forEach((d) => {
        const order = { id: d.id, ...d.data() }; o.push(order);
        if (order.status === "Delivered") {
          revenue += order.total; delivered++;
          const commission = calcCommission(order.total);
          const deliveryFee = calcDeliveryFee(order.distanceKm);
          const riderPayout = calcRiderPayout(order.distanceKm);
          totalCommission += commission;
          totalDeliveryFees += deliveryFee;
          totalRiderPayouts += riderPayout;
          // Per-seller aggregation
          const sid = order.sellerId || "unknown";
          if (!sellerMap[sid]) sellerMap[sid] = { sellerId: sid, sellerName: order.sellerName || "Unknown Seller", orderCount: 0, gmv: 0, commission: 0, sellerEarnings: 0 };
          sellerMap[sid].orderCount++;
          sellerMap[sid].gmv += order.total;
          sellerMap[sid].commission += commission;
          sellerMap[sid].sellerEarnings += (order.total - commission);
        } else {
          active++;
          if (order.status === "Pending") { pending++; pendingSettlements += order.total; }
          if (order.status === "Shipped") shipped++;
        }
      });
      const sellerBreakdown = Object.values(sellerMap).sort((a, b) => b.commission - a.commission);
      setOrders(o);
      setStats((prev) => ({ ...prev, revenue, active, delivered, pending, shipped }));
      setRevenueStats({ totalCommission, totalDeliveryFees, totalRiderPayouts, netProfit: totalCommission + totalDeliveryFees - totalRiderPayouts, pendingSettlements, sellerBreakdown });
    }));

    // Sellers
    unsubs.push(onSnapshot(collection(db, "sellers_profile"), (snap) => {
      const s = []; snap.forEach((d) => s.push({ id: d.id, ...d.data() }));
      setSellers(s);
      setStats((prev) => ({ ...prev, sellers: s.length }));
    }));

    // Delivery fleet
    unsubs.push(onSnapshot(collection(db, "delivery_profile"), (snap) => {
      const d = []; snap.forEach((doc) => d.push({ id: doc.id, ...doc.data() }));
      setDeliveryAgents(d);
      setStats((prev) => ({ ...prev, fleet: d.length }));
    }));
    // Feedback collection
    unsubs.push(onSnapshot(collection(db, "feedback"), (snap) => {
      const f = [];
      snap.forEach((doc) => f.push({ id: doc.id, ...doc.data() }));
      setFeedbacks(f);
    }));

    // Users
    unsubs.push(onSnapshot(collection(db, "users"), (snap) => {
      const u = []; snap.forEach((d) => u.push({ id: d.id, ...d.data() }));
      setUsers(u);
    }));

    // Products
    unsubs.push(onSnapshot(collection(db, "products"), (snap) => {
      const p = []; snap.forEach((d) => p.push({ id: d.id, ...d.data() }));
      setProducts(p);
    }));

    // Banners (docs: banner_1 through banner_5)
    ["banner_1", "banner_2", "banner_3", "banner_4", "banner_5"].forEach((id) => {
      unsubs.push(onSnapshot(doc(db, "banners", id), (snap) => {
        if (snap.exists()) {
          setBanners((prev) => ({ ...prev, [id]: { id, ...snap.data() } }));
        }
      }));
    });

    // Banner Requests from sellers
    unsubs.push(onSnapshot(collection(db, "banner_requests"), (snap) => {
      const r = []; snap.forEach((d) => r.push({ id: d.id, ...d.data() }));
      r.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setBannerRequests(r);
    }));

    return () => unsubs.forEach((u) => u());
  }, [authenticated]);

  const approveSeller = async (id) => {
    await updateDoc(doc(db, "sellers_profile", id), { approved: true });
    alert("Seller Approved! ✅");
  };

  // Reusable helper to send a push notification via the API
  const sendNotification = async (token, title, body) => {
    if (!token) return;
    try {
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, title, body }),
      });
    } catch (e) { console.error("Push notification failed:", e); }
  };

  const removeSeller = async (id, name) => {
    if (!confirm(`Remove "${name}" from Dresho? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "sellers_profile", id));
    alert("Seller removed.");
  };

  const removeAdminProduct = async (id, name) => {
    if (!confirm(`Permanently delete the product "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "products", id));
      alert("Product deleted.");
    } catch (e) { alert("Failed to delete product: " + e.message); }
  };

  const suspendSeller = async (id, current) => {
    await updateDoc(doc(db, "sellers_profile", id), { approved: !current });
    alert(current ? "Seller suspended." : "Seller reactivated! ✅");
  };

  const approveRider = async (id) => {
    await updateDoc(doc(db, "delivery_profile", id), { approved: true });
    // Notify the rider
    const rider = deliveryAgents.find(r => r.id === id);
    if (rider?.fcmToken) sendNotification(rider.fcmToken, "🎉 You're Approved!", "Congratulations! Your Dresho rider account has been approved. You can now go online and accept deliveries.");
    alert("Rider Approved! ✅");
  };

  const removeRider = async (id, name) => {
    if (!confirm(`Remove rider "${name}" from Dresho? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "delivery_profile", id));
    alert("Rider removed.");
  };

  const removeUser = async (id, name) => {
    if (!confirm(`Permanently delete the user "${name}"? This action cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "users", id));
      alert("User deleted successfully.");
    } catch (e) {
      alert("Failed to delete user: " + e.message);
    }
  };

  const suspendRider = async (id, current) => {
    await updateDoc(doc(db, "delivery_profile", id), { approved: !current });
    alert(current ? "Rider suspended." : "Rider reactivated! ✅");
  };

  // Banner Management Functions
  const openBannerEditor = (bannerId) => {
    const existing = banners[bannerId] || {};
    setBannerForm({
      imageUrl: existing.imageUrl || "",
      title: existing.title || "",
      subtitle: existing.subtitle || "",
      tag: existing.tag || "",
      cta: existing.cta || "",
      linkUrl: existing.linkUrl || "",
      expiry: existing.expiry || "",
    });
    setEditingBanner(bannerId);
  };

  const saveBanner = async () => {
    if (!editingBanner) return;
    try {
      await setDoc(doc(db, "banners", editingBanner), {
        ...bannerForm,
        updatedAt: new Date(),
      }, { merge: true });
      alert("Banner saved! ✅");
      setEditingBanner(null);
    } catch (e) { alert("Failed: " + e.message); }
  };

  const approveBannerRequest = async (reqId, req) => {
    const duration = prompt("How many days to run this banner?", "7");
    if (!duration) return;
    const slot = req.slot || 1;
    const bannerId = `banner_${slot}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(duration));
    try {
      await setDoc(doc(db, "banners", bannerId), {
        imageUrl: req.imageUrl,
        title: req.title || "",
        subtitle: req.subtitle || "",
        tag: req.tag || "",
        cta: req.cta || "",
        expiry: expiryDate.toISOString(),
        sellerName: req.sellerName || "",
        sellerId: req.sellerId || "",
        updatedAt: new Date(),
      }, { merge: true });
      await updateDoc(doc(db, "banner_requests", reqId), {
        status: "approved",
        approvedAt: new Date(),
        durationDays: parseInt(duration),
        assignedSlot: slot,
      });
      alert(`Banner approved for Slot ${slot}, ${duration} days! ✅`);
      // Notify the seller
      const seller = sellers.find(s => s.id === req.sellerId);
      if (seller?.fcmToken) sendNotification(seller.fcmToken, "🎉 Banner Approved!", `Your banner ad has been approved and will run for ${duration} days!`);
    } catch (e) { alert("Failed: " + e.message); }
  };

  const sendPushNotification = async (e) => {
    e.preventDefault();
    if (!pushTitle || !pushBody) return alert("Title and Body are required.");
    setPushSending(true);

    try {
      let targetTokens = [];
      const fetchTokens = (collectionData) => collectionData.map(d => d.fcmToken).filter(Boolean);

      if (pushTarget === "all" || pushTarget === "customers") targetTokens.push(...fetchTokens(users));
      if (pushTarget === "all" || pushTarget === "sellers") targetTokens.push(...fetchTokens(sellers));
      if (pushTarget === "all" || pushTarget === "riders") targetTokens.push(...fetchTokens(deliveryAgents));
      if (pushTarget === "specific" && pushSpecificId) {
        const u = [...users, ...sellers, ...deliveryAgents].find(d => d.id === pushSpecificId);
        if (u && u.fcmToken) targetTokens.push(u.fcmToken);
      }

      if (targetTokens.length === 0) {
        alert("No users found with valid notification tokens for this target.");
        setPushSending(false);
        return;
      }

      let successCount = 0;
      for (const token of targetTokens) {
        const res = await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, title: pushTitle, body: pushBody })
        });
        if (res.ok) successCount++;
      }

      alert(`Successfully sent notification to ${successCount} user(s).`);
      setPushTitle("");
      setPushBody("");
    } catch (err) {
      console.error(err);
      alert("Error sending notification.");
    }
    setPushSending(false);
  };

  const rejectBannerRequest = async (reqId) => {
    const reason = prompt("Reason for rejection (optional):", "");
    try {
      await updateDoc(doc(db, "banner_requests", reqId), {
        status: "rejected",
        rejectedAt: new Date(),
        rejectionReason: reason || "",
      });
      alert("Request rejected.");
    } catch (e) { alert("Failed: " + e.message); }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "Delivered": return { bg: "rgba(16,185,129,0.1)", color: "#10b981", border: "rgba(16,185,129,0.2)" };
      case "Out for Delivery": return { bg: "rgba(6,182,212,0.1)", color: "#06b6d4", border: "rgba(6,182,212,0.2)" };
      case "Shipped": return { bg: "rgba(139,92,246,0.1)", color: "#8b5cf6", border: "rgba(139,92,246,0.2)" };
      default: return { bg: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "rgba(245,158,11,0.2)" };
    }
  };

  const sidebarItems = [
    { id: "dash", icon: "fa-chart-pie", label: "Dashboard" },
    { id: "revenue", icon: "fa-indian-rupee-sign", label: "Revenue" },
    { id: "sellers", icon: "fa-store", label: "Sellers" },
    { id: "orders", icon: "fa-truck-fast", label: "Live Orders" },
    { id: "users", icon: "fa-users-gear", label: "Users" },
    { id: "fleet", icon: "fa-motorcycle", label: "Delivery Fleet" },
    { id: "reviews", icon: "fa-star", label: "Ratings & Reviews" },
    { id: "banners", icon: "fa-image", label: "Banners" }
  ];

  // AUTH SCREEN
  if (!authenticated) {
    return (
      <div className="adm-auth-wrap">
        <div className="adm-auth-card">
          <div style={{ textAlign:"center" }}>
            <div style={{ width:52, height:52, borderRadius:14, background:"linear-gradient(140deg,var(--adm-gold-hi),#8C620A)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px", boxShadow:"0 4px 16px rgba(196,154,60,0.35)" }}>
              <i className="fas fa-shield-halved" style={{ fontSize:22, color:"#fff" }} />
            </div>
            <div style={{ fontFamily:"var(--font-d)", fontSize:30, fontWeight:700, color:"var(--adm-t1)" }}>Dresho</div>
            <div style={{ fontSize:12, color:"var(--adm-t4)", marginTop:4, letterSpacing:"0.12em", textTransform:"uppercase" }}>Admin Console</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            <input className="glass-input" type="email" placeholder="Admin email" value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="glass-input" type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} />
            <button className="btn-slide-primary" onClick={async()=>{try{await signInWithEmailAndPassword(auth,email,pass);}catch(err){alert("Login failed: "+(err.code||err.message));}}}>
              Verify Identity
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navSections = [
    { label:"Main", items:[
      { id:"dash",    icon:"fa-chart-line",       label:"Dashboard" },
      { id:"revenue", icon:"fa-indian-rupee-sign", label:"Revenue" },
    ]},
    { label:"Operations", items:[
      { id:"sellers", icon:"fa-store",    label:"Sellers",       badge: sellers.filter(s=>!s.approved).length||null },
      { id:"orders",  icon:"fa-bolt",     label:"Live Orders",   badge: stats.active||null },
      { id:"users",   icon:"fa-users",    label:"Users" },
      { id:"fleet",   icon:"fa-motorcycle", label:"Delivery Fleet", badge: deliveryAgents.filter(d=>!d.approved).length||null },
    ]},
    { label:"Content", items:[
      { id:"reviews", icon:"fa-star",  label:"Ratings & Reviews" },
      { id:"banners", icon:"fa-image", label:"Banners" },
      { id:"notifications", icon:"fa-bell", label:"Push Notifications" },
    ]},
  ];

  const curLabel = navSections.flatMap(s=>s.items).find(i=>i.id===tab)?.label || "Dashboard";

  // MAIN ADMIN PANEL
  return (
    <>
      <div className="adm-app">
        {/* Overlay */}
        {isMobileSidebarOpen && <div className="adm-overlay" onClick={()=>setIsMobileSidebarOpen(false)} />}

        {/* ── SIDEBAR ── */}
        <aside className={`adm-sb${isMobileSidebarOpen?" open":""}`}>
          <div className="adm-sb-brand">
            <div className="adm-sb-mark">D</div>
            <div>
              <div className="adm-sb-name">Dresho</div>
              <div className="adm-sb-role">Admin Console</div>
            </div>
          </div>

          <nav className="adm-nav">
            {navSections.map(sec=>(
              <div key={sec.label}>
                <div className="adm-nav-sec">{sec.label}</div>
                {sec.items.map(item=>(
                  <button key={item.id} className={`adm-nav-item${tab===item.id?" active":""}`}
                    onClick={()=>{setTab(item.id);setIsMobileSidebarOpen(false);}}>
                    <span className="adm-nav-ico"><i className={`fas ${item.icon}`}/></span>
                    {item.label}
                    {item.badge ? <span className="adm-nav-badge">{item.badge}</span> : null}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="adm-sys">
            <div className="adm-sys-dot"/>
            <div className="adm-sys-lbl">All systems operational</div>
            <div className="adm-sys-live">LIVE</div>
          </div>

        </aside>

        {/* ── MAIN ── */}
        <div className="adm-main">
          {/* Desktop topbar */}
          <header className="adm-topbar">
            <div className="adm-crumb">
              Dresho <span className="adm-crumb-sep"><i className="fas fa-chevron-right"/></span>
              <span className="adm-crumb-cur">{curLabel}</span>
            </div>
            <div className="adm-tb-spacer"/>
            <div className="adm-tb-date">{new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div>
            <div className="adm-tb-divider"/>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <button style={{ background: "var(--navy)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 2px 4px rgba(15,23,42,0.1)" }}>
                <i className="fas fa-external-link-alt" /> View Website
              </button>
            </Link>
            <div className="adm-tb-divider"/>
            <div style={{ position: "relative" }}>
              <div className="adm-tb-action" onClick={() => setShowMessages(!showMessages)}>
                <i className="far fa-envelope" />
                {feedbacks.length > 0 && <div className="adm-tb-notif">{feedbacks.length}</div>}
              </div>
              
              {/* Messages Dropdown */}
              {showMessages && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setShowMessages(false)} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 10px)", right: 0, width: 340,
                    background: "var(--white, #fff)", borderRadius: 16, boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
                    border: "1px solid var(--adm-line)", zIndex: 100, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: 400
                  }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--adm-line)", background: "var(--adm-parch)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--adm-t1)" }}>Inbox Messages</span>
                      <span style={{ fontSize: 11, background: "rgba(10,140,134,0.1)", color: "var(--adm-jade)", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{feedbacks.length} New</span>
                    </div>
                    <div style={{ overflowY: "auto", flex: 1, padding: 0 }}>
                      {feedbacks.length === 0 ? (
                        <div style={{ padding: 40, textAlign: "center", color: "var(--adm-t4)", fontSize: 13 }}>No new messages</div>
                      ) : (
                        feedbacks.sort((a, b) => b.createdAt?.toMillis?.() - a.createdAt?.toMillis?.()).map(fb => (
                          <div key={fb.id} 
                            style={{ padding: "16px 20px", borderBottom: "1px solid var(--adm-line)", cursor: "pointer", transition: "background 0.2s" }} 
                            onMouseEnter={e => e.currentTarget.style.background = "var(--adm-line)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            onClick={() => { setSelectedMessage(fb); setShowMessages(false); }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-t2)" }}>{fb.userName || fb.name || "Customer"}</span>
                              <span style={{ fontSize: 10, color: "var(--adm-t4)", whiteSpace: "nowrap" }}>
                                {fb.createdAt?.toDate ? fb.createdAt.toDate().toLocaleDateString() : "New"}
                              </span>
                            </div>
                            {fb.email && <div style={{ fontSize: 11, color: "var(--adm-saph)", marginBottom: 6 }}>{fb.email}</div>}
                            <div style={{ fontSize: 13, color: "var(--adm-t3)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {fb.text || fb.message}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </header>

          {/* MESSAGE DETAILS MODAL */}
          {selectedMessage && (
            <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setSelectedMessage(null)}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--adm-parch)", borderRadius: 24, padding: 32, maxWidth: 500, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", position: "relative" }}>
                <button onClick={() => setSelectedMessage(null)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", fontSize: 20, color: "var(--adm-t4)", cursor: "pointer" }}><i className="fas fa-xmark"/></button>
                
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(140deg, var(--adm-saph), #1e40af)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 700 }}>
                    {(selectedMessage.userName || selectedMessage.name || "C").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--adm-t1)", margin: 0 }}>{selectedMessage.userName || selectedMessage.name || "Customer"}</h3>
                    <div style={{ fontSize: 12, color: "var(--adm-t4)", marginTop: 2 }}>
                      {selectedMessage.createdAt?.toDate ? selectedMessage.createdAt.toDate().toLocaleString("en-IN") : "Just now"}
                    </div>
                  </div>
                </div>

                <div style={{ background: "var(--white)", borderRadius: 16, padding: 24, border: "1px solid var(--adm-line)" }}>
                  {selectedMessage.rating && (
                    <div style={{ marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(245,158,11,0.1)", color: "#f59e0b", padding: "4px 10px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                      <i className="fas fa-star" /> {selectedMessage.rating} / 5 Rating
                    </div>
                  )}
                  {selectedMessage.email && (
                    <div style={{ fontSize: 13, color: "var(--adm-saph)", marginBottom: 16, fontWeight: 500 }}>
                      <i className="fas fa-envelope" style={{ marginRight: 6 }}/> {selectedMessage.email}
                    </div>
                  )}
                  <div style={{ fontSize: 15, color: "var(--adm-t2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {selectedMessage.text || selectedMessage.message || "No message content."}
                  </div>
                </div>

                <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => setSelectedMessage(null)} className="btn-slide-primary" style={{ padding: "12px 24px", borderRadius: 12, fontSize: 13 }}>
                    Close Message
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mobile header */}
          <header className="adm-mob-hd">
            <div className="adm-ham" onClick={()=>setIsMobileSidebarOpen(true)}>
              <div/><div/>
            </div>
            <span style={{fontFamily:"var(--font-d)",fontSize:20,color:"var(--adm-t1)",fontStyle:"italic"}}>Dresho</span>
          </header>

          {/* Page content */}
          <div className="adm-page">
            <div className="adm-page-inner">

            {(() => {
              const liveActivities = [
                ...orders.map(o => ({ type: 'order', title: 'New Order', sub: `₹${o.total.toLocaleString("en-IN")} · ${o.status}`, time: o.createdAt?.toMillis?.() || 0, id: o.id })),
                ...users.map(u => ({ type: 'user', title: 'New User Registered', sub: u.name || 'Customer', time: u.createdAt?.toMillis?.() || 0, id: u.id })),
                ...feedbacks.map(f => ({ type: 'support', title: 'Support Ticket', sub: f.userName || f.email || 'Customer', time: f.createdAt?.toMillis?.() || 0, id: f.id }))
              ].sort((a, b) => b.time - a.time).slice(0, 6);

              return (
                <>

          {/* DASHBOARD */}
          {tab === "dash" && (
            <div className="animate-fade-in">
              <div className="adm-ph">
                <div>
                  <div className="adm-eyebrow">Platform Overview</div>
                  <div className="adm-title">Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}, Admin</div>
                  <div className="adm-sub">Real-time metrics across all Dresho operations</div>
                </div>
                <div className="adm-updated">Updated just now</div>
              </div>

              <div className="adm-sec-lbl"><span className="adm-sec-lbl-t">Key Metrics</span><div className="adm-sec-lbl-l"/></div>

              <div className="adm-stats">
                {[
                  { cls:"sc-jade", ico:"si-jade", sn:"sn-jade", icon:"fa-indian-rupee-sign", label:"Total Sales (GMV)", value:`₹${stats.revenue.toLocaleString("en-IN")}`, sub:"Across all sellers · Today", click:()=>setTab("revenue") },
                  { cls:"sc-saff", ico:"si-saff", sn:"sn-saff", icon:"fa-box-open",         label:"Active Orders", value:stats.active,  sub:"In progress right now" },
                  { cls:"sc-plum", ico:"si-plum", sn:"sn-plum", icon:"fa-store",             label:"Registered Sellers", value:stats.sellers, sub:"Active seller accounts" },
                  { cls:"sc-saph", ico:"si-saph", sn:"sn-saph", icon:"fa-motorcycle",        label:"Delivery Fleet", value:stats.fleet, sub:"Riders available now" },
                ].map((c,i)=>(
                  <div key={i} className={`adm-sc ${c.cls}`} style={{cursor:c.click?"pointer":"default"}} onClick={c.click}>
                    <div className="adm-sc-glow"/>
                    <div className="adm-sc-top">
                      <div className={`adm-sc-ico ${c.ico}`}><i className={`fas ${c.icon}`}/></div>
                    </div>
                    <div className="adm-sc-lbl">{c.label}</div>
                    <div className={`adm-sc-num ${c.sn}`}>{c.value}</div>
                    <div className="adm-sc-sub">{c.sub}</div>
                  </div>
                ))}
              </div>

              {/* Revenue + Orders panels */}
              <div className="adm-sec-lbl" style={{marginTop:8}}><span className="adm-sec-lbl-t">Revenue & Orders</span><div className="adm-sec-lbl-l"/></div>

              <div className="adm-row2">
                {/* Revenue panel */}
                <div className="adm-panel">
                  <div className="adm-panel-hd">
                    <div><div className="adm-panel-title">Revenue Overview</div><div className="adm-panel-sub">Commission breakdown</div></div>
                    <button className="adm-view-all" onClick={()=>setTab("revenue")}>View all <i className="fas fa-arrow-right" style={{fontSize:9}}/></button>
                  </div>
                  <div className="adm-panel-body" style={{padding:0}}>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",borderBottom:"1px solid var(--adm-line)"}}>
                      {[
                        {l:"Commission",v:`₹${revenueStats.totalCommission.toLocaleString("en-IN")}`,c:"var(--adm-jade)"},
                        {l:"Delivery Fees",v:`₹${revenueStats.totalDeliveryFees.toLocaleString("en-IN")}`,c:"var(--adm-saph)"},
                        {l:"Net Profit",v:`₹${revenueStats.netProfit.toLocaleString("en-IN")}`,c:"var(--adm-em)"},
                      ].map((s,i)=>(
                        <div key={i} style={{padding:"14px 18px",borderRight:i<2?"1px solid var(--adm-line)":"none"}}>
                          <div style={{fontSize:10.5,color:"var(--adm-t4)"}}>{s.l}</div>
                          <div style={{fontFamily:"var(--font-d)",fontSize:22,fontWeight:700,color:s.c,lineHeight:1,marginTop:3}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Seller table */}
                    <table className="adm-table">
                      <thead><tr><th>#</th><th>Seller</th><th>Orders</th><th>GMV</th><th>Commission</th></tr></thead>
                      <tbody>
                        {revenueStats.sellerBreakdown.length===0?(
                          <tr><td colSpan={5} style={{textAlign:"center",color:"var(--adm-t4)",padding:32}}>No delivered orders yet</td></tr>
                        ):revenueStats.sellerBreakdown.slice(0,5).map((sel,i)=>(
                          <tr key={sel.sellerId}>
                            <td><span style={{width:24,height:24,borderRadius:6,background:"var(--adm-parch)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"var(--adm-t2)"}}>{i+1}</span></td>
                            <td style={{fontWeight:600}}>{sellers.find(s => s.id === sel.sellerId)?.storeName || sel.sellerName}</td>
                            <td>{sel.orderCount}</td>
                            <td>₹{sel.gmv.toLocaleString("en-IN")}</td>
                            <td><span style={{color:"var(--adm-em)",fontWeight:700}}>₹{sel.commission.toLocaleString("en-IN")}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Live Activity Feed */}
                <div className="adm-panel">
                  <div className="adm-panel-hd" style={{ paddingBottom: 16 }}>
                    <div><div className="adm-panel-title">Live Activity</div><div className="adm-panel-sub">Real-time platform events</div></div>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--adm-em)", boxShadow: "0 0 10px var(--adm-em)" }} />
                  </div>
                  <div className="adm-panel-body" style={{ padding: "0 0 8px 0" }}>
                    {liveActivities.length === 0 ? (
                      <div style={{ padding: 40, textAlign: "center", color: "var(--adm-t4)", fontSize: 13 }}>No recent activity</div>
                    ) : (
                      liveActivities.map((act, i) => (
                        <div key={`${act.id}-${i}`} style={{ display: "flex", gap: 14, padding: "14px 24px", borderBottom: i < liveActivities.length - 1 ? "1px solid var(--adm-line)" : "none", transition: "background 0.2s", cursor: "pointer" }} className="hover:bg-gray-50">
                          <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            background: act.type === 'order' ? "var(--adm-jade-pale)" : act.type === 'user' ? "var(--adm-saph-pale)" : "var(--adm-saff-pale)",
                            color: act.type === 'order' ? "var(--adm-jade)" : act.type === 'user' ? "var(--adm-saph)" : "var(--adm-saff)"
                          }}>
                            <i className={`fas ${act.type === 'order' ? 'fa-bag-shopping' : act.type === 'user' ? 'fa-user' : 'fa-headset'}`} style={{ fontSize: 14 }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-t1)" }}>{act.title}</span>
                              <span style={{ fontSize: 10, color: "var(--adm-t4)" }}>
                                {act.time ? new Date(act.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--adm-t3)" }}>{act.sub}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Fleet quick view */}
              <div className="adm-sec-lbl" style={{marginTop:8}}><span className="adm-sec-lbl-t">Delivery Fleet</span><div className="adm-sec-lbl-l"/></div>
              <div className="adm-panel">
                <div className="adm-panel-hd">
                  <div><div className="adm-panel-title">Fleet Status</div><div className="adm-panel-sub">{deliveryAgents.filter(d=>d.online).length} riders online</div></div>
                  <button className="adm-view-all" onClick={()=>setTab("fleet")}>View all <i className="fas fa-arrow-right" style={{fontSize:9}}/></button>
                </div>
                <div style={{padding:"14px 18px"}}>
                  {deliveryAgents.slice(0,4).map(d=>(
                    <div key={d.id} className="adm-fleet-item">
                      <div className="adm-fleet-av" style={{background:d.online?"linear-gradient(140deg,var(--adm-jade),#065E5A)":"linear-gradient(140deg,var(--adm-t3),var(--adm-t4))"}}>{(d.name||"R").charAt(0)}</div>
                      <div className="adm-fleet-info">
                        <div className="adm-fleet-name">{d.name}</div>
                        <div className="adm-fleet-task">{d.vehicleType||"Vehicle"} · {d.deliveryCount||0} deliveries</div>
                      </div>
                      <div className={`adm-fleet-status ${d.online?"fs-on":"fs-break"}`}>{d.online?"Active":"Offline"}</div>
                    </div>
                  ))}
                  {deliveryAgents.length===0&&<div style={{textAlign:"center",padding:24,color:"var(--adm-t4)"}}>No riders registered yet</div>}
                </div>
              </div>
            </div>
          )}

                </>
              );
            })()}

          {tab === "revenue" && (
            <div className="animate-fade-in">
              <div className="adm-ph">
                <div>
                  <div className="adm-eyebrow">Financial</div>
                  <div className="adm-title">Revenue Breakdown</div>
                  <div className="adm-sub">Commission, delivery fees, and rider payouts</div>
                </div>
              </div>

              <div className="adm-stats">
                {[
                  { cls:"sc-jade", ico:"si-jade", sn:"sn-jade", icon:"fa-percent",    label:"Commission", value:`₹${revenueStats.totalCommission.toLocaleString("en-IN")}`, sub:"10–15% per order" },
                  { cls:"sc-saph", ico:"si-saph", sn:"sn-saph", icon:"fa-truck",      label:"Delivery Fees", value:`₹${revenueStats.totalDeliveryFees.toLocaleString("en-IN")}`, sub:"₹29–₹49 per delivery" },
                  { cls:"sc-saff", ico:"si-saff", sn:"sn-saff", icon:"fa-motorcycle",  label:"Rider Payouts", value:`₹${revenueStats.totalRiderPayouts.toLocaleString("en-IN")}`, sub:"₹22–₹40 per delivery" },
                  { cls:"sc-plum", ico:"si-plum", sn:"sn-plum", icon:"fa-chart-line",  label:"Net Profit", value:`₹${revenueStats.netProfit.toLocaleString("en-IN")}`, sub:"Commission + Fees − Payouts" },
                ].map((c,i)=>(
                  <div key={i} className={`adm-sc ${c.cls}`}>
                    <div className="adm-sc-glow"/>
                    <div className="adm-sc-top"><div className={`adm-sc-ico ${c.ico}`}><i className={`fas ${c.icon}`}/></div></div>
                    <div className="adm-sc-lbl">{c.label}</div>
                    <div className={`adm-sc-num ${c.sn}`}>{c.value}</div>
                    <div className="adm-sc-sub">{c.sub}</div>
                  </div>
                ))}
              </div>

              {/* Commission Rate Guide */}
              <div className="adm-panel" style={{marginBottom:20}}>
                <div className="adm-panel-hd"><div><div className="adm-panel-title">Commission Rate Table</div></div></div>
                <div style={{padding:0}}>
                  {[["Below ₹500","10%","var(--adm-jade)"],["₹500 – ₹1,500","12%","var(--adm-saph)"],["Above ₹1,500","15%","var(--adm-gold)"]].map(([range,rate,color],i)=>(
                    <div key={range} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 22px",borderBottom:i<2?"1px solid var(--adm-line)":"none"}}>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:color}}/>
                        <span style={{fontSize:14,fontWeight:500,color:"var(--adm-t2)"}}>{range}</span>
                      </div>
                      <span style={{fontSize:18,fontWeight:700,color,fontFamily:"var(--font-d)"}}>{rate}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seller Breakdown */}
              <div className="adm-panel">
                <div className="adm-panel-hd"><div><div className="adm-panel-title">Per-Seller Revenue</div><div className="adm-panel-sub">All delivered orders</div></div></div>
                <div style={{overflowX:"auto"}}>
                  <table className="adm-table">
                    <thead><tr><th>#</th><th>Seller</th><th>Orders</th><th>GMV</th><th>Commission</th><th>Seller Earnings</th></tr></thead>
                    <tbody>
                      {revenueStats.sellerBreakdown.length===0?(
                        <tr><td colSpan={6} style={{textAlign:"center",color:"var(--adm-t4)",padding:40}}>No delivered orders yet</td></tr>
                      ):revenueStats.sellerBreakdown.map((s,i)=>(
                        <tr key={s.sellerId}>
                          <td><span style={{width:28,height:28,borderRadius:8,background:"var(--adm-parch)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"var(--adm-t2)"}}>{i+1}</span></td>
                          <td style={{fontWeight:600}}>{sellers.find(seller => seller.id === s.sellerId)?.storeName || s.sellerName}</td>
                          <td>{s.orderCount}</td>
                          <td>₹{s.gmv.toLocaleString("en-IN")}</td>
                          <td><span style={{color:"var(--adm-em)",fontWeight:700}}>₹{s.commission.toLocaleString("en-IN")}</span></td>
                          <td><span style={{color:"var(--adm-saph)",fontWeight:600}}>₹{s.sellerEarnings.toLocaleString("en-IN")}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SELLERS */}
          {tab === "sellers" && (
            <div className="animate-fade-in">
              <div className="adm-ph">
                <div>
                  <div className="adm-eyebrow">Operations</div>
                  <div className="adm-title">Seller Management</div>
                  <div className="adm-sub">Review and manage seller applications</div>
                </div>
                {sellers.filter(s=>!s.approved).length>0&&<span className="adm-pill pill-pending">{sellers.filter(s=>!s.approved).length} Pending</span>}
              </div>

              <div className="admin-desktop-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {sellers.length === 0 ? (
                  <p style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "#8a93a4", fontWeight: 600 }}>No sellers registered yet</p>
                ) : (
                  sellers.map((s) => (
                    <div key={s.id} className="admin-mobile-card" style={{ padding: 22 }}>
                      {/* Status badge + name */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--navy)" }}>{s.storeName}</h3>
                          <p style={{ fontSize: 12, color: "#8a93a4", marginTop: 2 }}>👤 {s.ownerName || s.name || "—"}</p>
                        </div>
                        <span style={{
                          padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                          background: s.approved ? "#d1fae5" : "#fef3c7",
                          color: s.approved ? "#059669" : "#d97706",
                        }}>
                          {s.approved ? "✓ ACTIVE" : "⏳ PENDING"}
                        </span>
                      </div>

                      {/* Quick info row */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                        {s.phone && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                            <i className="fas fa-phone" style={{ color: "var(--gold)", width: 14 }} />
                            <span>{s.phone}</span>
                          </div>
                        )}
                        {s.locality && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                            <i className="fas fa-location-dot" style={{ color: "var(--gold)", width: 14 }} />
                            <span>{s.locality}</span>
                          </div>
                        )}
                        {s.shopType && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                            <i className="fas fa-tag" style={{ color: "var(--gold)", width: 14 }} />
                            <span>{s.shopType}</span>
                          </div>
                        )}
                      </div>

                      {/* Buttons */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button style={{ flex: 1, padding: "9px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "var(--navy)", color: "white", border: "none", cursor: "pointer" }}
                          onClick={() => setSelectedSeller(s)}>
                          🔍 More Info
                        </button>
                        {!s.approved ? (
                          <button className="btn-slide-primary" style={{ flex: 1, padding: "9px", borderRadius: 10, fontSize: 12, background: "linear-gradient(135deg, #10b981, #059669)" }}
                            onClick={() => approveSeller(s.id)}>
                            ✓ Approve
                          </button>
                        ) : (
                          <button style={{ flex: 1, padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#fef3c7", color: "#d97706", border: "1px solid #fde68a", cursor: "pointer" }}
                            onClick={() => suspendSeller(s.id, true)}>
                            ⏸ Suspend
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* ── SELLER DETAIL MODAL ── */}
              {selectedSeller && typeof document !== "undefined" && createPortal(
                <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto" }}
                  onClick={() => setSelectedSeller(null)}>
                  <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 24, padding: 24, maxWidth: 560, width: "100%", margin: "0 auto", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>

                    {/* Modal Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div>
                        <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--navy)" }}>{selectedSeller.storeName}</h2>
                        <p style={{ fontSize: 13, color: "#8a93a4", marginTop: 3 }}>👤 {selectedSeller.ownerName || selectedSeller.name || "—"}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 800, background: selectedSeller.approved ? "#d1fae5" : "#fef3c7", color: selectedSeller.approved ? "#059669" : "#d97706" }}>
                          {selectedSeller.approved ? "✓ ACTIVE" : "⏳ PENDING"}
                        </span>
                        <button onClick={() => setSelectedSeller(null)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                      </div>
                    </div>

                    {/* Documents */}
                    <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "#aaa", marginBottom: 8, textTransform: "uppercase" }}>Uploaded Documents</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "#aaa", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>🪪 ID Proof</p>
                        {selectedSeller.idProofUrl ? (
                          <a href={selectedSeller.idProofUrl} target="_blank" rel="noopener noreferrer">
                            <img src={selectedSeller.idProofUrl} alt="ID Proof"
                              style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 12, border: "2px solid #e8d8be", cursor: "pointer" }}
                              onError={(e) => { e.target.style.display = "none"; }} />
                          </a>
                        ) : (
                          <div style={{ width: "100%", padding: "12px", borderRadius: 12, background: "#f5f0e8", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#bbb", fontSize: 12 }}>
                            <i className="fas fa-image" style={{ fontSize: 16 }} /><span>Not Uploaded</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: "#aaa", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>🏪 Shop Photo</p>
                        {selectedSeller.shopPhotoUrl ? (
                          <a href={selectedSeller.shopPhotoUrl} target="_blank" rel="noopener noreferrer">
                            <img src={selectedSeller.shopPhotoUrl} alt="Shop"
                              style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 12, border: "2px solid #e8d8be", cursor: "pointer" }}
                              onError={(e) => { e.target.style.display = "none"; }} />
                          </a>
                        ) : (
                          <div style={{ width: "100%", padding: "12px", borderRadius: 12, background: "#f5f0e8", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#bbb", fontSize: 12 }}>
                            <i className="fas fa-store" style={{ fontSize: 16 }} /><span>Not Uploaded</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Info Grid */}
                    <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "#aaa", marginBottom: 8, textTransform: "uppercase" }}>Seller Details</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "#faf7f2", borderRadius: 16, padding: "12px 16px", marginBottom: 16 }}>
                      {[
                        { icon: "fa-phone", label: "Phone", value: selectedSeller.phone },
                        { icon: "fa-envelope", label: "Email", value: selectedSeller.email },
                        { icon: "fa-location-dot", label: "Address", value: selectedSeller.shopAddress },
                        { icon: "fa-map-pin", label: "Locality", value: selectedSeller.locality },
                        { icon: "fa-tag", label: "Shop Type", value: selectedSeller.shopType },
                        { icon: "fa-wallet", label: "UPI ID", value: selectedSeller.upiId },
                        { icon: "fa-clock", label: "Hours", value: selectedSeller.openingTime && selectedSeller.closingTime ? `${selectedSeller.openingTime} – ${selectedSeller.closingTime}` : null },
                        { icon: "fa-calendar-days", label: "Working Days", value: Array.isArray(selectedSeller.availableDays) && selectedSeller.availableDays.length ? selectedSeller.availableDays.join(", ") : null },
                      ].map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <i className={`fas ${item.icon}`} style={{ color: "var(--gold)", width: 14, marginTop: 3, fontSize: 12 }} />
                          <div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#aaa", display: "block" }}>{item.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", wordBreak: "break-all" }}>{item.value || "—"}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Applied date */}
                    {selectedSeller.createdAt && (
                      <p style={{ fontSize: 11, color: "#aaa", marginBottom: 20 }}>
                        📅 Applied: {selectedSeller.createdAt?.toDate
                          ? selectedSeller.createdAt.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : new Date(selectedSeller.createdAt?.seconds * 1000).toLocaleDateString("en-IN")}
                      </p>
                    )}

                    {/* Seller Products */}
                    {(() => {
                      const sellerProducts = products.filter(p => p.sellerId === selectedSeller.id);
                      if (sellerProducts.length === 0) return null;
                      return (
                        <div style={{ marginBottom: 20 }}>
                          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "#aaa", marginBottom: 10, textTransform: "uppercase" }}>
                            Uploaded Products ({sellerProducts.length})
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 200, overflowY: "auto", paddingRight: 5 }}>
                            {sellerProducts.map(p => (
                              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                                <img src={p.image} alt={p.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                                  <div style={{ fontSize: 11, color: "#64748b" }}>₹{p.price} • Stock: {p.stock} {p.outOfStock && <span style={{ color: "#ef4444", fontWeight: "bold" }}>(Out of Stock)</span>}</div>
                                </div>
                                <button onClick={() => removeAdminProduct(p.id, p.name)} style={{ background: "#fee2e2", color: "#ef4444", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <i className="fas fa-trash" style={{ fontSize: 12 }} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Modal Action Buttons */}
                    <div style={{ display: "flex", gap: 10 }}>
                      {!selectedSeller.approved ? (
                        <>
                          <button className="btn-slide-primary" style={{ flex: 1, padding: 14, borderRadius: 14, fontSize: 14, background: "linear-gradient(135deg, #10b981, #059669)" }}
                            onClick={() => { approveSeller(selectedSeller.id); setSelectedSeller(null); }}>
                            ✓ Approve Seller
                          </button>
                          <button style={{ flex: 1, padding: 14, borderRadius: 14, fontSize: 14, fontWeight: 700, background: "#ffe4e6", color: "#fb7185", border: "1px solid #fecdd3", cursor: "pointer" }}
                            onClick={() => { removeSeller(selectedSeller.id, selectedSeller.storeName); setSelectedSeller(null); }}>
                            ✕ Reject & Remove
                          </button>
                        </>
                      ) : (
                        <>
                          <button style={{ flex: 1, padding: 14, borderRadius: 14, fontSize: 14, fontWeight: 700, background: "#fef3c7", color: "#d97706", border: "1px solid #fde68a", cursor: "pointer" }}
                            onClick={() => { suspendSeller(selectedSeller.id, true); setSelectedSeller(null); }}>
                            ⏸ Suspend
                          </button>
                          <button style={{ flex: 1, padding: 14, borderRadius: 14, fontSize: 14, fontWeight: 700, background: "#ffe4e6", color: "#fb7185", border: "1px solid #fecdd3", cursor: "pointer" }}
                            onClick={() => { removeSeller(selectedSeller.id, selectedSeller.storeName); setSelectedSeller(null); }}>
                            ✕ Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>
          )}

          {/* LIVE ORDERS */}
          {tab === "orders" && (
            <div className="animate-fade-in">
              <div className="adm-ph">
                <div>
                  <div className="adm-eyebrow">Live Operations</div>
                  <div className="adm-title">Global Live Orders</div>
                  <div className="adm-sub">Monitor and track all ongoing orders</div>
                </div>
                <div className="adm-updated">Real-time</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:13}}>
                {orders.length === 0 ? (
                  <div style={{gridColumn:"1/-1",textAlign:"center",padding:40,color:"var(--adm-t4)",fontWeight:600}}>No orders yet</div>
                ) : (
                  orders.map((o) => {
                    const pillCls = o.status==="Delivered"?"pill-delivered":o.status==="Pending"?"pill-pending":o.status==="Shipped"?"pill-shipped":"pill-pending";
                    return (
                      <div key={o.id} className="adm-data-card">
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                          <span style={{fontSize:10.5,fontWeight:700,color:"var(--adm-t4)",letterSpacing:"0.1em"}}>ORDER #{o.trackingId}</span>
                          <span className={`adm-pill ${pillCls}`}>{o.status}</span>
                        </div>
                        <div style={{fontWeight:600,fontSize:14,color:"var(--adm-t1)",marginBottom:4}}>{o.userName}</div>
                        <div style={{fontSize:12,color:"var(--adm-t4)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:12}}>
                          <i className="fas fa-location-dot" style={{marginRight:6,color:"var(--adm-t5)"}}/>{o.userAddress}
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:11,borderTop:"1px solid var(--adm-line)"}}>
                          <span style={{fontSize:12,color:"var(--adm-t4)"}}>{o.items?.length||0} items</span>
                          <span style={{fontFamily:"var(--font-d)",fontSize:20,fontWeight:700,color:"var(--adm-jade)"}}>₹{o.total}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* USERS */}
          {tab === "users" && (
            <div className="animate-fade-in">
              <div className="adm-ph">
                <div>
                  <div className="adm-eyebrow">User Management</div>
                  <div className="adm-title">Registered Users</div>
                  <div className="adm-sub">Customer database and details · {users.length} total</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:13}}>
                {users.length === 0 ? (
                  <div style={{gridColumn:"1/-1",textAlign:"center",padding:40,color:"var(--adm-t4)",fontWeight:600}}>No users registered yet</div>
                ) : (
                  users.map((u) => (
                    <div key={u.id} className="adm-data-card">
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                        <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(140deg,var(--adm-gold-hi),#8C620A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0}}>
                          {(u.name||"U").charAt(0).toUpperCase()}
                        </div>
                        <div style={{fontWeight:600,fontSize:14,color:"var(--adm-t1)", flex: 1}}>{u.name}</div>
                        <button onClick={() => removeUser(u.id, u.name)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: "4px" }} title="Delete User">
                          <i className="fas fa-trash-alt" />
                        </button>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:7}}>
                        {[
                          {icon:"fa-envelope",val:u.email},
                          {icon:"fa-phone",val:u.phone||"—"},
                          {icon:"fa-location-dot",val:u.address?(typeof u.address==="object"?[u.address.line,u.address.landmark,u.address.city,u.address.pincode].filter(Boolean).join(", "):u.address):"—"},
                        ].map((r,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:12,color:"var(--adm-t3)"}}>
                            <i className={`fas ${r.icon}`} style={{color:"var(--adm-t5)",width:14,marginTop:2}}/>
                            <span style={{wordBreak:"break-all"}}>{r.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* DELIVERY FLEET */}
          {tab === "fleet" && (
            <div className="animate-fade-in">
              <div className="adm-ph">
                <div>
                  <div className="adm-eyebrow">Logistics</div>
                  <div className="adm-title">Delivery Fleet</div>
                  <div className="adm-sub">Manage your delivery partners</div>
                </div>
                {deliveryAgents.filter(d=>!d.approved).length>0&&<span className="adm-pill pill-pending">{deliveryAgents.filter(d=>!d.approved).length} Pending</span>}
              </div>
              
              {/* LIVE MAP TRACKING */}
              <div style={{ marginBottom: 24, background: "white", padding: 20, borderRadius: 16, border: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--navy)", marginBottom: 16 }}>
                   <i className="fas fa-satellite-dish" style={{ color: "#10b981", marginRight: 8 }} />
                   Live Rider Tracking
                </h3>
                {deliveryAgents.filter(d => d.online && d.liveLocation).length === 0 ? (
                  <div style={{ background: "#f8fafc", padding: 30, borderRadius: 12, textAlign: "center", color: "#64748b" }}>
                    <i className="fas fa-map-location-dot" style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }} />
                    <p style={{ fontWeight: 600 }}>No riders are currently broadcasting live location.</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                    {deliveryAgents.filter(d => d.online && d.liveLocation).map(d => (
                      <div key={d.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{d.name}</span>
                          <span style={{ fontSize: 10, background: "#ecfdf5", color: "#10b981", padding: "2px 6px", borderRadius: 4, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }}></span> Live</span>
                        </div>
                        <div style={{ width: "100%", height: 200, position: "relative" }}>
                          <LiveMap lat={d.liveLocation.lat} lng={d.liveLocation.lng} label={d.name} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:13}}>
                {deliveryAgents.length === 0 ? (
                  <div style={{gridColumn:"1/-1",textAlign:"center",padding:40,color:"var(--adm-t4)",fontWeight:600}}>No delivery agents yet</div>
                ) : (
                  deliveryAgents.map((d) => (
                    <div key={d.id} className="adm-data-card" style={{display:"flex",flexDirection:"column",gap:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div className="adm-fleet-av" style={{background:d.online?"linear-gradient(140deg,var(--adm-jade),#065E5A)":"linear-gradient(140deg,var(--adm-t3),var(--adm-t4))"}}>
                            {(d.name||"R").charAt(0)}
                          </div>
                          <div>
                            <div style={{display:"flex",alignItems:"center",gap:7}}>
                              <span style={{fontSize:15,fontWeight:700,color:"var(--adm-t1)"}}>{d.name}</span>
                              <span className={`adm-pill ${d.approved?"pill-delivered":"pill-pending"}`} style={{fontSize:9,padding:"2px 7px"}}>{d.approved?"ACTIVE":"PENDING"}</span>
                            </div>
                            <div style={{fontSize:12,color:"var(--adm-t3)",marginTop:2}}>{d.phone||"No phone"}</div>
                          </div>
                        </div>
                        <div style={{width:38,height:38,borderRadius:10,background:d.online?"var(--adm-jade-pale)":"var(--adm-parch2)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <i className="fas fa-motorcycle" style={{color:d.online?"var(--adm-jade)":"var(--adm-t4)",fontSize:15}}/>
                        </div>
                      </div>
                      <div style={{fontSize:12,color:"var(--adm-t4)"}}>{d.vehicleType||"Vehicle"} · {d.vehicleNumber||""}</div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:11,borderTop:"1px solid var(--adm-line)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span className={`adm-fleet-status ${d.online?"fs-on":"fs-break"}`}>{d.online?"Online":"Offline"}</span>
                          <span style={{fontSize:12,color:"var(--adm-t4)"}}>{d.deliveryCount||0} deliveries</span>
                        </div>
                        <button style={{padding:"6px 14px",fontSize:12,borderRadius:8,border:"1px solid var(--adm-line2)",background:"#fff",color:"var(--adm-t2)",cursor:"pointer",fontWeight:500}} onClick={()=>setSelectedRider(d)}>
                          <i className="fas fa-search" style={{marginRight:6,fontSize:10}}/> View
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* ── RIDER DETAIL MODAL ── */}
              {selectedRider && typeof document !== "undefined" && createPortal(
                <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto" }}
                  onClick={() => setSelectedRider(null)}>
                  <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 24, padding: 24, maxWidth: 560, width: "100%", margin: "0 auto", boxShadow: "0 24px 80px rgba(0,0,0,0.18)" }}>

                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div>
                        <h2 style={{ fontSize: 24, fontWeight: 900, color: "var(--navy)", marginBottom: 4 }}>{selectedRider.name}</h2>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>ID: {selectedRider.id.substring(0, 8)}...</span>
                          {selectedRider.approved ? (
                            <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: "#ecfdf5", color: "#10b981", border: "1px solid #d1fae5" }}>ACTIVE</span>
                          ) : (
                            <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: "#fef3c7", color: "#d97706", border: "1px solid #fde68a" }}>PENDING</span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => setSelectedRider(null)} style={{ background: "#f1f5f9", border: "none", width: 36, height: 36, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                        <i className="fas fa-times" />
                      </button>
                    </div>

                    {/* Documents Grid */}
                    <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "#aaa", marginBottom: 8, textTransform: "uppercase" }}>Verification Documents</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>ID Proof</p>
                        {selectedRider.idProofUrl ? (
                          <a href={selectedRider.idProofUrl} target="_blank" rel="noreferrer">
                            <img src={selectedRider.idProofUrl} alt="ID Proof"
                              style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 12, border: "2px solid #e2e8f0", cursor: "pointer" }}
                              onError={(e) => { e.target.style.display = "none"; }} />
                          </a>
                        ) : (
                          <div style={{ width: "100%", padding: "12px", borderRadius: 12, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#94a3b8", fontSize: 12, border: "1px dashed #e2e8f0" }}>
                            <i className="fas fa-id-card" style={{ fontSize: 16 }} /><span>Not Uploaded</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>Driving License</p>
                        {selectedRider.drivingLicenseUrl ? (
                          <a href={selectedRider.drivingLicenseUrl} target="_blank" rel="noreferrer">
                            <img src={selectedRider.drivingLicenseUrl} alt="Driving License"
                              style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 12, border: "2px solid #e2e8f0", cursor: "pointer" }}
                              onError={(e) => { e.target.style.display = "none"; }} />
                          </a>
                        ) : (
                          <div style={{ width: "100%", padding: "12px", borderRadius: 12, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#94a3b8", fontSize: 12, border: "1px dashed #e2e8f0" }}>
                            <i className="fas fa-id-badge" style={{ fontSize: 16 }} /><span>Not Uploaded</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Info Grid */}
                    <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "#aaa", marginBottom: 8, textTransform: "uppercase" }}>Rider Details</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "#f8fafc", borderRadius: 16, padding: "16px", marginBottom: 16 }}>
                      {[
                        { icon: "fa-phone", label: "Phone", value: selectedRider.phone },
                        { icon: "fa-envelope", label: "Email", value: selectedRider.email },
                        { icon: "fa-location-dot", label: "Address", value: selectedRider.address },
                        { icon: "fa-map", label: "Pref. Zone", value: selectedRider.preferredZone },
                        { icon: "fa-motorcycle", label: "Vehicle", value: selectedRider.vehicleType },
                        { icon: "fa-hashtag", label: "Vehicle No.", value: selectedRider.vehicleNumber },
                        { icon: "fa-wallet", label: "UPI ID", value: selectedRider.upiId },
                        { icon: "fa-clock", label: "Hours", value: selectedRider.workingHours },
                        { icon: "fa-coins", label: "Earnings", value: `₹${selectedRider.earnings || 0}` },
                      ].map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <i className={`fas ${item.icon}`} style={{ color: "var(--navy)", width: 14, marginTop: 3, fontSize: 12, opacity: 0.6 }} />
                          <div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", display: "block" }}>{item.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", wordBreak: "break-all" }}>{item.value || "—"}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Applied date */}
                    {selectedRider.createdAt && (
                      <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 20 }}>
                        Applied: <span style={{ fontWeight: 600 }}>{selectedRider.createdAt.toDate ? selectedRider.createdAt.toDate().toLocaleString() : "Unknown"}</span>
                      </p>
                    )}

                    {/* Modal Action Buttons */}
                    <div style={{ display: "flex", gap: 10 }}>
                      {!selectedRider.approved ? (
                        <>
                          <button style={{ flex: 1, padding: 14, borderRadius: 14, fontSize: 14, fontWeight: 700, background: "#10b981", color: "white", border: "none", cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}
                            onClick={() => { approveRider(selectedRider.id); setSelectedRider(null); }}>
                            ✓ Approve Rider
                          </button>
                          <button style={{ flex: 1, padding: 14, borderRadius: 14, fontSize: 14, fontWeight: 700, background: "#ffe4e6", color: "#fb7185", border: "1px solid #fecdd3", cursor: "pointer" }}
                            onClick={() => { removeRider(selectedRider.id, selectedRider.name); setSelectedRider(null); }}>
                            ✕ Reject
                          </button>
                        </>
                      ) : (
                        <>
                          <button style={{ flex: 1, padding: 14, borderRadius: 14, fontSize: 14, fontWeight: 700, background: "#fef3c7", color: "#d97706", border: "1px solid #fde68a", cursor: "pointer" }}
                            onClick={() => { suspendRider(selectedRider.id, true); setSelectedRider(null); }}>
                            ⏸ Suspend
                          </button>
                          <button style={{ flex: 1, padding: 14, borderRadius: 14, fontSize: 14, fontWeight: 700, background: "#ffe4e6", color: "#fb7185", border: "1px solid #fecdd3", cursor: "pointer" }}
                            onClick={() => { removeRider(selectedRider.id, selectedRider.name); setSelectedRider(null); }}>
                            ✕ Remove
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>
          )}

          {/* REVIEWS & FEEDBACK */}
          {tab === "reviews" && (
            <div className="animate-fade-in">
              <div className="adm-ph">
                <div>
                  <div className="adm-eyebrow">Engagement</div>
                  <div className="adm-title">Customer Feedback</div>
                  <div className="adm-sub">Reviews and suggestions from {feedbacks.length} users</div>
                </div>
              </div>
              <div className="admin-desktop-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {feedbacks.length === 0 ? (
                  <p style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "#8a93a4", fontWeight: 600 }}>No feedback received yet.</p>
                ) : (
                  feedbacks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((f) => {
                    const fbUser = users.find((u) => u.id === f.userId) || {};
                    let addr = "No Address Provided";
                    if (fbUser.address) {
                      addr = typeof fbUser.address === "string" ? fbUser.address : [fbUser.address.line, fbUser.address.city, fbUser.address.pincode].filter(Boolean).join(", ");
                    }

                    return (
                      <div key={f.id} className="admin-mobile-card" style={{ padding: "24px", background: "white", borderRadius: "16px", boxShadow: "0 4px 16px rgba(0,0,0,0.04)", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "16px" }}>
                        {/* HEADER: User Info */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--navy)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                            {(f.userName || fbUser.name || "G").charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ fontWeight: 700, fontSize: 15, color: "var(--navy)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.userName || fbUser.name || "Guest User"}</h4>
                            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fbUser.email || "No Email"}</p>
                            <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, display: "flex", alignItems: "flex-start", gap: 4, lineHeight: 1.4 }}>
                              <span style={{ fontSize: 10, marginTop: 1 }}>📍</span>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{addr}</span>
                            </p>
                          </div>
                          <div style={{ background: "#fffbeb", padding: "6px 12px", borderRadius: "20px", display: "flex", alignItems: "center", gap: 4, border: "1px solid #fde68a", flexShrink: 0 }}>
                            <span style={{ fontSize: 14, color: "#f59e0b", fontWeight: 800 }}>{f.rating}.0</span>
                            <span style={{ color: "#f59e0b", fontSize: 14 }}>★</span>
                          </div>
                        </div>

                        {/* BODY: Review Text */}
                        <div style={{ position: "relative", background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9", marginTop: 4 }}>
                          <span style={{ position: "absolute", top: -8, left: 16, background: "white", padding: "0 8px", fontSize: 10, fontWeight: 700, color: "#cbd5e1", letterSpacing: 1, textTransform: "uppercase" }}>Review</span>
                          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
                            "{f.text}"
                          </p>
                        </div>

                        {/* FOOTER: Date */}
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <span style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 500 }}>
                            {f.createdAt?.toDate ? f.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* BANNER MANAGEMENT */}
          {tab === "banners" && (
            <div className="animate-fade-in">
              <div className="adm-ph">
                <div>
                  <div className="adm-eyebrow">Content</div>
                  <div className="adm-title">Banner Management</div>
                  <div className="adm-sub">Control all 5 homepage banner slots</div>
                </div>
              </div>

              {/* LIVE BANNER SLOTS */}
              <p style={{ fontSize: 11, fontWeight: 800, color: "#8a93a4", letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Live Banner Slots</p>
              <div className="admin-desktop-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 40 }}>
                {["banner_1", "banner_2", "banner_3", "banner_4", "banner_5"].map((bid, i) => {
                  const b = banners[bid] || {};
                  const labels = ["Hero Slide 1", "Hero Slide 2", "Hero Slide 3", "Mini Left", "Mini Right"];
                  const isExpired = b.expiry && new Date(b.expiry) < new Date();
                  return (
                    <div key={bid} className="admin-mobile-card" style={{ padding: 22, border: isExpired ? "2px solid #fb7185" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "var(--text-tertiary)", textTransform: "uppercase" }}>SLOT {i + 1}</span>
                          <p style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{labels[i]}</p>
                        </div>
                        {isExpired && <span className="badge badge-rose" style={{ fontSize: 10 }}>EXPIRED</span>}
                        {b.sellerName && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>by {b.sellerName}</span>}
                      </div>
                      {b.imageUrl ? (
                        <div style={{ width: "100%", height: 120, borderRadius: 12, overflow: "hidden", marginBottom: 12, background: "#f0ebe3" }}>
                          <img src={b.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} />
                        </div>
                      ) : (
                        <div style={{ width: "100%", height: 120, borderRadius: 12, background: "#f0ebe3", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, color: "#aaa", fontSize: 13 }}>No banner set</div>
                      )}
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}><strong>Title:</strong> {b.title || "—"}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}><strong>Tag:</strong> {b.tag || "—"}</div>
                      {b.expiry && <div style={{ fontSize: 11, color: isExpired ? "#fb7185" : "#10b981", marginBottom: 8 }}>Expires: {new Date(b.expiry).toLocaleDateString()}</div>}
                      <button className="btn-slide-primary" style={{ width: "100%", padding: "10px", borderRadius: 12, fontSize: 12 }} onClick={() => openBannerEditor(bid)}>
                        ✎ Edit Banner
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* BANNER EDITOR MODAL */}
              {editingBanner && (
                <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setEditingBanner(null)}>
                  <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 24, padding: 32, maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
                    <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>Edit {editingBanner.replace("_", " ").toUpperCase()}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 8 }}>BANNER IMAGE</label>
                        {/* File upload dropzone */}
                        <label htmlFor="banner-img-upload" style={{
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          gap: 8, border: "2px dashed", borderColor: bannerUploading ? "var(--adm-jade)" : "var(--adm-line2)",
                          borderRadius: 12, padding: "20px 16px", cursor: bannerUploading ? "wait" : "pointer",
                          background: bannerUploading ? "var(--adm-jade-pale)" : "var(--adm-parch)",
                          transition: "all 0.2s"
                        }}>
                          {bannerUploading ? (
                            <><i className="fas fa-spinner fa-spin" style={{ fontSize: 22, color: "var(--adm-jade)" }}/><div style={{ fontSize: 12, color: "var(--adm-jade)" }}>Uploading…</div></>
                          ) : (
                            <><i className="fas fa-image" style={{ fontSize: 22, color: "var(--adm-t4)" }}/><div style={{ fontSize: 12, color: "var(--adm-t3)", textAlign: "center" }}>Click to upload banner image<br/><span style={{ fontSize: 10, color: "var(--adm-t4)" }}>JPG, PNG, WEBP · Max 10 MB</span></div></>
                          )}
                          <input id="banner-img-upload" type="file" accept="image/*" style={{ display: "none" }}
                            disabled={bannerUploading}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setBannerUploading(true); setBannerUploadErr("");
                              try {
                                const fd = new FormData();
                                fd.append("image", file);
                                const res = await fetch("/api/upload", { method: "POST", body: fd });
                                const json = await res.json();
                                if (res.ok && json.url) {
                                  setBannerForm(prev => ({ ...prev, imageUrl: json.url }));
                                } else { setBannerUploadErr(json.error || "Upload failed. Try again."); }
                              } catch { setBannerUploadErr("Upload error. Check connection."); }
                              finally { setBannerUploading(false); e.target.value = ""; }
                            }}
                          />
                        </label>
                        {bannerUploadErr && <div style={{ fontSize: 11, color: "var(--adm-rouge)", marginTop: 6 }}>{bannerUploadErr}</div>}
                      </div>
                      {bannerForm.imageUrl && (
                        <div style={{ width: "100%", height: 140, borderRadius: 12, overflow: "hidden", background: "#f0ebe3" }}>
                          <img src={bannerForm.imageUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} />
                        </div>
                      )}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>TITLE</label>
                        <input className="glass-input" placeholder="e.g. Style Arrives in 30 Minutes" value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>SUBTITLE</label>
                        <input className="glass-input" placeholder="e.g. Premium brands delivered fast" value={bannerForm.subtitle} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>TAG</label>
                          <input className="glass-input" placeholder="e.g. Express Fashion" value={bannerForm.tag} onChange={(e) => setBannerForm({ ...bannerForm, tag: e.target.value })} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>CTA TEXT</label>
                          <input className="glass-input" placeholder="e.g. Shop Now" value={bannerForm.cta} onChange={(e) => setBannerForm({ ...bannerForm, cta: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>LINK URL (Optional)</label>
                        <input className="glass-input" placeholder="e.g. /shop/category/women" value={bannerForm.linkUrl} onChange={(e) => setBannerForm({ ...bannerForm, linkUrl: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>EXPIRY DATE</label>
                        <input className="glass-input" type="date" value={bannerForm.expiry ? bannerForm.expiry.slice(0, 10) : ""} onChange={(e) => setBannerForm({ ...bannerForm, expiry: e.target.value ? new Date(e.target.value).toISOString() : "" })} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                      <button style={{ flex: 1, padding: 14, borderRadius: 14, fontSize: 13, fontWeight: 700, background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", cursor: "pointer" }} onClick={() => setEditingBanner(null)}>Cancel</button>
                      <button className="btn-slide-primary" style={{ flex: 1, borderRadius: 14, fontSize: 13 }} onClick={saveBanner}>Save Banner</button>
                    </div>
                  </div>
                </div>
              )}

              {/* SELLER BANNER REQUESTS */}
              <p style={{ fontSize: 11, fontWeight: 800, color: "#8a93a4", letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Seller Ad Requests</p>
              {bannerRequests.length === 0 ? (
                <div className="admin-mobile-card" style={{ padding: 40, textAlign: "center", color: "#8a93a4", fontWeight: 600 }}>No banner requests yet</div>
              ) : (
                <div className="admin-desktop-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  {bannerRequests.map((req) => {
                    const statusColors = { pending: { bg: "#fef3c7", color: "#f59e0b" }, approved: { bg: "#d1fae5", color: "#10b981" }, rejected: { bg: "#ffe4e6", color: "#fb7185" } };
                    const sc = statusColors[req.status] || statusColors.pending;
                    return (
                      <div key={req.id} className="admin-mobile-card" style={{ padding: 22 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{req.sellerName || req.sellerId}</span>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 8 }}>→ Slot {req.slot}</span>
                          </div>
                          <span style={{ padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, textTransform: "uppercase" }}>{req.status}</span>
                        </div>
                        {req.imageUrl && (
                          <div style={{ width: "100%", height: 100, borderRadius: 12, overflow: "hidden", marginBottom: 12, background: "#f0ebe3" }}>
                            <img src={req.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} />
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}><strong>Title:</strong> {req.title || "—"} &nbsp; <strong>Tag:</strong> {req.tag || "—"}</div>
                        {req.message && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}><strong>Message:</strong> {req.message}</div>}
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 12 }}>Requested {req.durationDays || "?"} days &nbsp;·&nbsp; {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : ""}</div>
                        {req.status === "pending" && (
                          <div style={{ display: "flex", gap: 10 }}>
                            <button className="btn-slide-primary" style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 12 }} onClick={() => approveBannerRequest(req.id, req)}>✓ Approve & Set Duration</button>
                            <button style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 12, fontWeight: 700, background: "rgba(251,113,133,0.1)", color: "#fb7185", border: "1px solid rgba(251,113,133,0.2)", cursor: "pointer" }} onClick={() => rejectBannerRequest(req.id)}>✕ Reject</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {tab === "notifications" && (
            <div className="animate-fade-in">
              <div className="adm-ph">
                <div>
                  <div className="adm-eyebrow">Engagement</div>
                  <div className="adm-title">Push Notifications</div>
                  <div className="adm-sub">Send manual alerts to your users</div>
                </div>
              </div>
              <div className="adm-grid" style={{ gridTemplateColumns: "1fr" }}>
                <div className="adm-card">
                  <div className="adm-card-head"><h3 className="adm-card-title">Compose Message</h3></div>
                  <div style={{ padding: 20 }}>
                    <form onSubmit={sendPushNotification} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 500 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-t2)", marginBottom: 6, display: "block" }}>Notification Title</label>
                        <input className="adm-input" value={pushTitle} onChange={e=>setPushTitle(e.target.value)} placeholder="e.g. 50% OFF Flash Sale!" required />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-t2)", marginBottom: 6, display: "block" }}>Notification Message</label>
                        <textarea className="adm-input" value={pushBody} onChange={e=>setPushBody(e.target.value)} placeholder="e.g. Hurry up! Sale ends in 2 hours." rows={3} required />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-t2)", marginBottom: 6, display: "block" }}>Target Audience</label>
                        <select className="adm-input" value={pushTarget} onChange={e=>setPushTarget(e.target.value)}>
                          <option value="all">Everyone (Customers, Sellers, Riders)</option>
                          <option value="customers">Only Customers</option>
                          <option value="sellers">Only Sellers</option>
                          <option value="riders">Only Riders</option>
                          <option value="specific">Specific User ID</option>
                        </select>
                      </div>
                      {pushTarget === "specific" && (
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-t2)", marginBottom: 6, display: "block" }}>User ID</label>
                          <input className="adm-input" value={pushSpecificId} onChange={e=>setPushSpecificId(e.target.value)} placeholder="Enter User ID" required />
                        </div>
                      )}
                      <button type="submit" className="adm-btn" style={{ marginTop: 10, alignSelf: "flex-start" }} disabled={pushSending}>
                        {pushSending ? "Sending..." : "Send Notification"} <i className="fas fa-paper-plane" style={{ marginLeft: 8 }}/>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>{/* end adm-page-inner */}
      </div>{/* end adm-page */}
    </div>{/* end adm-main */}
  </div>{/* end adm-app */}
</>
  );
}


