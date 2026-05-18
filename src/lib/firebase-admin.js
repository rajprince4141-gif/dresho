import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace escaped newlines with actual newlines to support Vercel deployment
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    console.log('Firebase Admin Initialized successfully.');
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error.stack);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminMessaging = admin.messaging();
export const adminStorage = admin.storage();

export default admin;
