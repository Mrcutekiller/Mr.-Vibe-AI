import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Waves, Volume2, LogIn, UserPlus, ArrowRight, ArrowLeft, 
  User as UserIcon, CheckCircle2, Mail, Lock, Sparkles, 
  ChevronRight, MicOff, MessageSquare, AlertCircle, AlertTriangle, RefreshCw,
  Camera, FileText, Upload, Loader2, Play, Image as ImageIcon, Globe,
  Leaf, Droplets, Share2, ThumbsUp, ThumbsDown, Edit3, Check, Zap, ExternalLink, Activity, Bell, Music, Film, Heart, GraduationCap, Users, Copy, Share, LogOut, AlertOctagon, Key, Wand2, Info, HelpCircle, Eye, EyeOff, Smile, Rocket, Eraser, Pin, StickyNote, ListFilter, Mic2, UserCheck, ShieldCheck, Palette, FastForward, Sliders, BookOpen, PenTool, Hash
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES, DISCOVERY_DATA } from './constants';
import { PersonalityId, Personality, AppSettings, User, ChatSession, Message, ReactionType, GroundingSource, ApiStatus, Gender, CustomCommand } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';
import { decode, decodeAudioData } from './utils/audioUtils';

// --- Components ---

const validateEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const Logo = ({ className = "w-12 h-12", animated = false }: { className?: string, animated?: boolean }) => (
  <div className={`relative flex items-center justify-center ${className} ${animated ? 'animate-float' : ''}`}>
    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full opacity-50" />
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full relative z-10 drop-shadow-lg">
      <defs>
        {/* Fixed duplicate attribute x2 and added y1 for standard compliance */}
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect x="5" y="5" width="90" height="90" rx="28" fill="url(#logoGrad)" />
      <path d="M30 35C30 35 35 65 50 65C65 65 70 35 70 35M35 45C35 45 40 55 50 55C60 55 65 45 65 45" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" className={animated ? "animate-pulse" : ""} />
    </svg>
  </div>
);

