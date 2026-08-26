/**
 * Google AI Voice Generation (Gemini TTS) Service
 * High-fidelity Google AI Speech Synthesis with Google Kore Flagship voice.
 */

export const DEFAULT_GEMINI_KEY = '';

export interface GoogleVoiceProfile {
  id: string;
  name: string;
  voiceName: string;
  accent: string;
  gender: 'Female' | 'Male';
  description: string;
  sampleText: string;
  badge?: string;
  isVixoraVoice?: boolean;
}

export const GOOGLE_VOICES: GoogleVoiceProfile[] = [
  {
    id: 'vixora_studio_voice',
    name: 'Vixora Studio Voice (Signature Flagship AI)',
    voiceName: 'Kore',
    accent: 'Vixora Studio Signature Voice (High-Energy & Crystal Clear)',
    gender: 'Female',
    description: 'The official signature Vixora Studio AI voice. Vibrant, charismatic, high-energy tone engineered for maximum video retention, viral hooks, and immersive narration.',
    sampleText: 'Welcome to Vixora Studio! I am your signature AI studio voice, ready to bring your video scripts and audio creations to life!',
    badge: 'OFFICIAL VIXORA STUDIO VOICE',
    isVixoraVoice: true
  },
  {
    id: 'aoede_warm',
    name: 'Aoede (Warm Storytelling)',
    voiceName: 'Aoede',
    accent: 'Warm & Engaging Accent',
    gender: 'Female',
    description: 'Gentle, engaging female narrator tone for documentary, storytelling, and lifestyle shorts.',
    sampleText: 'Empower your content with high-retention storytelling, crystal clarity, and authentic pacing.'
  },
  {
    id: 'puck_high_energy',
    name: 'Puck (Viral High Energy)',
    voiceName: 'Puck',
    accent: 'Fast-Paced Viral Accent',
    gender: 'Male',
    description: 'Upbeat, high-impact male voice engineered for fast hooks on TikTok and YouTube Shorts.',
    sampleText: 'Stop scrolling right now! Here are three secrets top creators use to scale their audience.'
  },
  {
    id: 'charon_dramatic',
    name: 'Charon (Deep Cinematic)',
    voiceName: 'Charon',
    accent: 'Deep Authoritative Tone',
    gender: 'Male',
    description: 'Authoritative deep cinematic tone for mysteries, history, finance, and dramatic breakdowns.',
    sampleText: 'In a world driven by continuous change, one fundamental truth remains untouched.'
  },
  {
    id: 'fenrir_bold',
    name: 'Fenrir (Bold & Direct)',
    voiceName: 'Fenrir',
    accent: 'Confident Direct Tone',
    gender: 'Male',
    description: 'Strong, articulate male tone for tech reviews, business breakdowns, and sharp commentaries.',
    sampleText: 'Welcome back! Today we are dissecting the biggest AI breakthrough and how you can profit from it.'
  },
  {
    id: 'zephyr_smooth',
    name: 'Zephyr (Smooth Professional)',
    voiceName: 'Zephyr',
    accent: 'Balanced Studio Tone',
    gender: 'Female',
    description: 'Smooth, polished, and balanced tone for educational tutorials and product showcases.',
    sampleText: 'Let us dive into the details and guide you step by step through the complete workflow.'
  }
];

export interface GoogleVoiceSynthesisRequest {
  text: string;
  voiceName?: string;
  format?: 'mp3' | 'wav' | 'pcm';
  speed?: number;
  customApiKey?: string;
}

