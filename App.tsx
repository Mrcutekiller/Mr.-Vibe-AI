
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
  const [neuralPass, setNeuralPass] = useState<string>(() => (localStorage.getItem('mr_vibe_neural_pass') || '').trim());
  const [toast, setToast] = useState<{id: string, message: string, type: string, onClick?: () => void} | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(() => JSON.parse(localStorage.getItem('mr_vibe_notif_history') || '[]'));
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('mr_vibe_active_user') || 'null'));
  const [tempProfile, setTempProfile] = useState<Partial<User> & { neuralPass?: string }>({ 
    userName: '', 
    gender: 'Secret', 
    avatarUrl: AVATARS[0], 
    personalityId: PersonalityId.STUDENT,
    neuralPass: ''
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mr_vibe_settings');
    if (saved) return JSON.parse(saved);
    return { language: "English", theme: "dark", personalityId: PersonalityId.STUDENT, voiceName: "Aoede", speakingRate: 1.0, speakingPitch: 1.0, customCommands: [] };
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
  const [selectedFiles, setSelectedFiles] = useState<FileAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{text: string, isModel: boolean}[]>([]);
  const [isAiSpeakingGlobal, setIsAiSpeakingGlobal] = useState(false);
  const [selectedVoiceMode, setSelectedVoiceMode] = useState<'chat' | 'note'>('chat');
  const [avatarAnimation, setAvatarAnimation] = useState<OrbAnimationState>('idle');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentPersonality = PERSONALITIES[settings.personalityId];
  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const pinnedMessages = useMemo(() => messages.filter(m => m.isPinned), [messages]);

  const currentApiKey = (neuralPass || process.env.API_KEY || '').trim();

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
    console.error("API ERROR:", error);
    showToast("Signal Interrupted. Try shorter text or re-upload?", "error");
  }, [showToast]);

  const handleLogout = () => {
    localStorage.clear();
    window.location.reload();
  };

  useEffect(() => {
    const saveTimer = setInterval(() => {
      if (sessions.length > 0) localStorage.setItem('mr_vibe_sessions', JSON.stringify(sessions));
      if (activeSessionId) localStorage.setItem('mr_vibe_active_session_id', activeSessionId);
    }, 5000);
    return () => clearInterval(saveTimer);
  }, [sessions, activeSessionId]);

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

  const togglePin = useCallback((messageId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? {
        ...s,
        messages: s.messages.map(m => m.id === messageId ? { ...m, isPinned: !m.isPinned } : m)
      } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    showToast("Memory Link Secured.", "success");
  }, [activeSessionId, showToast]);

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
      const prompt = `ACT AS Mr. Cute. Say hi to ${user?.userName || 'bestie'}. Keep it brief. Introduce yourself as Mr. Cute ONLY this once.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ text: `${BASE_SYSTEM_PROMPT}\n\n${PERSONALITIES[personalityId].prompt}\n\n${prompt}` }]
      });
      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: response.text || 'Yo! Ready to study?', timestamp: Date.now() };
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

  const handleSendToAI = async (text: string, isAutoGreet = false) => {
    if (!currentApiKey) {
      showToast("Identity protocol error. Re-enter passphrase.", "error");
      setIsProfileModalOpen(true);
      return;
    }
    if ((!text.trim() && selectedFiles.length === 0) || isLoading) return;
    
    let sessionId = activeSessionId || handleNewChat(false);
    const sessionRef = sessions.find(s => s.id === sessionId);
    const isFirstMessage = !sessionRef || sessionRef.messages.length === 0;
    
    const currentFiles = [...selectedFiles];
    setSelectedFiles([]);
    const textToSend = text;
    setInputText('');

    if (!isAutoGreet) {
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { 
          ...s, 
          messages: [...s.messages, { 
            id: `u-${Date.now()}`, 
            role: 'user' as const, 
            text: textToSend, 
            files: currentFiles.length > 0 ? currentFiles : undefined, 
            timestamp: Date.now() 
          }], 
          lastTimestamp: Date.now() 
        } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
    }
    
    setIsLoading(true);
    setAvatarAnimation('thoughtful');

    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const parts: any[] = [];
      
      // Process multiple files
      currentFiles.forEach(file => {
        parts.push({
          inlineData: { 
            data: file.data.split(',')[1], 
            mimeType: file.type 
          }
        });
      });
      
      parts.push({ text: `${BASE_SYSTEM_PROMPT}\n\n${currentPersonality.prompt}\n\nUSER INPUT: ${textToSend}` });

      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: { parts },
        config: { 
          tools: [{ googleSearch: {} }],
          temperature: 0.8
        } 
      });
      
      let rawText = response.text || '...';
      const shouldAutoPin = rawText.includes('[AUTO_PIN]');
      const cleanText = rawText.replace('[AUTO_PIN]', '').trim();

      const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[];
      const aiMessage: Message = { 
        id: `ai-${Date.now()}`, 
        role: 'model', 
        text: cleanText, 
        timestamp: Date.now(), 
        isNote: selectedVoiceMode === 'note' || cleanText.length > 500,
        groundingChunks: grounding,
        isPinned: shouldAutoPin
      };

      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });

      if (isFirstMessage) {
        const titleResp = await ai.models.generateContent({
           model: 'gemini-3-flash-preview',
           contents: `Summarize in 2-3 words: ${textToSend}`
        });
        const title = titleResp.text?.trim().replace(/"/g, '') || 'New Sync';
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

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedFiles(prev => [...prev, { 
          data: reader.result as string, 
          name: file.name, 
          type: file.type 
        }]);
      };
      reader.readAsDataURL(file);
    });
    // Reset input
    e.target.value = '';
  };

  const removeFileFromSelection = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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
          { id: `u-${Date.now()}`, role: 'user' as const, text: u, timestamp: Date.now() }, 
          { id: `m-${Date.now() + 1}`, role: 'model' as const, text: m, timestamp: Date.now() + 1, isNote: selectedVoiceMode === 'note' }
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
      showToast("Pin a memory bubble first.", "info"); return;
    }
    setIsLoading(true); setIsLibraryOpen(false); setAvatarAnimation('thoughtful');
    try {
      const text = Array.isArray(contextSource) ? contextSource.map(m => m.text).join("\n") : contextSource.text;
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `CONTEXT: ${text}\n\nAct as Mr. Cute. Create 3 MCQs. JSON: { "title": "Assessment", "questions": [ { "question": "", "options": [], "correctAnswer": "", "explanation": "" } ] }`,
        config: { responseMimeType: "application/json" }
      });
      const quizData = JSON.parse(response.text || '{}') as Quiz;
      setActiveQuiz(quizData); setQuizAnswers({}); setIsQuizSubmitted(false);
    } catch (e: any) { handleApiError(e); } finally { setIsLoading(false); setAvatarAnimation('idle'); }
  };

  const handleOnboardingComplete = () => {
    if (tempProfile.userName && tempProfile.gender && tempProfile.personalityId && tempProfile.neuralPass) {
      const newUser = { ...tempProfile, avatarUrl: AVATARS[Math.floor(Math.random() * AVATARS.length)] } as User;
      localStorage.setItem('mr_vibe_active_user', JSON.stringify(newUser));
      localStorage.setItem('mr_vibe_neural_pass', tempProfile.neuralPass);
      setNeuralPass(tempProfile.neuralPass);
      setUser(newUser);
      updateSettings({ personalityId: tempProfile.personalityId });
      setIsNewUser(false);
      handleNewChat(true);
    } else {
      showToast("Identity Protocol incomplete. Enter passphrase.", "info");
    }
  };

  return (
    <div className={`fixed inset-0 flex flex-col transition-colors duration-700 ${theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-zinc-50 text-black'} overflow-hidden ios-safe-top ios-safe-bottom font-sans w-screen h-screen`}>
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}

      <header className={`h-20 px-4 md:px-8 flex items-center justify-between border-b ${theme === 'dark' ? 'border-white/5 bg-black/50' : 'border-black/5 bg-white/50'} backdrop-blur-3xl z-50 w-full shrink-0 overflow-hidden`}>
        <div className="flex items-center gap-1 md:gap-3 shrink-0">
          <button onClick={() => setIsHistoryOpen(true)} className={`p-3 rounded-2xl active:scale-90 transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-400' : 'hover:bg-black/5 text-zinc-500'}`} title="Archive (Ctrl+K)"><Menu size={20} /></button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-3 rounded-2xl active:scale-90 transition-all ${theme === 'dark' ? 'text-yellow-400' : 'text-blue-600'}`}><Sun size={20} /></button>
        </div>
        
        <div className="flex flex-col items-center gap-1 overflow-hidden mx-2">
          <span className="font-black text-[12px] md:text-[14px] uppercase tracking-[0.4em] text-blue-500 animate-pulse whitespace-nowrap">Mr. Vibe AI</span>
        </div>

        <div className="flex items-center gap-1 md:gap-3 shrink-0">
          <button onClick={() => setIsLibraryOpen(true)} className={`p-3 rounded-2xl relative active:scale-90 transition-all ${theme === 'dark' ? 'text-blue-400 bg-blue-500/10' : 'text-blue-600 bg-blue-500/5'}`} title="Brain (Ctrl+B)">
            <Brain size={20} />
            {pinnedMessages.length > 0 && <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
          </button>
          <button onClick={() => setIsProfileModalOpen(true)} className="w-10 h-10 md:w-11 md:h-11 rounded-2xl overflow-hidden border-2 border-white/10 active:scale-90 transition-all shrink-0">
             {user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><UserIcon size={18} /></div>}
          </button>
        </div>
      </header>

      <main ref={mainContentRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-10 space-y-10 custom-scrollbar scroll-smooth relative w-full overflow-x-hidden">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-10 animate-fade-in px-6">
            <VibeOrb active={false} isThinking={isLoading} volume={0} outputVolume={0} animationState={avatarAnimation} personalityId={settings.personalityId} />
            <div className="space-y-4 max-w-xs">
              <h3 className="text-[10px] font-black uppercase tracking-[0.6em] text-blue-500 opacity-80">Link Active</h3>
              <p className="text-[11px] font-bold italic text-zinc-600 uppercase tracking-[0.2em] leading-loose">"Yo student, Mr. Cute is here. Drop your files or a question."</p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-vibe-in group w-full`}>
              {msg.files && msg.files.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 justify-end max-w-[85%]">
                  {msg.files.map((file, fIdx) => (
                    <div key={fIdx} className={`rounded-[20px] overflow-hidden border shadow-xl ${theme === 'dark' ? 'border-white/10 bg-zinc-900' : 'border-black/5 bg-white'}`}>
                      {file.type.startsWith('image/') ? (
                        <img src={file.data} className="w-40 h-auto object-cover max-h-[200px]" />
                      ) : (
                        <div className="flex items-center gap-2 p-3 min-w-[120px]">
                          <FileIcon size={16} className="text-blue-500" />
                          <div className="flex-1 truncate font-bold text-[9px]">{file.name}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className={`relative flex items-end gap-3 max-w-[92%]`}>
                {msg.role === 'model' && <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mb-1 border border-white/10"><img src={AVATARS[index % AVATARS.length]} className="w-full h-full object-cover" /></div>}
                <div className={`px-5 py-4 rounded-[24px] text-[14px] md:text-[15px] font-medium shadow-xl border transition-all duration-300 ${msg.role === 'user' ? 'bg-blue-600 text-white border-blue-500/20 rounded-br-none' : theme === 'dark' ? 'bg-[#121212] text-zinc-100 border-white/5 rounded-bl-none' : 'bg-white text-zinc-900 border-black/5 rounded-bl-none'}`}>
                  {msg.isNote && <div className="flex items-center gap-1.5 mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-blue-400"><StickyNote size={10} /> Neural summary</div>}
                  <MarkdownText text={msg.text} />
                  {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                       <div className="flex flex-wrap gap-2">
                          {msg.groundingChunks.map((chunk, idx) => chunk.web && <a key={idx} href={chunk.web.uri} target="_blank" className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[9px] font-bold text-blue-400 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"><ExternalLink size={10} /> {chunk.web.title || "Ref"}</a>)}
                       </div>
                    </div>
                  )}
                </div>
                {msg.role === 'model' && <button onClick={() => togglePin(msg.id)} className={`p-2 rounded-xl transition-all ${msg.isPinned ? 'text-blue-500 bg-blue-500/10' : 'text-zinc-600 opacity-0 group-hover:opacity-100'}`}><Pin size={14} fill={msg.isPinned ? 'currentColor' : 'none'} /></button>}
              </div>
            </div>
          ))
        )}
        {isLoading && <div className="flex items-start"><div className={`px-5 py-3 rounded-[20px] border ${theme === 'dark' ? 'bg-[#121212] border-white/5' : 'bg-white border-black/5'}`}><div className="flex gap-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" /><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" /><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" /></div></div></div>}
        <div ref={messagesEndRef} className="h-10 w-full" />
      </main>

      <footer className={`px-4 pb-8 pt-3 bg-gradient-to-t ${theme === 'dark' ? 'from-black via-black/95' : 'from-zinc-50 via-zinc-50/95'} to-transparent z-40 shrink-0`}>
        {selectedFiles.length > 0 && (
          <div className="max-w-4xl mx-auto mb-4 flex flex-wrap gap-2 animate-slide-up">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className={`relative inline-flex items-center gap-3 p-2 rounded-xl border ${theme === 'dark' ? 'bg-[#151515] border-white/10' : 'bg-white border-black/10'}`}>
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
                  {file.type.startsWith('image/') ? <img src={file.data} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-blue-500/10 flex items-center justify-center text-blue-500"><FileText size={14} /></div>}
                </div>
                <span className="text-[9px] font-bold truncate max-w-[80px] text-zinc-500">{file.name}</span>
                <button onClick={() => removeFileFromSelection(idx)} className="ml-1 p-0.5 hover:text-rose-500"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <div className={`max-w-4xl mx-auto flex items-center gap-1 p-1 border rounded-[32px] shadow-2xl backdrop-blur-3xl ${theme === 'dark' ? 'bg-[#0a0a0a]/90 border-white/10' : 'bg-white/90 border-black/10'} w-full overflow-hidden`}>
          <button onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-500 hover:text-blue-500"><Paperclip size={18}/><input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFilesUpload} /></button>
          <input type="text" placeholder="Drop a thought or upload a file..." value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} className="flex-1 bg-transparent py-3 font-bold text-[14px] outline-none placeholder-zinc-800 min-w-0" />
          <button onClick={() => handleSendToAI(inputText)} className={`p-3 rounded-full transition-all active:scale-95 ${(inputText.trim() || selectedFiles.length > 0) ? 'bg-blue-600 text-white' : 'text-zinc-700'}`}><Send size={18}/></button>
        </div>
      </footer>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={() => setIsProfileModalOpen(false)} />
           <div className={`relative w-full max-w-md rounded-[40px] p-8 space-y-6 animate-scale-in border ${theme === 'dark' ? 'bg-[#080808] border-white/10' : 'bg-white border-black/10'}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase italic tracking-tight">Identity Profile</h2>
                <button onClick={() => setIsProfileModalOpen(false)} className="p-2 bg-white/5 rounded-xl"><X size={18}/></button>
              </div>
              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Vibe Alias</label>
                    <input type="text" value={user?.userName} onChange={e => setUser(u => u ? ({...u, userName: e.target.value}) : null)} className="w-full py-3 px-5 rounded-2xl bg-white/5 border border-white/5 focus:border-blue-500 outline-none font-black transition-all" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Archetype</label>
                    <div className="grid grid-cols-2 gap-2">
                       {Object.values(PERSONALITIES).map(p => <button key={p.id} onClick={() => updateSettings({ personalityId: p.id })} className={`p-3 rounded-2xl font-black text-[9px] uppercase border transition-all flex items-center gap-2 ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-transparent text-zinc-600'}`}>{p.emoji} {p.name}</button>)}
                    </div>
                 </div>
                 <button onClick={handleLogout} className="w-full py-3 rounded-2xl bg-rose-500/10 text-rose-500 font-black text-[10px] uppercase flex items-center justify-center gap-2 mt-4"><LogOut size={16} /> Disconnect</button>
              </div>
           </div>
        </div>
      )}

      {isNewUser && (
        <div className="fixed inset-0 z-[12000] bg-black flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#080808] rounded-[48px] p-8 md:p-12 text-center border border-white/5 animate-scale-in space-y-8 my-auto">
             <Logo className="w-10 h-10 mx-auto" />
             <div className="space-y-2"><h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">Mr. Vibe AI</h1><p className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-500">Initialize Identity</p></div>
             <div className="space-y-6 text-left">
               <div className="space-y-3"><label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-4">Neural Passphrase</label><input type="password" placeholder="Required to establish sync..." value={tempProfile.neuralPass} onChange={e => setTempProfile({...tempProfile, neuralPass: e.target.value})} className="w-full bg-white/5 rounded-[24px] py-4 px-6 font-mono text-[12px] outline-none border border-transparent focus:border-blue-600 transition-all placeholder-zinc-800" /></div>
               <div className="space-y-3"><label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-4">Vibe Alias</label><input type="text" placeholder="Your name..." value={tempProfile.userName} onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} className="w-full bg-white/5 rounded-[24px] py-4 px-6 font-black outline-none border border-transparent focus:border-blue-600 transition-all placeholder-zinc-800" /></div>
               <div className="grid grid-cols-2 gap-2">{Object.values(PERSONALITIES).map((p) => <button key={p.id} onClick={() => setTempProfile({...tempProfile, personalityId: p.id})} className={`p-3 rounded-[20px] border transition-all text-[9px] font-black uppercase flex flex-col items-center gap-1 ${tempProfile.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-transparent text-zinc-600'}`}>{p.emoji} {p.name}</button>)}</div>
             </div>
             <button onClick={handleOnboardingComplete} disabled={!tempProfile.userName || !tempProfile.neuralPass} className={`w-full py-5 rounded-[28px] font-black text-base uppercase tracking-widest transition-all ${tempProfile.userName && tempProfile.neuralPass ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-zinc-900 text-zinc-800 cursor-not-allowed'}`}>Activate Sync</button>
          </div>
        </div>
      )}

      {activeQuiz && (
        <div className="fixed inset-0 z-[12000] bg-black/98 backdrop-blur-3xl flex flex-col p-6 overflow-y-auto"><div className="max-w-2xl mx-auto w-full space-y-8 pb-20 pt-10"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black uppercase italic tracking-tight">{activeQuiz.title}</h2><p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Assessment result</p></div><button onClick={() => setActiveQuiz(null)} className="p-3 text-zinc-500 bg-white/5 rounded-xl"><X size={20}/></button></div><div className="space-y-6">{activeQuiz.questions.map((q, idx) => (<div key={idx} className="p-6 rounded-[28px] bg-white/5 border border-white/10 space-y-4"><h4 className="font-bold text-sm leading-relaxed">"{q.question}"</h4><div className="grid grid-cols-1 gap-2">{q.options.map((opt, oIdx) => (<button key={oIdx} onClick={() => !isQuizSubmitted && setQuizAnswers(p => ({...p, [idx]: opt}))} className={`p-3.5 rounded-xl text-left text-[12px] font-black border transition-all ${isQuizSubmitted ? (opt === q.correctAnswer ? 'bg-emerald-500 border-emerald-500 text-white' : quizAnswers[idx] === opt ? 'bg-rose-500 border-rose-500 text-white' : 'opacity-30 border-transparent') : (quizAnswers[idx] === opt ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-transparent hover:bg-white/10')}`}>{opt}</button>))}</div></div>))}</div>{!isQuizSubmitted ? (<button onClick={() => setIsQuizSubmitted(true)} className="w-full py-4 bg-blue-600 text-white rounded-[24px] font-black uppercase tracking-widest text-[10px]">Finish Assessment</button>) : (<button onClick={() => setActiveQuiz(null)} className="w-full py-4 bg-white text-black rounded-[24px] font-black uppercase text-[10px] tracking-widest">Back to Sync</button>)}</div></div>
      )}
    </div>
  );
}
