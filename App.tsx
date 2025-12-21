
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
  Flame,
  AlertCircle,
  Gamepad2,
  Command
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES, PERSONALITY_STYLES } from './constants';
import { PersonalityId, Personality, AppSettings, User, ChatSession, Message, ReactionType, Notification, FileAttachment, Quiz, QuizQuestion, GroundingChunk, Gender } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';

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
    <div className={`relative flex items-center justify-center w-36 h-36 md:w-64 md:h-64 transition-all duration-300 ${getAnimationClass()}`}>
      <div 
        className={`absolute inset-0 rounded-full blur-3xl transition-opacity duration-700 ${active || isThinking ? 'opacity-80' : 'opacity-30'}`} 
        style={{ backgroundColor: style.glow }}
      />
      <div 
        className={`relative w-20 h-20 md:w-36 md:h-36 rounded-full transition-all duration-75 ease-out flex items-center justify-center shadow-2xl ${active ? `bg-gradient-to-br ${style.gradient}` : 'bg-zinc-800'}`}
        style={{ transform: `scale(${scale})`, boxShadow: active ? `0 0 60px ${style.glow}` : 'none' }}
      >
        <div className={`w-full h-full rounded-full bg-white/10 ${active ? 'animate-orb-float' : ''}`} />
      </div>
    </div>
  );
};

