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
  onSnapshot, updateDoc, increment,
} from "firebase/firestore";

export default function DeliveryPage() {
  const [user, setUser] = useState(null);
  const [riderData, setRiderData] = useState(null);
  const [isPending, setIsPending] = useState(false);

  // Auth flow states
  const [authStep, setAuthStep] = useState("google"); // google, basic, vehicle, documents, availability, phone, otp
  const [authPhone, setAuthPhone] = useState("");
  const [authOtp, setAuthOtp] = useState(["", "", "", "", "", ""]);
  const [confirmResult, setConfirmResult] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Form Fields
  const [riderName, setRiderName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  
  const [vehicleType, setVehicleType] = useState("Bike");
  const [vehicleNumber, setVehicleNumber] = useState("");
  
  const [idProofFile, setIdProofFile] = useState(null);
  const [idProofPreview, setIdProofPreview] = useState("");
  const [drivingLicenseFile, setDrivingLicenseFile] = useState(null);
  const [drivingLicensePreview, setDrivingLicensePreview] = useState("");
  const [rcBookFile, setRcBookFile] = useState(null);
  const [rcBookPreview, setRcBookPreview] = useState("");
  
  const [workingHours, setWorkingHours] = useState("");
  const [preferredZone, setPreferredZone] = useState("");
  const [upiId, setUpiId] = useState("");

  const [isOnline, setIsOnline] = useState(false);
  const [tab, setTab] = useState("jobs");
  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeDeliveries, setActiveDeliveries] = useState([]);

  // OTP Modal
  const [showOtp, setShowOtp] = useState(false);
  const [otpOrderId, setOtpOrderId] = useState(null);
  const [otpExpected, setOtpExpected] = useState(null);
  const [otpInput, setOtpInput] = useState("");

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
          setUser(u);
          setRiderData(snap.data());
        } else {
          // Not a delivery agent yet! Show registration form
          setUser(null);
          setRiderData(null);
          setAuthStep((prev) => prev === "google" ? "basic" : prev);
        }
      } else { 
        setUser(null); 
        setRiderData(null); 
        setAuthStep("google"); 
      }
    });
    return () => unsub();
  }, []);

  // Available jobs
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "orders"), where("status", "==", "Shipped"), where("riderId", "==", null));
    const unsub = onSnapshot(q, (snap) => {
      const o = []; snap.forEach((d) => o.push({ id: d.id, ...d.data() }));
      setAvailableOrders(o);
    });
    return () => unsub();
  }, [user]);

  // Active deliveries
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "orders"), where("riderId", "==", user.uid), where("status", "==", "Out for Delivery"));
    const unsub = onSnapshot(q, (snap) => {
      const o = []; snap.forEach((d) => o.push({ id: d.id, ...d.data() }));
      setActiveDeliveries(o);
    });
    return () => unsub();
  }, [user]);

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

  const uploadToImgBB = async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.success) throw new Error("Image upload failed.");
    return data.data.url;
  };

  const submitRegistration = async () => {
    if (!agreedTerms) return alert("You must agree to the Terms & Conditions.");
    // No need to set authLoading here because handleVerifyOtp already did it.
    try {
      let idProofUrl = "";
      let drivingLicenseUrl = "";
      if (idProofFile) idProofUrl = await uploadToImgBB(idProofFile);
      if (drivingLicenseFile) drivingLicenseUrl = await uploadToImgBB(drivingLicenseFile);

      await setDoc(doc(db, "delivery_profile", auth.currentUser.uid), {
        phone: "+91" + authPhone,
        name: riderName, address, email,
        vehicleType, vehicleNumber,
        idProofUrl, drivingLicenseUrl,
        workingHours, preferredZone, upiId,
        role: "delivery", approved: false, online: false, earnings: 0, deliveryCount: 0,
        createdAt: new Date(),
      });
      setIsPending(true);
    } catch (e) { alert("Registration failed: " + e.message); }
  };

  const toggleOnline = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    await updateDoc(doc(db, "delivery_profile", user.uid), { online: newStatus });
  };

  const acceptOrder = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { riderId: user.uid, status: "Out for Delivery" });
    setTab("active");
  };

  const openOtpModal = (orderId, otp) => {
    setOtpOrderId(orderId);
    setOtpExpected(otp);
    setOtpInput("");
    setShowOtp(true);
  };

  const confirmDelivery = async () => {
    if (parseInt(otpInput) === otpExpected) {
      await updateDoc(doc(db, "orders", otpOrderId), { status: "Delivered" });
      await updateDoc(doc(db, "delivery_profile", user.uid), {
        earnings: increment(40),
        deliveryCount: increment(1),
      });
      setRiderData((prev) => ({
        ...prev,
        earnings: (prev.earnings || 0) + 40,
        deliveryCount: (prev.deliveryCount || 0) + 1,
      }));
      setShowOtp(false);
      alert("Delivery Success! ₹40 added to wallet.");
      setTab("jobs");
    } else {
      alert("Invalid OTP! Check with customer.");
    }
  };

  // AUTH SCREEN
  if (!user) {
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
              <h1 style={{ fontFamily: "var(--font-d)", fontSize: 44, fontWeight: 400, color: "var(--navy)", letterSpacing: 4, marginBottom: 12 }}>
                Dres<span style={{ color: "var(--gold)" }}>h</span>o
              </h1>
              <p style={{ color: "var(--sub)", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>Rider Access</p>
            </div>

            {/* Steps Indicator */}
            {authStep !== "google" && authStep !== "phone" && authStep !== "otp" && (
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: -10 }}>
                {["basic", "vehicle", "documents", "availability"].map((stepItem) => (
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
                <input className="glass-input" placeholder="Full Name" value={riderName} onChange={(e) => setRiderName(e.target.value)} />
                <input className="glass-input" placeholder="Full Address" value={address} onChange={(e) => setAddress(e.target.value)} />
                <input className="glass-input" type="email" placeholder="Email (Optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="auth-btn-primary" onClick={() => {
                  if(!riderName || !address) return alert("Fill required fields");
                  setAuthStep("vehicle");
                }}>Next</button>
              </div>
            )}

            {/* ── STEP 3: Vehicle Info ── */}
            {authStep === "vehicle" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <select className="glass-input" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} style={{ cursor: "pointer" }}>
                  <option value="Bike">Bike</option>
                  <option value="Scooter">Scooter</option>
                </select>
                <input className="glass-input" placeholder="Vehicle Number (e.g. DL 1S AB 1234)" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="auth-btn-ghost" onClick={() => setAuthStep("basic")} style={{ flex: 1 }}>Back</button>
                  <button className="auth-btn-primary" onClick={() => {
                    if(!vehicleNumber) return alert("Fill Vehicle Number");
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
                      const f = e.target.files[0]; if(f) { setIdProofFile(f); setIdProofPreview(URL.createObjectURL(f)); }
                    }} style={{ display: "none" }} id="idUpload" />
                    <div onClick={() => document.getElementById("idUpload").click()} style={{ minHeight: 100, border: "2px dashed var(--border2)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer", background: "rgba(255,255,255,0.5)", transition: "all 0.3s ease" }}>
                      {idProofPreview ? <img src={idProofPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} /> : <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)" }}>Tap to upload</p>}
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>DRIVING LICENSE</p>
                    <input type="file" accept="image/*" onChange={(e) => {
                      const f = e.target.files[0]; if(f) { setDrivingLicenseFile(f); setDrivingLicensePreview(URL.createObjectURL(f)); }
                    }} style={{ display: "none" }} id="dlUpload" />
                    <div onClick={() => document.getElementById("dlUpload").click()} style={{ minHeight: 100, border: "2px dashed var(--border2)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer", background: "rgba(255,255,255,0.5)", transition: "all 0.3s ease" }}>
                      {drivingLicensePreview ? <img src={drivingLicensePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} /> : <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)" }}>Tap to upload</p>}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button className="auth-btn-ghost" onClick={() => setAuthStep("vehicle")} style={{ flex: 1 }}>Back</button>
                  <button className="auth-btn-primary" onClick={() => {
                    if(!idProofFile || !drivingLicenseFile) return alert("ID and Driving License are required");
                    setAuthStep("availability");
                  }} style={{ flex: 1 }}>Next</button>
                </div>
              </div>
            )}

            {/* ── STEP 5: Availability ── */}
            {authStep === "availability" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <input className="glass-input" placeholder="Working Hours (e.g. 10 AM - 8 PM)" value={workingHours} onChange={(e) => setWorkingHours(e.target.value)} />
                <input className="glass-input" placeholder="Preferred Area/Zone" value={preferredZone} onChange={(e) => setPreferredZone(e.target.value)} />
                <input className="glass-input" placeholder="UPI ID (For Payments)" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 4 }}>
                  <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--gold)", width: 18, height: 18, cursor: "pointer" }} />
                  <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    I agree to Dresho&apos;s <span onClick={() => setShowTermsModal(true)} style={{ color: "var(--gold)", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Delivery Partner Agreement</span>
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
                  <button className="auth-btn-ghost" onClick={() => setAuthStep("availability")} style={{ flex: 1 }}>Back</button>
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
      </>
    );
  }

  // MAIN RIDER APP
  return (
    <>
      <div className=""><div className="" /></div>
      <div className="page-content " style={{ paddingBottom: 40, position: "relative", zIndex: 1 }}>
        {/* Top Nav */}
        <nav style={s.topNav} className="premium-nav">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/" style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(26,13,220,0.06)", border: "1px solid rgba(26,13,220,0.12)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "var(--gold)", transition: "all 0.3s ease", flexShrink: 0 }}>
              <i className="fas fa-house" style={{ fontSize: 13 }} />
            </Link>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: "var(--gold)", letterSpacing: 2 }}>DRESHO RIDER</h2>
              <p style={{ fontSize: 10, fontWeight: 700, color: isOnline ? "var(--navy)" : "var(--text-muted)", letterSpacing: 2, textTransform: "uppercase" }}>
                {isOnline ? "Online" : "Offline"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Online Toggle */}
            <div onClick={toggleOnline} style={{
              width: 56, height: 32, borderRadius: 16, position: "relative", cursor: "pointer",
              transition: "all 0.3s ease",
              background: isOnline ? "rgba(20,184,166,0.4)" : "rgba(255,255,255,0.06)",
              border: isOnline ? "1px solid rgba(20,184,166,0.4)" : "1px solid rgba(255,255,255,0.08)",
              boxShadow: isOnline ? "0 0 20px rgba(20,184,166,0.3)" : "none",
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 12, position: "absolute", top: 3,
                left: isOnline ? "calc(100% - 28px)" : "4px",
                background: isOnline ? "#2dd4bf" : "rgba(255,255,255,0.3)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: isOnline ? "0 2px 10px rgba(20,184,166,0.4)" : "none",
              }} />
            </div>
            <button className="btn-icon" onClick={() => signOut(auth)}>
              <i className="fas fa-power-off" style={{ fontSize: 14 }} />
            </button>
          </div>
        </nav>

        <main style={{ padding: "0 20px" }}>
          {/* Earnings Card */}
          <div style={s.earningsCard}>
            <div style={s.earningsGlow} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.9, letterSpacing: 1 }}>TODAY&apos;S EARNINGS</p>
                <h3 style={{ fontSize: 36, fontWeight: 900, marginTop: 6 }}>₹{riderData?.earnings || 0}</h3>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fas fa-wallet" style={{ fontSize: 20 }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.15)", fontSize: 12, fontWeight: 700 }}>
              <span>Deliveries: {riderData?.deliveryCount || 0}</span>
              <span>Rating: 4.9 ★</span>
            </div>
          </div>

          {/* Tab Switcher */}
          <div style={{ display: "flex", background: "rgba(0,0,0,0.04)", borderRadius: 16, padding: 4, gap: 4, marginTop: 20, marginBottom: 20 }}>
            {["jobs", "active"].map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: tab === t ? "white" : "transparent",
                color: tab === t ? "var(--navy)" : "var(--text-muted)",
                border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif",
                transition: "all 0.3s ease",
                boxShadow: tab === t ? "0 2px 10px rgba(0,0,0,0.2)" : "none",
              }}>
                {t === "jobs" ? "Job Board" : "My Route"}
              </button>
            ))}
          </div>

          {/* JOB BOARD */}
          {tab === "jobs" && (
            <div className="animate-fade-in">
              <p className="section-label" style={{ marginBottom: 14 }}>AVAILABLE NEAR YOU</p>
              {!isOnline ? (
                <div style={s.emptyState}>
                  <i className="fas fa-satellite-dish" style={{ fontSize: 36, color: "var(--text-tertiary)", marginBottom: 12, animation: "rotate3d 4s linear infinite" }} />
                  <p style={{ fontWeight: 700, color: "var(--text-tertiary)" }}>Go Online to see orders...</p>
                </div>
              ) : availableOrders.length === 0 ? (
                <div style={s.emptyState}>
                  <i className="fas fa-box-open" style={{ fontSize: 36, color: "var(--text-tertiary)", marginBottom: 12 }} />
                  <p style={{ fontWeight: 700, color: "var(--text-tertiary)" }}>No jobs available yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {availableOrders.map((o) => (
                    <div key={o.id} className="premium-card animate-fade-in-up" style={{ padding: "20px 22px", borderRadius: 24, cursor: "default" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <span className="badge badge-purple">New Job</span>
                        <span style={{ fontWeight: 800, color: "var(--navy)" }}>₹40 Earning</span>
                      </div>
                      <h5 style={{ fontWeight: 700, marginBottom: 4 }}>{o.userName}</h5>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <i className="fas fa-location-dot" style={{ marginRight: 6 }} />{o.userAddress}
                      </p>
                      <button className="auth-btn-primary" style={{ borderRadius: 14 }} onClick={() => acceptOrder(o.id)}>
                        Accept Delivery
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ACTIVE DELIVERIES */}
          {tab === "active" && (
            <div className="animate-fade-in">
              <p className="section-label" style={{ marginBottom: 14 }}>ONGOING DELIVERY</p>
              {activeDeliveries.length === 0 ? (
                <div style={s.emptyState}>
                  <i className="fas fa-route" style={{ fontSize: 36, color: "var(--text-tertiary)", marginBottom: 12 }} />
                  <p style={{ fontWeight: 700, color: "var(--text-tertiary)" }}>No active deliveries</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {activeDeliveries.map((o) => (
                    <div key={o.id} className="glass-card" style={{ padding: "24px", borderRadius: 28, cursor: "default", border: "1px solid rgba(20,184,166,0.15)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏠</div>
                        <div>
                          <h4 style={{ fontWeight: 700 }}>{o.userName}</h4>
                          <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{o.userPhone}</p>
                        </div>
                      </div>
                      <div style={{ padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,0.03)", marginBottom: 16, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        {o.userAddress}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <a href={`tel:${o.userPhone}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontWeight: 700, fontSize: 14, color: "var(--text-primary)", textDecoration: "none" }}>
                          <i className="fas fa-phone" /> Call
                        </a>
                        <button className="auth-btn-primary" style={{ borderRadius: 16, padding: "14px", background: "linear-gradient(135deg, #14b8a6, #0d9488)" }} onClick={() => openOtpModal(o.id, o.deliveryOtp)}>
                          Complete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* OTP MODAL */}
        {showOtp && (
          <div className="modal-overlay" onClick={() => setShowOtp(false)}>
            <div className="modal-content animate-scale-in" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Verify Handover</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>Ask customer for the 4-digit OTP</p>
              <input
                type="number"
                className="glass-input"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="0000"
                style={{ textAlign: "center", fontSize: 32, fontWeight: 900, letterSpacing: 12, padding: "20px" }}
              />
              <button className="auth-btn-primary" style={{ marginTop: 20, borderRadius: 16, background: "linear-gradient(135deg, #14b8a6, #0d9488)" }} onClick={confirmDelivery}>
                Complete Delivery
              </button>
              <button className="auth-btn-ghost" style={{ width: "100%", marginTop: 8, textAlign: "center", color: "var(--text-tertiary)" }} onClick={() => setShowOtp(false)}>
                Cancel
              </button>
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
    marginBottom: 8, boxShadow: "0 0 40px rgba(26, 13, 220, 0.1)",
  },
  topNav: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px",
    position: "sticky", top: 0, zIndex: 40,
    background: "rgba(248, 247, 244, 0.8)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)",
    borderBottom: "1px solid rgba(0,0,0,0.05)",
  },
  earningsCard: {
    background: "linear-gradient(135deg, var(--gold), var(--navy), var(--blue-bright))",
    padding: "28px 24px",
    borderRadius: 28,
    color: "white",
    position: "relative",
    overflow: "hidden",
    marginTop: 16,
    boxShadow: "0 12px 30px rgba(26, 13, 220, 0.25)",
  },
  earningsGlow: {
    position: "absolute", top: -40, right: -40, width: 140, height: 140,
    borderRadius: "50%", background: "rgba(6, 182, 212, 0.3)", filter: "blur(50px)",
  },
  emptyState: {
    textAlign: "center", padding: 60, display: "flex", flexDirection: "column", alignItems: "center",
  },
};

