import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

/**
 * Reusable React Hook to handle real-time subscriptions to orders.
 * Supports users, sellers, and riders with custom filtering and calculation logics.
 * 
 * @param {Object} options - Filtering options
 * @param {string} [options.userId] - Filter orders placed by this user
 * @param {string} [options.sellerId] - Filter orders belonging to this seller
 * @param {string} [options.riderId] - Rider's UID for active deliveries
 * @param {string} [options.role] - Specific role to toggle logic ('user', 'seller', 'delivery')
 * @param {boolean} [options.approved] - For riders, whether they are approved to accept jobs
 */
export function useOrders(options = {}) {
  const [orders, setOrders] = useState([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  
  // Rider specific states
  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  
  const [loading, setLoading] = useState(true);

  const { userId, sellerId, riderId, role, approved } = options;

  useEffect(() => {
    let unsub1;
    let unsub2;

    // ── Rider Logic ──
    if (role === "delivery") {
      if (!riderId || !approved) {
        setLoading(false);
        return;
      }

      // 1. Listen for Available Orders
      const availableQuery = query(
        collection(db, "orders"),
        where("status", "in", ["Searching Rider", "Rider Searching", "Return Approved", "Exchange Approved"]),
        where("riderId", "==", null)
      );

      unsub1 = onSnapshot(availableQuery, (snap) => {
        const jobs = [];
        snap.forEach((d) => jobs.push({ id: d.id, ...d.data() }));
        setAvailableOrders(jobs);
        setLoading(false);
      }, (err) => {
        console.error("Error listening to available rider orders:", err);
      });

      // 2. Listen for Active Deliveries
      const activeQuery = query(
        collection(db, "orders"),
        where("riderId", "==", riderId),
        where("status", "in", [
          "Rider Accepted", "Rider Assigned", "Rider Arrived At Pickup", "Preparing", "Preparing Order",
          "Packed Ready", "Ready For Pickup", "Picked Up", "Out For Delivery", "Pickup Assigned",
          "Pickup Scheduled", "Return Approved", "Exchange Approved", "Delivered", "Returned",
          "Exchanged", "Return Completed", "Exchange Completed"
        ])
      );

      unsub2 = onSnapshot(activeQuery, (snap) => {
        const jobs = [];
        snap.forEach((d) => jobs.push({ id: d.id, ...d.data() }));
        setActiveDeliveries(jobs);
      }, (err) => {
        console.error("Error listening to active rider orders:", err);
      });

      return () => {
        if (unsub1) unsub1();
        if (unsub2) unsub2();
      };
    }

    // ── Seller Logic ──
    if (sellerId) {
      const q = query(collection(db, "orders"), where("sellerId", "==", sellerId));
      
      unsub1 = onSnapshot(q, (snap) => {
        const list = [];
        let sales = 0;
        let pending = 0;

        snap.forEach((d) => {
          const order = { id: d.id, ...d.data() };
          list.push(order);
          if (order.status?.toUpperCase() === "DELIVERED") {
            sales += order.total;
          }
          if (order.status === "Pending" || order.status === "Placed") {
            pending++;
          }
        });

        setOrders(list);
        setSalesTotal(sales);
        setPendingCount(pending);
        setLoading(false);
      }, (err) => {
        console.error("Error listening to seller orders:", err);
        setLoading(false);
      });

      return () => {
        if (unsub1) unsub1();
      };
    }

    // ── User / Customer Logic ──
    if (userId) {
      const q = query(collection(db, "orders"), where("userId", "==", userId));

      unsub1 = onSnapshot(q, (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        
        // Sort newest first
        list.sort((a, b) => {
          const aTime = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        setOrders(list);
        setLoading(false);
      }, (err) => {
        console.error("Error listening to user orders:", err);
        setLoading(false);
      });

      return () => {
        if (unsub1) unsub1();
      };
    }

    setLoading(false);
  }, [userId, sellerId, riderId, role, approved]);

  return {
    orders,
    salesTotal,
    pendingCount,
    availableOrders,
    activeDeliveries,
    loading
  };
}
