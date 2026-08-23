export interface VixoraToolEntry {
  id: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  category: 'video' | 'voice' | 'growth' | 'creative' | 'mentorship';
  icon: string;
  gradient: string;
  badge?: string;
  actionType: 'tab' | 'live_voice' | 'chat_command' | 'modal';
  targetTab?: string;
  suggestedPrompt?: string;
  keywords: string[];
}

export const VIXORA_TOOLS_REGISTRY: VixoraToolEntry[] = [
  {
    id: 'tool_autopilot',
    name: 'AI Autopilot Video Producer',
    shortDescription: 'Cook complete faceless videos automatically with script, voice, B-roll & captions.',
    fullDescription: 'Full-stack automated video production. Generates viral scripts, extracts scene keywords, fetches stock clips, generates voiceover TTS, and syncs captions in one click.',
    category: 'video',
    icon: 'fa-wand-magic-sparkles',
    gradient: 'from-rose-500 to-pink-600',
    badge: 'AUTOPILOT',
    actionType: 'tab',
    targetTab: 'autopilot',
    suggestedPrompt: 'Generate a 30s vertical autopilot video about 5 habit changes for success',
    keywords: ['autopilot', 'video generator', 'faceless', 'shorts', 'reels', 'tiktok', 'cook video', 'automate']
  },
  {
    id: 'tool_live_voice',
    name: 'Vixora Live Voice Agent',
    shortDescription: 'Real-time two-way voice call assistant with energetic Nigerian voice & command execution.',
    fullDescription: 'Connect directly to Vixora via low-latency live audio. Speak naturally to brainstorm video ideas, request tab changes, or command full video production verbally.',
    category: 'voice',
    icon: 'fa-microphone-lines',
    gradient: 'from-amber-500 to-orange-600',
    badge: 'LIVE VOICE',
    actionType: 'live_voice',
    keywords: ['live voice', 'voice call', 'voice assistant', 'kore voice', 'speak', 'audio agent', 'talk']
  },
  {
    id: 'tool_chat_assistant',
    name: 'Vixora AI Assistant',
    shortDescription: 'Conversational creator assistant with function calling, image generation & workspace control.',
    fullDescription: 'Conversational AI co-pilot interface. Issue commands, analyze content, request flyer graphics, switch voice narrators, or edit scripts dynamically.',
    category: 'mentorship',
    icon: 'fa-comments',
    gradient: 'from-orange-500 to-amber-600',
    badge: 'VIXORA AI',
    actionType: 'chat_command',
    suggestedPrompt: 'How far Vixora! Help me plan a 7-day viral video content strategy',
    keywords: ['chat', 'assistant', 'ai chat', 'command', 'conversation']
  },
  {
    id: 'tool_script_genius',
    name: 'YouTube Script Genius',
    shortDescription: 'Generate high-retention viral scripts with hooks, speaker cues & CTAs.',
    fullDescription: 'Generates structured scripts optimized for viewer retention. Supports live web search grounding to include breaking trends and fresh facts.',
    category: 'video',
    icon: 'fa-scroll',
    gradient: 'from-purple-500 to-indigo-600',
    badge: 'SEO SCRIPT',
    actionType: 'tab',
    targetTab: 'scripts',
    suggestedPrompt: 'Write a viral 60-second YouTube Shorts script about the future of AI',
    keywords: ['script', 'writer', 'youtube script', 'hook', 'cta', 'retention', 'storyboard', 'text']
  },
  {
    id: 'tool_video_creator',
    name: 'Stock B-Roll Video Creator',
    shortDescription: 'Source HD B-roll video clips, assemble scene timelines & sync audio layers.',
    fullDescription: 'Search thousands of HD Vixora Media video clips tailored to your script scenes. Preview multi-track audio-visual timelines and export.',
    category: 'video',
    icon: 'fa-clapperboard',
    gradient: 'from-orange-600 to-red-600',
    badge: 'STUDIO',
    actionType: 'tab',
    targetTab: 'videos',
    suggestedPrompt: 'Source HD stock videos for finance and wealth script',
    keywords: ['b-roll', 'stock videos', 'video editor', 'timeline', 'clips', 'broll', 'pexels']
  },
  {
    id: 'tool_voiceover_tts',
    name: 'Voiceover & TTS Studio',
    shortDescription: 'Studio-grade AI voice narration with natural accents and multi-voice options.',
    fullDescription: 'Convert any script text into crisp, studio-quality speech. Preview multiple voice avatars (Kore, Sarah, Marcus, etc.) and download WAV audio.',
    category: 'voice',
    icon: 'fa-waveform-lines',
    gradient: 'from-blue-500 to-cyan-600',
    badge: 'TTS AUDIO',
    actionType: 'tab',
    targetTab: 'voiceover',
    suggestedPrompt: 'Generate studio voiceover narration for my script text',
    keywords: ['voiceover', 'tts', 'text to speech', 'voice studio', 'narration', 'kore', 'sarah', 'speech']
  },
  {
    id: 'tool_bg_music',
    name: 'Background Music Library',
    shortDescription: 'Mood-extracted background music tracks & sound effect layers.',
    fullDescription: 'Search mood-matched background music tracks and sound effects. Adjust master volume levels to balance voiceover and ambient audio.',
    category: 'voice',
    icon: 'fa-music',
    gradient: 'from-amber-500 to-yellow-600',
    badge: 'AUDIO MIX',
    actionType: 'tab',
    targetTab: 'bgmusic',
    keywords: ['background music', 'audio', 'sfx', 'music', 'soundtrack', 'volume', 'mood music']
  },
  {
    id: 'tool_growth_seo',
    name: 'Growth & SEO Suite',
    shortDescription: 'High-ranking SEO tags, 3-second viral opening hooks & thumbnail concepts.',
    fullDescription: 'Supercharge video CTR and search discoverability. Generate comma-separated tags, 5 high-retention opening hooks, and high-CTR visual thumbnail concepts.',
    category: 'growth',
    icon: 'fa-bolt-lightning',
    gradient: 'from-emerald-500 to-teal-600',
    badge: 'VIRAL SEO',
    actionType: 'tab',
    targetTab: 'more',
    suggestedPrompt: 'Generate high-ranking SEO tags and viral hooks for crypto trading',
    keywords: ['seo', 'tags', 'hooks', 'thumbnails', 'growth', 'ctr', 'keywords', 'rank']
  },
  {
    id: 'tool_flyer_generator',
    name: 'Promotional Flyer & Graphic Canvas',
    shortDescription: 'Design eye-catching social media promotional flyers and banner graphics.',
    fullDescription: 'Canvas-powered graphic designer. Generates 1080x1350 high-resolution promotional flyers with custom typography, gradient themes, and badge headers.',
    category: 'creative',
    icon: 'fa-image',
    gradient: 'from-pink-500 to-rose-600',
    badge: 'CANVAS ART',
    actionType: 'chat_command',
    suggestedPrompt: 'Generate a promotional flyer banner for my YouTube channel launch',
    keywords: ['flyer', 'banner', 'thumbnail', 'graphic', 'poster', 'instagram', 'image', 'design']
  },
  {
    id: 'tool_subtitle_styler',
    name: 'TikTok Subtitle & Caption Styler',
    shortDescription: 'CapCut & TikTok style animated subtitles with pop green highlights.',
    fullDescription: 'Apply trendy, high-retention subtitle presets including TikTok Pop Green, YouTube Bold Yellow, Cyber Neon, and Minimal White.',
    category: 'creative',
    icon: 'fa-closed-captioning',
    gradient: 'from-teal-500 to-emerald-600',
    badge: 'CAPCUT STYLE',
    actionType: 'chat_command',
    suggestedPrompt: 'Set subtitle caption style to TikTok Pop Green',
    keywords: ['subtitles', 'captions', 'tiktok captions', 'capcut', 'text overlay', 'style']
  },
  {
    id: 'tool_sister_vixora',
    name: 'Sister Vixora Faith & Growth Mentor',
    shortDescription: 'Spiritual motivation, faith alignment, and personal growth guidance.',
    fullDescription: 'Personalized spiritual and creator mentorship guided by faith, encouraging quotes, scripture alignment, and daily purpose coaching.',
    category: 'mentorship',
    icon: 'fa-cross',
    gradient: 'from-amber-600 to-orange-700',
    badge: 'MENTORSHIP',
    actionType: 'tab',
    targetTab: 'coach',
    suggestedPrompt: 'Give me a spiritual message and motivation for creators today',
    keywords: ['faith', 'mentor', 'spiritual', 'sister vixora', 'encouragement', 'coaching', 'bible']
  },
  {
    id: 'tool_learned_skills',
    name: 'Custom Learned Skills & Brand Rules',
    shortDescription: 'Teach Vixora custom workflow preferences, channel voice, and formatting rules.',
    fullDescription: 'Store persistent rules and skills into Vixora AI memory. Customize video durations, preferred voice narrators, or brand styling guidelines.',
    category: 'mentorship',
    icon: 'fa-brain',
    gradient: 'from-indigo-500 to-purple-600',
    badge: 'AI MEMORY',
    actionType: 'chat_command',
    suggestedPrompt: 'Learn a new skill: Always make my scripts 30 seconds and fast paced',
    keywords: ['learned skills', 'memory', 'preferences', 'rules', 'brand voice', 'custom skill']
  }
];
