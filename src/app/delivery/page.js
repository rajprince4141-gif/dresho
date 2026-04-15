"use client";
import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, collection, query, where,
  onSnapshot, updateDoc, increment,
} from "firebase/firestore";

export default function DeliveryPage() {
  const [user, setUser] = useState(null);
  const [riderData, setRiderData] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [riderName, setRiderName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [isOnline, setIsOnline] = useState(false);
  const [tab, setTab] = useState("jobs");
  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeDeliveries, setActiveDeliveries] = useState([]);

  // OTP Modal
  const [showOtp, setShowOtp] = useState(false);
  const [otpOrderId, setOtpOrderId] = useState(null);
  const [otpExpected, setOtpExpected] = useState(null);
  const [otpInput, setOtpInput] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "delivery_profile", u.uid));
        if (snap.exists() && snap.data().role === "delivery") {
          setUser(u);
          setRiderData(snap.data());
        } else { await signOut(auth); alert("Not a Delivery Agent"); }
      } else { setUser(null); setRiderData(null); }
    });
    return () => unsub();
  }, []);

  // Available jobs
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "orders"), where("status", "==", "Shipped"), where("riderId", "==", null));
    const unsub = onSnapshot(q, (snap) => {
      const o = []; snap.forEach((d) => o.push({ id: d.id, ...d.data() }));
      setAvailableOrders(o);
    });
    return () => unsub();
  }, [user]);

  // Active deliveries
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "orders"), where("riderId", "==", user.uid), where("status", "==", "Out for Delivery"));
    const unsub = onSnapshot(q, (snap) => {
      const o = []; snap.forEach((d) => o.push({ id: d.id, ...d.data() }));
      setActiveDeliveries(o);
    });
    return () => unsub();
  }, [user]);

  const handleAuth = async () => {
    setAuthLoading(true);
    try {
      if (isLogin) { await signInWithEmailAndPassword(auth, email, pass); }
      else {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "delivery_profile", res.user.uid), {
          name: riderName, vehicle, email, role: "delivery", online: false, earnings: 0, deliveryCount: 0,
        });
      }
    } catch (e) { alert(e.message); }
    setAuthLoading(false);
  };

  const toggleOnline = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    await updateDoc(doc(db, "delivery_profile", user.uid), { online: newStatus });
  };

  const acceptOrder = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { riderId: user.uid, status: "Out for Delivery" });
    setTab("active");
  };

  const openOtpModal = (orderId, otp) => {
    setOtpOrderId(orderId);
    setOtpExpected(otp);
    setOtpInput("");
    setShowOtp(true);
  };

  const confirmDelivery = async () => {
    if (parseInt(otpInput) === otpExpected) {
      await updateDoc(doc(db, "orders", otpOrderId), { status: "Delivered" });
      await updateDoc(doc(db, "delivery_profile", user.uid), {
        earnings: increment(40),
        deliveryCount: increment(1),
      });
      setRiderData((prev) => ({
        ...prev,
        earnings: (prev.earnings || 0) + 40,
        deliveryCount: (prev.deliveryCount || 0) + 1,
      }));
      setShowOtp(false);
      alert("Delivery Success! ₹40 added to wallet.");
      setTab("jobs");
    } else {
      alert("Invalid OTP! Check with customer.");
    }
  };

  // AUTH SCREEN
  if (!user) {
    return (
      <>
        <div className="aurora-bg" />
        <div className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20, position: "relative", zIndex: 1 }}>
          <div className="animate-scale-in" style={s.authCard}>
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ ...s.authLogo, background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.2)" }}>
                <i className="fas fa-motorcycle" style={{ fontSize: 28, color: "#2dd4bf" }} />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 900 }}>Rider Login</h1>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Join the DRĀP Delivery Fleet</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {!isLogin && (
                <>
                  <input className="glass-input" placeholder="Full Name" value={riderName} onChange={(e) => setRiderName(e.target.value)} />
                  <input className="glass-input" placeholder="Vehicle Number (DL 1S AB 1234)" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
                </>
              )}
              <input className="glass-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="glass-input" type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} />
              <button className="btn-primary" onClick={handleAuth} disabled={authLoading}
                style={{ background: "linear-gradient(135deg, #14b8a6, #0d9488)" }}>
                {authLoading ? "..." : isLogin ? "Sign In" : "Register as Rider"}
              </button>
              <button className="btn-ghost" onClick={() => setIsLogin(!isLogin)} style={{ textAlign: "center", color: "#2dd4bf" }}>
                {isLogin ? "Need to Register?" : "Already a Rider?"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // MAIN RIDER APP
  return (
    <>
      <div className="aurora-bg" />
      <div className="page-content" style={{ paddingBottom: 40, position: "relative", zIndex: 1 }}>
        {/* Top Nav */}
        <nav style={s.topNav}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "#2dd4bf", letterSpacing: 2 }}>DRĀP RIDER</h2>
            <p style={{ fontSize: 10, fontWeight: 700, color: isOnline ? "#2dd4bf" : "var(--text-tertiary)", letterSpacing: 2, textTransform: "uppercase" }}>
              {isOnline ? "Online" : "Offline"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Online Toggle */}
            <div onClick={toggleOnline} style={{
              width: 56, height: 32, borderRadius: 16, position: "relative", cursor: "pointer",
              transition: "all 0.3s ease",
              background: isOnline ? "rgba(20,184,166,0.4)" : "rgba(255,255,255,0.06)",
              border: isOnline ? "1px solid rgba(20,184,166,0.4)" : "1px solid rgba(255,255,255,0.08)",
              boxShadow: isOnline ? "0 0 20px rgba(20,184,166,0.3)" : "none",
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 12, position: "absolute", top: 3,
                left: isOnline ? "calc(100% - 28px)" : "4px",
                background: isOnline ? "#2dd4bf" : "rgba(255,255,255,0.3)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: isOnline ? "0 2px 10px rgba(20,184,166,0.4)" : "none",
              }} />
            </div>
            <button className="btn-icon" onClick={() => signOut(auth)}>
              <i className="fas fa-power-off" style={{ fontSize: 14 }} />
            </button>
          </div>
        </nav>

        <main style={{ padding: "0 20px" }}>
          {/* Earnings Card */}
          <div style={s.earningsCard}>
            <div style={s.earningsGlow} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, letterSpacing: 1 }}>TODAY&apos;S EARNINGS</p>
                <h3 style={{ fontSize: 36, fontWeight: 900, marginTop: 6 }}>₹{riderData?.earnings || 0}</h3>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fas fa-wallet" style={{ fontSize: 20 }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 12, fontWeight: 700 }}>
              <span>Deliveries: {riderData?.deliveryCount || 0}</span>
              <span>Rating: 4.9 ★</span>
            </div>
          </div>

          {/* Tab Switcher */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 4, gap: 4, marginTop: 20, marginBottom: 20 }}>
            {["jobs", "active"].map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: tab === t ? "rgba(255,255,255,0.06)" : "transparent",
                color: tab === t ? "var(--text-primary)" : "var(--text-tertiary)",
                border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif",
                transition: "all 0.3s ease",
                boxShadow: tab === t ? "0 2px 10px rgba(0,0,0,0.2)" : "none",
              }}>
                {t === "jobs" ? "Job Board" : "My Route"}
              </button>
            ))}
          </div>

          {/* JOB BOARD */}
          {tab === "jobs" && (
            <div className="animate-fade-in">
              <p className="section-label" style={{ marginBottom: 14 }}>AVAILABLE NEAR YOU</p>
              {!isOnline ? (
                <div style={s.emptyState}>
                  <i className="fas fa-satellite-dish" style={{ fontSize: 36, color: "var(--text-tertiary)", marginBottom: 12, animation: "rotate3d 4s linear infinite" }} />
                  <p style={{ fontWeight: 700, color: "var(--text-tertiary)" }}>Go Online to see orders...</p>
                </div>
              ) : availableOrders.length === 0 ? (
                <div style={s.emptyState}>
                  <i className="fas fa-box-open" style={{ fontSize: 36, color: "var(--text-tertiary)", marginBottom: 12 }} />
                  <p style={{ fontWeight: 700, color: "var(--text-tertiary)" }}>No jobs available yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {availableOrders.map((o) => (
                    <div key={o.id} className="glass-card animate-fade-in-up" style={{ padding: "20px 22px", borderRadius: 24, cursor: "default" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <span className="badge badge-cyan">New Job</span>
                        <span style={{ fontWeight: 800, color: "var(--aurora-emerald)" }}>₹40 Earning</span>
                      </div>
                      <h5 style={{ fontWeight: 700, marginBottom: 4 }}>{o.userName}</h5>
                      <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <i className="fas fa-location-dot" style={{ marginRight: 6 }} />{o.userAddress}
                      </p>
                      <button className="btn-primary" style={{ borderRadius: 14, background: "linear-gradient(135deg, #0f172a, #1e293b)" }} onClick={() => acceptOrder(o.id)}>
                        Accept Delivery
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ACTIVE DELIVERIES */}
          {tab === "active" && (
            <div className="animate-fade-in">
              <p className="section-label" style={{ marginBottom: 14 }}>ONGOING DELIVERY</p>
              {activeDeliveries.length === 0 ? (
                <div style={s.emptyState}>
                  <i className="fas fa-route" style={{ fontSize: 36, color: "var(--text-tertiary)", marginBottom: 12 }} />
                  <p style={{ fontWeight: 700, color: "var(--text-tertiary)" }}>No active deliveries</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {activeDeliveries.map((o) => (
                    <div key={o.id} className="glass-card" style={{ padding: "24px", borderRadius: 28, cursor: "default", border: "1px solid rgba(20,184,166,0.15)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏠</div>
                        <div>
                          <h4 style={{ fontWeight: 700 }}>{o.userName}</h4>
                          <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{o.userPhone}</p>
                        </div>
                      </div>
                      <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,0.03)", marginBottom: 16, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        {o.userAddress}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <a href={`tel:${o.userPhone}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontWeight: 700, fontSize: 14, color: "var(--text-primary)", textDecoration: "none" }}>
                          <i className="fas fa-phone" /> Call
                        </a>
                        <button className="btn-primary" style={{ borderRadius: 16, padding: "14px", background: "linear-gradient(135deg, #14b8a6, #0d9488)" }} onClick={() => openOtpModal(o.id, o.deliveryOtp)}>
                          Complete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* OTP MODAL */}
        {showOtp && (
          <div className="modal-overlay" onClick={() => setShowOtp(false)}>
            <div className="modal-content animate-scale-in" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Verify Handover</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>Ask customer for the 4-digit OTP</p>
              <input
                type="number"
                className="glass-input"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="0000"
                style={{ textAlign: "center", fontSize: 32, fontWeight: 900, letterSpacing: 12, padding: "20px" }}
              />
              <button className="btn-primary" style={{ marginTop: 20, borderRadius: 16, background: "linear-gradient(135deg, #14b8a6, #0d9488)" }} onClick={confirmDelivery}>
                Complete Delivery
              </button>
              <button className="btn-ghost" style={{ width: "100%", marginTop: 8, textAlign: "center", color: "var(--text-tertiary)" }} onClick={() => setShowOtp(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const s = {
  authCard: {
    width: "100%", maxWidth: 420, background: "rgba(20, 20, 50, 0.9)", backdropFilter: "blur(40px)",
    border: "1px solid rgba(255,255,255,0.06)", borderRadius: 36, padding: 40,
    display: "flex", flexDirection: "column", gap: 28,
  },
  authLogo: {
    width: 72, height: 72, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: 8, boxShadow: "0 0 40px rgba(20,184,166,0.2)",
  },
  topNav: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px",
    position: "sticky", top: 0, zIndex: 40,
    background: "rgba(15, 15, 35, 0.8)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  earningsCard: {
    background: "linear-gradient(135deg, #0d9488, #14b8a6, #0f766e)",
    padding: "28px 24px",
    borderRadius: 28,
    color: "white",
    position: "relative",
    overflow: "hidden",
    marginTop: 16,
  },
  earningsGlow: {
    position: "absolute", top: -40, right: -40, width: 140, height: 140,
    borderRadius: "50%", background: "rgba(6, 182, 212, 0.3)", filter: "blur(50px)",
  },
  emptyState: {
    textAlign: "center", padding: 60, display: "flex", flexDirection: "column", alignItems: "center",
  },
};
