"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot, addDoc, updateDoc, setDoc } from "firebase/firestore";

const SLUG_TO_CATEGORY = {
  "womens-wear": "Women's Wear",
  "mens-wear": "Men's Wear",
  "kids-wear": "Kids Wear",
  "ethnic": "Ethnic",
  "casual": "Casual",
  "formal": "Formal",
  "jackets": "Jackets",
  "shirts": "Shirts",
  "sarees": "Sarees",
  "kurtas": "Kurtas",
  "lehengas": "Lehengas",
  "sneakers": "Sneakers",
  "heels": "Heels",
  "activewear": "Activewear",
  "all": "All",
};

const MOCK_PRODUCTS = [
  { id: "mock1", name: "Royal Blue Embroidered Kurta", price: 2499, category: "Ethnic", storeName: "DRESHO", image: "https://images.unsplash.com/photo-1583391733958-d25e07fac04f?w=600&q=80", sizes: ["S", "M", "L"] },
  { id: "mock2", name: "Banarasi Silk Saree", price: 4999, category: "Ethnic", storeName: "DRESHO", image: "https://images.unsplash.com/photo-1610189013230-6db19c4d92a1?w=600&q=80", sizes: ["Free Size"] },
  { id: "mock3", name: "Premium Leather Jacket", price: 3999, category: "Men's Wear", storeName: "DRESHO", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80", sizes: ["M", "L", "XL"] },
  { id: "mock4", name: "Linen Formal Shirt", price: 1299, category: "Men's Wear", storeName: "DRESHO", image: "https://images.unsplash.com/photo-1596755094514-f87e32f85e2c?w=600&q=80", sizes: ["38", "40", "42"] },
  { id: "mock5", name: "Designer Party Gown", price: 5499, category: "Women's Wear", storeName: "DRESHO", image: "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&q=80", sizes: ["S", "M"] },
  { id: "mock6", name: "Classic White Sneakers", price: 1999, category: "Casual", storeName: "DRESHO", image: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600&q=80", sizes: ["7", "8", "9", "10"] },
  { id: "mock7", name: "Velvet Lehenga Choli", price: 8999, category: "Women's Wear", storeName: "DRESHO", image: "https://images.unsplash.com/photo-1621786032742-0199e52575be?w=600&q=80", sizes: ["S", "M", "L"] },
  { id: "mock8", name: "Kids Party Wear Suit", price: 1499, category: "Kids Wear", storeName: "DRESHO", image: "https://images.unsplash.com/photo-1519241047957-be31d7379a5d?w=600&q=80", sizes: ["4-5Y", "6-7Y"] },
];

export default function CategoryPage() {
  const params = useParams();
  const slug = params?.slug || "all";
  const categoryName = SLUG_TO_CATEGORY[slug] || slug.replace(/-/g, " ");

  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [viewProduct, setViewProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists() && snap.data().role === "user") {
          setUser(u); setUserData(snap.data());
        }
      } else { setUser(null); setUserData(null); }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snap) => {
      let p = [];
      snap.forEach((d) => p.push({ id: d.id, ...d.data() }));
      if (p.length === 0) p = MOCK_PRODUCTS;
      setProducts(p);
    });
    return () => unsub();
  }, []);

  const addToCart = useCallback((product, size) => {
    setCart((prev) => {
      const key = product.id + (size || "");
      const existing = prev.find((i) => i.id + (i.selectedSize || "") === key);
      if (existing) return prev.map((i) => i.id + (i.selectedSize || "") === key ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1, selectedSize: size || "M" }];
    });
    setViewProduct(null);
  }, []);

  const changeQty = (idx, delta) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[idx].qty += delta;
      if (updated[idx].qty <= 0) updated.splice(idx, 1);
      return updated;
    });
  };

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  let filtered = categoryName === "All" ? products : products.filter((p) => p.category === categoryName);
  if (sortBy === "price-asc") filtered = [...filtered].sort((a, b) => a.price - b.price);
  if (sortBy === "price-desc") filtered = [...filtered].sort((a, b) => b.price - a.price);

  return (
    <>
      <style>{`
        *,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
        body{background:#FAF7F2;color:#14213D;font-family:'DM Sans',sans-serif;overflow-x:hidden;}
        a{text-decoration:none;color:inherit;}
        img{display:block;max-width:100%;}
        :root{--navy:#14213D;--gold:#B07D3A;--gold2:#C99A52;--ivory:#FAF7F2;--ivory2:#F3EDE3;--border:#E5DDD1;--sub:#5A6478;--white:#FFFFFF;--red:#DC2626;--green:#16A34A;}

        /* NAV */
        .cat-nav{background:#fff;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:500;box-shadow:0 2px 16px rgba(20,33,61,0.08);}
        .cat-nav-inner{display:flex;align-items:center;gap:16px;padding:14px 24px;flex-wrap:wrap;}
        .nav-logo{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:500;letter-spacing:4px;color:var(--navy);}
        .nav-logo span{color:var(--gold);}
        .nav-back{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--sub);cursor:pointer;padding:6px 12px;border:1px solid var(--border);background:var(--ivory2);transition:all .2s;}
        .nav-back:hover{border-color:var(--gold);color:var(--gold);}
        .nav-spacer{flex:1;}
        .cart-btn{display:flex;align-items:center;gap:8px;padding:8px 18px;background:var(--navy);color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:500;position:relative;transition:background .3s;}
        .cart-btn:hover{background:var(--gold);}
        .cart-badge{background:var(--red);color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;}

        /* HERO STRIP */
        .cat-hero{background:var(--navy);padding:40px 24px;text-align:center;position:relative;overflow:hidden;}
        .cat-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 60% 40%,rgba(176,125,58,.12) 0%,transparent 65%);}
        .cat-hero-eyebrow{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--gold2);margin-bottom:12px;}
        .cat-hero-title{font-family:'Cormorant Garamond',serif;font-size:clamp(32px,6vw,56px);font-weight:300;color:#FAF7F2;line-height:1.1;}
        .cat-hero-title em{color:var(--gold2);font-style:italic;}
        .cat-hero-count{font-size:13px;color:rgba(250,247,242,.45);margin-top:10px;}

        /* FILTERS */
        .filters-bar{display:flex;align-items:center;gap:12px;padding:16px 24px;background:#fff;border-bottom:1px solid var(--border);flex-wrap:wrap;}
        .filter-label{font-size:12px;color:var(--sub);letter-spacing:1px;text-transform:uppercase;flex-shrink:0;}
        .sort-select{padding:8px 14px;border:1px solid var(--border);background:var(--ivory2);font-size:13px;color:var(--navy);cursor:pointer;outline:none;}
        .result-count{margin-left:auto;font-size:13px;color:var(--sub);}

        /* PRODUCT GRID */
        .products-section{padding:32px 24px;}
        .products-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;}
        .product-card{background:#fff;border:1px solid var(--border);cursor:pointer;transition:box-shadow .3s,transform .3s;position:relative;}
        .product-card:hover{box-shadow:0 8px 40px rgba(20,33,61,.12);transform:translateY(-2px);}
        .prod-img-wrap{aspect-ratio:3/4;overflow:hidden;background:var(--ivory2);position:relative;}
        .prod-img-wrap img{width:100%;height:100%;object-fit:cover;transition:transform .6s;}
        .product-card:hover .prod-img-wrap img{transform:scale(1.05);}
        .prod-quick{position:absolute;bottom:0;left:0;right:0;background:var(--navy);color:var(--gold2);font-size:10px;letter-spacing:2px;text-transform:uppercase;padding:10px;text-align:center;transform:translateY(100%);transition:transform .3s;}
        .product-card:hover .prod-quick{transform:translateY(0);}
        .prod-info{padding:12px 14px 16px;}
        .prod-brand{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:4px;}
        .prod-name{font-family:'Cormorant Garamond',serif;font-size:15px;color:var(--navy);line-height:1.3;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
        .prod-price-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .prod-price{font-size:15px;font-weight:600;color:var(--navy);}
        .prod-mrp{font-size:11px;color:#9CA3AF;text-decoration:line-through;}
        .prod-off{font-size:10px;color:var(--red);font-weight:600;}
        .prod-delivery{font-size:11px;color:var(--green);margin-top:6px;display:flex;align-items:center;gap:4px;}
        .green-dot{width:6px;height:6px;background:var(--green);border-radius:50%;}
        .empty-state{text-align:center;padding:80px 24px;color:var(--sub);}
        .empty-icon{font-size:60px;margin-bottom:16px;}

        /* PRODUCT MODAL */
        .modal-bg{position:fixed;inset:0;background:rgba(20,33,61,.55);z-index:700;display:flex;align-items:flex-end;justify-content:center;padding:0;}
        .modal-box{background:#fff;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;padding:28px 24px 40px;border-radius:20px 20px 0 0;animation:slideUp .35s ease;}
        @keyframes slideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
        .modal-img{width:100%;height:260px;object-fit:cover;border-radius:12px;margin-bottom:20px;}
        .modal-brand{font-size:10px;letter-spacing:2px;color:var(--gold);text-transform:uppercase;margin-bottom:6px;}
        .modal-name{font-family:'Cormorant Garamond',serif;font-size:26px;color:var(--navy);margin-bottom:8px;}
        .modal-price{font-size:22px;font-weight:700;color:var(--navy);margin-bottom:20px;}
        .size-label{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--sub);margin-bottom:10px;}
        .size-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;}
        .size-chip{padding:8px 16px;border:1px solid var(--border);background:var(--ivory2);font-size:13px;cursor:pointer;transition:all .2s;}
        .size-chip.active{background:var(--navy);color:#fff;border-color:var(--navy);}
        .btn-add{width:100%;padding:16px;background:var(--navy);color:#fff;border:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:500;cursor:pointer;transition:background .3s;}
        .btn-add:hover{background:var(--gold);}
        .modal-close{position:absolute;top:16px;right:20px;background:none;border:none;font-size:24px;cursor:pointer;color:var(--sub);}

        /* CART PANEL */
        .cart-panel{position:fixed;inset:0;z-index:800;display:flex;}
        .cart-overlay{flex:1;background:rgba(20,33,61,.5);}
        .cart-drawer{width:min(400px,100%);background:#fff;height:100%;overflow-y:auto;padding:28px 24px;display:flex;flex-direction:column;gap:20px;}
        .cart-head{display:flex;justify-content:space-between;align-items:center;}
        .cart-title{font-family:'Cormorant Garamond',serif;font-size:28px;color:var(--navy);}
        .cart-close{background:none;border:none;font-size:24px;cursor:pointer;color:var(--sub);}
        .cart-item{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid var(--border);}
        .cart-item-img{width:72px;height:90px;object-fit:cover;flex-shrink:0;background:var(--ivory2);}
        .cart-item-info{flex:1;}
        .cart-item-name{font-size:14px;font-weight:500;color:var(--navy);margin-bottom:4px;}
        .cart-item-sub{font-size:12px;color:var(--sub);}
        .qty-row{display:flex;align-items:center;gap:12px;margin-top:10px;}
        .qty-btn{width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--ivory2);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;}
        .cart-footer{margin-top:auto;padding-top:20px;border-top:1px solid var(--border);}
        .cart-total-row{display:flex;justify-content:space-between;font-size:15px;color:var(--navy);font-weight:600;margin-bottom:16px;}
        .btn-checkout{width:100%;padding:16px;background:var(--navy);color:#fff;border:none;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:500;cursor:pointer;}

        /* MOBILE NAV BAR */
        .bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid var(--border);z-index:600;padding:8px 0;}
        .bottom-nav-inner{display:flex;justify-content:space-around;}
        .bottom-nav-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 12px;cursor:pointer;border:none;background:none;color:var(--sub);font-size:10px;letter-spacing:.5px;}
        .bottom-nav-btn.active{color:var(--gold);}
        .bottom-nav-icon{font-size:20px;}

        @media(max-width:768px){
          .cat-nav-inner{padding:12px 16px;gap:10px;}
          .filters-bar{padding:12px 16px;}
          .products-section{padding:20px 16px 100px;}
          .products-grid{grid-template-columns:repeat(2,1fr);gap:10px;}
          .bottom-nav{display:block;}
          .cat-hero{padding:28px 16px;}
          .prod-info{padding:10px 10px 12px;}
        }
        @media(max-width:360px){
          .products-grid{grid-template-columns:repeat(2,1fr);gap:8px;}
        }
      `}</style>

      {/* NAVBAR */}
      <nav className="cat-nav">
        <div className="cat-nav-inner">
          <Link href="/shop" className="nav-logo">Dres<span>h</span>o</Link>
          <Link href="/shop" className="nav-back">← Back to Shop</Link>
          <div className="nav-spacer" />
          {userData && (
            <span style={{ fontSize: 13, color: "var(--sub)" }}>Hi, {userData.name?.split(" ")[0]} 👋</span>
          )}
          <button className="cart-btn" onClick={() => setShowCart(true)}>
            🛍 Cart {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div className="cat-hero">
        <div className="cat-hero-eyebrow">Dresho Collection</div>
        <h1 className="cat-hero-title"><em>{categoryName}</em></h1>
        <div className="cat-hero-count">{filtered.length} styles available · 30-min delivery</div>
      </div>

      {/* FILTERS */}
      <div className="filters-bar">
        <span className="filter-label">Sort by</span>
        <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="default">Featured</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
        </select>
        <span className="result-count">{filtered.length} results</span>
      </div>

      {/* PRODUCTS */}
      <div className="products-section">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👗</div>
            <p style={{ fontSize: 18, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>No products in this category yet</p>
            <p style={{ fontSize: 14 }}>Check back soon or explore other categories</p>
            <Link href="/shop" style={{ display: "inline-block", marginTop: 20, padding: "12px 28px", background: "var(--navy)", color: "#fff", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Browse All</Link>
          </div>
        ) : (
          <div className="products-grid">
            {filtered.map((p, i) => (
              <div key={p.id} className="product-card" onClick={() => { setViewProduct(p); setSelectedSize(p.sizes?.[0] || "M"); }}>
                <div className="prod-img-wrap">
                  <img src={p.image} alt={p.name} onError={(e) => { e.target.style.display = "none"; }} />
                  <div className="prod-quick" onClick={(e) => { e.stopPropagation(); addToCart(p, p.sizes?.[0] || "M"); }}>⚡ Quick Add</div>
                </div>
                <div className="prod-info">
                  <div className="prod-brand">{p.storeName || "DRESHO"}</div>
                  <div className="prod-name">{p.name}</div>
                  <div className="prod-price-row">
                    <span className="prod-price">₹{p.price}</span>
                    <span className="prod-mrp">₹{Math.floor(p.price * 1.38)}</span>
                    <span className="prod-off">38% off</span>
                  </div>
                  <div className="prod-delivery"><span className="green-dot" /> 28 min delivery</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PRODUCT MODAL */}
      {viewProduct && (
        <div className="modal-bg" onClick={() => setViewProduct(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
            <button className="modal-close" onClick={() => setViewProduct(null)}>×</button>
            <img src={viewProduct.image} alt={viewProduct.name} className="modal-img" onError={(e) => { e.target.style.display = "none"; }} />
            <div className="modal-brand">{viewProduct.storeName || "DRESHO"}</div>
            <div className="modal-name">{viewProduct.name}</div>
            <div className="modal-price">₹{viewProduct.price} <span style={{ fontSize: 13, fontWeight: 400, color: "#9CA3AF", textDecoration: "line-through" }}>₹{Math.floor(viewProduct.price * 1.38)}</span></div>
            <div className="size-label">Select Size</div>
            <div className="size-row">
              {(viewProduct.sizes || ["S", "M", "L", "XL"]).map((s) => (
                <div key={s} className={`size-chip ${selectedSize === s ? "active" : ""}`} onClick={() => setSelectedSize(s)}>{s}</div>
              ))}
            </div>
            <button className="btn-add" onClick={() => addToCart(viewProduct, selectedSize)}>Add to Cart</button>
          </div>
        </div>
      )}

      {/* CART PANEL */}
      {showCart && (
        <div className="cart-panel">
          <div className="cart-overlay" onClick={() => setShowCart(false)} />
          <div className="cart-drawer">
            <div className="cart-head">
              <div className="cart-title">My Cart</div>
              <button className="cart-close" onClick={() => setShowCart(false)}>×</button>
            </div>
            {cart.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--sub)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🛍</div>
                <p>Your cart is empty</p>
              </div>
            ) : (
              <>
                {cart.map((item, idx) => (
                  <div key={idx} className="cart-item">
                    <img src={item.image} alt="" className="cart-item-img" onError={(e) => { e.target.style.display = "none"; }} />
                    <div className="cart-item-info">
                      <div className="cart-item-name">{item.name}</div>
                      <div className="cart-item-sub">Size: {item.selectedSize} · ₹{item.price}</div>
                      <div className="qty-row">
                        <button className="qty-btn" onClick={() => changeQty(idx, -1)}>−</button>
                        <span style={{ fontWeight: 600 }}>{item.qty}</span>
                        <button className="qty-btn" onClick={() => changeQty(idx, 1)}>+</button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="cart-footer">
                  <div className="cart-total-row"><span>Total</span><span>₹{cartTotal}</span></div>
                  <Link href="/shop"><button className="btn-checkout">Proceed to Checkout</button></Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          <Link href="/shop"><button className="bottom-nav-btn"><span className="bottom-nav-icon">🏠</span>Home</button></Link>
          <button className="bottom-nav-btn active"><span className="bottom-nav-icon">👗</span>Browse</button>
          <button className="bottom-nav-btn" onClick={() => setShowCart(true)}><span className="bottom-nav-icon">🛍{cartCount > 0 && <sup style={{ background: "red", color: "#fff", borderRadius: "50%", padding: "1px 4px", fontSize: 9 }}>{cartCount}</sup>}</span>Cart</button>
          {user ? <button className="bottom-nav-btn" onClick={() => signOut(auth)}><span className="bottom-nav-icon">👤</span>Logout</button> : <Link href="/shop"><button className="bottom-nav-btn"><span className="bottom-nav-icon">👤</span>Login</button></Link>}
        </div>
      </nav>
    </>
  );
}
