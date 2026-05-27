// src/hooks/useSellerStatus.js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Returns a boolean indicating whether the given seller is currently online.
 * The Firestore document `sellers_profile/<sellerUid>` must contain a boolean field `online`.
 */
export const useSellerStatus = (sellerUid) => {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!sellerUid) {
      setIsOnline(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "sellers_profile", sellerUid), (snap) => {
      setIsOnline(snap.exists() && snap.data().online === true);
    }, (err) => {
      console.error(`Error listening to seller status for ${sellerUid}:`, err);
    });
    return () => unsub();
  }, [sellerUid]);

  return isOnline;
};
