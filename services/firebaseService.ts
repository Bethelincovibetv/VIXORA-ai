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
import firebaseConfig from '../firebase-applet-config.json';
import { CreatedVideo, UserProfile } from '../types';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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
