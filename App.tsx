
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Volume2, CheckCircle2, Sparkles, MicOff, ImageIcon, Globe,
  Edit3, History, LogOut, Clock, MessageSquare, StickyNote,
  UserCheck, Palette, Bell, Eraser, Info, ExternalLink, Activity,
  ChevronDown, MoreHorizontal, User as UserIcon, Copy, Share2, Heart, ThumbsUp, Pin, BookOpen, Key, Save, ListFilter,
  Check, AlertTriangle, FileText, File, TrendingUp, Brain, ShieldAlert,
  Headphones, BarChart3, Calculator, Zap, Square, CheckSquare, Search, VolumeX, RefreshCw, Paperclip, FileIcon,
  MessageCircle, Link2, GraduationCap, Award, PlayCircle, Fingerprint,
  ZapOff,
  Flame
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES, PERSONALITY_STYLES } from './constants';
import { PersonalityId, Personality, AppSettings, User, ChatSession, Message, ReactionType, Notification, FileAttachment, Quiz, QuizQuestion, GroundingChunk, Gender } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const Logo = ({ className }: { className?: string }) => (
  <div className={`flex items-center justify-center ${className}`}>
    <div className="relative">
      <div className="absolute inset-0 bg-blue-600/30 blur-2xl rounded-full animate-pulse" />
      <Zap size={48} className="text-blue-500 relative z-10 fill-blue-500/20" />
    </div>
  </div>
);

const VibeOrb = ({ active, isThinking, volume, outputVolume, animationState, personalityId }: { 
  active: boolean, 
  isThinking: boolean, 
  volume: number,
  outputVolume: number,
  animationState?: OrbAnimationState,
  personalityId: PersonalityId
}) => {
  const currentVol = active ? outputVolume || volume : 0;
  const scale = active ? 1 + currentVol * 2.2 : 1;
  const style = PERSONALITY_STYLES[personalityId];
  
  const getAnimationClass = () => {
    if (animationState === 'hi') return 'animate-hi-pulse';
    if (animationState === 'excited') return 'animate-excited-bounce';
    if (animationState === 'thoughtful') return 'animate-thoughtful-wobble';
    if (isThinking) return 'animate-pulse-orb';
    return '';
  };

  return (
    <div className={`relative flex items-center justify-center w-44 h-44 md:w-64 md:h-64 transition-all duration-300 ${getAnimationClass()}`}>
      <div 
        className={`absolute inset-0 rounded-full blur-3xl transition-opacity duration-700 ${active || isThinking ? 'opacity-80' : 'opacity-30'}`} 
        style={{ backgroundColor: style.glow }}
      />
      <div 
        className={`relative w-24 h-24 md:w-36 md:h-36 rounded-full transition-all duration-75 ease-out flex items-center justify-center shadow-2xl ${active ? `bg-gradient-to-br ${style.gradient}` : 'bg-zinc-800'}`}
        style={{ transform: `scale(${scale})`, boxShadow: active ? `0 0 60px ${style.glow}` : 'none' }}
      >
        <div className={`w-full h-full rounded-full bg-white/10 ${active ? 'animate-orb-float' : ''}`} />
      </div>
    </div>
  );
};

const SyncMeter = ({ level }: { level: number }) => (
  <div className="flex flex-col items-center gap-1.5 w-full max-w-[120px]">
    <div className="flex justify-between w-full px-1">
      <span className="text-[7px] font-black uppercase tracking-widest text-zinc-500">Sync</span>
      <span className="text-[7px] font-black text-blue-500">{level}%</span>
    </div>
    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-blue-600 to-indigo-400 transition-all duration-1000 ease-out"
        style={{ width: `${level}%` }}
      />
    </div>
  </div>
);

const NotificationToast = ({ message, type, onClose, onClick }: { message: string, type: string, onClose: () => void, onClick?: () => void }) => (
  <div className="fixed top-4 md:top-8 inset-x-4 z-[10000] flex justify-center pointer-events-none">
    <div 
      onClick={onClick}
      className={`w-full max-w-sm mb-4 bg-zinc-900 shadow-2xl rounded-[28px] border flex items-center gap-4 p-5 pointer-events-auto animate-slide-up cursor-pointer ${
        type === 'success' ? 'border-emerald-500/20 text-emerald-400' :
        type === 'error' ? 'border-rose-500/20 text-rose-400' :
        type === 'pulse' ? 'border-blue-500/50 bg-blue-950/20 text-blue-400' :
        'border-blue-500/20 text-blue-400'
      }`}
    >
      <div className={`p-2.5 rounded-xl bg-white/5 ${type === 'pulse' ? 'animate-pulse text-blue-500' : ''}`}>
        {type === 'pulse' ? <Flame size={18} /> : <Bell size={18} />}
      </div>
      <div className="flex-1 font-bold text-[11px] leading-snug">{message}</div>
      <button 
        onClick={(e) => { e.stopPropagation(); onClose(); }} 
        className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-zinc-500"
      >
        <X size={16} />
      </button>
    </div>
  </div>
);

const MarkdownText = ({ text }: { text: string }) => {
  const renderLine = (line: string, key: number) => {
    if (line.startsWith('###')) {
      return <h3 key={key} className="text-blue-500 font-black text-base mt-4 mb-2 flex items-center gap-2">
        <Activity size={16} /> {line.replace('###', '').trim()}
      </h3>;
    }
    const parts = line.split(/(\*\*.*?\*\*|`.*?`|https?:\/\/[^\s]+)/g);
    return (
      <div key={key} className="mb-1 last:mb-0">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) return <strong key={idx} className="font-extrabold text-blue-400/90">{part.slice(2, -2)}</strong>;
          if (part.startsWith('`') && part.endsWith('`')) return <code key={idx} className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[10px] border border-white/5">{part.slice(1, -1)}</code>;
          if (part.startsWith('http')) return <a key={idx} href={part} target="_blank" className="text-blue-500 underline decoration-blue-500/30 hover:decoration-blue-500 transition-all">{part}</a>;
          return <span key={idx}>{part}</span>;
        })}
      </div>
    );
  };
  return <div className="leading-relaxed whitespace-pre-wrap">{text.split('\n').map((l, i) => renderLine(l, i))}</div>;
};

