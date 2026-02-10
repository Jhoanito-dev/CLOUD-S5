const admin = require('firebase-admin');

let firebaseApp = null;
let isFirebaseAvailable = false;
let firestoreDb = null;
let storageBucket = null;

const initializeFirebase = () => {
  try {
    // Prefer GOOGLE_APPLICATION_CREDENTIALS (mounted file) when present
    let serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    // Also accept the common mounted path if file exists
    const defaultMountedPath = '/secrets/service-account.json';
    if (!serviceAccountPath && require('fs').existsSync(defaultMountedPath)) {
      serviceAccountPath = defaultMountedPath;
    }

    if (serviceAccountPath) {
      const serviceAccount = require(serviceAccountPath);

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: `${serviceAccount.project_id}.appspot.com`,
      });

      firestoreDb = admin.firestore();
      storageBucket = admin.storage().bucket();
      isFirebaseAvailable = true;
      console.log('✅ Firebase initialized using service account file:', serviceAccountPath);
      console.log('✅ Firestore database connected');
      console.log('✅ Firebase Storage connected');
      return;
    }

    // Fallback to individual environment variables (existing behavior)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      const serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
      };

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
      });

      firestoreDb = admin.firestore();
      storageBucket = admin.storage().bucket();
      isFirebaseAvailable = true;
      console.log('✅ Firebase initialized using env vars');
      console.log('✅ Firestore database connected');
      console.log('✅ Firebase Storage connected');
      return;
    }

    console.log('⚠️ Firebase credentials not provided, using local database only');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    isFirebaseAvailable = false;
  }
};

initializeFirebase();

// Get Firestore database instance
const getFirestore = () => firestoreDb;

// Get Storage bucket instance
const getStorageBucket = () => storageBucket;

// Upload file to Firebase Storage
const uploadToStorage = async (fileBuffer, fileName, mimeType) => {
  if (!isFirebaseAvailable || !storageBucket) {
    throw new Error('Firebase Storage not available');
  }
  
  try {
    const file = storageBucket.file(`reports/${fileName}`);
    
    await file.save(fileBuffer, {
      metadata: {
        contentType: mimeType,
      },
    });
    
    // Make file publicly accessible
    await file.makePublic();
    
    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${storageBucket.name}/reports/${fileName}`;
    
    console.log(`✅ File uploaded to Firebase Storage: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('❌ Firebase Storage upload error:', error.message);
    throw error;
  }
};

// Delete file from Firebase Storage
const deleteFromStorage = async (fileName) => {
  if (!isFirebaseAvailable || !storageBucket) {
    return null;
  }
  
  try {
    await storageBucket.file(`reports/${fileName}`).delete();
    console.log(`✅ File deleted from Firebase Storage: ${fileName}`);
    return true;
  } catch (error) {
    console.error('❌ Firebase Storage delete error:', error.message);
    return null;
  }
};

const verifyFirebaseToken = async (idToken) => {
  if (!isFirebaseAvailable) {
    return null;
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Firebase token verification error:', error.message);
    return null;
  }
};

const createFirebaseUser = async (email, password) => {
  if (!isFirebaseAvailable) {
    return null;
  }
  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      emailVerified: false,
    });
    return userRecord;
  } catch (error) {
    throw error;
  }
};

const updateFirebaseUser = async (uid, data) => {
  if (!isFirebaseAvailable) {
    return null;
  }
  try {
    const userRecord = await admin.auth().updateUser(uid, data);
    return userRecord;
  } catch (error) {
    throw error;
  }
};

const deleteFirebaseUser = async (uid) => {
  if (!isFirebaseAvailable) {
    return null;
  }
  try {
    await admin.auth().deleteUser(uid);
    return true;
  } catch (error) {
    throw error;
  }
};

// ===== FIRESTORE OPERATIONS FOR REPORTS =====

