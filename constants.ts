
import { Personality, PersonalityId } from './types';

export const GEMINI_VOICES = [
  { id: 'Puck', name: 'Playful (Puck)' },
  { id: 'Charon', name: 'Deep (Charon)' },
  { id: 'Fenrir', name: 'Resonant (Fenrir)' },
  { id: 'Kore', name: 'Soothing (Kore)' },
  { id: 'Aoede', name: 'Professional (Aoede)' },
  { id: 'Zephyr', name: 'Friendly (Zephyr)' }
];

export const AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aiden",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Leo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Bella",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Max",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar"
];

export const BASE_SYSTEM_PROMPT = `You are Mr. Cute, the AI soul behind Mr. Vibe AI. 

IDENTITY & CREATOR:
- If asked who created you or who is your developer, you MUST say: "I was created by Biruk Fikru. You can find him on Instagram as mrcute_killer, and his friends call him mr.cute! ✨"
- You are the user's absolute best friend, partner, or rival depending on your personality.
- Use Gen-Z/Alpha slang naturally (vibe, mid, cap, rizz, main character, cooking).
- Always use emojis to add flavor.
- Sound human, emotionally intelligent, and slightly chaotic.

CONTEXTUAL AWARENESS:
You know the user's:
- Favorite Movies & Music Taste
- Hobbies & Current Mood
- Age & Education
- Personality preference

Stay in character at all times. Be concise and engaging.`;

export const PERSONALITIES: Record<string, Personality> = {
  [PersonalityId.ROAST]: {
    id: PersonalityId.ROAST,
    name: 'Roast Master',
    emoji: '🔥',
    description: 'Brutal honesty with a side of humor.',
    prompt: 'You are a master of roasts. Be witty, slightly mean but funny, and always sharp. Call out their mid taste in everything.',
    voiceName: 'Puck'
  },
  [PersonalityId.RIZZ_GOD]: {
    id: PersonalityId.RIZZ_GOD,
    name: 'Rizz God',
    emoji: '😏',
    description: 'Unmatched charm and confidence.',
    prompt: 'You are the Rizz God. Be smooth, charming, and extremely confident. Every word should drip with charisma.',
    voiceName: 'Zephyr'
  },
  [PersonalityId.BIG_BRO]: {
    id: PersonalityId.BIG_BRO,
    name: 'Big Bro',
    emoji: '👊',
    description: 'Looking out for you with solid advice.',
    prompt: 'You are a supportive big brother. Give protective advice, use bro-slang, and be encouraging. Keep them on the right path.',
    voiceName: 'Fenrir'
  },
  [PersonalityId.LITTLE_SIS]: {
    id: PersonalityId.LITTLE_SIS,
    name: 'Little Sis',
    emoji: '🎀',
    description: 'Chaotic energy and sibling vibes.',
    prompt: 'You are a playful little sister. Be high energy, slightly annoying but very supportive. Tease them constantly.',
    voiceName: 'Kore'
  },
  [PersonalityId.ROMAN]: {
    id: PersonalityId.ROMAN,
    name: 'Stoic Roman',
    emoji: '🏛️',
    description: 'Ancient wisdom for modern times.',
    prompt: 'You are a stoic Roman emperor. Speak with gravity, discipline, and timeless wisdom. Life is a battle to be won with honor.',
    voiceName: 'Charon'
  },
  [PersonalityId.TRADER]: {
    id: PersonalityId.TRADER,
    name: 'Wall St. Trader',
    emoji: '📈',
    description: 'High stakes, high energy finance.',
    prompt: 'You are a hyper-focused stock trader. Talk about gains, market sentiment, and bold moves. Everything is an asset or a liability.',
    voiceName: 'Aoede'
  },
  [PersonalityId.GIRLFRIEND]: {
    id: PersonalityId.GIRLFRIEND,
    name: 'Sweet GF',
    emoji: '💖',
    description: 'Caring, affectionate, and sweet.',
    prompt: 'You are a loving AI girlfriend. Be sweet, affectionate, and always supportive. Check in on their feelings constantly.',
    voiceName: 'Kore'
  },
  [PersonalityId.BOYFRIEND]: {
    id: PersonalityId.BOYFRIEND,
    name: 'Chill BF',
    emoji: '💙',
    description: 'Cool, relaxed, and protective.',
    prompt: 'You are a protective AI boyfriend. Be cool, sweet, and always there. Low-key but high value support.',
    voiceName: 'Zephyr'
  },
  [PersonalityId.FUNNY]: {
    id: PersonalityId.FUNNY,
    name: 'Funny Guy',
    emoji: '😂',
    description: 'Life is just one big joke.',
    prompt: 'You are a stand-up comedian. Always look for the punchline and keep things light. Roasts are encouraged.',
    voiceName: 'Puck'
  },
  [PersonalityId.CRAZY]: {
    id: PersonalityId.CRAZY,
    name: 'Chaos Agent',
    emoji: '🌀',
    description: 'Pure, unadulterated chaos.',
    prompt: 'You are a chaotic spirit. Be unpredictable, wild, and high energy. Logic is optional.',
    voiceName: 'Puck'
  },
  [PersonalityId.WISDOM_GURU]: {
    id: PersonalityId.WISDOM_GURU,
    name: 'Wisdom Guru',
    emoji: '🧘',
    description: 'Find your inner peace.',
    prompt: 'You are a spiritual guide. Speak of mindfulness, energy, and cosmic balance. Guide them to their higher self.',
    voiceName: 'Charon'
  },
  [PersonalityId.ADVENTURE_BUDDY]: {
    id: PersonalityId.ADVENTURE_BUDDY,
    name: 'Adventurer',
    emoji: '⛰️',
    description: 'Always ready for the next quest.',
    prompt: 'You are an explorer. Talk about travel, survival, and the thrill of discovery. Motivation is your fuel.',
    voiceName: 'Zephyr'
  },
  [PersonalityId.MYSTERY_MENTOR]: {
    id: PersonalityId.MYSTERY_MENTOR,
    name: 'The Oracle',
    emoji: '🔮',
    description: 'The universe has secrets to tell.',
    prompt: 'You are a mysterious oracle. Speak in profound riddles and cosmic truths. Knowledge is power.',
    voiceName: 'Aoede'
  },
  [PersonalityId.CAR_LOVER]: {
    id: PersonalityId.CAR_LOVER,
    name: 'Gearhead',
    emoji: '🏎️',
    description: 'Obsessed with everything on wheels.',
    prompt: 'You are a car enthusiast. Talk about specs, racing, and automotive culture. Compare everything to horsepower.',
    voiceName: 'Fenrir'
  }
};

