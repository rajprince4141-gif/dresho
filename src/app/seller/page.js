"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";
import Link from "next/link";
import { auth, db, IMGBB_API_KEY } from "@/lib/firebase";
import {
  GoogleAuthProvider, signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, collection, query, where,
  onSnapshot, updateDoc, addDoc, deleteDoc,
} from "firebase/firestore";
import NotificationBell from "@/components/NotificationBell";
import { requestNotificationPermission } from "@/lib/firebase";

// Custom Hooks
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";

// Modular Utilities
import { isValidPhone, isValidEmail } from "@/utils/validators";
import { compressImage } from "@/utils/imageCompressor";

export default function SellerPage() {
  const { user, userData: sellerData, loading: authLoadingState, isPending, setIsPending, authStep, setAuthStep, logout, setUserData: setSellerData } = useAuth("seller");
  const [authPhone, setAuthPhone] = useState("");
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
  const { products } = useProducts({ sellerId: user?.uid });
  const { orders, salesTotal, pendingCount } = useOrders({ sellerId: user?.uid });
  const [orderSegment, setOrderSegment] = useState("New order");

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
  const [pMeasurements, setPMeasurements] = useState({});
  const [pImageFiles, setPImageFiles] = useState([]);
  const [pImagePreviews, setPImagePreviews] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Data listeners
  useEffect(() => {
    if (!user) return;

    // My banner requests
    const bq = query(collection(db, "banner_requests"), where("sellerId", "==", user.uid));
    const unsub3 = onSnapshot(bq, (snap) => {
      const r = []; snap.forEach((d) => r.push({ id: d.id, ...d.data() }));
      r.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMyBannerRequests(r);
    }, (err) => { console.error("Seller: Error listening to banner_requests:", err); });
    return () => { unsub3(); };
  }, [user]);

  const handleApproveReturn = async (o) => {
    try {
      const isReturn = o.status === "Return Requested";
      const newStatus = isReturn ? "Return Approved" : "Exchange Approved";
      await updateDoc(doc(db, "orders", o.id), {
        status: newStatus,
        returnApprovedAt: new Date()
      });
      alert(`Request approved! Reverse logistics rider will be assigned to pick up the item.`);

      // Notify customer
      if (o.userId) {
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "single",
            userId: o.userId,
            role: "customer",
            title: `Request Approved! 🚀`,
            body: `Your request for order #${o.trackingId} has been approved by the seller.`,
            link: "/shop?tab=orders"
          })
        }).catch(err => console.error("Notification failed", err));
      }
    } catch (e) {
      alert("Error approving request: " + e.message);
    }
  };

  const handleRejectReturn = async (o) => {
    const reason = prompt("Please provide a reason for rejecting this request:");
    if (!reason) return;
    try {
      const isReturn = o.status === "Return Requested";
      const newStatus = isReturn ? "Return Rejected" : "Exchange Rejected";
      await updateDoc(doc(db, "orders", o.id), {
        status: newStatus,
        returnRejectionReason: reason,
        returnRejectedAt: new Date()
      });
      alert(`Request rejected.`);

      // Notify customer
      if (o.userId) {
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "single",
            userId: o.userId,
            body: `Your request for order #${o.trackingId} was rejected. Reason: ${reason}`,
            link: "/shop?tab=orders"
          })
        }).catch(err => console.error("Notification failed", err));
      }
    } catch (e) {
      alert("Error rejecting request: " + e.message);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "Rider Searching",
        acceptedAt: new Date()
      });
      alert("Order accepted! 🚀 Finding nearby riders...");
      const order = orders.find(o => o.id === orderId);
      if (order?.userId) {
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "single",
            userId: order.userId,
            role: "customer",
            title: "Order Accepted! 🎉",
            body: `Your order #${order.trackingId} has been accepted by the store. Finding rider...`,
            link: "/shop?tab=orders"
          })
        }).catch(err => console.error("Notification failed", err));
      }

      // Broadcast to active riders to grab the delivery job
      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "broadcast_riders",
          title: "New Delivery Available! 📦",
          body: `A new order #${order?.trackingId || ""} is available for delivery from ${sellerData?.storeName || "a nearby store"}.`,
          link: "/delivery"
        })
      }).catch(err => console.error("Rider broadcast failed", err));

    } catch (e) {
      alert("Failed to accept order: " + e.message);
    }
  };

  const handleRejectOrder = async (orderId) => {
    const reason = prompt("Enter reason for rejecting this order:");
    if (!reason) return;
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "Cancelled",
        rejectionReason: reason,
        rejectedAt: new Date()
      });
      alert("Order rejected.");
      const order = orders.find(o => o.id === orderId);
      if (order?.userId) {
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "single",
            userId: order.userId,
            role: "customer",
            title: "Order Rejected ❌",
            body: `Your order #${order.trackingId} was rejected. Reason: ${reason}`,
            link: "/shop?tab=orders"
          })
        }).catch(err => console.error("Notification failed", err));
      }
    } catch (e) {
      alert("Failed to reject order: " + e.message);
    }
  };

  const handleMarkReady = async (orderId) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "Ready For Pickup",
        readyAt: new Date()
      });
      alert("Order marked as ready! 📦 Rider will pick it up shortly.");
      const order = orders.find(o => o.id === orderId);
      if (order?.userId) {
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "single",
            userId: order.userId,
            role: "customer",
            title: "Order Packed! 📦",
            body: `Your order #${order.trackingId} has been packed and is ready for pickup.`,
            link: "/shop?tab=orders"
          })
        }).catch(err => console.error("Notification failed", err));
      }
      if (order?.riderId) {
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "single",
            userId: order.riderId,
            role: "rider",
            title: "Order Ready! 📦",
            body: `Order #${order.trackingId} is packed and ready for pickup at ${sellerData?.storeName}.`,
            link: "/delivery"
          })
        }).catch(err => console.error("Notification failed", err));
      }
    } catch (e) {
      alert("Failed to update status: " + e.message);
    }
  };

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

  const handleGoogleSignIn = async (hintEmail = null) => {
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      if (typeof hintEmail === "string" && hintEmail.includes("@")) {
        provider.setCustomParameters({ login_hint: hintEmail });
      }
      await signInWithPopup(auth, provider);
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        alert('Google sign-in failed: ' + e.message);
      }
    }
    setAuthLoading(false);
  };

  const fetchLocation = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported by your browser.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoordinates(`${pos.coords.latitude}, ${pos.coords.longitude}`),
      () => alert("Unable to retrieve location. Please allow location access.")
    );
  };



  const uploadToImgBB = async (file) => {
    const attemptUpload = async (fileToUpload) => {
      const formData = new FormData();
      formData.append("image", fileToUpload);

      const res = await fetch("/api/upload", { method: "POST", body: formData });

      // Guard: check if we got HTML back (means API crashed / returned 404 / 500 HTML page)
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        console.error("[Upload] Server returned non-JSON response:", text.slice(0, 200));
        throw new Error(`Server error (${res.status}). Please try again.`);
      }

      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Image upload failed.");
      return data.url;
    };

    try {
      // Try with compressed file first
      const compressedFile = await compressImage(file);
      return await attemptUpload(compressedFile);
    } catch (firstErr) {
      console.warn("[Upload] Compressed upload failed, retrying with original:", firstErr.message);
      try {
        // Retry with original uncompressed file
        return await attemptUpload(file);
      } catch (secondErr) {
        throw new Error(secondErr.message);
      }
    }
  };

  const submitRegistration = async () => {
    if (!storeName || !ownerName || !shopAddress || !locality) return alert("Please fill all required store details.");
    if (email && !isValidEmail(email)) return alert("Please enter a valid email address.");
    setAuthLoading(true);
    try {
      await setDoc(doc(db, "sellers_profile", auth.currentUser.uid), {
        phone: "+91" + authPhone,
        ownerName, storeName, email: email || auth.currentUser.email || "",
        shopAddress, locality, shopType, coordinates,
        idProofUrl: "", shopPhotoUrl: "",
        openingTime: "09:00", closingTime: "21:00", availableDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], upiId: "",
        role: "seller", approved: false, sales: 0, isShopOpen: false,
        createdAt: new Date(),
      });
      setIsPending(true);
      setAuthStep("success");
    } catch (e) { alert("Registration failed: " + e.message); }
    setAuthLoading(false);
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (pImageFiles.length + files.length > 5) {
      return alert("You can only upload up to 5 images per product.");
    }

    setPImageFiles(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPImagePreviews(prev => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so the same files can be selected again if needed
    e.target.value = null;
  };

  const removeImage = (index) => {
    setPImageFiles(prev => prev.filter((_, i) => i !== index));
    setPImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const toggleSize = (size) => {
    setPSizes((prev) => prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]);
  };

  const toggleShopStatus = async () => {
    if (!auth.currentUser) return;
    if (!sellerData?.approved) {
      alert("Your store is not approved yet. Please complete document verification and wait for admin approval.");
      return;
    }
    try {
      const newStatus = !sellerData?.isShopOpen;
      await updateDoc(doc(db, "sellers_profile", auth.currentUser.uid), {
        isShopOpen: newStatus
      });
      setSellerData(prev => ({ ...prev, isShopOpen: newStatus }));
    } catch (e) {
      console.error(e);
      alert("Failed to update shop status: " + e.message);
    }
  };

  const saveProduct = async () => {
    if (pImageFiles.length === 0) return alert("Select at least one image");
    if (!pName || !pPrice) return alert("Fill name and price");
    setUploading(true);
    try {
      const imageUrls = [];
      for (const file of pImageFiles) {
        const url = await uploadToImgBB(file);
        imageUrls.push(url);
      }

      await addDoc(collection(db, "products"), {
        sellerId: user.uid, storeName: sellerData.storeName, name: pName,
        price: parseFloat(pPrice), stock: parseInt(pStock) || 0, category: pCategory,
        sizes: pSizes,
        measurements: pMeasurements,
        image: imageUrls[0], // Main image
        images: imageUrls,   // All images
        createdAt: new Date(),
      });
      setShowModal(false);
      setPName(""); setPPrice(""); setPStock("");
      setPImageFiles([]); setPImagePreviews([]);
      setPSizes(["S", "M", "L", "XL"]);
      setPMeasurements({});
    } catch (e) { alert("Upload failed: " + e.message); }
    setUploading(false);
  };

  const categories = ["Men's Wear", "Women's Wear", "Kids Wear", "Ethnic", "Casual", "Formal", "Accessories", "Footwear"];

  // AUTH SCREEN
  if (!user && !isPending) {
    return (
      <>
        <div className=""><div className="" /></div>
        <div className="page-content " style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20, position: "relative", zIndex: 1 }}>
          <Link href="/" style={{ position: "fixed", top: 20, left: 20, zIndex: 100, width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "var(--gold)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "all 0.3s ease", display: "none" }}>
            <i className="fas fa-house" style={{ fontSize: 16 }} />
          </Link>
          <div className="animate-scale-in auth-card">
            {/* Back Button */}
            {authStep !== "welcome" && (
              <div style={{ position: "absolute", top: 16, left: 20, cursor: "pointer", color: "var(--navy)", zIndex: 10 }} onClick={() => {
                if (authStep === "google") setAuthStep("welcome");
                else if (authStep === "phone") setAuthStep("google");
                else if (authStep === "store") setAuthStep("phone");
              }}>
                <i className="fas fa-arrow-left" style={{ fontSize: 18 }} />
              </div>
            )}

            {/* Header (Hidden on welcome screen as it has its own) */}
            {authStep !== "welcome" && (
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <h1 style={{ fontFamily: "var(--font-d)", fontSize: 32, fontWeight: 400, color: "var(--navy)", letterSpacing: 3, margin: "0 0 4px 0" }}>
                  Dres<span style={{ color: "var(--gold)" }}>h</span>o
                </h1>
              </div>
            )}

            {/* ── STEP 1: Welcome ── */}
            {authStep === "welcome" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: -20 }}>
                <div style={{ padding: "32px 24px", background: "linear-gradient(135deg, #0f172a, #2e1065)", borderRadius: 24, color: "white", position: "relative", overflow: "hidden", textAlign: "left", boxShadow: "0 12px 32px rgba(15,23,42,0.3)" }}>
                  <h1 style={{ fontFamily: "var(--font-d)", fontSize: 24, fontWeight: 400, letterSpacing: 2, margin: "0 0 24px 0" }}>
                    Dres<span style={{ color: "var(--gold)" }}>h</span>o
                  </h1>
                  <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 12, lineHeight: 1.2 }}>Start Selling on Dresho</h2>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 32, lineHeight: 1.5 }}>Grow your fashion business with fast deliveries and more customers nearby.</p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="fas fa-bolt" style={{ color: "#facc15", fontSize: 18 }} /></div>
                      <div>
                        <h4 style={{ fontSize: 14, fontWeight: 700 }}>Fast Deliveries</h4>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Reach your customers in minutes</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="fas fa-box" style={{ color: "#f87171", fontSize: 18 }} /></div>
                      <div>
                        <h4 style={{ fontSize: 14, fontWeight: 700 }}>Easy Product Uploads</h4>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Upload and manage products easily</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><i className="fas fa-users" style={{ color: "#60a5fa", fontSize: 18 }} /></div>
                      <div>
                        <h4 style={{ fontSize: 14, fontWeight: 700 }}>More Local Customers</h4>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Get discovered by nearby buyers</p>
                      </div>
                    </div>
                  </div>
                </div>

                {typeof window !== "undefined" && localStorage.getItem("dreshoSavedEmail") && (
                  <button className="auth-btn-primary" onClick={() => handleGoogleSignIn(localStorage.getItem("dreshoSavedEmail"))} style={{ height: 60, fontSize: 16, borderRadius: 16, background: "var(--navy)", boxShadow: "0 8px 24px rgba(15,23,42,0.25)" }}>
                    Continue as {localStorage.getItem("dreshoSavedEmail")}
                  </button>
                )}

                <button className={typeof window !== "undefined" && localStorage.getItem("dreshoSavedEmail") ? "auth-btn-ghost" : "auth-btn-primary"} onClick={() => setAuthStep("google")} style={{ height: 60, fontSize: 16, borderRadius: 16, ...(typeof window !== "undefined" && localStorage.getItem("dreshoSavedEmail") ? { background: "transparent", color: "var(--navy)" } : { background: "var(--navy)", boxShadow: "0 8px 24px rgba(15,23,42,0.25)" }) }}>
                  {typeof window !== "undefined" && localStorage.getItem("dreshoSavedEmail") ? "Sign In with a different account" : "Start Selling Today"}
                </button>
              </div>
            )}

            {/* ── STEP 2: Google ── */}
            {authStep === "google" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "center", marginTop: -10 }}>
                <div style={{ padding: "16px 0 32px" }}>
                  <img src="https://cdn3d.iconscout.com/3d/premium/thumb/store-5591146-4652973.png" alt="Store" style={{ width: 160, height: 160, objectFit: "contain", margin: "0 auto 16px" }} />
                  <h2 style={{ fontSize: 24, fontWeight: 900, color: "var(--navy)", marginBottom: 8, lineHeight: 1.3 }}>Join thousands of sellers on Dresho</h2>
                  <p style={{ fontSize: 14, color: "var(--text-muted)", padding: "0 20px" }}>Sign in with your Google account to create your store.</p>
                </div>

                <button onClick={handleGoogleSignIn} disabled={authLoading}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", padding: "16px", borderRadius: 16, border: "2px solid #e2e8f0", background: "var(--white)", cursor: authLoading ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700, color: "var(--navy)", transition: "all 0.2s" }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {authLoading ? "Signing in..." : "Continue with Google"}
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, justifyContent: "center" }}>
                  <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} style={{ accentColor: "var(--navy)", width: 16, height: 16, cursor: "pointer" }} />
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    I agree to the <span onClick={() => setShowTermsModal(true)} style={{ color: "var(--navy)", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Terms & Policy</span>
                  </p>
                </div>
              </div>
            )}

            {/* ── STEP 3: Phone Number ── */}
            {authStep === "phone" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 10 }}>
                <div style={{ textAlign: "left" }}>
                  <h2 style={{ fontSize: 26, fontWeight: 900, color: "var(--navy)", marginBottom: 10 }}>Enter Mobile Number</h2>
                  <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>We will use this number to contact you about your store and orders.</p>
                </div>

                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", color: "var(--navy)", fontWeight: 700, fontSize: 16 }}>+91</span>
                  <input type="tel" maxLength={10} placeholder="98765 43210" value={authPhone} onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, ""))} style={{ width: "100%", padding: "20px 20px 20px 60px", borderRadius: 16, border: "2px solid " + (authPhone.length === 10 ? "#10b981" : "#e2e8f0"), fontSize: 18, fontWeight: 700, letterSpacing: 1, outline: "none", transition: "all 0.2s" }} />
                  {authPhone.length === 10 && <i className="fas fa-check-circle" style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", color: "#10b981", fontSize: 20 }} />}
                </div>

                <button className="auth-btn-primary" onClick={() => {
                  if (!agreedTerms) return alert("Please go back and agree to the Terms & Policy first.");
                  if (!isValidPhone(authPhone)) return alert("Enter a valid 10-digit phone number");
                  setAuthStep("store");
                }} style={{ height: 60, fontSize: 16, borderRadius: 16, background: authPhone.length === 10 ? "var(--navy)" : "#cbd5e1", boxShadow: authPhone.length === 10 ? "0 8px 24px rgba(15,23,42,0.25)" : "none", marginTop: 8 }}>
                  Continue
                </button>
              </div>
            )}

            {/* ── STEP 4: Store Info ── */}
            {authStep === "store" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ textAlign: "left", marginBottom: 8 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 900, color: "var(--navy)", marginBottom: 8 }}>Store Information</h2>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Tell us about your store.</p>
                </div>

                <div style={{ textAlign: "left" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginLeft: 4, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>Store Name</label>
                  <input className="glass-input" placeholder="e.g. Dresho Fashion Hub" value={storeName} onChange={(e) => setStoreName(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15 }} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginLeft: 4, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>Owner Name</label>
                  <input className="glass-input" placeholder="e.g. Rahul Kumar" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15 }} />
                </div>
                <div style={{ textAlign: "left", position: "relative" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginLeft: 4, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>Store Address</label>
                  <input className="glass-input" placeholder="e.g. 102, MG Road" value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15, paddingRight: 40 }} />
                  <i className="fas fa-location-dot" style={{ position: "absolute", right: 20, bottom: 20, color: "var(--navy)", cursor: "pointer" }} onClick={fetchLocation} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginLeft: 4, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>City</label>
                  <input className="glass-input" placeholder="e.g. Bangalore" value={locality} onChange={(e) => setLocality(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15 }} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginLeft: 4, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>Store Category</label>
                  <select className="glass-input" value={shopType} onChange={(e) => setShopType(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15, appearance: "none", cursor: "pointer", background: "var(--white)" }}>
                    <option value="Men Fashion">Men Fashion</option>
                    <option value="Women Fashion">Women Fashion</option>
                    <option value="Kids Wear">Kids Wear</option>
                    <option value="Both">Both (Unisex)</option>
                  </select>
                </div>

                <div style={{ marginTop: 12 }}>
                  <button className="auth-btn-primary" onClick={submitRegistration} disabled={authLoading} style={{ width: "100%", height: 60, borderRadius: 16, fontSize: 16, background: "var(--navy)", boxShadow: "0 8px 24px rgba(15,23,42,0.25)" }}>
                    {authLoading ? <i className="fas fa-circle-notch fa-spin" /> : "Continue"}
                  </button>
                </div>
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

  // REGISTRATION SUCCESS SCREEN
  if (isPending && authStep === "success") {
    return (
      <>
        <div className=""><div className="" /></div>
        <div className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 20 }}>
          <div className="auth-card animate-scale-in" style={{ textAlign: "center", padding: "40px 24px", width: "100%", maxWidth: 400, background: "white", borderRadius: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.08)" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 8px 24px rgba(16,185,129,0.3)" }}>
              <i className="fas fa-check" style={{ fontSize: 36, color: "white" }} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: "var(--navy)", marginBottom: 12 }}>Registration Successful!</h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 32 }}>Your store has been registered successfully.</p>

            <div style={{ background: "rgba(16,185,129,0.08)", padding: "16px 20px", borderRadius: 16, border: "1px solid rgba(16,185,129,0.2)", marginBottom: 32, textAlign: "left" }}>
              <div style={{ display: "flex", gap: 12 }}>
                <i className="fas fa-file-invoice" style={{ color: "#10b981", marginTop: 2, fontSize: 18 }} />
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 800, color: "var(--navy)", marginBottom: 4 }}>Pending Approval</h4>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>Upload your documents to get your store verified and start selling.</p>
                </div>
              </div>
            </div>

            <button className="auth-btn-primary" onClick={() => setAuthStep("dashboard")} style={{ width: "100%", height: 56, borderRadius: 16, fontSize: 16, background: "var(--navy)", boxShadow: "0 8px 24px rgba(15,23,42,0.2)" }}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </>
    );
  }



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
            <NotificationBell userId={user.uid} role="seller" />
            <button className="btn-icon" onClick={() => signOut(auth)}>
              <i className="fas fa-power-off" style={{ fontSize: 14 }} />
            </button>
          </div>
        </nav>

        <main style={{ padding: "16px 20px 40px" }}>
          {/* Verification Pending Banner */}
          {isPending && (
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: "16px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <i className="fas fa-shield-halved" style={{ color: "#f59e0b", fontSize: 20, marginTop: 2 }} />
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 800, color: "#92400e", marginBottom: 4 }}>Verification Pending</h4>
                  <p style={{ fontSize: 12, color: "#92400e", opacity: 0.8, lineHeight: 1.4 }}>Upload documents to get your store approved and start receiving orders.</p>
                </div>
              </div>
              <button className="auth-btn-primary" onClick={() => setTab("documents")} style={{ background: "white", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)", fontSize: 13, height: 40, borderRadius: 10, alignSelf: "flex-start", padding: "0 16px", boxShadow: "0 2px 8px rgba(245,158,11,0.15)" }}>
                <i className="fas fa-arrow-up-from-bracket" style={{ marginRight: 6 }} /> Upload Documents
              </button>
            </div>
          )}

          {/* Main Earnings Card */}
          <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)", borderRadius: 20, padding: 24, marginBottom: 24, position: "relative", overflow: "hidden", boxShadow: "0 12px 24px rgba(15,23,42,0.15)" }}>
            <h3 style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: 500, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Total Sales</h3>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 24 }}>
              <h2 style={{ fontSize: 38, fontWeight: 900, color: "white" }}>₹{salesTotal.toLocaleString("en-IN")}</h2>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 16 }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: "white", marginBottom: 4 }}>{pendingCount}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>Pending Orders</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: "white", marginBottom: 4 }}>{products.length}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>Total Products</p>
              </div>
            </div>
          </div>

          {/* Quick Access */}
          <div style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            paddingBottom: 10,
            marginBottom: 32,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch"
          }} className="no-scrollbar">
            <style>{`
              .no-scrollbar::-webkit-scrollbar {
                display: none;
              }
            `}</style>

            <button onClick={() => setShowModal(true)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", flex: "0 0 auto", width: 72 }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#10b981", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", border: "1px solid #f1f5f9" }}>
                <i className="fas fa-plus-circle" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>Add Item</span>
            </button>
            <button onClick={() => setTab("inventory")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", flex: "0 0 auto", width: 72 }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#f97316", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", border: "1px solid #f1f5f9", ...(tab === "inventory" ? { border: "2px solid #f97316", background: "#fff7ed" } : {}) }}>
                <i className="fas fa-box-open" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>Products</span>
            </button>
            <button onClick={() => setTab("orders")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", flex: "0 0 auto", width: 72 }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#6366f1", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", border: "1px solid #f1f5f9", ...(tab === "orders" ? { border: "2px solid #6366f1", background: "#eef2ff" } : {}) }}>
                <i className="fas fa-shopping-bag" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>Orders</span>
            </button>
            <button onClick={() => setTab("returns")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", flex: "0 0 auto", width: 72 }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#ef4444", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", border: "1px solid #f1f5f9", ...(tab === "returns" ? { border: "2px solid #ef4444", background: "#fee2e2" } : {}) }}>
                <i className="fas fa-undo" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>Returns</span>
            </button>
            <button onClick={() => setTab("documents")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", flex: "0 0 auto", width: 72 }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#ec4899", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", border: "1px solid #f1f5f9", ...(tab === "documents" ? { border: "2px solid #ec4899", background: "#fdf2f8" } : {}) }}>
                <i className="fas fa-file-invoice" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>Documents</span>
            </button>
            <button onClick={() => setTab("advertise")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", flex: "0 0 auto", width: 72 }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#0ea5e9", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", border: "1px solid #f1f5f9", ...(tab === "advertise" ? { border: "2px solid #0ea5e9", background: "#e0f2fe" } : {}) }}>
                <i className="fas fa-ad" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>Advertise</span>
            </button>
          </div>


          {/* DOCUMENTS */}
          {tab === "documents" && (
            <div className="animate-fade-in">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }} onClick={() => setTab("inventory")}>
                <i className="fas fa-arrow-left" style={{ cursor: "pointer", color: "var(--navy)" }} />
                <h3 style={{ fontSize: 18, fontWeight: 900 }}>Upload Documents</h3>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>These documents are required to verify your store.</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="premium-card" style={{ padding: 16, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between", border: idProofPreview || sellerData?.idProofUrl ? "1px solid #10b981" : "1px solid rgba(0,0,0,0.08)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}><i className="fas fa-id-card" /></div>
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 800 }}>Aadhaar / PAN Card</h4>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Upload front side</p>
                    </div>
                  </div>
                  <input type="file" id="idUploadDoc" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                    const f = e.target.files[0];
                    if (f) {
                      alert("Uploading ID Proof...");
                      try {
                        const url = await uploadToImgBB(f);
                        await updateDoc(doc(db, "sellers_profile", user.uid), { idProofUrl: url });
                        setIdProofPreview(url);
                        setSellerData({ ...sellerData, idProofUrl: url });
                        alert("Uploaded successfully!");
                      } catch (err) { alert("Failed: " + err.message); }
                    }
                  }} />
                  {idProofPreview || sellerData?.idProofUrl ? (
                    <span style={{ color: "#10b981", fontSize: 13, fontWeight: 700 }}><i className="fas fa-check" /> Done</span>
                  ) : (
                    <button onClick={() => document.getElementById("idUploadDoc").click()} style={{ background: "transparent", color: "var(--navy)", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>Upload</button>
                  )}
                </div>

                <div className="premium-card" style={{ padding: 16, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between", border: shopPhotoPreview || sellerData?.shopPhotoUrl ? "1px solid #10b981" : "1px solid rgba(0,0,0,0.08)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}><i className="fas fa-store" /></div>
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 800 }}>Store Photo</h4>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Upload your store front photo</p>
                    </div>
                  </div>
                  <input type="file" id="shopUploadDoc" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                    const f = e.target.files[0];
                    if (f) {
                      alert("Uploading Shop Photo...");
                      try {
                        const url = await uploadToImgBB(f);
                        await updateDoc(doc(db, "sellers_profile", user.uid), { shopPhotoUrl: url });
                        setShopPhotoPreview(url);
                        setSellerData({ ...sellerData, shopPhotoUrl: url });
                        alert("Uploaded successfully!");
                      } catch (err) { alert("Failed: " + err.message); }
                    }
                  }} />
                  {shopPhotoPreview || sellerData?.shopPhotoUrl ? (
                    <span style={{ color: "#10b981", fontSize: 13, fontWeight: 700 }}><i className="fas fa-check" /> Done</span>
                  ) : (
                    <button onClick={() => document.getElementById("shopUploadDoc").click()} style={{ background: "transparent", color: "var(--navy)", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>Upload</button>
                  )}
                </div>

                <div className="premium-card" style={{ padding: 16, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between", border: sellerData?.upiId ? "1px solid #10b981" : "1px solid rgba(0,0,0,0.08)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(139,92,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6" }}><i className="fas fa-university" /></div>
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 800 }}>Bank / UPI Details</h4>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Add bank account or UPI</p>
                    </div>
                  </div>
                  {sellerData?.upiId ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{sellerData.upiId}</span>
                      <span style={{ color: "#10b981", fontSize: 13, fontWeight: 700 }}><i className="fas fa-check" /></span>
                    </div>
                  ) : (
                    <button onClick={() => {
                      const upi = prompt("Enter your UPI ID (e.g. number@upi)");
                      if (upi) {
                        updateDoc(doc(db, "sellers_profile", user.uid), { upiId: upi });
                        setSellerData({ ...sellerData, upiId: upi });
                      }
                    }} style={{ background: "transparent", color: "var(--navy)", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>Add</button>
                  )}
                </div>

                {/* Store Location — Required for delivery time calculation */}
                <div className="premium-card" style={{ padding: 16, borderRadius: 16, border: sellerData?.coordinates ? "1px solid #10b981" : "1px solid rgba(245,158,11,0.4)", background: sellerData?.coordinates ? "rgba(16,185,129,0.03)" : "rgba(245,158,11,0.04)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: sellerData?.coordinates ? 0 : 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: sellerData?.coordinates ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: sellerData?.coordinates ? "#10b981" : "#f59e0b", flexShrink: 0 }}>
                      <i className="fas fa-location-crosshairs" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 800 }}>Store Location <span style={{ fontSize: 10, fontWeight: 600, color: "#ef4444", marginLeft: 4 }}>Required</span></h4>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
                        {sellerData?.coordinates
                          ? `📍 Saved: ${sellerData.coordinates}`
                          : "Needed to calculate delivery time for customers"}
                      </p>
                    </div>
                    {sellerData?.coordinates && (
                      <span style={{ color: "#10b981", fontSize: 13, fontWeight: 700, flexShrink: 0 }}><i className="fas fa-check" /> Done</span>
                    )}
                  </div>

                  {!sellerData?.coordinates && (
                    <div style={{ background: "rgba(245,158,11,0.08)", borderRadius: 10, padding: "10px 12px", marginBottom: 10, fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                      ⚠️ Without your location, customers will see a generic "45 min" estimate instead of the real delivery time.
                    </div>
                  )}

                  <button
                    onClick={async () => {
                      if (!navigator.geolocation) return alert("Geolocation is not supported by your browser.");
                      navigator.geolocation.getCurrentPosition(
                        async (pos) => {
                          const coords = `${pos.coords.latitude}, ${pos.coords.longitude}`;
                          try {
                            await updateDoc(doc(db, "sellers_profile", user.uid), { coordinates: coords });
                            setSellerData({ ...sellerData, coordinates: coords });
                            alert("✅ Store location saved! Customers will now see accurate delivery times.");
                          } catch (e) { alert("Failed to save location: " + e.message); }
                        },
                        () => alert("Location access denied. Please allow location permission in your browser settings and try again.")
                      );
                    }}
                    style={{ display: sellerData?.coordinates ? "none" : "flex", alignItems: "center", gap: 8, width: "100%", padding: "12px 16px", borderRadius: 10, background: "var(--navy)", color: "white", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, justifyContent: "center" }}
                  >
                    <i className="fas fa-location-dot" /> Pin My Store Location
                  </button>

                  {sellerData?.coordinates && (
                    <button
                      onClick={async () => {
                        if (!navigator.geolocation) return alert("Geolocation not supported.");
                        navigator.geolocation.getCurrentPosition(
                          async (pos) => {
                            const coords = `${pos.coords.latitude}, ${pos.coords.longitude}`;
                            try {
                              await updateDoc(doc(db, "sellers_profile", user.uid), { coordinates: coords });
                              setSellerData({ ...sellerData, coordinates: coords });
                              alert("✅ Store location updated!");
                            } catch (e) { alert("Failed: " + e.message); }
                          },
                          () => alert("Location access denied.")
                        );
                      }}
                      style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(16,185,129,0.3)", color: "#059669", padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      <i className="fas fa-rotate" /> Update Location
                    </button>
                  )}
                </div>

              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24, padding: "0 8px" }}>
                <i className="fas fa-shield-check" style={{ color: "var(--text-muted)" }} />
                <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>Your documents are secure with us and will not be shared.</p>
              </div>
            </div>
          )}


          {/* INVENTORY */}
          {tab === "inventory" && (
            <div className="animate-fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: "var(--navy)" }}>My Products</h3>
                <button className="auth-btn-primary" style={{ width: "auto", padding: "10px 20px", borderRadius: 14, fontSize: 13, background: "var(--navy)" }} onClick={() => setShowModal(true)}>
                  <i className="fas fa-plus" style={{ marginRight: 6 }} /> Add Item
                </button>
              </div>
              {products.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", background: "white", borderRadius: 24, border: "1px solid rgba(0,0,0,0.05)" }}>
                  <i className="fas fa-box-open" style={{ fontSize: 40, marginBottom: 12, color: "#cbd5e1" }} />
                  <p style={{ fontWeight: 700, color: "var(--text-muted)", fontSize: 14 }}>No products yet. Add your first item!</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {products.map((p) => (
                    <div key={p.id} className="premium-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 20, cursor: "default", background: "white", border: "1px solid #e2e8f0" }}>
                      <div style={{ width: 64, height: 64, borderRadius: 14, overflow: "hidden", background: "#f1f5f9", flexShrink: 0 }}>
                        <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>{p.name}</h4>
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Stock: {p.stock} {p.outOfStock && <span style={{ color: "#ef4444", fontWeight: "bold" }}>(OOS)</span>} · Sizes: {(p.sizes || []).join(", ")}</p>
                      </div>
                      <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                        <p style={{ fontSize: 16, fontWeight: 900, color: "#10b981" }}>₹{p.price}</p>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => {
                            const ns = prompt("Enter new stock quantity:", p.stock);
                            if (ns !== null) {
                              const parsed = parseInt(ns) || 0;
                              updateDoc(doc(db, "products", p.id), { stock: parsed });
                              if (parsed > 0 && (p.stock === 0 || p.outOfStock)) {
                                fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "restock_alert", data: { productId: p.id }, title: "It's Back! 🎉", body: `${p.name} is back in stock! Grab your size now.`, link: "/shop" }) });
                              }
                            }
                          }} style={{ background: "#f1f5f9", border: "none", color: "var(--navy)", padding: "6px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                            Edit
                          </button>
                          <button onClick={() => {
                            const newOos = !p.outOfStock;
                            updateDoc(doc(db, "products", p.id), { outOfStock: newOos });
                            if (!newOos) {
                              fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "restock_alert", data: { productId: p.id }, title: "It's Back! 🎉", body: `${p.name} is back in stock! Grab your size now.`, link: "/shop" }) });
                            }
                          }} style={{ background: p.outOfStock ? "#fef2f2" : "#f1f5f9", border: "none", color: p.outOfStock ? "#ef4444" : "var(--navy)", padding: "6px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                            {p.outOfStock ? "Mark In Stock" : "OOS"}
                          </button>
                          <button onClick={() => { if (confirm("Remove item?")) deleteDoc(doc(db, "products", p.id)); }} style={{ background: "#fef2f2", border: "none", color: "#ef4444", padding: "6px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer" }}>
                            <i className="fas fa-trash" />
                          </button>
                        </div>
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
              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4, color: "var(--navy)" }}>Active Orders</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
                Manage your new and processing orders. First accept them, then pack them!
              </p>

            </div>
          )}

          {/* RETURNS TAB */}
          {tab === "returns" && (
            <div className="animate-fade-in">
              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4, color: "var(--navy)" }}>Return & Exchange Requests</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
                Review customer requests for returns or exchanges. As per Dresho policy, we support replacements only (no refunds).
              </p>

              {orders.filter((o) =>
                o.status === "Return Requested" ||
                o.status === "Exchange Requested" ||
                o.status === "Return Approved" ||
                o.status === "Exchange Approved" ||
                o.status === "Return Rejected" ||
                o.status === "Exchange Rejected"
              ).length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", background: "white", borderRadius: 24, border: "1px solid rgba(0,0,0,0.05)" }}>
                  <i className="fas fa-smile" style={{ fontSize: 40, marginBottom: 12, color: "#10b981", opacity: 0.8 }} />
                  <p style={{ fontSize: 14, fontWeight: 800, color: "var(--navy)" }}>No Return Requests!</p>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>All your customers are happy with their orders! 😊</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {orders.filter((o) =>
                    o.status === "Return Requested" ||
                    o.status === "Exchange Requested" ||
                    o.status === "Return Approved" ||
                    o.status === "Exchange Approved" ||
                    o.status === "Return Rejected" ||
                    o.status === "Exchange Rejected"
                  ).map((o) => {
                    const isPending = o.status === "Return Requested" || o.status === "Exchange Requested";
                    const isApproved = o.status === "Return Approved" || o.status === "Exchange Approved";
                    const isRejected = o.status === "Return Rejected" || o.status === "Exchange Rejected";

                    return (
                      <div key={o.id} className="premium-card" style={{ padding: "20px", borderRadius: 20, background: "white", border: isPending ? "2px solid #f59e0b" : "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 14, borderBottom: "1px solid #f1f5f9", marginBottom: 12 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 1 }}>
                            ORDER #{o.trackingId}
                            <span style={{
                              background: isPending ? "#fef3c7" : isApproved ? "#d1fae5" : "#fee2e2",
                              color: isPending ? "#d97706" : isApproved ? "#065f46" : "#991b1b",
                              padding: "2px 8px",
                              borderRadius: 6,
                              marginLeft: 8,
                              fontWeight: 800
                            }}>
                              {o.status}
                            </span>
                          </span>
                          <span style={{ fontWeight: 900, color: "var(--navy)", fontSize: 15 }}>₹{o.total}</span>
                        </div>

                        {/* Customer & Request Details */}
                        <div style={{ fontSize: 13, color: "var(--navy)", marginBottom: 14, display: "flex", flexDirection: "column", gap: 4 }}>
                          <p><strong>Customer:</strong> {o.userName || "Dresho Buyer"} ({o.userPhone || "N/A"})</p>
                          <p><strong>Address:</strong> {o.userAddress || "N/A"}</p>
                          <p><strong>Reason:</strong> <span style={{ color: "#d97706", fontWeight: 600 }}>{o.returnReason || o.exchangeReason || "No reason specified"}</span></p>
                          {(o.returnRemarks || o.exchangeRemarks) && (
                            <p><strong>Remarks:</strong> <em>"{o.returnRemarks || o.exchangeRemarks}"</em></p>
                          )}
                          {isRejected && o.returnRejectionReason && (
                            <p style={{ color: "#991b1b", margin: 0 }}><strong>Rejection Reason:</strong> {o.returnRejectionReason}</p>
                          )}
                        </div>

                        {/* Items to Return/Exchange */}
                        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 12, marginBottom: 16 }}>
                          <p style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Items</p>
                          {o.items?.map((item, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: i !== o.items.length - 1 ? 6 : 0 }}>
                              <span style={{ fontWeight: 600 }}>{item.name} (Size: {item.selectedSize})</span>
                              <span style={{ color: "var(--text-muted)" }}>Qty: {item.qty}</span>
                            </div>
                          ))}
                        </div>

                        {/* Action buttons */}
                        {isPending && (
                          <div style={{ display: "flex", gap: 10 }}>
                            <button
                              className="auth-btn-primary"
                              style={{ flex: 1, borderRadius: 14, fontSize: 13, background: "#10b981", border: "none", height: 44, boxShadow: "none" }}
                              onClick={() => handleApproveReturn(o)}
                            >
                              APPROVE
                            </button>
                            <button
                              className="auth-btn-primary"
                              style={{ flex: 1, borderRadius: 14, fontSize: 13, background: "#ef4444", border: "none", height: 44, boxShadow: "none" }}
                              onClick={() => handleRejectReturn(o)}
                            >
                              REJECT
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ADVERTISE TAB */}
          {tab === "advertise" && (
            <div className="animate-fade-in">
              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4, color: "var(--navy)" }}>Advertise on Dresho Homepage</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
                Get your banner on Dresho's homepage! Submit your banner details below. Admin will review and activate it for your chosen duration.
              </p>

              {/* Slot Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
                {[{ slot: 1, label: "Hero Slide 1", desc: "Full-width hero banner" }, { slot: 2, label: "Hero Slide 2", desc: "Full-width hero banner" }, { slot: 3, label: "Hero Slide 3", desc: "Full-width hero banner" }, { slot: 4, label: "Mini Banner Left", desc: "Half-width promo" }, { slot: 5, label: "Mini Banner Right", desc: "Half-width promo" }].map((item) => (
                  <div key={item.slot} onClick={() => setAdvSlot(String(item.slot))} style={{ padding: "16px", borderRadius: 20, cursor: "pointer", border: advSlot === String(item.slot) ? "2px solid var(--navy)" : "1px solid #e2e8f0", background: advSlot === String(item.slot) ? "#eef2ff" : "white", transition: "all 0.2s" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: advSlot === String(item.slot) ? "var(--navy)" : "var(--text-muted)", letterSpacing: 1, marginBottom: 4 }}>SLOT {item.slot}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{item.desc}</div>
                  </div>
                ))}
              </div>

              {/* Form */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ textAlign: "left" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginLeft: 4, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>Banner Image URL *</label>
                  <input className="glass-input" placeholder="https://your-banner-image.com/banner.jpg" value={advImage} onChange={(e) => setAdvImage(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15, background: "white", border: "1px solid #e2e8f0" }} />
                  {advImage.trim() && (
                    <div style={{ marginTop: 12, width: "100%", height: 160, borderRadius: 16, overflow: "hidden", background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
                      <img src={advImage} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} />
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ textAlign: "left" }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginLeft: 4, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>Title</label>
                    <input className="glass-input" placeholder="e.g. Big Sale This Weekend" value={advTitle} onChange={(e) => setAdvTitle(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15, background: "white", border: "1px solid #e2e8f0" }} />
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginLeft: 4, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>Tag</label>
                    <input className="glass-input" placeholder="e.g. Women's Special" value={advTag} onChange={(e) => setAdvTag(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15, background: "white", border: "1px solid #e2e8f0" }} />
                  </div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginLeft: 4, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>Subtitle</label>
                  <input className="glass-input" placeholder="e.g. Up to 50% off on all ethnic wear" value={advSubtitle} onChange={(e) => setAdvSubtitle(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15, background: "white", border: "1px solid #e2e8f0" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ textAlign: "left" }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginLeft: 4, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>Button Text (CTA)</label>
                    <input className="glass-input" placeholder="e.g. Shop Now" value={advCta} onChange={(e) => setAdvCta(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15, background: "white", border: "1px solid #e2e8f0" }} />
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginLeft: 4, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>Duration (Days)</label>
                    <input className="glass-input" type="number" min="1" placeholder="e.g. 7" value={advDuration} onChange={(e) => setAdvDuration(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15, background: "white", border: "1px solid #e2e8f0" }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginLeft: 4, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: 1 }}>Message to Admin (Optional)</label>
                  <textarea className="glass-input" placeholder="Any special instructions or deal details..." value={advMessage} onChange={(e) => setAdvMessage(e.target.value)} rows={3} style={{ resize: "vertical", padding: "16px 20px", borderRadius: 16, fontSize: 15, background: "white", border: "1px solid #e2e8f0", width: "100%" }} />
                </div>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 16, padding: "16px", fontSize: 13, color: "#065f46" }}>
                  💡 <strong>How it works:</strong> Submit your request → Admin reviews it → If approved, your banner goes live on the selected slot for your requested duration. Contact us at dresho.business@gmail.com for pricing.
                </div>
                <button className="auth-btn-primary" onClick={submitBannerRequest} disabled={advSubmitting} style={{ borderRadius: 16, height: 56, fontSize: 16, background: "var(--navy)" }}>
                  {advSubmitting ? "Submitting..." : "📢 Submit Banner Request"}
                </button>
              </div>

              {/* My Past Requests */}
              {myBannerRequests.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, color: "var(--navy)" }}>My Banner Requests</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {myBannerRequests.map((req) => {
                      const statusStyles = { pending: { bg: "#fef3c7", color: "#d97706" }, approved: { bg: "#d1fae5", color: "#059669" }, rejected: { bg: "#ffe4e6", color: "#e11d48" } };
                      const sc = statusStyles[req.status] || statusStyles.pending;
                      return (
                        <div key={req.id} className="premium-card" style={{ padding: "18px", borderRadius: 20, cursor: "default", background: "white", border: "1px solid #e2e8f0" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>Slot {req.slot} — {req.title || "(No title)"}</div>
                            <span style={{ padding: "4px 12px", borderRadius: 10, fontSize: 11, fontWeight: 800, background: sc.bg, color: sc.color, textTransform: "uppercase" }}>{req.status}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{req.durationDays} days · {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : ""}</div>
                          {req.status === "rejected" && req.rejectionReason && (
                            <div style={{ fontSize: 12, color: "#e11d48", marginTop: 8, padding: 8, background: "#fff1f2", borderRadius: 8 }}>Reason: {req.rejectionReason}</div>
                          )}
                          {req.status === "approved" && (
                            <div style={{ fontSize: 12, color: "#059669", marginTop: 8, padding: 8, background: "#ecfdf5", borderRadius: 8 }}>✅ Live for {req.durationDays} days on Slot {req.assignedSlot || req.slot}</div>
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
                <div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                    {pImagePreviews.map((preview, idx) => (
                      <div key={idx} style={{ position: "relative", width: 80, height: 80, borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                        <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button onClick={() => removeImage(idx)} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.5)", color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>
                          <i className="fas fa-times" />
                        </button>
                      </div>
                    ))}
                    {pImagePreviews.length < 5 && (
                      <div onClick={() => document.getElementById("pImageInput").click()} style={{ width: 80, height: 80, borderRadius: 16, border: "2px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#f8fafc", color: "#94a3b8", flexDirection: "column" }}>
                        <i className="fas fa-plus" style={{ fontSize: 20, marginBottom: 4 }} />
                        <span style={{ fontSize: 10, fontWeight: 700 }}>{pImagePreviews.length}/5</span>
                      </div>
                    )}
                  </div>
                  <input type="file" id="pImageInput" accept="image/*" multiple style={{ display: "none" }} onChange={handleImageSelect} />
                </div>

                <input className="glass-input" placeholder="Product Name" value={pName} onChange={(e) => setPName(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15, background: "white", border: "1px solid #e2e8f0" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input className="glass-input" type="number" placeholder="Price (₹)" value={pPrice} onChange={(e) => setPPrice(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15, background: "white", border: "1px solid #e2e8f0" }} />
                  <input className="glass-input" type="number" placeholder="Stock Qty" value={pStock} onChange={(e) => setPStock(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15, background: "white", border: "1px solid #e2e8f0" }} />
                </div>

                <select className="glass-input" value={pCategory} onChange={(e) => setPCategory(e.target.value)} style={{ padding: "16px 20px", borderRadius: 16, fontSize: 15, background: "white", border: "1px solid #e2e8f0", cursor: "pointer" }}>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>

                {/* Size toggles — show standard sizes for clothing, numeric for footwear */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, letterSpacing: 1 }}>AVAILABLE SIZES</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(pCategory === "Footwear"
                      ? ["4", "5", "6", "7", "8", "9", "10", "11", "12"]
                      : ["XS", "S", "M", "L", "XL", "XXL"]
                    ).map((size) => (
                      <button key={size} onClick={() => toggleSize(size)} style={{
                        width: 46, height: 46, borderRadius: 12, fontSize: 13, fontWeight: 700,
                        background: pSizes.includes(size) ? "var(--gold)" : "white",
                        color: pSizes.includes(size) ? "white" : "var(--text-muted)",
                        border: pSizes.includes(size) ? "none" : "1px solid #e2e8f0",
                        cursor: "pointer", transition: "all 0.2s"
                      }}>
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category-specific measurements */}
                {(() => {
                  const setM = (key, val) => setPMeasurements(prev => ({ ...prev, [key]: val }));
                  const inputStyle = { padding: "12px 14px", borderRadius: 12, fontSize: 14, background: "white", border: "1px solid #e2e8f0", width: "100%", outline: "none" };
                  const label = (txt) => <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: 1 }}>{txt}</p>;

                  if (pCategory === "Footwear") return (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, letterSpacing: 1 }}>👟 FOOTWEAR MEASUREMENTS</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                        <div>{label("FOOT LENGTH (cm)")} <input style={inputStyle} placeholder="e.g. 25.1, 25.6, 26.4 (comma separated for each size)" value={pMeasurements.footLength || ""} onChange={e => setM("footLength", e.target.value)} /></div>
                      </div>
                    </div>
                  );

                  if (["Casual", "Formal"].includes(pCategory) && pName.toLowerCase().includes("jean") || pName.toLowerCase().includes("trouser") || pName.toLowerCase().includes("pant")) return (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, letterSpacing: 1 }}>👖 BOTTOM WEAR MEASUREMENTS</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>{label("WAIST (inches)")} <input style={inputStyle} placeholder="e.g. 30" value={pMeasurements.waist || ""} onChange={e => setM("waist", e.target.value)} /></div>
                        <div>{label("LENGTH (inches)")} <input style={inputStyle} placeholder="e.g. 32" value={pMeasurements.length || ""} onChange={e => setM("length", e.target.value)} /></div>
                        <div>{label("HIP (cm)")} <input style={inputStyle} placeholder="e.g. 90" value={pMeasurements.hip || ""} onChange={e => setM("hip", e.target.value)} /></div>
                        <div>{label("RISE (inches)")} <input style={inputStyle} placeholder="e.g. 10" value={pMeasurements.rise || ""} onChange={e => setM("rise", e.target.value)} /></div>
                      </div>
                    </div>
                  );

                  if (["Men's Wear", "Women's Wear", "Kids Wear", "Ethnic", "Casual", "Formal"].includes(pCategory)) return (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, letterSpacing: 1 }}>👕 CLOTHING MEASUREMENTS</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>{label("CHEST (inches)")} <input style={inputStyle} placeholder="e.g. 38" value={pMeasurements.chest || ""} onChange={e => setM("chest", e.target.value)} /></div>
                        <div>{label("WAIST (inches)")} <input style={inputStyle} placeholder="e.g. 32" value={pMeasurements.waist || ""} onChange={e => setM("waist", e.target.value)} /></div>
                        <div>{label("SHOULDER (cm)")} <input style={inputStyle} placeholder="e.g. 44" value={pMeasurements.shoulder || ""} onChange={e => setM("shoulder", e.target.value)} /></div>
                        <div>{label("LENGTH (cm)")} <input style={inputStyle} placeholder="e.g. 70" value={pMeasurements.length || ""} onChange={e => setM("length", e.target.value)} /></div>
                        {pCategory === "Kids Wear" && <div>{label("AGE GROUP")} <input style={inputStyle} placeholder="e.g. 5-7 Years" value={pMeasurements.ageGroup || ""} onChange={e => setM("ageGroup", e.target.value)} /></div>}
                      </div>
                    </div>
                  );

                  if (pCategory === "Accessories") return (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, letterSpacing: 1 }}>💍 ACCESSORY DIMENSIONS</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>{label("WIDTH (cm)")} <input style={inputStyle} placeholder="e.g. 5" value={pMeasurements.width || ""} onChange={e => setM("width", e.target.value)} /></div>
                        <div>{label("HEIGHT (cm)")} <input style={inputStyle} placeholder="e.g. 3" value={pMeasurements.height || ""} onChange={e => setM("height", e.target.value)} /></div>
                        <div style={{ gridColumn: "1/-1" }}>{label("MATERIAL")} <input style={inputStyle} placeholder="e.g. Sterling Silver, Leather" value={pMeasurements.material || ""} onChange={e => setM("material", e.target.value)} /></div>
                      </div>
                    </div>
                  );

                  return null;
                })()}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button className="auth-btn-ghost" style={{ flex: 1, borderRadius: 16, height: 50 }} onClick={() => setShowModal(false)}>Cancel</button>
                <button className="auth-btn-primary" style={{ flex: 1, borderRadius: 16, height: 50, background: "var(--navy)" }} onClick={saveProduct} disabled={uploading}>
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

