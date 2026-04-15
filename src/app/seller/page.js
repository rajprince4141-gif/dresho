"use client";
import { useState, useEffect } from "react";
import { auth, db, IMGBB_API_KEY } from "@/lib/firebase";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, collection, query, where,
  onSnapshot, updateDoc, addDoc, deleteDoc,
} from "firebase/firestore";

export default function SellerPage() {
  const [user, setUser] = useState(null);
  const [sellerData, setSellerData] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState("inventory");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // Product modal
  const [showModal, setShowModal] = useState(false);
  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pStock, setPStock] = useState("");
  const [pCategory, setPCategory] = useState("Men's Wear");
  const [pSizes, setPSizes] = useState(["S", "M", "L", "XL"]);
  const [pImageFile, setPImageFile] = useState(null);
  const [pImagePreview, setPImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "sellers_profile", u.uid));
        if (snap.exists() && snap.data().role === "seller") {
          if (snap.data().approved) {
            setUser(u);
            setSellerData(snap.data());
            setIsPending(false);
          } else {
            setIsPending(true);
          }
        } else { await signOut(auth); alert("Unauthorized Role"); }
      } else { setUser(null); setSellerData(null); setIsPending(false); }
    });
    return () => unsub();
  }, []);

  // Data listeners
  useEffect(() => {
    if (!user) return;
    const pq = query(collection(db, "products"), where("sellerId", "==", user.uid));
    const unsub1 = onSnapshot(pq, (snap) => {
      const p = []; snap.forEach((d) => p.push({ id: d.id, ...d.data() })); setProducts(p);
    });
    const oq = query(collection(db, "orders"), where("sellerId", "==", user.uid));
    const unsub2 = onSnapshot(oq, (snap) => {
      const o = []; let sales = 0; let pending = 0;
      snap.forEach((d) => {
        const order = { id: d.id, ...d.data() }; o.push(order);
        if (order.status === "Delivered") sales += order.total;
        if (order.status === "Pending") pending++;
      });
      setOrders(o); setSalesTotal(sales); setPendingCount(pending);
    });
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const handleAuth = async () => {
    setAuthLoading(true);
    try {
      if (isLogin) { await signInWithEmailAndPassword(auth, email, pass); }
      else {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "sellers_profile", res.user.uid), {
          name: ownerName, storeName, email, role: "seller", approved: false, sales: 0,
        });
      }
    } catch (e) { alert(e.message); }
    setAuthLoading(false);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const toggleSize = (size) => {
    setPSizes((prev) => prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]);
  };

  const saveProduct = async () => {
    if (!pImageFile) return alert("Select an image");
    if (!pName || !pPrice) return alert("Fill name and price");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", pImageFile);
      const imgRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
      const imgData = await imgRes.json();
      await addDoc(collection(db, "products"), {
        sellerId: user.uid, storeName: sellerData.storeName, name: pName,
        price: parseFloat(pPrice), stock: parseInt(pStock) || 0, category: pCategory,
        sizes: pSizes, image: imgData.data.url, createdAt: new Date(),
      });
      setShowModal(false);
      setPName(""); setPPrice(""); setPStock(""); setPImageFile(null); setPImagePreview("");
      setPSizes(["S", "M", "L", "XL"]);
    } catch (e) { alert("Upload failed: " + e.message); }
    setUploading(false);
  };

  const categories = ["Men's Wear", "Women's Wear", "Kids Wear", "Ethnic", "Casual", "Formal"];

  // AUTH SCREEN
  if (!user && !isPending) {
    return (
      <>
        <div className="aurora-bg" />
        <div className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20, position: "relative", zIndex: 1 }}>
          <div className="animate-scale-in" style={s.authCard}>
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ ...s.authLogo, background: "rgba(139, 92, 246, 0.15)", borderColor: "rgba(139, 92, 246, 0.2)" }}>
                <i className="fas fa-store" style={{ fontSize: 28, color: "#a78bfa" }} />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 900 }}>Seller Studio</h1>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Launch your store in seconds</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {!isLogin && (
                <>
                  <input className="glass-input" placeholder="Owner Name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                  <input className="glass-input" placeholder="Store Name (e.g. Fresh Fashion)" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
                </>
              )}
              <input className="glass-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="glass-input" type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} />
              <button className="btn-primary" onClick={handleAuth} disabled={authLoading}>
                {authLoading ? "..." : isLogin ? "Access Dashboard" : "Create Store"}
              </button>
              <button className="btn-ghost" onClick={() => setIsLogin(!isLogin)} style={{ textAlign: "center" }}>
                {isLogin ? "Create Store Account" : "Back to Login"}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // PENDING SCREEN
  if (isPending) {
    return (
      <>
        <div className="aurora-bg" />
        <div className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20, position: "relative", zIndex: 1 }}>
          <div className="animate-scale-in" style={{ ...s.authCard, textAlign: "center" }}>
            <div style={{ fontSize: 64 }}>⏳</div>
            <h2 style={{ fontSize: 24, fontWeight: 900 }}>Application Pending</h2>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
              The DRĀP Admin is reviewing your store. You&apos;ll gain access once approved.
            </p>
            <button className="btn-ghost" onClick={() => signOut(auth)}>Try Different Account</button>
          </div>
        </div>
      </>
    );
  }

  // MAIN DASHBOARD
  return (
    <>
      <div className="aurora-bg" />
      <div className="page-content" style={{ position: "relative", zIndex: 1 }}>
        {/* Top Nav */}
        <nav style={s.topNav} className="glass-panel">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--aurora-8)", letterSpacing: 1 }}>{sellerData?.storeName}</h2>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: 2, textTransform: "uppercase" }}>Seller Partner</p>
          </div>
          <button className="btn-icon" onClick={() => signOut(auth)}>
            <i className="fas fa-power-off" style={{ fontSize: 14 }} />
          </button>
        </nav>

        <main style={{ padding: "16px 20px 40px" }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div className="glass-card" style={{ padding: 22, borderRadius: 22, cursor: "default" }}>
              <p className="section-label">MY SALES</p>
              <h3 style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>₹{salesTotal.toLocaleString("en-IN")}</h3>
            </div>
            <div className="glass-card" style={{ padding: 22, borderRadius: 22, cursor: "default" }}>
              <p className="section-label">LIVE ORDERS</p>
              <h3 style={{ fontSize: 26, fontWeight: 900, marginTop: 6, color: "var(--aurora-7)" }}>{pendingCount}</h3>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            {["inventory", "orders"].map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                ...s.tabBtn,
                ...(tab === t ? s.tabBtnActive : {}),
              }}>
                {t === "inventory" ? "Inventory" : "Orders"}
              </button>
            ))}
          </div>

          {/* INVENTORY */}
          {tab === "inventory" && (
            <div className="animate-fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900 }}>My Products</h3>
                <button className="btn-primary" style={{ width: "auto", padding: "10px 20px", borderRadius: 14, fontSize: 13 }} onClick={() => setShowModal(true)}>
                  <i className="fas fa-plus" style={{ marginRight: 6 }} /> Add Item
                </button>
              </div>
              {products.length === 0 ? (
                <div style={s.emptyState}>
                  <i className="fas fa-shirt" style={{ fontSize: 40, marginBottom: 12, color: "var(--text-tertiary)" }} />
                  <p style={{ fontWeight: 700, color: "var(--text-tertiary)" }}>No products yet. Add your first item!</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {products.map((p) => (
                    <div key={p.id} className="glass-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 22, cursor: "default" }}>
                      <div style={{ width: 56, height: 56, borderRadius: 14, overflow: "hidden", background: "linear-gradient(135deg, #1a1a3e, #2d1b69)", flexShrink: 0 }}>
                        <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</h4>
                        <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Stock: {p.stock} · Sizes: {(p.sizes || []).join(", ")}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 16, fontWeight: 900, color: "var(--aurora-cyan)" }}>₹{p.price}</p>
                        <button onClick={() => { if (confirm("Remove item?")) deleteDoc(doc(db, "products", p.id)); }} style={{ background: "none", border: "none", color: "var(--aurora-rose)", fontSize: 13, cursor: "pointer", marginTop: 4 }}>
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ORDERS */}
          {tab === "orders" && (
            <div className="animate-fade-in">
              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16 }}>Processing Required</h3>
              {orders.filter((o) => o.status === "Pending").length === 0 ? (
                <div style={s.emptyState}>
                  <i className="fas fa-check-circle" style={{ fontSize: 40, marginBottom: 12, color: "var(--text-tertiary)" }} />
                  <p style={{ fontWeight: 700, color: "var(--text-tertiary)" }}>No pending orders</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {orders.filter((o) => o.status === "Pending").map((o) => (
                    <div key={o.id} className="glass-card" style={{ padding: "22px 20px", borderRadius: 24, cursor: "default", border: "1px solid rgba(168, 85, 247, 0.15)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 1 }}>ORDER #{o.trackingId}</span>
                        <span style={{ fontWeight: 800, color: "var(--aurora-7)" }}>₹{o.total}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
                        {o.items?.map((item, i) => (
                          <p key={i} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                            {item.qty}× {item.name} {item.size ? `(${item.size})` : ""}
                          </p>
                        ))}
                      </div>
                      <button className="btn-primary" style={{ borderRadius: 14, fontSize: 14 }} onClick={() => { updateDoc(doc(db, "orders", o.id), { status: "Shipped" }); alert("Order sent to delivery!"); }}>
                        Mark Packed & Handed Over
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ADD PRODUCT MODAL */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
              <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 20 }}>New Product</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Image upload */}
                <div style={s.imageUpload} onClick={() => document.getElementById("pImageInput").click()}>
                  {pImagePreview ? (
                    <img src={pImagePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 20 }} />
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <i className="fas fa-cloud-arrow-up" style={{ fontSize: 32, color: "var(--text-tertiary)", marginBottom: 8 }} />
                      <p style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600 }}>Tap to upload image</p>
                    </div>
                  )}
                </div>
                <input type="file" id="pImageInput" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />

                <input className="glass-input" placeholder="Product Name" value={pName} onChange={(e) => setPName(e.target.value)} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input className="glass-input" type="number" placeholder="Price (₹)" value={pPrice} onChange={(e) => setPPrice(e.target.value)} />
                  <input className="glass-input" type="number" placeholder="Stock Qty" value={pStock} onChange={(e) => setPStock(e.target.value)} />
                </div>

                <select className="glass-input" value={pCategory} onChange={(e) => setPCategory(e.target.value)} style={{ cursor: "pointer" }}>
                  {categories.map((c) => <option key={c} value={c} style={{ background: "#1a1a3e", color: "white" }}>{c}</option>)}
                </select>

                {/* Size toggles */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 10 }}>AVAILABLE SIZES</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                      <button key={size} onClick={() => toggleSize(size)} style={{
                        width: 42, height: 42, borderRadius: 12, fontSize: 12, fontWeight: 700,
                        background: pSizes.includes(size) ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "rgba(255,255,255,0.04)",
                        color: pSizes.includes(size) ? "white" : "var(--text-secondary)",
                        border: pSizes.includes(size) ? "none" : "1px solid rgba(255,255,255,0.08)",
                        cursor: "pointer", transition: "all 0.3s ease", fontFamily: "Inter, sans-serif",
                      }}>
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button className="btn-secondary" style={{ flex: 1, borderRadius: 14 }} onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 1, borderRadius: 14 }} onClick={saveProduct} disabled={uploading}>
                  {uploading ? "Uploading..." : "List Product"}
                </button>
              </div>
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
    marginBottom: 8, boxShadow: "0 0 40px rgba(139, 92, 246, 0.2)", border: "1px solid",
  },
  topNav: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px",
    position: "sticky", top: 0, zIndex: 40, borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  tabBtn: {
    flex: 1, padding: "14px", borderRadius: 16, fontSize: 14, fontWeight: 700,
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.3s ease", fontFamily: "Inter, sans-serif",
  },
  tabBtnActive: {
    background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "white",
    border: "1px solid transparent", boxShadow: "0 4px 20px rgba(124, 58, 237, 0.3)",
  },
  emptyState: { textAlign: "center", padding: 60, display: "flex", flexDirection: "column", alignItems: "center" },
  imageUpload: {
    width: "100%", height: 180, borderRadius: 20, overflow: "hidden",
    background: "rgba(255,255,255,0.03)", border: "2px dashed rgba(255,255,255,0.08)",
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.3s ease",
  },
};
