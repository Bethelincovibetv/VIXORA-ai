
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