// Update a report in Firestore by matching PostgreSQL report UID
const updateReportInFirestore = async (reportUid, updates) => {
  if (!isFirebaseAvailable || !firestoreDb) {
    console.log('⚠️ Firestore not available, skipping sync');
    return null;
  }
  try {
    // Find the report in Firestore by UID (stored when mobile creates it)
    // or by matching other criteria
    const reportsRef = firestoreDb.collection('reports');
    
    // Try to find by uid field first
    let querySnapshot = await reportsRef.where('uid', '==', reportUid).get();
    
    if (querySnapshot.empty) {
      console.log(`⚠️ Report with uid ${reportUid} not found in Firestore`);
      return null;
    }
    
    // Update all matching documents (should be just one)
    const batch = firestoreDb.batch();
    querySnapshot.forEach(doc => {
      batch.update(doc.ref, {
        ...updates,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    await batch.commit();
    console.log(`✅ Report ${reportUid} synced to Firestore`);
    return true;
  } catch (error) {
    console.error('❌ Firestore sync error:', error.message);
    return null;
  }
};

// Sync report status to Firestore by PostgreSQL ID
const syncReportStatusToFirestore = async (postgresId, status, reportUid) => {
  if (!isFirebaseAvailable || !firestoreDb) {
    console.log('⚠️ Firestore not available, skipping status sync');
    return null;
  }
  try {
    const reportsRef = firestoreDb.collection('reports');
    
    // Try finding by postgres_id field or uid
    let querySnapshot = await reportsRef.where('postgres_id', '==', postgresId).get();
    
    if (querySnapshot.empty && reportUid) {
      // Try by uid
      querySnapshot = await reportsRef.where('uid', '==', reportUid).get();
    }
    
    if (querySnapshot.empty) {
      // Try finding by id field (some documents might use id as string)
      querySnapshot = await reportsRef.where('id', '==', String(postgresId)).get();
    }
    
    if (querySnapshot.empty) {
      console.log(`⚠️ Report with postgres_id ${postgresId} not found in Firestore, creating link...`);
      return null;
    }
    
    // Update status
    const batch = firestoreDb.batch();
    querySnapshot.forEach(doc => {
      batch.update(doc.ref, {
        status: status,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Updating Firestore doc ${doc.id} with status: ${status}`);
    });
    
    await batch.commit();
    console.log(`✅ Report status synced to Firestore: ${status}`);
    return true;
  } catch (error) {
    console.error('❌ Firestore status sync error:', error.message);
    return null;
  }
};

// Get all reports from Firestore
const getReportsFromFirestore = async () => {
  if (!isFirebaseAvailable || !firestoreDb) {
    return [];
  }
  try {
    const snapshot = await firestoreDb.collection('reports').orderBy('created_at', 'desc').get();
    return snapshot.docs.map(doc => ({
      firestore_id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('❌ Firestore get reports error:', error.message);
    return [];
  }
};

// ===== PUSH NOTIFICATIONS =====

// Envoyer une notification push à un utilisateur via son FCM token stocké dans Firestore
const sendStatusChangeNotification = async (reportUserUid, reportId, newStatus) => {
  if (!isFirebaseAvailable || !firestoreDb) {
    console.log('⚠️ Firebase not available, skipping push notification');
    return null;
  }
  try {
    // Récupérer le FCM token de l'utilisateur depuis Firestore
    const tokenDoc = await firestoreDb.collection('fcm_tokens').doc(reportUserUid).get();
    
    if (!tokenDoc.exists) {
      console.log(`⚠️ No FCM token found for user ${reportUserUid}`);
      return null;
    }

    const { token } = tokenDoc.data();
    if (!token) {
      console.log(`⚠️ Empty FCM token for user ${reportUserUid}`);
      return null;
    }

    const statusLabels = {
      'new': 'Nouveau',
      'in_progress': 'En cours',
      'done': 'Terminé',
    };

    const message = {
      token: token,
      notification: {
        title: 'Mise à jour de votre signalement',
        body: `Le signalement #${reportId} est passé au statut : ${statusLabels[newStatus] || newStatus}`,
      },
      data: {
        report_id: String(reportId),
        status: newStatus,
        type: 'status_change',
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ Push notification sent to user ${reportUserUid}:`, response);
    return response;
  } catch (error) {
    // Si le token est invalide, on le supprime
    if (error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token') {
      console.log(`🧹 Removing invalid FCM token for user ${reportUserUid}`);
      try {
        await firestoreDb.collection('fcm_tokens').doc(reportUserUid).delete();
      } catch (e) { /* ignore */ }
    }
    console.error('⚠️ Push notification error (non-blocking):', error.message);
    return null;
  }
};

module.exports = {
  admin,
  firebaseApp,
  isFirebaseAvailable: () => isFirebaseAvailable,
  getFirestore,
  getStorageBucket,
  uploadToStorage,
  deleteFromStorage,
  verifyFirebaseToken,
  createFirebaseUser,
  updateFirebaseUser,
  deleteFirebaseUser,
  updateReportInFirestore,
  syncReportStatusToFirestore,
  getReportsFromFirestore,
  sendStatusChangeNotification,
};
