import React, { useState } from 'react';
import { COMPLETE_STANDALONE_BUNDLE_JSON, FULL_INTEGRATION_AI_PROMPT } from '../services/codeExportBundle';

interface NativeExportDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode?: 'dark' | 'light';
}

export const NativeExportDownloadModal: React.FC<NativeExportDownloadModalProps> = ({
  isOpen,
  onClose,
  themeMode = 'dark'
}) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedZipManifest, setCopiedZipManifest] = useState(false);
  const [activeTab, setActiveTab] = useState<'prompt' | 'files' | 'download'>('prompt');

  if (!isOpen) return null;

  const handleDownloadFullZipPackage = () => {
    const blob = new Blob([COMPLETE_STANDALONE_BUNDLE_JSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vixora-studio-full-native-codebase.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAIPrompt = () => {
    const blob = new Blob([FULL_INTEGRATION_AI_PROMPT], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'VIXORA_AI_BUILDER_INSTRUCTIONS.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyPromptToClipboard = () => {
    navigator.clipboard.writeText(FULL_INTEGRATION_AI_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const copyBundleToClipboard = () => {
    navigator.clipboard.writeText(COMPLETE_STANDALONE_BUNDLE_JSON);
    setCopiedZipManifest(true);
    setTimeout(() => setCopiedZipManifest(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className={`w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
        themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-950 border-white/15 text-white'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/30 text-white text-lg">
              <i className="fa-solid fa-box-archive"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black uppercase tracking-tight">
                  1-Click Full Codebase & AI Builder Package
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase border border-emerald-500/30">
                  Ready to Download
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Contains 100% of every component, service, state manager, SFX engine, and the exact AI builder prompt.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-base"></i>
          </button>
        </div>

        {/* Action Highlights Bar */}
        <div className="p-4 bg-orange-500/10 border-b border-orange-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-sparkles text-orange-400 text-lg"></i>
            <span className="text-xs font-bold text-orange-300">
              Hand this directly to your Lovable, Cursor, Bolt, or AI Developer to import Vixora natively into your website in 1 step!
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDownloadFullZipPackage}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg transition-transform hover:scale-105"
            >
              <i className="fa-solid fa-download"></i>
              <span>Download Full Code (.JSON)</span>
            </button>

            <button
              onClick={handleDownloadAIPrompt}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer border border-white/10"
            >
              <i className="fa-solid fa-file-code"></i>
              <span>Download Prompt (.MD)</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-white/10 bg-slate-900/40">
          <button
            onClick={() => setActiveTab('prompt')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'prompt'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-robot"></i>
            <span>AI Side-Builder Integration Prompt</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'files'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-folder-tree"></i>
            <span>Packaged Files Manifest (All Codes)</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'prompt' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Copy & Paste this directly to your AI Assistant / Site Builder:
                </span>
                <button
                  onClick={copyPromptToClipboard}
                  className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <i className={`fa-solid ${copiedPrompt ? 'fa-check' : 'fa-copy'}`}></i>
                  <span>{copiedPrompt ? 'Copied to Clipboard!' : 'Copy AI Prompt'}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-black/80 border border-white/10 font-mono text-xs text-slate-200 leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap selection:bg-orange-500 selection:text-white">
                {FULL_INTEGRATION_AI_PROMPT}
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Complete Raw Code Manifest (All files bundled into structured JSON):
                </span>
                <button
                  onClick={copyBundleToClipboard}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border border-white/10"
                >
                  <i className={`fa-solid ${copiedZipManifest ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                  <span>{copiedZipManifest ? 'Copied Full Code JSON!' : 'Copy Raw Code JSON'}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-black/80 border border-white/10 font-mono text-[11px] text-emerald-400/90 leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap">
                {COMPLETE_STANDALONE_BUNDLE_JSON.slice(0, 5000)}
                {'\n\n/* ... [Complete file manifest containing all 18 components, services, and types ready for 1-click download] ... */'}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            Files included: <span className="text-white font-bold">App.tsx, types.ts, sfxLibrary.ts, DeveloperApiView.tsx, CompleteApiModal.tsx, PaystackModal.tsx, serverVideoEngine.ts, and all services</span>.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadFullZipPackage}
              className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <i className="fa-solid fa-file-arrow-down"></i>
              <span>1-Click Download Codebase</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
