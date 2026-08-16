
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from "@google/genai";
import { UserProfile, Bank } from './types';
import { VideoSequencer } from './components/VideoSequencer';
import { VixoraContentMaster } from './components/VixoraContentMaster';
import { PRESET_MUSIC_TRACKS, VOICE_AVATAR_OPTIONS } from './constants';
import { syncSaveCreatedVideo, syncFetchCreatedVideos, syncSaveVoiceover, syncFetchVoiceovers } from './services/dataSyncService';
import { scoreAndFetchBeatVisual } from './services/stockSourcingService';
import { 
  requestNotificationPermission, 
  setupForegroundMessageListener, 
  sendLocalPushNotification,
  syncFirebaseSaveAnnouncement, 
  syncFirebaseFetchAnnouncements, 
  FeatureAnnouncement 
} from './services/firebaseService';
import vixoraLogo from './src/assets/images/vixora_logo_1786107851312.jpg';
import vixoraAgentAvatar from './src/assets/images/vixora_agent_avatar_1786108775324.jpg';
import viralGrowthBanner from './src/assets/images/viral_growth_banner_1786110948420.jpg';

// --- TYPES ---

export interface GenAIBlob {
  data: string;
  mimeType: string;
}

export interface CreatedVideo {
  id: string;
  topic: string;
  scriptText: string;
  videoUrl: string;
  date: string;
  aspectRatio: 'vertical' | 'horizontal' | 'square';
}

interface SourcedVideo {
  id: number;
  url: string;
  image: string;
  duration: number;
  video_files: Array<{
    link: string;
    quality: string;
    width: number;
    height: number;
  }>;
}

export const NICHE_OPTIONS = [
  { 
    id: 'finance', 
    name: 'Finance & Wealth', 
    icon: 'fa-sack-dollar', 
    coverImage: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80',
    colorGradient: 'from-amber-500 to-orange-600',
    promptSuffix: 'Write in a professional, wealth-building, high-retention tone focusing on finance, investing, passive income, and smart money habits.',
    suggestions: [
      "5 rules of wealth you must learn",
      "Why 99% of people stay poor forever",
      "The truth about passive income in 2026"
    ]
  },
  { 
    id: 'motivation', 
    name: 'Motivation & Mindset', 
    icon: 'fa-fire-flame-curved', 
    coverImage: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
    colorGradient: 'from-orange-500 to-red-600',
    promptSuffix: 'Write in a deeply moving, highly inspirational, high-retention tone focusing on self-discipline, mindset shifting, morning habits, and relentless focus.',
    suggestions: [
      "How to build unbreakable discipline",
      "Atomic habits that will change your life",
      "The power of waking up at 5 am"
    ]
  },
  { 
    id: 'tech', 
    name: 'Tech & Future AI', 
    icon: 'fa-microchip', 
    coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    colorGradient: 'from-cyan-500 to-blue-600',
    promptSuffix: 'Write in a fascinating, tech-forward, high-octane voice focusing on cutting-edge AI breakthroughs, futuristic tech, cyber developments, and smart gadgets.',
    suggestions: [
      "AI is evolving faster than you think",
      "3 futuristic gadgets you can buy today",
      "The truth about artificial super intelligence"
    ]
  },
  { 
    id: 'history', 
    name: 'Ancient History & Mythology', 
    icon: 'fa-scroll', 
    coverImage: 'https://images.unsplash.com/photo-1568792923760-d70635a89fdc?auto=format&fit=crop&w=800&q=80',
    colorGradient: 'from-amber-600 to-yellow-700',
    promptSuffix: 'Write in a suspenseful, epic storytelling vibe focusing on historic ancient wars, Roman/Greek secrets, and legendary mythological figures.',
    suggestions: [
      "The secret lives of Roman Gladiators",
      "Why did the Spartan Empire collapse?",
      "The legendary power of Greek Gods"
    ]
  },
  { 
    id: 'psychology', 
    name: 'Psychology & Human Mind', 
    icon: 'fa-brain', 
    coverImage: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&w=800&q=80',
    colorGradient: 'from-purple-500 to-indigo-600',
    promptSuffix: 'Write in a curious, eye-opening psychological tone focusing on dark psychology facts, human behavior patterns, relationship dynamics, and mind reading.',
    suggestions: [
      "3 body language tricks to read anyone",
      "Dark psychology hacks that actually work",
      "The psychology of silence in conversations"
    ]
  },
  { 
    id: 'health', 
    name: 'Health & Biohacking', 
    icon: 'fa-heart-pulse', 
    coverImage: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80',
    colorGradient: 'from-emerald-500 to-teal-600',
    promptSuffix: 'Write in an energetic, health-conscious, informative style focusing on biohacking secrets, longevity workouts, superfoods, and holistic body wellness.',
    suggestions: [
      "Biohacking secrets to live 100 years",
      "The optimal daily workout for focus",
      "What happens to your body when you fast"
    ]
  },
  { 
    id: 'crime', 
    name: 'True Crime & Mystery', 
    icon: 'fa-user-ninja', 
    coverImage: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    colorGradient: 'from-slate-700 to-slate-900',
    promptSuffix: 'Write in a chilling, suspenseful, gripping documentary style focusing on unsolved mysteries, cold case investigations, and criminal psychology.',
    suggestions: [
      "The unrevealed mystery of the Lost Heist",
      "3 cold cases that shocked the world",
      "Inside the mind of a master deceiver"
    ]
  },
  { 
    id: 'luxury', 
    name: 'Luxury & Lifestyle', 
    icon: 'fa-gem', 
    coverImage: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
    colorGradient: 'from-yellow-500 to-amber-600',
    promptSuffix: 'Write in an opulent, high-status, mesmerizing tone focusing on billionaire lifestyle habits, hypercars, luxury watches, and elite private jets.',
    suggestions: [
      "How billionaires spend their first million",
      "Inside the world's most expensive hypercars",
      "The unspoken habits of the top 0.1%"
    ]
  }
];

// --- UTILITIES ---