export interface GoogleVoiceSynthesisResponse {
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
 * Maps voice input to standard Google Gemini Voice name (defaults to Kore)
 */
export function resolveGoogleVoice(voiceNameOrId?: string): string {
  if (!voiceNameOrId) return 'Kore';
  const clean = voiceNameOrId.toLowerCase();
  if (clean.includes('kore')) return 'Kore';
  if (clean.includes('aoede')) return 'Aoede';
  if (clean.includes('puck')) return 'Puck';
  if (clean.includes('charon')) return 'Charon';
  if (clean.includes('fenrir')) return 'Fenrir';
  if (clean.includes('zephyr')) return 'Zephyr';
  return 'Kore';
}

/**
 * Synthesizes voiceover speech via Google AI server endpoint or direct synthesis
 */
export async function synthesizeGoogleVoice(
  request: GoogleVoiceSynthesisRequest
): Promise<GoogleVoiceSynthesisResponse> {
  const {
    text,
    voiceName: requestedVoice = 'Kore',
    format = 'mp3',
    speed = 1.0,
    customApiKey
  } = request;

  const targetVoice = resolveGoogleVoice(requestedVoice);

  // 1. Try internal backend API proxy first (/api/audio/tts or /api/public/v1/audio/tts)
  try {
    const serverRes = await fetch('/api/audio/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, audio/*'
      },
      body: JSON.stringify({
        text,
        voice: targetVoice,
        speed,
        format,
        apiKey: customApiKey || undefined
      })
    });

    if (serverRes.ok) {
      const contentType = serverRes.headers.get('content-type') || '';
      if (contentType.includes('audio/') || contentType.includes('application/octet-stream')) {
        const arrayBuf = await serverRes.arrayBuffer();
        const blob = new Blob([arrayBuf], { type: format === 'wav' ? 'audio/wav' : 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        const base64 = await blobToBase64(blob);
        const wordCount = text.split(/\s+/).length;
        const estDuration = Math.max(2, Math.round((wordCount / 140) * 60 / speed));

        return {
          ok: true,
          audioBlob: blob,
          audioBase64: base64,
          audioUrl,
          durationSeconds: estDuration,
          format,
          voice: targetVoice
        };
      } else {
        const json = await serverRes.json();
        if (json.ok && (json.audio_base64 || json.audio_stream_url)) {
          let base64 = json.audio_base64;
          if (!base64 && json.audio_stream_url?.startsWith('data:')) {
            base64 = json.audio_stream_url.split(',')[1];
          }

          let blob: Blob | undefined;
          let audioUrl = json.audio_stream_url;

          if (base64) {
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            blob = new Blob([byteArray], { type: json.audio_format === 'wav' ? 'audio/wav' : 'audio/mpeg' });
            audioUrl = URL.createObjectURL(blob);
          }

          return {
            ok: true,
            audioBlob: blob,
            audioBase64: base64,
            audioUrl: audioUrl || `data:audio/mp3;base64,${base64}`,
            durationSeconds: json.estimated_duration_seconds || Math.max(2, Math.round((text.split(/\s+/).length / 140) * 60 / speed)),
            format: json.audio_format || format,
            voice: targetVoice
          };
        }
      }
    }
  } catch (proxyErr) {
    console.warn('[Google Voice Server Proxy warning]:', proxyErr);
  }

  // 2. Client-side Speech synthesis fallback if server unreachable
  return clientSpeechFallback(text, targetVoice, format, speed);
}

/**
 * Fallback Web Speech Synthesis if network is offline
 */
function clientSpeechFallback(
  text: string, 
  voice: string, 
  format: string, 
  speed: number
): Promise<GoogleVoiceSynthesisResponse> {
  return new Promise((resolve) => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed;
        utterance.pitch = voice === 'Kore' ? 1.15 : 1.0;
        
        // Find best match voice in browser
        const synthVoices = window.speechSynthesis.getVoices();
        const preferred = synthVoices.find(v => 
          (voice === 'Kore' && (v.name.includes('Google') || v.name.includes('Female') || v.lang.includes('en'))) ||
          (v.name.includes('Google') || v.lang.startsWith('en'))
        );
        if (preferred) utterance.voice = preferred;

        window.speechSynthesis.speak(utterance);

        const wordCount = text.split(/\s+/).length;
        const estDuration = Math.max(2, Math.round((wordCount / 140) * 60 / speed));

        resolve({
          ok: true,
          voice,
          format: 'browser-speech',
          durationSeconds: estDuration
        });
        return;
      }
    } catch {}

    resolve({
      ok: false,
      voice,
      format,
      error: 'Google Voice synthesis error'
    });
  });
}

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
