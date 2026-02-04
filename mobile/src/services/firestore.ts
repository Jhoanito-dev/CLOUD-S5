import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  orderBy, 
  limit,
  where,
  Timestamp,
  onSnapshot,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
};

// Use existing Firebase app if already initialized, otherwise create new one
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Helper to get current user UID
export const getCurrentUserUid = (): string | null => {
  return auth.currentUser?.uid || null;
};

// Enable offline persistence
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.log('Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.log('Persistence not available');
    }
  });
} catch (e) {
  console.log('Persistence already enabled');
}

export interface Report {
  id?: string;
  latitude: number;
  longitude: number;
  description: string;
  surface?: number | null;
  budget?: number | null;
  company?: string;
  status: string;
  created_at: Timestamp | Date;
  user_uid: string;
  user_email?: string;
}

// Get all reports from Firestore
export const getReports = async (limitCount: number = 100): Promise<Report[]> => {
  try {
    const reportsRef = collection(db, 'reports');
    const q = query(reportsRef, orderBy('created_at', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Report));
  } catch (error) {
    console.error('Error fetching reports from Firestore:', error);
    return [];
  }
};

// Get reports by user
export const getReportsByUser = async (userUid: string, limitCount: number = 100): Promise<Report[]> => {
  try {
    console.log('Fetching reports for user:', userUid);
    const reportsRef = collection(db, 'reports');
    
    // First, let's see all reports to debug
    const allDocs = await getDocs(collection(db, 'reports'));
    console.log('DEBUG: All reports user_uids:', allDocs.docs.map(d => d.data().user_uid));
    
    // Simple query without orderBy to avoid index requirement
    // We'll sort client-side
    const q = query(
      reportsRef, 
      where('user_uid', '==', userUid),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    
    const reports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Report));
    
    // Sort client-side by created_at (descending)
    reports.sort((a, b) => {
      const dateA = a.created_at?.seconds || 0;
      const dateB = b.created_at?.seconds || 0;
      return dateB - dateA;
    });
    
    console.log('Found', reports.length, 'reports for user', userUid);
    return reports;
  } catch (error) {
    console.error('Error fetching user reports from Firestore:', error);
    return [];
  }
};

// Add a new report to Firestore
export const addReport = async (report: Omit<Report, 'id' | 'created_at'>): Promise<string | null> => {
  try {
    const reportsRef = collection(db, 'reports');
    const docRef = await addDoc(reportsRef, {
      ...report,
      created_at: Timestamp.now(),
      status: 'new'
    });
    console.log('Report added to Firestore with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error adding report to Firestore:', error);
    return null;
  }
};

// Subscribe to reports in real-time
export const subscribeToReports = (
  callback: (reports: Report[]) => void,
  limitCount: number = 100
): (() => void) => {
  const reportsRef = collection(db, 'reports');
  const q = query(reportsRef, orderBy('created_at', 'desc'), limit(limitCount));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Report));
    callback(reports);
  }, (error) => {
    console.error('Error subscribing to reports:', error);
  });
  
  return unsubscribe;
};

export { db };
