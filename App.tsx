
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
  MessageCircle, Link2, GraduationCap, Award, PlayCircle, Fingerprint
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES } from './constants';
import { PersonalityId, Personality, AppSettings, User, ChatSession, Message, ReactionType, Notification, FileAttachment, Quiz, QuizQuestion } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';

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

const NotificationToast = ({ message, type, onClose }: { message: string, type: 'info' | 'success' | 'error', onClose: () => void }) => (
  <div className="fixed top-4 md:top-8 inset-x-4 z-[10000] flex justify-center pointer-events-none">
    <div className={`w-full max-w-sm bg-zinc-900 shadow-2xl rounded-[28px] border flex items-center gap-4 p-5 pointer-events-auto animate-slide-up ${
      type === 'success' ? 'border-emerald-500/20 text-emerald-400' :
      type === 'error' ? 'border-rose-500/20 text-rose-400' :
      'border-blue-500/20 text-blue-400'
    }`}>
      <div className="p-2.5 rounded-xl bg-white/5"><Bell size={18} /></div>
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
  const [toast, setToast] = useState<{id: string, message: string, type: 'info' | 'success' | 'error'} | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(() => JSON.parse(localStorage.getItem('mr_vibe_notif_history') || '[]'));
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('mr_vibe_active_user') || 'null'));
  const [tempProfile, setTempProfile] = useState<Partial<User>>({ userName: '', gender: 'Male', avatarUrl: AVATARS[0], personalityId: PersonalityId.STUDENT });

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
  const [isVoiceModeSelectOpen, setIsVoiceModeSelectOpen] = useState(false);
  const [isNotifLogOpen, setIsNotifLogOpen] = useState(false);
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
  const [selectedVoiceMode, setSelectedVoiceMode] = useState<'note' | 'chat'>('chat');
  const [avatarAnimation, setAvatarAnimation] = useState<OrbAnimationState>('idle');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentPersonality = PERSONALITIES[settings.personalityId];
  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const pinnedMessages = useMemo(() => messages.filter(m => m.isPinned), [messages]);

  // Auto-scroll effect
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isLoading]);

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
    } catch (e) {
      console.warn("Audio Context blocked.");
    }
  }, []);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now().toString();
    setToast({ id, message, type });
    const newNotif: Notification = { id, message, type, timestamp: Date.now() };
    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, 50);
      localStorage.setItem('mr_vibe_notif_history', JSON.stringify(updated));
      return updated;
    });
    if (type !== 'error') {
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
    setIsNotifLogOpen(false);
    setIsLibraryOpen(false);
    setSelectedPinnedId(null);
    
    if (autoGreet) {
      setAvatarAnimation('hi');
      setTimeout(() => setAvatarAnimation('idle'), 1200);
      let greeting = `Yo! Mr. Cute is here. Ready to vibe, ${user?.gender === 'Male' ? 'bro' : user?.gender === 'Female' ? 'bestie' : 'fam'}?`;
      handleSendToAI(greeting, true);
    }
    return newId;
  }, [settings.personalityId, user]);

  const togglePin = (messageId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? {
        ...s,
        messages: s.messages.map(m => m.id === messageId ? { ...m, isPinned: !m.isPinned } : m)
      } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    showToast("Frequency linked to library.", "success");
  };

  const generateNeuralQuiz = async (specificMessageId?: string) => {
    const contextSource = specificMessageId 
      ? pinnedMessages.find(m => m.id === specificMessageId)
      : pinnedMessages;

    if (!contextSource || (Array.isArray(contextSource) && contextSource.length === 0)) {
      showToast("Select a pinned frequency first.", "info");
      return;
    }

    setIsLoading(true);
    setIsLibraryOpen(false);
    setAvatarAnimation('thoughtful');

    try {
      const text = Array.isArray(contextSource) 
        ? contextSource.map(m => m.text).join("\n---\n") 
        : contextSource.text;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `CONTEXT: ${text}\n\nAct as Mr. Cute. Generate a professional multiple choice test with 5 questions based ONLY on the context above.
        FORMAT: Return ONLY a JSON object:
        {
          "title": "Neural Assessment",
          "questions": [
            {
              "question": "The question",
              "options": ["A", "B", "C", "D"],
              "correctAnswer": "Exact string of correct option",
              "explanation": "Brief context on why it's correct"
            }
          ]
        }`,
        config: { responseMimeType: "application/json" }
      });

      const quizData = JSON.parse(response.text || '{}') as Quiz;
      setActiveQuiz(quizData);
      setQuizAnswers({});
      setIsQuizSubmitted(false);
      setAvatarAnimation('excited');
    } catch (e) {
      showToast("Sync failed. Check frequency link.", "error");
    } finally {
      setIsLoading(false);
      setAvatarAnimation('idle');
    }
  };

  const generateChatTitle = async (sessionId: string, firstMessage: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Based on: "${firstMessage}", generate a catchy 2-word title. No quotes.`
      });
      const title = response.text?.trim() || "New Chat";
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, title } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
    } catch (e) { console.error(e); }
  };

  async function handleSendToAI(text: string, isAutoGreet = false) {
    if ((!text.trim() && !selectedFile) || isLoading) return;
    
    let sessionId = activeSessionId || handleNewChat(false);
    const sessionRef = sessions.find(s => s.id === sessionId);
    const isFirstMessage = !sessionRef || sessionRef.messages.length === 0;
    
    const userMsgFile = selectedFile ? { ...selectedFile } : undefined;

    // Immediately clear file to avoid double rendering
    const currentFile = selectedFile;
    setSelectedFile(null);
    setInputText('');

    if (!isAutoGreet) {
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, { id: `u-${Date.now()}`, role: 'user', text, file: userMsgFile, timestamp: Date.now() }], lastTimestamp: Date.now() } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
      if (isFirstMessage) generateChatTitle(sessionId, text);
    }
    
    setIsLoading(true);
    setAvatarAnimation('thoughtful');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const introInstruction = isFirstMessage 
        ? "START: Introduce yourself as Mr. Cute." 
        : "CONTINUE: DO NOT repeat your name.";
      
      const parts: any[] = [{ text: `${BASE_SYSTEM_PROMPT}\n\nPROTOCOL: ${introInstruction}\n\nUser Input: ${text}\nUser Label: ${user?.userName}` }];
      
      if (currentFile?.type.startsWith('image/')) {
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

      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: response.text || '...', timestamp: Date.now() };
      
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
      
      playNotificationSound();
      setAvatarAnimation('idle');
    } catch (e: any) { 
      showToast("Link unstable. Frequency error.", "error"); 
      setAvatarAnimation('idle'); 
    } finally { 
      setIsLoading(false); 
    }
  }

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
    onError: (m) => showToast(m, "error")
  });

  return (
    <div className={`flex flex-col h-full w-full transition-colors duration-500 ${theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-zinc-50 text-black'} relative overflow-hidden ios-safe-top ios-safe-bottom font-sans`}>
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}

      <header className={`h-20 px-8 flex items-center justify-between border-b ${theme === 'dark' ? 'border-white/5 bg-black/40' : 'border-black/5 bg-white/40'} backdrop-blur-3xl z-50`}>
        <div className="flex items-center gap-5">
          <button onClick={() => setIsHistoryOpen(true)} className={`p-3 rounded-2xl transition-all active:scale-90 ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-400' : 'hover:bg-black/5 text-zinc-500'}`}><Menu size={24} /></button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-3 rounded-2xl transition-all active:scale-90 ${theme === 'dark' ? 'hover:bg-white/5 text-yellow-400' : 'hover:bg-black/5 text-blue-600'}`}>
            {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
          </button>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-black text-[11px] uppercase tracking-[0.4em] text-blue-500">Mr. Vibe AI</span>
          <span className={`text-[9px] font-black flex items-center gap-1.5 uppercase tracking-widest mt-1 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Neural Sync Active
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsLibraryOpen(true)} className={`p-3 rounded-2xl relative transition-all active:scale-90 ${theme === 'dark' ? 'hover:bg-white/5 text-blue-400' : 'hover:bg-black/5 text-blue-600'}`}>
            <Brain size={22} />
            {pinnedMessages.length > 0 && <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
          </button>
          <button onClick={() => setIsProfileModalOpen(true)} className={`w-11 h-11 rounded-2xl overflow-hidden border-2 ${theme === 'dark' ? 'border-white/10' : 'border-black/10'} ring-4 ring-blue-500/10 shadow-2xl active:scale-95 transition-all`}><img src={user?.avatarUrl} className="w-full h-full object-cover" /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-10 space-y-8 custom-scrollbar scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-10 opacity-40">
            <VibeOrb active={false} isThinking={false} volume={0} outputVolume={0} animationState={avatarAnimation} />
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-[0.4em] text-blue-500">Awaiting Signal</h3>
              <p className="text-[11px] font-bold italic text-zinc-500 uppercase tracking-widest">Connect your neural link and drop a vibe.</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-vibe-in group`}>
              {msg.file && (
                <div className={`mb-3 max-w-[85%] rounded-[30px] overflow-hidden border shadow-2xl ${theme === 'dark' ? 'border-white/10' : 'border-black/5'}`}>
                  {msg.file.type.startsWith('image/') ? (
                    <img src={msg.file.data} alt="Vibe" className="w-full h-auto object-cover max-h-[350px]" />
                  ) : (
                    <div className="flex items-center gap-4 p-5 bg-white/5">
                      <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500"><FileIcon size={28} /></div>
                      <div className="flex-1 truncate font-bold text-xs">{msg.file.name}</div>
                    </div>
                  )}
                </div>
              )}
              <div className={`relative px-6 py-4.5 rounded-[32px] text-sm font-semibold max-w-[88%] shadow-2xl border transition-all duration-300 ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-800 text-white rounded-tr-none border-blue-400/20' 
                  : theme === 'dark' ? 'bg-[#121212] text-zinc-100 rounded-tl-none border-white/5' : 'bg-white text-zinc-900 rounded-tl-none border-black/5'
              }`}>
                <MarkdownText text={msg.text} />
                {msg.role === 'model' && (
                  <button onClick={() => togglePin(msg.id)} className={`absolute -right-12 top-1/2 -translate-y-1/2 p-3 rounded-xl transition-all ${msg.isPinned ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-600/30' : 'text-zinc-500 hover:text-blue-500 opacity-0 group-hover:opacity-100'}`}>
                    <Pin size={16} fill={msg.isPinned ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-start animate-pulse">
            <div className={`px-7 py-5 rounded-[32px] rounded-tl-none border ${theme === 'dark' ? 'bg-[#121212] border-white/5' : 'bg-white border-black/5'}`}>
              <div className="flex gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </main>

      <footer className={`p-6 bg-gradient-to-t ${theme === 'dark' ? 'from-black via-black/90' : 'from-zinc-50 via-zinc-50/90'} to-transparent z-40`}>
        {selectedFile && (
          <div className="max-w-3xl mx-auto mb-4 animate-slide-up">
            <div className={`relative inline-flex items-center gap-4 p-4 rounded-[28px] border shadow-2xl ${theme === 'dark' ? 'bg-[#121212] border-white/10' : 'bg-white border-black/10'}`}>
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 shadow-inner">
                {selectedFile.type.startsWith('image/') ? <img src={selectedFile.data} alt="Preview" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-blue-500/10 flex items-center justify-center text-blue-500"><FileIcon size={20}/></div>}
              </div>
              <div className="flex-1 pr-12 min-w-0">
                <div className="text-[11px] font-bold truncate max-w-[180px]">{selectedFile.name}</div>
              </div>
              <button onClick={() => setSelectedFile(null)} className="absolute top-2 right-2 p-2 hover:bg-white/10 rounded-xl text-zinc-500 transition-all"><X size={14} /></button>
            </div>
          </div>
        )}
        <div className={`max-w-4xl mx-auto flex items-center gap-3 p-2.5 border rounded-[36px] shadow-2xl backdrop-blur-[40px] transition-all duration-500 ${theme === 'dark' ? 'bg-[#111111]/90 border-white/10 ring-1 ring-white/5' : 'bg-white border-black/10 ring-1 ring-black/5'}`}>
          <button onClick={() => fileInputRef.current?.click()} className={`p-4 rounded-full transition-all active:scale-90 ${theme === 'dark' ? 'text-zinc-500 hover:bg-white/5 hover:text-blue-500' : 'text-zinc-500 hover:bg-black/5 hover:text-blue-600'}`}>
            <Paperclip size={24}/>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
               const file = e.target.files?.[0]; if (!file) return;
               const reader = new FileReader(); reader.onload = () => setSelectedFile({ data: reader.result as string, name: file.name, type: file.type });
               reader.readAsDataURL(file); e.target.value = '';
            }} />
          </button>
          <input 
            type="text" 
            placeholder="Link frequencies..." 
            value={inputText} 
            onChange={e => setInputText(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} 
            className="flex-1 bg-transparent py-4 px-3 font-bold text-sm outline-none text-white placeholder-zinc-700"
          />
          <div className="flex items-center gap-2.5 pr-2.5">
             <button onClick={() => connectLive()} className={`p-4 rounded-full transition-all active:scale-90 ${isLive ? 'bg-blue-600 text-white animate-pulse' : 'bg-white/5 text-zinc-500'}`}><Mic size={24}/></button>
             <button onClick={() => handleSendToAI(inputText)} className={`p-4 rounded-full transition-all duration-500 active:scale-95 ${(inputText.trim() || selectedFile) ? 'bg-blue-600 text-white' : 'bg-zinc-500/10 text-zinc-500/20'}`}><Send size={24}/></button>
          </div>
        </div>
      </footer>

      {/* History Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[10000] w-80 transition-transform duration-700 transform ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'} shadow-[0_0_100px_rgba(0,0,0,0.5)] border-r ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-black/5'}`}>
         <div className="flex flex-col h-full">
            <div className={`p-10 flex items-center justify-between border-b ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
               <h2 className="font-black uppercase tracking-[0.4em] text-[10px] flex items-center gap-3 text-zinc-600"><History size={18}/> Vibe Archive</h2>
               <button onClick={() => setIsHistoryOpen(false)} className={`p-3 rounded-2xl ${theme === 'dark' ? 'bg-white/5 text-zinc-500' : 'bg-black/5 text-zinc-600'}`}><X size={18}/></button>
            </div>
            <div className="p-8">
               <button onClick={() => handleNewChat(true)} className="w-full py-5 bg-blue-600 text-white rounded-[26px] font-black flex items-center justify-center gap-3 text-[11px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all"><Plus size={20}/> New Session</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 space-y-3 custom-scrollbar pb-12">
               {sessions.length === 0 ? <div className="text-center py-20 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-800">Void</div> : sessions.map(s => (
                 <div key={s.id} onClick={() => { setActiveSessionId(s.id); setIsHistoryOpen(false); }} className={`group w-full p-5 rounded-[28px] text-left border-2 transition-all cursor-pointer relative ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-600/50' : 'bg-transparent border-transparent hover:bg-black/5'}`}>
                   <div className={`font-black text-xs truncate pr-10 ${activeSessionId === s.id ? 'text-blue-500' : theme === 'dark' ? 'text-zinc-400' : 'text-zinc-700'}`}>{s.title}</div>
                   <button onClick={(e) => { e.stopPropagation(); setSessions(prev => prev.filter(x => x.id !== s.id)); }} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2.5 text-rose-500"><Trash2 size={16}/></button>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* Neural Library Sidebar */}
      <div className={`fixed inset-y-0 right-0 z-[10000] w-96 transition-transform duration-700 transform ${isLibraryOpen ? 'translate-x-0' : 'translate-x-full'} shadow-[0_0_100px_rgba(0,0,0,0.5)] border-l ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-black/5'}`}>
         <div className="flex flex-col h-full">
            <div className={`p-10 flex items-center justify-between border-b ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
               <h2 className="font-black uppercase tracking-[0.4em] text-[10px] flex items-center gap-3 text-blue-500"><Brain size={18}/> Neural Library</h2>
               <button onClick={() => { setIsLibraryOpen(false); setSelectedPinnedId(null); }} className="p-3 bg-white/5 rounded-2xl text-zinc-500"><X size={18}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-8 space-y-4 custom-scrollbar py-8">
               {pinnedMessages.length === 0 ? (
                 <div className="text-center py-20 opacity-20 flex flex-col items-center gap-6">
                   <Pin size={48} />
                   <p className="text-[10px] font-black uppercase tracking-widest">No Pinned Logs</p>
                 </div>
               ) : pinnedMessages.map(m => (
                 <div 
                  key={m.id} 
                  onClick={() => setSelectedPinnedId(m.id === selectedPinnedId ? null : m.id)}
                  className={`p-6 rounded-[28px] border-2 cursor-pointer transition-all ${selectedPinnedId === m.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                 >
                    <div className="text-[11px] leading-relaxed line-clamp-3 font-bold">{m.text}</div>
                 </div>
               ))}
            </div>

            {selectedPinnedId && (
              <div className="p-8 space-y-4 border-t border-white/5 bg-black/40 backdrop-blur-3xl animate-slide-up">
                <p className="text-[9px] font-black uppercase tracking-widest text-center text-blue-500 mb-2">Neural Link Target</p>
                <div className="flex gap-4">
                  <button onClick={() => { 
                    const msg = pinnedMessages.find(x => x.id === selectedPinnedId);
                    if(msg) handleSendToAI(`Give me a quick bestie summary of this link: "${msg.text}"`);
                    setIsLibraryOpen(false);
                    setSelectedPinnedId(null);
                  }} className="flex-1 py-4 bg-zinc-800 text-white rounded-[22px] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg"><StickyNote size={14}/> Summarize</button>
                  <button onClick={() => generateNeuralQuiz(selectedPinnedId)} className="flex-1 py-4 bg-blue-600 text-white rounded-[22px] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg"><GraduationCap size={14}/> Assessment</button>
                </div>
              </div>
            )}
         </div>
      </div>

      {/* Identity Matrix */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-6">
           <div className="absolute inset-0 bg-black/95 backdrop-blur-[60px]" onClick={() => setIsProfileModalOpen(false)} />
           <div className={`relative w-full max-w-xl rounded-[60px] p-12 space-y-10 animate-scale-in border shadow-2xl ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10'} max-h-[90vh] overflow-y-auto`}>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-4"><UserIcon size={26} className="text-blue-500" /> Identity Matrix</h2>
                <button onClick={() => setIsProfileModalOpen(false)} className="p-4 bg-white/5 rounded-3xl text-zinc-500"><X size={24}/></button>
              </div>
              
              <div className="space-y-8">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Human Label</label>
                    <input type="text" value={user?.userName} onChange={e => setUser(u => u ? ({...u, userName: e.target.value}) : null)} onBlur={() => localStorage.setItem('mr_vibe_active_user', JSON.stringify(user))} className="w-full py-5 px-8 rounded-[28px] bg-white/5 border-2 border-transparent focus:border-blue-500 text-white outline-none font-black" />
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Gender Context</label>
                    <div className="grid grid-cols-3 gap-4">
                       {['Male', 'Female', 'Other'].map(g => (
                          <button key={g} onClick={() => { setUser(u => u ? ({...u, gender: g as any}) : null); localStorage.setItem('mr_vibe_active_user', JSON.stringify({...user, gender: g})); }} className={`py-4 rounded-[24px] font-black text-[11px] uppercase tracking-widest border-2 transition-all ${user?.gender === g ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-transparent text-zinc-600'}`}>{g}</button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Neural Archetype</label>
                    <div className="grid grid-cols-2 gap-4">
                       {Object.values(PERSONALITIES).map(p => (
                          <button key={p.id} onClick={() => { updateSettings({ personalityId: p.id }); showToast(`Archetype synced: ${p.name}`, "info"); }} className={`py-5 px-6 rounded-[30px] font-black text-[10px] uppercase tracking-widest border-2 transition-all text-left flex items-center gap-4 ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-transparent text-zinc-600'}`}>
                            <span className="text-2xl">{p.emoji}</span>
                            <span>{p.name}</span>
                          </button>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Onboarding */}
      {isNewUser && (
        <div className="fixed inset-0 z-[9000] bg-black flex items-center justify-center p-8 overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-2xl bg-[#080808] rounded-[64px] p-16 text-center border border-white/5 animate-scale-in my-auto">
             <Logo className="w-16 h-16 mx-auto mb-10" />
             <h1 className="text-4xl font-black mb-16 uppercase italic tracking-tighter text-white">Calibration</h1>
             
             <div className="space-y-10 text-left mb-16">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3">
                   <label className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.4em] ml-4">Human Label</label>
                   <input type="text" placeholder="Identity..." value={tempProfile.userName} onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} className="w-full bg-white/5 rounded-[32px] py-6 px-9 font-bold text-xl outline-none border-2 border-transparent focus:border-blue-600 text-white shadow-inner" />
                 </div>
                 <div className="space-y-3">
                   <label className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.4em] ml-4">Vibe Context</label>
                   <div className="grid grid-cols-3 gap-2">
                     {['Male', 'Female', 'Other'].map(g => (
                       <button key={g} onClick={() => setTempProfile({...tempProfile, gender: g as any})} className={`py-6 rounded-[24px] font-black text-[10px] uppercase border-2 transition-all active:scale-95 ${tempProfile.gender === g ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-transparent text-zinc-700'}`}>{g}</button>
                     ))}
                   </div>
                 </div>
               </div>

               <div className="space-y-3">
                 <label className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.4em] ml-4">Archetype Sync</label>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.values(PERSONALITIES).map(p => (
                      <button key={p.id} onClick={() => setTempProfile({...tempProfile, personalityId: p.id})} className={`p-6 rounded-[36px] font-black text-[9px] uppercase tracking-widest border-2 transition-all flex flex-col items-center gap-3 active:scale-95 ${tempProfile.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-transparent text-zinc-800'}`}>
                        <span className="text-2xl">{p.emoji}</span>
                        <span>{p.name}</span>
                      </button>
                    ))}
                 </div>
               </div>
             </div>

             <button onClick={() => { 
                if(tempProfile.userName) { 
                  const newUser = { ...tempProfile, avatarUrl: AVATARS[Math.floor(Math.random()*AVATARS.length)] } as User; 
                  localStorage.setItem('mr_vibe_active_user', JSON.stringify(newUser)); 
                  setUser(newUser); 
                  setIsNewUser(false); 
                  handleNewChat(true); 
                } else { showToast("Label required, bestie!", "error"); } 
             }} className="w-full py-7 bg-blue-600 text-white rounded-[40px] font-black text-xl uppercase tracking-[0.3em] active:scale-95 transition-all">Link Persona</button>
          </div>
        </div>
      )}

      {/* Quiz UI */}
      {activeQuiz && (
        <div className="fixed inset-0 z-[10000] bg-black/98 backdrop-blur-3xl flex flex-col p-8 md:p-16 overflow-y-auto custom-scrollbar animate-fade-in">
          <div className="w-full max-w-3xl mx-auto space-y-12 pb-20">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="p-5 bg-blue-600 rounded-[28px] text-white"><GraduationCap size={32}/></div>
                <div>
                  <h1 className="text-2xl font-black uppercase italic tracking-tighter">{activeQuiz.title}</h1>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Neural Assessment</p>
                </div>
              </div>
              <button onClick={() => setActiveQuiz(null)} className="p-4 bg-white/5 rounded-3xl text-zinc-500 hover:text-white transition-all"><X size={24}/></button>
            </header>

            <div className="space-y-10">
              {activeQuiz.questions.map((q, qIdx) => (
                <div key={qIdx} className={`p-10 rounded-[48px] border-2 transition-all duration-500 ${isQuizSubmitted ? (quizAnswers[qIdx] === q.correctAnswer ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30') : 'bg-white/5 border-white/5'}`}>
                  <h3 className="text-xl font-bold leading-snug mb-8">{q.question}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = quizAnswers[qIdx] === opt;
                      const isCorrect = opt === q.correctAnswer;
                      return (
                        <button 
                          key={optIdx} 
                          disabled={isQuizSubmitted}
                          onClick={() => setQuizAnswers(prev => ({ ...prev, [qIdx]: opt }))}
                          className={`p-6 rounded-[28px] border-2 font-bold text-left transition-all ${
                            isQuizSubmitted
                              ? isCorrect ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg' : isSelected ? 'bg-rose-500 border-rose-400 text-white' : 'opacity-40 border-transparent'
                              : isSelected ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-transparent hover:bg-white/10'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {isQuizSubmitted && (
                    <div className="mt-8 p-6 rounded-[24px] bg-white/5 text-[11px] font-bold italic text-zinc-400 border border-white/5 leading-relaxed">{q.explanation}</div>
                  )}
                </div>
              ))}
            </div>

            {!isQuizSubmitted ? (
              <button onClick={() => {
                if(Object.keys(quizAnswers).length < activeQuiz.questions.length) return showToast("Finish all questions, bestie!", "info");
                setIsQuizSubmitted(true);
              }} className="w-full py-8 bg-blue-600 text-white rounded-[40px] font-black text-xl uppercase tracking-[0.3em] active:scale-95 transition-all">Submit Assessment</button>
            ) : (
              <div className="flex flex-col items-center gap-10 animate-slide-up">
                <div className="text-center space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Final Vibe Score</p>
                  <h2 className="text-7xl font-black italic text-blue-500">{Math.round((activeQuiz.questions.filter((q, i) => quizAnswers[i] === q.correctAnswer).length / activeQuiz.questions.length) * 100)}%</h2>
                </div>
                <button onClick={() => setActiveQuiz(null)} className="px-12 py-6 bg-white text-black rounded-[40px] font-black uppercase text-xs tracking-widest active:scale-95 transition-all">Finish Assessment</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
