import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreatedVideo, UserProfile } from '../types';
import { 
  syncFirebaseSaveVideo, 
  syncFirebaseFetchVideos, 
  syncFirebaseSaveVoiceover, 
  syncFirebaseFetchVoiceovers 
} from './firebaseService';

// Read Supabase configuration from Vite environment or direct fallback
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://cilkybiebptqtuhbopyz.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbGt5YmllYnB0cXR1aGJvcHl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU4OTY0MDB9';

let supabase: SupabaseClient | null = null;

try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (err) {
  console.warn("Supabase client init note:", err);
}

export function getSupabaseClient() {
  return supabase;
}

// --- CREATED VIDEOS SYNC ---
export async function syncSaveCreatedVideo(video: CreatedVideo): Promise<void> {
  // Always update local storage first for immediate offline guarantee
  try {
    const saved = localStorage.getItem('ggd_created_videos');
    const existing: CreatedVideo[] = saved ? JSON.parse(saved) : [];
    const updated = [video, ...existing.filter(v => v.id !== video.id)];
    localStorage.setItem('ggd_created_videos', JSON.stringify(updated));
  } catch (err) {
    console.error("Error saving video to localStorage:", err);
  }

  // Dual sync to Firebase Firestore
  try {
    await syncFirebaseSaveVideo(video);
  } catch (err) {
    console.warn("Firebase video sync note:", err);
  }

  // Sync to Supabase if client available
  if (supabase) {
    try {
      await supabase.from('vixora_created_videos').upsert({
        id: video.id,
        topic: video.topic,
        script_text: video.scriptText,
        video_url: video.videoUrl,
        date: video.date,
        aspect_ratio: video.aspectRatio,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Supabase video sync fallback to local cache:", err);
    }
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

  let supabaseVideos: CreatedVideo[] = [];
  if (supabase) {
    try {
      const { data, error } = await supabase.from('vixora_created_videos').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        supabaseVideos = data.map(item => ({
          id: item.id,
          topic: item.topic,
          scriptText: item.script_text,
          videoUrl: item.video_url,
          date: item.date,
          aspectRatio: item.aspect_ratio || 'vertical'
        }));
      }
    } catch (err) {
      console.warn("Supabase fetch fallback to local cache:", err);
    }
  }

  // Merge all sources seamlessly
  const mergedMap = new Map<string, CreatedVideo>();
  [...firebaseVideos, ...supabaseVideos, ...localVideos].forEach(v => mergedMap.set(v.id, v));
  const merged = Array.from(mergedMap.values());
  localStorage.setItem('ggd_created_videos', JSON.stringify(merged));
  return merged;
}

// --- VOICEOVER HISTORY SYNC ---
export async function syncSaveVoiceover(voiceoverItem: { id: string; text: string; audioBase64: string; date: string }): Promise<void> {
  try {
    const saved = localStorage.getItem('vixora_voiceover_history');
    const existing = saved ? JSON.parse(saved) : [];
    const updated = [voiceoverItem, ...existing.filter((item: any) => item.id !== voiceoverItem.id)];
    localStorage.setItem('vixora_voiceover_history', JSON.stringify(updated));
  } catch (err) {
    console.error("Local voiceover save error:", err);
  }

  // Dual sync to Firebase Firestore
  try {
    await syncFirebaseSaveVoiceover(voiceoverItem);
  } catch (err) {
    console.warn("Firebase voiceover sync note:", err);
  }

  if (supabase) {
    try {
      await supabase.from('vixora_voiceovers').upsert({
        id: voiceoverItem.id,
        text: voiceoverItem.text,
        audio_base64: voiceoverItem.audioBase64,
        date: voiceoverItem.date,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Supabase voiceover sync fallback:", err);
    }
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

  let supabaseItems: any[] = [];
  if (supabase) {
    try {
      const { data, error } = await supabase.from('vixora_voiceovers').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        supabaseItems = data.map(item => ({
          id: item.id,
          text: item.text,
          audioBase64: item.audio_base64,
          date: item.date
        }));
      }
    } catch (err) {
      console.warn("Supabase fetch voiceovers fallback:", err);
    }
  }

  const map = new Map<string, any>();
  [...firebaseItems, ...supabaseItems, ...localItems].forEach(item => map.set(item.id, item));
  const merged = Array.from(map.values());
  localStorage.setItem('vixora_voiceover_history', JSON.stringify(merged));
  return merged;
}

