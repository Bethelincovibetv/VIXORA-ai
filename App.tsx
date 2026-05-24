
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from "@google/genai";
import { UserProfile, Bank } from './types';
import { VideoSequencer } from './components/VideoSequencer';

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
    promptSuffix: 'Write in a suspenseful, epic storytelling vibe focusing on historic ancient wars, Roman/Greek secrets, and legendary mythological figures.',
    suggestions: [
      "The secret lives of Roman Gladiators",
      "Why did the Spartan Empire collapse?",
      "The legendary power of Greek Gods"
    ]
  },
  { 
    id: 'psychology', 
    name: 'Psychology & Relationships', 
    icon: 'fa-brain', 
    promptSuffix: 'Write in a curious, eye-opening psychological tone focusing on dark psychology facts, human behavior patterns, relationship dynamics, and mind reading.',
    suggestions: [
      "3 body language tricks to read anyone",
      "Dark psychology hacks that actually work",
      "The psychology of silence in conversations"
    ]
  },
  { 
    id: 'health', 
    name: 'Health & Workout Longevity', 
    icon: 'fa-heart-pulse', 
    promptSuffix: 'Write in an energetic, health-conscious, informative style focusing on biohacking secrets, longevity workouts, superfoods, and holistic body wellness.',
    suggestions: [
      "Biohacking secrets to live 100 years",
      "The optimal daily workout for focus",
      "What happens to your body when you fast"
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
  const [activeTab, setActiveTab] = useState<'studio' | 'voiceover' | 'scripts' | 'profile' | 'more' | 'videos' | 'contact'>('studio');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  
  // Onboarding Wizard State
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardData, setWizardData] = useState({ fullName: '', email: '', apiKey: 'AIzaSyCBO1PRv5h9aQAB3rWbLrkwq_Uf_Q_uQCk' });

  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // API Update State
  const [newApiKey, setNewApiKey] = useState('');

  // Live Assistant State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  const [callTimer, setCallTimer] = useState(0);
  
  // Voiceover State
  const [voiceoverText, setVoiceoverText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false);
  const [lastVoiceoverAudio, setLastVoiceoverAudio] = useState<string | null>(null);

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

  // Autopilot Orchestration States
  const [isAutopilotRunning, setIsAutopilotRunning] = useState(false);
  const [autopilotStep, setAutopilotStep] = useState<number>(0);
  const [autopilotLog, setAutopilotLog] = useState<string>('');

  // Tools State
  const [toolInput, setToolInput] = useState('');
  const [toolOutput, setToolOutput] = useState('');
  const [isToolLoading, setIsToolLoading] = useState(false);

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

    // Detect Standalone display mode / pre-installed app execution
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsStandalone(true);
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Retrieve session to prevent intrusive popping if dismissed
      if (!sessionStorage.getItem('pwa_prompt_dismissed')) {
        setShowPwaPrompt(true);
      }
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

  const triggerPwaInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsStandalone(true);
      setShowPwaPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const dismissPwaPrompt = () => {
    setShowPwaPrompt(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  const updateApiKey = () => {
    if (!user) return;
    const updatedUser = { ...user, apiKey: newApiKey };
    setUser(updatedUser);
    localStorage.setItem('ggd_creator_user', JSON.stringify(updatedUser));
    alert("Gemini API Key saved to Local Storage!");
  };

  const handleFinishOnboarding = () => {
    if (!wizardData.fullName || !wizardData.apiKey) {
      setAppError("Please complete all fields.");
      return;
    }
    const newUser = { fullName: wizardData.fullName, email: 'user@creator.hub', phone: '', apiKey: wizardData.apiKey, niche: 'finance' };
    setUser(newUser);
    localStorage.setItem('ggd_creator_user', JSON.stringify(newUser));
  };

  // --- VIDEO SOURCER (FACELESS VIDEO CREATOR) ---

  const handleSourceVideos = async (overrideScript?: string) => {
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
      const prompt = videoMode === 'ai_packaged' 
        ? `I need to create a faceless video. Extract 5 specific keywords for high-quality HD scenes that flow as a storyboard from this script: "${input}". Return ONLY the keywords separated by spaces.`
        : `Extract exactly 3 search keywords for high-quality stock footage from this script: "${input}". Return ONLY the keywords separated by spaces.`;

      const keywordResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const searchQuery = keywordResponse.text?.trim() || input.split(' ').slice(0, 3).join(' ');

      const pexelsResponse = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(searchQuery)}&per_page=12&orientation=landscape`, {
        headers: {
          Authorization: PEXELS_API_KEY
        }
      });

      if (!pexelsResponse.ok) throw new Error("API error");

      const data = await pexelsResponse.json();
      setSourcedVideos(data.videos || []);

      if (data.videos.length === 0) {
        setAppError("No matching videos found. Try different keywords.");
      }
    } catch (err) {
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

  // --- GROWTH TOOLS ---

  const handleToolAction = async (type: 'tags' | 'hooks' | 'thumbnails') => {
    if (!toolInput.trim()) return;
    const activeApiKey = user?.apiKey || process.env.API_KEY;
    if (!activeApiKey) return;

    setIsToolLoading(true);
    setToolOutput('');
    try {
      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const prompts = {
        tags: `Generate a comma-separated list of high-ranking SEO tags for a YouTube video about: ${toolInput}. Return ONLY the tags. No asterisks.`,
        hooks: `Provide 5 viral hook options for a video about: ${toolInput}. Return only the list. No asterisks.`,
        thumbnails: `Describe 3 thumbnail visual concepts for: ${toolInput}. Be brief and visual. No asterisks.`,
      };

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompts[type],
      });
      setToolOutput(response.text?.replace(/\*/g, '') || '');
    } catch (err) {
      setAppError("Tool failed to generate results.");
    } finally {
      setIsToolLoading(false);
    }
  };

  // --- SCRIPT GENERATION ---

  const handleGenerateScript = async (overrideTopic?: string) => {
    const topic = overrideTopic || scriptTopic;
    if (!topic.trim()) {
      setAppError("Please enter a topic for the script.");
      return;
    }

    const activeApiKey = user?.apiKey || process.env.API_KEY;
    if (!activeApiKey) {
      setAppError("API Key is missing. Check your Profile.");
      return;
    }

    setIsGeneratingScript(true);
    setAppError(null);
    setGeneratedScript('');

    try {
      const userNiche = (user as any)?.niche || 'finance';
      const activeNicheConfig = NICHE_OPTIONS.find(n => n.id === userNiche) || NICHE_OPTIONS[0];
      const nicheSuffix = activeNicheConfig.promptSuffix;

      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Write a professional, viral-optimized YouTube script for a FACELESS channel about "${topic}". 
        
        NICHE VOICE GUIDELINES:
        - ${nicheSuffix}

        REQUIREMENTS:
        - Go direct to the point. No introductory talk.
        - Do NOT use asterisks (*) or markdown bolding (**).
        - Structure: HOOK, BODY, CTA.
        - Return ONLY the script content.`,
      });

      const text = response.text?.replace(/\*/g, '') || '';
      setGeneratedScript(text);
      return text;
    } catch (err) {
      setAppError("Script generation failed. Try a simpler topic.");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // --- VOICE OVER GENERATION ---

  const handleGenerateVoiceover = async (overrideText?: string) => {
    const text = overrideText || voiceoverText;
    if (!text.trim()) return;
    const activeApiKey = user?.apiKey || process.env.API_KEY;
    if (!activeApiKey) return;

    setIsGeneratingVoiceover(true);
    setAppError(null);
    setLastVoiceoverAudio(null);

    try {
      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Speak this script with a natural, professional Nigerian female accent. No conversational filler: ${text.replace(/\*/g, '')}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        setLastVoiceoverAudio(base64Audio);
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (err) {
      setAppError("Voiceover generation failed.");
    } finally {
      setIsGeneratingVoiceover(false);
    }
  };

  const downloadVoiceover = () => {
    if (!lastVoiceoverAudio) return;
    const pcmData = decode(lastVoiceoverAudio);
    const wavHeader = createWavHeader(pcmData.length, 24000, 1, 16);
    const wavFile = new Uint8Array(wavHeader.length + pcmData.length);
    wavFile.set(wavHeader);
    wavFile.set(pcmData, wavHeader.length);

    const blob = new window.Blob([wavFile], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voiceover_${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleVideoCompiled = (blobUrl: string, orientation: 'vertical' | 'horizontal') => {
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
    };
    const updated = [newVideo, ...createdVideos];
    setCreatedVideos(updated);
    localStorage.setItem('ggd_created_videos', JSON.stringify(updated));
    alert("🎉 Ultimate Video compiled successfully & saved to your local Vixora Studio Gallery!");
  };

  const handleAutopilotVideoGeneration = async (topicToUse: string) => {
    if (!topicToUse.trim()) {
      setAppError("Please provide an idea or topic for Autopilot.");
      return;
    }
    const activeApiKey = user?.apiKey || process.env.API_KEY;
    if (!activeApiKey) {
      setAppError("API Credentials are required to launch autopilot.");
      return;
    }

    setIsAutopilotRunning(true);
    setAutopilotStep(1);
    setAutopilotLog("Cooking up viral script draft with Gemini AI...");
    
    // Shift automatically to videos tab to monitor progress
    setActiveTab('videos');

    try {
      // --- STEP 1: SCRIPT ---
      const scriptText = await handleGenerateScript(topicToUse);
      if (!scriptText) throw new Error("Could not formulate script.");
      
      setAutopilotStep(2);
      setAutopilotLog("Generating smooth natural female accent voiceover...");

      // --- STEP 2: VOICE OVER ---
      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const voiceResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Speak this script with a natural, professional Nigerian female accent. No conversational filler: ${scriptText.replace(/\*/g, '')}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const base64Audio = voiceResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("Failed to produce voiceover stream.");
      setLastVoiceoverAudio(base64Audio);
      setVoiceoverText(scriptText);

      // --- STEP 3: VIDEOS ---
      setAutopilotStep(3);
      setAutopilotLog("Sourcing Premium HD video storyboard clips from Pexels...");
      
      setVideoScriptInput(scriptText);
      
      const keywordResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `I need to create a faceless video. Extract 5 specific keywords for high-quality HD scenes that flow as a storyboard from this script: "${scriptText}". Return ONLY the keywords separated by spaces.`,
      });

      const searchQuery = keywordResponse.text?.trim() || scriptText.split(' ').slice(0, 3).join(' ');

      const pexelsResponse = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(searchQuery)}&per_page=12&orientation=landscape`, {
        headers: {
          Authorization: PEXELS_API_KEY
        }
      });

      if (!pexelsResponse.ok) throw new Error("Failed to fetch matching stock videos.");

      const data = await pexelsResponse.json();
      setSourcedVideos(data.videos || []);

      setAutopilotStep(4);
      setAutopilotLog("Timeline synchronized perfectly! Launching preview console...");
      
      setTimeout(() => {
        setIsAutopilotRunning(false);
      }, 2000);

    } catch (err: any) {
      console.error("Autopilot engine failure:", err);
      setAppError(`Autopilot failed: ${err.message || err}`);
      setIsAutopilotRunning(false);
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
        audio: true, 
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
          description: 'Fully cooks the complete script, voiceover audio, and stocks video storyboard clips in one automated autopilot run for a specified topic.',
          properties: {
            topic: { type: Type.STRING, description: 'The topic/theme for the autogenerated movie.' }
          },
          required: ['topic']
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
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
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
                  result = `I am now running the full automatic autopilot engine to cook your video about "${topic}". I will formulate the script, generate voiceover audio with my custom lady accent, and sync premium HD stock clips storyboard automatically. Go to the Creator tab, it will be ready in seconds!`;
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
          tools: [{ googleSearch: {} }, { functionDeclarations: [navigateToTabDeclaration, generateScriptDeclaration, sourceVideoDeclaration, createFullAutopilotVideoDeclaration] }],
          systemInstruction: `You are 'Vixora', a brilliant Nigerian AI Creator Assistant. Speak English, Pidgin, and Igbo. Your vibe is 100% Naija (energetic, witty, helpful). No asterisks.
          You can control the app! Use tools to change tabs, generate scripts, source videos, or cook an entire video automatically. 
          If the user wants you to make/build/generate a video for a topic, use the 'createFullAutopilotVideo' tool to generate the script, voiceover, and stock footage storyboard with one single action.
          Respond like a sister on a phone call. Explain what you are doing naturally.`,
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
            <button onClick={() => setWizardStep(1)} className="w-full py-5 bg-white text-slate-950 font-black uppercase rounded-2xl active:scale-95 transition-all">Begin Onboarding</button>
          </div>
        ) : wizardStep === 1 ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-black uppercase">Your Name</h2>
            <input value={wizardData.fullName} onChange={e => setWizardData({...wizardData, fullName: e.target.value})} className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl font-bold outline-none focus:border-ggd-orange" placeholder="Full Name" />
            <button onClick={() => setWizardStep(2)} className="w-full py-5 bg-ggd-orange font-black uppercase rounded-2xl">Continue</button>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-black uppercase">Gemini API Key</h2>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              We have pre-filled a default Gemini API key for you to start creating instantly. You can update it or add your own key anytime!
            </p>
            <input type="text" value={wizardData.apiKey} onChange={e => setWizardData({...wizardData, apiKey: e.target.value})} className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl font-bold outline-none focus:border-ggd-orange text-xs text-ggd-orange font-mono" placeholder="Gemini API Key..." />
            <button onClick={handleFinishOnboarding} className="w-full py-5 bg-ggd-orange font-black uppercase rounded-2xl">Setup Vixora Studio</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen relative flex flex-col bg-slate-950 pb-24 text-white">
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      <div className={`fixed top-0 left-0 h-full w-72 bg-slate-900 z-[201] transition-transform duration-300 transform shadow-2xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 h-full flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
                <img src="https://cilkybiebptqtuhbopyz.supabase.co/storage/v1/object/public/images/default/c51236bd-d2c7-4166-a82e-f347059d7ba8.jpg" alt="Vixora Logo" className="w-full h-full object-contain rounded-lg" referrerPolicy="no-referrer" />
              </span>
              Vixora <span className="text-ggd-orange">Studio</span>
            </h2>
            <button onClick={() => setIsSidebarOpen(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10"><i className="fa-solid fa-xmark"></i></button>
          </div>

          <div className="flex-1 space-y-4">
            <button onClick={() => { setActiveTab('studio'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold uppercase text-xs tracking-widest border transition-all ${activeTab === 'studio' ? 'bg-ggd-orange/10 border-ggd-orange/30 text-ggd-orange' : 'bg-white/5 border-white/5 text-slate-400'}`}>
              <i className="fa-solid fa-microphone-lines w-5"></i> Vixora Studio
            </button>
            <button onClick={() => { setActiveTab('scripts'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold uppercase text-xs tracking-widest border transition-all ${activeTab === 'scripts' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-white/5 border-white/5 text-slate-400'}`}>
              <i className="fa-solid fa-scroll w-5"></i> YT Scripts
            </button>
            <button onClick={() => { setActiveTab('videos'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold uppercase text-xs tracking-widest border transition-all ${activeTab === 'videos' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-white/5 border-white/5 text-slate-400'}`}>
              <i className="fa-solid fa-video w-5"></i> Video Creator
            </button>
            <button onClick={() => { setActiveTab('voiceover'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold uppercase text-xs tracking-widest border transition-all ${activeTab === 'voiceover' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-slate-400'}`}>
              <i className="fa-solid fa-waveform-lines w-5"></i> Voiceovers
            </button>
            <button onClick={() => { setActiveTab('more'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold uppercase text-xs tracking-widest border transition-all ${activeTab === 'more' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/5 text-slate-400'}`}>
              <i className="fa-solid fa-bolt-lightning w-5"></i> Growth Tools
            </button>
            <div className="h-px bg-white/5 my-6"></div>
            <button onClick={() => { setActiveTab('contact'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold uppercase text-xs tracking-widest border transition-all ${activeTab === 'contact' ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/5 text-slate-400'}`}>
              <i className="fa-solid fa-envelope w-5"></i> Contact Us
            </button>
            <button onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-bold uppercase text-xs tracking-widest border transition-all ${activeTab === 'profile' ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/5 text-slate-400'}`}>
              <i className="fa-solid fa-user-gear w-5"></i> User Profile
            </button>
            <button onClick={() => { setShowAbout(true); setIsSidebarOpen(false); }} className="w-full flex items-center gap-4 p-4 rounded-2xl font-bold uppercase text-xs tracking-widest bg-white/5 border border-white/5 text-slate-400">
              <i className="fa-solid fa-circle-info w-5"></i> About App
            </button>
          </div>

          <div className="pt-6 border-t border-white/5">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-black uppercase text-white">{user.fullName[0]}</div>
               <div className="flex-1 overflow-hidden">
                 <p className="text-[10px] font-black truncate">{user.fullName}</p>
                 <p className="text-[8px] text-slate-500 font-bold">Gold Creator</p>
               </div>
             </div>
          </div>
        </div>
      </div>

      {showAbout && (
        <div className="fixed inset-0 z-[300] bg-slate-950 flex flex-col items-center justify-center p-8 animate-rise">
           <div className="w-full max-w-sm bg-slate-900 rounded-[3rem] p-10 border border-white/10 text-center space-y-8 relative shadow-2xl">
              <button onClick={() => setShowAbout(false)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10"><i className="fa-solid fa-xmark"></i></button>
              <div className="w-20 h-20 rounded-3xl mx-auto overflow-hidden shadow-xl rotate-3 border border-white/10 bg-white p-2 flex items-center justify-center">
                 <img src="https://cilkybiebptqtuhbopyz.supabase.co/storage/v1/object/public/images/default/c51236bd-d2c7-4166-a82e-f347059d7ba8.jpg" alt="Vixora Logo" className="w-full h-full object-contain rounded-[1.25rem]" referrerPolicy="no-referrer" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter">Vixora <span className="text-ggd-orange">Studio</span></h2>
              <p className="text-xs text-slate-400">Modern AI content engine for faceless channels.</p>
              <p className="text-[8px] text-slate-600 font-black uppercase tracking-[0.3em]">Version 2.5.0 Gold Edition</p>
           </div>
        </div>
      )}

      <header className="px-6 py-6 flex items-center justify-between z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 active:scale-90 transition-all">
            <i className="fa-solid fa-bars-staggered text-xs"></i>
          </button>
          <h1 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0 border border-white/10">
              <img src="https://cilkybiebptqtuhbopyz.supabase.co/storage/v1/object/public/images/default/c51236bd-d2c7-4166-a82e-f347059d7ba8.jpg" alt="Vixora Logo" className="w-full h-full object-contain rounded-md" referrerPolicy="no-referrer" />
            </span>
            Vixora
          </h1>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
          <i className="fa-solid fa-bolt text-ggd-orange text-xs"></i>
        </div>
      </header>

      <main className="flex-1 p-3.5 md:p-6 overflow-y-auto">
        {showPwaPrompt && deferredPrompt && (
          <div className="mb-6 p-4 bg-slate-900/90 backdrop-blur-xl border border-ggd-orange/30 rounded-3xl flex items-center justify-between gap-3 animate-rise shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-ggd-orange/10 flex items-center justify-center text-ggd-orange shrink-0">
                 <i className="fa-solid fa-download text-sm"></i>
              </div>
              <div className="text-left">
                 <p className="text-[10px] font-black uppercase text-white tracking-widest">Install Vixora App</p>
                  <p className="text-[8px] text-slate-400 font-bold">Fast access from your home screen</p>
               </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
               <button onClick={triggerPwaInstall} className="px-3 py-2 bg-ggd-orange text-white text-[8px] font-black uppercase rounded-xl active:scale-95 transition-all">Install</button>
               <button onClick={dismissPwaPrompt} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-white"><i className="fa-solid fa-xmark text-[10px]"></i></button>
            </div>
          </div>
        )}

        {appError && (
          <div className="mb-6 p-4 bg-red-600/20 border border-red-500/40 rounded-2xl text-red-200 text-[10px] font-bold flex justify-between items-center">
            <span>{appError}</span>
            <button onClick={() => setAppError(null)}><i className="fa-solid fa-xmark"></i></button>
          </div>
        )}

        {activeTab === 'studio' && (
          <div className="animate-rise space-y-6 text-center">
            {!isLiveActive ? (
              <div className="bg-slate-900/40 rounded-[3rem] p-10 border border-white/10 shadow-2xl backdrop-blur-md">
                 <div className="w-20 h-20 bg-ggd-orange/10 rounded-full mx-auto flex items-center justify-center text-ggd-orange text-3xl mb-6 border border-ggd-orange/20">
                   <i className="fa-solid fa-microphone-lines"></i>
                 </div>
                 <h2 className="text-2xl font-black uppercase mb-4">Chat with Vixora</h2>
                 <p className="text-xs text-slate-400 font-medium mb-10 leading-relaxed">Connect with your AI partner. Vixora can control the app for you—just ask her to generate a script or switch tabs!</p>
                 <button disabled={isConnecting} onClick={startLiveAssistant} className="w-full py-5 bg-ggd-orange text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">
                   {isConnecting ? 'Warming Up Engine...' : 'Launch AI Session'}
                 </button>
              </div>
            ) : (
              <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-between py-20 px-10">
                <div className="absolute top-10 right-10 w-24 h-36 bg-black rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col items-center gap-6">
                   <div className="w-40 h-40 rounded-full border-4 border-ggd-orange/30 p-1 relative">
                     <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 shadow-2xl">
                       <img 
                        src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=500&auto=format&fit=crop" 
                        alt="Vixora" 
                        className="w-full h-full object-cover"
                       />
                     </div>
                   </div>
                   <div className="text-center space-y-2">
                     <h2 className="text-3xl font-black uppercase tracking-tighter">Vixora AI</h2>
                     <p className="text-emerald-400 text-sm font-black uppercase tracking-widest">{formatTime(callTimer)}</p>
                   </div>
                </div>
                <div className="w-full max-w-xs p-6 bg-white/5 border border-white/10 rounded-[2rem] min-h-[100px] flex items-center justify-center text-center">
                   <p className="text-white/60 text-[10px] italic leading-relaxed">
                     {liveTranscription || "I'm listening, wetin dey happen?..."}
                   </p>
                </div>
                <button onClick={stopLiveAssistant} className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all">
                  <i className="fa-solid fa-phone-slash text-white text-2xl"></i>
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'scripts' && (
          <div className="animate-rise space-y-6">
             <div className="bg-slate-900/40 rounded-[2.5rem] p-8 border border-white/10 space-y-6">
                <h2 className="text-xl font-black uppercase text-white">Faceless Script Genius</h2>
                <input value={scriptTopic} onChange={e => setScriptTopic(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs outline-none focus:border-ggd-orange" placeholder="Video Topic..." />
                <button disabled={isGeneratingScript} onClick={() => handleGenerateScript()} className="w-full py-4 bg-ggd-orange rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">
                   {isGeneratingScript ? 'Cooking Script...' : 'Generate Script'}
                </button>
                {generatedScript && (
                  <div className="space-y-3 animate-rise">
                     <div className="p-5 bg-white/5 border border-white/10 rounded-2xl max-h-80 overflow-y-auto relative">
                        <pre className="text-[11px] text-white/80 whitespace-pre-wrap font-sans leading-relaxed">{generatedScript}</pre>
                        <button onClick={() => { navigator.clipboard.writeText(generatedScript); alert('Script Copied!'); }} className="absolute top-4 right-4 text-ggd-orange hover:text-white transition-colors">
                          <i className="fa-solid fa-copy"></i>
                        </button>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => { setVoiceoverText(generatedScript); setActiveTab('voiceover'); }} className="py-4 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-[9px] font-black uppercase">Transfer to Voice</button>
                        <button onClick={() => { setVideoScriptInput(generatedScript); setActiveTab('videos'); }} className="py-4 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-xl text-[9px] font-black uppercase">Transfer to Video</button>
                     </div>
                  </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="animate-rise space-y-4">
            {/* TOP BAR PROJECT CONTROLS */}
            <div className="bg-slate-900/60 p-4 border border-white/10 rounded-3xl space-y-3 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="text-left">
                  <h3 className="text-xs font-black uppercase text-glow text-white tracking-widest flex items-center gap-1.5">
                    <i className="fa-solid fa-cube text-ggd-orange"></i> Video Ratio & Niche Sourcing
                  </h3>
                  <p className="text-[7.5px] text-slate-500 font-bold uppercase">Configure output shape and template topic recommendations</p>
                </div>
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 shadow-inner shrink-0 w-full sm:w-auto justify-between sm:justify-start">
                  <button 
                    onClick={() => setVideoRatio('vertical')} 
                    className={`px-3 py-1.5 text-[8px] font-black uppercase rounded-lg flex items-center gap-1 transition-all ${videoRatio === 'vertical' ? 'bg-ggd-orange text-white' : 'text-slate-500 hover:text-white'}`}
                  >
                    <i className="fa-solid fa-mobile-screen-button"></i>
                    <span>9:16 Vertical</span>
                  </button>
                  <button 
                    onClick={() => setVideoRatio('horizontal')} 
                    className={`px-3 py-1.5 text-[8px] font-black uppercase rounded-lg flex items-center gap-1 transition-all ${videoRatio === 'horizontal' ? 'bg-ggd-orange text-white' : 'text-slate-500 hover:text-white'}`}
                  >
                    <i className="fa-solid fa-desktop"></i>
                    <span>16:9 Landscape</span>
                  </button>
                  <button 
                    onClick={() => setVideoRatio('square')} 
                    className={`px-3 py-1.5 text-[8px] font-black uppercase rounded-lg flex items-center gap-1 transition-all ${videoRatio === 'square' ? 'bg-ggd-orange text-white' : 'text-slate-500 hover:text-white'}`}
                  >
                    <i className="fa-solid fa-square text-[7px]"></i>
                    <span>1:1 Square</span>
                  </button>
                </div>
              </div>

              {/* Niche Search Filter Chips */}
              <div className="pt-2 border-t border-white/5 space-y-1.5">
                <p className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest text-left">Active Niche Filter</p>
                <div className="flex flex-wrap gap-1">
                  <button 
                    onClick={() => setSelectedNicheFilter('all')}
                    className={`px-2.5 py-1 rounded-lg border text-[8px] font-black uppercase transition-all ${selectedNicheFilter === 'all' ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-400'}`}
                  >
                    All Niches
                  </button>
                  {NICHE_OPTIONS.map(n => (
                    <button 
                      key={n.id}
                      onClick={() => setSelectedNicheFilter(n.id)}
                      className={`px-2.5 py-1 rounded-lg border text-[8px] font-black uppercase flex items-center gap-1 transition-all ${selectedNicheFilter === n.id ? 'bg-ggd-orange/15 border-ggd-orange text-white shadow-sm' : 'bg-transparent border-white/5 text-slate-500 hover:border-white/10'}`}
                    >
                      <i className={`fa-solid ${n.icon} text-[8.5px]`}></i>
                      <span>{n.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Suggested Topic Recommendations based on Selected Niche */}
              <div className="p-2.5 bg-black/40 rounded-2xl border border-white/5 space-y-1.5">
                <p className="text-[7.5px] font-black text-ggd-orange uppercase tracking-widest flex items-center gap-1 text-left">
                  <i className="fa-solid fa-lightbulb"></i> Recommended Niche Starters (Click to generate)
                </p>
                <div className="flex flex-col sm:flex-row gap-1.5">
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
                      className="flex-1 p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-left text-[8px] font-bold text-slate-300 uppercase leading-snug transition-all truncate"
                    >
                      💡 {suggestion}
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
              <div className="bg-gradient-to-br from-ggd-orange/10 via-slate-900 to-slate-950 border border-ggd-orange/20 rounded-3xl p-4 space-y-3.5 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-ggd-orange/10 flex items-center justify-center text-ggd-orange text-md">
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                  </div>
                  <div className="text-left">
                    <h4 className="text-[9px] font-black uppercase text-white tracking-widest">Vixora Video Autopilot</h4>
                    <p className="text-[7.5px] text-slate-400 font-bold font-sans">1-Click script generator, voice synthesis & assets syncing</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input 
                    value={scriptTopic} 
                    onChange={e => setScriptTopic(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-ggd-orange text-white placeholder-slate-600" 
                    placeholder="e.g. 5 rules of wealth you must learn..." 
                  />
                  <button 
                    onClick={() => handleAutopilotVideoGeneration(scriptTopic)} 
                    className="px-4 bg-ggd-orange rounded-xl text-[8px] font-black uppercase tracking-wider shadow-md hover:brightness-110 active:scale-95 transition-all text-white shrink-0"
                  >
                    Auto Generate
                  </button>
                </div>
              </div>
            )}

            {/* MANUAL CREATOR CONSOLE */}
            <div className="bg-slate-900/40 rounded-3xl p-5 border border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-left">
                <i className="fa-solid fa-clapperboard text-ggd-orange text-sm"></i>
                <h2 className="text-xs font-black uppercase text-white">Manual Creator Studio</h2>
              </div>

              <div className="space-y-2">
                <textarea 
                  value={videoScriptInput} 
                  onChange={e => setVideoScriptInput(e.target.value)} 
                  className="w-full h-24 bg-black/40 border border-white/10 rounded-2xl p-3 text-xs outline-none focus:border-ggd-orange resize-none" 
                  placeholder="Paste script below to fetch stock footage timeline manually..." 
                />
              </div>

              <button 
                disabled={isSourcingVideos} 
                onClick={() => handleSourceVideos()} 
                className="w-full py-3.5 bg-ggd-orange rounded-2xl font-black uppercase text-[9px] tracking-wider shadow-lg active:scale-95 transition-all"
              >
                {isSourcingVideos ? 'Processing HD Project...' : 'Build Video Package'}
              </button>
              
              {sourcedVideos.length > 0 && (
                <div className="space-y-4 animate-rise">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-[10px] font-black uppercase text-slate-400">Project Timeline</h3>
                    <button onClick={downloadAllVideos} className="px-3 py-1.5 bg-emerald-600 rounded-xl text-[8px] font-black uppercase flex items-center gap-2">
                      Download HD Package
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
                    />
                    {!lastVoiceoverAudio && (
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-left text-[8.5px] text-blue-400 font-bold leading-relaxed flex gap-2 font-sans">
                        <span className="text-md">💡</span>
                        <span>
                          <strong>Naija Smart Tip:</strong> Generate voiceover speech in the <strong>Voice overs</strong> tab first. Your voice audio will automatically sync inside the timelines!
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-2 scrollbar-hide">
                    {sourcedVideos.map((video, idx) => (
                      <div key={video.id} className="relative rounded-2xl overflow-hidden group bg-slate-800 border border-white/5">
                        <img src={video.image} className="w-full h-20 object-cover opacity-80" alt="" />
                        <div className="absolute inset-0 flex flex-col justify-end p-2 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-[8px] font-black text-white uppercase">Clip {idx + 1}</p>
                          <a href={video.video_files.find(f => f.quality === 'hd')?.link || video.video_files[0].link} target="_blank" rel="noopener noreferrer" className="mt-2 w-full py-1.5 bg-white/10 text-white rounded-lg text-center text-[7.5px] font-black uppercase" download>Get HD</a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CREATED VIDEO HISTORY GALLERY */}
            <div className="bg-slate-900/40 rounded-[2.5rem] p-8 border border-white/10 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left text-slate-400"></i>
                  <h3 className="text-[10px] font-black uppercase text-white tracking-widest">Studio Pack History</h3>
                </div>
                <span className="text-[9px] font-black uppercase text-ggd-orange px-2 py-0.5 bg-ggd-orange/10 rounded-full">{createdVideos.length} Saved</span>
              </div>

              {createdVideos.length === 0 ? (
                <div className="p-10 text-center bg-black/20 rounded-2xl border border-white/5">
                  <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider leading-relaxed">No custom videos generated yet. Try autopilot above!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {createdVideos.map((video) => (
                    <div key={video.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-3 hover:border-ggd-orange/20 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="text-left space-y-1">
                          <p className="text-[10px] font-black uppercase text-white truncate max-w-[180px]">{video.topic}</p>
                          <p className="text-[8px] text-slate-500 font-bold">{video.date}</p>
                        </div>
                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${video.aspectRatio === 'vertical' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'}`}>
                          {video.aspectRatio === 'vertical' ? 'Portrait' : 'Landscape'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a 
                          href={video.videoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1 py-2 bg-ggd-orange text-white text-[8px] font-black uppercase rounded-lg text-center tracking-wider hover:brightness-110"
                        >
                          Play Demo Video
                        </a>
                        <button 
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = video.videoUrl;
                            link.download = `autopilot_video_${video.id}.mp4`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }} 
                          className="p-2 bg-white/10 text-white hover:text-ggd-orange rounded-lg text-center text-xs"
                          title="Download to Files"
                        >
                          <i className="fa-solid fa-download"></i>
                        </button>
                        <button 
                          onClick={() => {
                            const updated = createdVideos.filter(v => v.id !== video.id);
                            setCreatedVideos(updated);
                            localStorage.setItem('ggd_created_videos', JSON.stringify(updated));
                          }} 
                          className="p-2 bg-red-600/10 text-red-500 hover:bg-red-600/20 rounded-lg text-center text-xs"
                          title="Delete"
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
          <div className="animate-rise space-y-6">
             <div className="bg-slate-900/40 rounded-[2.5rem] p-8 border border-white/10 space-y-6">
                <h2 className="text-xl font-black uppercase text-white">Vixora Voice Studio</h2>
                <div className="flex gap-2">
                   {['Kore', 'Zephyr', 'Puck'].map(v => (
                     <button key={v} onClick={() => setSelectedVoice(v)} className={`flex-1 py-2 rounded-xl text-[9px] font-bold uppercase border ${selectedVoice === v ? 'bg-ggd-orange border-ggd-orange' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                       {v === 'Kore' ? 'Vixora Voice' : v}
                     </button>
                   ))}
                </div>
                <textarea value={voiceoverText} onChange={e => setVoiceoverText(e.target.value)} className="w-full h-40 bg-black/40 border border-white/10 rounded-2xl p-4 text-xs outline-none focus:border-ggd-orange" placeholder="Enter text for voiceover..." />
                <button disabled={isGeneratingVoiceover} onClick={() => handleGenerateVoiceover()} className="w-full py-4 bg-ggd-orange rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">
                   {isGeneratingVoiceover ? 'Processing...' : 'Create Voiceover'}
                </button>
                {lastVoiceoverAudio && (
                  <button onClick={downloadVoiceover} className="w-full py-3 bg-emerald-600 rounded-xl text-[9px] font-black uppercase shadow-lg">Download WAV</button>
                )}
             </div>
          </div>
        )}

        {activeTab === 'more' && (
          <div className="animate-rise space-y-6">
             <div className="bg-slate-900/40 rounded-[2.5rem] p-8 border border-white/10 space-y-6">
                <h2 className="text-xl font-black uppercase text-white">Growth & SEO Tools</h2>
                <div className="flex gap-2">
                   {['Tags', 'Hooks', 'Thumbnails'].map(t => (
                     <button key={t} onClick={() => setToolInput('')} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-[8px] font-black uppercase hover:bg-white/10 transition-all">
                       {t}
                     </button>
                   ))}
                </div>
                <input value={toolInput} onChange={e => setToolInput(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs outline-none focus:border-ggd-orange" placeholder="Video Topic..." />
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => handleToolAction('tags')} className="py-3 bg-blue-600/20 text-blue-400 rounded-xl text-[8px] font-black uppercase border border-blue-600/20 active:scale-95 transition-all">Viral Tags</button>
                   <button onClick={() => handleToolAction('hooks')} className="py-3 bg-purple-600/20 text-purple-400 rounded-xl text-[8px] font-black uppercase border border-purple-600/20 active:scale-95 transition-all">Retention Hooks</button>
                </div>
                {isToolLoading && <div className="text-center py-4"><i className="fa-solid fa-spinner animate-spin"></i></div>}
                {toolOutput && (
                   <div className="p-5 bg-white/5 border border-white/10 rounded-2xl animate-rise relative">
                      <p className="text-[10px] text-white/70 leading-relaxed font-mono whitespace-pre-wrap">{toolOutput}</p>
                      <button onClick={() => { navigator.clipboard.writeText(toolOutput); alert('Copied!'); }} className="absolute top-4 right-4 text-white/30 hover:text-white"><i className="fa-solid fa-copy"></i></button>
                   </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="animate-rise space-y-8">
            <div className="bg-white/5 border border-white/10 rounded-[3rem] p-10 text-center shadow-xl">
               <div className="w-16 h-16 bg-slate-800 rounded-3xl mx-auto flex items-center justify-center text-white text-2xl mb-4 border border-white/10 shadow-lg"><i className="fa-solid fa-user-ninja"></i></div>
               <h2 className="text-lg font-black uppercase tracking-tight">{user?.fullName}</h2>
               <p className="text-[8px] text-ggd-orange font-bold uppercase tracking-widest mt-1">Status: Gold Creator Tier</p>
            </div>

            <div className="bg-slate-900 rounded-3xl p-5 border border-white/10 space-y-4">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">App Environment</h3>
               <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                     <span className="text-[10px] font-bold text-slate-400 uppercase">Network Mode</span>
                     <div className="flex items-center gap-2">
                       <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`}></span>
                       <span className="text-[9px] font-black uppercase">{isOnline ? 'Online Integration' : 'Offline Mode Active'}</span>
                     </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                     <span className="text-[10px] font-bold text-slate-400 uppercase">App Client Type</span>
                     <span className="text-[9px] font-black uppercase text-ggd-orange">{isStandalone ? 'Installed Native App' : 'Web Browser Mode'}</span>
                  </div>
                  {deferredPrompt && (
                    <button onClick={triggerPwaInstall} className="w-full mt-2 py-4 bg-ggd-orange/15 hover:bg-ggd-orange/25 text-ggd-orange border border-ggd-orange/20 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-lg">
                       <i className="fa-solid fa-download mr-1.5"></i> Install Native App Wrapper
                    </button>
                  )}
               </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-5 border border-white/10 space-y-4">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Creator Persona & Target Niche</h3>
               <p className="text-[9px] text-slate-400 leading-normal">Configure your primary target demographic and channel focus. Vixora automatically tailors script voice tones and footage search terms to dominate this audience.</p>
               <div className="grid grid-cols-2 gap-2 pt-2">
                 {NICHE_OPTIONS.map(n => {
                    const isSelected = (user as any)?.niche === n.id;
                    return (
                       <button 
                         key={n.id} 
                         onClick={() => {
                           if (!user) return;
                           const updated = { ...user, niche: n.id };
                           setUser(updated);
                           localStorage.setItem('ggd_creator_user', JSON.stringify(updated));
                         }}
                         className={`p-3 rounded-xl border flex items-center gap-2 text-left transition-all ${isSelected ? 'bg-ggd-orange/15 border-ggd-orange text-white' : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10'}`}
                       >
                         <span className={`w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center shrink-0 ${isSelected ? 'text-ggd-orange' : 'text-slate-500'}`}>
                           <i className={`fa-solid ${n.icon} text-xs`}></i>
                         </span>
                         <span className="text-[8.5px] font-black uppercase tracking-tight leading-tight truncate">{n.name}</span>
                       </button>
                    );
                 })}
               </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-5 border border-white/10 space-y-4">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">API Credentials</h3>
               <div className="space-y-3">
                  <input type="password" value={newApiKey} onChange={e => setNewApiKey(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-mono outline-none focus:border-ggd-orange" placeholder="Gemini API Key" />
                  <button onClick={updateApiKey} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-lg">Save To Hub</button>
               </div>
            </div>

            <button className="w-full py-5 text-[9px] font-black text-red-500 uppercase bg-white/5 border border-red-500/20 rounded-2xl active:scale-95 transition-all" onClick={() => { localStorage.clear(); window.location.reload(); }}>Full App Data Reset</button>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="animate-rise space-y-6">
             <div className="bg-slate-900/40 rounded-[2.5rem] p-10 border border-white/10 space-y-8 text-center shadow-2xl">
                <div className="w-20 h-20 bg-white/5 rounded-full mx-auto flex items-center justify-center text-ggd-orange text-3xl border border-white/10"><i className="fa-solid fa-headset"></i></div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Get In Touch</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Vixora Support</p>
                </div>

                <div className="space-y-4">
                   <a href="https://wa.me/2347043537401" target="_blank" className="w-full flex items-center justify-between p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl active:scale-95 transition-all"><div className="flex items-center gap-4 text-left"><i className="fa-brands fa-whatsapp text-2xl text-emerald-500"></i><div><p className="text-[10px] font-black uppercase text-white">WhatsApp Support</p><p className="text-[9px] font-bold text-slate-400">Message us anytime</p></div></div><i className="fa-solid fa-arrow-right text-[10px]"></i></a>
                   <a href="tel:07043537401" className="w-full flex items-center justify-between p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl active:scale-95 transition-all"><div className="flex items-center gap-4 text-left"><i className="fa-solid fa-phone text-2xl text-blue-500"></i><div><p className="text-[10px] font-black uppercase text-white">Direct Line</p><p className="text-[9px] font-bold text-slate-400">070-435-37401</p></div></div><i className="fa-solid fa-arrow-right text-[10px]"></i></a>
                   <a href="mailto:goodgiftdigital@gmail.com" className="w-full flex items-center justify-between p-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl active:scale-95 transition-all"><div className="flex items-center gap-4 text-left"><i className="fa-solid fa-envelope text-2xl text-purple-500"></i><div><p className="text-[10px] font-black uppercase text-white">Email Contact</p><p className="text-[9px] font-bold text-slate-400">goodgiftdigital@gmail.com</p></div></div><i className="fa-solid fa-arrow-right text-[10px]"></i></a>
                   <a href="https://ggdigital.com.ng" target="_blank" className="w-full flex items-center justify-between p-5 bg-ggd-orange/10 border border-ggd-orange/20 rounded-2xl active:scale-95 transition-all"><div className="flex items-center gap-4 text-left"><i className="fa-solid fa-globe text-2xl text-ggd-orange"></i><div><p className="text-[10px] font-black uppercase text-white">Our Site</p><p className="text-[9px] font-bold text-slate-400">More products available</p></div></div><i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i></a>
                </div>

                <div className="pt-4 border-t border-white/5">
                   <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest">© 2026 Vixora. All rights reserved.</p>
                </div>
             </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-2xl rounded-[3rem] p-2 flex items-center justify-between z-50 border border-white/10 shadow-2xl">
         <button onClick={() => setActiveTab('studio')} className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all ${activeTab === 'studio' ? 'text-ggd-orange' : 'text-slate-500'}`}>
            <i className="fa-solid fa-microphone-lines text-lg"></i>
            <span className="text-[7px] font-black uppercase">Studio</span>
         </button>
         <button onClick={() => setActiveTab('scripts')} className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all ${activeTab === 'scripts' ? 'text-purple-400' : 'text-slate-500'}`}>
            <i className="fa-solid fa-scroll text-lg"></i>
            <span className="text-[7px] font-black uppercase">Scripts</span>
         </button>
         <button onClick={() => setActiveTab('videos')} className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all ${activeTab === 'videos' ? 'text-orange-400' : 'text-slate-500'}`}>
            <i className="fa-solid fa-clapperboard text-lg"></i>
            <span className="text-[7px] font-black uppercase">Creator</span>
         </button>
         <button onClick={() => setActiveTab('voiceover')} className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all ${activeTab === 'voiceover' ? 'text-blue-400' : 'text-slate-500'}`}>
            <i className="fa-solid fa-waveform-lines text-lg"></i>
            <span className="text-[7px] font-black uppercase">Voice</span>
         </button>
         <button onClick={() => setActiveTab('more')} className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all ${activeTab === 'more' ? 'text-emerald-400' : 'text-slate-500'}`}>
            <i className="fa-solid fa-bolt-lightning text-lg"></i>
            <span className="text-[7px] font-black uppercase">Tools</span>
         </button>
      </nav>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
