import React, { useState, useMemo } from 'react';
import { VIXORA_TOOLS_REGISTRY, VixoraToolEntry } from '../services/vixoraToolsRegistry';

interface ToolsLibraryProps {
  onSelectTab: (tab: string) => void;
  onStartLiveAssistant: () => void;
  onOpenChatWithPrompt: (prompt?: string) => void;
  themeMode?: 'light' | 'dark';
}

export const ToolsLibrary: React.FC<ToolsLibraryProps> = ({
  onSelectTab,
  onStartLiveAssistant,
  onOpenChatWithPrompt,
  themeMode = 'dark'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Tools', icon: 'fa-shapes' },
    { id: 'video', label: 'Video & Scripting', icon: 'fa-video' },
    { id: 'voice', label: 'AI Voice & Audio', icon: 'fa-waveform-lines' },
    { id: 'growth', label: 'Growth & SEO', icon: 'fa-chart-line' },
    { id: 'creative', label: 'Creative Assets', icon: 'fa-palette' },
    { id: 'mentorship', label: 'Mentorship & Memory', icon: 'fa-brain' }
  ];

  const filteredTools = useMemo(() => {
    return VIXORA_TOOLS_REGISTRY.filter(tool => {
      const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCategory;

      const matchesSearch = 
        tool.name.toLowerCase().includes(q) ||
        tool.shortDescription.toLowerCase().includes(q) ||
        tool.fullDescription.toLowerCase().includes(q) ||
        tool.keywords.some(k => k.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const handleLaunchTool = (tool: VixoraToolEntry) => {
    if (tool.actionType === 'tab' && tool.targetTab) {
      onSelectTab(tool.targetTab);
    } else if (tool.actionType === 'live_voice') {
      onStartLiveAssistant();
    } else if (tool.actionType === 'chat_command') {
      onOpenChatWithPrompt(tool.suggestedPrompt || `Help me with ${tool.name}`);
    } else if (tool.targetTab) {
      onSelectTab(tool.targetTab);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* PAGE HEADER */}
      <div className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden ${
        themeMode === 'light' 
          ? 'bg-gradient-to-br from-white via-orange-50/30 to-amber-50/50 border-slate-200 text-slate-900' 
          : 'bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border-white/10 text-white'
      }`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-ggd-orange/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-ggd-orange/20 text-ggd-orange border border-ggd-orange/30">
              Unified Feature Library
            </span>
            <span className="text-xs font-bold text-slate-400">({VIXORA_TOOLS_REGISTRY.length} AI Tools)</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-2.5">
            <i className="fa-solid fa-bolt-lightning text-ggd-orange"></i>
            <span>Vixora AI Tools & Capabilities</span>
          </h2>

          <p className="text-xs text-slate-400 max-w-xl leading-relaxed font-medium">
            Explore every AI creation tool in Vixora AI Studio. From full autopilot video production and live audio calls to viral scriptwriting, flyer design, and SEO growth tools.
          </p>

          {/* SEARCH BAR */}
          <div className="pt-2">
            <div className={`relative flex items-center rounded-2xl border transition-all shadow-md ${
              themeMode === 'light'
                ? 'bg-white border-slate-300 focus-within:border-ggd-orange text-slate-900'
                : 'bg-white/5 border-white/10 focus-within:border-ggd-orange text-white'
            }`}>
              <i className="fa-solid fa-magnifying-glass text-slate-400 text-sm ml-4"></i>
              <input 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tools by name, keyword (e.g. 'video', 'voice', 'script', 'flyer')..."
                className="w-full px-3 py-3.5 bg-transparent outline-none text-xs font-semibold placeholder:text-slate-500"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="mr-3 text-slate-400 hover:text-white text-xs p-1"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CATEGORY FILTER PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map(cat => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-2 shrink-0 active:scale-95 ${
                isActive
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white border-orange-400/50 shadow-md'
                  : themeMode === 'light'
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              <i className={`fa-solid ${cat.icon} text-[11px]`}></i>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* TOOLS GRID */}
      {filteredTools.length === 0 ? (
        <div className={`p-10 text-center rounded-3xl border ${
          themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-white/5'
        }`}>
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3 text-lg">
            <i className="fa-solid fa-magnifying-glass"></i>
          </div>
          <h3 className="text-sm font-black uppercase tracking-tight">No tools found</h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">Try searching for another keyword or change the selected category filter.</p>
          <button 
            onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
            className="mt-4 px-4 py-2 rounded-xl bg-ggd-orange/10 border border-ggd-orange/30 text-ggd-orange font-bold text-xs"
          >
            Reset Search Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map((tool) => (
            <div 
              key={tool.id}
              className={`p-5 rounded-3xl border flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 shadow-lg group relative overflow-hidden ${
                themeMode === 'light'
                  ? 'bg-white border-slate-200 hover:border-ggd-orange/50 hover:shadow-orange-500/10'
                  : 'bg-slate-900/90 border-white/10 hover:border-ggd-orange/50 hover:shadow-orange-500/10'
              }`}
            >
              <div className="space-y-3 relative z-10">
                {/* TOOL HEADER */}
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center text-white text-base shadow-md shrink-0 border border-white/20`}>
                    <i className={`fa-solid ${tool.icon}`}></i>
                  </div>
                  {tool.badge && (
                    <span className="px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-orange-500/15 border border-orange-500/30 text-ggd-orange">
                      {tool.badge}
                    </span>
                  )}
                </div>

                {/* TOOL TITLE & DESC */}
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-tight group-hover:text-ggd-orange transition-colors ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    {tool.name}
                  </h3>
                  <p className={`text-xs mt-1 font-medium leading-relaxed ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                    {tool.shortDescription}
                  </p>
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className={`pt-4 mt-4 border-t flex items-center justify-between ${themeMode === 'light' ? 'border-slate-100' : 'border-white/5'}`}>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${themeMode === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                  {tool.category.toUpperCase()}
                </span>
                <button
                  onClick={() => handleLaunchTool(tool)}
                  className="btn-3d btn-3d-orange px-4 py-2.5 min-h-[44px] text-[10.5px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer touch-manipulation"
                >
                  <span>{tool.actionType === 'chat_command' ? 'Invoke in Chat' : 'Launch Feature'}</span>
                  <i className="fa-solid fa-arrow-right text-[10px]"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
