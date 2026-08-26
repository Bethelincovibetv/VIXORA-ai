import React, { useState, useEffect } from 'react';
import { 
  apiServerCreateVideo, 
  apiServerGetVideoStatus, 
  ServerCreateVideoRequest, 
  ServerVideoStatusResponse 
} from '../services/supabaseService';
import { 
  ApiKeyRecord, 
  listLocalApiKeys, 
  generateRemoteApiKey, 
  revokeRemoteApiKey, 
  deleteApiKey 
} from '../services/apiKeyService';
import { CompleteApiModal } from './CompleteApiModal';

interface DeveloperApiViewProps {
  themeMode?: 'dark' | 'light';
  activeProjectId?: string | null;
}

export const DeveloperApiView: React.FC<DeveloperApiViewProps> = ({ themeMode = 'dark', activeProjectId }) => {
  // Navigation Sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'endpoints' | 'apikeys' | 'embeds' | 'simulator'>('endpoints');

  // API Key State
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>(() => listLocalApiKeys());
  const [selectedApiKey, setSelectedApiKey] = useState<string>(() => {
    const keys = listLocalApiKeys();
    return keys[0]?.apiKey || 'vx_live_vixora_prod_89f3a928b7e411d9c02';
  });
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([
    'videos:create', 'scripts:generate', 'audio:tts', 'assets:search', 'remote:embed'
  ]);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<{ [id: string]: boolean }>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // REST API Parameters
  const [topic, setTopic] = useState('5 Golden Rules for Wealth and Investing');
  const [script, setScript] = useState('First, spend less than you earn. Second, invest consistently every month. Third, avoid high-interest debt and let compounding work for you.');
  const [aspectRatio, setAspectRatio] = useState<'vertical' | 'horizontal' | 'square'>('vertical');
  const [duration, setDuration] = useState('30s');
  const [voice, setVoice] = useState('Aoede');
  const [resolution, setResolution] = useState('1080p');
  const [format, setFormat] = useState('mp4');
  
  const [activeCodeLang, setActiveCodeLang] = useState<'curl' | 'js' | 'python' | 'php' | 'react'>('curl');
  const [copiedCode, setCopiedCode] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  
  // Interactive Tester State
  const [isTriggering, setIsTriggering] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<ServerVideoStatusResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Embed Studio Config State
  const [embedType, setEmbedType] = useState<'creator' | 'chat' | 'voiceover' | 'scripts'>('creator');
  const [embedTheme, setEmbedTheme] = useState<'dark' | 'light'>('dark');
  const [embedHeight, setEmbedHeight] = useState('740px');

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

  // Generate dynamic cURL command using selected API key
  const curlCommand = `curl -X POST "${baseUrl}/api/public/v1/videos/create" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${selectedApiKey}" \\
  -d '${JSON.stringify(requestPayload, null, 2)}'`;

  // Generate JS / Fetch snippet
  const jsSnippet = `// 1. Create Video Job (Zero-Login via API Key)
const response = await fetch("${baseUrl}/api/public/v1/videos/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${selectedApiKey}"
  },
  body: JSON.stringify(${JSON.stringify(requestPayload, null, 2)})
});

const data = await response.json();
console.log("Job ID:", data.job_id);

// 2. Poll Status until 'ready'
const checkStatus = async (jobId) => {
  const res = await fetch(\`${baseUrl}/api/public/v1/videos/status?job_id=\${jobId}\`, {
    headers: { "Authorization": "Bearer ${selectedApiKey}" }
  });
  return await res.json();
};`;

  // Generate Python snippet
  const pythonSnippet = `import requests
import json
import time

url = "${baseUrl}/api/public/v1/videos/create"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${selectedApiKey}"
}
payload = ${JSON.stringify(requestPayload, null, 4)}

# Trigger generation
response = requests.post(url, headers=headers, json=payload)
data = response.json()
job_id = data.get("job_id")
print(f"Video Job Started: {job_id}")

# Poll status
while True:
    status_url = f"${baseUrl}/api/public/v1/videos/status?job_id={job_id}"
    status_res = requests.get(status_url, headers=headers).json()
    status = status_res.get("status")
    print(f"Current Status: {status} ({status_res.get('progress')}%)")
    
    if status == "ready":
        print(f"Video Ready! URL: {status_res.get('video_url')}")
        break
    elif status == "failed":
        print(f"Generation Failed: {status_res.get('error')}")
        break
    time.sleep(2)`;

  // Generate PHP snippet
  const phpSnippet = `<?php
$ch = curl_init("${baseUrl}/api/public/v1/videos/create");
$payload = json_encode(${JSON.stringify(requestPayload, null, 2)});

curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Content-Type: application/json',
    'Authorization: Bearer ${selectedApiKey}'
));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$result = curl_exec($ch);
curl_close($ch);

$data = json_decode($result, true);
echo "Video Job ID: " . $data['job_id'];
?>`;

  // Generate React Component snippet
  const reactSnippet = `import React from 'react';

export function VixoraRemoteWidget() {
  return (
    <div style={{ width: '100%', maxWidth: '1080px', margin: '0 auto' }}>
      <iframe
        src="${baseUrl}/?embed=${embedType}&apiKey=${selectedApiKey}&theme=${embedTheme}"
        width="100%"
        height="${embedHeight}"
        style={{
          border: 'none',
          borderRadius: '24px',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)'
        }}
        allow="camera; microphone; display-capture; clipboard-write;"
        title="Vixora Studio Remote Creator"
      />
    </div>
  );
}`;

  const getActiveCode = () => {
    switch (activeCodeLang) {
      case 'js': return jsSnippet;
      case 'python': return pythonSnippet;
      case 'php': return phpSnippet;
      case 'react': return reactSnippet;
      case 'curl':
      default:
        return curlCommand;
    }
  };

  const copyToClipboard = (text: string, id?: string) => {
    navigator.clipboard.writeText(text);
    if (id) {
      setCopiedKeyId(id);
      setTimeout(() => setCopiedKeyId(null), 2500);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleCreateNewKey = async () => {
    if (!newKeyName.trim()) {
      alert('Please enter a name for the new API Key (e.g. "Main Website", "Surah AI Embed")');
      return;
    }
    setIsGeneratingKey(true);
    try {
      const newKey = await generateRemoteApiKey(newKeyName.trim(), newKeyPermissions);
      setApiKeys(listLocalApiKeys());
      setSelectedApiKey(newKey.apiKey);
      setNewKeyName('');
    } catch (e: any) {
      alert('Failed to generate key: ' + e?.message);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (id: string, apiKey: string) => {
    if (!confirm('Are you sure you want to revoke this API Key? Any external sites using it will lose access.')) return;
    await revokeRemoteApiKey(id, apiKey);
    setApiKeys(listLocalApiKeys());
  };

  const handleDeleteKey = (id: string) => {
    if (!confirm('Are you sure you want to delete this API Key record?')) return;
    deleteApiKey(id);
    setApiKeys(listLocalApiKeys());
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-ggd-orange/15 text-ggd-orange border border-ggd-orange/30 text-[9px] font-black uppercase tracking-wider">
                Vixora Studio Engine v3.1
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider">
                Remote API & Embeds Ready
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
              Developer Console & Remote Display Center
            </h2>
            <p className={`text-xs ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
              Generate API keys, trigger server-side video creation, or embed the live video creator & Surah AI on any external website with zero user login.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowCompleteModal(true)}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-xl transition-all hover:scale-105"
            >
              <i className="fa-solid fa-book-open text-sm"></i>
              <span>Full API & Embed Guide</span>
            </button>

            <button
              onClick={() => copyToClipboard(curlCommand)}
              className="btn-3d btn-3d-orange px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shrink-0"
            >
              <i className={`fa-solid ${copiedCode ? 'fa-check' : 'fa-copy'}`}></i>
              <span>{copiedCode ? 'Copied Code!' : 'Copy Code'}</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="mt-5 pt-4 border-t border-white/10 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveSubTab('endpoints')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'endpoints'
                ? 'bg-ggd-orange text-white shadow-lg'
                : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-code"></i>
            <span>REST API & Tester</span>
          </button>

          <button
            onClick={() => setActiveSubTab('apikeys')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'apikeys'
                ? 'bg-ggd-orange text-white shadow-lg'
                : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-key text-amber-400"></i>
            <span>API Keys Manager ({apiKeys.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('embeds')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'embeds'
                ? 'bg-ggd-orange text-white shadow-lg'
                : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-tv text-emerald-400"></i>
            <span>Remote Display & Embed SDK</span>
          </button>

          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'simulator'
                ? 'bg-ggd-orange text-white shadow-lg'
                : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-play text-purple-400"></i>
            <span>Live Remote Simulator</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: REST API & TESTER */}
      {activeSubTab === 'endpoints' && (
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
              <span className="text-[9px] font-bold text-slate-400 font-mono">POST /videos/create</span>
            </div>

            {/* Active API Key Selector */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-key"></i>
                  <span>Active Authentication Key</span>
                </label>
                <button
                  onClick={() => setActiveSubTab('apikeys')}
                  className="text-[9px] font-bold text-amber-400 hover:underline uppercase"
                >
                  + Generate New
                </button>
              </div>
              <select
                value={selectedApiKey}
                onChange={e => setSelectedApiKey(e.target.value)}
                className={`w-full p-2.5 rounded-xl border text-xs font-mono font-bold outline-none ${
                  themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
                }`}
              >
                {apiKeys.map(k => (
                  <option key={k.id} value={k.apiKey}>
                    {k.name} ({k.prefix}) - {k.status.toUpperCase()}
                  </option>
                ))}
              </select>
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
                  <option value="vertical">9:16 Vertical (TikTok/Reels)</option>
                  <option value="horizontal">16:9 Horizontal (YouTube)</option>
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
                  <option value="Fenrir">Fenrir (Authoritative)</option>
                  <option value="Kore">Kore (Smooth & Pro)</option>
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
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['curl', 'js', 'python', 'php', 'react'] as const).map(lang => (
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
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer"
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
      )}

      {/* SUBTAB 2: API KEYS MANAGER */}
      {activeSubTab === 'apikeys' && (
        <div className="space-y-6">
          {/* Key Generator Form */}
          <div className={`p-6 rounded-3xl border shadow-xl space-y-5 ${
            themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-white/10'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-white/10 border-slate-200">
              <div className="space-y-0.5">
                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <i className="fa-solid fa-key text-amber-400"></i>
                  <span>Generate New API Key</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Keys allow external web apps and Lovable platforms to call video rendering or embed studio remotely without user login.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-6 space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Key Label / Client Name
                </label>
                <input
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="e.g. My Website Video Creator, Mobile App, Zapier Bot"
                  className={`w-full p-3 rounded-xl border text-xs font-bold outline-none focus:border-ggd-orange ${
                    themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'
                  }`}
                />
              </div>

              <div className="md:col-span-6 space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Granted Capabilities
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { id: 'videos:create', label: 'Video Creator' },
                    { id: 'scripts:generate', label: 'Script AI' },
                    { id: 'audio:tts', label: 'Voiceover' },
                    { id: 'remote:embed', label: 'Remote Embed' },
                  ].map(perm => (
                    <button
                      key={perm.id}
                      type="button"
                      onClick={() => {
                        setNewKeyPermissions(prev => 
                          prev.includes(perm.id) ? prev.filter(p => p !== perm.id) : [...prev, perm.id]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${
                        newKeyPermissions.includes(perm.id)
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-white/5 text-slate-400 border border-white/10'
                      }`}
                    >
                      <i className={`fa-solid ${newKeyPermissions.includes(perm.id) ? 'fa-check' : 'fa-plus'}`}></i>
                      <span>{perm.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-12 pt-2">
                <button
                  onClick={handleCreateNewKey}
                  disabled={isGeneratingKey || !newKeyName.trim()}
                  className="btn-3d btn-3d-orange px-6 py-3.5 text-xs font-black uppercase tracking-wider shadow-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <i className={`fa-solid ${isGeneratingKey ? 'fa-spinner animate-spin' : 'fa-sparkles'}`}></i>
                  <span>Generate Production API Key</span>
                </button>
              </div>
            </div>
          </div>

          {/* Existing Keys Table */}
          <div className={`p-6 rounded-3xl border shadow-xl space-y-4 ${
            themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-white/10'
          }`}>
            <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-list-check text-emerald-400"></i>
              <span>Active Keys ({apiKeys.length})</span>
            </h3>

            <div className="space-y-3">
              {apiKeys.map(key => {
                const isVisible = visibleKeys[key.id] || false;
                const isSelected = selectedApiKey === key.apiKey;

                return (
                  <div
                    key={key.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-ggd-orange/60 bg-ggd-orange/5 shadow-md'
                        : themeMode === 'light'
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-black uppercase text-white tracking-wide">
                            {key.name}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            key.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {key.status}
                          </span>
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] font-black uppercase">
                              Active in Code
                            </span>
                          )}
                        </div>

                        {/* Secret Key Display */}
                        <div className="flex items-center gap-2 font-mono text-xs text-amber-300">
                          <span>{isVisible ? key.apiKey : key.prefix}</span>
                          <button
                            onClick={() => setVisibleKeys(prev => ({ ...prev, [key.id]: !prev[key.id] }))}
                            className="text-slate-400 hover:text-white text-[11px] cursor-pointer"
                            title={isVisible ? "Hide Key" : "Show Full Key"}
                          >
                            <i className={`fa-solid ${isVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                          </button>
                        </div>

                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                          <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>Calls: {key.usageCount || 0}</span>
                          <span>•</span>
                          <span>Rate: {key.rateLimitPerMin}/min</span>
                        </div>
                      </div>

                      {/* Key Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => copyToClipboard(key.apiKey, key.id)}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <i className={`fa-solid ${copiedKeyId === key.id ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                          <span>{copiedKeyId === key.id ? 'Copied' : 'Copy Key'}</span>
                        </button>

                        <button
                          onClick={() => setSelectedApiKey(key.apiKey)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-ggd-orange text-white'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          <i className="fa-solid fa-check-double"></i>
                          <span>Use for API</span>
                        </button>

                        {key.status === 'active' ? (
                          <button
                            onClick={() => handleRevokeKey(key.id, key.apiKey)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase cursor-pointer"
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeleteKey(key.id)}
                            className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-[10px] font-black uppercase cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: REMOTE DISPLAY & EMBED SDK */}
      {activeSubTab === 'embeds' && (
        <div className="space-y-6">
          {/* Customizer Box */}
          <div className={`p-6 rounded-3xl border shadow-xl space-y-5 ${
            themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-white/10'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 dark:border-white/10 border-slate-200">
              <div className="space-y-0.5">
                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                  <i className="fa-solid fa-tv text-emerald-400"></i>
                  <span>Zero-Login Remote Display Customizer</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Embed video creation or Surah AI directly on your website. Remote visitors can create and preview without signing in.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Feature to Display */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Studio Tool to Display
                </label>
                <select
                  value={embedType}
                  onChange={e => setEmbedType(e.target.value as any)}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${
                    themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-800 border-white/10 text-white'
                  }`}
                >
                  <option value="creator">Video Studio & Auto-Sourcer</option>
                  <option value="chat">Surah AI / Assistant Coach</option>
                  <option value="voiceover">Voiceover & Neural TTS Studio</option>
                  <option value="scripts">Viral Script Generator</option>
                </select>
              </div>

              {/* Theme */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Color Theme
                </label>
                <select
                  value={embedTheme}
                  onChange={e => setEmbedTheme(e.target.value as any)}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${
                    themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-800 border-white/10 text-white'
                  }`}
                >
                  <option value="dark">Dark Theme (Neon & Slate)</option>
                  <option value="light">Light Theme (Clean White)</option>
                </select>
              </div>

              {/* Height */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                  Container Height
                </label>
                <select
                  value={embedHeight}
                  onChange={e => setEmbedHeight(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${
                    themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-800 border-white/10 text-white'
                  }`}
                >
                  <option value="740px">740px (Full Studio)</option>
                  <option value="640px">640px (Medium Widget)</option>
                  <option value="500px">500px (Compact)</option>
                  <option value="100vh">100vh (Full Screen Takeover)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Embed Code Snippets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Snippet 1: Script Tag Embed */}
            <div className="rounded-3xl bg-slate-950 border border-white/10 shadow-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">
                    Method 1 (Recommended)
                  </span>
                  <h4 className="text-xs font-black uppercase text-white">1-Click Script Drop-in</h4>
                </div>
                <button
                  onClick={() => copyToClipboard(`<!-- Vixora Video Creator Embed Container -->
<div id="vixora-video-creator" data-api-key="${selectedApiKey}" data-theme="${embedTheme}" data-height="${embedHeight}"></div>
<script src="${baseUrl}/embed.js" async></script>`)}
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-copy"></i>
                  <span>Copy</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                Paste this anywhere in your HTML. The script automatically mounts the responsive studio.
              </p>

              <div className="p-3.5 rounded-2xl bg-black/60 font-mono text-xs text-emerald-400 overflow-x-auto">
                <pre>{`<!-- Vixora Video Creator Embed Container -->
<div 
  id="vixora-video-creator" 
  data-api-key="${selectedApiKey}" 
  data-theme="${embedTheme}" 
  data-height="${embedHeight}"
></div>
<script src="${baseUrl}/embed.js" async></script>`}</pre>
              </div>
            </div>

            {/* Snippet 2: Native Iframe Embed */}
            <div className="rounded-3xl bg-slate-950 border border-white/10 shadow-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 text-[9px] font-black uppercase">
                    Method 2
                  </span>
                  <h4 className="text-xs font-black uppercase text-white">Universal HTML Iframe</h4>
                </div>
                <button
                  onClick={() => copyToClipboard(`<iframe
  src="${baseUrl}/?embed=${embedType}&apiKey=${selectedApiKey}&theme=${embedTheme}"
  width="100%"
  height="${embedHeight}"
  style="border: none; border-radius: 24px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5);"
  allow="camera; microphone; display-capture; clipboard-write;"
  title="Vixora Studio Remote Creator"
></iframe>`)}
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-copy"></i>
                  <span>Copy</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                Works in WordPress, Webflow, Shopify, Framer, Wix, or custom React/Vue apps.
              </p>

              <div className="p-3.5 rounded-2xl bg-black/60 font-mono text-xs text-emerald-400 overflow-x-auto">
                <pre>{`<iframe
  src="${baseUrl}/?embed=${embedType}&apiKey=${selectedApiKey}&theme=${embedTheme}"
  width="100%"
  height="${embedHeight}"
  style="border: none; border-radius: 24px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5);"
  allow="camera; microphone; display-capture; clipboard-write;"
  title="Vixora Studio Remote Creator"
></iframe>`}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: LIVE SIMULATOR */}
      {activeSubTab === 'simulator' && (
        <div className={`p-6 rounded-3xl border shadow-xl space-y-4 ${
          themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-white/10'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3 dark:border-white/10 border-slate-200">
            <div className="space-y-0.5">
              <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-play text-purple-400"></i>
                <span>Live Remote Embed Simulator</span>
              </h3>
              <p className="text-xs text-slate-400">
                This simulator runs the exact iframe container that your remote visitors will see on your external website.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={embedType}
                onChange={e => setEmbedType(e.target.value as any)}
                className={`p-2 rounded-xl border text-xs font-bold outline-none ${
                  themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-800 border-white/10 text-white'
                }`}
              >
                <option value="creator">Video Studio</option>
                <option value="chat">Surah AI Coach</option>
                <option value="voiceover">Voiceover Studio</option>
                <option value="scripts">Scripts AI</option>
              </select>

              <a
                href={`${baseUrl}/?embed=${embedType}&apiKey=${selectedApiKey}&theme=${embedTheme}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase flex items-center gap-1.5"
              >
                <i className="fa-solid fa-arrow-up-right-from-square"></i>
                <span>Open in New Window</span>
              </a>
            </div>
          </div>

          {/* Embedded Iframe Container */}
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/60 shadow-2xl">
            <iframe
              src={`${baseUrl}/?embed=${embedType}&apiKey=${selectedApiKey}&theme=${embedTheme}`}
              width="100%"
              height="700px"
              style={{ border: 'none' }}
              allow="camera; microphone; display-capture; clipboard-write;"
              title="Vixora Studio Live Embed Simulator"
            />
          </div>
        </div>
      )}

      {/* 1-Click Complete API & Integration Documentation Modal */}
      <CompleteApiModal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        themeMode={themeMode}
        baseUrl={baseUrl}
      />
    </div>
  );
};

