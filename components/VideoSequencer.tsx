import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { PRESET_MUSIC_TRACKS } from '../constants';
import { PRESET_SFX_CATALOG, playProceduralSFX } from '../sfxLibrary';
import { SFXPlacement, VideoTemplate } from '../types';
import { syncFirebaseSaveTemplate } from '../services/firebaseService';
import { scoreAndFetchBeatVisual, BeatAuditLog, VisualClipCandidate } from '../services/stockSourcingService';

export interface SourcedVideo {
  id: number | string;
  url: string;
  image: string;
  duration: number;
  mediaType?: 'video' | 'photo';
  title?: string;
  matchScore?: number;
  searchQuery?: string;
  confidence?: 'high' | 'medium' | 'low_confidence';
  fallbackUsed?: boolean;
  video_files: Array<{
    link: string;
    quality: string;
    width: number;
    height: number;
  }>;
}

interface VideoSequencerProps {
  scriptText: string;
  voiceoverBase64: string | null;
  sourcedVideos: SourcedVideo[];
  aspectRatio?: 'vertical' | 'horizontal' | 'square';
  onAspectRatioChange?: (ratio: 'vertical' | 'horizontal' | 'square') => void;
  onVideoCompiled?: (
    blobUrl: string, 
    orientation: 'vertical' | 'horizontal' | 'square', 
    metadata?: { duration?: string; resolution?: string; format?: string }
  ) => void;
  selectedMusicUrl?: string;
  onSelectedMusicUrlChange?: (url: string) => void;
  musicVolume?: number;
  onMusicVolumeChange?: (vol: number) => void;
  onMoodDetected?: (mood: string) => void;
  themeMode?: 'light' | 'dark';
}

interface TimeWord {
  text: string;
  start: number;
  end: number;
  index: number;
}

interface Segment {
  id: number;
  text: string;
  words: TimeWord[];
  start: number;
  end: number;
  videoUrl: string;
  videoId: number | string;
  thumbnail: string;
  mediaType?: 'video' | 'photo';
  title?: string;
  matchScore?: number;
  searchQuery?: string;
  confidence?: 'high' | 'medium' | 'low_confidence';
  fallbackUsed?: boolean;
  speed?: number;
}

// Semantic emoji dictionary for CapCut AI Emoji translation
const getSemanticEmoji = (word: string): string => {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (/^(money|cash|rich|wealth|gold|dollar|boss|pay|buy|earn|cost|expense|millions|billions)$/.test(clean)) return '💰';
  if (/^(idea|brain|mind|think|learn|stud|know|thought|creativ|imag|question)$/.test(clean)) return '💡';
  if (/^(fire|hot|burn|excit|lit|popular|viral)$/.test(clean)) return '🔥';
  if (/^(love|heart|passion|romance|feel|babe|sweet)$/.test(clean)) return '❤️';
  if (/^(success|win|goal|rocket|fly|space|star|above)$/.test(clean)) return '🚀';
  if (/^(grow|up|gain|invest|scal|high|big|huge|expand)$/.test(clean)) return '📈';
  if (/^(time|clock|fast|speed|run|hour|day|calendar|wait|late)$/.test(clean)) return '⏱️';
  if (/^(alert|warning|caution|danger|scary|stop|careful)$/.test(clean)) return '⚠️';
  if (/^(music|sound|voice|vocal|song|sing|podcast|mic)$/.test(clean)) return '🎵';
  if (/^(smile|happy|joy|laugh|fun|haha)$/.test(clean)) return '😊';
  if (/^(book|read|write|school|college|paper)$/.test(clean)) return '📖';
  if (/^(sad|cry|hurt|sorry|tear)$/.test(clean)) return '😢';
  if (/^(power|strong|gym|fit|muscle|work)$/.test(clean)) return '💪';
  if (/^(car|drive|ride|speed|road)$/.test(clean)) return '🏎️';
  if (/^(phone|call|text|connect|mobile)$/.test(clean)) return '📱';
  if (/^(earth|world|global|nature|plant)$/.test(clean)) return '🌍';
  if (/^(camera|video|shoot|photo|creator|studio)$/.test(clean)) return '🎥';
  return '';
};

