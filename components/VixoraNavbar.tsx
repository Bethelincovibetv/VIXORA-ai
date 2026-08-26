import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

export interface VixoraNavbarProps {
  themeMode: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenAccessibility: () => void;
  onOpenProjects: () => void;
  onOpenGlobalApi: () => void;
  onOpenExportModal: () => void;
  projectCount: number;
  activeProjectTitle?: string;
  isLiveActive?: boolean;
}

export const MAIN_NAV_ITEMS = [
  { path: '/studio', label: 'Studio', icon: 'fa-microphone-lines', badge: 'Live AI', color: 'from-amber-500 to-orange-500' },
  { path: '/videos', label: 'Video Creator', icon: 'fa-film', badge: 'HD Sourcing', color: 'from-orange-500 to-red-500' },
  { path: '/scripts', label: 'AI Scripts', icon: 'fa-scroll', badge: 'Viral SEO', color: 'from-purple-500 to-indigo-500' },
  { path: '/autopilot', label: 'Autopilot', icon: 'fa-wand-magic-sparkles', badge: '1-Click', color: 'from-rose-500 to-pink-600' },
  { path: '/voiceover', label: 'Voiceover', icon: 'fa-waveform-lines', badge: 'TTS HD', color: 'from-cyan-500 to-teal-500' },
  { path: '/bgmusic', label: 'Music HQ', icon: 'fa-music', badge: 'Tracks', color: 'from-amber-400 to-yellow-500' },
  { path: '/growth', label: 'Growth SEO', icon: 'fa-bolt-lightning', badge: 'Tags & Hooks', color: 'from-emerald-500 to-teal-600' },
  { path: '/tools', label: 'All Tools', icon: 'fa-shapes', badge: '12+ Tools', color: 'from-blue-500 to-indigo-600' },
  { path: '/developer', label: 'Dev API', icon: 'fa-code', badge: 'v1 REST', color: 'from-violet-500 to-purple-600' },
  { path: '/profile', label: 'Profile', icon: 'fa-user-gear', badge: 'Settings', color: 'from-slate-500 to-slate-700' },
  { path: '/contact', label: 'Contact', icon: 'fa-headset', badge: 'Support', color: 'from-green-500 to-emerald-600' },
  { path: '/coach', label: 'Coach', icon: 'fa-cross', badge: 'Mentorship', color: 'from-amber-600 to-orange-700' },
];

