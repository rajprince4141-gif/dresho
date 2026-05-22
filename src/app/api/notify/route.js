import { adminMessaging, adminDb } from '@/lib/firebase-admin';

export const maxDuration = 30; // 30 seconds limit

export async function POST(req) {
  try {
    const { userId, role, title, body, link, data, type = "single", segment } = await req.json();

    if (!title || !body) {
      return Response.json({ error: 'Title and body are required' }, { status: 400 });
    }

    const timestamp = new Date().toISOString();
    const notificationPayload = {
      title,
      body,
      link: link || "",
      data: data || {},
      read: false,
      createdAt: timestamp,
    };

    let pushTokens = [];

    // --- BROADCAST TO ALL RIDERS (e.g., "New Delivery Available") ---
    if (type === "broadcast_riders") {
      notificationPayload.role = "rider";
      notificationPayload.type = "delivery_available";
      
      // Save globally for broadcast history (optional)
      await adminDb.collection('broadcast_notifications').add(notificationPayload);

      // Get all online riders (filter approved in JS)
      const ridersSnap = await adminDb.collection('delivery_profile').where('online', '==', true).get();
      ridersSnap.forEach((doc) => {
        const rData = doc.data();
        if (rData.approved && rData.fcmToken) pushTokens.push(rData.fcmToken);
      });
    }
    // --- BROADCAST TO CUSTOMERS (With Segmentation) ---
    else if (type === "broadcast_customers") {
      notificationPayload.role = "customer";
      notificationPayload.type = "marketing";
      notificationPayload.segment = segment || "all";
      
      await adminDb.collection('broadcast_notifications').add(notificationPayload);

      const usersSnap = await adminDb.collection('users').get();
      usersSnap.forEach((doc) => {
        const uData = doc.data();
        if (!uData.fcmToken) return;
        
        // Basic Segmentation Logic
        // If segment is "all" or "customers", send to everyone.
        // If segment is "segment_men", only send if they have a preference or we default to true for demo.
        // In a production app, we would check uData.preferences.includes("menswear"). 
        // For this demo, we will simulate the segment check:
        if (segment === "segment_men" && uData.gender !== "Male") return; // example
        if (segment === "segment_women" && uData.gender !== "Female") return; // example
        
        // If it passes or no segment matches exactly, we push it:
        pushTokens.push(uData.fcmToken);
      });
    }
    // --- BROADCAST TO SELLERS ---
    else if (type === "broadcast_sellers") {
      notificationPayload.role = "seller";
      notificationPayload.type = "announcement";
      await adminDb.collection('broadcast_notifications').add(notificationPayload);

      const sellersSnap = await adminDb.collection('sellers_profile').get();
      sellersSnap.forEach((doc) => {
        if (doc.data().fcmToken) pushTokens.push(doc.data().fcmToken);
      });
    }
    // --- GLOBAL BROADCAST ---
    else if (type === "broadcast_all") {
      notificationPayload.role = "all";
      notificationPayload.type = "global";
      await adminDb.collection('broadcast_notifications').add(notificationPayload);

      const [uSnap, sSnap, rSnap] = await Promise.all([
        adminDb.collection('users').get(),
        adminDb.collection('sellers_profile').get(),
        adminDb.collection('delivery_profile').get()
      ]);
      uSnap.forEach(d => { if (d.data().fcmToken) pushTokens.push(d.data().fcmToken); });
      sSnap.forEach(d => { if (d.data().fcmToken) pushTokens.push(d.data().fcmToken); });
      rSnap.forEach(d => { if (d.data().fcmToken) pushTokens.push(d.data().fcmToken); });
    }
    // --- RESTOCK ALERTS ---
    else if (type === "restock_alert" && data?.productId) {
      notificationPayload.role = "customer";
      notificationPayload.type = "restock";
      
      const reqsSnap = await adminDb.collection('restock_requests')
        .where('productId', '==', data.productId)
        .where('fulfilled', '==', false).get();

      let reqsToUpdate = [];
      reqsSnap.forEach(doc => {
        const d = doc.data();
        if (d.fcmToken) {
          pushTokens.push(d.fcmToken);
          reqsToUpdate.push(doc.id);
        }
      });

      if (pushTokens.length > 0) {
        // Only save to DB if there are people to notify
        await adminDb.collection('broadcast_notifications').add(notificationPayload);
        
        const batch = adminDb.batch();
        reqsToUpdate.forEach(id => {
          batch.update(adminDb.collection('restock_requests').doc(id), { fulfilled: true });
        });
        await batch.commit();
      }
    }
    // --- SINGLE TARGET ---
    else if (type === "single" && userId) {
      notificationPayload.userId = userId;
      notificationPayload.role = role || "customer";
      
      // Save to Database for In-App Notification Center
      await adminDb.collection('notifications').add(notificationPayload);

      // Lookup FCM Token based on role
      let collectionName = "users";
      if (role === "seller") collectionName = "sellers_profile";
      if (role === "rider" || role === "delivery") collectionName = "delivery_profile";

      const userDoc = await adminDb.collection(collectionName).doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.fcmToken) {
          pushTokens.push(userData.fcmToken);
        }
      }
    } else {
      return Response.json({ error: 'Invalid parameters for single/broadcast push' }, { status: 400 });
    }

    // SEND PUSH NOTIFICATIONS IF TOKENS EXIST
    let pushResult = { successCount: 0, failureCount: 0 };
    if (pushTokens.length > 0) {
      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: data || {},
      };

      if (pushTokens.length === 1) {
        message.token = pushTokens[0];
        try {
          await adminMessaging.send(message);
          pushResult.successCount = 1;
        } catch (e) {
          console.error("Push single failed:", e);
          pushResult.failureCount = 1;
        }
      } else {
        // Multicast for broadcasts
        const multicastMessage = { ...message, tokens: pushTokens };
        try {
          const response = await adminMessaging.sendEachForMulticast(multicastMessage);
          pushResult.successCount = response.successCount;
          pushResult.failureCount = response.failureCount;
        } catch (e) {
          console.error("Push multicast failed:", e);
        }
      }
    }

    return Response.json({ 
      success: true, 
      savedToDb: type === "single",
      pushSent: pushTokens.length > 0,
      pushResult 
    });

  } catch (error) {
    console.error('Error sending hybrid notification:', error);
    return Response.json({ error: 'Failed to process notification', details: error.message }, { status: 500 });
  }
}
