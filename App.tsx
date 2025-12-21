
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
  History as HistoryIcon
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES } from './constants';
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

const VibeOrb = ({ active, isThinking, isAiSpeaking, volume, outputVolume, animationState }: { 
  active: boolean, 
  isThinking: boolean, 
  isAiSpeaking?: boolean,
  volume: number,
  outputVolume: number,
  animationState?: OrbAnimationState
}) => {
  const currentVol = isAiSpeaking ? outputVolume : volume;
  const scale = active ? 1 + currentVol * 1.8 : 1;
  
  const getAnimationClass = () => {
    if (animationState === 'hi') return 'animate-hi-pulse';
    if (animationState === 'excited') return 'animate-excited-bounce';
    if (animationState === 'thoughtful') return 'animate-thoughtful-wobble';
    if (isThinking) return 'animate-pulse-orb';
    return '';
  };

  return (
    <div className={`relative flex items-center justify-center w-40 h-40 md:w-56 md:h-56 transition-all duration-300 ${getAnimationClass()}`}>
      <div className={`absolute inset-0 rounded-full bg-blue-500/10 blur-3xl transition-opacity duration-500 ${isThinking || animationState !== 'idle' ? 'opacity-100' : 'opacity-50'}`} />
      <div 
        className={`relative w-20 h-20 md:w-28 md:h-28 rounded-full transition-all duration-75 ease-out flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.5)] ${active || animationState !== 'idle' ? 'bg-gradient-to-br from-blue-400 to-indigo-600' : 'bg-zinc-800'}`}
        style={{ transform: `scale(${scale})` }}
      >
        <div className={`w-full h-full rounded-full bg-white/10 ${active ? 'animate-orb-float' : ''}`} />
      </div>
    </div>
  );
};

