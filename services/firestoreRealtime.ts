/**
 * Firestore Realtime Service
 * Uses Firebase Client SDK (Web) for onSnapshot real-time listeners
 * 
 * Provides: listenToCollection, listenToDocument, listenToQuery
 * All return unsubscribe functions
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  query,
  where,
  onSnapshot,
  Unsubscribe,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot,
  QueryFieldFilterConstraint,
  WhereFilterOp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

function getDb(): Firestore {
  if (!db) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return db;
}

/**
 * Listen to an entire collection in real-time
 * @param collectionName - The Firestore collection name
 * @param callback - Called with array of documents on each snapshot
 * @param errorCallback - Called on error
 * @returns Unsubscribe function
 */
export function listenToCollection(
  collectionName: string,
  callback: (documents: DocumentData[]) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe {
  const dbInstance = getDb();
  const collectionRef = collection(dbInstance, collectionName);

  return onSnapshot(
    collectionRef,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const docs: DocumentData[] = [];
      snapshot.forEach((docSnap) => {
        docs.push({ id: docSnap.id, ...docSnap.data() });
      });
      callback(docs);
    },
    (error: any) => {
      console.error(`Firestore listenToCollection error (${collectionName}):`, error);
      errorCallback?.(error);
    }
  );
}

/**
 * Listen to a single document in real-time
 * @param collectionName - The Firestore collection name
 * @param docId - The document ID
 * @param callback - Called with document data or null if not found
 * @param errorCallback - Called on error
 * @returns Unsubscribe function
 */
export function listenToDocument(
  collectionName: string,
  docId: string,
  callback: (document: DocumentData | null) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe {
  const dbInstance = getDb();
  const docRef = doc(dbInstance, collectionName, docId);

  return onSnapshot(
    docRef,
    (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() });
      } else {
        callback(null);
      }
    },
    (error: any) => {
      console.error(`Firestore listenToDocument error (${collectionName}/${docId}):`, error);
      errorCallback?.(error);
    }
  );
}

/**
 * Listen to a filtered query in real-time
 * @param collectionName - The Firestore collection name
 * @param field - The field to filter on
 * @param operator - Firestore where operator (==, !=, <, <=, >, >=, array-contains, in, not-in, array-contains-any)
 * @param value - The value to filter by
 * @param callback - Called with array of matching documents
 * @param errorCallback - Called on error
 * @returns Unsubscribe function
 */
export function listenToQuery(
  collectionName: string,
  field: string,
  operator: WhereFilterOp,
  value: any,
  callback: (documents: DocumentData[]) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe {
  const dbInstance = getDb();
  const collectionRef = collection(dbInstance, collectionName);
  const q = query(collectionRef, where(field, operator, value));

  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const docs: DocumentData[] = [];
      snapshot.forEach((docSnap) => {
        docs.push({ id: docSnap.id, ...docSnap.data() });
      });
      callback(docs);
    },
    (error: any) => {
      console.error(`Firestore listenToQuery error (${collectionName}/${field} ${operator} ${value}):`, error);
      errorCallback?.(error);
    }
  );
}

export default {
  listenToCollection,
  listenToDocument,
  listenToQuery,
};
