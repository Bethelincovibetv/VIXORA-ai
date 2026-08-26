import React, { useState, useEffect, useRef } from 'react';
import { VOICE_AVATAR_OPTIONS, VoiceOption } from '../constants';
import { playProceduralSFX } from '../sfxLibrary';

export interface VoiceSelectorDropdownProps {
  selectedVoice: string;
  onSelectVoice: (voiceName: string) => void;
  previewingVoiceId: string | null;
  onPreviewVoice: (voiceOption: VoiceOption) => void;
  themeMode?: 'light' | 'dark';
  label?: string;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
}

export const VoiceSelectorDropdown: React.FC<VoiceSelectorDropdownProps> = ({
  selectedVoice,
  onSelectVoice,
  previewingVoiceId,
  onPreviewVoice,
  themeMode = 'dark',
  label = 'Voiceover Accent & Narrator',
  className = '',
  compact = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'Female' | 'Male'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find active voice profile, fallback to first option (Kore)
  const currentVoice = 
    VOICE_AVATAR_OPTIONS.find(v => v.voiceName.toLowerCase() === (selectedVoice || 'kore').toLowerCase()) ||
    VOICE_AVATAR_OPTIONS.find(v => v.id === selectedVoice) ||
    VOICE_AVATAR_OPTIONS[0];

  const isCurrentPreviewing = previewingVoiceId === currentVoice.id;

  // Filter voices by search & gender
  const filteredVoices = VOICE_AVATAR_OPTIONS.filter((v) => {
    const matchesSearch = 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.accent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = genderFilter === 'all' || v.gender === genderFilter;
    return matchesSearch && matchesGender;
  });

  // Handle outside click to dismiss desktop dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Lock body scroll on mobile bottom sheet when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setSearchQuery('');
      setGenderFilter('all');
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      {label && (
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[9.5px] font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
            <i className="fa-solid fa-microphone text-purple-400"></i>
            <span>{label}</span>
          </span>
          <span className={`text-[8.5px] font-bold uppercase tracking-wider ${themeMode === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
            {currentVoice.gender} • {currentVoice.accent.split('(')[0].trim()}
          </span>
        </div>
      )}

      {/* TRIGGER BUTTON (FULLY MOBILE-RESPONSIVE & TOUCH-OPTIMIZED) */}
      <div className="flex items-center gap-2 w-full">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setIsOpen(!isOpen);
            playProceduralSFX('click');
          }}
          className={`flex-1 min-w-0 flex items-center justify-between gap-2 p-2 rounded-2xl border transition-all text-left outline-none min-h-[48px] group active:scale-[0.99] ${
            isOpen 
              ? 'ring-2 ring-purple-500/40 border-purple-500 shadow-md' 
              : themeMode === 'light'
                ? 'bg-white border-slate-300 hover:border-purple-500 text-slate-900 shadow-sm'
                : 'bg-slate-900/90 border-white/15 hover:border-purple-400/60 text-white shadow-md'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          title="Click to select voice narrator"
        >
          {/* LEFT: AVATAR & NAME */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="relative shrink-0">
              <img
                src={currentVoice.avatar}
                alt={currentVoice.name}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-purple-500/70 shadow-sm"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white flex items-center justify-center text-[7.5px] text-white font-bold">
                ✓
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate">
                <span className={`text-[11.5px] sm:text-[11px] font-black truncate ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  {currentVoice.name}
                </span>
                {currentVoice.isVixoraVoice && (
                  <span className="shrink-0 px-1.5 py-0.2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[7px] font-black uppercase tracking-wider">
                    Official
                  </span>
                )}
              </div>
              <p className={`text-[9px] sm:text-[8.5px] font-semibold truncate ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                {currentVoice.flag} {currentVoice.accent}
              </p>
            </div>
          </div>

          {/* RIGHT: CHEVRON */}
          <div className={`shrink-0 flex items-center gap-1 pl-1 transition-colors ${
            themeMode === 'light' ? 'text-slate-500 group-hover:text-purple-600' : 'text-slate-400 group-hover:text-purple-400'
          }`}>
            <i className={`fa-solid fa-chevron-down text-[11px] transition-transform duration-200 ${isOpen ? 'rotate-180 text-purple-500' : ''}`}></i>
          </div>
        </button>

        {/* QUICK PREVIEW BUTTON FOR CURRENT VOICE */}
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onPreviewVoice(currentVoice);
          }}
          className={`shrink-0 px-3 py-2 min-w-[48px] h-[48px] rounded-2xl border text-[9.5px] sm:text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer ${
            isCurrentPreviewing
              ? 'bg-purple-600 border-purple-500 text-white animate-pulse shadow-purple-500/25 ring-2 ring-purple-400/40'
              : themeMode === 'light'
                ? 'bg-purple-50 hover:bg-purple-100 border-purple-300 text-purple-800 hover:border-purple-500'
                : 'bg-purple-950/40 hover:bg-purple-900/60 border-purple-500/40 text-purple-300 hover:border-purple-400'
          }`}
          title={isCurrentPreviewing ? 'Stop voice sample' : 'Play voice sample'}
        >
          {isCurrentPreviewing ? (
            <>
              <div className="flex items-center gap-0.5 h-3">
                <span className="w-0.5 h-3 bg-white animate-pulse"></span>
                <span className="w-0.5 h-2 bg-white animate-bounce"></span>
                <span className="w-0.5 h-3.5 bg-white animate-pulse"></span>
              </div>
              <span className="hidden xs:inline sm:inline">Playing</span>
            </>
          ) : (
            <>
              <i className="fa-solid fa-volume-high text-xs"></i>
              <span className="hidden xs:inline sm:inline">Preview</span>
            </>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 📱 MOBILE BOTTOM SHEET MODAL (FOR PHONES & NARROW SCREENS < 640px)        */}
      {/* ========================================================================= */}
      {isOpen && (
        <div className="sm:hidden fixed inset-0 z-[999] flex flex-col justify-end bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          {/* BACKDROP TAP TO DISMISS */}
          <div className="flex-1 w-full" onClick={() => setIsOpen(false)}></div>

          {/* BOTTOM SHEET CONTAINER */}
          <div 
            className={`w-full max-h-[85vh] rounded-t-3xl border-t shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 pb-safe ${
              themeMode === 'light'
                ? 'bg-white border-slate-200 text-slate-900 shadow-slate-900/30'
                : 'bg-slate-950 border-white/15 text-white shadow-black'
            }`}
          >
            {/* DRAG HANDLE & HEADER */}
            <div className={`p-4 pb-3 border-b shrink-0 ${themeMode === 'light' ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-slate-900/50'}`}>
              <div className={`w-12 h-1.5 rounded-full mx-auto mb-3 ${themeMode === 'light' ? 'bg-slate-300' : 'bg-white/20'}`}></div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-user-astronaut"></i>
                  </div>
                  <div>
                    <h3 className={`text-xs font-black uppercase tracking-wider ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                      Select Voice Narrator
                    </h3>
                    <p className="text-[9px] font-bold text-purple-600 dark:text-purple-400">
                      {VOICE_AVATAR_OPTIONS.length} AI Voices • Tap avatar to select
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all cursor-pointer ${
                    themeMode === 'light'
                      ? 'bg-slate-200 hover:bg-rose-500 hover:text-white text-slate-700'
                      : 'bg-white/10 hover:bg-rose-500 hover:text-white text-slate-300'
                  }`}
                  aria-label="Close"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* SEARCH & GENDER FILTER TABS */}
              <div className="mt-3 space-y-2">
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search narrator, accent, or style..."
                    className={`w-full py-2 pl-8 pr-3 rounded-xl border text-[11px] font-medium outline-none transition-all ${
                      themeMode === 'light'
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-purple-500'
                        : 'bg-white/5 border-white/10 text-white focus:border-purple-500 focus:bg-white/10'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-purple-500"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>

                {/* GENDER CHIPS */}
                <div className="flex gap-1.5">
                  {(['all', 'Female', 'Male'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setGenderFilter(g);
                        playProceduralSFX('click');
                      }}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer ${
                        genderFilter === g
                          ? 'bg-purple-600 text-white shadow-sm'
                          : themeMode === 'light'
                            ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {g === 'all' ? 'All Voices' : `${g}s`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SCROLLABLE VOICE LIST (TOUCH-OPTIMIZED) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[50vh]">
              {filteredVoices.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-1">
                  <i className="fa-solid fa-microphone-slash text-2xl text-slate-500"></i>
                  <p className="text-xs font-bold">No voices match your search</p>
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setGenderFilter('all'); }}
                    className="text-[10px] text-purple-600 dark:text-purple-400 font-extrabold underline mt-1"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                filteredVoices.map((option) => {
                  const isSelected = 
                    option.voiceName.toLowerCase() === (selectedVoice || 'kore').toLowerCase() || 
                    option.id.toLowerCase() === (selectedVoice || '').toLowerCase() ||
                    option.name.toLowerCase() === (selectedVoice || '').toLowerCase();
                  const isOptionPreviewing = previewingVoiceId === option.id;

                  return (
                    <div
                      key={option.id}
                      onClick={() => {
                        onSelectVoice(option.voiceName);
                        playProceduralSFX('click');
                        setIsOpen(false);
                      }}
                      className={`p-2.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.98] min-h-[56px] ${
                        isSelected
                          ? themeMode === 'light'
                            ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-400/40 shadow-sm'
                            : 'bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/40 shadow-md'
                          : themeMode === 'light'
                            ? 'bg-slate-50 hover:bg-purple-50/60 border-slate-200'
                            : 'bg-white/5 hover:bg-white/10 border-white/10'
                      }`}
                    >
                      {/* AVATAR & INFO */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <img
                            src={option.avatar}
                            alt={option.name}
                            className={`w-11 h-11 rounded-full object-cover border-2 shadow-sm ${
                              isSelected ? 'border-purple-500 ring-2 ring-purple-400/40' : 'border-slate-300 dark:border-white/30'
                            }`}
                          />
                          <span className="absolute -bottom-1 -right-1 text-xs">
                            {option.flag || '🎙️'}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-xs font-black truncate ${isSelected ? 'text-purple-600' : themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                              {option.name}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded-md text-[7.5px] font-black uppercase ${
                              option.gender === 'Female'
                                ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400 border border-pink-500/30'
                                : 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                            }`}>
                              {option.gender}
                            </span>
                            {option.isVixoraVoice && (
                              <span className="px-1.5 py-0.2 rounded-md bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[7px] font-black uppercase">
                                Signature
                              </span>
                            )}
                          </div>
                          <p className={`text-[9.5px] font-medium mt-0.5 truncate ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                            {option.description}
                          </p>
                        </div>
                      </div>

                      {/* ACTIONS: PREVIEW & SELECTION CHECK */}
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onPreviewVoice(option)}
                          className={`min-w-[44px] min-h-[44px] px-2.5 py-2 rounded-xl border text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer ${
                            isOptionPreviewing
                              ? 'bg-purple-600 border-purple-500 text-white animate-pulse'
                              : themeMode === 'light'
                                ? 'bg-white border-slate-300 text-purple-700 hover:bg-purple-100'
                                : 'bg-slate-900 border-white/15 text-purple-300 hover:bg-purple-900/40'
                          }`}
                          title={isOptionPreviewing ? "Stop audio preview" : "Play audio preview"}
                        >
                          {isOptionPreviewing ? (
                            <div className="flex items-center gap-0.5 h-3">
                              <span className="w-0.5 h-3 bg-white animate-pulse"></span>
                              <span className="w-0.5 h-2 bg-white animate-bounce"></span>
                              <span className="w-0.5 h-3.5 bg-white animate-pulse"></span>
                            </div>
                          ) : (
                            <i className="fa-solid fa-volume-high text-xs"></i>
                          )}
                        </button>

                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs shadow-md shrink-0">
                            <i className="fa-solid fa-check"></i>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* CONFIRM / DONE BUTTON */}
            <div className={`p-3 border-t shrink-0 ${themeMode === 'light' ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-slate-900/50'}`}>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  playProceduralSFX('sparkle');
                }}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
              >
                <i className="fa-solid fa-check"></i>
                <span>Use {currentVoice.name} Narrator</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 💻 DESKTOP FLOATING POPOVER (FOR SCREENS >= 640px)                         */}
      {/* ========================================================================= */}
      {isOpen && (
        <div
          className={`hidden sm:block absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border shadow-2xl p-2.5 space-y-2 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl ${
            themeMode === 'light'
              ? 'bg-white border-slate-200 text-slate-900 shadow-slate-900/15'
              : 'bg-slate-900/98 border-white/20 text-white shadow-black/80'
          }`}
          role="listbox"
        >
          {/* POPOVER HEADER */}
          <div className={`flex items-center justify-between pb-2 border-b px-1 ${themeMode === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <i className="fa-solid fa-user-astronaut"></i> Choose Voice Narrator
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[8px] font-extrabold">
                {VOICE_AVATAR_OPTIONS.length} AI Voices
              </span>
            </div>
            <span className={`text-[8px] font-bold ${themeMode === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              Click avatar to select • 🔊 to test
            </span>
          </div>

          {/* QUICK SEARCH */}
          <div className="relative px-0.5">
            <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by voice name or accent..."
              className={`w-full py-1.5 pl-7 pr-3 rounded-xl border text-[10px] font-medium outline-none transition-all ${
                themeMode === 'light'
                  ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-purple-500 focus:bg-white'
                  : 'bg-white/5 border-white/10 text-white focus:border-purple-500 focus:bg-white/10'
              }`}
            />
          </div>

          {/* VOICE OPTIONS LIST */}
          <div className="max-h-[290px] overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
            {filteredVoices.map((option) => {
              const isSelected = 
                option.voiceName.toLowerCase() === (selectedVoice || 'kore').toLowerCase() || 
                option.id.toLowerCase() === (selectedVoice || '').toLowerCase() ||
                option.name.toLowerCase() === (selectedVoice || '').toLowerCase();
              const isOptionPreviewing = previewingVoiceId === option.id;

              return (
                <div
                  key={option.id}
                  onClick={() => {
                    onSelectVoice(option.voiceName);
                    playProceduralSFX('click');
                    setIsOpen(false);
                  }}
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                    isSelected
                      ? themeMode === 'light'
                        ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-400 shadow-sm'
                        : 'bg-purple-950/40 border-purple-500/80 ring-1 ring-purple-500/50 shadow-md'
                      : themeMode === 'light'
                        ? 'bg-slate-50 hover:bg-purple-50/60 border-slate-200 hover:border-purple-300'
                        : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/20'
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  {/* AVATAR & METADATA */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <img
                        src={option.avatar}
                        alt={option.name}
                        className={`w-9 h-9 rounded-full object-cover border-2 shadow-sm transition-transform ${
                          isSelected
                            ? 'border-purple-500 scale-105 ring-2 ring-purple-400/40'
                            : 'border-slate-300 dark:border-white/20'
                        }`}
                      />
                      <span className="absolute -bottom-1 -right-1 text-xs">
                        {option.flag || '🎙️'}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[11px] font-black truncate ${isSelected ? 'text-purple-600' : themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                          {option.name}
                        </span>

                        <span className={`px-1.5 py-0.2 rounded-md text-[7.5px] font-black uppercase ${
                          option.gender === 'Female'
                            ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400 border border-pink-500/30'
                            : 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                        }`}>
                          {option.gender}
                        </span>

                        {option.isVixoraVoice && (
                          <span className="px-1.5 py-0.2 rounded-md bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[7px] font-black uppercase">
                            Official
                          </span>
                        )}
                      </div>

                      <p className={`text-[9px] font-medium mt-0.5 line-clamp-1 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                        {option.description}
                      </p>
                    </div>
                  </div>

                  {/* PREVIEW SAMPLE AUDIO BUTTON & CHECKMARK */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onPreviewVoice(option)}
                      className={`px-2.5 py-1.5 rounded-xl border text-[8.5px] font-black uppercase flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer ${
                        isOptionPreviewing
                          ? 'bg-purple-600 border-purple-500 text-white animate-pulse'
                          : themeMode === 'light'
                            ? 'bg-white hover:bg-purple-100 border-slate-300 text-slate-700 hover:text-purple-700 hover:border-purple-300'
                            : 'bg-slate-800 hover:bg-purple-900/60 border-white/10 text-slate-300 hover:text-white hover:border-purple-400/40'
                      }`}
                      title={isOptionPreviewing ? "Stop audio preview" : "Listen to audio preview"}
                    >
                      {isOptionPreviewing ? (
                        <>
                          <div className="flex items-center gap-0.5 h-2.5">
                            <span className="w-0.5 h-2.5 bg-white animate-pulse"></span>
                            <span className="w-0.5 h-1.5 bg-white animate-bounce"></span>
                            <span className="w-0.5 h-3 bg-white animate-pulse"></span>
                          </div>
                          <span>Playing</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-play text-[8px]"></i>
                          <span>Preview</span>
                        </>
                      )}
                    </button>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[9px] shadow-sm shrink-0">
                        <i className="fa-solid fa-check"></i>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* FOOTER NOTICE */}
          <div className={`pt-1 text-center border-t ${themeMode === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
            <span className={`text-[8px] font-bold ${themeMode === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              ⚡ Powered by Google AI Voice Engine with High-Fidelity Audio Synthesis
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