// WAV Header Helper Node
export function createWavHeader(dataLength: number, sampleRate: number, numChannels: number, bitsPerSample: number) {
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

export const CAPCUT_TEMPLATES = [
  { id: 'bold-yellow', name: 'CapCut Classic', color: '#facc15', font: '"Montserrat Bold", "Montserrat", "Space Grotesk", sans-serif', description: 'Yellow active word with bold black outer contours' },
  { id: 'toktok-neon', name: 'TikTok Pop', color: '#22c55e', font: '"Impact", "Arial Black", sans-serif', description: 'Bright neon green pop with capital letters' },
  { id: 'darkbox', name: 'Minimal Darkbox', color: '#ffffff', font: '"Montserrat Bold", "Montserrat", "Inter", sans-serif', description: 'Translucent background box behind captions' },
  { id: 'cyber-future', name: 'Cyberpunk Cyber', color: '#ec4899', font: '"JetBrains Mono", monospace', description: 'Glowing neon pink with cyber-cyan contours' },
  { id: 'karaoke-grad', name: 'Karaoke Glow', color: '#f59e0b', font: '"Montserrat Bold", "Space Grotesk", sans-serif', description: 'Faded subtitles, flowing gold highlight' }
];

export const VideoSequencer: React.FC<VideoSequencerProps> = ({
  scriptText,
  voiceoverBase64,
  sourcedVideos,
  aspectRatio: controlledAspectRatio,
  onAspectRatioChange,
  onVideoCompiled,
  selectedMusicUrl: propSelectedMusicUrl,
  onSelectedMusicUrlChange: propOnSelectedMusicUrlChange,
  musicVolume: propMusicVolume,
  onMusicVolumeChange: propOnMusicVolumeChange,
  onMoodDetected,
  themeMode = 'dark',
}) => {
  const [localAspectRatio, setLocalAspectRatio] = useState<'vertical' | 'horizontal' | 'square'>('vertical');
  const aspectRatio = controlledAspectRatio || localAspectRatio;

  const setAspectRatio = (ratio: 'vertical' | 'horizontal' | 'square') => {
    setLocalAspectRatio(ratio);
    if (onAspectRatioChange) {
      onAspectRatioChange(ratio);
    }
  };

  const [segments, setSegments] = useState<Segment[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(10); // fallback default
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  const [compiledBlobUrl, setCompiledBlobUrl] = useState<string | null>(null);
  const [compiledFormat, setCompiledFormat] = useState<'webm' | 'mp4'>('webm');
  const [exportResolution, setExportResolution] = useState<'720p' | '1080p' | '4K'>('1080p');
  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm'>('mp4');
  const [formatFallbackNote, setFormatFallbackNote] = useState<string | null>(null);
  const hasAutoCompiledRef = useRef<boolean>(false);
  const [captionColor, setCaptionColor] = useState<string>('#facc15'); // Yellow fallback
  const [fontSize, setFontSize] = useState<number>(24);
  const [captionTemplate, setCaptionTemplate] = useState<string>('bold-yellow');
  const [aiEmojiMode, setAiEmojiMode] = useState<boolean>(true);

  // --- SOUND EFFECTS (SFX) STATE ---
  const [sfxPlacements, setSfxPlacements] = useState<SFXPlacement[]>([
    { id: 'sfx_init_1', sfxId: 'sfx_whoosh', name: 'Fast Air Whoosh', synthType: 'whoosh', timestamp: 0.1 },
    { id: 'sfx_init_2', sfxId: 'sfx_pop', name: 'Bubble Pop', synthType: 'pop', timestamp: 2.2 },
    { id: 'sfx_init_3', sfxId: 'sfx_sparkle', name: 'Magic Glint / Chime', synthType: 'sparkle', timestamp: 4.8 }
  ]);
  const [autoSfxEnabled, setAutoSfxEnabled] = useState<boolean>(true);
  const [showSfxModal, setShowSfxModal] = useState<boolean>(false);
  const [selectedSfxId, setSelectedSfxId] = useState<string>('sfx_whoosh');
  const lastTriggeredSfxRef = useRef<Set<string>>(new Set());

  // --- SAVE VIDEO TEMPLATE STATE ---
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState<boolean>(false);
  const [templateTitle, setTemplateTitle] = useState<string>('');
  const [templateDesc, setTemplateDesc] = useState<string>('');
  const [templateNiche, setTemplateNiche] = useState<string>('General');
  const [isSavingTemplate, setIsSavingTemplate] = useState<boolean>(false);
  const [templateSavedMsg, setTemplateSavedMsg] = useState<string | null>(null);

  // --- MOBILE EDITOR TAB DOCK STATE ---
  const [activeEditorTab, setActiveEditorTab] = useState<'timeline' | 'audio' | 'captions' | 'speed' | 'export'>('timeline');

  const [alignedWords, setAlignedWords] = useState<TimeWord[] | null>(null);
  const [isAligning, setIsAligning] = useState<boolean>(false);
  const [alignmentError, setAlignmentError] = useState<string | null>(null);

  // --- BACKGROUND MUSIC STATES & PROPS MAPPING ---
  const [localMusicUrl, setLocalMusicUrl] = useState<string>('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
  const selectedMusicUrl = propSelectedMusicUrl !== undefined ? propSelectedMusicUrl : localMusicUrl;
  const setSelectedMusicUrl = propOnSelectedMusicUrlChange || setLocalMusicUrl;

  const [musicBuffer, setMusicBuffer] = useState<AudioBuffer | null>(null);

  const [localMusicVolume, setLocalMusicVolume] = useState<number>(0.15); // 15% default volume
  const musicVolume = propMusicVolume !== undefined ? propMusicVolume : localMusicVolume;
  const setMusicVolume = propOnMusicVolumeChange || setLocalMusicVolume;

  const [musicLoading, setMusicLoading] = useState<boolean>(false);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [extractedMood, setExtractedMood] = useState<string>('motivational');
  const [musicTracks] = useState(PRESET_MUSIC_TRACKS);

  const [isReSourcingBeatId, setIsReSourcingBeatId] = useState<number | null>(null);

  const setSegmentSpeed = (id: number, speed: number) => {
    setSegments(prev => prev.map(seg => {
      if (seg.id === id) {
        return { ...seg, speed };
      }
      return seg;
    }));
  };

  const handleReSourceBeat = async (segId: number) => {
    const targetSeg = segments.find(s => s.id === segId);
    if (!targetSeg) return;

    setIsReSourcingBeatId(segId);

    try {
      const orientationParam = aspectRatio === 'vertical' ? 'portrait' : aspectRatio === 'horizontal' ? 'landscape' : 'square';
      const usedIds = new Set(segments.map(s => s.videoId));
      const activeKey = (window as any).PEXELS_API_KEY || process.env.API_KEY || '';

      const { clip } = await scoreAndFetchBeatVisual(
        targetSeg.text,
        targetSeg.searchQuery || targetSeg.text.slice(0, 30),
        orientationParam,
        activeKey,
        usedIds,
        segId
      );

      const hdFile = clip.video_files.find(f => f.quality === 'hd') || clip.video_files[0];
      const newVideoUrl = hdFile?.link || clip.image || clip.url;

      setSegments(prev => prev.map(s => {
        if (s.id === segId) {
          return {
            ...s,
            videoUrl: newVideoUrl,
            videoId: clip.id,
            thumbnail: clip.image,
            mediaType: clip.mediaType,
            title: clip.title,
            matchScore: clip.matchScore,
            searchQuery: clip.searchQuery,
            confidence: clip.confidence,
            fallbackUsed: clip.fallbackUsed
          };
        }
        return s;
      }));

      if (clip.image) {
        const img = new Image();
        img.src = clip.image;
        thumbnailImgCacheRef.current[clip.image] = img;
      }
    } catch (err) {
      console.error(`Failed to re-source beat #${segId}:`, err);
    } finally {
      setIsReSourcingBeatId(null);
    }
  };

  const activeSeg = segments.find(seg => currentTime >= seg.start && currentTime <= seg.end) 
    || segments[segments.length - 1] 
    || (segments.length > 0 ? segments[0] : null);

  // Audio Context Ref for player
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const musicSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const musicGainNodeRef = useRef<GainNode | null>(null);
  const compileMusicSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Helper to download and decode royalty-free background music track safely with clear error handling
  const downloadAndPrepareMusic = async (url: string) => {
    setMusicLoading(true);
    setMusicError(null);

    const fetchWithFallback = async (targetUrl: string): Promise<ArrayBuffer> => {
      // Attempt 1: Direct fetch with cors mode configuration (best if server is CORS-friendly)
      try {
        const response = await fetch(targetUrl, { mode: 'cors' });
        if (response.ok) {
          return await response.arrayBuffer();
        }
      } catch (e) {
        console.warn("[!] Direct fetch failed due to CORS, trying proxy 1 (corsproxy.io)...", e);
      }

      // Attempt 2: CORS Proxy 1 (corsproxy.io)
      try {
        const proxy1Url = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxy1Url);
        if (response.ok) {
          return await response.arrayBuffer();
        }
      } catch (e) {
        console.warn("[!] Proxy 1 (corsproxy.io) failed, trying proxy 2 (allorigins.win)...", e);
      }

      // Attempt 3: CORS Proxy 2 (allorigins.win)
      try {
        const proxy2Url = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const response = await fetch(proxy2Url);
        if (response.ok) {
          return await response.arrayBuffer();
        }
      } catch (e) {
        console.warn("[!] Proxy 2 (allorigins.win) failed...", e);
      }

      throw new Error("Failed to fetch audio stream after attempting all CORS proxies.");
    };

    try {
      const arrayBuffer = await fetchWithFallback(url);
      
      const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      
      // Decode audio data safely
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      setMusicBuffer(buffer);
      console.log("[+] Background music loaded and decoded successfully. Duration:", buffer.duration);
    } catch (err: any) {
      console.info("[i] Sourcing royalty-free music synth loop due to CORS or mute/silent media track...", err.message || err);
      setMusicError("Active CORS Proxies throttled. Configurable offline backup pad synthesized.");
      
      // Fallback: Programmatically synthesize a professional, calming, ambient music pad!
      try {
        const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        
        // Let's determine the mood style based on URL and current extracted mood
        let style = 'calm';
        const urlLower = url.toLowerCase();
        const moodLower = extractedMood ? extractedMood.toLowerCase() : 'calm';

        if (urlLower.includes('motivation') || moodLower.includes('motivational') || moodLower.includes('inspiring') || urlLower.includes('rise')) {
          style = 'motivational';
        } else if (urlLower.includes('epic') || urlLower.includes('drama') || moodLower.includes('dramatic') || moodLower.includes('cinema')) {
          style = 'epic';
        } else if (urlLower.includes('upbeat') || urlLower.includes('pop') || urlLower.includes('bright') || moodLower.includes('upbeat')) {
          style = 'upbeat';
        } else if (urlLower.includes('corporate') || urlLower.includes('business') || moodLower.includes('corporate') || urlLower.includes('clean')) {
          style = 'corporate';
        } else if (urlLower.includes('tech') || urlLower.includes('cyber') || urlLower.includes('future') || moodLower.includes('tech')) {
          style = 'tech';
        } else if (urlLower.includes('calm') || urlLower.includes('chill') || urlLower.includes('ambient') || urlLower.includes('lofi') || moodLower.includes('calm')) {
          style = 'calm';
        }

        const sampleRate = ctx.sampleRate;
        const duration = 16.0; // 16 seconds loop for rich variety
        const numSamples = sampleRate * duration;
        const synthBuffer = ctx.createBuffer(2, numSamples, sampleRate);
        const leftChannel = synthBuffer.getChannelData(0);
        const rightChannel = synthBuffer.getChannelData(1);

        console.info(`[i] Synthesizing high-fidelity browser background score. Mood Style: ${style.toUpperCase()}`);

        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          
          // Set up a 4-chord progression changing every 4 seconds
          const chordIndex = Math.floor(t / 4.0) % 4;
          let notes: number[] = [];
          
          if (style === 'calm') {
            // Smooth, luxurious Lofi Chord Progression (Maj7 / Min7)
            if (chordIndex === 0) notes = [130.81, 164.81, 196.00, 246.94];
            else if (chordIndex === 1) notes = [110.00, 130.81, 164.81, 196.00];
            else if (chordIndex === 2) notes = [87.31, 110.00, 130.81, 164.81];
            else notes = [98.00, 130.81, 146.83, 174.61];
          } 
          else if (style === 'motivational') {
            // Bright, Uplifting Piano / Symphony (C -> G -> Am -> F)
            if (chordIndex === 0) notes = [130.81, 164.81, 196.00, 261.63];
            else if (chordIndex === 1) notes = [98.00, 123.47, 146.83, 196.00];
            else if (chordIndex === 2) notes = [110.00, 130.81, 164.81, 220.00];
            else notes = [87.31, 110.00, 130.81, 174.61];
          } 
          else if (style === 'epic') {
            // Deep Orchestral / Brass & Heavy Choir (Am -> F -> C -> G)
            if (chordIndex === 0) notes = [55.00, 110.00, 130.81, 164.81];
            else if (chordIndex === 1) notes = [43.65, 87.31, 110.00, 130.81];
            else if (chordIndex === 2) notes = [65.41, 130.81, 164.81, 196.00];
            else notes = [49.00, 98.00, 123.47, 146.83];
          } 
          else if (style === 'upbeat') {
            // Fun Pop / Bright Acoustic Chords (G -> C -> D -> Em)
            if (chordIndex === 0) notes = [98.00, 146.83, 196.00, 293.66];
            else if (chordIndex === 1) notes = [130.81, 196.00, 261.63, 329.63];
            else if (chordIndex === 2) notes = [146.83, 220.00, 293.66, 369.99];
            else notes = [82.41, 164.81, 196.00, 329.63];
          } 
          else if (style === 'corporate') {
            // Warm corporate neutral presentation chords (F -> G -> Em -> Am)
            if (chordIndex === 0) notes = [87.31, 130.81, 174.61, 220.00];
            else if (chordIndex === 1) notes = [98.00, 146.83, 196.00, 246.94];
            else if (chordIndex === 2) notes = [82.41, 130.81, 164.81, 246.94];
            else notes = [110.00, 164.81, 220.00, 261.63];
          } 
          else {
            // Technological cyberpunk future (Am -> G -> F -> E)
            if (chordIndex === 0) notes = [110.00, 164.81, 220.00, 329.63];
            else if (chordIndex === 1) notes = [98.00, 146.83, 196.00, 293.66];
            else if (chordIndex === 2) notes = [87.31, 130.81, 174.61, 261.63];
            else notes = [82.41, 123.47, 164.81, 246.94];
          }

          // Generate base pad synthesis (slow envelope sweep)
          const envelope = Math.sin((t % 4.0) / 4.0 * Math.PI);
          
          // Combine pad voices
          let padVal = 0;
          for (let n = 0; n < notes.length; n++) {
            const freq = notes[n];
            if (style === 'calm' || style === 'corporate') {
              padVal += Math.sin(2 * Math.PI * freq * t) * 0.45;
              padVal += Math.sin(2 * Math.PI * (freq * 2) * t) * 0.10; // soft octave sparkle
            } 
            else if (style === 'epic') {
              const saw = 1.0 - (2.0 * ((t * freq) % 1.0));
              padVal += saw * 0.35;
              padVal += Math.sin(2 * Math.PI * freq * t) * 0.25;
            } 
            else if (style === 'tech') {
              const sq = ((t * freq) % 1.0) < 0.5 ? 1.0 : -1.0;
              const cutoffFreq = 800 + Math.sin(t * 0.5) * 500;
              const filterSweep = freq < cutoffFreq ? 1.0 : 0.1;
              padVal += sq * 0.25 * filterSweep;
            } 
            else {
              padVal += Math.sin(2 * Math.PI * freq * t) * 0.4;
              padVal += (1.0 - (2.0 * ((t * (freq * 2.0)) % 1.0))) * 0.05;
            }
          }
          padVal /= notes.length;

          // Add subtle dynamic arpeggiator melody over chord notes!
          let melVal = 0;
          if (style === 'calm' || style === 'motivational' || style === 'corporate' || style === 'tech') {
            const arpeggioSpeed = style === 'tech' ? 0.20 : 0.40;
            const arpIndex = Math.floor(t / arpeggioSpeed) % 8;
            const baseNote = notes[arpIndex % notes.length];
            const arpFreq = baseNote * (arpIndex < 4 ? 2 : 4);
            const plEnvelope = Math.max(0, 1.0 - ((t % arpeggioSpeed) / arpeggioSpeed));
            
            if (style === 'tech') {
              melVal = Math.sin(2 * Math.PI * arpFreq * t) * 0.45 + ((((t * arpFreq) % 1.0) < 0.5 ? 1.0 : -1.0) * 0.15);
            } else {
              const tri = 1.0 - 4.0 * Math.abs(Math.round(t * arpFreq) - (t * arpFreq));
              melVal = tri * 0.6;
            }
            melVal *= 0.15 * plEnvelope;
          }

          // Rhythmic element
          let beatVal = 0;
          if (style === 'upbeat' || style === 'tech' || style === 'corporate') {
            const beatTerm = style === 'upbeat' ? 0.5 : 1.0;
            const bEnvelope = Math.max(0, 1.0 - ((t % beatTerm) / 0.15));
            if (t % beatTerm < 0.02) {
              const kickPitch = Math.max(40, 150 * Math.exp(-((t % beatTerm) * 120)));
              beatVal = Math.sin(2 * Math.PI * kickPitch * t) * 0.65;
            } else {
              beatVal = (Math.random() - 0.5) * 0.05;
            }
            beatVal *= bEnvelope * 0.12;
          }

          // Combine with tape hiss warming (vinyl crackle simulation)
          const tapeWarming = (Math.random() - 0.5) * 0.005;
          const sampleVal = (padVal * envelope + melVal + beatVal + tapeWarming) * 0.15;

          leftChannel[i] = sampleVal;
          const stereoDelaySamples = Math.floor(sampleRate * 0.03);
          if (i > stereoDelaySamples) {
            rightChannel[i] = (sampleVal * 0.7) + (leftChannel[i - stereoDelaySamples] * 0.3);
          } else {
            rightChannel[i] = sampleVal;
          }
        }
        
        setMusicBuffer(synthBuffer);
        console.info(`[+] Dynamic synthesized background loop (${style}) compiled cleanly.`);
      } catch (synthErr) {
        console.warn("[!] Programmatic synthesizer fallback failed:", synthErr);
      }
    } finally {
      setMusicLoading(false);
    }
  };

  // Trigger music track preparation on URL change
  useEffect(() => {
    if (selectedMusicUrl) {
      downloadAndPrepareMusic(selectedMusicUrl);
    }
  }, [selectedMusicUrl]);

  // Extract mood or theme from script text using Gemini AI & query Pexels key to keep alignment
  useEffect(() => {
    if (!scriptText || scriptText === "Enter script and create voiceover") return;

    const detectMoodAndSearch = async () => {
      try {
        const activeApiKey = (window as any).__GEMINI_API_KEY__ || process.env.GEMINI_API_KEY || '';
        // If no credentials, we silent fallback cleanly to default motivational selection
        if (!activeApiKey) return;

        const ai = new GoogleGenAI({
          apiKey: activeApiKey,
          httpOptions: {
            headers: { 'User-Agent': 'aistudio-build' }
          }
        });

        const prompt = `Analyze the script text below. Determine the single most dominant mood or theme of this script. Select EXACTLY one of the following words: "motivational", "calm", "upbeat", "dramatic", "tech", "corporate".\n\nScript: "${scriptText.replace(/"/g, '\\"')}"`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt
        });

        const moodText = response.text?.trim().toLowerCase() || 'motivational';
        let matchedMood = 'motivational';
        if (moodText.includes('calm')) matchedMood = 'calm';
        else if (moodText.includes('upbeat')) matchedMood = 'upbeat';
        else if (moodText.includes('dramatic') || moodText.includes('epic')) matchedMood = 'dramatic';
        else if (moodText.includes('tech') || moodText.includes('future') || moodText.includes('cyber')) matchedMood = 'tech';
        else if (moodText.includes('corporate') || moodText.includes('business')) matchedMood = 'corporate';

        setExtractedMood(matchedMood);
        if (onMoodDetected) {
          onMoodDetected(matchedMood);
        }
        console.log("[+] AI detected dominant script mood:", matchedMood);

        // Standard matching of royalty-free background visual theme tags using existing Pexels credentials
        try {
          const PEXELS_API_KEY = 'wFE0bEysdabca67O2GKWXtE92HWh5XHBtcBmw14VaGcBfkB39q69mxb5';
          const pexelsSearch = await fetch(`https://api.pexels.com/videos/search?query=${matchedMood}&per_page=1`, {
            headers: { Authorization: PEXELS_API_KEY }
          });
          if (pexelsSearch.ok) {
            console.log("[+] Authenticated Pexels query triggered for background music matching mood:", matchedMood);
          }
        } catch (e) {
          console.error("[-] Swallowed Pexels API log query error:", e);
        }

        // Auto selection matching the track
        const matchedTrack = musicTracks.find(t => t.mood === matchedMood);
        if (matchedTrack) {
          setSelectedMusicUrl(matchedTrack.url);
        }
      } catch (err) {
        console.error("[-] Mood detection or Pexels search failed:", err);
      }
    };

    detectMoodAndSearch();
  }, [scriptText]);
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioStartTimeRef = useRef<number>(0);
  const audioPauseOffsetRef = useRef<number>(0);

  // Hidden references for composition
  const playerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Keeps track of the currently active video source to prevent redundant reloading
  const currentVideoSrcRef = useRef<string>('');

  // Cache of preloaded thumbnail image elements to prevent black "empty scenes" when video is buffering/loading
  const thumbnailImgCacheRef = useRef<Record<string, HTMLImageElement>>({});

  // Preload thumbnail images when segments list is ready/modified
  useEffect(() => {
    if (!segments || segments.length === 0) return;
    segments.forEach(seg => {
      if (seg.thumbnail && !thumbnailImgCacheRef.current[seg.thumbnail]) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = seg.thumbnail;
        thumbnailImgCacheRef.current[seg.thumbnail] = img;
      }
    });
  }, [segments]);

  // Auto clean up URL on unmount
  useEffect(() => {
    return () => {
      if (compiledBlobUrl) {
        URL.revokeObjectURL(compiledBlobUrl);
      }
      stopPlayback();
    };
  }, [compiledBlobUrl]);

  // Helpers for audio base64 handling (supports Fish Audio MP3, WAV and legacy PCM)
  const getWavBase64 = (rawPcmBase64: string): string => {
    try {
      const binaryString = atob(rawPcmBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const hasWavHeader = binaryString.startsWith('RIFF');
      const isMp3 = binaryString.startsWith('ID3') || (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0);
      if (hasWavHeader || isMp3) {
        return rawPcmBase64;
      }
      
      const rawPcm = new Int16Array(bytes.buffer);
      const header = createWavHeader(rawPcm.byteLength, 24000, 1, 16);
      const wavFile = new Uint8Array(header.length + rawPcm.byteLength);
      wavFile.set(header);
      wavFile.set(new Uint8Array(rawPcm.buffer), header.length);
      
      let binary = '';
      const batchSize = 8192;
      for (let i = 0; i < wavFile.length; i += batchSize) {
        binary += String.fromCharCode.apply(null, Array.from(wavFile.subarray(i, i + batchSize)));
      }
      return btoa(binary);
    } catch (e) {
      console.error("Failed to wrap audio in WAV base64:", e);
      return rawPcmBase64;
    }
  };

  // Auto trigger word-level alignment using Gemini 3.5-flash
  useEffect(() => {
    if (!voiceoverBase64 || !scriptText) {
      setAlignedWords(null);
      return;
    }

    const triggerAlignment = async () => {
      setIsAligning(true);
      setAlignmentError(null);
      try {
        const activeApiKey = (window as any).__GEMINI_API_KEY__ || process.env.GEMINI_API_KEY || process.env.API_KEY || '';
        if (!activeApiKey) {
          throw new Error("AI credentials uninitialized.");
        }

        const wavBase64 = getWavBase64(voiceoverBase64);

        const ai = new GoogleGenAI({
          apiKey: activeApiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const prompt = `Analyze the provided voiceover speech audio and the script text below. ` +
          `Your task is to perform forced audio-to-text alignment to find the EXACT start and end timestamps (in seconds) for EVERY single word spoken in the audio. ` +
          `The spoken text in the audio is precisely: "${scriptText.replace(/"/g, '\\"')}"\n\n` +
          `Please output a JSON list of objects, representing every word in order. Ensure each word's start and end times correspond EXACTLY to when it is heard spoken in the audio. Do not skip or drop any word. Ensure word timings are fully continuous and aligned with standard speaker cadence.`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              inlineData: {
                data: wavBase64,
                mimeType: "audio/wav"
              }
            },
            { text: prompt }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  start: { type: Type.NUMBER },
                  end: { type: Type.NUMBER }
                },
                required: ["text", "start", "end"]
              }
            }
          }
        });

        const jsonText = response.text?.trim();
        if (!jsonText) {
          throw new Error("AIGenerator did not return matching timestamps.");
        }

        const parsedContent = JSON.parse(jsonText);
        if (Array.isArray(parsedContent) && parsedContent.length > 0) {
          const timeWords: TimeWord[] = parsedContent.map((item: any, idx: number) => ({
            text: item.text,
            start: Number(item.start),
            end: Number(item.end),
            index: idx
          }));
          setAlignedWords(timeWords);
          console.log("[+] AI Word Caption Alignment succeeded! Generated words count:", timeWords.length);
        } else {
          throw new Error("Invalid timestamps format.");
        }
      } catch (err: any) {
        console.error("[-] AI forced audio-text alignment failed:", err);
        setAlignmentError(err?.message || "Sync alignment failed.");
      } finally {
        setIsAligning(false);
      }
    };

    triggerAlignment();
  }, [voiceoverBase64, scriptText]);

  // Parse Script and Sourced Videos to build Timeline
  useEffect(() => {
    if (!scriptText) return;

    const prepareTimeline = async () => {
      // 1. Determine Voiceover Duration
      let duration = 12; // Fallback duration in seconds if no voiceover is available
      if (voiceoverBase64) {
        try {
          const binaryString = atob(voiceoverBase64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          let audioData = bytes.buffer;
          const hasWavHeader = binaryString.startsWith('RIFF');
          const isMp3 = binaryString.startsWith('ID3') || (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0);
          
          if (!hasWavHeader && !isMp3) {
            const rawPcm = new Int16Array(audioData);
            const wavHeader = createWavHeader(rawPcm.byteLength, 24000, 1, 16);
            const wavFile = new Uint8Array(wavHeader.length + rawPcm.byteLength);
            wavFile.set(wavHeader);
            wavFile.set(new Uint8Array(rawPcm.buffer), wavHeader.length);
            audioData = wavFile.buffer;
          }

          const audioCtx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
          audioCtxRef.current = audioCtx;
          const decoded = await audioCtx.decodeAudioData(audioData);
          audioBufferRef.current = decoded;
          duration = decoded.duration;
        } catch (e) {
          console.error("Failed to decode voiceover audio for sequencer, using length fallback:", e);
          const wordsCount = scriptText.split(/\s+/).length;
          duration = Math.max(8, wordsCount / 2.2);
        }
      } else {
        const wordsCount = scriptText.split(/\s+/).length;
        duration = Math.max(8, wordsCount / 2.2);
      }

      setTotalDuration(duration);

      // 2. Split script into sentences/clauses
      const RawSentences = scriptText
        .split(/(?<=[.!?])\s+|\n+/)
        .map(s => s.trim())
        .filter(s => s.length > 3);

      if (RawSentences.length === 0) return;

      console.log(`[SEQUENCER_BEATS] ${RawSentences.length} distinct beat objects generated for script:`, RawSentences.map((s, i) => ({ beatId: i + 1, text: s })));
      console.log(`[SEQUENCER_SOURCED_VIDEOS] ${sourcedVideos.length} distinct sourced clips received by VideoSequencer:`, sourcedVideos.map((v, i) => ({ clipIndex: i + 1, id: v.id, title: v.title, query: v.searchQuery })));

      // 3. Map Sentences to Timeline segment window
      if (alignedWords && alignedWords.length > 0) {
        // --- HIGH FIDELITY AI SYNCHRONIZED ALIGNMENT ---
        let wordPointer = 0;
        setSegments(prev => {
          const updated = RawSentences.map((sentence, index) => {
            const sentenceWordsText = sentence.split(/\s+/);
            const matchedWords: TimeWord[] = [];
            
            for (let i = 0; i < sentenceWordsText.length; i++) {
              if (wordPointer < alignedWords.length) {
                matchedWords.push({
                  ...alignedWords[wordPointer],
                  index: i
                });
                wordPointer++;
              }
            }
            
            // Adjust segment start and end based on the first and last words
            const segStart = matchedWords.length > 0 ? matchedWords[0].start : (index === 0 ? 0 : prev[index - 1]?.end || index * (duration / RawSentences.length));
            let segEnd = matchedWords.length > 0 ? matchedWords[matchedWords.length - 1].end : (segStart + (duration / RawSentences.length));
            
            if (segEnd > duration) segEnd = duration;
            
            const videoIndex = index % Math.max(1, sourcedVideos.length);
            const video = sourcedVideos[videoIndex] || null;
            const hdFile = video?.video_files.find(f => f.quality === 'hd') || video?.video_files[0] || null;
            const videoUrl = hdFile?.link || video?.image || video?.url || "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4";

            const existing = prev.find(p => p.id === index);
            const speed = existing && existing.speed !== undefined ? existing.speed : 1.0;

            console.log(`[FINAL_RENDER_MAPPING] Beat #${index + 1} ("${sentence.slice(0, 25)}...") -> Assigned Video ID: ${video?.id || 'FALLBACK'}, Title: "${video?.title || 'Default Space'}", URL: ${videoUrl}`);

            return {
              id: index,
              text: sentence,
              words: matchedWords,
              start: segStart,
              end: segEnd,
              videoUrl,
              videoId: video?.id || 0,
              thumbnail: video?.image || '',
              mediaType: video?.mediaType || (videoUrl.includes('.mp4') ? 'video' : 'photo'),
              title: video?.title || `Beat ${index + 1}`,
              matchScore: video?.matchScore || 0.85,
              searchQuery: video?.searchQuery || sentence.slice(0, 30),
              confidence: video?.confidence || 'high',
              fallbackUsed: video?.fallbackUsed || false,
              speed,
            };
          });
          return updated;
        });
      } else {
        // --- SYNTHESIZED FALLBACK TIMING (PUNCTUATION WEIGHTED) ---
        const totalChars = RawSentences.reduce((acc, s) => acc + s.length, 0);
        let elapsed = 0;

        setSegments(prev => {
          const updated = RawSentences.map((sentence, index) => {
            const charWeight = sentence.length / totalChars;
            const segmentDuration = charWeight * duration;
            const segStart = elapsed;
            const segEnd = elapsed + segmentDuration;
            elapsed = segEnd;

            const videoIndex = index % Math.max(1, sourcedVideos.length);
            const video = sourcedVideos[videoIndex] || null;
            const hdFile = video?.video_files.find(f => f.quality === 'hd') || video?.video_files[0] || null;
            const videoUrl = hdFile?.link || video?.image || video?.url || "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4";

            const words = sentence.split(/\s+/);
            let wordsTotalWeight = 0;
            const wordWeights = words.map(w => {
              let pauseBonus = 0;
              if (/[.,!?]$/.test(w)) pauseBonus = 0.25;
              else if (/[,;:]$/.test(w)) pauseBonus = 0.12;
              const weight = Math.max(1, w.length) + (pauseBonus * 10);
              wordsTotalWeight += weight;
              return weight;
            });

            let wordElapsed = segStart;

            const timeWords: TimeWord[] = words.map((word, wIdx) => {
              const wordWeight = wordWeights[wIdx] / Math.max(1, wordsTotalWeight);
              const wordDuration = wordWeight * segmentDuration;
              const wordStart = wordElapsed;
              const wordEnd = wordElapsed + wordDuration;
              wordElapsed = wordEnd;
              return {
                text: word,
                start: wordStart,
                end: wordEnd,
                index: wIdx,
              };
            });

            const existing = prev.find(p => p.id === index);
            const speed = existing && existing.speed !== undefined ? existing.speed : 1.0;

            console.log(`[FINAL_RENDER_MAPPING] Beat #${index + 1} ("${sentence.slice(0, 25)}...") -> Assigned Video ID: ${video?.id || 'FALLBACK'}, Title: "${video?.title || 'Default Space'}", URL: ${videoUrl}`);

            return {
              id: index,
              text: sentence,
              words: timeWords,
              start: segStart,
              end: segEnd,
              videoUrl,
              videoId: video?.id || 0,
              thumbnail: video?.image || '',
              mediaType: video?.mediaType || (videoUrl.includes('.mp4') ? 'video' : 'photo'),
              title: video?.title || `Beat ${index + 1}`,
              matchScore: video?.matchScore || 0.85,
              searchQuery: video?.searchQuery || sentence.slice(0, 30),
              confidence: video?.confidence || 'high',
              fallbackUsed: video?.fallbackUsed || false,
              speed,
            };
          });
          return updated;
        });
      }
    };

    prepareTimeline();
  }, [scriptText, voiceoverBase64, sourcedVideos, alignedWords]);

  // --- AUTOMATIC COMPILATION TRIGGER ---
  useEffect(() => {
    hasAutoCompiledRef.current = false;
  }, [scriptText, voiceoverBase64]);

  useEffect(() => {
    if (
      segments.length > 0 &&
      voiceoverBase64 &&
      !isCompiling &&
      !compiledBlobUrl &&
      !hasAutoCompiledRef.current &&
      !isAligning
    ) {
      hasAutoCompiledRef.current = true;
      console.log("[⚡ AUTO-COMPILE] Automatically triggering video compilation...");
      const timer = setTimeout(() => {
        handleCompileVideo();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [segments, voiceoverBase64, isCompiling, compiledBlobUrl, isAligning]);

  // --- AUDIO PLAYBACK CORE ---

  const playVoiceoverNode = (startOffset: number) => {
    if (!audioBufferRef.current) return;
    const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;

    // stop existing nodes
    if (audioSourceNodeRef.current) {
      try {
        audioSourceNodeRef.current.disconnect();
      } catch (e) {}
    }
    if (musicSourceNodeRef.current) {
      try {
        musicSourceNodeRef.current.disconnect();
      } catch (e) {}
    }

    // 1. Play Voiceover Track
    const source = ctx.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(ctx.destination);
    source.start(0, startOffset);
    audioSourceNodeRef.current = source;

    // 2. Play Background Music Track (if fully fetched and ready)
    if (musicBuffer) {
      const musicSource = ctx.createBufferSource();
      musicSource.buffer = musicBuffer;
      musicSource.loop = true; // Auto-loop the music to match full video length

      const musicGain = ctx.createGain();
      musicGain.gain.setValueAtTime(musicVolume, ctx.currentTime);

      musicSource.connect(musicGain);
      musicGain.connect(ctx.destination);

      // Start music offset matching the current audio offset
      const startMusicOffset = startOffset % musicBuffer.duration;
      musicSource.start(0, startMusicOffset);

      musicSourceNodeRef.current = musicSource;
      musicGainNodeRef.current = musicGain;
    }
  };

  const stopVoiceoverNode = () => {
    if (audioSourceNodeRef.current) {
      try {
        audioSourceNodeRef.current.disconnect();
      } catch (e) {}
      audioSourceNodeRef.current = null;
    }
    if (musicSourceNodeRef.current) {
      try {
        musicSourceNodeRef.current.disconnect();
      } catch (e) {}
      musicSourceNodeRef.current = null;
    }
  };

  // --- RENDERING LOOP ON CANVAS ---

  // Helper to render premium glowing gradient fallback background
  const drawFallbackBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e1b4b');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 102, 0, 0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i < width; i += 85) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let j = 0; j < height; j += 85) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(width, j);
      ctx.stroke();
    }
  };

  const drawFrame = (time: number) => {
    try {
      const canvas = playerCanvasRef.current;
      const video = hiddenVideoRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Apply orientation size
      const width = aspectRatio === 'vertical' ? 1080 : 1920;
      const height = aspectRatio === 'vertical' ? 1920 : 1080;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      // 1. Draw Background Solid Pitch
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      // 2. Get active segment based on time
      if (!segments || segments.length === 0) {
        drawFallbackBackground(ctx, width, height);
        return;
      }

      const activeSeg = segments.find(seg => time >= seg.start && time <= seg.end) 
        || segments[segments.length - 1] 
        || segments[0];

      if (activeSeg) {
        // Manage core background video playback reference
        if (video) {
          try {
            if (activeSeg.videoUrl && currentVideoSrcRef.current !== activeSeg.videoUrl) {
              currentVideoSrcRef.current = activeSeg.videoUrl;
              video.src = activeSeg.videoUrl;
              video.load();
            }
          } catch (srcErr) {
            console.error("Failed to set video source:", srcErr);
          }
          
          try {
            const desiredSpeed = activeSeg.speed || 1.0;
            const isMediaActive = isPlaying || isCompiling;
            
            if (video.readyState >= 1) {
              if (video.playbackRate !== desiredSpeed) {
                video.playbackRate = desiredSpeed;
              }
              
              // Loop standard clip if clip is shorter, adjusting for customized playback speed
              const clipProgress = ((time - activeSeg.start) * desiredSpeed) % (video.duration || 10);
              if (Math.abs(video.currentTime - clipProgress) > 0.15 && isMediaActive) {
                video.currentTime = clipProgress;
              }
            }

            if (isMediaActive && video.paused) {
              video.play().catch((playErr) => {
                console.warn("video.play() was interrupted or blocked:", playErr);
              });
            } else if (!isMediaActive && !video.paused) {
              video.pause();
            }
          } catch (videoError) {
            console.warn("Non-fatal video state synchronization warning:", videoError);
          }

          // Check if video is loaded and ready or photo mode
          const isVideoReady = activeSeg.mediaType !== 'photo' && video.readyState >= 1 && video.videoWidth > 0 && video.videoHeight > 0;
          const cachedImg = activeSeg.thumbnail ? thumbnailImgCacheRef.current[activeSeg.thumbnail] : null;

          if (isVideoReady) {
            try {
              // Draw active video context onto canvas preserving correct aspect ratios using cover
              const vW = video.videoWidth;
              const vH = video.videoHeight;
              const targetRatio = width / height;
              const sourceRatio = vW / vH;
              let sWidth = vW;
              let sHeight = vH;
              let sx = 0;
              let sy = 0;

              if (sourceRatio > targetRatio) {
                sWidth = vH * targetRatio;
                sx = (vW - sWidth) / 2;
              } else {
                sHeight = vW / targetRatio;
                sy = (vH - sHeight) / 2;
              }

              ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, width, height);
            } catch (drawErr) {
              console.error("Failed to draw video frame onto canvas:", drawErr);
              drawFallbackBackground(ctx, width, height);
            }
          } else if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
            try {
              // Ken Burns Motion Effect for Photos or preloaded thumbnails
              const segDuration = Math.max(0.1, activeSeg.end - activeSeg.start);
              const p = Math.max(0, Math.min(1, (time - activeSeg.start) / segDuration));

              const imgW = cachedImg.naturalWidth;
              const imgH = cachedImg.naturalHeight;
              const targetRatio = width / height;
              const sourceRatio = imgW / imgH;
              let sWidth = imgW;
              let sHeight = imgH;
              let sx = 0;
              let sy = 0;

              if (sourceRatio > targetRatio) {
                sWidth = imgH * targetRatio;
                sx = (imgW - sWidth) / 2;
              } else {
                sHeight = imgW / targetRatio;
                sy = (imgH - sHeight) / 2;
              }

              ctx.save();
              // Smooth Ken Burns slow zoom (1.0 -> 1.14) & cinematic camera pan
              const zoomScale = 1.0 + p * 0.14;
              const panX = (p - 0.5) * (width * 0.04);
              const panY = Math.sin(p * Math.PI) * (height * 0.02);

              ctx.translate(width / 2 + panX, height / 2 + panY);
              ctx.scale(zoomScale, zoomScale);

              ctx.drawImage(cachedImg, sx, sy, sWidth, sHeight, -width / 2, -height / 2, width, height);
              ctx.restore();
            } catch (imgErr) {
              console.error("Failed to draw cached thumbnail with Ken Burns:", imgErr);
              drawFallbackBackground(ctx, width, height);
            }
          } else {
            // Premium glowing grid/gradient fallback
            drawFallbackBackground(ctx, width, height);
          }

          // Standard subtle fade transition on segment borders
          const segmentElapsed = time - activeSeg.start;
          const segmentTotal = activeSeg.end - activeSeg.start;
          const fadeLimit = 0.4; // 400ms transition

          if (segmentElapsed < fadeLimit) {
            const alpha = segmentElapsed / fadeLimit;
            ctx.fillStyle = `rgba(2, 6, 23, ${1 - alpha})`;
            ctx.fillRect(0, 0, width, height);
          } else if (segmentTotal - segmentElapsed < fadeLimit) {
            const alpha = (segmentTotal - segmentElapsed) / fadeLimit;
            ctx.fillStyle = `rgba(2, 6, 23, ${1 - alpha})`;
            ctx.fillRect(0, 0, width, height);
          }
        }
      }

      // 3. Render CapCut-Style Word-Synced Animated Captions
      if (activeSeg && activeSeg.words && activeSeg.words.length > 0) {
        try {
          const activeWordIndex = activeSeg.words.findIndex(w => time >= w.start && time <= w.end);
          const activeWord = activeWordIndex !== -1 ? activeSeg.words[activeWordIndex] : (time > activeSeg.end ? activeSeg.words[activeSeg.words.length - 1] : activeSeg.words[0]);

          if (activeWord) {
            const activeTemplateInfo = CAPCUT_TEMPLATES.find(t => t.id === captionTemplate) || CAPCUT_TEMPLATES[0];
            const fontSelected = activeTemplateInfo.font;
            const highlightColor = captionColor || activeTemplateInfo.color;

            const scaleFont = fontSize * (width / 500) * 1.30;
            ctx.font = `900 ${scaleFont}px ${fontSelected}`;

            const capX = width / 2;
            const capY = height * 0.78; // Lower-third positioning

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // --- STYLE 1: KARAOKE WORD HIGHLIGHT ---
            if (captionTemplate === 'karaoke-grad') {
              const phraseSize = 3;
              const phraseStartIndex = Math.floor((activeWordIndex >= 0 ? activeWordIndex : 0) / phraseSize) * phraseSize;
              const phraseWords = activeSeg.words.slice(phraseStartIndex, phraseStartIndex + phraseSize);

              const wordWidths = phraseWords.map(w => ctx.measureText(w.text + ' ').width);
              const totalPhraseWidth = wordWidths.reduce((a, b) => a + b, 0);
              let startX = capX - totalPhraseWidth / 2;

              phraseWords.forEach((pw, pIdx) => {
                const wWidth = wordWidths[pIdx];
                const wordCenterX = startX + wWidth / 2;
                const isActive = activeWordIndex >= 0 && (phraseStartIndex + pIdx === activeWordIndex);

                ctx.save();
                if (isActive) {
                  const padX = scaleFont * 0.25;
                  const padY = scaleFont * 0.15;
                  ctx.fillStyle = 'rgba(245, 158, 11, 0.95)'; // Gold highlight
                  const r = scaleFont * 0.2;
                  ctx.beginPath();
                  if (ctx.roundRect) ctx.roundRect(wordCenterX - wWidth / 2 - padX / 2, capY - scaleFont / 2 - padY / 2, wWidth + padX, scaleFont + padY, r);
                  else ctx.rect(wordCenterX - wWidth / 2 - padX / 2, capY - scaleFont / 2 - padY / 2, wWidth + padX, scaleFont + padY);
                  ctx.fill();

                  ctx.fillStyle = '#020617';
                  ctx.fillText(pw.text, wordCenterX, capY);
                } else {
                  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
                  ctx.lineWidth = scaleFont * 0.14;
                  ctx.strokeText(pw.text, wordCenterX, capY);
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                  ctx.fillText(pw.text, wordCenterX, capY);
                }
                ctx.restore();

                startX += wWidth;
              });

            } else {
              // --- STYLE 2 & 3: BOUNCE / POP-IN PER WORD & NEON / CYBER / DARKBOX ---
              const textToDraw = captionTemplate === 'toktok-neon' ? activeWord.text.toUpperCase() : activeWord.text;

              // Calculate elastic spring pop scale factor
              const elapsedInWord = Math.max(0, time - activeWord.start);
              const popDuration = 0.13;
              const popScale = elapsedInWord < popDuration
                ? 0.75 + Math.sin((elapsedInWord / popDuration) * Math.PI) * 0.42
                : 1.0;

              ctx.save();
              ctx.translate(capX, capY);
              ctx.scale(popScale, popScale);

              // Darkbox pill box
              if (captionTemplate === 'darkbox') {
                const textWidth = ctx.measureText(textToDraw).width;
                const paddingX = scaleFont * 0.45;
                const paddingY = scaleFont * 0.22;
                ctx.fillStyle = 'rgba(2, 6, 23, 0.82)';
                const radius = scaleFont * 0.25;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(-textWidth / 2 - paddingX, -scaleFont / 2 - paddingY, textWidth + paddingX * 2, scaleFont + paddingY * 2, radius);
                else ctx.rect(-textWidth / 2 - paddingX, -scaleFont / 2 - paddingY, textWidth + paddingX * 2, scaleFont + paddingY * 2);
                ctx.fill();
              }

              // Set up borders & glows
              if (captionTemplate === 'cyber-future') {
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = scaleFont * 0.22;
                ctx.shadowColor = '#06b6d4';
                ctx.shadowBlur = scaleFont * 0.4;
              } else if (captionTemplate !== 'darkbox') {
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = scaleFont * 0.25;
                ctx.lineJoin = 'round';
                ctx.miterLimit = 2;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
                ctx.shadowBlur = scaleFont * 0.15;
                ctx.shadowOffsetY = scaleFont * 0.05;
              }

              if (captionTemplate !== 'darkbox') {
                ctx.strokeText(textToDraw, 0, 0);
              }

              ctx.fillStyle = highlightColor;
              ctx.fillText(textToDraw, 0, 0);

              // Floating AI Emoji
              if (aiEmojiMode) {
                const emoji = getSemanticEmoji(activeWord.text);
                if (emoji) {
                  ctx.font = `${scaleFont * 1.3}px "Inter", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
                  const floatY = -scaleFont * 1.45 + Math.sin(performance.now() / 140) * (scaleFont * 0.1);
                  ctx.shadowColor = '#000000';
                  ctx.shadowBlur = scaleFont * 0.15;
                  ctx.strokeText(emoji, 0, floatY);
                  ctx.fillText(emoji, 0, floatY);
                }
              }

              ctx.restore();
            }
          }
        } catch (captionErr) {
          console.error("Failed to render snappy captions on canvas:", captionErr);
        }
      }

      // Reset shadows
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } catch (globalDrawErr) {
      console.error("Critical error inside drawFrame loop:", globalDrawErr);
    }
  };

  // Run updates in animation loop
  useEffect(() => {
    if (isPlaying) {
      const run = () => {
        const delta = (performance.now() - audioStartTimeRef.current) / 1000;
        const nextTime = audioPauseOffsetRef.current + delta;

        if (nextTime >= totalDuration) {
          setIsPlaying(false);
          setCurrentTime(totalDuration);
          stopVoiceoverNode();
          if (hiddenVideoRef.current) hiddenVideoRef.current.pause();
        } else {
          setCurrentTime(nextTime);
          drawFrame(nextTime);

          // Real-time SFX Trigger checks
          sfxPlacements.forEach(sfx => {
            if (Math.abs(nextTime - sfx.timestamp) < 0.15 && !lastTriggeredSfxRef.current.has(sfx.id)) {
              lastTriggeredSfxRef.current.add(sfx.id);
              playProceduralSFX(sfx.synthType);
            }
          });

          // Auto-SFX scene transition triggers
          if (autoSfxEnabled && segments.length > 1) {
            segments.slice(1).forEach(seg => {
              const boundaryKey = `scene_transition_${seg.start}`;
              if (Math.abs(nextTime - seg.start) < 0.15 && !lastTriggeredSfxRef.current.has(boundaryKey)) {
                lastTriggeredSfxRef.current.add(boundaryKey);
                playProceduralSFX('whoosh');
              }
            });
          }

          animationFrameRef.current = requestAnimationFrame(run);
        }
      };
      audioStartTimeRef.current = performance.now();
      playVoiceoverNode(audioPauseOffsetRef.current);
      animationFrameRef.current = requestAnimationFrame(run);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      stopVoiceoverNode();
      if (hiddenVideoRef.current) hiddenVideoRef.current.pause();
      audioPauseOffsetRef.current = currentTime;
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying]);

  // Adjust preview frames when pausing and dragging slider
  useEffect(() => {
    if (!isPlaying) {
      drawFrame(currentTime);
    }
  }, [currentTime, segments, aspectRatio, captionColor, fontSize]);

  const togglePlayPause = () => {
    if (currentTime >= totalDuration) {
      setCurrentTime(0);
      audioPauseOffsetRef.current = 0;
    }
    lastTriggeredSfxRef.current.clear();
    setIsPlaying(!isPlaying);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    audioPauseOffsetRef.current = 0;
    setCurrentTime(0);
    lastTriggeredSfxRef.current.clear();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    audioPauseOffsetRef.current = target;
    lastTriggeredSfxRef.current.clear();
    if (isPlaying) {
      audioStartTimeRef.current = performance.now();
      playVoiceoverNode(target);
    }
  };

  // --- AUTOMATIC CHROME RECORDER & EXPORT BLOB COMPILE CLIENT-SIDE ---

  const handleCompileVideo = async () => {
    if (segments.length === 0) return;
    setIsCompiling(true);
    setCompileProgress(0);
    setCompiledBlobUrl(null);
    stopPlayback();

    const canvas = playerCanvasRef.current;
    if (!canvas) {
      setIsCompiling(false);
      return;
    }

    try {
      // 1. Prepare visual canvas stream based on resolution selection (30 fps standard)
      let width = 1080;
      let height = 1920;
      if (exportResolution === '4K') {
        width = aspectRatio === 'vertical' ? 2160 : aspectRatio === 'square' ? 2160 : 3840;
        height = aspectRatio === 'vertical' ? 3840 : aspectRatio === 'square' ? 2160 : 2160;
      } else if (exportResolution === '720p') {
        width = aspectRatio === 'vertical' ? 720 : aspectRatio === 'square' ? 720 : 1280;
        height = aspectRatio === 'vertical' ? 1280 : aspectRatio === 'square' ? 720 : 720;
      } else {
        width = aspectRatio === 'vertical' ? 1080 : aspectRatio === 'square' ? 1080 : 1920;
        height = aspectRatio === 'vertical' ? 1920 : aspectRatio === 'square' ? 1080 : 1080;
      }
      canvas.width = width;
      canvas.height = height;

      const videoStream = canvas.captureStream(30);

      // 2. Assemble Combined Media Recorder with Audio Channel Integration
      let finalAudioDestinationStream: MediaStream | null = null;
      let mixCtx: AudioContext | null = null;

      if (voiceoverBase64 && audioBufferRef.current) {
        mixCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const bufferSource = mixCtx.createBufferSource();
        bufferSource.buffer = audioBufferRef.current;

        const mediaStreamDest = mixCtx.createMediaStreamDestination();
        bufferSource.connect(mediaStreamDest);
        // Do NOT connect to mixCtx.destination so compilation remains completely silent
        
        // MIX IN BACKGROUND MUSIC UNDER VOICEOVER DURING RECORD COMPILING!
        if (musicBuffer) {
          const musicSource = mixCtx.createBufferSource();
          musicSource.buffer = musicBuffer;
          musicSource.loop = true;

          const musicGain = mixCtx.createGain();
          musicGain.gain.setValueAtTime(musicVolume, mixCtx.currentTime);

          musicSource.connect(musicGain);
          musicGain.connect(mediaStreamDest);
          // Do NOT connect to mixCtx.destination so background music remains silent during compile

          musicSource.start(0);
          compileMusicSourceRef.current = musicSource;
        }

        finalAudioDestinationStream = mediaStreamDest.stream;

        // Force startup buffer playback on record activation
        bufferSource.start(0);
      }

      const compositeTracks = [
        ...videoStream.getVideoTracks(),
        ...(finalAudioDestinationStream ? finalAudioDestinationStream.getAudioTracks() : [])
      ];

      const outStream = new MediaStream(compositeTracks);
      
      // Determine device supported media recorder containers with format preference
      let selectedMimeType = '';
      let fallbackNote: string | null = null;

      if (exportFormat === 'mp4') {
        const mp4Options = [
          'video/mp4;codecs=h264,aac',
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4',
        ];
        for (const mime of mp4Options) {
          if (MediaRecorder.isTypeSupported(mime)) {
            selectedMimeType = mime;
            break;
          }
        }
        if (!selectedMimeType) {
          fallbackNote = "Your browser doesn't support direct MP4 recording; recorded in WebM format.";
          const webmOptions = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
          ];
          for (const mime of webmOptions) {
            if (MediaRecorder.isTypeSupported(mime)) {
              selectedMimeType = mime;
              break;
            }
          }
        }
      } else {
        const webmOptions = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm'
        ];
        for (const mime of webmOptions) {
          if (MediaRecorder.isTypeSupported(mime)) {
            selectedMimeType = mime;
            break;
          }
        }
        if (!selectedMimeType) {
          fallbackNote = "Your browser doesn't support WebM recording; recorded in MP4 format.";
          const mp4Options = ['video/mp4;codecs=h264,aac', 'video/mp4'];
          for (const mime of mp4Options) {
            if (MediaRecorder.isTypeSupported(mime)) {
              selectedMimeType = mime;
              break;
            }
          }
        }
      }

      setFormatFallbackNote(fallbackNote);

      const targetBitrate = exportResolution === '4K' ? 14000000 : exportResolution === '720p' ? 3500000 : 7000000;

      const recorder = new MediaRecorder(outStream, {
        mimeType: selectedMimeType || undefined,
        videoBitsPerSecond: targetBitrate,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (compileMusicSourceRef.current) {
          try {
            compileMusicSourceRef.current.disconnect();
          } catch (e) {}
          compileMusicSourceRef.current = null;
        }
        const finalExt = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
        const mimeOut = finalExt === 'mp4' ? 'video/mp4' : 'video/webm';
        const finalBlob = new Blob(chunks, { type: mimeOut });
        const videoBlobUrl = URL.createObjectURL(finalBlob);
        setCompiledBlobUrl(videoBlobUrl);
        setCompiledFormat(finalExt);
        setIsCompiling(false);
        setCompileProgress(100);
        playProceduralSFX('sparkle');
        if (onVideoCompiled) {
          onVideoCompiled(videoBlobUrl, aspectRatio, {
            duration: `${totalDuration.toFixed(0)}s`,
            resolution: exportResolution,
            format: finalExt
          });
        }
      };

      // 3. Initiate Real-time Canvas Rendering compilation phase
      drawFrame(0);
      recorder.start();

      const compileStart = performance.now();
      const renderingDuration = totalDuration;

      const compileLoop = () => {
        const elapsed = (performance.now() - compileStart) / 1000;
        // Compile at matching speed
        const activeTime = elapsed;

        if (activeTime >= renderingDuration) {
          recorder.stop();
          if (hiddenVideoRef.current) hiddenVideoRef.current.pause();
        } else {
          setCompileProgress(Math.floor((activeTime / renderingDuration) * 98));
          drawFrame(activeTime);
          requestAnimationFrame(compileLoop);
        }
      };

      requestAnimationFrame(compileLoop);

    } catch (e) {
      console.error(e);
      alert("Encountered rendering exception compiling client-side wrapper. Ensure mic credentials allowed.");
      setIsCompiling(false);
    }
  };

  return (
    <div className={`p-3 sm:p-5 border rounded-3xl space-y-4 text-left relative overflow-hidden shadow-2xl transition-all ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900/90 border-white/10 text-white'}`} id="sequencer-studio">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-ggd-orange animate-ping"></span>
            <h2 className={`text-base font-black uppercase tracking-tight ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>CapCut Render Studio</h2>
          </div>
          <p className={`text-[10px] font-bold uppercase mt-0.5 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
            Auto-sync Voiceover, HD Footage & Subtitle Aesthetics
          </p>
        </div>

        {/* QUICK ASPECT RATIO & TEMPLATE CONTROLS */}
        <div className={`flex flex-wrap items-center gap-1.5 p-1 rounded-2xl border shrink-0 ${themeMode === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/5'}`}>
          <button
            onClick={() => setShowSaveTemplateModal(true)}
            className="px-2.5 py-1.5 text-[10px] font-black uppercase rounded-xl flex items-center gap-1.5 transition-all bg-ggd-orange/15 text-ggd-orange border border-ggd-orange/30 hover:bg-ggd-orange hover:text-white shrink-0 min-h-[36px]"
            title="Save this video setup as a reusable template to Firebase"
          >
            <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
            <span>Template</span>
          </button>

          <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setAspectRatio('vertical')} 
              className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg flex items-center gap-1 transition-all min-h-[32px] ${aspectRatio === 'vertical' ? 'bg-ggd-orange text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              title="Vertical format (9:16)"
            >
              <i className="fa-solid fa-mobile-screen-button"></i>
              <span>9:16</span>
            </button>
            <button 
              onClick={() => setAspectRatio('horizontal')} 
              className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg flex items-center gap-1 transition-all min-h-[32px] ${aspectRatio === 'horizontal' ? 'bg-ggd-orange text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              title="Landscape format (16:9)"
            >
              <i className="fa-solid fa-desktop"></i>
              <span>16:9</span>
            </button>
            <button 
              onClick={() => setAspectRatio('square')} 
              className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg flex items-center gap-1 transition-all min-h-[32px] ${aspectRatio === 'square' ? 'bg-ggd-orange text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              title="Square format (1:1)"
            >
              <i className="fa-solid fa-square-full text-[8px]"></i>
              <span>1:1</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI ALIGNMENT STATUS INDICATOR BANNER */}
      {(isAligning || alignmentError || alignedWords) && (
        <div className="animate-fadeIn">
          {isAligning && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
              <div className="w-3 h-3 rounded-full border-2 border-t-transparent border-blue-500 animate-spin shrink-0"></div>
              <p className="text-[10px] font-black uppercase text-blue-300 tracking-wider">
                Syncing exact word captions from audio via AI Neural Engine...
              </p>
            </div>
          )}
          {alignmentError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-2xl">
              <i className="fa-solid fa-triangle-exclamation text-red-500 text-[10px] shrink-0"></i>
              <p className="text-[10px] font-bold text-red-400">
                AI Alignment Fallback: {alignmentError}. Showing standard synced captions.
              </p>
            </div>
          )}
          {alignedWords && !isAligning && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
              <i className="fa-solid fa-circle-check text-emerald-500 text-[10px] shrink-0"></i>
              <p className="text-[10px] font-black uppercase text-emerald-300 tracking-wider">
                ✨ High-Fidelity Word-Level AI Sync Active ({alignedWords.length} words matched!)
              </p>
            </div>
          )}
        </div>
      )}

      {/* TOP VIDEO CANVAS STAGE (PREVIEW AREA) */}
      <div className="w-full flex flex-col items-center justify-center space-y-3 bg-black/40 p-3 sm:p-4 rounded-3xl border border-white/5 shadow-inner relative">
        <div className={`relative w-full overflow-hidden rounded-2xl bg-black border border-white/10 shadow-2xl flex items-center justify-center transition-all ${
          aspectRatio === 'vertical' ? 'aspect-[9/16] max-w-[280px] sm:max-w-[300px]' : aspectRatio === 'square' ? 'aspect-square max-w-[320px] sm:max-w-[360px]' : 'aspect-video max-w-full sm:max-w-[540px]'
        }`}>
          <canvas 
            ref={playerCanvasRef} 
            className="max-h-full max-w-full object-contain"
          />

          {!isPlaying && (
            <button 
              onClick={togglePlayPause} 
              className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-ggd-orange/90 backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-white shadow-2xl border border-white/20 z-20"
              aria-label="Play Video"
            >
              <i className="fa-solid fa-play text-xl ml-1"></i>
            </button>
          )}

          <div className="absolute top-3 left-3 flex gap-1.5 z-10 pointer-events-none">
            <span className="px-2 py-0.5 bg-black/80 backdrop-blur-md rounded-lg text-[8px] font-black uppercase text-glow border border-white/10">
              {aspectRatio === 'vertical' ? '9:16 Vertical' : aspectRatio === 'square' ? '1:1 Square' : '16:9 Landscape'}
            </span>
            <span className="px-2 py-0.5 bg-ggd-orange/90 rounded-lg text-[8px] font-black uppercase text-white shadow-md">
              Live Preview
            </span>
          </div>

          <div className="absolute bottom-3 left-3 px-2 py-0.5 bg-black/80 rounded-lg text-[8.5px] font-black uppercase text-white/90 border border-white/10 z-10">
            {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
          </div>
        </div>

        {/* COMPACT PLAYER TIMELINE & PLAY/PAUSE SCRUBBER */}
        <div className="w-full max-w-md space-y-2">
          <div className="flex items-center gap-2.5">
            <button 
              onClick={togglePlayPause} 
              className={`w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 transition-all font-bold shrink-0 shadow-lg min-h-[44px] ${
                themeMode === 'light'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/20'
                  : 'bg-white text-slate-950 hover:bg-slate-200'
              }`}
            >
              {isPlaying ? <i className="fa-solid fa-pause text-base"></i> : <i className="fa-solid fa-play text-base ml-0.5"></i>}
            </button>

            <button 
              onClick={stopPlayback} 
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 min-h-[44px] transition-all ${
                themeMode === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
              }`}
              title="Stop & Reset"
            >
              <i className="fa-solid fa-stop text-sm"></i>
            </button>

            <input 
              type="range" 
              min="0" 
              max={totalDuration} 
              step="0.05" 
              value={currentTime} 
              onChange={handleSeek} 
              className="flex-1 accent-ggd-orange h-2 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* CAPCUT MOBILE EDITOR TOOL DOCK BAR (STICKY / TABBED BOTTOM TOOLBAR) */}
      <div className="space-y-3">
        <div className={`flex items-center gap-1 overflow-x-auto p-1.5 rounded-2xl border shadow-lg scrollbar-hide ${
          themeMode === 'light' ? 'bg-slate-100/90 border-slate-200' : 'bg-black/40 border-white/10'
        }`}>
          <button
            onClick={() => setActiveEditorTab('timeline')}
            className={`flex-1 min-w-[85px] py-2.5 px-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all min-h-[44px] ${
              activeEditorTab === 'timeline'
                ? 'bg-ggd-orange text-white shadow-lg border border-ggd-orange'
                : themeMode === 'light'
                ? 'text-slate-700 hover:text-slate-950 hover:bg-white border border-transparent'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <i className={`fa-solid fa-layer-group text-xs ${activeEditorTab === 'timeline' ? 'text-white' : 'text-ggd-orange'}`}></i>
            <span>Clips ({segments.length})</span>
          </button>

          <button
            onClick={() => setActiveEditorTab('audio')}
            className={`flex-1 min-w-[85px] py-2.5 px-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all min-h-[44px] ${
              activeEditorTab === 'audio'
                ? 'bg-ggd-orange text-white shadow-lg border border-ggd-orange'
                : themeMode === 'light'
                ? 'text-slate-700 hover:text-slate-950 hover:bg-white border border-transparent'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <i className={`fa-solid fa-music text-xs ${activeEditorTab === 'audio' ? 'text-white' : 'text-purple-600'}`}></i>
            <span>Music</span>
          </button>

          <button
            onClick={() => setActiveEditorTab('captions')}
            className={`flex-1 min-w-[85px] py-2.5 px-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all min-h-[44px] ${
              activeEditorTab === 'captions'
                ? 'bg-ggd-orange text-white shadow-lg border border-ggd-orange'
                : themeMode === 'light'
                ? 'text-slate-700 hover:text-slate-950 hover:bg-white border border-transparent'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <i className={`fa-solid fa-closed-captioning text-xs ${activeEditorTab === 'captions' ? 'text-white' : 'text-blue-600'}`}></i>
            <span>Captions</span>
          </button>

          <button
            onClick={() => setActiveEditorTab('speed')}
            className={`flex-1 min-w-[85px] py-2.5 px-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all min-h-[44px] ${
              activeEditorTab === 'speed'
                ? 'bg-ggd-orange text-white shadow-lg border border-ggd-orange'
                : themeMode === 'light'
                ? 'text-slate-700 hover:text-slate-950 hover:bg-white border border-transparent'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <i className={`fa-solid fa-gauge-high text-xs ${activeEditorTab === 'speed' ? 'text-white' : 'text-amber-600'}`}></i>
            <span>Speed & SFX</span>
          </button>

          <button
            onClick={() => setActiveEditorTab('export')}
            className={`flex-1 min-w-[85px] py-2.5 px-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all min-h-[44px] ${
              activeEditorTab === 'export'
                ? 'bg-emerald-600 text-white shadow-lg border border-emerald-500'
                : themeMode === 'light'
                ? 'text-emerald-700 hover:text-emerald-900 hover:bg-white border border-transparent'
                : 'text-emerald-400 hover:text-white hover:bg-emerald-500/10'
            }`}
          >
            <i className="fa-solid fa-download text-xs"></i>
            <span>Export</span>
          </button>
        </div>

        {/* CONTEXTUAL PANEL 1: CLIPS & TIMELINE */}
        {activeEditorTab === 'timeline' && (
          <div className="space-y-4 animate-fadeIn">
            <div className={`rounded-2xl p-4 border space-y-3 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-black uppercase tracking-wider ${themeMode === 'light' ? 'text-slate-800' : 'text-slate-300'}`}>
                  Clips Timeline & Visual Beat Sourcing ({segments.length})
                </h3>
                <span className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-ggd-orange/15 text-ggd-orange border border-ggd-orange/30">
                  <i className="fa-solid fa-layer-group mr-1"></i> 1 Clip per Beat
                </span>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 scrollbar-hide">
                {segments.map((seg, idx) => (
                  <div 
                    key={seg.id} 
                    id={`timeline-scene-item-${seg.id}`}
                    onClick={() => { setCurrentTime(seg.start); audioPauseOffsetRef.current = seg.start; }}
                    className={`p-3 rounded-2xl border flex flex-col gap-2 cursor-pointer transition-all ${
                      currentTime >= seg.start && currentTime <= seg.end 
                        ? 'bg-ggd-orange/15 border-ggd-orange shadow-md ring-2 ring-ggd-orange/30' 
                        : themeMode === 'light'
                          ? 'bg-white border-slate-200 hover:bg-slate-100'
                          : 'bg-black/40 border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-11 rounded-xl overflow-hidden bg-slate-800 border border-white/10 bg-cover bg-center shrink-0 relative shadow-sm" style={{ backgroundImage: `url(${seg.thumbnail})` }}>
                        {seg.mediaType === 'photo' && (
                          <span className="absolute bottom-0.5 right-0.5 text-[7px] font-black bg-amber-500 text-black px-1 rounded">PHOTO</span>
                        )}
                      </div>
                      <div className="overflow-hidden flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className={`text-[10px] font-black truncate uppercase ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                            Beat #{idx + 1}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {seg.matchScore !== undefined && (
                              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                seg.matchScore >= 0.8 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}>
                                {Math.round(seg.matchScore * 100)}% Match
                              </span>
                            )}
                            <span className="text-[8px] font-mono font-bold text-ggd-orange">{(seg.speed || 1.0).toFixed(1)}x</span>
                          </div>
                        </div>
                        <p className={`text-[9px] font-medium truncate italic text-left ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>"{seg.text}"</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-[8.5px]">
                      <div className="truncate text-slate-400 font-mono flex items-center gap-1 max-w-[180px]">
                        <i className="fa-solid fa-magnifying-glass text-ggd-orange"></i>
                        <span className="truncate">{seg.searchQuery || seg.text.slice(0, 25)}</span>
                      </div>

                      <button
                        type="button"
                        disabled={isReSourcingBeatId === seg.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReSourceBeat(seg.id);
                        }}
                        className="px-2.5 py-1 bg-ggd-orange/20 hover:bg-ggd-orange text-ggd-orange hover:text-white font-black uppercase text-[8.5px] rounded-lg border border-ggd-orange/30 transition-all flex items-center gap-1 min-h-[32px]"
                      >
                        {isReSourcingBeatId === seg.id ? (
                          <>
                            <i className="fa-solid fa-circle-notch fa-spin"></i> Sourcing...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-arrows-rotate"></i> Re-source Beat
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AUDIT LOG INSPECTOR */}
            <div className={`rounded-2xl p-4 border space-y-2 ${themeMode === 'light' ? 'bg-slate-100 border-slate-300' : 'bg-slate-900/90 border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-ggd-orange flex items-center gap-1.5">
                  <i className="fa-solid fa-clipboard-check"></i>
                  Vixora Media HD Footage Audit
                </h3>
                <span className="text-[8px] font-mono text-slate-400">Match Quality Log</span>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-[8px] font-mono">
                {segments.map((seg, idx) => (
                  <div key={seg.id} className="p-2 bg-slate-950/60 rounded-xl border border-white/5 space-y-0.5">
                    <div className="flex items-center justify-between text-slate-300 font-bold">
                      <span>BEAT #{idx + 1} | ID: {seg.videoId || 'VIXORA_CLIP'}</span>
                      <span className={seg.matchScore && seg.matchScore >= 0.8 ? 'text-emerald-400' : 'text-amber-400'}>
                        SCORE: {seg.matchScore ? Math.round(seg.matchScore * 100) : 85}%
                      </span>
                    </div>
                    <p className="text-slate-400 italic break-words">"{seg.text}"</p>
                    <div className="text-ggd-orange flex flex-wrap items-center gap-2">
                      <span>QUERY: [{seg.searchQuery || seg.text.slice(0, 25)}]</span>
                      <span>TYPE: {seg.mediaType?.toUpperCase() || 'VIDEO'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CONTEXTUAL PANEL 2: MUSIC & AUDIO */}
        {activeEditorTab === 'audio' && (
          <div className="space-y-4 animate-fadeIn">
            <div className={`p-4 border rounded-2xl space-y-3.5 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950/80 border-white/10 text-white'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5 border-white/10">
                <div>
                  <h3 className="text-xs font-black uppercase flex items-center gap-1.5 text-ggd-orange">
                    <i className="fa-solid fa-music"></i>
                    <span>Royalty-Free AI Background Music</span>
                  </h3>
                  <p className={`text-[9px] font-bold uppercase mt-0.5 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                    Script Mood: <span className="text-ggd-orange font-black uppercase">{extractedMood}</span>
                  </p>
                </div>
                {musicLoading && (
                  <span className="text-[8px] font-black uppercase text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-xl border border-blue-500/20 animate-pulse">
                    Loading Loop...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {musicTracks.map((track) => {
                  const isActive = selectedMusicUrl === track.url;
                  return (
                    <button
                      key={track.id}
                      onClick={() => {
                        setSelectedMusicUrl(track.url);
                        setExtractedMood(track.mood);
                      }}
                      className={`p-3 rounded-2xl text-left transition-all border outline-none cursor-pointer min-h-[56px] flex flex-col justify-between ${
                        isActive 
                          ? 'bg-ggd-orange/15 border-ggd-orange text-ggd-orange font-bold shadow-md ring-2 ring-ggd-orange/30' 
                          : themeMode === 'light'
                            ? 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                            : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-white/10 hover:text-white'
                      }`}
                    >
                      <div>
                        <div className={`text-[10.5px] font-black uppercase truncate mb-0.5 ${isActive ? 'text-ggd-orange' : themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                          {track.name}
                        </div>
                        <div className={`text-[8px] font-bold uppercase ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                          Mood: {track.mood}
                        </div>
                      </div>
                      <div className={`text-[8px] font-medium truncate mt-1 ${themeMode === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {track.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className={`p-4 rounded-2xl border space-y-3 ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-black/40 border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase flex items-center gap-1.5 text-ggd-orange">
                    <i className="fa-solid fa-sliders"></i> Smart Audio Balance & Ducking
                  </span>
                  <span className="text-[8px] font-bold uppercase px-2 py-0.5 rounded-full bg-ggd-orange/15 text-ggd-orange border border-ggd-orange/30">
                    Auto-Ducked ✓
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setMusicVolume(0.08)}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-xl border transition-all min-h-[36px] ${musicVolume <= 0.1 ? 'bg-ggd-orange text-white border-ggd-orange shadow-md' : 'bg-slate-800/80 text-slate-300 border-white/10'}`}
                  >
                    Quiet (8%)
                  </button>
                  <button
                    onClick={() => setMusicVolume(0.18)}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-xl border transition-all min-h-[36px] ${musicVolume > 0.1 && musicVolume <= 0.25 ? 'bg-ggd-orange text-white border-ggd-orange shadow-md' : 'bg-slate-800/80 text-slate-300 border-white/10'}`}
                  >
                    Balanced (18%)
                  </button>
                  <button
                    onClick={() => setMusicVolume(0.32)}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-xl border transition-all min-h-[36px] ${musicVolume > 0.25 ? 'bg-ggd-orange text-white border-ggd-orange shadow-md' : 'bg-slate-800/80 text-slate-300 border-white/10'}`}
                  >
                    Music Up (32%)
                  </button>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[9px] font-black uppercase shrink-0 text-slate-400">Volume:</span>
                  <input
                    type="range"
                    min="0"
                    max="0.4"
                    step="0.01"
                    value={musicVolume}
                    onChange={(e) => {
                      const vol = parseFloat(e.target.value);
                      setMusicVolume(vol);
                      if (musicGainNodeRef.current && audioCtxRef.current) {
                        musicGainNodeRef.current.gain.setValueAtTime(vol, audioCtxRef.current.currentTime);
                      }
                    }}
                    className="flex-1 accent-ggd-orange cursor-pointer h-2 bg-white/10 rounded-lg"
                  />
                  <span className="text-[10px] font-mono text-ggd-orange font-bold shrink-0">{Math.round(musicVolume * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CONTEXTUAL PANEL 3: CAPTIONS & SUBTITLES */}
        {activeEditorTab === 'captions' && (
          <div className="space-y-4 animate-fadeIn">
            <div className={`rounded-2xl p-4 border space-y-4 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'}`}>
              <h3 className="text-xs font-black uppercase tracking-wider text-ggd-orange flex items-center gap-1.5">
                <i className="fa-solid fa-closed-captioning"></i>
                CapCut Caption Aesthetics & Fonts
              </h3>
              
              <div className="space-y-2">
                <label className="text-[9.5px] font-bold uppercase block tracking-wider text-slate-400">Select Subtitle Style Preset</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 scrollbar-hide">
                  {CAPCUT_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setCaptionTemplate(t.id);
                        setCaptionColor(t.color);
                      }}
                      className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all min-h-[50px] ${
                        captionTemplate === t.id 
                          ? 'bg-ggd-orange/15 border-ggd-orange text-ggd-orange font-bold shadow-md ring-2 ring-ggd-orange/30' 
                          : themeMode === 'light'
                            ? 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                            : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/10'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center text-[7px] font-bold mt-0.5 shrink-0 shadow-sm" style={{ backgroundColor: t.color }}>
                        {captionTemplate === t.id && <i className="fa-solid fa-check text-slate-950 text-[7px]"></i>}
                      </span>
                      <div className="overflow-hidden">
                        <p className={`text-[10px] font-black uppercase tracking-tight ${captionTemplate === t.id ? 'text-ggd-orange' : themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>{t.name}</p>
                        <p className="text-[8px] leading-snug font-medium text-slate-400 truncate">{t.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex justify-between items-center text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Font Sizing</span>
                  <span className="font-mono text-ggd-orange font-black">{fontSize}px</span>
                </div>
                <input 
                  type="range" 
                  min="16" 
                  max="36" 
                  value={fontSize} 
                  onChange={(e) => setFontSize(parseInt(e.target.value))} 
                  className="w-full accent-ggd-orange cursor-pointer h-2 bg-white/10 rounded-lg"
                />
              </div>

              <div className="pt-2.5 border-t border-white/10 flex items-center justify-between">
                <div className="text-left shrink-0 max-w-[200px]">
                  <p className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-ggd-orange">
                    <i className="fa-solid fa-wand-magic-sparkles"></i> AI Contextual Emojis
                  </p>
                  <p className="text-[8.5px] text-slate-400 font-medium">Auto-pop interactive emojis over key spoken words</p>
                </div>
                <button
                  onClick={() => setAiEmojiMode(!aiEmojiMode)}
                  className={`w-11 h-6 rounded-full transition-all relative p-0.5 flex items-center border cursor-pointer min-h-[32px] ${aiEmojiMode ? 'bg-ggd-orange border-ggd-orange' : 'bg-slate-800 border-white/15'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${aiEmojiMode ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONTEXTUAL PANEL 4: SPEED & SFX */}
        {activeEditorTab === 'speed' && (
          <div className="space-y-4 animate-fadeIn">
            {/* SPEED CONTROL FOR ACTIVE CLIP */}
            {activeSeg && (
              <div className={`p-4 border rounded-2xl space-y-3 ${themeMode === 'light' ? 'bg-amber-500/5 border-amber-500/20 text-slate-900' : 'bg-slate-900/80 border-ggd-orange/20 text-white'}`}>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black uppercase text-ggd-orange tracking-widest flex items-center gap-1.5">
                    <i className="fa-solid fa-gauge-high"></i> Beat #{activeSeg.id + 1} Clip Speed
                  </p>
                  <span className="text-[9px] px-2.5 py-0.5 bg-ggd-orange/15 text-ggd-orange rounded-md font-mono font-black border border-ggd-orange/30">
                    {(activeSeg.speed || 1.0).toFixed(2)}x Speed
                  </span>
                </div>
                
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[8px] font-semibold uppercase text-slate-400">0.25x</span>
                  <input 
                    type="range" 
                    min="0.25" 
                    max="3.0" 
                    step="0.05"
                    value={activeSeg.speed || 1.0} 
                    onChange={(e) => setSegmentSpeed(activeSeg.id, parseFloat(e.target.value))} 
                    className="flex-1 accent-ggd-orange h-2 bg-white/10 rounded-lg cursor-pointer"
                  />
                  <span className="text-[8px] font-semibold uppercase text-slate-400">3.0x</span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button 
                    onClick={() => setSegmentSpeed(activeSeg.id, 0.5)} 
                    className={`py-2 rounded-xl text-[8.5px] font-black uppercase border transition-all min-h-[36px] ${activeSeg.speed === 0.5 ? 'bg-ggd-orange text-white border-ggd-orange shadow-md' : 'bg-slate-800/80 border-white/5 text-slate-300'}`}
                  >
                    0.5x Slow
                  </button>
                  <button 
                    onClick={() => setSegmentSpeed(activeSeg.id, 1.0)} 
                    className={`py-2 rounded-xl text-[8.5px] font-black uppercase border transition-all min-h-[36px] ${(activeSeg.speed || 1.0) === 1.0 ? 'bg-ggd-orange text-white border-ggd-orange shadow-md' : 'bg-slate-800/80 border-white/5 text-slate-300'}`}
                  >
                    1.0x Normal
                  </button>
                  <button 
                    onClick={() => setSegmentSpeed(activeSeg.id, 1.5)} 
                    className={`py-2 rounded-xl text-[8.5px] font-black uppercase border transition-all min-h-[36px] ${activeSeg.speed === 1.5 ? 'bg-ggd-orange text-white border-ggd-orange shadow-md' : 'bg-slate-800/80 border-white/5 text-slate-300'}`}
                  >
                    1.5x Fast
                  </button>
                  <button 
                    onClick={() => setSegmentSpeed(activeSeg.id, 2.0)} 
                    className={`py-2 rounded-xl text-[8.5px] font-black uppercase border transition-all min-h-[36px] ${activeSeg.speed === 2.0 ? 'bg-ggd-orange text-white border-ggd-orange shadow-md' : 'bg-slate-800/80 border-white/5 text-slate-300'}`}
                  >
                    2.0x Double
                  </button>
                </div>
              </div>
            )}

            {/* SFX PANEL */}
            <div className={`rounded-2xl p-4 border space-y-3 ${themeMode === 'light' ? 'bg-indigo-50/60 border-indigo-200' : 'bg-indigo-950/30 border-indigo-500/20'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                    <i className="fa-solid fa-wand-magic-sparkles text-ggd-orange"></i>
                    Procedural Sound Effects ({sfxPlacements.length})
                  </h3>
                  <p className="text-[8.5px] text-slate-400 font-medium">Auto-synthesize transition whooshes, pops & chimes</p>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setAutoSfxEnabled(!autoSfxEnabled)}
                    className={`px-2.5 py-1.5 rounded-xl text-[8.5px] font-black uppercase border transition-all flex items-center gap-1 min-h-[32px] ${
                      autoSfxEnabled 
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                        : 'bg-slate-800 border-white/10 text-slate-400'
                    }`}
                  >
                    <i className={`fa-solid ${autoSfxEnabled ? 'fa-bolt text-emerald-400' : 'fa-power-off'}`}></i>
                    Auto SFX: {autoSfxEnabled ? 'ON' : 'OFF'}
                  </button>

                  <button
                    onClick={() => setShowSfxModal(true)}
                    className="px-3 py-1.5 bg-ggd-orange text-white text-[9px] font-black uppercase rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1 min-h-[32px]"
                  >
                    <i className="fa-solid fa-plus text-[8px]"></i> Add SFX
                  </button>
                </div>
              </div>

              {sfxPlacements.length === 0 ? (
                <p className="text-[9px] italic text-center py-3 text-slate-400">
                  No custom sound effects added yet. Click "+ Add SFX" to place sound effects at current playhead time.
                </p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 scrollbar-hide">
                  {sfxPlacements.map((sfx) => (
                    <div 
                      key={sfx.id} 
                      className="p-2.5 rounded-xl border border-white/5 bg-slate-900/60 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <button
                          onClick={() => playProceduralSFX(sfx.synthType)}
                          className="w-7 h-7 rounded-lg bg-ggd-orange/20 text-ggd-orange hover:bg-ggd-orange hover:text-white flex items-center justify-center text-[10px] transition-all shrink-0 min-h-[28px]"
                          title="Preview SFX"
                        >
                          <i className="fa-solid fa-play"></i>
                        </button>
                        <div className="overflow-hidden text-left">
                          <p className="text-[9.5px] font-black uppercase truncate text-white">{sfx.name}</p>
                          <p className="text-[8px] text-ggd-orange font-mono font-bold">At timestamp: {sfx.timestamp.toFixed(1)}s</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSfxPlacements(prev => prev.filter(p => p.id !== sfx.id))}
                        className="text-slate-400 hover:text-red-400 p-1.5 text-[11px] transition-all shrink-0"
                        title="Remove SFX"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTEXTUAL PANEL 5: EXPORT & RENDER */}
        {activeEditorTab === 'export' && (
          <div className="space-y-4 animate-fadeIn">
            <div className={`p-4 border rounded-2xl space-y-4 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/10'}`}>
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <i className="fa-solid fa-clapperboard"></i>
                Export Format & Video Resolution
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Format Selector */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400">File Format</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setExportFormat('mp4')}
                      className={`py-3 text-[10px] font-black uppercase rounded-xl border transition-all min-h-[44px] ${exportFormat === 'mp4' ? 'bg-ggd-orange text-white border-ggd-orange shadow-md' : 'bg-slate-800/80 border-white/10 text-slate-400'}`}
                    >
                      MP4 (Universal)
                    </button>
                    <button
                      onClick={() => setExportFormat('webm')}
                      className={`py-3 text-[10px] font-black uppercase rounded-xl border transition-all min-h-[44px] ${exportFormat === 'webm' ? 'bg-ggd-orange text-white border-ggd-orange shadow-md' : 'bg-slate-800/80 border-white/10 text-slate-400'}`}
                    >
                      WebM (High Speed)
                    </button>
                  </div>
                </div>

                {/* Resolution Selector */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400">Export Resolution</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => setExportResolution('720p')}
                      className={`py-3 text-[9.5px] font-black uppercase rounded-xl border transition-all min-h-[44px] ${exportResolution === '720p' ? 'bg-ggd-orange text-white border-ggd-orange shadow-md' : 'bg-slate-800/80 border-white/10 text-slate-400'}`}
                    >
                      720p HD
                    </button>
                    <button
                      onClick={() => setExportResolution('1080p')}
                      className={`py-3 text-[9.5px] font-black uppercase rounded-xl border transition-all min-h-[44px] ${exportResolution === '1080p' ? 'bg-ggd-orange text-white border-ggd-orange shadow-md' : 'bg-slate-800/80 border-white/10 text-slate-400'}`}
                    >
                      1080p Full HD
                    </button>
                    <button
                      onClick={() => setExportResolution('4K')}
                      className={`py-3 text-[9.5px] font-black uppercase rounded-xl border transition-all min-h-[44px] ${exportResolution === '4K' ? 'bg-ggd-orange text-white border-ggd-orange shadow-md' : 'bg-slate-800/80 border-white/10 text-slate-400'}`}
                    >
                      4K Ultra
                    </button>
                  </div>
                </div>
              </div>

              {formatFallbackNote && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[9px] text-amber-300 font-bold flex items-center gap-2">
                  <i className="fa-solid fa-triangle-exclamation text-amber-400"></i>
                  <span>{formatFallbackNote}</span>
                </div>
              )}

              {isCompiling && (
                <div className="p-5 bg-ggd-orange/10 border border-ggd-orange/30 rounded-2xl text-center space-y-3 text-glow animate-fadeIn">
                  <div className="flex items-center justify-between text-xs font-black uppercase text-ggd-orange">
                    <span className="flex items-center gap-2 animate-pulse">
                      <i className="fa-solid fa-wand-magic-sparkles"></i> Auto-Rendering HD Video ({exportResolution} {exportFormat.toUpperCase()})
                    </span>
                    <span>{compileProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-ggd-orange transition-all duration-200" style={{ width: `${compileProgress}%` }} />
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium">Encoding video frames with synchronized voiceover & background audio</p>
                </div>
              )}

              {compiledBlobUrl && !isCompiling && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center flex items-center justify-center gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-400 text-sm"></i>
                    <p className="text-[10px] font-black uppercase text-emerald-300 tracking-wider">
                      Automatically Compiled & Saved to Your Studio Library!
                    </p>
                  </div>

                  <a 
                    href={compiledBlobUrl} 
                    download={`vixora_${exportResolution}_${Date.now()}.${compiledFormat}`}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase rounded-2xl active:scale-95 transition-all shadow-xl text-center flex items-center justify-center gap-2.5 text-glow min-h-[48px]"
                  >
                    <i className="fa-solid fa-download text-sm"></i>
                    <span>Download {exportResolution} Video ({compiledFormat.toUpperCase()})</span>
                  </a>

                  <button 
                    onClick={handleCompileVideo} 
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-black uppercase rounded-xl transition-all border border-white/10 flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <i className="fa-solid fa-rotate-right text-xs"></i>
                    <span>Re-Render Video</span>
                  </button>
                </div>
              )}

              {!isCompiling && !compiledBlobUrl && (
                <button 
                  onClick={handleCompileVideo} 
                  className="w-full py-4 bg-ggd-orange hover:brightness-110 text-white text-xs font-black uppercase rounded-2xl active:scale-95 transition-all shadow-xl text-glow flex items-center justify-center gap-2 border border-white/10 min-h-[48px]"
                >
                  <i className="fa-solid fa-clapperboard text-sm"></i> Compile Final Video ({exportResolution} {exportFormat.toUpperCase()})
                </button>
              )}
            </div>
          </div>
        )}
      </div>



      {/* Hidden Video Source for drawing onto Canvas */}
      <video 
        ref={hiddenVideoRef} 
        style={{ position: 'fixed', top: '-1000px', left: '-1000px', width: '320px', height: '180px', pointerEvents: 'none', zIndex: -9999 }}
        crossOrigin="anonymous" 
        loop 
        muted 
        playsInline
      />

      {/* ADD SFX MODAL */}
      {showSfxModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className={`w-full max-w-md p-6 rounded-3xl border space-y-4 shadow-2xl ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'}`}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                  <i className="fa-solid fa-wand-magic-sparkles text-ggd-orange"></i> Add Sound Effect
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Place sound effect at playhead time ({currentTime.toFixed(1)}s)</p>
              </div>
              <button onClick={() => setShowSfxModal(false)} className="text-slate-400 hover:text-white p-1">
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-hide">
              {PRESET_SFX_CATALOG.map((sfx) => (
                <div 
                  key={sfx.id} 
                  onClick={() => setSelectedSfxId(sfx.id)}
                  className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    selectedSfxId === sfx.id 
                      ? 'bg-ggd-orange/15 border-ggd-orange text-ggd-orange font-bold' 
                      : themeMode === 'light' ? 'bg-slate-50 border-slate-200 hover:bg-slate-100' : 'bg-white/5 border-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playProceduralSFX(sfx.synthType);
                      }}
                      className="w-8 h-8 rounded-xl bg-ggd-orange text-white flex items-center justify-center text-xs shadow-md hover:scale-105 active:scale-95 transition-all shrink-0"
                      title="Test SFX Sound"
                    >
                      <i className="fa-solid fa-play"></i>
                    </button>
                    <div>
                      <p className={`text-xs font-black uppercase ${selectedSfxId === sfx.id ? 'text-ggd-orange' : themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>{sfx.name}</p>
                      <p className="text-[9px] text-slate-500">{sfx.category} • {sfx.description}</p>
                    </div>
                  </div>
                  {selectedSfxId === sfx.id && <i className="fa-solid fa-circle-check text-ggd-orange text-sm"></i>}
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSfxModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase ${themeMode === 'light' ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-slate-300'}`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const sfxObj = PRESET_SFX_CATALOG.find(s => s.id === selectedSfxId);
                  if (sfxObj) {
                    const newPlacement: SFXPlacement = {
                      id: 'sfx_' + Date.now(),
                      sfxId: sfxObj.id,
                      name: sfxObj.name,
                      synthType: sfxObj.synthType,
                      timestamp: currentTime
                    };
                    setSfxPlacements(prev => [...prev, newPlacement]);
                    playProceduralSFX(sfxObj.synthType);
                  }
                  setShowSfxModal(false);
                }}
                className="px-5 py-2 bg-ggd-orange text-white rounded-xl text-xs font-black uppercase shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
              >
                <i className="fa-solid fa-check"></i> Place at {currentTime.toFixed(1)}s
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE VIDEO TEMPLATE MODAL */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className={`w-full max-w-md p-6 rounded-3xl border space-y-4 shadow-2xl ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'}`}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                  <i className="fa-solid fa-cloud-arrow-up text-ggd-orange"></i> Save Video Template
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Persist settings to Firebase for instant AI reuse</p>
              </div>
              <button onClick={() => setShowSaveTemplateModal(false)} className="text-slate-400 hover:text-white p-1">
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {templateSavedMsg ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-2">
                <i className="fa-solid fa-circle-check text-emerald-500 text-2xl"></i>
                <p className="text-xs font-black uppercase text-emerald-400">{templateSavedMsg}</p>
                <button
                  onClick={() => {
                    setTemplateSavedMsg(null);
                    setShowSaveTemplateModal(false);
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Template Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. High Impact Viral TikTok Layout"
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                    className={`w-full p-3 rounded-xl border text-xs font-semibold focus:outline-none focus:border-ggd-orange ${themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'}`}
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Category / Niche</label>
                  <select
                    value={templateNiche}
                    onChange={(e) => setTemplateNiche(e.target.value)}
                    className={`w-full p-3 rounded-xl border text-xs font-semibold focus:outline-none focus:border-ggd-orange ${themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-800 border-white/10 text-white'}`}
                  >
                    <option value="General">General / All-Purpose</option>
                    <option value="Faith & Purpose">Faith & Purpose (Christian)</option>
                    <option value="Business & Finance">Business & Finance</option>
                    <option value="Lifestyle & Vlog">Lifestyle & Vlog</option>
                    <option value="Tech & AI">Tech & AI Innovation</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Description (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of script style, pacing, and visual look..."
                    value={templateDesc}
                    onChange={(e) => setTemplateDesc(e.target.value)}
                    className={`w-full p-3 rounded-xl border text-xs focus:outline-none focus:border-ggd-orange ${themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'}`}
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setShowSaveTemplateModal(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase ${themeMode === 'light' ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-slate-300'}`}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!templateTitle.trim() || isSavingTemplate}
                    onClick={async () => {
                      if (!templateTitle.trim()) return;
                      setIsSavingTemplate(true);
                      const newTemplate: VideoTemplate = {
                        id: 'tpl_' + Date.now(),
                        title: templateTitle.trim(),
                        description: templateDesc,
                        niche: templateNiche,
                        aspectRatio,
                        targetDuration: `${totalDuration.toFixed(0)}s`,
                        captionTemplate,
                        sfxEnabled: autoSfxEnabled || sfxPlacements.length > 0,
                        bgMusicUrl: selectedMusicUrl,
                        createdAt: new Date().toISOString()
                      };
                      await syncFirebaseSaveTemplate(newTemplate);
                      setIsSavingTemplate(false);
                      setTemplateSavedMsg("Video Template successfully saved to Firebase!");
                    }}
                    className="px-5 py-2 bg-ggd-orange text-white rounded-xl text-xs font-black uppercase shadow-lg disabled:opacity-50 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    {isSavingTemplate ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                    Save to Firebase
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
