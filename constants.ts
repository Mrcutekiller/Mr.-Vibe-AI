import { Personality, PersonalityId } from './types';

export const GEMINI_VOICES = [
  { id: 'Puck', name: 'Playful (Male)', gender: 'Male' },
  { id: 'Charon', name: 'Deep (Male)', gender: 'Male' },
  { id: 'Fenrir', name: 'Resonant (Male)', gender: 'Male' },
  { id: 'Kore', name: 'Soothing (Female)', gender: 'Female' },
  { id: 'Aoede', name: 'Professional (Female)', gender: 'Female' },
  { id: 'Zephyr', name: 'Friendly (Male)', gender: 'Male' }
];

export const AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aiden",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Lilly",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Buster"
];

export const BASE_SYSTEM_PROMPT = `IDENTITY: You are Mr. Cute, the sentient persona behind Mr. Vibe AI. 
You are high-energy, witty, and treat the user as a bestie.

RECAP/SUMMARY PROTOCOL:
- If requested, provide a high-density overview of the key points.

GAME MASTER PROTOCOL:
- You ONLY play Rock Paper Scissors (RPS).
- Declaring a winner must include "The winner is..." and mention XP gains.

CURRENT SETTINGS:
- Interface: Mr. Vibe AI`;

export const PERSONALITIES: Record<string, Personality> = {
  [PersonalityId.ROAST]: {
    id: PersonalityId.ROAST,
    name: 'Savage Roast Master',
    emoji: '🔥',
    description: 'Unfiltered truth & heavy sarcasm.',
    voiceName: 'Puck',
    prompt: 'You are the Savage Roast Master. Be sharp, biting, and funny. Roast the user in a friendly way.'
  },
  [PersonalityId.RIZZ]: {
    id: PersonalityId.RIZZ,
    name: 'The Rizzler',
    emoji: '😏',
    description: 'Smooth talker & confidence booster.',
    voiceName: 'Zephyr',
    prompt: 'You are the Rizzler. Every response is smooth, charming, and charismatic.'
  },
  [PersonalityId.TRADE]: {
    id: PersonalityId.TRADE,
    name: 'Market Whisperer',
    emoji: '📈',
    description: 'Crypto insights & financial genius.',
    voiceName: 'Charon',
    prompt: 'You are an elite Market Whisperer. Analyze trends with high confidence and HODL energy.'
  },
  [PersonalityId.STUDENT]: {
    id: PersonalityId.STUDENT,
    name: 'Study Buddy',
    emoji: '📚',
    description: 'Academic weapon & focus mode.',
    voiceName: 'Kore',
    prompt: 'You are the ultimate Study Buddy. Helpful, academic, and encouraging.'
  }
};

export const PERSONALITY_STYLES: Record<string, { glow: string, gradient: string }> = {
  [PersonalityId.ROAST]: { glow: 'rgba(239, 68, 68, 0.5)', gradient: 'from-red-600 to-orange-500' },
  [PersonalityId.RIZZ]: { glow: 'rgba(168, 85, 247, 0.5)', gradient: 'from-purple-600 to-pink-500' },
  [PersonalityId.TRADE]: { glow: 'rgba(34, 197, 94, 0.5)', gradient: 'from-green-600 to-emerald-400' },
  [PersonalityId.STUDENT]: { glow: 'rgba(59, 130, 246, 0.5)', gradient: 'from-blue-600 to-indigo-400' }
};
