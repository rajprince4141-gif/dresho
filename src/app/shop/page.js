"use client";
import { useState, useEffect, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, collection, query, where,
  onSnapshot, addDoc, orderBy,
} from "firebase/firestore";

/* ═══════════════════════════════════════
   DRĀP — Customer Shopping Experience
   ═══════════════════════════════════════ */
export default function ShopPage() {
  // ── Auth State ──
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authName, setAuthName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // ── App State ──
  const [currentSection, setCurrentSection] = useState("home");
  const [products, setProducts] = useState([]);
  const [currentCategory, setCurrentCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [viewProduct, setViewProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState("");

  // ── Checkout ──
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [placing, setPlacing] = useState(false);

  const [loaded, setLoaded] = useState(false);

  // ── Auth Listener ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists() && snap.data().role === "user") {
          setUser(u);
          setUserData(snap.data());
        } else {
          await signOut(auth);
          alert("Unauthorized role for this panel.");
        }
      } else {
        setUser(null);
        setUserData(null);
      }
    });
    setLoaded(true);
    return () => unsub();
  }, []);

  // ── Products Listener ──
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "products"), (snap) => {
      const p = [];
      snap.forEach((d) => p.push({ id: d.id, ...d.data() }));
      setProducts(p);
    });
    return () => unsub();
  }, [user]);

  // ── Orders Listener ──
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "orders"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const o = [];
      snap.forEach((d) => o.push({ id: d.id, ...d.data() }));
      setOrders(o);
    });
    return () => unsub();
  }, [user]);

  // ── Auth handlers ──
  const handleAuth = async () => {
    setAuthLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, authEmail, authPass);
      } else {
        const res = await createUserWithEmailAndPassword(auth, authEmail, authPass);
        await setDoc(doc(db, "users", res.user.uid), {
          name: authName, email: authEmail, role: "user", address: "", phone: "",
        });
      }
    } catch (e) { alert(e.message); }
    setAuthLoading(false);
  };

  // ── Cart helpers ──
  const addToCart = useCallback((product, size) => {
    setCart((prev) => {
      const key = product.id + (size || "");
      const existing = prev.find((item) => item.id + (item.selectedSize || "") === key);
      if (existing) {
        return prev.map((item) =>
          item.id + (item.selectedSize || "") === key
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [...prev, { ...product, qty: 1, selectedSize: size || "M" }];
    });
    setViewProduct(null);
  }, []);

  const changeQty = (index, delta) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[index].qty += delta;
      if (updated[index].qty <= 0) updated.splice(index, 1);
      return updated;
    });
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  // ── Place Order ──
  const placeOrder = async () => {
    if (!checkoutAddress || !checkoutPhone) return alert("Fill all details.");
    setPlacing(true);
    try {
      const otp = Math.floor(1000 + Math.random() * 9000);
      const trackingId = "DR" + Date.now().toString().slice(-6);
      const sellerId = cart[0]?.sellerId || "";
      await addDoc(collection(db, "orders"), {
        userId: user.uid,
        userName: userData.name,
        userAddress: checkoutAddress,
        userPhone: checkoutPhone,
        sellerId,
        items: cart.map((i) => ({
          name: i.name, qty: i.qty, price: i.price, size: i.selectedSize,
        })),
        total: cartTotal,
        status: "Pending",
        trackingId,
        deliveryOtp: otp,
        riderId: null,
        createdAt: new Date(),
      });
      await setDoc(doc(db, "users", user.uid), { address: checkoutAddress, phone: checkoutPhone }, { merge: true });
      setUserData((prev) => ({ ...prev, address: checkoutAddress, phone: checkoutPhone }));
      setCart([]);
      setShowCheckout(false);
      setCurrentSection("orders");
      alert(`Order placed! OTP: ${otp}`);
    } catch (e) { alert("Order failed: " + e.message); }
    setPlacing(false);
  };

  const filteredProducts = currentCategory === "All" ? products : products.filter((p) => p.category === currentCategory);

  const categories = ["All", "Men's Wear", "Women's Wear", "Kids Wear", "Ethnic", "Casual", "Formal"];

  const getStatusColor = (status) => {
    switch (status) {
      case "Delivered": return "#10b981";
      case "Out for Delivery": return "#06b6d4";
      case "Shipped": return "#8b5cf6";
      default: return "#f59e0b";
    }
  };

  // ══════════════════════════
  //   AUTH SCREEN
  // ══════════════════════════
  if (!user) {
    return (
      <>
        <div className="aurora-bg" />
        <div className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20, position: "relative", zIndex: 1 }}>
          <div className={`animate-scale-in`} style={s.authCard}>
            <div style={s.authHeader}>
              <div style={s.authLogo}>
                <i className="fas fa-fire" style={{ fontSize: 28, color: "#c084fc" }} />
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: 2 }}>DRĀP</h1>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13, fontWeight: 500 }}>
                Fashion in 30 Minutes
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {!isLogin && (
                <input
                  className="glass-input"
                  type="text"
                  placeholder="Full Name"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                />
              )}
              <input
                className="glass-input"
                type="email"
                placeholder="Email Address"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
              <input
                className="glass-input"
                type="password"
                placeholder="Password"
                value={authPass}
                onChange={(e) => setAuthPass(e.target.value)}
              />
              <button className="btn-primary" onClick={handleAuth} disabled={authLoading} style={{ marginTop: 4 }}>
                {authLoading ? "..." : isLogin ? "Sign In" : "Create Account"}
              </button>
              <button className="btn-ghost" onClick={() => setIsLogin(!isLogin)} style={{ textAlign: "center" }}>
                {isLogin ? "Create an Account" : "Back to Login"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ══════════════════════════
  //   MAIN APP
  // ══════════════════════════
  return (
    <>
      <div className="aurora-bg" />
      <div className="page-content" style={{ paddingBottom: 90, position: "relative", zIndex: 1 }}>

        {/* ── Top Nav ── */}
        <nav style={s.topNav} className="glass-panel">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--aurora-8)", letterSpacing: 2 }}>DRĀP</h2>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: 2, textTransform: "uppercase" }}>
              Hi, {userData?.name}
            </p>
          </div>
          <button className="btn-icon" onClick={() => signOut(auth)}>
            <i className="fas fa-power-off" style={{ fontSize: 14 }} />
          </button>
        </nav>

        {/* ── HOME ── */}
        {currentSection === "home" && (
          <div style={{ padding: "16px 16px 0" }} className="animate-fade-in">
            {/* Hero Banner */}
            <div style={s.heroBanner}>
              <div style={s.heroBannerGlow} />
              <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, letterSpacing: 1 }}>DELIVERY IN</p>
              <h3 style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>30 Minutes ⚡</h3>
              <p style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>Premium fashion from nearby boutiques</p>
            </div>

            {/* Categories */}
            <div style={{ marginTop: 24 }}>
              <p className="section-label" style={{ paddingLeft: 4 }}>CATEGORIES</p>
              <div className="hide-scrollbar" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, marginTop: 12 }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCurrentCategory(cat)}
                    style={{
                      ...s.catBtn,
                      ...(currentCategory === cat ? s.catBtnActive : {}),
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Grid */}
            <div style={s.productGrid}>
              {filteredProducts.length === 0 ? (
                <p style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: "var(--text-tertiary)", fontWeight: 600 }}>
                  No products found
                </p>
              ) : (
                filteredProducts.map((p, i) => (
                  <div
                    key={p.id}
                    className={`glass-card animate-fade-in-up stagger-${Math.min(i + 1, 8)}`}
                    style={s.productCard}
                    onClick={() => { setViewProduct(p); setSelectedSize(p.sizes?.[0] || "M"); }}
                  >
                    <div style={s.productImage}>
                      <img
                        src={p.image}
                        alt={p.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                      <div style={s.productImageFallback}>
                        <i className="fas fa-shirt" style={{ fontSize: 30, color: "var(--text-tertiary)" }} />
                      </div>
                    </div>
                    <div style={{ padding: "14px 16px 16px" }}>
                      <p style={{ fontSize: 9, fontWeight: 800, color: "var(--aurora-8)", letterSpacing: 2, textTransform: "uppercase" }}>
                        {p.storeName || "DRĀP"}
                      </p>
                      <h4 style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: "var(--text-primary)", lineHeight: 1.3 }}>{p.name}</h4>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: "var(--aurora-cyan)" }}>₹{p.price}</span>
                        <button
                          className="btn-icon"
                          style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", color: "white", fontSize: 12 }}
                          onClick={(e) => { e.stopPropagation(); addToCart(p, p.sizes?.[0] || "M"); }}
                        >
                          <i className="fas fa-plus" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── CART ── */}
        {currentSection === "cart" && (
          <div style={{ padding: 16 }} className="animate-fade-in">
            <h3 style={{ fontSize: 24, fontWeight: 900, marginBottom: 20 }}>My Cart</h3>
            {cart.length === 0 ? (
              <div style={s.emptyState}>
                <i className="fas fa-bag-shopping" style={{ fontSize: 40, marginBottom: 12, color: "var(--text-tertiary)" }} />
                <p style={{ fontWeight: 700, color: "var(--text-tertiary)" }}>Cart is empty</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {cart.map((item, idx) => (
                  <div key={idx} className="glass-card" style={s.cartItem}>
                    <div style={s.cartItemImg}>
                      <img src={item.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} onError={(e) => { e.target.style.display = "none"; }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</h4>
                      <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                        Size: {item.selectedSize} · ₹{item.price} × {item.qty}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button className="btn-icon" style={{ width: 30, height: 30, borderRadius: 8, fontSize: 12 }} onClick={() => changeQty(idx, -1)}>−</button>
                      <span style={{ fontWeight: 800, fontSize: 14, width: 20, textAlign: "center" }}>{item.qty}</span>
                      <button className="btn-icon" style={{ width: 30, height: 30, borderRadius: 8, fontSize: 12, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", color: "white" }} onClick={() => changeQty(idx, 1)}>+</button>
                    </div>
                  </div>
                ))}
                <div className="glass-card" style={{ padding: "24px", borderRadius: 24, marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Total</span>
                    <span style={{ fontSize: 24, fontWeight: 900, color: "var(--aurora-cyan)" }}>₹{cartTotal}</span>
                  </div>
                  <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => { setCheckoutAddress(userData?.address || ""); setCheckoutPhone(userData?.phone || ""); setShowCheckout(true); }}>
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS ── */}
        {currentSection === "orders" && (
          <div style={{ padding: 16 }} className="animate-fade-in">
            <h3 style={{ fontSize: 24, fontWeight: 900, marginBottom: 20 }}>My Orders</h3>
            {orders.length === 0 ? (
              <div style={s.emptyState}>
                <i className="fas fa-box" style={{ fontSize: 40, marginBottom: 12, color: "var(--text-tertiary)" }} />
                <p style={{ fontWeight: 700, color: "var(--text-tertiary)" }}>No orders yet</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {orders.map((o) => (
                  <div key={o.id} className="glass-card animate-fade-in-up" style={{ padding: "20px 22px", borderRadius: 28, cursor: "default" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 1 }}>ORDER #{o.trackingId}</span>
                      <span className="badge" style={{ background: `${getStatusColor(o.status)}15`, color: getStatusColor(o.status), border: `1px solid ${getStatusColor(o.status)}30` }}>
                        {o.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                      {o.items?.map((item, i) => (
                        <p key={i} style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                          {item.qty}× {item.name} {item.size ? `(${item.size})` : ""} — <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>₹{item.price * item.qty}</span>
                        </p>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Total</span>
                      <span style={{ fontSize: 20, fontWeight: 900, color: "var(--aurora-cyan)" }}>₹{o.total}</span>
                    </div>
                    {o.status === "Out for Delivery" && (
                      <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 14, background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.15)", textAlign: "center" }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--aurora-cyan)" }}>
                          Delivery OTP: <span style={{ fontSize: 20 }}>{o.deliveryOtp}</span>
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ACCOUNT ── */}
        {currentSection === "account" && (
          <div style={{ padding: 16 }} className="animate-fade-in">
            <h3 style={{ fontSize: 24, fontWeight: 900, marginBottom: 20 }}>My Account</h3>
            <div className="glass-card" style={{ padding: 24, borderRadius: 28, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 60, height: 60, borderRadius: 18, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fas fa-user" style={{ fontSize: 22, color: "white" }} />
                </div>
                <div>
                  <h4 style={{ fontSize: 18, fontWeight: 800 }}>{userData?.name}</h4>
                  <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{userData?.email}</p>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="glass-card" style={{ padding: "18px 20px", borderRadius: 18, display: "flex", alignItems: "center", gap: 14, cursor: "default" }}>
                <i className="fas fa-location-dot" style={{ color: "var(--aurora-7)", fontSize: 16 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>Delivery Address</p>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{userData?.address || "Not set"}</p>
                </div>
              </div>
              <div className="glass-card" style={{ padding: "18px 20px", borderRadius: 18, display: "flex", alignItems: "center", gap: 14, cursor: "default" }}>
                <i className="fas fa-phone" style={{ color: "var(--aurora-7)", fontSize: 16 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>Phone</p>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{userData?.phone || "Not set"}</p>
                </div>
              </div>
            </div>
            <button className="btn-danger" style={{ width: "100%", marginTop: 20, borderRadius: 18, padding: "16px" }} onClick={() => signOut(auth)}>
              Log Out
            </button>
          </div>
        )}

        {/* ── BOTTOM NAV ── */}
        <nav style={s.bottomNav} className="glass-panel">
          {[
            { id: "home", icon: "fa-house", label: "Home" },
            { id: "cart", icon: "fa-bag-shopping", label: "Cart", badge: cartCount },
            { id: "orders", icon: "fa-box", label: "Orders" },
            { id: "account", icon: "fa-user", label: "Account" },
          ].map((item) => (
            <button key={item.id} onClick={() => setCurrentSection(item.id)} style={{ ...s.navBtn, ...(currentSection === item.id ? s.navBtnActive : {}) }}>
              <div style={{ position: "relative" }}>
                <i className={`fas ${item.icon}`} style={{ fontSize: 18 }} />
                {item.badge > 0 && (
                  <span style={s.navBadge}>{item.badge}</span>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* ── PRODUCT DETAIL MODAL ── */}
        {viewProduct && (
          <div className="modal-overlay" onClick={() => setViewProduct(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <div style={{ height: 220, borderRadius: 20, overflow: "hidden", background: "linear-gradient(135deg, #1a1a3e, #2d1b69)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, position: "relative" }}>
                <img src={viewProduct.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute" }} onError={(e) => { e.target.style.display = "none"; }} />
                <i className="fas fa-shirt" style={{ fontSize: 50, color: "var(--text-tertiary)", opacity: 0.3 }} />
              </div>
              <p style={{ fontSize: 10, fontWeight: 800, color: "var(--aurora-8)", letterSpacing: 2 }}>{viewProduct.storeName || "DRĀP"}</p>
              <h3 style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{viewProduct.name}</h3>
              <p style={{ fontSize: 28, fontWeight: 900, color: "var(--aurora-cyan)", marginTop: 8 }}>₹{viewProduct.price}</p>

              {/* Size Selector */}
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 10 }}>SELECT SIZE</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {(viewProduct.sizes || ["S", "M", "L", "XL"]).map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      style={{
                        width: 44, height: 44, borderRadius: 12, fontSize: 13, fontWeight: 700,
                        background: selectedSize === size ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "rgba(255,255,255,0.04)",
                        color: selectedSize === size ? "white" : "var(--text-secondary)",
                        border: selectedSize === size ? "none" : "1px solid rgba(255,255,255,0.08)",
                        cursor: "pointer", transition: "all 0.3s ease",
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button className="btn-secondary" style={{ flex: 1, borderRadius: 14 }} onClick={() => setViewProduct(null)}>Close</button>
                <button className="btn-primary" style={{ flex: 2, borderRadius: 14 }} onClick={() => addToCart(viewProduct, selectedSize)}>
                  <i className="fas fa-bag-shopping" style={{ marginRight: 8 }} />
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CHECKOUT MODAL ── */}
        {showCheckout && (
          <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 20 }}>Checkout</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input className="glass-input" placeholder="Full Delivery Address" value={checkoutAddress} onChange={(e) => setCheckoutAddress(e.target.value)} />
                <input className="glass-input" type="tel" placeholder="Phone Number" value={checkoutPhone} onChange={(e) => setCheckoutPhone(e.target.value)} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", marginTop: 16 }}>
                <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Total</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: "var(--aurora-cyan)" }}>₹{cartTotal}</span>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                <button className="btn-secondary" style={{ flex: 1, borderRadius: 14 }} onClick={() => setShowCheckout(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1, borderRadius: 14 }} onClick={placeOrder} disabled={placing}>
                  {placing ? "Placing..." : "Place Order"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Styles ── */
const s = {
  authCard: {
    width: "100%",
    maxWidth: 420,
    background: "rgba(20, 20, 50, 0.9)",
    backdropFilter: "blur(40px)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 36,
    padding: 40,
    display: "flex",
    flexDirection: "column",
    gap: 28,
  },
  authHeader: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  authLogo: {
    width: 72,
    height: 72,
    borderRadius: 24,
    background: "rgba(168, 85, 247, 0.15)",
    border: "1px solid rgba(168, 85, 247, 0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    boxShadow: "0 0 40px rgba(168, 85, 247, 0.2)",
  },
  topNav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 20px",
    position: "sticky",
    top: 0,
    zIndex: 40,
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  heroBanner: {
    background: "linear-gradient(135deg, #4c1d95, #7c3aed, #6d28d9)",
    padding: "28px 24px",
    borderRadius: 28,
    color: "white",
    position: "relative",
    overflow: "hidden",
  },
  heroBannerGlow: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: "50%",
    background: "rgba(6, 182, 212, 0.3)",
    filter: "blur(40px)",
  },
  catBtn: {
    flexShrink: 0,
    padding: "10px 20px",
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 700,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    color: "var(--text-secondary)",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontFamily: "Inter, sans-serif",
    whiteSpace: "nowrap",
  },
  catBtnActive: {
    background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
    color: "white",
    border: "1px solid transparent",
    boxShadow: "0 4px 20px rgba(124, 58, 237, 0.3)",
  },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 14,
    marginTop: 20,
  },
  productCard: {
    borderRadius: 22,
    overflow: "hidden",
    cursor: "pointer",
    padding: 0,
  },
  productImage: {
    height: 140,
    background: "linear-gradient(135deg, #1a1a3e, #2d1b69)",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  productImageFallback: {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    inset: 0,
    zIndex: 0,
  },
  cartItem: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    borderRadius: 22,
    cursor: "default",
  },
  cartItemImg: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: "hidden",
    background: "linear-gradient(135deg, #1a1a3e, #2d1b69)",
    flexShrink: 0,
  },
  emptyState: {
    textAlign: "center",
    padding: 60,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    display: "flex",
    justifyContent: "space-around",
    padding: "10px 0 14px",
    borderTop: "1px solid rgba(255,255,255,0.04)",
  },
  navBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "none",
    color: "var(--text-tertiary)",
    cursor: "pointer",
    transition: "all 0.3s ease",
    padding: "6px 16px",
    fontFamily: "Inter, sans-serif",
  },
  navBtnActive: {
    color: "var(--aurora-8)",
    transform: "translateY(-2px)",
  },
  navBadge: {
    position: "absolute",
    top: -6,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "var(--aurora-rose)",
    color: "white",
    fontSize: 9,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
