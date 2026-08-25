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
  const [activeTab, setActiveTab] = useState<'all' | 'prompt' | 'code' | 'api'>('all');

  if (!isOpen) return null;

  const studioAiPrompt = `### AI STUDIO / WEB DEVELOPER INTEGRATION INSTRUCTION PROMPT
Act as an elite frontend and full-stack software engineer. Integrate the Vixora Video Generation Engine directly into my website as a native, embedded feature (not using an iframe).

TARGET API BASE URL:
${baseUrl}

ENDPOINTS SPECIFICATION:
1. CREATE VIDEO JOB:
   - Method: POST
   - URL: ${baseUrl}/api/public/v1/videos/create (or /videos/create)
   - Headers: { "Content-Type": "application/json" }
   - Body Schema:
     {
       "topic": "Video Topic Here",
       "script": "Optional full script text",
       "duration": "15s" | "30s" | "60s",
       "aspect_ratio": "vertical" | "square" | "horizontal",
       "voice": "Aoede" | "Charon" | "Fenrir" | "Kore" | "Puck",
       "project_id": "optional_project_id"
     }
   - Response: { "ok": true, "job_id": "job_xxx", "status": "queued", "progress": 5 }

2. POLL JOB PROGRESS & STATUS:
   - Method: GET
   - URL: ${baseUrl}/api/public/v1/videos/status?job_id={JOB_ID}
   - Response:
     {
       "ok": true,
       "job_id": "job_xxx",
       "status": "queued" | "processing" | "ready" | "failed",
       "progress": 0 to 100,
       "current_step": "Rendering video frames and compositing audio tracks...",
       "video_url": "/api/public/v1/assets/download/{asset_id}.mp4",
       "thumbnail_url": "https://...",
       "logs": ["..."]
     }

3. DIRECT VIDEO STREAM & DOWNLOAD:
   - URL: ${baseUrl}/api/public/v1/assets/download/{asset_id}.mp4

FRONTEND INTEGRATION REQUIREMENTS:
1. Build a clean user input form matching my site's design system (Prompt/Topic input, Duration selector, Aspect Ratio toggle [9:16 vertical, 1:1 square, 16:9 horizontal], and Voice selector).
2. When the user clicks "Generate Video", call POST /api/public/v1/videos/create.
3. Poll GET /api/public/v1/videos/status?job_id={job_id} every 2 seconds. Display real-time progress bar (0% - 100%) and current rendering step text.
4. When status === 'ready', display the video in a native HTML5 <video controls playsinline> player with download and share buttons.`;

  const copyableFullBundle = `================================================================================
VIXORA AI VIDEO ENGINE — COMPLETE API & INTEGRATION DOCUMENTATION
================================================================================
API Live Base URL: ${baseUrl}
Status: LIVE, ACTIVE & OPERATIONAL
Supported Formats: MP4 (H.264 / AAC)
Aspect Ratios: Vertical 9:16 (1080x1920), Square 1:1 (1080x1080), Horizontal 16:9 (1920x1080)
Voices: Aoede, Charon, Fenrir, Kore, Puck

--------------------------------------------------------------------------------
1. PROMPT / INSTRUCTIONS TO GIVE TO AI STUDIO / YOUR DEVELOPER
--------------------------------------------------------------------------------
${studioAiPrompt}

--------------------------------------------------------------------------------
2. READY-TO-USE JAVASCRIPT / TYPESCRIPT CLIENT SERVICE
--------------------------------------------------------------------------------
/**
 * Vixora Video Generation Client Service
 * Add this file to your website project (e.g. services/videoEngine.js)
 */
export async function createAndRenderVideo({
  topic,
  script,
  duration = '15s',
  aspectRatio = 'vertical',
  voice = 'Aoede',
  onProgress,
}) {
  const API_BASE = '${baseUrl}';

  // 1. Submit Video Generation Job
  const createRes = await fetch(\`\${API_BASE}/api/public/v1/videos/create\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic,
      script: script || undefined,
      duration,
      aspect_ratio: aspectRatio,
      voice,
    }),
  });

  const createData = await createRes.json();
  if (!createData.ok || !createData.job_id) {
    throw new Error(createData.error || 'Failed to submit video generation job');
  }

  const jobId = createData.job_id;

  // 2. Poll for Progress until Video is Ready
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const statusRes = await fetch(\`\${API_BASE}/api/public/v1/videos/status?job_id=\${jobId}\`);
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
            : \`\${API_BASE}\${statusData.video_url}\`;

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

--------------------------------------------------------------------------------
3. READY-TO-USE REACT COMPONENT FOR YOUR WEBSITE
--------------------------------------------------------------------------------
import React, { useState } from 'react';
import { createAndRenderVideo } from './videoEngine';

export function NativeVideoGenerator() {
  const [topic, setTopic] = useState('3 Rules for Rapid Daily Focus');
  const [aspectRatio, setAspectRatio] = useState('vertical');
  const [duration, setDuration] = useState('15s');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepText, setStepText] = useState('');
  const [videoResult, setVideoResult] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);
    setVideoResult(null);
    setProgress(5);
    setStepText('Initializing video pipeline...');

    try {
      const result = await createAndRenderVideo({
        topic,
        duration,
        aspectRatio,
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
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <h2>AI Video Creator</h2>
      <form onSubmit={handleGenerate}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Topic or Idea</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }}
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Ratio</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
            >
              <option value="vertical">9:16 (TikTok / Reels / Shorts)</option>
              <option value="square">1:1 (Instagram / LinkedIn)</option>
              <option value="horizontal">16:9 (YouTube / Web)</option>
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
            >
              <option value="15s">15 Seconds</option>
              <option value="30s">30 Seconds</option>
              <option value="60s">60 Seconds</option>
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
          }}
        >
          {isGenerating ? \`Generating (\${progress}%)... \${stepText}\` : 'Generate Video'}
        </button>
      </form>

      {/* Progress Bar */}
      {isGenerating && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span>{stepText}</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: \`\${progress}%\`, background: '#ff5500', transition: 'width 0.3s' }}></div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {/* Rendered Video Player */}
      {videoResult && (
        <div style={{ marginTop: '24px' }}>
          <h3>Your Generated Video:</h3>
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
              Download MP4
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

--------------------------------------------------------------------------------
4. RAW CURL COMMAND FOR TESTING IN TERMINAL
--------------------------------------------------------------------------------
curl -X POST "${baseUrl}/api/public/v1/videos/create" \\
  -H "Content-Type: application/json" \\
  -d '{
    "topic": "3 Productivity Hacks",
    "duration": "15s",
    "aspect_ratio": "vertical",
    "voice": "Aoede"
  }'
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
                  One-Click Complete API & Integration Bundle
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase border border-emerald-500/30">
                  Live & Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Contains API specs, Studio AI prompts, JavaScript client, and React native component.
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
            { id: 'prompt', label: 'Studio AI Prompt' },
            { id: 'code', label: 'React & JS Client Code' },
            { id: 'api', label: 'Raw Endpoints & cURL' },
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
                <span>Copy this prompt and paste it directly to your AI Studio / Developer:</span>
                <button
                  onClick={() => copyToClipboard(studioAiPrompt)}
                  className="text-ggd-orange hover:underline flex items-center gap-1"
                >
                  <i className="fa-solid fa-copy"></i> Copy Prompt
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-slate-950 border border-white/10 overflow-x-auto text-amber-300 whitespace-pre-wrap">
                {studioAiPrompt}
              </pre>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs font-sans font-bold">
                <span>Production JS Client & React Component:</span>
                <button
                  onClick={() => copyToClipboard(copyableFullBundle)}
                  className="text-ggd-orange hover:underline flex items-center gap-1"
                >
                  <i className="fa-solid fa-copy"></i> Copy Full Code
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-slate-950 border border-white/10 overflow-x-auto text-cyan-300 whitespace-pre-wrap">
                {copyableFullBundle.slice(copyableFullBundle.indexOf('2. READY-TO-USE JAVASCRIPT'), copyableFullBundle.indexOf('4. RAW CURL COMMAND'))}
              </pre>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs font-sans font-bold">
                <span>Raw HTTP Endpoints & Specs:</span>
                <button
                  onClick={() => copyToClipboard(copyableFullBundle)}
                  className="text-ggd-orange hover:underline flex items-center gap-1"
                >
                  <i className="fa-solid fa-copy"></i> Copy Spec
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-slate-950 border border-white/10 overflow-x-auto text-emerald-400 whitespace-pre-wrap">
                {copyableFullBundle.slice(0, copyableFullBundle.indexOf('2. READY-TO-USE JAVASCRIPT'))}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900/90 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-medium">
            <i className="fa-solid fa-shield-halved text-emerald-400"></i>
            <span>CORS Enabled & Ready for Any Website Frontend</span>
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
