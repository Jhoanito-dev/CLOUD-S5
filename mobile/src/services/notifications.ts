import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, setDoc, getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';

/**
 * Service de notifications push via Firebase Cloud Messaging (FCM)
 * - Enregistre le device token FCM dans Firestore (collection 'fcm_tokens')
 * - Gère les permissions et les listeners de notifications
 */

const db = getFirestore(getApp());

// Enregistrer le token FCM dans Firestore pour l'utilisateur connecté
const saveTokenToFirestore = async (token: string, userUid: string) => {
  try {
    await setDoc(doc(db, 'fcm_tokens', userUid), {
      token,
      user_uid: userUid,
      updated_at: new Date(),
      platform: 'android',
    });
    console.log('✅ FCM token saved to Firestore for user:', userUid);
  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
  }
};

// Initialiser les notifications push
export const initPushNotifications = async (userUid: string) => {
  // Ne fonctionne que sur un appareil natif (pas dans le navigateur)
  if (!Capacitor.isNativePlatform()) {
    console.log('⚠️ Push notifications not available on web platform');
    return;
  }

  try {
    // Vérifier les permissions
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('⚠️ Push notification permission not granted');
      return;
    }

    // S'enregistrer pour recevoir les notifications
    await PushNotifications.register();

    // Listener : token reçu → sauvegarder dans Firestore
    PushNotifications.addListener('registration', async (token) => {
      console.log('✅ FCM Token received:', token.value);
      await saveTokenToFirestore(token.value, userUid);
    });

    // Listener : erreur d'enregistrement
    PushNotifications.addListener('registrationError', (error) => {
      console.error('❌ Push registration error:', error);
    });

    // Listener : notification reçue en foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('📬 Notification received in foreground:', notification);
    });

    // Listener : notification cliquée (ouvre l'app)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('👆 Notification action performed:', action);
    });

    console.log('✅ Push notifications initialized');
  } catch (error) {
    console.error('❌ Error initializing push notifications:', error);
  }
};

// Nettoyer les listeners quand l'utilisateur se déconnecte
export const removePushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await PushNotifications.removeAllListeners();
    console.log('🧹 Push notification listeners removed');
  } catch (error) {
    console.error('Error removing push listeners:', error);
  }
};
