import { CreatedVideo, Project } from '../types';
import { 
  syncFirebaseSaveVideo, 
  syncFirebaseFetchVideos, 
  syncFirebaseSaveVoiceover, 
  syncFirebaseFetchVoiceovers 
} from './firebaseService';
import { 
  apiCreateProject, 
  apiListProjects, 
  apiCreateAsset, 
  apiGetAssetSignedUrl,
  LovableProjectPayload,
  LovableAssetPayload
} from './supabaseService';

// ============================================================================
// PROJECTS SYNC (Lovable Cloud / Supabase + LocalStorage)
// ============================================================================

export async function syncSaveProject(project: Project): Promise<void> {
  // 1. Update local storage for immediate UI feedback
  try {
    const saved = localStorage.getItem('vixora_projects');
    const existing: Project[] = saved ? JSON.parse(saved) : [];
    const updated = [project, ...existing.filter(p => p.id !== project.id)];
    localStorage.setItem('vixora_projects', JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving project to localStorage:', err);
  }

  // 2. Sync to Lovable Cloud / Supabase /projects/create
  try {
    const payload: LovableProjectPayload = {
      id: project.id,
      title: project.title,
      topic: project.topic,
      status: project.status,
      aspectRatio: project.aspectRatio,
      targetDuration: project.targetDuration,
      scriptText: project.scriptText,
      voiceoverUrl: project.voiceoverUrl,
      videoUrl: project.videoUrl,
      thumbnailUrl: project.thumbnailUrl,
      metadata: {
        chatHistory: project.chatHistory,
        sourcedVideos: project.sourcedVideos,
      },
    };

    await apiCreateProject(payload);
  } catch (err) {
    console.warn('Lovable/Supabase project sync note:', err);
  }
}

export async function syncFetchProjects(): Promise<Project[]> {
  let localProjects: Project[] = [];
  try {
    const saved = localStorage.getItem('vixora_projects');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        localProjects = parsed.filter(p => !p.id.startsWith('proj_demo_'));
      }
    }
  } catch (err) {
    console.error('Error reading localStorage projects:', err);
  }

  // Fetch from Lovable Cloud / Supabase /projects/list
  let remoteProjects: Project[] = [];
  try {
    const { projects, error } = await apiListProjects();
    if (!error && projects && projects.length > 0) {
      remoteProjects = projects;
    }
  } catch (err) {
    console.warn('Lovable/Supabase fetch projects note:', err);
  }

  // Merge remote and local without duplicates
  const mergedMap = new Map<string, Project>();
  [...remoteProjects, ...localProjects].forEach(p => mergedMap.set(p.id, p));
  const merged = Array.from(mergedMap.values());
  
  if (merged.length > 0) {
    try {
      localStorage.setItem('vixora_projects', JSON.stringify(merged));
    } catch {}
  }
  
  return merged;
}

// ============================================================================
// CREATED VIDEOS & ASSETS SYNC (Lovable Cloud / Supabase + Firestore + LocalStorage)
// ============================================================================

export async function syncSaveCreatedVideo(video: CreatedVideo, projectId?: string): Promise<void> {
  // 1. Update local storage first for immediate offline availability
  try {
    const saved = localStorage.getItem('ggd_created_videos');
    const existing: CreatedVideo[] = saved ? JSON.parse(saved) : [];
    const updated = [video, ...existing.filter(v => v.id !== video.id)];
    localStorage.setItem('ggd_created_videos', JSON.stringify(updated));
  } catch (err) {
    console.error("Error saving video to localStorage:", err);
  }

  // 2. Sync asset to Lovable Cloud / Supabase /assets/create
  try {
    const assetPayload: LovableAssetPayload = {
      id: `asset_vid_${video.id}`,
      projectId: projectId || (video as any).projectId || null,
      name: video.topic || 'Rendered Video',
      type: 'video',
      url: video.videoUrl || '',
      format: video.format || 'mp4',
      duration: video.duration || '',
      resolution: video.resolution || '1080p',
      metadata: {
        aspectRatio: video.aspectRatio,
        scriptText: video.scriptText,
        date: video.date,
      },
    };
    await apiCreateAsset(assetPayload);
  } catch (sbErr) {
    console.warn("Supabase asset sync note:", sbErr);
  }

  // 3. Sync to Firebase Firestore for backward compatibility
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
  try {
    localStorage.setItem('ggd_created_videos', JSON.stringify(merged));
  } catch {}
  return merged;
}

// ============================================================================
// ASSET SIGNED URL RETRIEVAL (/assets/signed-url)
// ============================================================================

export async function syncGetAssetSignedUrl(assetUrlOrPath: string): Promise<string> {
  if (!assetUrlOrPath) return '';
  try {
    const { signedUrl, error } = await apiGetAssetSignedUrl(assetUrlOrPath);
    if (!error && signedUrl) {
      return signedUrl;
    }
  } catch (err) {
    console.warn("Signed URL generation warning:", err);
  }
  return assetUrlOrPath;
}

// ============================================================================
// VOICEOVER HISTORY SYNC (Lovable Cloud / Supabase + Firestore + LocalStorage)
// ============================================================================

export async function syncSaveVoiceover(voiceoverItem: { id: string; text: string; audioBase64: string; date: string }, projectId?: string): Promise<void> {
  try {
    const saved = localStorage.getItem('vixora_voiceover_history');
    const existing = saved ? JSON.parse(saved) : [];
    const updated = [voiceoverItem, ...existing.filter((item: any) => item.id !== voiceoverItem.id)];
    localStorage.setItem('vixora_voiceover_history', JSON.stringify(updated));
  } catch (err) {
    console.error("Local voiceover save error:", err);
  }

  // Sync to Lovable Cloud / Supabase /assets/create as voiceover audio asset
  try {
    await apiCreateAsset({
      id: `asset_vo_${voiceoverItem.id}`,
      projectId: projectId || null,
      name: `Voiceover: ${voiceoverItem.text.slice(0, 30)}...`,
      type: 'voiceover',
      url: voiceoverItem.audioBase64 ? 'data:audio/mp3;base64,' + voiceoverItem.audioBase64.replace(/^data:audio\/\w+;base64,/, '') : '',
      format: 'mp3',
      metadata: {
        date: voiceoverItem.date,
        textSnippet: voiceoverItem.text.slice(0, 100),
      },
    });
  } catch (sbErr) {
    console.warn("Supabase voiceover asset save note:", sbErr);
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
  try {
    localStorage.setItem('vixora_voiceover_history', JSON.stringify(merged));
  } catch {}
  return merged;
}
