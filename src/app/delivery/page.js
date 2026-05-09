"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";
import Link from "next/link";
import { auth, db, IMGBB_API_KEY } from "@/lib/firebase";
import {
  GoogleAuthProvider, signInWithPopup,
  onAuthStateChanged, signOut,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, collection, query, where,
  onSnapshot, updateDoc, increment,
} from "firebase/firestore";

export default function DeliveryPage() {
  const [user, setUser] = useState(null);
  const [riderData, setRiderData] = useState(null);
  const [isPending, setIsPending] = useState(false);

  // Auth flow states
  const [authStep, setAuthStep] = useState("welcome"); // welcome, google, phone, details, complete
  const [authPhone, setAuthPhone] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // Rider profile fields
  const [riderName, setRiderName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [vehicleType, setVehicleType] = useState("Bike");
  const [vehicleNumber, setVehicleNumber] = useState("");

  // Document upload states
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [licenseFile, setLicenseFile] = useState(null);
  const [rcFile, setRcFile] = useState(null);
  const [upiOrBank, setUpiOrBank] = useState("");
  const [docUploadLoading, setDocUploadLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const [isOnline, setIsOnline] = useState(false);
  const [tab, setTab] = useState("jobs");
  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [sellersData, setSellersData] = useState({});

  // Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activePaymentOrder, setActivePaymentOrder] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        let snap = await getDoc(doc(db, "delivery_profile", u.uid));
        
        // Race condition fix
        if (!snap.exists()) {
          await new Promise(r => setTimeout(r, 2000));
          snap = await getDoc(doc(db, "delivery_profile", u.uid));
        }

        if (snap.exists() && snap.data().role === "delivery") {
          const lastActive = localStorage.getItem("dreshoLastActive");
          const now = Date.now();
          if (lastActive && now - parseInt(lastActive) > 10 * 60 * 1000) {
            localStorage.setItem("dreshoSavedEmail", u.email || "");
            await signOut(auth);
            localStorage.removeItem("dreshoLastActive");
            setUser(null);
            setRiderData(null);
            setAuthStep("welcome");
            setAuthReady(true);
            alert("Session expired. Please login again.");
            return;
          }
          localStorage.setItem("dreshoLastActive", now.toString());

          setUser(u);
          setRiderData(snap.data());
          setIsOnline(snap.data().online || false);
        } else {
          // Not a delivery agent yet. Keep auth user and continue registration.
          setUser(u);
          setRiderData(null);
          // Let the user start at the welcome page instead of forcing 'phone' step
        }
      } else { 
        setUser(null); 
        setRiderData(null); 
        setAuthStep("welcome"); 
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // ── LIVE LOCATION TRACKING ──
  useEffect(() => {
    let watchId;
    if (isOnline && user && riderData?.approved) {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            try {
              await updateDoc(doc(db, "delivery_profile", user.uid), {
                liveLocation: { lat, lng },
                locationUpdatedAt: Date.now()
              });
            } catch(e) { console.error("Error updating location", e); }
          },
          (err) => { console.warn("Location error:", err); },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
      }
    } else if (!isOnline && user) {
      // Clear live location when offline
      updateDoc(doc(db, "delivery_profile", user.uid), {
        liveLocation: null
      }).catch(e => console.error(e));
    }

    return () => {
      if (watchId && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isOnline, user, riderData?.approved]);

  // Keep session active for Rider while the page is open
  useEffect(() => {
    if (user && riderData?.role === "delivery") {
      // Update the last active timestamp every minute while the app is open
      const interval = setInterval(() => {
        localStorage.setItem("dreshoLastActive", Date.now().toString());
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [user, riderData]);

  // Available jobs
  useEffect(() => {
    if (!user || !riderData?.approved) return;
    const q = query(collection(db, "orders"), where("status", "==", "Shipped"), where("riderId", "==", null));
    const unsub = onSnapshot(q, async (snap) => {
      const o = []; 
      const sellerIds = new Set();
      snap.forEach((d) => {
        o.push({ id: d.id, ...d.data() });
        if (d.data().sellerId) sellerIds.add(d.data().sellerId);
      });
      setAvailableOrders(o);
      
      // Fetch seller data for all unique seller IDs
      if (sellerIds.size > 0) {
        const sellerPromises = Array.from(sellerIds).map(sellerId => 
          getDoc(doc(db, "sellers_profile", sellerId))
        );
        const sellerDocs = await Promise.all(sellerPromises);
        const sellerMap = {};
        sellerDocs.forEach(doc => {
          if (doc.exists()) {
            sellerMap[doc.id] = doc.data();
          }
        });
        setSellersData(sellerMap);
      }
    });
    return () => unsub();
  }, [user, riderData]);

  // Active deliveries
  useEffect(() => {
    if (!user || !riderData?.approved) return;
    const q = query(collection(db, "orders"), where("riderId", "==", user.uid), where("status", "==", "Out for Delivery"));
    const unsub = onSnapshot(q, (snap) => {
      const o = []; snap.forEach((d) => o.push({ id: d.id, ...d.data() }));
      setActiveDeliveries(o);
    });
    return () => unsub();
  }, [user, riderData]);

  const handleGoogleSignIn = async (hintEmail = null) => {
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      if (typeof hintEmail === "string" && hintEmail.includes("@")) {
        provider.setCustomParameters({ login_hint: hintEmail });
      }
      await signInWithPopup(auth, provider);
      setAuthStep("phone");
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        alert('Google sign-in failed: ' + e.message);
      }
    }
    setAuthLoading(false);
  };

  const handlePhoneContinue = () => {
    if (authPhone.length !== 10) return alert("Enter a valid 10-digit mobile number.");
    setAuthStep("details");
  };

  const uploadDocuments = async () => {
    if (!aadhaarFile || !panFile || !licenseFile || !rcFile) return alert("Upload all required documents.");
    if (!upiOrBank) return alert("Enter your UPI or bank details.");
    setDocUploadLoading(true);
    try {
      const uploadFile = async (file) => {
        const formData = new FormData();
        formData.append("image", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || "Document upload failed.");
        return data.url;
      };

      const [aadhaarUrl, panUrl, licenseUrl, rcUrl] = await Promise.all([
        uploadFile(aadhaarFile),
        uploadFile(panFile),
        uploadFile(licenseFile),
        uploadFile(rcFile),
      ]);

      await updateDoc(doc(db, "delivery_profile", user.uid), {
        documents: { aadhaarUrl, panUrl, licenseUrl, rcUrl },
        upiOrBank,
        status: "documents_uploaded",
      });

      setRiderData((prev) => ({
        ...prev,
        documents: { aadhaarUrl, panUrl, licenseUrl, rcUrl },
        upiOrBank,
        status: "documents_uploaded",
      }));

      alert("Documents uploaded successfully. Waiting for admin verification.");
    } catch (e) {
      alert("Document upload failed: " + e.message);
    }
    setDocUploadLoading(false);
  };

  const uploadToImgBB = async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || "Image upload failed.");
    return data.url;
  };

  const submitRegistration = async () => {
    if (authPhone.length !== 10) return alert("Enter a valid 10-digit mobile number.");
    if (!riderName || !city || !address || !vehicleType) return alert("Fill all required fields.");
    setAuthLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Google authentication is required.");

      await setDoc(doc(db, "delivery_profile", currentUser.uid), {
        uid: currentUser.uid,
        phone: "+91" + authPhone,
        name: riderName,
        email: currentUser.email || email,
        photoURL: currentUser.photoURL || "",
        city,
        address,
        vehicleType,
        vehicleNumber,
        role: "delivery",
        approved: false,
        status: "pending",
        online: false,
        earnings: 0,
        deliveryCount: 0,
        documents: {},
        upiOrBank: "",
        createdAt: new Date(),
      });
      setIsPending(true);
      setAuthStep("complete");
    } catch (e) {
      alert("Registration failed: " + e.message);
    }
    setAuthLoading(false);
  };

  const toggleOnline = async () => {
    if (!riderData?.approved) return alert("Your account is not approved yet. Upload documents and wait for admin verification.");
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    
    const updatePayload = { online: newStatus };
    if (newStatus) {
      updatePayload.lastOnlineTimestamp = Date.now();
    } else {
      if (riderData.lastOnlineTimestamp) {
        const sessionTimeMs = Date.now() - riderData.lastOnlineTimestamp;
        const sessionTimeMin = Math.round(sessionTimeMs / 60000);
        updatePayload.totalOnlineMinutes = increment(sessionTimeMin);
        setRiderData((prev) => ({ ...prev, totalOnlineMinutes: (prev.totalOnlineMinutes || 0) + sessionTimeMin }));
      }
    }
    
    await updateDoc(doc(db, "delivery_profile", user.uid), updatePayload);
  };

  const acceptOrder = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { riderId: user.uid, status: "Out for Delivery" });
    setTab("active");
  };

  const openPaymentModal = (order) => {
    setActivePaymentOrder(order);
    setShowScanner(false);
    setShowPaymentModal(true);
  };

  // Distance calculation using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Calculate earnings based on distance
  const calculateDeliveryEarning = (distance) => {
    if (distance <= 2) return 25; // 0-2 km: ₹25
    if (distance <= 5) return 35; // 2-5 km: ₹35
    if (distance <= 8) return 45; // 5-8 km: ₹45
    return 55; // 8+ km: ₹55
  };

  const completeDelivery = async (methodUsed) => {
    if (!activePaymentOrder) return;
    
    // Calculate distance-based earnings
    const sellerData = sellersData[activePaymentOrder.sellerId];
    let deliveryEarning = 40; // Default fallback
    let currentDistance = 0;
    
    if (sellerData?.coordinates && activePaymentOrder.userCoordinates) {
      const [sellLat, sellLon] = sellerData.coordinates.split(",").map(Number);
      const [custLat, custLon] = activePaymentOrder.userCoordinates.split(",").map(Number);
      currentDistance = calculateDistance(sellLat, sellLon, custLat, custLon);
      deliveryEarning = calculateDeliveryEarning(currentDistance);
    }

    await updateDoc(doc(db, "orders", activePaymentOrder.id), { 
      status: "Delivered",
      paymentStatus: methodUsed === "COD_CASH" || methodUsed === "COD_UPI" ? "Paid" : activePaymentOrder.paymentStatus,
      deliveryHandoverMethod: methodUsed,
      actualDeliveryFee: deliveryEarning
    });
    
    await updateDoc(doc(db, "delivery_profile", user.uid), {
      earnings: increment(deliveryEarning),
      deliveryCount: increment(1),
      totalDistance: increment(currentDistance)
    });
    
    setRiderData((prev) => ({
      ...prev,
      earnings: (prev.earnings || 0) + deliveryEarning,
      deliveryCount: (prev.deliveryCount || 0) + 1,
      totalDistance: (prev.totalDistance || 0) + currentDistance
    }));
    
    setShowPaymentModal(false);
    alert(`Delivery Success! ₹${deliveryEarning} added to wallet.`);
    setTab("jobs");
  };

  const formatOnlineTime = (minutes) => {
    if (!minutes) return "0m";
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // AUTH SCREEN
  if (!authReady) {
    return (
      <div className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20 }}>
        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: 24, borderRadius: 18, background: "rgba(255,255,255,0.85)", boxShadow: "0 16px 32px rgba(0,0,0,0.08)" }}>
          Loading rider access...
        </div>
      </div>
    );
  }

  if (!user || !riderData) {
    const isAuthenticated = Boolean(user);

    return (
      <div className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20 }}>
        <div className="auth-onboarding-wrapper" />
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
              <h1 style={{ fontFamily: "var(--font-d)", fontSize: 44, fontWeight: 400, color: "var(--navy)", letterSpacing: 4, marginBottom: 12 }}>
                Dres<span style={{ color: "var(--gold)" }}>h</span>o
              </h1>
              <p style={{ color: "var(--sub)", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>Rider Access</p>
            </div>

            {/* ── STEP 1: Welcome Screen ── */}
            {authStep === "welcome" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ background: "linear-gradient(135deg, #f0f8ff 0%, #e8f4fd 100%)", padding: "32px 24px", borderRadius: 20, textAlign: "center", position: "relative", border: "1.5px solid #c0d8f0" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 18, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 16px", boxShadow: "0 4px 14px rgba(0,0,0,.08)" }}>🛵</div>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#1a7abf", marginBottom: 6 }}>For Delivery Partners</div>
                  <div style={{ fontFamily: "var(--font-d)", fontSize: 28, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>Become a Rider</div>
                  <p style={{ fontSize: 14, color: "var(--sub)", lineHeight: 1.6, marginBottom: 20 }}>Earn on your own time. Deliver fashion orders on your bike or scooter and get paid daily.</p>
                  
                  <div style={{ background: "white", borderRadius: 14, padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #c0d8f0", boxShadow: "0 4px 12px rgba(26,122,191,.08)" }}>
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <div style={{ fontFamily: "var(--font-d)", fontSize: 22, fontWeight: 700, color: "#1a7abf" }}>₹35K+</div>
                      <div style={{ fontSize: 11, color: "var(--sub)", fontWeight: 600 }}>Avg monthly earnings</div>
                    </div>
                    <div style={{ width: 1, height: 40, background: "#e0f0ff" }}></div>
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <div style={{ fontFamily: "var(--font-d)", fontSize: 22, fontWeight: 700, color: "#1a7abf" }}>Daily</div>
                      <div style={{ fontSize: 11, color: "var(--sub)", fontWeight: 600 }}>Payouts via UPI</div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: "0 8px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sub)", marginBottom: 14 }}>✦ Why become a Rider?</div>
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, padding: 0, margin: 0 }}>
                    {[
                      "Work anytime — morning, evening, or weekends",
                      "Free accident insurance coverage while on duty",
                      "Earn extra incentives during peak hours & festivals"
                    ].map((item, i) => (
                      <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "var(--navy)", fontWeight: 600, lineHeight: 1.5 }}>
                        <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#e0f0ff", color: "#1a7abf", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, flexShrink: 0, marginTop: 1 }}>✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {typeof window !== "undefined" && localStorage.getItem("dreshoSavedEmail") && (
                  <button className="auth-btn-primary" style={{ marginTop: 8, background: "#1a7abf", boxShadow: "0 6px 20px rgba(26,122,191,.25)", borderRadius: 16 }} onClick={() => handleGoogleSignIn(localStorage.getItem("dreshoSavedEmail"))}>
                    Continue as {localStorage.getItem("dreshoSavedEmail")}
                  </button>
                )}

                <button className={typeof window !== "undefined" && localStorage.getItem("dreshoSavedEmail") ? "auth-btn-ghost" : "auth-btn-primary"} style={{ marginTop: 8, borderRadius: 16, ...(typeof window !== "undefined" && localStorage.getItem("dreshoSavedEmail") ? { color: "#1a7abf" } : { background: "#1a7abf", boxShadow: "0 6px 20px rgba(26,122,191,.25)" }) }} onClick={() => setAuthStep("google")}>
                  {typeof window !== "undefined" && localStorage.getItem("dreshoSavedEmail") ? "Sign In with a different account" : "Sign-In and Complete Registration"} <i className="fas fa-arrow-right" style={{ marginLeft: 8 }} />
                </button>
                <div style={{ textAlign: "center" }}>
                  <Link href="/partner" style={{ fontSize: 12, color: "var(--sub)", fontWeight: 600, textDecoration: "none" }}>← Back to Partner Program</Link>
                </div>
              </div>
            )}

            {/* ── STEP 2: Google Sign-In ── */}
            {authStep === "google" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6 }}>Sign in with Google. We&apos;ll collect your name and email automatically.</p>
                <button onClick={handleGoogleSignIn} disabled={authLoading}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", padding: "14px 20px", border: "1.5px solid var(--border)", background: "var(--white)", cursor: authLoading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, color: "var(--navy)", transition: "border-color 0.2s" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {authLoading ? "Signing in..." : "Continue with Google"}
                </button>
                <button className="auth-btn-ghost" onClick={() => setAuthStep("welcome")}>← Back</button>
              </div>
            )}

            {authStep === "phone" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center" }}>Enter your phone number to continue as a delivery partner.</p>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--navy)", fontWeight: 500, fontSize: 15 }}>+91</span>
                  <input type="tel" maxLength={10} placeholder="Mobile Number" value={authPhone} onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, ""))} style={{ width: "100%", padding: "18px 16px 18px 52px", background: "#f0f4f8", border: "none", fontSize: 15, color: "var(--navy)", outline: "none" }} autoFocus />
                </div>
                <button className="auth-btn-primary" onClick={() => setAuthStep("details")} disabled={authLoading || authPhone.length !== 10}>
                  Continue
                </button>
                <button className="auth-btn-ghost" onClick={() => setAuthStep("google")}>Back</button>
              </div>
            )}

            {authStep === "details" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ color: "var(--text-muted)", lineHeight: 1.8 }}>
                  Complete your delivery partner profile and submit for approval.
                </p>
                <input className="glass-input" placeholder="Full Name" value={riderName} onChange={(e) => setRiderName(e.target.value)} />
                <input className="glass-input" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                <textarea className="glass-input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} style={{ minHeight: 100, resize: "vertical" }} />
                <input className="glass-input" type="email" placeholder="Email (Optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
                <select className="glass-input" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} style={{ cursor: "pointer" }}>
                  <option value="Bike">🏍️ Bike</option>
                  <option value="Scooter">🛵 Scooter</option>
                  <option value="Bicycle">🚲 Bicycle</option>
                  <option value="Electric Vehicle">⚡ Electric Vehicle</option>
                </select>
                <input className="glass-input" placeholder="Vehicle Number (e.g. DL 1S AB 1234)" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
                <div style={{ display: "flex", gap: 12 }}>
                  <button className="auth-btn-ghost" onClick={() => setAuthStep("phone")} style={{ flex: 1 }}>Back</button>
                  <button className="auth-btn-primary" onClick={submitRegistration} style={{ flex: 1 }} disabled={authLoading}>
                    {authLoading ? "Submitting..." : "Submit registration"}
                  </button>
                </div>
              </div>
            )}

            {authStep === "complete" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center" }}>
                <div style={{ width: 84, height: 84, borderRadius: "50%", background: "rgba(255,215,0,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fas fa-check" style={{ fontSize: 34, color: "var(--gold)" }} />
                </div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--navy)" }}>
                  Registration submitted
                </h2>
                <p style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
                  Your delivery partner profile is pending admin review. Refresh this page after a few minutes to see your status.
                </p>
                <button className="auth-btn-primary" onClick={() => window.location.reload()} style={{ width: "100%" }}>
                  Refresh status
                </button>
                <button className="auth-btn-ghost" onClick={() => signOut(auth)} style={{ width: "100%" }}>
                  Sign out
                </button>
              </div>
            )}



          </div>
          {showTermsModal && (
            <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowTermsModal(false)}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 24, padding: "28px 24px", maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16, color: "var(--gold)" }}>Delivery Partner Agreement</h3>
                <div style={{ fontSize: 13, color: "#444", lineHeight: 1.7 }}>
                  <p><strong>1. Role</strong> — The Rider agrees to pick up and deliver orders assigned via the Dresho platform.</p>
                  <p><strong>2. Independent Contractor</strong> — The Rider is not an employee. No salary, PF, or employment benefits are applicable.</p>
                  <p><strong>3. Payment</strong> — Payment per delivery will be communicated in-app. Payments will be settled weekly. Incentives may be provided based on performance.</p>
                  <p><strong>4. Responsibilities</strong> — Deliver orders within assigned time. Maintain professional behavior. Handle products safely. Collect COD payments (if applicable).</p>
                  <p><strong>5. Cash Handling (COD)</strong> — Rider must deposit collected cash within 24 hours. Any shortage will be recovered from rider.</p>
                  <p><strong>6. Penalties</strong> — Late delivery / misconduct may result in penalties or suspension.</p>
                  <p><strong>7. Termination</strong> — Dresho can suspend or terminate rider access anytime for misconduct or poor performance.</p>
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
      </div>
    );
  }

  // PENDING / NOT APPROVED DASHBOARD
  if (user && riderData && !riderData.approved) {
    return (
      <>
        <div className="page-content" style={{ paddingBottom: 40 }}>
          {/* Top Nav */}
          <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", position: "sticky", top: 0, zIndex: 40, background: "rgba(248,247,244,0.9)", backdropFilter: "blur(40px)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link href="/" style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(26,13,220,0.06)", border: "1px solid rgba(26,13,220,0.12)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "var(--gold)" }}>
                <i className="fas fa-house" style={{ fontSize: 13 }} />
              </Link>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 900, color: "var(--gold)", letterSpacing: 2 }}>DRESHO RIDER</h2>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", letterSpacing: 2, textTransform: "uppercase" }}>Verification Pending</p>
              </div>
            </div>
            <button className="btn-icon" onClick={() => signOut(auth)}><i className="fas fa-power-off" style={{ fontSize: 14 }} /></button>
          </nav>

          <main style={{ padding: "0 20px" }}>
            {/* Status Banner */}
            <div style={{ margin: "20px 0 16px", padding: "20px", borderRadius: 20, background: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "1px solid #f59e0b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className="fas fa-hourglass-half" style={{ fontSize: 20, color: "white" }} />
                </div>
                <div>
                  <p style={{ fontWeight: 800, color: "#92400e", fontSize: 15, marginBottom: 2 }}>Account Verification Pending</p>
                  <p style={{ fontSize: 12, color: "#b45309", lineHeight: 1.5 }}>Upload your documents below to start receiving delivery orders.</p>
                </div>
              </div>
            </div>

            {/* Profile Card */}
            <div style={{ padding: "20px", borderRadius: 20, background: "white", border: "1px solid var(--border)", marginBottom: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 2, marginBottom: 14 }}>YOUR PROFILE</p>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {riderData.photoURL ? <img src={riderData.photoURL} alt="" style={{ width: 52, height: 52, borderRadius: 16, objectFit: "cover" }} /> : <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--gold)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 22, fontWeight: 700 }}>{(riderData.name || "R")[0]}</div>}
                <div>
                  <p style={{ fontWeight: 800, fontSize: 16, color: "var(--navy)" }}>{riderData.name}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{riderData.phone} &nbsp;·&nbsp; {riderData.vehicleType}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{riderData.city}</p>
                </div>
              </div>
            </div>

            {/* Document Upload Section */}
            <div style={{ padding: "20px", borderRadius: 20, background: "white", border: "1px solid var(--border)", marginBottom: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 2, marginBottom: 16 }}>UPLOAD DOCUMENTS</p>
              
              {riderData.documents && Object.keys(riderData.documents).length > 0 ? (
                <div style={{ padding: "16px", borderRadius: 14, background: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", gap: 12 }}>
                  <i className="fas fa-check-circle" style={{ fontSize: 22, color: "#10b981" }} />
                  <div>
                    <p style={{ fontWeight: 700, color: "#065f46", fontSize: 14 }}>Documents Uploaded</p>
                    <p style={{ fontSize: 12, color: "#047857" }}>Waiting for admin review. You&apos;ll be notified once approved.</p>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 4 }}>Upload clear photos of the following documents. All 4 are required.</p>
                  {[
                    { label: "Aadhaar Card", state: aadhaarFile, setter: setAadhaarFile },
                    { label: "PAN Card", state: panFile, setter: setPanFile },
                    { label: "Driving License", state: licenseFile, setter: setLicenseFile },
                    { label: "Vehicle RC", state: rcFile, setter: setRcFile },
                  ].map((doc, i) => (
                    <div key={doc.label}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", marginBottom: 6 }}>{doc.label}</p>
                      <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, border: doc.state ? "2px solid var(--gold)" : "2px dashed rgba(0,0,0,0.12)", cursor: "pointer", background: doc.state ? "rgba(176,125,58,0.06)" : "#f8f9fa" }}>
                        <i className={`fas ${doc.state ? "fa-check-circle" : "fa-upload"}`} style={{ color: doc.state ? "var(--gold)" : "var(--text-muted)", fontSize: 16 }} />
                        <span style={{ fontSize: 12, color: doc.state ? "var(--navy)" : "var(--text-muted)", fontWeight: 600 }}>{doc.state ? doc.state.name : `Tap to upload ${doc.label}`}</span>
                        <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) doc.setter(e.target.files[0]); }} />
                      </label>
                    </div>
                  ))}
                  <input className="glass-input" placeholder="UPI ID or Bank Account Details" value={upiOrBank} onChange={(e) => setUpiOrBank(e.target.value)} style={{ marginTop: 4 }} />
                  <button className="auth-btn-primary" onClick={uploadDocuments} disabled={docUploadLoading} style={{ marginTop: 4 }}>
                    {docUploadLoading ? <><i className="fas fa-circle-notch fa-spin" style={{ marginRight: 8 }} />Uploading...</> : <><i className="fas fa-cloud-upload-alt" style={{ marginRight: 8 }} />Submit Documents</>}
                  </button>
                </div>
              )}
            </div>

            {/* Locked Sections */}
            <div style={{ padding: "20px", borderRadius: 20, background: "#f8f9fa", border: "1px solid var(--border)", marginBottom: 16, opacity: 0.6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <i className="fas fa-lock" style={{ fontSize: 18, color: "var(--text-muted)" }} />
                <div>
                  <p style={{ fontWeight: 700, color: "var(--text-muted)", fontSize: 14 }}>Job Board — Locked</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Available after admin approval</p>
                </div>
              </div>
            </div>

            {/* Support Section */}
            <div style={{ padding: "20px", borderRadius: 20, background: "white", border: "1px solid var(--border)", marginBottom: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 2, marginBottom: 14 }}>SUPPORT</p>
              <a href="https://wa.me/919128926837" target="_blank" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", padding: "14px", borderRadius: 14, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <i className="fab fa-whatsapp" style={{ fontSize: 22, color: "#25d366" }} />
                <div>
                  <p style={{ fontWeight: 700, color: "#065f46", fontSize: 13 }}>WhatsApp Support</p>
                  <p style={{ fontSize: 11, color: "#047857" }}>+91 9128926837 — 10 AM to 8 PM</p>
                </div>
              </a>
            </div>
          </main>
        </div>
      </>
    );
  }

  // MAIN RIDER APP (Approved only)
  // MAIN RIDER APP (Approved only)
  return (
    <>
      <style>{`
        body { background-color: #f8fafc; }
        .rider-app { background-color: #f8fafc; color: #0f172a; min-height: 100vh; font-family: 'Inter', sans-serif; padding-bottom: 90px; }
        .rider-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 20px 10px; }
        .rider-greeting h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; color: #0f172a; }
        .rider-greeting p { font-size: 13px; color: #64748b; }
        .rider-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); position: relative; display: flex; align-items: center; justify-content: center; background: #e2e8f0; font-size: 18px; color: #0f172a; cursor: pointer; }
        .online-dot { width: 12px; height: 12px; border-radius: 50%; position: absolute; bottom: -2px; right: -2px; border: 2px solid #ffffff; }
        .online-dot.on { background-color: #22c55e; }
        .online-dot.off { background-color: #ef4444; }
        
        .earnings-card { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); border-radius: 20px; padding: 24px; margin: 10px 20px 24px; position: relative; overflow: hidden; box-shadow: 0 12px 24px rgba(15,23,42,0.15); }
        .earnings-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .earnings-title { font-size: 13px; color: rgba(255,255,255,0.8); font-weight: 500; margin-bottom: 8px; }
        .earnings-amount { font-size: 38px; font-weight: 800; display: flex; align-items: baseline; gap: 12px; margin-bottom: 24px; color: #ffffff; }
        .earnings-trend { font-size: 12px; color: #4ade80; font-weight: 600; display: flex; align-items: center; gap: 4px; }
        .earnings-icon { width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 18px; color: white; }
        .earnings-stats { display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 16px; }
        .stat-item { text-align: center; }
        .stat-val { font-size: 16px; font-weight: 700; margin-bottom: 4px; color: #ffffff; }
        .stat-lbl { font-size: 11px; color: rgba(255,255,255,0.7); }

        .incentive-banner { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 16px; padding: 16px; margin: 0 20px 24px; display: flex; align-items: center; justify-content: space-between; }
        .ib-text p { font-size: 13px; font-weight: 700; color: #047857; margin-bottom: 4px; }
        .ib-text span { font-size: 11px; color: #059669; }
        .ib-icon { font-size: 24px; color: #10b981; }

        .section-title { font-size: 16px; font-weight: 700; margin: 0 20px 16px; color: #0f172a; display: flex; justify-content: space-between; align-items: center; }
        .section-title button { background: none; border: none; font-size: 13px; color: #4f46e5; cursor: pointer; font-weight: 700; }

        .job-card { background: #ffffff; border-radius: 20px; padding: 20px; margin: 0 20px 16px; position: relative; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .job-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .job-id { font-size: 14px; font-weight: 700; color: #0f172a; }
        .job-badge { background: #e0e7ff; color: #4f46e5; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; }
        .job-store { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
        .store-img { width: 48px; height: 48px; border-radius: 10px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .store-info h4 { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: #0f172a; }
        .store-info p { font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 4px; }
        .job-details { display: flex; justify-content: space-between; padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; }
        .jd-item h5 { font-size: 12px; color: #64748b; font-weight: 500; margin-bottom: 4px; }
        .jd-item p { font-size: 15px; font-weight: 700; color: #0f172a; }
        .accept-btn { width: 100%; padding: 16px; border-radius: 14px; background: #4f46e5; color: white; border: none; font-size: 15px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; box-shadow: 0 4px 12px rgba(79,70,229,0.2); }
        .accept-btn:hover { background: #4338ca; }
        .btn-timer { background: rgba(0,0,0,0.15); padding: 4px 8px; border-radius: 8px; font-size: 12px; }
        
        .active-btn { width: 100%; padding: 16px; border-radius: 14px; background: #22c55e; color: white; border: none; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; box-shadow: 0 4px 12px rgba(34,197,94,0.2); }
        .active-btn:hover { background: #16a34a; }

        .quick-access { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 0 20px; margin-bottom: 24px; }
        .qa-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; }
        .qa-icon-wrap { width: 64px; height: 64px; border-radius: 18px; background: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #0f172a; transition: transform 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.04); border: 1px solid #f1f5f9; }
        .qa-icon-wrap.orders { color: #f97316; }
        .qa-icon-wrap.earnings { color: #22c55e; }
        .qa-icon-wrap.support { color: #6366f1; }
        .qa-icon-wrap.incentives { color: #ec4899; }
        .qa-btn span { font-size: 12px; color: #64748b; font-weight: 600; }

        .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); border-top: 1px solid #e2e8f0; display: flex; justify-content: space-around; padding: 16px 0 24px; z-index: 100; box-shadow: 0 -4px 20px rgba(0,0,0,0.03); }
        .nav-item { display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: none; color: #94a3b8; cursor: pointer; transition: color 0.2s; }
        .nav-item.active { color: #4f46e5; }
        .nav-item i { font-size: 20px; }
        .nav-item span { font-size: 11px; font-weight: 700; }
        
        .aj-map { height: 160px; background: #f1f5f9 url('https://i.ibb.co/6yJd1Y9/map-placeholder.png') center/cover; position: relative; border-radius: 12px; margin-bottom: 16px; }
        .timeline { display: flex; flex-direction: column; gap: 20px; margin-bottom: 24px; position: relative; padding-left: 8px; }
        .timeline::before { content: ''; position: absolute; left: 23px; top: 20px; bottom: 20px; width: 2px; background: #e2e8f0; }
        .tl-item { display: flex; gap: 16px; position: relative; z-index: 1; }
        .tl-icon { width: 32px; height: 32px; border-radius: 50%; background: #ffffff; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 14px; flex-shrink: 0; }
        .tl-icon.done { background: #4f46e5; border-color: #4f46e5; color: white; }
        .tl-icon.current { border-color: #4f46e5; color: #4f46e5; background: #eef2ff; }
        .tl-text h5 { font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 4px; }
        .tl-text p { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
        .tl-text span { font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 4px; }
        .action-btns { display: flex; gap: 12px; }
        .btn-call { width: 48px; height: 48px; border-radius: 14px; background: #ecfdf5; color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1px solid #a7f3d0; cursor: pointer; text-decoration: none; }
        
        .profile-container { padding: 0 20px; }
        .profile-header { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 24px; }
        .profile-avatar-large { width: 80px; height: 80px; border-radius: 50%; background: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 32px; color: white; margin-bottom: 12px; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .profile-header h2 { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
        .profile-header p { font-size: 14px; color: #10b981; display: flex; align-items: center; gap: 6px; font-weight: 600; }
        .menu-list { display: flex; flex-direction: column; gap: 12px; }
        .menu-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 16px; background: #ffffff; cursor: pointer; border: 1px solid #e2e8f0; text-decoration: none; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
        .menu-left { display: flex; align-items: center; gap: 12px; }
        .menu-icon { font-size: 18px; color: #64748b; width: 24px; text-align: center; }
        .menu-left span { font-size: 15px; font-weight: 700; color: #0f172a; }
        .menu-right { color: #64748b; font-size: 14px; display: flex; align-items: center; gap: 8px; }
        .logout-btn { margin-top: 24px; width: 100%; padding: 16px; border-radius: 14px; background: transparent; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: background 0.2s; }
        .logout-btn:hover { background: rgba(239, 68, 68, 0.05); }
        
        .empty-state { padding: 40px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .empty-state i { font-size: 48px; color: #cbd5e1; margin-bottom: 16px; }
        .empty-state h3 { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
        .empty-state p { font-size: 14px; color: #64748b; }
      `}</style>

      <div className="rider-app">
        {/* HEADER */}
        <header className="rider-header">
          <div className="rider-greeting">
            <h1>Hey, {riderData.name?.split(" ")[0]} 👋</h1>
            <p>{isOnline ? "Good to see you online" : "You are offline"}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div className="rider-avatar" onClick={toggleOnline}>
              {riderData.photoURL ? <img src={riderData.photoURL} alt="" className="rider-avatar" /> : (riderData.name || "R")[0]}
              <div className={`online-dot ${isOnline ? "on" : "off"}`} />
            </div>
            <span style={{ fontSize: 10, color: "#64748b", cursor: "pointer", fontWeight: 600, letterSpacing: 0.5 }} onClick={toggleOnline}>
              {isOnline ? "GO OFFLINE" : "GO ONLINE"}
            </span>
          </div>
        </header>

        {/* MAIN TABS */}
        {tab === "home" || tab === "jobs" || tab === "active" ? (
          <>
            {/* EARNINGS CARD */}
            <div className="earnings-card">
              <div className="earnings-header">
                <div className="earnings-title">Today&apos;s Earnings</div>
                <div className="earnings-icon"><i className="fas fa-wallet" /></div>
              </div>
              <div className="earnings-amount">
                ₹{riderData?.earnings || 0}
                <span className="earnings-trend"><i className="fas fa-caret-up" /> 18%</span>
              </div>
              <div className="earnings-stats">
                <div className="stat-item">
                  <div className="stat-val">{riderData?.deliveryCount || 0}</div>
                  <div className="stat-lbl">Orders</div>
                </div>
                <div className="stat-item">
                  <div className="stat-val">{riderData?.totalDistance ? riderData.totalDistance.toFixed(1) : "0"} km</div>
                  <div className="stat-lbl">Distance</div>
                </div>
                <div className="stat-item">
                  <div className="stat-val">{formatOnlineTime(riderData?.totalOnlineMinutes || 0)}</div>
                  <div className="stat-lbl">Online Time</div>
                </div>
              </div>
            </div>

            {/* INCENTIVE BANNER */}
            <div className="incentive-banner">
              <div className="ib-text">
                <p>Complete 5 more orders</p>
                <span>and earn extra ₹250</span>
              </div>
              <div className="ib-icon"><i className="fas fa-gift" /></div>
            </div>

            {/* QUICK ACCESS */}
            <div className="quick-access">
              <button className="qa-btn" onClick={() => setTab("orders")}>
                <div className="qa-icon-wrap orders"><i className="fas fa-shopping-bag" /></div>
                <span>Orders</span>
              </button>
              <button className="qa-btn" onClick={() => setTab("earnings")}>
                <div className="qa-icon-wrap earnings"><i className="fas fa-wallet" /></div>
                <span>Earnings</span>
              </button>
              <button className="qa-btn" onClick={() => window.open("https://wa.me/919128926837", "_blank")}>
                <div className="qa-icon-wrap support"><i className="fas fa-headset" /></div>
                <span>Support</span>
              </button>
              <button className="qa-btn" onClick={() => alert("Incentives and Bonuses will be available here soon!")}>
                <div className="qa-icon-wrap incentives"><i className="fas fa-gift" /></div>
                <span>Incentives</span>
              </button>
            </div>

            {/* CURRENT ORDER / JOB BOARD */}
            <div className="section-title">
              {activeDeliveries.length > 0 ? "Current Order" : "Available Near You"}
              <button onClick={() => setTab("orders")}>View all</button>
            </div>

            {!isOnline ? (
              <div className="empty-state">
                <i className="fas fa-satellite-dish" style={{ animation: "rotate3d 4s linear infinite" }} />
                <h3>You are offline</h3>
                <p>Go online to see delivery requests.</p>
              </div>
            ) : activeDeliveries.length > 0 ? (
              // ACTIVE DELIVERY CARD
              activeDeliveries.slice(0,1).map((o) => {
                const seller = sellersData[o.sellerId];
                return (
                  <div key={o.id} className="job-card">
                    <div className="job-header">
                      <span className="job-id">#{o.id.substring(0,8).toUpperCase()}</span>
                      <span className="job-badge">In Progress</span>
                    </div>
                    <div className="job-store">
                      <div className="store-img">🏪</div>
                      <div className="store-info">
                        <h4>{seller?.storeName || seller?.name || "Store"}</h4>
                        <p><i className="fas fa-map-marker-alt" /> {seller?.address?.substring(0, 30)}...</p>
                      </div>
                    </div>
                    <div className="job-details">
                      <div className="jd-item">
                        <h5>Deliver To</h5>
                        <p>{o.userName}</p>
                      </div>
                      <div className="jd-item" style={{ textAlign: "right" }}>
                        <h5>Items</h5>
                        <p>{o.items?.length || 1}</p>
                      </div>
                    </div>
                    <div className="action-btns">
                      <a href={`tel:${o.userPhone}`} className="btn-call"><i className="fas fa-phone" /></a>
                      <button className="active-btn" style={{ flex: 1 }} onClick={() => openPaymentModal(o)}>
                        I&apos;ve Delivered the Order <i className="fas fa-chevron-right" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : availableOrders.length > 0 ? (
              // AVAILABLE ORDER CARD
              availableOrders.slice(0, 1).map((o) => {
                const seller = sellersData[o.sellerId];
                let distance = 0;
                let calculatedEarning = 40;
                if (seller?.coordinates && o.userCoordinates) {
                  const [sellLat, sellLon] = seller.coordinates.split(",").map(Number);
                  const [custLat, custLon] = o.userCoordinates.split(",").map(Number);
                  distance = calculateDistance(sellLat, sellLon, custLat, custLon);
                  calculatedEarning = calculateDeliveryEarning(distance);
                }
                return (
                  <div key={o.id} className="job-card">
                    <div className="job-header">
                      <span className="job-id">#{o.id.substring(0,8).toUpperCase()}</span>
                      <span className="job-badge" style={{ background: "rgba(236,72,153,0.15)", color: "#f472b6" }}>Pickup</span>
                    </div>
                    <div className="job-store">
                      <div className="store-img">🏪</div>
                      <div className="store-info">
                        <h4>{seller?.storeName || seller?.name || "Store"}</h4>
                        <p><i className="fas fa-map-marker-alt" /> {seller?.address?.substring(0, 30)}... ({distance > 0 ? `${distance.toFixed(1)} km away` : ""})</p>
                      </div>
                    </div>
                    <div className="job-details">
                      <div className="jd-item">
                        <h5>Earnings</h5>
                        <p>₹{calculatedEarning}</p>
                      </div>
                      <div className="jd-item" style={{ textAlign: "right" }}>
                        <h5>Items</h5>
                        <p>{o.items?.length || 1}</p>
                      </div>
                    </div>
                    <button className="accept-btn" onClick={() => acceptOrder(o.id)}>
                      Accept Order <span className="btn-timer">14s</span>
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <i className="fas fa-box-open" />
                <h3>No orders right now</h3>
                <p>We&apos;ll notify you when a new order arrives.</p>
              </div>
            )}
          </>
        ) : tab === "earnings" ? (
          <>
            <div className="section-title" style={{ marginTop: 20 }}>Earnings Overview</div>
            <div className="earnings-card">
              <div className="earnings-header">
                <div className="earnings-title">Total Earnings</div>
                <div className="earnings-icon"><i className="fas fa-wallet" /></div>
              </div>
              <div className="earnings-amount">₹{riderData?.earnings || 0}</div>
              <div className="earnings-stats">
                <div className="stat-item">
                  <div className="stat-val">{riderData?.deliveryCount || 0}</div>
                  <div className="stat-lbl">Orders</div>
                </div>
                <div className="stat-item">
                  <div className="stat-val">₹40</div>
                  <div className="stat-lbl">Base Fare</div>
                </div>
                <div className="stat-item">
                  <div className="stat-val">₹0</div>
                  <div className="stat-lbl">Incentives</div>
                </div>
              </div>
            </div>
            <div className="job-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="job-details" style={{ margin: 0, padding: 20, borderBottom: "1px solid #e2e8f0" }}>
                <div className="jd-item"><h5>Base Fare</h5></div>
                <div className="jd-item"><p>₹{riderData?.earnings || 0}</p></div>
              </div>
              <div className="job-details" style={{ margin: 0, padding: 20, borderBottom: "1px solid #e2e8f0" }}>
                <div className="jd-item"><h5>Distance Incentive</h5></div>
                <div className="jd-item"><p>₹0</p></div>
              </div>
              <div className="job-details" style={{ margin: 0, padding: 20, borderBottom: "none" }}>
                <div className="jd-item"><h5>Total Earnings</h5></div>
                <div className="jd-item"><p style={{ color: "#4f46e5" }}>₹{riderData?.earnings || 0}</p></div>
              </div>
            </div>
          </>
        ) : tab === "orders" ? (
          <>
            <div className="section-title" style={{ marginTop: 20 }}>All Active Orders</div>
            {!isOnline ? (
              <div className="empty-state">
                <i className="fas fa-satellite-dish" />
                <h3>You are offline</h3>
                <p>Go online to see delivery requests.</p>
              </div>
            ) : activeDeliveries.length === 0 && availableOrders.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-check-circle" style={{ color: "#22c55e" }} />
                <h3>All caught up</h3>
                <p>You have no active or available orders.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {activeDeliveries.map((o) => {
                  const seller = sellersData[o.sellerId];
                  return (
                    <div key={o.id} className="job-card">
                      <div className="job-header">
                        <span className="job-id">Order #{o.id.substring(0,8).toUpperCase()}</span>
                      </div>
                      <div className="timeline">
                        <div className="tl-item">
                          <div className="tl-icon done"><i className="fas fa-check" /></div>
                          <div className="tl-text">
                            <h5>Accepted</h5>
                            <p>Order accepted</p>
                          </div>
                        </div>
                        <div className="tl-item">
                          <div className="tl-icon current"><i className="fas fa-store" /></div>
                          <div className="tl-text">
                            <h5>Pickup from</h5>
                            <p>{seller?.storeName || seller?.name || "Store"}</p>
                            <span><i className="fas fa-map-marker-alt" /> {seller?.address}</span>
                          </div>
                        </div>
                        <div className="tl-item">
                          <div className="tl-icon"><i className="fas fa-home" /></div>
                          <div className="tl-text">
                            <h5>Deliver to</h5>
                            <p>{o.userName}</p>
                            <span><i className="fas fa-map-marker-alt" /> {o.userAddress}</span>
                          </div>
                        </div>
                      </div>
                      <div className="action-btns">
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.userCoordinates || o.userAddress)}`} target="_blank" className="btn-call" style={{ background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}>
                          <i className="fas fa-location-arrow" />
                        </a>
                        <button className="active-btn" style={{ flex: 1 }} onClick={() => openPaymentModal(o)}>
                          Mark Delivered <i className="fas fa-check" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : tab === "profile" ? (
          <div className="profile-container" style={{ marginTop: 20 }}>
            <div className="profile-header">
              <div className="profile-avatar-large">
                {riderData.photoURL ? <img src={riderData.photoURL} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : (riderData.name || "R")[0]}
              </div>
              <h2>{riderData.name}</h2>
              <p>★ 4.9 <span style={{ color: "#64748b", fontSize: 12, fontWeight: 500 }}>Approved Rider</span></p>
            </div>
            
            <div className="menu-list">
              <div className="menu-item" onClick={() => alert("Account settings will be available soon.")}>
                <div className="menu-left"><div className="menu-icon"><i className="far fa-user" /></div><span>Account Details</span></div>
                <div className="menu-right"><i className="fas fa-chevron-right" /></div>
              </div>
              <div className="menu-item" onClick={() => alert("Vehicle details will be available soon.")}>
                <div className="menu-left"><div className="menu-icon"><i className="fas fa-motorcycle" /></div><span>Vehicle Details</span></div>
                <div className="menu-right"><i className="fas fa-chevron-right" /></div>
              </div>
              <div className="menu-item" onClick={() => alert("Bank settings will be available soon.")}>
                <div className="menu-left"><div className="menu-icon"><i className="fas fa-university" /></div><span>Bank Details</span></div>
                <div className="menu-right"><i className="fas fa-chevron-right" /></div>
              </div>
              <div className="menu-item" onClick={() => alert("Document management will be available soon.")}>
                <div className="menu-left"><div className="menu-icon"><i className="far fa-file-alt" /></div><span>Documents</span></div>
                <div className="menu-right" style={{ color: "#22c55e", fontWeight: 700 }}>Approved <i className="fas fa-chevron-right" style={{ color: "#64748b", fontWeight: "normal", marginLeft: 8 }} /></div>
              </div>
              <div className="menu-item" onClick={() => window.open("https://wa.me/919128926837", "_blank")}>
                <div className="menu-left"><div className="menu-icon"><i className="far fa-question-circle" /></div><span>Help & Support</span></div>
                <div className="menu-right"><i className="fas fa-chevron-right" /></div>
              </div>
            </div>
            
            <button className="logout-btn" onClick={() => signOut(auth)}>
              <i className="fas fa-sign-out-alt" /> Logout
            </button>
          </div>
        ) : null}

        {/* BOTTOM NAVIGATION */}
        <nav className="bottom-nav">
          <button className={`nav-item ${tab === "home" || tab === "jobs" || tab === "active" ? "active" : ""}`} onClick={() => setTab("home")}>
            <i className="fas fa-home" />
            <span>Home</span>
          </button>
          <button className={`nav-item ${tab === "earnings" ? "active" : ""}`} onClick={() => setTab("earnings")}>
            <i className="fas fa-wallet" />
            <span>Earnings</span>
          </button>
          <button className={`nav-item ${tab === "orders" ? "active" : ""}`} onClick={() => setTab("orders")}>
            <i className="fas fa-shopping-bag" />
            <span>Orders</span>
          </button>
          <button className={`nav-item ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>
            <i className="far fa-user" />
            <span>Profile</span>
          </button>
        </nav>

        {/* PAYMENT MODAL (Same logic, dark themed) */}
        {showPaymentModal && activePaymentOrder && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={() => setShowPaymentModal(false)}>
            <div style={{ background: "#ffffff", width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "30px 20px 40px", borderTop: "none" }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px", color: "#0f172a", textAlign: "center" }}>Handover Order</h3>
              <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24, textAlign: "center" }}>Amount to Collect: <strong style={{ color: "#10b981", fontSize: 18 }}>₹{activePaymentOrder.total}</strong></p>
              
              {!showScanner ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {activePaymentOrder.paymentMethod === "UPI" || activePaymentOrder.paymentStatus === "Paid" ? (
                    <div style={{ padding: "16px", borderRadius: 16, background: "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 700, border: "1px solid rgba(34,197,94,0.2)", textAlign: "center" }}>
                      <i className="fas fa-check-circle" style={{ marginRight: 8 }}/> Order Prepaid Online
                    </div>
                  ) : (
                    <>
                      <button style={{ width: "100%", padding: "16px", borderRadius: 14, background: "#f59e0b", color: "white", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer" }} onClick={() => completeDelivery("COD_CASH")}>
                        <i className="fas fa-money-bill-wave" style={{ marginRight: 8 }}/> Customer Handed Cash
                      </button>
                      <button style={{ width: "100%", padding: "16px", borderRadius: 14, background: "transparent", color: "#6366f1", border: "2px solid #6366f1", fontSize: 15, fontWeight: 700, cursor: "pointer" }} onClick={() => setShowScanner(true)}>
                        <i className="fas fa-qrcode" style={{ marginRight: 8 }}/> Pay via UPI Scanner
                      </button>
                    </>
                  )}
                  
                  <button style={{ width: "100%", padding: "16px", borderRadius: 14, background: "#22c55e", color: "white", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 12 }} onClick={() => completeDelivery("PREPAID")}>
                    {activePaymentOrder.paymentMethod === "UPI" || activePaymentOrder.paymentStatus === "Paid" ? "Complete Delivery" : "Skip Payment & Complete"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 200, height: 200, background: "white", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#161722" }}>
                    <i className="fas fa-qrcode" style={{ fontSize: 48, marginBottom: 12 }}/>
                    <p style={{ fontSize: 12, fontWeight: 700 }}>Company UPI</p>
                  </div>
                  <p style={{ fontSize: 13, color: "#64748b" }}>Ask customer to scan and pay ₹{activePaymentOrder.total}</p>
                  
                  <button style={{ width: "100%", padding: "16px", borderRadius: 14, background: "#10b981", color: "white", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.2)" }} onClick={() => completeDelivery("COD_UPI")}>
                    Confirm Payment Received
                  </button>
                  <button style={{ width: "100%", padding: "16px", borderRadius: 14, background: "transparent", color: "#64748b", border: "1px solid #e2e8f0", fontSize: 15, fontWeight: 700, cursor: "pointer" }} onClick={() => setShowScanner(false)}>
                    Back to Options
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

