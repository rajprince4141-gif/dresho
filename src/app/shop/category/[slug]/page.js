"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot } from "firebase/firestore";

const SLUG_MAP = {
  "all": "All", "womens-wear": "Women's Wear", "mens-wear": "Men's Wear",
  "kids-wear": "Kids Wear", "ethnic": "Ethnic", "footwear": "Footwear",
  "accessories": "Accessories", "beauty": "Beauty", "jackets": "Jackets",
  "shirts": "Shirts", "sarees": "Sarees", "kurtas": "Kurtas",
  "lehengas": "Lehengas", "trousers": "Trousers",
};

const CATEGORIES = [
  { slug: "all", label: "All Included", icon: "✨" },
  { slug: "womens-wear", label: "Women", icon: "👗" },
  { slug: "mens-wear", label: "Men", icon: "👔" },
  { slug: "ethnic", label: "Ethnic Wear", icon: "🥻" },
  { slug: "footwear", label: "Footwear", icon: "👟" },
  { slug: "kids-wear", label: "Kids", icon: "👶" },
  { slug: "accessories", label: "Accessories", icon: "💍" },
];

const SUB_CATS = [
  { slug: "kurtas", label: "Kurtas", icon: "👗" },
  { slug: "sarees", label: "Sarees", icon: "🥻" },
  { slug: "lehengas", label: "Lehengas", icon: "👘" },
  { slug: "jackets", label: "Jackets", icon: "🧥" },
  { slug: "shirts", label: "Shirts", icon: "👔" },
  { slug: "trousers", label: "Trousers", icon: "👖" },
];

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug || "all";
  const categoryName = SLUG_MAP[slug] || slug.replace(/-/g, " ");

  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [viewProduct, setViewProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists() && snap.data().role === "user") {
            setUser(u); setUserData(snap.data());
          }
        } catch(e) { console.log("Auth check error", e); }
      } else { setUser(null); setUserData(null); }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snap) => {
      let p = [];
      snap.forEach((d) => p.push({ id: d.id, ...d.data() }));
      setProducts(p);
    }, (err) => console.log("Products fetch error", err));
    return () => unsub();
  }, []);

  const addToCart = useCallback((product, size) => {
    if (!user) { alert("Please sign in to add items to cart."); router.push("/shop"); return; }
    setCart((prev) => {
      const key = product.id + (size || "");
      const ex = prev.find((i) => i.id + (i.selectedSize || "") === key);
      if (ex) return prev.map((i) => i.id + (i.selectedSize || "") === key ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1, selectedSize: size || "M" }];
    });
    setViewProduct(null);
  }, [user, router]);

  const changeQty = (idx, delta) => {
    setCart((prev) => { const u = [...prev]; u[idx].qty += delta; if (u[idx].qty <= 0) u.splice(idx, 1); return u; });
  };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  let filtered = categoryName === "All" ? products : products.filter((p) => {
    const cat = (p.category || "").toLowerCase().trim();
    const target = categoryName.toLowerCase().trim();
    return cat === target;
  });
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p => (p.name||"").toLowerCase().includes(q) || (p.category||"").toLowerCase().includes(q));
  }
  if (sortBy === "price-asc") filtered = [...filtered].sort((a, b) => a.price - b.price);
  if (sortBy === "price-desc") filtered = [...filtered].sort((a, b) => b.price - a.price);

  return (
    <>
      <style>{`
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
        body{background:#FAF7F2;color:#14213D;font-family:'DM Sans',sans-serif;overflow-x:hidden;}
        a{text-decoration:none;color:inherit;} img{display:block;max-width:100%;}
        :root{--navy:#14213D;--gold:#B07D3A;--gold2:#C99A52;--ivory:#FAF7F2;--ivory2:#F3EDE3;--border:#E5DDD1;--sub:#5A6478;--white:#FFFFFF;--red:#DC2626;--green:#16A34A;}

        .cp-nav{background:#fff;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:500;box-shadow:0 2px 16px rgba(20,33,61,0.06);}
        .cp-nav-top{display:flex;align-items:center;gap:16px;padding:14px 32px;}
        .cp-logo{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:500;letter-spacing:4px;color:var(--navy);}
        .cp-logo span{color:var(--gold);}
        .cp-search{flex:1;max-width:500px;display:flex;align-items:center;background:var(--ivory2);border:1px solid var(--border);padding:0 16px;gap:8px;transition:border-color .3s;}
        .cp-search:focus-within{border-color:var(--gold);}
        .cp-search input{flex:1;border:none;background:transparent;padding:10px 0;font-size:14px;outline:none;color:var(--navy);font-family:inherit;}
        .cp-search input::placeholder{color:#9CA3AF;}
        .cp-nav-actions{display:flex;align-items:center;gap:16px;margin-left:auto;}
        .cp-back{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--sub);cursor:pointer;padding:8px 14px;border:1px solid var(--border);background:var(--ivory2);transition:all .2s;text-decoration:none;}
        .cp-back:hover{border-color:var(--gold);color:var(--gold);}
        .cp-cart-btn{display:flex;align-items:center;gap:8px;padding:10px 20px;background:var(--navy);color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:500;transition:background .3s;position:relative;}
        .cp-cart-btn:hover{background:var(--gold);}
        .cp-badge{background:var(--red);color:#fff;border-radius:50%;width:20px;height:20px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;}
        .cp-user{font-size:13px;color:var(--sub);}
        .cp-logout{background:transparent;border:1px solid var(--border);padding:8px 14px;font-size:12px;cursor:pointer;color:var(--sub);transition:all .2s;}
        .cp-logout:hover{border-color:var(--red);color:var(--red);}

        .cp-cat-bar{display:flex;align-items:center;gap:0;padding:0 32px;border-top:1px solid var(--border);overflow-x:auto;}
        .cp-cat-bar::-webkit-scrollbar{display:none;}
        .cp-cat-link{display:flex;align-items:center;gap:6px;padding:12px 18px;font-size:13px;font-weight:600;color:var(--sub);cursor:pointer;white-space:nowrap;border-bottom:2.5px solid transparent;transition:all .2s;text-decoration:none;}
        .cp-cat-link:hover,.cp-cat-link.active{color:var(--gold);border-bottom-color:var(--gold);}
        .cp-cat-link span{font-size:14px;}

        .cp-pills{display:flex;gap:12px;padding:16px 32px;overflow-x:auto;background:var(--ivory);}
        .cp-pills::-webkit-scrollbar{display:none;}
        .cp-pill{display:flex;align-items:center;gap:8px;padding:6px 16px 6px 6px;border-radius:40px;border:1px solid var(--border);background:#fff;cursor:pointer;flex-shrink:0;transition:all .25s;text-decoration:none;}
        .cp-pill:hover,.cp-pill.active{border-color:var(--gold);box-shadow:0 2px 8px rgba(176,125,58,0.12);}
        .cp-pill-icon{width:28px;height:28px;border-radius:50%;background:var(--ivory2);display:flex;align-items:center;justify-content:center;font-size:13px;}
        .cp-pill-text{font-size:12px;font-weight:600;color:var(--navy);}

        .cp-toolbar{display:flex;align-items:center;justify-content:space-between;padding:16px 32px;background:#fff;border-bottom:1px solid var(--border);}
        .cp-results{font-size:14px;color:var(--sub);}
        .cp-results strong{color:var(--navy);}
        .cp-sort{padding:8px 14px;border:1px solid var(--border);background:var(--ivory2);font-size:13px;color:var(--navy);cursor:pointer;outline:none;}

        .cp-grid-wrap{padding:32px;background:var(--ivory);}
        .cp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px;}
        .cp-card{background:#fff;border:1px solid var(--border);cursor:pointer;transition:box-shadow .3s,transform .3s;overflow:hidden;position:relative;}
        .cp-card:hover{box-shadow:0 12px 40px rgba(20,33,61,.1);transform:translateY(-3px);}
        .cp-card-img{aspect-ratio:3/4;overflow:hidden;background:var(--ivory2);position:relative;}
        .cp-card-img img{width:100%;height:100%;object-fit:cover;transition:transform .6s;}
        .cp-card:hover .cp-card-img img{transform:scale(1.06);}
        .cp-quick-add{position:absolute;bottom:0;left:0;right:0;background:var(--navy);color:var(--gold2);font-size:10px;letter-spacing:2px;text-transform:uppercase;padding:10px;text-align:center;transform:translateY(100%);transition:transform .3s;cursor:pointer;}
        .cp-card:hover .cp-quick-add{transform:translateY(0);}
        .cp-card-info{padding:14px 16px 18px;}
        .cp-card-brand{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:4px;}
        .cp-card-name{font-family:'Cormorant Garamond',serif;font-size:16px;color:var(--navy);line-height:1.3;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
        .cp-price-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .cp-price{font-size:16px;font-weight:700;color:var(--navy);}
        .cp-mrp{font-size:11px;color:#9CA3AF;text-decoration:line-through;}
        .cp-off{font-size:10px;color:var(--red);font-weight:600;}
        .cp-delivery{font-size:11px;color:var(--green);margin-top:6px;display:flex;align-items:center;gap:4px;}
        .cp-dot{width:6px;height:6px;background:var(--green);border-radius:50%;}

        .cp-empty{text-align:center;padding:100px 24px;color:var(--sub);}
        .cp-empty-icon{font-size:64px;margin-bottom:16px;}

        .cp-modal-bg{position:fixed;inset:0;background:rgba(20,33,61,.55);z-index:700;display:flex;align-items:flex-end;justify-content:center;}
        .cp-modal{background:#fff;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;padding:28px 24px 40px;border-radius:20px 20px 0 0;animation:cpSlide .35s ease;}
        @keyframes cpSlide{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .cp-modal-img{width:100%;height:280px;object-fit:cover;border-radius:12px;margin-bottom:20px;}
        .cp-modal-brand{font-size:10px;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:6px;}
        .cp-modal-name{font-family:'Cormorant Garamond',serif;font-size:26px;color:var(--navy);margin-bottom:8px;}
        .cp-modal-price{font-size:22px;font-weight:700;color:var(--navy);margin-bottom:20px;}
        .cp-size-label{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--sub);margin-bottom:10px;}
        .cp-sizes{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;}
        .cp-size{padding:8px 18px;border:1px solid var(--border);background:var(--ivory2);font-size:13px;cursor:pointer;transition:all .2s;}
        .cp-size.active{background:var(--navy);color:#fff;border-color:var(--navy);}
        .cp-add-btn{width:100%;padding:16px;background:var(--navy);color:#fff;border:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:500;cursor:pointer;transition:background .3s;}
        .cp-add-btn:hover{background:var(--gold);}
        .cp-modal-close{position:absolute;top:16px;right:20px;background:none;border:none;font-size:24px;cursor:pointer;color:var(--sub);}

        .cp-cart-panel{position:fixed;inset:0;z-index:800;display:flex;}
        .cp-cart-overlay{flex:1;background:rgba(20,33,61,.5);}
        .cp-cart-drawer{width:min(420px,100%);background:#fff;height:100%;overflow-y:auto;padding:28px 24px;display:flex;flex-direction:column;gap:16px;}
        .cp-cart-head{display:flex;justify-content:space-between;align-items:center;}
        .cp-cart-title{font-family:'Cormorant Garamond',serif;font-size:28px;color:var(--navy);}
        .cp-cart-close{background:none;border:none;font-size:24px;cursor:pointer;color:var(--sub);}
        .cp-cart-item{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--border);}
        .cp-cart-img{width:72px;height:90px;object-fit:cover;flex-shrink:0;background:var(--ivory2);}
        .cp-cart-info{flex:1;}
        .cp-cart-name{font-size:14px;font-weight:500;color:var(--navy);margin-bottom:4px;}
        .cp-cart-sub{font-size:12px;color:var(--sub);}
        .cp-qty{display:flex;align-items:center;gap:12px;margin-top:10px;}
        .cp-qty-btn{width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--ivory2);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;}
        .cp-cart-footer{margin-top:auto;padding-top:20px;border-top:1px solid var(--border);}
        .cp-cart-total{display:flex;justify-content:space-between;font-size:16px;color:var(--navy);font-weight:600;margin-bottom:16px;}
        .cp-checkout-btn{width:100%;padding:16px;background:var(--navy);color:#fff;border:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:500;cursor:pointer;transition:background .3s;}
        .cp-checkout-btn:hover{background:var(--gold);}

        .cp-bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--border);z-index:600;padding:8px 0;}
        .cp-bottom-inner{display:flex;justify-content:space-around;}
        .cp-bottom-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 12px;cursor:pointer;border:none;background:none;color:var(--sub);font-size:10px;}
        .cp-bottom-btn.active{color:var(--gold);}
        .cp-bottom-icon{font-size:20px;}

        @media(max-width:768px){
          .cp-nav-top{padding:12px 16px;gap:8px;flex-wrap:wrap;}
          .cp-logo{font-size:22px;letter-spacing:2px;}
          .cp-search{order:3;flex:unset;width:100%;max-width:none;}
          .cp-nav-actions{margin-left:auto;gap:8px;}
          .cp-back{display:none;}
          .cp-cart-btn{padding:8px 12px;font-size:12px;}
          .cp-cat-bar{padding:0 12px;}
          .cp-cat-link{padding:10px 12px;font-size:12px;}
          .cp-pills{padding:12px 16px;gap:8px;}
          .cp-toolbar{padding:12px 16px;}
          .cp-grid-wrap{padding:16px 16px 100px;}
          .cp-grid{grid-template-columns:repeat(2,1fr);gap:10px;}
          .cp-card-info{padding:10px 10px 12px;}
          .cp-card-name{font-size:14px;}
          .cp-bottom-nav{display:block;}
          .cp-user,.cp-logout{display:none;}
          .cp-modal{border-radius:16px 16px 0 0;padding:20px 16px 32px;}
          .cp-modal-img{height:220px;}
          .cp-cart-drawer{width:100%;}
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav className="cp-nav">
        <div className="cp-nav-top">
          <Link href="/shop" className="cp-logo">DRES<span>H</span>O</Link>
          <div className="cp-search">
            <span>🔍</span>
            <input placeholder="Search for clothes, brands, occasions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="cp-nav-actions">
            {userData && <span className="cp-user">Hi, {userData.name?.split(" ")[0]} 👋</span>}
            <Link href="/shop" className="cp-back">← Back to Shop</Link>
            <button className="cp-cart-btn" onClick={() => setShowCart(true)}>
              🛍 Cart {cartCount > 0 && <span className="cp-badge">{cartCount}</span>}
            </button>
            {user && <button className="cp-logout" onClick={() => signOut(auth)}>Logout</button>}
          </div>
        </div>
        <div className="cp-cat-bar">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} href={`/shop/category/${c.slug}`} className={`cp-cat-link ${slug === c.slug ? "active" : ""}`}>
              <span>{c.icon}</span> {c.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* ── SUB-CATEGORY PILLS ── */}
      <div className="cp-pills">
        {SUB_CATS.map((c) => (
          <Link key={c.slug} href={`/shop/category/${c.slug}`} className={`cp-pill ${slug === c.slug ? "active" : ""}`}>
            <div className="cp-pill-icon">{c.icon}</div>
            <div className="cp-pill-text">{c.label}</div>
          </Link>
        ))}
      </div>

      {/* ── TOOLBAR ── */}
      <div className="cp-toolbar">
        <div className="cp-results">
          Showing <strong>{filtered.length}</strong> {categoryName === "All" ? "products" : `products in ${categoryName}`}
        </div>
        <select className="cp-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="default">Sort: Featured</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="price-desc">Price: High → Low</option>
        </select>
      </div>

      {/* ── PRODUCT GRID ── */}
      <div className="cp-grid-wrap">
        {filtered.length === 0 ? (
          <div className="cp-empty">
            <div className="cp-empty-icon">👗</div>
            <p style={{ fontSize: 20, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>No products found</p>
            <p style={{ fontSize: 14, marginBottom: 24 }}>Try a different category or check back soon</p>
            <Link href="/shop/category/all" style={{ padding: "12px 32px", background: "var(--navy)", color: "#fff", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Browse All</Link>
          </div>
        ) : (
          <div className="cp-grid">
            {filtered.map((p) => (
              <div key={p.id} className="cp-card" onClick={() => { setViewProduct(p); setSelectedSize(p.sizes?.[0] || "M"); }}>
                <div className="cp-card-img">
                  <img src={p.image} alt={p.name} style={{ opacity: (p.outOfStock || p.stock === 0) ? 0.4 : 1 }} onError={(e) => { e.target.style.display = "none"; }} />
                  {(p.outOfStock || p.stock === 0) && (
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.6)", color: "white", padding: "8px 16px", borderRadius: 8, fontSize: 10, fontWeight: 900, zIndex: 10, letterSpacing: 1, whiteSpace: "nowrap", backdropFilter: "blur(2px)" }}>
                      OUT OF STOCK
                    </div>
                  )}
                  {!(p.outOfStock || p.stock === 0) && (
                    <div className="cp-quick-add" onClick={(e) => { e.stopPropagation(); addToCart(p, p.sizes?.[0] || "M"); }}>⚡ Quick Add</div>
                  )}
                </div>
                <div className="cp-card-info">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div className="cp-card-brand" style={{ marginBottom: 0 }}>{p.storeName || "DRESHO"}</div>
                    {p.stock > 0 && p.stock <= 5 && !p.outOfStock && (
                      <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 800 }}>Only {p.stock} left</span>
                    )}
                  </div>
                  <div className="cp-card-name">{p.name}</div>
                  <div className="cp-price-row">
                    <span className="cp-price">₹{p.price}</span>
                    <span className="cp-mrp">₹{Math.floor(p.price * 1.38)}</span>
                    <span className="cp-off">38% off</span>
                  </div>
                  <div className="cp-delivery"><span className="cp-dot" /> 28 min delivery</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── PRODUCT MODAL ── */}
      {viewProduct && (
        <div className="cp-modal-bg" onClick={() => setViewProduct(null)}>
          <div className="cp-modal" onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
            <button className="cp-modal-close" onClick={() => setViewProduct(null)}>×</button>
            <div style={{ position: "relative" }}>
              <img src={viewProduct.image} alt={viewProduct.name} className="cp-modal-img" style={{ opacity: (viewProduct.outOfStock || viewProduct.stock === 0) ? 0.4 : 1 }} onError={(e) => { e.target.style.display = "none"; }} />
              {(viewProduct.outOfStock || viewProduct.stock === 0) && (
                <div style={{ position: "absolute", top: "45%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.6)", color: "white", padding: "10px 24px", borderRadius: 8, fontSize: 16, fontWeight: 900, zIndex: 10, letterSpacing: 2, backdropFilter: "blur(2px)" }}>
                  OUT OF STOCK
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div className="cp-modal-brand" style={{ marginBottom: 0 }}>{viewProduct.storeName || "DRESHO"}</div>
              {viewProduct.stock > 0 && viewProduct.stock <= 5 && !viewProduct.outOfStock && (
                <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 800 }}>Only {viewProduct.stock} left!</span>
              )}
            </div>
            <div className="cp-modal-name">{viewProduct.name}</div>
            <div className="cp-modal-price">₹{viewProduct.price} <span style={{ fontSize: 13, fontWeight: 400, color: "#9CA3AF", textDecoration: "line-through" }}>₹{Math.floor(viewProduct.price * 1.38)}</span></div>
            <div className="cp-size-label">Select Size</div>
            <div className="cp-sizes">
              {(viewProduct.sizes || ["S", "M", "L", "XL"]).map((s) => (
                <div key={s} className={`cp-size ${selectedSize === s ? "active" : ""}`} onClick={() => setSelectedSize(s)}>{s}</div>
              ))}
            </div>
            <button 
              disabled={viewProduct.outOfStock || viewProduct.stock === 0}
              className="cp-add-btn" 
              style={{ background: (viewProduct.outOfStock || viewProduct.stock === 0) ? "#cbd5e1" : "", cursor: (viewProduct.outOfStock || viewProduct.stock === 0) ? "not-allowed" : "pointer" }}
              onClick={() => addToCart(viewProduct, selectedSize)}>
              {(viewProduct.outOfStock || viewProduct.stock === 0) ? "Unavailable" : "Add to Cart"}
            </button>
          </div>
        </div>
      )}

      {/* ── CART DRAWER ── */}
      {showCart && (
        <div className="cp-cart-panel">
          <div className="cp-cart-overlay" onClick={() => setShowCart(false)} />
          <div className="cp-cart-drawer">
            <div className="cp-cart-head">
              <div className="cp-cart-title">My Cart</div>
              <button className="cp-cart-close" onClick={() => setShowCart(false)}>×</button>
            </div>
            {cart.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--sub)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🛍</div>
                <p>Your cart is empty</p>
              </div>
            ) : (
              <>
                {cart.map((item, idx) => (
                  <div key={idx} className="cp-cart-item">
                    <img src={item.image} alt="" className="cp-cart-img" onError={(e) => { e.target.style.display = "none"; }} />
                    <div className="cp-cart-info">
                      <div className="cp-cart-name">{item.name}</div>
                      <div className="cp-cart-sub">Size: {item.selectedSize} · ₹{item.price}</div>
                      <div className="cp-qty">
                        <button className="cp-qty-btn" onClick={() => changeQty(idx, -1)}>−</button>
                        <span style={{ fontWeight: 600 }}>{item.qty}</span>
                        <button className="cp-qty-btn" onClick={() => changeQty(idx, 1)}>+</button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="cp-cart-footer">
                  <div className="cp-cart-total"><span>Total</span><span>₹{cartTotal}</span></div>
                  <Link href="/shop"><button className="cp-checkout-btn" onClick={() => setShowCart(false)}>Proceed to Checkout →</button></Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="cp-bottom-nav">
        <div className="cp-bottom-inner">
          <Link href="/shop"><button className="cp-bottom-btn"><span className="cp-bottom-icon">🏠</span>Home</button></Link>
          <button className="cp-bottom-btn active"><span className="cp-bottom-icon">👗</span>Browse</button>
          <button className="cp-bottom-btn" onClick={() => setShowCart(true)}><span className="cp-bottom-icon">🛍</span>Cart{cartCount > 0 && <sup style={{ background: "red", color: "#fff", borderRadius: "50%", padding: "1px 4px", fontSize: 9 }}>{cartCount}</sup>}</button>
          {user ? <button className="cp-bottom-btn" onClick={() => signOut(auth)}><span className="cp-bottom-icon">👤</span>Logout</button> : <Link href="/shop"><button className="cp-bottom-btn"><span className="cp-bottom-icon">👤</span>Login</button></Link>}
        </div>
      </nav>
    </>
  );
}