const NotificationToast = ({ message, type, onClose, onClick }: { message: string, type: string, onClose: () => void, onClick?: () => void }) => (
  <div className="fixed top-4 md:top-8 inset-x-4 z-[10000] flex justify-center pointer-events-none">
    <div 
      onClick={onClick}
      className={`w-full max-sm mb-4 bg-zinc-900 shadow-2xl rounded-[28px] border flex items-center gap-4 p-5 pointer-events-auto animate-slide-up cursor-pointer ${
        type === 'success' ? 'border-emerald-500/20 text-emerald-400' :
        type === 'error' ? 'border-rose-500/20 text-rose-400' :
        type === 'pulse' ? 'border-blue-500/50 bg-blue-950/20 text-blue-400' :
        'border-blue-500/20 text-blue-400'
      }`}
    >
      <div className={`p-2.5 rounded-xl bg-white/5 ${type === 'pulse' ? 'animate-pulse text-blue-500' : ''}`}>
        {type === 'pulse' ? <Brain size={18} /> : <Bell size={18} />}
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
      setTimeout(checkForNeuralPulse, 3000);
    }
  }, [hasLicense, user, isNewUser]);

  const checkForNeuralPulse = async () => {
    if (isSyncingMemories || sessions.length === 0) return;
    setIsSyncingMemories(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const lastSession = sessions[0];
      const context = lastSession.messages.slice(-10).map(m => m.text).join('\n');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ text: `CONTEXT HISTORY: ${context}\n\nTASK: You are Mr. Cute. Scan the context for any upcoming events or personal notes the user mentioned. If found, generate a SHORT slang-heavy follow-up question (max 10 words). If nothing relevant is found, return exactly 'none'.` }]
      });

      const pulseText = response.text?.trim();
      if (pulseText && pulseText.toLowerCase() !== 'none') {
        showToast(pulseText, 'pulse', () => {
          handleNewChat(false);
          handleSendToAI(`Yo Mr. Cute, you asked: "${pulseText}". Let's chat!`, true);
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
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, isLoading, liveTranscript, scrollToBottom]);

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
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
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
       setTimeout(() => setToast(current => current?.id === id ? null : current), 6000);
    }
  }, []);

  const handleNewChat = useCallback((autoGreet = true) => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { 
      id: newId, title: 'Linking...', messages: [], lastTimestamp: Date.now(), personalityId: settings.personalityId 
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
      const prompt = `ACT AS Mr. Cute. Say hi to ${user?.userName || 'bestie'}. Keep it very brief and high vibe. Introduce yourself as Mr. Cute only this once.`;
      
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
    showToast("Linked to your Neural Library.", "success");
  };

  const handleOpenLicenseKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      const has = await window.aistudio.hasSelectedApiKey();
      setHasLicense(has);
    }
  };

  const handleSendToAI = async (text: string, isAutoGreet = false) => {
    if (!hasLicense) {
      showToast("LICENSE KEY required.", "error");
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
           contents: `Summarize in 2 words for a chat title: ${text}`
        });
        const title = titleResp.text?.trim().replace(/"/g, '') || 'New Vibe';
        setSessions(prev => {
           const updated = prev.map(s => s.id === sessionId ? { ...s, title } : s);
           localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
           return updated;
        });
      }

      playNotificationSound();
    } catch (e: any) { 
      if (e.message?.includes("Requested entity was not found")) setHasLicense(false);
      showToast("Link error. Re-link frequencies.", "error"); 
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
        if (found) { updateSettings({ voiceName: found.id }); showToast(`Voice synced: ${found.name}`, "success"); }
      }
    },
    onError: (m) => {
      if (m.includes("Requested entity was not found")) setHasLicense(false);
      showToast(m, "error");
    }
  });

  const handleVoiceButtonClick = () => {
    if (!hasLicense) { showToast("License required.", "error"); handleOpenLicenseKey(); return; }
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
      showToast("Link a memory first.", "info");
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
        contents: `CONTEXT: ${text}\n\nAct as Mr. Cute. Create a 3-question MCQ test based on this. Return ONLY JSON:\n{ "title": "Neural Check", "questions": [ { "question": "", "options": [], "correctAnswer": "", "explanation": "" } ] }`,
        config: { responseMimeType: "application/json" }
      });

      const quizData = JSON.parse(response.text || '{}') as Quiz;
      setActiveQuiz(quizData);
      setQuizAnswers({});
      setIsQuizSubmitted(false);
    } catch (e) {
      showToast("Sync failed.", "error");
    } finally {
      setIsLoading(false);
      setAvatarAnimation('idle');
    }
  };

  const handleOnboardingComplete = async () => {
    if (!hasLicense) {
      await handleOpenLicenseKey();
    }
    
    // Check again after license attempt
    const currentlyLicensed = await window.aistudio?.hasSelectedApiKey();
    if (!currentlyLicensed) {
      showToast("Identity verified, but Neural Link is missing.", "error");
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
      showToast("Complete your Identity Matrix.", "info");
    }
  };

  return (
    <div className={`flex flex-col h-full w-full transition-colors duration-500 ${theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-zinc-50 text-black'} relative overflow-hidden ios-safe-top ios-safe-bottom font-sans`}>
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}

      <header className={`h-20 px-4 md:px-6 flex items-center justify-between border-b ${theme === 'dark' ? 'border-white/5 bg-black/40' : 'border-black/5 bg-white/40'} backdrop-blur-3xl z-50`}>
        <div className="flex items-center gap-1 md:gap-3">
          <button onClick={() => setIsHistoryOpen(true)} className={`p-3 rounded-2xl active:scale-90 ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-400' : 'hover:bg-black/5 text-zinc-500'}`}><Menu size={22} /></button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-3 rounded-2xl active:scale-90 ${theme === 'dark' ? 'text-yellow-400' : 'text-blue-600'}`}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-black text-[11px] uppercase tracking-[0.4em] text-blue-500">Mr. Vibe AI</span>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <button onClick={() => setIsLibraryOpen(true)} className={`p-3 rounded-2xl relative active:scale-90 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
            <Brain size={20} />
            {pinnedMessages.length > 0 && <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
          </button>
          <button onClick={() => setIsProfileModalOpen(true)} className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 active:scale-90"><img src={user?.avatarUrl} className="w-full h-full object-cover" /></button>
        </div>
      </header>

      <main ref={mainContentRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-8 custom-scrollbar scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-12 animate-fade-in">
            <VibeOrb active={false} isThinking={false} volume={0} outputVolume={0} animationState={avatarAnimation} />
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-[0.5em] text-blue-500">Awaiting Signal</h3>
              <p className="text-[10px] font-bold italic text-zinc-600 uppercase tracking-widest leading-relaxed">Let's vibe. What's the frequency today?</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-vibe-in group`}>
              {msg.file && (
                <div className={`mb-2 max-w-[80%] rounded-[24px] overflow-hidden border shadow-xl ${theme === 'dark' ? 'border-white/10' : 'border-black/5'}`}>
                  {msg.file.type.startsWith('image/') ? (
                    <img src={msg.file.data} className="w-full h-auto object-cover max-h-[250px]" />
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-white/5">
                      <FileIcon size={20} className="text-blue-500" />
                      <div className="flex-1 truncate font-bold text-[10px]">{msg.file.name}</div>
                    </div>
                  )}
                </div>
              )}
              <div className="relative flex items-end gap-2 max-w-[90%]">
                <div className={`px-5 py-3.5 rounded-[24px] text-sm font-semibold shadow-xl border transition-all duration-300 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white border-blue-500/20 rounded-br-sm' 
                    : theme === 'dark' 
                      ? 'bg-[#1a1a1a] text-zinc-100 border-white/5 rounded-bl-sm' 
                      : 'bg-white text-zinc-900 border-black/5 rounded-bl-sm'
                }`}>
                  {msg.isNote && <div className="flex items-center gap-1 mb-1 text-[8px] font-black uppercase tracking-widest text-blue-400"><StickyNote size={8} /> Saved Frequency</div>}
                  <MarkdownText text={msg.text} />
                  
                  {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                       <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5"><Globe size={10} /> Neural Citations</p>
                       <div className="flex flex-wrap gap-2">
                          {msg.groundingChunks.map((chunk, idx) => chunk.web && (
                             <a key={idx} href={chunk.web.uri} target="_blank" className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[9px] font-bold text-blue-400 hover:bg-white/10 transition-all truncate max-w-[150px]">
                               {chunk.web.title || chunk.web.uri}
                             </a>
                          ))}
                       </div>
                    </div>
                  )}
                </div>
                {msg.role === 'model' && (
                  <button onClick={() => togglePin(msg.id)} className={`p-2 rounded-xl transition-all ${msg.isPinned ? 'text-blue-500 bg-blue-500/10' : 'text-zinc-600 hover:text-blue-500 opacity-0 group-hover:opacity-100'}`}>
                    <Pin size={14} fill={msg.isPinned ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        
        {liveTranscript.length > 0 && (
          <div className="flex flex-col gap-3">
            {liveTranscript.map((t, idx) => (
              <div key={idx} className={`flex flex-col ${t.isModel ? 'items-start' : 'items-end'} animate-fade-in opacity-60 italic`}>
                <div className={`px-5 py-3 rounded-[20px] text-[13px] border ${
                  t.isModel ? 'bg-[#1a1a1a]/50 border-white/5' : 'bg-blue-600/20 border-blue-500/10'
                }`}>
                  {t.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex items-start">
            <div className={`px-5 py-3 rounded-[20px] border ${theme === 'dark' ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-black/5'}`}>
              <div className="flex gap-1.5"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" /><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" /><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" /></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4 w-full" />
      </main>

      <footer className={`px-4 pb-6 pt-2 bg-gradient-to-t ${theme === 'dark' ? 'from-black via-black/90' : 'from-zinc-50 via-zinc-50/90'} to-transparent z-40 ios-safe-bottom`}>
        {selectedFile && (
          <div className="max-w-2xl mx-auto mb-4 animate-slide-up">
            <div className={`relative inline-flex items-center gap-3 p-3 rounded-[20px] border shadow-2xl ${theme === 'dark' ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-black/10'}`}>
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
                {selectedFile.type.startsWith('image/') ? <img src={selectedFile.data} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-blue-500/10 flex items-center justify-center text-blue-500"><FileText size={14} /></div>}
              </div>
              <div className="text-[9px] font-black truncate max-w-[120px]">{selectedFile.name}</div>
              <button onClick={() => setSelectedFile(null)} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500"><X size={12} /></button>
            </div>
          </div>
        )}
        <div className={`max-w-4xl mx-auto flex items-center gap-2 p-1 border rounded-[32px] shadow-2xl backdrop-blur-3xl transition-all ${theme === 'dark' ? 'bg-[#111111]/80 border-white/10' : 'bg-white border-black/10'}`}>
          <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-full text-zinc-500 hover:text-blue-500 transition-all flex-shrink-0">
            <Paperclip size={20}/>
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
               const file = e.target.files?.[0]; if (!file) return;
               const reader = new FileReader(); reader.onload = () => setSelectedFile({ data: reader.result as string, name: file.name, type: file.type });
               reader.readAsDataURL(file);
            }} />
          </button>
          <input 
            type="text" 
            placeholder={hasLicense ? "Link frequencies..." : "Activate Neural Link..."}
            value={inputText} 
            onChange={e => setInputText(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} 
            className="flex-1 bg-transparent py-3 px-1 font-bold text-[14px] outline-none placeholder-zinc-700 min-w-0"
          />
          <div className="flex items-center gap-1 pr-1 flex-shrink-0">
             <button onClick={handleVoiceButtonClick} className={`p-3 rounded-full transition-all ${isLive ? 'bg-rose-600 text-white animate-pulse' : 'bg-white/5 text-zinc-500'}`}>{isLive ? <MicOff size={20}/> : <Mic size={20}/>}</button>
             <button onClick={() => handleSendToAI(inputText)} className={`p-3 rounded-full transition-all ${(inputText.trim() || selectedFile) ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-zinc-500/10 text-zinc-700'}`}><Send size={20}/></button>
          </div>
        </div>
      </footer>

      {/* Identity Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-6">
           <div className="absolute inset-0 bg-black/90 backdrop-blur-3xl" onClick={() => setIsProfileModalOpen(false)} />
           <div className={`relative w-full max-w-lg rounded-[48px] p-10 space-y-8 animate-scale-in border ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10'} max-h-[85vh] overflow-y-auto custom-scrollbar`}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase italic flex items-center gap-3"><UserIcon size={24} className="text-blue-500" /> Identity Matrix</h2>
                <button onClick={() => setIsProfileModalOpen(false)} className="p-3 bg-white/5 rounded-2xl text-zinc-500"><X size={20}/></button>
              </div>
              <div className="space-y-6">
                 <div className="p-6 rounded-[32px] bg-blue-600/5 border border-blue-500/10 space-y-4">
                    <div className="flex items-center justify-between">
                       <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Neural License</label>
                       <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${hasLicense ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{hasLicense ? 'Verified' : 'Required'}</span>
                    </div>
                    <button onClick={handleOpenLicenseKey} className="w-full py-4 bg-white/5 border border-white/5 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2">Sync Neural License</button>
                    {!hasLicense && (
                       <a href="https://t.me/Mrvibeai" target="_blank" className="flex items-center justify-center gap-1.5 text-[8px] font-black uppercase text-blue-500 hover:text-blue-400 transition-all mt-1">
                         Get a license from Mr. Vibe AI <ExternalLink size={10} />
                       </a>
                    )}
                 </div>
                 
                 <div className="space-y-3">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-2">Human Label</label>
                    <input type="text" value={user?.userName} onChange={e => setUser(u => u ? ({...u, userName: e.target.value}) : null)} onBlur={() => localStorage.setItem('mr_vibe_active_user', JSON.stringify(user))} className="w-full py-4 px-6 rounded-2xl bg-white/5 border border-transparent focus:border-blue-500 outline-none font-bold" />
                 </div>

                 <div className="space-y-3">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-2">Gender Identification</label>
                    <div className="flex flex-wrap gap-2">
                       {['Male', 'Female', 'Other', 'Secret'].map((g) => (
                          <button key={g} onClick={() => { setUser(u => u ? ({...u, gender: g as Gender}) : null); localStorage.setItem('mr_vibe_active_user', JSON.stringify({...user, gender: g})); }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${user?.gender === g ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-500'}`}>{g}</button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest ml-2">Neural Archetype</label>
                    <div className="grid grid-cols-2 gap-3">
                       {Object.values(PERSONALITIES).map(p => (
                          <button key={p.id} onClick={() => { updateSettings({ personalityId: p.id }); showToast(`Archetype: ${p.name}`, "info"); }} className={`p-4 rounded-[24px] font-black text-[9px] uppercase tracking-widest border-2 transition-all flex items-center gap-3 ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-transparent text-zinc-600'}`}><span className="text-xl">{p.emoji}</span><span>{p.name}</span></button>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Voice Mode Selector Modal */}
      {isVoiceModeModalOpen && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center p-8 animate-fade-in">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={() => setIsVoiceModeModalOpen(false)} />
          <div className={`relative w-full max-sm rounded-[48px] p-10 space-y-10 border shadow-2xl animate-scale-in ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10'}`}>
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto text-blue-500"><Mic size={28}/></div>
              <h2 className="text-lg font-black uppercase italic tracking-tighter">Voice Frequency</h2>
              <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Choose link protocol, bestie.</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => startVoiceMode('chat')} className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95"><MessageCircle size={18}/> Voice Chat</button>
              <button onClick={() => startVoiceMode('note')} className="w-full py-5 bg-zinc-800 text-white rounded-[24px] font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95"><StickyNote size={18}/> Note Taker</button>
            </div>
            <button onClick={() => setIsVoiceModeModalOpen(false)} className="w-full py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">Cancel</button>
          </div>
        </div>
      )}

      {/* History Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[10000] w-72 transition-transform duration-500 transform ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'} border-r ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-black/5'}`}>
         <div className="flex flex-col h-full">
            <div className="p-8 flex items-center justify-between border-b border-white/5">
               <h2 className="font-black uppercase tracking-[0.3em] text-[9px] flex items-center gap-2 text-zinc-600"><HistoryIcon size={16}/> Archive</h2>
               <button onClick={() => setIsHistoryOpen(false)} className="p-2 text-zinc-500"><X size={18}/></button>
            </div>
            <div className="p-6">
               <button onClick={() => handleNewChat(true)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest"><Plus size={18}/> New Session</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
               {sessions.map(s => (
                 <div key={s.id} onClick={() => { setActiveSessionId(s.id); setIsHistoryOpen(false); }} className={`group w-full p-4 rounded-2xl text-left border transition-all cursor-pointer relative ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-600/40' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                   <div className={`font-black text-[11px] truncate pr-8 ${activeSessionId === s.id ? 'text-blue-500' : 'text-zinc-500'}`}>{s.title}</div>
                   <button onClick={(e) => { e.stopPropagation(); setSessions(prev => prev.filter(x => x.id !== s.id)); }} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-rose-500"><Trash2 size={14}/></button>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* Neural Library Sidebar */}
      <div className={`fixed inset-y-0 right-0 z-[10000] w-80 transition-transform duration-500 transform ${isLibraryOpen ? 'translate-x-0' : 'translate-x-full'} border-l ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-black/5'}`}>
         <div className="flex flex-col h-full">
            <div className="p-8 flex items-center justify-between border-b border-white/5">
               <h2 className="font-black uppercase tracking-[0.3em] text-[9px] flex items-center gap-2 text-blue-500"><Brain size={16}/> Brain</h2>
               <button onClick={() => { setIsLibraryOpen(false); setSelectedPinnedId(null); }} className="p-2 text-zinc-500"><X size={18}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
               {pinnedMessages.map(m => (
                 <div key={m.id} onClick={() => setSelectedPinnedId(m.id === selectedPinnedId ? null : m.id)} className={`p-4 rounded-2xl border transition-all cursor-pointer ${selectedPinnedId === m.id ? 'bg-blue-600/10 border-blue-500/40' : 'bg-white/5 border-transparent'}`}>
                    <div className="flex items-center justify-between mb-1"><span className="text-[7px] font-black uppercase text-blue-500">{m.isNote ? 'Memory' : 'Log'}</span><span className="text-[7px] font-bold text-zinc-700">{new Date(m.timestamp).toLocaleDateString()}</span></div>
                    <div className="text-[10px] leading-relaxed line-clamp-2 font-bold">{m.text}</div>
                 </div>
               ))}
            </div>
            {selectedPinnedId && (
              <div className="p-6 border-t border-white/5 space-y-3 animate-slide-up">
                <button onClick={() => { 
                  const msg = pinnedMessages.find(x => x.id === selectedPinnedId);
                  if(msg) handleSendToAI(`Give me a summary of this: "${msg.text}"`);
                  setIsLibraryOpen(false);
                }} className="w-full py-3 bg-zinc-800 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2"><StickyNote size={12}/> Summarize</button>
                <button onClick={() => generateNeuralQuiz(selectedPinnedId)} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2"><GraduationCap size={12}/> Assessment</button>
              </div>
            )}
         </div>
      </div>

      {/* Quiz UI Overlay */}
      {activeQuiz && (
        <div className="fixed inset-0 z-[12000] bg-black/98 backdrop-blur-3xl flex flex-col p-6 overflow-y-auto custom-scrollbar animate-fade-in">
           <div className="max-w-2xl mx-auto w-full space-y-10 pb-20">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-600 rounded-2xl text-white"><GraduationCap size={24}/></div>
                    <h2 className="text-xl font-black uppercase italic tracking-tighter">{activeQuiz.title}</h2>
                 </div>
                 <button onClick={() => setActiveQuiz(null)} className="p-3 text-zinc-500"><X size={20}/></button>
              </div>
              <div className="space-y-6">
                 {activeQuiz.questions.map((q, idx) => (
                    <div key={idx} className={`p-8 rounded-[32px] border transition-all ${isQuizSubmitted ? (quizAnswers[idx] === q.correctAnswer ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20') : 'bg-white/5 border-white/5'}`}>
                       <h4 className="font-bold text-sm mb-6">{q.question}</h4>
                       <div className="grid grid-cols-1 gap-2">
                          {q.options.map((opt, oIdx) => (
                             <button key={oIdx} onClick={() => !isQuizSubmitted && setQuizAnswers(p => ({...p, [idx]: opt}))} className={`p-4 rounded-xl text-left text-xs font-bold border transition-all ${isQuizSubmitted ? (opt === q.correctAnswer ? 'bg-emerald-500 border-emerald-500 text-white' : quizAnswers[idx] === opt ? 'bg-rose-500 border-rose-500 text-white' : 'opacity-40 border-transparent') : (quizAnswers[idx] === opt ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-transparent hover:bg-white/10')}`}>
                                {opt}
                             </button>
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
              {!isQuizSubmitted ? (
                 <button onClick={() => { if(Object.keys(quizAnswers).length < activeQuiz.questions.length) return; setIsQuizSubmitted(true); }} className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black uppercase tracking-widest transition-all">Submit Vibe Check</button>
              ) : (
                 <div className="text-center space-y-6 animate-slide-up">
                    <h3 className="text-5xl font-black text-blue-500 italic">{Math.round((activeQuiz.questions.filter((q, i) => quizAnswers[i] === q.correctAnswer).length / activeQuiz.questions.length) * 100)}%</h3>
                    <button onClick={() => setActiveQuiz(null)} className="px-8 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest">Finish Assessment</button>
                 </div>
              )}
           </div>
        </div>
      )}

      {/* New User Onboarding */}
      {isNewUser && (
        <div className="fixed inset-0 z-[9000] bg-black flex items-center justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#080808] rounded-[48px] p-10 text-center border border-white/5 animate-scale-in space-y-8">
             <Logo className="w-12 h-12 mx-auto mb-2" />
             <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">Neural Protocol</h1>
             
             <div className="space-y-10 text-left">
               {/* Name Input */}
               <div className="space-y-3">
                 <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-3">Identity Label (Name)</label>
                 <input 
                   type="text" 
                   placeholder="e.g. Neo..." 
                   value={tempProfile.userName} 
                   onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} 
                   className="w-full bg-white/5 rounded-2xl py-5 px-6 font-bold text-lg outline-none border border-transparent focus:border-blue-600 transition-all placeholder-zinc-800" 
                 />
               </div>

               {/* Gender Selection */}
               <div className="space-y-3">
                 <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-3">Gender Sync</label>
                 <div className="grid grid-cols-2 gap-3">
                   {['Male', 'Female', 'Other', 'Secret'].map((g) => (
                     <button 
                       key={g} 
                       onClick={() => setTempProfile({...tempProfile, gender: g as Gender})}
                       className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${tempProfile.gender === g ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-transparent text-zinc-600 hover:bg-white/10'}`}
                     >
                       {g}
                     </button>
                   ))}
                 </div>
               </div>

               {/* Personality Grid */}
               <div className="space-y-3">
                 <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-3">Neural Archetype</label>
                 <div className="grid grid-cols-2 gap-3">
                    {Object.values(PERSONALITIES).map(p => (
                       <button 
                         key={p.id} 
                         onClick={() => setTempProfile({...tempProfile, personalityId: p.id})}
                         className={`p-4 rounded-[24px] font-black text-[9px] uppercase tracking-widest border transition-all flex items-center gap-3 ${tempProfile.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-transparent text-zinc-600 hover:bg-white/10'}`}
                       >
                         <span className="text-xl">{p.emoji}</span>
                         <span className="truncate">{p.name}</span>
                       </button>
                    ))}
                 </div>
               </div>
             </div>

             <div className="pt-4">
                <button 
                  onClick={handleOnboardingComplete} 
                  className={`w-full py-6 rounded-[24px] font-black text-lg uppercase tracking-widest transition-all ${tempProfile.userName ? 'bg-blue-600 shadow-2xl shadow-blue-600/30 text-white hover:scale-[1.02] active:scale-95' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'}`}
                >
                  Activate Neural Link
                </button>
                <p className="mt-4 text-[8px] font-black uppercase tracking-widest text-zinc-600 text-center">
                  Secure connection via Google Neural Network
                </p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
