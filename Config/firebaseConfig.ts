/**
 * Firebase configuration for frontend SDK
 * NOTE: All data access is proxied through the backend API.
 * This config is only kept for Firebase Auth (optional client SDK usage).
 * In production, authentication happens entirely via the backend API endpoints.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyATEU61bk0_DNuEBui15djMTvlGmSv_5fc",
  authDomain: "truck-d18ad.firebaseapp.com",
  projectId: "truck-d18ad",
  storageBucket: "truck-d18ad.firebasestorage.app",
  messagingSenderId: "591932346134",
  appId: "1:591932346134:web:aff38c5dc11cfebfe68a37",
  measurementId: "G-GQKGCC566M"
};

// Note: To use Firebase client SDK directly, uncomment below:
// import { initializeApp } from 'firebase/app';
// import { getAuth } from 'firebase/auth';
// export const app = initializeApp(firebaseConfig);
// export const auth = getAuth(app);
