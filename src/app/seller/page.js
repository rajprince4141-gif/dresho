"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";
import Link from "next/link";
import { auth, db, IMGBB_API_KEY } from "@/lib/firebase";
import {
  RecaptchaVerifier, linkWithPhoneNumber, GoogleAuthProvider, signInWithPopup,
  onAuthStateChanged, signOut,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, collection, query, where,
  onSnapshot, updateDoc, addDoc, deleteDoc,
} from "firebase/firestore";

export default function SellerPage() {
  const [user, setUser] = useState(null);
  const [sellerData, setSellerData] = useState(null);
  const [isPending, setIsPending] = useState(false);

  // Auth flow states
  const [authStep, setAuthStep] = useState("google"); // google, basic, business, documents, operations, phone, otp
  const [authPhone, setAuthPhone] = useState("");
  const [authOtp, setAuthOtp] = useState(["", "", "", "", "", ""]);
  const [confirmResult, setConfirmResult] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Form Fields
  const [ownerName, setOwnerName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [locality, setLocality] = useState("");
  const [shopType, setShopType] = useState("Both");
  const [coordinates, setCoordinates] = useState("");

  const [idProofFile, setIdProofFile] = useState(null);
  const [idProofPreview, setIdProofPreview] = useState("");
  const [shopPhotoFile, setShopPhotoFile] = useState(null);
  const [shopPhotoPreview, setShopPhotoPreview] = useState("");
  const [businessProofFile, setBusinessProofFile] = useState(null);
  const [businessProofPreview, setBusinessProofPreview] = useState("");
  const [bankProofFile, setBankProofFile] = useState(null);
  const [bankProofPreview, setBankProofPreview] = useState("");

  const [openingTime, setOpeningTime] = useState("");
  const [closingTime, setClosingTime] = useState("");
  const [availableDays, setAvailableDays] = useState(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  const [upiId, setUpiId] = useState("");

  const [tab, setTab] = useState("inventory");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  // Advertise state
  const [myBannerRequests, setMyBannerRequests] = useState([]);
  const [advImage, setAdvImage] = useState("");
  const [advTitle, setAdvTitle] = useState("");
  const [advSubtitle, setAdvSubtitle] = useState("");
  const [advTag, setAdvTag] = useState("");
  const [advCta, setAdvCta] = useState("");
  const [advSlot, setAdvSlot] = useState("");
  const [advDuration, setAdvDuration] = useState("7");
  const [advMessage, setAdvMessage] = useState("");
  const [advSubmitting, setAdvSubmitting] = useState(false);

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
            setUser(null);
            setIsPending(true);
          }
        } else {
          // Not a seller yet! Show registration form
          setUser(null);
          setSellerData(null);
          setIsPending(false);
          setAuthStep((prev) => prev === "google" ? "basic" : prev);
        }
      } else {
        setUser(null);
        setSellerData(null);
        setIsPending(false);
        setAuthStep("google");
      }
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
    // My banner requests
    const bq = query(collection(db, "banner_requests"), where("sellerId", "==", user.uid));
    const unsub3 = onSnapshot(bq, (snap) => {
      const r = []; snap.forEach((d) => r.push({ id: d.id, ...d.data() }));
      r.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMyBannerRequests(r);
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user]);

  const submitBannerRequest = async () => {
    if (!advImage.trim()) return alert("Please provide your banner image URL.");
    if (!advSlot) return alert("Please select a preferred slot.");
    setAdvSubmitting(true);
    try {
      await addDoc(collection(db, "banner_requests"), {
        sellerId: user.uid,
        sellerName: sellerData?.storeName || "",
        imageUrl: advImage.trim(),
        title: advTitle.trim(),
        subtitle: advSubtitle.trim(),
        tag: advTag.trim(),
        cta: advCta.trim(),
        slot: parseInt(advSlot),
        durationDays: parseInt(advDuration) || 7,
        message: advMessage.trim(),
        status: "pending",
        createdAt: new Date(),
      });
      alert("Banner request submitted! ✅ Admin will review it shortly.");
      setAdvImage(""); setAdvTitle(""); setAdvSubtitle(""); setAdvTag("");
      setAdvCta(""); setAdvSlot(""); setAdvDuration("7"); setAdvMessage("");
    } catch (e) { alert("Failed: " + e.message); }
    setAdvSubmitting(false);
  };

  const setupRecaptcha = () => {
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }
    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
    return window.recaptchaVerifier;
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        alert('Google sign-in failed: ' + e.message);
      }
    }
    setAuthLoading(false);
  };

  const handleSendOtp = async () => {
    if (authPhone.length !== 10) return alert("Enter a valid 10-digit number.");
    setAuthLoading(true);
    try {
      const fullPhone = "+91" + authPhone;
      const appVerifier = setupRecaptcha();
      const result = await linkWithPhoneNumber(auth.currentUser, fullPhone, appVerifier);
      setConfirmResult(result);
      setAuthStep("otp");
    } catch (e) {
      alert("Error: " + e.message);
      if (window.recaptchaVerifier) { window.recaptchaVerifier.clear(); window.recaptchaVerifier = null; }
    }
    setAuthLoading(false);
  };

  const handleVerifyOtp = async () => {
    const otp = authOtp.join("");
    if (otp.length < 6) return alert("Enter the 6-digit OTP.");
    setAuthLoading(true);
    try {
      await confirmResult.confirm(otp);
      await submitRegistration();
    } catch (e) {
      alert("Invalid OTP or error. Please try again.");
      setAuthOtp(["", "", "", "", "", ""]);
    }
    setAuthLoading(false);
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...authOtp];
    newOtp[index] = value;
    setAuthOtp(newOtp);
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      if (next) next.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !authOtp[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      if (prev) prev.focus();
    }
  };

  const fetchLocation = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported by your browser.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoordinates(`${pos.coords.latitude}, ${pos.coords.longitude}`),
      () => alert("Unable to retrieve location. Please allow location access.")
    );
  };

  const uploadToImgBB = async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.success) throw new Error("Image upload failed.");
    return data.data.url;
  };

  const submitRegistration = async () => {
    if (!agreedTerms) return alert("You must agree to the Seller Terms.");
    // No need to set authLoading here because handleVerifyOtp already did it.
    try {
      let idProofUrl = "";
      let shopPhotoUrl = "";
      let businessProofUrl = "";
      let bankProofUrl = "";
      if (idProofFile) idProofUrl = await uploadToImgBB(idProofFile);
      if (shopPhotoFile) shopPhotoUrl = await uploadToImgBB(shopPhotoFile);

      await setDoc(doc(db, "sellers_profile", auth.currentUser.uid), {
        phone: "+91" + authPhone,
        ownerName, storeName, email,
        shopAddress, locality, shopType, coordinates,
        idProofUrl, shopPhotoUrl,
        openingTime, closingTime, availableDays, upiId,
        role: "seller", approved: false, sales: 0, isShopOpen: false,
        createdAt: new Date(),
      });
      setIsPending(true);
    } catch (e) { alert("Registration failed: " + e.message); }
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
        <div className=""><div className="" /></div>
        <div id="recaptcha-container" />
        <div className="page-content " style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20, position: "relative", zIndex: 1 }}>
          <Link href="/" style={{ position: "fixed", top: 20, left: 20, zIndex: 100, width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "var(--gold)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "all 0.3s ease", display: "none" }}>
            <i className="fas fa-house" style={{ fontSize: 16 }} />
          </Link>
          <div className="animate-scale-in auth-card">
            <div style={{ position: "absolute", top: 16, right: 20, cursor: "pointer", color: "var(--sub)" }}>
              <i className="fas fa-question-circle" style={{ fontSize: 18 }} />
            </div>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h1 style={{ fontFamily: "var(--font-d)", fontSize: 44, fontWeight: 400, color: "var(--navy)", letterSpacing: 4, margin: "0 0 12px 0" }}>
                Dres<span style={{ color: "var(--gold)" }}>h</span>o
              </h1>
              <p style={{ color: "var(--sub)", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>Seller Access</p>
            </div>

            {/* Steps Indicator */}
            {authStep !== "google" && authStep !== "phone" && authStep !== "otp" && (
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: -10 }}>
                {["basic", "business", "documents", "operations"].map((stepItem) => (
                  <div key={stepItem} style={{ width: authStep === stepItem ? 20 : 8, height: 8, borderRadius: 4, background: authStep === stepItem ? "var(--navy)" : "rgba(139,69,19,0.15)", transition: "all 0.3s ease" }} />
                ))}
              </div>
            )}

            {/* ── STEP 1: Google ── */}
            {authStep === "google" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <button onClick={handleGoogleSignIn} disabled={authLoading}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", padding: "14px 20px", border: "1.5px solid var(--border)", background: "var(--white)", cursor: authLoading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, color: "var(--navy)", transition: "border-color 0.2s" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {authLoading ? "Signing in..." : "Sign in with Google"}
                </button>
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <Link href="/" style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, textDecoration: "none" }}>? Back to Customer Login</Link>
                </div>
              </div>
            )}

            {/* ── STEP 2: Basic Info ── */}
            {authStep === "basic" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <input className="glass-input" placeholder="Shop Name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
                <input className="glass-input" placeholder="Owner Name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                <input className="glass-input" type="email" placeholder="Email (Optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="auth-btn-primary" onClick={() => {
                  if (!storeName || !ownerName) return alert("Fill required fields");
                  setAuthStep("business");
                }}>Next</button>
              </div>
            )}

            {/* ── STEP 3: Business Details ── */}
            {authStep === "business" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <input className="glass-input" placeholder="Shop Address" value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} />
                <input className="glass-input" placeholder="Area / Locality" value={locality} onChange={(e) => setLocality(e.target.value)} />
                <select className="glass-input" value={shopType} onChange={(e) => setShopType(e.target.value)} style={{ cursor: "pointer" }}>
                  <option value="Men">Men's</option>
                  <option value="Women">Women's</option>
                  <option value="Both">Both (Unisex)</option>
                </select>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input className="glass-input" placeholder="Location (Lat, Lng)" value={coordinates} readOnly style={{ flex: 1, fontSize: 12 }} />
                  <button className="auth-btn-ghost" onClick={fetchLocation} style={{ padding: "0 16px", height: 52, borderRadius: 14 }}>
                    <i className="fas fa-location-crosshairs" /> Fetch
                  </button>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="auth-btn-ghost" onClick={() => setAuthStep("basic")} style={{ flex: 1 }}>Back</button>
                  <button className="auth-btn-primary" onClick={() => {
                    if (!shopAddress || !locality || !coordinates) return alert("Fill all details including GPS location");
                    setAuthStep("documents");
                  }} style={{ flex: 1 }}>Next</button>
                </div>
              </div>
            )}

            {/* ── STEP 4: Documents ── */}
            {authStep === "documents" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>ID PROOF (Aadhar/PAN)</p>
                    <input type="file" accept="image/*" onChange={(e) => {
                      const f = e.target.files[0]; if (f) { setIdProofFile(f); setIdProofPreview(URL.createObjectURL(f)); }
                    }} style={{ display: "none" }} id="idUpload" />
                    <div style={{ ...s.imageUpload, minHeight: 100, border: "2px dashed var(--border2)", borderRadius: 16, background: "rgba(255,255,255,0.5)", margin: 0 }} onClick={() => document.getElementById("idUpload").click()}>
                      {idProofPreview ? <img src={idProofPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} /> : <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)" }}>Tap to upload</p>}
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>SHOP PHOTO</p>
                    <input type="file" accept="image/*" onChange={(e) => {
                      const f = e.target.files[0]; if (f) { setShopPhotoFile(f); setShopPhotoPreview(URL.createObjectURL(f)); }
                    }} style={{ display: "none" }} id="shopUpload" />
                    <div style={{ ...s.imageUpload, minHeight: 100, border: "2px dashed var(--border2)", borderRadius: 16, background: "rgba(255,255,255,0.5)", margin: 0 }} onClick={() => document.getElementById("shopUpload").click()}>
                      {shopPhotoPreview ? <img src={shopPhotoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} /> : <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)" }}>Tap to upload</p>}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button className="auth-btn-ghost" onClick={() => setAuthStep("business")} style={{ flex: 1 }}>Back</button>
                  <button className="auth-btn-primary" onClick={() => {
                    if (!idProofFile || !shopPhotoFile) return alert("ID Proof and Shop Photo are required to proceed");
                    setAuthStep("operations");
                  }} style={{ flex: 1 }}>Next</button>
                </div>
              </div>
            )}

            {/* ── STEP 5: Operations ── */}
            {authStep === "operations" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>OPEN TIME</p>
                    <input type="time" className="glass-input" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>CLOSE TIME</p>
                    <input type="time" className="glass-input" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} />
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>AVAILABLE DAYS</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                      <div key={day} onClick={() => setAvailableDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: availableDays.includes(day) ? "var(--navy)" : "rgba(0,0,0,0.05)", color: availableDays.includes(day) ? "white" : "#555" }}>
                        {day}
                      </div>
                    ))}
                  </div>
                </div>
                <input className="glass-input" placeholder="UPI ID (For Payments)" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 4 }}>
                  <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--gold)", width: 18, height: 18, cursor: "pointer" }} />
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    I agree to Dresho&apos;s <span onClick={() => setShowTermsModal(true)} style={{ color: "var(--gold)", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Terms & Conditions</span>
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="auth-btn-ghost" onClick={() => setAuthStep("documents")} style={{ flex: 1 }}>Back</button>
                  <button className="auth-btn-primary" onClick={() => {
                    if (!agreedTerms) return alert("You must agree to the Terms & Conditions.");
                    setAuthStep("phone");
                  }} disabled={authLoading} style={{ flex: 1 }}>
                    Continue to Verify Phone
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 6: Phone Verification ── */}
            {authStep === "phone" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>Almost done! Verify your phone number.</p>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--navy)", fontWeight: 500, fontSize: 15 }}>+91</span>
                  <input type="tel" maxLength={10} placeholder="Mobile Number" value={authPhone} onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, ""))} style={{ width: "100%", padding: "18px 16px 18px 52px", background: "#f0f4f8", border: "none", fontSize: 15, color: "var(--navy)", outline: "none" }} autoFocus />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="auth-btn-ghost" onClick={() => setAuthStep("operations")} style={{ flex: 1 }}>Back</button>
                  <button className="auth-btn-primary" style={{ flex: 1 }} onClick={handleSendOtp} disabled={authLoading}>
                    {authLoading ? <i className="fas fa-circle-notch fa-spin" /> : "Send OTP"}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 7: OTP ── */}
            {authStep === "otp" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-tertiary)" }}>Sent to +91 {authPhone}</p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  {authOtp.map((digit, i) => (
                    <input key={i} id={`otp-${i}`} type="tel" maxLength={1} value={digit} onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(i, e)} style={{ width: 44, height: 52, borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", textAlign: "center", fontSize: 20, fontWeight: 700, background: "rgba(255,255,255,0.8)" }} />
                  ))}
                </div>
                <button className="auth-btn-primary" onClick={handleVerifyOtp} disabled={authLoading}>
                  {authLoading ? <i className="fas fa-circle-notch fa-spin" /> : "Verify & Submit Application"}
                </button>
                <button className="auth-btn-ghost" onClick={() => setAuthStep("phone")} style={{ fontSize: 12 }}>Change Number</button>
              </div>
            )}
          </div>
          {showTermsModal && (
            <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowTermsModal(false)}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 24, padding: "28px 24px", maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16, color: "var(--gold)" }}>Seller Terms & Conditions</h3>
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
                <h3 style={{ fontSize: 20, fontWeight: 900, margin: "20px 0 16px", color: "var(--gold)" }}>Privacy Policy</h3>
                <div style={{ fontSize: 13, color: "#444", lineHeight: 1.7 }}>
                  <p><strong>1. Information Collected</strong> — Name, phone number, address, payment details (via secure gateways), app usage data.</p>
                  <p><strong>2. Use of Information</strong> — To process orders, improve user experience, and provide customer support.</p>
                  <p><strong>3. Data Sharing</strong> — Shared with delivery partners & sellers for order fulfillment. Not sold to third parties.</p>
                  <p><strong>4. Security</strong> — We use secure systems to protect user data.</p>
                  <p><strong>5. Consent</strong> — By using Dresho, users agree to this policy.</p>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 900, margin: "20px 0 16px", color: "var(--gold)" }}>Contact & Support</h3>
                <div style={{ fontSize: 13, color: "#444", lineHeight: 1.7 }}>
                  <p>📧 Email: <strong>dresho.business@gmail.com</strong></p>
                  <p>💬 WhatsApp: <strong>+91 9128926837</strong> (10 AM – 8 PM, All Days)</p>
                  <p>📍 Service Area: <strong>Hazaribagh, Jharkhand</strong></p>
                </div>
                <button className="auth-btn-primary" style={{ width: "100%", marginTop: 20 }} onClick={() => { setAgreedTerms(true); setShowTermsModal(false); }}>I Agree</button>
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
        <div className=""><div className="" /></div>
        <div className="page-content " style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20, position: "relative", zIndex: 1 }}>
          <Link href="/" style={{ position: "fixed", top: 20, left: 20, zIndex: 100, width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "var(--gold)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "all 0.3s ease" }}>
            <i className="fas fa-house" style={{ fontSize: 16 }} />
          </Link>
          <div className="animate-scale-in premium-card" style={{ ...s.authCard, textAlign: "center" }}>
            <div style={{ fontSize: 64 }}>⏳</div>
            <h2 style={{ fontSize: 24, fontWeight: 900 }}>Application Pending</h2>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
              The DRĀP Admin is reviewing your store. You&apos;ll gain access once approved.
            </p>
            <button className="auth-btn-ghost" onClick={() => signOut(auth)}>Try Different Account</button>
          </div>
        </div>
      </>
    );
  }

  const toggleShopStatus = async () => {
    try {
      const newStatus = !sellerData.isShopOpen;
      await updateDoc(doc(db, "sellers_profile", user.uid), { isShopOpen: newStatus });
      setSellerData({ ...sellerData, isShopOpen: newStatus });
    } catch (e) {
      alert("Failed to update status: " + e.message);
    }
  };

  // MAIN DASHBOARD
  return (
    <>
      <div className=""><div className="" /></div>
      <div className="page-content " style={{ position: "relative", zIndex: 1 }}>
        {/* Top Nav */}
        <nav style={s.topNav} className="premium-nav">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/" style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(26,13,220,0.06)", border: "1px solid rgba(26,13,220,0.12)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "var(--gold)", transition: "all 0.3s ease", flexShrink: 0 }}>
              <i className="fas fa-house" style={{ fontSize: 13 }} />
            </Link>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--gold)", letterSpacing: 1 }}>{sellerData?.storeName} · Dresho</h2>
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 2, textTransform: "uppercase" }}>Seller Partner</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: sellerData?.isShopOpen ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", padding: "6px 12px", borderRadius: 20 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: sellerData?.isShopOpen ? "#10b981" : "#ef4444", boxShadow: sellerData?.isShopOpen ? "0 0 10px #10b981" : "none" }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: sellerData?.isShopOpen ? "#10b981" : "#ef4444", textTransform: "uppercase" }}>{sellerData?.isShopOpen ? "Open" : "Closed"}</span>
              <label className="switch" style={{ marginLeft: 4 }}>
                <input type="checkbox" checked={!!sellerData?.isShopOpen} onChange={toggleShopStatus} />
                <span className="slider round"></span>
              </label>
            </div>
            <button className="btn-icon" onClick={() => signOut(auth)}>
              <i className="fas fa-power-off" style={{ fontSize: 14 }} />
            </button>
          </div>
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
              <h3 style={{ fontSize: 26, fontWeight: 900, marginTop: 6, color: "var(--gold)" }}>{pendingCount}</h3>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            {["inventory", "orders", "advertise"].map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                ...s.tabBtn,
                ...(tab === t ? s.tabBtnActive : {}),
                flex: "none", padding: "12px 20px",
              }}>
                {t === "inventory" ? "📦 Inventory" : t === "orders" ? "🛒 Orders" : "📢 Advertise"}
              </button>
            ))}
          </div>

          {/* INVENTORY */}
          {tab === "inventory" && (
            <div className="animate-fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900 }}>My Products</h3>
                <button className="auth-btn-primary" style={{ width: "auto", padding: "10px 20px", borderRadius: 14, fontSize: 13 }} onClick={() => setShowModal(true)}>
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
                      <button className="auth-btn-primary" style={{ borderRadius: 14, fontSize: 14 }} onClick={() => { updateDoc(doc(db, "orders", o.id), { status: "Shipped" }); alert("Order sent to delivery!"); }}>
                        Mark Packed & Handed Over
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ADVERTISE TAB */}
          {tab === "advertise" && (
            <div className="animate-fade-in">
              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Advertise on Dresho Homepage</h3>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 20, lineHeight: 1.6 }}>
                Get your banner on Dresho's homepage! Submit your banner details below. Admin will review and activate it for your chosen duration.
              </p>

              {/* Slot Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                {[{ slot: 1, label: "Hero Slide 1", desc: "Full-width hero banner" }, { slot: 2, label: "Hero Slide 2", desc: "Full-width hero banner" }, { slot: 3, label: "Hero Slide 3", desc: "Full-width hero banner" }, { slot: 4, label: "Mini Banner Left", desc: "Half-width promo" }, { slot: 5, label: "Mini Banner Right", desc: "Half-width promo" }].map((item) => (
                  <div key={item.slot} onClick={() => setAdvSlot(String(item.slot))} style={{ padding: "12px 14px", borderRadius: 16, cursor: "pointer", border: advSlot === String(item.slot) ? "2px solid var(--gold)" : "1px solid rgba(0,0,0,0.08)", background: advSlot === String(item.slot) ? "rgba(176,125,58,0.08)" : "rgba(0,0,0,0.02)", transition: "all 0.2s" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: advSlot === String(item.slot) ? "var(--gold)" : "var(--text-tertiary)", letterSpacing: 1 }}>SLOT {item.slot}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>{item.desc}</div>
                  </div>
                ))}
              </div>

              {/* Form */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>BANNER IMAGE URL *</label>
                  <input className="glass-input" placeholder="https://your-banner-image.com/banner.jpg" value={advImage} onChange={(e) => setAdvImage(e.target.value)} />
                  {advImage.trim() && (
                    <div style={{ marginTop: 8, width: "100%", height: 120, borderRadius: 12, overflow: "hidden", background: "#f0ebe3" }}>
                      <img src={advImage} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} />
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>TITLE</label>
                    <input className="glass-input" placeholder="e.g. Big Sale This Weekend" value={advTitle} onChange={(e) => setAdvTitle(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>TAG</label>
                    <input className="glass-input" placeholder="e.g. Women's Special" value={advTag} onChange={(e) => setAdvTag(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>SUBTITLE</label>
                  <input className="glass-input" placeholder="e.g. Up to 50% off on all ethnic wear" value={advSubtitle} onChange={(e) => setAdvSubtitle(e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>BUTTON TEXT (CTA)</label>
                    <input className="glass-input" placeholder="e.g. Shop Now" value={advCta} onChange={(e) => setAdvCta(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>DURATION (DAYS)</label>
                    <input className="glass-input" type="number" min="1" placeholder="e.g. 7" value={advDuration} onChange={(e) => setAdvDuration(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#888", display: "block", marginBottom: 4 }}>MESSAGE TO ADMIN (OPTIONAL)</label>
                  <textarea className="glass-input" placeholder="Any special instructions or deal details..." value={advMessage} onChange={(e) => setAdvMessage(e.target.value)} rows={3} style={{ resize: "vertical", paddingTop: 12 }} />
                </div>
                <div style={{ background: "rgba(176,125,58,0.08)", border: "1px solid rgba(176,125,58,0.2)", borderRadius: 14, padding: "12px 16px", fontSize: 12, color: "#8a6020" }}>
                  💡 <strong>How it works:</strong> Submit your request → Admin reviews it → If approved, your banner goes live on the selected slot for your requested duration. Contact us at dresho.business@gmail.com for pricing.
                </div>
                <button className="auth-btn-primary" onClick={submitBannerRequest} disabled={advSubmitting} style={{ borderRadius: 16 }}>
                  {advSubmitting ? "Submitting..." : "📢 Submit Banner Request"}
                </button>
              </div>

              {/* My Past Requests */}
              {myBannerRequests.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>My Banner Requests</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {myBannerRequests.map((req) => {
                      const statusStyles = { pending: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b" }, approved: { bg: "rgba(16,185,129,0.1)", color: "#10b981" }, rejected: { bg: "rgba(251,113,133,0.1)", color: "#fb7185" } };
                      const sc = statusStyles[req.status] || statusStyles.pending;
                      return (
                        <div key={req.id} className="glass-card" style={{ padding: "16px 18px", borderRadius: 18, cursor: "default" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Slot {req.slot} — {req.title || "(No title)"}</div>
                            <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, textTransform: "uppercase" }}>{req.status}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{req.durationDays} days · {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : ""}</div>
                          {req.status === "rejected" && req.rejectionReason && (
                            <div style={{ fontSize: 11, color: "#fb7185", marginTop: 4 }}>Reason: {req.rejectionReason}</div>
                          )}
                          {req.status === "approved" && (
                            <div style={{ fontSize: 11, color: "#10b981", marginTop: 4 }}>✅ Live for {req.durationDays} days on Slot {req.assignedSlot || req.slot}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
                <button className="auth-btn-ghost" style={{ flex: 1, borderRadius: 14 }} onClick={() => setShowModal(false)}>Cancel</button>
                <button className="auth-btn-primary" style={{ flex: 1, borderRadius: 14 }} onClick={saveProduct} disabled={uploading}>
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
    width: "100%", maxWidth: 460, background: "var(--white)",
    border: "1px solid var(--border)", padding: "48px 40px",
    display: "flex", flexDirection: "column", gap: 24, position: "relative",
    boxShadow: "0 20px 60px rgba(20,33,61,0.08)",
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
    background: "linear-gradient(135deg, var(--navy), var(--gold))", color: "white",
    border: "1px solid transparent", boxShadow: "0 4px 20px rgba(26, 13, 220, 0.3)",
  },
  emptyState: { textAlign: "center", padding: 60, display: "flex", flexDirection: "column", alignItems: "center" },
  imageUpload: {
    width: "100%", height: 180, borderRadius: 20, overflow: "hidden",
    background: "rgba(0,0,0,0.03)", border: "2px dashed rgba(0,0,0,0.15)",
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.3s ease",
  },
};

