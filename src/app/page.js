"use client";
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where,
  onSnapshot, addDoc, orderBy,
} from "firebase/firestore";

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   SECURITY UTILITIES
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

// 1. Input sanitizer — strips HTML tags and trims dangerous characters
const sanitize = (str = '') =>
  String(str).replace(/<[^>]*>/g, '').replace(/['"`;]/g, '').trim().slice(0, 500);

// 2. Phone validator — must be exactly 10 digits
const isValidPhone = (p) => /^\d{10}$/.test(p.trim());

// 3. Email validator
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

// 4. Pincode validator — must be 6 digits
const isValidPincode = (p) => /^\d{6}$/.test(p.trim());

// 5. Simple in-memory rate limiter (per browser session)
//    Allows max `limit` calls within `windowMs` milliseconds
function createRateLimiter(limit = 3, windowMs = 60_000) {
  const calls = [];
  return {
    check() {
      const now = Date.now();
      // Remove calls outside the current window
      while (calls.length && calls[0] < now - windowMs) calls.shift();
      if (calls.length >= limit) return false; // blocked
      calls.push(now);
      return true; // allowed
    },
    reset() { calls.length = 0; },
  };
}

// OTP rate limiter: max 3 OTP sends per 60 seconds
const otpLimiter = createRateLimiter(3, 60_000);
// Order rate limiter: max 5 orders per 5 minutes
const orderLimiter = createRateLimiter(5, 300_000);



/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Dresho — Customer Shopping Experience
   Fashion, Delivered instantly.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function ShopPage() {
  // â”€â”€ Auth State â”€â”€
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authStep, setAuthStep] = useState("google"); // "google" | "profile" | "phone-otp"
  const [authPhone, setAuthPhone] = useState("");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authAddrLine, setAuthAddrLine] = useState("");
  const [authLandmark, setAuthLandmark] = useState("");
  const [authCity, setAuthCity] = useState("");
  const [authPincode, setAuthPincode] = useState("");
  const [authOtp, setAuthOtp] = useState(["", "", "", "", "", ""]);
  const [authLoading, setAuthLoading] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [showFloatBar, setShowFloatBar] = useState(false);
  const [checkoutPhone, setCheckoutPhone] = useState("");

  // Panel Role — tracks if admin/seller/rider is visiting homepage
  const [panelRole, setPanelRole] = useState(null); // "admin" | "seller" | "delivery" | null

  // Live Banners from Firestore
  const [liveBanners, setLiveBanners] = useState({});
  // New feedback state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const router = useRouter();


  // â”€â”€ Custom Cursor State â”€â”€
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [dotPos, setDotPos] = useState({ x: -100, y: -100 });

  useEffect(() => {
    const onMouseMove = (e) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  useEffect(() => {
    let animationFrame;
    const updateDot = () => {
      setDotPos((prev) => {
        const dx = cursorPos.x - prev.x;
        const dy = cursorPos.y - prev.y;
        return { x: prev.x + dx * 0.15, y: prev.y + dy * 0.15 };
      });
      animationFrame = requestAnimationFrame(updateDot);
    };
    animationFrame = requestAnimationFrame(updateDot);
    return () => cancelAnimationFrame(animationFrame);
  }, [cursorPos]);

  // â”€â”€ App State â”€â”€
  const [currentSection, setCurrentSection] = useState("home");
  const [products, setProducts] = useState([]);
  const [currentCategory, setCurrentCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [viewProduct, setViewProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState("");

  // â”€â”€ Checkout â”€â”€
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [checkoutLandmark, setCheckoutLandmark] = useState("");
  const [checkoutCity, setCheckoutCity] = useState("");
  const [checkoutPincode, setCheckoutPincode] = useState("");
  const [checkoutCoordinates, setCheckoutCoordinates] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("COD"); // COD | UPI
  const [placing, setPlacing] = useState(false);

  // Address Management
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [newAddrLine, setNewAddrLine] = useState("");
  const [newAddrLandmark, setNewAddrLandmark] = useState("");
  const [newAddrCity, setNewAddrCity] = useState("");
  const [newAddrPincode, setNewAddrPincode] = useState("");

  const [loaded, setLoaded] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ h: "04", m: "32", s: "17" });

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

  // -- Auth Listener --
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (!snap.exists()) {
          // Could be seller or delivery agent — check before treating as new user
          const sellerSnap = await getDoc(doc(db, "sellers_profile", u.uid));
          if (sellerSnap.exists() && sellerSnap.data().role === "seller" && sellerSnap.data().approved) {
            setPanelRole("seller");
            setLoaded(true);
            return;
          }
          const deliverySnap = await getDoc(doc(db, "delivery_profile", u.uid));
          if (deliverySnap.exists()) {
            setPanelRole("delivery");
            setLoaded(true);
            return;
          }
          // New Google user — show profile completion
          setPendingGoogleUser(u);
          setAuthName(u.displayName || "");
          setAuthEmail(u.email || "");
          setAuthStep("profile");
          setShowAuth(true);
          return;
        }
        const data = snap.data();
        if (data.role === "user") {
          setUser(u);
          setUserData(data);
          setShowAuth(false);
          setPendingGoogleUser(null);
          setPanelRole(null);
          // Redirect customer to the shopping experience
          router.push('/shop');
        } else if (data.role === "admin") {
          setShowAuth(false);
          setPanelRole("admin");
        } else {
          // Check seller/delivery roles just in case they're in users collection
          const sellerSnap = await getDoc(doc(db, "sellers_profile", u.uid));
          if (sellerSnap.exists() && sellerSnap.data().role === "seller") {
            setPanelRole("seller");
            return;
          }
          const deliverySnap = await getDoc(doc(db, "delivery_profile", u.uid));
          if (deliverySnap.exists()) {
            setPanelRole("delivery");
            return;
          }
          await signOut(auth);
          alert("Unauthorized role for this panel.");
        }
      } else {
        setUser(null);
        setUserData(null);
        setPendingGoogleUser(null);
        setPanelRole(null);
      }
    });
    setLoaded(true);
    return () => unsub();
  }, []);

  // â”€â”€ Intersection Observer for Animations â”€â”€
  useEffect(() => {
    if (currentSection !== "home") return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
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

  // â”€â”€ Float Bar Scroll Effect â”€â”€
  useEffect(() => {
    const onScroll = () => setShowFloatBar(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "products"), (snap) => {
      let p = [];
      snap.forEach((d) => p.push({ id: d.id, ...d.data() }));

      if (p.length === 0) {
        p = [
          { id: "mock1", name: "Royal Blue Embroidered Kurta", price: 2499, category: "Ethnic", image: "https://images.unsplash.com/photo-1583391733958-d25e07fac04f?w=600&q=80", sizes: ["S", "M", "L"] },
          { id: "mock2", name: "Banarasi Silk Saree", price: 4999, category: "Ethnic", image: "https://images.unsplash.com/photo-1610189013230-6db19c4d92a1?w=600&q=80", sizes: ["Free Size"] },
          { id: "mock3", name: "Premium Leather Jacket", price: 3999, category: "Men's Wear", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80", sizes: ["M", "L", "XL"] },
          { id: "mock4", name: "Linen Formal Shirt", price: 1299, category: "Men's Wear", image: "https://images.unsplash.com/photo-1596755094514-f87e32f85e2c?w=600&q=80", sizes: ["38", "40", "42"] },
          { id: "mock5", name: "Designer Party Gown", price: 5499, category: "Women's Wear", image: "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&q=80", sizes: ["S", "M"] },
          { id: "mock6", name: "Classic White Sneakers", price: 1999, category: "Casual", image: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600&q=80", sizes: ["7", "8", "9", "10"] },
          { id: "mock7", name: "Velvet Lehenga Choli", price: 8999, category: "Women's Wear", image: "https://images.unsplash.com/photo-1621786032742-0199e52575be?w=600&q=80", sizes: ["S", "M", "L"] },
          { id: "mock8", name: "Kids Party Wear Suit", price: 1499, category: "Kids Wear", image: "https://images.unsplash.com/photo-1519241047957-be31d7379a5d?w=600&q=80", sizes: ["4-5Y", "6-7Y"] }
        ];
      }

      setProducts(p);
    });

    // Live Banners Listener (with error handler for Firestore rules)
    const bannerIds = ["banner_1", "banner_2", "banner_3", "banner_4", "banner_5"];
    const bannerUnsubs = bannerIds.map((bid) =>
      onSnapshot(doc(db, "banners", bid),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const isExpired = data.expiry && new Date(data.expiry) < new Date();
            setLiveBanners((prev) => ({ ...prev, [bid]: isExpired ? null : data }));
          } else {
            setLiveBanners((prev) => ({ ...prev, [bid]: null }));
          }
        },
        (err) => {
          // Permission denied — silently use fallback defaults
          console.warn(`Banner ${bid} read blocked (update Firestore rules):`, err.code);
        }
      )
    );

    return () => { unsub(); bannerUnsubs.forEach((u) => u()); };
  }, []);

  // -- Orders Listener --
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


  // -- Google Sign-In --
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged handles the rest
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        alert('Google sign-in failed: ' + e.message);
      }
    }
    setAuthLoading(false);
  };

  // -- Complete Profile (no OTP � Google already verified identity) --
  const handleCompleteProfile = async () => {
    if (!authName.trim()) return alert('Please enter your full name.');
    if (!isValidPhone(authPhone)) return alert('Enter a valid 10-digit mobile number.');
    if (!authAddrLine.trim() || !authCity.trim() || !isValidPincode(authPincode))
      return alert('Please fill in your full address (Street, City, Pincode).');
    if (!agreedTerms) return alert('Please agree to the Terms of Use.');
    if (!pendingGoogleUser) return;
    setAuthLoading(true);
    try {
      await setDoc(doc(db, 'users', pendingGoogleUser.uid), {
        name: sanitize(authName),
        email: sanitize(pendingGoogleUser.email || ''),
        phone: '+91' + authPhone,
        address: {
          line: sanitize(authAddrLine),
          landmark: sanitize(authLandmark),
          city: sanitize(authCity),
          pincode: authPincode.replace(/\D/g, '').slice(0, 6),
        },
        role: 'user',
        createdAt: new Date(),
      });
      // onAuthStateChanged fires automatically and logs the user in
    } catch (e) {
      alert('Error saving profile: ' + e.message);
    }
    setAuthLoading(false);
  };

  // -- Admin Login (Email + Password, always FREE � no Blaze needed) --
  const handleAdminLogin = async () => {
    if (!isValidEmail(adminEmail)) return alert('Enter a valid admin email.');
    if (!adminPass.trim()) return alert('Enter your password.');
    const allowed = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase());
    if (!allowed.includes(adminEmail.trim().toLowerCase()))
      return alert('Unauthorized: this email is not an admin.');
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPass);
      setShowAuth(false);
      router.push('/admin');
    } catch (e) {
      alert('Admin login failed: ' + (e.code === 'auth/wrong-password' ? 'Incorrect password.' : e.message));
    }
    setAuthLoading(false);
  };







  // -- Address Management --
  const handleAddAddress = async () => {
    if (!newAddrLine.trim() || !newAddrCity.trim() || !newAddrPincode.trim()) {
      return alert("Please fill required address fields.");
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

  // -- OTP input helpers --
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

  // -- Cart helpers --
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

  // -- Place Order --
  // -- Format address object to string for orders --
  const formatAddress = (addr) => {
    if (!addr) return "";
    if (typeof addr === "string") return addr;
    return [addr.line, addr.landmark, addr.city, addr.pincode].filter(Boolean).join(", ");
  };

  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1.3; // 1.3 road multiplier
  };

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
          } catch (e) { console.error(e); setDeliveryFee(40); }
        }
      },
      () => alert("Unable to retrieve location. Please allow location access.")
    );
  };

  const placeOrder = async () => {
    // ? Validate inputs
    if (!checkoutAddress || !checkoutPhone) return alert("Fill all delivery details.");
    if (!isValidPhone(checkoutPhone.replace('+91', ''))) return alert("Enter a valid 10-digit phone number.");
    if (!checkoutCoordinates) return alert("Please Pin Your Delivery Location first!");
    // ? Order rate limiter � max 5 orders per 5 minutes
    if (!orderLimiter.check()) return alert("Too many orders placed. Please wait a few minutes.");
    setPlacing(true);
    try {
      const otp = Math.floor(1000 + Math.random() * 9000);
      const trackingId = "DR" + Date.now().toString().slice(-6);
      const sellerId = cart[0]?.sellerId || "";

      // Financial Engine Calculations
      const grandTotal = cartTotal + deliveryFee;
      const adminCommission = cartTotal * 0.15; // 15% of product value
      const sellerEarnings = cartTotal * 0.85; // 85% of product value

      if (paymentMethod === "UPI") {
        // -- Razorpay UPI / Card flow --
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
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            amount: grandTotal * 100, // paise
            currency: "INR",
            name: "Dresho",
            description: `Order � ${cart.length} item(s)`,
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
                await setDoc(doc(db, "users", user.uid), { address: { line: checkoutAddress, landmark: checkoutLandmark, city: checkoutCity, pincode: checkoutPincode }, phone: checkoutPhone }, { merge: true });
                setUserData((prev) => ({ ...prev, address: { line: checkoutAddress, landmark: checkoutLandmark, city: checkoutCity, pincode: checkoutPincode }, phone: checkoutPhone }));
                setCart([]);
                setShowCheckout(false);
                setCurrentSection("orders");
                alert(`? Payment successful!\nOrder placed. Payment ID: ${response.razorpay_payment_id}`);
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
        })),
        cartTotal,
        deliveryFee,
        total: grandTotal,
        adminCommission,
        sellerEarnings,
        status: "Pending",
        paymentMethod,
        paymentStatus: "Pending",
        trackingId,
        deliveryOtp: otp,
        riderId: null,
        createdAt: new Date(),
      });
      await setDoc(doc(db, "users", user.uid), { address: { line: checkoutAddress, landmark: checkoutLandmark, city: checkoutCity, pincode: checkoutPincode }, phone: checkoutPhone }, { merge: true });
      setUserData((prev) => ({ ...prev, address: { line: checkoutAddress, landmark: checkoutLandmark, city: checkoutCity, pincode: checkoutPincode }, phone: checkoutPhone }));
      setCart([]);
      setShowCheckout(false);
      setCurrentSection("orders");
      alert(`? Order placed! Your OTP: ${otp}\nPayment: Cash on Delivery`);
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

  // -------------------------------------------------------------------------- 
  //   AUTH MODAL
  // -------------------------------------------------------------------------- 
  const authModal = (!user && showAuth) && (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(20,33,61,0.65)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="animate-scale-in" style={{ width: "100%", maxWidth: 420, background: "var(--white)", border: "1px solid var(--border)", padding: "44px 36px", boxShadow: "var(--shadow-lg)", position: "relative" }}>

        {/* Close � hidden during profile completion (user must finish) */}
        {authStep === "google" && (
          <button onClick={() => { setShowAuth(false); setIsAdminLogin(false); }} style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--sub)" }}>�</button>
        )}

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontFamily: "var(--font-d)", fontSize: 36, fontWeight: 400, color: "var(--navy)", letterSpacing: 2, margin: 0 }}>
            Dres<span style={{ color: "var(--gold)" }}>h</span>o
          </h1>
          <p style={{ color: "var(--sub)", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginTop: 6 }}>
            {authStep === "profile" ? "Complete your profile" : isAdminLogin ? "Admin Access" : "Sign in to continue"}
          </p>
        </div>

        {/* -- STEP 1: Google Sign-In -- */}
        {authStep === "google" && !isAdminLogin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <button onClick={handleGoogleSignIn} disabled={authLoading}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", padding: "14px 20px", border: "1.5px solid var(--border)", background: "var(--white)", cursor: authLoading ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, color: "var(--navy)", transition: "border-color 0.2s", fontFamily: "var(--font-b)" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--gold)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {authLoading ? "Signing in�" : "Continue with Google"}
            </button>

            <p style={{ textAlign: "center", fontSize: 12, color: "var(--sub)", lineHeight: 1.6, margin: 0 }}>
              By continuing, you agree to Dresho&apos;s{" "}
              <span onClick={() => setShowTermsModal(true)} style={{ color: "var(--gold)", cursor: "pointer", borderBottom: "1px solid var(--gold)" }}>Terms of Use</span>
            </p>

            <div style={{ textAlign: "center", paddingTop: 4 }}>
              <button onClick={() => setIsAdminLogin(true)} style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", borderBottom: "1px solid var(--gold)" }}>
                Admin? Login Here
              </button>
            </div>
          </div>
        )}

        {/* -- ADMIN: Email + Password -- */}
        {isAdminLogin && authStep === "google" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "rgba(176,125,58,0.08)", border: "1px solid rgba(176,125,58,0.25)", padding: "10px 14px", fontSize: 12, color: "var(--gold)" }}>
              ??? Admin credentials required
            </div>
            <input style={{ padding: "12px 0", border: "none", borderBottom: "1.5px solid var(--border2)", outline: "none", background: "transparent", fontSize: 15, fontFamily: "var(--font-b)", color: "var(--navy)" }}
              type="email" placeholder="Admin Email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} autoFocus />
            <input style={{ padding: "12px 0", border: "none", borderBottom: "1.5px solid var(--border2)", outline: "none", background: "transparent", fontSize: 15, fontFamily: "var(--font-b)", color: "var(--navy)" }}
              type="password" placeholder="Password" value={adminPass} onChange={e => setAdminPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdminLogin()} />
            <button onClick={handleAdminLogin} disabled={authLoading} style={{ background: "var(--navy)", color: "#fff", border: "none", padding: "14px", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: 500, cursor: authLoading ? "not-allowed" : "pointer" }}>
              {authLoading ? "Verifying�" : "Access Admin Panel"}
            </button>
            <button onClick={() => setIsAdminLogin(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--sub)", letterSpacing: 1, textTransform: "uppercase" }}>
              ? Back to Customer Login
            </button>
          </div>
        )}

        {/* -- STEP 2: Profile + Phone (new Google users) -- */}
        {authStep === "profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)", padding: "9px 13px", fontSize: 12, color: "#16A34A", display: "flex", gap: 8, alignItems: "center" }}>
              <span>?</span> Signed in as <strong>{authEmail || pendingGoogleUser?.email}</strong>
            </div>
            <input style={{ padding: "11px 0", border: "none", borderBottom: "1.5px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, fontFamily: "var(--font-b)", color: "var(--navy)" }}
              type="text" placeholder="Full Name" value={authName} onChange={e => setAuthName(e.target.value)} />
            <div style={{ display: "flex", borderBottom: "1.5px solid var(--border2)" }}>
              <span style={{ padding: "11px 10px 11px 0", fontWeight: 600, fontSize: 14, color: "var(--navy)", flexShrink: 0 }}>+91</span>
              <input style={{ flex: 1, padding: "11px 0", border: "none", outline: "none", background: "transparent", fontSize: 14, fontFamily: "var(--font-b)", color: "var(--navy)" }}
                type="tel" inputMode="numeric" maxLength={10} placeholder="Mobile number (for delivery)" value={authPhone}
                onChange={e => setAuthPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} autoFocus />
            </div>
            <input style={{ padding: "11px 0", border: "none", borderBottom: "1.5px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, fontFamily: "var(--font-b)", color: "var(--navy)" }}
              type="text" placeholder="House / Flat No., Street" value={authAddrLine} onChange={e => setAuthAddrLine(e.target.value)} />
            <input style={{ padding: "11px 0", border: "none", borderBottom: "1.5px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, fontFamily: "var(--font-b)", color: "var(--navy)" }}
              type="text" placeholder="Landmark (optional)" value={authLandmark} onChange={e => setAuthLandmark(e.target.value)} />
            <div style={{ display: "flex", gap: 16 }}>
              <input style={{ flex: 1, padding: "11px 0", border: "none", borderBottom: "1.5px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, fontFamily: "var(--font-b)", color: "var(--navy)" }}
                type="text" placeholder="City" value={authCity} onChange={e => setAuthCity(e.target.value)} />
              <input style={{ flex: 1, padding: "11px 0", border: "none", borderBottom: "1.5px solid var(--border2)", outline: "none", background: "transparent", fontSize: 14, fontFamily: "var(--font-b)", color: "var(--navy)" }}
                type="tel" placeholder="Pincode" maxLength={6} inputMode="numeric" value={authPincode}
                onChange={e => setAuthPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 4 }}>
              <input type="checkbox" id="terms-profile" checked={agreedTerms} onChange={e => setAgreedTerms(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--navy)", width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
              <label htmlFor="terms-profile" style={{ fontSize: 12, color: "var(--sub)", lineHeight: 1.5, cursor: "pointer" }}>
                I agree to Dresho&apos;s{" "}
                <span onClick={() => setShowTermsModal(true)} style={{ color: "var(--navy)", fontWeight: 500, cursor: "pointer", borderBottom: "1px solid var(--border2)" }}>Terms &amp; Policy</span>
              </label>
            </div>
            <button onClick={handleCompleteProfile} disabled={authLoading || !agreedTerms || authPhone.length < 10}
              style={{ background: "var(--navy)", color: "#fff", border: "none", padding: "14px", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: 500, cursor: "pointer", opacity: (authLoading || !agreedTerms || authPhone.length < 10) ? 0.5 : 1, transition: "all 0.3s", marginTop: 4 }}>
              {authLoading ? "Saving profile�" : "Complete & Start Shopping ?"}
            </button>
          </div>
        )}

        {/* -- phone-otp step removed � Google verifies identity -- */}
        {false && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-d)", fontSize: 22, color: "var(--navy)", margin: 0 }}>Verify +91 {authPhone}</p>
              <p style={{ fontSize: 12, color: "var(--sub)", marginTop: 6 }}>Enter the 6-digit OTP sent to your mobile</p>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {authOtp.map((digit, i) => (
                <input key={i} id={`otp-${i}`} type="tel" inputMode="numeric" maxLength={1} value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  style={{ width: 42, height: 50, textAlign: "center", fontSize: 20, fontFamily: "var(--font-b)", border: "none", borderBottom: digit ? "2px solid var(--gold)" : "2px solid var(--border)", background: "transparent", color: "var(--navy)", outline: "none", transition: "all 0.25s" }}
                  autoFocus={i === 0}
                />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <input type="checkbox" id="terms-otp" checked={agreedTerms} onChange={e => setAgreedTerms(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--navy)", width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
              <label htmlFor="terms-otp" style={{ fontSize: 12, color: "var(--sub)", lineHeight: 1.5, cursor: "pointer" }}>
                I agree to Dresho&apos;s{" "}
                <span onClick={() => setShowTermsModal(true)} style={{ color: "var(--navy)", fontWeight: 500, cursor: "pointer", borderBottom: "1px solid var(--border2)" }}>Terms &amp; Policy</span>
              </label>
            </div>
            <button onClick={handleVerifyPhoneOtp} disabled={authLoading || authOtp.join("").length < 6 || !agreedTerms}
              style={{ background: "var(--navy)", color: "#fff", border: "none", padding: "14px", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: 500, cursor: "pointer", opacity: (authOtp.join("").length < 6 || authLoading || !agreedTerms) ? 0.5 : 1, transition: "all 0.3s" }}>
              {authLoading ? "Verifying…" : "Create Account âœ“"}
            </button>
            <button onClick={() => { setAuthStep("profile"); setAuthOtp(["", "", "", "", "", ""]); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--sub)", letterSpacing: 1, textTransform: "uppercase" }}>
              â† Change Phone / Resend
            </button>
          </div>
        )}

        {/* Terms Modal */}
        {showTermsModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(20,33,61,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowTermsModal(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "var(--white)", padding: "40px", maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto", boxShadow: "var(--shadow-lg)" }}>
              <h3 style={{ fontFamily: "var(--font-d)", fontSize: 28, marginBottom: 16, color: "var(--navy)" }}>Terms of Use</h3>
              <div style={{ fontSize: 13, color: "var(--sub)", lineHeight: 1.7 }}>
                <p><strong>1. Orders</strong> — Orders once placed cannot be cancelled after dispatch.</p>
                <p><strong>2. Pricing</strong> — Prices are set by sellers and may vary.</p>
                <p><strong>3. Returns</strong> — Returns accepted within 7 days of delivery.</p>
              </div>
              <button style={{ background: "var(--navy)", color: "#fff", border: "none", padding: "14px", width: "100%", marginTop: 24, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }} onClick={() => { setAgreedTerms(true); setShowTermsModal(false); }}>I Agree</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );



  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //   MAIN APP
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  return (
    <>
      <style>{`
        :root {
          --ivory: #FAF7F2; --ivory2: #F3EDE3; --ivory3: #EAE0D0;
          --white: #FFFFFF; --card: #FFFFFF;
          --navy: #14213D; --navy2: #1C2D50;
          --gold: #B07D3A; --gold2: #C99A52;
          --gold-bg: rgba(176,125,58,0.08); --gold-border: rgba(176,125,58,0.22);
          --green: #16A34A; --red: #DC2626;
          --text: #14213D; --sub: #5A6478; --muted: #9CA3AF;
          --border: #E5DDD1; --border2: #D4C9B8;
          --shadow: 0 2px 16px rgba(20,33,61,0.08);
          --shadow-lg: 0 8px 40px rgba(20,33,61,0.12);
          --font-d: 'Poppins', sans-serif;
          --font-b: 'Poppins', sans-serif;
          --r: 6px;
        }
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { background: #FAF7F2; color: #14213D; font-family: 'Poppins', sans-serif; overflow-x: hidden; }
      `}</style>

      {/* â”€â”€ Custom Cursor â”€â”€ */}
      <div style={{ position: "fixed", left: dotPos.x, top: dotPos.y, width: 32, height: 32, background: "rgba(139,69,19,0.15)", borderRadius: "50%", pointerEvents: "none", transform: "translate(-50%, -50%)", zIndex: 99999, transition: "width 0.2s, height 0.2s" }} />
      <div style={{ position: "fixed", left: cursorPos.x, top: cursorPos.y, width: 8, height: 8, background: "rgba(139,69,19,0.8)", borderRadius: "50%", pointerEvents: "none", transform: "translate(-50%, -50%)", zIndex: 100000 }} />

      {authModal}
      <div suppressHydrationWarning style={{ position: "relative", zIndex: 1, minHeight: "100vh", background: "var(--ivory)", color: "var(--text)" }}>

        {/* --- Top Announcement Strip --- */}
        <div className="top-strip">
          <div className="strip-track">
            {[1, 2].map((group) => (
              <div key={group} style={{ display: 'flex' }}>
                <div className="strip-item"><span>Free Delivery on ?999+</span><div className="strip-dot"></div></div>
                <div className="strip-item"><span>? 30 Min Express Delivery</span><div className="strip-dot"></div></div>
                <div className="strip-item"><span>500+ Premium Brands</span><div className="strip-dot"></div></div>
                <div className="strip-item"><span>7-Day Easy Returns</span><div className="strip-dot"></div></div>
                <div className="strip-item"><span>100% Authentic Products</span><div className="strip-dot"></div></div>
                <div className="strip-item"><span>Now Live in 12 Cities</span><div className="strip-dot"></div></div>
              </div>
            ))}
          </div>
        </div>
        {/* Feedback Modal */}
        {showFeedbackModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(20,33,61,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowFeedbackModal(false)}>
            <div className="animate-scale-in" style={{ background: "var(--white)", padding: 30, borderRadius: 12, width: "100%", maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 20, color: "var(--navy)" }}>Give Feedback</h3>
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} onClick={() => setFeedbackRating(i)} style={{ fontSize: 24, cursor: "pointer", color: i <= feedbackRating ? "var(--gold)" : "var(--sub)" }}>★</span>
                ))}
              </div>
              <textarea rows={4} placeholder="Your comments..." value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid var(--border)", borderRadius: 4, resize: "vertical" }}></textarea>
              <div style={{ marginTop: 16, textAlign: "right" }}>
                <button onClick={() => setShowFeedbackModal(false)} style={{ marginRight: 8, background: "transparent", border: "none", color: "var(--navy)", fontSize: 14 }}>Cancel</button>
                <button onClick={async () => {
                  try {
                    await addDoc(collection(db, "feedback"), { rating: feedbackRating, comment: feedbackComment, createdAt: new Date() });
                    alert("Thank you for your feedback!");
                    setFeedbackRating(0);
                    setFeedbackComment("");
                    setShowFeedbackModal(false);
                  } catch (e) { alert("Failed to submit feedback: " + e.message); }
                }} style={{ background: "var(--gold)", border: "none", color: "#fff", padding: "6px 12px", borderRadius: 6, cursor: "pointer" }}>Submit</button>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ Main Navbar â”€â”€ */}
        <nav>
          <div className="nav-top">
            <div onClick={() => setCurrentSection("home")} className="nav-logo" style={{ cursor: "pointer" }}>
              Dres<span>h</span>o
            </div>

            <div className="nav-loc" onClick={() => { if (userData) setShowAddressModal(true); else setShowAuth(true); }} style={{ cursor: "pointer" }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor" /><circle cx="12" cy="9" r="2.5" fill="white" opacity=".8" /></svg>
              <div>
                <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1 }}>DELIVER TO</div>
                <strong>{userData?.address?.city ? `${userData.address.city} ${userData.address.pincode}` : "Select Address"}</strong>
              </div>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </div>

            <div className="search-bar">
              <select className="search-cat">
                <option>All</option>
                <option>Women</option>
                <option>Men</option>
                <option>Ethnic</option>
                <option>Kids</option>
              </select>
              <input className="search-input" type="text" placeholder="Search for clothes, brands, occasions…" />
              <button className="search-btn"></button>
            </div>

            <div className="nav-actions">
              {/* Panel Return Button — only visible to admin/seller/rider */}
              {panelRole && (
                <Link
                  href={panelRole === "admin" ? "/admin" : panelRole === "seller" ? "/seller" : "/delivery"}
                  style={{ textDecoration: "none" }}
                >
                  <button style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 20,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    border: "1.5px solid var(--navy)",
                    background: "var(--navy)", color: "#fff",
                    letterSpacing: 0.3, transition: "all 0.2s",
                    boxShadow: "0 2px 10px rgba(20,33,61,0.18)",
                    whiteSpace: "nowrap",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--gold)"; e.currentTarget.style.borderColor = "var(--gold)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--navy)"; e.currentTarget.style.borderColor = "var(--navy)"; }}
                  >
                    {panelRole === "admin" && <>⚡ Admin Panel</>}
                    {panelRole === "seller" && <>🏪 My Store</>}
                    {panelRole === "delivery" && <>🛥️ Rider Panel</>}
                  </button>
                </Link>
              )}
              {userData && (
                <button onClick={() => setCurrentSection("orders")} className="nav-action-btn">
                  <span className="nav-action-icon"></span>
                  <span className="nav-action-label">Orders</span>
                </button>
              )}
              <button onClick={() => setCurrentSection("cart")} className="nav-action-btn">
                <span className="nav-action-icon">{cart.length > 0 && <span className="nav-badge">{cart.length}</span>}</span>
                <span className="nav-action-label">Cart</span>
              </button>
              {userData ? (
                <button onClick={() => signOut(auth)} className="btn-signin" style={{ background: "transparent", color: "var(--navy)", border: "1px solid var(--border)" }}>Logout</button>
              ) : (
                !panelRole && <button onClick={() => setShowAuth(true)} className="btn-signin">Sign In</button>
              )}
              {/* Feedback button */}
              <button onClick={() => setShowFeedbackModal(true)} className="nav-action-btn" style={{ marginLeft: 8, background: "var(--gold)", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>Feedback</button>
            </div>
          </div>

          <div className="nav-bottom">
            <div onClick={() => { setCurrentCategory("All"); setCurrentSection("home"); }} className={`nav-cat-link ${currentCategory === "All" || !currentCategory ? 'active' : ''}`} style={{ cursor: "pointer" }}><span>👗</span> Women</div>
            <div onClick={() => { setCurrentCategory("Men's Wear"); setCurrentSection("home"); }} className={`nav-cat-link ${currentCategory === "Men's Wear" ? 'active' : ''}`} style={{ cursor: "pointer" }}><span>👔</span> Men</div>
            <div onClick={() => { setCurrentCategory("Ethnic"); setCurrentSection("home"); }} className={`nav-cat-link ${currentCategory === "Ethnic" ? 'active' : ''}`} style={{ cursor: "pointer" }}><span>🥻</span> Ethnic Wear</div>
            <div onClick={() => { setCurrentCategory("Footwear"); setCurrentSection("home"); }} className={`nav-cat-link ${currentCategory === "Footwear" ? 'active' : ''}`} style={{ cursor: "pointer" }}><span>👟</span> Footwear</div>
            <div onClick={() => { setCurrentCategory("Kids Wear"); setCurrentSection("home"); }} className={`nav-cat-link ${currentCategory === "Kids Wear" ? 'active' : ''}`} style={{ cursor: "pointer" }}><span>👶</span> Kids</div>
            <div onClick={() => { setCurrentCategory("Accessories"); setCurrentSection("home"); }} className={`nav-cat-link ${currentCategory === "Accessories" ? 'active' : ''}`} style={{ cursor: "pointer" }}><span>💍</span> Accessories</div>
            <div onClick={() => { setCurrentCategory("Beauty"); setCurrentSection("home"); }} className={`nav-cat-link ${currentCategory === "Beauty" ? 'active' : ''}`} style={{ cursor: "pointer" }}><span>💄</span> Beauty</div>
            <div onClick={() => { setCurrentCategory("Sale"); setCurrentSection("home"); }} className={`nav-cat-link ${currentCategory === "Sale" ? 'active' : ''}`} style={{ cursor: "pointer" }}><span>🏷️</span> Sale <em>SALE</em></div>
            <div onClick={() => { setCurrentCategory("New Arrivals"); setCurrentSection("home"); }} className={`nav-cat-link ${currentCategory === "New Arrivals" ? 'active' : ''}`} style={{ cursor: "pointer" }}><span>✨</span> New Arrivals <em>NEW</em></div>
            <Link href="/seller" className="nav-cat-link" style={{ marginLeft: "auto", color: "var(--gold)" }}>
              Become a Seller
            </Link>
            <Link href="/delivery" className="nav-cat-link" style={{ color: "var(--gold)" }}>
              Become a Rider
            </Link>
          </div>
        </nav>

        {/* â”€â”€ HOME â”€â”€ */}
        {currentSection === "home" && (
          <div style={{ paddingBottom: 60 }}>

            {/* QUICK CATEGORY PILLS */}
            <div className="quick-cats">
              <div className="quick-cats-inner">
                <div className="qcat" onClick={() => setCurrentCategory("Kurtas")}><div className="qcat-icon">👗</div><div className="qcat-name">Kurtas</div></div>
                <div className="qcat" onClick={() => setCurrentCategory("Sarees")}><div className="qcat-icon">🥻</div><div className="qcat-name">Sarees</div></div>
                <div className="qcat" onClick={() => setCurrentCategory("Lehengas")}><div className="qcat-icon">👘</div><div className="qcat-name">Lehengas</div></div>
                <div className="qcat" onClick={() => setCurrentCategory("Jackets")}><div className="qcat-icon">🧥</div><div className="qcat-name">Jackets</div></div>
                <div className="qcat" onClick={() => setCurrentCategory("Shirts")}><div className="qcat-icon">👔</div><div className="qcat-name">Shirts</div></div>
                <div className="qcat" onClick={() => setCurrentCategory("Trousers")}><div className="qcat-icon">👖</div><div className="qcat-name">Trousers</div></div>
                <div className="qcat" onClick={() => setCurrentCategory("Sneakers")}><div className="qcat-icon">👟</div><div className="qcat-name">Sneakers</div></div>
                <div className="qcat" onClick={() => setCurrentCategory("Heels")}><div className="qcat-icon">👠</div><div className="qcat-name">Heels</div></div>
                <div className="qcat" onClick={() => setCurrentCategory("Handbags")}><div className="qcat-icon">👜</div><div className="qcat-name">Handbags</div></div>
                <div className="qcat" onClick={() => setCurrentCategory("Sunglasses")}><div className="qcat-icon">🕶️</div><div className="qcat-name">Sunglasses</div></div>
                <div className="qcat" onClick={() => setCurrentCategory("Watches")}><div className="qcat-icon">⌚</div><div className="qcat-name">Watches</div></div>
                <div className="qcat" onClick={() => setCurrentCategory("Jewellery")}><div className="qcat-icon">J</div><div className="qcat-name">Jewellery</div></div>
                <div className="qcat" onClick={() => setCurrentCategory("Scarves")}><div className="qcat-icon">🧣</div><div className="qcat-name">Scarves</div></div>
                <div className="qcat" onClick={() => setCurrentCategory("Activewear")}><div className="qcat-icon">🏃</div><div className="qcat-name">Activewear</div></div>
              </div>
            </div>

            {/* HERO BANNER */}
            <div className="hero-banner" id="heroBanner" style={{ background: "#14213D", height: 420, position: "relative", overflow: "hidden" }}>
              <div className="hero-slides" style={{ display: "flex", transform: `translateX(-${activeSlide * 100}%)`, transition: "transform 0.7s cubic-bezier(.77,0,.18,1)" }}>
                {/* Slide 1 — Banner 1 */}
                {(() => {
                  const b = liveBanners["banner_1"];
                  return (
                    <div className="hero-slide slide-1" style={{ minWidth: "100%", height: 420, display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", padding: "0 80px", background: "linear-gradient(135deg,#14213D 0%,#1C2D50 50%,#0F1A30 100%)", flexShrink: 0 }}>
                      <div className="slide-content">
                        <div className="slide-tag"><span>{b?.tag || "Express Fashion"}</span></div>
                        <h1 className="slide-title" dangerouslySetInnerHTML={{ __html: (b?.title || "Style Arrives<br/><em>in 30 Minutes</em>") }} />
                        <p className="slide-sub">{b?.subtitle || "Premium brands. Real-time inventory. Delivered to your door faster than you think."}</p>
                        <div className="slide-cta">
                          <button className="btn-slide-primary" onClick={() => { document.getElementById("shopProducts")?.scrollIntoView(); }}>{b?.cta || "Shop Now"}</button>
                          <button className="btn-slide-ghost">Explore Brands</button>
                        </div>
                      </div>
                      <div className="slide-img-area">
                        <img src={b?.imageUrl || "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&q=80"} alt="Fashion" />
                        <div className="slide-badge"><div className="slide-badge-num">30</div><div className="slide-badge-txt">Min Delivery</div></div>
                      </div>
                    </div>
                  );
                })()}
                {/* Slide 2 — Banner 2 */}
                {(() => {
                  const b = liveBanners["banner_2"];
                  return (
                    <div className="hero-slide slide-2">
                      <div className="slide-content">
                        <div className="slide-tag"><span>{b?.tag || "🥻 New Ethnic Collection"}</span></div>
                        <h1 className="slide-title" dangerouslySetInnerHTML={{ __html: (b?.title || "Celebrate Every<br/><em>Occasion</em>") }} />
                        <p className="slide-sub">{b?.subtitle || "Handpicked ethnic wear from India's finest designers. From ₹999 onwards — delivered instantly."}</p>
                        <div className="slide-cta">
                          <button className="btn-slide-primary" onClick={() => { setCurrentCategory(b?.cta ? "" : "Ethnic"); }}>{b?.cta || "Shop Ethnic"}</button>
                          <button className="btn-slide-ghost">View Lookbook</button>
                        </div>
                      </div>
                      <div className="slide-img-area">
                        <img src={b?.imageUrl || "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80"} alt="Ethnic Wear" />
                        <div className="slide-badge" style={{ background: "var(--gold2)" }}><div className="slide-badge-num">40%</div><div className="slide-badge-txt">Up to Off</div></div>
                      </div>
                    </div>
                  );
                })()}
                {/* Slide 3 — Banner 3 */}
                {(() => {
                  const b = liveBanners["banner_3"];
                  return (
                    <div className="hero-slide slide-3">
                      <div className="slide-content">
                        <div className="slide-tag"><span>{b?.tag || "👔 Men's New In"}</span></div>
                        <h1 className="slide-title" dangerouslySetInnerHTML={{ __html: (b?.title || "Dress Sharp.<br/><em>Every Day.</em>") }} />
                        <p className="slide-sub">{b?.subtitle || "Premium formals, casuals & ethnic wear for men. Top brands. Lightning delivery."}</p>
                        <div className="slide-cta">
                          <button className="btn-slide-primary" onClick={() => { setCurrentCategory(b?.cta ? "" : "Men's Wear"); }}>{b?.cta || "Shop Men's"}</button>
                          <button className="btn-slide-ghost">New Arrivals</button>
                        </div>
                      </div>
                      <div className="slide-img-area">
                        <img src={b?.imageUrl || "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=600&q=80"} alt="Men's Wear" />
                        <div className="slide-badge" style={{ background: "var(--green)" }}><div className="slide-badge-num">Free</div><div className="slide-badge-txt">Delivery</div></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <button className="hero-arrow prev" onClick={() => setActiveSlide((p) => (p === 0 ? 2 : p - 1))}>‹</button>
              <button className="hero-arrow next" onClick={() => setActiveSlide((p) => (p === 2 ? 0 : p + 1))}>›</button>
              <div className="hero-dots">
                <button className={`hero-dot ${activeSlide === 0 ? "active" : ""}`} onClick={() => setActiveSlide(0)}></button>
                <button className={`hero-dot ${activeSlide === 1 ? "active" : ""}`} onClick={() => setActiveSlide(1)}></button>
                <button className={`hero-dot ${activeSlide === 2 ? "active" : ""}`} onClick={() => setActiveSlide(2)}></button>
              </div>
            </div>


            {/* FLASH SALE */}
            <div className="flash-sale">
              <div className="flash-label">
                <span className="flash-icon">⚡</span>
                <div><div className="flash-title">Flash Sale</div><div className="flash-subtitle">Today's Best Deals</div></div>
              </div>
              <div className="flash-divider"></div>
              <div className="flash-timer">
                <span className="timer-label">Ends in</span>
                <div className="timer-block"><div className="timer-num">{timeLeft.h}</div><div className="timer-unit">Hrs</div></div>
                <span className="timer-sep">:</span>
                <div className="timer-block"><div className="timer-num">{timeLeft.m}</div><div className="timer-unit">Min</div></div>
                <span className="timer-sep">:</span>
                <div className="timer-block"><div className="timer-num">{timeLeft.s}</div><div className="timer-unit">Sec</div></div>
              </div>
              <div className="flash-divider"></div>
              <div className="flash-products">
                {products.slice(0, 5).map((p, i) => (
                  <div key={p.id} className="flash-product" onClick={() => { setViewProduct(p); setSelectedSize(p.sizes?.[0] || "M"); }}>
                    <img src={p.image} alt="" className="flash-product-img" />
                    <div>
                      <div className="flash-product-name">{p.name}</div>
                      <div className="flash-product-price">₹{p.price}</div>
                      <div className="flash-product-off">âˆ’30%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* NEW ARRIVALS */}
            <section className="section" id="shopProducts">
              <div className="sec-head reveal in">
                <div className="sec-head-left">
                  <div className="sec-eyebrow"><div className="sec-eyebrow-line"></div><span>Just In</span></div>
                  <h2 className="sec-title">New <em>Arrivals</em></h2>
                </div>
                <div className="sec-link" style={{ cursor: "pointer" }} onClick={() => setCurrentCategory("All")}>View All New Arrivals â†’</div>
              </div>

              <div className="deal-grid">
                {filteredProducts.length === 0 ? (
                  <p style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: "var(--sub)" }}>No products found</p>
                ) : (
                  filteredProducts.slice(0, 5).map((p, i) => (
                    <div key={p.id} className={`deal-card reveal in d${i}`} onClick={() => { setViewProduct(p); setSelectedSize(p.sizes?.[0] || "M"); }}>
                      <div className="deal-img-wrap">
                        <img src={p.image} alt={p.name} onError={(e) => { e.target.style.display = "none"; }} />
                        <div className="deal-badge-wrap">
                          {i === 0 && <span className="badge-new">New</span>}
                          {i === 1 && <span className="badge-hot">Hot</span>}
                          <span className="badge-off">âˆ’38%</span>
                        </div>
                        <button className="wishlist-btn">♡</button>
                        <div className="deal-quick" onClick={(e) => { e.stopPropagation(); addToCart(p, p.sizes?.[0] || "M"); }}>⚡ Quick Add</div>
                      </div>
                      <div className="deal-info">
                        <div className="deal-brand">{p.storeName || "DRESHO"}</div>
                        <div className="deal-name" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div className="deal-price-row"><span className="deal-price">₹{p.price}</span><span className="deal-mrp">₹{Math.floor(p.price * 1.38)}</span><span className="deal-off">38% off</span></div>
                        <div className="deal-rating"><span className="deal-rating-stars">â˜… 4.6</span><span className="deal-rating-count">(1.2k)</span></div>
                        <div className="deal-delivery"><span className="green-dot"></span>Delivery in 28 min</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* TRENDING NOW */}
            <section className="section">
              <div className="sec-head reveal in">
                <div className="sec-head-left">
                  <div className="sec-eyebrow"><div className="sec-eyebrow-line"></div><span>Trending</span></div>
                  <h2 className="sec-title">What's <em>Hot</em> Right Now</h2>
                </div>
                <div className="sec-link" style={{ cursor: "pointer" }} onClick={() => setCurrentCategory("All")}>See All â†’</div>
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
            </section>

            {/* SHOP BY CATEGORY */}
            <section className="section section-bg">
              <div className="sec-head reveal in">
                <div className="sec-head-left">
                  <div className="sec-eyebrow"><div className="sec-eyebrow-line"></div><span>Browse</span></div>
                  <h2 className="sec-title">Shop by <em>Category</em></h2>
                </div>
                <div className="sec-link" style={{ cursor: "pointer" }} onClick={() => setCurrentCategory("All")}>All Categories â†’</div>
              </div>
              <div className="cat-grid reveal in">
                <div className="cat-card" onClick={() => setCurrentCategory("Women's Wear")}><img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80" alt="Women" /><div className="cat-overlay"></div><div className="cat-arrow">â†’</div><div className="cat-content"><div className="cat-label">Explore</div><div className="cat-name">Women's<br />Collection</div><div className="cat-count">1,240 styles</div></div></div>
                <div className="cat-card" onClick={() => setCurrentCategory("Men's Wear")}><img src="https://images.unsplash.com/photo-1617137968427-85924c800a22?w=600&q=80" alt="Men" /><div className="cat-overlay"></div><div className="cat-arrow">â†’</div><div className="cat-content"><div className="cat-label">Explore</div><div className="cat-name">Men's Wear</div><div className="cat-count">980 styles</div></div></div>
                <div className="cat-card" onClick={() => setCurrentCategory("Ethnic")}><img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80" alt="Ethnic" /><div className="cat-overlay"></div><div className="cat-arrow">â†’</div><div className="cat-content"><div className="cat-label">Explore</div><div className="cat-name">Ethnic & Fusion</div><div className="cat-count">2,100 styles</div></div></div>
                <div className="cat-card" onClick={() => setCurrentCategory("Casual")}><img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80" alt="Footwear" /><div className="cat-overlay"></div><div className="cat-arrow">â†’</div><div className="cat-content"><div className="cat-label">Explore</div><div className="cat-name">Footwear</div><div className="cat-count">620 styles</div></div></div>
                <div className="cat-card" onClick={() => setCurrentCategory("Kids Wear")}><img src="https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=600&q=80" alt="Kids" /><div className="cat-overlay"></div><div className="cat-arrow">â†’</div><div className="cat-content"><div className="cat-label">Explore</div><div className="cat-name">Kids & Teen</div><div className="cat-count">450 styles</div></div></div>
              </div>
            </section>

            {/* MINI BANNERS */}
            <div style={{ padding: "0 40px 3px" }}>
              <div className="banner-pair">
                {/* Mini Banner 4 */}
                {(() => {
                  const b = liveBanners["banner_4"];
                  return (
                    <div className="mini-banner" onClick={() => setCurrentCategory(b ? "" : "Women's Wear")}>
                      <img src={b?.imageUrl || "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80"} alt={b?.tag || "Women Sale"} />
                      <div className="mini-banner-overlay"></div>
                      <div className="mini-banner-content">
                        <div className="mini-banner-tag">{b?.tag || "Women's Special"}</div>
                        <div className="mini-banner-title" dangerouslySetInnerHTML={{ __html: b?.title || "Up to 50%<br/>Off Today" }} />
                        <button className="mini-banner-btn">{b?.cta || "Shop Now"}</button>
                      </div>
                    </div>
                  );
                })()}
                {/* Mini Banner 5 */}
                {(() => {
                  const b = liveBanners["banner_5"];
                  return (
                    <div className="mini-banner" onClick={() => setCurrentCategory(b ? "" : "Men's Wear")}>
                      <img src={b?.imageUrl || "https://images.unsplash.com/photo-1550246140-5119ae4790b8?w=900&q=80"} alt={b?.tag || "Men Sale"} />
                      <div className="mini-banner-overlay"></div>
                      <div className="mini-banner-content">
                        <div className="mini-banner-tag">{b?.tag || "Men's Exclusive"}</div>
                        <div className="mini-banner-title" dangerouslySetInnerHTML={{ __html: b?.title || "New Season<br/>Formals" }} />
                        <button className="mini-banner-btn">{b?.cta || "Shop Now"}</button>
                      </div>
                    </div>
                  );
                })()}
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
                <div className="how-card reveal in"><div className="how-num">01</div><div className="how-icon-wrap"></div><h3 className="how-title">Set Location</h3><p className="how-desc">Share your address and we instantly show real-time inventory from the nearest Dresho dark store in your city.</p><div className="how-time">⚡ Under 10 seconds</div></div>
                <div className="how-card reveal in d1"><div className="how-num">02</div><div className="how-icon-wrap">✨</div><h3 className="how-title">Browse & Pick</h3><p className="how-desc">Explore 500+ premium Indian and global brands. Filter by size, colour, occasion, and price to find your perfect look.</p><div className="how-time">âœ¦ At your pace</div></div>
                <div className="how-card reveal in d2"><div className="how-num">03</div><div className="how-icon-wrap"></div><h3 className="how-title">Pay Securely</h3><p className="how-desc">Pay via UPI, card, net banking, or Cash on Delivery. Fully encrypted, 100% safe every single time.</p><div className="how-time">⚡ Under 5 seconds</div></div>
                <div className="how-card reveal in d3"><div className="how-num">04</div><div className="how-icon-wrap"></div><h3 className="how-title">Delivered Fast</h3><p className="how-desc">Your order is picked, quality-checked, and delivered in a premium Dresho bag. In 30 minutes or we refund.</p><div className="how-time">⚡ 30 min guarantee</div></div>
              </div>
            </section>

            {/* PARTNER / SELLER / RIDER SECTION */}
            <section className="section partner-section">
              <div className="sec-head reveal in" style={{ marginBottom: 36 }}>
                <div className="sec-head-left">
                  <div className="sec-eyebrow"><div className="sec-eyebrow-line"></div><span>Join Us</span></div>
                  <h2 className="sec-title">Grow with <em>Dresho</em></h2>
                </div>
              </div>
              <div className="partner-grid">
                <div className="partner-card reveal in">
                  <div className="partner-pill"><span>ðŸª For Brands & Sellers</span></div>
                  <h3 className="partner-title">Become a<br /><em>Dresho Seller</em></h3>
                  <p className="partner-desc">List your clothing brand on India's fastest growing quick commerce fashion platform. Reach millions of style-conscious customers across 12 cities and growing.</p>
                  <div className="partner-perks">
                    <div className="partner-perk"><div className="perk-check">âœ“</div><span>Zero listing fee for your first 3 months</span></div>
                    <div className="partner-perk"><div className="perk-check">âœ“</div><span>Dedicated seller dashboard and analytics</span></div>
                    <div className="partner-perk"><div className="perk-check">âœ“</div><span>Dresho handles all delivery and returns</span></div>
                    <div className="partner-perk"><div className="perk-check">âœ“</div><span>Weekly payouts, no hidden charges</span></div>
                    <div className="partner-perk"><div className="perk-check">âœ“</div><span>24/7 seller support team</span></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <Link href="/seller"><button className="btn-partner">Start Selling</button></Link>
                  </div>
                  <div className="partner-stats">
                    <div><div className="p-stat-num">5,000+</div><div className="p-stat-label">Active Sellers</div></div>
                    <div><div className="p-stat-num">₹2Cr+</div><div className="p-stat-label">Monthly GMV</div></div>
                    <div><div className="p-stat-num">12</div><div className="p-stat-label">Cities Live</div></div>
                  </div>
                </div>
                <div className="partner-card reveal in d2">
                  <div className="partner-pill"><span>ðŸ›µ For Delivery Partners</span></div>
                  <h3 className="partner-title">Become a<br /><em>Dresho Rider</em></h3>
                  <p className="partner-desc">Join India's most rewarding delivery network. Flexible hours, guaranteed earnings, and the pride of delivering style to thousands of customers every day.</p>
                  <div className="partner-perks">
                    <div className="partner-perk"><div className="perk-check">âœ“</div><span>Earn ₹25,000–₹45,000/month guaranteed</span></div>
                    <div className="partner-perk"><div className="perk-check">âœ“</div><span>Flexible shift timings — you choose your hours</span></div>
                    <div className="partner-perk"><div className="perk-check">âœ“</div><span>Weekly salary + performance bonuses</span></div>
                    <div className="partner-perk"><div className="perk-check">âœ“</div><span>Free Dresho uniform and delivery gear</span></div>
                    <div className="partner-perk"><div className="perk-check">âœ“</div><span>Health insurance and accident cover</span></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <Link href="/delivery"><button className="btn-partner">Apply Now</button></Link>
                  </div>
                  <div className="partner-stats">
                    <div><div className="p-stat-num">8,000+</div><div className="p-stat-label">Active Riders</div></div>
                    <div><div className="p-stat-num">99.2%</div><div className="p-stat-label">On-Time Rate</div></div>
                    <div><div className="p-stat-num">4.8â˜…</div><div className="p-stat-label">Avg Rating</div></div>
                  </div>
                </div>
              </div>
            </section>

            {/* TESTIMONIALS */}
            <section className="section section-bg">
              <div className="sec-head reveal in">
                <div className="sec-head-left">
                  <div className="sec-eyebrow"><div className="sec-eyebrow-line"></div><span>Reviews</span></div>
                  <h2 className="sec-title">What India <em>Says</em></h2>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 13, color: "var(--sub)" }}>â˜…â˜…â˜…â˜…â˜… <strong style={{ color: "var(--navy)", marginLeft: 6 }}>4.8 / 5</strong> &nbsp;from 50,000+ reviews</div>
              </div>
              <div className="reviews-grid">
                <div className="review-card reveal in"><div className="review-stars">â˜…â˜…â˜…â˜…â˜…</div><p className="review-text">"Ordered a lehenga for a last-minute wedding — it arrived in 27 minutes. I literally cried happy tears. Dresho is a lifesaver."</p><div className="reviewer"><div className="reviewer-av">P</div><div><div className="reviewer-name">Priya Sharma</div><div className="reviewer-loc">ðŸ“ Mumbai · Verified Buyer</div></div></div></div>
                <div className="review-card reveal in d1"><div className="review-stars">â˜…â˜…â˜…â˜…â˜…</div><p className="review-text">"Finally a premium fashion app that understands India. The packaging is luxurious and every product is authentic. 10/10."</p><div className="reviewer"><div className="reviewer-av">A</div><div><div className="reviewer-name">Arjun Mehta</div><div className="reviewer-loc">ðŸ“ Delhi · Verified Buyer</div></div></div></div>
                <div className="review-card reveal in d2"><div className="review-stars">â˜…â˜…â˜…â˜…â˜…</div><p className="review-text">"Dresho is like having a personal stylist on speed dial. Found Anita Dongre pieces I couldn't find anywhere in Bangalore!"</p><div className="reviewer"><div className="reviewer-av">N</div><div><div className="reviewer-name">Nisha Kapoor</div><div className="reviewer-loc">ðŸ“ Bangalore · Verified Buyer</div></div></div></div>
              </div>
            </section>

            {/* APP DOWNLOAD */}
            <div className="app-section">
              <div className="app-left reveal in">
                <div className="sec-eyebrow" style={{ marginBottom: 16 }}><div className="sec-eyebrow-line"></div><span>Get the App</span></div>
                <h2 className="app-title">Carry <em>Dresho</em><br />Everywhere</h2>
                <p className="app-desc">Real-time delivery tracking, exclusive app offers, and your entire wardrobe wishlist — all in your pocket.</p>
                <div className="app-btns">
                  <div className="app-btn"><span className="app-btn-icon"></span><div><div className="app-btn-sub">Download on the</div><div className="app-btn-main">App Store</div></div></div>
                  <div className="app-btn"><span className="app-btn-icon">â–¶</span><div><div className="app-btn-sub">Get it on</div><div className="app-btn-main">Google Play</div></div></div>
                </div>
                <div style={{ marginTop: 32, display: "flex", gap: 32 }}>
                  <div><div style={{ fontFamily: "var(--font-d)", fontSize: 28, color: "var(--gold2)" }}>4.8â˜…</div><div style={{ fontSize: 11, letterSpacing: 1, color: "rgba(234,224,210,.45)", marginTop: 2 }}>App Rating</div></div>
                  <div><div style={{ fontFamily: "var(--font-d)", fontSize: 28, color: "var(--gold2)" }}>2M+</div><div style={{ fontSize: 11, letterSpacing: 1, color: "rgba(234,224,210,.45)", marginTop: 2 }}>Downloads</div></div>
                  <div><div style={{ fontFamily: "var(--font-d)", fontSize: 28, color: "var(--gold2)" }}>50K+</div><div style={{ fontSize: 11, letterSpacing: 1, color: "rgba(234,224,210,.45)", marginTop: 2 }}>Reviews</div></div>
                </div>
              </div>
              <div className="app-right reveal in d2">
                <div className="phone-wrap">
                  <div className="ring ring1"></div><div className="ring ring2"></div>
                  <div className="phone-mockup">
                    <div className="phone-inner">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="phone-logo">Dres<span>h</span>o</span><span style={{ fontSize: 13 }}></span></div>
                      <div className="phone-search">🔍 Search clothes, brands…</div>
                      <div className="phone-strip">⚡ 28 min delivery active in your area</div>
                      <div className="phone-grid">
                        <div className="phone-card"><div className="phone-card-img"></div><div className="phone-card-name">Silk Kurta</div><div className="phone-card-price">₹3,299</div></div>
                        <div className="phone-card"><div className="phone-card-img"></div><div className="phone-card-name">Linen Shirt</div><div className="phone-card-price">₹2,199</div></div>
                        <div className="phone-card"><div className="phone-card-img"></div><div className="phone-card-name">Block Heels</div><div className="phone-card-price">₹4,999</div></div>
                        <div className="phone-card"><div className="phone-card-img"></div><div className="phone-card-name">Silk Saree</div><div className="phone-card-price">₹8,499</div></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <footer>
              <div className="footer-main">
                <div>
                  <div className="footer-brand">Dres<span>h</span>o</div>
                  <p className="footer-tagline">India's first luxury quick commerce fashion platform. Premium brands, delivered in 30 minutes.</p>
                  <div className="footer-social"><div className="soc">in</div><div className="soc">ig</div><div className="soc">tw</div><div className="soc">yt</div></div>
                  <div className="payment-icons"><span className="pay-icon">UPI</span><span className="pay-icon">VISA</span><span className="pay-icon">MC</span><span className="pay-icon">AMEX</span><span className="pay-icon">COD</span></div>
                </div>
                <div>
                  <div className="footer-col-title">Company</div>
                  <ul className="footer-links">
                    <li><Link href="/about">About Us</Link></li>
                  </ul>
                </div>
                <div>
                  <div className="footer-col-title">Help</div>
                  <ul className="footer-links">
                    <li><Link href="/track-order">Track Order</Link></li>
                    <li><Link href="/returns">Returns</Link></li>
                    <li><Link href="/size-guide">Size Guide</Link></li>
                    <li><Link href="/faqs">FAQs</Link></li>
                    <li><Link href="/contact">Contact Us</Link></li>
                  </ul>
                </div>

              </div>
              <div className="footer-bottom">
                <div className="footer-bottom-left">
                  <span>© 2026 Dresho Technologies Pvt. Ltd.</span>
                  <span>CIN: U74999MH2026PTC000001</span>
                </div>
                <div className="footer-bottom-right">
                  <span>Privacy Policy</span>
                  <span>Terms of Service</span>
                  <span>Cookie Policy</span>
                  <span>Grievance</span>
                </div>
              </div>
            </footer>

          </div>
        )}

        {/* â”€â”€ CART â”€â”€ */}
        {currentSection === "cart" && (
          <div style={{ padding: "32px 20px" }} className="animate-fade-in">
            <h3 style={{ fontFamily: "var(--font-d)", fontSize: 28, fontWeight: 400, color: "var(--navy)", marginBottom: 24 }}>My Cart</h3>
            {cart.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", border: "1px dashed var(--border)", background: "var(--ivory2)" }}>
                <span style={{ fontSize: 40, marginBottom: 12 }}></span>
                <p style={{ fontWeight: 500, color: "var(--sub)" }}>Your cart is empty.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {cart.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 16, background: "var(--card)", border: "1px solid var(--border)", padding: 12 }}>
                    <div style={{ width: 80, height: 100, background: "var(--ivory2)", flexShrink: 0 }}>
                      <img src={item.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} />
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--navy)" }}>{item.name}</h4>
                      <p style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>
                        Size: {item.selectedSize} · ₹{item.price} × {item.qty}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                        <button style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--ivory2)", color: "var(--navy)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }} onClick={() => changeQty(idx, -1)}>âˆ’</button>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--navy)" }}>{item.qty}</span>
                        <button style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "var(--navy)", color: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }} onClick={() => changeQty(idx, 1)}>+</button>
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", padding: "24px", marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 500, color: "var(--sub)", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>Total Amount</span>
                    <span style={{ fontSize: 24, fontWeight: 600, color: "var(--navy)" }}>₹{cartTotal}</span>
                  </div>
                  <button style={{ background: "var(--navy)", color: "#fff", border: "none", padding: "16px", width: "100%", marginTop: 24, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: 500, cursor: "pointer", transition: "background 0.3s" }} onClick={() => {
                    const addr = userData?.address;
                    setCheckoutAddress(typeof addr === "object" ? addr?.line || "" : addr || "");
                    setCheckoutLandmark(typeof addr === "object" ? addr?.landmark || "" : "");
                    setCheckoutCity(typeof addr === "object" ? addr?.city || "" : "");
                    setCheckoutPincode(typeof addr === "object" ? addr?.pincode || "" : "");
                    setCheckoutPhone(userData?.phone || "");
                    setShowCheckout(true);
                  }}>
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ ORDERS â”€â”€ */}
        {currentSection === "orders" && (
          <div style={{ padding: "32px 20px" }} className="animate-fade-in">
            <h3 style={{ fontFamily: "var(--font-d)", fontSize: 28, fontWeight: 400, color: "var(--navy)", marginBottom: 24 }}>My Orders</h3>
            {orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", border: "1px dashed var(--border)", background: "var(--ivory2)" }}>
                <span style={{ fontSize: 40, marginBottom: 12 }}></span>
                <p style={{ fontWeight: 500, color: "var(--sub)" }}>No orders yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {orders.map((o) => (
                  <div key={o.id} className="animate-fade-in-up" style={{ background: "var(--card)", border: "1px solid var(--border)", padding: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--sub)", letterSpacing: 1 }}>ORDER #{o.trackingId}</span>
                      <span style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", background: "var(--ivory2)", color: "var(--navy)", border: "1px solid var(--border)" }}>
                        {o.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      {o.items?.map((item, i) => (
                        <p key={i} style={{ fontSize: 13, color: "var(--sub)", display: "flex", justifyContent: "space-between" }}>
                          <span>{item.qty}× {item.name} {item.size ? `(${item.size})` : ""}</span>
                          <span style={{ fontWeight: 600, color: "var(--navy)" }}>₹{item.price * item.qty}</span>
                        </p>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid var(--border2)" }}>
                      <span style={{ fontSize: 12, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1 }}>Total</span>
                      <span style={{ fontSize: 20, fontWeight: 600, color: "var(--navy)" }}>₹{o.total}</span>
                    </div>
                    {o.status === "Out for Delivery" && (
                      <div style={{ marginTop: 16, padding: "16px", background: "var(--ivory2)", border: "1px dashed var(--gold)", textAlign: "center" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", textTransform: "uppercase", letterSpacing: 1 }}>
                          Delivery OTP: <span style={{ fontSize: 24, display: "block", marginTop: 4, color: "var(--gold)" }}>{o.deliveryOtp}</span>
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ ACCOUNT â”€â”€ */}
        {currentSection === "account" && (
          <div style={{ padding: "32px 20px" }} className="animate-fade-in">
            <h3 style={{ fontFamily: "var(--font-d)", fontSize: 28, fontWeight: 400, color: "var(--navy)", marginBottom: 24 }}>My Account</h3>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", padding: 24, marginBottom: 16, display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--ivory2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 24 }}></span>
              </div>
              <div>
                <h4 style={{ fontSize: 18, fontWeight: 600, color: "var(--navy)", marginBottom: 4 }}>{userData?.name}</h4>
                <p style={{ fontSize: 13, color: "var(--sub)" }}>{userData?.email}</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }} onClick={() => setCurrentSection('orders')}>
                <span style={{ fontSize: 20 }}></span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--navy)" }}>My Orders</span>
              </div>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }} onClick={() => setShowHelp(true)}>
                <span style={{ fontSize: 20 }}></span>
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
                Dresho is a premium quickâ€‘commerce platform delivering fashion in 30 minutes. We bring the latest trends from curated boutiques straight to your doorstep.
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

        {/* â”€â”€ FLOATING DELIVERY BAR â”€â”€ */}
        <div className={`float-bar${showFloatBar ? ' show' : ''}`}>
          <div className="float-bar-left">
            <div className="float-dot"></div>
            <div className="float-bar-text">⚡ Express delivery active — <strong>28 min to your location</strong></div>
          </div>
          <div className="float-bar-right">
            <div className="float-loc">ðŸ“ {userData?.address?.city ? `${userData.address.city}, ${userData.address.pincode}` : 'Select Location'}</div>
            <button className="btn-float" onClick={() => setCurrentSection('cart')}>Shop Now</button>
          </div>
        </div>

        {/* â”€â”€ PRODUCT DETAIL MODAL â”€â”€ */}
        {viewProduct && (
          <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(20,33,61,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setViewProduct(null)}>
            <div className="animate-scale-in" onClick={(e) => e.stopPropagation()} style={{ background: "var(--white)", width: "100%", maxWidth: 420, padding: 32, boxShadow: "var(--shadow-lg)" }}>
              <div style={{ height: 260, background: "var(--ivory2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, position: "relative" }}>
                <img src={viewProduct.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute" }} onError={(e) => { e.target.style.display = "none"; }} />
                <span style={{ fontSize: 40, color: "var(--sub)", opacity: 0.3 }}></span>
              </div>
              <p style={{ fontSize: 10, fontWeight: 600, color: "var(--gold)", letterSpacing: 2, textTransform: "uppercase" }}>{viewProduct.storeName || "DRESHO"}</p>
              <h3 style={{ fontFamily: "var(--font-d)", fontSize: 24, color: "var(--navy)", marginTop: 4 }}>{viewProduct.name}</h3>
              <p style={{ fontSize: 22, fontWeight: 600, color: "var(--navy)", marginTop: 8 }}>₹{viewProduct.price}</p>

              {/* Size Selector */}
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--sub)", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>Select Size</p>
                <div style={{ display: "flex", gap: 10 }}>
                  {(viewProduct.sizes || ["S", "M", "L", "XL"]).map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      style={{
                        width: 44, height: 44, fontSize: 13, fontWeight: 500,
                        background: selectedSize === size ? "var(--navy)" : "var(--ivory2)",
                        color: selectedSize === size ? "white" : "var(--navy)",
                        border: selectedSize === size ? "none" : "1px solid var(--border)",
                        cursor: "pointer", transition: "all 0.3s ease",
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
                <button style={{ flex: 1, background: "transparent", color: "var(--navy)", border: "1px solid var(--border2)", padding: 14, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer", transition: "all 0.3s" }} onClick={() => setViewProduct(null)}>Close</button>
                <button style={{ flex: 2, background: "var(--gold)", color: "white", border: "none", padding: 14, fontSize: 11, textTransform: "uppercase", letterSpacing: 2, cursor: "pointer", transition: "background 0.3s" }} onClick={() => addToCart(viewProduct, selectedSize)}>
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ CHECKOUT MODAL â”€â”€ */}
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
                  <span style={{ marginRight: 8 }}>{checkoutCoordinates ? 'âœ“' : 'ðŸ“'}</span>
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

        {/* â”€â”€ Address Management Modal â”€â”€ */}
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

      </div>
    </>
  );
}

/* â”€â”€ Styles â”€â”€ */
const s = {
  authCard: {
    width: "100%",
    maxWidth: 420,
    background: "var(--white)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "40px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
    boxShadow: "var(--shadow-lg)",
  },
  authHeader: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  authLogo: {
    width: 64,
    height: 64,
    borderRadius: 8,
    background: "var(--gold-bg)",
    border: "1px solid var(--gold-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  topNav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 20px",
    position: "sticky",
    top: 0,
    zIndex: 40,
    borderBottom: "1px solid var(--border)",
    background: "var(--white)",
  },
  heroBanner: {
    display: "none",
  },
  heroBannerGlow: {
    display: "none",
  },
  catBtn: {
    flexShrink: 0,
    padding: "8px 16px",
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 500,
    background: "var(--ivory2)",
    border: "1px solid var(--border)",
    color: "var(--sub)",
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontFamily: "var(--font-b)",
    whiteSpace: "nowrap",
  },
  catBtnActive: {
    background: "var(--navy)",
    color: "white",
    border: "1px solid var(--navy)",
  },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 14,
    marginTop: 20,
  },
  productCard: {
    borderRadius: 4,
    overflow: "hidden",
    cursor: "pointer",
    padding: 0,
    border: "1px solid var(--border)",
  },
  productImage: {
    height: 140,
    background: "var(--ivory2)",
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
    borderRadius: 4,
    cursor: "default",
    border: "1px solid var(--border)",
    background: "var(--white)",
  },
  cartItemImg: {
    width: 56,
    height: 56,
    borderRadius: 4,
    overflow: "hidden",
    background: "var(--ivory2)",
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
    borderTop: "1px solid var(--border)",
    background: "var(--white)",
  },
  navBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "none",
    color: "var(--sub)",
    cursor: "pointer",
    transition: "all 0.3s ease",
    padding: "6px 16px",
    fontFamily: "var(--font-b)",
  },
  navBtnActive: {
    color: "var(--gold)",
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
