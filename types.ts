
export enum PersonalityId {
  NORMAL = 'NORMAL',
  ROAST = 'ROAST',
  RIZZ_GOD = 'RIZZ_GOD',
  BIG_BRO = 'BIG_BRO',
  LITTLE_SIS = 'LITTLE_SIS',
  ROMAN = 'ROMAN',
  TRADER = 'TRADER',
  GIRLFRIEND = 'GIRLFRIEND',
  BOYFRIEND = 'BOYFRIEND',
  FUNNY = 'FUNNY',
  CRAZY = 'CRAZY',
  WISDOM_GURU = 'WISDOM_GURU',
  ADVENTURE_BUDDY = 'ADVENTURE_BUDDY',
  MYSTERY_MENTOR = 'MYSTERY_MENTOR',
  CAR_LOVER = 'CAR_LOVER'
}

export type Theme = 'dark' | 'light';
export type Gender = 'Male' | 'Female' | 'Other' | 'Secret';

export interface User {
  email: string;
  password?: string;
  userName: string;
  age: string;
  gender: Gender;
  avatarUrl: string;
  personalityId: PersonalityId;
  movieGenre?: string;
  musicGenre?: string;
  favoriteArtists?: string[];
  educationLevel?: string;
  hobbies?: string[];
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

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface CustomCommand {
  id: string;
  trigger: string;
  action: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // base64
  isNote?: boolean;
  isQuestion?: boolean;
  timestamp: number;
  reaction?: ReactionType;
  sources?: GroundingSource[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  lastTimestamp: number;
  personalityId: PersonalityId;
}

export interface AppSettings {
  language: string;
  theme: Theme;
  personalityId: PersonalityId;
  voiceName: string;
  speakingRate: number;
  speakingPitch: number;
  wakeWordEnabled: boolean;
  customCommands: CustomCommand[];
}

export type ApiStatus = 'checking' | 'connected' | 'error';
