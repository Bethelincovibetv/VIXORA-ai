import { Type } from "@google/genai";

export interface VixoraAppContext {
  setActiveTab: (tab: string) => void;
  handleAutopilotVideoGeneration: (topic: string, ratio?: 'vertical' | 'horizontal' | 'square', duration?: string, webSearch?: boolean) => void;
  setSelectedVoice: (voice: string) => void;
  setVideoRatio: (ratio: 'vertical' | 'horizontal' | 'square') => void;
  setTargetVideoDuration: (dur: string) => void;
  saveCustomLearnedSkill: (name: string, desc: string, pref?: string, cat?: 'format' | 'voice' | 'style' | 'custom') => void;
  setGeneratedScript: (script: string) => void;
  setScriptTopic: (topic: string) => void;
  setVideoScriptInput: (script: string) => void;
  handleSourceVideos?: (script: string) => void;
  setGlobalMusicVolume?: (vol: number) => void;
  setGlobalExtractedMood?: (mood: string) => void;
  setCaptionTemplate?: (tpl: string) => void;
  addCreatedAsset?: (asset: { id: string; title: string; imageUrl: string; date: string; type: 'flyer' | 'video' }) => void;
  userFullName?: string;
  currentScriptText?: string;
  currentTopic?: string;
}

export interface VixoraToolResult {
  success: boolean;
  message: string;
  executedActionName: string;
  data?: any;
}

export interface VixoraToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: Type;
    properties: Record<string, {
      type: Type;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  execute: (args: any, ctx: VixoraAppContext) => Promise<VixoraToolResult>;
}

// Helper to generate a crisp promotional flyer using HTML5 Canvas
const createPromotionalFlyerCanvas = (headline: string, subheadline?: string, themeColor?: string, niche?: string): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350; // Instagram Portrait / Flyer ratio
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background Gradient
  const grad = ctx.createLinearGradient(0, 0, 1080, 1350);
  if (themeColor === 'gold' || themeColor === 'amber') {
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.5, '#31103f');
    grad.addColorStop(1, '#f59e0b');
  } else if (themeColor === 'green' || themeColor === 'emerald') {
    grad.addColorStop(0, '#022c22');
    grad.addColorStop(0.5, '#064e3b');
    grad.addColorStop(1, '#10b981');
  } else if (themeColor === 'purple' || themeColor === 'cyber') {
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#4c1d95');
    grad.addColorStop(1, '#ec4899');
  } else { // Default Vixora Orange / Dark Navy
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(0.6, '#1e1b4b');
    grad.addColorStop(1, '#f97316');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1350);

  // Decorative Accent Shapes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath();
  ctx.arc(900, 200, 350, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(100, 1150, 400, 0, Math.PI * 2);
  ctx.fill();

  // Top Badge Header
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.roundRect(80, 90, 320, 50, 25);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px sans-serif';
  ctx.fillText('⚡ VIXORA AI STUDIO', 110, 123);

  // Niche / Category Pill
  if (niche) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.roundRect(420, 90, 280, 50, 25);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 20px sans-serif';
    ctx.fillText(niche.toUpperCase(), 445, 122);
  }

  // Main Headline Text Wrapping
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 68px sans-serif';
  const words = headline.split(' ');
  let line = '';
  let y = 380;
  const maxWidth = 920;
  const lineHeight = 82;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), 80, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), 80, y);

  // Subheadline
  if (subheadline) {
    y += 40;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 36px sans-serif';
    const subWords = subheadline.split(' ');
    let subLine = '';
    for (let s = 0; s < subWords.length; s++) {
      const testSub = subLine + subWords[s] + ' ';
      if (ctx.measureText(testSub).width > maxWidth && s > 0) {
        ctx.fillText(subLine.trim(), 80, y);
        subLine = subWords[s] + ' ';
        y += 50;
      } else {
        subLine = testSub;
      }
    }
    ctx.fillText(subLine.trim(), 80, y);
  }

  // Center Feature Box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
  ctx.strokeStyle = 'rgba(249, 115, 22, 0.5)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(80, y + 60, 920, 280, 32);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 32px sans-serif';
  ctx.fillText('🎬 CREATED WITH VIXORA AI AUTOPILOT', 120, y + 140);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 26px sans-serif';
  ctx.fillText('• 100% Auto Scripting & HD Stock Video Sync', 120, y + 195);
  ctx.fillText('• CapCut Subtitle Styling & Neural Speech', 120, y + 240);

  // Footer Branding
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 24px sans-serif';
  ctx.fillText('VIXORA STUDIO • AUTOMATED VIDEO ENGINE 2026', 80, 1260);

  return canvas.toDataURL('image/png');
};

