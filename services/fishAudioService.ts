/**
 * Fish Audio API Voice Synthesis Service (https://api.fish.audio)
 * Replaces legacy audio synthesis with Fish Audio's S2-Pro neural voice generation.
 */

export const DEFAULT_FISH_AUDIO_KEY = 'sk-fish-xEutEyyFu1FHRG1iw_Ivgpscuo4oxXzpOJQ1YdITcjk';

export interface FishAudioVoiceProfile {
  id: string;
  name: string;
  voiceName: string;
  accent: string;
  gender: 'Female' | 'Male';
  reference_id?: string;
  emotionTag: string;
  description: string;
  sampleText: string;
  badge?: string;
  isVixoraVoice?: boolean;
}

export const FISH_AUDIO_VOICES: FishAudioVoiceProfile[] = [
  {
    id: 'kore_nigerian',
    name: 'Vixora Voice (Kore - Highly Energetic Lady)',
    voiceName: 'Kore',
    accent: 'Highly Energetic Nigerian Female Accent',
    gender: 'Female',
    emotionTag: '[excited] [cheerful]',
    description: 'Vibrant, highly energetic, natural Nigerian female AI tone powered by Fish Audio.',
    sampleText: 'Welcome to Vixora Studio! I am your energetic Nigerian AI partner, ready to cook viral videos with you!',
    badge: 'FLAGSHIP HIGHLY ENERGETIC NIGERIAN VOICE',
    isVixoraVoice: true
  },
  {
    id: 'aoede_warm',
    name: 'Aoede',
    voiceName: 'Aoede',
    accent: 'Warm Storytelling Accent',
    gender: 'Female',
    emotionTag: '[calm] [warm]',
    description: 'Gentle, engaging female narrator tone for documentary and lifestyle shorts.',
    sampleText: 'Empower your content with high-retention storytelling and effortless clarity.'
  },
  {
    id: 'puck_high_energy',
    name: 'Puck',
    voiceName: 'Puck',
    accent: 'High Energy Viral Accent',
    gender: 'Male',
    emotionTag: '[excited] [energetic]',
    description: 'Upbeat, fast-paced viral male voice ideal for TikTok and YouTube Shorts hooks.',
    sampleText: 'Stop scrolling right now! Here are three secrets to build wealth before 30.'
  },
  {
    id: 'charon_dramatic',
    name: 'Charon',
    voiceName: 'Charon',
    accent: 'Deep Cinematic Accent',
    gender: 'Male',
    emotionTag: '[deep] [serious]',
    description: 'Authoritative deep cinematic tone for true crime, history, and mysteries.',
    sampleText: 'In a world driven by constant evolution, one historic truth remains untouched.'
  },
  {
    id: 'fenrir_bold',
    name: 'Fenrir',
    voiceName: 'Fenrir',
    accent: 'Bold & Direct Accent',
    gender: 'Male',
    emotionTag: '[confident]',
    description: 'Strong, articulate male tone for tech reviews, news, and business breakdowns.',
    sampleText: 'Welcome back! Today we are dissecting the biggest AI breakthrough of the decade.'
  }
];

export interface FishAudioSynthesisRequest {
  text: string;
  voiceName?: string;
  reference_id?: string;
  model?: 's2.1-pro-free' | 's2.1-pro' | 's2-pro' | string;
  format?: 'mp3' | 'wav' | 'opus' | 'pcm';
  speed?: number;
  customApiKey?: string;
}

export interface FishAudioSynthesisResponse {
  ok: boolean;
  audioBlob?: Blob;
  audioBase64?: string;
  audioUrl?: string;
  durationSeconds?: number;
  format: string;
  voice: string;
  error?: string;
  statusCode?: number;
}

/**
 * Maps app voice names/IDs to emotion prompts & reference IDs for Fish Audio
 */
export function resolveFishAudioParams(voiceKey: string = 'Kore', text: string): { styledText: string; reference_id?: string } {
  const profile = FISH_AUDIO_VOICES.find(v => 
    v.id.toLowerCase() === voiceKey.toLowerCase() || 
    v.voiceName.toLowerCase() === voiceKey.toLowerCase()
  ) || FISH_AUDIO_VOICES[0];

  const emotionPrefix = profile.emotionTag ? `${profile.emotionTag} ` : '';
  const cleanText = text.replace(/\[.*?\]/g, '').trim();
  const styledText = `${emotionPrefix}${cleanText}`;

  return {
    styledText,
    reference_id: profile.reference_id
  };
}

