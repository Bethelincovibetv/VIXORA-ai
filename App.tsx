
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from "@google/genai";
import { UserProfile, Bank, Project } from './types';
import { VideoSequencer, SourcedVideo } from './components/VideoSequencer';
import { VixoraContentMaster } from './components/VixoraContentMaster';
import { VixoraTextChatPanel } from './components/VixoraTextChatPanel';
import { ToolsLibrary } from './components/ToolsLibrary';
import { DeveloperApiView } from './components/DeveloperApiView';
import { CompleteApiModal } from './components/CompleteApiModal';
import { NativeExportDownloadModal } from './components/NativeExportDownloadModal';
import { ProjectsNavigationDrawer } from './components/ProjectsNavigationDrawer';
import { VixoraNavbar } from './components/VixoraNavbar';
import { VoiceSelectorDropdown } from './components/VoiceSelectorDropdown';
import { VixoraAppContext } from './services/vixoraAgentTools';
import { PRESET_MUSIC_TRACKS, VOICE_AVATAR_OPTIONS, VIRAL_PROMPT_NICHES } from './constants';
import { synthesizeFishAudio, FISH_AUDIO_VOICES } from './services/fishAudioService';
import { playProceduralSFX } from './sfxLibrary';
import { 
  syncSaveCreatedVideo, 
  syncFetchCreatedVideos, 
  syncSaveVoiceover, 
  syncFetchVoiceovers,
  syncSaveProject,
  syncFetchProjects,
  syncGetAssetSignedUrl
} from './services/dataSyncService';
import {
  signInWithSupabase,
  signUpWithSupabase,
  signOutSupabase,
  getSupabaseCurrentUser
} from './services/supabaseService';
import { scoreAndFetchBeatVisual } from './services/stockSourcingService';
import { 
  requestNotificationPermission, 
  setupForegroundMessageListener, 
  sendLocalPushNotification,
  syncFirebaseSaveAnnouncement, 
  syncFirebaseFetchAnnouncements, 
  syncFirebaseUserProfile,
  FeatureAnnouncement 
} from './services/firebaseService';
import { LearnedSkill } from './types';
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
  duration?: string;
  resolution?: string;
  format?: string;
  userId?: string;
  createdAt?: string;
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

function createAudioBlobFromBase64(base64Audio: string): Blob {
  try {
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const isMp3 = binaryString.startsWith('ID3') || (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0);
    const isWav = binaryString.startsWith('RIFF');

    if (isMp3) {
      return new window.Blob([bytes], { type: 'audio/mpeg' });
    } else if (isWav) {
      return new window.Blob([bytes], { type: 'audio/wav' });
    } else {
      // PCM wrapping
      const rawPcm = new Int16Array(bytes.buffer);
      const wavHeader = createWavHeader(rawPcm.byteLength, 24000, 1, 16);
      const audioFile = new Uint8Array(wavHeader.length + rawPcm.byteLength);
      audioFile.set(wavHeader);
      audioFile.set(new Uint8Array(rawPcm.buffer), wavHeader.length);
      return new window.Blob([audioFile], { type: 'audio/wav' });
    }
  } catch (e) {
    console.error("createAudioBlobFromBase64 error:", e);
    return new window.Blob([], { type: 'audio/mpeg' });
  }
}

