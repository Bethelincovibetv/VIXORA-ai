import React, { useState, useEffect } from 'react';
import { 
  apiServerCreateVideo, 
  apiServerGetVideoStatus, 
  ServerCreateVideoRequest, 
  ServerVideoStatusResponse 
} from '../services/supabaseService';

interface DeveloperApiViewProps {
  themeMode?: 'dark' | 'light';
  activeProjectId?: string | null;
}

export const DeveloperApiView: React.FC<DeveloperApiViewProps> = ({ themeMode = 'dark', activeProjectId }) => {
  const [topic, setTopic] = useState('5 Golden Rules for Wealth and Investing');
  const [script, setScript] = useState('First, spend less than you earn. Second, invest consistently every month. Third, avoid high-interest debt and let compounding work for you.');
  const [aspectRatio, setAspectRatio] = useState<'vertical' | 'horizontal' | 'square'>('vertical');
  const [duration, setDuration] = useState('30s');
  const [voice, setVoice] = useState('Aoede');
  const [resolution, setResolution] = useState('1080p');
  const [format, setFormat] = useState('mp4');
  
  const [activeCodeLang, setActiveCodeLang] = useState<'curl' | 'js' | 'python' | 'php'>('curl');
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Interactive Tester State
  const [isTriggering, setIsTriggering] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<ServerVideoStatusResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://vixora.studio';

  const requestPayload: ServerCreateVideoRequest = {
    project_id: activeProjectId || 'proj_dev_test',
    topic: topic.trim() || undefined,
    script: script.trim() || undefined,
    voice,
    aspect_ratio: aspectRatio,
    duration,
    resolution,
    format,
  };

  // Generate dynamic cURL command
  const curlCommand = `curl -X POST "${baseUrl}/api/public/v1/videos/create" \\
  -H "Content-Type: application/json" \\
  -H "apikey: sb_publishable_bgmE8p2LPYQn2eVWBUEdMw_6R4GplVZ" \\
  -d '${JSON.stringify(requestPayload, null, 2)}'`;

  // Generate JS / Fetch snippet
  const jsSnippet = `const response = await fetch("${baseUrl}/api/public/v1/videos/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": "sb_publishable_bgmE8p2LPYQn2eVWBUEdMw_6R4GplVZ"
  },
  body: JSON.stringify(${JSON.stringify(requestPayload, null, 2)})
});

const data = await response.json();
console.log("Job ID:", data.job_id);

// Poll for status:
const checkStatus = async (jobId) => {
  const res = await fetch(\`${baseUrl}/api/public/v1/videos/status?job_id=\${jobId}\`);
  return await res.json();
};`;

  // Generate Python snippet
  const pythonSnippet = `import requests
import json

url = "${baseUrl}/api/public/v1/videos/create"
headers = {
    "Content-Type": "application/json",
    "apikey": "sb_publishable_bgmE8p2LPYQn2eVWBUEdMw_6R4GplVZ"
}
payload = ${JSON.stringify(requestPayload, null, 4)}

response = requests.post(url, headers=headers, json=payload)
data = response.json()
print("Job ID:", data.get("job_id"))

# Check status:
status_url = f"${baseUrl}/api/public/v1/videos/status?job_id={data.get('job_id')}"
status_res = requests.get(status_url).json()
print("Status:", status_res.get("status"))`;

  // Generate PHP snippet
  const phpSnippet = `<?php
$ch = curl_init("${baseUrl}/api/public/v1/videos/create");
$payload = json_encode(${JSON.stringify(requestPayload, null, 2)});

curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Content-Type: application/json',
    'apikey: sb_publishable_bgmE8p2LPYQn2eVWBUEdMw_6R4GplVZ'
));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$result = curl_exec($ch);
curl_close($ch);

$data = json_decode($result, true);
echo "Job ID: " . $data['job_id'];
?>`;

  const getActiveCode = () => {
    switch (activeCodeLang) {
      case 'js': return jsSnippet;
      case 'python': return pythonSnippet;
      case 'php': return phpSnippet;
      case 'curl':
      default:
        return curlCommand;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Trigger test directly from Developer UI
  const handleTestCreate = async () => {
    setIsTriggering(true);
    setTestError(null);
    setJobStatus(null);

    try {
      const res = await apiServerCreateVideo(requestPayload);
      if (!res.ok || !res.job_id) {
        setTestError(res.error || 'Failed to trigger video generation');
        setIsTriggering(false);
        return;
      }

      setActiveJobId(res.job_id);
    } catch (err: any) {
      setTestError(err?.message || 'Error executing request');
      setIsTriggering(false);
    }
  };

  // Poll active job status
  useEffect(() => {
    if (!activeJobId) return;

    let interval: any = null;
    const poll = async () => {
      const statusRes = await apiServerGetVideoStatus(activeJobId);
      if (statusRes && 'status' in statusRes) {
        setJobStatus(statusRes);
        if (statusRes.status === 'ready' || statusRes.status === 'failed') {
          setIsTriggering(false);
          clearInterval(interval);
        }
      }
    };

    poll();
    interval = setInterval(poll, 2000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeJobId]);

  return (
    <div className="space-y-6 text-left animate-rise">
      {/* Header Banner */}
      <div className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden ${
        themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-white/10'
      }`}>
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-purple-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-ggd-orange/15 text-ggd-orange border border-ggd-orange/30 text-[9px] font-black uppercase tracking-wider">
                Vixora Engine API v1
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider">
                REST Endpoints Operational
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
              Developer API & Remote Video Generator
            </h2>
            <p className={`text-xs ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
              Trigger high-retention video creation server-side from your external website, SaaS backend, or webhook workflows.
            </p>
          </div>

          <button
            onClick={() => copyToClipboard(curlCommand)}
            className="btn-3d btn-3d-orange px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shrink-0"
          >
            <i className={`fa-solid ${copiedCode ? 'fa-check' : 'fa-copy'}`}></i>
            <span>{copiedCode ? 'Copied cURL!' : 'Copy cURL'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Parameters Configurator + Code Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Interactive Parameters (5 cols) */}
        <div className={`lg:col-span-5 p-5 rounded-3xl border shadow-xl space-y-4 ${
          themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-white/10'
        }`}>
          <div className="flex items-center justify-between border-b pb-3 dark:border-white/10 border-slate-200">
            <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-sliders text-ggd-orange"></i>
              <span>API Request Parameters</span>
            </h3>
            <span className="text-[9px] font-bold text-slate-400">POST /videos/create</span>
          </div>

          {/* Topic */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
              Topic (or Prompt)
            </label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className={`w-full p-3 rounded-xl border text-xs font-bold outline-none focus:border-ggd-orange ${
                themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'
              }`}
              placeholder="e.g. 5 Habit Hacks to Boost Focus"
            />
          </div>

          {/* Script */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
              Direct Script (Optional - AI auto-writes if omitted)
            </label>
            <textarea
              rows={3}
              value={script}
              onChange={e => setScript(e.target.value)}
              className={`w-full p-3 rounded-xl border text-xs font-medium outline-none focus:border-ggd-orange ${
                themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'
              }`}
              placeholder="Enter spoken script sentences..."
            />
          </div>

          {/* Controls Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Aspect Ratio */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                Aspect Ratio
              </label>
              <select
                value={aspectRatio}
                onChange={e => setAspectRatio(e.target.value as any)}
                className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${
                  themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-800 border-white/10 text-white'
                }`}
              >
                <option value="vertical">9:16 Vertical (TikTok/Reels/Shorts)</option>
                <option value="horizontal">16:9 Horizontal (YouTube/TV)</option>
                <option value="square">1:1 Square (Instagram)</option>
              </select>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                Target Duration
              </label>
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${
                  themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-800 border-white/10 text-white'
                }`}
              >
                <option value="15s">15 Seconds (Ultra Hook)</option>
                <option value="30s">30 Seconds (Optimal Short)</option>
                <option value="60s">60 Seconds (Deep Dive)</option>
              </select>
            </div>

            {/* Voice */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                Voice Avatar
              </label>
              <select
                value={voice}
                onChange={e => setVoice(e.target.value)}
                className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${
                  themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-800 border-white/10 text-white'
                }`}
              >
                <option value="Aoede">Aoede (Narrative & Warm)</option>
                <option value="Puck">Puck (Fast & Energetic)</option>
                <option value="Fenrir">Fenrir (Authoritative / Deep)</option>
                <option value="Kore">Kore (Smooth & Professional)</option>
                <option value="Charon">Charon (Dramatic)</option>
              </select>
            </div>

            {/* Format */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                Resolution & Format
              </label>
              <select
                value={`${resolution}-${format}`}
                onChange={e => {
                  const [res, fmt] = e.target.value.split('-');
                  setResolution(res);
                  setFormat(fmt);
                }}
                className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${
                  themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-800 border-white/10 text-white'
                }`}
              >
                <option value="1080p-mp4">1080p MP4 (High Quality)</option>
                <option value="720p-mp4">720p MP4 (Fast Render)</option>
                <option value="4k-mp4">4K Ultra HD MP4</option>
              </select>
            </div>
          </div>

          {/* Test Trigger Button */}
          <div className="pt-2">
            <button
              onClick={handleTestCreate}
              disabled={isTriggering}
              className="btn-3d btn-3d-purple w-full py-3.5 text-xs font-black uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isTriggering ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin"></i>
                  <span>Executing Server Generation...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-play text-amber-300"></i>
                  <span>Test Run /videos/create API</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Code Snippets & Response Viewer (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Code Viewer Box */}
          <div className="rounded-3xl bg-slate-950 border border-white/10 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-white/10">
              {/* Language Selector */}
              <div className="flex items-center gap-1.5">
                {(['curl', 'js', 'python', 'php'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setActiveCodeLang(lang)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                      activeCodeLang === lang
                        ? 'bg-ggd-orange text-white shadow-md'
                        : 'text-slate-400 hover:text-white bg-white/5'
                    }`}
                  >
                    {lang === 'js' ? 'JavaScript' : lang.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Copy Code */}
              <button
                onClick={() => copyToClipboard(getActiveCode())}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase transition-all flex items-center gap-1.5"
              >
                <i className={`fa-solid ${copiedCode ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="p-4 overflow-x-auto text-xs font-mono text-emerald-400/90 leading-relaxed max-h-72">
              <pre>{getActiveCode()}</pre>
            </div>
          </div>

          {/* Interactive Test Live Job Tracker */}
          {(jobStatus || testError) && (
            <div className={`p-5 rounded-3xl border shadow-xl animate-rise space-y-3 ${
              jobStatus?.status === 'failed' || testError
                ? 'bg-red-950/40 border-red-500/30'
                : jobStatus?.status === 'ready'
                ? 'bg-emerald-950/40 border-emerald-500/30'
                : 'bg-slate-900/90 border-ggd-orange/40'
            }`}>
              <div className="flex items-center justify-between border-b pb-2.5 dark:border-white/10 border-slate-200">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    jobStatus?.status === 'ready' ? 'bg-emerald-400' : jobStatus?.status === 'failed' ? 'bg-red-400' : 'bg-amber-400 animate-pulse'
                  }`}></span>
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    Job Reference: {jobStatus?.job_id || activeJobId}
                  </span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                  jobStatus?.status === 'ready'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : jobStatus?.status === 'failed'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {jobStatus?.status || 'Processing'}
                </span>
              </div>

              {testError && (
                <p className="text-xs text-red-300 font-semibold">{testError}</p>
              )}

              {jobStatus && (
                <div className="space-y-2">
                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                      <span>{jobStatus.current_step}</span>
                      <span>{jobStatus.progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-300"
                        style={{ width: `${jobStatus.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Ready Action Link */}
                  {jobStatus.status === 'ready' && jobStatus.video_url && (
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                      <div className="flex items-center gap-2.5">
                        <i className="fa-solid fa-circle-check text-emerald-400 text-base"></i>
                        <div>
                          <p className="text-xs font-black text-white uppercase">Video Generation Ready</p>
                          <p className="text-[9px] text-emerald-300/80 font-mono truncate max-w-xs">Asset: {jobStatus.asset_id}</p>
                        </div>
                      </div>

                      <a
                        href={jobStatus.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md"
                      >
                        <i className="fa-solid fa-download"></i>
                        <span>Download MP4</span>
                      </a>
                    </div>
                  )}

                  {/* Live Status Log Feed */}
                  {jobStatus.logs && jobStatus.logs.length > 0 && (
                    <div className="p-3 rounded-xl bg-black/50 border border-white/5 font-mono text-[10px] text-slate-300 space-y-1 max-h-36 overflow-y-auto">
                      {jobStatus.logs.map((log, idx) => (
                        <div key={idx} className="truncate">{log}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
