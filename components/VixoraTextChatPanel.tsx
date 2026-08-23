import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { VIXORA_AGENT_TOOLS, VixoraAppContext } from '../services/vixoraAgentTools';
import vixoraAgentAvatar from '../src/assets/images/vixora_agent_avatar_1786108775324.jpg';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'vixora';
  text: string;
  timestamp: string;
  actionBadge?: string;
  imageUrl?: string;
  attachedFile?: { name: string; text?: string };
  isThinking?: boolean;
}

interface VixoraTextChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  appContext: VixoraAppContext;
  apiKey: string;
  themeMode?: 'light' | 'dark';
  isFullTab?: boolean;
  onStartLiveAssistant?: () => void;
  initialPrompt?: string;
}

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: 'msg_welcome',
  sender: 'vixora',
  text: "How far my creator! 👋 I am Vixora, your AI Creator Assistant. You can chat with me or give me direct commands—I can generate videos on autopilot, change narrator voices, switch tabs, update captions, or design promotional flyers for your channel! What are we cooking today?",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

export const VixoraTextChatPanel: React.FC<VixoraTextChatPanelProps> = ({
  isOpen,
  onClose,
  appContext,
  apiKey,
  themeMode = 'dark',
  isFullTab = false,
  onStartLiveAssistant,
  initialPrompt
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('vixora_text_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [DEFAULT_WELCOME_MSG];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; text: string } | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('vixora_text_chat_history', JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  useEffect(() => {
    if (isOpen || isFullTab) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, isFullTab, messages]);

  useEffect(() => {
    if (initialPrompt) {
      setInputQuery(initialPrompt);
    }
  }, [initialPrompt]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputQuery).trim();
    if ((!textToSend && !attachedImage && !attachedFile) || isProcessing) return;

    let fullPromptText = textToSend;
    if (attachedFile) {
      fullPromptText += `\n\n[Attached File Content (${attachedFile.name})]:\n${attachedFile.text.slice(0, 3000)}`;
    }

    const userMsgId = `usr_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend || (attachedImage ? 'Uploaded an image for analysis' : 'Uploaded a file'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      imageUrl: attachedImage || undefined,
      attachedFile: attachedFile ? { name: attachedFile.name } : undefined
    };

    const thinkingMsgId = `think_${Date.now()}`;
    const thinkingMsg: ChatMessage = {
      id: thinkingMsgId,
      sender: 'vixora',
      text: "Vixora is thinking & preparing action...",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isThinking: true
    };

    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setInputQuery('');
    setAttachedImage(null);
    setAttachedFile(null);
    setIsAddMenuOpen(false);
    setIsProcessing(true);

    try {
      const envApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
      let activeKey = apiKey;
      if (!activeKey || activeKey.includes('AIzaSyCBO1PRv5h9aQAB3rWb')) {
        activeKey = envApiKey || activeKey;
      }
      const ai = new GoogleGenAI({ apiKey: activeKey });

      const systemInstruction = `You are 'Vixora' (Visora AI), the highly energetic, vibrant, warm, and brilliant Nigerian AI Creator Assistant & Video Producer! Address the user warmly by name (${appContext.userFullName || 'Creator'}). Your voice and vibe are 100% highly energetic, lively, witty, supportive, creative, and enthusiastic with authentic, warm Nigerian energy (e.g., "No wahala at all!", "Oya let's cook this viral masterpiece!", "I hear you crystal clear!"). Speak dynamically with high energy. No asterisks (*).

YOUR MANDATE:
You can CONTROL the Vixora AI Studio app directly for the user using function calls/tools!
Whenever the user asks you to make a video, switch tabs, change voice, edit script, change caption style, generate a flyer, or learn a skill, CALL THE APPROPRIATE TOOL!

AMBIGUITY RULE:
If the user's request is ambiguous or missing information (e.g. "make it shorter" without specifying if they mean script, clip, or video length, or by how much), DO NOT call a tool blindly! Ask a quick, friendly clarifying question first in chat.

UNSUPPORTED CAPABILITIES RULE:
If the user asks for an action that Vixora AI Studio does not support yet (e.g. "export as 3D Holographic VR file" or "order pizza"), politely explain that the capability is not currently supported, and suggest what you CAN do instead!`;

      // Build conversation history turns for Gemini
      const historyTurns = messages
        .filter(m => !m.isThinking)
        .slice(-10)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }]
        }));

      historyTurns.push({
        role: 'user',
        parts: [{ text: fullPromptText || 'Hello Vixora!' }]
      });

      let responseText = '';
      let actionBadgeText: string | undefined = undefined;
      let generatedImageUrl: string | undefined = undefined;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: historyTurns,
          config: {
            systemInstruction,
            tools: [{
              functionDeclarations: VIXORA_AGENT_TOOLS.map(t => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters
              }))
            }]
          }
        });

        responseText = response.text || '';

        // Handle Function Calls
        if (response.functionCalls && response.functionCalls.length > 0) {
          for (const fc of response.functionCalls) {
            const tool = VIXORA_AGENT_TOOLS.find(t => t.name === fc.name);
            if (tool) {
              const toolResult = await tool.execute(fc.args, appContext);
              actionBadgeText = `⚡ ${toolResult.message}`;
              if (toolResult.data?.imageUrl) {
                generatedImageUrl = toolResult.data.imageUrl;
              }

              try {
                const secondPassTurns = [
                  ...historyTurns,
                  {
                    role: 'model',
                    parts: [{ functionCall: { name: fc.name, args: fc.args } }]
                  },
                  {
                    role: 'user',
                    parts: [{
                      functionResponse: {
                        name: fc.name,
                        response: { result: toolResult.message }
                      }
                    }]
                  }
                ];

                const secondRes = await ai.models.generateContent({
                  model: 'gemini-2.5-flash',
                  contents: secondPassTurns,
                  config: { systemInstruction }
                });

                if (secondRes.text) {
                  responseText = secondRes.text;
                }
              } catch (err) {
                if (!responseText) {
                  responseText = `No wahala! I have executed ${fc.name}: ${toolResult.message}`;
                }
              }
            }
          }
        }
      } catch (firstPassErr) {
        console.warn("First pass chat model call with tools warning:", firstPassErr);
        // Fallback pass without tools functionDeclarations
        try {
          const fallbackRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: historyTurns,
            config: { systemInstruction }
          });
          responseText = fallbackRes.text || '';
        } catch (secondPassErr) {
          console.warn("Second pass chat model call warning:", secondPassErr);
        }
      }

      // Check local intent fallback if API response was empty or error occurred
      if (!responseText) {
        const lower = fullPromptText.toLowerCase();
        if (lower.includes('video') || lower.includes('autopilot') || lower.includes('generate')) {
          appContext.setActiveTab('autopilot');
          actionBadgeText = '⚡ Navigated to AI Autopilot Studio';
          responseText = "No wahala! I have switched you directly to the AI Autopilot Studio so we can cook your video!";
        } else if (lower.includes('script')) {
          appContext.setActiveTab('scripts');
          actionBadgeText = '⚡ Navigated to YT Scripts Genius';
          responseText = "I've brought you right to the Script Writer studio! Enter your topic to draft a viral video script.";
        } else if (lower.includes('voice') || lower.includes('speech') || lower.includes('narration')) {
          appContext.setActiveTab('voiceover');
          actionBadgeText = '⚡ Navigated to Voice Studio';
          responseText = "Switched to AI Voice Studio! You can choose Kore, Chimamanda, or any preferred narrator voice.";
        } else if (lower.includes('coach') || lower.includes('sister')) {
          appContext.setActiveTab('coach');
          actionBadgeText = '⚡ Navigated to Sister Vixora Coach';
          responseText = "God bless you! Switched to Sister Vixora Content Master & Divine Purpose Coach.";
        } else if (lower.includes('tools') || lower.includes('library')) {
          appContext.setActiveTab('tools');
          actionBadgeText = '⚡ Navigated to Tools Library';
          responseText = "Opening our unified Vixora AI Tools Library!";
        } else {
          responseText = "No wahala my creator! Tell me what video topic, script, or voiceover you would like to generate, or choose from our Quick Actions below!";
        }
      }

      const agentMsg: ChatMessage = {
        id: `vix_${Date.now()}`,
        sender: 'vixora',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionBadge: actionBadgeText,
        imageUrl: generatedImageUrl
      };

      setMessages(prev => prev.filter(m => m.id !== thinkingMsgId).concat(agentMsg));
    } catch (err: any) {
      console.error("Vixora Text Chat Error:", err);
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'vixora',
        text: `Network or API connection error: ${err?.message || 'Please check your connection and try again.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => prev.filter(m => m.id !== thinkingMsgId).concat(errorMsg));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setAttachedImage(evt.target?.result as string);
      setIsAddMenuOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setAttachedFile({ name: file.name, text: evt.target?.result as string });
      setIsAddMenuOpen(false);
    };
    reader.readAsText(file);
  };

  const handleClearHistory = () => {
    if (window.confirm("Clear chat history with Vixora?")) {
      setMessages([DEFAULT_WELCOME_MSG]);
      localStorage.removeItem('vixora_text_chat_history');
    }
  };

  if (!isOpen && !isFullTab) return null;

  return (
    <div 
      className={
        isFullTab 
          ? "w-full h-[calc(100vh-120px)] flex flex-col relative animate-fade-in"
          : "fixed inset-0 z-[250] bg-slate-950/70 backdrop-blur-md flex justify-end animate-fade-in"
      }
      onClick={isFullTab ? undefined : onClose}
    >
      <div 
        className={
          isFullTab
            ? `w-full h-full flex flex-col rounded-3xl border shadow-xl relative overflow-hidden ${
                themeMode === 'light' 
                  ? 'bg-slate-50 border-slate-200 text-slate-900' 
                  : 'bg-slate-900/90 border-white/10 text-white'
              }`
            : `w-full max-w-lg h-full flex flex-col shadow-2xl border-l transition-all duration-300 relative ${
                themeMode === 'light' 
                  ? 'bg-slate-50 border-slate-200 text-slate-900' 
                  : 'bg-slate-900 border-white/10 text-white'
              }`
        }
        onClick={e => e.stopPropagation()}
      >
        {/* CHAT HEADER */}
        <div className={`p-4 border-b flex items-center justify-between ${
          themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-950/80 border-white/10'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-ggd-orange p-0.5 shadow-md bg-slate-900 shrink-0">
              <img 
                src={vixoraAgentAvatar} 
                alt="Vixora AI" 
                className="w-full h-full object-cover rounded-xl" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-tight">Vixora AI Assistant</h3>
                <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  VIXORA AI
                </span>
              </div>
              <p className="text-[9.5px] font-bold uppercase text-ggd-orange tracking-widest flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active Workspace Command Agent</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleClearHistory} 
              title="Clear Chat History"
              className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all active:scale-95 ${
                themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              <i className="fa-solid fa-trash-can text-xs"></i>
              <span className="hidden sm:inline">Clear</span>
            </button>
            {!isFullTab && (
              <button 
                onClick={onClose} 
                className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs transition-all active:scale-95 ${
                  themeMode === 'light' ? 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }`}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>

        {/* QUICK SUGGESTION CHIPS */}
        <div className={`p-2.5 border-b overflow-x-auto flex items-center gap-2 scrollbar-none ${
          themeMode === 'light' ? 'bg-slate-100/80 border-slate-200' : 'bg-slate-950/40 border-white/5'
        }`}>
          {[
            { label: '⚡ Cook Finance Video', cmd: 'Generate a 30s vertical video on 5 rules of wealth' },
            { label: '🎨 Generate Flyer', cmd: 'Generate a promotional flyer banner for my finance channel' },
            { label: '🎙️ Voice to Sarah', cmd: 'Change the voice narrator to Sarah' },
            { label: '📐 9:16 Vertical Ratio', cmd: 'Change video preferences to 9:16 vertical ratio' },
            { label: '🔤 TikTok Green Captions', cmd: 'Change subtitle caption style to TikTok pop green' }
          ].map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(chip.cmd)}
              disabled={isProcessing}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all active:scale-95 shrink-0 ${
                themeMode === 'light'
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* MESSAGES FEED */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 text-xs max-w-3xl mx-auto w-full">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                {msg.sender === 'vixora' && (
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-ggd-orange flex items-center gap-1">
                    <i className="fa-solid fa-sparkles text-[10px]"></i>
                    <span>Vixora AI</span>
                  </span>
                )}
                {msg.sender === 'user' && (
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">
                    You
                  </span>
                )}
                <span className="text-[8px] font-medium text-slate-500">{msg.timestamp}</span>
              </div>

              <div 
                className={`max-w-[88%] p-4 rounded-3xl space-y-2 shadow-md leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-tr-none font-medium'
                    : themeMode === 'light'
                    ? 'bg-white border border-slate-200 text-slate-900 rounded-tl-none'
                    : 'bg-slate-800/90 border border-white/10 text-slate-100 rounded-tl-none'
                }`}
              >
                {/* ATTACHED IMAGE OR FILE DISPLAY IN MESSAGE */}
                {msg.imageUrl && (
                  <div className="mb-2 rounded-2xl overflow-hidden border border-white/20 shadow-md">
                    <img src={msg.imageUrl} alt="Attached asset" className="w-full max-h-60 object-cover" />
                  </div>
                )}

                {msg.attachedFile && (
                  <div className="mb-2 p-2.5 rounded-xl bg-black/20 border border-white/10 flex items-center gap-2 text-[10px] font-bold">
                    <i className="fa-solid fa-file-code text-ggd-orange"></i>
                    <span>Attached Document: {msg.attachedFile.name}</span>
                  </div>
                )}

                {msg.isThinking ? (
                  <div className="flex items-center gap-2.5 text-ggd-orange font-bold text-[11px] py-1">
                    <i className="fa-solid fa-spinner animate-spin text-sm"></i>
                    <span>Vixora is analyzing & executing action...</span>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                )}

                {/* ACTION EXECUTION BADGE */}
                {msg.actionBadge && (
                  <div className="mt-2.5 p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10.5px] font-bold flex items-center gap-2 shadow-sm">
                    <i className="fa-solid fa-bolt text-emerald-400"></i>
                    <span>{msg.actionBadge}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* ATTACHMENT PREVIEW DOCK BEFORE SENDING */}
        {(attachedImage || attachedFile) && (
          <div className="px-4 py-2 border-t border-white/10 bg-slate-950/80 flex items-center gap-3">
            {attachedImage && (
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-ggd-orange/50 shrink-0">
                <img src={attachedImage} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setAttachedImage(null)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[8px]"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            )}
            {attachedFile && (
              <div className="relative px-3 py-2 rounded-xl bg-slate-800 border border-white/10 flex items-center gap-2 text-xs font-bold text-white shrink-0">
                <i className="fa-solid fa-file-text text-ggd-orange"></i>
                <span className="max-w-[120px] truncate text-[10px]">{attachedFile.name}</span>
                <button 
                  onClick={() => setAttachedFile(null)}
                  className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[8px] ml-1"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ACTION SHEET / TOOLS POPOVER MENU */}
        {isAddMenuOpen && (
          <div className="absolute bottom-20 left-4 right-4 z-[260] bg-slate-900 border border-white/15 rounded-3xl p-4 shadow-2xl animate-rise max-h-96 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h4 className="text-xs font-black uppercase tracking-wider text-ggd-orange flex items-center gap-2">
                <i className="fa-solid fa-plus-circle"></i>
                <span>Add & Invoke AI Tools</span>
              </h4>
              <button 
                onClick={() => setIsAddMenuOpen(false)}
                className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* UPLOAD ACTIONS */}
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => imageInputRef.current?.click()}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2.5 text-left active:scale-95 transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-ggd-orange flex items-center justify-center text-xs">
                  <i className="fa-solid fa-image"></i>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white">Upload Image</p>
                  <p className="text-[8.5px] text-slate-400">Attach graphic/photo</p>
                </div>
              </button>

              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2.5 text-left active:scale-95 transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-file-lines"></i>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white">Upload File</p>
                  <p className="text-[8.5px] text-slate-400">Script or doc text</p>
                </div>
              </button>
            </div>

            {/* DIRECT TOOLS LIBRARY LINK */}
            <div className="pt-1">
              <button
                onClick={() => {
                  setIsAddMenuOpen(false);
                  appContext.setActiveTab('tools');
                }}
                className="w-full p-3 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 hover:from-emerald-500/25 hover:to-teal-500/25 border border-emerald-500/30 flex items-center justify-between text-left transition-all active:scale-95 group shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xs shrink-0 shadow-md">
                    <i className="fa-solid fa-shapes"></i>
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-white group-hover:text-emerald-400 transition-colors">Tools Library</p>
                    <p className="text-[8.5px] text-slate-400">Open full suite of 12 AI creation tools</p>
                  </div>
                </div>
                <i className="fa-solid fa-arrow-right text-xs text-emerald-400 group-hover:translate-x-1 transition-transform"></i>
              </button>
            </div>
          </div>
        )}

        {/* HIDDEN FILE INPUTS */}
        <input 
          ref={imageInputRef}
          type="file" 
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".txt,.pdf,.md,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* FIXED BOTTOM INPUT BAR */}
        <div className={`p-3 sm:p-4 border-t ${
          themeMode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-950 border-white/10'
        }`}>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 max-w-3xl mx-auto"
          >
            {/* ADD BUTTON (+) FOR ACTION SHEET */}
            <button
              type="button"
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              title="Add Image, File, or Tool"
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border text-base transition-all shrink-0 active:scale-90 ${
                isAddMenuOpen
                  ? 'bg-ggd-orange border-ggd-orange text-white rotate-45'
                  : themeMode === 'light'
                  ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                  : 'bg-white/10 border-white/15 text-white hover:bg-white/20'
              }`}
            >
              <i className="fa-solid fa-plus"></i>
            </button>

            {/* LIVE VOICE SESSION BUTTON */}
            <button
              type="button"
              onClick={() => {
                if (onStartLiveAssistant) onStartLiveAssistant();
                else if (appContext.handleAutopilotVideoGeneration) {
                  // Fallback to switching or triggering live assistant
                  appContext.setActiveTab('studio');
                }
              }}
              title="Start Live Voice Assistant Call"
              className="px-3 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black uppercase text-[10px] tracking-wider flex items-center gap-1.5 shadow-md active:scale-90 shrink-0 border border-amber-300/40"
            >
              <i className="fa-solid fa-microphone-lines text-xs animate-pulse"></i>
              <span className="hidden sm:inline">Live Call</span>
            </button>

            {/* INPUT FIELD */}
            <input 
              type="text" 
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask Vixora anything or type a command..."
              disabled={isProcessing}
              className={`flex-1 px-4 py-3 rounded-2xl border text-xs font-medium outline-none transition-all ${
                themeMode === 'light'
                  ? 'bg-slate-100 border-slate-300 text-slate-900 focus:bg-white focus:border-ggd-orange'
                  : 'bg-white/5 border-white/10 text-white focus:bg-slate-900 focus:border-ggd-orange'
              }`}
            />

            {/* SEND BUTTON */}
            <button 
              type="submit"
              disabled={(!inputQuery.trim() && !attachedImage && !attachedFile) || isProcessing}
              className="btn-3d btn-3d-orange px-4 py-3.5 rounded-2xl text-xs tracking-wider disabled:opacity-50 shrink-0 shadow-lg"
            >
              {isProcessing ? (
                <i className="fa-solid fa-spinner animate-spin"></i>
              ) : (
                <i className="fa-solid fa-paper-plane"></i>
              )}
            </button>
          </form>
          <p className="text-[8.5px] text-slate-500 font-semibold text-center mt-2">
            Vixora controls video production, voices, & scripts using AI function calling.
          </p>
        </div>
      </div>
    </div>
  );
};
