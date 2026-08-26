/**
 * Voice Synthesis Service - Powered by Google AI (Gemini Voice Engine)
 * Default Flagship Voice: Google Kore Voice
 */

import {
  GOOGLE_VOICES,
  GoogleVoiceProfile,
  GoogleVoiceSynthesisRequest,
  GoogleVoiceSynthesisResponse,
  synthesizeGoogleVoice,
  resolveGoogleVoice,
  DEFAULT_GEMINI_KEY
} from './googleVoiceService';

export const DEFAULT_FISH_AUDIO_KEY = DEFAULT_GEMINI_KEY;

export type FishAudioVoiceProfile = GoogleVoiceProfile;
export const FISH_AUDIO_VOICES: FishAudioVoiceProfile[] = GOOGLE_VOICES;

export type FishAudioSynthesisRequest = GoogleVoiceSynthesisRequest;
export type FishAudioSynthesisResponse = GoogleVoiceSynthesisResponse;

export const synthesizeFishAudio = synthesizeGoogleVoice;
export const synthesizeVoiceover = synthesizeGoogleVoice;
export const resolveVoice = resolveGoogleVoice;
