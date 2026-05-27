import admin from 'firebase-admin';

let adminAuth = null;
let adminDb = null;
let adminMessaging = null;
let adminStorage = null;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    // Strip outer double quotes if present
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (!admin.apps.length) {
    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
      console.log('Firebase Admin Initialized successfully with cert.');
    } else {
      admin.initializeApp({
        projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
      console.log('Firebase Admin Initialized with default ADC.');
    }
  }

  adminAuth = admin.auth();
  adminDb = admin.firestore();
  adminMessaging = admin.messaging();
  adminStorage = admin.storage();
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error.stack);
}

export { adminAuth, adminDb, adminMessaging, adminStorage };
export default admin;
