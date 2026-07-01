/**
 * Firebase configuration for frontend SDK
 * NOTE: All data access is proxied through the backend API.
 * This config is only kept for Firebase Auth (optional client SDK usage).
 * In production, authentication happens entirely via the backend API endpoints.
 */
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Note: To use Firebase client SDK directly, uncomment below:
// import { initializeApp } from 'firebase/app';
// import { getAuth } from 'firebase/auth';
// export const app = initializeApp(firebaseConfig);
// export const auth = getAuth(app);
