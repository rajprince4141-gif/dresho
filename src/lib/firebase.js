import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ImgBB API Key for seller product image uploads
export const IMGBB_API_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY;

// Prevent re-initialization during hot reloads or SSR
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Messaging only on the client side (browser)
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

// Helper to request permission and get the FCM token
export const requestNotificationPermission = async () => {
  if (!messaging) return null;
  // Guard: Notification API may not exist in all environments
  if (typeof Notification === 'undefined') return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try {
        // Register the FCM Service Worker if browser supports it
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
          try {
            await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log('FCM Service Worker registered successfully.');
          } catch (swErr) {
            console.warn('Service Worker registration failed:', swErr);
          }
        }
        
        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: await navigator.serviceWorker?.getRegistration('/firebase-messaging-sw.js') || undefined
        });
        return token;
      } catch (tokenError) {
        // Silently handle token retrieval failures (auth credential issues, network, etc.)
        console.warn('FCM token retrieval failed (non-critical):', tokenError.message || tokenError);
        return null;
      }
    }
  } catch (error) {
    console.warn('Notification permission request failed (non-critical):', error.message || error);
  }
  return null;
};

export default app;
