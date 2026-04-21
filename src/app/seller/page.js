"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";
import Link from "next/link";
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
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

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
        let snap = await getDoc(doc(db, "sellers_profile", u.uid));
        
        // Race condition fix
        if (!snap.exists()) {
          await new Promise(r => setTimeout(r, 2000));
          snap = await getDoc(doc(db, "sellers_profile", u.uid));
        }

        if (snap.exists() && snap.data().role === "seller") {
          if (snap.data().approved) {
            setUser(u);
            setSellerData(snap.data());
            setIsPending(false);
          } else {
            setIsPending(true);
          }
        } else if (snap.exists()) { 
          await signOut(auth); 
          alert("Unauthorized Role"); 
        }
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
      if (!imgData.success) throw new Error(imgData.error?.message || "Image upload failed. Check your ImgBB API key.");
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
        <div className="luxury-bg"><div className="grain" /></div>
        <div className="page-content lp-light" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20, position: "relative", zIndex: 1 }}>
          <Link href="/" style={{ position: "fixed", top: 20, left: 20, zIndex: 100, width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "var(--blue-vivid)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "all 0.3s ease" }}>
            <i className="fas fa-house" style={{ fontSize: 16 }} />
          </Link>
          <div className="animate-scale-in premium-card" style={s.authCard}>
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ ...s.authLogo, background: "var(--blue-subtle)", borderColor: "var(--border-blue)" }}>
                <i className="fas fa-store" style={{ fontSize: 28, color: "var(--blue-electric)" }} />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 900 }}>Dresho Seller</h1>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Launch your store in seconds ⚡</p>
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
              {!isLogin && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 4 }}>
                  <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--blue-vivid)", width: 18, height: 18, cursor: "pointer" }} />
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    I agree to Dresho&apos;s{" "}
                    <span onClick={() => setShowTermsModal(true)} style={{ color: "var(--blue-vivid)", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Seller Terms & Conditions</span>
                  </p>
                </div>
              )}
              <button className="btn-primary" onClick={handleAuth} disabled={authLoading || (!isLogin && !agreedTerms)} style={{ opacity: (!isLogin && !agreedTerms) ? 0.5 : 1 }}>
                {authLoading ? "..." : isLogin ? "Access Dashboard" : "Create Store"}
              </button>
              <button className="btn-ghost" onClick={() => setIsLogin(!isLogin)} style={{ textAlign: "center" }}>
                {isLogin ? "Create Store Account" : "Back to Login"}
              </button>
            </div>
          </div>
          {showTermsModal && (
            <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowTermsModal(false)}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 24, padding: "28px 24px", maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16, color: "var(--blue-vivid)" }}>Seller Terms & Conditions</h3>
                <div style={{ fontSize: 13, color: "#444", lineHeight: 1.7 }}>
                  <p><strong>1. Onboarding</strong> — Seller agrees to provide accurate business details and product information.</p>
                  <p><strong>2. Product Responsibility</strong> — Seller is responsible for product quality, authenticity, and availability. No counterfeit or illegal products allowed.</p>
                  <p><strong>3. Order Fulfillment</strong> — Orders must be packed and ready within agreed time. Delays may result in penalties.</p>
                  <p><strong>4. Pricing & Commission</strong> — Seller sets product price. Dresho charges a commission (as agreed).</p>
                  <p><strong>5. Returns / Replacement</strong> — Seller must accept replacement requests for defective/wrong items. No refund policy (replacement only).</p>
                  <p><strong>6. Cancellation</strong> — High cancellation rates may lead to suspension.</p>
                  <p><strong>7. Payment Settlement</strong> — Payments will be settled after successful delivery. COD orders will be settled after cash reconciliation.</p>
                  <p><strong>8. Termination</strong> — Dresho reserves the right to suspend sellers for poor performance or violations.</p>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, margin: "20px 0 16px", color: "var(--blue-vivid)" }}>Privacy Policy</h3>
                <div style={{ fontSize: 13, color: "#444", lineHeight: 1.7 }}>
                  <p><strong>1. Information Collected</strong> — Name, phone number, address, payment details (via secure gateways), app usage data.</p>
                  <p><strong>2. Use of Information</strong> — To process orders, improve user experience, and provide customer support.</p>
                  <p><strong>3. Data Sharing</strong> — Shared with delivery partners & sellers for order fulfillment. Not sold to third parties.</p>
                  <p><strong>4. Security</strong> — We use secure systems to protect user data.</p>
                  <p><strong>5. Consent</strong> — By using Dresho, users agree to this policy.</p>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, margin: "20px 0 16px", color: "var(--blue-vivid)" }}>Contact & Support</h3>
                <div style={{ fontSize: 13, color: "#444", lineHeight: 1.7 }}>
                  <p>📧 Email: <strong>dresho.business@gmail.com</strong></p>
                  <p>💬 WhatsApp: <strong>+91 9128926837</strong> (10 AM – 8 PM, All Days)</p>
                  <p>📍 Service Area: <strong>Hazaribagh, Jharkhand</strong></p>
                </div>
                <button className="btn-primary" style={{ width: "100%", marginTop: 20 }} onClick={() => { setAgreedTerms(true); setShowTermsModal(false); }}>I Agree</button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // PENDING SCREEN
  if (isPending) {
    return (
      <>
        <div className="luxury-bg"><div className="grain" /></div>
        <div className="page-content lp-light" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20, position: "relative", zIndex: 1 }}>
          <Link href="/" style={{ position: "fixed", top: 20, left: 20, zIndex: 100, width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "var(--blue-vivid)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "all 0.3s ease" }}>
            <i className="fas fa-house" style={{ fontSize: 16 }} />
          </Link>
          <div className="animate-scale-in premium-card" style={{ ...s.authCard, textAlign: "center" }}>
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
      <div className="luxury-bg"><div className="grain" /></div>
      <div className="page-content lp-light" style={{ position: "relative", zIndex: 1 }}>
        {/* Top Nav */}
        <nav style={s.topNav} className="premium-nav">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/" style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(26,13,220,0.06)", border: "1px solid rgba(26,13,220,0.12)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "var(--blue-vivid)", transition: "all 0.3s ease", flexShrink: 0 }}>
              <i className="fas fa-house" style={{ fontSize: 13 }} />
            </Link>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--blue-vivid)", letterSpacing: 1 }}>{sellerData?.storeName} · Dresho</h2>
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 2, textTransform: "uppercase" }}>Seller Partner</p>
            </div>
          </div>
          <button className="btn-icon" onClick={() => signOut(auth)}>
            <i className="fas fa-power-off" style={{ fontSize: 14 }} />
          </button>
        </nav>

        <main style={{ padding: "16px 20px 40px" }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div className="premium-card" style={{ padding: 22, borderRadius: 22, cursor: "default" }}>
              <p className="section-label">MY SALES</p>
              <h3 style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>₹{salesTotal.toLocaleString("en-IN")}</h3>
            </div>
            <div className="premium-card" style={{ padding: 22, borderRadius: 22, cursor: "default" }}>
              <p className="section-label">LIVE ORDERS</p>
              <h3 style={{ fontSize: 26, fontWeight: 900, marginTop: 6, color: "var(--blue-vivid)" }}>{pendingCount}</h3>
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
                  {categories.map((c) => <option key={c} value={c} style={{ background: "white", color: "#333" }}>{c}</option>)}
                </select>

                {/* Size toggles */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 10 }}>AVAILABLE SIZES</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                      <button key={size} onClick={() => toggleSize(size)} style={{
                        width: 42, height: 42, borderRadius: 12, fontSize: 12, fontWeight: 700,
                        background: pSizes.includes(size) ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "rgba(0,0,0,0.04)",
                        color: pSizes.includes(size) ? "white" : "#555",
                        border: pSizes.includes(size) ? "none" : "1px solid rgba(0,0,0,0.12)",
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
    width: "100%", maxWidth: 420, background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(40px)",
    border: "1px solid rgba(0,0,0,0.06)", borderRadius: 36, padding: 40,
    display: "flex", flexDirection: "column", gap: 28,
  },
  authLogo: {
    width: 72, height: 72, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: 8, boxShadow: "0 0 40px rgba(26, 13, 220, 0.1)", border: "1px solid",
  },
  topNav: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px",
    position: "sticky", top: 0, zIndex: 40, borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  tabBtn: {
    flex: 1, padding: "14px", borderRadius: 16, fontSize: 14, fontWeight: 700,
    background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)",
    color: "#555", cursor: "pointer", transition: "all 0.3s ease", fontFamily: "Inter, sans-serif",
  },
  tabBtnActive: {
    background: "linear-gradient(135deg, var(--blue-electric), var(--blue-vivid))", color: "white",
    border: "1px solid transparent", boxShadow: "0 4px 20px rgba(26, 13, 220, 0.3)",
  },
  emptyState: { textAlign: "center", padding: 60, display: "flex", flexDirection: "column", alignItems: "center" },
  imageUpload: {
    width: "100%", height: 180, borderRadius: 20, overflow: "hidden",
    background: "rgba(0,0,0,0.03)", border: "2px dashed rgba(0,0,0,0.15)",
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.3s ease",
  },
};