/**
 * Synthesizes voice audio via Fish Audio S2-Pro API (via server proxy or direct fallback)
 */
export async function synthesizeFishAudio(params: FishAudioSynthesisRequest): Promise<FishAudioSynthesisResponse> {
  const { text, voiceName = 'Kore', format = 'mp3', model = 's2.1-pro-free', customApiKey } = params;
  
  if (!text || !text.trim()) {
    return {
      ok: false,
      format,
      voice: voiceName,
      error: 'Text is required for voiceover synthesis'
    };
  }

  const { styledText, reference_id } = resolveFishAudioParams(voiceName, text);

  // 1. Try via our server proxy endpoint first (avoids CORS and protects API keys)
  try {
    const serverRes = await fetch('/api/fish-audio/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: styledText,
        reference_id: reference_id || params.reference_id,
        format,
        voice: voiceName,
        model,
        apiKey: customApiKey || DEFAULT_FISH_AUDIO_KEY
      })
    });

    if (serverRes.ok) {
      const contentType = serverRes.headers.get('content-type') || '';
      if (contentType.includes('audio/') || contentType.includes('application/octet-stream')) {
        const arrayBuf = await serverRes.arrayBuffer();
        const blob = new Blob([arrayBuf], { type: format === 'mp3' ? 'audio/mpeg' : 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);
        const base64 = await blobToBase64(blob);

        const wordCount = text.split(/\s+/).length;
        const estDuration = Math.max(2, Math.round((wordCount / 140) * 60));

        return {
          ok: true,
          audioBlob: blob,
          audioBase64: base64,
          audioUrl,
          durationSeconds: estDuration,
          format,
          voice: voiceName
        };
      } else {
        const json = await serverRes.json();
        if (json.ok && json.audio_base64) {
          const byteCharacters = atob(json.audio_base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: format === 'mp3' ? 'audio/mpeg' : 'audio/wav' });
          const audioUrl = URL.createObjectURL(blob);

          return {
            ok: true,
            audioBlob: blob,
            audioBase64: json.audio_base64,
            audioUrl,
            durationSeconds: json.duration || Math.max(2, Math.round((text.split(/\s+/).length / 140) * 60)),
            format,
            voice: voiceName
          };
        }
        if (json.error) {
          console.warn('[Fish Audio Server Proxy Response]:', json.error);
        }
      }
    }
  } catch (proxyErr) {
    console.warn('[Fish Audio Server Proxy fetch warning]:', proxyErr);
  }

  // 2. Direct browser fetch to https://api.fish.audio/v1/tts
  const apiKeyToUse = customApiKey || 
    (typeof process !== 'undefined' && process.env?.FISH_AUDIO_API_KEY) || 
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FISH_AUDIO_API_KEY) || 
    DEFAULT_FISH_AUDIO_KEY;

  try {
    const directRes = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeyToUse}`,
        'Content-Type': 'application/json',
        'model': model
      },
      body: JSON.stringify({
        text: styledText,
        reference_id: reference_id || undefined,
        format
      })
    });

    if (directRes.ok) {
      const arrayBuf = await directRes.arrayBuffer();
      const blob = new Blob([arrayBuf], { type: format === 'mp3' ? 'audio/mpeg' : 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);
      const base64 = await blobToBase64(blob);

      const wordCount = text.split(/\s+/).length;
      const estDuration = Math.max(2, Math.round((wordCount / 140) * 60));

      return {
        ok: true,
        audioBlob: blob,
        audioBase64: base64,
        audioUrl,
        durationSeconds: estDuration,
        format,
        voice: voiceName
      };
    } else {
      const errText = await directRes.text();
      let parsedErr: any = null;
      try { parsedErr = JSON.parse(errText); } catch {}
      const msg = parsedErr?.message || errText || `HTTP ${directRes.status}`;
      
      console.warn(`[Fish Audio API Direct Error (${directRes.status})]:`, msg);

      return {
        ok: false,
        format,
        voice: voiceName,
        statusCode: directRes.status,
        error: msg
      };
    }
  } catch (directErr: any) {
    console.warn('[Fish Audio direct synthesis error]:', directErr);
    return {
      ok: false,
      format,
      voice: voiceName,
      error: directErr?.message || 'Network error connecting to Fish Audio'
    };
  }
}

/**
 * Utility: Converts a Blob to a base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
