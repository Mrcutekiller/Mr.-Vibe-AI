
export enum PersonalityId {
  ROAST = 'ROAST',
  RIZZ = 'RIZZ',
  TRADE = 'TRADE',
  STUDENT = 'STUDENT'
}

export type Theme = 'dark' | 'light';
export type Gender = 'Male' | 'Female' | 'Other' | 'Secret';

export interface User {
  email?: string;
  password?: string;
  userName: string;
  gender: Gender;
  avatarUrl: string;
  personalityId: PersonalityId;
  mood?: string;
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

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  file?: FileAttachment;
  isNote?: boolean;
  isPinned?: boolean;
  timestamp: number;
  reaction?: ReactionType;
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
}
