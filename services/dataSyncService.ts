import { CreatedVideo } from '../types';
import { 
  syncFirebaseSaveVideo, 
  syncFirebaseFetchVideos, 
  syncFirebaseSaveVoiceover, 
  syncFirebaseFetchVoiceovers 
} from './firebaseService';

// --- CREATED VIDEOS SYNC (Firebase Firestore + LocalStorage) ---
export async function syncSaveCreatedVideo(video: CreatedVideo): Promise<void> {
  // Update local storage first for immediate offline availability
  try {
    const saved = localStorage.getItem('ggd_created_videos');
    const existing: CreatedVideo[] = saved ? JSON.parse(saved) : [];
    const updated = [video, ...existing.filter(v => v.id !== video.id)];
    localStorage.setItem('ggd_created_videos', JSON.stringify(updated));
  } catch (err) {
    console.error("Error saving video to localStorage:", err);
  }

  // Sync to Firebase Firestore
  try {
    await syncFirebaseSaveVideo(video);
  } catch (err) {
    console.warn("Firebase video sync note:", err);
  }
}

export async function syncFetchCreatedVideos(): Promise<CreatedVideo[]> {
  let localVideos: CreatedVideo[] = [];
  try {
    const saved = localStorage.getItem('ggd_created_videos');
    if (saved) localVideos = JSON.parse(saved);
  } catch (err) {
    console.error("Error reading localStorage videos:", err);
  }

  // Fetch from Firebase Firestore
  let firebaseVideos: CreatedVideo[] = [];
  try {
    firebaseVideos = await syncFirebaseFetchVideos();
  } catch (err) {
    console.warn("Firebase fetch videos note:", err);
  }

  // Merge sources seamlessly without duplicates
  const mergedMap = new Map<string, CreatedVideo>();
  [...firebaseVideos, ...localVideos].forEach(v => mergedMap.set(v.id, v));
  const merged = Array.from(mergedMap.values());
  localStorage.setItem('ggd_created_videos', JSON.stringify(merged));
  return merged;
}

// --- VOICEOVER HISTORY SYNC (Firebase Firestore + LocalStorage) ---
export async function syncSaveVoiceover(voiceoverItem: { id: string; text: string; audioBase64: string; date: string }): Promise<void> {
  try {
    const saved = localStorage.getItem('vixora_voiceover_history');
    const existing = saved ? JSON.parse(saved) : [];
    const updated = [voiceoverItem, ...existing.filter((item: any) => item.id !== voiceoverItem.id)];
    localStorage.setItem('vixora_voiceover_history', JSON.stringify(updated));
  } catch (err) {
    console.error("Local voiceover save error:", err);
  }

  // Sync to Firebase Firestore
  try {
    await syncFirebaseSaveVoiceover(voiceoverItem);
  } catch (err) {
    console.warn("Firebase voiceover sync note:", err);
  }
}

export async function syncFetchVoiceovers(): Promise<Array<{ id: string; text: string; audioBase64: string; date: string }>> {
  let localItems: any[] = [];
  try {
    const saved = localStorage.getItem('vixora_voiceover_history');
    if (saved) localItems = JSON.parse(saved);
  } catch (err) {
    console.error("Local voiceover read error:", err);
  }

  // Fetch from Firebase Firestore
  let firebaseItems: any[] = [];
  try {
    firebaseItems = await syncFirebaseFetchVoiceovers();
  } catch (err) {
    console.warn("Firebase fetch voiceovers note:", err);
  }

  const map = new Map<string, any>();
  [...firebaseItems, ...localItems].forEach(item => map.set(item.id, item));
  const merged = Array.from(map.values());
  localStorage.setItem('vixora_voiceover_history', JSON.stringify(merged));
  return merged;
}
