"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "firebase/auth";
import {
  doc, getDoc, collection, onSnapshot, updateDoc,
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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "admin_roles", user.uid));
        if (snap.exists() && snap.data().role === "admin") {
          setAuthenticated(true);
        } else { await signOut(auth); alert("Unauthorized access"); }
      } else { setAuthenticated(false); }
    });
    return () => unsub();
  }, []);

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

    // Users
    unsubs.push(onSnapshot(collection(db, "users"), (snap) => {
      const u = []; snap.forEach((d) => u.push({ id: d.id, ...d.data() }));
      setUsers(u);
    }));

    return () => unsubs.forEach((u) => u());
  }, [authenticated]);

  const approveSeller = async (id) => {
    await updateDoc(doc(db, "sellers_profile", id), { approved: true });
    alert("Seller Approved!");
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
  ];

  // AUTH SCREEN
  if (!authenticated) {
    return (
      <>
        <div className="aurora-bg" />
        <div className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20, position: "relative", zIndex: 1 }}>
          <div className="animate-scale-in" style={s.authCard}>
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ ...s.authLogo, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <i className="fas fa-shield-halved" style={{ fontSize: 28, color: "#818cf8" }} />
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: 2 }}>DRĀP</h1>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Admin Control Center</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input className="glass-input" type="email" placeholder="Admin Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="glass-input" type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} />
              <button className="btn-primary" onClick={async () => { try { await signInWithEmailAndPassword(auth, email, pass); } catch { alert("Invalid credentials"); } }}
                style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
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
      <div className="aurora-bg" />
      <div className="page-content" style={{ display: "flex", minHeight: "100vh", position: "relative", zIndex: 1 }}>
        {/* SIDEBAR */}
        <nav style={s.sidebar} className="glass-panel">
          <div style={{ padding: "24px 16px 32px", textAlign: "center" }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--aurora-8)", letterSpacing: 3 }}>DRĀP</h2>
            <p className="section-label" style={{ marginTop: 4, marginBottom: 0 }}>ADMIN</p>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, padding: "0 8px" }}>
            {sidebarItems.map((item) => (
              <button key={item.id} onClick={() => setTab(item.id)} style={{
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
        <main style={{ flex: 1, marginLeft: 240, padding: "32px 40px" }}>

          {/* DASHBOARD */}
          {tab === "dash" && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>Platform Overview</h1>
                <p style={{ color: "var(--text-tertiary)", marginTop: 4 }}>Real-time stats across all operations</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
                <span className="badge badge-emerald">
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", marginRight: 6, display: "inline-block" }} />
                  System Online
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 32 }}>
                {[
                  { label: "Total Revenue", value: `₹${stats.revenue.toLocaleString("en-IN")}`, color: "#a855f7", icon: "fa-indian-rupee-sign" },
                  { label: "Active Orders", value: stats.active, color: "#06b6d4", icon: "fa-clock" },
                  { label: "Sellers", value: stats.sellers, color: "#10b981", icon: "fa-store" },
                  { label: "Delivery Fleet", value: stats.fleet, color: "#f59e0b", icon: "fa-motorcycle" },
                ].map((card, i) => (
                  <div key={i} className="glass-card" style={{ padding: 28, borderRadius: 24, cursor: "default" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p className="section-label">{card.label}</p>
                        <h3 style={{ fontSize: 32, fontWeight: 900, marginTop: 8, color: card.color }}>{card.value}</h3>
                      </div>
                      <div style={{ width: 48, height: 48, borderRadius: 16, background: `${card.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <i className={`fas ${card.icon}`} style={{ color: card.color, fontSize: 18 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order breakdown cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {[
                  { label: "Delivered", value: stats.delivered, color: "#10b981" },
                  { label: "Pending", value: stats.pending, color: "#f59e0b" },
                  { label: "Shipped", value: stats.shipped, color: "#8b5cf6" },
                ].map((item, i) => (
                  <div key={i} className="glass-card" style={{ padding: 22, borderRadius: 20, cursor: "default", borderLeft: `3px solid ${item.color}` }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)" }}>{item.label}</p>
                    <h4 style={{ fontSize: 28, fontWeight: 900, color: item.color, marginTop: 6 }}>{item.value}</h4>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SELLERS */}
          {tab === "sellers" && (
            <div className="animate-fade-in">
              <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 24 }}>Seller Approvals</h1>
              <div className="glass-card" style={{ borderRadius: 24, overflow: "hidden", cursor: "default" }}>
                <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      {["Store Name", "Owner", "Status", "Action"].map((h) => (
                        <th key={h} style={{ padding: "18px 24px", fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 1.5, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.map((s) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background 0.2s" }}>
                        <td style={{ padding: "16px 24px", fontWeight: 700 }}>{s.storeName}</td>
                        <td style={{ padding: "16px 24px", color: "var(--text-secondary)" }}>{s.name}</td>
                        <td style={{ padding: "16px 24px" }}>
                          <span className={`badge ${s.approved ? "badge-emerald" : "badge-amber"}`}>
                            {s.approved ? "Approved" : "Pending"}
                          </span>
                        </td>
                        <td style={{ padding: "16px 24px" }}>
                          {!s.approved ? (
                            <button className="btn-primary" style={{ width: "auto", padding: "8px 20px", borderRadius: 10, fontSize: 12, background: "linear-gradient(135deg, #6366f1, #4f46e5)" }} onClick={() => approveSeller(s.id)}>
                              Approve
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--aurora-emerald)" }}>✓ Active</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sellers.length === 0 && (
                  <p style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontWeight: 600 }}>No sellers registered yet</p>
                )}
              </div>
            </div>
          )}

          {/* LIVE ORDERS */}
          {tab === "orders" && (
            <div className="animate-fade-in">
              <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 24 }}>Global Live Orders</h1>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                {orders.length === 0 ? (
                  <p style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontWeight: 600 }}>No orders yet</p>
                ) : (
                  orders.map((o) => {
                    const sty = getStatusStyle(o.status);
                    return (
                      <div key={o.id} className="glass-card" style={{ padding: "22px 24px", borderRadius: 24, cursor: "default" }}>
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
              <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 24 }}>Registered Users</h1>
              <div className="glass-card" style={{ borderRadius: 24, overflow: "hidden", cursor: "default" }}>
                <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      {["Name", "Email", "Phone", "Address"].map((h) => (
                        <th key={h} style={{ padding: "18px 24px", fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 1.5, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "16px 24px", fontWeight: 700 }}>{u.name}</td>
                        <td style={{ padding: "16px 24px", color: "var(--text-secondary)" }}>{u.email}</td>
                        <td style={{ padding: "16px 24px", color: "var(--text-secondary)" }}>{u.phone || "—"}</td>
                        <td style={{ padding: "16px 24px", color: "var(--text-secondary)", fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.address || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <p style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontWeight: 600 }}>No users registered yet</p>
                )}
              </div>
            </div>
          )}

          {/* DELIVERY FLEET */}
          {tab === "fleet" && (
            <div className="animate-fade-in">
              <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 24 }}>Delivery Fleet</h1>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {deliveryAgents.length === 0 ? (
                  <p style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontWeight: 600 }}>No delivery agents yet</p>
                ) : (
                  deliveryAgents.map((d) => (
                    <div key={d.id} className="glass-card" style={{ padding: "22px 24px", borderRadius: 22, cursor: "default" }}>
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
        </main>
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
    marginBottom: 8, boxShadow: "0 0 40px rgba(99,102,241,0.2)",
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
    background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white",
    boxShadow: "0 4px 20px rgba(99, 102, 241, 0.3)",
  },
  sidebarLabel: { fontSize: 14, fontWeight: 600 },
};
