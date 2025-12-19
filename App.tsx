
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Waves, Volume2, LogIn, UserPlus, ArrowRight, ArrowLeft, 
  User as UserIcon, CheckCircle2, Mail, Lock, Sparkles, 
  ChevronRight, MicOff, MessageSquare, AlertCircle, AlertTriangle, RefreshCw,
  Camera, FileText, Upload, Loader2, Play, Image as ImageIcon, Globe,
  Leaf, Droplets, Share2, ThumbsUp, ThumbsDown, Edit3, Check, Zap, ExternalLink, Activity, Bell, Music, Film, Heart, GraduationCap, Users, Copy, Share, LogOut, AlertOctagon, Key, Wand2, Info, HelpCircle, Eye, EyeOff, Smile, Rocket, Eraser
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES, DISCOVERY_DATA, VIBE_VISION_PROMPT } from './constants';
import { PersonalityId, Personality, AppSettings, User, ChatSession, Message, ReactionType, GroundingSource, ApiStatus, Gender } from './types';
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

const MarkdownText = ({ text }: { text: string }) => {
  const parts = text.split(/(```[\s\S]*?```|`.*?`)/g);
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const content = part.slice(3, -3).trim();
          return (
            <div key={i} className="my-2 bg-black/10 dark:bg-black/40 rounded-xl overflow-hidden border border-black/5 dark:border-white/5">
              <div className="bg-black/20 dark:bg-white/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 flex justify-between items-center">
                <span>Code Block</span>
                <button onClick={() => navigator.clipboard.writeText(content)} className="hover:text-blue-500 transition-colors"><Copy size={12} /></button>
              </div>
              <pre className="p-4 text-[13px] font-mono overflow-x-auto custom-scrollbar leading-relaxed">
                <code>{content}</code>
              </pre>
            </div>
          );
        }
        if (part.startsWith('`')) {
          return <code key={i} className="bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-md font-mono text-[13px]">{part.slice(1, -1)}</code>;
        }
        return <span key={i} className="whitespace-pre-wrap">{part}</span>;
      })}
    </div>
  );
};

