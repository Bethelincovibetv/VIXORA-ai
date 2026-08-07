import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { PRESET_MUSIC_TRACKS } from '../constants';

export interface SourcedVideo {
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

interface VideoSequencerProps {
  scriptText: string;
  voiceoverBase64: string | null;
  sourcedVideos: SourcedVideo[];
  aspectRatio?: 'vertical' | 'horizontal' | 'square';
  onAspectRatioChange?: (ratio: 'vertical' | 'horizontal' | 'square') => void;
  onVideoCompiled?: (blobUrl: string, orientation: 'vertical' | 'horizontal' | 'square') => void;
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
  videoId: number;
  thumbnail: string;
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
  const [captionColor, setCaptionColor] = useState<string>('#facc15'); // Yellow fallback
  const [fontSize, setFontSize] = useState<number>(24);
  const [captionTemplate, setCaptionTemplate] = useState<string>('bold-yellow');
  const [aiEmojiMode, setAiEmojiMode] = useState<boolean>(true);

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

  const setSegmentSpeed = (id: number, speed: number) => {
    setSegments(prev => prev.map(seg => {
      if (seg.id === id) {
        return { ...seg, speed };
      }
      return seg;
    }));
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
          model: "gemini-3.5-flash",
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

  // Helpers for base64 WAV wrapping for Gemini
  const getWavBase64 = (rawPcmBase64: string): string => {
    try {
      const binaryString = atob(rawPcmBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const hasWavHeader = binaryString.startsWith('RIFF');
      if (hasWavHeader) {
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
        const activeApiKey = process.env.GEMINI_API_KEY || '';
        if (!activeApiKey) {
          throw new Error("No API credentials found. Please set your Gemini key.");
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
          model: "gemini-3.5-flash",
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
          if (!hasWavHeader) {
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

      // 3. Map Sentences to Timeline segment window
      if (alignedWords && alignedWords.length > 0) {
        // --- HIGH FIDELITY AI SYNCHRONIZED ALIGNMENT ---
        let wordPointer = 0;
        setSegments(prev => {
          return RawSentences.map((sentence, index) => {
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
            const videoUrl = hdFile?.link || "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4";

            const existing = prev.find(p => p.id === index);
            const speed = existing && existing.speed !== undefined ? existing.speed : 1.0;

            return {
              id: index,
              text: sentence,
              words: matchedWords,
              start: segStart,
              end: segEnd,
              videoUrl,
              videoId: video?.id || 0,
              thumbnail: video?.image || '',
              speed,
            };
          });
        });
      } else {
        // --- SYNTHESIZED FALLBACK TIMING (INSTANT PREVIEW) ---
        const totalChars = RawSentences.reduce((acc, s) => acc + s.length, 0);
        let elapsed = 0;

        setSegments(prev => {
          return RawSentences.map((sentence, index) => {
            const charWeight = sentence.length / totalChars;
            const segmentDuration = charWeight * duration;
            const segStart = elapsed;
            const segEnd = elapsed + segmentDuration;
            elapsed = segEnd;

            const videoIndex = index % Math.max(1, sourcedVideos.length);
            const video = sourcedVideos[videoIndex] || null;
            const hdFile = video?.video_files.find(f => f.quality === 'hd') || video?.video_files[0] || null;
            const videoUrl = hdFile?.link || "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4";

            const words = sentence.split(/\s+/);
            const wordsTotalChars = words.reduce((acc, w) => acc + w.length, 0);
            let wordElapsed = segStart;

            const timeWords: TimeWord[] = words.map((word, wIdx) => {
              const wordWeight = word.length / Math.max(1, wordsTotalChars);
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

            return {
              id: index,
              text: sentence,
              words: timeWords,
              start: segStart,
              end: segEnd,
              videoUrl,
              videoId: video?.id || 0,
              thumbnail: video?.image || '',
              speed,
            };
          });
        });
      }
    };

    prepareTimeline();
  }, [scriptText, voiceoverBase64, sourcedVideos, alignedWords]);

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
            if (video.readyState >= 1) {
              if (video.playbackRate !== desiredSpeed) {
                video.playbackRate = desiredSpeed;
              }
              
              // Loop standard clip if clip is shorter, adjusting for customized playback speed
              const clipProgress = ((time - activeSeg.start) * desiredSpeed) % (video.duration || 10);
              if (Math.abs(video.currentTime - clipProgress) > 0.3 && isPlaying) {
                video.currentTime = clipProgress;
              }
            }

            if (isPlaying && video.paused) {
              video.play().catch((playErr) => {
                console.warn("video.play() was interrupted or blocked:", playErr);
              });
            } else if (!isPlaying && !video.paused) {
              video.pause();
            }
          } catch (videoError) {
            console.warn("Non-fatal video state synchronization warning:", videoError);
          }

          // Check if video is loaded and ready
          const isVideoReady = video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
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
              // Fallback to preloaded static scene thumbnail cover instantly so we never show empty black screens
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

              ctx.drawImage(cachedImg, sx, sy, sWidth, sHeight, 0, 0, width, height);

              // Subtle overlay dark layer for aesthetic visual loading aesthetics
              ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
              ctx.fillRect(0, 0, width, height);
            } catch (imgErr) {
              console.error("Failed to draw cached thumbnail:", imgErr);
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

      // 3. Render Premium Snappy Word-by-Word Captains
      if (activeSeg && activeSeg.words && activeSeg.words.length > 0) {
        try {
          const activeWord = activeSeg.words.find(word => time >= word.start && time <= word.end);
          
          if (activeWord) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const activeTemplateInfo = CAPCUT_TEMPLATES.find(t => t.id === captionTemplate) || CAPCUT_TEMPLATES[0];
            const fontSelected = activeTemplateInfo.font;
            const highlightColor = captionColor || activeTemplateInfo.color;

            // Scale active word up for extreme high impact short-form reading retention
            const scaleFont = fontSize * (width / 500) * 1.35; 
            ctx.font = `900 ${scaleFont}px ${fontSelected}`;

            const capX = width / 2;
            const capY = height * 0.78; // Perfect lower-third positioning

            const textToDraw = activeTemplateInfo.id === 'toktok-neon' ? activeWord.text.toUpperCase() : activeWord.text;

            // Draw dark backdrop pill box for minimalist dark box aesthetics
            if (activeTemplateInfo.id === 'darkbox') {
              const textWidth = ctx.measureText(textToDraw).width;
              const paddingX = scaleFont * 0.45;
              const paddingY = scaleFont * 0.22;
              
              ctx.fillStyle = 'rgba(2, 6, 23, 0.75)';
              const radius = scaleFont * 0.25;
              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(capX - textWidth / 2 - paddingX, capY - scaleFont / 2 - paddingY, textWidth + paddingX * 2, scaleFont + paddingY * 2, radius);
              } else {
                ctx.rect(capX - textWidth / 2 - paddingX, capY - scaleFont / 2 - paddingY, textWidth + paddingX * 2, scaleFont + paddingY * 2);
              }
              ctx.fill();
            }

            ctx.save();

            // Set up borders, glows & contours
            if (activeTemplateInfo.id === 'cyber-future') {
              ctx.strokeStyle = '#06b6d4'; // Glowing cyberpunk cyan contour
              ctx.lineWidth = scaleFont * 0.22;
              ctx.shadowColor = '#06b6d4';
              ctx.shadowBlur = scaleFont * 0.4;
            } else if (activeTemplateInfo.id === 'darkbox') {
              ctx.strokeStyle = 'transparent';
              ctx.lineWidth = 0;
              ctx.shadowBlur = 0;
            } else if (activeTemplateInfo.id === 'karaoke-grad') {
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = scaleFont * 0.18;
              ctx.shadowColor = '#f59e0b';
              ctx.shadowBlur = scaleFont * 0.3;
            } else {
              // High contrast thick black border
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = scaleFont * 0.25;
              ctx.lineJoin = 'round';
              ctx.miterLimit = 2;
              ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
              ctx.shadowBlur = scaleFont * 0.15;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = scaleFont * 0.05;
            }

            // Render outlines
            if (activeTemplateInfo.id !== 'darkbox') {
              ctx.strokeText(textToDraw, capX, capY);
            }

            // Fill text with design accent
            ctx.fillStyle = highlightColor;
            ctx.fillText(textToDraw, capX, capY);

            // Float float bounce emoji floating above the spoken word
            if (aiEmojiMode) {
              const emoji = getSemanticEmoji(activeWord.text);
              if (emoji) {
                ctx.restore();
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = `${scaleFont * 1.3}px "Inter", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
                const floatY = capY - scaleFont * 1.45 + Math.sin(performance.now() / 140) * (scaleFont * 0.1);
                ctx.shadowColor = '#000000';
                ctx.shadowBlur = scaleFont * 0.15;
                ctx.strokeText(emoji, capX, floatY);
                ctx.fillText(emoji, capX, floatY);
              }
            }

            ctx.restore();
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
    setIsPlaying(!isPlaying);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    audioPauseOffsetRef.current = 0;
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    audioPauseOffsetRef.current = target;
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
      // 1. Prepare visual canvas stream (30 frames per second standard)
      const width = aspectRatio === 'vertical' ? 1080 : 1920;
      const height = aspectRatio === 'vertical' ? 1920 : 1080;
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
        bufferSource.connect(mixCtx.destination); // Let user monitor composition real-time
        
        // MIX IN BACKGROUND MUSIC UNDER VOICEOVER DURING RECORD COMPILING!
        if (musicBuffer) {
          const musicSource = mixCtx.createBufferSource();
          musicSource.buffer = musicBuffer;
          musicSource.loop = true;

          const musicGain = mixCtx.createGain();
          musicGain.gain.setValueAtTime(musicVolume, mixCtx.currentTime);

          musicSource.connect(musicGain);
          musicGain.connect(mediaStreamDest);
          // Also feed to local speaker monitor
          musicGain.connect(mixCtx.destination);

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
      
      // Determine device supported media recorder containers
      let selectedMimeType = '';
      const options = [
        'video/mp4;codecs=h264,aac',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/ogg'
      ];
      
      for (const mime of options) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime;
          break;
        }
      }

      const recorder = new MediaRecorder(outStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 6000000, // 6Mbps high-fidelity HD studio packaging
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
        const mimeOut = selectedMimeType.includes('mp4') ? 'video/mp4' : 'video/webm';
        const finalBlob = new Blob(chunks, { type: mimeOut });
        const videoBlobUrl = URL.createObjectURL(finalBlob);
        setCompiledBlobUrl(videoBlobUrl);
        setIsCompiling(false);
        setCompileProgress(100);
        if (onVideoCompiled) {
          onVideoCompiled(videoBlobUrl, aspectRatio);
        }
      };

      // 3. Initiate Real-time Canvas Rendering compilation phase
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
    <div className={`p-5 border rounded-3xl space-y-5 text-left relative overflow-hidden shadow-2xl ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900/80 border-white/10 text-white'}`} id="sequencer-studio">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-black uppercase tracking-tight ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>CapCut Render Studio</h2>
          <p className={`text-[10px] font-bold uppercase mt-0.5 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Auto-sync Voiceover, HD Footage & Subtitle Aesthetics</p>
        </div>
        <div className={`flex items-center gap-1 p-1 rounded-2xl border shrink-0 ${themeMode === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/5'}`}>
          <button 
            onClick={() => setAspectRatio('vertical')} 
            className={`px-2.5 py-1.5 text-xs font-black uppercase rounded-xl flex items-center gap-1 transition-all ${aspectRatio === 'vertical' ? 'bg-ggd-orange text-white' : themeMode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
            title="Vertical format (9:16)"
          >
            <i className="fa-solid fa-mobile-screen-button"></i>
            <span>9:16</span>
          </button>
          <button 
            onClick={() => setAspectRatio('horizontal')} 
            className={`px-2.5 py-1.5 text-xs font-black uppercase rounded-xl flex items-center gap-1 transition-all ${aspectRatio === 'horizontal' ? 'bg-ggd-orange text-white' : themeMode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
            title="Landscape format (16:9)"
          >
            <i className="fa-solid fa-desktop"></i>
            <span>16:9</span>
          </button>
          <button 
            onClick={() => setAspectRatio('square')} 
            className={`px-2.5 py-1.5 text-xs font-black uppercase rounded-xl flex items-center gap-1 transition-all ${aspectRatio === 'square' ? 'bg-ggd-orange text-white' : themeMode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
            title="Square format (1:1)"
          >
            <i className="fa-solid fa-square-full text-[9px]"></i>
            <span>1:1</span>
          </button>
        </div>
      </div>

      {/* AI Alignment Status Indicator Banner */}
      {(isAligning || alignmentError || alignedWords) && (
        <div className="mb-4 animate-fadeIn">
          {isAligning && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
              <div className="w-3 h-3 rounded-full border-2 border-t-transparent border-blue-500 animate-spin shrink-0"></div>
              <p className="text-[10px] font-black uppercase text-blue-300 tracking-wider">
                Syncing exact word captions from audio via Gemini AI...
              </p>
            </div>
          )}
          {alignmentError && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-2xl">
              <i className="fa-solid fa-triangle-exclamation text-red-500 text-[10px] shrink-0"></i>
              <p className="text-[10px] font-bold text-red-400">
                AI Alignment Fallback: {alignmentError}. Showing standard synced captions.
              </p>
            </div>
          )}
          {alignedWords && !isAligning && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
              <i className="fa-solid fa-circle-check text-emerald-500 text-[10px] shrink-0"></i>
              <p className="text-[10px] font-black uppercase text-emerald-300 tracking-wider">
                ✨ High-Fidelity Word-Level AI Sync Active ({alignedWords.length} words matched!)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Premium Royalty-Free Background Music Assistant Core */}
      <div className={`p-4 border rounded-2xl space-y-3.5 mb-4 animate-fadeIn ${themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950/75 border-white/5 text-white'}`} id="sequencer-music-panel">
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5 ${themeMode === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
          <div>
            <h3 className={`text-xs font-black uppercase flex items-center gap-1.5 ${themeMode === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
              <i className="fa-solid fa-music text-ggd-orange"></i>
              <span>Royalty-Free AI Background Music Search</span>
            </h3>
            <p className={`text-[9px] font-bold uppercase mt-0.5 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
              Detected Mood Theme: <span className="text-ggd-orange font-black text-[9px] tracking-wide">{extractedMood.toUpperCase()}</span> (from video script)
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {musicLoading && (
              <span className="text-[8px] font-black uppercase text-blue-500 animate-pulse bg-blue-500/10 px-2 py-1 rounded-xl border border-blue-500/20">
                ⬇️ Preparing High Quality Loop...
              </span>
            )}
            {!musicLoading && musicBuffer && !musicError && (
              <span className="text-[8px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-xl border border-emerald-500/20 flex items-center gap-1">
                <i className="fa-solid fa-circle-check"></i> Connected & Synced
              </span>
            )}
            {musicError && (
              <span className="text-[8px] font-bold text-red-500 bg-red-400/10 px-2 py-1 rounded-xl border border-red-500/20">
                ⚠️ Loaded Default Loop
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {musicTracks.map((track) => {
            const isActive = selectedMusicUrl === track.url;
            return (
              <button
                key={track.id}
                onClick={() => {
                  setSelectedMusicUrl(track.url);
                  setExtractedMood(track.mood);
                }}
                className={`p-2.5 rounded-xl text-left transition-all border outline-none cursor-pointer flex flex-col justify-between ${
                  isActive 
                    ? 'bg-ggd-orange/15 border-ggd-orange text-ggd-orange font-bold shadow-sm' 
                    : themeMode === 'light'
                      ? 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                      : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className={`text-[10px] font-black uppercase truncate leading-none mb-1 ${isActive ? 'text-ggd-orange' : themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    {track.name}
                  </div>
                  <div className={`text-[8px] font-bold uppercase tracking-wider truncate leading-none ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                    Mood: {track.mood}
                  </div>
                </div>
                <div className={`text-[8px] font-medium truncate w-full mt-1.5 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                  {track.description}
                </div>
              </button>
            );
          })}
        </div>

        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border ${themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-black/30 border-white/5'}`}>
          <div className="flex-1 flex items-center gap-2.5">
            <span className={`text-[9px] font-black uppercase shrink-0 ${themeMode === 'light' ? 'text-slate-700' : 'text-slate-400'}`}>Music Volume:</span>
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
              className="flex-1 accent-ggd-orange max-w-xs cursor-pointer"
            />
            <span className="text-[9px] font-mono text-ggd-orange font-bold shrink-0">{Math.round(musicVolume * 100)}%</span>
            <span className={`text-[8px] font-bold uppercase ${themeMode === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>(15% is optimal)</span>
          </div>
          {musicError && (
            <p className="text-[8px] font-bold text-red-500 leading-tight shrink-0">
              {musicError}
            </p>
          )}
        </div>
      </div>

      {/* Primary HTML Live Renderer Stage */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Playback Canvas Previewer Shield */}
        <div className="flex-1 flex flex-col items-center">
          <div className={`relative w-full overflow-hidden rounded-3xl bg-black border border-white/10 shadow-2xl flex items-center justify-center ${aspectRatio === 'vertical' ? 'aspect-[9/16] max-w-[280px]' : aspectRatio === 'square' ? 'aspect-square max-w-[320px]' : 'aspect-video'}`}>
            <canvas 
              ref={playerCanvasRef} 
              className="max-h-full max-w-full object-contain"
            />
            {/* Ambient indicator */}
            {!isPlaying && (
              <button 
                onClick={togglePlayPause} 
                className="absolute inset-x-0 inset-y-0 m-auto w-16 h-16 rounded-full bg-ggd-orange/80 backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-white shadow-2xl border border-white/20"
              >
                <i className="fa-solid fa-play text-xl ml-1"></i>
              </button>
            )}
            
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="px-2 py-1 bg-black/70 backdrop-blur-md rounded-lg text-[8px] font-black uppercase text-glow border border-white/5">
                {aspectRatio === 'vertical' ? 'Vertical 9:16' : aspectRatio === 'square' ? 'Square 1:1' : 'Horizontal 16:9'}
              </span>
              <span className="px-2 py-1 bg-ggd-orange/80 rounded-lg text-[8px] font-black uppercase text-glow">
                Live Studio
              </span>
            </div>
            
            <div className="absolute bottom-4 left-4 px-2.5 py-1 bg-black/60 rounded-lg text-[8px] font-black uppercase text-white/80">
              {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
            </div>
          </div>

          {/* Simple Timeline Player UI Controls */}
          <div className="w-full max-w-sm mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <button 
                onClick={togglePlayPause} 
                className="w-10 h-10 rounded-xl bg-white text-slate-950 flex items-center justify-center hover:bg-slate-200 active:scale-90 transition-all font-bold"
              >
                {isPlaying ? <i className="fa-solid fa-pause"></i> : <i className="fa-solid fa-play ml-0.5"></i>}
              </button>

              <button 
                onClick={stopPlayback} 
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center border border-white/10"
              >
                <i className="fa-solid fa-stop text-xs"></i>
              </button>

              <input 
                type="range" 
                min="0" 
                max={totalDuration} 
                step="0.05" 
                value={currentTime} 
                onChange={handleSeek} 
                className="flex-1 accent-ggd-orange h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Timeline Inspector + Styling controls */}
        <div className="w-full md:w-64 space-y-4">
          <div className={`rounded-2xl p-4 border space-y-3 ms-0 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'}`}>
            <h3 className={`text-xs font-black uppercase tracking-wider ${themeMode === 'light' ? 'text-slate-800' : 'text-slate-400'}`}>Style Options</h3>
            
            <div className="space-y-2">
              <label className={`text-[9px] font-bold uppercase block tracking-wider ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>1. Caption Style Preset</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-hide">
                {CAPCUT_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setCaptionTemplate(t.id);
                      setCaptionColor(t.color);
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${
                      captionTemplate === t.id 
                        ? 'bg-ggd-orange/15 border-ggd-orange text-ggd-orange font-bold shadow-sm' 
                        : themeMode === 'light'
                          ? 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                          : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/10'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-white/15 flex items-center justify-center text-[7px] font-bold mt-0.5 shrink-0" style={{ backgroundColor: t.color }}>
                      {captionTemplate === t.id && <i className="fa-solid fa-check text-slate-950 text-[6px]"></i>}
                    </span>
                    <div className="overflow-hidden">
                      <p className={`text-[9px] font-black uppercase tracking-tight ${captionTemplate === t.id ? 'text-ggd-orange' : themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>{t.name}</p>
                      <p className={`text-[8px] leading-snug font-medium truncate ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>{t.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className={`flex justify-between items-center text-[9px] font-bold uppercase tracking-wider ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                <span>2. Font Sizing</span>
                <span className={`font-mono ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>{fontSize}px</span>
              </div>
              <input 
                type="range" 
                min="16" 
                max="36" 
                value={fontSize} 
                onChange={(e) => setFontSize(parseInt(e.target.value))} 
                className="w-full accent-ggd-orange cursor-pointer"
              />
            </div>

            <div className={`pt-2.5 border-t flex items-center justify-between ${themeMode === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
              <div className="text-left shrink-0 max-w-[140px]">
                <p className={`text-xs font-black uppercase tracking-wider flex items-center gap-1 ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}><i className="fa-solid fa-wand-magic-sparkles text-ggd-orange"></i> AI Emoji</p>
                <p className={`text-[8px] ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Auto-inject interactive emojis above spoken words</p>
              </div>
              <button
                onClick={() => setAiEmojiMode(!aiEmojiMode)}
                className={`w-9 h-5 rounded-full transition-all relative p-0.5 flex items-center border cursor-pointer ${aiEmojiMode ? 'bg-ggd-orange border-ggd-orange' : themeMode === 'light' ? 'bg-slate-200 border-slate-300' : 'bg-white/5 border-white/15'}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-md transform transition-transform ${aiEmojiMode ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Active Clip Speed Control Box */}
          {activeSeg && (
            <div className={`p-4 border rounded-2xl space-y-3 ${themeMode === 'light' ? 'bg-amber-500/5 border-amber-500/20 text-slate-900' : 'bg-slate-900/80 border-ggd-orange/20 text-white'}`} id="active-clip-speed-panel">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-black uppercase text-ggd-orange tracking-widest flex items-center gap-1">
                  <i className="fa-solid fa-gauge-high"></i> Scene {activeSeg.id + 1} speed
                </p>
                <span className="text-[9px] px-2 py-0.5 bg-ggd-orange/15 text-ggd-orange rounded-md font-mono font-bold">
                  {(activeSeg.speed || 1.0).toFixed(2)}x
                </span>
              </div>
              <p className={`text-[8px] leading-snug ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                Adjust this clip's speed to sync movement perfectly with the spoken voiceover text pacing.
              </p>
              <div className="flex items-center gap-2">
                <span className={`text-[8px] font-semibold uppercase ${themeMode === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>0.25x</span>
                <input 
                  type="range" 
                  min="0.25" 
                  max="3.0" 
                  step="0.05"
                  value={activeSeg.speed || 1.0} 
                  onChange={(e) => setSegmentSpeed(activeSeg.id, parseFloat(e.target.value))} 
                  className="flex-1 accent-ggd-orange h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer"
                  id={`speed-slider-${activeSeg.id}`}
                />
                <span className={`text-[8px] font-semibold uppercase ${themeMode === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>3.0x</span>
              </div>
              <div className="flex gap-1">
                <button 
                  id={`speed-btn-slow-${activeSeg.id}`}
                  onClick={() => setSegmentSpeed(activeSeg.id, 0.5)} 
                  className={`flex-1 py-1 rounded-md text-[8px] font-black uppercase border transition-all ${activeSeg.speed === 0.5 ? 'bg-ggd-orange/20 border-ggd-orange text-ggd-orange font-bold' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-transparent border-white/5 text-slate-400 hover:border-white/10'}`}
                >
                  Slow (0.5x)
                </button>
                <button 
                  id={`speed-btn-normal-${activeSeg.id}`}
                  onClick={() => setSegmentSpeed(activeSeg.id, 1.0)} 
                  className={`flex-1 py-1 rounded-md text-[8px] font-black uppercase border transition-all ${(activeSeg.speed || 1.0) === 1.0 ? 'bg-ggd-orange/20 border-ggd-orange text-ggd-orange font-bold' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-transparent border-white/5 text-slate-400 hover:border-white/10'}`}
                >
                  Normal
                </button>
                <button 
                  id={`speed-btn-fast-${activeSeg.id}`}
                  onClick={() => setSegmentSpeed(activeSeg.id, 1.5)} 
                  className={`flex-1 py-1 rounded-md text-[8px] font-black uppercase border transition-all ${activeSeg.speed === 1.5 ? 'bg-ggd-orange/20 border-ggd-orange text-ggd-orange font-bold' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-transparent border-white/5 text-slate-400 hover:border-white/10'}`}
                >
                  Fast (1.5x)
                </button>
                <button 
                  id={`speed-btn-double-${activeSeg.id}`}
                  onClick={() => setSegmentSpeed(activeSeg.id, 2.0)} 
                  className={`flex-1 py-1 rounded-md text-[8px] font-black uppercase border transition-all ${activeSeg.speed === 2.0 ? 'bg-ggd-orange/20 border-ggd-orange text-ggd-orange font-bold' : themeMode === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-transparent border-white/5 text-slate-400 hover:border-white/10'}`}
                >
                  Double (2x)
                </button>
              </div>
            </div>
          )}

          <div className={`rounded-2xl p-4 border space-y-3 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'}`} id="timeline-clips-panel">
            <h3 className={`text-xs font-black uppercase tracking-wider ${themeMode === 'light' ? 'text-slate-800' : 'text-slate-400'}`}>Clips Timeline ({segments.length})</h3>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1 scrollbar-hide">
              {segments.map((seg, idx) => (
                <div 
                  key={seg.id} 
                  id={`timeline-scene-item-${seg.id}`}
                  onClick={() => { setCurrentTime(seg.start); audioPauseOffsetRef.current = seg.start; }}
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    currentTime >= seg.start && currentTime <= seg.end 
                      ? 'bg-ggd-orange/15 border-ggd-orange shadow-sm' 
                      : themeMode === 'light'
                        ? 'bg-white border-slate-200 hover:bg-slate-100'
                        : 'bg-transparent border-white/5 hover:bg-white/5'
                  }`}
                >
                  <div className="w-12 h-8 rounded-md overflow-hidden bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-white/10 bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${seg.thumbnail})` }} />
                  <div className="overflow-hidden flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <p className={`text-[10px] font-black truncate uppercase ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>Scene {idx + 1}</p>
                      <span className="text-[8px] font-mono font-bold text-ggd-orange shrink-0">{(seg.speed || 1.0).toFixed(1)}x</span>
                    </div>
                    <p className={`text-[8px] font-medium truncate italic text-left ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>"{seg.text}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Export Action block */}
          <div className="space-y-2">
            {!isCompiling ? (
              <button 
                onClick={handleCompileVideo} 
                className="w-full py-4 bg-ggd-orange text-white text-[10px] font-black uppercase rounded-2xl active:scale-95 transition-all shadow-xl text-glow flex items-center justify-center gap-2 border border-white/10"
              >
                <i className="fa-solid fa-clapperboard"></i> Compile Final Video
              </button>
            ) : (
              <div className="p-4 bg-ggd-orange/10 border border-ggd-orange/30 rounded-2xl text-center space-y-2 text-glow">
                <p className="text-[9px] font-black uppercase text-ggd-orange animate-pulse">Rendering Studio Package ({compileProgress}%)</p>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-ggd-orange transition-all duration-300" style={{ width: `${compileProgress}%` }} />
                </div>
                <p className="text-[7px] text-slate-400">Keep this browser tab active to support hardware acceleration</p>
              </div>
            )}

            {compiledBlobUrl && (
              <a 
                href={compiledBlobUrl} 
                download={`compiled_story_${Date.now()}.${compiledBlobUrl.includes('mp4') ? 'mp4' : 'webm'}`}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase rounded-2xl active:scale-95 transition-all shadow-lg text-center flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-download"></i> Download Exported Video
              </a>
            )}
          </div>
        </div>
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
    </div>
  );
};
