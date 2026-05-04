"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, collection, onSnapshot, updateDoc, deleteDoc,
} from "firebase/firestore";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [tab, setTab] = useState("dash");
  const [stats, setStats] = useState({ revenue: 0, active: 0, sellers: 0, fleet: 0, delivered: 0, pending: 0, shipped: 0 });
  const [sellers, setSellers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [deliveryAgents, setDeliveryAgents] = useState([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Banner Management State
  const [banners, setBanners] = useState({});
  const [bannerRequests, setBannerRequests] = useState([]);
  const [editingBanner, setEditingBanner] = useState(null);
  const [bannerForm, setBannerForm] = useState({ imageUrl: "", title: "", subtitle: "", tag: "", cta: "", expiry: "" });

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

  const [feedbacks, setFeedbacks] = useState([]);
  useEffect(() => {
    if (!authenticated) return;
    const unsubs = [];

    // Orders
    unsubs.push(onSnapshot(collection(db, "orders"), (snap) => {
      let revenue = 0, active = 0, delivered = 0, pending = 0, shipped = 0;
      const o = [];
      snap.forEach((d) => {
        const order = { id: d.id, ...d.data() }; o.push(order);
        if (order.status === "Delivered") { revenue += order.total; delivered++; }
        else active++;
        if (order.status === "Pending") pending++;
        if (order.status === "Shipped") shipped++;
      });
      setOrders(o);
      setStats((prev) => ({ ...prev, revenue, active, delivered, pending, shipped }));
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

  const removeSeller = async (id, name) => {
    if (!confirm(`Remove "${name}" from Dresho? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "sellers_profile", id));
    alert("Seller removed.");
  };

  const suspendSeller = async (id, current) => {
    await updateDoc(doc(db, "sellers_profile", id), { approved: !current });
    alert(current ? "Seller suspended." : "Seller reactivated! ✅");
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
    } catch (e) { alert("Failed: " + e.message); }
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
      <>
        <div className=""><div className="" /></div>
        <div className="page-content " style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20, position: "relative", zIndex: 1 }}>
          <Link href="/" style={{ position: "fixed", top: 20, left: 20, zIndex: 100, width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "var(--gold)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "all 0.3s ease" }}>
            <i className="fas fa-house" style={{ fontSize: 16 }} />
          </Link>
          <div className="animate-scale-in premium-card" style={s.authCard}>
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ ...s.authLogo, background: "var(--ivory2)", border: "1px solid var(--border2)" }}>
                <i className="fas fa-shield-halved" style={{ fontSize: 28, color: "var(--navy)" }} />
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: 2 }}>Dresho</h1>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Admin Control Center</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input className="glass-input" type="email" placeholder="Admin Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="glass-input" type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} />
                <button className="btn-slide-primary" onClick={async () => { try { await signInWithEmailAndPassword(auth, email, pass); } catch (err) { alert("Login failed: " + (err.code || err.message)); } }}>
                Verify Identity
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // MAIN ADMIN PANEL
  return (
    <>
      <div className=""><div className="" /></div>
      <div className="page-content " style={{ display: "flex", minHeight: "100vh", position: "relative", zIndex: 1 }}>
        {/* MOBILE OVERLAY */}
        {isMobileSidebarOpen && (
          <div className="admin-overlay" onClick={() => setIsMobileSidebarOpen(false)}></div>
        )}

        {/* SIDEBAR */}
        <nav style={s.sidebar} className={`premium-sidebar admin-sidebar ${isMobileSidebarOpen ? "open" : ""}`}>
          <div style={{ padding: "24px 16px 32px", textAlign: "center" }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--gold)", letterSpacing: 3, cursor: "pointer" }}>Dresho</h2>
            </Link>
            <p className="section-label" style={{ marginTop: 4, marginBottom: 0 }}>ADMIN</p>
          </div>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", margin: "0 8px 6px", borderRadius: 14, background: "transparent", textDecoration: "none", color: "var(--text-secondary)", fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600, transition: "all 0.3s ease" }}>
            <i className="fas fa-house" style={{ fontSize: 16, width: 24, textAlign: "center" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Homepage</span>
          </Link>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, padding: "0 8px" }}>
            {sidebarItems.map((item) => (
              <button key={item.id} onClick={() => { setTab(item.id); setIsMobileSidebarOpen(false); }} style={{
                ...s.sidebarBtn,
                ...(tab === item.id ? s.sidebarBtnActive : {}),
              }}>
                <i className={`fas ${item.icon}`} style={{ fontSize: 16, width: 24, textAlign: "center" }} />
                <span style={s.sidebarLabel}>{item.label}</span>
              </button>
            ))}
          </div>
          <div style={{ padding: "16px 8px" }}>
            <button onClick={() => signOut(auth)} style={{ ...s.sidebarBtn, color: "var(--aurora-rose)" }}>
              <i className="fas fa-right-from-bracket" style={{ fontSize: 16, width: 24, textAlign: "center" }} />
              <span style={s.sidebarLabel}>Exit</span>
            </button>
          </div>
        </nav>

        {/* MAIN CONTENT */}
        <main className="admin-main" style={{ flex: 1, marginLeft: 240, padding: "32px 40px", overflowX: "hidden" }}>
          
          <div className="admin-mobile-header">
            <button className="admin-menu-btn-new" onClick={() => setIsMobileSidebarOpen(true)}>
              <div />
              <div />
            </button>
          </div>

          {/* DASHBOARD */}
          {tab === "dash" && (

            <div className="animate-fade-in">
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, color: "var(--navy)", lineHeight: 1.1 }}>Platform<br/>Overview</h1>
                <p style={{ color: "#8a93a4", marginTop: 8, fontSize: 13, fontWeight: 500 }}>Real-time stats across all operations</p>
              </div>

              <div className="admin-mobile-status-pill">
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                  System Online
                </div>
                <div style={{ background: "#ccfbf1", color: "#10b981", fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 12, letterSpacing: 1 }}>
                  LIVE
                </div>
              </div>

              <div className="admin-desktop-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
                {[
                  { label: "TOTAL REVENUE", value: `₹${stats.revenue.toLocaleString("en-IN")}`, color: "#14b8a6", bg: "#ccfbf1", icon: "fa-indian-rupee-sign", sub: "Updated just now" },
                  { label: "ACTIVE ORDERS", value: stats.active, color: "#f59e0b", bg: "#fef3c7", icon: "fa-clock", sub: "In progress" },
                  { label: "SELLERS", value: stats.sellers, color: "#3b82f6", bg: "#dbeafe", icon: "fa-store", sub: "Registered" },
                  { label: "DELIVERY FLEET", value: stats.fleet, color: "#8b5cf6", bg: "#ede9fe", icon: "fa-motorcycle", sub: "Riders available" },
                ].map((card, i) => (
                  <div key={i} className="admin-mobile-card">
                    <div className="admin-mobile-card-icon" style={{ background: card.bg }}>
                      <i className={`fas ${card.icon}`} style={{ color: card.color, fontSize: 16 }} />
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 800, color: "#8a93a4", letterSpacing: 1, marginBottom: 4 }}>{card.label}</p>
                    <h3 style={{ fontSize: 32, fontWeight: 900, color: card.color, marginBottom: 4 }}>{card.value}</h3>
                    <p style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 500 }}>{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* Order breakdown cards */}
              <p style={{ fontSize: 11, fontWeight: 800, color: "#8a93a4", letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Order Status</p>
              <div className="admin-desktop-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {[
                  { label: "Delivered", value: stats.delivered, color: "#10b981", bg: "#d1fae5", icon: "fa-check-double", sub: "Successfully completed" },
                  { label: "Pending", value: stats.pending, color: "#f59e0b", bg: "#fef3c7", icon: "fa-hourglass-half", sub: "Awaiting dispatch" },
                  { label: "Shipped", value: stats.shipped, color: "#8b5cf6", bg: "#ede9fe", icon: "fa-box-open", sub: "Out for delivery" },
                ].map((item, i) => (
                  <div key={i} className="admin-order-card" style={{ borderLeft: `6px solid ${item.color}` }}>
                    <div className="admin-order-icon" style={{ background: item.bg }}>
                      <i className={`fas ${item.icon}`} style={{ color: item.color, fontSize: 18 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>{item.label}</h4>
                      <p style={{ fontSize: 11, color: "#8a93a4", fontWeight: 500, marginTop: 2 }}>{item.sub}</p>
                    </div>
                    <h4 style={{ fontSize: 24, fontWeight: 900, color: item.color }}>{item.value}</h4>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SELLERS */}
          {tab === "sellers" && (

            <div className="animate-fade-in">
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, color: "var(--navy)", lineHeight: 1.1 }}>Seller<br/>Management</h1>
                <p style={{ color: "#8a93a4", marginTop: 8, fontSize: 13, fontWeight: 500 }}>Approve, suspend, or remove sellers from the Dresho platform.</p>
              </div>
              <div className="admin-desktop-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {sellers.length === 0 ? (
                  <p style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "#8a93a4", fontWeight: 600 }}>No sellers registered yet</p>
                ) : (
                  sellers.map((s) => (
                    <div key={s.id} className="admin-mobile-card" style={{ padding: 22 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                        <div>
                          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--navy)" }}>{s.storeName}</h3>
                          <p style={{ fontSize: 12, color: "#8a93a4", marginTop: 2 }}>{s.name}</p>
                        </div>
                        <span className={`badge ${s.approved ? "badge-emerald" : "badge-amber"}`} style={{ fontSize: 10 }}>
                          {s.approved ? "✓ ACTIVE" : "PENDING"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                        <i className="fas fa-envelope" style={{ color: "#cbd5e1" }} />
                        <span style={{ wordBreak: "break-all" }}>{s.email}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
                        {!s.approved ? (
                          <button className="btn-slide-primary" style={{ flex: 1, padding: "10px", borderRadius: 10, fontSize: 12, background: "linear-gradient(135deg, #10b981, #059669)" }} onClick={() => approveSeller(s.id)}>
                            ✓ Approve
                          </button>
                        ) : (
                          <button style={{ flex: 1, padding: "10px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#fef3c7", color: "#f59e0b", border: "1px solid #fde68a", cursor: "pointer" }} onClick={() => suspendSeller(s.id, true)}>
                            ⏸ Suspend
                          </button>
                        )}
                        <button style={{ flex: 1, padding: "10px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#ffe4e6", color: "#fb7185", border: "1px solid #fecdd3", cursor: "pointer" }} onClick={() => removeSeller(s.id, s.storeName)}>
                          ✕ Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* LIVE ORDERS */}
          {tab === "orders" && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, color: "var(--navy)", lineHeight: 1.1 }}>Global<br/>Live Orders</h1>
                <p style={{ color: "#8a93a4", marginTop: 8, fontSize: 13, fontWeight: 500 }}>Monitor and track all ongoing orders</p>
              </div>
              <div className="admin-desktop-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                {orders.length === 0 ? (
                  <p style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "#8a93a4", fontWeight: 600 }}>No orders yet</p>
                ) : (
                  orders.map((o) => {
                    const sty = getStatusStyle(o.status);
                    return (
                      <div key={o.id} className="admin-mobile-card" style={{ padding: "20px 24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 1 }}>ORDER #{o.trackingId}</span>
                          <span className="badge" style={{ background: sty.bg, color: sty.color, border: `1px solid ${sty.border}` }}>{o.status}</span>
                        </div>
                        <h4 style={{ fontWeight: 700, marginBottom: 4 }}>{o.userName}</h4>
                        <p style={{ fontSize: 13, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <i className="fas fa-location-dot" style={{ marginRight: 6 }} />{o.userAddress}
                        </p>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{o.items?.length || 0} items</span>
                          <span style={{ fontSize: 18, fontWeight: 900, color: "var(--aurora-cyan)" }}>₹{o.total}</span>
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
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, color: "var(--navy)", lineHeight: 1.1 }}>Registered<br/>Users</h1>
                <p style={{ color: "#8a93a4", marginTop: 8, fontSize: 13, fontWeight: 500 }}>Customer database and details</p>
              </div>
              <div className="admin-desktop-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {users.length === 0 ? (
                  <p style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "#8a93a4", fontWeight: 600 }}>No users registered yet</p>
                ) : (
                  users.map((u) => (
                    <div key={u.id} className="admin-mobile-card" style={{ padding: 22 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--navy)", marginBottom: 12 }}>{u.name}</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                          <i className="fas fa-envelope" style={{ color: "#cbd5e1", width: 16 }} />
                          <span style={{ wordBreak: "break-all" }}>{u.email}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                          <i className="fas fa-phone" style={{ color: "#cbd5e1", width: 16 }} />
                          <span>{u.phone || "—"}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                          <i className="fas fa-location-dot" style={{ color: "#cbd5e1", width: 16, marginTop: 4 }} />
                          <span style={{ flex: 1 }}>
                            {u.address
                              ? (typeof u.address === "object"
                                  ? [u.address.line, u.address.landmark, u.address.city, u.address.pincode].filter(Boolean).join(", ")
                                  : u.address)
                              : "—"}
                          </span>
                        </div>
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
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, color: "var(--navy)", lineHeight: 1.1 }}>Delivery<br/>Fleet</h1>
                <p style={{ color: "#8a93a4", marginTop: 8, fontSize: 13, fontWeight: 500 }}>Manage your delivery partners</p>
              </div>
              <div className="admin-desktop-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {deliveryAgents.length === 0 ? (
                  <p style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "#8a93a4", fontWeight: 600 }}>No delivery agents yet</p>
                ) : (
                  deliveryAgents.map((d) => (
                    <div key={d.id} className="admin-mobile-card" style={{ padding: "20px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 16, background: d.online ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <i className="fas fa-motorcycle" style={{ color: d.online ? "#10b981" : "var(--text-tertiary)", fontSize: 18 }} />
                        </div>
                        <div>
                          <h4 style={{ fontWeight: 700 }}>{d.name}</h4>
                          <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{d.vehicle || "No vehicle"}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        <span className={`badge ${d.online ? "badge-emerald" : "badge-rose"}`}>
                          {d.online ? "Online" : "Offline"}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{d.deliveryCount || 0} deliveries</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* REVIEWS & FEEDBACK */}
          {tab === "reviews" && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, color: "var(--navy)", lineHeight: 1.1 }}>Customer<br/>Feedback</h1>
                <p style={{ color: "#8a93a4", marginTop: 8, fontSize: 13, fontWeight: 500 }}>Reviews and suggestions submitted by users</p>
              </div>
              <div className="admin-desktop-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {feedbacks.length === 0 ? (
                  <p style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "#8a93a4", fontWeight: 600 }}>No feedback received yet.</p>
                ) : (
                  feedbacks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((f) => (
                    <div key={f.id} className="admin-mobile-card" style={{ padding: "20px 24px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div>
                          <h4 style={{ fontWeight: 700, fontSize: 14 }}>{f.userName || "Guest User"}</h4>
                          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{f.createdAt?.toDate ? f.createdAt.toDate().toLocaleDateString() : ""}</span>
                        </div>
                        <div style={{ color: "var(--gold)", fontSize: 14, letterSpacing: 2 }}>
                          {"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}
                        </div>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, background: "rgba(0,0,0,0.02)", padding: 12, borderRadius: 12, marginTop: 12 }}>
                        "{f.text}"
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* BANNER MANAGEMENT */}
          {tab === "banners" && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, color: "var(--navy)", lineHeight: 1.1 }}>Banner<br/>Management</h1>
                <p style={{ color: "#8a93a4", marginTop: 8, fontSize: 13, fontWeight: 500 }}>Control all 5 homepage banner slots</p>
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
                        <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>IMAGE URL</label>
                        <input className="glass-input" placeholder="https://..." value={bannerForm.imageUrl} onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })} />
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
        </main>
      </div>
    </>
  );
}

const s = {
  authCard: {
    width: "100%", maxWidth: 420, background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(40px)",
    border: "1px solid rgba(0,0,0,0.06)", borderRadius: 36, padding: 40,
    display: "flex", flexDirection: "column", gap: 28,
  },
  authLogo: {
    width: 72, height: 72, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: 8, boxShadow: "0 0 40px rgba(26,13,220,0.1)",
  },
  sidebar: {
    width: 240, position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 40,
    display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.04)",
  },
  sidebarBtn: {
    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
    borderRadius: 14, background: "transparent", border: "none",
    color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.3s ease",
    fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600, width: "100%", textAlign: "left",
  },
  sidebarBtnActive: {
    background: "linear-gradient(135deg, var(--navy), var(--gold))", color: "white",
    boxShadow: "0 4px 20px rgba(26, 13, 220, 0.3)",
  },
  sidebarLabel: { fontSize: 14, fontWeight: 600 },
};

