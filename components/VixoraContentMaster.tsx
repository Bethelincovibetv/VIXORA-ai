import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ContentRoadmap, RoadmapItem, VideoTemplate } from '../types';
import { 
  syncFirebaseSaveRoadmap, 
  syncFirebaseFetchRoadmaps, 
  syncFirebaseSaveTemplate, 
  syncFirebaseFetchTemplates 
} from '../services/firebaseService';
import vixoraAgentAvatar from '../src/assets/images/vixora_agent_avatar_1786108775324.jpg';

interface VixoraContentMasterProps {
  themeMode?: 'light' | 'dark';
  onUseTemplateInStudio?: (template: VideoTemplate) => void;
  onGenerateScriptForStudio?: (script: string, topic: string) => void;
}

interface CoachMessage {
  id: string;
  sender: 'sister_vixora' | 'user';
  text: string;
  timestamp: string;
  roadmap?: ContentRoadmap;
  generatedTemplate?: VideoTemplate;
}

export const VixoraContentMaster: React.FC<VixoraContentMasterProps> = ({
  themeMode = 'dark',
  onUseTemplateInStudio,
  onGenerateScriptForStudio
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'roadmaps' | 'templates'>('chat');
  const [niche, setNiche] = useState<string>('Faith & Purpose');
  const [goal, setGoal] = useState<string>('Grow an impactful viral audience & monetize with divine purpose');
  
  const [messages, setMessages] = useState<CoachMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'sister_vixora',
      text: "God bless you my dear creator! I am Sister Vixora — your AI Content Master & Divine Purpose Coach. I am here to help you discern your God-given calling, build viral content roadmaps for Facebook, WhatsApp & TikTok, craft video templates, and monetize your gifts with complete integrity. Tell me about your niche, or ask me for a customized 4-week viral strategy!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [inputQuery, setInputQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [voiceEnergy, setVoiceEnergy] = useState<'high' | 'gentle'>('high');

  // Firebase persisted collections
  const [savedRoadmaps, setSavedRoadmaps] = useState<ContentRoadmap[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<VideoTemplate[]>([]);
  const [isFetchingData, setIsFetchingData] = useState<boolean>(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Load Firestore saved items
  useEffect(() => {
    const loadFirebaseData = async () => {
      setIsFetchingData(true);
      try {
        const [roadmaps, templates] = await Promise.all([
          syncFirebaseFetchRoadmaps(),
          syncFirebaseFetchTemplates()
        ]);
        setSavedRoadmaps(roadmaps);
        setSavedTemplates(templates);
      } catch (err) {
        console.warn("Failed loading Sister Vixora Firebase records:", err);
      } finally {
        setIsFetchingData(false);
      }
    };
    loadFirebaseData();
  }, []);

  // Voice Synthesis (Soft energetic Nigerian lady voice simulation using Web Speech API)
  const speakVoiceResponse = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel(); // Stop any active speech

    // Clean markdown tags for natural speech
    const cleanText = text
      .replace(/[*#_`]/g, '')
      .replace(/\[.*?\]/g, '')
      .substring(0, 450); // Read first paragraph warmly

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Attempt to locate African/Nigerian or female English voices
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.includes('en-NG') || 
      v.name.includes('Nigeria') || 
      v.name.includes('Female') || 
      v.name.includes('Zira') || 
      v.name.includes('Google US English') ||
      v.lang.includes('en-GB')
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.pitch = voiceEnergy === 'high' ? 1.25 : 1.05;
    utterance.rate = voiceEnergy === 'high' ? 1.08 : 0.95;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopVoice = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Main Gemini Coach Engine
  const handleSendMessage = async (customPrompt?: string) => {
    const promptToUse = customPrompt || inputQuery;
    if (!promptToUse.trim() || isLoading) return;

    const userMsgId = 'usr_' + Date.now();
    const userMsg: CoachMessage = {
      id: userMsgId,
      sender: 'user',
      text: promptToUse,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setInputQuery('');
    setIsLoading(true);

    try {
      const activeApiKey = (window as any).__GEMINI_API_KEY__ || process.env.GEMINI_API_KEY || '';
      
      const systemInstruction = `You are "Sister Vixora Content Master", an elite AI Content Coach and Faith-Aligned Media Strategist.
Your persona is a warm, highly intelligent, articulate Nigerian sister with immense warmth, spiritual wisdom, and deep social media mastery (like a ChatGPT voice agent with Nigerian warmth).

CORE DIRECTIVES:
1. Speak with warmth, clarity, and authority ("My dear creator", "God bless your talent", "Let us align your niche with God's purpose").
2. ALWAYS provide actionable, high-converting content advice for Facebook, WhatsApp status, TikTok, Instagram, and YouTube.
3. FORMATTING RULE: NEVER use asterisks (* or **) anywhere in your response. Do not use markdown bold or italic syntax with asterisks. Write in clean plain text with standard line breaks or bullets (•) without asterisks.
4. If the user asks for a content roadmap or strategy, structure a 4-item or 4-week roadmap with clear hooks and call-to-actions.
5. If the user asks to create a video template, generate JSON format inside your response containing:
   [TEMPLATE_JSON]
   {
     "title": "Title",
     "description": "Desc",
     "niche": "Niche",
     "aspectRatio": "vertical",
     "targetDuration": "30s",
     "captionTemplate": "bold-yellow",
     "sfxEnabled": true,
     "scriptStyle": "Engaging Hook -> Faith Insight -> Call to Action"
   }
   [/TEMPLATE_JSON]
6. Always remind creators to align their monetization with biblical truth, honesty, and high-value service.`;

      const ai = new GoogleGenAI({
        apiKey: activeApiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const prompt = `User Niche: ${niche}\nUser Goal: ${goal}\nUser Message: ${promptToUse}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7
        }
      });

      const responseText = response.text || "Praise God my dear creator! I am reviewing your request. How else can I guide your viral content journey today?";

      // Check for embedded Template JSON
      let generatedTemplate: VideoTemplate | undefined = undefined;
      if (responseText.includes('[TEMPLATE_JSON]')) {
        try {
          const jsonMatch = responseText.match(/\[TEMPLATE_JSON\]([\s\S]*?)\[\/TEMPLATE_JSON\]/);
          if (jsonMatch && jsonMatch[1]) {
            const raw = JSON.parse(jsonMatch[1].trim());
            generatedTemplate = {
              id: 'tpl_' + Date.now(),
              title: raw.title || 'Sister Vixora AI Template',
              description: raw.description || 'Custom generated video template by Sister Vixora',
              niche: raw.niche || niche,
              aspectRatio: raw.aspectRatio || 'vertical',
              targetDuration: raw.targetDuration || '30s',
              captionTemplate: raw.captionTemplate || 'bold-yellow',
              sfxEnabled: raw.sfxEnabled ?? true,
              scriptStyle: raw.scriptStyle || 'Inspiring',
              createdAt: new Date().toISOString()
            };
            // Automatically save to Firebase
            await syncFirebaseSaveTemplate(generatedTemplate);
            setSavedTemplates(prev => [generatedTemplate!, ...prev]);
          }
        } catch (e) {
          console.warn("Template JSON parse error:", e);
        }
      }

      const coachMsg: CoachMessage = {
        id: 'vx_' + Date.now(),
        sender: 'sister_vixora',
        text: responseText
          .replace(/\[TEMPLATE_JSON\][\s\S]*?\[\/TEMPLATE_JSON\]/g, '')
          .replace(/\*/g, '')
          .trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        generatedTemplate
      };

      setMessages(prev => [...prev, coachMsg]);
      speakVoiceResponse(coachMsg.text);

    } catch (err) {
      console.error("Sister Vixora AI Coach error:", err);
      const errMsg: CoachMessage = {
        id: 'err_' + Date.now(),
        sender: 'sister_vixora',
        text: "My dear creator, I experienced a minor network flicker. Please try asking me again, and we shall build your viral strategy together!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Action Handler to Generate Structured Roadmap
  const handleGenerateRoadmap = async () => {
    setIsLoading(true);
    try {
      const activeApiKey = (window as any).__GEMINI_API_KEY__ || process.env.GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({
        apiKey: activeApiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const prompt = `Create a 4-week Viral Content Roadmap for the niche "${niche}" with goal "${goal}".
Return strictly valid JSON in this exact format:
{
  "title": "4-Week ${niche} Viral Content Mastery",
  "niche": "${niche}",
  "platform": "Multi-Platform (WhatsApp, Facebook, TikTok)",
  "goal": "${goal}",
  "faithAlignment": "Honoring God with truthful, uplifting, and high-value content",
  "roadmapItems": [
    {
      "week": "Week 1",
      "topic": "The High-Impact Origin Hook",
      "hook": "Why 90% of creators in ${niche} fail to reach their true audience...",
      "platform": "TikTok & Facebook Reels",
      "monetizationAngle": "Build trust and introduce free community link"
    },
    {
      "week": "Week 2",
      "topic": "Debunking Common Myths",
      "hook": "Stop doing this if you want divine breakthrough in ${niche}!",
      "platform": "WhatsApp Status & Instagram Stories",
      "monetizationAngle": "Direct 1-on-1 WhatsApp consultations"
    },
    {
      "week": "Week 3",
      "topic": "Transformational Testimony & Value Breakdown",
      "hook": "Here is the exact framework God gave me to master ${niche}...",
      "platform": "YouTube Shorts & Facebook Page",
      "monetizationAngle": "Digital downloadable guide / masterclass"
    },
    {
      "week": "Week 4",
      "topic": "Community Call to Action & Scaling",
      "hook": "Ready to take your ${niche} journey to the next level?",
      "platform": "WhatsApp Broadcast & All Channels",
      "monetizationAngle": "Premium inner circle membership"
    }
  ]
}`;

      const res = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt
      });

      const rawText = res.text || '{}';
      const cleanJson = rawText.substring(rawText.indexOf('{'), rawText.lastIndexOf('}') + 1);
      const parsed = JSON.parse(cleanJson);

      const newRoadmap: ContentRoadmap = {
        id: 'rdmp_' + Date.now(),
        title: parsed.title || `4-Week ${niche} Roadmap`,
        niche: parsed.niche || niche,
        platform: parsed.platform || 'Multi-Platform',
        goal: parsed.goal || goal,
        faithAlignment: parsed.faithAlignment || 'Faith & Integrity First',
        roadmapItems: parsed.roadmapItems || [],
        createdAt: new Date().toISOString()
      };

      // Save to Firebase
      await syncFirebaseSaveRoadmap(newRoadmap);
      setSavedRoadmaps(prev => [newRoadmap, ...prev]);

      const coachMsg: CoachMessage = {
        id: 'vx_rdmp_' + Date.now(),
        sender: 'sister_vixora',
        text: `Hallelujah! I have generated your personalized 4-Week Content Roadmap for "${niche}". It has been saved securely to Firebase for you. Take a look at your roadmap below!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        roadmap: newRoadmap
      };

      setMessages(prev => [...prev, coachMsg]);
      speakVoiceResponse("Praise God! I have generated your customized 4-Week Content Roadmap and saved it to your account.");

    } catch (err) {
      console.error("Roadmap generation error:", err);
      handleSendMessage("Generate a 4-week content roadmap for my niche");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`p-5 border rounded-3xl space-y-5 text-left relative overflow-hidden shadow-2xl ${themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900/90 border-white/10 text-white'}`} id="vixora-content-master">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src={vixoraAgentAvatar} 
              alt="Sister Vixora" 
              className="w-12 h-12 rounded-2xl border-2 border-ggd-orange object-cover shadow-lg"
            />
            {isSpeaking && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border border-white text-[7px] text-white font-bold items-center justify-center">
                  <i className="fa-solid fa-volume-high"></i>
                </span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-base font-black uppercase tracking-tight ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Sister Vixora
              </h2>
              <span className="px-2 py-0.5 bg-ggd-orange/20 text-ggd-orange border border-ggd-orange/30 text-[8px] font-black uppercase rounded-lg tracking-wider">
                Content Master & Purpose Coach
              </span>
            </div>
            <p className={`text-[10px] font-bold uppercase mt-0.5 flex items-center gap-1 ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
              <i className="fa-solid fa-cross text-amber-500"></i> Faith-Aligned Viral Strategy • Energetic Lady Voice
            </p>
          </div>
        </div>

        {/* Top Controls & Audio Energy Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoiceEnergy(voiceEnergy === 'high' ? 'gentle' : 'high')}
            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-all flex items-center gap-1.5 ${
              voiceEnergy === 'high' 
                ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
            }`}
            title="Toggle between High Energy Nigerian Lady cadence & Gentle Cadence"
          >
            <i className="fa-solid fa-bolt"></i>
            Voice: {voiceEnergy === 'high' ? 'High Energy ⚡' : 'Gentle 🕊️'}
          </button>

          {isSpeaking ? (
            <button
              onClick={stopVoice}
              className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-black uppercase rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center gap-1"
            >
              <i className="fa-solid fa-volume-xmark"></i> Mute Voice
            </button>
          ) : (
            <button
              onClick={() => speakVoiceResponse("God bless you my dear creator! Sister Vixora is ready to guide your content journey!")}
              className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[9px] font-black uppercase rounded-xl hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1"
            >
              <i className="fa-solid fa-volume-high"></i> Test Voice
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between gap-2 bg-slate-100 dark:bg-black/40 p-1 rounded-2xl border border-slate-200 dark:border-white/5">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'chat' 
              ? 'bg-ggd-orange text-white shadow-md' 
              : themeMode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-comments"></i>
          <span>Live Coach Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('roadmaps')}
          className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'roadmaps' 
              ? 'bg-ggd-orange text-white shadow-md' 
              : themeMode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-map-location-dot"></i>
          <span>Content Roadmaps ({savedRoadmaps.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'templates' 
              ? 'bg-ggd-orange text-white shadow-md' 
              : themeMode === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-clapperboard"></i>
          <span>Saved Video Templates ({savedTemplates.length})</span>
        </button>
      </div>

      {/* TAB 1: LIVE COACH CHAT */}
      {activeTab === 'chat' && (
        <div className="space-y-4">
          {/* Quick Setup Bar */}
          <div className={`p-3 rounded-2xl border grid grid-cols-1 md:grid-cols-2 gap-3 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Your Creator Niche</label>
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className={`w-full p-2 rounded-xl border text-xs font-semibold focus:outline-none focus:border-ggd-orange ${
                  themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-800 border-white/10 text-white'
                }`}
              >
                <option value="Faith & Purpose">Faith & Purpose (Christian Content)</option>
                <option value="Business & Wealth">Business, Tech & Finance</option>
                <option value="Lifestyle & Vlog">Lifestyle, Relationship & Family</option>
                <option value="Education & AI">Education, AI & Career Growth</option>
                <option value="Health & Fitness">Health, Wellness & Mindset</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Primary Growth Goal</label>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Monetize WhatsApp group and grow 10k TikTok followers"
                className={`w-full p-2 rounded-xl border text-xs font-semibold focus:outline-none focus:border-ggd-orange ${
                  themeMode === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'
                }`}
              />
            </div>
          </div>

          {/* Quick AI Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleGenerateRoadmap}
              disabled={isLoading}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-ggd-orange text-white text-[9px] font-black uppercase rounded-xl shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              Generate 4-Week Roadmap
            </button>

            <button
              onClick={() => handleSendMessage(`Create a viral video template for my ${niche} niche with hook ideas`)}
              disabled={isLoading}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1.5"
            >
              <i className="fa-solid fa-clapperboard"></i>
              Generate Video Template
            </button>

            <button
              onClick={() => handleSendMessage(`How do I monetize my ${niche} content while staying aligned with God's purpose?`)}
              disabled={isLoading}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1.5"
            >
              <i className="fa-solid fa-coins"></i>
              Monetization & Purpose
            </button>
          </div>

          {/* Chat Messages Log */}
          <div className={`p-4 rounded-2xl border space-y-4 max-h-96 overflow-y-auto scrollbar-hide ${
            themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'
          }`}>
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'sister_vixora' && (
                  <img 
                    src={vixoraAgentAvatar} 
                    alt="Sister Vixora" 
                    className="w-8 h-8 rounded-xl border border-ggd-orange object-cover shrink-0 mt-0.5"
                  />
                )}

                <div className={`max-w-[85%] space-y-2 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-ggd-orange text-white border-ggd-orange rounded-tr-none'
                      : themeMode === 'light'
                        ? 'bg-white border-slate-200 text-slate-900 shadow-sm rounded-tl-none'
                        : 'bg-slate-900 border-white/10 text-slate-100 rounded-tl-none'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.text.replace(/\*/g, '')}</p>
                    <p className={`text-[8px] mt-1 font-mono ${msg.sender === 'user' ? 'text-amber-100' : 'text-slate-400'}`}>
                      {msg.timestamp}
                    </p>
                  </div>

                  {/* Render Embedded Roadmap Card if attached */}
                  {msg.roadmap && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase text-amber-500">{msg.roadmap.title}</h4>
                        <span className="text-[8px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-md">
                          Saved to Firebase
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-300 italic">" {msg.roadmap.faithAlignment} "</p>

                      <div className="space-y-2">
                        {msg.roadmap.roadmapItems.map((item: RoadmapItem, idx: number) => (
                          <div key={idx} className="p-2.5 bg-black/40 rounded-xl border border-white/5 space-y-1">
                            <div className="flex justify-between items-center text-[9px] font-bold text-ggd-orange">
                              <span>{item.week}: {item.topic}</span>
                              <span className="text-slate-400">{item.platform}</span>
                            </div>
                            <p className="text-[9px] text-white font-medium">Hook: "{item.hook}"</p>
                            <p className="text-[8px] text-emerald-400 font-bold">Monetization: {item.monetizationAngle}</p>
                            {onGenerateScriptForStudio && (
                              <button
                                onClick={() => onGenerateScriptForStudio(item.hook, item.topic)}
                                className="mt-1 px-2 py-0.5 bg-ggd-orange/20 text-ggd-orange hover:bg-ggd-orange hover:text-white rounded text-[8px] font-bold uppercase transition-all"
                              >
                                Send Hook to Video Studio 🎬
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Render Generated Template Card if attached */}
                  {msg.generatedTemplate && (
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-left space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-black uppercase text-indigo-400">{msg.generatedTemplate.title}</p>
                        <span className="text-[8px] font-bold text-emerald-400">Saved to Firestore</span>
                      </div>
                      <p className="text-[9px] text-slate-300">{msg.generatedTemplate.description}</p>
                      {onUseTemplateInStudio && (
                        <button
                          onClick={() => onUseTemplateInStudio(msg.generatedTemplate!)}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase shadow-md active:scale-95 transition-all"
                        >
                          Use Template in Video Sequencer Studio 🚀
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 items-center text-slate-400 text-xs italic animate-pulse">
                <img src={vixoraAgentAvatar} alt="Sister Vixora" className="w-6 h-6 rounded-lg object-cover" />
                <span>Sister Vixora is discerning your content strategy...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Controls */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask Sister Vixora anything about content ideas, biblical alignment, or video creation..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className={`flex-1 p-3.5 rounded-2xl border text-xs font-medium focus:outline-none focus:border-ggd-orange ${
                themeMode === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'
              }`}
            />
            <button
              disabled={!inputQuery.trim() || isLoading}
              onClick={() => handleSendMessage()}
              className="px-5 py-3.5 bg-ggd-orange text-white text-xs font-black uppercase rounded-2xl shadow-xl disabled:opacity-50 active:scale-95 transition-all shrink-0 flex items-center gap-1.5"
            >
              <span>Ask Coach</span>
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: SAVED CONTENT ROADMAPS */}
      {activeTab === 'roadmaps' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className={`text-xs font-black uppercase tracking-wider ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
              Your Saved Content Roadmaps ({savedRoadmaps.length})
            </h3>
            <button
              onClick={handleGenerateRoadmap}
              disabled={isLoading}
              className="px-3 py-1.5 bg-ggd-orange text-white text-[9px] font-black uppercase rounded-xl shadow-md active:scale-95 transition-all"
            >
              + Generate New Roadmap
            </button>
          </div>

          {savedRoadmaps.length === 0 ? (
            <div className={`p-8 border rounded-2xl text-center space-y-2 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
              <i className="fa-solid fa-map-location-dot text-3xl text-slate-500"></i>
              <p className="text-xs font-bold text-slate-400">No content roadmaps generated yet.</p>
              <p className="text-[10px] text-slate-500">Click "+ Generate New Roadmap" or ask Sister Vixora in Live Chat!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1 scrollbar-hide">
              {savedRoadmaps.map((rd) => (
                <div key={rd.id} className={`p-4 rounded-2xl border space-y-3 ${
                  themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-black uppercase text-ggd-orange">{rd.title}</h4>
                      <p className="text-[9px] text-slate-400">{rd.niche} • {rd.platform}</p>
                    </div>
                    <span className="text-[8px] font-mono text-slate-500">
                      {new Date(rd.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {rd.roadmapItems?.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-black/30 rounded-xl border border-white/5 space-y-1">
                        <div className="flex justify-between items-center text-[9px] font-bold text-amber-400">
                          <span>{item.week}: {item.topic}</span>
                          <span className="text-slate-400">{item.platform}</span>
                        </div>
                        <p className="text-[9px] text-slate-200">Hook: "{item.hook}"</p>
                        <p className="text-[8px] text-emerald-400 font-bold">Monetization: {item.monetizationAngle}</p>
                        {onGenerateScriptForStudio && (
                          <button
                            onClick={() => onGenerateScriptForStudio(item.hook, item.topic)}
                            className="mt-1 px-2.5 py-1 bg-ggd-orange text-white rounded text-[8px] font-bold uppercase active:scale-95 transition-all"
                          >
                            Send to Video Studio 🎬
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SAVED VIDEO TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className={`text-xs font-black uppercase tracking-wider ${themeMode === 'light' ? 'text-slate-900' : 'text-white'}`}>
              Your Saved Video Templates ({savedTemplates.length})
            </h3>
          </div>

          {savedTemplates.length === 0 ? (
            <div className={`p-8 border rounded-2xl text-center space-y-2 ${themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}>
              <i className="fa-solid fa-clapperboard text-3xl text-slate-500"></i>
              <p className="text-xs font-bold text-slate-400">No video templates saved yet.</p>
              <p className="text-[10px] text-slate-500">Save templates from CapCut Render Studio or ask Sister Vixora to design one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1 scrollbar-hide">
              {savedTemplates.map((tpl) => (
                <div key={tpl.id} className={`p-4 rounded-2xl border space-y-2 flex flex-col justify-between ${
                  themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'
                }`}>
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-black uppercase text-indigo-400">{tpl.title}</h4>
                      <span className="text-[8px] font-bold px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-md">
                        {tpl.aspectRatio}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">{tpl.description}</p>
                    <div className="mt-2 text-[8px] space-y-0.5 text-slate-500 font-mono">
                      <p>Target Duration: {tpl.targetDuration}</p>
                      <p>Caption Style: {tpl.captionTemplate}</p>
                      <p>SFX Enabled: {tpl.sfxEnabled ? 'Yes' : 'No'}</p>
                    </div>
                  </div>

                  {onUseTemplateInStudio && (
                    <button
                      onClick={() => onUseTemplateInStudio(tpl)}
                      className="w-full py-2 bg-ggd-orange text-white rounded-xl text-[9px] font-black uppercase shadow-md active:scale-95 transition-all mt-3"
                    >
                      Apply Template in Studio 🚀
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