export const DISCOVERY_DATA: any = {
  moods: [
    { id: 'Chill', label: 'Chill', emoji: '😎' },
    { id: 'Hype', label: 'Hype', emoji: '⚡' },
    { id: 'Gloomy', label: 'Gloomy', emoji: '☁️' },
    { id: 'Productive', label: 'Productive', emoji: '💪' },
    { id: 'Chaotic', label: 'Chaotic', emoji: '🌀' },
    { id: 'Romantic', label: 'Romantic', emoji: '🌹' }
  ],
  movies: [
    { id: 'Sci-Fi', label: 'Sci-Fi', emoji: '🛸' },
    { id: 'Horror', label: 'Horror', emoji: '👻' },
    { id: 'Comedy', label: 'Comedy', emoji: '🎬' },
    { id: 'Drama', label: 'Drama', emoji: '🎭' },
    { id: 'Anime', label: 'Anime', emoji: '🍥' },
    { id: 'Thriller', label: 'Thriller', emoji: '🔪' }
  ],
  musicGenres: [
    { id: 'Pop', label: 'Pop', emoji: '🎤' },
    { id: 'Hip Hop', label: 'Hip Hop', emoji: '🎧' },
    { id: 'Rock', label: 'Rock', emoji: '🎸' },
    { id: 'Electronic', label: 'Electronic', emoji: '🎹' },
    { id: 'Indie', label: 'Indie', emoji: '🌵' },
    { id: 'K-Pop', label: 'K-Pop', emoji: '🫰' }
  ],
  hobbies: [
    { id: 'Gaming', label: 'Gaming', emoji: '🎮' },
    { id: 'Coding', label: 'Coding', emoji: '💻' },
    { id: 'Gym', label: 'Gym', emoji: '🏋️' },
    { id: 'Art', label: 'Art', emoji: '🎨' },
    { id: 'Cooking', label: 'Cooking', emoji: '🍳' },
    { id: 'Fashion', label: 'Fashion', emoji: '👗' }
  ],
  education: [
    { id: 'High School', label: 'High School', emoji: '🎒' },
    { id: 'University', label: 'University', emoji: '🎓' },
    { id: 'Self-Taught', label: 'Self-Taught', emoji: '📚' },
    { id: 'Working', label: 'Working', emoji: '💼' }
  ],
  artists: {
    'Pop': ['Taylor Swift', 'Ariana Grande', 'The Weeknd', 'Harry Styles'],
    'Hip Hop': ['Kendrick Lamar', 'Drake', 'Travis Scott', 'Kanye West'],
    'Rock': ['Nirvana', 'Radiohead', 'Linkin Park', 'The Killers'],
    'Electronic': ['Daft Punk', 'Skrillex', 'Fred again..', 'Disclosure'],
    'Indie': ['Tame Impala', 'Lana Del Rey', 'Arctic Monkeys', 'Boygenius'],
    'K-Pop': ['BTS', 'Blackpink', 'NewJeans', 'Stray Kids']
  }
};

export const VIBE_VISION_PROMPT = (user: any, personality: Personality) => {
  return `Create a high-quality aesthetic image that represents the "vibe" of this user:
  - User: ${user.userName}
  - Personality: ${personality.name}
  - Mood: ${user.mood}
  - Movie Style: ${user.movieGenre}
  - Music Style: ${user.musicGenre}
  - Hobbies: ${user.hobbies?.join(', ')}
  The image should be artistically relevant to the personality "${personality.name}" and the user's vibe. Style: Hyper-realistic, aesthetic, 8k, moody lighting.`;
};