const ReactionPicker = ({ onSelect, onClose }: { onSelect: (r: ReactionType) => void, onClose: () => void }) => {
  const reactions: ReactionType[] = ['❤️', '👍', '😂', '😮', '🔥', '💀'];
  return (
    <div className="absolute bottom-full mb-2 left-0 z-50 animate-scale-in bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-2xl shadow-2xl p-1.5 flex gap-1 items-center">
      {reactions.map(r => (
        <button key={r} onClick={() => { onSelect(r); onClose(); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl transition-all active:scale-125 text-lg">
          {r}
        </button>
      ))}
    </div>
  );
};

const NotificationToast = ({ message, type, onClose }: { message: string, type: 'info' | 'success' | 'error', onClose: () => void }) => (
  <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[2000] w-[90%] max-w-sm animate-vibe-in">
    <div className={`px-5 py-4 rounded-[2rem] shadow-2xl backdrop-blur-3xl border flex items-center gap-3 font-bold text-sm uppercase tracking-wider ${
      type === 'success' ? 'bg-green-500/20 border-green-500/30 text-green-800 dark:text-green-300' :
      type === 'error' ? 'bg-rose-500/20 border-rose-500/30 text-rose-800 dark:text-rose-300' :
      'bg-blue-500/20 border-blue-500/30 text-blue-800 dark:text-blue-300'
    }`}>
      {type === 'success' ? <CheckCircle2 size={18} /> : type === 'error' ? <AlertCircle size={18} /> : <Bell size={18} />}
      <span className="flex-1 truncate">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"><X size={16}/></button>
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

const FluidOrb = ({ volume, active, isThinking }: { volume: number, active: boolean, isThinking?: boolean }) => {
  const scale = 1 + (active ? volume * 2.5 : isThinking ? 0.1 : 0);
  return (
    <div className="relative flex items-center justify-center transition-all duration-500">
      <div className={`absolute inset-0 bg-blue-500/20 blur-[60px] md:blur-[100px] rounded-full transition-transform duration-700 ${active || isThinking ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}`} />
      <div className={`w-40 h-40 md:w-56 md:h-56 rounded-full relative overflow-hidden transition-all duration-300 shadow-[0_0_80px_rgba(59,130,246,0.4)] ${isThinking ? 'animate-pulse' : ''}`}
        style={{ transform: `scale(${scale})`, opacity: active || isThinking ? 1 : 0.4, background: 'radial-gradient(circle at 30% 30%, #3b82f6, #6366f1, #1e40af)' }}>
        <div className={`absolute inset-0 bg-gradient-to-tr from-white/30 to-transparent opacity-40 ${isThinking ? 'animate-spin' : 'animate-spin-slow'}`} />
        {isThinking && <div className="absolute inset-0 flex items-center justify-center"><Sparkles className="text-white animate-bounce w-12 h-12 opacity-50" /></div>}
      </div>
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
    personalityId: PersonalityId.FUNNY, 
    movieGenre: 'Sci-Fi',
    musicGenre: 'Pop',
    favoriteArtists: [],
    educationLevel: 'University',
    gender: 'Other',
    age: '18',
    hobbies: [],
    mood: 'Chill'
  });

  const [settings, setSettings] = useState<AppSettings>(() => JSON.parse(localStorage.getItem('mr_vibe_settings') || '{"language":"English","theme":"dark","personalityId":"FUNNY","voiceName":"Puck"}'));
  const [sessions, setSessions] = useState<ChatSession[]>(() => JSON.parse(localStorage.getItem('mr_vibe_sessions') || '[]'));
  const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('mr_vibe_active_session_id'));

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingVibe, setIsGeneratingVibe] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{text: string, isModel: boolean}[]>([]);
  const [editUserName, setEditUserName] = useState('');

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [activeReactionMenu, setActiveReactionMenu] = useState<string | null>(null);
  
  const [stagedFile, setStagedFile] = useState<{ data: string, mimeType: string, fileName: string } | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const currentPersonality = PERSONALITIES[settings.personalityId];

  const currentApiKey = useMemo(() => manualApiKey.trim() || (process.env.API_KEY || ''), [manualApiKey]);

  // Request notifications and microphone permissions on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const addNotification = (text: string, type: string = 'info') => {
    setNotifications(prev => [{id: Date.now().toString(), text, type, time: Date.now()}, ...prev.slice(0, 19)]);
    
    // Also trigger native notification if allowed
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Mr. Vibe AI", {
        body: text,
        icon: user?.avatarUrl || "/favicon.ico",
      });
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
      const prompt = `GREETING CHALLENGE: Greet ${user?.userName} warmly based on their profile. BE MR. CUTE!`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { systemInstruction: BASE_SYSTEM_PROMPT, thinkingConfig: { thinkingBudget: 0 } } });
      const aiMessage: Message = { id: `ai-greet-${Date.now()}`, role: 'model', text: response.text || 'Yo! Ready to cook? ✨', timestamp: Date.now() };
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage], lastTimestamp: Date.now() } : s));
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { id: newId, title: 'Vibe ' + (sessions.length + 1), messages: [], lastTimestamp: Date.now(), personalityId: settings.personalityId };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setIsSidebarOpen(false);
    setTimeout(() => handleAISpeakFirst(newId), 100);
    return newId;
  };

  const handleClearChat = () => {
    if (!activeSessionId) return;
    if (confirm("Reset the vibe? All messages in this session will be cleared.")) {
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [], lastTimestamp: Date.now() } : s));
      showToast("Vibe reset! ✨", "success");
      handleAISpeakFirst(activeSessionId);
    }
  };

  const handleDeleteSession = (id: string) => {
    if (confirm("End this session permanently?")) {
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) setActiveSessionId(null);
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

  async function handleGenerateVibeArt() {
    if (!user || isGeneratingVibe) return;
    if (!currentApiKey) { showToast("License link missing.", "error"); return; }
    let sessionId = activeSessionId || handleNewChat();
    setIsGeneratingVibe(true);
    showToast("Cooking your visual essence...", "info");
    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const prompt = VIBE_VISION_PROMPT(user, currentPersonality);
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ text: prompt }] }, config: { imageConfig: { aspectRatio: "1:1" } } });
      let base64Data = '';
      for (const part of response.candidates[0].content.parts) { if (part.inlineData) { base64Data = part.inlineData.data; break; } }
      if (base64Data) {
        const aiMessage: Message = { id: `vibe-art-${Date.now()}`, role: 'model', text: `Aura render complete! 🤌✨`, timestamp: Date.now(), image: `data:image/png;base64,${base64Data}`, isVibeArt: true };
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s));
        showToast("Visual vibe complete! 🎨", "success");
      }
    } catch (e: any) { showToast("Synthesis glitch.", "error"); } finally { setIsGeneratingVibe(false); }
  }

  const handleReaction = (messageId: string, reaction: ReactionType) => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === messageId ? { ...m, reaction: m.reaction === reaction ? null : reaction } : m) } : s));
  };

  async function handleSendToAI(text: string, fileToUse?: { data: string, mimeType: string, fileName: string }, regenerateFromId?: string) {
    const finalFile = fileToUse || stagedFile;
    if ((!text.trim() && !finalFile) || isLoading) return;
    if (apiStatus !== 'connected') { const isOk = await checkApiConnection(); if (!isOk) { showToast("License Link Failed.", "error"); return; } }
    
    let sessionId = activeSessionId || handleNewChat();
    if (regenerateFromId) {
        setSessions(prev => prev.map(s => { if (s.id !== sessionId) return s; const idx = s.messages.findIndex(m => m.id === regenerateFromId); return { ...s, messages: [...s.messages.slice(0, idx + 1)], lastTimestamp: Date.now() }; }));
    } else {
        const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', text: text || 'Check this out!', timestamp: Date.now(), image: finalFile ? `data:${finalFile.mimeType};base64,${finalFile.data}` : undefined };
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, userMessage], lastTimestamp: Date.now() } : s));
    }
    
    setIsLoading(true); setInputText(''); setStagedFile(null);
    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}\n\n${PERSONALITIES[settings.personalityId].prompt}\n\nUSER PROFILE: Name: ${user?.userName}, Age: ${user?.age}, Mood: ${user?.mood}, Hobbies: ${user?.hobbies?.join(', ')}, Fav Music: ${user?.musicGenre}, Fav Movies: ${user?.movieGenre}.`;
      const parts: any[] = [{ text: text || "Check this image out!" }];
      if (finalFile) parts.push({ inlineData: { mimeType: finalFile.mimeType, data: finalFile.data } });
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: { parts }, config: { systemInstruction: fullSystemPrompt, thinkingConfig: { thinkingBudget: 0 } } });
      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: response.text || '...vibe lost...', timestamp: Date.now() };
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s));
    } catch (e: any) { showToast("Soul link lost. Try again! 💫", "error"); } finally { setIsLoading(false); }
  }

  const handleEditMessage = (id: string, text: string) => { setEditingMessageId(id); setEditingText(text); };
  const saveEditMessage = (id: string) => { if (!editingText.trim()) return; setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === id ? { ...m, text: editingText } : m) } : s)); setEditingMessageId(null); handleSendToAI(editingText, undefined, id); };

  const { connect: connectLive, disconnect: disconnectLive, isLive, isConnecting, volume } = useGeminiLive({
    apiKey: currentApiKey, personality: currentPersonality, settings, user: user || tempProfile as User,
    onTranscript: (t, iM) => setLiveTranscript(prev => [...prev, { text: t, isModel: iM }]),
    onTurnComplete: (u, m) => { setLiveTranscript([]); const sId = activeSessionId || handleNewChat(); setSessions(prev => prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, { id: `u-${Date.now()}`, role: 'user', text: u, timestamp: Date.now() }, { id: `m-${Date.now() + 1}`, role: 'model', text: m, timestamp: Date.now() + 1 }] } : s)); },
    onConnectionStateChange: (c) => { if(c) addNotification("Voice link established", "success"); else addNotification("Voice link closed", "info"); !c && setLiveTranscript([]); },
    onError: (m) => showToast(m, "error")
  });

  const handleUpdateUser = () => { if (!editUserName.trim()) return; setUser(prev => prev ? { ...prev, userName: editUserName } : null); showToast("Identity updated! ✨", "success"); };

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
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(onboardingStep / 10) * 100}%` }} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
          {options.map((opt: any) => {
            const optId = opt.id || opt;
            const isSelected = multi ? (current as string[]).includes(optId) : current === optId;
            return (
              <button key={optId} onClick={() => onSelect(optId)} className={`p-4 rounded-[2rem] border-2 transition-all text-center shadow-sm ${isSelected ? 'bg-blue-600 border-blue-500 text-white scale-[1.02]' : 'bg-zinc-100 dark:bg-zinc-800/40 border-transparent text-zinc-900 dark:text-white'}`}>
                {opt.emoji && <span className="text-xl md:text-2xl block mb-1">{opt.emoji}</span>}
                <p className="font-black text-[10px] uppercase">{opt.label || opt}</p>
              </button>
            );
          })}
        </div>
        <button onClick={onNext} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">Next <ArrowRight size={20}/></button>
      </div>
    );

    return (
      <div className="fixed inset-0 z-[2000] bg-zinc-50 dark:bg-[#030303] flex items-center justify-center p-4 overflow-y-auto transition-colors duration-500 h-[100dvh]">
        <div className="w-full max-w-lg bg-white/95 dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/10 p-6 md:p-10 rounded-[3rem] backdrop-blur-3xl shadow-3xl animate-scale-in text-center my-auto">
          {onboardingStep === 1 ? (
            <div className="space-y-8 animate-slide-up">
              <Logo className="w-16 h-16 md:w-20 md:h-20 mx-auto" animated />
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase leading-none">Mr. Vibe AI</h1>
                <p className="text-zinc-500 font-medium text-sm">Meet Mr. Cute, your AI soulmate.</p>
              </div>
              <div className="space-y-3 text-left">
                <div className="relative group"><Mail className={`absolute left-5 top-1/2 -translate-y-1/2 ${isEmailInputValid === true ? 'text-green-500' : isEmailInputValid === false ? 'text-rose-500' : 'text-zinc-400'}`} size={20} /><input type="email" placeholder="Email Address" value={credentials.email} onChange={e => setCredentials({...credentials, email: e.target.value})} className={`w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-4 pl-14 pr-12 font-bold outline-none border-2 transition-all text-zinc-900 dark:text-white text-sm ${isEmailInputValid === true ? 'border-green-500' : isEmailInputValid === false ? 'border-rose-500' : 'border-transparent focus:border-blue-500'}`} /></div>
                <div className="relative"><Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={20} /><input type="password" placeholder="Password" value={credentials.password} onChange={e => setCredentials({...credentials, password: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-4 pl-14 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-sm" /></div>
              </div>
              <button onClick={() => { if (!validateEmail(credentials.email)) { showToast("Check that email, chief. 📧", "error"); return; } setOnboardingStep(1.5); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Continue</button>
            </div>
          ) : onboardingStep === 1.5 ? (
            <div className="space-y-8 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(1)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500"><ArrowLeft size={16} /> Back</button>
              <div className="space-y-4 text-center"><div className="w-16 h-16 bg-blue-500/10 rounded-[2rem] flex items-center justify-center mx-auto text-blue-600 mb-2 animate-pulse"><Key size={32} /></div><h2 className="text-2xl md:text-3xl font-black italic text-zinc-900 dark:text-white tracking-tighter">Soul Connection</h2><p className="text-zinc-500 text-sm font-medium px-4">Instant sync with your License Key. Security is no cap.</p></div>
              <div className="space-y-4 text-left"><div className="relative"><Activity className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={20} /><input type={showApiKey ? "text" : "password"} placeholder="Paste License Key here..." value={manualApiKey} onChange={e => setManualApiKey(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-4 pl-14 pr-12 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-sm" /><button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-blue-500 transition-colors">{showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><button onClick={async () => { const ok = await checkApiConnection(manualApiKey); if (ok || manualApiKey.trim().length >= 20) { setOnboardingStep(2); } else { showToast("Key too short.", "error"); } }} className="w-full py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 bg-blue-600 text-white">Verify & Connect Soul</button></div>
            </div>
          ) : onboardingStep === 2 ? (
            <div className="space-y-8 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(1.5)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-2xl md:text-3xl font-black italic text-zinc-900 dark:text-white tracking-tighter text-center">Identity Sync</h2>
              <div className="grid grid-cols-4 gap-2 max-h-[30vh] overflow-y-auto px-1 custom-scrollbar">{AVATARS.map((url) => (<button key={url} onClick={() => setTempProfile({...tempProfile, avatarUrl: url})} className={`w-full aspect-square rounded-[1.2rem] overflow-hidden transition-all shadow-md border-4 ${tempProfile.avatarUrl === url ? 'border-blue-500 scale-105' : 'border-transparent opacity-50'}`}><img src={url} className="w-full h-full" alt="Avatar" /></button>))}</div>
              <input type="text" placeholder="Call me..." value={tempProfile.userName} onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-4 px-8 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-center text-lg" />
              <button onClick={() => { if (!tempProfile.userName?.trim()) { showToast("Name required! ✨", "error"); return; } setOnboardingStep(3); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Next</button>
            </div>
          ) : onboardingStep === 3 ? ( <DiscoveryStep title="Current Mood" options={DISCOVERY_DATA.moods} current={tempProfile.mood} onSelect={(v: string) => setTempProfile({...tempProfile, mood: v})} onNext={() => setOnboardingStep(4)} />
          ) : onboardingStep === 4 ? (
            <div className="space-y-8 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(3)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-2xl font-black italic text-zinc-900 dark:text-white tracking-tighter text-center">Soul Archetype</h2>
              <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">{(Object.values(PERSONALITIES) as Personality[]).map(p => (<button key={p.id} onClick={() => { setTempProfile({...tempProfile, personalityId: p.id}); setSettings(prev => ({ ...prev, personalityId: p.id, voiceName: p.voiceName })); }} className={`p-4 rounded-[1.5rem] border-2 transition-all text-left flex flex-col items-start gap-1 ${tempProfile.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800/40 border-transparent text-zinc-900 dark:text-white'}`}><span className="text-xl">{p.emoji}</span><p className="font-black text-[10px] uppercase leading-none">{p.name}</p></button>))}</div>
              <button onClick={() => setOnboardingStep(5)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Next</button>
            </div>
          ) : onboardingStep >= 5 && onboardingStep <= 9 ? (
             <DiscoveryStep title={onboardingStep === 5 ? "Cinematic Vibe" : onboardingStep === 6 ? "Acoustic Essence" : onboardingStep === 7 ? "Soul Hobbies" : onboardingStep === 8 ? "Top Influencers" : "Education Path"} options={onboardingStep === 5 ? DISCOVERY_DATA.movies : onboardingStep === 6 ? DISCOVERY_DATA.musicGenres : onboardingStep === 7 ? DISCOVERY_DATA.hobbies : onboardingStep === 8 ? DISCOVERY_DATA.artists[tempProfile.musicGenre || 'Pop'] : DISCOVERY_DATA.education} current={onboardingStep === 7 || onboardingStep === 8 ? (onboardingStep === 7 ? tempProfile.hobbies : tempProfile.favoriteArtists) : (onboardingStep === 5 ? tempProfile.movieGenre : onboardingStep === 6 ? tempProfile.musicGenre : tempProfile.educationLevel)} multi={onboardingStep === 7 || onboardingStep === 8} onSelect={(v: any) => { if(onboardingStep === 7 || onboardingStep === 8) { const key = onboardingStep === 7 ? 'hobbies' : 'favoriteArtists'; const current = tempProfile[key] || []; setTempProfile({...tempProfile, [key]: current.includes(v) ? current.filter(x => x !== v) : [...current, v]}); } else { const keys = ['movieGenre', 'musicGenre', 'educationLevel']; setTempProfile({...tempProfile, [onboardingStep === 5 ? 'movieGenre' : onboardingStep === 6 ? 'musicGenre' : 'educationLevel']: v}); } }} onNext={() => setOnboardingStep(onboardingStep + 1)} />
          ) : (
            <div className="space-y-8 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(9)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-2xl font-black italic text-zinc-900 dark:text-white tracking-tighter text-center">Vibe Check</h2>
              <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest">Age on Earth?</p>
              <input type="number" value={tempProfile.age} onChange={e => setTempProfile({...tempProfile, age: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-4 px-8 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-4xl text-center" />
              <button onClick={() => setUser(tempProfile as User)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Finalize Vibe</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full font-sans overflow-hidden bg-zinc-50 dark:bg-[#050505] transition-colors duration-500 relative select-none">
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}
      
      {(isLive || isConnecting || isGeneratingVibe) && (
        <div className="fixed inset-0 z-[5000] bg-white dark:bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-between p-6 animate-fade-in">
          <div className="w-full flex justify-end"><button onClick={() => { disconnectLive(); setIsGeneratingVibe(false); }} className="p-4 bg-zinc-900/10 dark:bg-white/10 hover:bg-rose-500 text-zinc-900 dark:text-white hover:text-white rounded-full transition-all"><X size={24}/></button></div>
          <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center w-full">
            <FluidOrb volume={volume} active={isLive} isThinking={isGeneratingVibe} />
            <div className="space-y-2"><h2 className="text-3xl md:text-5xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase leading-none">{isConnecting ? "Tuning..." : isGeneratingVibe ? "Synthesizing..." : currentPersonality.name}</h2><p className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">{isLive ? "Connection Live" : "Establishing Link..."}</p></div>
            <div className="max-w-2xl px-4 w-full">{!isGeneratingVibe ? liveTranscript.slice(-1).map((t, i) => (<p key={i} className={`text-xl font-black italic leading-tight ${t.isModel ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>{t.text}</p>)) : <p className="text-zinc-500 font-black italic text-xl animate-pulse">Cooking...</p>}</div>
          </div>
          <button onClick={() => { disconnectLive(); setIsGeneratingVibe(false); }} className="w-full md:w-auto px-10 py-5 bg-rose-600 text-white rounded-[2rem] font-black shadow-3xl flex items-center justify-center gap-3"><MicOff size={24} /> Close Session</button>
        </div>
      )}

      {isSidebarOpen && <div className="fixed inset-0 z-[400] bg-black/60 md:hidden animate-fade-in backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}

      <div className={`fixed inset-y-0 left-0 z-[450] w-[85%] max-w-xs bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/5 transition-transform duration-500 ease-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:relative shadow-2xl md:shadow-none h-full`}>
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center justify-between"><div className="flex items-center gap-3"><Logo className="w-8 h-8" /><h2 className="text-2xl font-black italic tracking-tighter uppercase text-zinc-900 dark:text-white leading-none">History</h2></div><button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-500 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"><X size={20}/></button></div>
          <div className="px-6 pb-4"><button onClick={handleNewChat} className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-500 transition-all active:scale-95"><Plus size={18} /> New Vibe</button></div>
          <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
            {sessions.map(s => (<div key={s.id} className="group relative"><div onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }} className={`p-4 pr-10 rounded-[1.5rem] cursor-pointer transition-all border ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-500/30' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 border-transparent'}`}><div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400"><MessageSquare size={16} /><p className="font-bold text-xs truncate">{s.title}</p></div></div><button onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"><Trash2 size={16} /></button></div>))}
          </div>
          <div className="p-6 border-t border-zinc-100 dark:border-white/5 space-y-4"><button onClick={() => setSettings(s => ({...s, theme: s.theme === 'dark' ? 'light' : 'dark'}))} className="w-full flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-black text-[10px] uppercase tracking-widest text-zinc-900 dark:text-white hover:bg-zinc-200 transition-all">{settings.theme === 'dark' ? <><Moon size={16} /> Night Mode</> : <><Sun size={16} /> Day Mode</>}</button></div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative h-full overflow-hidden w-full">
        <header className="h-[72px] min-h-[72px] px-4 md:px-8 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-white/80 dark:bg-black/80 backdrop-blur-3xl sticky top-0 z-[300] w-full">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl md:hidden text-zinc-900 dark:text-white shadow-sm active:scale-90 transition-all"><Menu size={22} /></button>
            <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-3 cursor-pointer group outline-none active:scale-95 transition-transform">
              <div className="relative"><img src={user?.avatarUrl} className="w-10 h-10 md:w-11 md:h-11 rounded-[1.2rem] border-2 border-white dark:border-zinc-800 shadow-lg" alt="Avatar" /><div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm ${apiStatus === 'connected' ? 'bg-green-500' : 'bg-rose-500 animate-pulse'}`} /></div>
              <div className="hidden sm:block text-left"><h1 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">{user?.userName}</h1><p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Main Character</p></div>
            </button>
          </div>
          <div className="flex items-center gap-2">
             {messages.length > 0 && (
               <button onClick={handleClearChat} className="flex items-center gap-2 px-3 py-2 rounded-full bg-rose-500/10 text-[10px] font-black uppercase tracking-widest text-rose-500 border border-rose-500/20 active:scale-95 transition-all">
                 <Eraser size={14} /> <span className="hidden sm:inline">Clear</span>
               </button>
             )}
            <button onClick={() => setIsNotifOpen(true)} className="p-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-blue-500 transition-all relative">{notifications.length > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full animate-ping" /><Bell size={22} /></button>
            <button onClick={connectLive} className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-xl active:scale-90 transition-all"><Mic size={22} /></button>
          </div>
        </header>

        {isNotifOpen && (
          <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-xl animate-fade-in flex flex-col justify-end sm:justify-center p-0 sm:p-6" onClick={() => setIsNotifOpen(false)}>
            <div className="w-full max-w-lg mx-auto bg-white dark:bg-zinc-900 rounded-t-[2.5rem] sm:rounded-[3rem] p-8 space-y-6 animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center"><div className="flex items-center gap-4"><Logo className="w-10 h-10" /><h2 className="text-2xl font-black italic uppercase text-zinc-900 dark:text-white">Sync Log</h2></div><button onClick={() => setIsNotifOpen(false)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl"><X size={24}/></button></div>
              <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">{notifications.length === 0 ? <div className="py-20 text-center"><p className="text-zinc-400 font-black uppercase tracking-widest text-xs">Nothing but silence.</p></div> : notifications.map(n => (<div key={n.id} className="flex gap-4 items-start border-b border-zinc-100 dark:border-white/5 pb-5"><div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${n.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'}`} /><div className="flex-1"><p className="text-sm font-bold text-zinc-900 dark:text-zinc-200">{n.text}</p><p className="text-[10px] text-zinc-400 font-black mt-1">{new Date(n.time).toLocaleTimeString()}</p></div></div>))}</div>
              <button onClick={() => setNotifications([])} className="w-full py-5 bg-rose-500/10 text-rose-500 font-black uppercase tracking-widest rounded-3xl active:scale-95 transition-all">Clear Logs</button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 md:px-12 py-6 custom-scrollbar bg-zinc-50 dark:bg-[#050505] w-full">
          <div className="max-w-3xl mx-auto flex flex-col gap-4 md:gap-6 pb-36">
            {messages.length === 0 && !isLoading ? (
              <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-8 animate-vibe-in px-4">
                <Logo className="w-20 h-20" animated />
                <div className="space-y-2"><h2 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase leading-none">Mr. Cute is in.</h2><p className="text-sm font-medium text-zinc-500 max-w-xs mx-auto">Tuned into your mood. Ready to cook some heat? 🔥</p></div>
                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
                  <button onClick={handleGenerateVibeArt} className="w-full px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"><Wand2 size={20} /> Aura Render</button>
                  <button onClick={connectLive} className="w-full px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"><Mic size={20} /> Voice Link</button>
                </div>
              </div>
            ) : messages.map((msg, idx) => (
              <div key={msg.id} className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-vibe-in`} style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className={`flex items-end gap-2 max-w-[92%] sm:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'model' && (<div className="w-7 h-7 rounded-[0.7rem] bg-blue-500/10 flex items-center justify-center text-base shrink-0 overflow-hidden shadow-sm border border-zinc-100 dark:border-white/5"><span>{currentPersonality.emoji}</span></div>)}
                  <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-[1.2rem] md:rounded-[1.5rem] shadow-lg text-[14px] md:text-[15px] leading-snug font-bold relative transition-all ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-100 dark:border-white/5 rounded-bl-none shadow-zinc-200/50 dark:shadow-black/30'}`}>
                      {msg.image && (<div className="mb-2 rounded-xl overflow-hidden shadow-md border border-white/10"><img src={msg.image} alt="Vibe" className="w-full h-auto max-h-[350px] object-cover" /></div>)}
                      {editingMessageId === msg.id ? (
                        <div className="flex flex-col gap-2 min-w-[180px]"><textarea autoFocus className="w-full bg-white/10 p-2 rounded-lg border-2 border-white/20 outline-none text-white font-bold text-sm" value={editingText} onChange={(e) => setEditingText(e.target.value)} /><div className="flex justify-end gap-2"><button onClick={() => setEditingMessageId(null)} className="px-3 py-1 bg-black/20 rounded-lg text-[10px] uppercase font-black">Cancel</button><button onClick={() => saveEditMessage(msg.id)} className="px-3 py-1 bg-white text-blue-600 rounded-lg text-[10px] uppercase font-black">Update</button></div></div>
                      ) : (<MarkdownText text={msg.text} />)}
                      {msg.reaction && (
                        <div className="absolute -bottom-2 -right-1 bg-white dark:bg-zinc-800 rounded-full px-1.5 py-0.5 shadow-md border border-black/5 dark:border-white/10 flex items-center gap-1">
                          <span className="text-xs">{msg.reaction}</span>
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
                          {activeReactionMenu === msg.id && <ReactionPicker onSelect={(r) => handleReaction(msg.id, r)} onClose={() => setActiveReactionMenu(null)} />}
                        </div>
                        <button onClick={() => handleCopy(msg.text)} className="p-1 text-zinc-400 hover:text-blue-500"><Copy size={12} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && <TypingIndicator personality={currentPersonality} />}
            {isGeneratingVibe && <TypingIndicator personality={currentPersonality} label="Manifesting..." />}
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
              <input type="text" placeholder="Speak your truth.." value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} className="w-full bg-transparent py-4 px-2 font-bold outline-none text-zinc-900 dark:text-white text-[16px] placeholder:text-zinc-400 min-w-0" maxLength={2000} />
              
              <div className="flex items-center gap-1 shrink-0">
                {inputText.length > 0 && (
                  <>
                    <button onClick={() => setInputText('')} className="p-2 text-zinc-400 hover:text-rose-500 transition-colors shrink-0"><X size={18}/></button>
                    <div className="h-6 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block" />
                    <span className="hidden sm:block text-[10px] font-black text-zinc-400 w-10 text-right">{inputText.length}/2k</span>
                  </>
                )}
                <button onClick={() => handleSendToAI(inputText)} disabled={(!inputText.trim() && !stagedFile) || isLoading} className="text-blue-600 disabled:opacity-30 active:scale-90 transition-transform p-2 shrink-0"><Send size={24} strokeWidth={2.5}/></button>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-2xl animate-fade-in" onClick={() => setIsProfileModalOpen(false)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 md:p-12 shadow-3xl animate-vibe-in max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8 shrink-0"><div className="flex items-center gap-4"><Logo className="w-10 h-10" /><h2 className="text-2xl font-black uppercase italic text-zinc-900 dark:text-white leading-none">Identity</h2></div><button onClick={() => setIsProfileModalOpen(false)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl active:scale-90"><X size={24}/></button></div>
            <div className="overflow-y-auto custom-scrollbar pr-2 flex-1 space-y-10">
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="relative group"><img src={user?.avatarUrl} className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] shadow-2xl border-4 border-white dark:border-zinc-800" alt="Avatar" /><div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2.5 rounded-xl shadow-lg border-2 border-white dark:border-zinc-900"><Camera size={16} /></div></div>
                <div className="w-full space-y-4 text-left">
                  <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block px-1">Alias</label><div className="flex gap-2"><input type="text" value={editUserName} onChange={e => setEditUserName(e.target.value)} className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-4 px-5 font-bold outline-none text-zinc-900 dark:text-white" /><button onClick={handleUpdateUser} className="bg-blue-600 text-white px-5 rounded-2xl active:scale-95"><Check size={20} strokeWidth={3} /></button></div></div>
                  <div className="p-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-[2rem] border border-zinc-100 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">License Key</label><div className={`w-3 h-3 rounded-full ${apiStatus === 'connected' ? 'bg-green-500' : 'bg-rose-500 animate-pulse'}`} /></div>
                    <div className="relative"><input type={showApiKey ? "text" : "password"} placeholder="License Key..." className="w-full bg-zinc-200/50 dark:bg-black/20 p-4 rounded-xl border-2 border-transparent focus:border-blue-500 outline-none font-bold text-sm" value={manualApiKey} onChange={(e) => setManualApiKey(e.target.value)} /><button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-zinc-400">{showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                    <button onClick={async () => { await checkApiConnection(manualApiKey); showToast("Link synchronized! ✨", "success"); }} className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-xs uppercase tracking-widest bg-zinc-900 dark:bg-white text-white dark:text-black active:scale-95 transition-all">Update License</button>
                  </div>
                </div>
              </div>
              <div className="space-y-6"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Switch Personality</label><div className="grid grid-cols-2 gap-3">{(Object.values(PERSONALITIES) as Personality[]).map(p => (<button key={p.id} onClick={() => { setSettings({...settings, personalityId: p.id, voiceName: p.voiceName}); showToast(`${p.name} activated!`, "success"); }} className={`flex items-center gap-3 p-4 rounded-[1.5rem] border-2 transition-all ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-900 dark:text-white'}`}><span className="text-xl shrink-0">{p.emoji}</span><p className="font-black text-[10px] uppercase text-left leading-none">{p.name}</p></button>))}</div></div>
              <div className="pt-6"><button onClick={handleLogOut} className="w-full py-5 text-[10px] text-rose-500 font-black uppercase tracking-[0.3em] hover:bg-rose-500/10 rounded-[2rem] transition-all border-2 border-rose-500/20">End Session</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