const CodeBlock = ({ content }: { content: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-4 bg-zinc-950 dark:bg-black rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/5 shadow-xl animate-vibe-in">
      <div className="bg-zinc-100 dark:bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 flex justify-between items-center border-b border-zinc-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-blue-500" />
          <span>Script Block</span>
        </div>
        <button 
          onClick={handleCopy} 
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all text-[10px] font-black uppercase ${copied ? 'text-green-500 bg-green-500/10' : 'text-zinc-400 hover:text-blue-500 hover:bg-zinc-200 dark:hover:bg-white/10 active:scale-95'}`}
        >
          {copied ? <Check size={12} strokeWidth={3} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-[13px] font-mono overflow-x-auto custom-scrollbar leading-relaxed text-zinc-300">
        <code>{content}</code>
      </pre>
    </div>
  );
};

const MarkdownText = ({ text }: { text: string }) => {
  const lines = text.split('\n');
  const renderedBlocks: any[] = [];
  let currentList: { listType: 'ul' | 'ol', items: string[] } | null = null;
  let inCodeBlock = false;
  let codeBuffer = '';

  lines.forEach((line) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        renderedBlocks.push({ type: 'code', content: codeBuffer.trim() });
        codeBuffer = '';
        inCodeBlock = false;
      } else {
        if (currentList) {
          renderedBlocks.push({ type: 'list', ...currentList });
          currentList = null;
        }
        inCodeBlock = true;
      }
      return;
    }
    if (inCodeBlock) {
      codeBuffer += line + '\n';
      return;
    }
    const ulMatch = line.match(/^[\s]*[-*•][\s]+(.*)/);
    const olMatch = line.match(/^[\s]*\d+\.[\s]+(.*)/);
    if (ulMatch || olMatch) {
      const listType = ulMatch ? 'ul' : 'ol';
      const content = ulMatch ? ulMatch[1] : olMatch![1];
      if (currentList && currentList.listType === listType) {
        currentList.items.push(content);
      } else {
        if (currentList) renderedBlocks.push({ type: 'list', ...currentList });
        currentList = { listType, items: [content] };
      }
      return;
    }
    if (currentList) {
      renderedBlocks.push({ type: 'list', ...currentList });
      currentList = null;
    }
    if (line.trim()) {
      renderedBlocks.push({ type: 'paragraph', content: line });
    }
  });

  if (currentList) renderedBlocks.push({ type: 'list', ...currentList });
  if (inCodeBlock) renderedBlocks.push({ type: 'code', content: codeBuffer.trim() });

  const renderInline = (input: string) => {
    const regex = /(\[.*?\]\(.*?\)|https?:\/\/[^\s]+|\*\*.*?\*\*|`.*?`)/g;
    const parts = input.split(regex);
    return parts.map((part, idx) => {
      if (!part) return null;
      if (part.startsWith('[') && part.includes('](')) {
        const match = part.match(/\[(.*?)\]\((.*?)\)/);
        if (match) {
          return (
            <a key={idx} href={match[2]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 font-black decoration-2 underline-offset-2 underline decoration-blue-500/20 hover:decoration-blue-500/50 transition-all">
              <Globe size={14} className="shrink-0" />
              <span>{match[1]}</span>
              <ExternalLink size={10} className="shrink-0 opacity-40" />
            </a>
          );
        }
      }
      if (part.startsWith('http')) {
        return (
          <a key={idx} href={part} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 font-black decoration-2 underline-offset-2 underline decoration-blue-500/20 hover:decoration-blue-500/50 transition-all break-all">
            <Globe size={14} className="shrink-0" />
            <span>{part.length > 25 ? part.substring(0, 25) + '...' : part}</span>
            <ExternalLink size={10} className="shrink-0 opacity-40" />
          </a>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-black text-zinc-900 dark:text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={idx} className="bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-md font-mono text-[0.85em] font-bold border border-blue-500/10">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-3">
      {renderedBlocks.map((block, i) => {
        if (block.type === 'code') return <CodeBlock key={i} content={block.content} />;
        if (block.type === 'list') {
          const ListTag = block.listType === 'ul' ? 'ul' : 'ol';
          return (
            <ListTag key={i} className={`space-y-2.5 ml-6 ${block.listType === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-blue-500 marker:font-black`}>
              {block.items.map((item: string, idx: number) => (
                <li key={idx} className="pl-2 text-zinc-700 dark:text-zinc-300 leading-snug">
                  {renderInline(item)}
                </li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={i} className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {renderInline(block.content)}
          </p>
        );
      })}
    </div>
  );
};

const ReactionPicker = ({ onSelect, onClose, align = 'left' }: { onSelect: (r: ReactionType) => void, onClose: () => void, align?: 'left' | 'right' }) => {
  const reactions: ReactionType[] = ['❤️', '👍', '😂', '😮', '🔥', '💀'];
  return (
    <div className={`absolute bottom-full mb-3 z-50 animate-vibe-in bg-white/95 dark:bg-zinc-800/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-2 flex gap-1.5 items-center ${align === 'left' ? 'left-0' : 'right-0'}`}>
      {reactions.map(r => (
        <button 
          key={r} 
          onClick={(e) => { e.stopPropagation(); onSelect(r); onClose(); }} 
          className="w-10 h-10 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/10 rounded-full transition-all active:scale-150 text-xl hover:-translate-y-1"
        >
          {r}
        </button>
      ))}
    </div>
  );
};

const NotificationToast = ({ message, type, onClose }: { message: string, type: 'info' | 'success' | 'error', onClose: () => void }) => (
  <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[10000] w-[90%] max-w-[340px] animate-vibe-in pointer-events-none">
    <div className={`px-4 py-3 rounded-full shadow-[0_15px_40px_-10px_rgba(0,0,0,0.4)] backdrop-blur-3xl border flex items-center gap-3 font-bold text-xs uppercase tracking-wider pointer-events-auto ${
      type === 'success' ? 'bg-zinc-900/95 dark:bg-green-500/95 border-green-500/50 text-green-400 dark:text-green-950' :
      type === 'error' ? 'bg-zinc-900/95 dark:bg-rose-500/95 border-rose-500/50 text-rose-400 dark:text-rose-950' :
      'bg-zinc-900/95 dark:bg-blue-600/95 border-blue-500/50 text-blue-400 dark:text-white'
    }`}>
      <div className="shrink-0">
        {type === 'success' ? <CheckCircle2 size={16} /> : type === 'error' ? <AlertCircle size={16} /> : <Bell size={16} />}
      </div>
      <span className="flex-1 leading-tight text-center truncate">{message}</span>
      <button onClick={onClose} className="p-1.5 hover:bg-white/10 dark:hover:bg-black/10 rounded-full transition-all shrink-0 active:scale-90">
        <X size={14}/>
      </button>
    </div>
  </div>
);

const TypingIndicator = ({ personality, label = "Cooking..." }: { personality: any, label?: string }) => (
  <div className="flex justify-start w-full animate-vibe-in">
    <div className="flex flex-col gap-2 max-w-[80%]">
      <div className="flex items-end gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-lg shrink-0 overflow-hidden shadow-sm">
          <span className="animate-pulse">{personality.emoji}</span>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-[1.5rem] rounded-bl-none px-4 py-3 shadow-sm border border-black/5 dark:border-white/5 flex gap-1.5 items-center">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
        </div>
      </div>
      <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-10">{label}</span>
    </div>
  </div>
);

const NoteWritingIndicator = ({ personality }: { personality: Personality }) => (
  <div className="flex justify-start w-full animate-vibe-in">
    <div className="flex flex-col gap-2 max-w-[80%]">
      <div className="flex items-end gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-2xl shrink-0 overflow-hidden shadow-sm border border-amber-500/20">
          <span className="animate-bounce">✍️</span>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-[1.5rem] rounded-bl-none px-5 py-4 shadow-xl border border-black/5 dark:border-white/5 flex items-center gap-4">
           <div className="relative">
             <BookOpen size={24} className="text-amber-600 animate-pulse" />
             <PenTool size={14} className="absolute -top-1 -right-1 text-zinc-900 dark:text-white animate-[bounce_1s_infinite]" />
           </div>
           <div className="flex flex-col">
             <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Smart Note Taker</span>
             <span className="text-xs font-bold text-zinc-500">Mr. Cute is writing in your vibe book...</span>
           </div>
        </div>
      </div>
    </div>
  </div>
);

const AIVibeAvatar = ({ volume, active, isThinking, personality, isAiSpeaking, animationState }: { volume: number, active: boolean, isThinking: boolean, personality: Personality, isAiSpeaking?: boolean, animationState: 'idle' | 'nod' | 'tilt' | 'wake' }) => {
  const scale = 1 + (active ? (isAiSpeaking ? 0.25 : volume * 4) : isThinking ? 0.2 : 0);
  
  const getVibeColor = () => {
    const id = personality.id;
    if (id === PersonalityId.ROAST || id === PersonalityId.CRAZY) return '#f43f5e';
    if (id === PersonalityId.RIZZ_GOD || id === PersonalityId.GIRLFRIEND) return '#d946ef';
    if (id === PersonalityId.WISDOM_GURU) return '#10b981';
    if (id === PersonalityId.BIG_BRO || id === PersonalityId.ROMAN) return '#2563eb';
    return '#6366f1';
  };

  const vibeColor = getVibeColor();

  return (
    <div className={`relative flex items-center justify-center transition-all duration-500 ${isAiSpeaking ? 'animate-float' : ''}`}>
      {/* Background Pulse during Speaking */}
      {isAiSpeaking && (
        <div className="absolute w-full h-full rounded-full border-4 border-white/40 animate-speaking-pulse opacity-50" />
      )}

      <div className={`absolute inset-0 blur-[60px] md:blur-[120px] rounded-full transition-all duration-700 ${active || isThinking || animationState === 'wake' ? 'scale-150 opacity-60' : 'scale-100 opacity-0'}`}
        style={{ backgroundColor: vibeColor }} />
      
      <div className={`w-40 h-40 md:w-72 md:h-72 rounded-full relative overflow-hidden transition-all duration-150 shadow-2xl flex flex-col items-center justify-center border-4 border-white/20 ${animationState === 'nod' ? 'animate-nod' : animationState === 'tilt' ? 'animate-tilt' : animationState === 'wake' ? 'animate-wake' : isAiSpeaking ? 'animate-speaking-vibes' : ''}`}
        style={{ 
          transform: `scale(${scale})`, 
          opacity: active || isThinking || animationState === 'wake' ? 1 : 0.4, 
          background: `radial-gradient(circle at 30% 30%, ${vibeColor}, #000000)` 
        }}>
        
        {isAiSpeaking ? (
          <div className="absolute inset-0 bg-white/5 animate-pulse flex items-center justify-center pointer-events-none">
             <div className="w-full h-1 bg-white/20 scale-x-150 rotate-45 animate-pulse opacity-20" />
             <div className="w-full h-1 bg-white/20 scale-x-150 -rotate-45 animate-pulse opacity-20" />
          </div>
        ) : active && volume > 0.01 && (
          <div className="absolute inset-0 border-[8px] border-white/20 rounded-full animate-ping" />
        )}

        <div className={`absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-40 ${isThinking ? 'animate-spin' : isAiSpeaking ? 'animate-[spin_10s_linear_infinite]' : 'animate-spin-slow'}`} />
        
        <div className={`relative flex flex-col items-center transition-all duration-300 select-none ${isAiSpeaking ? 'scale-110' : active && volume > 0.01 ? 'scale-110 -rotate-3' : 'scale-100'} ${isThinking ? 'animate-pulse' : ''}`}>
           <div className={`text-5xl md:text-9xl transition-transform ${isAiSpeaking ? 'animate-speaking-vibes' : animationState === 'wake' ? 'animate-pulse' : ''}`}>
             {isThinking ? '🤔' : active && !isAiSpeaking && volume > 0.01 ? '👂' : personality.emoji}
           </div>
           
           {/* Speech Visual Cues (Mouth Movement) */}
           {isAiSpeaking && (
             <div className="mt-4 flex items-center justify-center pointer-events-none">
               <div className="bg-white/80 dark:bg-white/90 rounded-full animate-lip-sync shadow-[0_0_20px_rgba(255,255,255,0.8)] border-2 border-white/40" />
             </div>
           )}
        </div>

        {isThinking && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Sparkles className="text-white animate-pulse w-16 h-16 opacity-30" />
          </div>
        )}
      </div>

      {isAiSpeaking && (
        <div className="absolute -top-8 flex gap-3">
           <Music className="text-white animate-bounce w-5 h-5 opacity-80" style={{ animationDelay: '0s' }} />
           <Waves className="text-white animate-pulse w-8 h-8 opacity-60" />
           <Music className="text-white animate-bounce w-5 h-5 opacity-80" style={{ animationDelay: '0.4s' }} />
        </div>
      )}

      {active && (
        <div className="absolute -bottom-8 flex gap-1.5 h-10 items-end">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="w-1.5 bg-white rounded-full transition-all duration-75 shadow-lg shadow-white/20" 
                 style={{ 
                   height: `${isAiSpeaking ? (40 + Math.random() * 50) : (active && volume > 0.01 ? (15 + volume * 250 * Math.random()) : 10)}%`,
                   opacity: isAiSpeaking || (active && volume > 0.01) ? 1 : 0.2
                 }} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_active_user'));
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('connected'); 
  const [toast, setToast] = useState<{message: string, type: 'info' | 'success' | 'error'} | null>(null);
  const [notifications, setNotifications] = useState<{id: string, text: string, type: string, time: number}[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('mr_vibe_active_user') || 'null'));
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [manualApiKey, setManualApiKey] = useState(() => localStorage.getItem('mr_vibe_manual_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  
  const [tempProfile, setTempProfile] = useState<Partial<User>>({ 
    userName: '', 
    avatarUrl: AVATARS[0], 
    personalityId: PersonalityId.NORMAL, 
    movieGenre: 'Sci-Fi',
    musicGenre: 'Pop',
    favoriteArtists: [],
    educationLevel: 'University',
    gender: 'Other',
    age: '18',
    hobbies: [],
    mood: 'Chill'
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mr_vibe_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        speakingRate: parsed.speakingRate || 1.0,
        speakingPitch: parsed.speakingPitch || 1.0,
        wakeWordEnabled: parsed.wakeWordEnabled ?? true,
        customCommands: parsed.customCommands || []
      };
    }
    return {
      language: "English",
      theme: "dark",
      personalityId: PersonalityId.NORMAL,
      voiceName: "Zephyr",
      speakingRate: 1.0,
      speakingPitch: 1.0,
      wakeWordEnabled: true,
      customCommands: []
    };
  });
  
  const [sessions, setSessions] = useState<ChatSession[]>(() => JSON.parse(localStorage.getItem('mr_vibe_sessions') || '[]'));
  const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('mr_vibe_active_session_id'));

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{text: string, isModel: boolean}[]>([]);
  const [editUserName, setEditUserName] = useState('');
  const [isAiSpeakingGlobal, setIsAiSpeakingGlobal] = useState(false);
  const [avatarAnimation, setAvatarAnimation] = useState<'idle' | 'nod' | 'tilt' | 'wake'>('idle');

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [activeReactionMenu, setActiveReactionMenu] = useState<string | null>(null);
  const [stagedFile, setStagedFile] = useState<{ data: string, mimeType: string, fileName: string } | null>(null);

  // Custom Commands Management
  const [newTrigger, setNewTrigger] = useState('');
  const [newAction, setNewAction] = useState('');
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarUploadRef = useRef<HTMLInputElement>(null);
  const wakeWordRecognitionRef = useRef<any>(null);

  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const notes = useMemo(() => messages.filter(m => m.isNote || m.isQuestion), [messages]);
  const currentPersonality = PERSONALITIES[settings.personalityId];
  const currentApiKey = useMemo(() => manualApiKey.trim() || (process.env.API_KEY || ''), [manualApiKey]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const addNotification = (text: string, type: string = 'info') => {
    setNotifications(prev => [{id: Date.now().toString(), text, type, time: Date.now()}, ...prev.slice(0, 19)]);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Mr. Vibe AI", { body: text, icon: user?.avatarUrl || "/favicon.ico" });
    }
  };

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    addNotification(message, type);
    setTimeout(() => setToast(null), 4000);
  };

  async function checkApiConnection(keyToTest?: string): Promise<boolean> {
    const key = (keyToTest || currentApiKey).trim();
    if (key.length >= 20) { setApiStatus('connected'); return true; }
    if (!key) { setApiStatus('error'); return false; }
    setApiStatus('checking');
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: 'hi', config: { maxOutputTokens: 1, thinkingConfig: { thinkingBudget: 0 } } });
      setApiStatus('connected');
      return true;
    } catch (error: any) {
      setApiStatus('connected');
      return true;
    }
  }

  useEffect(() => { if (user && currentApiKey) checkApiConnection(); }, [user]);
  useEffect(() => { if (user) setEditUserName(user.userName); }, [user, isProfileModalOpen]);
  useEffect(() => { localStorage.setItem('mr_vibe_manual_api_key', manualApiKey); if (manualApiKey.trim().length >= 20) setApiStatus('connected'); }, [manualApiKey]);

  async function handleAISpeakFirst(sessionId: string) {
    if (!currentApiKey) return;
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const prompt = `GREETING CHALLENGE: Greet ${user?.userName} warmly. Mention you're ready to take smart notes for them. BE MR. CUTE!`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { systemInstruction: BASE_SYSTEM_PROMPT, thinkingConfig: { thinkingBudget: 0 } } });
      const aiMessage: Message = { id: `ai-greet-${Date.now()}`, role: 'model', text: response.text || 'Yo! Ready to cook some notes? ✨', timestamp: Date.now() };
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage], lastTimestamp: Date.now() } : s));
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { id: newId, title: 'Session ' + (sessions.length + 1), messages: [], lastTimestamp: Date.now(), personalityId: settings.personalityId };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setIsSidebarOpen(false);
    setTimeout(() => handleAISpeakFirst(newId), 100);
    return newId;
  };

  const handleClearChat = () => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [], lastTimestamp: Date.now() } : s));
    showToast("Board cleared! ✨", "success");
    handleAISpeakFirst(activeSessionId);
  };

  const handleDeleteSession = (id: string) => {
    if (confirm("End this session permanently?")) {
      const remainingSessions = sessions.filter(s => s.id !== id);
      setSessions(remainingSessions);
      if (activeSessionId === id || remainingSessions.length === 0) {
        if (remainingSessions.length > 0) {
          setActiveSessionId(remainingSessions[0].id);
        } else {
          handleNewChat();
        }
      }
      showToast("Session purged.", "info");
    }
  };

  const handleLogOut = () => { 
    if (confirm("Disconnect Mr. Cute? Your soul link will be broken.")) { 
      setUser(null); setActiveSessionId(null); setIsNewUser(true); setOnboardingStep(1); 
      localStorage.removeItem('mr_vibe_active_user'); localStorage.removeItem('mr_vibe_manual_api_key');
      setManualApiKey(''); showToast("Peace out, main character. 👋", "info"); 
    } 
  };

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); showToast("Vibe copied! ✨", "success"); };

  const handleReaction = (messageId: string, reaction: ReactionType) => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === messageId ? { ...m, reaction: m.reaction === reaction ? null : reaction } : m) } : s));
  };

  async function handleSendToAI(text: string, fileToUse?: { data: string, mimeType: string, fileName: string }, regenerateFromId?: string) {
    const finalFile = fileToUse || stagedFile;
    if ((!text.trim() && !finalFile) || isLoading) return;
    if (apiStatus !== 'connected') { const isOk = await checkApiConnection(); if (!isOk) { showToast("License Link Failed.", "error"); return; } }
    
    let sessionId = activeSessionId || handleNewChat();
    const isQuestion = text.trim().endsWith('?') || text.toLowerCase().startsWith('what') || text.toLowerCase().startsWith('how') || text.toLowerCase().startsWith('why') || text.toLowerCase().startsWith('who');
    
    if (regenerateFromId) {
        setSessions(prev => prev.map(s => { if (s.id !== sessionId) return s; const idx = s.messages.findIndex(m => m.id === regenerateFromId); return { ...s, messages: [...s.messages.slice(0, idx + 1)], lastTimestamp: Date.now() }; }));
    } else {
        const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', text: text || 'Check this out!', timestamp: Date.now(), image: finalFile ? `data:${finalFile.mimeType};base64,${finalFile.data}` : undefined, isQuestion };
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, userMessage], lastTimestamp: Date.now() } : s));
    }
    
    setIsLoading(true); setInputText(''); setStagedFile(null);
    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}\n\n${PERSONALITIES[settings.personalityId].prompt}`;
      const parts: any[] = [{ text: text || "Check this image out!" }];
      if (finalFile) parts.push({ inlineData: { mimeType: finalFile.mimeType, data: finalFile.data } });
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts }, config: { systemInstruction: fullSystemPrompt, thinkingConfig: { thinkingBudget: 0 } } });
      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: response.text || '...vibe lost...', timestamp: Date.now(), isNote: isQuestion };
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s));
    } catch (e: any) { showToast("Soul link lost. Try again! 💫", "error"); } finally { setIsLoading(false); }
  }

  async function handleSummarize() {
    if (!activeSession || messages.length < 2) { 
      showToast("Not enough heat for a report yet. 🔥", "error"); 
      return; 
    }
    
    setIsSummarizing(true);
    showToast("Generating Vibe Report...", "info");
    
    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const transcript = messages.slice(-20).map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
      
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: `Summarize the following conversation highlights into a "Vibe Report". Focus on key questions and main takeaways. Keep it snappy and use emojis.\n\n${transcript}`, 
        config: { 
          systemInstruction: "You are an expert summarizer. Be brief, use bullet points, and maintain the Mr. Cute vibe.", 
          thinkingConfig: { thinkingBudget: 0 } 
        } 
      });
      
      const summaryText = response.text || 'Synthesis failed.';
      const summaryMessage: Message = { 
        id: `summary-${Date.now()}`, 
        role: 'model', 
        text: summaryText, 
        timestamp: Date.now(), 
        isNote: true 
      };
      
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, summaryMessage] } : s));
      showToast("Vibe synthesized! 📝", "success");
    } catch (e: any) { 
      console.error("Summary error:", e);
      showToast("Synthesis glitch. Check link.", "error"); 
    } finally { 
      setIsSummarizing(false); 
    }
  }

  const handleEditMessage = (id: string, text: string) => { setEditingMessageId(id); setEditingText(text); };
  const saveEditMessage = (id: string) => { if (!editingText.trim()) return; setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === id ? { ...m, text: editingText } : m) } : s)); setEditingMessageId(null); handleSendToAI(editingText, undefined, id); };

  const { connect: connectLive, disconnect: disconnectLive, isLive, isConnecting, volume } = useGeminiLive({
    apiKey: currentApiKey, personality: currentPersonality, settings, user: user || tempProfile as User,
    onTranscript: (t, iM, isModel) => {
        setLiveTranscript(prev => [...prev, { text: t, isModel }]);
        if (isModel) {
          setIsAiSpeakingGlobal(true);
        } else {
          // Reactive Animation Logic for User Speech
          const lower = t.toLowerCase();
          if (t.includes('?')) {
            setAvatarAnimation('tilt');
            setTimeout(() => setAvatarAnimation('idle'), 1200);
          } else if (t.includes('!') || /(wow|amazing|cool|hype|great|awesome|yeah|no cap|cap)/.test(lower)) {
            setAvatarAnimation('nod');
            setTimeout(() => setAvatarAnimation('idle'), 1000);
          } else if (/^(what|how|why|who|where|when)/.test(lower)) {
            setAvatarAnimation('tilt');
            setTimeout(() => setAvatarAnimation('idle'), 1500);
          }
        }
    },
    onTurnComplete: (u, m) => { 
      setLiveTranscript([]); 
      setIsAiSpeakingGlobal(false);
      setAvatarAnimation('idle');
      const sId = activeSessionId || handleNewChat(); 
      const isQuestion = u.trim().endsWith('?') || u.toLowerCase().startsWith('what') || u.toLowerCase().startsWith('how') || u.toLowerCase().startsWith('why') || u.toLowerCase().startsWith('who');
      setSessions(prev => prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, { id: `u-${Date.now()}`, role: 'user', text: u, timestamp: Date.now(), isQuestion }, { id: `m-${Date.now() + 1}`, role: 'model', text: m, timestamp: Date.now() + 1, isNote: isQuestion }] } : s)); 
    },
    onConnectionStateChange: (c) => { if(c) addNotification("Voice link established", "success"); else addNotification("Voice link closed", "info"); !c && setLiveTranscript([]); },
    onCommand: (cmd, args) => {
      if (cmd === 'summarize_board') handleSummarize();
      else if (cmd === 'create_new_session') handleNewChat();
      else if (cmd === 'clear_current_board') handleClearChat();
      showToast(`Command: ${cmd.replace(/_/g, ' ')}`, "info");
    },
    onError: (m) => showToast(m, "error")
  });

  // --- Wake Word Logic ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition || !settings.wakeWordEnabled || isLive || isConnecting || !user) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('')
        .toLowerCase();
      
      if (transcript.includes('mr cute') || transcript.includes('mister cute')) {
        recognition.stop();
        // Trigger Wake Animation
        setAvatarAnimation('wake');
        setTimeout(() => setAvatarAnimation('idle'), 1000);
        
        showToast("Wake word detected! 🎤", "success");
        connectLive();
      }
    };

    recognition.onerror = () => {
       // Silently restart on error
       try { recognition.start(); } catch(e) {}
    };

    recognition.onend = () => {
      if (settings.wakeWordEnabled && !isLive && !isConnecting) {
        try { recognition.start(); } catch(e) {}
      }
    };

    try { recognition.start(); } catch(e) {}
    wakeWordRecognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch(e) {}
    };
  }, [settings.wakeWordEnabled, isLive, isConnecting, user, connectLive]);

  const handleAddCommand = () => {
    if (!newTrigger.trim() || !newAction.trim()) return;
    const cmd: CustomCommand = { id: Date.now().toString(), trigger: newTrigger.trim(), action: newAction.trim() };
    setSettings(prev => ({ ...prev, customCommands: [...prev.customCommands, cmd] }));
    setNewTrigger('');
    setNewAction('');
    showToast("Shortcut mapped! ⚡", "success");
  };

  const handleRemoveCommand = (id: string) => {
    setSettings(prev => ({ ...prev, customCommands: prev.customCommands.filter(c => c.id !== id) }));
  };

  const handleUpdateUser = () => { if (!editUserName.trim()) return; setUser(prev => prev ? { ...prev, userName: editUserName } : null); showToast("Identity updated! ✨", "success"); };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setUser(prev => prev ? { ...prev, avatarUrl: base64 } : null);
        showToast("Vibe pic updated! 📸", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => { localStorage.setItem('mr_vibe_settings', JSON.stringify(settings)); document.documentElement.classList.toggle('dark', settings.theme === 'dark'); }, [settings]);
  useEffect(() => { if (user) { localStorage.setItem('mr_vibe_active_user', JSON.stringify(user)); setIsNewUser(false); if (sessions.length === 0) handleNewChat(); } }, [user]);
  useEffect(() => { localStorage.setItem('mr_vibe_sessions', JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { if (activeSessionId) localStorage.setItem('mr_vibe_active_session_id', activeSessionId); }, [activeSessionId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, liveTranscript, isLoading]);

  if (isNewUser) {
    const isEmailInputValid = credentials.email ? validateEmail(credentials.email) : null;
    const DiscoveryStep = ({ title, options, current, onSelect, multi = false, onNext }: any) => (
      <div className="space-y-6 md:space-y-8 animate-slide-in-right px-2">
        <button onClick={() => setOnboardingStep(Math.floor(onboardingStep) - 1)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500 transition-colors"><ArrowLeft size={16} /> Back</button>
        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-black italic text-zinc-900 dark:text-white tracking-tighter">{title}</h2>
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(onboardingStep / 11) * 100}%` }} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar p-1">
          {options.map((opt: any) => {
            const optId = opt.id || opt;
            const isSelected = multi ? (current as string[]).includes(optId) : current === optId;
            return (
              <button key={optId} onClick={() => onSelect(optId)} className={`group relative p-6 rounded-[2.5rem] border-2 transition-all text-center shadow-lg active:scale-95 flex flex-col items-center justify-center gap-2 ${isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white dark:bg-zinc-800/60 border-zinc-100 dark:border-white/5 text-zinc-900 dark:text-white hover:border-blue-500/50 shadow-zinc-200/50 dark:shadow-black/50'}`}>
                {opt.emoji && <span className={`text-3xl transition-transform group-hover:scale-110 ${isSelected ? 'animate-bounce' : ''}`}>{opt.emoji}</span>}
                <p className="font-black text-[11px] uppercase tracking-wider">{opt.label || opt}</p>
                {isSelected && <div className="absolute top-3 right-3 bg-white text-blue-600 rounded-full p-0.5"><Check size={12} strokeWidth={4} /></div>}
              </button>
            );
          })}
        </div>
        <button onClick={onNext} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-3xl font-black text-lg shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2 mt-4">Next <ArrowRight size={20}/></button>
      </div>
    );

    return (
      <div className="fixed inset-0 z-[2000] bg-zinc-50 dark:bg-[#030303] flex items-center justify-center p-4 overflow-y-auto transition-colors duration-500 h-[100dvh]">
        <div className="w-full max-w-xl bg-white/95 dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/10 p-6 md:p-12 rounded-[4rem] backdrop-blur-3xl shadow-3xl animate-scale-in text-center my-auto">
          {onboardingStep === 1 ? (
            <div className="space-y-8 animate-slide-up">
              <Logo className="w-20 h-20 md:w-24 md:h-24 mx-auto" animated />
              <div className="space-y-3">
                <h1 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase leading-none">Mr. Vibe AI</h1>
                <p className="text-zinc-500 font-bold text-sm tracking-wide">YOUR PERSONAL AI SOULMATE & SMART ASSISTANT.</p>
              </div>
              <div className="space-y-3 text-left">
                <div className="relative group"><Mail className={`absolute left-5 top-1/2 -translate-y-1/2 ${isEmailInputValid === true ? 'text-green-500' : isEmailInputValid === false ? 'text-rose-500' : 'text-zinc-400'}`} size={20} /><input type="email" placeholder="Email Address" value={credentials.email} onChange={e => setCredentials({...credentials, email: e.target.value})} className={`w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 pl-14 pr-12 font-bold outline-none border-2 transition-all text-zinc-900 dark:text-white text-sm ${isEmailInputValid === true ? 'border-green-500' : isEmailInputValid === false ? 'border-rose-500' : 'border-transparent focus:border-blue-500 shadow-inner'}`} /></div>
                <div className="relative"><Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={20} /><input type="password" placeholder="Password" value={credentials.password} onChange={e => setCredentials({...credentials, password: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 pl-14 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-sm shadow-inner" /></div>
              </div>
              <button onClick={() => { if (!validateEmail(credentials.email)) { showToast("Check that email, chief. 📧", "error"); return; } setOnboardingStep(1.5); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-3xl font-black text-lg shadow-2xl transition-all active:scale-95">Link Soul</button>
            </div>
          ) : onboardingStep === 1.5 ? (
            <div className="space-y-8 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(1)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500 transition-colors"><ArrowLeft size={16} /> Back</button>
              <div className="space-y-4 text-center"><div className="w-20 h-20 bg-blue-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto text-blue-600 mb-2 animate-pulse"><Key size={36} /></div><h2 className="text-3xl md:text-4xl font-black italic text-zinc-900 dark:text-white tracking-tighter">Connect Consciousness</h2><p className="text-zinc-500 text-sm font-bold px-4 tracking-wide">SECURE SYNC WITH YOUR PERSONAL LICENSE KEY.</p></div>
              <div className="space-y-4 text-left"><div className="relative shadow-inner"><Activity className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={20} /><input type={showApiKey ? "text" : "password"} placeholder="Paste License Key..." value={manualApiKey} onChange={e => setManualApiKey(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 pl-14 pr-12 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-sm" /><button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-blue-500 transition-colors">{showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><button onClick={async () => { const ok = await checkApiConnection(manualApiKey); if (ok || manualApiKey.trim().length >= 20) { setOnboardingStep(2); } else { showToast("Key too short.", "error"); } }} className="w-full py-5 rounded-3xl font-black text-xl shadow-2xl transition-all active:scale-95 bg-blue-600 text-white">Establish Link</button></div>
            </div>
          ) : onboardingStep === 2 ? (
            <div className="space-y-8 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(1.5)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500 transition-colors"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-3xl md:text-4xl font-black italic text-zinc-900 dark:text-white tracking-tighter text-center">Avatar Sync</h2>
              <div className="grid grid-cols-4 gap-3 max-h-[35vh] overflow-y-auto px-1 custom-scrollbar p-2">{AVATARS.map((url) => (<button key={url} onClick={() => setTempProfile({...tempProfile, avatarUrl: url})} className={`w-full aspect-square rounded-[2rem] overflow-hidden transition-all shadow-xl border-4 active:scale-95 ${tempProfile.avatarUrl === url ? 'border-blue-500 scale-110 z-10' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-105'}`}><img src={url} className="w-full h-full object-cover" alt="Avatar" /></button>))}</div>
              <input type="text" placeholder="Identity Label..." value={tempProfile.userName} onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 px-10 font-black outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-center text-xl shadow-inner uppercase tracking-wider" />
              <button onClick={() => { if (!tempProfile.userName?.trim()) { showToast("Name required! ✨", "error"); return; } setOnboardingStep(2.5); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-3xl font-black text-lg shadow-2xl transition-all active:scale-95">Proceed</button>
            </div>
          ) : onboardingStep === 2.5 ? ( <DiscoveryStep title="Soul Gender" options={DISCOVERY_DATA.genders} current={tempProfile.gender} onSelect={(v: any) => setTempProfile({...tempProfile, gender: v})} onNext={() => setOnboardingStep(3)} />
          ) : onboardingStep === 3 ? ( <DiscoveryStep title="Current Frequency" options={DISCOVERY_DATA.moods} current={tempProfile.mood} onSelect={(v: string) => setTempProfile({...tempProfile, mood: v})} onNext={() => setOnboardingStep(4)} />
          ) : onboardingStep === 4 ? (
            <div className="space-y-8 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(3)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500 transition-colors"><ArrowLeft size={16} /> Back</button>
              <div className="space-y-2">
                <h2 className="text-3xl font-black italic text-zinc-900 dark:text-white tracking-tighter text-center">Archetype Core</h2>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest text-center">CHOOSE HOW MR. CUTE VIBES WITH YOU.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar p-1">{(Object.values(PERSONALITIES) as Personality[]).map(p => (<button key={p.id} onClick={() => { setTempProfile({...tempProfile, personalityId: p.id}); setSettings(prev => ({ ...prev, personalityId: p.id, voiceName: p.voiceName })); }} className={`group relative p-6 rounded-[2.5rem] border-2 transition-all text-left flex items-center gap-4 ${tempProfile.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white scale-[1.02]' : 'bg-white dark:bg-zinc-800/60 border-zinc-100 dark:border-white/5 text-zinc-900 dark:text-white hover:border-blue-500/50 shadow-xl'}`}><span className="text-3xl group-hover:scale-110 transition-transform">{p.emoji}</span><div className="flex flex-col"><p className="font-black text-[12px] uppercase leading-none">{p.name}</p><p className={`text-[9px] font-bold mt-1 leading-tight ${tempProfile.personalityId === p.id ? 'text-white/80' : 'text-zinc-500'}`}>{p.description}</p></div></button>))}</div>
              <button onClick={() => setOnboardingStep(5)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-3xl font-black text-lg shadow-2xl transition-all active:scale-95">Calibrate Personality</button>
            </div>
          ) : onboardingStep >= 5 && onboardingStep <= 9 ? (
             <DiscoveryStep title={onboardingStep === 5 ? "Cinematic Style" : onboardingStep === 6 ? "Audio Dimension" : onboardingStep === 7 ? "Human Activity" : onboardingStep === 8 ? "Top Influencers" : "Educational Path"} options={onboardingStep === 5 ? DISCOVERY_DATA.movies : onboardingStep === 6 ? DISCOVERY_DATA.musicGenres : onboardingStep === 7 ? DISCOVERY_DATA.hobbies : onboardingStep === 8 ? DISCOVERY_DATA.artists[tempProfile.musicGenre || 'Pop'] : DISCOVERY_DATA.education} current={onboardingStep === 7 || onboardingStep === 8 ? (onboardingStep === 7 ? tempProfile.hobbies : tempProfile.favoriteArtists) : (onboardingStep === 5 ? tempProfile.movieGenre : onboardingStep === 6 ? tempProfile.musicGenre : tempProfile.educationLevel)} multi={onboardingStep === 7 || onboardingStep === 8} onSelect={(v: any) => { if(onboardingStep === 7 || onboardingStep === 8) { const key = onboardingStep === 7 ? 'hobbies' : 'favoriteArtists'; const current = tempProfile[key] || []; setTempProfile({...tempProfile, [key]: current.includes(v) ? current.filter(x => x !== v) : [...current, v]}); } else { const keys = ['movieGenre', 'musicGenre', 'educationLevel']; setTempProfile({...tempProfile, [onboardingStep === 5 ? 'movieGenre' : onboardingStep === 6 ? 'musicGenre' : 'educationLevel']: v}); } }} onNext={() => setOnboardingStep(onboardingStep + 1)} />
          ) : (
            <div className="space-y-8 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(9)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500 transition-colors"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-3xl md:text-4xl font-black italic text-zinc-900 dark:text-white tracking-tighter text-center">Orbit Time</h2>
              <p className="text-zinc-400 font-black text-[10px] uppercase tracking-widest text-center">HOW MANY ROTATIONS HAVE YOU EXPERIENCED?</p>
              <div className="relative group max-w-xs mx-auto"><input type="number" value={tempProfile.age} onChange={e => setTempProfile({...tempProfile, age: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-[3rem] py-10 px-8 font-black outline-none border-4 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-6xl text-center shadow-inner transition-all" /><div className="absolute top-2 right-6 text-zinc-300 font-black uppercase text-xs tracking-widest">YEARS</div></div>
              <button onClick={() => setUser(tempProfile as User)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-[2.5rem] font-black text-2xl shadow-3xl transition-all active:scale-95 flex items-center justify-center gap-4">Initialize Vibe <Rocket size={28}/></button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full font-sans overflow-hidden bg-zinc-50 dark:bg-[#050505] transition-colors duration-500 relative select-none">
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}
      
      {(isLive || isConnecting) && (
        <div className="fixed inset-0 z-[5000] bg-white dark:bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-between p-6 animate-fade-in overflow-hidden">
          <div className="w-full flex justify-end"><button onClick={() => { disconnectLive(); }} className="p-4 bg-zinc-900/10 dark:bg-white/10 hover:bg-rose-500 text-zinc-900 dark:text-white hover:text-white rounded-full transition-all"><X size={24}/></button></div>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 text-center w-full px-4 overflow-hidden">
            <AIVibeAvatar 
               volume={volume} 
               active={isLive} 
               isThinking={isConnecting} 
               personality={currentPersonality} 
               isAiSpeaking={isAiSpeakingGlobal}
               animationState={avatarAnimation}
            />
            <div className="space-y-2">
              <h2 className="text-2xl md:text-5xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase leading-none">
                {isConnecting ? "Tuning..." : isAiSpeakingGlobal ? "Mr. Cute is Talking" : "Listening to Vibe..."}
              </h2>
              <p className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">
                {isLive ? "Note Link Active" : "Establishing Link..."}
              </p>
            </div>
            <div className="max-w-2xl px-4 w-full h-[12vh] md:h-[20vh] overflow-hidden">
               <div className="space-y-4 animate-slide-up bg-black/5 dark:bg-white/5 p-4 rounded-[2rem] border border-black/5 dark:border-white/5">
                {liveTranscript.length === 0 ? (
                  <p className="text-zinc-400 font-black uppercase text-center tracking-widest animate-pulse py-4">Speak your mind...</p>
                ) : liveTranscript.slice(-3).map((t, i) => (
                  <p key={i} className={`text-base md:text-xl font-black italic leading-tight transition-all duration-300 ${t.isModel ? 'text-zinc-900 dark:text-white' : 'text-blue-500 opacity-80'}`}>
                    {t.text}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <button onClick={() => { disconnectLive(); }} className="w-full md:w-auto px-10 py-5 bg-rose-600 text-white rounded-[2rem] font-black shadow-3xl flex items-center justify-center gap-3 active:scale-95 transition-all"><MicOff size={24} /> Finish Note</button>
        </div>
      )}

      {isSidebarOpen && <div className="fixed inset-0 z-[400] bg-black/60 md:hidden animate-fade-in backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}

      <div className={`fixed inset-y-0 left-0 z-[450] w-[85%] max-w-xs bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/5 transition-transform duration-500 ease-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:relative shadow-2xl md:shadow-none h-full`}>
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center justify-between"><div className="flex items-center gap-3"><Logo className="w-8 h-8" /><h2 className="text-xl font-black italic tracking-tighter uppercase text-zinc-900 dark:text-white leading-none">Mr. Vibe AI</h2></div><button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-500 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"><X size={20}/></button></div>
          <div className="px-6 pb-4"><button onClick={handleNewChat} className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-500 transition-all active:scale-95"><Plus size={18} /> New Board</button></div>
          <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
            {sessions.map(s => (
              <div key={s.id} className="group relative">
                <div onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }} className={`p-4 pr-10 rounded-[1.5rem] cursor-pointer transition-all border ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-500/30' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 border-transparent'}`}>
                  <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
                    <StickyNote size={16} />
                    <p className="font-bold text-xs truncate">{s.title}</p>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <div className="p-6 border-t border-zinc-100 dark:border-white/5 space-y-4">
            <button onClick={() => setSettings(s => ({...s, theme: s.theme === 'dark' ? 'light' : 'dark'}))} className="w-full flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-black text-[10px] uppercase tracking-widest text-zinc-900 dark:text-white hover:bg-zinc-200 transition-all">
              {settings.theme === 'dark' ? <><Moon size={16} /> Night Mode</> : <><Sun size={16} /> Day Mode</>}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative h-full overflow-hidden w-full">
        <header className="h-[72px] min-h-[72px] px-4 md:px-8 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-white/80 dark:bg-black/80 backdrop-blur-3xl sticky top-0 z-[300] w-full">
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-zinc-100/50 dark:bg-zinc-800/80 rounded-2xl md:hidden text-zinc-900 dark:text-white shadow-sm active:scale-90 transition-all border border-black/5 dark:border-white/5"><Menu size={20} /></button>
            <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-2 md:gap-3 cursor-pointer group outline-none active:scale-95 transition-transform">
              <div className="relative"><img src={user?.avatarUrl} className="w-10 h-10 md:w-11 md:h-11 rounded-2xl border-2 border-white dark:border-zinc-800 shadow-lg" alt="Avatar" /><div className={`absolute -bottom-1 -right-1 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm ${apiStatus === 'connected' ? 'bg-green-500' : 'bg-rose-500 animate-pulse'}`} /></div>
              <div className="hidden sm:block text-left"><h1 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">{user?.userName}</h1><p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Master Key</p></div>
            </button>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={handleSummarize} disabled={isSummarizing} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-blue-500 border border-black/5 dark:border-white/5 active:scale-95 transition-all disabled:opacity-50">
              <ListFilter size={20} className={isSummarizing ? "animate-spin" : ""} />
            </button>
            <button onClick={connectLive} className="h-11 w-11 bg-blue-600 text-white rounded-full active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Mic size={20} strokeWidth={2.5} />
            </button>
            <button onClick={() => setIsNotifOpen(true)} className="w-11 h-11 flex items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-blue-500 border border-black/5 dark:border-white/5 relative">
              {notifications.length > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full animate-ping" />}
              <Bell size={20} />
            </button>
          </div>
        </header>

        {isNotifOpen && (
          <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-xl animate-fade-in flex flex-col justify-end sm:justify-center p-0 sm:p-6" onClick={() => setIsNotifOpen(false)}>
            <div className="w-full max-w-lg mx-auto bg-white dark:bg-zinc-900 rounded-t-[2.5rem] sm:rounded-[3rem] p-8 space-y-6 animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center"><div className="flex items-center gap-4"><Logo className="w-10 h-10" /><h2 className="text-2xl font-black italic uppercase text-zinc-900 dark:text-white">Live Logs</h2></div><button onClick={() => setIsNotifOpen(false)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl"><X size={24}/></button></div>
              <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                {notifications.length === 0 ? <div className="py-20 text-center"><p className="text-zinc-400 font-black uppercase tracking-widest text-xs">Nothing but silence.</p></div> : notifications.map(n => (
                  <div key={n.id} className="flex gap-4 items-start border-b border-zinc-100 dark:border-white/5 pb-5">
                    <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${n.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                    <div className="flex-1"><p className="text-sm font-bold text-zinc-900 dark:text-zinc-200">{n.text}</p><p className="text-[10px] text-zinc-400 font-black mt-1">{new Date(n.time).toLocaleTimeString()}</p></div>
                  </div>
                ))}
              </div>
              <button onClick={() => setNotifications([])} className="w-full py-5 bg-rose-500/10 text-rose-500 font-black uppercase tracking-widest rounded-3xl active:scale-95 transition-all">Clear Logs</button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 md:px-12 py-6 custom-scrollbar bg-zinc-50 dark:bg-[#050505] w-full">
          <div className="max-w-3xl mx-auto flex flex-col gap-4 md:gap-6 pb-36">
            {notes.length > 0 && (
              <div className="mb-8 space-y-3 animate-slide-up">
                <div className="flex items-center gap-2 px-1">
                  <Pin size={14} className="text-blue-500" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Pinned Essentials</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {notes.map(note => (
                    <div key={note.id} className="p-4 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 rounded-2xl shadow-sm hover:scale-[1.02] transition-transform cursor-pointer overflow-hidden relative">
                       <div className="absolute top-3 right-3 opacity-30"><StickyNote size={14} /></div>
                       <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">{note.role === 'user' ? 'Inquiry' : 'Insight'}</p>
                       <p className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-3 leading-snug">{note.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div key={msg.id} className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-vibe-in`} style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className={`flex items-end gap-2 max-w-[92%] sm:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'model' && (
                    <div className="w-7 h-7 rounded-[0.7rem] bg-blue-500/10 flex items-center justify-center text-base shrink-0 overflow-hidden shadow-sm border border-zinc-100 dark:border-white/5">
                      <span>{PERSONALITIES[activeSession?.personalityId || settings.personalityId]?.emoji || currentPersonality.emoji}</span>
                    </div>
                  )}
                  <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-[1.2rem] md:rounded-[1.5rem] shadow-lg text-[14px] md:text-[15px] font-bold relative transition-all ${
                      msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none' 
                      : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-100 dark:border-white/5 rounded-bl-none shadow-zinc-200/50 dark:shadow-black/30'
                    } ${msg.isQuestion || msg.isNote ? 'ring-2 ring-blue-500/50' : ''}`}>
                      {msg.isQuestion && (
                        <div className="flex items-center gap-1.5 mb-1.5 px-2 py-0.5 bg-white/10 dark:bg-black/20 rounded-full w-fit">
                          <Pin size={10} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Question Detected</span>
                        </div>
                      )}
                      {msg.isNote && !msg.isQuestion && (
                        <div className="flex items-center gap-1.5 mb-1.5 px-2 py-0.5 bg-blue-500/20 rounded-full w-fit">
                          <StickyNote size={10} className="text-blue-500" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-blue-500">Smart Answer</span>
                        </div>
                      )}
                      {msg.image && (<div className="mb-2 rounded-xl overflow-hidden shadow-md border border-white/10"><img src={msg.image} alt="Vibe" className="w-full h-auto max-h-[350px] object-cover" /></div>)}
                      {editingMessageId === msg.id ? (
                        <div className="flex flex-col gap-2 min-w-[180px]"><textarea autoFocus className="w-full bg-white/10 p-2 rounded-lg border-2 border-white/20 outline-none text-white font-bold text-sm" value={editingText} onChange={(e) => setEditingText(e.target.value)} /><div className="flex justify-end gap-2"><button onClick={() => setEditingMessageId(null)} className="px-3 py-1 bg-black/20 rounded-lg text-[10px] uppercase font-black">Cancel</button><button onClick={() => saveEditMessage(msg.id)} className="px-3 py-1 bg-white text-blue-600 rounded-lg text-[10px] uppercase font-black">Update</button></div></div>
                      ) : (<MarkdownText text={msg.text} />)}
                      {msg.reaction && (
                        <div className="absolute -bottom-2 -right-1 bg-white dark:bg-zinc-800 rounded-full px-1.5 py-0.5 shadow-md border border-black/5 dark:border-white/10 flex items-center gap-1">
                          <span className="text-xs">{msg.reaction}</span>
                        </div>
                      )}
                      
                      {/* Quick Reaction Button for Model Messages */}
                      {msg.role === 'model' && (
                        <div className="absolute top-1/2 -right-10 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="relative">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActiveReactionMenu(activeReactionMenu === msg.id ? null : msg.id); }} 
                              className={`p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full shadow-sm hover:scale-110 active:scale-95 transition-all text-zinc-400 hover:text-blue-500 ${activeReactionMenu === msg.id ? 'text-blue-500' : ''}`}
                            >
                              <Smile size={18} />
                            </button>
                            {activeReactionMenu === msg.id && (
                              <ReactionPicker align="left" onSelect={(r) => handleReaction(msg.id, r)} onClose={() => setActiveReactionMenu(null)} />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className={`flex items-center gap-2 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      <div className="flex items-center gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-all relative">
                        {msg.role === 'user' && editingMessageId !== msg.id && (<button onClick={() => handleEditMessage(msg.id, msg.text)} className="p-1 text-zinc-400 hover:text-blue-500"><Edit3 size={12} /></button>)}
                        <div className="relative">
                          <button onClick={() => setActiveReactionMenu(activeReactionMenu === msg.id ? null : msg.id)} className={`p-1 transition-all ${msg.reaction ? 'text-blue-500' : 'text-zinc-400'} hover:text-blue-500`}>
                            <Smile size={12} />
                          </button>
                          {activeReactionMenu === msg.id && <ReactionPicker align={msg.role === 'user' ? 'right' : 'left'} onSelect={(r) => handleReaction(msg.id, r)} onClose={() => setActiveReactionMenu(null)} />}
                        </div>
                        <button onClick={() => handleCopy(msg.text)} className="p-1 text-zinc-400 hover:text-blue-500"><Copy size={12} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && <NoteWritingIndicator personality={currentPersonality} />}
            {isSummarizing && <TypingIndicator personality={currentPersonality} label="Distilling..." />}
            <div ref={bottomRef} className="h-24" />
          </div>
        </main>

        <footer className="px-3 md:px-4 py-4 absolute bottom-0 left-0 right-0 z-[200] pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none">
          <div className="max-w-2xl mx-auto flex flex-col gap-2 w-full">
            {stagedFile && (
              <div className="flex items-center gap-2 animate-slide-up bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl p-2 rounded-2xl border border-zinc-200 dark:border-white/10 w-fit ml-4 shadow-xl pointer-events-auto">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-blue-500">
                  <img src={`data:${stagedFile.mimeType};base64,${stagedFile.data}`} className="w-full h-full object-cover" alt="Preview" />
                  <button onClick={() => setStagedFile(null)} className="absolute top-0 right-0 p-1 bg-black/60 text-white hover:bg-rose-500 transition-colors rounded-bl-xl"><X size={12} /></button>
                </div>
                <div className="pr-2"><p className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Staged</p><p className="text-[9px] font-bold text-zinc-400 truncate max-w-[80px]">{stagedFile.fileName}</p></div>
              </div>
            )}
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl flex items-center rounded-[1.8rem] md:rounded-[2rem] px-3 md:px-4 py-1 border-2 border-zinc-200 dark:border-white/10 focus-within:border-blue-500 transition-all shadow-2xl pointer-events-auto relative">
              <button onClick={() => fileInputRef.current?.click()} className="text-zinc-400 hover:text-blue-500 p-2 shrink-0"><ImageIcon size={20} /></button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onload = () => setStagedFile({ data: (r.result as string).split(',')[1], mimeType: file.type, fileName: file.name }); r.readAsDataURL(file); } }} />
              <input type="text" placeholder="Note down your thoughts.." value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} className="w-full bg-transparent py-4 px-2 font-bold outline-none text-zinc-900 dark:text-white text-[16px] placeholder:text-zinc-400 min-w-0" maxLength={2000} />
              <div className="flex items-center gap-1 shrink-0">
                {inputText.length > 0 && (
                  <>
                    <button onClick={() => setInputText('')} className="p-2 text-zinc-400 hover:text-rose-500 transition-colors shrink-0"><X size={18}/></button>
                    <div className="h-6 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block" />
                  </>
                )}
                <button onClick={() => handleSendToAI(inputText)} disabled={(!inputText.trim() && !stagedFile) || isLoading || isSummarizing} className="text-blue-600 disabled:opacity-30 active:scale-90 transition-transform p-2 shrink-0"><Send size={24} strokeWidth={2.5}/></button>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl animate-fade-in" onClick={() => setIsProfileModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-t-[2.5rem] md:rounded-[4rem] p-4 md:p-10 shadow-3xl animate-vibe-in max-h-[100vh] md:max-h-[90vh] flex flex-col overflow-hidden border-t border-x border-white/5 md:border-b mt-auto md:mt-0" onClick={e => e.stopPropagation()}>
            
            <div className="flex justify-between items-center mb-6 md:mb-8 shrink-0 px-2">
              <div className="flex items-center gap-3 md:gap-5">
                <div className="p-3 md:p-4 bg-blue-600 text-white rounded-2xl md:rounded-[1.8rem] shadow-xl shadow-blue-600/20">
                  <UserIcon size={20} className="md:w-[28px] md:h-[28px]" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black uppercase italic text-zinc-900 dark:text-white leading-none tracking-tighter">Profile Sync</h2>
                  <p className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">Manage AI Soul Link</p>
                </div>
              </div>
              <button onClick={() => setIsProfileModalOpen(false)} className="p-3 md:p-4 bg-zinc-100 dark:bg-white/5 rounded-2xl active:scale-90 hover:bg-rose-500/10 hover:text-rose-500 transition-all">
                <X size={20} className="md:w-[24px] md:h-[24px]"/>
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar px-2 flex-1 space-y-8 md:space-y-10 overflow-x-hidden pb-10">
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-3 md:space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <UserCheck size={14} className="text-blue-500" />
                    <label className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 block">IDENTITY LABEL</label>
                  </div>
                  <div className="bg-zinc-50 dark:bg-white/5 p-4 md:p-6 rounded-[2rem] border border-black/5 dark:border-white/5 flex flex-col items-center gap-4 md:gap-6">
                    <div className="relative group">
                      <div className="w-20 h-20 md:w-32 md:h-32 rounded-[2rem] overflow-hidden border-4 border-white dark:border-zinc-800 shadow-xl transition-transform group-hover:scale-105">
                        <img src={user?.avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                      </div>
                      <input type="file" ref={avatarUploadRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                      <button 
                        onClick={() => avatarUploadRef.current?.click()}
                        className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-2.5 md:p-3 rounded-xl md:rounded-2xl shadow-xl border-2 md:border-4 border-white dark:border-zinc-900 hover:scale-110 active:scale-95 transition-transform"
                      >
                        <Camera size={14} className="md:w-[18px] md:h-[18px]" />
                      </button>
                    </div>
                    <div className="w-full flex gap-2">
                      <input 
                        type="text" 
                        value={editUserName} 
                        onChange={e => setEditUserName(e.target.value)} 
                        className="flex-1 bg-zinc-100 dark:bg-black/40 border-2 border-transparent focus:border-blue-500 rounded-xl py-2.5 md:py-4 px-3 md:px-5 font-black outline-none text-zinc-900 dark:text-white shadow-inner transition-all text-center uppercase tracking-wider text-xs md:text-sm min-w-0" 
                        placeholder="Alias..."
                      />
                      <button onClick={handleUpdateUser} className="bg-blue-600 text-white px-3 md:px-5 rounded-xl active:scale-95 shadow-lg flex-shrink-0">
                        <Check size={18} className="md:w-[22px] md:h-[22px]" strokeWidth={4} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 md:space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <ShieldCheck size={14} className="text-blue-500" />
                    <label className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 block">LICENSE AUTH</label>
                  </div>
                  <div className="bg-zinc-50 dark:bg-white/5 p-4 md:p-6 rounded-[2rem] border border-black/5 dark:border-white/5 flex flex-col gap-4">
                    <div className="flex items-center justify-between bg-zinc-100 dark:bg-black/40 p-3 rounded-xl shadow-inner">
                      <div className="flex flex-col">
                        <span className="text-[7px] md:text-[9px] font-black text-zinc-500 uppercase tracking-widest">Link Status</span>
                        <span className={`text-[9px] md:text-xs font-black uppercase flex items-center gap-1 mt-0.5 ${apiStatus === 'connected' ? 'text-green-500' : 'text-rose-500'}`}>
                          <Activity size={12} className={apiStatus === 'connected' ? '' : 'animate-pulse'} />
                          {apiStatus === 'connected' ? 'Frequency Live' : 'Link Dead'}
                        </span>
                      </div>
                      <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full shadow-lg ${apiStatus === 'connected' ? 'bg-green-500' : 'bg-rose-500 animate-pulse'}`} />
                    </div>
                    <div className="relative">
                      <textarea 
                        placeholder="License Key..." 
                        rows={2}
                        className="w-full bg-zinc-100 dark:bg-black/40 p-3 md:p-4 rounded-xl border-2 border-transparent focus:border-blue-500 outline-none font-bold text-[10px] md:text-xs tracking-widest shadow-inner text-zinc-900 dark:text-white resize-none min-h-0" 
                        value={manualApiKey} 
                        onChange={(e) => setManualApiKey(e.target.value)} 
                      />
                      <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-2 p-2 text-zinc-400 hover:text-blue-500 transition-colors">
                        {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button 
                      onClick={async () => { await checkApiConnection(manualApiKey); showToast("Link synchronized! ✨", "success"); }} 
                      className="w-full py-2.5 md:py-3.5 rounded-xl font-black text-[8px] md:text-[10px] uppercase tracking-[0.2em] bg-zinc-900 dark:bg-white text-white dark:text-black active:scale-95 transition-all shadow-md"
                    >
                      Update frequency
                    </button>
                  </div>
                </div>
              </div>

              {/* Voice Command & Wake Word Section */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <Mic size={14} className="text-blue-500" />
                      <label className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 block">VOICE WAKE</label>
                    </div>
                    <button 
                      onClick={() => setSettings(prev => ({ ...prev, wakeWordEnabled: !prev.wakeWordEnabled }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.wakeWordEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-800'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.wakeWordEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <p className="text-[8px] md:text-[9px] text-zinc-500 font-bold px-1 tracking-wide">WHEN ENABLED, SAY "MR. CUTE" TO ACTIVATE VOICE CONTROL AUTOMATICALLY.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <Zap size={14} className="text-blue-500" />
                    <label className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 block">CUSTOM SHORTCUTS</label>
                  </div>
                  
                  <div className="bg-zinc-50 dark:bg-white/5 p-4 md:p-6 rounded-[2rem] border border-black/5 dark:border-white/5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">If I say...</span>
                        <input 
                          type="text" placeholder="e.g. 'Go dark'" 
                          value={newTrigger} onChange={e => setNewTrigger(e.target.value)}
                          className="w-full bg-zinc-100 dark:bg-black/40 rounded-xl py-3 px-4 text-xs font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all text-zinc-900 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-1">Do/Say this...</span>
                        <div className="flex gap-2">
                          <input 
                            type="text" placeholder="e.g. 'Switch theme to dark'" 
                            value={newAction} onChange={e => setNewAction(e.target.value)}
                            className="flex-1 bg-zinc-100 dark:bg-black/40 rounded-xl py-3 px-4 text-xs font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all text-zinc-900 dark:text-white"
                          />
                          <button onClick={handleAddCommand} className="bg-blue-600 text-white p-3 rounded-xl active:scale-95"><Plus size={18} /></button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      {settings.customCommands.length === 0 ? (
                        <p className="text-[9px] text-zinc-400 font-bold italic text-center py-2">No custom shortcuts mapped yet.</p>
                      ) : (
                        settings.customCommands.map(cmd => (
                          <div key={cmd.id} className="flex items-center justify-between bg-zinc-100 dark:bg-black/20 p-3 rounded-2xl border border-black/5 dark:border-white/5 animate-scale-in">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600"><Hash size={14} /></div>
                              <div>
                                <p className="text-[10px] font-black text-zinc-900 dark:text-white uppercase leading-none">{cmd.trigger}</p>
                                <p className="text-[8px] font-bold text-zinc-500 mt-1">→ {cmd.action}</p>
                              </div>
                            </div>
                            <button onClick={() => handleRemoveCommand(cmd.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"><Trash2 size={14} /></button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Avatar Preset Gallery Section */}
              <div className="space-y-4 md:space-y-5">
                <div className="flex items-center gap-2 px-1">
                  <ImageIcon size={14} className="text-blue-500" />
                  <label className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 block">AVATAR GALLERY</label>
                </div>
                <div className="bg-zinc-50 dark:bg-white/5 p-4 md:p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-inner">
                  <div className="grid grid-cols-5 md:grid-cols-10 gap-2 md:gap-3 max-h-[120px] overflow-y-auto custom-scrollbar pr-2">
                    {AVATARS.map((url, i) => (
                      <button 
                        key={i} 
                        onClick={() => { setUser(prev => prev ? { ...prev, avatarUrl: url } : null); showToast("Persona updated! ✨", "success"); }} 
                        className={`aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-110 active:scale-90 ${user?.avatarUrl === url ? 'border-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      >
                        <img src={url} className="w-full h-full object-cover" alt="Gallery" />
                      </button>
                    ))}
                    {/* Add extra dynamic seeds for wider gallery */}
                    {[...Array(10)].map((_, i) => {
                      const seed = `VibeMaster${i + 11}`;
                      const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
                      return (
                        <button 
                          key={seed} 
                          onClick={() => { setUser(prev => prev ? { ...prev, avatarUrl: url } : null); showToast("New persona linked! ✨", "success"); }} 
                          className={`aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-110 active:scale-90 ${user?.avatarUrl === url ? 'border-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        >
                          <img src={url} className="w-full h-full object-cover" alt="Gallery" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4 md:space-y-5">
                <div className="flex items-center gap-2 px-1">
                  <Sliders size={14} className="text-blue-500" />
                  <label className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 block">VOICE CALIBRATION</label>
                </div>
                <div className="bg-zinc-50 dark:bg-white/5 p-5 md:p-7 rounded-[2rem] space-y-6 border border-black/5 dark:border-white/5 shadow-inner">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] md:text-[9px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-1.5"><FastForward size={10}/> Speaking Rate</span>
                      <span className="text-[10px] font-black text-blue-500">{settings.speakingRate.toFixed(1)}x</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="2.0" step="0.1" 
                      value={settings.speakingRate} 
                      onChange={(e) => setSettings({...settings, speakingRate: parseFloat(e.target.value)})}
                      className="w-full h-1.5 bg-zinc-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] md:text-[9px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-1.5"><Music size={10}/> Vocal Pitch</span>
                      <span className="text-[10px] font-black text-blue-500">{settings.speakingPitch.toFixed(1)}x</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="2.0" step="0.1" 
                      value={settings.speakingPitch} 
                      onChange={(e) => setSettings({...settings, speakingPitch: parseFloat(e.target.value)})}
                      className="w-full h-1.5 bg-zinc-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Palette size={14} className="text-blue-500" />
                  <label className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 block">ARCHETYPE FREQUENCY</label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                  {(Object.values(PERSONALITIES) as Personality[]).map(p => {
                    const isSelected = settings.personalityId === p.id;
                    return (
                      <button 
                        key={p.id} 
                        onClick={() => { setSettings({...settings, personalityId: p.id, voiceName: p.voiceName}); showToast(`${p.name} on!`, "success"); }} 
                        className={`group relative p-3 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border-2 transition-all flex flex-col items-center text-center gap-1.5 md:gap-2 active:scale-95 ${isSelected ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white dark:bg-white/5 border-zinc-100 dark:border-white/5 text-zinc-900 dark:text-white hover:border-blue-500/50'}`}
                      >
                        <span className={`text-2xl md:text-3xl transition-transform ${isSelected ? 'animate-bounce' : ''}`}>{p.emoji}</span>
                        <div className="space-y-0.5">
                          <p className="font-black text-[8px] md:text-[10px] uppercase tracking-wider leading-none truncate w-full">{p.name}</p>
                          <p className={`text-[6px] md:text-[7px] font-bold leading-tight line-clamp-1 ${isSelected ? 'text-white/70' : 'text-zinc-500'}`}>{p.description}</p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 bg-white text-blue-600 rounded-full p-0.5 shadow-sm">
                            <Check size={8} strokeWidth={5} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Mic2 size={14} className="text-blue-500" />
                  <label className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 block">AUDIO ESSENCE</label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                  {GEMINI_VOICES.map(voice => {
                    const isSelected = settings.voiceName === voice.id;
                    return (
                      <button 
                        key={voice.id} 
                        onClick={() => { setSettings({...settings, voiceName: voice.id}); showToast(`Voice ${voice.name} set!`, "success"); }} 
                        className={`group relative p-3 md:p-4 rounded-xl md:rounded-[1.5rem] border-2 transition-all flex flex-col items-center gap-1.5 md:gap-2 active:scale-95 ${isSelected ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white' : 'bg-zinc-100 dark:bg-white/5 border-transparent text-zinc-900 dark:text-white'}`}
                      >
                        <Volume2 size={16} className={`md:w-[18px] md:h-[18px] ${isSelected ? 'text-blue-500' : 'text-zinc-400'}`} />
                        <p className="font-black text-[7px] md:text-[9px] uppercase tracking-widest">{voice.name.split(' ')[0]}</p>
                        {isSelected && (
                          <div className={`absolute top-1.5 right-1.5 rounded-full p-0.5 ${isSelected ? 'bg-blue-500 text-white' : ''}`}>
                            <Check size={8} strokeWidth={5} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-8 md:pt-10 space-y-4">
                 <div className="h-[1px] w-full bg-black/5 dark:bg-white/5" />
                 <button 
                  onClick={handleLogOut} 
                  className="w-full py-3.5 md:py-5 text-[9px] md:text-[11px] text-rose-500 font-black uppercase tracking-[0.2em] md:tracking-[0.3em] hover:bg-rose-500/10 rounded-2xl md:rounded-[2.5rem] transition-all border-2 border-rose-500/20 active:scale-95 flex items-center justify-center gap-2 md:gap-3 shadow-sm"
                >
                  <LogOut size={16} className="md:w-[18px] md:h-[18px]" /> Break connection
                </button>
                <p className="text-[6px] md:text-[8px] font-black text-center text-zinc-500 uppercase tracking-widest">Mr. Vibe AI Engine • Soul Link v2.6.0</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}