// --- APP COMPONENT ---

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState<(UserProfile & { apiKey?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'studio' | 'autopilot' | 'voiceover' | 'scripts' | 'profile' | 'more' | 'videos' | 'contact' | 'coach' | 'tools' | 'chat' | 'developer' | 'bgmusic'>('studio');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showAccessibilityModal, setShowAccessibilityModal] = useState(false);
  const [showGlobalApiModal, setShowGlobalApiModal] = useState(false);
  const [showNativeExportModal, setShowNativeExportModal] = useState(false);

  // Helper to map tab identifier to canonical URL path
  const getTabPath = (tab: string) => {
    switch (tab) {
      case 'videos': return '/videos';
      case 'scripts': return '/scripts';
      case 'autopilot': return '/autopilot';
      case 'voiceover': return '/voiceover';
      case 'bgmusic': return '/bgmusic';
      case 'more': return '/growth';
      case 'tools': return '/tools';
      case 'developer': return '/developer';
      case 'profile': return '/profile';
      case 'contact': return '/contact';
      case 'coach': return '/coach';
      case 'chat': return '/studio';
      default: return '/studio';
    }
  };

  // Navigates and updates URL path seamlessly
  const handleSelectTab = (tab: any) => {
    setActiveTab(tab);
    const targetPath = getTabPath(tab);
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };

  // Synchronize URL changes (e.g. direct address bar entry, browser back/forward) to activeTab
  useEffect(() => {
    const rawPath = location.pathname.toLowerCase().replace(/\/$/, '') || '/';
    if (rawPath === '/' || rawPath === '/studio') {
      setActiveTab('studio');
    } else if (rawPath === '/videos' || rawPath === '/creator' || rawPath === '/video-creator') {
      setActiveTab('videos');
    } else if (rawPath === '/scripts' || rawPath === '/script-writer' || rawPath === '/script') {
      setActiveTab('scripts');
    } else if (rawPath === '/autopilot' || rawPath === '/video-autopilot') {
      setActiveTab('autopilot');
    } else if (rawPath === '/voiceover' || rawPath === '/voice' || rawPath === '/tts') {
      setActiveTab('voiceover');
    } else if (rawPath === '/bgmusic' || rawPath === '/music' || rawPath === '/soundtracks') {
      setActiveTab('bgmusic');
    } else if (rawPath === '/growth' || rawPath === '/more' || rawPath === '/seo') {
      setActiveTab('more');
    } else if (rawPath === '/tools' || rawPath === '/features') {
      setActiveTab('tools');
    } else if (rawPath === '/developer' || rawPath === '/api' || rawPath === '/docs') {
      setActiveTab('developer');
    } else if (rawPath === '/profile' || rawPath === '/settings') {
      setActiveTab('profile');
    } else if (rawPath === '/contact' || rawPath === '/support') {
      setActiveTab('contact');
    } else if (rawPath === '/coach' || rawPath === '/mentorship') {
      setActiveTab('coach');
    } else if (rawPath === '/projects') {
      setIsSidebarOpen(true);
    }
  }, [location.pathname]);

  // Projects State for Requirement 3 (Projects-based Navigation)
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('vixora_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out sample demo project drafts
          const userProjects = parsed.filter(p => !p.id.startsWith('proj_demo_'));
          return userProjects;
        }
      }
    } catch {}

    return [];
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    return projects[0]?.id || null;
  });

  useEffect(() => {
    try {
      localStorage.setItem('vixora_projects', JSON.stringify(projects));
    } catch {}
  }, [projects]);

  // Theme & Accessibility States
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('vixora_theme') as 'dark' | 'light') || 'light';
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
  
  // Onboarding Wizard & Supabase Auth State
  const [wizardStep, setWizardStep] = useState(0);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);
  const [wizardData, setWizardData] = useState({ 
    fullName: '', 
    email: '', 
    apiKey: '' 
  });

  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showPwaInstallModal, setShowPwaInstallModal] = useState(false);

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
        setShowPwaInstallModal(true);
      }
    } else {
      setShowPwaInstallModal(true);
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

  const unreadAnnouncementsCount = announcements.filter(a => !readAnnouncementIds.includes(a.id)).length;

  // Admin Check
  const isAdmin = user?.email?.toLowerCase() === 'bethelincovibetv@gmail.com' || (user as any)?.role === 'admin';

  const markAllAnnouncementsAsRead = () => {
    const allIds = announcements.map(a => a.id);
    setReadAnnouncementIds(allIds);
    localStorage.setItem('vixora_read_announcements', JSON.stringify(allIds));
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
  const [apiKeyStatusMsg, setApiKeyStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showGeminiKeyInProfile, setShowGeminiKeyInProfile] = useState(false);

  // Fish.Audio API Key State & Live Test
  const [newFishAudioKey, setNewFishAudioKey] = useState('');
  const [fishAudioStatusMsg, setFishAudioStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isTestingFishAudio, setIsTestingFishAudio] = useState(false);
  const [showFishAudioKeyInProfile, setShowFishAudioKeyInProfile] = useState(false);

  // Live Assistant State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  const [callTimer, setCallTimer] = useState(0);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
  
  // Voiceover State
  const [voiceoverText, setVoiceoverText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('Kore'); // Default Vixora Studio Voice (Kore)
  const [voiceoverSpeed, setVoiceoverSpeed] = useState<number>(1.0);
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
  const [isReviewingScript, setIsReviewingScript] = useState<boolean>(false);
  const [sourcedVideos, setSourcedVideos] = useState<SourcedVideo[]>([]);
  const [isSourcingVideos, setIsSourcingVideos] = useState(false);
  const [videoMode, setVideoMode] = useState<'ordinary' | 'ai_packaged'>('ai_packaged');
  const [videoRatio, setVideoRatio] = useState<'vertical' | 'horizontal' | 'square'>('vertical');
  const [selectedNicheFilter, setSelectedNicheFilter] = useState<string>('all');
  const [creatorInputMode, setCreatorInputMode] = useState<'topic' | 'script'>('topic');
  const [isEnhancingScript, setIsEnhancingScript] = useState<boolean>(false);
  const [activeViralCategory, setActiveViralCategory] = useState<string>('hooks');
  const [isCreatorMusicPlaying, setIsCreatorMusicPlaying] = useState<boolean>(false);

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

  // Project Management Handlers & State Sync
  const handleCreateNewProject = () => {
    const newProj: Project = {
      id: 'proj_' + Date.now(),
      title: `Untitled Project #${projects.length + 1}`,
      topic: '',
      status: 'draft',
      aspectRatio: videoRatio || 'vertical',
      targetDuration: targetVideoDuration || '30s',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setProjects(prev => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setScriptTopic('');
    setGeneratedScript('');
    setVideoScriptInput('');
    setSourcedVideos([]);
    setActiveTab('studio');
    setIsSidebarOpen(false);
    
    // Sync to Lovable Cloud / Supabase /projects/create
    syncSaveProject(newProj);
  };

  const handleSelectProject = (proj: Project) => {
    setActiveProjectId(proj.id);
    if (proj.topic || proj.title) setScriptTopic(proj.topic || proj.title);
    if (proj.scriptText) {
      setGeneratedScript(proj.scriptText);
      setVideoScriptInput(proj.scriptText);
    }
    if (proj.aspectRatio) setVideoRatio(proj.aspectRatio);
    if (proj.targetDuration) setTargetVideoDuration(proj.targetDuration);
    if (proj.sourcedVideos) setSourcedVideos(proj.sourcedVideos);

    if (proj.chatHistory) {
      try {
        localStorage.setItem('vixora_text_chat_history', JSON.stringify(proj.chatHistory));
      } catch {}
    }

    if (proj.status === 'rendered' && proj.videoUrl) {
      setActiveTab('videos');
    } else {
      setActiveTab('studio');
    }
    setIsSidebarOpen(false);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    if (activeProjectId === projectId) {
      const remaining = projects.filter(p => p.id !== projectId);
      setActiveProjectId(remaining[0]?.id || null);
    }
  };

  const handleRenameProject = (projectId: string, newTitle: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        const updated = { ...p, title: newTitle, updatedAt: new Date().toISOString() };
        syncSaveProject(updated);
        return updated;
      }
      return p;
    }));
  };

  const handleDuplicateProject = (proj: Project) => {
    const dup: Project = {
      ...proj,
      id: 'proj_' + Date.now(),
      title: `${proj.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setProjects(prev => [dup, ...prev]);
    setActiveProjectId(dup.id);
    syncSaveProject(dup);
  };

  // Sync active project state with changes
  useEffect(() => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProjectId) return p;
      let chatHist = p.chatHistory;
      try {
        const savedChat = localStorage.getItem('vixora_text_chat_history');
        if (savedChat) chatHist = JSON.parse(savedChat);
      } catch {}
      return {
        ...p,
        topic: scriptTopic || p.topic,
        scriptText: generatedScript || p.scriptText,
        aspectRatio: videoRatio || p.aspectRatio,
        targetDuration: targetVideoDuration || p.targetDuration,
        sourcedVideos: sourcedVideos.length > 0 ? sourcedVideos : p.sourcedVideos,
        chatHistory: chatHist,
        updatedAt: new Date().toISOString()
      };
    }));
  }, [activeProjectId, scriptTopic, generatedScript, videoRatio, targetVideoDuration, sourcedVideos]);

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

  // Text Chat Agent State & App Context
  const [isTextChatOpen, setIsTextChatOpen] = useState<boolean>(false);

  const addCreatedAsset = (asset: { id: string; title: string; imageUrl: string; date: string; type: 'flyer' | 'video' }) => {
    const newVideoItem: CreatedVideo = {
      id: asset.id,
      topic: asset.title,
      scriptText: `Promotional Flyer Asset generated by Vixora AI for ${asset.title}`,
      videoUrl: asset.imageUrl,
      date: asset.date,
      aspectRatio: 'vertical'
    };
    setCreatedVideos(prev => {
      const updated = [newVideoItem, ...prev];
      localStorage.setItem('ggd_created_videos', JSON.stringify(updated));
      return updated;
    });
  };

  const appContext: VixoraAppContext = {
    setActiveTab: (tab: any) => setActiveTab(tab),
    handleAutopilotVideoGeneration: (topic, ratio, duration, searchWeb) => {
      handleAutopilotVideoGeneration(
        topic,
        ratio || 'vertical',
        duration || '30s',
        searchWeb !== undefined ? searchWeb : true
      );
    },
    setSelectedVoice,
    setVideoRatio,
    setTargetVideoDuration,
    saveCustomLearnedSkill,
    setGeneratedScript,
    setScriptTopic,
    setVideoScriptInput,
    handleSourceVideos: (script) => {
      if (typeof handleSourceVideos === 'function') {
        handleSourceVideos(script);
      }
    },
    setGlobalMusicVolume,
    setGlobalExtractedMood,
    addCreatedAsset,
    userFullName: user?.fullName,
    currentScriptText: generatedScript || videoScriptInput,
    currentTopic: scriptTopic
  };

  // Tools State
  const [activeToolType, setActiveToolType] = useState<'tags' | 'hooks' | 'thumbnails'>('tags');
  const [toolInput, setToolInput] = useState('');
  const [toolOutput, setToolOutput] = useState('');
  const [isToolLoading, setIsToolLoading] = useState(false);
  const [copiedToolOutput, setCopiedToolOutput] = useState(false);

  // Refs
  const liveSessionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
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

  // Centralized API Key Resolver & Fallback Generation Engine
  const isInvalidOrLeakedKey = (key?: string): boolean => {
    if (!key) return true;
    const clean = key.trim();
    if (!clean || clean === 'undefined' || clean === 'null' || clean === 'your_gemini_api_key_here') return true;
    if (
      clean.includes('AIzaSyAd6JjVFP5LYmtiSUXLH-HZGIPlHcseohA') ||
      clean.includes('AIzaSyAeCyBC9daZbvXNRtfLjxBWwpF3MwXJggk') ||
      clean.includes('AIzaSyCBO1PRv5h9aQAB3rWb') ||
      clean.startsWith('AIzaSy...') ||
      clean === 'AIzaSy...'
    ) {
      return true;
    }
    return false;
  };

  const getEffectiveApiKey = (userApiKey?: string): string => {
    const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    if (!isInvalidOrLeakedKey(userApiKey)) {
      return userApiKey!.trim();
    }
    if (!isInvalidOrLeakedKey(envKey)) {
      return envKey.trim();
    }
    return '';
  };

  const generateGeminiContentWithFallback = async (
    userApiKey: string | undefined,
    requestParams: {
      model?: string;
      contents: any;
      config?: any;
    }
  ) => {
    const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    const primaryKey = getEffectiveApiKey(userApiKey);
    const targetModel = requestParams.model || "gemini-3.7-flash";

    // Attempt 1: Server proxy with environment credentials (most secure & reliable)
    try {
      const serverRes = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: requestParams.contents,
          systemInstruction: requestParams.config?.systemInstruction,
          temperature: requestParams.config?.temperature,
          model: targetModel,
          responseMimeType: requestParams.config?.responseMimeType,
          apiKey: primaryKey || undefined
        })
      });

      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (serverData && serverData.ok) {
          return {
            text: serverData.text || '',
            candidates: serverData.candidates || []
          };
        }
      }
    } catch (serverErr) {
      console.warn("[Server AI proxy attempt failed, falling back to direct client execution]:", serverErr);
    }

    // Attempt 2: Primary resolved key on client
    if (primaryKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: primaryKey });
        return await ai.models.generateContent({
          model: targetModel,
          contents: requestParams.contents,
          config: requestParams.config
        });
      } catch (err1: any) {
        console.warn(`[Gemini API Attempt with primaryKey failed]:`, err1?.message || err1);
      }
    }

    // Attempt 3: Retry without tools parameter if present
    if (requestParams.config?.tools && (envKey || primaryKey)) {
      try {
        const activeKey = envKey || primaryKey;
        const aiNoTools = new GoogleGenAI({ apiKey: activeKey });
        const { tools, ...configWithoutTools } = requestParams.config;
        return await aiNoTools.models.generateContent({
          model: targetModel,
          contents: requestParams.contents,
          config: Object.keys(configWithoutTools).length > 0 ? configWithoutTools : undefined
        });
      } catch (err3: any) {
        console.warn("[Gemini API Attempt without tools failed]:", err3?.message || err3);
      }
    }

    return {
      text: "",
      candidates: []
    };
  };

  const activeVoicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Voice preview function (Powered by Google AI / Fish Audio Voice Engine)
  const handlePreviewVoice = async (voiceOption: typeof VOICE_AVATAR_OPTIONS[0]) => {
    // If clicking the currently playing voice preview, toggle stop immediately
    if (previewingVoiceId === voiceOption.id) {
      if (activeVoicePreviewAudioRef.current) {
        activeVoicePreviewAudioRef.current.pause();
        activeVoicePreviewAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPreviewingVoiceId(null);
      return;
    }

    // Stop any existing playing preview
    if (activeVoicePreviewAudioRef.current) {
      activeVoicePreviewAudioRef.current.pause();
      activeVoicePreviewAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setPreviewingVoiceId(voiceOption.id);

    try {
      const sampleText = voiceOption.sampleText || `Hello, I am ${voiceOption.name}, ready to narrate your high-impact video with crystal clear pacing.`;
      const result = await synthesizeFishAudio({
        text: sampleText,
        voiceName: voiceOption.voiceName,
        format: 'mp3'
      });

      if (result.ok && result.audioBase64) {
        const blob = createAudioBlobFromBase64(result.audioBase64);
        const url = URL.createObjectURL(blob);
        const previewAudio = new Audio(url);
        activeVoicePreviewAudioRef.current = previewAudio;

        previewAudio.onended = () => {
          setPreviewingVoiceId((current) => (current === voiceOption.id ? null : current));
          URL.revokeObjectURL(url);
          if (activeVoicePreviewAudioRef.current === previewAudio) {
            activeVoicePreviewAudioRef.current = null;
          }
        };

        previewAudio.onerror = () => {
          setPreviewingVoiceId((current) => (current === voiceOption.id ? null : current));
          URL.revokeObjectURL(url);
          if (activeVoicePreviewAudioRef.current === previewAudio) {
            activeVoicePreviewAudioRef.current = null;
          }
        };

        await previewAudio.play();
      } else {
        // Fallback to Web Speech API or procedural sound
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(sampleText);
          utterance.pitch = voiceOption.gender === 'Female' ? 1.2 : 0.9;
          utterance.rate = 1.05;
          utterance.onend = () => {
            setPreviewingVoiceId((current) => (current === voiceOption.id ? null : current));
          };
          utterance.onerror = () => {
            setPreviewingVoiceId((current) => (current === voiceOption.id ? null : current));
          };
          window.speechSynthesis.speak(utterance);
        } else {
          playProceduralSFX('sparkle');
          setPreviewingVoiceId(null);
        }
      }
    } catch (e) {
      console.warn("Voice preview error, falling back:", e);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const sampleText = voiceOption.sampleText || `Hello, I am ${voiceOption.name}.`;
        const utterance = new SpeechSynthesisUtterance(sampleText);
        utterance.pitch = voiceOption.gender === 'Female' ? 1.2 : 0.9;
        utterance.onend = () => setPreviewingVoiceId(null);
        utterance.onerror = () => setPreviewingVoiceId(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setPreviewingVoiceId(null);
      }
    }
  };

  // --- INITIALIZATION ---

  useEffect(() => {
    try {
      // Check for remote display & embed parameters (?embed=creator | chat | scripts | voiceover)
      const urlParams = new URLSearchParams(window.location.search);
      const embedParam = urlParams.get('embed');
      const apiKeyParam = urlParams.get('apiKey') || urlParams.get('api_key') || urlParams.get('apikey');
      const themeParam = urlParams.get('theme');

      if (themeParam === 'light' || themeParam === 'dark') {
        setThemeMode(themeParam);
      }

      if (embedParam) {
        // Zero-friction instant access for remote embedded websites
        const remoteGuestUser: UserProfile = {
          fullName: 'Remote Creator',
          email: 'guest@remote-embed.vixora',
          phone: '',
          apiKey: apiKeyParam || process.env.GEMINI_API_KEY || process.env.API_KEY || '',
          niche: 'general'
        };
        setUser(remoteGuestUser);
        setNewApiKey(remoteGuestUser.apiKey || '');
        setWizardStep(3);

        if (embedParam === 'chat' || embedParam === 'assistant' || embedParam === 'surah' || embedParam === 'ai') {
          setActiveTab('chat');
        } else if (embedParam === 'voice' || embedParam === 'voiceover') {
          setActiveTab('voiceover');
        } else if (embedParam === 'scripts') {
          setActiveTab('scripts');
        } else if (embedParam === 'developer' || embedParam === 'api') {
          setActiveTab('developer');
        } else {
          setActiveTab('studio');
        }

        setLoading(false);
        return;
      }

      const savedUser = localStorage.getItem('ggd_creator_user');
      const rawEnvKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
      const defaultEnvKey = isInvalidOrLeakedKey(rawEnvKey) ? '' : rawEnvKey;
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed) {
          if (!parsed.niche) parsed.niche = 'finance';
          if (isInvalidOrLeakedKey(parsed.apiKey)) {
            parsed.apiKey = defaultEnvKey;
          }
          if (parsed.fullName && parsed.email) {
            setUser(parsed);
            setNewApiKey(parsed.apiKey);
            localStorage.setItem('ggd_creator_user', JSON.stringify(parsed));
            setWizardStep(3);
          } else {
            const fallbackUser: UserProfile = {
              fullName: parsed.fullName || 'Creator',
              email: parsed.email || 'creator@vixora.studio',
              phone: '',
              apiKey: parsed.apiKey || defaultEnvKey,
              niche: parsed.niche || 'finance'
            };
            setUser(fallbackUser);
            setNewApiKey(fallbackUser.apiKey);
            localStorage.setItem('ggd_creator_user', JSON.stringify(fallbackUser));
            setWizardStep(3);
          }
        } else {
          const autoUser: UserProfile = {
            fullName: 'Creator',
            email: 'creator@vixora.studio',
            phone: '',
            apiKey: defaultEnvKey,
            niche: 'finance'
          };
          setUser(autoUser);
          setNewApiKey(defaultEnvKey);
          localStorage.setItem('ggd_creator_user', JSON.stringify(autoUser));
          setWizardStep(3);
        }
      } else {
        // Automatic zero-friction instant access using environment API key
        const autoUser: UserProfile = {
          fullName: 'Creator',
          email: 'creator@vixora.studio',
          phone: '',
          apiKey: defaultEnvKey,
          niche: 'finance'
        };
        setUser(autoUser);
        setNewApiKey(defaultEnvKey);
        localStorage.setItem('ggd_creator_user', JSON.stringify(autoUser));
        setWizardStep(3);
      }
    } catch (e) {
      console.warn("User state restoration fallback:", e);
      const rawEnvKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
      const defaultEnvKey = isInvalidOrLeakedKey(rawEnvKey) ? '' : rawEnvKey;
      const autoUser: UserProfile = {
        fullName: 'Creator',
        email: 'creator@vixora.studio',
        phone: '',
        apiKey: defaultEnvKey,
        niche: 'finance'
      };
      setUser(autoUser);
      setNewApiKey(defaultEnvKey);
      setWizardStep(3);
    } finally {
      setLoading(false);
    }

    // Sync remote data from Lovable Cloud / Supabase / Firestore or fallback
    syncFetchProjects().then(projs => {
      if (projs && projs.length > 0) {
        setProjects(prev => {
          const map = new Map<string, Project>();
          [...projs, ...prev].forEach(p => map.set(p.id, p));
          const merged = Array.from(map.values());
          return merged;
        });
      }
    });
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
    const cleanKey = newApiKey.trim();
    if (cleanKey && isInvalidOrLeakedKey(cleanKey)) {
      setApiKeyStatusMsg({ text: "This API key appears to be revoked, invalid or leaked. Please enter a valid Gemini API key.", type: 'error' });
      return;
    }
    const updatedUser = { ...user, apiKey: cleanKey };
    setUser(updatedUser);
    localStorage.setItem('ggd_creator_user', JSON.stringify(updatedUser));
    setApiKeyStatusMsg({ 
      text: cleanKey ? "Gemini API key updated successfully! Your studio is connected." : "Reverted to default system API key.", 
      type: 'success' 
    });
    setTimeout(() => setApiKeyStatusMsg(null), 4000);
  };

  const updateFishAudioKey = () => {
    if (!user) return;
    const cleanKey = newFishAudioKey.trim();
    const updatedUser = { ...user, fishAudioApiKey: cleanKey };
    setUser(updatedUser);
    localStorage.setItem('ggd_creator_user', JSON.stringify(updatedUser));
    localStorage.setItem('vixora_fish_audio_key', cleanKey);
    setFishAudioStatusMsg({
      text: cleanKey ? "Fish.Audio API key saved successfully! Custom voice synthesis is active." : "Reverted to default Fish.Audio configuration.",
      type: 'success'
    });
    setTimeout(() => setFishAudioStatusMsg(null), 4000);
  };

  const testFishAudioConnection = async () => {
    setIsTestingFishAudio(true);
    setFishAudioStatusMsg({ text: "Testing Fish.Audio connection & generating voice sample...", type: 'info' });
    try {
      const keyToTest = newFishAudioKey.trim() || user?.fishAudioApiKey || undefined;
      const res = await synthesizeFishAudio({
        text: "How far my creator! Fish Audio is fully connected and ready for your studio videos!",
        voiceName: 'Kore',
        customApiKey: keyToTest
      });
      if (res.ok && res.audioUrl) {
        const audio = new Audio(res.audioUrl);
        await audio.play();
        setFishAudioStatusMsg({ text: "✓ Fish.Audio connected! Live voice sample played successfully.", type: 'success' });
      } else {
        setFishAudioStatusMsg({ text: `Connection note: ${res.error || 'Check API key or network connection.'}`, type: 'error' });
      }
    } catch (err: any) {
      setFishAudioStatusMsg({ text: `Fish.Audio error: ${err.message || 'Failed to connect.'}`, type: 'error' });
    } finally {
      setIsTestingFishAudio(false);
      setTimeout(() => setFishAudioStatusMsg(null), 6000);
    }
  };

  const handleFinishOnboarding = async () => {
    if (!wizardData.fullName.trim() || !wizardData.email?.trim()) {
      setAppError("Please enter both your name and email address.");
      return;
    }
    const emailLower = wizardData.email.trim().toLowerCase();
    const defaultKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    const userApiKey = wizardData.apiKey?.trim() || defaultKey;
    const newUser = { 
      fullName: wizardData.fullName.trim(), 
      email: emailLower, 
      phone: '', 
      apiKey: userApiKey, 
      niche: 'finance' 
    };
    setUser(newUser);
    setNewApiKey(userApiKey);
    localStorage.setItem('ggd_creator_user', JSON.stringify(newUser));
    try {
      await syncFirebaseUserProfile(newUser);
    } catch (err) {
      console.warn("Firebase user sync warning:", err);
    }
    setWizardStep(3);
  };

  // Supabase Auth Integration Handler (Sign In / Sign Up)
  const handleSupabaseAuthSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthErrorMsg(null);

    const email = wizardData.email?.trim();
    if (!email) {
      setAuthErrorMsg("Please enter a valid email address.");
      return;
    }

    if (!authPassword || authPassword.length < 6) {
      setAuthErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (authMode === 'signup' && !wizardData.fullName?.trim()) {
      setAuthErrorMsg("Please enter your full name.");
      return;
    }

    setIsAuthenticating(true);

    try {
      if (authMode === 'signin') {
        const { user: sbUser, session, error } = await signInWithSupabase(email, authPassword);
        if (error) {
          setAuthErrorMsg(error);
          setIsAuthenticating(false);
          return;
        }

        const fullName = sbUser?.user_metadata?.full_name || wizardData.fullName || email.split('@')[0];
        const defaultKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
        const userObj: UserProfile = {
          fullName,
          email: email.toLowerCase(),
          phone: '',
          apiKey: defaultKey,
          niche: 'finance'
        };

        setUser(userObj);
        setNewApiKey(defaultKey);
        localStorage.setItem('ggd_creator_user', JSON.stringify(userObj));
        setWizardStep(3);
      } else {
        // Sign Up Flow
        const { user: sbUser, session, error } = await signUpWithSupabase(email, authPassword, wizardData.fullName.trim());
        if (error) {
          setAuthErrorMsg(error);
          setIsAuthenticating(false);
          return;
        }

        const fullName = wizardData.fullName.trim() || sbUser?.user_metadata?.full_name || email.split('@')[0];
        const defaultKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
        const userObj: UserProfile = {
          fullName,
          email: email.toLowerCase(),
          phone: '',
          apiKey: defaultKey,
          niche: 'finance'
        };

        setUser(userObj);
        setNewApiKey(defaultKey);
        localStorage.setItem('ggd_creator_user', JSON.stringify(userObj));
        setWizardStep(3);
      }
    } catch (err: any) {
      setAuthErrorMsg(err?.message || 'Authentication error occurred.');
    } finally {
      setIsAuthenticating(false);
    }
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

    setIsSourcingVideos(true);
    setAppError(null);
    setSourcedVideos([]);

    try {
      const currentDuration = overrideDuration || targetVideoDuration || '30s';
      const sceneCount = getTargetSceneCount(currentDuration);

      // Sentence beats splitting (rule-based fallback always ready)
      const sentenceBeats = input.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 3);
      console.log(`[BEAT_SPLITTING] Input script split into ${sentenceBeats.length} distinct sentence beats:`, sentenceBeats);

      let sceneQueries: string[] = [];

      // Intelligent scene-by-scene keyword extraction matching exact duration and script narrative
      try {
        const keywordResponse = await generateGeminiContentWithFallback(user?.apiKey, {
          model: "gemini-2.5-flash",
          contents: `Analyze this video script: "${input}". 
          The target video duration is ${currentDuration}.
          Break the script down into EXACTLY ${sceneCount} sequential scene queries corresponding to what is being spoken in each scene.
          For each scene, provide a highly specific 3-5 word stock video search visual query matching the exact mood and subject matter (e.g. "trader studying forex chart screen", "luxury mansion living room", "young woman smiling at laptop office").
          Return ONLY a JSON array of ${sceneCount} strings.`,
          config: {
            responseMimeType: "application/json"
          }
        });

        const cleanJson = (keywordResponse.text || "[]")
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();
        const json = JSON.parse(cleanJson);
        if (Array.isArray(json) && json.length > 0) {
          sceneQueries = json;
        }
      } catch (genErr) {
        console.warn("Visual scene keyword AI generation fallback engaged:", genErr);
      }

      // Ensure every beat gets a distinct search query using rule-based beat sentence keywords if Gemini didn't return
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
      } else {
        playProceduralSFX('pop');
      }
    } catch (err) {
      console.warn("Video sourcing fallback handled:", err);
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

    setIsToolLoading(true);
    setToolOutput('');
    setCopiedToolOutput(false);
    try {
      const prompts = {
        tags: `Generate a comprehensive, comma-separated list of high-ranking, highly searched SEO tags and viral search keywords for a YouTube video about: ${topic}. Return ONLY the tags separated by commas. No asterisks, no bullet points.`,
        hooks: `Provide 5 viral, high-retention opening hooks for a video about: ${topic}. Each hook should grab attention in the first 3 seconds. Format as numbered list 1-5 with short commentary on why it works. No asterisks.`,
        thumbnails: `Provide 3 high-CTR visual thumbnail concepts for a video about: ${topic}. For each concept, describe the Main Visual Background, Color Palette, and Bold Text Overlay (3 words max). Format as numbered list 1-3. No asterisks.`,
      };

      const response = await generateGeminiContentWithFallback(user?.apiKey, {
        model: "gemini-2.5-flash",
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
      return "";
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

          const webResponse = await generateGeminiContentWithFallback(user?.apiKey, {
            model: "gemini-2.5-flash",
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
        const response = await generateGeminiContentWithFallback(user?.apiKey, {
          model: "gemini-2.5-flash",
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
      playProceduralSFX('pop');
      return text;
    } catch (err) {
      console.warn("Script generation API fallback engaged:", err);
      // Generate intelligent structured fallback script so Autopilot never breaks
      const cleanTopic = topic.trim().replace(/^['"]|['"]$/g, '');
      const fallbackText = `Stop scrolling if you want to master ${cleanTopic}. The biggest mistake people make is ignoring core execution. Successful creators and traders focus on discipline, strategy, and constant refinement. Start applying this today and transform your results.`;
      setGeneratedScript(fallbackText);
      return fallbackText;
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // --- AI SCRIPT ENHANCER ACTIONS ---
  const handleEnhanceScript = async (action: 'hook' | 'condense' | 'emotional' | 'cta') => {
    const currentText = videoScriptInput.trim() || generatedScript.trim() || scriptTopic.trim();
    if (!currentText) {
      setAppError("Please enter or generate a script first to polish with AI.");
      return;
    }
    setIsEnhancingScript(true);
    setAppError(null);
    try {
      let instruction = '';
      if (action === 'hook') {
        instruction = 'Rewrite the opening 1-2 sentences of this script into an irresistible, high-curiosity viral hook that stops viewers from scrolling in the first 2 seconds. Keep the rest of the script unchanged.';
      } else if (action === 'condense') {
        instruction = 'Condense and trim this script into fast-paced, punchy short sentences suitable for a 30-second video (~65-75 words). Remove any filler words while keeping maximum punch.';
      } else if (action === 'emotional') {
        instruction = 'Infuse this script with dramatic emotional tension, powerful sensory action verbs, and urgent narrative momentum.';
      } else if (action === 'cta') {
        instruction = 'Add a high-converting, viral call to action at the end asking the audience to comment their thoughts and follow for part 2.';
      }

      const prompt = `${instruction}

Original Script:
"${currentText}"

Formatting Rules:
- Return ONLY the clean, plain-text narrated speech.
- Do NOT use markdown bolding (**), asterisks (*), hashtags (#), or stage directions.
- Keep the tone natural, authoritative, and direct.`;

      const res = await generateGeminiContentWithFallback(user?.apiKey, {
        model: "gemini-2.5-flash",
        contents: prompt
      });

      const updated = res.text?.replace(/[*#]/g, '').trim();
      if (updated) {
        setVideoScriptInput(updated);
        setGeneratedScript(updated);
        playProceduralSFX('sparkle');
      }
    } catch (err: any) {
      console.error("AI Enhance script error:", err);
      setAppError(`Script enhancement notice: ${err.message || 'Updated automatically'}`);
    } finally {
      setIsEnhancingScript(false);
    }
  };

  const togglePlayCreatorBgMusic = (trackUrl: string) => {
    if (isCreatorMusicPlaying && previewAudioRef.src.includes(trackUrl)) {
      previewAudioRef.pause();
      setIsCreatorMusicPlaying(false);
    } else {
      previewAudioRef.pause();
      previewAudioRef.src = trackUrl;
      previewAudioRef.volume = globalMusicVolume || 0.15;
      previewAudioRef.play().then(() => {
        setIsCreatorMusicPlaying(true);
      }).catch(e => {
        console.warn("Audio preview failed:", e);
        setIsCreatorMusicPlaying(false);
      });
      previewAudioRef.onended = () => setIsCreatorMusicPlaying(false);
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
        const blob = createAudioBlobFromBase64(base64Audio);
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
    const blob = createAudioBlobFromBase64(dataToUse);
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

    setIsGeneratingVoiceover(true);
    setAppError(null);

    try {
      // Synthesize using Vixora Studio Voice (Kore) / Google Voice Engine
      const result = await synthesizeFishAudio({
        text: text.replace(/\*/g, ''),
        voiceName: selectedVoice || 'Kore',
        speed: voiceoverSpeed || 1.0,
        format: 'mp3'
      });

      if (result.ok && result.audioBase64) {
        setLastVoiceoverAudio(result.audioBase64);
        const newId = `vo_${Date.now()}`;
        const newEntry = {
          id: newId,
          text: text,
          audioBase64: result.audioBase64,
          date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        const updatedHistory = [newEntry, ...voiceoverHistory];
        setVoiceoverHistory(updatedHistory);
        syncSaveVoiceover(newEntry);
        setActiveVoiceoverId(newId);
        playProceduralSFX('bell');
      } else {
        if (result.error) {
          setAppError(`Vixora Voice (${result.statusCode || 'Error'}): ${result.error}`);
        } else {
          setAppError("Voiceover synthesis with Vixora Voice Engine failed. Please check network/API status.");
        }
      }
    } catch (err: any) {
      setAppError(`Vixora Voice error: ${err?.message || err}`);
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
      syncSaveCreatedVideo(newVideo, activeProjectId || undefined);
      return updated;
    });
  };

  const runUnifiedVideoCreation = async (options: {
    mode: 'topic' | 'script';
    overrideTopic?: string;
    overrideScript?: string;
    overrideDuration?: string;
    overrideRatio?: 'vertical' | 'horizontal' | 'square';
    skipReview?: boolean;
  }) => {
    const mode = options.mode;
    const topicToUse = (options.overrideTopic || scriptTopic).trim();
    const scriptToUse = (options.overrideScript || videoScriptInput).trim();
    const currentDuration = options.overrideDuration || targetVideoDuration || '30s';
    if (options.overrideRatio) setVideoRatio(options.overrideRatio);

    if (mode === 'topic' && !topicToUse) {
      setAppError("Please enter a topic for the video.");
      return;
    }
    if (mode === 'script' && !scriptToUse) {
      setAppError("Please enter or paste a video script.");
      return;
    }

    const activeApiKey = getEffectiveApiKey(user?.apiKey);

    if (!activeApiKey) {
      setAppError("API Credentials are required to launch video creation.");
      return;
    }

    (window as any).__GEMINI_API_KEY__ = activeApiKey;

    setIsAutopilotRunning(true);
    setIsSourcingVideos(true);
    setAutopilotStep(1);
    setAutopilotProgress(10);
    setAutopilotProgressMsg("Initializing Vixora AI Video Production Pipeline...");
    setAutopilotLog(`Configuring ${currentDuration} ${videoRatio} video layout...`);

    try {
      let scriptText = scriptToUse;

      if (mode === 'topic') {
        // Step 1: Generate Script from Topic
        setAutopilotStep(1);
        setAutopilotProgress(25);
        setAutopilotProgressMsg(useWebSearchForVideo ? "Searching Google Web Trends & drafting viral script..." : "Drafting viral narrative script structure...");
        setAutopilotLog(`Generating script for "${topicToUse}"...`);

        scriptText = await handleGenerateScript(topicToUse, useWebSearchForVideo, currentDuration);
        if (!scriptText) throw new Error("Could not formulate script from topic.");
        setVideoScriptInput(scriptText);
        setGeneratedScript(scriptText);

        if (!options.skipReview) {
          // Pause and show Editable Script Review Box before Voiceover
          setIsAutopilotRunning(false);
          setIsSourcingVideos(false);
          setIsReviewingScript(true);
          setAutopilotProgressMsg("Script generated! Review & edit your script below before Voiceover.");
          return;
        }
      } else {
        if (!options.skipReview) {
          // Pause for Script Review in Manual Script Mode
          setIsAutopilotRunning(false);
          setIsSourcingVideos(false);
          setIsReviewingScript(true);
          return;
        }
      }

      await startProductionWithConfirmedScript(scriptText, currentDuration);

    } catch (err: any) {
      console.error("Unified Video Creation error:", err);
      setAppError(`Video Creation failed: ${err.message || err}`);
      setIsAutopilotRunning(false);
      setIsSourcingVideos(false);
      setIsReviewingScript(false);
      setAutopilotProgress(0);
    }
  };

  const startProductionWithConfirmedScript = async (
    overrideScriptText?: string,
    overrideDur?: string
  ) => {
    const scriptText = (overrideScriptText || videoScriptInput).trim();
    const currentDuration = overrideDur || targetVideoDuration || '30s';

    if (!scriptText) {
      setAppError("Script text cannot be empty.");
      return;
    }

    setIsReviewingScript(false);
    setIsAutopilotRunning(true);
    setIsSourcingVideos(true);
    setAutopilotStep(2);
    setAutopilotProgress(40);
    setAutopilotProgressMsg("Synthesizing AI neural voiceover narration...");
    setAutopilotLog(`Rendering audio with ${selectedVoice || 'Kore'} narrator accent...`);

    try {
      // Step 2: Neural Voiceover Synthesis
      await handleGenerateVoiceover(scriptText);

      // Step 3: Stock Video Sourcing & Beat Assembly using working Manual pipeline
      setAutopilotStep(3);
      setAutopilotProgress(70);
      setAutopilotProgressMsg("Extracting visual scenes & sourcing HD stock footage clips...");
      setAutopilotLog("Querying Vixora Media HD video library for matching storyboard clips...");

      await handleSourceVideos(scriptText, currentDuration);

      // Step 4: Subtitle Sync & Sequencer Finalization
      setAutopilotStep(4);
      setAutopilotProgress(95);
      setAutopilotProgressMsg("Aligning CapCut-style dynamic subtitles & active word timestamps...");
      setAutopilotLog("Building multi-track video preview sequencer...");

      await new Promise(r => setTimeout(r, 500));

      setAutopilotProgress(100);
      setAutopilotProgressMsg("🎉 100% Video Production Complete!");
      setAutopilotLog("Timeline ready! Opening video preview console...");
      playProceduralSFX('sparkle');

      setTimeout(() => {
        setIsAutopilotRunning(false);
        setIsSourcingVideos(false);
      }, 1200);

    } catch (err: any) {
      console.error("Confirmed Script Production error:", err);
      setAppError(`Video Creation failed: ${err.message || err}`);
      setIsAutopilotRunning(false);
      setIsSourcingVideos(false);
      setAutopilotProgress(0);
    }
  };

  const handleAutopilotVideoGeneration = async (
    topicToUse: string,
    ratioToUse?: 'vertical' | 'horizontal' | 'square',
    durationToUse?: string,
    webSearch?: boolean
  ) => {
    if (ratioToUse) setVideoRatio(ratioToUse);
    if (durationToUse) setTargetVideoDuration(durationToUse);
    if (webSearch !== undefined) setUseWebSearchForVideo(webSearch);
    setScriptTopic(topicToUse);
    setCreatorInputMode('topic');
    setActiveTab('autopilot');
    await runUnifiedVideoCreation({ mode: 'topic', overrideTopic: topicToUse, overrideRatio: ratioToUse, overrideDuration: durationToUse });
  };


  // --- LIVE SESSION CORE (KORE AI PERSONA + FUNCTION CALLING) ---

  const startLiveAssistant = async () => {
    const activeApiKey = getEffectiveApiKey(user?.apiKey);
    if (!activeApiKey) {
      setAppError("Gemini API key required. Please configure your key in Profile settings.");
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
          sampleRate: 16000
        }
      });

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
      
      // Store in refs for complete lifecycle cleanup
      mediaStreamRef.current = stream;
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;

      await inputCtx.resume();
      await outputCtx.resume();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsLiveActive(true);
            setIsConnecting(false);
            setCallTimer(0);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = window.setInterval(() => setCallTimer(t => t + 1), 1000);
            
            // Automatically prompt Vixora AI to initiate the call and speak first!
            sessionPromise.then(session => {
              session.sendClientContent({
                turns: [
                  {
                    role: 'user',
                    parts: [
                      { text: `[System Event: The live voice call has connected! YOU MUST SPEAK FIRST RIGHT NOW TO INITIATE THE CALL! Greet ${user?.fullName || 'Creator'} with maximum enthusiasm in your signature energetic Nigerian Vixora persona, e.g. "How far my creator! Vixora live on line with you! Wetin we dey cook today?", and ask them what video topic or idea they want to create today!]` }
                    ]
                  }
                ],
                turnComplete: true
              });
            }).catch(console.error);

            const mediaSource = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(2048, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

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
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob })).catch(() => {});
            };
            mediaSource.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
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
                  functionResponses: [{ id: fc.id, name: fc.name, response: { output: result } }]
                })).catch(console.error);
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
          onerror: (e) => {
            console.error("Live assistant error:", e);
            const errStr = String((e as any)?.message || (e as any)?.error?.message || e || '');
            if (errStr.toLowerCase().includes('leaked') || errStr.toLowerCase().includes('api key')) {
              setAppError("API key error or key reported as invalid. Please enter your Gemini API key in Profile settings.");
            } else {
              setAppError("Live voice connection dropped. Please tap again to start call.");
            }
            stopLiveAssistant();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          tools: [{ functionDeclarations: [
            navigateToTabDeclaration,
            generateScriptDeclaration,
            sourceVideoDeclaration,
            createFullAutopilotVideoDeclaration,
            configureAndCreateAutopilotVideoDeclaration,
            setVideoPreferencesDeclaration,
            learnUserCustomSkillDeclaration,
            searchWebTrendsDeclaration
          ] }],
          systemInstruction: `You are 'Vixora' (Visora AI), the highly energetic, vibrant, warm, and brilliant Nigerian AI Creator Assistant & Video Producer! Address the user warmly by name (${user?.fullName || 'Creator'}). Your voice and vibe are 100% highly energetic, lively, witty, supportive, creative, and enthusiastic with authentic, warm Nigerian energy (e.g., "No wahala at all!", "Oya let's cook this viral masterpiece!", "I hear you crystal clear!"). Speak dynamically with high energy. No asterisks (*).

          CRITICAL CALL INITIATION RULE:
          When the user connects or calls you on this live session, YOU MUST START THE CONVERSATION FIRST! Do NOT wait silently for the user to talk. Speak immediately upon connection, greeting ${user?.fullName || 'Creator'} with your signature energetic Nigerian Vixora persona, welcoming them to the call, and asking what video topic or content idea you two are making today!

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
    } catch (err: any) {
      console.error("Failed to start live assistant:", err);
      setAppError(err?.message || "Microphone access denied or connection failed.");
      setIsConnecting(false);
    }
  };

  const stopLiveAssistant = () => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    
    // Stop all audio playback sources
    audioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    audioSourcesRef.current.clear();

    // Disconnect script processor
    if (scriptProcessorRef.current) {
      try { scriptProcessorRef.current.disconnect(); } catch(e) {}
      scriptProcessorRef.current = null;
    }

    // Close Audio Contexts
    if (inputAudioCtxRef.current) {
      try { inputAudioCtxRef.current.close(); } catch(e) {}
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      try { outputAudioCtxRef.current.close(); } catch(e) {}
      outputAudioCtxRef.current = null;
    }

    // Stop Media Tracks
    if (mediaStreamRef.current) {
      try { mediaStreamRef.current.getTracks().forEach(track => track.stop()); } catch(e) {}
      mediaStreamRef.current = null;
    }

    // Close Live Session WebSocket
    if (liveSessionRef.current) {
      try { liveSessionRef.current.close(); } catch(e) {}
      liveSessionRef.current = null;
    }

    setIsLiveActive(false);
    setIsConnecting(false);
    setLiveTranscription('');
    setMicVolumeLevel(0);
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
    <div className={`min-h-screen flex items-center justify-center p-4 sm:p-6 transition-colors duration-300 ${themeMode === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-white'}`}>
      <div className="w-full max-w-md space-y-6 animate-rise">
        {wizardStep === 0 ? (
          <div className={`text-center space-y-6 p-6 sm:p-8 rounded-3xl border shadow-2xl backdrop-blur-xl relative overflow-hidden ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900/90 border-white/10 text-white'}`}>
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-orange-500/20 blur-2xl pointer-events-none"></div>
            
            <div className="w-20 h-20 rounded-3xl mx-auto overflow-hidden shadow-[0_0_50px_rgba(255,102,0,0.4)] border border-white/20 bg-slate-900 p-2 flex items-center justify-center">
              <img src={vixoraLogo} alt="Vixora Logo" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-black uppercase tracking-tighter">VIXORA <span className="text-ggd-orange">STUDIO</span></h1>
              <p className={`text-[11px] font-bold uppercase tracking-widest ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>AI Video Creator & Voice Production Engine</p>
            </div>

            {/* Backend Integration Badge */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-left space-y-1">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-cloud text-xs"></i>
                <span className="text-[10px] font-black uppercase tracking-wider">Vixora Cloud Sync Active</span>
              </div>
              <p className="text-[9px] leading-normal opacity-90">
                Persistent video projects, cloud asset storage, and authenticated creator workspace ready.
              </p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => {
                  setAuthMode('signin');
                  setWizardStep(1);
                }} 
                className="w-full py-4 btn-3d btn-3d-orange font-black uppercase rounded-2xl text-xs tracking-wider shadow-2xl cursor-pointer"
              >
                Sign In to Studio
              </button>
              <button 
                onClick={() => {
                  setAuthMode('signup');
                  setWizardStep(1);
                }} 
                className={`w-full py-3.5 border font-black uppercase rounded-2xl text-xs tracking-wider transition-all cursor-pointer ${
                  themeMode === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
                }`}
              >
                Create New Account
              </button>
              <button 
                onClick={() => {
                  // Direct Instant Access for quick preview
                  const demoUser: UserProfile = {
                    fullName: 'Bethel Inco',
                    email: 'bethelincovibetv@gmail.com',
                    phone: '',
                    apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || '',
                    niche: 'finance'
                  };
                  setUser(demoUser);
                  localStorage.setItem('ggd_creator_user', JSON.stringify(demoUser));
                  setWizardStep(3);
                }} 
                className={`w-full py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  themeMode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚡ Quick Instant Creator Mode
              </button>
            </div>
          </div>
        ) : (
          <div className={`space-y-5 text-left p-6 sm:p-8 rounded-3xl border shadow-2xl backdrop-blur-xl relative ${
            themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900/90 border-white/10 text-white'
          }`}>
            {/* Header & Mode Switcher */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-tight">
                  {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                </h2>
                <span className="text-[9px] font-black uppercase text-ggd-orange px-2.5 py-1 rounded-lg bg-ggd-orange/15 border border-ggd-orange/30">
                  Cloud Account
                </span>
              </div>
              
              {/* Segmented Mode Selector */}
              <div className={`p-1 rounded-xl border flex items-center gap-1 ${
                themeMode === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/10'
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setAuthErrorMsg(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    authMode === 'signin'
                      ? 'bg-ggd-orange text-white shadow-md'
                      : themeMode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthErrorMsg(null);
                  }}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    authMode === 'signup'
                      ? 'bg-ggd-orange text-white shadow-md'
                      : themeMode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {authErrorMsg && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-red-500 shrink-0"></i>
                <span className="leading-snug">{authErrorMsg}</span>
              </div>
            )}
            
            <form onSubmit={handleSupabaseAuthSubmit} className="space-y-3.5">
              {authMode === 'signup' && (
                <div>
                  <label className={`text-[9px] font-black uppercase tracking-wider mb-1 block ${themeMode === 'light' ? 'text-slate-700' : 'text-slate-400'}`}>Full Name *</label>
                  <input 
                    type="text"
                    value={wizardData.fullName} 
                    onChange={e => setWizardData({...wizardData, fullName: e.target.value})} 
                    className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-ggd-orange text-xs ${
                      themeMode === 'light' 
                        ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400' 
                        : 'bg-white/5 border-white/10 text-white placeholder:text-slate-500'
                    }`} 
                    placeholder="e.g. Bethel Inco" 
                    required={authMode === 'signup'}
                  />
                </div>
              )}

              <div>
                <label className={`text-[9px] font-black uppercase tracking-wider mb-1 block ${themeMode === 'light' ? 'text-slate-700' : 'text-slate-400'}`}>Email Address *</label>
                <input 
                  type="email" 
                  value={wizardData.email || ''} 
                  onChange={e => setWizardData({...wizardData, email: e.target.value})} 
                  className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-ggd-orange text-xs ${
                    themeMode === 'light' 
                      ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400' 
                      : 'bg-white/5 border-white/10 text-white placeholder:text-slate-500'
                  }`} 
                  placeholder="e.g. creator@example.com" 
                  required
                />
              </div>

              <div>
                <label className={`text-[9px] font-black uppercase tracking-wider mb-1 block ${themeMode === 'light' ? 'text-slate-700' : 'text-slate-400'}`}>Password *</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={authPassword} 
                    onChange={e => setAuthPassword(e.target.value)} 
                    className={`w-full p-3 pr-10 border rounded-xl font-bold outline-none focus:border-ggd-orange text-xs ${
                      themeMode === 'light' 
                        ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400' 
                        : 'bg-white/5 border-white/10 text-white placeholder:text-slate-500'
                    }`} 
                    placeholder="Min. 6 characters" 
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${
                      themeMode === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-2.5">
                <button 
                  type="submit"
                  disabled={isAuthenticating}
                  className="btn-3d btn-3d-orange w-full py-3.5 font-black uppercase rounded-xl text-xs tracking-wider shadow-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAuthenticating ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin"></i>
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <span>{authMode === 'signin' ? 'Sign In & Open Studio' : 'Register Creator Account'}</span>
                  )}
                </button>
                
                <button 
                  type="button"
                  onClick={() => setWizardStep(0)} 
                  className={`w-full py-2 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    themeMode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ← Back to Welcome
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );

  const isVideoCreationView = activeTab === 'videos' || activeTab === 'autopilot';

  return (
    <div className={`w-full max-w-4xl lg:max-w-5xl mx-auto min-h-screen relative flex flex-col px-3 sm:px-6 pt-3 transition-colors duration-300 ${
      isVideoCreationView ? 'pb-8 sm:pb-12' : 'pb-32 sm:pb-36'
    } ${themeMode === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-white'}`}>
      
      {showAbout && (
        <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-rise">
           <div className={`w-full max-w-sm rounded-2xl p-6 border text-center space-y-4 relative shadow-2xl ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'}`}>
              <button onClick={() => setShowAbout(false)} className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center border ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white'}`}><i className="fa-solid fa-xmark"></i></button>
              <div className="w-16 h-16 rounded-2xl mx-auto overflow-hidden shadow-xl border border-ggd-orange/40 bg-slate-950 p-1 flex items-center justify-center">
                 <img src={vixoraLogo} alt="Vixora Logo" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tighter">Vixora <span className="text-ggd-orange">Voice Agent Studio</span></h2>
              <p className={`text-xs ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Powered by Google AI with Google Kore Voice integration.</p>
              <p className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em]">Vixora Voice Agent Studio</p>
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

      {/* GLOBAL URL-BASED NAVIGATION HEADER & DOCK (HIDDEN ON VIDEO CREATOR VIEW AS REQUESTED) */}
      {!isVideoCreationView && (
        <VixoraNavbar
          themeMode={themeMode}
          onToggleTheme={() => setThemeMode(prev => prev === 'light' ? 'dark' : 'light')}
          onOpenAccessibility={() => setShowAccessibilityModal(true)}
          onOpenProjects={() => setIsSidebarOpen(true)}
          onOpenGlobalApi={() => setShowGlobalApiModal(true)}
          onOpenExportModal={() => setShowNativeExportModal(true)}
          projectCount={projects.length}
          activeProjectTitle={projects.find(p => p.id === activeProjectId)?.title}
          isLiveActive={isLiveActive}
        />
      )}

      {/* PROJECTS DRAWER MODAL */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[350] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-rise">
          <div className={`w-full max-w-lg rounded-3xl p-6 border relative shadow-2xl space-y-4 max-h-[85vh] flex flex-col overflow-hidden ${
            themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-lg shadow-md">
                  <i className="fa-solid fa-folder-open"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight">Creation Projects Manager</h3>
                  <p className="text-[9px] text-amber-400 font-bold uppercase">All Saved Timelines & Drafts ({projects.length})</p>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                  themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white'
                }`}
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <ProjectsNavigationDrawer
                projects={projects}
                activeProjectId={activeProjectId}
                onSelectProject={(proj) => {
                  handleSelectProject(proj);
                  handleSelectTab('videos');
                }}
                onCreateNewProject={() => {
                  handleCreateNewProject();
                  handleSelectTab('videos');
                }}
                onDeleteProject={handleDeleteProject}
                onRenameProject={handleRenameProject}
                onDuplicateProject={handleDuplicateProject}
                themeMode={themeMode}
              />
            </div>
          </div>
        </div>
      )}

      <main className="w-full">
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
                 <div className="flex flex-col sm:flex-row gap-3">
                   <button 
                     onClick={() => setIsTextChatOpen(true)} 
                     className="btn-3d btn-3d-orange flex-1 py-3.5 text-xs tracking-widest shadow-lg flex items-center justify-center gap-2"
                   >
                     <i className="fa-solid fa-comments text-base"></i>
                     <span>Open AI Text Chat</span>
                   </button>
                   <button 
                     disabled={isConnecting} 
                     onClick={startLiveAssistant} 
                     className={`btn-3d flex-1 py-3.5 text-xs tracking-widest shadow-lg flex items-center justify-center gap-2 ${
                       themeMode === 'light' ? 'btn-3d-purple' : 'bg-slate-800 hover:bg-slate-700 text-white border border-white/20'
                     }`}
                   >
                     <i className="fa-solid fa-phone text-base"></i>
                     <span>{isConnecting ? 'Warming Up...' : 'Live Voice Call'}</span>
                   </button>
                 </div>
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

        {(activeTab === 'coach' || activeTab === 'scripts') && (
          <div className="animate-rise space-y-4">
            <VixoraContentMaster 
              themeMode={themeMode}
              onGenerateScriptForStudio={(scriptHook, topicTitle) => {
                setScriptTopic(topicTitle || scriptHook);
                setVideoScriptInput(scriptHook);
                handleSelectTab('videos');
              }}
              onCookAutopilotVideo={(topic, platform) => {
                setScriptTopic(topic);
                handleAutopilotVideoGeneration(topic);
              }}
              onUseTemplateInStudio={(tpl) => {
                if (tpl.targetDuration) setTargetVideoDuration(tpl.targetDuration);
                if (tpl.aspectRatio) setVideoRatio(tpl.aspectRatio);
                if (tpl.topic) setScriptTopic(tpl.topic);
                handleSelectTab('videos');
              }}
            />
          </div>
        )}

        {(activeTab === 'videos' || activeTab === 'autopilot') && (
          <div className="animate-rise space-y-4">
            {/* IMMERSIVE VIDEO CREATION TOP NAVIGATION BAR */}
            <div className={`p-2.5 sm:p-3 rounded-2xl border flex items-center justify-between gap-2 shadow-lg backdrop-blur-md sticky top-2 z-40 ${
              themeMode === 'light' ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-slate-900/95 border-white/10 text-white shadow-black/50'
            }`}>
              <button
                type="button"
                onClick={() => {
                  playProceduralSFX('click');
                  handleSelectTab('studio');
                }}
                className={`px-3 py-2 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all min-h-[40px] cursor-pointer active:scale-95 ${
                  themeMode === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                }`}
                title="Exit video creator and return to Voice Agent Studio"
              >
                <i className="fa-solid fa-arrow-left text-xs"></i>
                <span className="hidden sm:inline">Back to Studio</span>
                <span className="sm:hidden">Studio</span>
              </button>

              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
                <span className={`text-[11px] sm:text-xs font-black uppercase tracking-wider truncate ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  Video Creation Mode
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    playProceduralSFX('click');
                    setIsSidebarOpen(true);
                  }}
                  className={`px-2.5 py-2 rounded-xl border text-[10px] font-black uppercase flex items-center gap-1.5 transition-all min-h-[40px] cursor-pointer active:scale-95 ${
                    themeMode === 'light' ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                  }`}
                  title="Open Projects Library"
                >
                  <i className="fa-solid fa-folder-open text-amber-500"></i>
                  <span className="hidden md:inline">Projects ({projects.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playProceduralSFX('click');
                    setThemeMode(prev => prev === 'light' ? 'dark' : 'light');
                  }}
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                    themeMode === 'light' ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-slate-800 border-white/10 text-amber-300'
                  }`}
                  title={themeMode === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
                >
                  <i className={`fa-solid ${themeMode === 'light' ? 'fa-moon' : 'fa-sun'}`}></i>
                </button>
              </div>
            </div>

            {/* UNIFIED CREATOR HEADER */}
            <div className={`p-5 rounded-3xl border text-center relative overflow-hidden shadow-2xl ${themeMode === 'light' ? 'bg-gradient-to-br from-rose-500/10 via-amber-500/10 to-white border-rose-200 shadow-rose-500/5' : 'bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 border-rose-500/20'}`}>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white mx-auto flex items-center justify-center text-xl mb-2 shadow-lg">
                <i className="fa-solid fa-clapperboard"></i>
              </div>
              <h2 className={`text-xl sm:text-2xl font-black uppercase tracking-tight ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Vixora AI Video Creator
              </h2>
              <p className={`text-xs mt-1 font-medium max-w-md mx-auto ${themeMode === 'light' ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
                Unified AI Studio Video Production Engine. Generate faceless videos from a topic prompt or paste your custom script.
              </p>
            </div>

            {/* CORE MODE TOGGLE BAR: TOPIC VS SCRIPT */}
            <div className={`p-1.5 rounded-2xl border flex items-center gap-1.5 shadow-xl ${
              themeMode === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-white/10'
            }`}>
              <button
                type="button"
                onClick={() => setCreatorInputMode('topic')}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  creatorInputMode === 'topic'
                    ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg scale-[1.01]'
                    : themeMode === 'light' ? 'text-slate-800 hover:text-slate-950 hover:bg-white/80' : 'text-slate-400 hover:text-white'
                }`}
              >
                <i className={`fa-solid fa-wand-magic-sparkles text-sm ${creatorInputMode === 'topic' ? 'text-white' : themeMode === 'light' ? 'text-rose-600' : 'text-slate-400'}`}></i>
                <span>Create from Topic (AI Autopilot)</span>
              </button>

              <button
                type="button"
                onClick={() => setCreatorInputMode('script')}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  creatorInputMode === 'script'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg scale-[1.01]'
                    : themeMode === 'light' ? 'text-slate-800 hover:text-slate-950 hover:bg-white/80' : 'text-slate-400 hover:text-white'
                }`}
              >
                <i className={`fa-solid fa-scroll text-sm ${creatorInputMode === 'script' ? 'text-white' : themeMode === 'light' ? 'text-amber-600' : 'text-slate-400'}`}></i>
                <span>Create from Script (Manual)</span>
              </button>
            </div>

            {/* INPUT CONSOLE: CREATE FROM TOPIC MODE */}
            {creatorInputMode === 'topic' && (
              <div className={`p-4 sm:p-6 rounded-3xl border space-y-5 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
                {/* HEADER & RANDOMIZER */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                    <i className="fa-solid fa-bolt"></i> 1. Choose Viral Blueprint or Enter Topic
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allPrompts = VIRAL_PROMPT_NICHES.flatMap(n => n.prompts);
                      const randomPrompt = allPrompts[Math.floor(Math.random() * allPrompts.length)];
                      setScriptTopic(randomPrompt);
                      playProceduralSFX('sparkle');
                    }}
                    className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 transition-all border ${
                      themeMode === 'light' ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
                    }`}
                  >
                    <i className="fa-solid fa-dice text-xs animate-spin"></i>
                    <span>🎲 Surprise Viral Topic</span>
                  </button>
                </div>

                {/* VIRAL NICHE CATEGORY TABS */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                    {VIRAL_PROMPT_NICHES.map((niche) => {
                      const isActive = activeViralCategory === niche.id;
                      return (
                        <button
                          key={niche.id}
                          type="button"
                          onClick={() => setActiveViralCategory(niche.id)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1.5 transition-all ${
                            isActive
                              ? `bg-gradient-to-r ${niche.color} text-white shadow-md scale-105`
                              : themeMode === 'light'
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <i className={`fa-solid ${niche.icon} text-[10px]`}></i>
                          <span>{niche.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* PROMPT INSPIRATION CARDS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {VIRAL_PROMPT_NICHES.find(n => n.id === activeViralCategory)?.prompts.map((prompt) => {
                      const isSelected = scriptTopic === prompt;
                      return (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => {
                            setScriptTopic(prompt);
                            playProceduralSFX('click');
                          }}
                          className={`p-2.5 rounded-2xl text-left text-xs font-semibold transition-all border flex items-center justify-between gap-2 group ${
                            isSelected
                              ? 'bg-rose-500/15 border-rose-500 text-rose-500 shadow-md scale-[1.01]'
                              : themeMode === 'light'
                              ? 'bg-slate-50 hover:bg-rose-50/50 border-slate-200 text-slate-800 hover:border-rose-300'
                              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:border-rose-400/40'
                          }`}
                        >
                          <span className="line-clamp-2">{prompt}</span>
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] transition-all ${
                            isSelected ? 'bg-rose-500 text-white' : 'bg-black/10 group-hover:bg-rose-500 group-hover:text-white text-slate-400'
                          }`}>
                            <i className="fa-solid fa-arrow-right text-[9px]"></i>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3D TACTILE TOPIC INPUT FIELD */}
                <div className="space-y-1.5">
                  <div className={`p-1.5 rounded-2xl border-2 transition-all shadow-[inset_0_2px_5px_rgba(0,0,0,0.5),0_4px_12px_rgba(244,63,94,0.25)] flex items-center gap-2 ${themeMode === 'light' ? 'bg-gradient-to-b from-white to-slate-100 border-rose-400' : 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-rose-500/60'}`}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-rose-600 flex items-center justify-center text-white shrink-0 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),0_3px_0_#9f1239] border border-rose-300/40">
                      <i className="fa-solid fa-wand-magic-sparkles text-sm animate-pulse"></i>
                    </div>
                    <input 
                      value={scriptTopic} 
                      onChange={e => setScriptTopic(e.target.value)}
                      className={`w-full bg-transparent p-2 text-xs sm:text-sm font-black outline-none ${themeMode === 'light' ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-400'}`} 
                      placeholder="Enter custom video topic or select a viral blueprint above..." 
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
                  {scriptTopic && (
                    <div className="flex items-center justify-between px-1 text-[9px] font-bold text-slate-400">
                      <span>Ready to produce video for topic: <strong className="text-rose-400 font-black">"{scriptTopic.slice(0, 45)}{scriptTopic.length > 45 ? '...' : ''}"</strong></span>
                      <span>{scriptTopic.length} chars</span>
                    </div>
                  )}
                </div>

                {/* PRODUCTION OPTIONS TOOLBAR */}
                <div className="pt-3 text-left border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                      <i className="fa-solid fa-sliders text-rose-500"></i> 2. Configure Production Engine
                    </p>
                    <span className="text-[8.5px] font-black uppercase text-rose-400">Full Audio, Video & Subtitle Sync</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {/* TOOL 1: ASPECT RATIO */}
                    <div className={`p-3 rounded-2xl border flex flex-col justify-between gap-1.5 ${
                      themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-white/10'
                    }`}>
                      <span className="text-[9px] font-black uppercase text-rose-400 flex items-center gap-1">
                        <i className="fa-solid fa-mobile-screen"></i> Video Aspect Ratio
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setVideoRatio('vertical')}
                          className={`py-2 px-1.5 rounded-xl text-[9.5px] sm:text-[9px] font-black uppercase flex items-center justify-center gap-1 border transition-all min-h-[44px] ${videoRatio === 'vertical' ? 'bg-rose-500 text-white border-rose-400 shadow-md' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-rose-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                        >
                          <i className="fa-solid fa-mobile-screen text-[11px]"></i> 9:16
                        </button>
                        <button 
                          type="button"
                          onClick={() => setVideoRatio('horizontal')}
                          className={`py-2 px-1.5 rounded-xl text-[9.5px] sm:text-[9px] font-black uppercase flex items-center justify-center gap-1 border transition-all min-h-[44px] ${videoRatio === 'horizontal' ? 'bg-rose-500 text-white border-rose-400 shadow-md' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-rose-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                        >
                          <i className="fa-solid fa-display text-[11px]"></i> 16:9
                        </button>
                        <button 
                          type="button"
                          onClick={() => setVideoRatio('square')}
                          className={`py-2 px-1.5 rounded-xl text-[9.5px] sm:text-[9px] font-black uppercase flex items-center justify-center gap-1 border transition-all min-h-[44px] ${videoRatio === 'square' ? 'bg-rose-500 text-white border-rose-400 shadow-md' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-rose-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                        >
                          <i className="fa-solid fa-square text-[9px]"></i> 1:1
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
                      <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5">
                        {['15s', '30s', '1min', '2min', '3min', '5min'].map((dur) => (
                          <button 
                            key={dur}
                            type="button"
                            onClick={() => setTargetVideoDuration(dur)}
                            className={`py-1.5 px-2 rounded-xl text-[9px] sm:text-[8.5px] font-black uppercase border transition-all text-center min-h-[44px] sm:min-h-[38px] flex items-center justify-center ${targetVideoDuration === dur ? 'bg-amber-500 text-white border-amber-400 shadow-md' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-amber-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
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
                      <VoiceSelectorDropdown
                        selectedVoice={selectedVoice}
                        onSelectVoice={(voice) => setSelectedVoice(voice)}
                        previewingVoiceId={previewingVoiceId}
                        onPreviewVoice={handlePreviewVoice}
                        themeMode={themeMode}
                        label="Voiceover Character"
                      />
                    </div>

                    {/* TOOL 4: VIDEO NICHE CATEGORY */}
                    <div className={`p-3 rounded-2xl border flex flex-col justify-between gap-1.5 ${
                      themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-white/10'
                    }`}>
                      <span className="text-[9px] font-black uppercase text-emerald-400 flex items-center gap-1">
                        <i className="fa-solid fa-film"></i> Footage Niche Style
                      </span>
                      <select
                        value={selectedNicheFilter}
                        onChange={(e) => setSelectedNicheFilter(e.target.value)}
                        className={`w-full border text-[10px] sm:text-[9.5px] font-black uppercase py-2 px-3 rounded-xl outline-none cursor-pointer transition-all min-h-[48px] sm:min-h-[44px] ${
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

                    {/* TOOL 5: BACKGROUND MUSIC TRACK */}
                    <div className={`p-3 rounded-2xl border flex flex-col justify-between gap-1.5 ${
                      themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-white/10'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-purple-400 flex items-center gap-1">
                          <i className="fa-solid fa-music"></i> Background Music
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePlayCreatorBgMusic(globalMusicUrl)}
                          className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 transition-all ${
                            isCreatorMusicPlaying ? 'bg-purple-500 text-white animate-pulse' : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                          }`}
                        >
                          <i className={`fa-solid ${isCreatorMusicPlaying ? 'fa-pause' : 'fa-play'} text-[8px]`}></i>
                          <span>{isCreatorMusicPlaying ? 'Stop' : 'Preview'}</span>
                        </button>
                      </div>
                      <select
                        value={globalMusicUrl}
                        onChange={(e) => {
                          setGlobalMusicUrl(e.target.value);
                          if (isCreatorMusicPlaying) {
                            togglePlayCreatorBgMusic(e.target.value);
                          }
                        }}
                        className={`w-full border text-[10px] sm:text-[9.5px] font-black uppercase py-2 px-3 rounded-xl outline-none cursor-pointer transition-all min-h-[48px] sm:min-h-[44px] ${
                          themeMode === 'light'
                            ? 'bg-white border-slate-300 text-slate-900 hover:border-purple-400'
                            : 'bg-slate-900 border-white/20 text-white hover:border-purple-400'
                        }`}
                      >
                        {PRESET_MUSIC_TRACKS.map((t) => (
                          <option key={t.id} value={t.url}>
                            🎵 {t.name} ({t.mood})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* TOOL 6: GOOGLE WEB TRENDS */}
                    <div className={`p-3 rounded-2xl border flex flex-col justify-between gap-1.5 ${
                      themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-white/10'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-cyan-400 flex items-center gap-1">
                          <i className="fa-solid fa-globe"></i> Google Web Trends
                        </span>
                        <span className={`px-2 py-0.5 text-[8px] font-black rounded uppercase ${useWebSearchForVideo ? 'bg-cyan-400 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
                          {useWebSearchForVideo ? 'ACTIVE' : 'OFF'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUseWebSearchForVideo(!useWebSearchForVideo)}
                        className={`w-full py-2 px-3 rounded-xl border text-[9.5px] font-black uppercase flex items-center justify-center gap-2 transition-all min-h-[48px] sm:min-h-[44px] ${
                          useWebSearchForVideo 
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md' 
                            : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <i className="fa-solid fa-globe text-xs"></i>
                        <span>{useWebSearchForVideo ? 'Real-Time Web Data ON' : 'Enable Real-Time Search'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* DUAL LAUNCH ACTION BUTTONS */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* BUTTON 1: 1-CLICK FAST RENDER */}
                  <button 
                    disabled={isAutopilotRunning || isSourcingVideos || !scriptTopic.trim()} 
                    onClick={() => runUnifiedVideoCreation({ mode: 'topic', skipReview: true })} 
                    className="btn-3d btn-3d-orange w-full py-4 px-3 text-xs sm:text-sm font-black uppercase tracking-wider shadow-2xl flex items-center justify-center gap-2"
                  >
                    {isAutopilotRunning || isSourcingVideos ? (
                      <>
                        <i className="fa-solid fa-spinner animate-spin text-sm"></i>
                        <span>Cooking Video ({autopilotProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-bolt text-sm animate-pulse text-amber-300"></i>
                        <span>⚡ 1-Click Cook ({targetVideoDuration} {videoRatio === 'vertical' ? 'Short' : videoRatio === 'horizontal' ? '16:9' : '1:1'})</span>
                      </>
                    )}
                  </button>

                  {/* BUTTON 2: STEP-BY-STEP REVIEW & CUSTOMIZE */}
                  <button 
                    disabled={isAutopilotRunning || isSourcingVideos || !scriptTopic.trim()} 
                    onClick={() => runUnifiedVideoCreation({ mode: 'topic', skipReview: false })} 
                    className={`w-full py-4 px-3 rounded-2xl border-2 text-xs sm:text-sm font-black uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 transition-all active:scale-98 ${
                      themeMode === 'light'
                        ? 'bg-slate-900 text-white border-slate-800 hover:bg-slate-800'
                        : 'bg-white/10 text-white border-white/20 hover:bg-white/15'
                    }`}
                  >
                    <i className="fa-solid fa-pen-to-square text-sm text-amber-400"></i>
                    <span>📝 Review & Customize Script First</span>
                  </button>
                </div>
              </div>
            )}

            {/* INPUT CONSOLE: CREATE FROM SCRIPT MODE */}
            {creatorInputMode === 'script' && (
              <div className={`p-4 sm:p-6 rounded-3xl border space-y-5 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <label className="text-xs font-black uppercase tracking-wider text-orange-500 flex items-center gap-1.5">
                    <i className="fa-solid fa-pen-to-square"></i> Video Script & Narration Text
                  </label>
                  <div className="flex items-center gap-2">
                    {generatedScript && (
                      <button 
                        onClick={() => setVideoScriptInput(generatedScript)} 
                        className="text-xs font-bold uppercase text-orange-500 hover:underline flex items-center gap-1"
                      >
                        <i className="fa-solid fa-file-import"></i> Paste Generated Script
                      </button>
                    )}
                  </div>
                </div>

                {/* SCRIPT METRICS HUD */}
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                  <span className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-300'}`}>
                    <i className="fa-solid fa-font text-orange-400"></i>
                    <span>{videoScriptInput.trim().split(/\s+/).filter(Boolean).length} Words</span>
                  </span>
                  <span className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-300'}`}>
                    <i className="fa-solid fa-clock text-amber-400"></i>
                    <span>~{Math.max(5, Math.round(videoScriptInput.trim().split(/\s+/).filter(Boolean).length / 2.3))}s Spoken Audio</span>
                  </span>
                  <span className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-slate-300'}`}>
                    <i className="fa-solid fa-film text-emerald-400"></i>
                    <span>~{Math.max(2, Math.round(videoScriptInput.trim().split(/\s+/).filter(Boolean).length / 15))} Scene Cuts</span>
                  </span>
                </div>

                {/* 1-TAP AI SCRIPT POLISHERS */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <i className="fa-solid fa-wand-magic-sparkles text-amber-400"></i> 1-Tap AI Script Polishers
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      disabled={isEnhancingScript || !videoScriptInput.trim()}
                      onClick={() => handleEnhanceScript('hook')}
                      className={`p-2 rounded-xl border text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                        themeMode === 'light' ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800' : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      <i className={`fa-solid fa-bolt text-[10px] ${isEnhancingScript ? 'animate-spin' : ''}`}></i>
                      <span>⚡ Punchy Hook</span>
                    </button>
                    <button
                      type="button"
                      disabled={isEnhancingScript || !videoScriptInput.trim()}
                      onClick={() => handleEnhanceScript('condense')}
                      className={`p-2 rounded-xl border text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                        themeMode === 'light' ? 'bg-cyan-50 hover:bg-cyan-100 border-cyan-200 text-cyan-800' : 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                      }`}
                    >
                      <i className={`fa-solid fa-scissors text-[10px] ${isEnhancingScript ? 'animate-spin' : ''}`}></i>
                      <span>✂️ 30s Pacing</span>
                    </button>
                    <button
                      type="button"
                      disabled={isEnhancingScript || !videoScriptInput.trim()}
                      onClick={() => handleEnhanceScript('emotional')}
                      className={`p-2 rounded-xl border text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                        themeMode === 'light' ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-800' : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <i className={`fa-solid fa-fire text-[10px] ${isEnhancingScript ? 'animate-spin' : ''}`}></i>
                      <span>🔥 Emotional Fire</span>
                    </button>
                    <button
                      type="button"
                      disabled={isEnhancingScript || !videoScriptInput.trim()}
                      onClick={() => handleEnhanceScript('cta')}
                      className={`p-2 rounded-xl border text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                        themeMode === 'light' ? 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-800' : 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-300'
                      }`}
                    >
                      <i className={`fa-solid fa-bullhorn text-[10px] ${isEnhancingScript ? 'animate-spin' : ''}`}></i>
                      <span>📢 Viral CTA</span>
                    </button>
                  </div>
                </div>

                <textarea 
                  value={videoScriptInput} 
                  onChange={e => setVideoScriptInput(e.target.value)} 
                  className={`w-full h-36 border rounded-2xl p-4 text-sm outline-none focus:border-orange-500 resize-none font-medium leading-relaxed ${themeMode === 'light' ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/10 text-white'}`} 
                  placeholder="Paste your video script here to fetch stock video clips and assemble your timeline..." 
                />

                {/* PRODUCTION OPTIONS TOOLBAR */}
                <div className="pt-2 text-left border-t border-white/10 space-y-3">
                  <p className="text-[9.5px] font-black uppercase text-slate-400 mb-2.5 flex items-center gap-1.5">
                    <i className="fa-solid fa-sliders text-orange-500"></i> Configure Production Options
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {/* TOOL 1: ASPECT RATIO */}
                    <div className={`p-3 rounded-2xl border flex flex-col justify-between gap-1.5 ${
                      themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-white/10'
                    }`}>
                      <span className="text-[9px] font-black uppercase text-rose-400 flex items-center gap-1">
                        <i className="fa-solid fa-mobile-screen"></i> Video Aspect Ratio
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setVideoRatio('vertical')}
                          className={`py-2 px-1.5 rounded-xl text-[9.5px] sm:text-[9px] font-black uppercase flex items-center justify-center gap-1 border transition-all min-h-[44px] ${videoRatio === 'vertical' ? 'bg-orange-500 text-white border-orange-400 shadow-md' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-orange-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                        >
                          <i className="fa-solid fa-mobile-screen text-[11px]"></i> 9:16
                        </button>
                        <button 
                          type="button"
                          onClick={() => setVideoRatio('horizontal')}
                          className={`py-2 px-1.5 rounded-xl text-[9.5px] sm:text-[9px] font-black uppercase flex items-center justify-center gap-1 border transition-all min-h-[44px] ${videoRatio === 'horizontal' ? 'bg-orange-500 text-white border-orange-400 shadow-md' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-orange-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                        >
                          <i className="fa-solid fa-display text-[11px]"></i> 16:9
                        </button>
                        <button 
                          type="button"
                          onClick={() => setVideoRatio('square')}
                          className={`py-2 px-1.5 rounded-xl text-[9.5px] sm:text-[9px] font-black uppercase flex items-center justify-center gap-1 border transition-all min-h-[44px] ${videoRatio === 'square' ? 'bg-orange-500 text-white border-orange-400 shadow-md' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-orange-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                        >
                          <i className="fa-solid fa-square text-[9px]"></i> 1:1
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
                      <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5">
                        {['15s', '30s', '1min', '2min', '3min', '5min'].map((dur) => (
                          <button 
                            key={dur}
                            type="button"
                            onClick={() => setTargetVideoDuration(dur)}
                            className={`py-1.5 px-2 rounded-xl text-[9px] sm:text-[8.5px] font-black uppercase border transition-all text-center min-h-[44px] sm:min-h-[38px] flex items-center justify-center ${targetVideoDuration === dur ? 'bg-amber-500 text-white border-amber-400 shadow-md' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-amber-300' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
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
                      <VoiceSelectorDropdown
                        selectedVoice={selectedVoice}
                        onSelectVoice={(voice) => setSelectedVoice(voice)}
                        previewingVoiceId={previewingVoiceId}
                        onPreviewVoice={handlePreviewVoice}
                        themeMode={themeMode}
                        label="Voiceover Character"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  disabled={isSourcingVideos || isAutopilotRunning || !videoScriptInput.trim()} 
                  onClick={() => runUnifiedVideoCreation({ mode: 'script' })} 
                  className="btn-3d btn-3d-orange w-full py-4 px-3 text-xs sm:text-sm font-black uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSourcingVideos || isAutopilotRunning ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin"></i>
                      <span>Sourcing HD Footage & Assembling Package ({autopilotProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-wand-magic-sparkles text-base"></i>
                      <span>🎬 Generate Video from Script</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* EDITABLE SCRIPT REVIEW CONSOLE */}
            {isReviewingScript && (
              <div className={`p-5 sm:p-6 rounded-3xl border-2 space-y-4 shadow-2xl relative overflow-hidden animate-rise ${
                themeMode === 'light'
                  ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-white border-amber-400'
                  : 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border-amber-500/50'
              }`}>
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center font-black text-lg shadow-lg shrink-0">
                      <i className="fa-solid fa-pen-to-square"></i>
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-500 flex items-center gap-2">
                        <span>Review & Polish Script</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-extrabold border border-amber-500/40">
                          Pre-Voiceover Check
                        </span>
                      </h3>
                      <p className={`text-xs mt-0.5 font-medium ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                        Read and edit the generated script. Use 1-tap AI tools below or tweak words directly before synthesizing audio.
                      </p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsReviewingScript(false)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-all"
                    title="Dismiss review mode"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                {/* SCRIPT METRICS & AI POLISHERS */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold">
                      <span className={`px-2.5 py-0.5 rounded-lg border ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700' : 'bg-black/40 border-white/10 text-slate-300'}`}>
                        📝 {videoScriptInput.trim().split(/\s+/).filter(Boolean).length} Words
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-lg border ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700' : 'bg-black/40 border-white/10 text-slate-300'}`}>
                        ⏱️ ~{Math.max(5, Math.round(videoScriptInput.trim().split(/\s+/).filter(Boolean).length / 2.3))}s Audio
                      </span>
                    </div>

                    {/* QUICK AI POLISHER CHIPS */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isEnhancingScript}
                        onClick={() => handleEnhanceScript('hook')}
                        className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase flex items-center gap-1 border transition-all ${
                          themeMode === 'light' ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800' : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300'
                        }`}
                      >
                        <i className={`fa-solid fa-bolt text-[8px] ${isEnhancingScript ? 'animate-spin' : ''}`}></i>
                        <span>⚡ Hook</span>
                      </button>
                      <button
                        type="button"
                        disabled={isEnhancingScript}
                        onClick={() => handleEnhanceScript('condense')}
                        className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase flex items-center gap-1 border transition-all ${
                          themeMode === 'light' ? 'bg-cyan-50 hover:bg-cyan-100 border-cyan-300 text-cyan-800' : 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500/40 text-cyan-300'
                        }`}
                      >
                        <i className={`fa-solid fa-scissors text-[8px] ${isEnhancingScript ? 'animate-spin' : ''}`}></i>
                        <span>✂️ 30s Trim</span>
                      </button>
                      <button
                        type="button"
                        disabled={isEnhancingScript}
                        onClick={() => handleEnhanceScript('emotional')}
                        className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase flex items-center gap-1 border transition-all ${
                          themeMode === 'light' ? 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-800' : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-300'
                        }`}
                      >
                        <i className={`fa-solid fa-fire text-[8px] ${isEnhancingScript ? 'animate-spin' : ''}`}></i>
                        <span>🔥 Fire</span>
                      </button>
                      <button
                        type="button"
                        disabled={isEnhancingScript}
                        onClick={() => handleEnhanceScript('cta')}
                        className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase flex items-center gap-1 border transition-all ${
                          themeMode === 'light' ? 'bg-purple-50 hover:bg-purple-100 border-purple-300 text-purple-800' : 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/40 text-purple-300'
                        }`}
                      >
                        <i className={`fa-solid fa-bullhorn text-[8px] ${isEnhancingScript ? 'animate-spin' : ''}`}></i>
                        <span>📢 CTA</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={videoScriptInput}
                    onChange={(e) => setVideoScriptInput(e.target.value)}
                    rows={7}
                    className={`w-full border rounded-2xl p-4 text-sm outline-none focus:border-amber-500 resize-y font-medium leading-relaxed shadow-inner ${
                      themeMode === 'light' 
                        ? 'bg-white border-amber-300 text-slate-900 focus:ring-2 focus:ring-amber-400/20' 
                        : 'bg-black/60 border-amber-500/40 text-white focus:ring-2 focus:ring-amber-500/20'
                    }`}
                    placeholder="Type or edit script text here..."
                  />
                </div>

                {/* CONFIRM & PROCEED ACTIONS */}
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="button"
                    disabled={!videoScriptInput.trim() || isAutopilotRunning}
                    onClick={() => startProductionWithConfirmedScript()}
                    className="btn-3d btn-3d-orange flex-1 py-4 text-xs font-black uppercase tracking-wider shadow-2xl flex items-center justify-center gap-2"
                  >
                    <i className="fa-solid fa-microphone-lines text-base"></i>
                    <span>🎙️ Confirm Script & Cook Video →</span>
                  </button>

                  {creatorInputMode === 'topic' && (
                    <button
                      type="button"
                      disabled={isGeneratingScript || isAutopilotRunning}
                      onClick={async () => {
                        setIsGeneratingScript(true);
                        const newScript = await handleGenerateScript(scriptTopic, useWebSearchForVideo, targetVideoDuration);
                        setIsGeneratingScript(false);
                        if (newScript) {
                          setVideoScriptInput(newScript);
                          setGeneratedScript(newScript);
                        }
                      }}
                      className={`px-5 py-4 border rounded-2xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                        themeMode === 'light'
                          ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                          : 'bg-white/10 hover:bg-white/20 border-white/20 text-slate-200'
                      }`}
                    >
                      <i className={`fa-solid fa-arrows-rotate ${isGeneratingScript ? 'animate-spin' : ''}`}></i>
                      <span>Regenerate AI Script</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* LIVE 3D TACTILE CREATION PERCENTAGE PROGRESS ANIMATION CARD */}
            {(isAutopilotRunning || isSourcingVideos) && (
              <div className="bg-gradient-to-br from-slate-950 via-rose-950/80 to-slate-950 border-2 border-rose-500/60 rounded-3xl p-6 text-center space-y-5 shadow-2xl animate-rise relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/15 rounded-full blur-3xl pointer-events-none"></div>

                {/* 3D GLOWING PERCENTAGE BADGE */}
                <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-rose-500 via-purple-500 to-amber-500 animate-spin blur-md opacity-70"></div>
                  <div className="relative w-24 h-24 rounded-full bg-slate-950 border-4 border-rose-400/80 flex flex-col items-center justify-center shadow-2xl">
                    <span className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-300 to-amber-300 drop-shadow-md">
                      {autopilotProgress || 50}%
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-rose-400">COOKING</span>
                  </div>
                </div>

                {/* ANIMATED PROGRESS BAR */}
                <div className="space-y-1.5 max-w-md mx-auto">
                  <div className="w-full h-3.5 bg-black/60 rounded-full border border-white/10 p-0.5 overflow-hidden shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-rose-500 via-purple-500 to-cyan-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(244,63,94,0.8)]"
                      style={{ width: `${Math.max(5, autopilotProgress || 50)}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] font-black text-rose-300 tracking-wider uppercase animate-pulse">
                    {autopilotProgressMsg || "Processing video assets..."}
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

            {/* SHARED DOWNSTREAM OUTPUT: TIMELINE SEQUENCER CONSOLE */}
            {sourcedVideos.length > 0 && (
              <div className={`p-5 rounded-3xl border space-y-4 shadow-2xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-white/10'}`}>
                <div className="flex items-center justify-between border-b pb-3 border-white/10">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-film text-orange-500 text-sm"></i>
                    <h3 className="text-xs font-black uppercase tracking-wider">Project Timeline ({sourcedVideos.length} Clips)</h3>
                  </div>
                  <button onClick={downloadAllVideos} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black uppercase flex items-center gap-2 text-white shadow-lg active:scale-95 transition-all">
                    <i className="fa-solid fa-download"></i> Download HD Package
                  </button>
                </div>

                <div className="space-y-3">
                  <VideoSequencer 
                    scriptText={videoScriptInput || scriptTopic || generatedScript || "Video Timeline"} 
                    voiceoverBase64={lastVoiceoverAudio} 
                    sourcedVideos={sourcedVideos} 
                    targetDuration={targetVideoDuration}
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
                        <strong className="font-bold text-blue-300">Creator Tip:</strong> Voiceover narration audio will automatically sync inside this video timeline!
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10 text-left">
                  <h4 className="text-xs font-black uppercase text-slate-400">Sourced HD Clips Gallery</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1 scrollbar-hide">
                    {sourcedVideos.map((video, idx) => (
                      <div key={video.id} className="relative rounded-2xl overflow-hidden group bg-slate-800 border border-white/10 shadow-md">
                        <img src={video.image} className="w-full h-24 object-cover opacity-85 group-hover:scale-105 transition-all duration-300" alt="" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 flex flex-col justify-end p-2.5 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                          <span className="text-xs font-black text-white uppercase tracking-wider">Clip {idx + 1}</span>
                          <a 
                            href={video.video_files?.find(f => f.quality === 'hd')?.link || video.video_files?.[0]?.link || video.url} 
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
                      
                      {/* INLINE PLAYABLE VIDEO PREVIEW */}
                      <div className="relative rounded-xl overflow-hidden bg-black border border-white/10 shadow-inner">
                        <video 
                          src={video.videoUrl} 
                          controls 
                          preload="metadata" 
                          className="w-full h-48 object-contain bg-slate-950" 
                          playsInline
                        />
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
          <div className="animate-rise space-y-4 text-left">
             {/* VIXORA STUDIO VOICE FLAGSHIP HERO & STUDIO CONTROLS */}
             <div className={`rounded-3xl p-6 border space-y-5 shadow-2xl relative overflow-hidden ${
               themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-white/10'
             }`}>
                {/* Background Ambient Glow */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-ggd-orange/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

                {/* SIGNATURE VIXORA STUDIO VOICE PROFILE BANNER */}
                <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10 shadow-lg ${
                  themeMode === 'light' 
                    ? 'bg-gradient-to-r from-orange-50 via-amber-50 to-white border-orange-200' 
                    : 'bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900/90 border-orange-500/30'
                }`}>
                  {(() => {
                    const currentVo = VOICE_AVATAR_OPTIONS.find(v => v.voiceName === selectedVoice) || VOICE_AVATAR_OPTIONS[0];
                    const isPreviewing = previewingVoiceId === currentVo.id;
                    return (
                      <>
                        <div className="flex items-center gap-4">
                          <div className="relative shrink-0">
                            <img 
                              src={currentVo.avatar} 
                              alt={currentVo.name} 
                              className="w-16 h-16 rounded-2xl object-cover border-2 border-ggd-orange shadow-xl"
                              referrerPolicy="no-referrer"
                            />
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full shadow-[0_0_10px_#10b981] flex items-center justify-center">
                              <i className="fa-solid fa-check text-[7px] text-white"></i>
                            </span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                                {currentVo.name}
                              </h3>
                              <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase bg-ggd-orange text-white shadow-sm flex items-center gap-1">
                                <i className="fa-solid fa-bolt text-[7px]"></i>
                                {currentVo.badge || 'OFFICIAL VIXORA STUDIO VOICE'}
                              </span>
                            </div>
                            <p className="text-[10px] font-medium leading-relaxed max-w-xl text-slate-600 dark:text-slate-300">
                              {currentVo.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            disabled={isPreviewing}
                            onClick={() => handlePreviewVoice(currentVo)}
                            className={`px-3.5 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 shadow-md transition-all active:scale-95 ${
                              isPreviewing
                                ? 'bg-ggd-orange text-white animate-pulse'
                                : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:brightness-110'
                            }`}
                          >
                            {isPreviewing ? (
                              <>
                                <i className="fa-solid fa-spinner animate-spin"></i>
                                <span>Sampling...</span>
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-play text-[8px]"></i>
                                <span>Preview Audio</span>
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* VOICE AVATARS SELECTION PALETTE */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-wider text-ggd-orange flex items-center gap-1.5">
                      <i className="fa-solid fa-microphone-lines"></i> Select Studio Voice Engine
                    </label>
                    <span className="text-[8px] font-black uppercase text-slate-400">Click avatar to select voice profile</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                    {VOICE_AVATAR_OPTIONS.map((v) => {
                      const isSelected = selectedVoice === v.voiceName;
                      const isPreviewingThis = previewingVoiceId === v.id;
                      return (
                        <div
                          key={v.id}
                          onClick={() => setSelectedVoice(v.voiceName)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between group ${
                            isSelected
                              ? 'bg-ggd-orange/15 border-ggd-orange shadow-md ring-2 ring-ggd-orange/30'
                              : themeMode === 'light'
                                ? 'bg-slate-50 border-slate-200 hover:border-ggd-orange/40 hover:bg-orange-50/40'
                                : 'bg-slate-950/60 border-white/10 hover:border-white/20 hover:bg-white/5'
                          }`}
                        >
                          {v.isVixoraVoice && (
                            <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-ggd-orange text-white text-[7px] font-black uppercase shadow tracking-tight">
                              Official
                            </span>
                          )}

                          <div className="flex items-center gap-2 mb-2">
                            <img
                              src={v.avatar}
                              alt={v.name}
                              className={`w-9 h-9 rounded-xl object-cover shrink-0 shadow-sm border ${
                                isSelected ? 'border-ggd-orange' : 'border-slate-300 dark:border-white/10'
                              }`}
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 flex-1">
                              <p className={`text-[9.5px] font-black uppercase truncate ${
                                isSelected ? 'text-ggd-orange' : themeMode === 'light' ? 'text-slate-900' : 'text-white'
                              }`}>
                                {v.voiceName}
                              </p>
                              <p className="text-[7.5px] font-bold uppercase truncate text-slate-500 dark:text-slate-400">
                                {v.gender} • {v.flag || '🎙️'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-200 dark:border-white/5">
                            <span className={`text-[7.5px] font-black uppercase truncate ${isSelected ? 'text-ggd-orange' : 'text-slate-400'}`}>
                              {isSelected ? '✓ Selected' : 'Choose'}
                            </span>
                            <button
                              type="button"
                              disabled={isPreviewingThis}
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreviewVoice(v);
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[7.5px] font-black uppercase flex items-center gap-1 transition-all shrink-0 ${
                                isPreviewingThis
                                  ? 'bg-ggd-orange text-white animate-pulse'
                                  : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white hover:bg-ggd-orange hover:text-white'
                              }`}
                              title={`Preview ${v.name}'s voice`}
                            >
                              <i className={`fa-solid ${isPreviewingThis ? 'fa-spinner animate-spin' : 'fa-play text-[6px]'}`}></i>
                              <span>{isPreviewingThis ? 'Playing' : 'Test'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* VIXORA PRESET INSPIRATION HOOKS */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <i className="fa-solid fa-wand-magic-sparkles text-ggd-orange"></i> Vixora Studio Voice Audio Presets
                    </label>
                    <span className="text-[8px] font-bold uppercase text-slate-400">Click to load preset script hook</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      {
                        title: '⚡ Viral Shorts Hook',
                        text: "Stop scrolling right now! If you're looking to scale your online income this year, here are three simple secrets top creators never tell you."
                      },
                      {
                        title: '🎬 Cinematic Narrative',
                        text: "In a world of constant noise and endless distractions, one historic technological shift is quietly reshaping our future forever."
                      },
                      {
                        title: '💡 Tech Explainer',
                        text: "Here is the exact step-by-step breakdown to automate your full video production workflow in less than two minutes."
                      },
                      {
                        title: '🔥 High-Energy Motivation',
                        text: "Your only limitation is the hesitation inside your mind. Push through the doubt, take action today, and claim your success."
                      },
                      {
                        title: '🎙️ Podcast Host',
                        text: "Welcome back to another studio session! Grab your headphones, get comfortable, and let's jump straight into today's deep dive."
                      }
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setVoiceoverText(preset.text);
                          setSelectedVoice('Kore');
                          playProceduralSFX('sparkle');
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-[8.5px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 ${
                          voiceoverText === preset.text
                            ? 'bg-ggd-orange text-white border-ggd-orange shadow-md'
                            : themeMode === 'light'
                              ? 'bg-slate-100 border-slate-200 text-slate-700 hover:border-ggd-orange/40 hover:bg-orange-50'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:border-ggd-orange/40 hover:bg-white/10'
                        }`}
                      >
                        <span>{preset.title}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* SCRIPT INPUT AREA WITH WORD / TIME COUNTER */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Voiceover Script Text
                    </label>
                    <div className="flex items-center gap-3">
                      {generatedScript && (
                        <button 
                          onClick={() => {
                            setVoiceoverText(generatedScript);
                            playProceduralSFX('sparkle');
                          }} 
                          className="text-[8px] font-bold uppercase text-ggd-orange hover:underline flex items-center gap-1"
                        >
                          <i className="fa-solid fa-file-import"></i> Import Active Script
                        </button>
                      )}
                      {videoScriptInput && videoScriptInput !== generatedScript && (
                        <button 
                          onClick={() => {
                            setVoiceoverText(videoScriptInput);
                            playProceduralSFX('sparkle');
                          }} 
                          className="text-[8px] font-bold uppercase text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <i className="fa-solid fa-video"></i> Import Video Script
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea 
                    value={voiceoverText} 
                    onChange={e => setVoiceoverText(e.target.value)} 
                    className={`w-full h-32 border rounded-2xl p-4 text-xs outline-none focus:border-ggd-orange font-medium leading-relaxed transition-all ${
                      themeMode === 'light' 
                        ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400' 
                        : 'bg-black/50 border-white/10 text-white placeholder:text-slate-500'
                    }`} 
                    placeholder="Type or paste any text here for Vixora Studio Voice to synthesize into crystal-clear audio narration..." 
                  />

                  {/* SPEED MULTIPLIER & METRICS BAR */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    {/* Speed Selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] font-black uppercase text-slate-400 mr-1 flex items-center gap-1">
                        <i className="fa-solid fa-gauge-high"></i> Speed:
                      </span>
                      {[
                        { label: '0.85x Relaxed', value: 0.85 },
                        { label: '1.0x Natural', value: 1.0 },
                        { label: '1.15x Fast Viral', value: 1.15 },
                        { label: '1.3x Hyper', value: 1.3 },
                      ].map(spd => (
                        <button
                          key={spd.value}
                          type="button"
                          onClick={() => setVoiceoverSpeed(spd.value)}
                          className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${
                            voiceoverSpeed === spd.value
                              ? 'bg-ggd-orange text-white shadow-sm'
                              : themeMode === 'light'
                                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                : 'bg-white/10 text-slate-300 hover:bg-white/20'
                          }`}
                        >
                          {spd.label}
                        </button>
                      ))}
                    </div>

                    {/* Word & Estimated Duration Stats */}
                    {voiceoverText.trim() && (
                      <div className="flex items-center gap-2 text-[8.5px] font-mono text-slate-400">
                        <span>{voiceoverText.trim().split(/\s+/).length} words</span>
                        <span>•</span>
                        <span className="text-ggd-orange font-bold">
                          ~{Math.max(2, Math.round((voiceoverText.trim().split(/\s+/).length / 140) * 60 / (voiceoverSpeed || 1.0)))}s audio
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* PRIMARY GENERATION ACTION BUTTON */}
                <button 
                  disabled={isGeneratingVoiceover || !voiceoverText.trim()} 
                  onClick={() => handleGenerateVoiceover()} 
                  className="btn-3d btn-3d-orange w-full py-4 text-xs tracking-wider shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                   {isGeneratingVoiceover ? (
                     <>
                       <i className="fa-solid fa-spinner animate-spin text-sm"></i>
                       <span>Vixora Studio Engine Synthesizing Voiceover...</span>
                     </>
                   ) : (
                     <>
                       <i className="fa-solid fa-microphone-lines text-sm"></i>
                       <span>Synthesize with Vixora Studio Voice ({selectedVoice})</span>
                     </>
                   )}
                </button>
             </div>

             {/* ACTIVE PLAYBACK & TIMELINE INTEGRATION CONSOLE */}
             {activeVoiceoverId && (
                <div className={`p-5 border rounded-3xl space-y-4 shadow-2xl animate-rise ${
                  themeMode === 'light' ? 'bg-gradient-to-r from-orange-50/80 to-amber-50/80 border-orange-200' : 'bg-gradient-to-r from-orange-950/30 via-slate-900 to-slate-900 border-orange-500/30'
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3.5">
                      <div className="relative shrink-0">
                        <img 
                          src={vixoraAgentAvatar} 
                          alt="Vixora Studio" 
                          className="w-12 h-12 rounded-2xl border-2 border-ggd-orange object-cover shadow-md" 
                          referrerPolicy="no-referrer"
                        />
                        {isVoiceoverPlaying && (
                          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-ggd-orange"></span>
                          </span>
                        )}
                      </div>
                      <div className="text-left space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black uppercase text-ggd-orange tracking-wider flex items-center gap-1">
                            <i className="fa-solid fa-circle-play"></i> Active Playback • Vixora Studio Voice
                          </span>
                          <span className="text-[7.5px] px-2 py-0.5 rounded-full bg-ggd-orange/15 text-ggd-orange font-bold uppercase">
                            {voiceoverSpeed}x Speed
                          </span>
                        </div>
                        <p className="text-xs font-black uppercase truncate max-w-md text-slate-900 dark:text-white">
                          {voiceoverHistory.find(h => h.id === activeVoiceoverId)?.text || "Vixora Narration Audio"}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        const item = voiceoverHistory.find(h => h.id === activeVoiceoverId);
                        if (item) togglePlayVoiceoverItem(item.id, item.audioBase64);
                      }} 
                      className="w-12 h-12 rounded-2xl bg-ggd-orange text-white flex items-center justify-center text-lg shadow-lg active:scale-95 hover:brightness-110 transition-all shrink-0"
                      title={isVoiceoverPlaying ? "Pause Playback" : "Play Voiceover"}
                    >
                      <i className={`fa-solid ${isVoiceoverPlaying ? 'fa-pause' : 'fa-play pl-0.5'}`}></i>
                    </button>
                  </div>

                  {/* PROGRESS BAR & TIMING */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-400 font-mono">
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

                  {/* DUAL ACTION BUTTONS: USE IN VIDEO CREATOR & DOWNLOAD MP3 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <button 
                      onClick={() => {
                        const item = voiceoverHistory.find(h => h.id === activeVoiceoverId);
                        if (item) {
                          setVideoScriptInput(item.text);
                          setLastVoiceoverAudio(item.audioBase64);
                          setSelectedVoice(selectedVoice || 'Kore');
                          handleSelectTab('videos');
                          playProceduralSFX('sparkle');
                        }
                      }}
                      className="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <i className="fa-solid fa-clapperboard"></i>
                      <span>Use in Video Creator Studio</span>
                    </button>

                    <button 
                      onClick={() => {
                        const item = voiceoverHistory.find(h => h.id === activeVoiceoverId);
                        if (item) downloadVoiceoverMp3(item.audioBase64, item.text);
                        else downloadVoiceoverMp3();
                      }} 
                      className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <i className="fa-solid fa-download"></i>
                      <span>Download Studio MP3</span>
                    </button>
                  </div>
                </div>
             )}

             {/* PREVIOUS PLAYBACKS HISTORY */}
             {voiceoverHistory.length > 0 && (
                <div className={`p-5 rounded-3xl border space-y-3 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
                  <div className="flex justify-between items-center border-b pb-2 dark:border-white/10 border-slate-200">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-history text-ggd-orange text-xs"></i>
                      <h3 className="text-xs font-black uppercase tracking-wider">Audio Creation History ({voiceoverHistory.length})</h3>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {voiceoverHistory.map((item) => {
                      const isItemActive = activeVoiceoverId === item.id;
                      const isItemPlaying = isItemActive && isVoiceoverPlaying;

                      return (
                        <div 
                          key={item.id} 
                          className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                            isItemActive 
                              ? 'border-ggd-orange bg-ggd-orange/10 shadow-sm' 
                              : themeMode === 'light' ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-white/5 border-white/5 hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <button 
                              onClick={() => togglePlayVoiceoverItem(item.id, item.audioBase64)}
                              className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-xs transition-all active:scale-95 shadow ${
                                isItemPlaying ? 'bg-ggd-orange text-white animate-pulse' : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                              }`}
                              title={isItemPlaying ? "Pause" : "Play"}
                            >
                              <i className={`fa-solid ${isItemPlaying ? 'fa-pause' : 'fa-play pl-0.5'}`}></i>
                            </button>
                            <div className="text-left space-y-0.5 overflow-hidden">
                              <p className="text-[10px] font-black uppercase truncate max-w-xs text-slate-900 dark:text-white">
                                {item.text}
                              </p>
                              <div className="flex items-center gap-2 text-[7.5px] text-slate-400 font-mono">
                                <span>{item.date}</span>
                                <span>•</span>
                                <span className="text-ggd-orange font-sans font-bold">Vixora Studio Voice</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button 
                              onClick={() => {
                                setVideoScriptInput(item.text);
                                setLastVoiceoverAudio(item.audioBase64);
                                setSelectedVoice(selectedVoice || 'Kore');
                                handleSelectTab('videos');
                                playProceduralSFX('sparkle');
                              }}
                              className="px-2.5 py-1.5 bg-blue-600/15 hover:bg-blue-600/25 text-blue-500 border border-blue-600/30 rounded-lg text-[8px] font-black uppercase transition-all"
                              title="Use in Video Creator"
                            >
                              <i className="fa-solid fa-video mr-1"></i> Video
                            </button>
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
                    Vixora Media Search
                  </button>
                </div>
              </div>

              {/* VIXORA MEDIA MUSIC SEARCH CARD */}
              {musicResourceMode === 'pexels' ? (
                <div className="space-y-3 bg-amber-400/5 p-3.5 border border-amber-400/20 rounded-xl">
                  <div className="flex items-start gap-2 text-amber-500">
                    <i className="fa-solid fa-wand-magic-sparkles text-xs pt-0.5"></i>
                    <p className="text-[8px] font-black uppercase tracking-wider leading-normal">
                      Vixora Media Library: Stock videos contain commercial-free background soundtracks. Type a soundtrack style below!
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
                      Search Vixora
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
                        <span className="text-[6px] font-black uppercase bg-amber-400/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-400/20">Vixora Media</span>
                      )}
                    </div>
                    <p className="text-xs font-black uppercase truncate max-w-[200px]">
                      {(() => {
                        if (globalMusicUrl.includes('pexels')) {
                          return 'Decoded Vixora Media Backing Track';
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
                    {musicResourceMode === 'pexels' ? 'Vixora Media Live Results' : 'Premium Preset Loop Tracks'}
                  </h3>
                  {musicResourceMode === 'pexels' && (
                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest font-mono">Total Powered Sourcing</span>
                  )}
                </div>
                
                {isSearchingPexelsMusic ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-3">
                    <i className="fa-solid fa-spinner animate-spin text-xl text-amber-400"></i>
                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Querying commercial video backing audio tracks from Vixora Media...</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {musicResourceMode === 'pexels' ? (
                      pexelsMusicTracks.length === 0 ? (
                        <div className="py-12 text-center border border-dashed border-white/5 rounded-2xl">
                          <i className="fa-solid fa-cloud-arrow-down text-lg text-slate-600 mb-2"></i>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
                            No active Vixora Media results loaded. <br />
                            Type your search and click &ldquo;Search Vixora&rdquo; to unlock background tracks!
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
                    ⚡ High-Speed Neural Engine
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
                        handleSelectTab('scripts');
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

        {activeTab === 'tools' && (
          <div className="animate-rise">
            <ToolsLibrary
              onSelectTab={(tab) => handleSelectTab(tab as any)}
              onStartLiveAssistant={() => setIsTextChatOpen(true)}
              onOpenChatWithPrompt={(prompt) => {
                setIsTextChatOpen(true);
              }}
              themeMode={themeMode}
            />
          </div>
        )}

        {activeTab === 'developer' && (
          <div className="animate-rise">
            <DeveloperApiView 
              themeMode={themeMode} 
              activeProjectId={activeProjectId} 
            />
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
                  <button onClick={triggerPwaInstall} className="w-full mt-1 py-3 bg-ggd-orange/15 hover:bg-ggd-orange/25 text-ggd-orange border border-ggd-orange/20 rounded-xl font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer">
                     <i className="fa-solid fa-download"></i>
                     <span>{isStandalone ? 'PWA App Installed ✓' : 'Install Vixora PWA App'}</span>
                  </button>
               </div>
            </div>

            {/* GEMINI AI API KEY & ENGINE SETTINGS */}
            <div className={`rounded-2xl p-4 sm:p-5 border space-y-3 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}>
               <div className="flex items-center justify-between">
                 <div className="text-left">
                   <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                     <i className="fa-solid fa-key"></i> Gemini AI Engine Key
                   </h3>
                   <p className={`text-[9px] leading-normal mt-0.5 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                     Powers Live Voice Calls, AI script writing, and Video Autopilot.
                   </p>
                 </div>
                 <div className="flex items-center gap-1">
                   <span className={`w-2 h-2 rounded-full ${getEffectiveApiKey(user?.apiKey) ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                   <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                     {getEffectiveApiKey(user?.apiKey) ? 'Connected' : 'No Key'}
                   </span>
                 </div>
               </div>

               <div className="space-y-2 pt-1">
                 <div className="relative">
                   <input
                     type={showGeminiKeyInProfile ? "text" : "password"}
                     value={newApiKey}
                     onChange={(e) => setNewApiKey(e.target.value)}
                     placeholder={user?.apiKey ? "•••••••••••••••• (Saved)" : "Enter Gemini API Key (e.g. AIzaSy...)"}
                     className={`w-full p-3 pr-10 rounded-xl border font-mono text-xs outline-none transition-all ${
                       themeMode === 'light' 
                         ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-purple-500' 
                         : 'bg-white/5 border-white/10 text-white focus:border-purple-500'
                     }`}
                   />
                   <button
                     type="button"
                     onClick={() => setShowGeminiKeyInProfile(!showGeminiKeyInProfile)}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                   >
                     <i className={`fa-solid ${showGeminiKeyInProfile ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                   </button>
                 </div>

                 {apiKeyStatusMsg && (
                   <div className={`p-2.5 rounded-xl text-[9px] font-bold flex items-center gap-1.5 ${
                     apiKeyStatusMsg.type === 'success' 
                       ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                       : apiKeyStatusMsg.type === 'error'
                         ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                         : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                   }`}>
                     <i className={`fa-solid ${apiKeyStatusMsg.type === 'success' ? 'fa-check' : 'fa-circle-exclamation'}`}></i>
                     <span>{apiKeyStatusMsg.text}</span>
                   </div>
                 )}

                 <div className="flex gap-2">
                   <button
                     onClick={updateApiKey}
                     className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                   >
                     <i className="fa-solid fa-floppy-disk"></i>
                     <span>Save Gemini Key</span>
                   </button>
                   {user?.apiKey && (
                     <button
                       onClick={() => {
                         setNewApiKey('');
                         if (user) {
                           const updated = { ...user, apiKey: '' };
                           setUser(updated);
                           localStorage.setItem('ggd_creator_user', JSON.stringify(updated));
                           setApiKeyStatusMsg({ text: "Reverted to default environment key.", type: 'info' });
                           setTimeout(() => setApiKeyStatusMsg(null), 3000);
                         }
                       }}
                       className={`px-3 py-3 rounded-xl font-black uppercase text-[9px] border transition-all active:scale-95 cursor-pointer ${
                         themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-slate-400'
                       }`}
                     >
                       Reset
                     </button>
                   )}
                 </div>
               </div>
            </div>

            {/* FISH.AUDIO API KEY & VOICE ENGINE SETTINGS */}
            <div className={`rounded-2xl p-4 sm:p-5 border space-y-3 shadow-xl ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}>
               <div className="flex items-center justify-between">
                 <div className="text-left">
                   <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                     <i className="fa-solid fa-microphone-lines"></i> Fish.Audio Voice Engine Key
                   </h3>
                   <p className={`text-[9px] leading-normal mt-0.5 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                     High-fidelity African TTS voices including Kore, Chimamanda, Uncle Bayo & Funke.
                   </p>
                 </div>
                 <div className="flex items-center gap-1">
                   <span className={`w-2 h-2 rounded-full ${user?.fishAudioApiKey || localStorage.getItem('vixora_fish_audio_key') ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`}></span>
                   <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                     {user?.fishAudioApiKey ? 'Custom Key' : 'Default Key'}
                   </span>
                 </div>
               </div>

               <div className="space-y-2 pt-1">
                 <div className="relative">
                   <input
                     type={showFishAudioKeyInProfile ? "text" : "password"}
                     value={newFishAudioKey}
                     onChange={(e) => setNewFishAudioKey(e.target.value)}
                     placeholder={user?.fishAudioApiKey ? "•••••••••••••••• (Saved)" : "Enter Fish.Audio API Key (e.g. sk-fish-...)"}
                     className={`w-full p-3 pr-10 rounded-xl border font-mono text-xs outline-none transition-all ${
                       themeMode === 'light' 
                         ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500' 
                         : 'bg-white/5 border-white/10 text-white focus:border-cyan-500'
                     }`}
                   />
                   <button
                     type="button"
                     onClick={() => setShowFishAudioKeyInProfile(!showFishAudioKeyInProfile)}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                   >
                     <i className={`fa-solid ${showFishAudioKeyInProfile ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                   </button>
                 </div>

                 {fishAudioStatusMsg && (
                   <div className={`p-2.5 rounded-xl text-[9px] font-bold flex items-center gap-1.5 ${
                     fishAudioStatusMsg.type === 'success' 
                       ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                       : fishAudioStatusMsg.type === 'error'
                         ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                         : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                   }`}>
                     <i className={`fa-solid ${fishAudioStatusMsg.type === 'success' ? 'fa-check' : 'fa-circle-exclamation'}`}></i>
                     <span>{fishAudioStatusMsg.text}</span>
                   </div>
                 )}

                 <div className="flex gap-2">
                   <button
                     onClick={updateFishAudioKey}
                     className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl font-black uppercase text-[9px] tracking-widest active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                   >
                     <i className="fa-solid fa-floppy-disk"></i>
                     <span>Save Fish Key</span>
                   </button>

                   <button
                     onClick={testFishAudioConnection}
                     disabled={isTestingFishAudio}
                     className="px-3.5 py-3 bg-white/10 hover:bg-white/20 border border-white/15 text-cyan-300 rounded-xl font-black uppercase text-[9px] tracking-wider active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                   >
                     {isTestingFishAudio ? (
                       <i className="fa-solid fa-spinner animate-spin"></i>
                     ) : (
                       <i className="fa-solid fa-volume-high"></i>
                     )}
                     <span>Test Voice</span>
                   </button>

                   {user?.fishAudioApiKey && (
                     <button
                       onClick={() => {
                         setNewFishAudioKey('');
                         if (user) {
                           const updated = { ...user, fishAudioApiKey: '' };
                           setUser(updated);
                           localStorage.setItem('ggd_creator_user', JSON.stringify(updated));
                           localStorage.removeItem('vixora_fish_audio_key');
                           setFishAudioStatusMsg({ text: "Reverted to default Fish.Audio configuration.", type: 'info' });
                           setTimeout(() => setFishAudioStatusMsg(null), 3000);
                         }
                       }}
                       className={`px-3 py-3 rounded-xl font-black uppercase text-[9px] border transition-all active:scale-95 cursor-pointer ${
                         themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-slate-400'
                       }`}
                     >
                       Reset
                     </button>
                   )}
                 </div>
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

            <div className="space-y-2">
              <button 
                type="button"
                className="w-full py-3.5 text-[9px] font-black text-amber-400 uppercase bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                onClick={async () => {
                  await signOutSupabase();
                  localStorage.removeItem('ggd_creator_user');
                  setUser(null);
                  setWizardStep(0);
                }}
              >
                <i className="fa-solid fa-right-from-bracket"></i>
                <span>Sign Out from Workspace</span>
              </button>
              
              <button 
                className="w-full py-3.5 text-[9px] font-black text-red-500 uppercase bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl active:scale-95 transition-all" 
                onClick={() => { localStorage.clear(); window.location.reload(); }}
              >
                Full App Data Reset
              </button>
            </div>
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

      {/* PWA INSTALL MODAL */}
      {showPwaInstallModal && (
        <div className="fixed inset-0 z-[400] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-rise">
          <div className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border relative space-y-5 overflow-hidden ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'}`}>
            {/* Background glow accent */}
            <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-orange-500/20 blur-2xl pointer-events-none"></div>

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 p-0.5 shadow-lg">
                  <img src="/icon-192.jpg" alt="Vixora App Icon" className="w-full h-full object-cover rounded-[14px]" />
                </div>
                <div>
                  <h2 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                    <span>Vixora PWA App</span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${isStandalone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                      {isStandalone ? 'Installed ✓' : 'PWA Ready'}
                    </span>
                  </h2>
                  <p className={`text-[10px] font-semibold ${themeMode === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    1-Tap Mobile & Desktop Native App
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowPwaInstallModal(false)}
                className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Action Button if deferredPrompt is available */}
            {deferredPrompt ? (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-purple-500/10 border border-orange-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-circle-check text-emerald-400 text-base"></i>
                  <p className="text-xs font-black uppercase tracking-wide">Direct 1-Tap Installation Ready!</p>
                </div>
                <button
                  onClick={() => {
                    triggerPwaInstall();
                    setShowPwaInstallModal(false);
                  }}
                  className="w-full py-3.5 btn-3d btn-3d-orange flex items-center justify-center gap-2 text-xs"
                >
                  <i className="fa-solid fa-download text-sm"></i>
                  <span>Install Vixora Now</span>
                </button>
              </div>
            ) : (
              <div className={`p-4 rounded-2xl border space-y-2 ${themeMode === 'light' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'}`}>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-mobile-screen text-amber-400 text-sm"></i>
                  <p className="text-[11px] font-black uppercase">How to Install on Your Device</p>
                </div>
                <p className="text-[10px] leading-relaxed opacity-90">
                  {isStandalone 
                    ? "Vixora is already running as an installed PWA App!"
                    : "You can easily add Vixora Studio to your Home Screen or Desktop as a native app:"}
                </p>
              </div>
            )}

            {/* Open in New Tab Button (Crucial for iframe environments where beforeinstallprompt is blocked) */}
            {window.self !== window.top && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-600/15 via-indigo-600/15 to-purple-600/15 border border-blue-500/30 space-y-2">
                <div className="flex items-center gap-2 text-blue-400">
                  <i className="fa-solid fa-circle-info text-xs"></i>
                  <p className="text-[10px] font-black uppercase tracking-wide">Embedded Preview Detected</p>
                </div>
                <p className={`text-[10px] leading-relaxed ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                  Browsers disable PWA app installation inside embedded preview windows. Open Vixora in a direct tab to install it with 1 tap!
                </p>
                <button
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                  <span>Open in Full Browser Tab & Install</span>
                </button>
              </div>
            )}

            {/* Instructions by Platform */}
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {/* iOS / Safari */}
              <div className={`p-3 rounded-2xl border flex items-start gap-3 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                  <i className="fa-brands fa-apple text-sm"></i>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-blue-400">iOS (iPhone & iPad Safari)</p>
                  <p className={`text-[10px] leading-relaxed mt-0.5 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                    1. Tap the <span className="font-bold">Share</span> button <i className="fa-solid fa-share-nodes text-[9px] mx-0.5"></i> in Safari.<br />
                    2. Scroll down and tap <span className="font-bold text-orange-400">"Add to Home Screen"</span> <i className="fa-solid fa-square-plus text-[9px] mx-0.5"></i>.<br />
                    3. Tap <span className="font-bold text-emerald-400">"Add"</span> to launch from your home screen!
                  </p>
                </div>
              </div>

              {/* Android / Chrome */}
              <div className={`p-3 rounded-2xl border flex items-start gap-3 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <i className="fa-brands fa-android text-sm"></i>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400">Android (Chrome)</p>
                  <p className={`text-[10px] leading-relaxed mt-0.5 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                    1. Tap the <span className="font-bold">3 Dots</span> menu <i className="fa-solid fa-ellipsis-vertical text-[9px] mx-0.5"></i> in Chrome.<br />
                    2. Select <span className="font-bold text-orange-400">"Install app"</span> or <span className="font-bold text-orange-400">"Add to Home screen"</span>.
                  </p>
                </div>
              </div>

              {/* Desktop / PC & Mac */}
              <div className={`p-3 rounded-2xl border flex items-start gap-3 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                  <i className="fa-solid fa-desktop text-sm"></i>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-purple-400">Desktop (Chrome / Edge / Brave)</p>
                  <p className={`text-[10px] leading-relaxed mt-0.5 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                    Click the <span className="font-bold text-orange-400">Install icon</span> <i className="fa-solid fa-download text-[9px] mx-0.5"></i> in the browser address bar or menu.
                  </p>
                </div>
              </div>
            </div>

            {/* PWA Highlights */}
            <div className={`p-3 rounded-2xl border flex items-center justify-around text-center text-[9px] font-bold uppercase tracking-wider ${themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/5 border-white/5 text-slate-300'}`}>
              <div className="flex items-center gap-1">
                <i className="fa-solid fa-bolt text-amber-400"></i> Fast Load
              </div>
              <div className="flex items-center gap-1">
                <i className="fa-solid fa-wifi text-emerald-400"></i> Offline Ready
              </div>
              <div className="flex items-center gap-1">
                <i className="fa-solid fa-bell text-purple-400"></i> Push Alerts
              </div>
            </div>

            {/* Footer Close */}
            <button
              onClick={() => setShowPwaInstallModal(false)}
              className={`w-full py-3 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all ${themeMode === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-white/10 hover:bg-white/15 border-white/10 text-white'}`}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 1-CLICK ALL-IN-ONE API INTEGRATION DOCUMENTATION MODAL */}
      <CompleteApiModal
        isOpen={showGlobalApiModal}
        onClose={() => setShowGlobalApiModal(false)}
        themeMode={themeMode}
        baseUrl={typeof window !== 'undefined' ? window.location.origin : 'https://vixora.studio'}
      />

      {/* 1-CLICK COMPLETE CODEBASE & AI SIDE-BUILDER EXPORT MODAL */}
      <NativeExportDownloadModal
        isOpen={showNativeExportModal}
        onClose={() => setShowNativeExportModal(false)}
        themeMode={themeMode}
      />

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
