import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  orderBy, 
  getDocFromServer 
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';
import { CreatedVideo, UserProfile, VideoTemplate, ContentRoadmap } from '../types';

export interface FeatureAnnouncement {
  id: string;
  title: string;
  message: string;
  tag?: string;
  badgeText?: string;
  actionUrl?: string;
  imageUrl?: string;
  createdAt: string;
}

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firebase Messaging conditionally
let messagingInstance: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      messagingInstance = getMessaging(app);
    }
  }).catch(() => {
    console.log("Firebase Messaging not supported in this environment");
  });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Connection on load as mandated by Firebase skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client is offline or initializing.");
    }
  }
}
testConnection();

// --- PWA & PUSH NOTIFICATIONS HELPERS ---
export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn("Notifications not supported in this browser.");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log("Notification permission granted.");
      // Trigger instant native phone push notification to confirm functionality
      sendLocalPushNotification(
        '🔔 Vixora Push Notifications Active!',
        'You will now receive instant phone push alerts whenever a new Vixora feature update is published.'
      );
      if (messagingInstance) {
        try {
          const token = await getToken(messagingInstance, {
            vapidKey: 'BD3aJ0e7-placeholder-vapid-key' // Optional standard Web Push key
          });
          if (token) {
            console.log("FCM Token obtained:", token);
            if (auth.currentUser) {
              await setDoc(doc(db, 'users', auth.currentUser.uid), { fcmToken: token }, { merge: true });
            }
            return token;
          }
        } catch (fcmErr) {
          console.warn("FCM getToken fallback:", fcmErr);
        }
      }
      return 'granted_web_push';
    } else {
      console.warn("Notification permission denied or dismissed.");
      return null;
    }
  } catch (err) {
    console.error("Error requesting notification permission:", err);
    return null;
  }
}

export function setupForegroundMessageListener(callback: (payload: any) => void) {
  if (!messagingInstance) return;
  try {
    onMessage(messagingInstance, (payload) => {
      console.log("Foreground message received:", payload);
      callback(payload);
    });
  } catch (err) {
    console.warn("Error attaching messaging listener:", err);
  }
}

export async function sendLocalPushNotification(title: string, body: string, data?: any) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    // 1. Trigger via ServiceWorker registration (Triggers native phone notification tray)
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            body,
            icon: '/icon-192.jpg',
            badge: '/icon-192.jpg',
            vibrate: [200, 100, 200, 100, 200],
            tag: 'vixora-update-' + Date.now(),
            renotify: true,
            data
          });
          return;
        }
      }
    } catch (swErr) {
      console.warn("SW showNotification error fallback:", swErr);
    }

    // 2. PostMessage to ServiceWorker controller
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        body,
        data
      });
    }

    // 3. Fallback direct window Notification API
    try {
      new Notification(title, {
        body,
        icon: '/icon-192.jpg',
        badge: '/icon-192.jpg',
        data
      });
    } catch (e) {
      console.log("Direct notification construct fallback:", e);
    }
  }
}

// --- FEATURE ANNOUNCEMENTS / ADVERTS SYNC ---
export async function syncFirebaseSaveAnnouncement(announcement: FeatureAnnouncement): Promise<void> {
  const path = `announcements/${announcement.id}`;
  try {
    await setDoc(doc(db, 'announcements', announcement.id), {
      id: announcement.id,
      title: announcement.title,
      message: announcement.message,
      tag: announcement.tag || 'NEW UPDATE',
      badgeText: announcement.badgeText || 'v3.0 Release',
      actionUrl: announcement.actionUrl || '',
      imageUrl: announcement.imageUrl || '',
      createdAt: announcement.createdAt || new Date().toISOString()
    });

    // Also trigger push notification locally/system wide
    sendLocalPushNotification(`🚀 ${announcement.title}`, announcement.message, announcement);
  } catch (error) {
    console.warn("Firestore save announcement error:", error);
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncFirebaseFetchAnnouncements(): Promise<FeatureAnnouncement[]> {
  const path = 'announcements';
  try {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const announcements: FeatureAnnouncement[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      announcements.push({
        id: data.id || docSnap.id,
        title: data.title,
        message: data.message,
        tag: data.tag || 'NEW UPDATE',
        badgeText: data.badgeText || 'v3.0 Release',
        actionUrl: data.actionUrl || '',
        imageUrl: data.imageUrl || '',
        createdAt: data.createdAt
      });
    });
    return announcements;
  } catch (error) {
    console.warn("Firestore fetch announcements fallback:", error);
    return [];
  }
}

// --- AUTH HELPERS ---
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google login error:", error);
    throw error;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
  }
}