const PEXELS_API_KEY = 'wFE0bEysdabca67O2GKWXtE92HWh5XHBtcBmw14VaGcBfkB39q69mxb5';

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createGenAIBlob(data: Float32Array): GenAIBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function createWavHeader(dataLength: number, sampleRate: number, numChannels: number, bitsPerSample: number) {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataLength, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
  view.setUint16(32, numChannels * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataLength, true);
  return new Uint8Array(buffer);
}

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [user, setUser] = useState<(UserProfile & { apiKey?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'studio' | 'autopilot' | 'voiceover' | 'scripts' | 'profile' | 'more' | 'videos' | 'contact' | 'coach'>('studio');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showAccessibilityModal, setShowAccessibilityModal] = useState(false);

  // Theme & Accessibility States
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('vixora_theme') as 'dark' | 'light') || 'dark';
  });
  const [accessibilityMode, setAccessibilityMode] = useState<{
    highContrast: boolean;
    largeText: boolean;
    reduceMotion: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem('vixora_accessibility');
      return saved ? JSON.parse(saved) : { highContrast: false, largeText: false, reduceMotion: false };
    } catch {
      return { highContrast: false, largeText: false, reduceMotion: false };
    }
  });

  useEffect(() => {
    localStorage.setItem('vixora_theme', themeMode);
    if (themeMode === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('vixora_accessibility', JSON.stringify(accessibilityMode));
    if (accessibilityMode.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    if (accessibilityMode.largeText) {
      document.documentElement.classList.add('accessibility-large-text');
    } else {
      document.documentElement.classList.remove('accessibility-large-text');
    }
  }, [accessibilityMode]);
  
  // Onboarding Wizard State
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardData, setWizardData] = useState({ fullName: '', email: '', apiKey: 'AIzaSyCBO1PRv5h9aQAB3rWbLrkwq_Uf_Q_uQCk' });

  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const triggerPwaInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsStandalone(true);
        }
        setDeferredPrompt(null);
      } catch (e) {
        console.warn("Native PWA install prompt error:", e);
      }
    }
  };

  // Push Notifications & Feature Update Announcements State
  const [notificationPermission, setNotificationPermission] = useState<string | null>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : null
  );
  const [announcements, setAnnouncements] = useState<FeatureAnnouncement[]>([
    {
      id: 'init_v3_update',
      title: '🚀 Vixora v3.0 PWA & Phone Push Engine Active!',
      message: 'Vixora Studio is now a full Progressive Web App (PWA) with 1-tap home screen installation, real-time native phone push alerts for feature update adverts, and multi-voice synthesis.',
      tag: 'NEW FEATURE',
      badgeText: 'v3.0 Release',
      createdAt: new Date().toISOString()
    }
  ]);
  const [showAnnouncementsDrawer, setShowAnnouncementsDrawer] = useState(false);
  const [showNewAdvertModal, setShowNewAdvertModal] = useState(false);
  const [activeAdvertPopup, setActiveAdvertPopup] = useState<FeatureAnnouncement | null>(null);

  // Notification Read Tracking State
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vixora_read_announcements');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [hasUnreadAnnouncements, setHasUnreadAnnouncements] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('vixora_read_announcements');
      const readIds: string[] = saved ? JSON.parse(saved) : [];
      return !readIds.includes('init_v3_update');
    } catch {
      return true;
    }
  });

  // Admin Check
  const isAdmin = user?.email?.toLowerCase() === 'bethelincovibetv@gmail.com' || (user as any)?.role === 'admin';

  const markAllAnnouncementsAsRead = () => {
    const allIds = announcements.map(a => a.id);
    setReadAnnouncementIds(allIds);
    localStorage.setItem('vixora_read_announcements', JSON.stringify(allIds));
    setHasUnreadAnnouncements(false);
  };

  const markAnnouncementAsRead = (id: string) => {
    setReadAnnouncementIds(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      localStorage.setItem('vixora_read_announcements', JSON.stringify(updated));
      return updated;
    });
  };

  // New Advert Form State
  const [newAdvertTitle, setNewAdvertTitle] = useState('');
  const [newAdvertMessage, setNewAdvertMessage] = useState('');
  const [newAdvertTag, setNewAdvertTag] = useState('NEW FEATURE');
  const [newAdvertBadge, setNewAdvertBadge] = useState('v3.1 Update');
  const [isPublishingAdvert, setIsPublishingAdvert] = useState(false);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'granted');
    if (perm) {
      alert("🔔 Phone Push Notifications enabled! You will now receive instant push alerts on your phone whenever new feature update adverts are published.");
    } else {
      alert("Notification permission was not granted or blocked by browser.");
    }
  };

  const handlePublishNewFeatureAdvert = async () => {
    if (!isAdmin) {
      setAppError("Publishing feature update announcements is restricted to Admin users only.");
      return;
    }

    if (!newAdvertTitle.trim() || !newAdvertMessage.trim()) {
      setAppError("Please enter both update title and announcement description.");
      return;
    }

    setIsPublishingAdvert(true);
    const newAnn: FeatureAnnouncement = {
      id: 'ann_' + Date.now(),
      title: newAdvertTitle.trim(),
      message: newAdvertMessage.trim(),
      tag: newAdvertTag || 'NEW UPDATE',
      badgeText: newAdvertBadge || 'v3.0 Update',
      createdAt: new Date().toISOString()
    };

    try {
      await syncFirebaseSaveAnnouncement(newAnn);
      setAnnouncements(prev => [newAnn, ...prev]);
      setActiveAdvertPopup(newAnn);
      setHasUnreadAnnouncements(true);
      setShowNewAdvertModal(false);

      // Trigger native phone OS push notification
      await sendLocalPushNotification(
        '🚀 ' + newAnn.title,
        newAnn.message,
        { id: newAnn.id }
      );

      setNewAdvertTitle('');
      setNewAdvertMessage('');
    } catch (err) {
      console.error("Error publishing announcement:", err);
      setAppError("Failed to publish feature update announcement.");
    } finally {
      setIsPublishingAdvert(false);
    }
  };

  // API Update State
  const [newApiKey, setNewApiKey] = useState('');

  // Live Assistant State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  const [callTimer, setCallTimer] = useState(0);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
  
  // Voiceover State
  const [voiceoverText, setVoiceoverText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('Kore'); // Default Vixora Voice (Kore)
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false);
  const [lastVoiceoverAudio, setLastVoiceoverAudio] = useState<string | null>(null);
  const [voiceoverHistory, setVoiceoverHistory] = useState<Array<{ id: string; text: string; audioBase64: string; date: string }>>(() => {
    try {
      const saved = localStorage.getItem('vixora_voiceover_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeVoiceoverId, setActiveVoiceoverId] = useState<string | null>(null);
  const [isVoiceoverPlaying, setIsVoiceoverPlaying] = useState<boolean>(false);
  const [voiceoverAudioRef] = useState<HTMLAudioElement>(() => new Audio());
  const [voiceoverCurrentTime, setVoiceoverCurrentTime] = useState<number>(0);
  const [voiceoverDuration, setVoiceoverDuration] = useState<number>(0);

  // Script Generator State
  const [scriptTopic, setScriptTopic] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // Video Sourcer State
  const [videoScriptInput, setVideoScriptInput] = useState('');
  const [sourcedVideos, setSourcedVideos] = useState<SourcedVideo[]>([]);
  const [isSourcingVideos, setIsSourcingVideos] = useState(false);
  const [videoMode, setVideoMode] = useState<'ordinary' | 'ai_packaged'>('ai_packaged');
  const [videoRatio, setVideoRatio] = useState<'vertical' | 'horizontal' | 'square'>('vertical');
  const [selectedNicheFilter, setSelectedNicheFilter] = useState<string>('all');

  // Created Video Gallery History State
  const [createdVideos, setCreatedVideos] = useState<CreatedVideo[]>(() => {
    try {
      const saved = localStorage.getItem('ggd_created_videos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Autopilot Orchestration & Video Creation States
  const [isAutopilotRunning, setIsAutopilotRunning] = useState(false);
  const [autopilotStep, setAutopilotStep] = useState<number>(0);
  const [autopilotLog, setAutopilotLog] = useState<string>('');
  const [autopilotProgress, setAutopilotProgress] = useState<number>(0);
  const [autopilotProgressMsg, setAutopilotProgressMsg] = useState<string>('');
  const [targetVideoDuration, setTargetVideoDuration] = useState<string>('30s');
  const [useWebSearchForVideo, setUseWebSearchForVideo] = useState<boolean>(true);

  // Vixora AI Learned Skills Memory State
  const [userSkills, setUserSkills] = useState<LearnedSkill[]>(() => {
    try {
      const saved = localStorage.getItem('vixora_user_skills');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'sk_1', name: '9:16 Shorts & Reels Aspect Ratio', description: 'Default vertical portrait format for viral TikTok & Instagram Reels.', category: 'format', createdAt: 'Initial' },
      { id: 'sk_2', name: 'Real-Time Google Web Trends Integration', description: 'Automatically search live web news and viral trends before drafting video scripts.', category: 'style', createdAt: 'Initial' },
      { id: 'sk_3', name: 'Kore Neural Female Accent Narration', description: 'Smooth, energetic female narrator accent with zero filler words.', category: 'voice', createdAt: 'Initial' },
      { id: 'sk_4', name: 'CapCut-style Subtitle Sync & Emojis', description: 'Dynamic active word highlighting with contextual semantic emojis.', category: 'style', createdAt: 'Initial' },
    ];
  });
  const [showLearnedSkillsModal, setShowLearnedSkillsModal] = useState<boolean>(false);
  const [newSkillName, setNewSkillName] = useState<string>('');
  const [newSkillDesc, setNewSkillDesc] = useState<string>('');

  const saveCustomLearnedSkill = (name: string, description: string, preferenceData?: string, category: 'format' | 'voice' | 'style' | 'custom' = 'custom') => {
    const newSkill: LearnedSkill = {
      id: `sk_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      preferenceData,
      category,
      createdAt: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    setUserSkills(prev => {
      const updated = [newSkill, ...prev];
      localStorage.setItem('vixora_user_skills', JSON.stringify(updated));
      return updated;
    });
    return newSkill;
  };

  // Global Background Music States
  const [globalMusicUrl, setGlobalMusicUrl] = useState<string>('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
  const [globalMusicVolume, setGlobalMusicVolume] = useState<number>(0.15);
  const [globalExtractedMood, setGlobalExtractedMood] = useState<string>('motivational');
  const [bgMusicSearchQuery, setBgMusicSearchQuery] = useState<string>('');
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [previewAudioRef] = useState<HTMLAudioElement>(() => new Audio());
  const [pexelsMusicTracks, setPexelsMusicTracks] = useState<any[]>([]);
  const [isSearchingPexelsMusic, setIsSearchingPexelsMusic] = useState<boolean>(false);
  const [musicResourceMode, setMusicResourceMode] = useState<'presets' | 'pexels'>('presets');

  // Tools State
  const [activeToolType, setActiveToolType] = useState<'tags' | 'hooks' | 'thumbnails'>('tags');
  const [toolInput, setToolInput] = useState('');
  const [toolOutput, setToolOutput] = useState('');
  const [isToolLoading, setIsToolLoading] = useState(false);
  const [copiedToolOutput, setCopiedToolOutput] = useState(false);

  // Refs
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const frameIntervalRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Helper Ref for Functions (so Live callbacks can access latest states)
  const stateRef = useRef({ activeTab, videoMode, scriptTopic, videoScriptInput, voiceoverText });
  useEffect(() => {
    stateRef.current = { activeTab, videoMode, scriptTopic, videoScriptInput, voiceoverText };
  }, [activeTab, videoMode, scriptTopic, videoScriptInput, voiceoverText]);

  // Voice preview function
  const handlePreviewVoice = async (voiceOption: typeof VOICE_AVATAR_OPTIONS[0]) => {
    const activeApiKey = user?.apiKey || process.env.API_KEY;
    if (!activeApiKey) {
      setAppError("Gemini API Key required to preview voice.");
      return;
    }
    setPreviewingVoiceId(voiceOption.id);
    try {
      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: voiceOption.sampleText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceOption.voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const pcmData = decode(base64Audio);
        const wavHeader = createWavHeader(pcmData.length, 24000, 1, 16);
        const audioFile = new Uint8Array(wavHeader.length + pcmData.length);
        audioFile.set(wavHeader);
        audioFile.set(pcmData, wavHeader.length);

        const blob = new window.Blob([audioFile], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const previewAudio = new Audio(url);
        previewAudio.play();
      }
    } catch (err) {
      console.error("Voice preview failed:", err);
      setAppError("Voice preview error. Please check your API key.");
    } finally {
      setPreviewingVoiceId(null);
    }
  };

  // --- INITIALIZATION ---

  useEffect(() => {
    const savedUser = localStorage.getItem('ggd_creator_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      if (parsed && !parsed.niche) {
        parsed.niche = 'finance';
      }
      setUser(parsed);
      setNewApiKey(parsed.apiKey || '');
      if (parsed.fullName && parsed.apiKey) {
        setWizardStep(3); 
      }
    }
    setLoading(false);

    // Sync remote data from Firestore or fallback
    syncFetchCreatedVideos().then(vids => {
      if (vids && vids.length > 0) setCreatedVideos(vids);
    });
    syncFetchVoiceovers().then(vos => {
      if (vos && vos.length > 0) setVoiceoverHistory(vos);
    });
    syncFirebaseFetchAnnouncements().then(anns => {
      if (anns && anns.length > 0) {
        setAnnouncements(prev => {
          const map = new Map();
          [...anns, ...prev].forEach(a => map.set(a.id, a));
          return Array.from(map.values());
        });
      }
    });

    // Listen to real-time foreground FCM push messages
    setupForegroundMessageListener((payload) => {
      const title = payload.notification?.title || payload.data?.title || 'Vixora Feature Advert Update';
      const body = payload.notification?.body || payload.data?.message || 'Check out our newly updated feature!';
      const incomingAnn: FeatureAnnouncement = {
        id: 'push_' + Date.now(),
        title,
        message: body,
        tag: 'LIVE ADVERT',
        badgeText: 'New Update',
        createdAt: new Date().toISOString()
      };
      setAnnouncements(prev => [incomingAnn, ...prev]);
      setActiveAdvertPopup(incomingAnn);
      setHasUnreadAnnouncements(true);
    });

    // Detect Standalone display mode / pre-installed app execution
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsStandalone(true);
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleOnlineStatus = () => setIsOnline(true);
    const handleOfflineStatus = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOfflineStatus);
    };
  }, []);

  // Voiceover audio player listeners
  useEffect(() => {
    const audio = voiceoverAudioRef;
    const handleTimeUpdate = () => setVoiceoverCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setVoiceoverDuration(audio.duration || 0);
    const handleEnded = () => {
      setIsVoiceoverPlaying(false);
      setVoiceoverCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [voiceoverAudioRef]);

  // Sync state and handle global background music preview playout
  useEffect(() => {
    previewAudioRef.volume = globalMusicVolume;
  }, [globalMusicVolume, previewAudioRef]);

  useEffect(() => {
    return () => {
      previewAudioRef.pause();
      setIsPlayingPreview(false);
    };
  }, [activeTab, previewAudioRef]);

  const updateApiKey = () => {
    if (!user) return;
    const updatedUser = { ...user, apiKey: newApiKey };
    setUser(updatedUser);
    localStorage.setItem('ggd_creator_user', JSON.stringify(updatedUser));
    alert("Gemini API Key saved to Local Storage!");
  };

  const handleFinishOnboarding = async () => {
    if (!wizardData.fullName.trim() || !wizardData.email?.trim()) {
      setAppError("Please enter both your name and email address.");
      return;
    }
    const emailLower = wizardData.email.trim().toLowerCase();
    const newUser = { 
      fullName: wizardData.fullName.trim(), 
      email: emailLower, 
      phone: '', 
      apiKey: process.env.GEMINI_API_KEY || 'AIzaSyCBO1PRv5h9aQAB3rWbLrkwq_Uf_Q_uQCk', 
      niche: 'forex' 
    };
    setUser(newUser);
    localStorage.setItem('ggd_creator_user', JSON.stringify(newUser));
    try {
      await syncFirebaseUserProfile(newUser);
    } catch (err) {
      console.warn("Firebase user sync warning:", err);
    }
    setWizardStep(3);
  };

  // --- DURATION AND SCENE SOURCING HELPERS ---
  const getDurationScriptInstruction = (dur: string) => {
    switch (dur) {
      case '15s':
        return `CRITICAL TARGET DURATION: Exactly 15 Seconds (~30 to 35 spoken words max).
Keep it ultra concise and punchy: 1 line Hook (3s), 2 short facts (9s), 1 line CTA (3s).`;
      case '30s':
        return `CRITICAL TARGET DURATION: Exactly 30 Seconds (~65 to 75 spoken words).
Structure: Instant Hook (5s), 2 core insights (20s), Clear CTA (5s).`;
      case '60s':
      case '1min':
        return `CRITICAL TARGET DURATION: Exactly 1 Minute / 60 Seconds (~130 to 150 spoken words).
Structure: Viral Hook (8s), 3 structured key points with real-world impact (45s), Strong CTA (7s).`;
      case '2min':
        return `CRITICAL TARGET DURATION: Exactly 2 Minutes (~260 to 300 spoken words).
Structure: Story Hook (12s), 4 in-depth insights / steps (95s), Summary & Call to action (13s).`;
      case '3min':
        return `CRITICAL TARGET DURATION: Exactly 3 Minutes (~390 to 450 spoken words).
Structure: Mini-Documentary format. Introduction (20s), 5 detailed educational pillars with examples (140s), Conclusion & CTA (20s).`;
      case '5min':
        return `CRITICAL TARGET DURATION: Exactly 5 Minutes (~650 to 750 spoken words).
Structure: Full Masterclass / In-depth Documentary Script.
1. High-Stakes Hook & Prologue (30s)
2. Chapter 1: The Core Problem & Misconceptions (60s)
3. Chapter 2: Deep Dive Analysis & Principles (90s)
4. Chapter 3: Practical Execution & Case Studies (90s)
5. Conclusion, Final Mindset Shift & Powerful Call To Action (30s)`;
      default:
        return `CRITICAL TARGET DURATION: Exactly 30 Seconds (~65 to 75 spoken words).`;
    }
  };

  const getTargetSceneCount = (dur: string): number => {
    switch (dur) {
      case '15s': return 3;
      case '30s': return 5;
      case '60s':
      case '1min': return 8;
      case '2min': return 12;
      case '3min': return 18;
      case '5min': return 25;
      default: return 5;
    }
  };

  // --- VIDEO SOURCER (FACELESS VIDEO CREATOR) ---

  const handleSourceVideos = async (overrideScript?: string, overrideDuration?: string) => {
    const input = overrideScript || videoScriptInput;
    if (!input.trim()) {
      setAppError("Please enter a script or topic to source videos.");
      return;
    }

    const activeApiKey = user?.apiKey || process.env.API_KEY;
    if (!activeApiKey) {
      setAppError("API Key is missing. Check your Profile.");
      return;
    }

    setIsSourcingVideos(true);
    setAppError(null);
    setSourcedVideos([]);

    try {
      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const currentDuration = overrideDuration || targetVideoDuration || '30s';
      const sceneCount = getTargetSceneCount(currentDuration);

      // Intelligent scene-by-scene keyword extraction matching exact duration and script narrative
      const keywordResponse = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Analyze this video script: "${input}". 
        The target video duration is ${currentDuration}.
        Break the script down into EXACTLY ${sceneCount} sequential scene queries corresponding to what is being spoken in each scene.
        For each scene, provide a highly specific 3-5 word stock video search visual query matching the exact mood and subject matter (e.g. "trader studying forex chart screen", "luxury mansion living room", "young woman smiling at laptop office").
        Return ONLY a JSON array of ${sceneCount} strings.`,
        config: {
          responseMimeType: "application/json"
        }
      });

      // Split script into sentence beats matching target scene count
      const sentenceBeats = input.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 3);
      console.log(`[BEAT_SPLITTING] Input script split into ${sentenceBeats.length} distinct sentence beats:`, sentenceBeats);

      let sceneQueries: string[] = [];
      try {
        const cleanJson = (keywordResponse.text || "[]")
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();
        const json = JSON.parse(cleanJson);
        if (Array.isArray(json) && json.length > 0) {
          sceneQueries = json;
        }
      } catch (jsonErr) {
        console.warn("[!] JSON parse failed for sceneQueries, expanding beat-based search queries:", jsonErr);
      }

      // Ensure every beat gets a distinct search query
      const targetQueryCount = Math.max(sentenceBeats.length, sceneCount);
      for (let b = sceneQueries.length; b < targetQueryCount; b++) {
        const beatSentence = sentenceBeats[b % Math.max(1, sentenceBeats.length)] || input;
        const fallbackWords = beatSentence.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
        const generatedQuery = fallbackWords.slice(0, 4).join(' ') || `scene ${b + 1}`;
        sceneQueries.push(generatedQuery);
      }

      console.log(`[SCENE_QUERIES_GENERATED] ${sceneQueries.length} scene queries ready for stock API fetching:`, sceneQueries);

      const orientationParam = videoRatio === 'vertical' ? 'portrait' : videoRatio === 'horizontal' ? 'landscape' : 'square';
      const usedIds = new Set<number | string>();
      const matchedClips: SourcedVideo[] = [];

      for (let i = 0; i < sceneQueries.length; i++) {
        const query = sceneQueries[i];
        const beatText = sentenceBeats[i] || sentenceBeats[i % Math.max(1, sentenceBeats.length)] || input;
        
        const { clip } = await scoreAndFetchBeatVisual(
          beatText,
          query,
          orientationParam,
          PEXELS_API_KEY,
          usedIds,
          i
        );

        matchedClips.push({
          id: typeof clip.id === 'number' ? clip.id : parseInt(String(clip.id).replace(/\D/g, '') || String(1000 + i)),
          url: clip.url,
          image: clip.image,
          duration: clip.duration,
          video_files: clip.video_files,
          title: clip.title,
          mediaType: clip.mediaType,
          matchScore: clip.matchScore,
          searchQuery: query,
          confidence: clip.confidence,
          fallbackUsed: clip.fallbackUsed
        } as any);
      }

      console.log(`[SOURCED_CLIPS_SUMMARY] Successfully sourced ${matchedClips.length} distinct video clips:`, matchedClips.map((c, idx) => ({
        beatIndex: idx + 1,
        id: c.id,
        title: c.title,
        query: c.searchQuery,
        mediaType: c.mediaType,
        url: c.video_files?.[0]?.link || c.image
      })));

      setSourcedVideos(matchedClips);

      if (matchedClips.length === 0) {
        setAppError("No matching visuals found. Try different keywords.");
      }
    } catch (err) {
      console.error("Video sourcing error:", err);
      setAppError("Failed to source videos. Please try again.");
    } finally {
      setIsSourcingVideos(false);
    }
  };

  const downloadAllVideos = () => {
    if (sourcedVideos.length === 0) return;
    sourcedVideos.forEach((video, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        const hdFile = video.video_files.find(f => f.quality === 'hd') || video.video_files[0];
        link.href = hdFile.link;
        link.target = "_blank";
        link.download = `clip_hd_${video.id}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 1000);
    });
    alert("Starting bulk HD package download. Please allow multiple downloads if prompted.");
  };

  const handleSearchPexelsMusic = async (term: string) => {
    if (!term.trim()) return;
    setIsSearchingPexelsMusic(true);
    setMusicResourceMode('pexels');
    try {
      const response = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(term)}&per_page=15`, {
        headers: {
          Authorization: PEXELS_API_KEY
        }
      });
      if (response.ok) {
        const data = await response.json();
        const formatted = (data.videos || []).map((video: any) => {
          const videoFile = video.video_files.find((f: any) => f.quality === 'sd' || f.width < 1000) || video.video_files[0];
          return {
            id: `pexels-${video.id}`,
            name: `${video.user.name} - ${video.width}x${video.height} Loop`,
            url: videoFile ? videoFile.link : '',
            mood: term,
            description: `Stock video audio track by ${video.user.name}. Duration: ${video.duration}s`,
            duration: video.duration,
            image: video.image
          };
        }).filter((v: any) => v.url !== '');
        setPexelsMusicTracks(formatted);
      } else {
        console.error("[-] Pexels background music search failed response status");
      }
    } catch (err) {
      console.error("[-] Pexels background music search request error:", err);
    } finally {
      setIsSearchingPexelsMusic(false);
    }
  };

  // --- GROWTH TOOLS ---

  const handleToolAction = async (overrideType?: 'tags' | 'hooks' | 'thumbnails', overrideTopic?: string) => {
    const targetType = overrideType || activeToolType;
    const topic = overrideTopic || toolInput;
    if (!topic.trim()) {
      setAppError("Please enter a video topic or keyword first.");
      return;
    }
    const activeApiKey = user?.apiKey || process.env.API_KEY;
    if (!activeApiKey) {
      setAppError("API key is required to generate growth analytics.");
      return;
    }

    setIsToolLoading(true);
    setToolOutput('');
    setCopiedToolOutput(false);
    try {
      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const prompts = {
        tags: `Generate a comprehensive, comma-separated list of high-ranking, highly searched SEO tags and viral search keywords for a YouTube video about: ${topic}. Return ONLY the tags separated by commas. No asterisks, no bullet points.`,
        hooks: `Provide 5 viral, high-retention opening hooks for a video about: ${topic}. Each hook should grab attention in the first 3 seconds. Format as numbered list 1-5 with short commentary on why it works. No asterisks.`,
        thumbnails: `Provide 3 high-CTR visual thumbnail concepts for a video about: ${topic}. For each concept, describe the Main Visual Background, Color Palette, and Bold Text Overlay (3 words max). Format as numbered list 1-3. No asterisks.`,
      };

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompts[targetType],
      });
      setToolOutput(response.text?.replace(/\*/g, '') || '');
    } catch (err) {
      setAppError("Growth engine failed to generate results. Please try again.");
    } finally {
      setIsToolLoading(false);
    }
  };

  // --- SCRIPT GENERATION ---

  const handleGenerateScript = async (
    overrideTopic?: string, 
    useWebSearch?: boolean,
    overrideDuration?: string
  ) => {
    const topic = overrideTopic || scriptTopic;
    if (!topic.trim()) {
      setAppError("Please enter a topic for the script.");
      return;
    }

    const envApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
    let activeApiKey = user?.apiKey;
    if (!activeApiKey || activeApiKey.includes('AIzaSyCBO1PRv5h9aQAB3rWb')) {
      activeApiKey = envApiKey || activeApiKey;
    }

    if (!activeApiKey) {
      setAppError("API Key is missing. Check your Profile.");
      return;
    }

    setIsGeneratingScript(true);
    setAppError(null);
    setGeneratedScript('');

    try {
      const userNiche = (user as any)?.niche || 'forex';
      const activeNicheConfig = NICHE_OPTIONS.find(n => n.id === userNiche) || NICHE_OPTIONS[0];
      const nicheSuffix = activeNicheConfig.promptSuffix;
      const userNameGreeting = user?.fullName ? `Personalize and tailor this video script for content creator "${user.fullName}".` : '';
      const targetDur = overrideDuration || targetVideoDuration || '30s';
      const durationGuideline = getDurationScriptInstruction(targetDur);

      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      
      const promptText = `Write a professional, viral-optimized YouTube script for a FACELESS channel about "${topic}". 
      
      ${userNameGreeting}

      NICHE VOICE GUIDELINES:
      - ${nicheSuffix}

      EXACT DURATION SPECIFICATION:
      ${durationGuideline}

      CRITICAL FORMATTING REQUIREMENTS:
      - Go direct to the point. No introductory chit-chat ("Hey guys welcome back...").
      - Strictly do NOT use asterisks (*) or markdown bolding (**). Write purely clean plain text.
      - Maintain standard speaker pacing (~130-150 words per minute) so the speech timing matches the duration requested.
      - Return ONLY the script text ready for narration.`;

      let text = '';

      if (useWebSearch) {
        try {
          const webPrompt = `Search the web for the latest real-time news, viral facts, or fresh trending information regarding "${topic}". Use the Google Search tool to retrieve fresh accurate data.
          
          Then, write a high-retention, viral video script using those fresh web facts for content creator ${user?.fullName || 'Creator'}.
          
          NICHE VOICE GUIDELINES:
          - ${nicheSuffix}

          EXACT DURATION SPECIFICATION:
          ${durationGuideline}

          CRITICAL FORMATTING REQUIREMENTS:
          - Incorporate specific real-time web facts or viral trend data found from your search.
          - Go direct to the point.
          - Strictly do NOT use asterisks (*) or markdown bolding (**). Write purely clean plain text.
          - Maintain standard speaker pacing (~130-150 words per minute) so the speech timing matches the duration requested.
          - Return ONLY the script text ready for narration.`;

          const webResponse = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: webPrompt,
            config: { tools: [{ googleSearch: {} }] }
          });
          text = webResponse.text?.replace(/\*/g, '').trim() || '';
        } catch (webErr) {
          console.warn("Web search grounded script generation warning, falling back to standard AI generation:", webErr);
        }
      }

      // If web search was off or web search grounded call failed, perform standard generation
      if (!text) {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: promptText
        });
        text = response.text?.replace(/\*/g, '').trim() || '';
      }

      // Fallback script synthesis if API response was empty
      if (!text) {
        const cleanTopic = topic.trim().replace(/^['"]|['"]$/g, '');
        if (targetDur === '15s') {
          text = `Did you know this about ${cleanTopic}? Most people get this completely wrong. Here is the secret strategy top performers use every single day to stay ahead. Master this mindset today and double your results.`;
        } else if (targetDur === '60s' || targetDur === '1min') {
          text = `Here is the undeniable truth about ${cleanTopic} that most people ignore. First, beginners fail because they focus on short-term noise instead of long-term fundamentals. Second, real experts master disciplined execution every single day. Third, consistency and strategy will always beat raw luck. Start applying these principles today and take total control of your progress.`;
        } else {
          text = `Stop scrolling if you want to master ${cleanTopic}. The biggest mistake people make is ignoring core execution. Successful creators and traders focus on discipline, strategy, and constant refinement. Start applying this today and transform your results.`;
        }
      }

      setGeneratedScript(text);
      return text;
    } catch (err) {
      console.error("Script generation error:", err);
      // Generate intelligent structured fallback script so Autopilot never breaks
      const cleanTopic = topic.trim().replace(/^['"]|['"]$/g, '');
      const fallbackText = `Stop scrolling if you want to master ${cleanTopic}. The biggest mistake people make is ignoring core execution. Successful creators and traders focus on discipline, strategy, and constant refinement. Start applying this today and transform your results.`;
      setGeneratedScript(fallbackText);
      return fallbackText;
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // --- VOICE OVER GENERATION & PLAYBACK ---

  const formatAudioTime = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const togglePlayVoiceoverItem = (id: string, base64Audio: string) => {
    if (activeVoiceoverId === id && isVoiceoverPlaying) {
      voiceoverAudioRef.pause();
      setIsVoiceoverPlaying(false);
    } else {
      if (activeVoiceoverId !== id) {
        voiceoverAudioRef.pause();
        const pcmData = decode(base64Audio);
        const wavHeader = createWavHeader(pcmData.length, 24000, 1, 16);
        const audioFile = new Uint8Array(wavHeader.length + pcmData.length);
        audioFile.set(wavHeader);
        audioFile.set(pcmData, wavHeader.length);

        const blob = new window.Blob([audioFile], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        voiceoverAudioRef.src = url;
        setActiveVoiceoverId(id);
      }
      voiceoverAudioRef.play().then(() => {
        setIsVoiceoverPlaying(true);
      }).catch((err) => {
        console.error("Voiceover playback error:", err);
      });
    }
  };

  const downloadVoiceoverMp3 = (audioBase64?: string, textSnippet?: string) => {
    const dataToUse = audioBase64 || lastVoiceoverAudio;
    if (!dataToUse) return;
    const pcmData = decode(dataToUse);
    const wavHeader = createWavHeader(pcmData.length, 24000, 1, 16);
    const audioFile = new Uint8Array(wavHeader.length + pcmData.length);
    audioFile.set(wavHeader);
    audioFile.set(pcmData, wavHeader.length);

    const blob = new window.Blob([audioFile], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (textSnippet || 'vixora_voiceover').slice(0, 20).trim().replace(/[^a-z0-9]/gi, '_');
    a.download = `${safeName || 'vixora_voice'}_${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const deleteVoiceoverHistoryItem = (id: string) => {
    if (activeVoiceoverId === id) {
      voiceoverAudioRef.pause();
      setIsVoiceoverPlaying(false);
      setActiveVoiceoverId(null);
    }
    const updated = voiceoverHistory.filter(item => item.id !== id);
    setVoiceoverHistory(updated);
    localStorage.setItem('vixora_voiceover_history', JSON.stringify(updated));
  };

  const handleGenerateVoiceover = async (overrideText?: string) => {
    const text = overrideText || voiceoverText;
    if (!text.trim()) return;
    const activeApiKey = user?.apiKey || process.env.API_KEY;
    if (!activeApiKey) return;

    setIsGeneratingVoiceover(true);
    setAppError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Speak this script with a natural, professional accent. No conversational filler: ${text.replace(/\*/g, '')}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice || 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        setLastVoiceoverAudio(base64Audio);
        const newId = `vo_${Date.now()}`;
        const newEntry = {
          id: newId,
          text: text,
          audioBase64: base64Audio,
          date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        const updatedHistory = [newEntry, ...voiceoverHistory];
        setVoiceoverHistory(updatedHistory);
        syncSaveVoiceover(newEntry);

        // Auto play generated audio using our player
        togglePlayVoiceoverItem(newId, base64Audio);
      }
    } catch (err) {
      setAppError("Voiceover generation failed. Please try again.");
    } finally {
      setIsGeneratingVoiceover(false);
    }
  };

  const handleVideoCompiled = (
    blobUrl: string, 
    orientation: 'vertical' | 'horizontal' | 'square', 
    metadata?: { duration?: string; resolution?: string; format?: string }
  ) => {
    const newVideo: CreatedVideo = {
      id: `vid_${Date.now()}`,
      topic: scriptTopic || videoScriptInput || "Untitled Faceless Video",
      scriptText: videoScriptInput || generatedScript || "",
      videoUrl: blobUrl,
      date: new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      aspectRatio: orientation,
      duration: metadata?.duration || `${targetVideoDuration || '30s'}`,
      resolution: metadata?.resolution || '1080p',
      format: metadata?.format || 'mp4',
    };
    setCreatedVideos(prev => {
      const updated = [newVideo, ...prev.filter(v => v.id !== newVideo.id)];
      syncSaveCreatedVideo(newVideo);
      return updated;
    });
  };

  const handleAutopilotVideoGeneration = async (
    topicToUse: string,
    ratioToUse?: 'vertical' | 'horizontal' | 'square',
    durationToUse?: string,
    webSearch?: boolean
  ) => {
    if (!topicToUse.trim()) {
      setAppError("Please provide an idea or topic for Autopilot.");
      return;
    }
    const envApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
    let activeApiKey = user?.apiKey;
    if (!activeApiKey || activeApiKey.includes('AIzaSyCBO1PRv5h9aQAB3rWb')) {
      activeApiKey = envApiKey || activeApiKey;
    }

    console.log(`[AUTOPILOT_START] activeApiKey resolved: "${activeApiKey ? activeApiKey.slice(0, 8) + '...' : 'EMPTY'}" | Voice: ${selectedVoice || 'Kore'} | Ratio: ${ratioToUse || videoRatio} | Duration: ${durationToUse || targetVideoDuration}`);

    if (!activeApiKey) {
      console.error("[AUTOPILOT_ERROR] No activeApiKey available to launch Autopilot.");
      setAppError("API Credentials are required to launch autopilot.");
      return;
    }

    (window as any).__GEMINI_API_KEY__ = activeApiKey;

    if (ratioToUse) setVideoRatio(ratioToUse);
    if (durationToUse) setTargetVideoDuration(durationToUse);
    const shouldWebSearch = webSearch !== undefined ? webSearch : useWebSearchForVideo;

    setIsAutopilotRunning(true);
    setAutopilotStep(1);
    setAutopilotProgress(5);
    setAutopilotProgressMsg("Initializing Vixora AI Video Production Pipeline...");
    setAutopilotLog(`Configuring ${durationToUse || targetVideoDuration} ${ratioToUse || videoRatio} video layout...`);
    
    setActiveTab('autopilot');

    try {
      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      console.log("[AUTOPILOT_AI_INIT] GoogleGenAI client instance created successfully.");

      // Smooth progress ticker helper
      const setProgressWithMsg = (pct: number, msg: string, log: string, stepNum: number) => {
        setAutopilotProgress(pct);
        setAutopilotProgressMsg(msg);
        setAutopilotLog(log);
        setAutopilotStep(stepNum);
      };

      // --- STEP 1: SCRIPT WITH OPTIONAL WEB SEARCH TRENDS ---
      setProgressWithMsg(
        15,
        shouldWebSearch ? "Searching Google Web Trends for real-time viral data..." : "Drafting viral narrative script structure...",
        `Generating script for ${topicToUse}...`,
        1
      );

      const currentDur = durationToUse || targetVideoDuration || '30s';

      const scriptText = await handleGenerateScript(topicToUse, shouldWebSearch, currentDur);
      if (!scriptText) throw new Error("Could not formulate script.");

      setProgressWithMsg(
        38,
        "Script formulated! Synthesizing AI neural voiceover audio...",
        `Rendering voiceover with ${selectedVoice} narrator accent...`,
        2
      );

      // --- STEP 2: VOICE OVER ---
      setVoiceoverText(scriptText);
      try {
        const voiceResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: `Speak this script with a natural, professional accent. No conversational filler: ${scriptText.replace(/\*/g, '')}` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice || 'Kore' },
              },
            },
          },
        });

        const base64Audio = voiceResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          setLastVoiceoverAudio(base64Audio);
        }
      } catch (voiceErr) {
        console.warn("TTS voiceover generation warning, proceeding with synthesized voice timing:", voiceErr);
      }

      setProgressWithMsg(
        62,
        "Voiceover synthesized! Extracting visual scenes & sourcing HD stock footage...",
        "Querying Pexels HD video library for matching storyboard clips...",
        3
      );

      // --- STEP 3: VIDEOS ---
      setVideoScriptInput(scriptText);
      
      const currentRatio = ratioToUse || videoRatio;
      const targetSceneCount = getTargetSceneCount(currentDur);
      const orientationParam = currentRatio === 'vertical' ? 'portrait' : currentRatio === 'horizontal' ? 'landscape' : 'square';

      const keywordResponse = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Analyze this video script: "${scriptText}". 
        The target video duration is ${currentDur}.
        Break the script down into EXACTLY ${targetSceneCount} sequential scene visual queries corresponding to what is being spoken in each section.
        For each scene, provide a highly specific 3-5 word stock video search visual query matching the exact mood and subject matter (e.g. "trader studying forex chart screen", "luxury mansion living room", "young woman smiling at laptop office").
        Return ONLY a JSON array of ${targetSceneCount} strings.`,
        config: { responseMimeType: "application/json" }
      });

      // Split script into sentence beats matching target scene count
      const sentenceBeats = scriptText.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 3);
      console.log(`[BEAT_SPLITTING] Autopilot script split into ${sentenceBeats.length} distinct sentence beats:`, sentenceBeats);

      let sceneQueries: string[] = [];
      try {
        const cleanJson = (keywordResponse.text || "[]")
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();
        const json = JSON.parse(cleanJson);
        if (Array.isArray(json) && json.length > 0) sceneQueries = json;
      } catch (jsonErr) {
        console.warn("[!] Autopilot JSON parse warning for sceneQueries, expanding beat-based search queries:", jsonErr);
      }

      // Ensure every beat gets a distinct search query
      const targetQueryCount = Math.max(sentenceBeats.length, targetSceneCount);
      for (let b = sceneQueries.length; b < targetQueryCount; b++) {
        const beatSentence = sentenceBeats[b % Math.max(1, sentenceBeats.length)] || scriptText;
        const fallbackWords = beatSentence.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
        const generatedQuery = fallbackWords.slice(0, 4).join(' ') || `scene ${b + 1}`;
        sceneQueries.push(generatedQuery);
      }

      console.log(`[SCENE_QUERIES_GENERATED] ${sceneQueries.length} scene queries ready for stock API fetching:`, sceneQueries);

      const usedIds = new Set<number | string>();
      const matchedClips: SourcedVideo[] = [];

      for (let i = 0; i < sceneQueries.length; i++) {
        const query = sceneQueries[i];
        const beatText = sentenceBeats[i] || sentenceBeats[i % Math.max(1, sentenceBeats.length)] || scriptText;
        
        const { clip } = await scoreAndFetchBeatVisual(
          beatText,
          query,
          orientationParam,
          PEXELS_API_KEY,
          usedIds,
          i
        );

        matchedClips.push({
          id: typeof clip.id === 'number' ? clip.id : parseInt(String(clip.id).replace(/\D/g, '') || String(1000 + i)),
          url: clip.url,
          image: clip.image,
          duration: clip.duration,
          video_files: clip.video_files,
          title: clip.title,
          mediaType: clip.mediaType,
          matchScore: clip.matchScore,
          searchQuery: query,
          confidence: clip.confidence,
          fallbackUsed: clip.fallbackUsed
        } as any);
      }

      console.log(`[SOURCED_CLIPS_SUMMARY] Successfully sourced ${matchedClips.length} distinct video clips for Autopilot:`, matchedClips.map((c, idx) => ({
        beatIndex: idx + 1,
        id: c.id,
        title: c.title,
        query: c.searchQuery,
        mediaType: c.mediaType,
        url: c.video_files?.[0]?.link || c.image
      })));

      setSourcedVideos(matchedClips);

      setProgressWithMsg(
        88,
        "Aligning CapCut-style dynamic subtitles & active word timestamps...",
        "Building multi-track audio-visual preview sequencer...",
        4
      );

      // Short delay for final 100% completion render
      await new Promise(r => setTimeout(r, 600));

      setProgressWithMsg(
        100,
        "🎉 100% Video Production Complete!",
        "Timeline ready! Opening video preview console in Creator Studio...",
        4
      );

      setTimeout(() => {
        setIsAutopilotRunning(false);
      }, 1800);

    } catch (err: any) {
      console.error("Autopilot engine failure:", err);
      setAppError(`Autopilot failed: ${err.message || err}`);
      setIsAutopilotRunning(false);
      setAutopilotProgress(0);
    }
  };


  // --- LIVE SESSION CORE (KORE AI PERSONA + FUNCTION CALLING) ---

  const startLiveAssistant = async () => {
    const activeApiKey = user?.apiKey || process.env.API_KEY;
    if (!activeApiKey) {
      setAppError("Please add your Gemini API Key in the Profile tab first.");
      return;
    }

    try {
      setIsConnecting(true);
      setAppError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
          latency: 0
        }, 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
      }

      const navigateToTabDeclaration: FunctionDeclaration = {
        name: 'navigateToTab',
        parameters: {
          type: Type.OBJECT,
          description: 'Switch between different modules of the app.',
          properties: {
            tab: {
              type: Type.STRING,
              description: 'The name of the tab to open: studio, scripts, videos, voiceover, more, contact, profile.',
              enum: ['studio', 'scripts', 'videos', 'voiceover', 'more', 'contact', 'profile']
            }
          },
          required: ['tab']
        }
      };

      const generateScriptDeclaration: FunctionDeclaration = {
        name: 'generateScript',
        parameters: {
          type: Type.OBJECT,
          description: 'Generates a professional YouTube script based on a topic.',
          properties: {
            topic: { type: Type.STRING, description: 'The topic for the video script.' }
          },
          required: ['topic']
        }
      };

      const sourceVideoDeclaration: FunctionDeclaration = {
        name: 'sourceVideo',
        parameters: {
          type: Type.OBJECT,
          description: 'Finds stock video clips based on a provided script text.',
          properties: {
            script: { type: Type.STRING, description: 'The text script to find matching videos for.' }
          },
          required: ['script']
        }
      };

      const createFullAutopilotVideoDeclaration: FunctionDeclaration = {
        name: 'createFullAutopilotVideo',
        parameters: {
          type: Type.OBJECT,
          description: 'Cooks the video automatically for a topic.',
          properties: {
            topic: { type: Type.STRING, description: 'The topic/theme for the video.' }
          },
          required: ['topic']
        }
      };

      const configureAndCreateAutopilotVideoDeclaration: FunctionDeclaration = {
        name: 'configureAndCreateAutopilotVideo',
        parameters: {
          type: Type.OBJECT,
          description: 'Cooks the video automatically with explicit user preferences for aspect ratio, duration, and search web trends.',
          properties: {
            topic: { type: Type.STRING, description: 'The topic or theme for the video.' },
            aspectRatio: { type: Type.STRING, description: 'The video frame shape: "vertical" (9:16 Shorts/Reels), "horizontal" (16:9 YouTube), or "square" (1:1).', enum: ['vertical', 'horizontal', 'square'] },
            duration: { type: Type.STRING, description: 'The target video duration e.g. "15s", "30s", "60s", or "2min".' },
            useWebSearchTrends: { type: Type.BOOLEAN, description: 'Whether to search live Google web trends for fresh facts before scripting.' }
          },
          required: ['topic']
        }
      };

      const setVideoPreferencesDeclaration: FunctionDeclaration = {
        name: 'setVideoPreferences',
        parameters: {
          type: Type.OBJECT,
          description: 'Updates default video layout settings like aspect ratio and target duration.',
          properties: {
            aspectRatio: { type: Type.STRING, enum: ['vertical', 'horizontal', 'square'], description: 'Desired aspect ratio' },
            duration: { type: Type.STRING, description: 'Desired video length e.g. "15s", "30s", "60s"' }
          }
        }
      };

      const learnUserCustomSkillDeclaration: FunctionDeclaration = {
        name: 'learnUserCustomSkill',
        parameters: {
          type: Type.OBJECT,
          description: 'Saves a new custom skill, workflow preference, or brand rule learned from the user into Vixora AI skill memory.',
          properties: {
            skillName: { type: Type.STRING, description: 'Name of the skill or rule learned, e.g. "Forex 9:16 30s Fast Pace"' },
            skillDescription: { type: Type.STRING, description: 'Detailed explanation of what the user wants for this skill.' },
            preferenceData: { type: Type.STRING, description: 'Additional JSON or key-value preferences.' },
            category: { type: Type.STRING, enum: ['format', 'voice', 'style', 'custom'] }
          },
          required: ['skillName', 'skillDescription']
        }
      };

      const searchWebTrendsDeclaration: FunctionDeclaration = {
        name: 'searchWebTrends',
        parameters: {
          type: Type.OBJECT,
          description: 'Searches live Google web trends for fresh breaking news or facts about a topic.',
          properties: {
            query: { type: Type.STRING, description: 'The search query or topic.' }
          },
          required: ['query']
        }
      };

      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsLiveActive(true);
            setIsConnecting(false);
            setCallTimer(0);
            timerIntervalRef.current = window.setInterval(() => setCallTimer(t => t + 1), 1000);
            
            const mediaSource = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(2048, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);

              // Calculate real-time RMS volume for AI hearing visualizer
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);
              const normalizedLevel = Math.min(100, Math.round(rms * 350));
              setMicVolumeLevel(normalizedLevel);

              const pcmBlob = createGenAIBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            mediaSource.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);

            frameIntervalRef.current = window.setInterval(() => {
              if (videoRef.current && canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                canvasRef.current.width = 320;
                canvasRef.current.height = 240;
                ctx?.drawImage(videoRef.current, 0, 0, 320, 240);
                canvasRef.current.toBlob(async (blob) => {
                  if (blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const base64Data = (reader.result as string).split(',')[1];
                      sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } }));
                    };
                    reader.readAsDataURL(blob);
                  }
                }, 'image/jpeg', 0.5);
              }
            }, 1000);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              setLiveTranscription(prev => (prev + ' ' + message.serverContent!.outputTranscription!.text).slice(-150));
            }

            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                let result = "ok";
                if (fc.name === 'navigateToTab') {
                  const tab = (fc.args as any).tab;
                  setActiveTab(tab);
                  result = `Navigated to ${tab} tab successfully.`;
                } else if (fc.name === 'generateScript') {
                  const topic = (fc.args as any).topic;
                  setScriptTopic(topic);
                  setActiveTab('scripts');
                  handleGenerateScript(topic);
                  result = `Started script generation for ${topic}.`;
                } else if (fc.name === 'sourceVideo') {
                  const scriptText = (fc.args as any).script;
                  setVideoScriptInput(scriptText);
                  setVideoMode('ai_packaged');
                  setActiveTab('videos');
                  handleSourceVideos(scriptText);
                  result = `Started sourcing videos for your script. Check the Creator tab.`;
                } else if (fc.name === 'createFullAutopilotVideo') {
                  const topic = (fc.args as any).topic;
                  handleAutopilotVideoGeneration(topic);
                  result = `I am now running the autopilot engine for "${topic}". Watch the live 3D creation percentage progress on screen!`;
                } else if (fc.name === 'configureAndCreateAutopilotVideo') {
                  const { topic, aspectRatio, duration, useWebSearchTrends } = fc.args as any;
                  handleAutopilotVideoGeneration(
                    topic,
                    aspectRatio || 'vertical',
                    duration || '30s',
                    useWebSearchTrends !== undefined ? useWebSearchTrends : true
                  );
                  result = `Configured video creation: Aspect ratio ${aspectRatio || 'vertical'}, Duration ${duration || '30s'}, Web search trends: ${useWebSearchTrends ? 'Enabled' : 'Disabled'}. I am now generating your video with live percentage progress tracking!`;
                } else if (fc.name === 'setVideoPreferences') {
                  const { aspectRatio, duration } = fc.args as any;
                  if (aspectRatio) setVideoRatio(aspectRatio);
                  if (duration) setTargetVideoDuration(duration);
                  result = `Updated video preferences: Ratio = ${aspectRatio || videoRatio}, Duration = ${duration || targetVideoDuration}.`;
                } else if (fc.name === 'learnUserCustomSkill') {
                  const { skillName, skillDescription, preferenceData, category } = fc.args as any;
                  saveCustomLearnedSkill(skillName, skillDescription, preferenceData, category);
                  result = `Successfully learned and stored new custom skill "${skillName}" into my permanent skill memory! I will apply this rule for future video creations.`;
                } else if (fc.name === 'searchWebTrends') {
                  const query = (fc.args as any).query;
                  try {
                    const resText = await handleGenerateScript(query, true);
                    result = `Search trends for "${query}": ${resText?.slice(0, 300) || 'Found latest trends.'}`;
                  } catch {
                    result = `Searched trends for ${query}.`;
                  }
                }

                sessionPromise.then(s => s.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { result } }
                }));
              }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              audioSourcesRef.current.add(source);
              source.onended = () => audioSourcesRef.current.delete(source);
            }
          },
          onclose: () => stopLiveAssistant(),
          onerror: (e) => stopLiveAssistant(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          tools: [{ googleSearch: {} }, { functionDeclarations: [
            navigateToTabDeclaration,
            generateScriptDeclaration,
            sourceVideoDeclaration,
            createFullAutopilotVideoDeclaration,
            configureAndCreateAutopilotVideoDeclaration,
            setVideoPreferencesDeclaration,
            learnUserCustomSkillDeclaration,
            searchWebTrendsDeclaration
          ] }],
          systemInstruction: `You are 'Vixora', the highly energetic, vibrant, warm, and brilliant Nigerian AI Creator Assistant & Video Producer! Address the user warmly by name (${user?.fullName || 'Creator'}). Your voice and vibe are 100% highly energetic, lively, witty, supportive, creative, and enthusiastic with authentic, warm Nigerian energy (e.g., "No wahala at all!", "Oya let's cook this viral masterpiece!", "I hear you crystal clear!"). Speak dynamically with high energy. No asterisks (*).

          CRITICAL INTERACTIVE VIDEO CREATION FLOW:
          1. When the user asks you to make, create, generate, or cook a video:
             - Ask them how they want the video configured:
               a) Topic / Theme
               b) Aspect Ratio (9:16 Vertical for Shorts/Reels or 16:9 Horizontal for YouTube)
               c) Duration (15s, 30s, 60s, or 2min)
             - Once they specify (or ask you to choose), call 'configureAndCreateAutopilotVideo'.
          2. When the user teaches you a preference, rule, or custom workflow (e.g. "always use vertical 9:16 and 30s duration for my finance videos" or "my channel style is fast-paced"), call 'learnUserCustomSkill' to save it to your skill memory base!
          3. Listen intently to every word the user says. Respond like a passionate, highly energetic Nigerian creative producer on a live call!`,
          outputAudioTranscription: {},
        }
      });

      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      setAppError("Mic/Camera access denied.");
      setIsConnecting(false);
    }
  };

  const stopLiveAssistant = () => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (liveSessionRef.current) try { liveSessionRef.current.close(); } catch(e){}
    setIsLiveActive(false);
    setIsConnecting(false);
    setLiveTranscription('');
    setCallTimer(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return null;

  // --- RENDERING ---

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-white">
      <div className="w-full max-w-sm space-y-8 animate-rise">
        {wizardStep === 0 ? (
          <div className="text-center space-y-10">
            <div className="w-24 h-24 rounded-[2.5rem] mx-auto overflow-hidden shadow-[0_0_60px_rgba(255,102,0,0.4)] rotate-6 border border-white/20 bg-white p-2.5 flex items-center justify-center">
              <img src="https://cilkybiebptqtuhbopyz.supabase.co/storage/v1/object/public/images/default/c51236bd-d2c7-4166-a82e-f347059d7ba8.jpg" alt="Vixora Logo" className="w-full h-full object-contain rounded-3xl" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">VIXORA</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Digital content production engine</p>
            <button onClick={() => setWizardStep(1)} className="w-full py-5 bg-white text-slate-950 font-black uppercase rounded-2xl active:scale-95 transition-all font-black text-xs tracking-wider shadow-2xl">Begin Onboarding</button>
          </div>
        ) : (
          <div className="space-y-6 text-left">
            <div className="space-y-1">
              <h2 className="text-2xl font-black uppercase tracking-tight">Creator Profile Registration</h2>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Enter your details to register and sync with Firebase storage.</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block">Full Name</label>
                <input value={wizardData.fullName} onChange={e => setWizardData({...wizardData, fullName: e.target.value})} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl font-bold outline-none focus:border-ggd-orange text-sm text-white" placeholder="e.g. Bethel Inco" />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1.5 block">Email Address</label>
                <input type="email" value={wizardData.email || ''} onChange={e => setWizardData({...wizardData, email: e.target.value})} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl font-bold outline-none focus:border-ggd-orange text-sm text-white" placeholder="e.g. bethel@example.com" />
              </div>
            </div>

            <button onClick={handleFinishOnboarding} className="btn-3d btn-3d-orange w-full py-5 font-black uppercase rounded-2xl text-xs tracking-wider shadow-xl">Complete Registration & Enter</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`max-w-lg mx-auto min-h-screen relative flex flex-col pb-20 transition-colors duration-300 ${themeMode === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-white'}`}>
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      <div className={`fixed top-0 left-0 h-full w-72 z-[201] transition-all duration-300 transform shadow-2xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${themeMode === 'light' ? 'bg-white text-slate-900 border-r border-slate-200' : 'bg-slate-900 text-white'}`}>
        <div className="p-5 h-full flex flex-col">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/10">
            <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-slate-950 p-1 flex items-center justify-center overflow-hidden shrink-0 border border-ggd-orange/30 shadow-md">
                <img src={vixoraLogo} alt="Vixora Logo" className="w-full h-full object-cover rounded-md" referrerPolicy="no-referrer" />
              </span>
              <span>Vixora <span className="text-ggd-orange">Studio</span></span>
            </h2>
            <button onClick={() => setIsSidebarOpen(false)} className={`w-8 h-8 rounded-full flex items-center justify-center border ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white'}`}><i className="fa-solid fa-xmark text-xs"></i></button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            <button onClick={() => { setActiveTab('coach'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider border transition-all active:scale-95 ${activeTab === 'coach' ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-md' : themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#78350f] border border-amber-300/40">
                <i className="fa-solid fa-cross text-xs"></i>
              </div>
              <span>Sister Vixora Coach</span>
            </button>

            <button onClick={() => { setActiveTab('studio'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider border transition-all active:scale-95 ${activeTab === 'studio' ? 'bg-orange-500/10 border-orange-500/40 text-orange-500 shadow-md' : themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#b33600] border border-orange-300/40">
                <i className="fa-solid fa-microphone-lines text-xs"></i>
              </div>
              <span>Vixora Studio</span>
            </button>

            <button onClick={() => { setActiveTab('autopilot'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider border transition-all active:scale-95 ${activeTab === 'autopilot' ? 'bg-rose-500/10 border-rose-500/40 text-rose-500 shadow-md' : themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#9f1239] border border-rose-300/40">
                <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
              </div>
              <span>AI Autopilot Studio</span>
            </button>

            <button onClick={() => { setActiveTab('scripts'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider border transition-all active:scale-95 ${activeTab === 'scripts' ? 'bg-purple-500/10 border-purple-500/40 text-purple-500 shadow-md' : themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#581c87] border border-purple-300/40">
                <i className="fa-solid fa-scroll text-xs"></i>
              </div>
              <span>YT Scripts Genius</span>
            </button>

            <button onClick={() => { setActiveTab('videos'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider border transition-all active:scale-95 ${activeTab === 'videos' ? 'bg-orange-500/10 border-orange-500/40 text-orange-500 shadow-md' : themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#9a3412] border border-orange-300/40">
                <i className="fa-solid fa-clapperboard text-xs"></i>
              </div>
              <span>Video Creator</span>
            </button>

            <button onClick={() => { setActiveTab('voiceover'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider border transition-all active:scale-95 ${activeTab === 'voiceover' ? 'bg-blue-500/10 border-blue-500/40 text-blue-500 shadow-md' : themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#1e3a8a] border border-blue-300/40">
                <i className="fa-solid fa-waveform-lines text-xs"></i>
              </div>
              <span>Voice Studio</span>
            </button>

            <button onClick={() => { setActiveTab('bgmusic'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider border transition-all active:scale-95 ${activeTab === 'bgmusic' ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-md' : themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#78350f] border border-amber-300/40">
                <i className="fa-solid fa-music text-xs"></i>
              </div>
              <span>Background Music</span>
            </button>

            <button onClick={() => { setActiveTab('more'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider border transition-all active:scale-95 ${activeTab === 'more' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500 shadow-md' : themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#064e3b] border border-emerald-300/40">
                <i className="fa-solid fa-bolt-lightning text-xs"></i>
              </div>
              <span>Growth Tools</span>
            </button>

            <div className={`h-px my-3 ${themeMode === 'light' ? 'bg-slate-200' : 'bg-white/10'}`}></div>

            {/* ACCESSIBILITY & THEME MODE CONTROL BUTTONS IN SIDEBAR */}
            <button 
              onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')} 
              className={`w-full flex items-center justify-between p-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider border transition-all active:scale-95 ${themeMode === 'light' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-slate-800/80 border-slate-700 text-amber-300'}`}
            >
              <span className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#78350f] border border-amber-300/40">
                  <i className={`fa-solid ${themeMode === 'light' ? 'fa-sun' : 'fa-moon'} text-xs`}></i>
                </div>
                <span>{themeMode === 'light' ? 'Light Mode' : 'Normal (Dark)'}</span>
              </span>
              <span className="text-[8px] px-2 py-0.5 rounded-full font-black bg-ggd-orange text-white shadow-sm">
                {themeMode === 'light' ? 'LIGHT' : 'DARK'}
              </span>
            </button>

            <button 
              onClick={() => { setShowAccessibilityModal(true); setIsSidebarOpen(false); }} 
              className={`w-full flex items-center gap-3 p-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider border transition-all active:scale-95 ${themeMode === 'light' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-blue-950/40 border-blue-500/30 text-blue-300'}`}
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#1e3a8a] border border-blue-300/40">
                <i className="fa-solid fa-universal-access text-xs"></i>
              </div>
              <span>Accessibility</span>
            </button>

            <button onClick={() => { setActiveTab('contact'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider border transition-all active:scale-95 ${activeTab === 'contact' ? 'bg-slate-500/20 border-slate-400 text-slate-900' : themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#334155] border border-slate-400/40">
                <i className="fa-solid fa-envelope text-xs"></i>
              </div>
              <span>Contact Us</span>
            </button>

            <button onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider border transition-all active:scale-95 ${activeTab === 'profile' ? 'bg-slate-500/20 border-slate-400 text-slate-900' : themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#581c87] border border-purple-300/40">
                <i className="fa-solid fa-user-gear text-xs"></i>
              </div>
              <span>User Profile</span>
            </button>

            <button onClick={() => { setShowAbout(false); setShowAbout(true); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl font-bold uppercase text-xs tracking-wider border transition-all active:scale-95 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-white/5 border-white/5 text-slate-300'}`}>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#155e75] border border-cyan-300/40">
                <i className="fa-solid fa-circle-info text-xs"></i>
              </div>
              <span>About App</span>
            </button>
          </div>

          <div className={`pt-3 border-t ${themeMode === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-ggd-orange/20 border border-ggd-orange flex items-center justify-center text-xs font-black uppercase text-ggd-orange">{user.fullName[0]}</div>
               <div className="flex-1 overflow-hidden">
                 <p className="text-[10px] font-black truncate">{user.fullName}</p>
                 <p className="text-[8px] text-slate-500 font-bold">Gold Creator</p>
               </div>
             </div>
          </div>
        </div>
      </div>

      {showAbout && (
        <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-rise">
           <div className={`w-full max-w-sm rounded-2xl p-6 border text-center space-y-4 relative shadow-2xl ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'}`}>
              <button onClick={() => setShowAbout(false)} className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center border ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white'}`}><i className="fa-solid fa-xmark"></i></button>
              <div className="w-16 h-16 rounded-2xl mx-auto overflow-hidden shadow-xl border border-ggd-orange/40 bg-slate-950 p-1 flex items-center justify-center">
                 <img src={vixoraLogo} alt="Vixora Logo" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tighter">Vixora <span className="text-ggd-orange">Studio</span></h2>
              <p className={`text-xs ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Modern AI content engine for faceless creators with accessibility support.</p>
              <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em]">Version 2.6.0 Accessible Edition</p>
           </div>
        </div>
      )}

      {/* ACCESSIBILITY & THEME MODAL */}
      {showAccessibilityModal && (
        <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-rise">
          <div className={`w-full max-w-sm rounded-[2.5rem] p-7 border text-left space-y-6 relative shadow-2xl ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'}`}>
            <div className="flex items-center justify-between border-b border-slate-200/20 pb-4">
              <div className="flex items-center gap-2.5">
                <i className="fa-solid fa-universal-access text-xl text-blue-500"></i>
                <h3 className="text-sm font-black uppercase tracking-wider">Accessibility & Mode</h3>
              </div>
              <button onClick={() => setShowAccessibilityModal(false)} className={`w-9 h-9 rounded-full flex items-center justify-center border ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white'}`}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-4">
              {/* DISPLAY MODE TOGGLE */}
              <div className={`p-4 rounded-2xl border space-y-2 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
                <p className="text-[10px] font-black uppercase tracking-wider flex items-center justify-between">
                  <span>Display Theme Mode</span>
                  <span className="text-ggd-orange font-bold">{themeMode === 'light' ? 'Light Mode' : 'Normal (Dark)'}</span>
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button 
                    onClick={() => setThemeMode('dark')}
                    className={`py-3 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 border transition-all ${themeMode === 'dark' ? 'bg-slate-950 border-ggd-orange text-white shadow-md' : 'bg-transparent border-slate-300 text-slate-500'}`}
                  >
                    <i className="fa-solid fa-moon text-amber-300"></i>
                    <span>Normal (Dark)</span>
                  </button>
                  <button 
                    onClick={() => setThemeMode('light')}
                    className={`py-3 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 border transition-all ${themeMode === 'light' ? 'bg-amber-500 border-amber-600 text-white shadow-md' : 'bg-transparent border-slate-300 text-slate-500'}`}
                  >
                    <i className="fa-solid fa-sun text-white"></i>
                    <span>Light Mode</span>
                  </button>
                </div>
              </div>

              {/* HIGH CONTRAST */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-wider">High Contrast</p>
                  <p className="text-[8px] text-slate-400 font-medium">Increases visual distinction for readability</p>
                </div>
                <button 
                  onClick={() => setAccessibilityMode(prev => ({ ...prev, highContrast: !prev.highContrast }))}
                  className={`w-12 h-6 rounded-full p-1 transition-all flex items-center ${accessibilityMode.highContrast ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'}`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm"></div>
                </button>
              </div>

              {/* LARGE TEXT ACCESSIBILITY */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-wider">Large Font Size</p>
                  <p className="text-[8px] text-slate-400 font-medium">Scales text size for clearer viewing</p>
                </div>
                <button 
                  onClick={() => setAccessibilityMode(prev => ({ ...prev, largeText: !prev.largeText }))}
                  className={`w-12 h-6 rounded-full p-1 transition-all flex items-center ${accessibilityMode.largeText ? 'bg-blue-500 justify-end' : 'bg-slate-700 justify-start'}`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm"></div>
                </button>
              </div>
            </div>

            <button 
              onClick={() => setShowAccessibilityModal(false)}
              className="w-full py-3.5 bg-ggd-orange text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg active:scale-95 transition-all text-center"
            >
              Apply Settings
            </button>
          </div>
        </div>
      )}

      {/* APP NAVBAR HEADER */}
      <header className={`px-5 py-4 flex items-center justify-between z-40 backdrop-blur-xl border-b transition-colors duration-300 ${themeMode === 'light' ? 'bg-white/90 border-slate-200 text-slate-900 shadow-sm' : 'bg-slate-950/80 border-white/5 text-white'}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className={`w-10 h-10 rounded-full flex items-center justify-center border active:scale-90 transition-all ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'}`}>
            <i className="fa-solid fa-bars-staggered text-xs"></i>
          </button>
          <h1 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-slate-950 p-0.5 flex items-center justify-center overflow-hidden shrink-0 border border-ggd-orange/30 shadow-md">
              <img src={vixoraLogo} alt="Vixora Logo" className="w-full h-full object-cover rounded-md" referrerPolicy="no-referrer" />
            </span>
            <span>Vixora</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* 3D PWA INSTALL QUICK BUTTON */}
          <button 
            onClick={triggerPwaInstall}
            title="Install Vixora PWA App on Phone"
            className="btn-3d btn-3d-orange h-10 px-3 flex items-center gap-1.5 shadow-lg active:scale-95 transition-all text-white cursor-pointer"
          >
            <i className="fa-solid fa-mobile-screen-button text-xs text-white animate-pulse"></i>
            <span className="text-[9px] font-black uppercase tracking-wider hidden sm:inline">Install</span>
          </button>

          {/* PROMINENT 3D TACTILE BELL BUTTON */}
          <button 
            onClick={() => {
              setShowAnnouncementsDrawer(true);
              setHasUnreadAnnouncements(false);
            }} 
            title="3D Feature Update Announcements & Adverts"
            className="relative btn-3d btn-3d-purple h-11 w-11 sm:w-auto sm:px-3.5 flex items-center justify-center gap-1.5 shadow-xl active:scale-95 transition-all cursor-pointer border-2 border-purple-400/40"
          >
            <i className="fa-solid fa-bell text-base text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-pulse"></i>
            <span className="text-[10px] font-black uppercase tracking-wider text-white hidden sm:inline">Adverts</span>
            {hasUnreadAnnouncements && (
              <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-gradient-to-r from-red-500 to-rose-600 border-2 border-slate-950 rounded-full text-[8px] font-black text-white shadow-lg animate-bounce">
                {announcements.length}
              </span>
            )}
          </button>

          {/* ACCESSIBILITY MODAL QUICK TRIGGER */}
          <button 
            onClick={() => setShowAccessibilityModal(true)} 
            title="Accessibility Options"
            className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-95 ${themeMode === 'light' ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100' : 'bg-blue-950/40 border-blue-500/30 text-blue-400 hover:bg-blue-900/40'}`}
          >
            <i className="fa-solid fa-universal-access text-xs"></i>
          </button>

          {/* LIGHT / DARK MODE TOGGLE */}
          <button 
            onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${themeMode === 'dark' ? 'Light' : 'Normal (Dark)'} Mode`}
            className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-95 ${themeMode === 'light' ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200' : 'bg-white/10 border-white/10 text-amber-300 hover:bg-white/20'}`}
          >
            <i className={`fa-solid ${themeMode === 'dark' ? 'fa-sun text-amber-300' : 'fa-moon text-amber-700'} text-xs`}></i>
          </button>
        </div>
      </header>

      <main className="flex-1 p-3 sm:p-4 overflow-y-auto">
        {appError && (
          <div className="mb-4 p-3 bg-red-600/20 border border-red-500/40 rounded-xl text-red-200 text-[10px] font-bold flex justify-between items-center">
            <span>{appError}</span>
            <button onClick={() => setAppError(null)}><i className="fa-solid fa-xmark"></i></button>
          </div>
        )}

        {activeTab === 'studio' && (
          <div className="animate-rise space-y-4 text-center">
            {!isLiveActive ? (
              <div className={`rounded-2xl p-6 border shadow-xl backdrop-blur-md ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
                 <div className="w-24 h-24 mx-auto mb-4 relative">
                   <div className="w-full h-full rounded-full overflow-hidden border-2 border-ggd-orange shadow-2xl p-1 bg-slate-900">
                     <img 
                       src={vixoraAgentAvatar} 
                       alt="Vixora AI Assistant" 
                       className="w-full h-full object-cover rounded-full" 
                       referrerPolicy="no-referrer"
                     />
                   </div>
                   <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full shadow-md animate-pulse"></span>
                 </div>
                 <h2 className="text-xl font-black uppercase mb-1">Chat with Vixora</h2>
                 <p className="text-[10px] text-ggd-orange font-bold uppercase tracking-widest mb-3">Your AI Studio Partner</p>
                 <p className={`text-xs font-medium mb-6 leading-relaxed max-w-sm mx-auto ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Connect with your AI partner. Vixora can control the app for you—just ask her to generate a script, launch autopilot, or switch tabs!</p>
                 <button disabled={isConnecting} onClick={startLiveAssistant} className="btn-3d btn-3d-orange w-full py-3.5 text-xs tracking-widest shadow-lg">
                   {isConnecting ? 'Warming Up Engine...' : 'Launch AI Session'}
                 </button>
              </div>
            ) : (
              <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-between py-10 px-6">
                {/* Top Badge Indicators */}
                <div className="w-full max-w-xs flex items-center justify-between z-10">
                  <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[8.5px] font-black uppercase rounded-full flex items-center gap-1.5 shadow-md">
                    <i className="fa-solid fa-ear-listen animate-pulse text-xs"></i>
                    <span>AI Hearing HD (16kHz Mic)</span>
                  </span>

                  <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[8.5px] font-black uppercase rounded-full flex items-center gap-1.5 shadow-md">
                    <i className="fa-solid fa-bolt text-xs"></i>
                    <span>Highly Energetic Nigerian Voice</span>
                  </span>
                </div>

                <div className="absolute top-6 right-6 w-20 h-30 bg-black rounded-xl overflow-hidden border-2 border-white/20 shadow-xl z-10">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>

                <div className="flex flex-col items-center gap-4 my-auto">
                   <div 
                     className="w-36 h-36 rounded-full border-4 transition-all duration-100 p-1 relative flex items-center justify-center"
                     style={{
                       borderColor: micVolumeLevel > 15 ? '#10b981' : '#f97316',
                       boxShadow: `0 0 ${15 + micVolumeLevel * 0.6}px ${micVolumeLevel > 15 ? 'rgba(16,185,129,0.8)' : 'rgba(249,115,22,0.5)'}`
                     }}
                   >
                     <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 shadow-2xl">
                       <img 
                        src={vixoraAgentAvatar} 
                        alt="Vixora" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                       />
                     </div>
                   </div>

                   <div className="text-center space-y-1">
                     <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Vixora AI</h2>
                     <p className="text-emerald-400 text-xs font-black uppercase tracking-widest">{formatTime(callTimer)}</p>
                   </div>

                   {/* REAL-TIME MICROPHONE HEARING VISUALIZER BARS */}
                   <div className="flex items-end justify-center gap-1.5 h-8 pt-2">
                      {[0.4, 0.8, 1.2, 1.0, 0.7, 1.4, 0.9, 0.5].map((factor, idx) => {
                        const barHeight = Math.max(6, Math.min(32, Math.round(micVolumeLevel * factor)));
                        return (
                          <div 
                            key={idx}
                            className="w-1.5 rounded-full transition-all duration-75 bg-gradient-to-t from-emerald-500 to-teal-300 shadow-sm"
                            style={{ height: `${barHeight}px` }}
                          />
                        );
                      })}
                   </div>
                   <p className="text-[8px] font-black uppercase tracking-widest text-emerald-400">
                     {micVolumeLevel > 10 ? '⚡ Live Voice Audio Detected' : 'Listening for your voice...'}
                   </p>
                </div>

                <div className="w-full max-w-xs p-4 bg-white/5 border border-white/10 rounded-2xl min-h-[80px] flex items-center justify-center text-center">
                   <p className="text-white/80 text-[10.5px] font-medium leading-relaxed">
                     {liveTranscription || "I'm listening crystal clear! Speak to me anytime, wetin dey happen?..."}
                   </p>
                </div>

                <button onClick={stopLiveAssistant} className="w-16 h-16 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all border-2 border-red-400/30">
                  <i className="fa-solid fa-phone-slash text-white text-xl"></i>
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'coach' && (
          <div className="animate-rise space-y-4">
            <VixoraContentMaster 
              themeMode={themeMode}
              onGenerateScriptForStudio={(scriptHook, topicTitle) => {
                setScriptTopic(topicTitle || scriptHook);
                setVideoScriptInput(scriptHook);
                setActiveTab('videos');
              }}
              onCookAutopilotVideo={(topic, platform) => {
                setScriptTopic(topic);
                handleAutopilotVideoGeneration(topic);
              }}
              onUseTemplateInStudio={(tpl) => {
                if (tpl.targetDuration) setTargetVideoDuration(tpl.targetDuration);
                if (tpl.aspectRatio) setVideoRatio(tpl.aspectRatio);
                if (tpl.topic) setScriptTopic(tpl.topic);
                setActiveTab('videos');
              }}
            />
          </div>
        )}

        {activeTab === 'autopilot' && (
          <div className="animate-rise space-y-4">
            {/* AUTOPILOT HEADER */}
            <div className={`p-5 rounded-2xl border text-center relative overflow-hidden shadow-xl ${themeMode === 'light' ? 'bg-gradient-to-br from-rose-500/10 via-amber-500/10 to-white border-rose-200' : 'bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 border-rose-500/20'}`}>
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 mx-auto flex items-center justify-center text-rose-500 text-xl mb-2 shadow-md">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
              </div>
              <h2 className="text-lg font-black uppercase tracking-tight">Vixora AI Autopilot Studio</h2>
              <p className={`text-[11px] mt-1 font-medium max-w-xs mx-auto ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                1-Click AI Video Creation. Script writing, voiceover speech, stock HD videos & timeline rendering handled automatically!
              </p>
            </div>

            {/* TOPIC SELECTION & UNIFIED STRAIGHT-LINE TOOLBAR */}
            <div className={`p-5 rounded-2xl border space-y-4 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                  <i className="fa-solid fa-bolt"></i> Enter Video Topic or Choose Preset
                </label>
                <span className="text-[8px] font-black uppercase text-slate-400">1-Click Automated Generator</span>
              </div>
              
              {/* QUICK PRESET INSPIRATION TAGS */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[
                  "5 Money Rules for Wealth",
                  "Naija Tech Startup Hacks",
                  "Mindset Shift for 2026",
                  "Ancient African History",
                  "Daily Stoic Advice"
                ].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setScriptTopic(preset)}
                    className={`px-2.5 py-1 rounded-full text-[8.5px] font-bold transition-all active:scale-95 ${scriptTopic === preset ? 'bg-rose-500 text-white shadow-md' : themeMode === 'light' ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                  >
                    ⚡ {preset}
                  </button>
                ))}
              </div>

              {/* 3D TACTILE TOPIC INPUT FIELD */}
              <div className={`p-1.5 rounded-2xl border-2 transition-all shadow-[inset_0_2px_5px_rgba(0,0,0,0.5),0_4px_12px_rgba(244,63,94,0.25)] flex items-center gap-2 ${themeMode === 'light' ? 'bg-gradient-to-b from-white to-slate-100 border-rose-400' : 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-rose-500/60'}`}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-rose-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#9f1239] border border-rose-300/40">
                  <i className="fa-solid fa-wand-magic-sparkles text-sm animate-pulse"></i>
                </div>
                <input 
                  value={scriptTopic} 
                  onChange={e => setScriptTopic(e.target.value)}
                  className={`w-full bg-transparent p-2 text-xs sm:text-sm font-black outline-none ${themeMode === 'light' ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-400'}`} 
                  placeholder="Enter custom video topic e.g. 3 secrets of successful entrepreneurs..." 
                />
                {scriptTopic && (
                  <button 
                    onClick={() => setScriptTopic('')}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white shrink-0"
                    title="Clear topic"
                  >
                    <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
                )}
              </div>

              {/* RESPONSIVE PRODUCTION OPTIONS TOOLBAR */}
              <div className="pt-2 text-left border-t border-white/10">
                <p className="text-[9.5px] font-black uppercase text-slate-400 mb-2.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-sliders text-rose-500"></i> Configure Production Options
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {/* TOOL 1: ASPECT RATIO */}
                  <div className={`p-3 rounded-2xl border flex flex-col justify-between gap-1.5 ${
                    themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-white/10'
                  }`}>
                    <span className="text-[9px] font-black uppercase text-rose-400 flex items-center gap-1">
                      <i className="fa-solid fa-mobile-screen"></i> Video Aspect Ratio
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      <button 
                        type="button"
                        onClick={() => setVideoRatio('vertical')}
                        className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1 border transition-all min-h-[38px] ${videoRatio === 'vertical' ? 'bg-rose-500 text-white border-rose-400 shadow-md' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                      >
                        <i className="fa-solid fa-mobile-screen text-[10px]"></i> 9:16
                      </button>
                      <button 
                        type="button"
                        onClick={() => setVideoRatio('horizontal')}
                        className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1 border transition-all min-h-[38px] ${videoRatio === 'horizontal' ? 'bg-rose-500 text-white border-rose-400 shadow-md' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                      >
                        <i className="fa-solid fa-display text-[10px]"></i> 16:9
                      </button>
                      <button 
                        type="button"
                        onClick={() => setVideoRatio('square')}
                        className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1 border transition-all min-h-[38px] ${videoRatio === 'square' ? 'bg-rose-500 text-white border-rose-400 shadow-md' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                      >
                        <i className="fa-solid fa-square text-[8px]"></i> 1:1
                      </button>
                    </div>
                  </div>

                  {/* TOOL 2: TARGET DURATION */}
                  <div className={`p-3 rounded-2xl border flex flex-col justify-between gap-1.5 ${
                    themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-white/10'
                  }`}>
                    <span className="text-[9px] font-black uppercase text-amber-400 flex items-center gap-1">
                      <i className="fa-solid fa-clock"></i> Target Duration
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {['15s', '30s', '1min', '2min', '3min', '5min'].map((dur) => (
                        <button 
                          key={dur}
                          type="button"
                          onClick={() => setTargetVideoDuration(dur)}
                          className={`flex-1 min-w-[36px] py-1.5 px-2 rounded-xl text-[8.5px] font-black uppercase border transition-all text-center min-h-[36px] ${targetVideoDuration === dur ? 'bg-amber-500 text-white border-amber-400 shadow-md' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                        >
                          {dur}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* TOOL 3: VOICE AVATAR SELECTOR */}
                  <div className={`p-3 rounded-2xl border flex flex-col justify-between gap-1.5 ${
                    themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-white/10'
                  }`}>
                    <span className="text-[9px] font-black uppercase text-purple-400 flex items-center gap-1">
                      <i className="fa-solid fa-microphone"></i> Voiceover Accent
                    </span>
                    <select
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      className={`w-full border text-[9.5px] font-black uppercase py-2 px-3 rounded-xl outline-none cursor-pointer transition-all min-h-[40px] ${
                        themeMode === 'light'
                          ? 'bg-white border-slate-300 text-slate-900 hover:border-rose-400'
                          : 'bg-slate-900 border-white/20 text-white hover:border-rose-400'
                      }`}
                    >
                      {VOICE_AVATAR_OPTIONS.map((v) => (
                        <option key={v.id} value={v.voiceName}>
                          {v.flag} {v.name} ({v.accent} - {v.gender})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* TOOL 4: VIDEO NICHE CATEGORY */}
                  <div className={`p-3 rounded-2xl border flex flex-col justify-between gap-1.5 ${
                    themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-white/10'
                  }`}>
                    <span className="text-[9px] font-black uppercase text-emerald-400 flex items-center gap-1">
                      <i className="fa-solid fa-film"></i> Footage Niche
                    </span>
                    <select
                      value={selectedNicheFilter}
                      onChange={(e) => setSelectedNicheFilter(e.target.value)}
                      className={`w-full border text-[9.5px] font-black uppercase py-2 px-3 rounded-xl outline-none cursor-pointer transition-all min-h-[40px] ${
                        themeMode === 'light'
                          ? 'bg-white border-slate-300 text-slate-900 hover:border-rose-400'
                          : 'bg-slate-900 border-white/20 text-white hover:border-rose-400'
                      }`}
                    >
                      <option value="all">🌟 All Niches</option>
                      {NICHE_OPTIONS.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* TOOL 5: GOOGLE WEB TRENDS */}
                  <div className={`p-3 rounded-2xl border flex flex-col justify-between gap-1.5 sm:col-span-2 lg:col-span-2 ${
                    themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-white/10'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-cyan-400 flex items-center gap-1">
                        <i className="fa-solid fa-globe"></i> Google Web Trends Research
                      </span>
                      <span className={`px-2 py-0.5 text-[8px] font-black rounded uppercase ${useWebSearchForVideo ? 'bg-cyan-400 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
                        {useWebSearchForVideo ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseWebSearchForVideo(!useWebSearchForVideo)}
                      className={`w-full py-2 px-3 rounded-xl border text-[9.5px] font-black uppercase flex items-center justify-center gap-2 transition-all min-h-[40px] ${
                        useWebSearchForVideo 
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md' 
                          : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <i className="fa-solid fa-globe text-xs"></i>
                      <span>{useWebSearchForVideo ? 'Web Trends Search Enabled (Fetches Real-Time Data)' : 'Enable Real-Time Google Web Search'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* LAUNCH BUTTON */}
              <button 
                disabled={isAutopilotRunning} 
                onClick={() => handleAutopilotVideoGeneration(scriptTopic)} 
                className="btn-3d btn-3d-orange w-full py-4 text-xs font-black uppercase tracking-wider shadow-2xl mt-2 flex items-center justify-center gap-2"
              >
                {isAutopilotRunning ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin text-sm"></i>
                    <span>Cooking Video ({autopilotProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-rocket text-sm animate-bounce"></i>
                    <span>✨ Cook {targetVideoDuration} {videoRatio === 'vertical' ? '9:16 Short' : videoRatio === 'horizontal' ? '16:9 Video' : '1:1 Square'} Video (1-Click Autopilot)</span>
                  </>
                )}
              </button>
            </div>

            {/* LIVE 3D TACTILE CREATION PERCENTAGE PROGRESS ANIMATION CARD */}
            {isAutopilotRunning && (
              <div className="bg-gradient-to-br from-slate-950 via-rose-950/80 to-slate-950 border-2 border-rose-500/60 rounded-3xl p-6 text-center space-y-5 shadow-2xl animate-rise relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/15 rounded-full blur-3xl pointer-events-none"></div>

                {/* 3D GLOWING PERCENTAGE BADGE */}
                <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-rose-500 via-purple-500 to-amber-500 animate-spin blur-md opacity-70"></div>
                  <div className="relative w-24 h-24 rounded-full bg-slate-950 border-4 border-rose-400/80 flex flex-col items-center justify-center shadow-2xl">
                    <span className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-300 to-amber-300 drop-shadow-md">
                      {autopilotProgress}%
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-rose-400">COOKING</span>
                  </div>
                </div>

                {/* ANIMATED PROGRESS BAR */}
                <div className="space-y-1.5 max-w-md mx-auto">
                  <div className="w-full h-3.5 bg-black/60 rounded-full border border-white/10 p-0.5 overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-rose-500 via-purple-500 to-cyan-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(244,63,94,0.8)]"
                      style={{ width: `${Math.max(5, autopilotProgress)}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] font-black text-rose-300 tracking-wider uppercase animate-pulse">
                    {autopilotProgressMsg || "Cooking video assets..."}
                  </p>
                </div>

                {/* 4-STAGE BADGE WORKFLOW INDICATORS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[8.5px] font-black uppercase max-w-lg mx-auto pt-1">
                  <div className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all ${autopilotProgress >= 15 ? 'bg-rose-500 text-white border-rose-400 shadow-md' : 'bg-slate-900 border-white/10 text-slate-500'}`}>
                    <i className={`fa-solid ${autopilotProgress >= 15 ? 'fa-check-circle' : 'fa-circle-notch animate-spin'}`}></i>
                    <span>1. Config & Web</span>
                  </div>
                  <div className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all ${autopilotProgress >= 38 ? 'bg-rose-500 text-white border-rose-400 shadow-md' : 'bg-slate-900 border-white/10 text-slate-500'}`}>
                    <i className={`fa-solid ${autopilotProgress >= 38 ? 'fa-check-circle' : 'fa-circle-notch animate-spin'}`}></i>
                    <span>2. AI Script</span>
                  </div>
                  <div className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all ${autopilotProgress >= 62 ? 'bg-rose-500 text-white border-rose-400 shadow-md' : 'bg-slate-900 border-white/10 text-slate-500'}`}>
                    <i className={`fa-solid ${autopilotProgress >= 62 ? 'fa-check-circle' : 'fa-circle-notch animate-spin'}`}></i>
                    <span>3. Voice & Clips</span>
                  </div>
                  <div className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all ${autopilotProgress >= 88 ? 'bg-rose-500 text-white border-rose-400 shadow-md' : 'bg-slate-900 border-white/10 text-slate-500'}`}>
                    <i className={`fa-solid ${autopilotProgress >= 100 ? 'fa-check-circle' : 'fa-circle-notch animate-spin'}`}></i>
                    <span>4. Subtitle Sync</span>
                  </div>
                </div>
              </div>
            )}


            {/* SEQUENCER & PREVIEW ON AUTOPILOT PAGE */}
            {sourcedVideos.length > 0 && (
              <div className={`p-4 rounded-2xl border space-y-3 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-500"></i>
                    <h3 className="text-xs font-black uppercase tracking-wider">Autopilot Video Ready</h3>
                  </div>
                  <button 
                    onClick={() => setActiveTab('videos')} 
                    className="text-[9px] font-black uppercase text-rose-500 underline"
                  >
                    Open Manual Studio →
                  </button>
                </div>

                <VideoSequencer 
                  scriptText={scriptTopic || generatedScript || "Autopilot Video"} 
                  voiceoverBase64={lastVoiceoverAudio} 
                  sourcedVideos={sourcedVideos} 
                  onVideoCompiled={handleVideoCompiled}
                  aspectRatio={videoRatio}
                  onAspectRatioChange={(ratio) => setVideoRatio(ratio)}
                  selectedMusicUrl={globalMusicUrl}
                  onSelectedMusicUrlChange={setGlobalMusicUrl}
                  musicVolume={globalMusicVolume}
                  onMusicVolumeChange={setGlobalMusicVolume}
                  onMoodDetected={setGlobalExtractedMood}
                  themeMode={themeMode}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'scripts' && (
          <div className="animate-rise space-y-4">
             <div className={`rounded-3xl p-5 sm:p-6 border space-y-4 shadow-2xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-white/10'}`}>
                <div className="flex items-center justify-between border-b pb-3 border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3.5px_0_#581c87]">
                      <i className="fa-solid fa-scroll text-sm"></i>
                    </div>
                    <div className="text-left">
                      <h2 className="text-base font-black uppercase tracking-tight">Faceless Script Genius</h2>
                      <p className="text-[10px] text-slate-400 font-medium">AI YouTube & TikTok viral script writer for {user?.fullName || 'Creators'}</p>
                    </div>
                  </div>
                </div>

                {/* 3D TACTILE TOPIC INPUT FIELD */}
                <div className={`p-1.5 rounded-2xl border-2 transition-all shadow-[inset_0_2px_5px_rgba(0,0,0,0.5),0_4px_12px_rgba(168,85,247,0.25)] flex items-center gap-2 ${themeMode === 'light' ? 'bg-gradient-to-b from-white to-slate-100 border-purple-400' : 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-purple-500/60'}`}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#581c87] border border-purple-300/40">
                    <i className="fa-solid fa-wand-magic-sparkles text-sm animate-pulse"></i>
                  </div>
                  <input 
                    value={scriptTopic} 
                    onChange={e => setScriptTopic(e.target.value)} 
                    className={`w-full bg-transparent p-2 text-xs sm:text-sm font-black outline-none ${themeMode === 'light' ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-400'}`} 
                    placeholder="Enter video topic e.g. 5 mindset secrets of successful entrepreneurs..." 
                  />
                  {scriptTopic && (
                    <button 
                      onClick={() => setScriptTopic('')}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white shrink-0"
                      title="Clear topic"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                  )}
                </div>

                {/* SCRIPT ACTION BUTTONS (STANDARD VS WEB SEARCH TRENDS) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button 
                    disabled={isGeneratingScript} 
                    onClick={() => handleGenerateScript(scriptTopic, false)} 
                    className="btn-3d btn-3d-orange w-full py-3.5 text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
                  >
                    {isGeneratingScript ? (
                      <>
                        <i className="fa-solid fa-spinner animate-spin"></i>
                        <span>Drafting Script...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-pen-nib"></i>
                        <span>Standard AI Script</span>
                      </>
                    )}
                  </button>

                  <button 
                    disabled={isGeneratingScript} 
                    onClick={() => handleGenerateScript(scriptTopic, true)} 
                    className="btn-3d btn-3d-purple w-full py-3.5 text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 border-2 border-purple-300/30"
                  >
                    {isGeneratingScript ? (
                      <>
                        <i className="fa-solid fa-spinner animate-spin"></i>
                        <span>Searching Web & Drafting...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-globe text-cyan-300 animate-pulse"></i>
                        <span>🌐 Web Trends Script</span>
                      </>
                    )}
                  </button>
                </div>

                {/* GENERATED SCRIPT OUTPUT DISPLAY */}
                {generatedScript && (
                  <div className="space-y-3 animate-rise pt-3 border-t border-white/10">
                     <div className={`p-4 border rounded-2xl max-h-96 overflow-y-auto relative text-left shadow-inner ${themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-black/50 border-white/10 text-white/90'}`}>
                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10">
                          <span className="text-[9px] font-black uppercase tracking-wider text-purple-400">Generated Script Draft</span>
                          <button onClick={() => { navigator.clipboard.writeText(generatedScript); alert('Script Copied to Clipboard!'); }} className="text-xs font-bold uppercase text-purple-400 hover:text-white flex items-center gap-1">
                            <i className="fa-solid fa-copy"></i> Copy Text
                          </button>
                        </div>
                        <pre className="text-[11px] whitespace-pre-wrap font-sans leading-relaxed">{generatedScript}</pre>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => { setVoiceoverText(generatedScript); setActiveTab('voiceover'); }} className="py-3 bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 border border-blue-500/30 rounded-xl text-[9px] font-black uppercase transition-all shadow-md">Transfer to Voice Studio →</button>
                        <button onClick={() => { setVideoScriptInput(generatedScript); setActiveTab('videos'); }} className="py-3 bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 border border-orange-500/30 rounded-xl text-[9px] font-black uppercase transition-all shadow-md">Transfer to Creator Studio →</button>
                     </div>
                  </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="animate-rise space-y-4">
            {/* TOP BAR PROJECT CONTROLS */}
            <div className={`p-5 border rounded-3xl space-y-4 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="text-left">
                  <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    <i className="fa-solid fa-cube text-ggd-orange"></i> Video Ratio & Niche Sourcing
                  </h3>
                  <p className={`text-[10px] font-bold uppercase ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Configure output shape and template topic recommendations</p>
                </div>
                <div className={`flex items-center gap-1 p-1 rounded-xl border shadow-inner shrink-0 w-full sm:w-auto justify-between sm:justify-start ${themeMode === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/5'}`}>
                  <button 
                    onClick={() => setVideoRatio('vertical')} 
                    className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg flex items-center gap-1 transition-all ${videoRatio === 'vertical' ? 'bg-ggd-orange text-white' : themeMode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
                  >
                    <i className="fa-solid fa-mobile-screen-button"></i>
                    <span>9:16 Vertical</span>
                  </button>
                  <button 
                    onClick={() => setVideoRatio('horizontal')} 
                    className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg flex items-center gap-1 transition-all ${videoRatio === 'horizontal' ? 'bg-ggd-orange text-white' : themeMode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
                  >
                    <i className="fa-solid fa-desktop"></i>
                    <span>16:9 Landscape</span>
                  </button>
                  <button 
                    onClick={() => setVideoRatio('square')} 
                    className={`px-3 py-1.5 text-xs font-black uppercase rounded-lg flex items-center gap-1 transition-all ${videoRatio === 'square' ? 'bg-ggd-orange text-white' : themeMode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
                  >
                    <i className="fa-solid fa-square text-[9px]"></i>
                    <span>1:1 Square</span>
                  </button>
                </div>
              </div>

              {/* PREVIOUSLY: Niche Search Filter Cards with Images */}
              <div className={`pt-3 border-t space-y-3 ${themeMode === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
                <div className="flex items-center justify-between">
                  <p className={`text-[10px] font-black uppercase tracking-widest text-left ${themeMode === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                    <i className="fa-solid fa-photo-film text-ggd-orange mr-1"></i> Video Niche Categories
                  </p>
                  <span className="text-[8px] font-black uppercase text-slate-400">Select niche to filter HD footage</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div
                    onClick={() => setSelectedNicheFilter('all')}
                    className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden relative min-h-[72px] ${
                      selectedNicheFilter === 'all'
                        ? 'bg-ggd-orange border-ggd-orange text-white shadow-md'
                        : themeMode === 'light'
                          ? 'bg-slate-100 border-slate-200 text-slate-800 hover:border-slate-300'
                          : 'bg-black/30 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <i className="fa-solid fa-shapes text-xs"></i>
                      <span className="text-[10px] font-black uppercase truncate">All Niches</span>
                    </div>
                    <span className="text-[8px] font-bold uppercase opacity-80">Universal Footage</span>
                  </div>

                  {NICHE_OPTIONS.map(n => {
                    const isSelected = selectedNicheFilter === n.id;
                    return (
                      <div
                        key={n.id}
                        onClick={() => setSelectedNicheFilter(n.id)}
                        className={`group relative rounded-2xl border transition-all cursor-pointer overflow-hidden min-h-[76px] flex flex-col justify-end p-2.5 ${
                          isSelected
                            ? 'ring-2 ring-ggd-orange border-ggd-orange shadow-lg'
                            : 'border-white/10 hover:border-ggd-orange/50'
                        }`}
                      >
                        <img
                          src={n.coverImage}
                          alt={n.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent"></div>
                        
                        <div className="relative z-10 space-y-0.5 text-left">
                          <div className="flex items-center gap-1 text-white">
                            <i className={`fa-solid ${n.icon} text-[9px] text-ggd-orange`}></i>
                            <span className="text-[9.5px] font-black uppercase tracking-tight text-white truncate">{n.name}</span>
                          </div>
                          <p className="text-[7.5px] text-slate-300 font-bold truncate">
                            {n.suggestions[0]}
                          </p>
                        </div>

                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-ggd-orange text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-md z-10">
                            ✓
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Suggested Topic Recommendations based on Selected Niche */}
              <div className={`p-3 rounded-2xl border space-y-2 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/5'}`}>
                <p className="text-[10px] font-black text-ggd-orange uppercase tracking-widest flex items-center gap-1.5 text-left">
                  <i className="fa-solid fa-lightbulb"></i> Recommended Niche Starters (Click to generate)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(selectedNicheFilter === 'all' 
                    ? NICHE_OPTIONS[0].suggestions.concat(NICHE_OPTIONS[1].suggestions).slice(0, 3)
                    : NICHE_OPTIONS.find(n => n.id === selectedNicheFilter)?.suggestions || []
                  ).map((suggestion, idx) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        setScriptTopic(suggestion);
                        setVideoScriptInput(suggestion);
                      }}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold uppercase leading-snug transition-all truncate ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-800 hover:border-ggd-orange hover:text-ggd-orange shadow-sm' : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
                    >
                      ⚡ {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* AUTOPILOT MODULE BLOCK */}
            {isAutopilotRunning ? (
              <div className="bg-slate-900 border border-ggd-orange/30 rounded-3xl p-5 space-y-5 text-center animate-pulse">
                <div className="w-16 h-16 bg-ggd-orange/10 border border-ggd-orange/20 rounded-full mx-auto flex items-center justify-center text-ggd-orange text-2xl animate-spin">
                  <i className="fa-solid fa-wand-magic-sparkles animate-pulse"></i>
                </div>
                <div className="space-y-1">
                  <h3 className="text-md font-black uppercase text-white tracking-tight">Vixora Autopilot Active</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Cooking complete faceless video storyboard automatically...</p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-[7px] font-black uppercase text-slate-500 px-2 leading-relaxed">
                    <span className={autopilotStep >= 1 ? 'text-ggd-orange font-bold' : ''}>1. Script Draft</span>
                    <span className={autopilotStep >= 2 ? 'text-blue-400 font-bold' : ''}>2. Speech voice</span>
                    <span className={autopilotStep >= 3 ? 'text-orange-400 font-bold' : ''}>3. HD Sourcing</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className={`h-full transition-all duration-700 rounded-full ${
                        autopilotStep === 1 ? 'w-1/3 bg-ggd-orange' : 
                        autopilotStep === 2 ? 'w-2/3 bg-blue-500' : 
                        'w-full bg-emerald-500'
                      }`} 
                    />
                  </div>
                </div>
                <div className="p-3 bg-slate-950 border border-white/5 rounded-xl text-[9px] text-slate-400 font-mono italic">
                  {autopilotLog}
                </div>
              </div>
            ) : (
              <div 
                onClick={() => setActiveTab('autopilot')}
                className="bg-gradient-to-r from-rose-500/20 via-orange-500/20 to-amber-500/20 border border-rose-500/30 rounded-3xl p-4 flex items-center justify-between cursor-pointer hover:border-rose-500/50 transition-all shadow-xl active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-500 text-lg shrink-0">
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                  </div>
                  <div className="text-left">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-rose-400">Launch AI Autopilot Studio</h4>
                    <p className="text-[8px] text-slate-400 font-bold">Dedicated 1-Click video generator page →</p>
                  </div>
                </div>
                <button className="btn-3d btn-3d-orange px-4 py-2 text-[8px] tracking-wider shrink-0">
                  Open Page
                </button>
              </div>
            )}

            {/* MANUAL CREATOR CONSOLE */}
            <div className={`rounded-2xl p-5 sm:p-6 border space-y-5 shadow-2xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-white/10'}`}>
              <div className="flex items-center justify-between border-b pb-3 dark:border-white/10 border-slate-200">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-ggd-orange/15 border border-ggd-orange/30 flex items-center justify-center text-ggd-orange text-lg shrink-0">
                    <i className="fa-solid fa-clapperboard"></i>
                  </div>
                  <div>
                    <h2 className="text-base font-black uppercase tracking-tight">Manual Creator Studio</h2>
                    <p className="text-xs text-slate-400 font-medium">Build custom video timelines with stock footage & voiceover</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400">Video Script & Storyboard Text</label>
                  {generatedScript && (
                    <button 
                      onClick={() => setVideoScriptInput(generatedScript)} 
                      className="text-xs font-bold uppercase text-ggd-orange hover:underline flex items-center gap-1"
                    >
                      <i className="fa-solid fa-file-import"></i> Paste Generated Script
                    </button>
                  )}
                </div>
                <textarea 
                  value={videoScriptInput} 
                  onChange={e => setVideoScriptInput(e.target.value)} 
                  className={`w-full h-36 border rounded-2xl p-4 text-sm outline-none focus:border-ggd-orange resize-none font-medium leading-relaxed ${themeMode === 'light' ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/10 text-white'}`} 
                  placeholder="Paste your video script here to fetch stock video clips and assemble your timeline..." 
                />
              </div>

              <button 
                disabled={isSourcingVideos || !videoScriptInput.trim()} 
                onClick={() => handleSourceVideos()} 
                className="btn-3d btn-3d-orange w-full py-4 text-sm font-black uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSourcingVideos ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    <span>Sourcing HD Footage & Assembling Package...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-wand-magic-sparkles text-base"></i>
                    <span>Build Video Package</span>
                  </>
                )}
              </button>
              
              {sourcedVideos.length > 0 && (
                <div className="space-y-4 animate-rise pt-3 border-t dark:border-white/10 border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-film text-ggd-orange text-sm"></i>
                      <h3 className="text-xs font-black uppercase tracking-wider">Project Timeline ({sourcedVideos.length} Clips)</h3>
                    </div>
                    <button onClick={downloadAllVideos} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black uppercase flex items-center gap-2 text-white shadow-lg active:scale-95 transition-all">
                      <i className="fa-solid fa-download"></i> Download HD Package
                    </button>
                  </div>

                  <div className="space-y-3">
                    <VideoSequencer 
                      scriptText={videoScriptInput || generatedScript || "Enter script and create voiceover"} 
                      voiceoverBase64={lastVoiceoverAudio} 
                      sourcedVideos={sourcedVideos} 
                      onVideoCompiled={handleVideoCompiled}
                      aspectRatio={videoRatio}
                      onAspectRatioChange={(ratio) => setVideoRatio(ratio)}
                      selectedMusicUrl={globalMusicUrl}
                      onSelectedMusicUrlChange={setGlobalMusicUrl}
                      musicVolume={globalMusicVolume}
                      onMusicVolumeChange={setGlobalMusicVolume}
                      onMoodDetected={setGlobalExtractedMood}
                      themeMode={themeMode}
                    />
                    {!lastVoiceoverAudio && (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-left text-xs text-blue-400 font-medium leading-relaxed flex items-start gap-3">
                        <span className="text-lg shrink-0">💡</span>
                        <span>
                          <strong className="font-bold text-blue-300">Creator Tip:</strong> Generate a voiceover narration in the <strong>Voice overs</strong> tab first. Your voice audio will automatically sync inside this video timeline!
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase text-slate-400">Sourced HD Clips Gallery</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1 scrollbar-hide">
                      {sourcedVideos.map((video, idx) => (
                        <div key={video.id} className="relative rounded-2xl overflow-hidden group bg-slate-800 border border-white/10 shadow-md">
                          <img src={video.image} className="w-full h-24 object-cover opacity-85 group-hover:scale-105 transition-all duration-300" alt="" />
                          <div className="absolute inset-0 flex flex-col justify-end p-2.5 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                            <span className="text-xs font-black text-white uppercase tracking-wider">Clip {idx + 1}</span>
                            <a 
                              href={video.video_files.find(f => f.quality === 'hd')?.link || video.video_files[0].link} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="mt-1.5 w-full py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-center text-xs font-bold uppercase transition-all" 
                              download
                            >
                              Get HD Clip
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CREATED VIDEO HISTORY GALLERY */}
            <div className={`rounded-2xl p-5 sm:p-6 border space-y-4 shadow-2xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-white/10'}`}>
              <div className="flex items-center justify-between border-b pb-3 dark:border-white/10 border-slate-200">
                <div className="flex items-center gap-2.5">
                  <i className="fa-solid fa-clock-rotate-left text-ggd-orange text-sm"></i>
                  <h3 className="text-xs font-black uppercase tracking-wider">Studio Pack History</h3>
                </div>
                <span className="text-xs font-black uppercase text-ggd-orange px-3 py-1 bg-ggd-orange/15 border border-ggd-orange/30 rounded-full">{createdVideos.length} Saved</span>
              </div>

              {createdVideos.length === 0 ? (
                <div className={`p-8 text-center rounded-2xl border ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-black/20 border-white/5'}`}>
                  <p className="text-xs text-slate-500 uppercase font-black tracking-wider leading-relaxed">No compiled studio videos saved yet. Generate or source clips above!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {createdVideos.map((video) => (
                    <div key={video.id} className={`p-4 border rounded-2xl flex flex-col gap-3 transition-all ${themeMode === 'light' ? 'bg-slate-50 border-slate-200 hover:border-ggd-orange/40' : 'bg-white/5 border-white/5 hover:border-ggd-orange/40'}`}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="text-left space-y-1 overflow-hidden">
                          <p className="text-xs font-black uppercase truncate max-w-[220px] sm:max-w-xs">{video.topic}</p>
                          <p className="text-[10px] text-slate-400 font-mono font-bold">{video.date}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 justify-end shrink-0">
                          {video.duration && (
                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              ⏱️ {video.duration}
                            </span>
                          )}
                          {video.resolution && (
                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              {video.resolution}
                            </span>
                          )}
                          {video.format && (
                            <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {video.format.toUpperCase()}
                            </span>
                          )}
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border ${video.aspectRatio === 'vertical' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                            {video.aspectRatio === 'vertical' ? '9:16' : video.aspectRatio === 'square' ? '1:1' : '16:9'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a 
                          href={video.videoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1 py-2.5 bg-ggd-orange text-white text-xs font-black uppercase rounded-xl text-center tracking-wider hover:brightness-110 shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          <i className="fa-solid fa-play"></i>
                          <span>Play Demo Video</span>
                        </a>
                        <button 
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = video.videoUrl;
                            link.download = `vixora_video_${video.id}.mp4`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }} 
                          className="p-2.5 bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white hover:bg-slate-300 rounded-xl text-center text-sm font-bold transition-all"
                          title="Download Video File"
                        >
                          <i className="fa-solid fa-download"></i>
                        </button>
                        <button 
                          onClick={() => {
                            const updated = createdVideos.filter(v => v.id !== video.id);
                            setCreatedVideos(updated);
                            localStorage.setItem('ggd_created_videos', JSON.stringify(updated));
                          }} 
                          className="p-2.5 bg-red-600/10 text-red-500 hover:bg-red-600/20 border border-red-600/20 rounded-xl text-center text-sm font-bold transition-all"
                          title="Delete Video"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'voiceover' && (
          <div className="animate-rise space-y-4">
             {/* VIXORA VOICE PROFILE & GENERATOR */}
             <div className={`rounded-2xl p-5 border space-y-4 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
                
                {/* ACTIVE VOICE SELECTION BANNER */}
                <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3.5 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'}`}>
                  {(() => {
                    const currentVo = VOICE_AVATAR_OPTIONS.find(v => v.voiceName === selectedVoice) || VOICE_AVATAR_OPTIONS[0];
                    return (
                      <div className="flex items-center gap-3.5 text-left">
                        <div className="relative shrink-0">
                          <img 
                            src={currentVo.avatar} 
                            alt={currentVo.name} 
                            className="w-14 h-14 rounded-full object-cover border-2 border-ggd-orange shadow-md"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full shadow-[0_0_8px_#10b981]"></span>
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black uppercase tracking-tight text-ggd-orange">{currentVo.name}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[7.5px] font-black uppercase bg-ggd-orange/15 text-ggd-orange border border-ggd-orange/30">
                              {currentVo.flag} {currentVo.accent}
                            </span>
                          </div>
                          <p className={`text-[9.5px] font-medium leading-tight ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                            {currentVo.description}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* VOICE AVATARS GRID SELECTION WITH PREVIEWS */}
                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-wider text-ggd-orange flex items-center gap-1.5">
                      <i className="fa-solid fa-users"></i> Available Voice Avatars
                    </label>
                    <span className="text-[8px] font-black uppercase text-slate-400">Click avatar to select voice</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {VOICE_AVATAR_OPTIONS.map((v) => {
                      const isSelected = selectedVoice === v.voiceName;
                      const isPreviewingThis = previewingVoiceId === v.id;
                      return (
                        <div
                          key={v.id}
                          onClick={() => setSelectedVoice(v.voiceName)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-ggd-orange/15 border-ggd-orange shadow-md ring-2 ring-ggd-orange/30'
                              : themeMode === 'light'
                                ? 'bg-white border-slate-200 hover:border-ggd-orange/40'
                                : 'bg-black/30 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 mb-2">
                            <img
                              src={v.avatar}
                              alt={v.name}
                              className="w-10 h-10 rounded-full object-cover border border-ggd-orange/30 shrink-0 shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 flex-1">
                              <p className={`text-[10px] font-black uppercase truncate ${isSelected ? 'text-ggd-orange' : themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                                {v.name}
                              </p>
                              <p className={`text-[8px] font-bold uppercase truncate ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                                {v.flag} {v.accent}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-white/5">
                            <span className={`text-[7.5px] font-bold uppercase truncate ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                              {v.gender}
                            </span>
                            <button
                              type="button"
                              disabled={isPreviewingThis}
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreviewVoice(v);
                              }}
                              className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 transition-all shrink-0 ${
                                isPreviewingThis
                                  ? 'bg-ggd-orange text-white animate-pulse'
                                  : 'bg-ggd-orange/10 text-ggd-orange hover:bg-ggd-orange hover:text-white border border-ggd-orange/20'
                              }`}
                              title={`Preview ${v.name}'s voice`}
                            >
                              {isPreviewingThis ? (
                                <i className="fa-solid fa-spinner animate-spin"></i>
                              ) : (
                                <i className="fa-solid fa-play text-[7px]"></i>
                              )}
                              <span>{isPreviewingThis ? 'Playing...' : 'Preview'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SCRIPT INPUT AREA */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Voiceover Script Text</label>
                    {generatedScript && (
                      <button 
                        onClick={() => setVoiceoverText(generatedScript)} 
                        className="text-[8px] font-bold uppercase text-ggd-orange hover:underline flex items-center gap-1"
                      >
                        <i className="fa-solid fa-file-import"></i> Import Active Script
                      </button>
                    )}
                  </div>
                  <textarea 
                    value={voiceoverText} 
                    onChange={e => setVoiceoverText(e.target.value)} 
                    className={`w-full h-32 border rounded-xl p-3 text-xs outline-none focus:border-ggd-orange font-medium ${themeMode === 'light' ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/10 text-white'}`} 
                    placeholder="Type or paste text here for Vixora Voice to narrate..." 
                  />
                </div>

                <button 
                  disabled={isGeneratingVoiceover || !voiceoverText.trim()} 
                  onClick={() => handleGenerateVoiceover()} 
                  className="btn-3d btn-3d-blue w-full py-3.5 text-xs tracking-wider shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                   {isGeneratingVoiceover ? (
                     <>
                       <i className="fa-solid fa-spinner animate-spin"></i>
                       <span>Vixora Engine Synthesizing Voice...</span>
                     </>
                   ) : (
                     <>
                       <i className="fa-solid fa-microphone-lines"></i>
                       <span>Generate Vixora Voice</span>
                     </>
                   )}
                </button>
             </div>

             {/* ACTIVE PLAYBACK PLAYER CONSOLE */}
             {activeVoiceoverId && (
                <div className={`p-4 border rounded-2xl space-y-3 shadow-xl ${themeMode === 'light' ? 'bg-blue-50/70 border-blue-200' : 'bg-gradient-to-r from-blue-950/30 to-slate-900 border-blue-500/30'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img src={vixoraAgentAvatar} alt="Vixora" className="w-10 h-10 rounded-full border border-ggd-orange" />
                        {isVoiceoverPlaying && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                          </span>
                        )}
                      </div>
                      <div className="text-left space-y-0.5">
                        <span className="text-[7.5px] font-black uppercase text-blue-400 tracking-wider">Active Playback • Vixora Voice</span>
                        <p className="text-xs font-black uppercase truncate max-w-[180px]">
                          {voiceoverHistory.find(h => h.id === activeVoiceoverId)?.text || "Vixora Narration"}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        const item = voiceoverHistory.find(h => h.id === activeVoiceoverId);
                        if (item) togglePlayVoiceoverItem(item.id, item.audioBase64);
                      }} 
                      className="w-11 h-11 rounded-full bg-ggd-orange text-white flex items-center justify-center text-base shadow-lg active:scale-95 transition-all shrink-0"
                      title={isVoiceoverPlaying ? "Pause Playback" : "Play Voiceover"}
                    >
                      <i className={`fa-solid ${isVoiceoverPlaying ? 'fa-pause' : 'fa-play pl-0.5'}`}></i>
                    </button>
                  </div>

                  {/* PROGRESS BAR & TIMING */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-400">
                      <span>{formatAudioTime(voiceoverCurrentTime)}</span>
                      <span>{formatAudioTime(voiceoverDuration)}</span>
                    </div>
                    <input 
                      type="range" 
                      min={0} 
                      max={voiceoverDuration || 100} 
                      value={voiceoverCurrentTime || 0} 
                      onChange={(e) => {
                        const newTime = parseFloat(e.target.value);
                        voiceoverAudioRef.currentTime = newTime;
                        setVoiceoverCurrentTime(newTime);
                      }} 
                      className="w-full accent-ggd-orange cursor-pointer"
                    />
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex gap-2 pt-1">
                    <button 
                      onClick={() => {
                        const item = voiceoverHistory.find(h => h.id === activeVoiceoverId);
                        if (item) downloadVoiceoverMp3(item.audioBase64, item.text);
                        else downloadVoiceoverMp3();
                      }} 
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <i className="fa-solid fa-file-audio"></i> Download MP3
                    </button>
                  </div>
                </div>
             )}

             {/* PREVIOUS PLAYBACKS HISTORY */}
             {voiceoverHistory.length > 0 && (
                <div className={`p-5 rounded-2xl border space-y-3 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
                  <div className="flex justify-between items-center border-b pb-2 dark:border-white/10 border-slate-200">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-history text-ggd-orange text-xs"></i>
                      <h3 className="text-xs font-black uppercase tracking-wider">Previous Playbacks ({voiceoverHistory.length})</h3>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {voiceoverHistory.map((item) => {
                      const isItemActive = activeVoiceoverId === item.id;
                      const isItemPlaying = isItemActive && isVoiceoverPlaying;

                      return (
                        <div 
                          key={item.id} 
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                            isItemActive 
                              ? 'border-ggd-orange bg-ggd-orange/10' 
                              : themeMode === 'light' ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-white/5 border-white/5 hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <button 
                              onClick={() => togglePlayVoiceoverItem(item.id, item.audioBase64)}
                              className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs transition-all active:scale-95 shadow ${
                                isItemPlaying ? 'bg-ggd-orange text-white animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-500'
                              }`}
                              title={isItemPlaying ? "Pause" : "Play"}
                            >
                              <i className={`fa-solid ${isItemPlaying ? 'fa-pause' : 'fa-play pl-0.5'}`}></i>
                            </button>
                            <div className="text-left space-y-0.5 overflow-hidden">
                              <p className="text-[10px] font-bold uppercase truncate max-w-[180px]">{item.text}</p>
                              <div className="flex items-center gap-2 text-[7.5px] text-slate-400 font-mono">
                                <span>{item.date}</span>
                                <span>•</span>
                                <span className="text-ggd-orange font-sans font-bold">Vixora Voice</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button 
                              onClick={() => downloadVoiceoverMp3(item.audioBase64, item.text)} 
                              className="px-2.5 py-1.5 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-500 border border-emerald-600/30 rounded-lg text-[8px] font-black uppercase transition-all"
                              title="Download MP3"
                            >
                              <i className="fa-solid fa-download mr-1"></i> MP3
                            </button>
                            <button 
                              onClick={() => deleteVoiceoverHistoryItem(item.id)} 
                              className="p-1.5 text-slate-400 hover:text-red-500 text-xs transition-all"
                              title="Delete"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
             )}
          </div>
        )}

        {activeTab === 'bgmusic' && (
          <div className="animate-rise space-y-4 text-left">
            <div className={`rounded-2xl p-5 border space-y-4 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 border border-amber-500/20">
                    <i className="fa-solid fa-music text-sm"></i>
                  </div>
                  <div>
                    <h2 className="text-base font-black uppercase">Vixora Music HQ</h2>
                    <p className="text-[7.5px] text-slate-500 font-extrabold uppercase tracking-widest">Select background tracks for timeline rendering</p>
                  </div>
                </div>
                <div className={`flex border rounded-lg p-0.5 shrink-0 ${themeMode === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-black/60 border-white/10'}`}>
                  <button 
                    onClick={() => setMusicResourceMode('presets')}
                    className={`px-2.5 py-1 text-[8px] font-black uppercase rounded-md transition-all ${musicResourceMode === 'presets' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Presets
                  </button>
                  <button 
                    onClick={() => setMusicResourceMode('pexels')}
                    className={`px-2.5 py-1 text-[8px] font-black uppercase rounded-md transition-all ${musicResourceMode === 'pexels' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Pexels Search
                  </button>
                </div>
              </div>

              {/* PEXELS MUSIC API SEARCH CARD */}
              {musicResourceMode === 'pexels' ? (
                <div className="space-y-3 bg-amber-400/5 p-3.5 border border-amber-400/20 rounded-xl">
                  <div className="flex items-start gap-2 text-amber-500">
                    <i className="fa-solid fa-wand-magic-sparkles text-xs pt-0.5"></i>
                    <p className="text-[8px] font-black uppercase tracking-wider leading-normal">
                      Pexels Music AI Loader: Pexels videos contain commercial-free background soundtracks. Type a soundtrack style below!
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      value={bgMusicSearchQuery} 
                      onChange={e => setBgMusicSearchQuery(e.target.value)} 
                      className={`flex-1 border rounded-xl py-2.5 px-3 text-xs outline-none focus:border-amber-400 font-medium ${themeMode === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-black/40 border-white/10 text-white'}`} 
                      placeholder="e.g. lo-fi ambient piano, electronic drone..." 
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSearchPexelsMusic(bgMusicSearchQuery);
                      }}
                    />
                    <button 
                      onClick={() => handleSearchPexelsMusic(bgMusicSearchQuery)}
                      className="px-4 bg-amber-400 text-slate-950 font-black uppercase text-[9px] rounded-xl shadow hover:bg-amber-300 transition-all shrink-0 active:scale-95"
                    >
                      Search Pexels
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['piano ambient', 'lofi background', 'cyberpunk techno', 'inspiring acoustic', 'corporate presentation'].map(preset => (
                      <button 
                        key={preset}
                        onClick={() => {
                          setBgMusicSearchQuery(preset);
                          handleSearchPexelsMusic(preset);
                        }}
                        className={`px-2 py-0.5 border text-[7.5px] font-black uppercase rounded-lg transition-all ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700 hover:text-amber-600' : 'bg-white/5 border-white/5 text-slate-400 hover:text-amber-400'}`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* PRESET FILTERS */
                <div className="space-y-2">
                  <div className="relative">
                    <input 
                      value={bgMusicSearchQuery} 
                      onChange={e => setBgMusicSearchQuery(e.target.value)} 
                      className={`w-full border rounded-xl py-3 pl-10 pr-3 text-xs outline-none focus:border-amber-400 font-medium ${themeMode === 'light' ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/10 text-white'}`} 
                      placeholder="Search preset loops by name or mood..." 
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <i className="fa-solid fa-magnifying-glass text-xs"></i>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTIVE PREVIEW PLAYER CONSOLE */}
              <div className={`p-4 border rounded-xl space-y-3 font-sans ${themeMode === 'light' ? 'bg-amber-50/50 border-amber-200' : 'bg-gradient-to-r from-amber-950/20 to-slate-900 border-amber-500/20'}`}>
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5 overflow-hidden mr-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[7.5px] font-black uppercase text-amber-500 tracking-wider">Active Autopilot Track</span>
                      {globalMusicUrl.includes('pexels') && (
                        <span className="text-[6px] font-black uppercase bg-amber-400/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-400/20">Pexels Sourced</span>
                      )}
                    </div>
                    <p className="text-xs font-black uppercase truncate max-w-[200px]">
                      {(() => {
                        if (globalMusicUrl.includes('pexels')) {
                          return 'Decoded Pexels Stock Backing Track';
                        }
                        const track = PRESET_MUSIC_TRACKS.find(t => t.url === globalMusicUrl);
                        return track ? track.name : 'Custom Track';
                      })()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={() => {
                        if (isPlayingPreview) {
                          previewAudioRef.pause();
                          setIsPlayingPreview(false);
                        } else {
                          previewAudioRef.src = globalMusicUrl;
                          previewAudioRef.loop = true;
                          previewAudioRef.play()
                            .then(() => setIsPlayingPreview(true))
                            .catch(err => alert("Press track Select to preview instantly. Standard browsers restrict automatic un-interacted startup audio."));
                        }
                      }} 
                      className="w-10 h-10 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-base shadow-md active:scale-95 transition-all"
                    >
                      <i className={`fa-solid ${isPlayingPreview ? 'fa-pause' : 'fa-play pl-0.5'}`}></i>
                    </button>
                  </div>
                </div>

                {/* VOLUME CONTROLLER */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[7.5px] font-black uppercase text-slate-500">
                    <span>Background Volume Balance</span>
                    <span className="font-mono text-amber-500">{Math.round(globalMusicVolume * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01" 
                    value={globalMusicVolume} 
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      setGlobalMusicVolume(v);
                    }} 
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                {/* EQUALIZER PULSATOR */}
                {isPlayingPreview && (
                  <div className="flex items-center justify-center gap-1 h-5 pt-1">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((bar) => (
                      <div 
                        key={bar} 
                        className="w-0.5 bg-amber-400 rounded-full" 
                        style={{ 
                          height: `${Math.floor(Math.random() * 16) + 4}px`, 
                          animation: 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                          animationDelay: `${bar * 50}ms`
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* TRACK LISTING RESULTS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    {musicResourceMode === 'pexels' ? 'Pexels API Live Results' : 'Premium Preset Loop Tracks'}
                  </h3>
                  {musicResourceMode === 'pexels' && (
                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest font-mono">Total Powered Sourcing</span>
                  )}
                </div>
                
                {isSearchingPexelsMusic ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <i className="fa-solid fa-spinner animate-spin text-xl text-amber-400"></i>
                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Querying commercial video backing audio tracks from Pexels API...</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {musicResourceMode === 'pexels' ? (
                      pexelsMusicTracks.length === 0 ? (
                        <div className="py-12 text-center border border-dashed border-white/5 rounded-2xl">
                          <i className="fa-solid fa-cloud-arrow-down text-lg text-slate-600 mb-2"></i>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
                            No active Pexels results loaded. <br />
                            Type your search and click &ldquo;Search Pexels&rdquo; to unlock background tracks!
                          </p>
                        </div>
                      ) : (
                        pexelsMusicTracks.map((track) => {
                          const isActive = globalMusicUrl === track.url;
                          return (
                            <div 
                              key={track.id} 
                              className={`p-3.5 border rounded-2xl flex items-center justify-between gap-4 transition-all ${
                                isActive 
                                  ? 'bg-amber-400/5 border-amber-400/30 shadow-md' 
                                  : 'bg-black/20 border-white/5 hover:border-white/10'
                              }`}
                            >
                              <div className="w-12 h-12 bg-slate-900 rounded-xl overflow-hidden shrink-0 border border-white/5 relative">
                                <img src={track.image} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover" />
                                <div className="absolute right-1 bottom-1 bg-black/80 px-1 rounded-[3px] text-[6px] font-black text-white font-mono">
                                  {track.duration}s
                                </div>
                              </div>
                              <div className="text-left space-y-1 overflow-hidden flex-1">
                                <span className="text-[9px] font-black uppercase text-white truncate block">{track.name}</span>
                                <p className="text-[7.5px] text-slate-400 font-bold tracking-tight line-clamp-2 leading-tight">{track.description}</p>
                              </div>

                              <div className="flex items-center shrink-0">
                                <button 
                                  onClick={() => {
                                    previewAudioRef.pause();
                                    setGlobalMusicUrl(track.url);
                                    previewAudioRef.src = track.url;
                                    previewAudioRef.loop = true;
                                    previewAudioRef.play()
                                      .then(() => setIsPlayingPreview(true))
                                      .catch(() => setIsPlayingPreview(false));
                                  }} 
                                  className={`px-3 py-2 text-[8px] font-black uppercase rounded-lg transition-all border ${
                                    isActive 
                                      ? 'bg-amber-400 text-slate-950 border-amber-400' 
                                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                  }`}
                                >
                                  {isActive ? 'Active Track' : 'Select'}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )
                    ) : (
                      /* SOUNDHELIX PRESETS LIST */
                      PRESET_MUSIC_TRACKS.filter(track => 
                        !bgMusicSearchQuery || 
                        track.name.toLowerCase().includes(bgMusicSearchQuery.toLowerCase()) || 
                        track.description.toLowerCase().includes(bgMusicSearchQuery.toLowerCase()) || 
                        track.mood.toLowerCase().includes(bgMusicSearchQuery.toLowerCase())
                      ).map((track) => {
                        const isActive = globalMusicUrl === track.url;
                        return (
                          <div 
                            key={track.id} 
                            className={`p-4 border rounded-2xl flex items-center justify-between transition-all ${
                              isActive 
                                ? 'bg-amber-400/5 border-amber-400/30 shadow-md' 
                                : 'bg-black/20 border-white/5 hover:border-white/10'
                            }`}
                          >
                            <div className="text-left space-y-1 overflow-hidden flex-1 mr-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase text-white truncate">{track.name}</span>
                                <span className="text-[6.5px] font-black uppercase text-amber-300 px-1.5 py-0.5 bg-amber-400/10 rounded-full">{track.mood}</span>
                              </div>
                              <p className="text-[8px] text-slate-400 font-bold tracking-tight">{track.description}</p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button 
                                onClick={() => {
                                  previewAudioRef.pause();
                                  setGlobalMusicUrl(track.url);
                                  previewAudioRef.src = track.url;
                                  previewAudioRef.loop = true;
                                  previewAudioRef.play()
                                    .then(() => setIsPlayingPreview(true))
                                    .catch(() => {
                                      setIsPlayingPreview(false);
                                    });
                                }} 
                                className={`px-3 py-2 text-[8px] font-black uppercase rounded-lg transition-all border ${
                                  isActive 
                                    ? 'bg-amber-400 text-slate-950 border-amber-400' 
                                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                }`}
                              >
                                {isActive ? 'Active Track' : 'Select'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* OFFLINE CAPABLE ANALOG GENERATOR CARD */}
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl space-y-3 font-sans">
                <div className="flex items-start gap-3">
                  <div className="text-md pt-0.5">💡</div>
                  <div className="text-left space-y-1">
                    <h4 className="text-[10px] font-black uppercase text-purple-300">Offline Synthesis Option</h4>
                    <p className="text-[8px] text-slate-400 font-medium leading-relaxed">
                      Facing proxy blocks? Tap below to synth a professional ambient background pad loop dynamically inside your browser! Completely royalty-free and 100% immune to CORS network restrictions.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setGlobalMusicUrl("local_midi_synthesized_pad.mp3");
                    alert("Aesthetic custom analog synthesized pad activated! This matches your narrative pace in the final sequencer rendering.");
                  }} 
                  className="w-full py-2.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-200 text-[8px] font-black uppercase rounded-xl tracking-wider transition-all"
                >
                  Synthesize Ambient Pad
                </button>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'more' && (
          <div className="animate-rise space-y-5">
            {/* VIRAL HERO BANNER CARD */}
            <div className="relative rounded-3xl overflow-hidden border border-emerald-500/30 shadow-2xl bg-slate-950">
              <img 
                src={viralGrowthBanner} 
                alt="Viral Growth Engine" 
                className="w-full h-44 object-cover opacity-60 hover:opacity-75 transition-opacity duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-5 flex flex-col justify-end text-left">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                    ⚡ Gemini 2.5 Flash Engine
                  </span>
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white">Viral Growth & SEO Suite</h2>
                <p className="text-xs text-slate-300 font-medium leading-relaxed mt-1 max-w-md">
                  Generate high-ranking YouTube SEO tags, viral opening hooks, and click-optimized thumbnail visual concepts in seconds.
                </p>
              </div>
            </div>

            {/* MAIN GROWTH TOOLS CONSOLE */}
            <div className={`rounded-3xl p-5 sm:p-6 border space-y-5 shadow-2xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-white/10'}`}>
              
              {/* TOOL SELECTOR TABS */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 block text-left">Select Viral Tool</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'tags', name: 'Viral Tags', icon: 'fa-hashtag', desc: 'SEO Search Ranking' },
                    { id: 'hooks', name: 'Retention Hooks', icon: 'fa-bolt-lightning', desc: '3-Sec Attention Grab' },
                    { id: 'thumbnails', name: 'Thumbnail Visuals', icon: 'fa-image', desc: 'High CTR Visuals' }
                  ].map(tool => {
                    const isActive = activeToolType === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => {
                          setActiveToolType(tool.id as any);
                          setCopiedToolOutput(false);
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between ${
                          isActive 
                            ? 'bg-gradient-to-br from-ggd-orange to-amber-500 text-white border-ggd-orange shadow-lg scale-102' 
                            : themeMode === 'light'
                              ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <i className={`fa-solid ${tool.icon} text-sm ${isActive ? 'text-white' : 'text-ggd-orange'}`}></i>
                          {isActive && <i className="fa-solid fa-circle-check text-xs"></i>}
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-tight">{tool.name}</p>
                          <p className={`text-[9px] font-bold ${isActive ? 'text-white/80' : 'text-slate-400'}`}>{tool.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* QUICK TOPIC PRESETS */}
              <div className="space-y-2 text-left">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 block">Quick Topic Suggestions</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Forex Trading & Wealth",
                    "Fitness Motivation",
                    "AI Tech Trends 2026",
                    "Cryptocurrency Investing",
                    "Self Improvement Discipline"
                  ].map(topic => (
                    <button
                      key={topic}
                      onClick={() => {
                        setToolInput(topic);
                        handleToolAction(activeToolType, topic);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold uppercase transition-all ${
                        themeMode === 'light'
                          ? 'bg-slate-100 hover:bg-ggd-orange/15 border-slate-200 text-slate-700 hover:text-ggd-orange'
                          : 'bg-white/5 hover:bg-ggd-orange/20 border-white/10 text-slate-300 hover:text-ggd-orange'
                      }`}
                    >
                      <i className="fa-solid fa-sparkles text-[10px] text-ggd-orange mr-1"></i>
                      {topic}
                    </button>
                  ))}
                </div>
              </div>

              {/* INPUT FORM */}
              <div className="space-y-2 text-left">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 block">Enter Your Video Topic or Niche Keyword</label>
                <div className="relative">
                  <input 
                    value={toolInput} 
                    onChange={e => setToolInput(e.target.value)} 
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleToolAction();
                    }}
                    className={`w-full border rounded-2xl py-3.5 pl-11 pr-4 text-sm outline-none focus:border-ggd-orange font-semibold ${
                      themeMode === 'light' ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/10 text-white'
                    }`} 
                    placeholder="e.g. How to double your productivity in 30 days..." 
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-ggd-orange text-sm">
                    <i className="fa-solid fa-magnifying-glass"></i>
                  </div>
                </div>
              </div>

              {/* ACTION GENERATE BUTTON */}
              <button 
                disabled={isToolLoading || !toolInput.trim()} 
                onClick={() => handleToolAction()} 
                className="btn-3d btn-3d-orange w-full py-4 text-sm font-black uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isToolLoading ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin"></i>
                    <span>Analyzing Viral Trends & Keywords...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-bolt-lightning text-base"></i>
                    <span>
                      Generate {activeToolType === 'tags' ? 'Viral SEO Tags' : activeToolType === 'hooks' ? 'Retention Script Hooks' : 'Thumbnail Visuals'}
                    </span>
                  </>
                )}
              </button>

              {/* RESULT OUTPUT */}
              {toolOutput && (
                <div className={`p-5 border rounded-2xl animate-rise space-y-3 relative text-left shadow-lg ${
                  themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/10'
                }`}>
                  <div className="flex justify-between items-center border-b pb-2 dark:border-white/10 border-slate-200">
                    <span className="text-xs font-black uppercase tracking-wider text-ggd-orange flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-check"></i>
                      Generated {activeToolType === 'tags' ? 'SEO Tags' : activeToolType === 'hooks' ? 'Retention Hooks' : 'Thumbnail Concepts'}
                    </span>
                    <button 
                      onClick={() => { 
                        navigator.clipboard.writeText(toolOutput); 
                        setCopiedToolOutput(true);
                        setTimeout(() => setCopiedToolOutput(false), 2500);
                      }} 
                      className="px-3 py-1.5 bg-ggd-orange/15 hover:bg-ggd-orange/30 border border-ggd-orange/30 text-ggd-orange rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5"
                    >
                      <i className={`fa-solid ${copiedToolOutput ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                      <span>{copiedToolOutput ? 'Copied to Clipboard!' : 'Copy Results'}</span>
                    </button>
                  </div>

                  <p className="text-xs leading-relaxed font-mono whitespace-pre-wrap select-all text-slate-800 dark:text-slate-200">
                    {toolOutput}
                  </p>

                  <div className="pt-2 flex items-center justify-end">
                    <button 
                      onClick={() => {
                        setScriptTopic(toolInput);
                        setActiveTab('scripts');
                      }}
                      className="text-xs font-bold uppercase text-slate-400 hover:text-ggd-orange flex items-center gap-1 transition-all"
                    >
                      <span>Send topic to Script Writer</span>
                      <i className="fa-solid fa-arrow-right"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="animate-rise space-y-4">
            <div className={`rounded-2xl p-5 border text-center shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
               <div className="w-14 h-14 bg-slate-800 rounded-2xl mx-auto flex items-center justify-center text-white text-xl mb-3 border border-white/10 shadow-lg"><i className="fa-solid fa-user-ninja"></i></div>
               <h2 className="text-base font-black uppercase tracking-tight">{user?.fullName}</h2>
               <p className="text-[8px] text-ggd-orange font-bold uppercase tracking-widest mt-0.5">Status: Gold Creator Tier</p>
            </div>

            <div className={`rounded-2xl p-4 sm:p-5 border space-y-3 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}>
               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">App Environment</h3>
               <div className="space-y-2">
                  <div className={`flex items-center justify-between p-3 rounded-xl border ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
                     <span className="text-[10px] font-bold uppercase">Network Mode</span>
                     <div className="flex items-center gap-1.5">
                       <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`}></span>
                       <span className="text-[9px] font-black uppercase">{isOnline ? 'Online Integration' : 'Offline Mode Active'}</span>
                     </div>
                  </div>
                  <div className={`flex items-center justify-between p-3 rounded-xl border ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
                     <span className="text-[10px] font-bold uppercase">App Client Type</span>
                     <span className="text-[9px] font-black uppercase text-ggd-orange">{isStandalone ? 'Installed Native App' : 'Web Browser Mode'}</span>
                  </div>
                  {deferredPrompt && (
                    <button onClick={triggerPwaInstall} className="w-full mt-1 py-3 bg-ggd-orange/15 hover:bg-ggd-orange/25 text-ggd-orange border border-ggd-orange/20 rounded-xl font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all shadow-md">
                       <i className="fa-solid fa-download mr-1.5"></i> Install Native App Wrapper
                    </button>
                  )}
               </div>
            </div>

            <div className={`rounded-2xl p-4 sm:p-5 border space-y-3.5 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}>
               <div className="text-left">
                 <h3 className="text-xs font-black uppercase tracking-widest text-ggd-orange flex items-center gap-1.5">
                   <i className="fa-solid fa-cubes-stacked"></i> Creator Persona & Target Niche
                 </h3>
                 <p className={`text-[9px] leading-normal mt-0.5 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                   Configure your primary target demographic and channel focus. Vixora automatically tailors script voice tones and footage search terms to dominate this audience.
                 </p>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                 {NICHE_OPTIONS.map(n => {
                    const isSelected = (user as any)?.niche === n.id;
                    return (
                       <button 
                         key={n.id} 
                         type="button"
                         onClick={() => {
                           if (!user) return;
                           const updated = { ...user, niche: n.id };
                           setUser(updated);
                           localStorage.setItem('ggd_creator_user', JSON.stringify(updated));
                         }}
                         className={`group relative p-3 rounded-2xl text-left transition-all duration-150 transform overflow-hidden cursor-pointer flex items-center gap-2.5 border-b-4 ${
                           isSelected
                             ? `bg-gradient-to-r ${n.colorGradient} text-white border-black/40 shadow-xl ring-2 ring-ggd-orange/60 scale-[1.02] translate-y-[-2px]`
                             : themeMode === 'light'
                               ? `bg-gradient-to-r ${n.colorGradient} text-white opacity-90 border-black/20 hover:opacity-100 hover:-translate-y-0.5 shadow-md`
                               : `bg-gradient-to-r ${n.colorGradient} text-white opacity-85 border-black/40 hover:opacity-100 hover:-translate-y-0.5 shadow-md`
                         } active:translate-y-1 active:border-b-2 active:shadow-inner`}
                       >
                         {/* Background Glossy Shine Effect */}
                         <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/20 rounded-full blur-xl pointer-events-none group-hover:bg-white/35 transition-all"></div>

                         {/* 3D Icon Badge */}
                         <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md border bg-white/20 text-white border-white/40">
                           <i className={`fa-solid ${n.icon} text-sm drop-shadow`}></i>
                         </div>

                         <div className="min-w-0 flex-1 z-10">
                           <span className="block text-[9.5px] font-black uppercase tracking-tight leading-tight truncate text-white drop-shadow-sm">
                             {n.name}
                           </span>
                           <span className="block text-[7.5px] font-extrabold uppercase tracking-wider truncate opacity-90 text-white/90">
                             {n.suggestions[0]}
                           </span>
                         </div>

                         {/* 3D Selected Checkmark Pin */}
                         {isSelected && (
                           <span className="w-5 h-5 bg-white text-ggd-orange rounded-full flex items-center justify-center text-[10px] font-black shadow-lg border border-white shrink-0 z-10 animate-pulse">
                             ✓
                           </span>
                         )}
                       </button>
                    );
                 })}
               </div>
            </div>

            <div className={`rounded-2xl p-4 sm:p-5 border space-y-3 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}>
               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">API Credentials</h3>
               <div className="space-y-2">
                  <input type="password" value={newApiKey} onChange={e => setNewApiKey(e.target.value)} className={`w-full border rounded-xl p-3 text-xs font-mono outline-none focus:border-ggd-orange ${themeMode === 'light' ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/10 text-white'}`} placeholder="Gemini API Key" />
                  <button onClick={updateApiKey} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all shadow-md">Save To Hub</button>
               </div>
            </div>

            <button className="w-full py-3.5 text-[9px] font-black text-red-500 uppercase bg-red-500/10 border border-red-500/20 rounded-xl active:scale-95 transition-all" onClick={() => { localStorage.clear(); window.location.reload(); }}>Full App Data Reset</button>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="animate-rise space-y-4">
             <div className={`rounded-2xl p-6 border space-y-5 text-center shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
                <div className="w-16 h-16 bg-ggd-orange/10 rounded-full mx-auto flex items-center justify-center text-ggd-orange text-2xl border border-ggd-orange/20"><i className="fa-solid fa-headset"></i></div>
                <div className="space-y-1">
                  <h2 className="text-xl font-black uppercase tracking-tighter">Get In Touch</h2>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Vixora Support</p>
                </div>

                <div className="space-y-2.5">
                   <a href="https://wa.me/2347043537401" target="_blank" className="w-full flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl active:scale-95 transition-all"><div className="flex items-center gap-3 text-left"><i className="fa-brands fa-whatsapp text-xl text-emerald-500"></i><div><p className="text-[10px] font-black uppercase">WhatsApp Support</p><p className="text-[8.5px] font-bold text-slate-400">Message us anytime</p></div></div><i className="fa-solid fa-arrow-right text-[10px]"></i></a>
                   <a href="tel:07043537401" className="w-full flex items-center justify-between p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl active:scale-95 transition-all"><div className="flex items-center gap-3 text-left"><i className="fa-solid fa-phone text-xl text-blue-500"></i><div><p className="text-[10px] font-black uppercase">Direct Line</p><p className="text-[8.5px] font-bold text-slate-400">070-435-37401</p></div></div><i className="fa-solid fa-arrow-right text-[10px]"></i></a>
                   <a href="mailto:goodgiftdigital@gmail.com" className="w-full flex items-center justify-between p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-xl active:scale-95 transition-all"><div className="flex items-center gap-3 text-left"><i className="fa-solid fa-envelope text-xl text-purple-500"></i><div><p className="text-[10px] font-black uppercase">Email Contact</p><p className="text-[8.5px] font-bold text-slate-400">goodgiftdigital@gmail.com</p></div></div><i className="fa-solid fa-arrow-right text-[10px]"></i></a>
                   <a href="https://ggdigital.com.ng" target="_blank" className="w-full flex items-center justify-between p-3.5 bg-ggd-orange/10 border border-ggd-orange/20 rounded-xl active:scale-95 transition-all"><div className="flex items-center gap-3 text-left"><i className="fa-solid fa-globe text-xl text-ggd-orange"></i><div><p className="text-[10px] font-black uppercase">Our Site</p><p className="text-[8.5px] font-bold text-slate-400">More products available</p></div></div><i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i></a>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-white/5">
                   <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">© 2026 Vixora. All rights reserved.</p>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* 1. FEATURE ADVERT POPUP MODAL (GLOSSY 3D STYLE) */}
      {activeAdvertPopup && (
        <div className="fixed inset-0 z-[400] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-rise">
          <div className={`w-full max-w-sm rounded-[2.5rem] p-6 border text-left relative shadow-2xl overflow-hidden ${themeMode === 'light' ? 'bg-white border-purple-200 text-slate-900' : 'bg-slate-900 border-purple-500/30 text-white'}`}>
            {/* Top Glossy Gradient Accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"></div>

            <button 
              onClick={() => setActiveAdvertPopup(null)} 
              className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center border ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white'}`}
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>

            <div className="space-y-4 pt-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[8px] font-black uppercase rounded-lg shadow-md tracking-wider">
                  {activeAdvertPopup.tag || 'NEW UPDATE'}
                </span>
                <span className="text-[8px] font-bold text-purple-400 uppercase tracking-widest">
                  {activeAdvertPopup.badgeText || 'Vixora Feature Advert'}
                </span>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 text-xl shadow-inner">
                  <i className="fa-solid fa-bullhorn animate-pulse"></i>
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight leading-snug">
                    {activeAdvertPopup.title}
                  </h3>
                  <p className="text-[8px] text-slate-400 font-medium mt-0.5">
                    {new Date(activeAdvertPopup.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border text-xs leading-relaxed ${themeMode === 'light' ? 'bg-purple-50/50 border-purple-100 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
                {activeAdvertPopup.message}
              </div>

              <div className="pt-2 flex gap-2">
                <button 
                  onClick={() => setActiveAdvertPopup(null)} 
                  className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg active:scale-95 transition-all text-center"
                >
                  Explore Feature Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. VIXORA LEARNED SKILL BASE MEMORY MODAL */}
      {showLearnedSkillsModal && (
        <div className="fixed inset-0 z-[450] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-rise">
          <div className={`w-full max-w-lg rounded-[2.5rem] p-6 border text-left relative shadow-2xl max-h-[85vh] flex flex-col overflow-hidden ${themeMode === 'light' ? 'bg-white border-purple-200 text-slate-900' : 'bg-slate-900 border-purple-500/30 text-white'}`}>
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 text-lg shadow-md">
                  <i className="fa-solid fa-brain animate-pulse"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight">Vixora AI Learned Skills</h3>
                  <p className="text-[9px] text-purple-400 font-bold uppercase">Custom Workflows & Agent Memory Base</p>
                </div>
              </div>

              <button 
                onClick={() => setShowLearnedSkillsModal(false)} 
                className={`w-8 h-8 rounded-full flex items-center justify-center border ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white'}`}
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <p className={`text-[10px] leading-relaxed ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                Vixora continuously learns from your instructions during live sessions. Any rule, formatting preference, or channel style you specify is automatically stored below and applied to your video creation pipeline!
              </p>

              {/* ADD NEW MANUAL SKILL */}
              <div className={`p-4 rounded-2xl border space-y-3 ${themeMode === 'light' ? 'bg-purple-50/50 border-purple-200' : 'bg-black/30 border-purple-500/20'}`}>
                <h4 className="text-[10px] font-black uppercase text-purple-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-plus-circle"></i> Teach Vixora A New Skill or Rule
                </h4>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newSkillName}
                    onChange={e => setNewSkillName(e.target.value)}
                    placeholder="Skill Title e.g. Forex 9:16 Fast Paced Shorts"
                    className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${themeMode === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-950 border-white/10 text-white'}`}
                  />
                  <textarea
                    value={newSkillDesc}
                    onChange={e => setNewSkillDesc(e.target.value)}
                    placeholder="Describe how Vixora should construct videos for this skill..."
                    rows={2}
                    className={`w-full p-2.5 rounded-xl border text-xs font-medium outline-none ${themeMode === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-950 border-white/10 text-white'}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newSkillName.trim() || !newSkillDesc.trim()) return;
                      saveCustomLearnedSkill(newSkillName, newSkillDesc, undefined, 'custom');
                      setNewSkillName('');
                      setNewSkillDesc('');
                    }}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md transition-all active:scale-95"
                  >
                    + Store Skill in Memory
                  </button>
                </div>
              </div>

              {/* LIST OF LEARNED SKILLS */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Active Learned Memory Base ({userSkills.length})
                </h4>

                <div className="space-y-2">
                  {userSkills.map((sk) => (
                    <div 
                      key={sk.id}
                      className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 transition-all ${
                        themeMode === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-950/60 border-white/10'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[8px] font-black uppercase rounded-md">
                            {sk.category || 'skill'}
                          </span>
                          <h5 className="text-[11px] font-black uppercase truncate text-purple-300">
                            {sk.name}
                          </h5>
                        </div>
                        <p className={`text-[9.5px] font-medium leading-normal ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                          {sk.description}
                        </p>
                        <p className="text-[8px] text-slate-500 font-bold">
                          Added: {sk.createdAt}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const updated = userSkills.filter(s => s.id !== sk.id);
                          setUserSkills(updated);
                          localStorage.setItem('vixora_user_skills', JSON.stringify(updated));
                        }}
                        className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white flex items-center justify-center shrink-0 border border-red-500/20 transition-all"
                        title="Delete Skill"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setShowLearnedSkillsModal(false)}
                className="w-full py-3 bg-purple-600 text-white rounded-xl font-black uppercase text-xs tracking-wider shadow-lg active:scale-95 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 2. ANNOUNCEMENTS & PWA DRAWER */}
      {showAnnouncementsDrawer && (
        <div className="fixed inset-0 z-[350] bg-slate-950/80 backdrop-blur-md flex justify-end animate-rise">
          <div className={`w-full max-w-md h-full flex flex-col p-5 shadow-2xl border-l ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'}`}>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <i className="fa-solid fa-bullhorn text-sm"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Feature Updates & PWA</h3>
                  <p className="text-[8px] text-slate-400 font-bold">App Adverts & Push Notifications</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAnnouncementsDrawer(false)} 
                className={`w-8 h-8 rounded-full flex items-center justify-center border ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white'}`}
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="py-4 space-y-3 border-b border-white/10">
              {/* Push Notification Permission Toggle */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${themeMode === 'light' ? 'bg-purple-50 border-purple-200' : 'bg-purple-950/30 border-purple-500/20'}`}>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    <i className="fa-solid fa-bell text-purple-400"></i>
                    <span>Firebase Push Notifications</span>
                  </p>
                  <p className="text-[8px] text-slate-400 font-medium">Get instant adverts when new features launch</p>
                </div>
                <button 
                  onClick={handleEnableNotifications}
                  className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 ${notificationPermission === 'granted' ? 'bg-emerald-500 text-white' : 'bg-purple-600 text-white'}`}
                >
                  {notificationPermission === 'granted' ? 'Enabled ✓' : 'Enable Push'}
                </button>
              </div>

              {/* Native PWA Install Banner Button */}
              {deferredPrompt && (
                <button 
                  onClick={triggerPwaInstall}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-download"></i>
                  <span>Install Vixora PWA App to Home Screen</span>
                </button>
              )}

              {/* Broadcast Advert Button */}
              <button 
                onClick={() => setShowNewAdvertModal(true)}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-plus-circle"></i>
                <span>Publish New Feature Update Advert</span>
              </button>
            </div>

            {/* Announcements List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">System Advert Announcements</p>
              
              {announcements.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No feature update announcements yet.</p>
              ) : (
                announcements.map((ann) => (
                  <div 
                    key={ann.id}
                    onClick={() => setActiveAdvertPopup(ann)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer hover:scale-[1.01] ${themeMode === 'light' ? 'bg-slate-50 border-slate-200 hover:border-purple-300' : 'bg-white/5 border-white/5 hover:border-purple-500/40'}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[7.5px] font-black uppercase rounded-md">
                        {ann.tag || 'UPDATE'}
                      </span>
                      <span className="text-[7.5px] text-slate-400 font-medium">
                        {new Date(ann.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-xs font-black uppercase mb-1 line-clamp-1">{ann.title}</h4>
                    <p className={`text-[10px] line-clamp-2 leading-relaxed ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                      {ann.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showNewAdvertModal && (
        <div className="fixed inset-0 z-[400] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-rise">
          <div className={`w-full max-w-sm rounded-[2.5rem] p-6 border text-left space-y-4 relative shadow-2xl ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'}`}>
            <div className="flex items-center justify-between border-b border-slate-200/20 pb-3">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-paper-plane text-purple-500 text-sm"></i>
                <h3 className="text-xs font-black uppercase tracking-wider">Broadcast Feature Advert</h3>
              </div>
              <button 
                onClick={() => setShowNewAdvertModal(false)}
                className={`w-7 h-7 rounded-full flex items-center justify-center border ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white'}`}
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Update Title</label>
                <input 
                  type="text"
                  value={newAdvertTitle}
                  onChange={e => setNewAdvertTitle(e.target.value)}
                  placeholder="e.g. ⚡ AI Voice cloning & PWA Offline mode!"
                  className={`w-full p-3 rounded-xl border outline-none font-bold text-xs ${themeMode === 'light' ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-white/5 border-white/10 text-white'}`}
                />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Badge Tag</label>
                <div className="grid grid-cols-3 gap-2">
                  {['NEW FEATURE', 'UPDATE', 'PROMO'].map(t => (
                    <button 
                      key={t}
                      type="button"
                      onClick={() => setNewAdvertTag(t)}
                      className={`py-2 rounded-xl text-[8px] font-black uppercase border transition-all ${newAdvertTag === t ? 'bg-purple-600 text-white border-purple-500' : 'bg-transparent border-slate-700 text-slate-400'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Advert Message & Details</label>
                <textarea 
                  rows={3}
                  value={newAdvertMessage}
                  onChange={e => setNewAdvertMessage(e.target.value)}
                  placeholder="Describe the new feature or update for your users..."
                  className={`w-full p-3 rounded-xl border outline-none font-medium text-xs leading-relaxed ${themeMode === 'light' ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-white/5 border-white/10 text-white'}`}
                />
              </div>

              <button 
                disabled={isPublishingAdvert}
                onClick={handlePublishNewFeatureAdvert}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg active:scale-95 transition-all text-center"
              >
                {isPublishingAdvert ? 'Broadcasting...' : 'Publish & Send Push Notification'}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className={`fixed bottom-3 left-3 right-3 max-w-md mx-auto rounded-3xl p-1.5 flex items-center justify-between z-50 border shadow-2xl backdrop-blur-2xl ${themeMode === 'light' ? 'bg-white/95 border-slate-200 text-slate-700' : 'bg-slate-950/95 border-white/10 text-white'}`}>
        {[
          { id: 'coach', label: 'Coach', icon: 'fa-cross', activeBg: 'from-amber-500 to-orange-600 border-amber-300/40 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3.5px_0_#78350f,0_6px_12px_rgba(245,158,11,0.35)]', activeText: 'text-amber-400' },
          { id: 'studio', label: 'Studio', icon: 'fa-microphone-lines', activeBg: 'from-orange-500 to-amber-600 border-orange-300/40 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3.5px_0_#b33600,0_6px_12px_rgba(255,102,0,0.35)]', activeText: 'text-orange-500' },
          { id: 'autopilot', label: 'Autopilot', icon: 'fa-wand-magic-sparkles', activeBg: 'from-rose-500 to-pink-600 border-rose-300/40 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3.5px_0_#9f1239,0_6px_12px_rgba(244,63,94,0.35)]', activeText: 'text-rose-500' },
          { id: 'scripts', label: 'Scripts', icon: 'fa-scroll', activeBg: 'from-purple-500 to-indigo-600 border-purple-300/40 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3.5px_0_#581c87,0_6px_12px_rgba(168,85,247,0.35)]', activeText: 'text-purple-500' },
          { id: 'videos', label: 'Creator', icon: 'fa-clapperboard', activeBg: 'from-orange-600 to-red-600 border-orange-300/40 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3.5px_0_#9a3412,0_6px_12px_rgba(234,88,12,0.35)]', activeText: 'text-orange-500' },
          { id: 'voiceover', label: 'Voice', icon: 'fa-waveform-lines', activeBg: 'from-blue-500 to-cyan-600 border-blue-300/40 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3.5px_0_#1e3a8a,0_6px_12px_rgba(59,130,246,0.35)]', activeText: 'text-blue-500' },
          { id: 'more', label: 'Tools', icon: 'fa-bolt-lightning', activeBg: 'from-emerald-500 to-teal-600 border-emerald-300/40 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3.5px_0_#064e3b,0_6px_12px_rgba(16,185,129,0.35)]', activeText: 'text-emerald-500' },
        ].map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)} 
              className="flex-1 py-0.5 flex flex-col items-center gap-1 transition-all active:scale-90 relative"
            >
              <div 
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                  isActive 
                    ? `bg-gradient-to-br ${item.activeBg} text-white -translate-y-1`
                    : themeMode === 'light'
                      ? 'bg-slate-100 border-slate-200 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_0_rgba(0,0,0,0.08)] hover:border-slate-300'
                      : 'bg-slate-900 border-white/10 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_0_rgba(0,0,0,0.5)] hover:border-white/20'
                }`}
              >
                <i className={`fa-solid ${item.icon} text-xs sm:text-sm ${isActive ? 'animate-pulse' : ''}`}></i>
              </div>
              <span className={`text-[7.5px] font-black uppercase tracking-wider transition-colors ${isActive ? item.activeText : 'text-slate-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