type OrbAnimationState = 'idle' | 'hi' | 'thoughtful' | 'excited';

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_active_user'));
  const [hasLicense, setHasLicense] = useState(false);
  const [toast, setToast] = useState<{id: string, message: string, type: string, onClick?: () => void} | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(() => JSON.parse(localStorage.getItem('mr_vibe_notif_history') || '[]'));
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('mr_vibe_active_user') || 'null'));
  const [tempProfile, setTempProfile] = useState<Partial<User>>({ 
    userName: '', 
    gender: 'Secret', 
    avatarUrl: AVATARS[0], 
    personalityId: PersonalityId.STUDENT 
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mr_vibe_settings');
    if (saved) return JSON.parse(saved);
    return { language: "English", theme: "dark", personalityId: PersonalityId.STUDENT, voiceName: "Zephyr", speakingRate: 1.0, speakingPitch: 1.0, customCommands: [] };
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(settings.theme || 'dark');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('mr_vibe_active_session_id'));
  const [sessions, setSessions] = useState<ChatSession[]>(() => JSON.parse(localStorage.getItem('mr_vibe_sessions') || '[]'));
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isVoiceModeModalOpen, setIsVoiceModeModalOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [selectedPinnedId, setSelectedPinnedId] = useState<string | null>(null);

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);

  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileAttachment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{text: string, isModel: boolean}[]>([]);
  const [isAiSpeakingGlobal, setIsAiSpeakingGlobal] = useState(false);
  const [selectedVoiceMode, setSelectedVoiceMode] = useState<'chat' | 'note'>('chat');
  const [avatarAnimation, setAvatarAnimation] = useState<OrbAnimationState>('idle');
  const [isSyncingMemories, setIsSyncingMemories] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentPersonality = PERSONALITIES[settings.personalityId];
  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const pinnedMessages = useMemo(() => messages.filter(m => m.isPinned), [messages]);

  const syncLevel = useMemo(() => {
    if (!messages.length) return 0;
    const score = Math.min(100, messages.length * 5 + pinnedMessages.length * 10);
    return score;
  }, [messages.length, pinnedMessages.length]);

  // Heartbeat Auto-save
  useEffect(() => {
    const saveTimer = setInterval(() => {
      if (sessions.length > 0) localStorage.setItem('mr_vibe_sessions', JSON.stringify(sessions));
      if (activeSessionId) localStorage.setItem('mr_vibe_active_session_id', activeSessionId);
    }, 5000);
    return () => clearInterval(saveTimer);
  }, [sessions, activeSessionId]);

  // License check
  useEffect(() => {
    const checkLicense = async () => {
      if (window.aistudio) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasLicense(has);
      }
    };
    checkLicense();
    const interval = setInterval(checkLicense, 5000);
    return () => clearInterval(interval);
  }, []);

  // Neural Pulse Logic
  useEffect(() => {
    if (hasLicense && user && !isNewUser) {
      setTimeout(checkForNeuralPulse, 8000);
    }
  }, [hasLicense, user, isNewUser, activeSessionId]);

  const checkForNeuralPulse = async () => {
    if (isSyncingMemories || sessions.length === 0 || !activeSessionId) return;
    setIsSyncingMemories(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currentSess = sessions.find(s => s.id === activeSessionId);
      if (!currentSess || currentSess.messages.length < 3) return;
      
      const context = currentSess.messages.slice(-6).map(m => m.text).join('\n');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ text: `CONTEXT HISTORY: ${context}\n\nTASK: You are Mr. Cute. Scan the context for any upcoming events or personal notes the user mentioned. If found, generate a SHORT slang-heavy follow-up question (max 12 words). Use emojis. If nothing relevant is found, return exactly 'none'.` }]
      });

      const pulseText = response.text?.trim();
      if (pulseText && pulseText.toLowerCase() !== 'none' && !pulseText.includes("none")) {
        showToast(pulseText, 'pulse', () => {
          handleSendToAI(`Yo Mr. Cute, about what you said: "${pulseText}". Let's chat!`, false);
          setToast(null);
        });
      }
    } catch (e) {
      console.error("Neural Sync failed", e);
    } finally {
      setIsSyncingMemories(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
    const timer = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(timer);
  }, [messages.length, isLoading, liveTranscript, scrollToBottom]);

  useEffect(() => {
    document.documentElement.className = theme;
    updateSettings({ theme });
  }, [theme]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('mr_vibe_settings', JSON.stringify(updated));
      return updated;
    });
  };

  const playNotificationSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  }, []);

  const showToast = useCallback((message: string, type: string = 'info', onClick?: () => void) => {
    const id = Date.now().toString();
    setToast({ id, message, type, onClick });
    const newNotif: Notification = { id, message, type: type as any, timestamp: Date.now() };
    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, 50);
      localStorage.setItem('mr_vibe_notif_history', JSON.stringify(updated));
      return updated;
    });
    if (type !== 'error' && type !== 'pulse') {
       setTimeout(() => setToast(current => current?.id === id ? null : current), 5000);
    }
  }, []);

  const handleNewChat = useCallback((autoGreet = true) => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { 
      id: newId, title: 'Syncing...', messages: [], lastTimestamp: Date.now(), personalityId: settings.personalityId 
    };
    setSessions(prev => {
      const updated = [newSession, ...prev];
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    setActiveSessionId(newId);
    localStorage.setItem('mr_vibe_active_session_id', newId);
    setIsHistoryOpen(false);
    setIsLibraryOpen(false);
    setSelectedPinnedId(null);
    
    if (autoGreet && hasLicense) {
      generateInitialGreeting(newId, settings.personalityId);
    }
    return newId;
  }, [settings.personalityId, user, hasLicense]);

  const generateInitialGreeting = async (sessionId: string, personalityId: PersonalityId) => {
    setIsLoading(true);
    setAvatarAnimation('hi');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const persona = PERSONALITIES[personalityId];
      const prompt = `ACT AS Mr. Cute. Say hi to ${user?.userName || 'bestie'}. Keep it very brief, high energy, and "bestie" vibe. Introduce yourself as Mr. Cute ONLY this once. Use emojis like ✨ or 👋.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ text: `${BASE_SYSTEM_PROMPT}\n\n${prompt}` }]
      });

      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: response.text || 'Yo! Ready to vibe?', timestamp: Date.now() };
      
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
      playNotificationSound();
    } catch (e) {} finally {
      setIsLoading(false);
      setAvatarAnimation('idle');
    }
  };

  const togglePin = (messageId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? {
        ...s,
        messages: s.messages.map(m => m.id === messageId ? { ...m, isPinned: !m.isPinned } : m)
      } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    showToast("Uploaded to Core Memories.", "success");
  };

  const handleOpenLicenseKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      const has = await window.aistudio.hasSelectedApiKey();
      setHasLicense(has);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsNewUser(true);
    setUser(null);
    setSessions([]);
    setActiveSessionId(null);
    setIsProfileModalOpen(false);
    showToast("Frequency Link Terminated.", "info");
  };

  const handleSendToAI = async (text: string, isAutoGreet = false) => {
    if (!hasLicense) {
      showToast("LICENSE KEY required for Neural Sync.", "error");
      handleOpenLicenseKey();
      return;
    }
    if ((!text.trim() && !selectedFile) || isLoading) return;
    
    let sessionId = activeSessionId || handleNewChat(false);
    const sessionRef = sessions.find(s => s.id === sessionId);
    const isFirstMessage = !sessionRef || sessionRef.messages.length === 0;
    
    const userMsgFile = selectedFile ? { ...selectedFile } : undefined;
    const currentFile = selectedFile;
    setSelectedFile(null);
    setInputText('');

    if (!isAutoGreet) {
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, { id: `u-${Date.now()}`, role: 'user', text, file: userMsgFile, timestamp: Date.now() }], lastTimestamp: Date.now() } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
    }
    
    setIsLoading(true);
    setAvatarAnimation('thoughtful');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [{ text: `${BASE_SYSTEM_PROMPT}\n\nUSER: ${user?.userName}\nMODE: ${selectedVoiceMode}\n\nINPUT: ${text}` }];
      
      if (currentFile?.data) {
        parts.push({
          inlineData: {
            data: currentFile.data.split(',')[1],
            mimeType: currentFile.type
          }
        });
      }

      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: { parts },
        config: { tools: [{ googleSearch: {} }] } 
      });

      const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[];
      const aiMessage: Message = { 
        id: `ai-${Date.now()}`, 
        role: 'model', 
        text: response.text || '...', 
        timestamp: Date.now(), 
        isNote: selectedVoiceMode === 'note',
        groundingChunks: grounding
      };
      
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
      
      if (isFirstMessage) {
        const titleResp = await ai.models.generateContent({
           model: 'gemini-3-flash-preview',
           contents: `Briefly summarize this chat start in 2 words: ${text}`
        });
        const title = titleResp.text?.trim().replace(/"/g, '') || 'New Link';
        setSessions(prev => {
           const updated = prev.map(s => s.id === sessionId ? { ...s, title } : s);
           localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
           return updated;
        });
      }

      playNotificationSound();
    } catch (e: any) { 
      if (e.message?.includes("Requested entity was not found")) setHasLicense(false);
      showToast("Signal Interrupted.", "error"); 
    } finally { 
      setIsLoading(false); 
      setAvatarAnimation('idle');
    }
  };

  const { connect: connectLive, disconnect: disconnectLive, isLive, isConnecting, volume, outputVolume } = useGeminiLive({
    personality: currentPersonality, settings, user: user as User, mode: selectedVoiceMode,
    onTranscript: (t, iM, isModel) => {
        setLiveTranscript(prev => [...prev, { text: t, isModel }]);
        if (isModel) setIsAiSpeakingGlobal(true);
    },
    onTurnComplete: (u, m) => { 
      setLiveTranscript([]); setIsAiSpeakingGlobal(false);
      const sId = activeSessionId || handleNewChat(false); 
      setSessions(prev => {
        const updated = prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, 
          { id: `u-${Date.now()}`, role: 'user', text: u, timestamp: Date.now() }, 
          { id: `m-${Date.now() + 1}`, role: 'model', text: m, timestamp: Date.now() + 1, isNote: selectedVoiceMode === 'note' }
        ] } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
      playNotificationSound();
    },
    onConnectionStateChange: (c) => { if(!c) setLiveTranscript([]); },
    onCommand: (cmd, args) => {
      if (cmd === 'change_voice') {
        const found = GEMINI_VOICES.find(v => v.id.toLowerCase() === args.voice_id?.toLowerCase());
        if (found) { updateSettings({ voiceName: found.id }); showToast(`Voice Synced: ${found.name}`, "success"); }
      }
    },
    onError: (m) => {
      if (m.includes("Requested entity was not found")) setHasLicense(false);
      showToast(m, "error");
    }
  });

  const handleVoiceButtonClick = () => {
    if (!hasLicense) { showToast("License link required.", "error"); handleOpenLicenseKey(); return; }
    if (isLive) disconnectLive(); else setIsVoiceModeModalOpen(true);
  };

  const startVoiceMode = (mode: 'chat' | 'note') => {
    setSelectedVoiceMode(mode);
    setIsVoiceModeModalOpen(false);
    connectLive();
  };

  const generateNeuralQuiz = async (specificMessageId?: string) => {
    const contextSource = specificMessageId 
      ? pinnedMessages.find(m => m.id === specificMessageId)
      : pinnedMessages;

    if (!contextSource || (Array.isArray(contextSource) && contextSource.length === 0)) {
      showToast("Link a memory bubble first.", "info");
      return;
    }

    setIsLoading(true);
    setIsLibraryOpen(false);
    setAvatarAnimation('thoughtful');

    try {
      const text = Array.isArray(contextSource) ? contextSource.map(m => m.text).join("\n") : contextSource.text;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `CONTEXT: ${text}\n\nAct as Mr. Cute. Create a 3-question MCQ test based on this for the user. Return ONLY JSON:\n{ "title": "Memory Check", "questions": [ { "question": "", "options": [], "correctAnswer": "", "explanation": "" } ] }`,
        config: { responseMimeType: "application/json" }
      });

      const quizData = JSON.parse(response.text || '{}') as Quiz;
      setActiveQuiz(quizData);
      setQuizAnswers({});
      setIsQuizSubmitted(false);
    } catch (e) {
      showToast("Assessment Sync failed.", "error");
    } finally {
      setIsLoading(false);
      setAvatarAnimation('idle');
    }
  };

  const handleOnboardingComplete = async () => {
    if (!hasLicense) {
      await handleOpenLicenseKey();
    }
    
    const currentlyLicensed = await window.aistudio?.hasSelectedApiKey();
    if (!currentlyLicensed) {
      showToast("Neural Link verified, but API access is missing.", "error");
      return;
    }

    if (tempProfile.userName && tempProfile.gender && tempProfile.personalityId) {
      const newUser = { 
        ...tempProfile, 
        avatarUrl: AVATARS[Math.floor(Math.random() * AVATARS.length)] 
      } as User;
      
      localStorage.setItem('mr_vibe_active_user', JSON.stringify(newUser));
      setUser(newUser);
      updateSettings({ personalityId: tempProfile.personalityId });
      setIsNewUser(false);
      handleNewChat(true);
    } else {
      showToast("Complete your Identity Protocol first.", "info");
    }
  };

  return (
    <div className={`flex flex-col h-full w-full transition-colors duration-700 ${theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-zinc-50 text-black'} relative overflow-hidden ios-safe-top ios-safe-bottom font-sans`}>
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}

      <header className={`h-24 px-4 md:px-8 flex items-center justify-between border-b ${theme === 'dark' ? 'border-white/5 bg-black/50' : 'border-black/5 bg-white/50'} backdrop-blur-3xl z-50`}>
        <div className="flex items-center gap-1 md:gap-3">
          <button onClick={() => setIsHistoryOpen(true)} className={`p-3 rounded-2xl active:scale-90 transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-400' : 'hover:bg-black/5 text-zinc-500'}`}><Menu size={22} /></button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-3 rounded-2xl active:scale-90 transition-all ${theme === 'dark' ? 'text-yellow-400' : 'text-blue-600'}`}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <span className="font-black text-[13px] md:text-[15px] uppercase tracking-[0.5em] text-blue-500 animate-pulse">Mr. Vibe AI</span>
          <SyncMeter level={syncLevel} />
        </div>

        <div className="flex items-center gap-1 md:gap-3">
          <button onClick={() => setIsLibraryOpen(true)} className={`p-3 rounded-2xl relative active:scale-90 transition-all ${theme === 'dark' ? 'text-blue-400 bg-blue-500/10' : 'text-blue-600 bg-blue-500/5'}`}>
            <Brain size={20} />
            {pinnedMessages.length > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-500 rounded-full animate-ping" />}
          </button>
          <button onClick={() => setIsProfileModalOpen(true)} className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white/10 active:scale-90 transition-all shadow-xl">
             {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><UserIcon size={18} /></div>}
          </button>
        </div>
      </header>

      <main ref={mainContentRef} className="flex-1 overflow-y-auto px-5 py-10 md:px-10 space-y-10 custom-scrollbar scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-14 animate-fade-in">
            <VibeOrb active={false} isThinking={false} volume={0} outputVolume={0} animationState={avatarAnimation} personalityId={settings.personalityId} />
            <div className="space-y-4 max-w-xs">
              <h3 className="text-[10px] font-black uppercase tracking-[0.6em] text-blue-500 opacity-80">Frequency Offline</h3>
              <p className="text-[11px] font-bold italic text-zinc-600 uppercase tracking-[0.2em] leading-loose">"Yo bestie, let's link up. Drop a line or tap the mic to sync."</p>
              <div className="pt-4 flex flex-wrap justify-center gap-2">
                 <button onClick={() => setInputText("Yo Mr. Cute, what's good?")} className="px-4 py-2 rounded-full border border-white/5 bg-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-blue-400 hover:border-blue-400 transition-all">Say Hello</button>
                 <button onClick={() => setIsVoiceModeModalOpen(true)} className="px-4 py-2 rounded-full border border-blue-500/20 bg-blue-600/10 text-[9px] font-black uppercase tracking-widest text-blue-500 hover:bg-blue-600 hover:text-white transition-all">Voice Link</button>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-vibe-in group`}>
              {msg.file && (
                <div className={`mb-3 max-w-[85%] rounded-[28px] overflow-hidden border shadow-2xl ${theme === 'dark' ? 'border-white/10' : 'border-black/5'}`}>
                  {msg.file.type.startsWith('image/') ? (
                    <img src={msg.file.data} className="w-full h-auto object-cover max-h-[300px]" />
                  ) : (
                    <div className="flex items-center gap-3 p-5 bg-white/5">
                      <FileIcon size={24} className="text-blue-500" />
                      <div className="flex-1 truncate font-bold text-[11px]">{msg.file.name}</div>
                    </div>
                  )}
                </div>
              )}
              <div className="relative flex items-end gap-3 max-w-[92%]">
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mb-1 border border-white/10">
                    <img src={AVATARS[index % AVATARS.length]} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className={`px-6 py-4.5 rounded-[30px] text-[15px] font-medium shadow-2xl border transition-all duration-300 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white border-blue-500/20 rounded-br-none' 
                    : theme === 'dark' 
                      ? 'bg-[#121212] text-zinc-100 border-white/5 rounded-bl-none' 
                      : 'bg-white text-zinc-900 border-black/5 rounded-bl-none'
                }`}>
                  {msg.isNote && <div className="flex items-center gap-1.5 mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-blue-400"><StickyNote size={10} /> Neural Trace</div>}
                  <MarkdownText text={msg.text} />
                  
                  {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-white/5 space-y-3">
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2"><Globe size={12} /> External Intelligence</p>
                       <div className="flex flex-wrap gap-2">
                          {msg.groundingChunks.map((chunk, idx) => chunk.web && (
                             <a key={idx} href={chunk.web.uri} target="_blank" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-blue-400 hover:bg-blue-600 hover:text-white transition-all truncate max-w-[180px] flex items-center gap-2">
                               <ExternalLink size={10} /> {chunk.web.title || chunk.web.uri}
                             </a>
                          ))}
                       </div>
                    </div>
                  )}
                </div>
                {msg.role === 'model' && (
                  <button onClick={() => togglePin(msg.id)} className={`p-2.5 rounded-2xl transition-all ${msg.isPinned ? 'text-blue-500 bg-blue-500/10' : 'text-zinc-600 hover:text-blue-500 opacity-0 group-hover:opacity-100'}`}>
                    <Pin size={16} fill={msg.isPinned ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        
        {liveTranscript.length > 0 && (
          <div className="flex flex-col gap-4">
            {liveTranscript.map((t, idx) => (
              <div key={idx} className={`flex flex-col ${t.isModel ? 'items-start' : 'items-end'} animate-fade-in opacity-70 italic`}>
                <div className={`px-6 py-4 rounded-[26px] text-[14px] border ${
                  t.isModel ? 'bg-[#1a1a1a]/40 border-white/5' : 'bg-blue-600/10 border-blue-500/10'
                }`}>
                  {t.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex items-start">
            <div className={`px-6 py-4 rounded-[26px] border ${theme === 'dark' ? 'bg-[#121212] border-white/5' : 'bg-white border-black/5'}`}>
              <div className="flex gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" /><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" /><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" /></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-10 w-full" />
      </main>

      <footer className={`px-4 pb-8 pt-3 bg-gradient-to-t ${theme === 'dark' ? 'from-black via-black/95' : 'from-zinc-50 via-zinc-50/95'} to-transparent z-40 ios-safe-bottom`}>
        {selectedFile && (
          <div className="max-w-3xl mx-auto mb-5 animate-slide-up">
            <div className={`relative inline-flex items-center gap-4 p-3.5 rounded-[24px] border shadow-2xl ${theme === 'dark' ? 'bg-[#151515] border-white/10' : 'bg-white border-black/10'}`}>
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shadow-inner">
                {selectedFile.type.startsWith('image/') ? <img src={selectedFile.data} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-blue-500/10 flex items-center justify-center text-blue-500"><FileText size={18} /></div>}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Neural Attachment</span>
                <span className="text-[10px] font-bold truncate max-w-[140px] text-zinc-500">{selectedFile.name}</span>
              </div>
              <button onClick={() => setSelectedFile(null)} className="ml-2 p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl text-zinc-600 transition-all"><X size={14} /></button>
            </div>
          </div>
        )}
        <div className={`max-w-5xl mx-auto flex items-center gap-3 p-1.5 border rounded-[40px] shadow-2xl backdrop-blur-3xl transition-all ${theme === 'dark' ? 'bg-[#0a0a0a]/90 border-white/10' : 'bg-white/90 border-black/10'}`}>
          <button onClick={() => fileInputRef.current?.click()} className="p-4 rounded-full text-zinc-500 hover:text-blue-500 transition-all flex-shrink-0 hover:bg-white/5 active:scale-90">
            <Paperclip size={22}/>
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
               const file = e.target.files?.[0]; if (!file) return;
               const reader = new FileReader(); reader.onload = () => setSelectedFile({ data: reader.result as string, name: file.name, type: file.type });
               reader.readAsDataURL(file);
            }} />
          </button>
          <input 
            type="text" 
            placeholder={hasLicense ? "Talk to Mr. Cute..." : "Connect Neural Link..."}
            value={inputText} 
            onChange={e => setInputText(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} 
            className="flex-1 bg-transparent py-4 px-2 font-bold text-[15px] outline-none placeholder-zinc-800 min-w-0"
          />
          <div className="flex items-center gap-2 pr-2 flex-shrink-0">
             <button onClick={handleVoiceButtonClick} className={`p-4 rounded-full transition-all active:scale-95 ${isLive ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/30' : 'bg-white/5 text-zinc-500 hover:bg-white/10'}`}>{isLive ? <MicOff size={22}/> : <Mic size={22}/>}</button>
             <button onClick={() => handleSendToAI(inputText)} className={`p-4 rounded-full transition-all active:scale-95 ${(inputText.trim() || selectedFile) ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/40' : 'bg-zinc-800 text-zinc-700'}`}><Send size={22}/></button>
          </div>
        </div>
      </footer>

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-6">
           <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={() => setIsProfileModalOpen(false)} />
           <div className={`relative w-full max-w-lg rounded-[56px] p-10 md:p-12 space-y-10 animate-scale-in border ${theme === 'dark' ? 'bg-[#080808] border-white/10' : 'bg-white border-black/10'} max-h-[85vh] overflow-y-auto custom-scrollbar shadow-[0_0_100px_rgba(0,0,0,0.5)]`}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">Identity Protocol</h2>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Mr. Cute's Database</p>
                </div>
                <button onClick={() => setIsProfileModalOpen(false)} className="p-3 bg-white/5 rounded-2xl text-zinc-500 hover:bg-white/10 transition-all"><X size={22}/></button>
              </div>
              <div className="space-y-8 pb-4">
                 <div className="p-7 rounded-[40px] bg-blue-600/5 border border-blue-500/10 space-y-5">
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Neural Link Auth</label>
                       <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${hasLicense ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{hasLicense ? 'Secured' : 'Missing'}</span>
                    </div>
                    <div className="space-y-3">
                       <p className="text-[11px] font-medium text-zinc-500 leading-relaxed px-1">You need a Neural Link Key to vibe with Mr. Cute. This connects you to the core processing matrix.</p>
                       <button onClick={handleOpenLicenseKey} className="w-full py-5 bg-white/5 border border-white/10 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-blue-600 hover:text-white transition-all shadow-lg">
                          <Fingerprint size={18} /> Update Matrix Key
                       </button>
                    </div>
                 </div>
                 
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] ml-3">Label Name</label>
                    <input type="text" value={user?.userName} onChange={e => setUser(u => u ? ({...u, userName: e.target.value}) : null)} onBlur={() => localStorage.setItem('mr_vibe_active_user', JSON.stringify(user))} className="w-full py-5 px-8 rounded-3xl bg-white/5 border border-white/5 focus:border-blue-500 outline-none font-black text-lg transition-all" />
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] ml-3">Sync Gender</label>
                    <div className="flex flex-wrap gap-2.5">
                       {['Male', 'Female', 'Other', 'Secret'].map((g) => (
                          <button key={g} onClick={() => { setUser(u => u ? ({...u, gender: g as Gender}) : null); localStorage.setItem('mr_vibe_active_user', JSON.stringify({...user, gender: g})); }} className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${user?.gender === g ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30' : 'bg-white/5 text-zinc-600 hover:bg-white/10'}`}>{g}</button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] ml-3">Neural Archetype</label>
                    <div className="grid grid-cols-2 gap-4">
                       {Object.values(PERSONALITIES).map(p => (
                          <button key={p.id} onClick={() => { updateSettings({ personalityId: p.id }); showToast(`Archetype Synced: ${p.name}`, "info"); }} className={`p-5 rounded-[32px] font-black text-[10px] uppercase tracking-widest border-2 transition-all flex items-center gap-4 ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl' : 'bg-white/5 border-transparent text-zinc-600 hover:bg-white/10'}`}><span className="text-2xl">{p.emoji}</span><span className="truncate">{p.name}</span></button>
                       ))}
                    </div>
                 </div>

                 <div className="pt-8 border-t border-white/5">
                    <button onClick={handleLogout} className="w-full py-5 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-rose-500 hover:text-white transition-all shadow-xl">
                       <LogOut size={18} /> Terminate Vibe (Logout)
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Onboarding */}
      {isNewUser && (
        <div className="fixed inset-0 z-[9000] bg-black flex items-center justify-center p-4 md:p-8 overflow-y-auto">
          <div className="w-full max-w-xl bg-[#080808] rounded-[64px] p-10 md:p-14 text-center border border-white/5 animate-scale-in space-y-10 shadow-[0_0_150px_rgba(59,130,246,0.2)]">
             <Logo className="w-20 h-20 mx-auto mb-4" />
             <div className="space-y-2">
               <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white">Mr. Vibe AI</h1>
               <p className="text-[11px] font-black uppercase tracking-[0.6em] text-blue-500">Neural Sync Interface</p>
             </div>
             
             <div className="space-y-8 text-left">
               <div className="space-y-4">
                 <label className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] ml-4">Identity Protocol (Name)</label>
                 <input 
                   type="text" 
                   placeholder="Enter your handle..." 
                   value={tempProfile.userName} 
                   onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} 
                   className="w-full bg-white/5 rounded-3xl py-5 md:py-6 px-8 font-black text-xl outline-none border border-transparent focus:border-blue-600 transition-all placeholder-zinc-800" 
                 />
               </div>

               <div className="space-y-4">
                 <label className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] ml-4">Neural License Link</label>
                 <div 
                   onClick={handleOpenLicenseKey}
                   className={`w-full py-6 px-8 rounded-3xl border cursor-pointer transition-all flex items-center justify-between ${hasLicense ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                 >
                   <span className={`font-black text-[13px] uppercase tracking-widest ${hasLicense ? 'text-emerald-400' : 'text-zinc-700'}`}>{hasLicense ? 'Matrix Synced ✓' : 'Link Neural Matrix Key...'}</span>
                   <Fingerprint size={24} className={hasLicense ? 'text-emerald-400' : 'text-zinc-800'} />
                 </div>
               </div>

               <div className="space-y-4">
                 <label className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] ml-4">Sync Protocol</label>
                 <div className="grid grid-cols-2 gap-4">
                   {['Male', 'Female', 'Other', 'Secret'].map((g) => (
                     <button 
                       key={g} 
                       onClick={() => setTempProfile({...tempProfile, gender: g as Gender})}
                       className={`py-4 md:py-5 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all border ${tempProfile.gender === g ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-600/30' : 'bg-white/5 border-transparent text-zinc-700 hover:bg-white/10'}`}
                     >
                       {g}
                     </button>
                   ))}
                 </div>
               </div>
             </div>

             <div className="pt-6">
                <button 
                  onClick={handleOnboardingComplete} 
                  disabled={!tempProfile.userName || !hasLicense}
                  className={`w-full py-6 md:py-7 rounded-[32px] font-black text-xl uppercase tracking-[0.3em] transition-all ${tempProfile.userName && hasLicense ? 'bg-blue-600 shadow-2xl shadow-blue-600/40 text-white hover:scale-[1.03] active:scale-95' : 'bg-zinc-900 text-zinc-800 cursor-not-allowed'}`}
                >
                  Activate Vibe
                </button>
                <p className="mt-6 text-[9px] font-black uppercase tracking-[0.4em] text-zinc-800 text-center flex items-center justify-center gap-2">
                   <ShieldAlert size={10} /> Secure Frequency Matrix Link
                </p>
             </div>
          </div>
        </div>
      )}

      {/* History Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[10000] w-80 md:w-96 transition-transform duration-700 transform ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'} border-r shadow-[50px_0_100px_rgba(0,0,0,0.5)] ${theme === 'dark' ? 'bg-[#080808] border-white/5' : 'bg-white border-black/5'}`}>
         <div className="flex flex-col h-full">
            <div className="p-10 flex items-center justify-between border-b border-white/5">
               <h2 className="font-black uppercase tracking-[0.4em] text-[11px] flex items-center gap-3 text-zinc-500"><History size={18}/> Neural Archive</h2>
               <button onClick={() => setIsHistoryOpen(false)} className="p-2.5 text-zinc-500 hover:text-white transition-all"><X size={20}/></button>
            </div>
            <div className="p-8">
               <button onClick={() => handleNewChat(true)} className="w-full py-5 bg-blue-600 text-white rounded-[28px] font-black flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:scale-105 transition-all"><Plus size={20}/> New Link</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-10 space-y-3 custom-scrollbar">
               {sessions.length === 0 ? (
                 <div className="h-60 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.4em] text-zinc-900 text-center px-10 leading-relaxed">Matrix Empty. Begin a frequency sync.</div>
               ) : (
                 sessions.map(s => (
                   <div key={s.id} onClick={() => { setActiveSessionId(s.id); setIsHistoryOpen(false); }} className={`group w-full p-5 rounded-[28px] text-left border-2 transition-all cursor-pointer relative ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-600/30' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                     <div className={`font-black text-[13px] truncate pr-12 ${activeSessionId === s.id ? 'text-blue-500' : 'text-zinc-500'}`}>{s.title}</div>
                     <div className="text-[9px] font-bold text-zinc-700 mt-1 uppercase tracking-widest">{new Date(s.lastTimestamp).toLocaleDateString()}</div>
                     <button onClick={(e) => { e.stopPropagation(); setSessions(prev => prev.filter(x => x.id !== s.id)); if(activeSessionId === s.id) setActiveSessionId(null); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-rose-500/30 transition-all hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl">
                        <Trash2 size={18}/>
                     </button>
                   </div>
                 ))
               )}
            </div>
         </div>
      </div>

      {/* Neural Library Sidebar */}
      <div className={`fixed inset-y-0 right-0 z-[10000] w-80 md:w-96 transition-transform duration-700 transform ${isLibraryOpen ? 'translate-x-0' : 'translate-x-full'} border-l shadow-[-50px_0_100px_rgba(0,0,0,0.5)] ${theme === 'dark' ? 'bg-[#080808] border-white/5' : 'bg-white border-black/5'}`}>
         <div className="flex flex-col h-full">
            <div className="p-10 flex items-center justify-between border-b border-white/5">
               <h2 className="font-black uppercase tracking-[0.4em] text-[11px] flex items-center gap-3 text-blue-500"><Brain size={20}/> Core Memories</h2>
               <button onClick={() => { setIsLibraryOpen(false); setSelectedPinnedId(null); }} className="p-2.5 text-zinc-500 hover:text-white transition-all"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
               {pinnedMessages.length === 0 ? (
                 <div className="h-60 flex flex-col items-center justify-center text-center px-8 space-y-4">
                    <div className="p-6 bg-zinc-900 rounded-full text-zinc-800"><Pin size={32} /></div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-800 leading-relaxed">Pin frequencies to save them to your core memory bank for future assessments.</p>
                 </div>
               ) : (
                 pinnedMessages.map(m => (
                   <div key={m.id} onClick={() => setSelectedPinnedId(m.id === selectedPinnedId ? null : m.id)} className={`p-5 rounded-[30px] border-2 transition-all cursor-pointer ${selectedPinnedId === m.id ? 'bg-blue-600/10 border-blue-500/40' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                      <div className="flex items-center justify-between mb-2"><span className="text-[8px] font-black uppercase text-blue-500 tracking-[0.2em]">{m.isNote ? 'Memory' : 'Neural Log'}</span><span className="text-[8px] font-bold text-zinc-700">{new Date(m.timestamp).toLocaleDateString()}</span></div>
                      <div className="text-[12px] leading-relaxed line-clamp-3 font-semibold text-zinc-300">{m.text}</div>
                   </div>
                 ))
               )}
            </div>
            {selectedPinnedId && (
              <div className="p-8 border-t border-white/5 space-y-4 animate-slide-up bg-black/40 backdrop-blur-xl">
                <button onClick={() => { 
                  const msg = pinnedMessages.find(x => x.id === selectedPinnedId);
                  if(msg) handleSendToAI(`Yo Mr. Cute, give me a quick slang summary of this: "${msg.text}"`);
                  setIsLibraryOpen(false);
                }} className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:bg-zinc-800"><StickyNote size={16}/> Extract Essence</button>
                <button onClick={() => generateNeuralQuiz(selectedPinnedId)} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl hover:scale-105 transition-all"><GraduationCap size={20}/> Assessment</button>
              </div>
            )}
         </div>
      </div>

      {/* Voice Selection Modal */}
      {isVoiceModeModalOpen && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center p-8 animate-fade-in">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-3xl" onClick={() => setIsVoiceModeModalOpen(false)} />
          <div className={`relative w-full max-w-sm rounded-[60px] p-12 space-y-12 border shadow-[0_0_100px_rgba(59,130,246,0.2)] animate-scale-in ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10'}`}>
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-blue-600/10 rounded-[30px] flex items-center justify-center mx-auto text-blue-500 shadow-inner"><Mic size={36}/></div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">Voice Matrix</h2>
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">Choose Link Protocol</p>
              </div>
            </div>
            <div className="space-y-4">
              <button onClick={() => startVoiceMode('chat')} className="w-full py-6 bg-blue-600 text-white rounded-[32px] font-black uppercase text-[11px] tracking-[0.3em] flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl hover:scale-[1.03]"><MessageCircle size={22}/> Voice Vibe</button>
              <button onClick={() => startVoiceMode('note')} className="w-full py-6 bg-zinc-900 text-white rounded-[32px] font-black uppercase text-[11px] tracking-[0.3em] flex items-center justify-center gap-4 transition-all active:scale-95 border border-white/5 hover:bg-zinc-800"><StickyNote size={22}/> Trace Collector</button>
            </div>
            <button onClick={() => setIsVoiceModeModalOpen(false)} className="w-full py-2 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700 hover:text-zinc-400 transition-all">Cancel Sync</button>
          </div>
        </div>
      )}

      {/* Quiz Modal */}
      {activeQuiz && (
        <div className="fixed inset-0 z-[12000] bg-black/98 backdrop-blur-3xl flex flex-col p-6 overflow-y-auto custom-scrollbar animate-fade-in">
           <div className="max-w-3xl mx-auto w-full space-y-12 pb-24 pt-12">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-5">
                    <div className="p-5 bg-blue-600 rounded-[28px] text-white shadow-2xl animate-pulse"><GraduationCap size={28}/></div>
                    <div className="space-y-1">
                      <h2 className="text-2xl font-black uppercase italic tracking-tighter">{activeQuiz.title}</h2>
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Memory Assessment Phase</p>
                    </div>
                 </div>
                 <button onClick={() => setActiveQuiz(null)} className="p-4 text-zinc-500 bg-white/5 rounded-3xl hover:bg-rose-500/10 hover:text-rose-500 transition-all"><X size={24}/></button>
              </div>
              <div className="space-y-8">
                 {activeQuiz.questions.map((q, idx) => (
                    <div key={idx} className={`p-10 rounded-[48px] border-2 transition-all ${isQuizSubmitted ? (quizAnswers[idx] === q.correctAnswer ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20') : 'bg-white/5 border-white/10'}`}>
                       <h4 className="font-bold text-lg mb-8 leading-relaxed">"{q.question}"</h4>
                       <div className="grid grid-cols-1 gap-3">
                          {q.options.map((opt, oIdx) => (
                             <button key={oIdx} onClick={() => !isQuizSubmitted && setQuizAnswers(p => ({...p, [idx]: opt}))} className={`p-5 rounded-2xl text-left text-sm font-black border-2 transition-all ${isQuizSubmitted ? (opt === q.correctAnswer ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : quizAnswers[idx] === opt ? 'bg-rose-500 border-rose-500 text-white' : 'opacity-40 border-transparent') : (quizAnswers[idx] === opt ? 'bg-blue-600 border-blue-500 text-white shadow-xl' : 'bg-white/5 border-transparent hover:bg-white/10')}`}>
                                {opt}
                             </button>
                          ))}
                       </div>
                       {isQuizSubmitted && (
                         <div className={`mt-6 p-5 rounded-2xl text-[11px] font-bold leading-relaxed border ${quizAnswers[idx] === q.correctAnswer ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10' : 'bg-rose-500/10 text-rose-400 border-rose-500/10'}`}>
                           {q.explanation}
                         </div>
                       )}
                    </div>
                 ))}
              </div>
              {!isQuizSubmitted ? (
                 <button onClick={() => { if(Object.keys(quizAnswers).length < activeQuiz.questions.length) return; setIsQuizSubmitted(true); }} className="w-full py-6 bg-blue-600 text-white rounded-[32px] font-black uppercase tracking-[0.4em] transition-all shadow-2xl hover:scale-[1.02] active:scale-95 text-[13px]">Finalize Vibe Check</button>
              ) : (
                 <div className="text-center space-y-8 animate-slide-up pt-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.6em] text-zinc-600">Sync Resolution</p>
                      <h3 className="text-7xl font-black text-blue-500 italic tracking-tighter shadow-blue-600/20 drop-shadow-2xl">{Math.round((activeQuiz.questions.filter((q, i) => quizAnswers[i] === q.correctAnswer).length / activeQuiz.questions.length) * 100)}%</h3>
                    </div>
                    <button onClick={() => setActiveQuiz(null)} className="px-12 py-5 bg-white text-black rounded-[28px] font-black uppercase text-[11px] tracking-[0.3em] hover:scale-105 active:scale-95 transition-all shadow-xl">Complete Sync</button>
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
}
