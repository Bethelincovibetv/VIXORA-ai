import { createClient, SupabaseClient, User as SupabaseUser, Session } from '@supabase/supabase-js';
import { Project, CreatedVideo } from '../types';

// Supabase and Lovable Cloud Configuration
// Credentials supplied by environment variables or default fallbacks
export const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://yyejcbbcqirsigphzxxo.supabase.co';
export const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_bgmE8p2LPYQn2eVWBUEdMw_6R4GplVZ';
export const LOVABLE_API_BASE_URL = (import.meta as any).env?.VITE_LOVABLE_API_BASE_URL || 'https://project--0ac951e1-eb85-437f-bffe-bc341e2037d2.lovable.app/api/public/v1';

// Initialize Supabase Client with Safe Anon Key & Token Storage
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// Helper to get active user session token
export async function getSupabaseAccessToken(): Promise<string | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;
    return session.access_token;
  } catch (err) {
    console.warn('Error fetching Supabase access token:', err);
    return null;
  }
}

// Generic authenticated fetcher for Lovable Cloud public API endpoints
async function fetchLovableApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<{ data: T | null; error: string | null }> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${LOVABLE_API_BASE_URL}${normalizedEndpoint}`;
  
  const token = await getSupabaseAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // Also include anon key as fallback header if no active user session
    headers['apikey'] = SUPABASE_ANON_KEY;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown API error');
      console.warn(`[Lovable Cloud API] ${options.method || 'GET'} ${normalizedEndpoint} responded with status ${res.status}:`, errText);
      return { data: null, error: `HTTP ${res.status}: ${errText}` };
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      return { data: json as T, error: null };
    } else {
      const text = await res.text();
      return { data: text as unknown as T, error: null };
    }
  } catch (err: any) {
    console.warn(`[Lovable Cloud API Network Error] ${normalizedEndpoint}:`, err?.message || err);
    return { data: null, error: err?.message || 'Network request failed' };
  }
}

// ============================================================================
// AUTHENTICATION METHODS (SUPABASE AUTH)
// ============================================================================

export async function signInWithSupabase(email: string, password: string): Promise<{ user: SupabaseUser | null; session: Session | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    return { user: data.user, session: data.session, error: null };
  } catch (err: any) {
    return { user: null, session: null, error: err?.message || 'Failed to sign in with Supabase' };
  }
}

export async function signUpWithSupabase(email: string, password: string, fullName?: string): Promise<{ user: SupabaseUser | null; session: Session | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName || '',
        },
      },
    });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    return { user: data.user, session: data.session, error: null };
  } catch (err: any) {
    return { user: null, session: null, error: err?.message || 'Failed to sign up with Supabase' };
  }
}

export async function signOutSupabase(): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    return { error: err?.message || 'Error signing out from Supabase' };
  }
}

export async function getSupabaseCurrentUser(): Promise<SupabaseUser | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export function onSupabaseAuthStateChange(callback: (session: Session | null, user: SupabaseUser | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session, session?.user || null);
  });
  return subscription;
}

// ============================================================================
// STEP 3: API ENDPOINTS FOR PROJECTS & ASSETS
// ============================================================================

export interface LovableProjectPayload {
  id?: string;
  title: string;
  topic?: string;
  status?: string;
  aspectRatio?: string;
  targetDuration?: string;
  scriptText?: string;
  voiceoverUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
}

export interface LovableAssetPayload {
  id?: string;
  projectId?: string;
  name: string;
  type: 'video' | 'voiceover' | 'clip' | 'thumbnail' | 'image' | 'audio';
  url: string;
  format?: string;
  duration?: string;
  resolution?: string;
  metadata?: Record<string, any>;
}

export interface LovableSignedUrlResponse {
  signedUrl: string;
  expiresAt?: string | number;
  url?: string;
}

/**
 * /projects/create: Called when a user starts a new video project (topic or script entry)
 */
export async function apiCreateProject(projectData: LovableProjectPayload): Promise<{ data: any; error: string | null }> {
  const payload = {
    id: projectData.id || `proj_${Date.now()}`,
    title: projectData.title || 'Untitled Project',
    topic: projectData.topic || '',
    status: projectData.status || 'draft',
    aspect_ratio: projectData.aspectRatio || 'vertical',
    target_duration: projectData.targetDuration || '30s',
    script_text: projectData.scriptText || '',
    voiceover_url: projectData.voiceoverUrl || '',
    video_url: projectData.videoUrl || '',
    thumbnail_url: projectData.thumbnailUrl || '',
    metadata: projectData.metadata || {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Attempt Lovable Cloud endpoint
  const result = await fetchLovableApi('/projects/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (result.error) {
    console.warn('[Lovable Cloud] /projects/create API returned error, falling back to direct Supabase storage if available:', result.error);
    try {
      const { data, error } = await supabase
        .from('projects')
        .upsert({
          id: payload.id,
          title: payload.title,
          topic: payload.topic,
          status: payload.status,
          aspect_ratio: payload.aspect_ratio,
          target_duration: payload.target_duration,
          script_text: payload.script_text,
          voiceover_url: payload.voiceover_url,
          video_url: payload.video_url,
          thumbnail_url: payload.thumbnail_url,
          updated_at: payload.updated_at,
        })
        .select()
        .single();

      if (!error && data) {
        return { data, error: null };
      }
    } catch (sbErr) {
      console.warn('[Supabase Fallback] Error in direct table upsert:', sbErr);
    }
  }

  return result;
}

/**
 * /projects/list: Called to populate the Projects navigation/library view
 */
export async function apiListProjects(): Promise<{ projects: Project[]; error: string | null }> {
  // First attempt Lovable Cloud /projects/list endpoint
  let result = await fetchLovableApi<any>('/projects/list', {
    method: 'GET',
  });

  // If GET not supported or failed, try POST
  if (result.error && result.error.includes('405')) {
    result = await fetchLovableApi<any>('/projects/list', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  if (result.data) {
    const rawList = Array.isArray(result.data) ? result.data : result.data.projects || result.data.data || [];
    const formatted: Project[] = rawList.map((item: any) => ({
      id: item.id || `proj_${Date.now()}`,
      title: item.title || 'Untitled Project',
      topic: item.topic || '',
      status: item.status || 'draft',
      aspectRatio: item.aspectRatio || item.aspect_ratio || 'vertical',
      targetDuration: item.targetDuration || item.target_duration || '30s',
      createdAt: item.createdAt || item.created_at || new Date().toISOString(),
      updatedAt: item.updatedAt || item.updated_at || new Date().toISOString(),
      thumbnailUrl: item.thumbnailUrl || item.thumbnail_url,
      scriptText: item.scriptText || item.script_text,
      voiceoverUrl: item.voiceoverUrl || item.voiceover_url,
      videoUrl: item.videoUrl || item.video_url,
      chatHistory: item.chatHistory || item.chat_history,
      sourcedVideos: item.sourcedVideos || item.sourced_videos,
    }));
    return { projects: formatted, error: null };
  }

  // Fallback to Supabase direct table query if Lovable API is pending
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const formatted: Project[] = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        topic: item.topic || '',
        status: item.status || 'draft',
        aspectRatio: item.aspect_ratio || 'vertical',
        targetDuration: item.target_duration || '30s',
        createdAt: item.created_at || new Date().toISOString(),
        updatedAt: item.updated_at || new Date().toISOString(),
        thumbnailUrl: item.thumbnail_url,
        scriptText: item.script_text,
        voiceoverUrl: item.voiceover_url,
        videoUrl: item.video_url,
      }));
      return { projects: formatted, error: null };
    }
  } catch (sbErr) {
    console.warn('[Supabase Fallback] Table query fallback error:', sbErr);
  }

  return { projects: [], error: result.error };
}

/**
 * /assets/create: Called after each generated asset (compiled video, voiceover audio, sourced clip reference) is ready
 */
export async function apiCreateAsset(assetData: LovableAssetPayload): Promise<{ data: any; error: string | null }> {
  const payload = {
    id: assetData.id || `asset_${Date.now()}`,
    project_id: assetData.projectId || null,
    name: assetData.name || 'Untitled Asset',
    type: assetData.type || 'video',
    url: assetData.url || '',
    format: assetData.format || 'mp4',
    duration: assetData.duration || '',
    resolution: assetData.resolution || '1080p',
    metadata: assetData.metadata || {},
    created_at: new Date().toISOString(),
  };

  const result = await fetchLovableApi('/assets/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (result.error) {
    console.warn('[Lovable Cloud] /assets/create API returned error, attempting Supabase direct table upsert:', result.error);
    try {
      const { data, error } = await supabase
        .from('assets')
        .upsert(payload)
        .select()
        .single();

      if (!error && data) {
        return { data, error: null };
      }
    } catch (sbErr) {
      console.warn('[Supabase Fallback] Asset table fallback warning:', sbErr);
    }
  }

  return result;
}

/**
 * /assets/signed-url: Used whenever the app needs to generate a downloadable/previewable link for a stored asset
 */
export async function apiGetAssetSignedUrl(assetIdOrPath: string, expiresIn: number = 3600): Promise<{ signedUrl: string | null; error: string | null }> {
  if (!assetIdOrPath) {
    return { signedUrl: null, error: 'No asset path provided' };
  }

  // If already an absolute http/https/blob URL, it can be used directly or signed
  if (assetIdOrPath.startsWith('blob:') || assetIdOrPath.startsWith('data:')) {
    return { signedUrl: assetIdOrPath, error: null };
  }

  // Attempt Lovable Cloud /assets/signed-url POST
  const result = await fetchLovableApi<LovableSignedUrlResponse>('/assets/signed-url', {
    method: 'POST',
    body: JSON.stringify({
      asset_id: assetIdOrPath,
      path: assetIdOrPath,
      expires_in: expiresIn,
    }),
  });

  if (result.data) {
    const signedUrl = result.data.signedUrl || result.data.url || null;
    if (signedUrl) return { signedUrl, error: null };
  }

  // If the Lovable endpoint is cold, attempt Supabase Storage bucket signed URL
  try {
    // Check if assetIdOrPath references a bucket:path format e.g. "videos/my-video.mp4"
    const parts = assetIdOrPath.split('/');
    if (parts.length >= 2) {
      const bucketName = parts[0];
      const filePath = parts.slice(1).join('/');
      const { data: storageData, error: storageErr } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (!storageErr && storageData?.signedUrl) {
        return { signedUrl: storageData.signedUrl, error: null };
      }
    }
  } catch (storageException) {
    console.warn('[Supabase Storage] createSignedUrl exception:', storageException);
  }

  // Return original URL if it's already a full web URL
  if (assetIdOrPath.startsWith('http://') || assetIdOrPath.startsWith('https://')) {
    return { signedUrl: assetIdOrPath, error: null };
  }

  return { signedUrl: null, error: result.error || 'Failed to generate signed URL' };
}

// ============================================================================
// STEP 2 & 3: SERVER-SIDE VIDEO CREATION & STATUS API HELPERS
// ============================================================================

export interface ServerCreateVideoRequest {
  project_id?: string;
  topic?: string;
  script?: string;
  voice?: string;
  aspect_ratio?: 'vertical' | 'horizontal' | 'square';
  duration?: string;
  resolution?: string;
  format?: string;
}

export interface ServerVideoStatusResponse {
  ok: boolean;
  job_id: string;
  project_id?: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  progress: number;
  current_step: string;
  asset_id?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  logs?: string[];
}

/**
 * /videos/create: Triggers asynchronous server-side video creation
 */
export async function apiServerCreateVideo(payload: ServerCreateVideoRequest): Promise<{ ok: boolean; job_id?: string; status?: string; message?: string; error?: string | null }> {
  // First attempt local /api/public/v1/videos/create endpoint or Lovable endpoint
  try {
    const res = await fetch('/api/public/v1/videos/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok && data.ok) {
      return { ok: true, job_id: data.job_id, status: data.status, message: data.message, error: null };
    }
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  } catch (err: any) {
    // Fallback to Lovable Cloud API
    const result = await fetchLovableApi<any>('/videos/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (result.data && (result.data.ok || result.data.job_id)) {
      return { ok: true, job_id: result.data.job_id, status: result.data.status || 'processing', error: null };
    }

    return { ok: false, error: err?.message || result.error || 'Failed to trigger server-side video creation' };
  }
}

/**
 * /videos/status: Polls progress and retrieves completed asset information
 */
export async function apiServerGetVideoStatus(jobId: string): Promise<ServerVideoStatusResponse | { ok: false; error: string }> {
  if (!jobId) {
    return { ok: false, error: 'Job ID is required' };
  }

  try {
    const res = await fetch(`/api/public/v1/videos/status?job_id=${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
      },
    });

    const data = await res.json();
    if (res.ok && data.ok) {
      return data as ServerVideoStatusResponse;
    }
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  } catch (err: any) {
    const result = await fetchLovableApi<any>(`/videos/status?job_id=${encodeURIComponent(jobId)}`, {
      method: 'GET',
    });

    if (result.data && result.data.ok) {
      return result.data as ServerVideoStatusResponse;
    }

    return { ok: false, error: err?.message || result.error || 'Failed to get video job status' };
  }
}