export const VixoraNavbar: React.FC<VixoraNavbarProps> = ({
  themeMode,
  onToggleTheme,
  onOpenAccessibility,
  onOpenProjects,
  onOpenGlobalApi,
  onOpenExportModal,
  projectCount,
  activeProjectTitle,
  isLiveActive = false,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Normalize current path
  const currentPath = location.pathname.toLowerCase().replace(/\/$/, '') || '/studio';

  const isCurrentActive = (path: string) => {
    if (path === '/studio' && (currentPath === '/' || currentPath === '/studio')) return true;
    if (path === '/videos' && (currentPath === '/videos' || currentPath === '/creator' || currentPath === '/video-creator')) return true;
    if (path === '/scripts' && (currentPath === '/scripts' || currentPath === '/script-writer' || currentPath === '/script')) return true;
    if (path === '/autopilot' && (currentPath === '/autopilot' || currentPath === '/video-autopilot')) return true;
    if (path === '/voiceover' && (currentPath === '/voiceover' || currentPath === '/voice' || currentPath === '/tts')) return true;
    if (path === '/bgmusic' && (currentPath === '/bgmusic' || currentPath === '/music' || currentPath === '/soundtracks')) return true;
    if (path === '/growth' && (currentPath === '/growth' || currentPath === '/more' || currentPath === '/seo')) return true;
    if (path === '/tools' && (currentPath === '/tools' || currentPath === '/features')) return true;
    if (path === '/developer' && (currentPath === '/developer' || currentPath === '/api' || currentPath === '/docs')) return true;
    if (path === '/profile' && (currentPath === '/profile' || currentPath === '/settings')) return true;
    if (path === '/contact' && (currentPath === '/contact' || currentPath === '/support')) return true;
    if (path === '/coach' && (currentPath === '/coach' || currentPath === '/mentorship')) return true;
    return currentPath === path;
  };

  const activeItem = MAIN_NAV_ITEMS.find(item => isCurrentActive(item.path)) || MAIN_NAV_ITEMS[0];

  return (
    <header className="w-full mb-6 z-40 sticky top-2">
      {/* TOP HEADER GLASS CONTAINER */}
      <div className={`w-full rounded-2xl border backdrop-blur-xl transition-all shadow-xl p-2.5 sm:p-3 ${
        themeMode === 'light' 
          ? 'bg-white/90 border-slate-200/90 shadow-slate-200/50 text-slate-900' 
          : 'bg-slate-900/85 border-white/10 shadow-black/40 text-white'
      }`}>
        <div className="flex items-center justify-between gap-2">
          {/* BRAND LOGO & ACTIVE SECTION BADGE */}
          <div className="flex items-center gap-2.5 min-w-0">
            <NavLink
              to="/studio"
              className="flex items-center gap-2 group shrink-0 outline-none"
              title="Vixora Studio Home"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-400 p-0.5 shadow-md group-hover:scale-105 transition-transform flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center overflow-hidden">
                  <i className="fa-solid fa-play text-ggd-orange text-sm ml-0.5"></i>
                </div>
              </div>
              <div className="hidden sm:block text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black uppercase tracking-tight text-ggd-orange">Vixora</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">AI</span>
                  {isLiveActive && (
                    <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[7.5px] font-black uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      Live Call
                    </span>
                  )}
                </div>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[120px]">
                  {activeProjectTitle || 'Studio Workspace'}
                </p>
              </div>
            </NavLink>

            {/* CURRENT ROUTE BADGE INDICATOR */}
            <div className="hidden xs:flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-ggd-orange/10 border border-ggd-orange/20 shrink-0">
              <i className={`fa-solid ${activeItem.icon} text-ggd-orange text-xs`}></i>
              <span className="text-[10px] font-black uppercase tracking-tight text-ggd-orange truncate max-w-[90px] sm:max-w-none">
                {activeItem.label}
              </span>
            </div>
          </div>

          {/* RIGHT ACTION BUTTONS */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* PROJECTS DRAWER BUTTON */}
            <button
              onClick={onOpenProjects}
              title="Open Creation Projects"
              className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                themeMode === 'light'
                  ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              <i className="fa-solid fa-folder-open text-amber-400 text-xs"></i>
              <span className="hidden md:inline">Projects</span>
              {projectCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[8px] font-mono font-bold">
                  {projectCount}
                </span>
              )}
            </button>

            {/* DEV API MODAL QUICK ACCESS */}
            <button
              onClick={onOpenGlobalApi}
              title="API Integration & Endpoints"
              className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                themeMode === 'light'
                  ? 'bg-slate-100 border-slate-200 text-purple-600 hover:bg-purple-50'
                  : 'bg-white/5 border-white/10 text-purple-400 hover:bg-purple-500/10'
              }`}
            >
              <i className="fa-solid fa-code text-xs"></i>
            </button>

            {/* EXPORT CODEBASE QUICK ACCESS */}
            <button
              onClick={onOpenExportModal}
              title="Download Complete Production Codebase"
              className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                themeMode === 'light'
                  ? 'bg-slate-100 border-slate-200 text-emerald-600 hover:bg-emerald-50'
                  : 'bg-white/5 border-white/10 text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              <i className="fa-solid fa-download text-xs"></i>
            </button>

            {/* THEME TOGGLE */}
            <button
              onClick={onToggleTheme}
              title={themeMode === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                themeMode === 'light'
                  ? 'bg-slate-100 border-slate-200 text-amber-600 hover:bg-amber-50'
                  : 'bg-white/5 border-white/10 text-amber-300 hover:bg-amber-500/10'
              }`}
            >
              <i className={`fa-solid ${themeMode === 'light' ? 'fa-moon' : 'fa-sun'} text-xs`}></i>
            </button>

            {/* ACCESSIBILITY MODAL TRIGGER */}
            <button
              onClick={onOpenAccessibility}
              title="Accessibility & Display"
              className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                themeMode === 'light'
                  ? 'bg-slate-100 border-slate-200 text-blue-600 hover:bg-blue-50'
                  : 'bg-white/5 border-white/10 text-blue-400 hover:bg-blue-500/10'
              }`}
            >
              <i className="fa-solid fa-universal-access text-xs"></i>
            </button>
          </div>
        </div>

        {/* HORIZONTAL SCROLLABLE URL NAVIGATION BAR */}
        <nav className="mt-2.5 pt-2 border-t border-slate-200/40 dark:border-white/5 flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
          {MAIN_NAV_ITEMS.map((item) => {
            const active = isCurrentActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap transition-all duration-150 shrink-0 border ${
                  active
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-400/60 shadow-md scale-102 font-extrabold'
                    : themeMode === 'light'
                    ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-950'
                    : 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-300 hover:text-white'
                }`}
              >
                <i className={`fa-solid ${item.icon} text-[10px] ${active ? 'text-white' : 'text-ggd-orange'}`}></i>
                <span>{item.label}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* MOBILE BOTTOM FLOATING QUICK-DOCK */}
      <div className="sm:hidden fixed bottom-3 left-3 right-3 z-50">
        <div className={`rounded-2xl border backdrop-blur-2xl shadow-2xl p-1.5 flex items-center justify-around ${
          themeMode === 'light' 
            ? 'bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-400/30' 
            : 'bg-slate-950/95 border-white/15 text-white shadow-black/80'
        }`}>
          {[
            { path: '/studio', label: 'Studio', icon: 'fa-microphone-lines' },
            { path: '/videos', label: 'Videos', icon: 'fa-film' },
            { path: '/scripts', label: 'Scripts', icon: 'fa-scroll' },
            { path: '/autopilot', label: 'Auto', icon: 'fa-wand-magic-sparkles' },
            { path: '/tools', label: 'Tools', icon: 'fa-shapes' },
          ].map((dockItem) => {
            const active = isCurrentActive(dockItem.path);
            return (
              <NavLink
                key={dockItem.path}
                to={dockItem.path}
                className={`flex-1 min-h-[44px] min-w-[48px] flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all touch-manipulation active:scale-95 ${
                  active
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md font-black'
                    : themeMode === 'light'
                    ? 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <i className={`fa-solid ${dockItem.icon} text-sm mb-0.5`}></i>
                <span className="text-[8.5px] font-black uppercase tracking-tight">{dockItem.label}</span>
              </NavLink>
            );
          })}

          {/* MORE MENU DROPDOWN BUTTON */}
          <button
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className={`min-h-[44px] min-w-[48px] flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all touch-manipulation active:scale-95 cursor-pointer ${
              isMoreMenuOpen 
                ? 'bg-ggd-orange text-white shadow-md' 
                : themeMode === 'light' 
                ? 'text-slate-700 hover:text-slate-950 hover:bg-slate-100' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <i className="fa-solid fa-ellipsis text-sm mb-0.5"></i>
            <span className="text-[8.5px] font-black uppercase tracking-tight">More</span>
          </button>
        </div>

        {/* EXPANDED MOBILE QUICK MENU */}
        {isMoreMenuOpen && (
          <div className={`mt-2 p-3 rounded-2xl border shadow-2xl space-y-2 animate-rise ${
            themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/15 text-white'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">All Studio URLs</span>
              <button 
                onClick={() => setIsMoreMenuOpen(false)}
                className="text-xs text-slate-400 hover:text-white p-1"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {MAIN_NAV_ITEMS.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setIsMoreMenuOpen(false);
                  }}
                  className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                    isCurrentActive(item.path)
                      ? 'bg-ggd-orange text-white border-ggd-orange font-bold'
                      : themeMode === 'light'
                      ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <i className={`fa-solid ${item.icon} text-xs text-ggd-orange`}></i>
                  <span className="text-[9px] font-black uppercase tracking-tight truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
