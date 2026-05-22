// src/app/api/return-request/route.js
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuthUser } from "@/lib/auth"; // helper to get authenticated user from cookies/session

export async function POST(req) {
  try {
    const { orderId, reason, details, checklist } = await req.json();
    const user = await getAuthUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthenticated" }), { status: 401 });
    }

    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
    }
    const orderData = orderSnap.data();
    if (orderData.userId !== user.uid) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const deliveredAt = orderData.deliveredAt?.toDate?.();
    if (!deliveredAt) {
      return new Response(JSON.stringify({ error: "Order not delivered yet" }), { status: 400 });
    }
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;
    if (now - deliveredAt.getTime() > windowMs) {
      return new Response(JSON.stringify({ error: "Return window closed" }), { status: 400 });
    }
    const deadline = new Date(deliveredAt.getTime() + windowMs);

    // Update order with return request
    await updateDoc(orderRef, {
      returnRequest: {
        requested: true,
        deadline: deadline,
        reason,
        details,
        checklist,
        status: "pending",
        requestedAt: serverTimestamp(),
      },
    });

    // Create/merge seller notification document
    const sellerNotifRef = doc(db, "seller_notifications", orderData.sellerId);
    await setDoc(
      sellerNotifRef,
      {
        type: "returnRequest",
        orderId,
        productId: orderData.productId,
        customerId: user.uid,
        reason,
        details,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error("Return request error", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
