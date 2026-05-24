import React, { useState, useEffect, useRef } from 'react';

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

export const CAPCUT_TEMPLATES = [
  { id: 'bold-yellow', name: 'CapCut Classic', color: '#facc15', font: '"Space Grotesk", "Impact", sans-serif', description: 'Yellow active word with bold black outer contours' },
  { id: 'toktok-neon', name: 'TikTok Pop', color: '#22c55e', font: '"Impact", "Arial Black", sans-serif', description: 'Bright neon green pop with capital letters' },
  { id: 'darkbox', name: 'Minimal Darkbox', color: '#ffffff', font: '"Inter", sans-serif', description: 'Translucent background box behind captions' },
  { id: 'cyber-future', name: 'Cyberpunk Cyber', color: '#ec4899', font: '"JetBrains Mono", monospace', description: 'Glowing neon pink with cyber-cyan contours' },
  { id: 'karaoke-grad', name: 'Karaoke Glow', color: '#f59e0b', font: '"Space Grotesk", sans-serif', description: 'Faded subtitles, flowing gold highlight' }
];

export const VideoSequencer: React.FC<VideoSequencerProps> = ({
  scriptText,
  voiceoverBase64,
  sourcedVideos,
  aspectRatio: controlledAspectRatio,
  onAspectRatioChange,
  onVideoCompiled,
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

  // Audio Context Ref for player
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioStartTimeRef = useRef<number>(0);
  const audioPauseOffsetRef = useRef<number>(0);

  // Hidden references for composition
  const playerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Keeps track of the currently active video source to prevent redundant reloading
  const currentVideoSrcRef = useRef<string>('');

  // Auto clean up URL on unmount
  useEffect(() => {
    return () => {
      if (compiledBlobUrl) {
        URL.revokeObjectURL(compiledBlobUrl);
      }
      stopPlayback();
    };
  }, [compiledBlobUrl]);

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
          
          // Audio elements to decode PCM or WAV
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioCtxRef.current = audioCtx;
          
          // Check if PCM raw or standard WAV
          // Gemini output is typically Raw PCM 24khz/16bit mono, or is pre-wrapped in WAV header by our App.tsx
          // Let's decode or handle base64
          let audioData = bytes.buffer;
          
          // If raw PCM, wrap it in wav header to make it decodeable by Web Audio API
          const hasWavHeader = binaryString.startsWith('RIFF');
          if (!hasWavHeader) {
            const rawPcm = new Int16Array(audioData);
            const wavHeader = createWavHeader(rawPcm.byteLength, 24000, 1, 16);
            const wavFile = new Uint8Array(wavHeader.length + rawPcm.byteLength);
            wavFile.set(wavHeader);
            wavFile.set(new Uint8Array(rawPcm.buffer), wavHeader.length);
            audioData = wavFile.buffer;
          }

          const decoded = await audioCtx.decodeAudioData(audioData);
          audioBufferRef.current = decoded;
          duration = decoded.duration;
        } catch (e) {
          console.error("Failed to decode voiceover audio for sequencer, using length fallback:", e);
          // Fallback based on words count (approx 130 words per minute / 2.1 words per second)
          const wordsCount = scriptText.split(/\s+/).length;
          duration = Math.max(8, wordsCount / 2.2);
        }
      } else {
        const wordsCount = scriptText.split(/\s+/).length;
        duration = Math.max(8, wordsCount / 2.2);
      }

      setTotalDuration(duration);

      // 2. Split script into sentences/clauses
      // Match sentences by . ! ? or clean break lines
      const RawSentences = scriptText
        .split(/(?<=[.!?])\s+|\n+/)
        .map(s => s.trim())
        .filter(s => s.length > 3);

      if (RawSentences.length === 0) return;

      // 3. Map Sentences to Timeline segment window
      const totalChars = RawSentences.reduce((acc, s) => acc + s.length, 0);
      let elapsed = 0;

      const generatedSegments: Segment[] = RawSentences.map((sentence, index) => {
        const charWeight = sentence.length / totalChars;
        const segmentDuration = charWeight * duration;
        const segStart = elapsed;
        const segEnd = elapsed + segmentDuration;
        elapsed = segEnd;

        // Balance sourced videos recursively if there are more sentences than sourced videos
        const videoIndex = index % Math.max(1, sourcedVideos.length);
        const video = sourcedVideos[videoIndex] || null;
        const hdFile = video?.video_files.find(f => f.quality === 'hd') || video?.video_files[0] || null;
        const videoUrl = hdFile?.link || "https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4"; // robust sample fallback

        // Word timestamp synthesis for CapCut highlighting
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

        return {
          id: index,
          text: sentence,
          words: timeWords,
          start: segStart,
          end: segEnd,
          videoUrl,
          videoId: video?.id || 0,
          thumbnail: video?.image || '',
        };
      });

      setSegments(generatedSegments);
    };

    prepareTimeline();
  }, [scriptText, voiceoverBase64, sourcedVideos]);

  // WAV Header Helper Node
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

  // --- AUDIO PLAYBACK CORE ---

  const playVoiceoverNode = (startOffset: number) => {
    if (!audioBufferRef.current) return;
    const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;

    // stop existing node
    if (audioSourceNodeRef.current) {
      try {
        audioSourceNodeRef.current.disconnect();
      } catch (e) {}
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(ctx.destination);
    source.start(0, startOffset);
    audioSourceNodeRef.current = source;
  };

  const stopVoiceoverNode = () => {
    if (audioSourceNodeRef.current) {
      try {
        audioSourceNodeRef.current.disconnect();
      } catch (e) {}
      audioSourceNodeRef.current = null;
    }
  };

  // --- RENDERING LOOP ON CANVAS ---

  const drawFrame = (time: number) => {
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
    const activeSeg = segments.find(seg => time >= seg.start && time <= seg.end) 
      || segments[segments.length - 1] 
      || (segments.length > 0 ? segments[0] : null);

    if (activeSeg) {
      // Manage core background video playback reference
      if (video) {
        if (currentVideoSrcRef.current !== activeSeg.videoUrl) {
          currentVideoSrcRef.current = activeSeg.videoUrl;
          video.src = activeSeg.videoUrl;
          video.load();
        }
        
        // Loop standard clip if clip is shorter
        const clipProgress = (time - activeSeg.start) % (video.duration || 10);
        if (Math.abs(video.currentTime - clipProgress) > 0.3 && isPlaying) {
          video.currentTime = clipProgress;
        }

        if (isPlaying && video.paused) {
          video.play().catch(() => {});
        } else if (!isPlaying && !video.paused) {
          video.pause();
        }

        // Draw active video context onto canvas preserving correct aspect ratios using cover
        const vW = video.videoWidth || 1920;
        const vH = video.videoHeight || 1080;
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

      // 3. Render Premium CapCut Subtitles Over the Canvas
      const activeWord = activeSeg.words.find(word => time >= word.start && time <= word.end);
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Design fonts based on templates
      const activeTemplateInfo = CAPCUT_TEMPLATES.find(t => t.id === captionTemplate) || CAPCUT_TEMPLATES[0];
      const fontSelected = activeTemplateInfo.font;
      const highlightColor = activeTemplateInfo.color;

      const scaleFont = fontSize * (width / 500); // Scale font automatically matching Canvas sizing
      ctx.font = `900 ${scaleFont}px ${fontSelected}`;

      const capX = width / 2;
      const capY = height * 0.8; // Lower fourth position

      // Draw standard subtitle block with text-wrapping if wide
      const phraseText = activeSeg.text;
      
      // Instead of drawing the whole sentence, we can draw a balanced segment chunk & highlight active word
      // Or split words into single rows or centered 5-word phrases
      const maxWordsPerRow = 5;
      const words = activeSeg.words;
      const activeWordIndex = activeWord ? words.indexOf(activeWord) : -1;

      // Group words into rows of 5
      const activeRowIndex = activeWordIndex !== -1 ? Math.floor(activeWordIndex / maxWordsPerRow) : 0;
      const activeRowWords = words.slice(activeRowIndex * maxWordsPerRow, (activeRowIndex + 1) * maxWordsPerRow);

      // Measure dimensions to render background wrap or shadows
      const wordsSpacing = scaleFont * 0.35;
      
      // Compute row total width
      const rowWidths = activeRowWords.map(w => {
        ctx.fillStyle = '#ffffff';
        return ctx.measureText(w.text).width;
      });
      const totalRowWidth = rowWidths.reduce((a, b) => a + b, 0) + (rowWidths.length - 1) * wordsSpacing;
      let startX = capX - totalRowWidth / 2;

      // Background backdrop box for "Minimal Darkbox" template
      if (activeTemplateInfo.id === 'darkbox') {
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
        const boxW = totalRowWidth + scaleFont * 0.8;
        const boxH = scaleFont * 1.5;
        const boxX = capX - boxW / 2;
        const boxY = capY - boxH / 2;
        const radius = scaleFont * 0.25;
        
        ctx.beginPath();
        ctx.moveTo(boxX + radius, boxY);
        ctx.lineTo(boxX + boxW - radius, boxY);
        ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
        ctx.lineTo(boxX + boxW, boxY + boxH - radius);
        ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
        ctx.lineTo(boxX + radius, boxY + boxH);
        ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
        ctx.lineTo(boxX, boxY + radius);
        ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
        ctx.closePath();
        ctx.fill();
      }

      activeRowWords.forEach((wordObj, i) => {
        const isCurrent = wordObj === activeWord;
        const currentWWidth = rowWidths[i];
        const textToDraw = activeTemplateInfo.id === 'toktok-neon' ? wordObj.text.toUpperCase() : wordObj.text;

        ctx.save();

        // 1. Configure outline strokes/glows based on templates
        if (activeTemplateInfo.id === 'cyber-future') {
          ctx.strokeStyle = '#06b6d4'; // neon cyan
          ctx.lineWidth = scaleFont * 0.16;
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = scaleFont * 0.35;
        } else if (activeTemplateInfo.id === 'darkbox') {
          ctx.strokeStyle = 'transparent';
          ctx.lineWidth = 0;
          ctx.shadowBlur = 0;
        } else if (activeTemplateInfo.id === 'karaoke-grad') {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = scaleFont * 0.12;
          if (isCurrent) {
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = scaleFont * 0.25;
          } else {
            ctx.shadowBlur = 0;
          }
        } else {
          // Default heavy black contour
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = scaleFont * 0.16;
          ctx.shadowColor = '#000000';
          ctx.shadowBlur = width * 0.015;
          ctx.shadowOffsetX = width * 0.003;
          ctx.shadowOffsetY = width * 0.003;
        }

        // Draw outline stroke text
        if (activeTemplateInfo.id !== 'darkbox') {
          ctx.strokeText(textToDraw, startX + currentWWidth / 2, capY);
        }

        // 2. Configure Fill colors
        if (isCurrent) {
          ctx.fillStyle = highlightColor;
        } else {
          ctx.fillStyle = activeTemplateInfo.id === 'karaoke-grad' ? 'rgba(255, 255, 255, 0.45)' : '#ffffff';
        }

        // Draw fill text
        ctx.fillText(textToDraw, startX + currentWWidth / 2, capY);

        // 3. Draw float bounce emoji above active word if AI Emoji Mode is enabled
        if (isCurrent && aiEmojiMode) {
          const emoji = getSemanticEmoji(wordObj.text);
          if (emoji) {
            ctx.restore();
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `${scaleFont * 1.4}px "Inter", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
            // slow gentle sine-wave floating bounce
            const floatY = capY - scaleFont * 1.45 + Math.sin(performance.now() / 140) * (scaleFont * 0.12);
            ctx.fillText(emoji, startX + currentWWidth / 2, floatY);
          }
        }

        ctx.restore();

        startX += currentWWidth + wordsSpacing;
      });

      // Reset shadows
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
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
    <div className="p-4 bg-slate-900/50 backdrop-blur-3xl border border-white/10 rounded-3xl space-y-4 text-left relative overflow-hidden" id="sequencer-studio">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black uppercase text-white tracking-tight">CapCut Render Studio</h2>
          <p className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">Auto-sync Voiceover, HD Footage & Subtitle Aesthetics</p>
        </div>
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-2xl border border-white/5 shrink-0">
          <button 
            onClick={() => setAspectRatio('vertical')} 
            className={`px-2.5 py-1.5 text-[8px] font-black uppercase rounded-xl flex items-center gap-1 transition-all ${aspectRatio === 'vertical' ? 'bg-ggd-orange text-white' : 'text-slate-500 hover:text-white'}`}
            title="Vertical format (9:16)"
          >
            <i className="fa-solid fa-mobile-screen-button"></i>
            <span>9:16</span>
          </button>
          <button 
            onClick={() => setAspectRatio('horizontal')} 
            className={`px-2.5 py-1.5 text-[8px] font-black uppercase rounded-xl flex items-center gap-1 transition-all ${aspectRatio === 'horizontal' ? 'bg-ggd-orange text-white' : 'text-slate-500 hover:text-white'}`}
            title="Landscape format (16:9)"
          >
            <i className="fa-solid fa-desktop"></i>
            <span>16:9</span>
          </button>
          <button 
            onClick={() => setAspectRatio('square')} 
            className={`px-2.5 py-1.5 text-[8px] font-black uppercase rounded-xl flex items-center gap-1 transition-all ${aspectRatio === 'square' ? 'bg-ggd-orange text-white' : 'text-slate-500 hover:text-white'}`}
            title="Square format (1:1)"
          >
            <i className="fa-solid fa-square-full text-[7.5px]"></i>
            <span>1:1</span>
          </button>
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
          <div className="bg-black/30 rounded-2xl p-4 border border-white/5 space-y-3 ms-0">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Style Options</h3>
            
            <div className="space-y-2">
              <label className="text-[8px] font-bold text-slate-500 uppercase block tracking-wider">1. Caption Style Preset</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-hide">
                {CAPCUT_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setCaptionTemplate(t.id);
                      setCaptionColor(t.color);
                    }}
                    className={`w-full p-2 rounded-xl border text-left flex items-start gap-2 transition-all ${captionTemplate === t.id ? 'bg-ggd-orange/15 border-ggd-orange text-white shadow-md' : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/10'}`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-white/15 flex items-center justify-center text-[7px] font-bold mt-0.5 shrink-0" style={{ backgroundColor: t.color }}>
                      {captionTemplate === t.id && <i className="fa-solid fa-check text-slate-950 text-[6px]"></i>}
                    </span>
                    <div className="overflow-hidden">
                      <p className="text-[8px] font-black uppercase tracking-tight text-white">{t.name}</p>
                      <p className="text-[7px] text-slate-500 leading-snug font-medium truncate">{t.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                <span>2. Font Sizing</span>
                <span className="text-white font-mono">{fontSize}px</span>
              </div>
              <input 
                type="range" 
                min="16" 
                max="36" 
                value={fontSize} 
                onChange={(e) => setFontSize(parseInt(e.target.value))} 
                className="w-full accent-ggd-orange"
              />
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <div className="text-left shrink-0 max-w-[140px]">
                <p className="text-[9px] font-black uppercase text-white tracking-wider flex items-center gap-1"><i className="fa-solid fa-wand-magic-sparkles text-ggd-orange"></i> AI Emoji</p>
                <p className="text-[6.5px] text-slate-500">Auto-inject interactive emojis above spoken words</p>
              </div>
              <button
                onClick={() => setAiEmojiMode(!aiEmojiMode)}
                className={`w-8 h-4 rounded-full transition-all relative p-0.5 flex items-center border ${aiEmojiMode ? 'bg-ggd-orange border-ggd-orange' : 'bg-white/5 border-white/15'}`}
              >
                <div className={`w-3 h-3 rounded-full bg-white shadow-md transform transition-transform ${aiEmojiMode ? 'translate-x-3.5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <div className="bg-black/30 rounded-2xl p-4 border border-white/5 space-y-3">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Clips Timeline ({segments.length})</h3>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1 scrollbar-hide">
              {segments.map((seg, idx) => (
                <div 
                  key={seg.id} 
                  onClick={() => { setCurrentTime(seg.start); audioPauseOffsetRef.current = seg.start; }}
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-all ${currentTime >= seg.start && currentTime <= seg.end ? 'bg-ggd-orange/15 border-ggd-orange/40' : 'bg-transparent border-white/5'}`}
                >
                  <div className="w-12 h-8 rounded-md overflow-hidden bg-slate-900 border border-white/10 bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${seg.thumbnail})` }} />
                  <div className="overflow-hidden">
                    <p className="text-[9px] font-black truncate uppercase text-white/90">Scene {idx + 1}</p>
                    <p className="text-[7px] text-slate-400 font-medium truncate italic">"{seg.text}"</p>
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
        className="hidden" 
        crossOrigin="anonymous" 
        loop 
        muted 
        playsInline
      />
    </div>
  );
};