/**
 * EXTENSIBLE AGENT TOOLS REGISTRY
 * Each tool is documented with name, description, required parameters schema, and executable action handler.
 */
export const VIXORA_AGENT_TOOLS: VixoraToolDefinition[] = [
  {
    name: 'configureAndCreateAutopilotVideo',
    description: 'Generates and cooks a complete video automatically on autopilot with explicit user settings for topic, aspect ratio, duration, and search web trends.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: { type: Type.STRING, description: 'The subject, title, or concept for the video.' },
        aspectRatio: { type: Type.STRING, enum: ['vertical', 'horizontal', 'square'], description: 'Video frame ratio: "vertical" (9:16 Shorts/TikTok), "horizontal" (16:9 YouTube), "square" (1:1 Instagram).' },
        duration: { type: Type.STRING, description: 'Target video length e.g. "15s", "30s", "60s", or "2min".' },
        useWebSearchTrends: { type: Type.BOOLEAN, description: 'Whether to search live Google web trends for fresh breaking facts.' }
      },
      required: ['topic']
    },
    execute: async (args, ctx) => {
      const topic = args.topic;
      const ratio = args.aspectRatio || 'vertical';
      const duration = args.duration || '30s';
      const searchWeb = args.useWebSearchTrends !== undefined ? args.useWebSearchTrends : true;

      ctx.setActiveTab('autopilot');
      ctx.handleAutopilotVideoGeneration(topic, ratio, duration, searchWeb);

      return {
        success: true,
        executedActionName: 'configureAndCreateAutopilotVideo',
        message: `Triggered Autopilot Video Creation for "${topic}" (${ratio} ratio, ${duration} length, Web Trends: ${searchWeb ? 'ON' : 'OFF'}). Navigated to Autopilot Studio.`
      };
    }
  },
  {
    name: 'navigateToTab',
    description: 'Switches or navigates to a specific screen/tab inside Vixora AI Studio app.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tab: { 
          type: Type.STRING, 
          enum: ['autopilot', 'manual', 'studio', 'voiceover', 'music', 'coach', 'tools', 'profile', 'announcements'], 
          description: 'The target tab name to open.' 
        }
      },
      required: ['tab']
    },
    execute: async (args, ctx) => {
      const tabMap: Record<string, string> = {
        'autopilot': 'autopilot',
        'manual': 'manual',
        'studio': 'studio',
        'voiceover': 'voiceover',
        'voice overs': 'voiceover',
        'music': 'music',
        'coach': 'coach',
        'tools': 'tools',
        'profile': 'profile',
        'announcements': 'announcements'
      };
      const mapped = tabMap[args.tab.toLowerCase()] || 'autopilot';
      ctx.setActiveTab(mapped);

      return {
        success: true,
        executedActionName: 'navigateToTab',
        message: `Navigated to the ${mapped.toUpperCase()} tab.`
      };
    }
  },
  {
    name: 'changeVoiceoverSettings',
    description: 'Changes the AI narrator voice model actor used for voiceovers in Vixora AI Studio.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        voiceName: { 
          type: Type.STRING, 
          description: 'The narrator voice name e.g. "Kore" (Energetic Female), "Sarah" (Soft Female), "Fenrir" (Deep Male), "Aoede" (Warm Female), "Puck" (Upbeat Male), "Charon" (Authoritative Male).' 
        }
      },
      required: ['voiceName']
    },
    execute: async (args, ctx) => {
      ctx.setSelectedVoice(args.voiceName);
      return {
        success: true,
        executedActionName: 'changeVoiceoverSettings',
        message: `Switched AI voice narrator to "${args.voiceName}".`
      };
    }
  },
  {
    name: 'changeCaptionStyle',
    description: 'Changes the CapCut subtitle font style, color palette, or preset caption template for the video.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        templateId: { 
          type: Type.STRING, 
          enum: ['bold-yellow', 'toktok-neon', 'darkbox', 'cyber-future', 'karaoke-grad'],
          description: 'Caption template ID: "bold-yellow" (CapCut Classic), "toktok-neon" (TikTok Pop Green), "darkbox" (Minimal Dark), "cyber-future" (Cyberpunk Neon Pink), "karaoke-grad" (Karaoke Glow).' 
        }
      },
      required: ['templateId']
    },
    execute: async (args, ctx) => {
      if (ctx.setCaptionTemplate) {
        ctx.setCaptionTemplate(args.templateId);
      }
      return {
        success: true,
        executedActionName: 'changeCaptionStyle',
        message: `Updated video subtitle caption template to "${args.templateId}".`
      };
    }
  },
  {
    name: 'editVideoScript',
    description: 'Updates, rewrites, or sets the current video script or topic in the studio workspace.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        newScript: { type: Type.STRING, description: 'The updated full script text.' },
        topic: { type: Type.STRING, description: 'The video topic or headline.' }
      }
    },
    execute: async (args, ctx) => {
      if (args.newScript) {
        ctx.setGeneratedScript(args.newScript);
        ctx.setVideoScriptInput(args.newScript);
      }
      if (args.topic) {
        ctx.setScriptTopic(args.topic);
      }
      return {
        success: true,
        executedActionName: 'editVideoScript',
        message: 'Updated script and topic in video workspace.'
      };
    }
  },
  {
    name: 'generateFlyerImage',
    description: 'Generates a branded promotional flyer graphic image for a channel, video announcement, or topic, and adds it to project assets.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        headline: { type: Type.STRING, description: 'Main prominent headline text on the flyer.' },
        subheadline: { type: Type.STRING, description: 'Secondary descriptive text or call to action.' },
        themeColor: { type: Type.STRING, enum: ['orange', 'gold', 'green', 'purple'], description: 'Color palette accent for the flyer design.' },
        niche: { type: Type.STRING, description: 'Content category e.g. "Finance", "Motivation", "Tech".' }
      },
      required: ['headline']
    },
    execute: async (args, ctx) => {
      const dataUrl = createPromotionalFlyerCanvas(args.headline, args.subheadline, args.themeColor, args.niche);
      
      if (ctx.addCreatedAsset) {
        ctx.addCreatedAsset({
          id: `flyer_${Date.now()}`,
          title: args.headline,
          imageUrl: dataUrl,
          date: new Date().toLocaleDateString(),
          type: 'flyer'
        });
      }

      return {
        success: true,
        executedActionName: 'generateFlyerImage',
        data: { imageUrl: dataUrl, headline: args.headline },
        message: `Successfully generated promotional flyer graphic for "${args.headline}". Added to project assets gallery!`
      };
    }
  },
  {
    name: 'learnUserCustomSkill',
    description: 'Saves a new custom workflow rule, brand requirement, or formatting preference learned from the user into Vixora AI skill memory.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        skillName: { type: Type.STRING, description: 'Name of the rule or skill learned e.g. "Finance Shorts 15s"' },
        skillDescription: { type: Type.STRING, description: 'Detailed explanation of what the user wants.' },
        category: { type: Type.STRING, enum: ['format', 'voice', 'style', 'custom'], description: 'Category of the skill.' }
      },
      required: ['skillName', 'skillDescription']
    },
    execute: async (args, ctx) => {
      ctx.saveCustomLearnedSkill(args.skillName, args.skillDescription, undefined, args.category || 'custom');
      return {
        success: true,
        executedActionName: 'learnUserCustomSkill',
        message: `Saved custom rule "${args.skillName}" into Vixora AI skill memory.`
      };
    }
  },
  {
    name: 'setVideoPreferences',
    description: 'Updates global video creation settings like aspect ratio frame shape and target duration.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        aspectRatio: { type: Type.STRING, enum: ['vertical', 'horizontal', 'square'], description: 'Aspect ratio' },
        duration: { type: Type.STRING, description: 'Video duration e.g. "15s", "30s", "60s"' }
      }
    },
    execute: async (args, ctx) => {
      if (args.aspectRatio) ctx.setVideoRatio(args.aspectRatio);
      if (args.duration) ctx.setTargetVideoDuration(args.duration);
      return {
        success: true,
        executedActionName: 'setVideoPreferences',
        message: `Updated video layout preferences (Ratio: ${args.aspectRatio || 'unchanged'}, Duration: ${args.duration || 'unchanged'}).`
      };
    }
  },
  {
    name: 'changeMusicSettings',
    description: 'Adjusts background music track volume or extracted mood genre.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        volume: { type: Type.NUMBER, description: 'Volume level from 0.0 to 1.0 e.g. 0.15' },
        mood: { type: Type.STRING, description: 'Extracted mood e.g. "motivational", "chill", "epic", "cinematic"' }
      }
    },
    execute: async (args, ctx) => {
      if (args.volume !== undefined && ctx.setGlobalMusicVolume) {
        ctx.setGlobalMusicVolume(args.volume);
      }
      if (args.mood && ctx.setGlobalExtractedMood) {
        ctx.setGlobalExtractedMood(args.mood);
      }
      return {
        success: true,
        executedActionName: 'changeMusicSettings',
        message: 'Updated background music settings.'
      };
    }
  }
];
