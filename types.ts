
export interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
}

export interface Module {
  title: string;
  content: string; // Markdown supported
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // Index of the correct option
}

export interface Course {
  id: string;
  topic: string;
  title: string;
  description: string;
  difficulty: string;
  objectives: string[];
  modules: Module[];
  quiz: QuizQuestion[];
  generatedAt: string;
}

export interface Certificate {
  id: string;
  courseTitle: string;
  userName: string;
  date: string;
  score: number;
}

// Added Bank interface to fix import error in paystackService.ts
export interface Bank {
  name: string;
  code: string;
  id: number;
  slug?: string;
}

export interface LearnedSkill {
  id: string;
  name: string;
  description: string;
  preferenceData?: string;
  category?: 'format' | 'voice' | 'style' | 'custom';
  createdAt: string;
}

export interface VideoTemplate {
  id: string;
  title: string;
  description: string;
  niche: string;
  aspectRatio: 'vertical' | 'horizontal' | 'square';
  targetDuration: '15s' | '30s' | '60s' | '2min';
  captionTemplate: string;
  sfxEnabled: boolean;
  bgMusicUrl: string;
  scriptStyle: string;
  createdBy?: string;
  createdAt: string;
}

export interface RoadmapItem {
  day: number;
  postTitle: string;
  platform: 'Facebook' | 'WhatsApp' | 'TikTok' | 'Instagram' | 'YouTube';
  contentHook: string;
  mainMessage: string;
  callToAction: string;
  monetizationTip: string;
  scriptPrompt: string;
}

export interface ContentRoadmap {
  id: string;
  title: string;
  niche: string;
  platform: string;
  goal: string;
  roadmapItems: RoadmapItem[];
  faithAlignment: string;
  userId?: string;
  createdAt: string;
}

export interface SFXPlacement {
  id: string;
  sfxId: string;
  name: string;
  synthType: string;
  timestamp: number; // in seconds
}

