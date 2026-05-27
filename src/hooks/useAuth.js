import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { requestNotificationPermission } from "@/lib/firebase";

/**
 * Reusable authentication hook for Dresho.
 * Encapsulates role detection, session expiration (10 min),
 * FCM push token registration, and single-device rider login checking.
 * 
 * @param {string} role - The expected role: 'user', 'seller', or 'delivery'.
 */
export function useAuth(role = "user") {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null); // stores user/seller/rider profile
  const [loading, setLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [authStep, setAuthStep] = useState("welcome");

  useEffect(() => {
    let profileUnsub;
    
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (u) {
          let collectionName = "users";
          if (role === "seller") collectionName = "sellers_profile";
          if (role === "delivery") collectionName = "delivery_profile";

          let snap = null;
          try {
            snap = await getDoc(doc(db, collectionName, u.uid));
            
            // Race condition fix (wait for signup transaction to commit in backend)
            if (!snap.exists()) {
              await new Promise(r => setTimeout(r, 2000));
              snap = await getDoc(doc(db, collectionName, u.uid));
            }
          } catch (err) {
            console.error(`Error loading profile from ${collectionName}:`, err);
          }

          if (snap && snap.exists() && snap.data().role === role) {
            // ── Device Binding Check (Delivery Agents Only) ──
            let deviceId = "";
            if (role === "delivery") {
              deviceId = localStorage.getItem("dreshoDeviceId");
              if (!deviceId) {
                deviceId = Math.random().toString(36).substring(2, 15);
                localStorage.setItem("dreshoDeviceId", deviceId);
              }
              if (snap.data().activeDeviceId !== deviceId) {
                await updateDoc(doc(db, "delivery_profile", u.uid), { activeDeviceId: deviceId }).catch(e => console.error(e));
              }
            }

            // ── Session Expiry Check (10 Minutes Inactivity) ──
            const lastActive = localStorage.getItem("dreshoLastActive");
            const now = Date.now();
            if (lastActive && now - parseInt(lastActive) > 10 * 60 * 1000) {
              localStorage.setItem("dreshoSavedEmail", u.email || "");
              await signOut(auth);
              localStorage.removeItem("dreshoLastActive");
              setUser(null);
              setUserData(null);
              setAuthStep("welcome");
              alert("Session expired. Please login again.");
              setLoading(false);
              return;
            }
            localStorage.setItem("dreshoLastActive", now.toString());

            setUser(u);
            const currentData = snap.data();
            setUserData(currentData);

            if (role === "seller" || role === "delivery") {
              setIsPending(!currentData.approved);
            }

            // Request FCM Token & Save
            requestNotificationPermission().then((token) => {
              if (token && currentData.fcmToken !== token) {
                updateDoc(doc(db, collectionName, u.uid), { fcmToken: token }).catch(e => console.error(e));
              }
            }).catch(e => console.error(e));

            // Listen to updates in real-time for Single Device Logout
            if (role === "delivery") {
              profileUnsub = onSnapshot(doc(db, "delivery_profile", u.uid), (docSnap) => {
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  if (data.activeDeviceId && data.activeDeviceId !== deviceId) {
                    alert("You have logged in from another device. You will be logged out here.");
                    signOut(auth);
                    setUser(null);
                    setUserData(null);
                    setAuthStep("welcome");
                  }
                }
              }, (err) => {
                console.error("Error listening to delivery profile:", err);
              });
            }
          } else {
            // If the profile document doesn't match the expected role,
            // for the shop panel, we check for other roles to restrict access or label correctly
            if (role === "user") {
              let currentRole = "user";
              let finalData = (snap && snap.exists()) ? snap.data() : null;

              if (snap && snap.exists() && snap.data().role === "user") {
                // Matches user role, handled above
              } else {
                let sellerSnap = null;
                try {
                  sellerSnap = await getDoc(doc(db, "sellers_profile", u.uid));
                } catch (err) {
                  console.warn("Could not check seller profile due to security rules:", err.message);
                }

                if (sellerSnap && sellerSnap.exists() && sellerSnap.data().role === "seller") {
                  currentRole = "seller";
                  finalData = sellerSnap.data();
                } else {
                  let riderSnap = null;
                  try {
                    riderSnap = await getDoc(doc(db, "delivery_profile", u.uid));
                  } catch (err) {
                    console.warn("Could not check delivery profile due to security rules:", err.message);
                  }

                  if (riderSnap && riderSnap.exists() && riderSnap.data().role === "delivery") {
                    currentRole = "delivery";
                    finalData = riderSnap.data();
                  } else {
                    // Fallback to admin role
                    const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "prinxadmin29@gmail.com,krishnaprakash0016@gmail.com").split(",").map(e => e.trim().toLowerCase());
                    if (u.email && ADMIN_EMAILS.includes(u.email.toLowerCase())) {
                      currentRole = "admin";
                      finalData = { name: "Admin" };
                    } else if (snap && snap.exists()) {
                      await signOut(auth);
                      alert("Unauthorized role for this panel.");
                      setLoading(false);
                      return;
                    }
                  }
                }
              }

              // Session check for shop/user
              const lastActive = localStorage.getItem("dreshoLastActive");
              const now = Date.now();
              if (lastActive && now - parseInt(lastActive) > 10 * 60 * 1000) {
                localStorage.setItem("dreshoSavedEmail", u.email || "");
                await signOut(auth);
                localStorage.removeItem("dreshoLastActive");
                setUser(null);
                setUserData(null);
                alert("Session expired. Please login again.");
                setLoading(false);
                return;
              }
              localStorage.setItem("dreshoLastActive", now.toString());

              setUser(u);
              setUserData({ ...finalData, role: currentRole });

              if (currentRole === "user" && snap && snap.exists()) {
                requestNotificationPermission().then((token) => {
                  if (token && finalData?.fcmToken !== token) {
                    updateDoc(doc(db, "users", u.uid), { fcmToken: token }).catch(e => console.error(e));
                  }
                }).catch(e => console.error(e));
              }
            } else {
              // Seller/Delivery registering for the first time
              setUser(u);
              setUserData(null);
              setIsPending(false);
              if (role === "seller") {
                setAuthStep((prev) => prev === "welcome" || prev === "google" ? "phone" : prev);
              }
            }
          }
        } else {
          setUser(null);
          setUserData(null);
          setIsPending(false);
          setAuthStep("welcome");
        }
      } catch (err) {
        console.error("Auth state checking failure:", err);
        setUser(null);
        setUserData(null);
        setIsPending(false);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsub();
      if (profileUnsub) profileUnsub();
    };
  }, [role]);

  // Session keep-alive trigger
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        localStorage.setItem("dreshoLastActive", Date.now().toString());
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem("dreshoLastActive");
    setUser(null);
    setUserData(null);
    setIsPending(false);
    setAuthStep("welcome");
  };

  return {
    user,
    userData,
    loading,
    isPending,
    setIsPending,
    authStep,
    setAuthStep,
    logout,
    setUserData,
  };
}
