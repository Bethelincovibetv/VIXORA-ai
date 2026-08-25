import React, { useState } from 'react';

interface CompleteApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode?: 'dark' | 'light';
  baseUrl: string;
}

export const CompleteApiModal: React.FC<CompleteApiModalProps> = ({
  isOpen,
  onClose,
  themeMode = 'dark',
  baseUrl,
}) => {
  const [copiedAll, setCopiedAll] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'prompt' | 'code' | 'api' | 'sync'>('all');

  if (!isOpen) return null;

  const studioAiPrompt = `### AI STUDIO / WEB DEVELOPER INTEGRATION INSTRUCTION PROMPT
Act as an elite frontend and full-stack software engineer. Integrate the Vixora AI Studio features (Video Creation, AI Script Generation, Voiceover Audio Synthesis, Sound Effects, Music Library, Stock Media, and Seamless Cloud Database Auth Sync) directly into my website as a native, embedded suite (not using an iframe).

TARGET API BASE URL:
${baseUrl}

SHARED DATABASE & CLOUD ENVIRONMENT VARIABLES (FOR SEAMLESS SSO & AUTO-SYNC):
Add these environment variables to your website's .env file so users share the exact same projects and never have to sign in twice:
VITE_SUPABASE_URL=https://yyejcbbcqirsigphzxxo.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_bgmE8p2LPYQn2eVWBUEdMw_6R4GplVZ
GEMINI_API_KEY=AIzaSyAeCyBC9daZbvXNRtfLjxBWwpF3MwXJggk

COMPLETE REST API ENDPOINTS SPECIFICATION:
1. CREATE VIDEO JOB:
   - POST ${baseUrl}/api/public/v1/videos/create
   - Headers: { "Content-Type": "application/json" }
   - Body: { "topic": "...", "script": "...", "duration": "15s"|"30s"|"60s", "aspect_ratio": "vertical"|"square"|"horizontal", "voice": "Aoede"|"Kore"|"Charon"|"Fenrir"|"Puck", "project_id": "..." }
   - Response: { "ok": true, "job_id": "job_xxx", "status": "queued", "progress": 5 }

2. POLL VIDEO PROGRESS & STATUS:
   - GET ${baseUrl}/api/public/v1/videos/status?job_id={JOB_ID}
   - Response: { "ok": true, "job_id": "job_xxx", "status": "queued"|"processing"|"ready"|"failed", "progress": 0-100, "current_step": "...", "video_url": "...", "thumbnail_url": "..." }

3. AI VIRAL SCRIPT & BEATS GENERATOR:
   - POST ${baseUrl}/api/public/v1/scripts/generate
   - Body: { "topic": "Topic Name", "duration": "30s", "niche": "finance", "tone": "energetic" }
   - Response: { "ok": true, "script": "...", "beats": [{ "text": "...", "visual_search_query": "...", "sfx_cue": "whoosh" }], "suggested_music_mood": "motivational" }

4. AI VOICEOVER (TTS) & VOICES:
   - POST ${baseUrl}/api/public/v1/audio/tts -> { "text": "...", "voice": "Kore" }
   - GET ${baseUrl}/api/public/v1/audio/voices -> Lists all voice options (Kore - Energetic Nigerian Voice, Aoede, Puck, Charon, Fenrir)

5. SOUND EFFECTS (SFX) & BACKGROUND MUSIC CATALOG:
   - GET ${baseUrl}/api/public/v1/audio/sfx -> Lists SFX (whoosh, pop, shutter, sub bass drop, sparkle)
   - GET ${baseUrl}/api/public/v1/audio/music -> Lists background music tracks with streaming URLs

6. STOCK MEDIA SEARCH:
   - POST ${baseUrl}/api/public/v1/assets/search -> { "query": "business", "orientation": "vertical" }

7. UNIFIED AUTH & SINGLE SIGN-ON SYNC (NO DOUBLE SIGN-IN):
   - POST ${baseUrl}/api/public/v1/auth/sync
   - Body: { "user_id": "...", "email": "user@example.com", "full_name": "...", "access_token": "..." }
   - Response: { "ok": true, "authenticated": true, "session_token": "..." }

8. DIRECT VIDEO STREAM & FILE DOWNLOAD:
   - GET ${baseUrl}/api/public/v1/assets/download/{asset_filename}.mp4

FRONTEND INTEGRATION REQUIREMENTS:
1. Build a sleek UI matching my site's branding with Video Creator, Script Generator, Voice Selector, and Music Player tabs.
2. Ensure user sessions auto-sync with POST /api/public/v1/auth/sync on page load.
3. When video is generated, display real-time progress bar (0%-100%) and render a native HTML5 <video controls playsinline> player once ready.`;

  const copyableFullBundle = `================================================================================
VIXORA AI STUDIO — COMPLETE UNIVERSAL API & INTEGRATION DOCUMENTATION
================================================================================
API Live Base URL: ${baseUrl}
Status: LIVE, ACTIVE & OPERATIONAL
Supported Formats: MP4 (H.264 / AAC)
Aspect Ratios: Vertical 9:16 (1080x1920), Square 1:1 (1080x1080), Horizontal 16:9 (1920x1080)
Voices: Kore (Flagship Energetic Nigerian Voice), Aoede, Charon, Fenrir, Puck

--------------------------------------------------------------------------------
1. DIRECT DATABASE & CLOUD ENVIRONMENT VARIABLES (SHARED AUTO-SYNC)
--------------------------------------------------------------------------------
Add these to your website's .env configuration to connect to the exact same cloud database so users never need to log in twice:

VITE_SUPABASE_URL=https://yyejcbbcqirsigphzxxo.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_bgmE8p2LPYQn2eVWBUEdMw_6R4GplVZ
GEMINI_API_KEY=AIzaSyAeCyBC9daZbvXNRtfLjxBWwpF3MwXJggk

--------------------------------------------------------------------------------
2. PROMPT / INSTRUCTIONS TO GIVE TO AI STUDIO / YOUR WEB DEVELOPER
--------------------------------------------------------------------------------
${studioAiPrompt}

--------------------------------------------------------------------------------
3. READY-TO-USE JAVASCRIPT / TYPESCRIPT UNIVERSAL CLIENT SERVICE
--------------------------------------------------------------------------------
/**
 * Vixora Universal Studio API Client
 * Save this file to your website project (e.g. services/vixoraClient.js)
 */
export class VixoraClient {
  constructor(baseUrl = '${baseUrl}') {
    this.baseUrl = baseUrl;
  }

  // 1. Sync User Session (Single Sign-On)
  async syncUserSession({ userId, email, fullName, accessToken }) {
    const res = await fetch(\`\${this.baseUrl}/api/public/v1/auth/sync\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, email, full_name: fullName, access_token: accessToken })
    });
    return res.json();
  }

  // 2. Generate Viral Script with Scene Beats
  async generateScript({ topic, duration = '30s', niche = 'general', tone = 'engaging' }) {
    const res = await fetch(\`\${this.baseUrl}/api/public/v1/scripts/generate\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, duration, niche, tone })
    });
    return res.json();
  }

  // 3. Synthesize Voiceover Audio
  async synthesizeVoiceover({ text, voice = 'Aoede', speed = 1.0 }) {
    const res = await fetch(\`\${this.baseUrl}/api/public/v1/audio/tts\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, speed })
    });
    return res.json();
  }

  // 4. Fetch Sound Effects (SFX) Catalog
  async getSfxCatalog(category) {
    const query = category ? \`?category=\${category}\` : '';
    const res = await fetch(\`\${this.baseUrl}/api/public/v1/audio/sfx\${query}\`);
    return res.json();
  }

  // 5. Fetch Background Music Library
  async getMusicTracks(mood) {
    const query = mood ? \`?mood=\${mood}\` : '';
    const res = await fetch(\`\${this.baseUrl}/api/public/v1/audio/music\${query}\`);
    return res.json();
  }

  // 6. Search Stock Media
  async searchStockMedia(query, orientation = 'vertical') {
    const res = await fetch(\`\${this.baseUrl}/api/public/v1/assets/search\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, orientation })
    });
    return res.json();
  }

  // 7. Full Video Render Pipeline
  async createAndRenderVideo({ topic, script, duration = '15s', aspectRatio = 'vertical', voice = 'Aoede', onProgress }) {
    const createRes = await fetch(\`\${this.baseUrl}/api/public/v1/videos/create\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, script, duration, aspect_ratio: aspectRatio, voice }),
    });

    const createData = await createRes.json();
    if (!createData.ok || !createData.job_id) {
      throw new Error(createData.error || 'Failed to submit video generation job');
    }

    const jobId = createData.job_id;

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(\`\${this.baseUrl}/api/public/v1/videos/status?job_id=\${jobId}\`);
          const statusData = await statusRes.json();

          if (onProgress) {
            onProgress({
              progress: statusData.progress || 0,
              step: statusData.current_step || 'Processing...',
              status: statusData.status,
              logs: statusData.logs || [],
            });
          }

          if (statusData.status === 'ready') {
            clearInterval(interval);
            const fullVideoUrl = statusData.video_url.startsWith('http')
              ? statusData.video_url
              : \`\${this.baseUrl}\${statusData.video_url}\`;

            resolve({
              jobId: statusData.job_id,
              assetId: statusData.asset_id,
              videoUrl: fullVideoUrl,
              thumbnailUrl: statusData.thumbnail_url,
            });
          } else if (statusData.status === 'failed') {
            clearInterval(interval);
            reject(new Error(statusData.error || 'Video rendering failed on server'));
          }
        } catch (err) {
          clearInterval(interval);
          reject(err);
        }
      }, 2000);
    });
  }
}

export const vixora = new VixoraClient();

--------------------------------------------------------------------------------
4. READY-TO-USE EMBEDDED REACT COMPONENT FOR YOUR WEBSITE
--------------------------------------------------------------------------------
import React, { useState, useEffect } from 'react';
import { vixora } from './services/vixoraClient';

export function VixoraNativeStudioEmbed({ currentUser }) {
  const [topic, setTopic] = useState('3 Daily Habits for Peak Energy');
  const [script, setScript] = useState('');
  const [aspectRatio, setAspectRatio] = useState('vertical');
  const [duration, setDuration] = useState('15s');
  const [voice, setVoice] = useState('kore');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isWritingScript, setIsWritingScript] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepText, setStepText] = useState('');
  const [videoResult, setVideoResult] = useState(null);
  const [error, setError] = useState(null);

  // Auto-sync logged-in website user on mount (Single Sign-On)
  useEffect(() => {
    if (currentUser) {
      vixora.syncUserSession({
        userId: currentUser.id,
        email: currentUser.email,
        fullName: currentUser.name || currentUser.fullName,
      }).catch(console.error);
    }
  }, [currentUser]);

  // AI Script Generation Handler
  const handleGenerateScript = async () => {
    if (!topic) return;
    setIsWritingScript(true);
    setError(null);
    try {
      const data = await vixora.generateScript({ topic, duration });
      if (data.ok && data.script) {
        setScript(data.script);
      }
    } catch (err) {
      setError('Failed to auto-write script: ' + err.message);
    } finally {
      setIsWritingScript(false);
    }
  };

  // Full Video Render Handler
  const handleRenderVideo = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);
    setVideoResult(null);
    setProgress(5);
    setStepText('Initializing video pipeline...');

    try {
      const result = await vixora.createAndRenderVideo({
        topic,
        script: script || undefined,
        duration,
        aspectRatio,
        voice,
        onProgress: (p) => {
          setProgress(p.progress);
          setStepText(p.step);
        },
      });
      setVideoResult(result);
    } catch (err) {
      setError(err.message || 'An error occurred during video creation');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>AI Video Creator</h2>
        <span style={{ fontSize: '12px', background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
          Cloud Synced
        </span>
      </div>

      <form onSubmit={handleRenderVideo}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>Topic or Concept</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              placeholder="e.g. 5 Habits of Highly Successful Founders"
              required
            />
            <button
              type="button"
              onClick={handleGenerateScript}
              disabled={isWritingScript}
              style={{ padding: '12px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {isWritingScript ? 'Writing...' : 'AI Script'}
            </button>
          </div>
        </div>

        {script && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>Generated Voiceover Script</label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>Ratio</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            >
              <option value="vertical">9:16 (TikTok / Reels)</option>
              <option value="square">1:1 (Square)</option>
              <option value="horizontal">16:9 (YouTube)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            >
              <option value="15s">15 Seconds</option>
              <option value="30s">30 Seconds</option>
              <option value="60s">60 Seconds</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>AI Voice</label>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            >
              <option value="Kore">Kore (Energetic Nigerian)</option>
              <option value="Aoede">Aoede (Warm Storyteller)</option>
              <option value="Puck">Puck (Viral Upbeat)</option>
              <option value="Charon">Charon (Cinematic Deep)</option>
              <option value="Fenrir">Fenrir (Bold Reviewer)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isGenerating}
          style={{
            width: '100%',
            padding: '14px',
            background: '#ff5500',
            color: '#fff',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '8px',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            fontSize: '15px'
          }}
        >
          {isGenerating ? \`Rendering (\${progress}%)... \${stepText}\` : 'Generate Video Now'}
        </button>
      </form>

      {/* Progress Bar */}
      {isGenerating && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span>{stepText}</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: \`\${progress}%\`, background: '#ff5500', transition: 'width 0.3s' }}></div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '8px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Rendered Video Player */}
      {videoResult && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>Your Generated Video:</h3>
          <video
            src={videoResult.videoUrl}
            poster={videoResult.thumbnailUrl}
            controls
            playsInline
            autoPlay
            style={{ width: '100%', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
          />
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <a
              href={videoResult.videoUrl}
              download="generated_video.mp4"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                background: '#10b981',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
              }}
            >
              Download MP4 Video
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
================================================================================
`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
        themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-950 border-white/10 text-white'
      }`}>
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-lg">
              <i className="fa-solid fa-code text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white">
                  Universal API & Database Integration Bundle
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase border border-emerald-500/30">
                  Live & Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                All features exposed (Video, Script, Voiceover, SFX, Music, Stock, Cloud SSO Database Sync).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(copyableFullBundle)}
              className="px-4 py-2 rounded-xl bg-ggd-orange hover:bg-orange-600 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <i className={`fa-solid ${copiedAll ? 'fa-check' : 'fa-copy'}`}></i>
              <span>{copiedAll ? 'Copied Everything!' : 'Copy Entire Documentation'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 bg-slate-900/40 overflow-x-auto">
          {[
            { id: 'all', label: 'Complete Bundle (All-in-One)' },
            { id: 'prompt', label: 'AI Studio Prompt' },
            { id: 'sync', label: 'Shared Database & SSO Sync' },
            { id: 'code', label: 'Universal JS Client & React Code' },
            { id: 'api', label: 'All API Endpoints' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-slate-950 shadow-md'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body with Scrollable Code */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-mono text-xs text-slate-300 leading-relaxed bg-black/40">
          {activeTab === 'all' && (
            <pre className="p-4 rounded-2xl bg-slate-950 border border-white/10 overflow-x-auto text-emerald-400 whitespace-pre-wrap">
              {copyableFullBundle}
            </pre>
          )}

          {activeTab === 'prompt' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs font-sans font-bold">
                <span>Copy this prompt and paste it directly to your AI Studio / Web Developer:</span>
                <button
                  onClick={() => copyToClipboard(studioAiPrompt)}
                  className="text-ggd-orange hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <i className="fa-solid fa-copy"></i> Copy Prompt
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-slate-950 border border-white/10 overflow-x-auto text-amber-300 whitespace-pre-wrap">
                {studioAiPrompt}
              </pre>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-3 font-sans">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed">
                <h4 className="font-black text-sm uppercase text-emerald-400 mb-1">
                  Direct Database Integration & No Double Sign-In
                </h4>
                <p>
                  To allow users to access the same projects, assets, and profiles without having to sign in again, configure these environment variables on your website:
                </p>
              </div>

              <pre className="p-4 rounded-2xl bg-slate-950 border border-white/10 overflow-x-auto text-cyan-300 font-mono text-xs whitespace-pre-wrap">
{`# Shared Cloud Database & AI Keys
VITE_SUPABASE_URL=https://yyejcbbcqirsigphzxxo.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_bgmE8p2LPYQn2eVWBUEdMw_6R4GplVZ
GEMINI_API_KEY=AIzaSyAeCyBC9daZbvXNRtfLjxBWwpF3MwXJggk`}
              </pre>

              <button
                onClick={() => copyToClipboard(`VITE_SUPABASE_URL=https://yyejcbbcqirsigphzxxo.supabase.co\nVITE_SUPABASE_ANON_KEY=sb_publishable_bgmE8p2LPYQn2eVWBUEdMw_6R4GplVZ\nGEMINI_API_KEY=AIzaSyAeCyBC9daZbvXNRtfLjxBWwpF3MwXJggk`)}
                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <i className="fa-solid fa-copy"></i> Copy Environment Variables
              </button>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs font-sans font-bold">
                <span>Production JS Universal Client & React Embed Component:</span>
                <button
                  onClick={() => copyToClipboard(copyableFullBundle)}
                  className="text-ggd-orange hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <i className="fa-solid fa-copy"></i> Copy Client Code
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-slate-950 border border-white/10 overflow-x-auto text-cyan-300 whitespace-pre-wrap">
                {copyableFullBundle.slice(copyableFullBundle.indexOf('3. READY-TO-USE JAVASCRIPT'), copyableFullBundle.length - 85)}
              </pre>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs font-sans font-bold">
                <span>All Live Endpoints & Specifications:</span>
                <button
                  onClick={() => copyToClipboard(copyableFullBundle)}
                  className="text-ggd-orange hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <i className="fa-solid fa-copy"></i> Copy Spec
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-slate-950 border border-white/10 overflow-x-auto text-emerald-400 whitespace-pre-wrap">
                {copyableFullBundle.slice(0, copyableFullBundle.indexOf('3. READY-TO-USE JAVASCRIPT'))}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900/90 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-medium">
            <i className="fa-solid fa-shield-halved text-emerald-400"></i>
            <span>CORS Enabled & Direct Database Sync Configured</span>
          </div>

          <button
            onClick={() => copyToClipboard(copyableFullBundle)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <i className={`fa-solid ${copiedAll ? 'fa-check' : 'fa-copy'}`}></i>
            <span>{copiedAll ? 'Copied Everything!' : 'Copy 1-Click Integration Bundle'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