const SyncMeter = ({ level }: { level: number }) => (
  <div className="flex flex-col items-center gap-1.5 w-full max-w-[100px] md:max-w-[120px]">
    <div className="flex justify-between w-full px-1">
      <span className="text-[6px] md:text-[7px] font-black uppercase tracking-widest text-zinc-500">Sync</span>
      <span className="text-[6px] md:text-[7px] font-black text-blue-500">{level}%</span>
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
      <div className={`p-2.5 rounded-xl bg-white/5 ${type === 'pulse' ? 'animate-pulse text-blue-500' : type === 'error' ? 'text-rose-500' : ''}`}>
        {type === 'pulse' ? <Flame size={18} /> : type === 'error' ? <AlertCircle size={18} /> : <Bell size={18} />}
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
  const [licenseKey, setLicenseKey] = useState<string>(() => (localStorage.getItem('mr_vibe_license_key') || '').trim());
  const [toast, setToast] = useState<{id: string, message: string, type: string, onClick?: () => void} | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(() => JSON.parse(localStorage.getItem('mr_vibe_notif_history') || '[]'));
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('mr_vibe_active_user') || 'null'));
  const [tempProfile, setTempProfile] = useState<Partial<User> & { licenseKey?: string }>({ 
    userName: '', 
    gender: 'Secret', 
    avatarUrl: AVATARS[0], 
    personalityId: PersonalityId.STUDENT,
    licenseKey: (localStorage.getItem('mr_vibe_license_key') || '').trim()
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

  const currentApiKey = (licenseKey || process.env.API_KEY || '').trim();

  // Utility functions declared early
  const playNotificationSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
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

  const handleApiError = useCallback((error: any) => {
    const message = error.message || String(error);
    if (message.includes("API_KEY_INVALID") || message.includes("invalid api key") || message.includes("401") || message.includes("403") || message.includes("not found")) {
      showToast("Matrix Sync Failed: Your License Key is invalid. Ensure it has no spaces and the Gemini API is enabled.", "error", () => setIsProfileModalOpen(true));
    } else {
      showToast("Signal Interrupted. Check your network connection or try again.", "error");
    }
  }, [showToast]);

  // Heartbeat Auto-save
  useEffect(() => {
    const saveTimer = setInterval(() => {
      if (sessions.length > 0) localStorage.setItem('mr_vibe_sessions', JSON.stringify(sessions));
      if (activeSessionId) localStorage.setItem('mr_vibe_active_session_id', activeSessionId);
    }, 5000);
    return () => clearInterval(saveTimer);
  }, [sessions, activeSessionId]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isNewUser) return;
      const isCmd = e.metaKey || e.ctrlKey;
      if (isCmd) {
        switch (e.key.toLowerCase()) {
          case 'k': e.preventDefault(); setIsHistoryOpen(prev => !prev); setIsLibraryOpen(false); break;
          case 'b': e.preventDefault(); setIsLibraryOpen(prev => !prev); setIsHistoryOpen(false); break;
          case 'p': e.preventDefault(); setIsProfileModalOpen(prev => !prev); break;
          case 'n': e.preventDefault(); handleNewChat(true); break;
          case 'm': e.preventDefault(); handleVoiceButtonClick(); break;
        }
      } else if (e.key === 'Escape') {
        setIsHistoryOpen(false); setIsLibraryOpen(false); setIsProfileModalOpen(false); setIsVoiceModeModalOpen(false); setActiveQuiz(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNewUser, activeSessionId]);

  // Neural Pulse Logic
  useEffect(() => {
    if (user && !isNewUser && currentApiKey) {
      const timer = setTimeout(checkForNeuralPulse, 10000);
      return () => clearTimeout(timer);
    }
  }, [user, isNewUser, activeSessionId, currentApiKey]);

  const checkForNeuralPulse = async () => {
    if (isSyncingMemories || sessions.length === 0 || !activeSessionId || !currentApiKey) return;
    setIsSyncingMemories(true);
    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
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
    } catch (e: any) {
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
    if (autoGreet && currentApiKey) {
      generateInitialGreeting(newId, settings.personalityId);
    }
    return newId;
  }, [settings.personalityId, user, currentApiKey]);

  const generateInitialGreeting = async (sessionId: string, personalityId: PersonalityId) => {
    if (!currentApiKey) return;
    setIsLoading(true);
    setAvatarAnimation('hi');
    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
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
    } catch (e: any) {
      handleApiError(e);
    } finally {
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

  const handleLogout = () => {
    localStorage.clear();
    setIsNewUser(true);
    setUser(null);
    setSessions([]);
    setLicenseKey('');
    setActiveSessionId(null);
    setIsProfileModalOpen(false);
    showToast("Frequency Link Terminated.", "info");
  };

  const handleSendToAI = async (text: string, isAutoGreet = false) => {
    if (!currentApiKey) {
      showToast("LICENSE KEY required.", "error");
      setIsProfileModalOpen(true);
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
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const parts: any[] = [{ text: `${BASE_SYSTEM_PROMPT}\n\nUSER: ${user?.userName}\nMODE: ${selectedVoiceMode}\n\nINPUT: ${text}` }];
      if (currentFile?.data) {
        parts.push({
          inlineData: { data: currentFile.data.split(',')[1], mimeType: currentFile.type }
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
      handleApiError(e);
    } finally { 
      setIsLoading(false); 
      setAvatarAnimation('idle');
    }
  };

  const { connect: connectLive, disconnect: disconnectLive, isLive, isConnecting, volume, outputVolume } = useGeminiLive({
    personality: currentPersonality, settings, user: user as User, mode: selectedVoiceMode, apiKey: currentApiKey,
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
    onError: (m) => { handleApiError(m); }
  });

  const handleVoiceButtonClick = () => {
    if (isLive) disconnectLive(); else setIsVoiceModeModalOpen(true);
  };

  const startVoiceMode = (mode: 'chat' | 'note') => {
    setSelectedVoiceMode(mode);
    setIsVoiceModeModalOpen(false);
    connectLive();
  };

  const generateNeuralQuiz = async (specificMessageId?: string) => {
    if (!currentApiKey) return;
    const contextSource = specificMessageId ? pinnedMessages.find(m => m.id === specificMessageId) : pinnedMessages;
    if (!contextSource || (Array.isArray(contextSource) && contextSource.length === 0)) {
      showToast("Link a memory bubble first.", "info"); return;
    }
    setIsLoading(true); setIsLibraryOpen(false); setAvatarAnimation('thoughtful');
    try {
      const text = Array.isArray(contextSource) ? contextSource.map(m => m.text).join("\n") : contextSource.text;
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `CONTEXT: ${text}\n\nAct as Mr. Cute. Create a 3-question MCQ test based on this for the user. Return ONLY JSON:\n{ "title": "Memory Check", "questions": [ { "question": "", "options": [], "correctAnswer": "", "explanation": "" } ] }`,
        config: { responseMimeType: "application/json" }
      });
      const quizData = JSON.parse(response.text || '{}') as Quiz;
      setActiveQuiz(quizData); setQuizAnswers({}); setIsQuizSubmitted(false);
    } catch (e: any) { handleApiError(e); } finally { setIsLoading(false); setAvatarAnimation('idle'); }
  };

  const handleOnboardingComplete = () => {
    const trimmedKey = (tempProfile.licenseKey || '').trim();
    if (tempProfile.userName && tempProfile.gender && tempProfile.personalityId && trimmedKey) {
      const newUser = { ...tempProfile, avatarUrl: AVATARS[Math.floor(Math.random() * AVATARS.length)], licenseKey: trimmedKey } as User;
      localStorage.setItem('mr_vibe_active_user', JSON.stringify(newUser));
      localStorage.setItem('mr_vibe_license_key', trimmedKey);
      setUser(newUser);
      setLicenseKey(trimmedKey);
      updateSettings({ personalityId: tempProfile.personalityId });
      setIsNewUser(false);
      handleNewChat(true);
    } else {
      showToast("Identity Protocol & License Key incomplete.", "info");
    }
  };

  return (
    <div className={`fixed inset-0 flex flex-col transition-colors duration-700 ${theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-zinc-50 text-black'} overflow-hidden ios-safe-top ios-safe-bottom font-sans w-screen h-screen`}>
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}

      <header className={`h-24 px-4 md:px-8 flex items-center justify-between border-b ${theme === 'dark' ? 'border-white/5 bg-black/50' : 'border-black/5 bg-white/50'} backdrop-blur-3xl z-50 w-full shrink-0 overflow-hidden`}>
        <div className="flex items-center gap-1 md:gap-3 shrink-0">
          <button onClick={() => setIsHistoryOpen(true)} className={`p-3 rounded-2xl active:scale-90 transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-400' : 'hover:bg-black/5 text-zinc-500'}`} title="Archive (Ctrl+K)"><Menu size={22} /></button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-3 rounded-2xl active:scale-90 transition-all ${theme === 'dark' ? 'text-yellow-400' : 'text-blue-600'}`}><Sun size={20} /></button>
        </div>
        
        <div className="flex flex-col items-center gap-2 overflow-hidden mx-2">
          <span className="font-black text-[12px] md:text-[15px] uppercase tracking-[0.3em] md:tracking-[0.5em] text-blue-500 animate-pulse whitespace-nowrap">Mr. Vibe AI</span>
          <SyncMeter level={syncLevel} />
        </div>

        <div className="flex items-center gap-1 md:gap-3 shrink-0">
          <button onClick={() => setIsLibraryOpen(true)} className={`p-3 rounded-2xl relative active:scale-90 transition-all ${theme === 'dark' ? 'text-blue-400 bg-blue-500/10' : 'text-blue-600 bg-blue-500/5'}`} title="Brain (Ctrl+B)">
            <Brain size={20} />
            {pinnedMessages.length > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-500 rounded-full animate-ping" />}
          </button>
          <button onClick={() => setIsProfileModalOpen(true)} className="w-10 h-10 md:w-11 md:h-11 rounded-2xl overflow-hidden border-2 border-white/10 active:scale-90 transition-all shadow-xl shrink-0" title="Identity (Ctrl+P)">
             {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><UserIcon size={18} /></div>}
          </button>
        </div>
      </header>

      <main ref={mainContentRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-10 space-y-10 custom-scrollbar scroll-smooth relative w-full overflow-x-hidden">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-10 animate-fade-in px-6">
            <VibeOrb active={false} isThinking={false} volume={0} outputVolume={0} animationState={avatarAnimation} personalityId={settings.personalityId} />
            <div className="space-y-4 max-w-xs">
              <h3 className="text-[10px] font-black uppercase tracking-[0.6em] text-blue-500 opacity-80">Frequency Offline</h3>
              <p className="text-[11px] font-bold italic text-zinc-600 uppercase tracking-[0.2em] leading-loose">"Yo bestie, let's link up. Drop a line or tap the mic to sync."</p>
              <div className="pt-4 flex flex-wrap justify-center gap-2">
                 <button onClick={() => setInputText("Yo Mr. Cute, what's good?")} className="px-4 py-2 rounded-full border border-white/5 bg-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-blue-400 transition-all">Say Hello</button>
                 <button onClick={() => setIsVoiceModeModalOpen(true)} className="px-4 py-2 rounded-full border border-blue-500/20 bg-blue-600/10 text-[9px] font-black uppercase tracking-widest text-blue-500 hover:bg-blue-600 hover:text-white transition-all">Voice Link</button>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-vibe-in group w-full`}>
              {msg.file && (
                <div className={`mb-3 max-w-[85%] rounded-[28px] overflow-hidden border shadow-2xl ${theme === 'dark' ? 'border-white/10' : 'border-black/5'}`}>
                  {msg.file.type.startsWith('image/') ? <img src={msg.file.data} className="w-full h-auto object-cover max-h-[300px]" /> : <div className="flex items-center gap-3 p-5 bg-white/5"><FileIcon size={24} className="text-blue-500" /><div className="flex-1 truncate font-bold text-[11px]">{msg.file.name}</div></div>}
                </div>
              )}
              <div className={`relative flex items-end gap-3 max-w-[92%]`}>
                {msg.role === 'model' && <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mb-1 border border-white/10"><img src={AVATARS[index % AVATARS.length]} className="w-full h-full object-cover" /></div>}
                <div className={`px-5 py-4 rounded-[28px] text-[14px] md:text-[15px] font-medium shadow-2xl border transition-all duration-300 ${msg.role === 'user' ? 'bg-blue-600 text-white border-blue-500/20 rounded-br-none' : theme === 'dark' ? 'bg-[#121212] text-zinc-100 border-white/5 rounded-bl-none' : 'bg-white text-zinc-900 border-black/5 rounded-bl-none'}`}>
                  {msg.isNote && <div className="flex items-center gap-1.5 mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-blue-400"><StickyNote size={10} /> Neural Trace</div>}
                  <MarkdownText text={msg.text} />
                  {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-white/5 space-y-3">
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2"><Globe size={12} /> Intelligence Sources</p>
                       <div className="flex flex-wrap gap-2">
                          {msg.groundingChunks.map((chunk, idx) => chunk.web && <a key={idx} href={chunk.web.uri} target="_blank" className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-blue-400 hover:bg-blue-600 hover:text-white transition-all truncate max-w-[150px] md:max-w-[200px] flex items-center gap-2"><ExternalLink size={10} /> {chunk.web.title || "Source"}</a>)}
                       </div>
                    </div>
                  )}
                </div>
                {msg.role === 'model' && <button onClick={() => togglePin(msg.id)} className={`p-2.5 rounded-2xl transition-all ${msg.isPinned ? 'text-blue-500 bg-blue-500/10' : 'text-zinc-600 hover:text-blue-500 opacity-0 group-hover:opacity-100 shrink-0'}`}><Pin size={16} fill={msg.isPinned ? 'currentColor' : 'none'} /></button>}
              </div>
            </div>
          ))
        )}
        {isLoading && <div className="flex items-start"><div className={`px-6 py-4 rounded-[26px] border ${theme === 'dark' ? 'bg-[#121212] border-white/5' : 'bg-white border-black/5'}`}><div className="flex gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" /><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" /><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" /></div></div></div>}
        <div ref={messagesEndRef} className="h-10 w-full" />
      </main>

      <footer className={`px-4 pb-8 pt-3 bg-gradient-to-t ${theme === 'dark' ? 'from-black via-black/95' : 'from-zinc-50 via-zinc-50/95'} to-transparent z-40 shrink-0`}>
        {selectedFile && <div className="max-w-3xl mx-auto mb-4 animate-slide-up"><div className={`relative inline-flex items-center gap-4 p-3 rounded-[20px] border shadow-2xl ${theme === 'dark' ? 'bg-[#151515] border-white/10' : 'bg-white border-black/10'}`}><div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">{selectedFile.type.startsWith('image/') ? <img src={selectedFile.data} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-blue-500/10 flex items-center justify-center text-blue-500"><FileText size={14} /></div>}</div><span className="text-[10px] font-bold truncate max-w-[120px] text-zinc-500">{selectedFile.name}</span><button onClick={() => setSelectedFile(null)} className="ml-2 p-1.5 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg text-zinc-600"><X size={12} /></button></div></div>}
        <div className={`max-w-5xl mx-auto flex items-center gap-2 p-1.5 border rounded-[40px] shadow-2xl backdrop-blur-3xl ${theme === 'dark' ? 'bg-[#0a0a0a]/90 border-white/10' : 'bg-white/90 border-black/10'} w-full overflow-hidden`}>
          <button onClick={() => fileInputRef.current?.click()} className="p-3.5 md:p-4 rounded-full text-zinc-500 hover:text-blue-500 active:scale-90 shrink-0"><Paperclip size={20}/><input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setSelectedFile({ data: reader.result as string, name: file.name, type: file.type }); reader.readAsDataURL(file); }} /></button>
          <input type="text" placeholder="Talk to Mr. Cute..." value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} className="flex-1 bg-transparent py-4 font-bold text-[14px] md:text-[15px] outline-none placeholder-zinc-800 min-w-0" />
          <div className="flex items-center gap-1 shrink-0 pr-1">
             <button onClick={handleVoiceButtonClick} className={`p-3.5 md:p-4 rounded-full transition-all active:scale-95 ${isLive ? 'bg-rose-600 text-white animate-pulse' : 'bg-white/5 text-zinc-500'}`}>{isLive ? <MicOff size={20}/> : <Mic size={20}/>}</button>
             <button onClick={() => handleSendToAI(inputText)} className={`p-3.5 md:p-4 rounded-full transition-all active:scale-95 ${(inputText.trim() || selectedFile) ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-700'}`}><Send size={20}/></button>
          </div>
        </div>
      </footer>

      {/* History Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[10000] w-72 md:w-96 transition-transform duration-500 transform ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'} border-r shadow-[50px_0_100px_rgba(0,0,0,0.5)] ${theme === 'dark' ? 'bg-[#080808] border-white/5' : 'bg-white border-black/5'}`}>
         <div className="flex flex-col h-full">
            <div className="p-8 flex items-center justify-between border-b border-white/5">
               <h2 className="font-black uppercase tracking-[0.3em] text-[10px] flex items-center gap-2 text-zinc-500"><History size={16}/> Neural Archive</h2>
               <button onClick={() => setIsHistoryOpen(false)} className="p-2 text-zinc-500 hover:text-white"><X size={18}/></button>
            </div>
            <div className="p-6">
               <button onClick={() => handleNewChat(true)} className="w-full py-4 bg-blue-600 text-white rounded-[24px] font-black flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em] shadow-lg"><Plus size={18}/> New Link</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-10 space-y-2 custom-scrollbar">
               {sessions.length === 0 ? <div className="h-40 flex items-center justify-center text-[9px] font-black uppercase text-zinc-800 text-center px-10">Matrix Empty.</div> : sessions.map(s => (
                 <div key={s.id} onClick={() => { setActiveSessionId(s.id); setIsHistoryOpen(false); }} className={`group w-full p-4 rounded-[24px] text-left border-2 transition-all cursor-pointer relative ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-600/30' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                   <div className={`font-black text-[12px] truncate pr-10 ${activeSessionId === s.id ? 'text-blue-500' : 'text-zinc-500'}`}>{s.title}</div>
                   <button onClick={(e) => { e.stopPropagation(); setSessions(prev => prev.filter(x => x.id !== s.id)); if(activeSessionId === s.id) setActiveSessionId(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-rose-500/20 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl"><Trash2 size={14}/></button>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* Neural Library Sidebar */}
      <div className={`fixed inset-y-0 right-0 z-[10000] w-72 md:w-96 transition-transform duration-500 transform ${isLibraryOpen ? 'translate-x-0' : 'translate-x-full'} border-l shadow-[-50px_0_100px_rgba(0,0,0,0.5)] ${theme === 'dark' ? 'bg-[#080808] border-white/5' : 'bg-white border-black/5'}`}>
         <div className="flex flex-col h-full">
            <div className="p-8 flex items-center justify-between border-b border-white/5">
               <h2 className="font-black uppercase tracking-[0.3em] text-[10px] flex items-center gap-2 text-blue-500"><Brain size={18}/> Core Memories</h2>
               <button onClick={() => { setIsLibraryOpen(false); setSelectedPinnedId(null); }} className="p-2 text-zinc-500 hover:text-white"><X size={18}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
               {pinnedMessages.length === 0 ? <div className="h-60 flex flex-col items-center justify-center text-center px-8 space-y-4"><Pin size={32} className="text-zinc-900" /><p className="text-[9px] font-black uppercase text-zinc-800">Pin frequencies to save memories.</p></div> : pinnedMessages.map(m => (
                 <div key={m.id} onClick={() => setSelectedPinnedId(m.id === selectedPinnedId ? null : m.id)} className={`p-4 rounded-[24px] border-2 transition-all cursor-pointer ${selectedPinnedId === m.id ? 'bg-blue-600/10 border-blue-500/40' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                    <div className="text-[11px] leading-relaxed line-clamp-3 font-semibold text-zinc-300">{m.text}</div>
                 </div>
               ))}
            </div>
            {selectedPinnedId && <div className="p-6 border-t border-white/5 space-y-3 bg-black/40 backdrop-blur-xl shrink-0"><button onClick={() => { const msg = pinnedMessages.find(x => x.id === selectedPinnedId); if(msg) handleSendToAI(`Yo Mr. Cute, give me a quick slang summary of this: "${msg.text}"`); setIsLibraryOpen(false); }} className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-3 transition-all"><StickyNote size={14}/> Essence</button><button onClick={() => generateNeuralQuiz(selectedPinnedId)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-3 shadow-lg"><GraduationCap size={16}/> Assessment</button></div>}
         </div>
      </div>

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={() => setIsProfileModalOpen(false)} />
           <div className={`relative w-full max-w-lg rounded-[48px] p-8 md:p-12 space-y-8 animate-scale-in border ${theme === 'dark' ? 'bg-[#080808] border-white/10' : 'bg-white border-black/10'} max-h-[90vh] overflow-y-auto custom-scrollbar`}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tight">Identity Protocol</h2>
                <button onClick={() => setIsProfileModalOpen(false)} className="p-2.5 bg-white/5 rounded-2xl text-zinc-500 hover:bg-white/10"><X size={20}/></button>
              </div>
              <div className="space-y-6">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Label Name</label>
                    <input type="text" value={user?.userName} onChange={e => setUser(u => u ? ({...u, userName: e.target.value}) : null)} onBlur={() => localStorage.setItem('mr_vibe_active_user', JSON.stringify(user))} className="w-full py-4 px-6 rounded-[24px] bg-white/5 border border-white/5 focus:border-blue-500 outline-none font-black text-lg transition-all" />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1 flex items-center gap-2"><Key size={12} /> License Key (API Key)</label>
                    <input type="password" value={licenseKey} onChange={e => { const val = e.target.value.trim(); setLicenseKey(val); localStorage.setItem('mr_vibe_license_key', val); }} className="w-full py-4 px-6 rounded-[24px] bg-white/5 border border-white/5 focus:border-blue-500 outline-none font-mono text-[12px] transition-all" placeholder="Paste API Key here..." />
                    <p className="text-[9px] font-medium text-zinc-600 px-1 leading-relaxed">Ensure no extra spaces. Sync requires an active Gemini API key.</p>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Archetype (Vibe)</label>
                    <div className="grid grid-cols-2 gap-3">
                       {Object.values(PERSONALITIES).map(p => <button key={p.id} onClick={() => { updateSettings({ personalityId: p.id }); showToast(`Synced: ${p.name}`, "info"); }} className={`p-4 rounded-[28px] font-black text-[10px] uppercase border-2 transition-all flex items-center gap-3 ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-transparent text-zinc-600 hover:bg-white/10'}`}><span className="text-xl">{p.emoji}</span><span className="truncate">{p.name}</span></button>)}
                    </div>
                 </div>
                 <div className="pt-6 border-t border-white/5"><button onClick={handleLogout} className="w-full py-4 rounded-[24px] bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-rose-500 hover:text-white transition-all"><LogOut size={16} /> Terminate Vibe (Logout)</button></div>
              </div>
           </div>
        </div>
      )}

      {/* Onboarding */}
      {isNewUser && (
        <div className="fixed inset-0 z-[12000] bg-black flex items-center justify-center p-4 md:p-8 overflow-y-auto custom-scrollbar w-screen h-screen">
          <div className="w-full max-w-xl bg-[#080808] rounded-[56px] p-8 md:p-14 text-center border border-white/5 animate-scale-in space-y-10 shadow-[0_0_150px_rgba(59,130,246,0.15)] my-auto">
             <Logo className="w-12 h-12 mx-auto" />
             <div className="space-y-2"><h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">Mr. Vibe AI</h1><p className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-500">Identity Initiation</p></div>
             <div className="space-y-8 text-left">
               <div className="space-y-4"><label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-4 flex items-center gap-2"><Key size={12} /> ENTER LICENSE KEY (API KEY)</label><div className="relative"><input type="password" placeholder="39-character Gemini Key..." value={tempProfile.licenseKey} onChange={e => setTempProfile({...tempProfile, licenseKey: e.target.value.trim()})} className="w-full bg-white/5 rounded-[28px] py-5 px-8 font-mono text-[12px] outline-none border border-transparent focus:border-blue-600 transition-all placeholder-zinc-800" /><div className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-800 pointer-events-none"><Fingerprint size={20} /></div></div></div>
               <div className="space-y-4"><label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-4">What's your handle, bestie?</label><input type="text" placeholder="Your name..." value={tempProfile.userName} onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} className="w-full bg-white/5 rounded-[28px] py-5 px-8 font-black text-lg outline-none border border-transparent focus:border-blue-600 transition-all placeholder-zinc-800" /></div>
               <div className="space-y-4"><label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-4 flex items-center gap-2"><Palette size={12} /> PICK MY VIBE (ARCHETYPE)</label><div className="grid grid-cols-2 gap-2">{Object.values(PERSONALITIES).map((p) => <button key={p.id} onClick={() => setTempProfile({...tempProfile, personalityId: p.id})} className={`flex flex-col items-center gap-1 p-4 rounded-[28px] border-2 transition-all ${tempProfile.personalityId === p.id ? 'bg-blue-600/10 border-blue-600 text-white shadow-lg' : 'bg-white/5 border-transparent text-zinc-600'}`}><span className="text-2xl">{p.emoji}</span><span className="text-[9px] font-black uppercase">{p.name}</span></button>)}</div></div>
               <div className="space-y-4"><label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-4">Sync Protocol</label><div className="grid grid-cols-4 gap-2">{['Male', 'Female', 'Other', 'Secret'].map((g) => <button key={g} onClick={() => setTempProfile({...tempProfile, gender: g as Gender})} className={`py-4 rounded-[20px] text-[9px] font-black uppercase transition-all border ${tempProfile.gender === g ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-transparent text-zinc-700'}`}>{g}</button>)}</div></div>
             </div>
             <div className="pt-4"><button onClick={handleOnboardingComplete} disabled={!tempProfile.userName || !tempProfile.personalityId || !tempProfile.licenseKey} className={`w-full py-6 rounded-[32px] font-black text-lg uppercase tracking-widest transition-all ${tempProfile.userName && tempProfile.personalityId && tempProfile.licenseKey ? 'bg-blue-600 shadow-xl shadow-blue-600/30 text-white hover:scale-[1.02]' : 'bg-zinc-900 text-zinc-800 cursor-not-allowed'}`}>Start Frequency Sync</button><p className="mt-6 text-[8px] font-black uppercase text-zinc-800 flex items-center justify-center gap-2 tracking-[0.3em]"><ShieldAlert size={10} /> Secure Identity Verification Protocol</p></div>
          </div>
        </div>
      )}

      {/* Voice and Quiz Modals follow original structure but ensured overflow-hidden on App to prevent the white bar shift */}
      {isVoiceModeModalOpen && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center p-8 animate-fade-in"><div className="absolute inset-0 bg-black/98 backdrop-blur-3xl" onClick={() => setIsVoiceModeModalOpen(false)} /><div className={`relative w-full max-w-sm rounded-[48px] p-10 space-y-10 border shadow-2xl animate-scale-in ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10'}`}><div className="text-center space-y-4"><div className="w-16 h-16 bg-blue-600/10 rounded-[24px] flex items-center justify-center mx-auto text-blue-500 shadow-inner"><Mic size={32}/></div><div className="space-y-1"><h2 className="text-xl font-black uppercase italic tracking-tight">Voice Matrix</h2><p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Select Protocol</p></div></div><div className="space-y-3"><button onClick={() => startVoiceMode('chat')} className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-600/20"><MessageCircle size={18}/> Voice Vibe</button><button onClick={() => startVoiceMode('note')} className="w-full py-5 bg-zinc-900 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 transition-all border border-white/5"><StickyNote size={18}/> Trace Collector</button></div><button onClick={() => setIsVoiceModeModalOpen(false)} className="w-full py-2 text-[9px] font-black uppercase tracking-widest text-zinc-700">Cancel Sync</button></div></div>
      )}

      {activeQuiz && (
        <div className="fixed inset-0 z-[12000] bg-black/98 backdrop-blur-3xl flex flex-col p-6 overflow-y-auto custom-scrollbar animate-fade-in"><div className="max-w-3xl mx-auto w-full space-y-10 pb-24 pt-12"><div className="flex items-center justify-between"><div className="flex items-center gap-4"><div className="p-4 bg-blue-600 rounded-2xl text-white shadow-xl animate-pulse"><GraduationCap size={24}/></div><div><h2 className="text-xl font-black uppercase italic tracking-tight">{activeQuiz.title}</h2><p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Memory Assessment</p></div></div><button onClick={() => setActiveQuiz(null)} className="p-3 text-zinc-500 bg-white/5 rounded-2xl"><X size={20}/></button></div><div className="space-y-6">{activeQuiz.questions.map((q, idx) => (<div key={idx} className={`p-8 rounded-[36px] border-2 transition-all ${isQuizSubmitted ? (quizAnswers[idx] === q.correctAnswer ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20') : 'bg-white/5 border-white/10'}`}><h4 className="font-bold text-base mb-6 leading-relaxed">"{q.question}"</h4><div className="grid grid-cols-1 gap-3">{q.options.map((opt, oIdx) => (<button key={oIdx} onClick={() => !isQuizSubmitted && setQuizAnswers(p => ({...p, [idx]: opt}))} className={`p-4 rounded-[18px] text-left text-[13px] font-black border-2 transition-all ${isQuizSubmitted ? (opt === q.correctAnswer ? 'bg-emerald-500 border-emerald-500 text-white' : quizAnswers[idx] === opt ? 'bg-rose-500 border-rose-500 text-white' : 'opacity-40 border-transparent') : (quizAnswers[idx] === opt ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-transparent hover:bg-white/10')}`}>{opt}</button>))}</div>{isQuizSubmitted && <div className={`mt-5 p-4 rounded-xl text-[10px] font-bold leading-relaxed border ${quizAnswers[idx] === q.correctAnswer ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10' : 'bg-rose-500/10 text-rose-400 border-rose-500/10'}`}>{q.explanation}</div>}</div>))}</div>{!isQuizSubmitted ? (<button onClick={() => { if(Object.keys(quizAnswers).length < activeQuiz.questions.length) return; setIsQuizSubmitted(true); }} className="w-full py-5 bg-blue-600 text-white rounded-[28px] font-black uppercase tracking-widest text-[11px] shadow-xl">Finalize Assessment</button>) : (<div className="text-center space-y-6 pt-4"><div className="space-y-1"><p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Sync Resolution</p><h3 className="text-6xl font-black text-blue-500 italic tracking-tighter drop-shadow-lg">{Math.round((activeQuiz.questions.filter((q, i) => quizAnswers[i] === q.correctAnswer).length / activeQuiz.questions.length) * 100)}%</h3></div><button onClick={() => setActiveQuiz(null)} className="px-10 py-4 bg-white text-black rounded-[24px] font-black uppercase text-[10px] tracking-widest">Complete Sync</button></div>)}</div></div>
      )}
    </div>
  );
}
