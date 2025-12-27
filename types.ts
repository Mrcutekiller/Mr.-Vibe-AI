
export enum PersonalityId {
  ROAST = 'ROAST',
  RIZZ = 'RIZZ',
  TRADE = 'TRADE',
  STUDENT = 'STUDENT',
  EXECUTIVE = 'EXECUTIVE'
}

export type Theme = 'dark' | 'light';
export type Gender = 'Male' | 'Female' | 'Other' | 'Secret';
export type AIProvider = 'google' | 'openai';
export type GameDifficulty = 'easy' | 'medium' | 'hard';

export interface GameResult {
  id: string;
  gameName: string;
  result: 'win' | 'loss' | 'draw' | 'completed';
  userChoice?: string;
  aiChoice?: string;
  xpGained: number;
  timestamp: number;
}

export interface User {
  userName: string;
  gender: Gender;
  avatarUrl: string;
  personalityId: PersonalityId;
  googleApiKey?: string;
  openaiApiKey?: string;
  preferredProvider: AIProvider;
  xp: number;
  level: number;
  badges: string[];
  gameHistory: GameResult[];
}

export interface Personality {
  id: PersonalityId;
  name: string;
  emoji: string;
  description: string;
  prompt: string;
  voiceName: string;
}

export type ReactionType = '❤️' | '👍' | '😂' | '😮' | '🔥' | '💀' | null;

export interface FileAttachment {
  data: string;
  name: string;
  type: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  files?: FileAttachment[];
  isNote?: boolean;
  isPinned?: boolean;
  timestamp: number;
  reaction?: ReactionType;
  groundingChunks?: GroundingChunk[];
  provider?: AIProvider;
  xpGained?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  lastTimestamp: number;
  personalityId: PersonalityId;
}

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
  timestamp: number;
}

export interface AppSettings {
  language: string;
  theme: Theme;
  personalityId: PersonalityId;
  voiceName: string;
  speakingRate: number;
  speakingPitch: number;
  customCommands: any[];
  preferredProvider: AIProvider;
  gameDifficulty: GameDifficulty;
}
