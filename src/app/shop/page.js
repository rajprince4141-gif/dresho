"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, getDocs, collection, query, where,
  onSnapshot, addDoc, updateDoc, orderBy, arrayUnion, arrayRemove, increment, writeBatch,
} from "firebase/firestore";
import { requestNotificationPermission } from "@/lib/firebase";
import dynamicImport from "next/dynamic";
import NotificationBell from "@/components/NotificationBell";
import ReturnModal from "@/components/shop/ReturnModal";

// Custom Hooks
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";

const LiveMap = dynamicImport(() => import("@/components/LiveMap"), { ssr: false });

// Modern Modular Utilities
import { formatAddress } from "@/utils/formatters";
import { getRoadDistance } from "@/utils/distanceCalculator";
import { generateInvoicePDF } from "@/utils/invoiceGenerator";
import { isValidPincode, isValidPhone } from "@/utils/validators";
import { APP_CONFIG, ADMIN_EMAILS } from "@/utils/constants";

// Fail-safe premium Product Image Thumbnail with dynamic search & smart HSL fallbacks
function ProductImageThumbnail({ item, products, size = 64 }) {
  const [hasError, setHasError] = useState(false);

  // Normalize string for robust, fuzzier comparison
  const cleanName = (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .split(",")[0]
      .split("-")[0]
      .split("|")[0]
      .trim()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ");
  };

  const resolvedUrl = (() => {
    if (item.image) return item.image;
    
    const iClean = cleanName(item.name);
    if (iClean && products && products.length > 0) {
      const match = products.find(p => {
        const pClean = cleanName(p.name);
        return pClean === iClean || pClean.includes(iClean) || iClean.includes(pClean);
      });
      if (match) {
        return match.image || match.imageUrl || match.images?.[0] || match.imageUrls?.[0] || "";
      }
    }
    return "";
  })();

  const getElegantBg = (name) => {
    if (!name) return { bg: "hsl(210, 20%, 96%)", text: "hsl(210, 10%, 40%)" };
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return {
      bg: `hsl(${h}, 50%, 95%)`,
      text: `hsl(${h}, 65%, 25%)`
    };
  };

  const nameInitial = item.name ? item.name.charAt(0).toUpperCase() : "P";
  const colors = getElegantBg(item.name);

  if (resolvedUrl && !hasError) {
    return (
      <img
        src={resolvedUrl}
        alt={item.name || "Product"}
        onError={() => setHasError(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transition: "transform 0.4s ease",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: colors.bg,
        color: colors.text,
        fontSize: size === 64 ? 16 : 20,
        fontWeight: 800,
        fontFamily: "var(--font-d), Georgia, serif",
        position: "relative",
        userSelect: "none",
        boxSizing: "border-box",
        padding: 4
      }}
    >
      <span style={{ transform: "translateY(1px)" }}>{nameInitial}</span>
      <i 
        className="fas fa-tag" 
        style={{ 
          position: "absolute", 
          bottom: 4, 
          right: 4, 
          fontSize: size === 64 ? 8 : 10, 
          opacity: 0.5 
        }} 
      />
    </div>
  );
}

/* ═══════════════════════════════════════
   Dresho — Customer Shopping Experience
   Fashion, Delivered instantly.
   ═══════════════════════════════════════ */
export default function ShopPage() {
  // ── Auth State ──
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showTCModal, setShowTCModal] = useState(false);
  const { user, userData, loading: authLoadingState, logout, setUserData } = useAuth("user");
  const [authLoading, setAuthLoading] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [fbRating, setFbRating] = useState(0);
  const [fbText, setFbText] = useState("");
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const router = useRouter();

  // ── App State ──
  const [currentSection, setCurrentSection] = useState("home");
  const { products } = useProducts();
  const [currentCategory, setCurrentCategory] = useState("All");
  const { cart, setCart, addToCart, changeQty, clearCart, cartTotal, cartCount } = useCart(user, setShowAuth);
  const { orders } = useOrders({ userId: user?.uid });
  const [riderLocations, setRiderLocations] = useState({});
  const [viewProduct, setViewProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [pincode, setPincode] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState(null);
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  
  // ── Reviews ──
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, text: "", title: "" });

  // ── Checkout ──
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [checkoutLandmark, setCheckoutLandmark] = useState("");
  const [checkoutCity, setCheckoutCity] = useState("");
  const [checkoutPincode, setCheckoutPincode] = useState("");
  const [checkoutCoordinates, setCheckoutCoordinates] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("COD"); // COD | UPI
  const [placing, setPlacing] = useState(false);

  // Address Management
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [newAddrLine, setNewAddrLine] = useState("");
  const [newAddrLandmark, setNewAddrLandmark] = useState("");
  const [newAddrCity, setNewAddrCity] = useState("");
  const [newAddrPincode, setNewAddrPincode] = useState("");

  // ── Returns/Availability States ──
  const [showReturnRequestModal, setShowReturnRequestModal] = useState(false);
  const [returnOrderId, setReturnOrderId] = useState(null);
  const [returnType, setReturnType] = useState("RETURN"); // RETURN or EXCHANGE
  const [returnReason, setReturnReason] = useState("");
  const [returnRemarks, setReturnRemarks] = useState("");

  const [sellers, setSellers] = useState({});
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "sellers_profile"), (snap) => {
      const s = {};
      snap.forEach((doc) => {
        s[doc.id] = doc.data();
      });
      setSellers(s);
    });
    return () => unsub();
  }, []);

  const isEligibleForReturnOrExchange = (o) => {
    if (!o) return false;
    const status = o.status?.toUpperCase();
    if (status !== "DELIVERED") return false;
    if (o.deliveredAt) {
      const deliveredTime = o.deliveredAt.seconds 
        ? o.deliveredAt.seconds * 1000 
        : new Date(o.deliveredAt).getTime();
      return (Date.now() - deliveredTime) <= 24 * 60 * 60 * 1000;
    }
    return false;
  };

  const isProductOutOfOrder = (p) => {
    if (!p) return false;
    const seller = sellers[p.sellerId];
    return seller ? seller.isShopOpen === false : false;
  };

  const hasOutOfOrderItems = cart.some(item => isProductOutOfOrder(item));

  const [loaded, setLoaded] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ h: "04", m: "32", s: "17" });
  const [heroBanners, setHeroBanners] = useState([]);

  // ── Banners Listener — Admin-controlled hero slides ──
  useEffect(() => {
    const bannerIds = ["banner_1", "banner_2", "banner_3", "banner_4", "banner_5"];
    const unsubs = bannerIds.map((id) =>
      onSnapshot(doc(db, "banners", id), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          // Check if banner has not expired
          const expired = d.expiry && new Date(d.expiry) < new Date();
          if (!expired && d.imageUrl) {
            setHeroBanners((prev) => {
              const filtered = prev.filter((b) => b.id !== id);
              return [...filtered, { id, ...d }].sort((a, b) => a.id.localeCompare(b.id));
            });
          } else {
            setHeroBanners((prev) => prev.filter((b) => b.id !== id));
          }
        } else {
          setHeroBanners((prev) => prev.filter((b) => b.id !== id));
        }
      })
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  // ── Auto-Slide Logic for Hero Banners ──
  useEffect(() => {
    const total = heroBanners.length > 0 ? heroBanners.length : 3;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev >= total - 1 ? 0 : prev + 1));
    }, 4000);
    return () => clearInterval(interval);
  }, [heroBanners.length]);

  useEffect(() => {
    let end = new Date().getTime() + 4 * 3600000 + 32 * 60000 + 17000;
    const timer = setInterval(() => {
      let diff = end - new Date().getTime();
      if (diff < 0) { end = new Date().getTime() + 8 * 3600000; return; }
      let h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({
        h: String(h).padStart(2, '0'),
        m: String(m).padStart(2, '0'),
        s: String(s).padStart(2, '0')
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem("dreshoFavorites");
      if (savedFavs) {
        setFavorites(JSON.parse(savedFavs));
      }
    } catch (e) {}
  }, []);

  const toggleFavorite = (product) => {
    let newFavs;
    if (favorites.find(f => f.id === product.id)) {
      newFavs = favorites.filter(f => f.id !== product.id);
    } else {
      newFavs = [...favorites, product];
    }
    setFavorites(newFavs);
    localStorage.setItem("dreshoFavorites", JSON.stringify(newFavs));
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const checkDeliveryAvailability = async () => {
    if (!pincode || pincode.length !== 6) {
      setPincodeStatus({ type: "error", msg: "Enter a valid 6-digit pincode." });
      return;
    }
    setCheckingPincode(true);
    setPincodeStatus(null);
    try {
      // Step 1: Geocode the customer's pincode to lat/lng
      const res = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json`);
      const geoData = await res.json();

      if (!geoData || geoData.length === 0) {
        setPincodeStatus({ type: "error", msg: "Invalid pincode or location not found." });
        setCheckingPincode(false);
        return;
      }

      const custLat = parseFloat(geoData[0].lat);
      const custLng = parseFloat(geoData[0].lon);

      // Step 2: Check if any ONLINE rider is within 4km of the customer's pincode
      const riderQuery = query(collection(db, "delivery_profile"), where("online", "==", true));
      const riderSnap = await getDocs(riderQuery);

      let riderNearby = false;
      riderSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.liveLocation?.lat && data.liveLocation?.lng) {
          const dist = calculateDistance(custLat, custLng, data.liveLocation.lat, data.liveLocation.lng);
          if (dist <= 4) riderNearby = true;
        }
      });

      if (!riderNearby) {
        setPincodeStatus({ type: "error", msg: `No riders available near ${pincode} right now. Try again later.` });
        setCheckingPincode(false);
        return;
      }

      // Step 3: Get the current product's seller location to calculate delivery time
      let deliveryMins = 45; // default fallback
      const sellerId = viewProduct?.sellerId;
      if (sellerId) {
        try {
          const sellerDoc = await getDoc(doc(db, "sellers_profile", sellerId));
          if (sellerDoc.exists() && sellerDoc.data().coordinates) {
            const [sellLat, sellLng] = sellerDoc.data().coordinates.split(",").map(Number);
            if (sellLat && sellLng) {
              // Distance from seller to customer (with 1.3x road factor)
              const distKm = calculateDistance(sellLat, sellLng, custLat, custLng) * 1.3;
              // Avg city speed: 25 km/h → distKm / 25 * 60 mins
              const travelMins = Math.round((distKm / 25) * 60);
              const packingMins = 5; // packing time
              deliveryMins = travelMins + packingMins;
              // Clamp: min 10 mins, max 90 mins
              deliveryMins = Math.max(10, Math.min(90, deliveryMins));
            }
          }
        } catch (_) {}
      }

      setPincodeStatus({
        type: "success",
        msg: `✅ Deliverable to ${pincode}! Estimated delivery: ~${deliveryMins} mins.`,
      });
    } catch (e) {
      setPincodeStatus({ type: "error", msg: "Failed to check delivery availability." });
    }
    setCheckingPincode(false);
  };


  const submitReview = async () => {
    if (!user) {
      alert("Please login to submit a review.");
      return setShowCheckout(true);
    }
    if (!reviewForm.text.trim()) return alert("Please write a review.");
    
    try {
      const newReview = {
        authorName: user.displayName || user.email?.split("@")[0] || "Customer",
        authorId: user.uid,
        rating: reviewForm.rating,
        title: reviewForm.title,
        text: reviewForm.text,
        date: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })
      };
      
      const productRef = doc(db, "products", viewProduct.id);
      await updateDoc(productRef, {
        reviews: arrayUnion(newReview)
      });
      
      setViewProduct(prev => ({ ...prev, reviews: [newReview, ...(prev.reviews || [])] }));
      setShowReviewModal(false);
      setReviewForm({ rating: 5, text: "", title: "" });
      alert("Review submitted successfully! Thank you.");
    } catch(e) {
      alert("Failed to submit review.");
    }
  };

  // Sync loaded state with hook authentication loading
  useEffect(() => {
    if (!authLoadingState) {
      setLoaded(true);
    }
  }, [authLoadingState]);

  // Pre-fill admin email if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dreshoSavedEmail");
      if (saved) setAdminEmail(saved);
    }
  }, []);

  // ── Intersection Observer for Animations ──
  useEffect(() => {
    if (currentSection !== "home") return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if(e.isIntersecting) {
          e.target.classList.add('in');
        }
      });
    }, { threshold: 0.1 });
    // Small timeout to ensure DOM is ready
    const timer = setTimeout(() => {
      const els = document.querySelectorAll('.reveal');
      els.forEach(el => observer.observe(el));
    }, 100);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [currentSection, loaded, products]);

  // ── Rider Location Tracking ──
  useEffect(() => {
    if (!orders || orders.length === 0) return;
    const activeRiders = new Set();
    orders.forEach(o => {
      if (o.status === "Out for Delivery" && o.riderId) {
        activeRiders.add(o.riderId);
      }
    });

    if (activeRiders.size === 0) return;

    const unsubs = [];
    activeRiders.forEach(riderId => {
      const unsub = onSnapshot(doc(db, "delivery_profile", riderId), (docSnap) => {
        if (docSnap.exists()) {
          setRiderLocations(prev => ({
            ...prev,
            [riderId]: docSnap.data().liveLocation || null
          }));
        }
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(fn => fn());
  }, [orders]);

  // ── Setup Recaptcha ──
  // ── Google Sign-In for customers ──
  const handleGoogleSignIn = async (hintEmail = null) => {
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      if (typeof hintEmail === "string" && hintEmail.includes("@")) {
        provider.setCustomParameters({ login_hint: hintEmail });
      }
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      const snap = await getDoc(doc(db, "users", u.uid));
      if (!snap.exists()) {
        await setDoc(doc(db, "users", u.uid), {
          name: u.displayName || "",
          email: u.email || "",
          phone: "",
          role: "user",
        });
      } else if (snap.data().role !== "user") {
        await signOut(auth);
        alert("This account is not registered as a customer.");
        setAuthLoading(false);
        return;
      }
      setShowAuth(false);
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user") alert("Sign-in failed: " + e.message);
    }
    setAuthLoading(false);
  };

  const handleAdminLogin = async () => {
    const configAdminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS
      ? process.env.NEXT_PUBLIC_ADMIN_EMAILS.split(",").map(e => e.trim().toLowerCase())
      : ADMIN_EMAILS.map(e => e.toLowerCase());

    if (!configAdminEmails.includes(adminEmail.trim().toLowerCase())) {
      return alert("Unauthorized: this email is not on the admin list.");
    }
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPass);
      setShowAuth(false);
      router.push("/admin");
    } catch (e) {
      const msg = (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential")
        ? "Wrong email or password." : e.message;
      alert("Login failed: " + msg);
    }
    setAuthLoading(false);
  };

  // ── Address Management ──
  const handleAddAddress = async () => {
    if (!newAddrLine.trim() || !newAddrCity.trim() || !newAddrPincode.trim()) {
      return alert("Please fill required address fields.");
    }
    if (!isValidPincode(newAddrPincode)) {
      return alert("Please enter a valid 6-digit PIN code.");
    }
    try {
      const newAddr = {
        id: Date.now().toString(),
        line: newAddrLine.trim(),
        landmark: newAddrLandmark.trim(),
        city: newAddrCity.trim(),
        pincode: newAddrPincode.trim()
      };
      
      let updatedAddresses = userData.addresses || [];
      if (!updatedAddresses.length && userData.address) {
        updatedAddresses = [{ id: "default", ...userData.address }];
      }
      updatedAddresses.push(newAddr);
      
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, { addresses: updatedAddresses, address: newAddr }); // Set new address as active (address)
      
      setUserData({ ...userData, addresses: updatedAddresses, address: newAddr });
      setShowAddAddressForm(false);
      setNewAddrLine(""); setNewAddrLandmark(""); setNewAddrCity(""); setNewAddrPincode("");
    } catch (e) {
      alert("Error adding address: " + e.message);
    }
  };

  const handleSelectAddress = async (addr) => {
    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, { address: addr }); // Sets the active selected address
      setUserData({ ...userData, address: addr });
      setShowAddressModal(false);
    } catch (e) {
      alert("Error selecting address: " + e.message);
    }
  };



  // ── Place Order ──
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => getRoadDistance(lat1, lon1, lat2, lon2);

  const fetchCustomerLocation = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported by your browser.");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const custLat = pos.coords.latitude;
        const custLon = pos.coords.longitude;
        setCheckoutCoordinates(`${custLat}, ${custLon}`);
        
        // Dynamic Delivery Fee Calculation
        const sellerId = cart[0]?.sellerId;
        if (sellerId) {
          try {
            const sellerDoc = await getDoc(doc(db, "sellers_profile", sellerId));
            if (sellerDoc.exists() && sellerDoc.data().coordinates) {
              const [sellLat, sellLon] = sellerDoc.data().coordinates.split(",").map(Number);
              const distanceKm = getDistanceFromLatLonInKm(custLat, custLon, sellLat, sellLon);
              
              let fee = 20; // 0.5 to 1km = 20
              if (distanceKm > 1 && distanceKm <= 2) fee = 30; // 1 to 2km = 30
              else if (distanceKm > 2) fee = 40; // > 2km = 40

              const totalItems = cart.reduce((sum, i) => sum + i.qty, 0);
              if (totalItems > 3) fee = fee / 2; // 50% discount

              setDeliveryFee(fee);
            } else { setDeliveryFee(40); }
          } catch(e) { console.error(e); setDeliveryFee(40); }
        }
      },
      () => alert("Unable to retrieve location. Please allow location access.")
    );
  };

  const placeOrder = async () => {
    if (!checkoutAddress || !checkoutPhone) return alert("Fill all delivery details.");
    if (!isValidPhone(checkoutPhone)) return alert("Please enter a valid 10-digit mobile number.");
    if (!checkoutCoordinates) return alert("Please Pin Your Delivery Location first!");
    setPlacing(true);
    try {
      const otp = Math.floor(1000 + Math.random() * 9000);
      const trackingId = "DR" + Date.now().toString().slice(-6);
      const sellerId = cart[0]?.sellerId || "";

      // Financial Engine Calculations
      const grandTotal = cartTotal + deliveryFee;
      const adminCommission = cartTotal * APP_CONFIG.COMMISSION_RATE;
      const sellerEarnings = cartTotal * (1 - APP_CONFIG.COMMISSION_RATE);

      if (paymentMethod === "UPI") {
        // ── Razorpay UPI / Card flow ──
        await new Promise((resolve, reject) => {
          const existingScript = document.getElementById("razorpay-script");
          if (existingScript) { resolve(); return; }
          const script = document.createElement("script");
          script.id = "razorpay-script";
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Razorpay SDK failed to load"));
          document.body.appendChild(script);
        });

        await new Promise((resolve, reject) => {
          const options = {
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_SfdWyoWv6wqHiT",
            amount: Math.round(grandTotal * 100) || 100,
            currency: "INR",
            name: "Dresho",
            description: `Order — ${cart.length} item(s)`,
            image: "/favicon.ico",
            prefill: {
              name: userData?.name || "",
              email: user?.email || "",
              contact: checkoutPhone,
            },
            theme: { color: "#6366f1" },
            handler: async (response) => {
              try {
                await addDoc(collection(db, "orders"), {
                  userId: user.uid,
                  userName: userData.name,
                  userAddress: formatAddress({ line: checkoutAddress, landmark: checkoutLandmark, city: checkoutCity, pincode: checkoutPincode }),
                  userCoordinates: checkoutCoordinates,
                  userPhone: checkoutPhone,
                  sellerId,
                  items: cart.map((i) => ({
                    name: i.name, qty: i.qty, price: i.price, size: i.selectedSize,
                    image: i.image || i.images?.[0] || "",
                  })),
                  cartTotal,
                  deliveryFee,
                  total: grandTotal,
                  adminCommission,
                  sellerEarnings,
                  status: "Pending",
                  paymentMethod: "UPI",
                  paymentStatus: "Paid",
                  paymentId: response.razorpay_payment_id,
                  trackingId,
                  deliveryOtp: otp,
                  riderId: null,
                  createdAt: new Date(),
                });

                // Direct in-app notification for customer
                await addDoc(collection(db, "notifications"), {
                  userId: user.uid,
                  role: "customer",
                  title: "Order Placed Successfully",
                  body: `Your order #${trackingId} has been placed successfully.`,
                  link: "/shop?section=orders",
                  read: false,
                  createdAt: new Date().toISOString(),
                });

                // Direct in-app notification for seller
                if (sellerId) {
                  await addDoc(collection(db, "notifications"), {
                    userId: sellerId,
                    role: "seller",
                    title: "New Order Received!",
                    body: `You have a new order from ${userData?.name}. Open your dashboard now!`,
                    link: "/seller",
                    read: false,
                    createdAt: new Date().toISOString(),
                  });
                }

                // Notify customer via Central Engine
                fetch("/api/notify", { 
                  method: "POST", 
                  headers: { "Content-Type": "application/json" }, 
                  body: JSON.stringify({ 
                    userId: user.uid, 
                    role: "customer",
                    title: "Order Placed Successfully", 
                    body: `Your order #${trackingId} has been placed successfully.`,
                    link: "/shop?section=orders"
                  }) 
                });

                // Notify seller via Central Engine
                if (sellerId) {
                  fetch("/api/notify", { 
                    method: "POST", 
                    headers: { "Content-Type": "application/json" }, 
                    body: JSON.stringify({ 
                      userId: sellerId, 
                      role: "seller",
                      title: "New Order Received!", 
                      body: `You have a new order from ${userData?.name}. Open your dashboard now!`,
                      link: "/seller"
                    }) 
                  });
                }

                await setDoc(doc(db, "users", user.uid), { address: { line: checkoutAddress, landmark: checkoutLandmark, city: checkoutCity, pincode: checkoutPincode }, phone: checkoutPhone }, { merge: true });
                setUserData((prev) => ({ ...prev, address: { line: checkoutAddress, landmark: checkoutLandmark, city: checkoutCity, pincode: checkoutPincode }, phone: checkoutPhone }));
                setCart([]);
                setShowCheckout(false);
                setCurrentSection("orders");
                alert(`✅ Payment successful!\nOrder placed. Payment ID: ${response.razorpay_payment_id}`);
                resolve();
              } catch (e) { reject(e); }
            },
            modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
          };
          const rzp = new window.Razorpay(options);
          rzp.on("payment.failed", (resp) => reject(new Error(resp.error?.description || "Payment failed")));
          rzp.open();
        });

        setPlacing(false);
        return;
      }

      await addDoc(collection(db, "orders"), {
        userId: user.uid,
        userName: userData.name,
        userAddress: formatAddress({ line: checkoutAddress, landmark: checkoutLandmark, city: checkoutCity, pincode: checkoutPincode }),
        userCoordinates: checkoutCoordinates,
        userPhone: checkoutPhone,
        sellerId,
        items: cart.map((i) => ({
          name: i.name, qty: i.qty, price: i.price, size: i.selectedSize,
          image: i.image || i.images?.[0] || "",
        })),
        cartTotal,
        deliveryFee,
        total: grandTotal,
        adminCommission,
        sellerEarnings,
        status: "Pending",
        paymentMethod: "COD",
        paymentStatus: "Pending",
        trackingId,
        deliveryOtp: otp,
        riderId: null,
        createdAt: new Date(),
      });

      // Direct in-app notification for customer
      await addDoc(collection(db, "notifications"), {
        userId: user.uid,
        role: "customer",
        title: "Order Placed Successfully",
        body: `Your COD order #${trackingId} has been placed successfully.`,
        link: "/shop?section=orders",
        read: false,
        createdAt: new Date().toISOString(),
      });

      // Direct in-app notification for seller
      if (sellerId) {
        await addDoc(collection(db, "notifications"), {
          userId: sellerId,
          role: "seller",
          title: "New COD Order Received!",
          body: `You have a new COD order from ${userData?.name}. Open your dashboard now!`,
          link: "/seller",
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      // Notify customer (COD) via Central Engine
      fetch("/api/notify", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ 
          userId: user.uid, 
          role: "customer",
          title: "Order Placed Successfully", 
          body: `Your COD order #${trackingId} has been placed successfully.`,
          link: "/shop?section=orders"
        }) 
      });

      // Notify seller (COD) via Central Engine
      if (sellerId) {
        fetch("/api/notify", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ 
            userId: sellerId, 
            role: "seller",
            title: "New COD Order Received!", 
            body: `You have a new COD order from ${userData?.name}. Open your dashboard now!`,
            link: "/seller"
          }) 
        });
      }

      await setDoc(doc(db, "users", user.uid), { address: { line: checkoutAddress, landmark: checkoutLandmark, city: checkoutCity, pincode: checkoutPincode }, phone: checkoutPhone }, { merge: true });
      setUserData((prev) => ({ ...prev, address: { line: checkoutAddress, landmark: checkoutLandmark, city: checkoutCity, pincode: checkoutPincode }, phone: checkoutPhone }));
      setCart([]);
      setShowCheckout(false);
      setCurrentSection("orders");
      alert(`✅ Order placed! Your OTP: ${otp}\nPayment: Cash on Delivery`);
    } catch (e) { alert("Order failed: " + e.message); }
    setPlacing(false);
  };

  const RETURN_REASONS = [
    "Size fits too tight / too loose",
    "Quality of fabric/material is not as expected",
    "Received a completely different item/wrong style",
    "Product is defective/damaged",
    "Changed my mind/No longer needed"
  ];

  const EXCHANGE_REASONS = [
    "Need a different size (smaller/larger)",
    "Need a different color/pattern",
    "Item was damaged, send a fresh replacement",
    "Received a wrong size/color, replace with correct one"
  ];

  const handleReturnOrder = (orderId) => {
    setReturnOrderId(orderId);
    setReturnType("RETURN");
    setReturnReason("");
    setReturnRemarks("");
    setShowReturnRequestModal(true);
  };

  const handleExchangeOrder = (orderId) => {
    setReturnOrderId(orderId);
    setReturnType("EXCHANGE");
    setReturnReason("");
    setReturnRemarks("");
    setShowReturnRequestModal(true);
  };

  const submitReturnOrExchangeRequest = async () => {
    if (!returnReason) {
      alert("Please select a reason.");
      return;
    }
    const order = orders.find(o => o.id === returnOrderId);
    if (!order) return;

    try {
      const updateData = {
        status: returnType === "RETURN" ? "Return Requested" : "Exchange Requested",
        [returnType === "RETURN" ? "returnReason" : "exchangeReason"]: returnReason,
        [returnType === "RETURN" ? "returnRemarks" : "exchangeRemarks"]: returnRemarks,
        [returnType === "RETURN" ? "returnedAt" : "exchangedAt"]: new Date()
      };
      
      await setDoc(doc(db, "orders", returnOrderId), updateData, { merge: true });
      
      // Notify the seller in real-time
      if (order.sellerId) {
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "single",
            userId: order.sellerId,
            role: "seller",
            title: `New ${returnType === "RETURN" ? "Return" : "Exchange"} Request ⚠️`,
            body: `A customer has requested a ${returnType.toLowerCase()} for order #${order.trackingId}. Reason: ${returnReason}`,
            link: "/seller?tab=returns"
          })
        }).catch(err => console.error("Notification failed", err));
      }

      alert(`${returnType === "RETURN" ? "Return" : "Exchange"} request submitted successfully!`);
      setShowReturnRequestModal(false);
    } catch (e) {
      alert("Failed to submit request: " + e.message);
    }
  };

  const handleRateProduct = async (orderId) => {
    const rating = prompt("Rate your product from 1 to 5 stars:");
    if (!rating || isNaN(rating) || rating < 1 || rating > 5) return alert("Please enter a valid rating between 1 and 5.");
    const review = prompt("Any feedback you'd like to share? (Optional)");
    try {
      await setDoc(doc(db, "orders", orderId), { rating: Number(rating), review: review || "", ratedAt: new Date() }, { merge: true });
      alert("Thank you for your rating! ⭐");
    } catch (e) { alert("Failed to submit rating: " + e.message); }
  };

  const downloadInvoice = async (o) => {
    let sellerName = "Dresho Official";
    let sellerContact = "Fulfilled by Dresho Logistics";
    
    if (o.sellerId) {
      try {
        const snap = await getDoc(doc(db, "sellers_profile", o.sellerId));
        if (snap.exists()) {
          sellerName = snap.data().shopName || "Dresho Verified Seller";
          sellerContact = snap.data().phone || snap.data().email || "";
        }
      } catch (err) {
        console.error("Error fetching seller details for invoice:", err);
      }
    }
    
    await generateInvoicePDF(o, userData, { shopName: sellerName, contact: sellerContact });
  };

  const filteredProducts = currentCategory === "All" ? products : products.filter((p) => p.category === currentCategory);

  const categories = ["All", "Men's Wear", "Women's Wear", "Kids Wear", "Ethnic", "Casual", "Formal", "Accessories", "Footwear"];

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
  const authModal = (!user && showAuth) && (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(20,33,61,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {/* Invisible reCAPTCHA container — required by Firebase Phone Auth */}
      <div id="recaptcha-container" />
      <div className="animate-scale-in" style={{ width: "100%", maxWidth: 400, background: "var(--white)", border: "1px solid var(--border)", padding: "44px 36px", boxShadow: "var(--shadow-lg)", position: "relative" }}>
        <button onClick={() => { setShowAuth(false); setIsAdminLogin(false); }} style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--sub)" }}>×</button>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontFamily: "var(--font-d)", fontSize: 36, fontWeight: 400, color: "var(--navy)", letterSpacing: 2, margin: 0 }}>Dres<span style={{ color: "var(--gold)" }}>h</span>o</h1>
          <p style={{ color: "var(--sub)", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginTop: 6 }}>{isAdminLogin ? "Admin Access" : "Fashion in 30 Minutes"}</p>
        </div>

        {/* ── CUSTOMER: Google Sign-In ── */}
        {!isAdminLogin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {typeof window !== "undefined" && localStorage.getItem("dreshoSavedEmail") && (
              <button
                onClick={() => handleGoogleSignIn(localStorage.getItem("dreshoSavedEmail"))}
                disabled={authLoading}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", padding: "14px 20px", border: "none", background: "var(--navy)", color: "white", cursor: authLoading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-b)" }}
              >
                Continue as {localStorage.getItem("dreshoSavedEmail")}
              </button>
            )}
            <button
              onClick={() => handleGoogleSignIn()}
              disabled={authLoading}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", padding: "14px 20px", border: "1.5px solid var(--border2)", background: "var(--white)", cursor: authLoading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, color: "var(--navy)", fontFamily: "var(--font-b)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {typeof window !== "undefined" && localStorage.getItem("dreshoSavedEmail") ? "Sign In with a different account" : (authLoading ? "Signing in…" : "Continue with Google")}
            </button>
            <p style={{ textAlign: "center", fontSize: 11, color: "var(--sub)", margin: 0, lineHeight: 1.6 }}>
              By continuing you agree to Dresho&apos;s Terms of Use.
            </p>
            <div style={{ textAlign: "center" }}>
              <button onClick={() => setIsAdminLogin(true)} style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", borderBottom: "1px solid var(--gold)" }}>
                Admin? Login Here
              </button>
            </div>
          </div>
        )}

        {/* ── ADMIN: Email + Password ── */}
        {isAdminLogin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input
              type="email" placeholder="Admin Email"
              value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
              style={{ padding: "12px 0", border: "none", borderBottom: "1px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, fontFamily: "var(--font-b)", color: "var(--navy)" }}
              autoFocus
            />
            <input
              type="password" placeholder="Password"
              value={adminPass} onChange={e => setAdminPass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
              style={{ padding: "12px 0", border: "none", borderBottom: "1px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, fontFamily: "var(--font-b)", color: "var(--navy)" }}
            />
            <button
              onClick={handleAdminLogin}
              disabled={authLoading || !adminEmail || !adminPass}
              style={{ background: "var(--navy)", color: "#fff", border: "none", padding: "14px", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: 500, cursor: "pointer", opacity: (!adminEmail || !adminPass || authLoading) ? 0.5 : 1 }}
            >
              {authLoading ? "Verifying…" : "Login as Admin"}
            </button>
            <div style={{ textAlign: "center" }}>
              <button onClick={() => setIsAdminLogin(false)} style={{ background: "none", border: "none", color: "var(--sub)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const submitFeedback = async () => {
    if (fbRating === 0 || !fbText.trim()) return alert("Please provide a rating and review text.");
    setFbSubmitting(true);
    try {
      await addDoc(collection(db, "feedback"), {
        userId: user?.uid || "anonymous",
        userName: userData?.name || "Guest",
        rating: fbRating,
        text: fbText,
        createdAt: new Date(),
      });
      alert("Thank you for your feedback!");
      setShowFeedback(false);
      setFbRating(0);
      setFbText("");
    } catch (e) { alert("Error submitting feedback: " + e.message); }
    setFbSubmitting(false);
  };

  // ══════════════════════════
  //   MAIN APP
  // ══════════════════════════
  return (
    <>
      {authModal}
      <div style={{ paddingBottom: 90, position: "relative", zIndex: 1, minHeight: "100vh", background: "var(--ivory)", color: "var(--text)" }}>

        {/* ── Top Announcement Strip ── */}
        <div className="top-strip">
          <div className="strip-track">
            {[1, 2].map((group) => (
              <div key={group} style={{ display: 'flex' }}>
                <div className="strip-item"><span>🚚 Free Delivery on Your First Order</span><div className="strip-dot"></div></div>
                <div className="strip-item"><span>⚡ 30 Min Express Delivery</span><div className="strip-dot"></div></div>
                <div className="strip-item"><span>🏷️ New Arrivals Every Week</span><div className="strip-dot"></div></div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main Navbar ── */}
        <nav className="shop-nav">
          <div className="nav-top">
            <div onClick={() => setCurrentSection("home")} className="nav-logo" style={{ cursor: "pointer" }}>
              Dres<span>h</span>o
            </div>
            
            <div className="nav-loc" onClick={() => { if(userData) setShowAddressModal(true); else setShowAuth(true); }} style={{ cursor: "pointer" }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor"/><circle cx="12" cy="9" r="2.5" fill="white" opacity=".8"/></svg>
              <div>
                <div style={{fontSize:10,color:"var(--muted)",letterSpacing:1}}>DELIVER TO</div>
                <strong>{userData?.address?.city ? `${userData.address.city} ${userData.address.pincode}` : "Select Address"}</strong>
              </div>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>

            <form className="search-bar" onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                router.push(`/shop/category/all?q=${encodeURIComponent(searchQuery.trim())}`);
              }
            }}>
              <select className="search-cat">
                <option>All</option>
                <option>Women</option>
                <option>Men</option>
                <option>Ethnic</option>
                <option>Kids</option>
              </select>
              <input 
                className="search-input" 
                type="text" 
                placeholder="Search for clothes, brands, occasions…" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="search-btn">🔍</button>
            </form>


            <div className="nav-actions">
              {user && <NotificationBell userId={user.uid} role={userData?.role || "customer"} />}
              {userData?.role === "user" && (
                <button onClick={() => setCurrentSection("orders")} className="nav-action-btn">
                  <span className="nav-action-icon">📦</span>
                  <span className="nav-action-label">Orders</span>
                </button>
              )}
              {user && (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "prinxadmin29@gmail.com,krishnaprakash0016@gmail.com").toLowerCase().split(",").map(e => e.trim()).includes(user.email?.toLowerCase()) && (
                <Link href="/admin">
                  <button className="btn-signin" style={{ background: "var(--gold)", color: "#fff", border: "none", fontSize: 11, padding: "8px 16px", letterSpacing: 1 }}>
                    🛡️ Admin Panel
                  </button>
                </Link>
              )}
              {userData?.role === "seller" && (
                <Link href="/seller">
                  <button className="btn-signin" style={{ background: "var(--gold)", color: "#fff", border: "none", fontSize: 11, padding: "8px 16px", letterSpacing: 1 }}>
                    🏪 Seller Panel
                  </button>
                </Link>
              )}
              {userData?.role === "delivery" && (
                <Link href="/delivery">
                  <button className="btn-signin" style={{ background: "var(--gold)", color: "#fff", border: "none", fontSize: 11, padding: "8px 16px", letterSpacing: 1 }}>
                    🛵 Rider Panel
                  </button>
                </Link>
              )}
              <button onClick={() => setCurrentSection("cart")} className="nav-action-btn">
                <span className="nav-action-icon">🛍{cart.length > 0 && <span className="nav-badge">{cart.length}</span>}</span>
                <span className="nav-action-label">Cart</span>
              </button>
              {!userData && (
                <button onClick={() => setShowAuth(true)} className="btn-signin">Sign In</button>
              )}
            </div>
          </div>
          
        </nav>

        {/* ── HOME ── */}
        {currentSection === "home" && (
          <div style={{ paddingBottom: 60 }}>
            
            {/* CATEGORY BOARD */}
            <div className="category-board-wrapper">
              <div className="category-board">
                <div className="nav-bottom">
                  <Link href="/shop/category/all" className={`nav-cat-link ${currentCategory === "All" || !currentCategory ? 'active' : ''}`} style={{cursor:"pointer"}}><span>✨</span> All Included</Link>
                  <Link href="/shop/category/womens-wear" className={`nav-cat-link ${currentCategory === "Women's Wear" ? 'active' : ''}`} style={{cursor:"pointer"}}><span>👗</span> Women</Link>
                  <Link href="/shop/category/mens-wear" className={`nav-cat-link ${currentCategory === "Men's Wear" ? 'active' : ''}`} style={{cursor:"pointer"}}><span>👔</span> Men</Link>
                  <Link href="/shop/category/ethnic" className={`nav-cat-link ${currentCategory === "Ethnic" ? 'active' : ''}`} style={{cursor:"pointer"}}><span>🥻</span> Ethnic</Link>
                  <Link href="/shop/category/kids-wear" className={`nav-cat-link ${currentCategory === "Kids Wear" ? 'active' : ''}`} style={{cursor:"pointer"}}><span>👶</span> Kids</Link>
                  <Link href="/shop/category/accessories" className={`nav-cat-link ${currentCategory === "Accessories" ? 'active' : ''}`} style={{cursor:"pointer"}}><span>💍</span> Accessories</Link>
                  <Link href="/shop/category/footwear" className={`nav-cat-link ${currentCategory === "Footwear" ? 'active' : ''}`} style={{cursor:"pointer"}}><span>👟</span> Footwear</Link>
                  {(!user || (userData?.role === "user" && !(process.env.NEXT_PUBLIC_ADMIN_EMAILS || "prinxadmin29@gmail.com,krishnaprakash0016@gmail.com").toLowerCase().includes(user?.email?.toLowerCase() || ""))) ? (
                    <Link href="/partner" style={{ marginLeft: "auto" }}>
                      <button className="nav-pill-btn">Become a Partner</button>
                    </Link>
                  ) : <div style={{ marginLeft: "auto" }}></div>}
                </div>

              </div>
            </div>

            {/* HERO BANNER — Dynamic from Firestore admin panel */}
            {(() => {
              const defaultSlides = [
                { id: "default_1", imageUrl: "/banners/banner_new.png", tag: "SPRING / SUMMER 2024", title: "Timeless Style,", subtitle: "Modern You", cta: "Explore Collection ➔", linkUrl: "/shop/category/men" },
                { id: "default_2", imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80", tag: "🥻 New Ethnic Collection", title: "Celebrate Every", subtitle: "Occasion", cta: "Shop Now", badge: "40% Off" },
                { id: "default_3", imageUrl: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=600&q=80", tag: "👔 Men's New In", title: "Dress Sharp.", subtitle: "Every Day.", cta: "Shop Now", badge: "Free Delivery" },
              ];
              const slides = heroBanners.length > 0 ? heroBanners : defaultSlides;
              const total = slides.length;
              const safeSlide = activeSlide >= total ? 0 : activeSlide;
              return (
                <div className="hero-banner" id="heroBanner">
                  <div className="hero-slides" style={{ transform: `translateX(-${safeSlide * 100}%)` }}>
                    {slides.map((slide, i) => (
                      <div 
                        key={slide.id} 
                        className={`hero-slide slide-${(i % 3) + 1}`} 
                        onClick={() => window.location.href = slide.linkUrl || '/shop/category/all'}
                        style={{ cursor: "pointer", background: i === 0 ? "#F3EBE1" : "" }}
                      >
                        <div className="slide-content">
                          {slide.tag && <div className="slide-tag"><span style={{ color: i === 0 ? "var(--navy)" : "" }}>{slide.tag}</span></div>}
                          <h1 className="slide-title" style={{ color: i === 0 ? "var(--navy)" : "" }}>
                            {slide.title || "Fashion in"}<br/><em>{slide.subtitle || "30 Minutes"}</em>
                          </h1>
                          {slide.subtitle && !slide.title && null}
                          <div className="slide-cta">
                            <button className="btn-slide-primary" onClick={(e) => { e.stopPropagation(); window.location.href = slide.linkUrl || '/shop/category/all'; }}>{slide.cta || "Shop Now"}</button>
                          </div>
                        </div>
                        <div className="slide-img-area" style={{ overflow: i === 0 ? "hidden" : "visible" }}>
                          <img 
                            src={slide.imageUrl} 
                            alt={slide.title || "Banner"} 
                            style={{ 
                              width: "100%", height: "380px", objectFit: "cover", 
                              objectPosition: "right top", 
                              borderRadius: i === 0 ? "0px" : "12px",
                              filter: i === 0 ? "none" : "",
                              transform: i === 0 ? "scale(1.5)" : "none",
                              transformOrigin: i === 0 ? "right center" : "center"
                            }} 
                            onError={(e) => { e.target.style.display = "none"; }} 
                          />
                          {slide.badge && <div className="slide-badge"><div className="slide-badge-num" style={{ fontSize: 18 }}>{slide.badge}</div></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="hero-arrow prev" onClick={() => setActiveSlide((p) => (p === 0 ? total - 1 : p - 1))}>‹</button>
                  <button className="hero-arrow next" onClick={() => setActiveSlide((p) => (p === total - 1 ? 0 : p + 1))}>›</button>
                  <div className="hero-dots">
                    {slides.map((_, i) => (
                      <button key={i} className={`hero-dot ${safeSlide === i ? "active" : ""}`} onClick={() => setActiveSlide(i)} />
                    ))}
                  </div>
                </div>
              );
            })()}


            {/* FLASH SALE COMING SOON */}
            <div className="flash-sale" style={{ justifyContent: "center", alignItems: "center" }}>
              <p className="flash-sale-txt">⚡ Flash Sales Coming Soon</p>
            </div>

            {/* NEW ARRIVALS */}
            <section className="section" id="shopProducts">
              <div className="sec-head reveal in">
                <div className="sec-head-left">
                  <div className="sec-eyebrow"><div className="sec-eyebrow-line"></div><span>Just In</span></div>
                  <h2 className="sec-title">New <em>Arrivals</em></h2>
                </div>
                <div className="sec-link" style={{ cursor: "pointer" }} onClick={() => setCurrentCategory("All")}>View All New Arrivals →</div>
              </div>
              
              <div className="deal-grid">
                {filteredProducts.length === 0 ? (
                  <p style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: "var(--sub)" }}>No products found</p>
                ) : (
                  filteredProducts.slice(0, 10).map((p, i) => (
                    <div key={p.id} className={`deal-card reveal in d${i}`} onClick={() => { setViewProduct(p); setSelectedSize(p.sizes?.[0] || "M"); }}>
                      <div className="deal-img-wrap">
                        <img src={p.image} alt={p.name} style={{ opacity: (p.outOfStock || p.stock === 0 || isProductOutOfOrder(p)) ? 0.4 : 1 }} onError={(e) => { e.target.style.display = "none"; }} />
                        {isProductOutOfOrder(p) ? (
                          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(239,68,68,0.85)", color: "white", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 900, zIndex: 10, letterSpacing: 1, whiteSpace: "nowrap", backdropFilter: "blur(2px)" }}>
                            OUT OF ORDER
                          </div>
                        ) : (p.outOfStock || p.stock === 0) ? (
                          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.6)", color: "white", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 900, zIndex: 10, letterSpacing: 1, whiteSpace: "nowrap", backdropFilter: "blur(2px)" }}>
                            OUT OF STOCK
                          </div>
                        ) : null}
                        <div className="deal-badge-wrap">
                          {p.stock > 0 && p.stock <= 5 && !p.outOfStock && !isProductOutOfOrder(p) && (
                            <span style={{ background: "#ef4444", color: "white", padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>Only {p.stock} left</span>
                          )}
                          {i === 0 && <span className="badge-new">New</span>}
                          {i === 1 && <span className="badge-hot">Hot</span>}
                          <span className="badge-off">−38%</span>
                        </div>
                        <button className="wishlist-btn">♡</button>
                        {!(p.outOfStock || p.stock === 0 || isProductOutOfOrder(p)) && (
                          <div className="deal-quick" onClick={(e) => { e.stopPropagation(); addToCart(p, p.sizes?.[0] || "M"); }}>⚡ Quick Add</div>
                        )}
                      </div>
                      <div className="deal-info">
                        <div className="deal-brand">{p.storeName || "DRESHO"}</div>
                        <div className="deal-name" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div className="deal-price-row"><span className="deal-price">₹{p.price}</span>{p.mrp && p.mrp > p.price && <><span className="deal-mrp">₹{p.mrp}</span><span className="deal-off">{Math.round(((p.mrp - p.price) / p.mrp) * 100)}% off</span></>}</div>
                        <div className="deal-delivery"><span className="green-dot"></span>Delivery in 30 min</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* SPACE RESERVED FOR NEW ARRIVALS */}
            <section className="section" style={{ minHeight: "80px" }}>
              {/* 
              <div className="sec-head reveal in">
                <div className="sec-head-left">
                  <div className="sec-eyebrow"><div className="sec-eyebrow-line"></div><span>Trending</span></div>
                  <h2 className="sec-title">What's <em>Hot</em> Right Now</h2>
                </div>
                <div className="sec-link" style={{ cursor: "pointer" }} onClick={() => setCurrentCategory("All")}>See All →</div>
              </div>
              <div className="trending-row">
                {filteredProducts.slice(5, 9).map((p, i) => (
                  <div key={p.id} className={`trend-card reveal in d${i}`} onClick={() => { setViewProduct(p); setSelectedSize(p.sizes?.[0] || "M"); }}>
                    <div className="trend-img">
                      <img src={p.image} alt={p.name} onError={(e) => { e.target.style.display = "none"; }} />
                    </div>
                    <div className="trend-info">
                      <div className="trend-brand">{p.storeName || "DRESHO"}</div>
                      <div className="trend-name" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      <div className="trend-price">₹{p.price}</div>
                      <div className="trend-delivery"><span className="green-dot"></span>28 min delivery</div>
                    </div>
                  </div>
                ))}
              </div>
              */}
            </section>

            {/* SHOP BY CATEGORY */}
            <section className="section section-bg">
              <div className="sec-head reveal in">
                <div className="sec-head-left">
                  <div className="sec-eyebrow"><div className="sec-eyebrow-line"></div><span>Browse</span></div>
                  <h2 className="sec-title">Shop by <em>Category</em></h2>
                </div>
                <div className="sec-link" style={{ cursor: "pointer" }} onClick={() => window.location.href='/shop/category/all'}>All Categories →</div>
              </div>
              <div className="cat-grid reveal in">
                <div className="cat-card" onClick={() => window.location.href='/shop/category/womens-wear'} style={{cursor:"pointer"}}><img src="https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=800&q=80" alt="Women" /><div className="cat-overlay"></div><div className="cat-arrow">→</div><div className="cat-content"><div className="cat-label">Explore</div><div className="cat-name">Women's<br/>Collection</div><div className="cat-count">1,240 styles</div></div></div>
                <div className="cat-card" onClick={() => window.location.href='/shop/category/mens-wear'} style={{cursor:"pointer"}}><img src="https://images.unsplash.com/photo-1617137968427-85924c800a22?w=600&q=80" alt="Men" /><div className="cat-overlay"></div><div className="cat-arrow">→</div><div className="cat-content"><div className="cat-label">Explore</div><div className="cat-name">Men's Wear</div><div className="cat-count">980 styles</div></div></div>
                <div className="cat-card" onClick={() => window.location.href='/shop/category/ethnic'} style={{cursor:"pointer"}}><img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80" alt="Ethnic" /><div className="cat-overlay"></div><div className="cat-arrow">→</div><div className="cat-content"><div className="cat-label">Explore</div><div className="cat-name">Ethnic & Fusion</div><div className="cat-count">2,100 styles</div></div></div>
                <div className="cat-card" onClick={() => window.location.href='/shop/category/kids-wear'} style={{cursor:"pointer", gridColumn:"span 2"}}><img src="https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&q=80" alt="Kids" /><div className="cat-overlay"></div><div className="cat-arrow">→</div><div className="cat-content"><div className="cat-label">Explore</div><div className="cat-name">Kids & Teen</div><div className="cat-count">450 styles</div></div></div>
              </div>
            </section>

            {/* MINI BANNERS */}
            <div style={{ padding: "0 40px 3px" }}>
              <div className="banner-pair">
                <Link href="/shop/category/womens-wear"><div className="mini-banner"><img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80" alt="Women Sale" /><div className="mini-banner-overlay"></div><div className="mini-banner-content"><div className="mini-banner-tag">Women's Special</div><div className="mini-banner-title">Up to 50%<br/>Off Today</div><button className="mini-banner-btn">Shop Now</button></div></div></Link>
                <Link href="/shop/category/mens-wear"><div className="mini-banner"><img src="https://images.unsplash.com/photo-1550246140-5119ae4790b8?w=900&q=80" alt="Men Sale" /><div className="mini-banner-overlay"></div><div className="mini-banner-content"><div className="mini-banner-tag">Men's Exclusive</div><div className="mini-banner-title">New Season<br/>Formals</div><button className="mini-banner-btn">Shop Now</button></div></div></Link>
              </div>
            </div>

            {/* HOW IT WORKS */}
            <section className="section how-section">
              <div className="sec-head reveal in" style={{ marginBottom: 48 }}>
                <div className="sec-head-left">
                  <div className="sec-eyebrow"><div className="sec-eyebrow-line"></div><span>The Process</span></div>
                  <h2 className="sec-title">How <em>Dresho</em> Works</h2>
                </div>
              </div>
              <div className="how-grid">
                <div className="how-card reveal in"><div className="how-num">01</div><div className="how-icon-wrap">📍</div><h3 className="how-title">Set Location</h3><p className="how-desc">Share your address and we instantly show real-time inventory from the nearest Dresho dark store in your city.</p><div className="how-time">⚡ Under 10 seconds</div></div>
                <div className="how-card reveal in d1"><div className="how-num">02</div><div className="how-icon-wrap">✨</div><h3 className="how-title">Browse & Pick</h3><p className="how-desc">Explore 500+ premium Indian and global brands. Filter by size, colour, occasion, and price to find your perfect look.</p><div className="how-time">✦ At your pace</div></div>
                <div className="how-card reveal in d2"><div className="how-num">03</div><div className="how-icon-wrap">💳</div><h3 className="how-title">Pay Securely</h3><p className="how-desc">Pay via UPI, card, net banking, or Cash on Delivery. Fully encrypted, 100% safe every single time.</p><div className="how-time">⚡ Under 5 seconds</div></div>
                <div className="how-card reveal in d3"><div className="how-num">04</div><div className="how-icon-wrap">🛵</div><h3 className="how-title">Delivered Fast</h3><p className="how-desc">Your order is picked, quality-checked, and delivered in a premium Dresho bag. In 30 minutes or we refund.</p><div className="how-time">⚡ 30 min guarantee</div></div>
              </div>
            </section>

            {/* RECENTLY VIEWED */}
            {recentlyViewed.length > 0 && (
              <section className="section" style={{ padding: "0 40px", marginBottom: 40 }}>
                <div className="sec-head reveal in" style={{ marginBottom: 24 }}>
                  <div className="sec-head-left">
                    <div className="sec-eyebrow"><div className="sec-eyebrow-line"></div><span>Your History</span></div>
                    <h2 className="sec-title" style={{ fontSize: 24 }}>Recently <em>Viewed</em></h2>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16 }} className="hide-scrollbar">
                  {recentlyViewed.map(sp => (
                    <div key={`rv-${sp.id}`} style={{ width: 140, flexShrink: 0, cursor: "pointer", background: "white", padding: 8, borderRadius: 12, border: "1px solid var(--border)" }} onClick={() => setViewProduct(sp)}>
                      <div style={{ width: "100%", aspectRatio: "3/4", background: "#f0ebe3", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
                        <img src={sp.imageUrl || sp.imageUrls?.[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sp.name}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--gold)" }}>₹{sp.price}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* BECOME A PARTNER SECTION */}
            <section className="section partner-section">
              <div className="partner-banner reveal in">
                <div className="partner-banner-bg"></div>
                <div className="partner-banner-content">
                  <div className="partner-pill"><span>🤝 Partner Program</span></div>
                  <h2 className="partner-title">Become a <em>Dresho Partner</em></h2>
                  <p className="partner-desc">Whether you're a boutique owner, a brand, or want to deliver fashion — join thousands of partners already growing with India's fastest quick commerce fashion platform.</p>
                  <div className="partner-perks">
                    <div className="partner-perk"><div className="perk-check">✓</div><span>List products & reach lakhs of customers instantly</span></div>
                    <div className="partner-perk"><div className="perk-check">✓</div><span>Flexible hours for delivery partners</span></div>
                    <div className="partner-perk"><div className="perk-check">✓</div><span>Weekly payouts & dedicated support</span></div>
                    <div className="partner-perk"><div className="perk-check">✓</div><span>Zero listing fees for your first 3 months</span></div>
                  </div>
                  <Link href="/partner"><button className="btn-partner">Become a Partner →</button></Link>
                </div>
                <div className="partner-banner-visual">
                  <div className="partner-stat-group">
                    <div className="partner-stat-card"><div className="p-stat-icon">🏪</div><div className="p-stat-label">Sell your products to customers across your city</div></div>
                    <div className="partner-stat-card"><div className="p-stat-icon">🛵</div><div className="p-stat-label">Deliver fashion & earn on your own schedule</div></div>
                    <div className="partner-stat-card"><div className="p-stat-icon">📈</div><div className="p-stat-label">Grow your business with Dresho's platform</div></div>
                  </div>
                </div>
              </div>
            </section>



            {/* FOOTER */}
            <footer>
              <div className="footer-main">
                <div>
                  <div className="footer-brand">Dres<span>h</span>o</div>
                  <p className="footer-tagline">India's first luxury quick commerce fashion platform. Premium brands, delivered in 30 minutes.</p>
                  <div className="footer-social"><a href="https://www.instagram.com/dresho.in/" target="_blank" rel="noopener noreferrer" className="soc" style={{ width: "auto", padding: "0 16px", textDecoration: "none" }}>instagram</a></div>
                </div>
                <div><div className="footer-col-title">Help</div><ul className="footer-links"><li onClick={() => { if(!user) setShowAuth(true); else setCurrentSection('orders'); }} style={{ cursor: "pointer" }}>Track Order</li><li onClick={() => setCurrentSection('about')} style={{ cursor: "pointer" }}>About Us</li><li><a href="mailto:prinxadmin29@gmail.com" style={{ color: "inherit", textDecoration: "none" }}>Contact Us</a></li><li onClick={() => setShowFeedback(true)} style={{ cursor: "pointer" }}>Feedback</li></ul></div>
                <div><div className="footer-col-title">Partners</div><ul className="footer-links"><li><Link href="/partner">Become a Partner</Link></li></ul></div>
                <div><div className="footer-col-title">Cities</div><ul className="footer-links"><li>Hazaribagh</li></ul></div>
                <div><div className="footer-col-title">Quick Links</div><ul className="footer-links"><li><Link href="/shop/category/all" style={{ color: "inherit", textDecoration: "none" }}>Shop All</Link></li><li><Link href="/shop/category/womens-wear" style={{ color: "inherit", textDecoration: "none" }}>Women's Wear</Link></li><li><Link href="/shop/category/mens-wear" style={{ color: "inherit", textDecoration: "none" }}>Men's Wear</Link></li><li><Link href="/shop/category/ethnic" style={{ color: "inherit", textDecoration: "none" }}>Ethnic Wear</Link></li></ul></div>
              </div>
              <div className="footer-bottom">
                <div className="footer-bottom-left">
                  <span>© 2026 Dresho Technologies</span>
                </div>
                <div className="footer-bottom-right">
                  <span className="footer-link-btn" onClick={() => setShowContactModal(true)}>Contact & Support</span>
                  <span className="footer-sep">|</span>
                  <span className="footer-link-btn" onClick={() => setShowReturnModal(true)}>Return Policy</span>
                  <span className="footer-sep">|</span>
                  <span className="footer-link-btn" onClick={() => setShowTCModal(true)}>Terms & Conditions</span>
                  <span className="footer-sep">|</span>
                  <Link href="/privacy-policy" style={{ color: "inherit", textDecoration: "none" }}><span className="footer-link-btn">Privacy Policy</span></Link>
                </div>
              </div>
            </footer>

          </div>
        )}

        {/* ── ABOUT US ── */}
        {currentSection === "about" && (
          <div style={{ padding: "60px 20px", maxWidth: 800, margin: "0 auto", textAlign: "center", minHeight: "60vh" }} className="animate-fade-in">
            <div className="sec-eyebrow" style={{ justifyContent: "center" }}><div className="sec-eyebrow-line"></div><span>Our Story</span><div className="sec-eyebrow-line"></div></div>
            <h3 style={{ fontFamily: "var(--font-d)", fontSize: 40, fontWeight: 400, color: "var(--navy)", marginBottom: 32, marginTop: 12 }}>About <em>Dresho</em></h3>
            <p style={{ fontSize: 16, color: "var(--sub)", lineHeight: 1.8, marginBottom: 24 }}>
              Dresho is India's first luxury quick commerce fashion platform. We are revolutionizing how you shop for premium brands by delivering the latest fashion right to your doorstep in just <strong>30 minutes</strong>.
            </p>
            <p style={{ fontSize: 16, color: "var(--sub)", lineHeight: 1.8, marginBottom: 40 }}>
              Whether you need a last-minute outfit for a party, a sharp suit for a meeting, or just want to upgrade your wardrobe without waiting days for delivery, Dresho is your ultimate style companion.
            </p>
            <button className="btn-signin" onClick={() => setCurrentSection("home")} style={{ padding: "12px 32px", fontSize: 14 }}>Explore Collection</button>
          </div>
        )}

        {/* ── FAVORITES ── */}
        {currentSection === "favorites" && (
          <div style={{ padding: "32px 20px" }} className="animate-fade-in">
            <h3 style={{ fontFamily: "var(--font-d)", fontSize: 28, fontWeight: 400, color: "var(--navy)", marginBottom: 24 }}>Favorites ❤️</h3>
            {favorites.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", border: "1px dashed var(--border)", background: "var(--ivory2)" }}>
                <span style={{ fontSize: 40, marginBottom: 12 }}>🤍</span>
                <p style={{ fontWeight: 500, color: "var(--sub)" }}>No favorites yet.</p>
                <p style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>Tap the heart icon on any product to save it here.</p>
              </div>
            ) : (
              <div className="deal-grid">
                {favorites.map((p) => (
                  <div key={p.id} className="deal-card" onClick={() => { setViewProduct(p); setSelectedSize(p.sizes?.[0] || "M"); }}>
                    <div className="deal-img-wrap">
                      <img src={p.image} alt={p.name} style={{ opacity: (p.outOfStock || p.stock === 0) ? 0.4 : 1 }} onError={(e) => { e.target.style.display = "none"; }} />
                      {(p.outOfStock || p.stock === 0) && (
                        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.6)", color: "white", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 900, zIndex: 10, letterSpacing: 1, whiteSpace: "nowrap", backdropFilter: "blur(2px)" }}>
                          OUT OF STOCK
                        </div>
                      )}
                      <div className="deal-badge-wrap">
                        {p.stock > 0 && p.stock <= 5 && !p.outOfStock && (
                          <span style={{ background: "#ef4444", color: "white", padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>Only {p.stock} left</span>
                        )}
                        <span className="badge-off">−38%</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); toggleFavorite(p); }} style={{ position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: "none", color: "#ef4444", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                        <i className="fas fa-heart" />
                      </button>
                      {!(p.outOfStock || p.stock === 0) && (
                        <div className="deal-quick" onClick={(e) => { e.stopPropagation(); addToCart(p, p.sizes?.[0] || "M"); }}>⚡ Quick Add</div>
                      )}
                    </div>
                    <div className="deal-info">
                      <div className="deal-brand">{p.storeName || "DRESHO"}</div>
                      <div className="deal-name" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                      <div className="deal-price-row"><span className="deal-price">₹{p.price}</span>{p.mrp && p.mrp > p.price && <><span className="deal-mrp">₹{p.mrp}</span><span className="deal-off">{Math.round(((p.mrp - p.price) / p.mrp) * 100)}% off</span></>}</div>
                      <div className="deal-rating"><span className="deal-rating-stars">★ {p.averageRating || "New"}</span><span className="deal-rating-count">{p.reviews?.length ? `(${p.reviews.length})` : ""}</span></div>
                      <div className="deal-delivery"><span className="green-dot"></span>Delivery in 30 min</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CART ── */}
        {currentSection === "cart" && (
          <div style={{ padding: "32px 20px" }} className="animate-fade-in">
            <h3 style={{ fontFamily: "var(--font-d)", fontSize: 28, fontWeight: 400, color: "var(--navy)", marginBottom: 24 }}>My Cart</h3>
            {cart.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 20px", background: "var(--ivory2)", borderRadius: 16 }}>
                <span style={{ fontSize: 50, marginBottom: 16, display: "block" }}>🛒</span>
                <h4 style={{ fontWeight: 800, color: "var(--navy)", fontSize: 20, marginBottom: 8 }}>Your cart is empty</h4>
                <p style={{ fontWeight: 500, color: "var(--sub)", fontSize: 13, marginBottom: 24 }}>Looks like you haven't added anything to your cart yet.</p>
                <button onClick={() => setCurrentSection("home")} style={{ padding: "12px 32px", background: "var(--navy)", color: "white", borderRadius: 12, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(20,33,61,0.2)" }}>
                  Start Shopping
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {cart.map((item, idx) => {
                  const outOfOrder = isProductOutOfOrder(item);
                  return (
                    <div key={idx} style={{ display: "flex", gap: 16, background: "var(--card)", border: "1px solid var(--border)", padding: 12, opacity: outOfOrder ? 0.7 : 1 }}>
                      <div style={{ width: 80, height: 100, background: "var(--ivory2)", flexShrink: 0, overflow: "hidden", position: "relative" }}>
                        <ProductImageThumbnail item={item} products={products} size={80} />
                        {outOfOrder && (
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 9, fontWeight: 900, textAlign: "center", textTransform: "uppercase", padding: 4 }}>
                            Shop Closed
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--navy)" }}>{item.name}</h4>
                        {outOfOrder && (
                          <span style={{ background: "#ef4444", color: "white", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 900, textTransform: "uppercase", alignSelf: "flex-start", marginTop: 4 }}>OUT OF ORDER</span>
                        )}
                        <p style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>
                          Size: {item.selectedSize} · ₹{item.price} × {item.qty}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                          <button style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--ivory2)", color: "var(--navy)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }} onClick={() => changeQty(idx, -1)}>−</button>
                          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--navy)" }}>{item.qty}</span>
                          <button style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "var(--navy)", color: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }} onClick={() => changeQty(idx, 1)}>+</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", padding: "24px", marginTop: 8, borderRadius: 12 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)", marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>Price Details ({cart.reduce((acc, item) => acc + item.qty, 0)} Items)</h4>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontWeight: 500, color: "var(--sub)", fontSize: 14 }}>Total MRP</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--navy)" }}>₹{cart.reduce((acc, item) => acc + (Math.floor(item.price * 1.38) * item.qty), 0)}</span>
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontWeight: 500, color: "var(--sub)", fontSize: 14 }}>Discount on MRP</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#16a34a" }}>−₹{cart.reduce((acc, item) => acc + (Math.floor(item.price * 1.38) * item.qty), 0) - cartTotal}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontWeight: 500, color: "var(--sub)", fontSize: 14 }}>Delivery Charges</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#16a34a" }}><span style={{ textDecoration: "line-through", color: "var(--sub)", marginRight: 6 }}>₹49</span>FREE</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px dashed var(--border)", marginTop: 8 }}>
                    <span style={{ fontWeight: 800, color: "var(--navy)", fontSize: 16 }}>Final Amount</span>
                    <span style={{ fontSize: 24, fontWeight: 900, color: "var(--navy)" }}>₹{cartTotal}</span>
                  </div>
                   {hasOutOfOrderItems && (
                    <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 12, padding: 12, marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 18 }}>⚠️</span>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#991b1b" }}>
                        Seller Offline - Some items are Out of Order. Please remove them to proceed.
                      </p>
                    </div>
                  )}

                  <p style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", marginTop: 12, background: "#dcfce7", padding: "8px 12px", borderRadius: 8, textAlign: "center" }}>
                    You will save ₹{cart.reduce((acc, item) => acc + (Math.floor(item.price * 1.38) * item.qty), 0) - cartTotal} on this order
                  </p>
                  <button 
                    disabled={hasOutOfOrderItems}
                    style={{ 
                      background: hasOutOfOrderItems ? "#cbd5e1" : "var(--navy)", 
                      color: hasOutOfOrderItems ? "#94a3b8" : "#fff", 
                      border: "none", 
                      padding: "16px", 
                      width: "100%", 
                      marginTop: 24, 
                      fontSize: 12, 
                      letterSpacing: 2, 
                      textTransform: "uppercase", 
                      fontWeight: 500, 
                      cursor: hasOutOfOrderItems ? "not-allowed" : "pointer", 
                      transition: "background 0.3s" 
                    }} 
                    onClick={() => {
                      if (hasOutOfOrderItems) return;
                      const addr = userData?.address;
                      setCheckoutAddress(typeof addr === "object" ? addr?.line || "" : addr || "");
                      setCheckoutLandmark(typeof addr === "object" ? addr?.landmark || "" : "");
                      setCheckoutCity(typeof addr === "object" ? addr?.city || "" : "");
                      setCheckoutPincode(typeof addr === "object" ? addr?.pincode || "" : "");
                      setCheckoutPhone(userData?.phone || "");
                      setShowCheckout(true);
                    }}
                  >
                    {hasOutOfOrderItems ? "Seller Offline - Out of Order" : "Proceed to Checkout"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ORDERS ── */}
        {currentSection === "orders" && (
          <div style={{ padding: "20px 0 80px 0", background: "#f1f5f9", minHeight: "100vh" }} className="animate-fade-in">
            <div style={{ padding: "0 20px" }}>
              <h3 style={{ fontFamily: "var(--font-d)", fontSize: 24, fontWeight: 600, color: "var(--navy)", marginBottom: 16 }}>My Orders</h3>
              
              {/* Search Bar & Filters */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "white", padding: "12px 16px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <i className="fas fa-search" style={{ color: "#94a3b8" }} />
                  <input placeholder="Search your order here" style={{ border: "none", outline: "none", width: "100%", fontSize: 14, color: "var(--navy)" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "var(--navy)", background: "white", padding: "12px 16px", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer" }}>
                  <i className="fas fa-sliders-h" /> Filters
                </div>
              </div>
            </div>

            {orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <span style={{ fontSize: 40, marginBottom: 12, display: "block" }}>📦</span>
                <h4 style={{ fontWeight: 800, color: "var(--navy)", fontSize: 18, marginBottom: 8 }}>No orders yet</h4>
                <p style={{ fontWeight: 500, color: "var(--sub)", fontSize: 13, marginBottom: 24 }}>You haven't placed any orders. Start exploring our collection!</p>
                <button onClick={() => setCurrentSection("home")} style={{ padding: "10px 24px", background: "var(--navy)", color: "white", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Start Shopping
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {orders.map((o) => (
                  <div key={o.id} className="animate-fade-in-up" style={{ background: "white", padding: "16px 20px" }}>
                    {o.items?.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: i !== o.items.length - 1 ? 16 : 0 }}>
                        <div style={{ width: 64, height: 64, borderRadius: 8, background: "#f8fafc", flexShrink: 0, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                          <ProductImageThumbnail item={item} products={products} size={64} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ 
                            fontSize: 14, fontWeight: 600, marginBottom: 4,
                            color: o.status === "Delivered" ? "#16a34a" : o.status === "Cancelled" || o.status === "Rejected" ? "#ef4444" : "#16a34a"
                          }}>
                            {o.status === "Delivered" 
                              ? `Delivered on ${o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString("en-US", {month: "short", day: "2-digit"}) : ""}`
                              : o.status === "Cancelled" 
                              ? `Cancelled on ${o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString("en-US", {month: "short", day: "2-digit"}) : ""}`
                              : o.status === "Rejected"
                              ? "Rejected"
                              : o.status === "Refunded"
                              ? "Refunded"
                              : ["Picked Up", "Out For Delivery"].includes(o.status)
                              ? "Rider on the way"
                              : "Order Confirmed"}
                          </h4>
                          <p style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {item.name}
                          </p>
                        </div>
                        <i className="fas fa-chevron-right" style={{ color: "#cbd5e1", fontSize: 14 }} />
                      </div>
                    ))}

                    {/* Rate & Review Footer */}
                    {(o.status === "Delivered" || o.status === "DELIVERED") && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "#475569" }}>Rate & Review</span>
                        <div style={{ display: "flex", gap: 8 }} onClick={() => handleRateProduct(o.id)}>
                          {[1,2,3,4,5].map(star => (
                            <i key={star} className={o.rating && star <= o.rating ? "fas fa-star" : "far fa-star"} style={{ color: o.rating && star <= o.rating ? "#16a34a" : "#cbd5e1", fontSize: 16, cursor: "pointer" }} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons for Delivered — 24-hour return/exchange window */}
                    {(o.status === "Delivered" || o.status === "DELIVERED") && (() => {
                      const eligible = isEligibleForReturnOrExchange(o);
                      const deliveredTime = o.deliveredAt?.seconds ? o.deliveredAt.seconds * 1000 : null;
                      const hoursLeft = deliveredTime ? Math.max(0, 24 - Math.floor((Date.now() - deliveredTime) / 3600000)) : 0;
                      return (
                        <div style={{ marginTop: 16 }}>
                          <div style={{ display: "flex", gap: 10 }}>
                            {eligible ? (
                              <>
                                <button onClick={() => handleExchangeOrder(o.id)} style={{ flex: 1, padding: "8px", fontSize: 12, fontWeight: 600, color: "#0f172a", background: "white", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer" }}>Exchange</button>
                                <button onClick={() => handleReturnOrder(o.id)} style={{ flex: 1, padding: "8px", fontSize: 12, fontWeight: 600, color: "#0f172a", background: "white", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer" }}>Return</button>
                              </>
                            ) : (
                              <div style={{ flex: 2, padding: "8px", fontSize: 11, fontWeight: 600, color: "#94a3b8", background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 8, textAlign: "center" }}>
                                ⏱ Return/Exchange window expired
                              </div>
                            )}
                            <button onClick={() => downloadInvoice(o)} style={{ flex: 1, padding: "8px", fontSize: 12, fontWeight: 600, color: "#16a34a", background: "#ecfdf5", border: "1px solid #16a34a", borderRadius: 8, cursor: "pointer" }}>E-Bill</button>
                          </div>
                          {eligible && deliveredTime && (
                            <p style={{ fontSize: 10, color: "#f59e0b", marginTop: 6, textAlign: "center" }}>
                              ⏰ Return/Exchange window closes in {hoursLeft}h
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Show E-Bill only (no return window) for requested statuses */}
                    {(o.status === "Return Requested" || o.status === "Exchange Requested") && (
                      <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ flex: 2, padding: "8px", fontSize: 11, fontWeight: 700, color: "#f59e0b", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, textAlign: "center" }}>
                          ⏳ {o.status} — Seller will contact you
                        </div>
                        <button onClick={() => downloadInvoice(o)} style={{ flex: 1, padding: "8px", fontSize: 12, fontWeight: 600, color: "#16a34a", background: "#ecfdf5", border: "1px solid #16a34a", borderRadius: 8, cursor: "pointer" }}>E-Bill</button>
                      </div>
                    )}

                    {/* Active Tracking timeline */}
                    {o.status !== "Delivered" && o.status !== "DELIVERED" && o.status !== "Cancelled" && o.status !== "Rejected" && o.status !== "Refunded" && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
                        {(() => {
                          let steps = [];
                          let currentIdx = -1;
                          
                          if (o.status.includes("Return") || o.status === "Refund Processed" || o.status === "Pickup Assigned" || o.status === "Return Picked Up" || o.status === "Return Completed") {
                            steps = ["Return Requested", "Return Approved", "Pickup Assigned", "Return Picked Up", "Refund Processed", "Return Completed"];
                            currentIdx = steps.indexOf(o.status);
                            if (currentIdx === -1) {
                              if (o.status === "Returned") currentIdx = 3;
                            }
                          } else if (o.status.includes("Exchange") || o.status.includes("Replacement") || o.status === "Pickup Scheduled" || o.status === "Replacement Processing" || o.status === "Replacement Shipped" || o.status === "Exchange Completed") {
                            steps = ["Exchange Requested", "Exchange Approved", "Pickup Scheduled", "Replacement Processing", "Replacement Shipped", "Exchange Completed"];
                            currentIdx = steps.indexOf(o.status);
                            if (currentIdx === -1) {
                              if (o.status === "Exchanged") currentIdx = 5;
                            }
                          } else {
                            steps = ["Order placed", "Seller accepted", "Rider assigned", "Rider accepted", "Picked up", "Delivered"];
                            const statusMapping = {
                              "Pending": 0,
                              "Seller Accepted": 1,
                              "Rider Searching": 2,
                              "Rider Accepted": 3,
                              "Preparing": 3,
                              "Ready For Pickup": 3,
                              "Picked Up": 4,
                              "Out For Delivery": 4,
                              "Delivered": 5
                            };
                            currentIdx = statusMapping[o.status] !== undefined ? statusMapping[o.status] : 0;
                          }

                          if (currentIdx === -1) return null;

                          return (
                            <div style={{ display: "flex", justifyContent: "space-between", position: "relative", padding: "0 10px" }}>
                              <div style={{ position: "absolute", top: 8, left: 20, right: 20, height: 2, background: "#e2e8f0", zIndex: 0 }} />
                              <div style={{ position: "absolute", top: 8, left: 20, width: `calc(${(currentIdx / (steps.length - 1)) * 100}% - 40px)`, height: 2, background: "#16a34a", zIndex: 1, transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)" }} />
                              {steps.map((step, idx) => (
                                <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2, gap: 6, opacity: idx <= currentIdx ? 1 : 0.4, width: 40 }}>
                                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: idx <= currentIdx ? "#16a34a" : "#f1f5f9", color: idx <= currentIdx ? "white" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800 }}>
                                    {idx < currentIdx ? <i className="fas fa-check" /> : idx + 1}
                                  </div>
                                  <span style={{ fontSize: 8, fontWeight: 600, color: idx <= currentIdx ? "#0f172a" : "#64748b", textAlign: "center", lineHeight: 1.1 }}>{step}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        {(o.status === "Out For Delivery" || o.status === "Out for Delivery") && (
                          <div style={{ marginTop: 16, padding: "12px", background: "#f8fafc", border: "1px dashed #cbd5e1", textAlign: "center", borderRadius: 8 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Delivery OTP: <span style={{ fontSize: 16, color: "#16a34a", fontWeight: 800 }}>{o.deliveryOtp}</span></p>
                            {o.riderId && riderLocations[o.riderId] ? (
                              <div style={{ width: "100%", height: 120, borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0", position: "relative" }}>
                                <LiveMap lat={riderLocations[o.riderId].lat} lng={riderLocations[o.riderId].lng} label="Rider" />
                              </div>
                            ) : (
                              <div style={{ width: "100%", height: 60, borderRadius: 8, background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 10, color: "#64748b" }}>Locating rider...</span>
                              </div>
                            )}
                          </div>
                        )}
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
          <div style={{ padding: "32px 20px" }} className="animate-fade-in">
            <h3 style={{ fontFamily: "var(--font-d)", fontSize: 28, fontWeight: 400, color: "var(--navy)", marginBottom: 24 }}>My Account</h3>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", padding: 24, marginBottom: 16, display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--ivory2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 24 }}>👤</span>
              </div>
              <div>
                <h4 style={{ fontSize: 18, fontWeight: 600, color: "var(--navy)", marginBottom: 4 }}>{userData?.name}</h4>
                <p style={{ fontSize: 13, color: "var(--sub)" }}>{userData?.email}</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }} onClick={() => setCurrentSection('orders')}>
                <span style={{ fontSize: 20 }}>📦</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--navy)" }}>My Orders</span>
              </div>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }} onClick={() => setShowHelp(true)}>
                <span style={{ fontSize: 20 }}>📞</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--navy)" }}>Help & Support</span>
              </div>
              <div className="glass-card" style={{ padding: "18px 20px", borderRadius: 18, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setIsDarkMode(!isDarkMode)}>
                <i className="fas fa-moon" style={{ color: "var(--gold)", fontSize: 16 }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </div>
              <div className="glass-card" style={{ padding: "18px 20px", borderRadius: 18, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Dresho App',
                    url: window.location.origin,
                  });
                } else {
                  prompt('Copy this link', window.location.origin);
                }
              }}>
                <i className="fas fa-share-alt" style={{ color: "var(--gold)", fontSize: 16 }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Share App</span>
              </div>
              <div className="glass-card" style={{ padding: "18px 20px", borderRadius: 18, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setShowAbout(true)}>
                <i className="fas fa-info-circle" style={{ color: "var(--gold)", fontSize: 16 }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>About Us</span>
              </div>
            </div>
            <button className="btn-danger" style={{ width: "100%", marginTop: 20, borderRadius: 18, padding: "16px" }} onClick={() => signOut(auth)}>
              Log Out
            </button>
          </div>
        )}

        {showAbout && (
          <div className="modal-overlay" onClick={() => setShowAbout(false)}>
            <div className="modal-content" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>About Dresho</h3>
              <p style={{ color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                Dresho is a premium quick‑commerce platform delivering fashion in 30 minutes. We bring the latest trends from curated boutiques straight to your doorstep.
              </p>
              <button className="btn-primary" onClick={() => setShowAbout(false)} style={{ marginTop: 16 }}>Close</button>
            </div>
          </div>
        )}
        {showHelp && (
          <div className="modal-overlay" onClick={() => setShowHelp(false)}>
            <div className="modal-content" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>Help & Support</h3>
              <p style={{ color: "var(--text-tertiary)", lineHeight: 1.6 }}>
                Need assistance? Email us at <a href="mailto:dresho.business@gmail.com" style={{ color: "var(--gold)" }}>dresho.business@gmail.com</a> or WhatsApp +91 9128926837 (10 AM – 8 PM).
              </p>
              <button className="btn-primary" onClick={() => setShowHelp(false)} style={{ marginTop: 16 }}>Close</button>
            </div>
          </div>
        )}

        {/* ── FOOTER POLICY MODALS ── */}
        <FooterModal open={showContactModal} onClose={() => setShowContactModal(false)} title="DRESHO – Contact & Support">
          <div style={{ fontSize: 14, color: "#333", lineHeight: 1.8 }}>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📞 Get in Touch</p>
              <p>We're here to help you with anything—orders, delivery, or general queries.</p>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📧 Email Support</p>
              <p>For business, support, or queries:</p>
              <a href="mailto:dresho.business@gmail.com" style={{ color: "#b07d3a", fontWeight: 600, textDecoration: "none" }}>dresho.business@gmail.com</a>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>💬 WhatsApp Support</p>
              <p>Chat with us directly for quick help:</p>
              <a href="https://wa.me/919128926837" target="_blank" rel="noopener noreferrer" style={{ color: "#25d366", fontWeight: 600, textDecoration: "none" }}>+91 9128926837</a>
              <p style={{ marginTop: 8, fontSize: 12, color: "#888" }}>👉 Available: 10:00 AM – 8:00 PM (All Days)</p>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>🛍️ Order Support</p>
              <p>If you have issues related to your order:</p>
              <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
                <li>Delayed delivery</li>
                <li>Wrong or damaged product</li>
                <li>Replacement request</li>
              </ul>
              <p style={{ fontSize: 12, color: "#888" }}>👉 Contact us via WhatsApp for fastest resolution</p>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>🤝 Seller & Partnership Queries</p>
              <p>Want to sell on Dresho or collaborate? Reach out via email with details and our team will get back to you.</p>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>⚡ Quick Response Promise</p>
              <p>We aim to respond:</p>
              <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
                <li><strong>WhatsApp:</strong> Within 1–2 hours</li>
                <li><strong>Email:</strong> Within 24 hours</li>
              </ul>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px" }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📍 Service Area</p>
              <p>Currently serving: <strong>Hazaribagh, Jharkhand</strong></p>
            </div>
          </div>
        </FooterModal>

        <FooterModal open={showReturnModal} onClose={() => setShowReturnModal(false)} title="Return / Replacement Policy">
          <div style={{ fontSize: 14, color: "#333", lineHeight: 1.8 }}>
            <div style={{ background: "#fff3cd", borderRadius: 16, padding: "16px 20px", marginBottom: 16, border: "1px solid #ffc107" }}>
              <p style={{ fontWeight: 700, color: "#856404" }}>⚠️ IMPORTANT: No refunds. Replacement only.</p>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>✅ We offer:</p>
              <p>Replacement only (No refunds)</p>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>🔁 Eligible cases:</p>
              <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
                <li>Wrong item delivered</li>
                <li>Damaged product</li>
                <li>Size issue (if applicable)</li>
              </ul>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>⏱ Time:</p>
              <p>Request within <strong>24 hours</strong> of delivery</p>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📦 Conditions:</p>
              <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
                <li>Product must be unused</li>
                <li>Original packaging required</li>
              </ul>
            </div>
            <div style={{ background: "#fde8e8", borderRadius: 16, padding: "20px", marginBottom: 16, border: "1px solid #f5c6cb" }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#721c24" }}>❌ Not eligible:</p>
              <ul style={{ paddingLeft: 20, margin: "8px 0", color: "#721c24" }}>
                <li>Change of mind</li>
                <li>Used products</li>
              </ul>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px" }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>🔄 Process:</p>
              <ol style={{ paddingLeft: 20, margin: "8px 0" }}>
                <li>User raises request</li>
                <li>Product picked up</li>
                <li>Replacement delivered</li>
              </ol>
            </div>
          </div>
        </FooterModal>

        <FooterModal open={showTCModal} onClose={() => setShowTCModal(false)} title="Terms & Conditions">
          <div style={{ fontSize: 14, color: "#333", lineHeight: 1.8 }}>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>DRESHO – Terms of Use for Buyers</p>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>1. Orders</p>
              <p>Orders once placed cannot be cancelled after dispatch.</p>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>2. Pricing</p>
              <p>Prices are set by sellers and may vary.</p>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>3. Delivery</p>
              <p>Delivery time is estimated, not guaranteed.</p>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px", marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>4. COD Orders</p>
              <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
                <li>Users must be available to receive orders</li>
                <li>Repeated refusal may lead to account restriction</li>
              </ul>
            </div>
            <div style={{ background: "#f8f7f4", borderRadius: 16, padding: "20px" }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>5. Liability</p>
              <p>Dresho acts as a platform connecting buyers and sellers.</p>
            </div>
          </div>
        </FooterModal>

        {/* ── RETURN/EXCHANGE REQUEST FORM MODAL ── */}
        <FooterModal open={showReturnRequestModal} onClose={() => setShowReturnRequestModal(false)} title={returnType === "RETURN" ? "Request Return" : "Request Exchange"}>
          <div style={{ padding: "10px 0" }}>
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: 12, marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#d97706" }}>
                {returnType === "RETURN" ? "⚠️ Returns are eligible for replacement only (no refunds)." : "🔄 Exchange with another size or fresh piece."}
              </p>
            </div>

            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--navy)" }}>Choose Reason</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {(returnType === "RETURN" ? RETURN_REASONS : EXCHANGE_REASONS).map((reason) => (
                <label key={reason} style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 12, 
                  padding: "12px 16px", 
                  borderRadius: 12, 
                  border: returnReason === reason ? "1px solid var(--navy)" : "1px solid var(--border)", 
                  background: returnReason === reason ? "rgba(15,23,42,0.03)" : "transparent",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}>
                  <input 
                    type="radio" 
                    name="return_reason" 
                    value={reason} 
                    checked={returnReason === reason} 
                    onChange={() => setReturnReason(reason)}
                    style={{ accentColor: "var(--navy)", width: 18, height: 18 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>{reason}</span>
                </label>
              ))}
            </div>

            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--navy)" }}>Additional Remarks (Optional)</p>
            <textarea 
              value={returnRemarks} 
              onChange={(e) => setReturnRemarks(e.target.value)} 
              placeholder="Provide any extra details or size specifications..." 
              style={{ 
                width: "100%", 
                minHeight: 80, 
                borderRadius: 12, 
                border: "1px solid var(--border)", 
                padding: 12, 
                fontSize: 13, 
                fontFamily: "inherit",
                resize: "vertical", 
                removeAttribute: "true",
                marginBottom: 20,
                outline: "none"
              }}
            />

            <button 
              onClick={submitReturnOrExchangeRequest}
              style={{ 
                width: "100%", 
                padding: "14px", 
                borderRadius: 12, 
                background: "var(--navy)", 
                color: "white", 
                border: "none", 
                fontSize: 14, 
                fontWeight: 700, 
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(15,23,42,0.15)"
              }}
            >
              Submit Request
            </button>
          </div>
        </FooterModal>

        {/* ── BOTTOM NAV ── */}
        <div style={s.bottomNav}>
          {[
            { id: "search", icon: "fa-magnifying-glass", label: "Search" },
            { id: "home", icon: "fa-house", label: "Home" },
            { id: "favorites", icon: "fa-heart", label: "Favorites", badge: favorites.length },
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
        </div>

        {/* ── PRODUCT DETAIL FULL SCREEN MODAL ── */}
        {viewProduct && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--white)", overflow: "hidden", display: "flex", flexDirection: "column" }} className="animate-fade-in slide-up">
            
            {/* Top Navigation Bar */}
            <div style={{ flexShrink: 0, zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--border)" }}>
              <button onClick={() => setViewProduct(null)} style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--ivory2)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: "var(--navy)" }}>
                <i className="fas fa-arrow-left" />
              </button>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => { if (navigator.share) navigator.share({ title: viewProduct.name, url: window.location.origin }); }} style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--ivory2)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: "var(--navy)" }}><i className="fas fa-share-alt" /></button>
                <button onClick={() => toggleFavorite(viewProduct)} style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--ivory2)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: favorites.find(f => f.id === viewProduct.id) ? "#ef4444" : "var(--navy)" }}><i className={favorites.find(f => f.id === viewProduct.id) ? "fas fa-heart" : "far fa-heart"} /></button>
              </div>
            </div>

            <div id="product-modal-scroll" style={{ flex: 1, paddingBottom: 40, overflowY: "auto" }} className="hide-scrollbar">
              {/* Image Gallery */}
              <div style={{ width: "100%", height: 450, background: "var(--ivory2)", position: "relative", display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }} className="hide-scrollbar">
                {(viewProduct.images && viewProduct.images.length > 0 ? viewProduct.images : [viewProduct.image]).map((img, i) => (
                  <div key={i} style={{ minWidth: "100%", height: "100%", scrollSnapAlign: "start", position: "relative" }}>
                    <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", opacity: (viewProduct.outOfStock || viewProduct.stock === 0) ? 0.4 : 1 }} onError={(e) => { e.target.style.display = "none"; }} />
                    {i === 0 && (
                      <div style={{ position: "absolute", bottom: 40, right: 16, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--navy)", cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}>
                        <i className="fas fa-play" style={{ marginLeft: 3, fontSize: 16 }} />
                      </div>
                    )}
                    {(viewProduct.outOfStock || viewProduct.stock === 0) && (
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.6)", color: "white", padding: "10px 24px", borderRadius: 8, fontSize: 16, fontWeight: 900, zIndex: 10, letterSpacing: 2, backdropFilter: "blur(2px)" }}>OUT OF STOCK</div>
                    )}
                  </div>
                ))}
                {(viewProduct.images?.length > 1) && (
                  <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.4)", color: "white", padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700, backdropFilter: "blur(4px)" }}>
                    Swipe for more ({viewProduct.images.length})
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div style={{ padding: "20px 20px 0 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      {viewProduct.storeName || "DRESHO"} <i className="fas fa-check-circle" style={{ color: "#10b981", fontSize: 10 }} />
                    </p>
                    <h1 style={{ fontFamily: "var(--font-d)", fontSize: 24, color: "var(--navy)", lineHeight: 1.2, margin: 0 }}>{viewProduct.name}</h1>
                    {viewProduct.trending && (
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <span style={{ fontSize: 11, background: "linear-gradient(135deg, #ef4444, #b91c1c)", color: "white", padding: "4px 8px", borderRadius: 6, fontWeight: 800 }}>🔥 #1 Trending this week</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Price Section */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "var(--navy)" }}>₹{viewProduct.price}</span>
                  {viewProduct.mrp && viewProduct.mrp > viewProduct.price && (
                    <>
                      <span style={{ fontSize: 16, fontWeight: 500, color: "var(--sub)", textDecoration: "line-through" }}>₹{viewProduct.mrp}</span>
                      <span style={{ padding: "4px 8px", background: "#fef2f2", color: "#ef4444", borderRadius: 6, fontSize: 12, fontWeight: 800 }}>
                        {Math.round(((viewProduct.mrp - viewProduct.price) / viewProduct.mrp) * 100)}% OFF
                      </span>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <p style={{ fontSize: 11, color: "var(--sub)" }}>Inclusive of all taxes</p>
                </div>

                {/* Advanced Delivery Information */}
                <div style={{ margin: "24px 0", padding: "16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 24 }}>⚡</div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 800, color: "#166534", marginBottom: 2 }}>Fast Delivery Available</h4>
                      <p style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>Get it by {new Date(Date.now() + 86400000 * 2).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })} with live rider tracking.</p>
                      
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                        {viewProduct.stock > 0 && viewProduct.stock <= 5 && !viewProduct.outOfStock && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", background: "#fef2f2", padding: "4px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4 }}>
                            <i className="fas fa-fire" /> Only {viewProduct.stock} left - selling fast!
                          </div>
                        )}
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", background: "white", padding: "4px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4, border: "1px solid #bbf7d0" }}>
                          <i className="fas fa-eye" style={{ color: "var(--gold)" }} /> {Math.floor(viewProduct.price % 30) + 15} people looking right now
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", background: "white", padding: "4px 8px", borderRadius: 6, display: "flex", alignItems: "center", gap: 4, border: "1px solid #bbf7d0" }}>
                          <i className="fas fa-shopping-bag" style={{ color: "#f59e0b" }} /> Ordered {Math.floor(viewProduct.price % 50) + 10} times today
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, borderTop: "1px solid #bbf7d0", paddingTop: 12 }}>
                    <input type="tel" maxLength={6} value={pincode} onChange={(e) => { setPincode(e.target.value); setPincodeStatus(null); }} placeholder="Enter Pincode" style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #bbf7d0", fontSize: 13, background: "white", outline: "none", color: "var(--navy)" }} />
                    <button onClick={checkDeliveryAvailability} disabled={checkingPincode} style={{ padding: "0 16px", background: "#166534", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: checkingPincode ? "not-allowed" : "pointer", opacity: checkingPincode ? 0.7 : 1 }}>
                      {checkingPincode ? "Checking..." : "Check"}
                    </button>
                  </div>
                  {pincodeStatus && (
                    <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: pincodeStatus.type === "success" ? "#dcfce7" : "#fee2e2", color: pincodeStatus.type === "success" ? "#166534" : "#b91c1c", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{pincodeStatus.type === "success" ? "✅" : "❌"}</span>
                      <span>{pincodeStatus.msg}</span>
                    </div>
                  )}
                </div>

                {/* Highlights */}
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, margin: "20px 0" }} className="hide-scrollbar">
                  {["Premium Fabric", "Breathable", "Easy Wash", "Perfect Fit"].map((hl, i) => (
                    <div key={i} style={{ padding: "8px 12px", background: "var(--ivory2)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11, fontWeight: 600, color: "var(--navy)", whiteSpace: "nowrap" }}>{hl}</div>
                  ))}
                </div>

                {/* Size Selection */}
                <div style={{ margin: "24px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>Select Size</h4>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gold)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><i className="fas fa-ruler" /> Size Guide</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {(viewProduct.sizes || ["S", "M", "L", "XL"]).map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        style={{
                          flex: 1, minWidth: 60, height: 60, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                          background: selectedSize === size ? "var(--navy)" : "white",
                          color: selectedSize === size ? "white" : "var(--navy)",
                          border: selectedSize === size ? "2px solid var(--navy)" : "1px solid var(--border)",
                          cursor: "pointer", transition: "all 0.2s ease",
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{size}</span>
                      </button>
                    ))}
                  </div>
                  {viewProduct.modelInfo && (
                    <div style={{ marginTop: 12, padding: "12px", background: "var(--ivory2)", borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>📏</div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)" }}>True to Size</p>
                        <p style={{ fontSize: 11, color: "var(--sub)" }}>{viewProduct.modelInfo}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Measurements / Size Chart ── */}
                {viewProduct.measurements && Object.keys(viewProduct.measurements).length > 0 && (() => {
                  const m = viewProduct.measurements;
                  const cat = viewProduct.category || "";
                  const name = (viewProduct.name || "").toLowerCase();
                  const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9" };
                  const labelStyle = { fontSize: 13, color: "#64748b", fontWeight: 500 };
                  const valueStyle = { fontSize: 13, fontWeight: 700, color: "var(--navy)" };

                  return (
                    <div style={{ margin: "20px 0", background: "#f8fafc", borderRadius: 16, padding: "16px 20px", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <span style={{ fontSize: 18 }}>
                          {cat === "Footwear" ? "👟" : cat === "Accessories" ? "💍" : "📏"}
                        </span>
                        <h4 style={{ fontSize: 14, fontWeight: 800, color: "var(--navy)" }}>
                          {cat === "Footwear" ? "Shoe Size & Fit Guide" : cat === "Accessories" ? "Product Dimensions" : "Size & Measurements"}
                        </h4>
                      </div>

                      {/* Footwear measurements */}
                      {cat === "Footwear" && (
                        <>
                          {m.footLength && <div style={rowStyle}><span style={labelStyle}>Foot Length</span><span style={valueStyle}>{m.footLength} cm</span></div>}
                          {m.euSize && <div style={rowStyle}><span style={labelStyle}>EU Size</span><span style={valueStyle}>{m.euSize}</span></div>}
                          {m.ukSize && <div style={rowStyle}><span style={labelStyle}>UK Size</span><span style={valueStyle}>{m.ukSize}</span></div>}
                          {m.usSize && <div style={rowStyle}><span style={labelStyle}>US Size</span><span style={valueStyle}>{m.usSize}</span></div>}
                        </>
                      )}

                      {/* Bottom wear (jeans/trousers/pants) */}
                      {(name.includes("jean") || name.includes("trouser") || name.includes("pant")) && (
                        <>
                          {m.waist && <div style={rowStyle}><span style={labelStyle}>Waist</span><span style={valueStyle}>{m.waist} inches</span></div>}
                          {m.length && <div style={rowStyle}><span style={labelStyle}>Length</span><span style={valueStyle}>{m.length} inches</span></div>}
                          {m.hip && <div style={rowStyle}><span style={labelStyle}>Hip</span><span style={valueStyle}>{m.hip} cm</span></div>}
                          {m.rise && <div style={rowStyle}><span style={labelStyle}>Rise</span><span style={valueStyle}>{m.rise} inches</span></div>}
                        </>
                      )}

                      {/* General clothing measurements */}
                      {cat !== "Footwear" && cat !== "Accessories" && !name.includes("jean") && !name.includes("trouser") && !name.includes("pant") && (
                        <>
                          {m.chest && <div style={rowStyle}><span style={labelStyle}>Chest</span><span style={valueStyle}>{m.chest} inches</span></div>}
                          {m.waist && <div style={rowStyle}><span style={labelStyle}>Waist</span><span style={valueStyle}>{m.waist} inches</span></div>}
                          {m.shoulder && <div style={rowStyle}><span style={labelStyle}>Shoulder</span><span style={valueStyle}>{m.shoulder} cm</span></div>}
                          {m.length && <div style={rowStyle}><span style={labelStyle}>Length</span><span style={valueStyle}>{m.length} cm</span></div>}
                          {m.ageGroup && <div style={rowStyle}><span style={labelStyle}>Age Group</span><span style={valueStyle}>{m.ageGroup}</span></div>}
                        </>
                      )}

                      {/* Accessories */}
                      {cat === "Accessories" && (
                        <>
                          {m.width && <div style={rowStyle}><span style={labelStyle}>Width</span><span style={valueStyle}>{m.width} cm</span></div>}
                          {m.height && <div style={rowStyle}><span style={labelStyle}>Height</span><span style={valueStyle}>{m.height} cm</span></div>}
                          {m.material && <div style={rowStyle}><span style={labelStyle}>Material</span><span style={valueStyle}>{m.material}</span></div>}
                        </>
                      )}

                      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 10, fontWeight: 500 }}>
                        📌 Measurements are approximate and may vary ±1cm
                      </p>
                    </div>
                  );
                })()}

                {/* Color Variants */}
                {viewProduct.colors && viewProduct.colors.length > 0 && (
                  <div style={{ margin: "24px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h4 style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>Select Color</h4>
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                      {viewProduct.colors.map((color, idx) => (
                        <div key={idx} style={{ width: 44, height: 44, borderRadius: "50%", padding: 3, border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: color.hex || "#000", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }} title={color.name} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Why You'll Love This */}
                {viewProduct.highlights && viewProduct.highlights.length > 0 && (
                  <div style={{ margin: "24px 0", padding: "16px", background: "var(--ivory2)", borderRadius: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, color: "var(--navy)", marginBottom: 12 }}>Why You'll Love This ❤️</h4>
                    <ul style={{ paddingLeft: 20, margin: 0, fontSize: 13, color: "var(--sub)", lineHeight: 1.8 }}>
                      {viewProduct.highlights.map((hl, i) => <li key={i}>{hl}</li>)}
                    </ul>
                  </div>
                )}

                {/* Return Transparency & Trust Indicators */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "24px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: "1px solid var(--border)", borderRadius: 12 }}>
                    <i className="fas fa-exchange-alt" style={{ color: "var(--gold)", fontSize: 18 }} />
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", lineHeight: 1.2, display: "block" }}>Easy Replacement</span>
                      <span style={{ fontSize: 10, color: "var(--sub)" }}>Within 24 hours</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: "1px solid var(--border)", borderRadius: 12 }}>
                    <i className="fas fa-shield-check" style={{ color: "var(--gold)", fontSize: 18 }} />
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", lineHeight: 1.2, display: "block" }}>Verified Seller</span>
                      <span style={{ fontSize: 10, color: "var(--sub)" }}>Trusted Partner</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: "1px solid var(--border)", borderRadius: 12 }}>
                    <i className="fas fa-check-double" style={{ color: "var(--gold)", fontSize: 18 }} />
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", lineHeight: 1.2, display: "block" }}>Quality Checked</span>
                      <span style={{ fontSize: 10, color: "var(--sub)" }}>100% Authentic</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, border: "1px solid var(--border)", borderRadius: 12 }}>
                    <i className="fas fa-truck-fast" style={{ color: "var(--gold)", fontSize: 18 }} />
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", lineHeight: 1.2, display: "block" }}>Fast Dispatch</span>
                      <span style={{ fontSize: 10, color: "var(--sub)" }}>Live tracking</span>
                    </div>
                  </div>
                </div>

                {/* Accordions */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 24 }}>
                  <details style={{ marginBottom: 16 }}>
                    <summary style={{ fontSize: 14, fontWeight: 800, color: "var(--navy)", cursor: "pointer", display: "flex", justifyContent: "space-between", listStyle: "none" }}>Product Details <i className="fas fa-chevron-down" style={{ fontSize: 12, color: "var(--sub)" }} /></summary>
                    <div style={{ padding: "12px 0", fontSize: 13, color: "var(--sub)", lineHeight: 1.6 }}>
                      High-quality materials tailored for exceptional comfort and a modern fit. A versatile addition to your everyday wardrobe.
                    </div>
                  </details>
                  <details style={{ marginBottom: 16 }}>
                    <summary style={{ fontSize: 14, fontWeight: 800, color: "var(--navy)", cursor: "pointer", display: "flex", justifyContent: "space-between", listStyle: "none" }}>Fabric & Care <i className="fas fa-chevron-down" style={{ fontSize: 12, color: "var(--sub)" }} /></summary>
                    <div style={{ padding: "12px 0", fontSize: 13, color: "var(--sub)", lineHeight: 1.6 }}>
                      <ul style={{ paddingLeft: 20 }}>
                        <li>Premium Cotton Blend</li>
                        <li>Machine wash cold</li>
                        <li>Do not bleach</li>
                        <li>Dry in shade</li>
                      </ul>
                    </div>
                  </details>
                </div>

                {/* Flipkart Style Ratings & Reviews */}
                {(() => {
                  const allReviews = viewProduct.reviews || [];
                  const totalRating = allReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0);
                  const avgRating = allReviews.length > 0 ? (totalRating / allReviews.length).toFixed(1) : 0;
                  const allReviewImages = allReviews.flatMap(r => r.images || []);

                  return (
                    <div style={{ borderTop: "8px solid #f1f5f9", paddingTop: 20, marginTop: 16, paddingBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h4 style={{ fontSize: 18, fontWeight: 800, color: "var(--navy)" }}>Ratings and reviews</h4>
                        <button style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "white", fontSize: 13, fontWeight: 700, color: "var(--navy)", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }} onClick={() => setShowReviewModal(true)}>
                          Rate Product
                        </button>
                      </div>
                      
                      {allReviews.length > 0 ? (
                        <>
                          {/* Overall Rating Block */}
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ fontSize: 32, fontWeight: 900, color: "var(--navy)", display: "flex", alignItems: "center", gap: 4 }}>
                                {avgRating} <i className="fas fa-star" style={{ fontSize: 20, color: "#16a34a" }} />
                              </div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "4px 12px", borderRadius: 20 }}>
                                {avgRating >= 4 ? "Good" : avgRating >= 3 ? "Average" : "Poor"}
                              </div>
                            </div>
                            <p style={{ fontSize: 13, color: "var(--sub)", marginTop: 4 }}>
                              based on {allReviews.length} ratings by <i className="fas fa-check-circle" style={{ color: "#16a34a" }} /> Verified Buyers
                            </p>
                          </div>

                          {/* Review Images Grid */}
                          {allReviewImages.length > 0 && (
                            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 16 }} className="hide-scrollbar">
                               {allReviewImages.map((img, idx) => (
                                 <img key={idx} src={img} style={{ width: 100, height: 100, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: "1px solid #e2e8f0" }} />
                               ))}
                            </div>
                          )}

                          {/* Quick Tags */}
                          {viewProduct.reviewTags && viewProduct.reviewTags.length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--navy)", marginBottom: 12 }}>Features customers loved</p>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {viewProduct.reviewTags.map((tag, i) => (
                                  <span key={i} style={{ fontSize: 13, padding: "8px 16px", background: "#f1f5f9", borderRadius: 8, color: "var(--navy)", fontWeight: 500 }}>{tag}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Reviews List */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
                            {allReviews.map((rev, i) => (
                              <div key={i} style={{ paddingBottom: 16, borderBottom: "1px solid #e2e8f0" }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                                  <span style={{ background: rev.rating >= 4 ? "#16a34a" : rev.rating >= 3 ? "#f59e0b" : "#ef4444", color: "white", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}>
                                    {rev.rating} <i className="fas fa-star" style={{ fontSize: 8 }} />
                                  </span>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>{rev.title || (rev.rating >= 4 ? "Awesome!" : rev.rating >= 3 ? "Good product" : "Okay")}</span>
                                </div>
                                <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, marginBottom: 12 }}>{rev.text}</p>
                                
                                {rev.images && rev.images.length > 0 && (
                                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                    {rev.images.map((img, idx) => (
                                      <div key={idx} style={{ width: 60, height: 60, borderRadius: 8, background: "#ddd", overflow: "hidden" }}>
                                        <img src={img} alt="" style={{width: "100%", height:"100%", objectFit:"cover"}} onError={(e) => e.target.style.display='none'} />
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <span style={{ fontWeight: 600 }}>{rev.authorName} <i className="fas fa-check-circle" style={{ color: "#10b981", fontSize: 10, marginLeft: 4 }} /></span>
                                  <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <span>{rev.date || "Recently"}</span>
                                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i className="fas fa-thumbs-up" style={{ color: "#cbd5e1" }} /> Helpful</span>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: "center", padding: "32px 0", background: "#f8fafc", borderRadius: 16 }}>
                          <i className="fas fa-comment-dots" style={{ fontSize: 32, color: "#cbd5e1", marginBottom: 12 }} />
                          <p style={{ color: "var(--navy)", fontSize: 14, fontWeight: 600 }}>No reviews yet</p>
                          <p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Be the first to share your thoughts!</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Review Modal */}
                {showReviewModal && (
                  <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowReviewModal(false)}>
                    <div style={{ background: "white", width: "100%", maxWidth: 600, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, animation: "slideUp 0.3s ease" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--navy)" }}>Write a Review</h3>
                        <button onClick={() => setShowReviewModal(false)} style={{ background: "none", border: "none", fontSize: 20, color: "#64748b", cursor: "pointer" }}><i className="fas fa-times" /></button>
                      </div>
                      
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", display: "block", marginBottom: 8 }}>Rating</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <button key={star} onClick={() => setReviewForm({ ...reviewForm, rating: star })} style={{ background: "none", border: "none", fontSize: 28, color: reviewForm.rating >= star ? "#16a34a" : "#e2e8f0", cursor: "pointer" }}>★</button>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", display: "block", marginBottom: 8 }}>Review Title</label>
                        <input type="text" value={reviewForm.title} onChange={e => setReviewForm({...reviewForm, title: e.target.value})} placeholder="E.g. Excellent Product!" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e2e8f0", outline: "none", color: "var(--navy)" }} />
                      </div>

                      <div style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", display: "block", marginBottom: 8 }}>Review Description</label>
                        <textarea value={reviewForm.text} onChange={e => setReviewForm({...reviewForm, text: e.target.value})} placeholder="What did you like or dislike?" rows="4" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e2e8f0", outline: "none", resize: "none", color: "var(--navy)" }} />
                      </div>

                      <button onClick={submitReview} style={{ width: "100%", padding: 16, background: "var(--navy)", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer" }}>Submit Review</button>
                    </div>
                  </div>
                )}

                {/* Style With This */}
                {viewProduct.relatedProducts && viewProduct.relatedProducts.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24, marginTop: 16 }}>
                    <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--navy)", marginBottom: 16 }}>Style With This</h4>
                    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 16 }} className="hide-scrollbar">
                      {viewProduct.relatedProducts.map((rel, i) => (
                        <div key={i} style={{ minWidth: 120, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
                          <div style={{ height: 120, background: "var(--ivory2)" }}>
                            <img src={rel.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                          <div style={{ padding: 8 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rel.name}</p>
                            <p style={{ fontSize: 12, fontWeight: 800, color: "var(--gold)", marginTop: 2 }}>₹{rel.price}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Similar Products — Only real products from Firestore */}
              {(() => {
                // Complementary category map: if viewing X, also show Y
                const complementaryMap = {
                  "Men's Wear":    ["Formal", "Casual", "Accessories", "Footwear"],
                  "Women's Wear":  ["Ethnic", "Casual", "Accessories", "Footwear"],
                  "Ethnic":        ["Accessories", "Footwear", "Women's Wear", "Men's Wear"],
                  "Formal":        ["Men's Wear", "Accessories", "Footwear"],
                  "Casual":        ["Men's Wear", "Women's Wear", "Accessories", "Footwear"],
                  "Kids Wear":     ["Accessories", "Footwear"],
                  "Accessories":   ["Men's Wear", "Women's Wear", "Ethnic", "Casual"],
                  "Footwear":      ["Men's Wear", "Women's Wear", "Casual", "Formal"],
                };
                const complements = complementaryMap[viewProduct.category] || [];

                // Priority 1: Same category (most similar items, any seller)
                const sameCategory = products.filter(p =>
                  p.id !== viewProduct.id && p.category === viewProduct.category
                );
                // Priority 2: Complementary categories (complete the outfit, any seller)
                const complementary = products.filter(p =>
                  p.id !== viewProduct.id &&
                  p.category !== viewProduct.category &&
                  complements.includes(p.category)
                );
                // Priority 3: Anything else from Firestore (fallback — never empty)
                const others = products.filter(p =>
                  p.id !== viewProduct.id &&
                  !sameCategory.find(x => x.id === p.id) &&
                  !complementary.find(x => x.id === p.id)
                );

                const similarProducts = [
                  ...sameCategory,
                  ...complementary,
                  ...others
                ].slice(0, 10);

                if (similarProducts.length === 0) return null;

                return (
                  <div style={{ borderTop: "8px solid #f1f5f9", paddingTop: 20, marginTop: 8, paddingBottom: 24 }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", marginBottom: 16 }}>
                      <div>
                        <h4 style={{ fontSize: 17, fontWeight: 900, color: "var(--navy)", margin: 0 }}>Similar Products</h4>
                        <p style={{ fontSize: 11, color: "var(--sub)", marginTop: 3, margin: 0 }}>
                          {sameCategory.length > 0 ? `More ${viewProduct.category}` : "You may also like"}
                        </p>
                      </div>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                        onClick={() => { setViewProduct(null); setCurrentCategory(viewProduct.category); }}>
                        <i className="fas fa-arrow-right" style={{ fontSize: 13, color: "white" }} />
                      </div>
                    </div>

                    {/* Horizontal Scroll Cards */}
                    <div style={{ display: "flex", gap: 20, overflowX: "auto", paddingBottom: 16, padding: "0 20px 16px" }} className="hide-scrollbar">
                      {similarProducts.map((sp) => {
                        const img = sp.image || sp.images?.[0] || "";
                        const avgRating = sp.reviews?.length
                          ? (sp.reviews.reduce((s, r) => s + (r.rating || 0), 0) / sp.reviews.length).toFixed(1)
                          : null;
                        const isNew = sp.createdAt && (Date.now() - (sp.createdAt?.seconds * 1000 || 0)) < 7 * 86400000;
                        const isSameCategory = sp.category === viewProduct.category;
                        return (
                          <div
                            key={sp.id}
                            style={{ width: 220, flexShrink: 0, cursor: "pointer", borderRadius: 20, overflow: "hidden", background: "white", border: "1px solid #f1f5f9", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", transition: "transform 0.2s, box-shadow 0.2s" }}
                            onClick={() => { setViewProduct(sp); setSelectedSize(sp.sizes?.[0] || "M"); document.getElementById("product-modal-scroll")?.scrollTo({ top: 0, behavior: "smooth" }); }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.12)"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; }}
                          >
                            {/* Image */}
                            <div style={{ position: "relative", width: "100%", height: 280, background: "#f0ebe3", overflow: "hidden" }}>
                              {img ? (
                                <img src={img} alt={sp.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                              ) : (
                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <i className="fas fa-shirt" style={{ fontSize: 32, color: "#d1cbc2" }} />
                                </div>
                              )}
                              {/* Badge */}
                              {isSameCategory && (
                                <div style={{ position: "absolute", top: 8, left: 8, background: "#14213d", color: "white", fontSize: 9, fontWeight: 800, padding: "3px 7px", borderRadius: 6, letterSpacing: 0.5 }}>
                                  SIMILAR
                                </div>
                              )}
                              {isNew && !isSameCategory && (
                                <div style={{ position: "absolute", top: 8, left: 8, background: "#10b981", color: "white", fontSize: 9, fontWeight: 800, padding: "3px 7px", borderRadius: 6, letterSpacing: 0.5 }}>
                                  NEW
                                </div>
                              )}
                              {(sp.outOfStock || sp.stock === 0) && (
                                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: "white", letterSpacing: 1 }}>OUT OF STOCK</span>
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div style={{ padding: "10px 10px 12px" }}>
                              {avgRating && (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#14213d", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, marginBottom: 6 }}>
                                  {avgRating} <i className="fas fa-star" style={{ fontSize: 8 }} />
                                </div>
                              )}
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", marginBottom: 4 }}>
                                {sp.name}
                              </div>
                              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>{sp.category}</div>
                              <div style={{ fontSize: 14, fontWeight: 900, color: "#14213d" }}>₹{Number(sp.price).toLocaleString("en-IN")}</div>
                              {sp.stock > 0 && sp.stock <= 5 && (
                                <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, marginTop: 3 }}>Only {sp.stock} left!</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              </div>
            </div>

            {/* Sticky Bottom Bar */}
            <div style={{ flexShrink: 0, background: "var(--white)", padding: "16px 20px", borderTop: "1px solid var(--border)", zIndex: 20 }}>
              {isProductOutOfOrder(viewProduct) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#ef4444", textAlign: "center" }}>
                    ⚠️ This shop is currently closed. You can't order right now.
                  </p>
                  <button 
                    disabled
                    style={{ width: "100%", height: 50, borderRadius: 16, background: "#cbd5e1", color: "#94a3b8", border: "none", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, cursor: "not-allowed" }}
                  >
                    Seller Offline - Out of Order
                  </button>
                </div>
              ) : (viewProduct.outOfStock || viewProduct.stock === 0) ? (
                <button 
                  style={{ width: "100%", height: 50, borderRadius: 16, background: "var(--navy)", color: "white", border: "none", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", boxShadow: "0 4px 14px rgba(20,33,61,0.2)" }} 
                  onClick={async () => { 
                    if (!user) return alert("Please log in to receive restock alerts.");
                    try {
                      await addDoc(collection(db, "restock_requests"), {
                        productId: viewProduct.id,
                        productName: viewProduct.name,
                        size: selectedSize,
                        userId: user.uid,
                        fcmToken: userData?.fcmToken || null,
                        requestedAt: new Date(),
                        fulfilled: false
                      });
                      alert(`Awesome! We will notify you the second ${viewProduct.name} (Size: ${selectedSize}) is back in stock!`); 
                      setViewProduct(null); 
                    } catch (e) {
                      console.error(e);
                      alert("Error setting up alert. Try again.");
                    }
                  }}>
                  Notify Me When Available
                </button>
              ) : (
                <div style={{ display: "flex", gap: 12 }}>
                  <button 
                    style={{ flex: 1, height: 50, borderRadius: 16, background: "white", color: "var(--navy)", border: "1px solid var(--navy)", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer" }} 
                    onClick={() => { addToCart(viewProduct, selectedSize); setViewProduct(null); }}>
                    Add to Cart
                  </button>
                  <button 
                    style={{ flex: 1.5, height: 50, borderRadius: 16, background: "var(--navy)", color: "white", border: "none", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", boxShadow: "0 4px 14px rgba(20,33,61,0.2)", position: "relative", overflow: "hidden" }} 
                    onClick={() => { addToCart(viewProduct, selectedSize); setViewProduct(null); setCurrentSection("cart"); }}>
                    <span style={{ position: "relative", top: -6 }}>Buy Now</span>
                    <span style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", fontSize: 9, opacity: 0.8, whiteSpace: "nowrap", fontWeight: 600 }}>⚡ 1-Tap Checkout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CHECKOUT MODAL ── */}
        {showCheckout && (
          <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(20,33,61,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowCheckout(false)}>
            <div className="animate-scale-in hide-scrollbar" onClick={(e) => e.stopPropagation()} style={{ background: "var(--white)", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: 32, boxShadow: "var(--shadow-lg)" }}>
              <h3 style={{ fontFamily: "var(--font-d)", fontSize: 26, color: "var(--navy)", marginBottom: 24 }}>Checkout</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <input style={{ padding: "12px 0", border: "none", borderBottom: "1px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, fontFamily: "var(--font-b)", color: "var(--navy)" }} placeholder="House / Flat No., Street" value={checkoutAddress} onChange={(e) => setCheckoutAddress(e.target.value)} />
                <input style={{ padding: "12px 0", border: "none", borderBottom: "1px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, fontFamily: "var(--font-b)", color: "var(--navy)" }} placeholder="Landmark (e.g. Near City Mall)" value={checkoutLandmark} onChange={(e) => setCheckoutLandmark(e.target.value)} />
                <div style={{ display: "flex", gap: 16 }}>
                  <input style={{ flex: 1, padding: "12px 0", border: "none", borderBottom: "1px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, fontFamily: "var(--font-b)", color: "var(--navy)" }} placeholder="City" value={checkoutCity} onChange={(e) => setCheckoutCity(e.target.value)} />
                  <input style={{ flex: 1, padding: "12px 0", border: "none", borderBottom: "1px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, fontFamily: "var(--font-b)", color: "var(--navy)" }} placeholder="Pincode" type="tel" maxLength={6} inputMode="numeric" value={checkoutPincode} onChange={(e) => setCheckoutPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                </div>
                <input style={{ padding: "12px 0", border: "none", borderBottom: "1px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, fontFamily: "var(--font-b)", color: "var(--navy)" }} type="tel" placeholder="Phone Number" value={checkoutPhone} onChange={(e) => setCheckoutPhone(e.target.value)} />
                
                <button 
                  style={{ 
                    marginTop: 8, padding: 14, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: 500, cursor: "pointer", transition: "all 0.3s",
                    background: checkoutCoordinates ? "var(--green)" : "var(--ivory2)",
                    color: checkoutCoordinates ? "white" : "var(--navy)",
                    border: checkoutCoordinates ? "none" : "1px solid var(--border)"
                  }} 
                  onClick={fetchCustomerLocation}
                >
                  <span style={{ marginRight: 8 }}>{checkoutCoordinates ? '✓' : '📍'}</span>
                  {checkoutCoordinates ? "GPS Location Pinned" : "Pin My Delivery Location (Required)"}
                </button>
              </div>

              {/* Payment Method */}
              <div style={{ marginTop: 32 }}>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: "var(--sub)", textTransform: "uppercase", marginBottom: 16 }}>Payment Method</p>
                <div style={{ display: "flex", gap: 12 }}>
                  {[
                    { id: "COD", icon: "💵", label: "Cash", sub: "Pay at door" },
                    { id: "UPI", icon: "📱", label: "UPI", sub: "Instant pay" },
                  ].map((pm) => (
                    <button key={pm.id} onClick={() => setPaymentMethod(pm.id)} style={{
                      flex: 1, padding: "16px 12px", cursor: "pointer", textAlign: "left",
                      background: paymentMethod === pm.id ? "var(--ivory2)" : "var(--white)",
                      border: paymentMethod === pm.id ? "1px solid var(--gold)" : "1px solid var(--border)",
                      transition: "all 0.2s ease",
                    }}>
                      <span style={{ fontSize: 20, marginBottom: 8, display: "block" }}>{pm.icon}</span>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "var(--navy)" }}>{pm.label}</p>
                      <p style={{ fontSize: 11, color: "var(--sub)", marginTop: 4 }}>{pm.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: "var(--ivory2)", border: "1px dashed var(--border2)", padding: 20, marginTop: 32 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--sub)" }}>Items Total</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--navy)" }}>₹{cartTotal}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: "var(--sub)" }}>Delivery Fee</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: checkoutCoordinates ? "var(--green)" : "var(--sub)" }}>
                    {checkoutCoordinates ? `₹${deliveryFee}` : "Calculated at GPS Pin"}
                  </span>
                </div>
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "var(--navy)", textTransform: "uppercase", letterSpacing: 1, fontSize: 11 }}>Grand Total</span>
                  <span style={{ fontSize: 24, fontWeight: 600, color: "var(--navy)" }}>₹{checkoutCoordinates ? cartTotal + deliveryFee : cartTotal}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <button style={{ flex: 1, background: "transparent", color: "var(--navy)", border: "1px solid var(--border2)", padding: 16, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }} onClick={() => setShowCheckout(false)}>Cancel</button>
                <button style={{ flex: 1, background: "var(--navy)", color: "white", border: "none", padding: 16, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }} onClick={placeOrder} disabled={placing}>
                  {placing ? "Placing..." : paymentMethod === "COD" ? "Place Order" : "Pay via UPI"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Address Management Modal ── */}
        {showAddressModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(20,33,61,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowAddressModal(false)}>
            <div onClick={(e) => e.stopPropagation()} className="animate-scale-in hide-scrollbar" style={{ background: "var(--white)", padding: "32px", maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto", boxShadow: "var(--shadow-lg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h3 style={{ fontFamily: "var(--font-d)", fontSize: 22, color: "var(--navy)", margin: 0 }}>Select Address</h3>
                <button onClick={() => setShowAddressModal(false)} style={{ background: "none", border: "none", fontSize: 24, color: "var(--sub)", cursor: "pointer" }}>×</button>
              </div>

              {(userData?.addresses && userData.addresses.length > 0) || userData?.address ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                  {(userData?.addresses && userData.addresses.length > 0 ? userData.addresses : [userData.address]).map((addr, i) => (
                    <div key={addr.id || i} onClick={() => handleSelectAddress(addr)} style={{ padding: 16, border: userData?.address?.id === addr.id || userData?.address?.line === addr.line ? "2px solid var(--gold)" : "1px solid var(--border)", background: "var(--ivory2)", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: userData?.address?.id === addr.id || userData?.address?.line === addr.line ? "5px solid var(--gold)" : "1px solid var(--border)", flexShrink: 0, marginTop: 2 }}></div>
                      <div>
                        <div style={{ fontSize: 13, color: "var(--navy)", fontWeight: 500, marginBottom: 4 }}>{addr.line}</div>
                        <div style={{ fontSize: 11, color: "var(--sub)" }}>{addr.landmark}, {addr.city} - {addr.pincode}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13, border: "1px dashed var(--border)", marginBottom: 24 }}>
                  No saved addresses found.
                </div>
              )}

              {!showAddAddressForm ? (
                <button onClick={() => setShowAddAddressForm(true)} style={{ background: "transparent", color: "var(--navy)", border: "1px dashed var(--navy)", padding: "14px", width: "100%", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", fontWeight: 500, cursor: "pointer" }}>
                  + Add New Address
                </button>
              ) : (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24 }}>
                  <h4 style={{ fontFamily: "var(--font-d)", fontSize: 16, color: "var(--navy)", marginBottom: 16 }}>New Address</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <input style={{ padding: "12px 0", border: "none", borderBottom: "1px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, color: "var(--navy)" }} type="text" placeholder="House / Flat No., Street" value={newAddrLine} onChange={(e) => setNewAddrLine(e.target.value)} />
                    <input style={{ padding: "12px 0", border: "none", borderBottom: "1px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, color: "var(--navy)" }} type="text" placeholder="Landmark" value={newAddrLandmark} onChange={(e) => setNewAddrLandmark(e.target.value)} />
                    <div style={{ display: "flex", gap: 16 }}>
                      <input style={{ flex: 1, padding: "12px 0", border: "none", borderBottom: "1px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, color: "var(--navy)" }} type="text" placeholder="City" value={newAddrCity} onChange={(e) => setNewAddrCity(e.target.value)} />
                      <input style={{ flex: 1, padding: "12px 0", border: "none", borderBottom: "1px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, color: "var(--navy)" }} type="tel" placeholder="Pincode" maxLength={6} inputMode="numeric" value={newAddrPincode} onChange={(e) => setNewAddrPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                      <button style={{ flex: 1, background: "transparent", color: "var(--navy)", border: "1px solid var(--border2)", padding: 12, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }} onClick={() => setShowAddAddressForm(false)}>Cancel</button>
                      <button style={{ flex: 1, background: "var(--navy)", color: "white", border: "none", padding: 12, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }} onClick={handleAddAddress}>Save Address</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FEEDBACK MODAL ── */}
        {showFeedback && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowFeedback(false)}>
            <div style={s.authCard} onClick={e => e.stopPropagation()}>
              <div style={s.authHeader}>
                <h2 style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-d)" }}>Your Feedback</h2>
                <p style={{ color: "var(--sub)", fontSize: 13, textAlign: "center" }}>Help us improve Dresho by sharing your experience.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "center", gap: 8, fontSize: 32, cursor: "pointer" }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} onClick={() => setFbRating(star)} style={{ color: star <= fbRating ? "var(--gold)" : "#ddd" }}>★</span>
                  ))}
                </div>
                <textarea
                  placeholder="Write your review here..."
                  value={fbText}
                  onChange={(e) => setFbText(e.target.value)}
                  style={{ width: "100%", height: 100, padding: 12, border: "1px solid var(--border)", borderRadius: 12, outline: "none", resize: "none", fontFamily: "var(--font-b)", fontSize: 14 }}
                />
                <button
                  onClick={submitFeedback}
                  disabled={fbSubmitting || fbRating === 0 || !fbText.trim()}
                  style={{ background: "var(--navy)", color: "#fff", border: "none", padding: "14px", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: 500, cursor: "pointer", borderRadius: 12, opacity: (fbSubmitting || fbRating === 0 || !fbText.trim()) ? 0.5 : 1 }}
                >
                  {fbSubmitting ? "Submitting..." : "Submit Review"}
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
    background: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(40px)",
    border: "1px solid rgba(0,0,0,0.06)",
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
    background: "rgba(176,125,58,0.15)",
    border: "1px solid rgba(176,125,58,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    boxShadow: "0 0 40px rgba(176,125,58,0.15)",
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
    background: "linear-gradient(135deg, var(--gold), var(--blue-electric), var(--blue-bright))",
    padding: "28px 24px",
    borderRadius: 28,
    color: "white",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 12px 40px rgba(176,125,58,0.15)",
  },
  heroBannerGlow: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.2)",
    filter: "blur(40px)",
  },
  catBtn: {
    flexShrink: 0,
    padding: "10px 20px",
    borderRadius: 14,
    fontSize: 13,
    fontWeight: 700,
    background: "rgba(255, 255, 255, 0.8)",
    border: "1px solid rgba(0,0,0,0.06)",
    color: "var(--text-muted)",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontFamily: "Inter, sans-serif",
    whiteSpace: "nowrap",
  },
  catBtnActive: {
    background: "linear-gradient(135deg, var(--blue-electric), var(--gold))",
    color: "white",
    border: "1px solid transparent",
    boxShadow: "0 4px 20px rgba(176,125,58,0.15)",
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
    background: "linear-gradient(135deg, #F8F7F4, #E5E7EB)",
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
    borderTop: "1px solid rgba(0,0,0,0.05)",
    background: "rgba(248, 247, 244, 0.95)",
    backdropFilter: "blur(20px)",
  },
  navBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "none",
    color: "#888",
    cursor: "pointer",
    transition: "all 0.3s ease",
    padding: "6px 16px",
    fontFamily: "Inter, sans-serif",
  },
  navBtnActive: {
    color: "#1a0ddc",
    transform: "translateY(-2px)",
  },
  navBadge: {
    position: "absolute",
    top: -6,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "var(--red)",
    color: "white",
    fontSize: 9,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

/* ─── FOOTER MODALS ─── */
function FooterModal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 600, maxHeight: "80vh", overflowY: "auto", padding: "32px 28px 48px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: "#1a1a2e", margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}


