// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing the standard config.
const firebaseConfig = {
  apiKey: "AIzaSyCJ49SeZhMUiLCAE6VVSNYoKrUmymA1QP0",
  authDomain: "dresho-421b7.firebaseapp.com",
  projectId: "dresho-421b7",
  storageBucket: "dresho-421b7.firebasestorage.app",
  messagingSenderId: "511477160266",
  appId: "1:511477160266:web:8854ca59235aa55deb49b3"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.image || '/logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
