// Pure server catalog without JSX or image imports for clean Node / esbuild compilation

export interface ServerVoiceOption {
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

export const SERVER_VOICE_OPTIONS: ServerVoiceOption[] = [
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
  }
];

export interface ServerMusicTrack {
  id: string;
  name: string;
  url: string;
  mood: string;
  description: string;
}

export const SERVER_MUSIC_TRACKS: ServerMusicTrack[] = [
  { id: 'motivational', name: 'Motivational Rise', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', mood: 'motivational', description: 'Energetic building rhythm' },
  { id: 'epic', name: 'Epic Cinema', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', mood: 'dramatic', description: 'Orchestral deep crescendo' },
  { id: 'calm', name: 'Chill Ambient', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', mood: 'calm', description: 'Restful, soothing focus pad' },
  { id: 'upbeat', name: 'Bright Pop', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', mood: 'upbeat', description: 'Cheerful uplifting acoustic guitar' },
  { id: 'corporate', name: 'Clean Corporate', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', mood: 'corporate', description: 'Smart, professional presentation' },
  { id: 'future', name: 'Future Cyber', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', mood: 'tech', description: 'Cyberpunk cinematic electronic' },
  { id: 'sunset-lounge', name: 'Sunset Lounge', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', mood: 'calm', description: 'Smooth atmospheric jazz and warm deep bass' },
  { id: 'neon-horizon', name: 'Neon Horizon', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', mood: 'tech', description: 'Driving synthwave highway explorer beat' },
  { id: 'productive-flow', name: 'Productive Flow', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', mood: 'corporate', description: 'Inspirational electronic pulse for deep focus' },
  { id: 'cinematic-velocity', name: 'Cinematic Velocity', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', mood: 'dramatic', description: 'Staccato orchestration with powerful cinematic action' },
  { id: 'acoustic-sunshine', name: 'Acoustic Sunshine', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', mood: 'upbeat', description: 'Happy handclaps with vibrant acoustic lead strumming' },
  { id: 'dreamy-lofi', name: 'Dreamy Lofi', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', mood: 'calm', description: 'Relaxing vintage dusty vinyl textures and bells' }
];