// --- CREATED VIDEOS SYNC TO FIRESTORE ---
export async function syncFirebaseSaveVideo(video: CreatedVideo): Promise<void> {
  const path = `videos/${video.id}`;
  try {
    await setDoc(doc(db, 'videos', video.id), {
      id: video.id,
      topic: video.topic,
      scriptText: video.scriptText,
      videoUrl: video.videoUrl || '',
      date: video.date || new Date().toISOString(),
      aspectRatio: video.aspectRatio || 'vertical',
      userId: auth.currentUser?.uid || 'anonymous',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn("Firestore save video error:", error);
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncFirebaseFetchVideos(): Promise<CreatedVideo[]> {
  const path = 'videos';
  try {
    const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const videos: CreatedVideo[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      videos.push({
        id: data.id || docSnap.id,
        topic: data.topic,
        scriptText: data.scriptText,
        videoUrl: data.videoUrl,
        date: data.date,
        aspectRatio: data.aspectRatio || 'vertical'
      });
    });
    return videos;
  } catch (error) {
    console.warn("Firestore fetch videos fallback:", error);
    return [];
  }
}

// --- VOICEOVER HISTORY SYNC TO FIRESTORE ---
export async function syncFirebaseSaveVoiceover(voiceoverItem: { id: string; text: string; audioBase64: string; date: string }): Promise<void> {
  const path = `voiceovers/${voiceoverItem.id}`;
  try {
    await setDoc(doc(db, 'voiceovers', voiceoverItem.id), {
      id: voiceoverItem.id,
      text: voiceoverItem.text,
      audioBase64: voiceoverItem.audioBase64 || '',
      date: voiceoverItem.date || new Date().toISOString(),
      userId: auth.currentUser?.uid || 'anonymous',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn("Firestore save voiceover error:", error);
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncFirebaseFetchVoiceovers(): Promise<Array<{ id: string; text: string; audioBase64: string; date: string }>> {
  const path = 'voiceovers';
  try {
    const q = query(collection(db, 'voiceovers'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const voiceovers: Array<{ id: string; text: string; audioBase64: string; date: string }> = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      voiceovers.push({
        id: data.id || docSnap.id,
        text: data.text,
        audioBase64: data.audioBase64,
        date: data.date
      });
    });
    return voiceovers;
  } catch (error) {
    console.warn("Firestore fetch voiceovers fallback:", error);
    return [];
  }
}

// --- USER PROFILE SYNC TO FIRESTORE ---
export async function syncFirebaseUserProfile(profile: UserProfile): Promise<void> {
  if (!profile.uid) return;
  const path = `users/${profile.uid}`;
  try {
    await setDoc(doc(db, 'users', profile.uid), {
      uid: profile.uid,
      email: profile.email || '',
      displayName: profile.displayName || '',
      apiKey: profile.apiKey || '',
      plan: profile.plan || 'Free Plan',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.warn("Firestore user profile sync error:", error);
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- VIDEO TEMPLATES SYNC TO FIRESTORE ---
export async function syncFirebaseSaveTemplate(template: VideoTemplate): Promise<void> {
  const path = `templates/${template.id}`;
  try {
    await setDoc(doc(db, 'templates', template.id), {
      id: template.id,
      title: template.title,
      description: template.description || '',
      niche: template.niche || 'General',
      aspectRatio: template.aspectRatio || 'vertical',
      targetDuration: template.targetDuration || '30s',
      captionTemplate: template.captionTemplate || 'bold-yellow',
      sfxEnabled: template.sfxEnabled ? 'true' : 'false',
      bgMusicUrl: template.bgMusicUrl || '',
      scriptStyle: template.scriptStyle || '',
      createdBy: auth.currentUser?.uid || 'system',
      createdAt: template.createdAt || new Date().toISOString()
    });
  } catch (error) {
    console.warn("Firestore save template error:", error);
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncFirebaseFetchTemplates(): Promise<VideoTemplate[]> {
  const path = 'templates';
  try {
    const q = query(collection(db, 'templates'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const templates: VideoTemplate[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      templates.push({
        id: data.id || docSnap.id,
        title: data.title,
        description: data.description || '',
        niche: data.niche || 'General',
        aspectRatio: data.aspectRatio || 'vertical',
        targetDuration: data.targetDuration || '30s',
        captionTemplate: data.captionTemplate || 'bold-yellow',
        sfxEnabled: data.sfxEnabled === 'true' || data.sfxEnabled === true,
        bgMusicUrl: data.bgMusicUrl || '',
        scriptStyle: data.scriptStyle || '',
        createdBy: data.createdBy,
        createdAt: data.createdAt
      });
    });
    return templates;
  } catch (error) {
    console.warn("Firestore fetch templates fallback:", error);
    return [];
  }
}

// --- CONTENT ROADMAPS SYNC TO FIRESTORE ---
export async function syncFirebaseSaveRoadmap(roadmap: ContentRoadmap): Promise<void> {
  const path = `roadmaps/${roadmap.id}`;
  try {
    await setDoc(doc(db, 'roadmaps', roadmap.id), {
      id: roadmap.id,
      title: roadmap.title,
      niche: roadmap.niche || 'General',
      platform: roadmap.platform || 'Multi-Platform',
      goal: roadmap.goal || '',
      roadmapItemsJson: JSON.stringify(roadmap.roadmapItems || []),
      faithAlignment: roadmap.faithAlignment || '',
      userId: auth.currentUser?.uid || 'anonymous',
      createdAt: roadmap.createdAt || new Date().toISOString()
    });
  } catch (error) {
    console.warn("Firestore save roadmap error:", error);
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncFirebaseFetchRoadmaps(): Promise<ContentRoadmap[]> {
  const path = 'roadmaps';
  try {
    const q = query(collection(db, 'roadmaps'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const roadmaps: ContentRoadmap[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      let parsedItems = [];
      try {
        parsedItems = JSON.parse(data.roadmapItemsJson || '[]');
      } catch (e) {
        parsedItems = [];
      }
      roadmaps.push({
        id: data.id || docSnap.id,
        title: data.title,
        niche: data.niche || 'General',
        platform: data.platform || 'Multi-Platform',
        goal: data.goal || '',
        roadmapItems: parsedItems,
        faithAlignment: data.faithAlignment || '',
        userId: data.userId,
        createdAt: data.createdAt
      });
    });
    return roadmaps;
  } catch (error) {
    console.warn("Firestore fetch roadmaps fallback:", error);
    return [];
  }
}

