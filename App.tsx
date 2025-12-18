
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Waves, Volume2, LogIn, UserPlus, ArrowRight, ArrowLeft, 
  User as UserIcon, CheckCircle2, Mail, Lock, Sparkles, 
  ChevronRight, MicOff, MessageSquare, AlertCircle, AlertTriangle, RefreshCw,
  Camera, FileText, Upload, Loader2, Play, Image as ImageIcon, Globe,
  Leaf, Droplets, Share2, ThumbsUp, ThumbsDown, Edit3, Check, Zap, ExternalLink, Activity, Bell, Music, Film, Heart, GraduationCap, Users, Copy, Share, LogOut, AlertOctagon, Key
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES, DISCOVERY_DATA } from './constants';
import { PersonalityId, AppSettings, User, ChatSession, Message, ReactionType, GroundingSource, ApiStatus, Gender } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';
import { decode, decodeAudioData } from './utils/audioUtils';

// --- Utility Components ---

const validateEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+\.[^\s@]{2,}$/.test(email) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
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

const NotificationToast = ({ message, type, onClose }: { message: string, type: 'info' | 'success' | 'error', onClose: () => void }) => (
  <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[2000] w-[90%] max-w-sm animate-vibe-in">
    <div className={`px-5 py-4 rounded-[2rem] shadow-2xl backdrop-blur-3xl border flex items-center gap-3 font-bold text-sm uppercase tracking-wider ${
      type === 'success' ? 'bg-green-500/20 border-green-500/30 text-green-800 dark:text-green-300' :
      type === 'error' ? 'bg-rose-500/20 border-rose-500/30 text-rose-800 dark:text-rose-300' :
      'bg-blue-500/20 border-blue-500/30 text-blue-800 dark:text-blue-300'
    }`}>
      {type === 'success' ? <CheckCircle2 size={18} /> : type === 'error' ? <AlertCircle size={18} /> : <Bell size={18} />}
      <span className="flex-1 truncate">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full"><X size={16}/></button>
    </div>
  </div>
);

const TypingIndicator = ({ personality }: { personality: any }) => (
  <div className="flex justify-start w-full animate-vibe-in">
    <div className="flex items-end gap-2 max-w-[80%]">
      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-lg shrink-0 overflow-hidden shadow-sm">
        <span className="animate-pulse">{personality.emoji}</span>
      </div>
      <div className="bg-white dark:bg-zinc-800 rounded-[1.5rem] rounded-bl-none px-4 py-3 shadow-sm border border-black/5 dark:border-white/5 flex gap-1.5 items-center">
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
      </div>
    </div>
  </div>
);

const FluidOrb = ({ volume, active }: { volume: number, active: boolean }) => {
  const scale = 1 + (active ? volume * 2.5 : 0);
  return (
    <div className="relative flex items-center justify-center transition-all duration-500">
      <div className={`absolute inset-0 bg-blue-500/20 blur-[60px] md:blur-[100px] rounded-full transition-transform duration-700 ${active ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}`} />
      <div className="w-40 h-40 md:w-56 md:h-56 rounded-full relative overflow-hidden transition-all duration-300 shadow-[0_0_80px_rgba(59,130,246,0.4)]"
        style={{ transform: `scale(${scale})`, opacity: active ? 1 : 0.4, background: 'radial-gradient(circle at 30% 30%, #3b82f6, #6366f1, #1e40af)' }}>
        <div className="absolute inset-0 bg-gradient-to-tr from-white/30 to-transparent animate-spin-slow opacity-40" />
      </div>
    </div>
  );
};

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_active_user'));
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const [toast, setToast] = useState<{message: string, type: 'info' | 'success' | 'error'} | null>(null);
  const [notifications, setNotifications] = useState<{id: string, text: string, type: string, time: number}[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('mr_vibe_active_user') || 'null'));
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  
  const [tempProfile, setTempProfile] = useState<Partial<User>>({ 
    userName: '', 
    avatarUrl: AVATARS[0], 
    personalityId: PersonalityId.FUNNY, 
    movieGenre: '',
    musicGenre: '',
    favoriteArtists: [],
    educationLevel: '',
    gender: 'Other',
    age: '18'
  });

  const [settings, setSettings] = useState<AppSettings>(() => JSON.parse(localStorage.getItem('mr_vibe_settings') || '{"language":"English","theme":"dark","personalityId":"FUNNY","voiceName":"Puck"}'));
  const [sessions, setSessions] = useState<ChatSession[]>(() => JSON.parse(localStorage.getItem('mr_vibe_sessions') || '[]'));
  const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('mr_vibe_active_session_id'));

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{text: string, isModel: boolean}[]>([]);
  const [editUserName, setEditUserName] = useState('');
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const currentPersonality = PERSONALITIES[settings.personalityId];

  const addNotification = (text: string, type: string = 'info') => {
    setNotifications(prev => [{id: Date.now().toString(), text, type, time: Date.now()}, ...prev.slice(0, 9)]);
  };

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    addNotification(message, type);
    setTimeout(() => setToast(null), 4000);
  };

  async function checkApiConnection() {
    if (!process.env.API_KEY) {
      setApiStatus('error');
      return false;
    }
    setApiStatus('checking');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: 'ping', 
        config: { maxOutputTokens: 2, thinkingConfig: { thinkingBudget: 0 } } 
      });
      if (response && response.text) { 
        setApiStatus('connected'); 
        addNotification("Vibe connection verified! ✨", "success");
        return true; 
      }
      throw new Error("Invalid key");
    } catch (error: any) {
      setApiStatus('error');
      showToast("Vibe connection failed. Check your API key.", "error");
      return false;
    }
  }

  const handleSelectApiKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      showToast("Connecting to Gemini network...", "info");
      setTimeout(checkApiConnection, 2000);
    } else {
      showToast("API selection not available in this environment.", "error");
    }
  };

  useEffect(() => { if (user) checkApiConnection(); }, [user]);
  useEffect(() => { if (user) setEditUserName(user.userName); }, [user, isProfileModalOpen]);

  async function handleAISpeakFirst(sessionId: string) {
    if (!process.env.API_KEY) return;
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}
      ---
      USER DATA: Name: ${user?.userName}, Movie: ${user?.movieGenre}, Music: ${user?.musicGenre}, Education: ${user?.educationLevel}
      ---
      PERSONALITY: ${currentPersonality.name}
      ---
      INSTRUCTION: Analyze this user's soul. Greet them warmly and specifically reference their mix of interests.`;
      
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: "Wake up and analyze my discovery vibe!", 
        config: { systemInstruction: fullSystemPrompt, thinkingConfig: { thinkingBudget: 0 } } 
      });
      
      const aiMessage: Message = { id: `ai-greet-${Date.now()}`, role: 'model', text: response.text || 'Hey! Ready to vibe? ✨', timestamp: Date.now() };
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage], lastTimestamp: Date.now() } : s));
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { id: newId, title: 'Vibe ' + (sessions.length + 1), messages: [], lastTimestamp: Date.now(), personalityId: settings.personalityId };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setIsSidebarOpen(false);
    setTimeout(() => handleAISpeakFirst(newId), 300);
    return newId;
  };

  const handleDeleteSession = (id: string) => {
    if (confirm("Delete this vibe?")) {
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) setActiveSessionId(null);
      showToast("Vibe deleted.", "info");
    }
  };

  const handleLogOut = () => { 
    if (confirm("Are you sure you want to log out of Mr. Vibe AI?")) { 
      setUser(null); 
      setActiveSessionId(null); 
      setIsNewUser(true); 
      setOnboardingStep(1); 
      localStorage.removeItem('mr_vibe_active_user'); 
      showToast("Logged out of Mr. Cute. Bye! 👋", "info"); 
    } 
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Vibe copied to clipboard! ✨", "success");
  };

  const handleShare = (text: string) => {
    if (navigator.share) {
      navigator.share({ title: 'Mr. Cute Vibe', text }).catch(() => handleCopy(text));
    } else {
      handleCopy(text);
    }
  };

  const handleReaction = (messageId: string, reaction: ReactionType) => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => 
      s.id === activeSessionId 
        ? { ...s, messages: s.messages.map(m => m.id === messageId ? { ...m, reaction: m.reaction === reaction ? null : reaction } : m) }
        : s
    ));
  };

  async function handleSendToAI(text: string, fileData?: { data: string, mimeType: string, fileName: string }) {
    if ((!text.trim() && !fileData) || isLoading) return;
    
    if (apiStatus !== 'connected') {
      const isOk = await checkApiConnection();
      if (!isOk) {
        showToast("Vibe connection inactive. Check API key in Profile.", "error");
        return;
      }
    }

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = handleNewChat();
    }

    const userMessage: Message = { 
      id: `u-${Date.now()}`, 
      role: 'user', 
      text: text || 'Vibe Snapshot', 
      timestamp: Date.now(), 
      image: fileData ? `data:${fileData.mimeType};base64,${fileData.data}` : undefined 
    };

    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, userMessage], lastTimestamp: Date.now() } : s));
    
    setIsLoading(true); 
    setInputText('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}\n- Personality: ${currentPersonality.name}\n- User Context: ${user?.userName}, likes ${user?.musicGenre} and ${user?.movieGenre}`;
      
      const parts: any[] = [{ text: text || "Analyze this vibe!" }];
      if (fileData) parts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.data } });

      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: { parts }, 
        config: { systemInstruction: fullSystemPrompt, thinkingConfig: { thinkingBudget: 0 } } 
      });
      
      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: response.text || '...', timestamp: Date.now() };
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s));
    } catch (e: any) { 
      showToast("Vibe error. Reconnecting to the Gemini network...", "error");
    } finally { 
      setIsLoading(false); 
    }
  }

  const { connect: connectLive, disconnect: disconnectLive, isLive, isConnecting, volume } = useGeminiLive({
    personality: currentPersonality, settings, user: user || tempProfile as User,
    onTranscript: (t, isM) => setLiveTranscript(prev => [...prev, { text: t, isModel: isM }]),
    onTurnComplete: (u, m) => { setLiveTranscript([]); const sId = activeSessionId || handleNewChat(); setSessions(prev => prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, { id: `u-${Date.now()}`, role: 'user', text: u, timestamp: Date.now() }, { id: `m-${Date.now() + 1}`, role: 'model', text: m, timestamp: Date.now() + 1 }] } : s)); },
    onConnectionStateChange: (c) => { if(c) addNotification("Voice Vibe session started", "success"); else addNotification("Voice Vibe session ended", "info"); !c && setLiveTranscript([]); },
    onError: (m) => showToast(m, "error")
  });

  const handleUpdateUser = () => {
    if (!editUserName.trim()) return;
    setUser(prev => prev ? { ...prev, userName: editUserName } : null);
    showToast("Identity updated! ✨", "success");
  };

  useEffect(() => { localStorage.setItem('mr_vibe_settings', JSON.stringify(settings)); document.documentElement.classList.toggle('dark', settings.theme === 'dark'); }, [settings]);
  useEffect(() => { if (user) { localStorage.setItem('mr_vibe_active_user', JSON.stringify(user)); setIsNewUser(false); if (sessions.length === 0) handleNewChat(); } }, [user]);
  useEffect(() => { localStorage.setItem('mr_vibe_sessions', JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { if (activeSessionId) localStorage.setItem('mr_vibe_active_session_id', activeSessionId); }, [activeSessionId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, liveTranscript, isLoading]);

  if (isNewUser) {
    const isEmailInputValid = credentials.email ? validateEmail(credentials.email) : null;

    const DiscoveryStep = ({ title, options, current, onSelect, multi = false, onNext }: any) => (
      <div className="space-y-8 animate-slide-in-right">
        <button onClick={() => setOnboardingStep(onboardingStep - 1)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500 transition-colors"><ArrowLeft size={16} /> Back</button>
        <h2 className="text-2xl md:text-3xl font-black italic text-zinc-900 dark:text-white tracking-tighter">{title}</h2>
        <div className="grid grid-cols-2 xs:grid-cols-2 gap-3 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
          {options.map((opt: any) => {
            const optId = opt.id || opt;
            const isSelected = multi ? (current as string[]).includes(optId) : current === optId;
            return (
              <button 
                key={optId} 
                onClick={() => onSelect(optId)} 
                className={`p-4 md:p-5 rounded-[2rem] border-2 transition-all text-center shadow-sm ${isSelected ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-[1.02]' : 'bg-zinc-100 dark:bg-zinc-800/40 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white'}`}
              >
                {opt.emoji && <span className="text-2xl md:text-3xl block mb-1">{opt.emoji}</span>}
                <p className="font-black text-[10px] md:text-xs uppercase leading-tight">{opt.label || opt}</p>
              </button>
            );
          })}
        </div>
        <button onClick={onNext} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 md:py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">Next <ArrowRight size={20}/></button>
      </div>
    );

    return (
      <div className="fixed inset-0 z-[2000] bg-zinc-50 dark:bg-[#030303] flex items-center justify-center p-4 overflow-y-auto transition-colors duration-500">
        <div className="w-full max-w-lg bg-white/95 dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/10 p-6 md:p-10 rounded-[3rem] backdrop-blur-3xl shadow-3xl animate-scale-in text-center my-auto">
          {onboardingStep === 1 ? (
            <div className="space-y-10 animate-slide-up">
              <Logo className="w-20 h-20 md:w-24 md:h-24 mx-auto" animated />
              <div className="space-y-3">
                <h1 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase leading-none">Mr. Vibe AI</h1>
                <p className="text-zinc-500 font-medium text-sm md:text-base">Meet Mr. Cute. Your new AI bestie.</p>
              </div>
              <div className="space-y-4 text-left">
                <div className="relative group">
                  <Mail className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${isEmailInputValid === true ? 'text-green-500' : isEmailInputValid === false ? 'text-rose-500' : 'text-zinc-400 group-focus-within:text-blue-500'}`} size={20} />
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    value={credentials.email} 
                    onChange={e => setCredentials({...credentials, email: e.target.value})} 
                    className={`w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-4 md:py-5 pl-14 pr-12 font-bold outline-none border-2 transition-all text-zinc-900 dark:text-white text-sm md:text-base
                      ${isEmailInputValid === true ? 'border-green-500 ring-4 ring-green-500/5' : isEmailInputValid === false ? 'border-rose-500 ring-4 ring-rose-500/5' : 'border-transparent focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5'}
                    `} 
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2">
                    {isEmailInputValid === true && <CheckCircle2 className="text-green-500 animate-scale-in" size={20} />}
                    {isEmailInputValid === false && <AlertOctagon className="text-rose-500 animate-scale-in" size={20} />}
                  </div>
                </div>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input type="password" placeholder="Password" value={credentials.password} onChange={e => setCredentials({...credentials, password: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-4 md:py-5 pl-14 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-sm md:text-base focus:ring-4 focus:ring-blue-500/5" />
                </div>
              </div>
              <button onClick={() => { if (!validateEmail(credentials.email)) { showToast("Enter a valid email! 📧", "error"); return; } setOnboardingStep(1.5); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 md:py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Next</button>
            </div>
          ) : onboardingStep === 1.5 ? (
            <div className="space-y-10 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(1)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500 transition-colors"><ArrowLeft size={16} /> Back</button>
              <div className="space-y-4">
                <div className="w-16 h-16 bg-blue-500/10 rounded-3xl flex items-center justify-center mx-auto text-blue-500"><Key size={32} /></div>
                <h2 className="text-2xl md:text-3xl font-black italic text-zinc-900 dark:text-white tracking-tighter">Connection Step</h2>
                <p className="text-zinc-500 text-sm md:text-base font-medium px-4">To link your account to the AI network, please select your Vibe project.</p>
              </div>
              <div className="space-y-4">
                <button onClick={async () => { await handleSelectApiKey(); setOnboardingStep(2); }} className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black py-4 md:py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3">
                  <Activity size={20} /> Link AI Project
                </button>
                <div className="flex items-center justify-center gap-3">
                   <div className={`w-2.5 h-2.5 rounded-full ${apiStatus === 'connected' ? 'bg-green-500' : 'bg-rose-500'}`} />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Connection: {apiStatus.toUpperCase()}</span>
                </div>
              </div>
            </div>
          ) : onboardingStep === 2 ? (
            <div className="space-y-8 md:space-y-10 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(1.5)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500 transition-colors"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-2xl md:text-3xl font-black italic text-zinc-900 dark:text-white tracking-tighter">Choose Visual</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {AVATARS.map((url) => (
                  <button key={url} onClick={() => setTempProfile({...tempProfile, avatarUrl: url})} className={`w-full aspect-square rounded-[1.5rem] md:rounded-[1.8rem] overflow-hidden transition-all shadow-md border-4 ${tempProfile.avatarUrl === url ? 'border-blue-500 scale-105' : 'border-transparent opacity-50 hover:opacity-100'}`}>
                    <img src={url} className="w-full h-full" alt="Avatar" />
                  </button>
                ))}
              </div>
              <input type="text" placeholder="Your display name?" value={tempProfile.userName} onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-4 md:py-5 px-8 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-center text-lg focus:ring-4 focus:ring-blue-500/5" />
              <button onClick={() => { if (!tempProfile.userName?.trim()) { showToast("Tell me your name! ✨", "error"); return; } setOnboardingStep(4); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 md:py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Next</button>
            </div>
          ) : onboardingStep === 4 ? (
            <div className="space-y-8 md:space-y-10 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(2)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500 transition-colors"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-2xl md:text-3xl font-black italic text-zinc-900 dark:text-white tracking-tighter text-center">Core Vibe</h2>
              <div className="grid grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {Object.values(PERSONALITIES).map(p => (
                  <button key={p.id} onClick={() => { setTempProfile({...tempProfile, personalityId: p.id}); setSettings(prev => ({ ...prev, personalityId: p.id, voiceName: p.voiceName })); }} className={`p-4 rounded-[1.5rem] border-2 transition-all text-left ${tempProfile.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-[1.02]' : 'bg-zinc-100 dark:bg-zinc-800/40 border-transparent text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}>
                    <span className="text-2xl">{p.emoji}</span><p className="font-black text-[10px] mt-1 uppercase leading-none">{p.name}</p>
                  </button>
                ))}
              </div>
              <button onClick={() => setOnboardingStep(5)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 md:py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Next</button>
            </div>
          ) : onboardingStep === 5 ? (
            <DiscoveryStep title="Movie Genre" options={DISCOVERY_DATA.movies} current={tempProfile.movieGenre} onSelect={(v: string) => setTempProfile({...tempProfile, movieGenre: v})} onNext={() => setOnboardingStep(6)} />
          ) : onboardingStep === 6 ? (
            <DiscoveryStep title="Music Vibe" options={DISCOVERY_DATA.musicGenres} current={tempProfile.musicGenre} onSelect={(v: string) => setTempProfile({...tempProfile, musicGenre: v, favoriteArtists: []})} onNext={() => setOnboardingStep(7)} />
          ) : onboardingStep === 7 ? (
            <DiscoveryStep title={`Top Artists`} options={DISCOVERY_DATA.artists[tempProfile.musicGenre || 'Rock']} current={tempProfile.favoriteArtists} multi={true} onSelect={(v: string) => {
                const current = tempProfile.favoriteArtists || [];
                if (current.includes(v)) setTempProfile({...tempProfile, favoriteArtists: current.filter(a => a !== v)});
                else setTempProfile({...tempProfile, favoriteArtists: [...current, v]});
              }} onNext={() => setOnboardingStep(8)} />
          ) : onboardingStep === 8 ? (
            <DiscoveryStep title="Education" options={DISCOVERY_DATA.education} current={tempProfile.educationLevel} onSelect={(v: string) => setTempProfile({...tempProfile, educationLevel: v})} onNext={() => setOnboardingStep(9)} />
          ) : onboardingStep === 9 ? (
            <DiscoveryStep title="Gender Identity" options={DISCOVERY_DATA.genders} current={tempProfile.gender} onSelect={(v: string) => setTempProfile({...tempProfile, gender: v as Gender})} onNext={() => setOnboardingStep(10)} />
          ) : (
            <div className="space-y-10 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(9)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500 transition-colors"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-2xl md:text-3xl font-black italic text-zinc-900 dark:text-white tracking-tighter text-center">Last Detail</h2>
              <div className="space-y-4">
                <p className="text-zinc-500 font-bold text-sm uppercase tracking-widest">How old are you?</p>
                <input type="number" value={tempProfile.age} onChange={e => setTempProfile({...tempProfile, age: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 px-8 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-4xl md:text-5xl text-center focus:ring-4 focus:ring-blue-500/5" />
              </div>
              <button onClick={() => setUser(tempProfile as User)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 md:py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Complete Setup</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full font-sans overflow-hidden bg-zinc-50 dark:bg-[#050505] transition-colors duration-500 relative">
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}
      
      {/* Voice UI Overlay */}
      {(isLive || isConnecting) && (
        <div className="fixed inset-0 z-[5000] bg-white dark:bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-between p-6 md:p-8 animate-fade-in transition-colors duration-500">
          <div className="w-full flex justify-end">
            <button onClick={disconnectLive} className="p-3 md:p-4 bg-zinc-900/10 dark:bg-white/10 hover:bg-rose-500 text-zinc-900 dark:text-white hover:text-white rounded-full transition-all">
              <X size={24}/>
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-8 md:gap-10 text-center w-full">
            <FluidOrb volume={volume} active={isLive} />
            <div className="space-y-3 md:space-y-4">
              <h2 className="text-3xl md:text-6xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase leading-none px-4">
                {isConnecting ? "Tuning In..." : currentPersonality.name}
              </h2>
              <p className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest text-[10px] md:text-xs animate-pulse">
                {isLive ? "Connection Established" : "Initializing Vibe..."}
              </p>
            </div>
            <div className="max-w-2xl px-4 md:px-6 w-full">
              {liveTranscript.slice(-2).map((t, i) => (
                <p key={i} className={`text-lg md:text-2xl font-black italic leading-tight mb-4 ${t.isModel ? 'text-zinc-900 dark:text-white opacity-100' : 'text-zinc-400 dark:text-zinc-500 opacity-60'}`}>
                  {t.text}
                </p>
              ))}
            </div>
          </div>
          <button onClick={disconnectLive} className="w-full md:w-auto px-12 py-5 md:py-6 bg-rose-600 text-white rounded-[2.5rem] font-black shadow-3xl hover:bg-rose-500 transition-all active:scale-95 flex items-center justify-center gap-3">
            <MicOff size={24} /> Stop Talking
          </button>
        </div>
      )}

      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[400] bg-black/40 md:hidden animate-fade-in" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[450] w-[85%] max-w-xs bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/5 transition-transform duration-500 ease-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:relative shadow-2xl md:shadow-none`}>
        <div className="flex flex-col h-full">
          <div className="p-6 md:p-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo className="w-8 h-8" />
              <h2 className="text-2xl font-black italic tracking-tighter uppercase text-zinc-900 dark:text-white leading-none">History</h2>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-900 dark:text-white p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm">
              <X size={20}/>
            </button>
          </div>
          <div className="px-6 md:px-8 pb-6">
            <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-4 rounded-xl font-black shadow-xl hover:bg-blue-500 transition-all active:scale-95">
              <Plus size={18} /> New Vibe
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 md:px-6 space-y-3 custom-scrollbar">
            {sessions.map(s => (
              <div key={s.id} className="group relative">
                <div onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }} className={`p-4 pr-12 rounded-[1.8rem] cursor-pointer transition-all border ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-500/30 shadow-md ring-1 ring-blue-500/10' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/40 border-transparent'}`}>
                  <div className="flex items-center gap-3">
                    <MessageSquare size={16} className={activeSessionId === s.id ? 'text-blue-500' : 'text-zinc-500'} />
                    <p className={`font-bold text-xs truncate ${activeSessionId === s.id ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                      {s.title}
                    </p>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all md:opacity-0 group-hover:opacity-100">
                  <Trash2 size={16} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
          <div className="p-6 md:p-8 border-t border-zinc-100 dark:border-white/5 space-y-4">
             <button onClick={() => setSettings(s => ({...s, theme: s.theme === 'dark' ? 'light' : 'dark'}))} className="w-full flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-black text-[10px] uppercase tracking-widest text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all">
                {settings.theme === 'dark' ? <><Moon size={16} /> Night Mode</> : <><Sun size={16} /> Day Mode</>}
             </button>
             <button onClick={handleLogOut} className="w-full flex items-center gap-3 p-4 bg-rose-500/10 text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">
                <LogOut size={16} /> End Journey
             </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative h-full overflow-hidden w-full">
        {/* Header */}
        <header className="px-4 md:px-6 py-4 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-white/60 dark:bg-black/40 backdrop-blur-2xl sticky top-0 z-[300] w-full">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl md:hidden text-zinc-900 dark:text-white shadow-sm hover:text-blue-500 transition-colors"><Menu size={20} /></button>
            <div className="flex items-center gap-2 md:gap-3 cursor-pointer group" onClick={() => setIsProfileModalOpen(true)}>
              <div className="relative">
                <img src={user?.avatarUrl} className="w-9 h-9 md:w-11 md:h-11 rounded-[1rem] md:rounded-[1.2rem] border-2 border-white dark:border-zinc-800 shadow-lg group-hover:scale-105 transition-transform" alt="Avatar" />
                <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm ${apiStatus === 'connected' ? 'bg-green-500' : apiStatus === 'checking' ? 'bg-amber-500' : 'bg-rose-500 animate-pulse'}`} />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2"><h1 className="text-sm font-black text-zinc-900 dark:text-white leading-none tracking-tight">{user?.userName}</h1></div>
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">{user?.personalityId}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)} 
                className={`p-2.5 md:p-3 rounded-2xl transition-all shadow-sm relative ${isNotifOpen ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-blue-500'}`}
                title="Activity logs"
              >
                <Bell size={20} />
                {notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-zinc-800" />}
              </button>
              
              {/* Notification Center Popover */}
              {isNotifOpen && (
                <div className="fixed inset-0 sm:absolute sm:inset-auto sm:top-full sm:right-0 mt-0 sm:mt-4 w-full h-full sm:h-auto sm:w-80 bg-white/95 dark:bg-zinc-900/95 sm:bg-white sm:dark:bg-zinc-900 border-0 sm:border border-zinc-100 dark:border-white/10 rounded-0 sm:rounded-[2.5rem] shadow-none sm:shadow-3xl p-6 z-[1000] animate-vibe-in overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-8 sm:mb-5">
                    <h3 className="text-[14px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white">Soul Activity</h3>
                    <div className="flex items-center gap-4">
                      <button onClick={() => setNotifications([])} className="text-[12px] sm:text-[10px] font-black text-rose-500 uppercase px-2 py-1 rounded-lg transition-colors">Clear</button>
                      <button onClick={() => setIsNotifOpen(false)} className="sm:hidden p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full"><X size={20}/></button>
                    </div>
                  </div>
                  <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-1">
                    {notifications.length === 0 ? (
                      <div className="py-20 text-center space-y-4">
                        <Activity size={32} className="mx-auto text-zinc-200 dark:text-zinc-700" />
                        <p className="text-[12px] text-zinc-400 font-bold uppercase tracking-widest">No recent logs.</p>
                      </div>
                    ) : notifications.map(n => (
                      <div key={n.id} className="flex gap-4 items-start border-b border-zinc-100 dark:border-white/5 pb-5 last:border-0 group">
                        <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${n.type === 'error' ? 'bg-rose-500' : n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`} />
                        <div className="flex-1 space-y-1">
                          <p className="text-[14px] sm:text-[12px] font-bold text-zinc-900 dark:text-zinc-200 leading-snug">{n.text}</p>
                          <p className="text-[10px] text-zinc-400 uppercase font-black tracking-tight">{new Date(n.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setIsProfileModalOpen(true)} className="px-3 md:px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-black text-[9px] md:text-[10px] shadow-xl uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-1.5 md:gap-2 border border-zinc-200 dark:border-transparent">
              <Activity size={14} className={apiStatus === 'connected' ? 'text-green-500' : apiStatus === 'checking' ? 'text-amber-500' : 'text-rose-500'} />
              <span className="max-w-[80px] truncate">{currentPersonality.name}</span>
            </button>
            <button onClick={connectLive} className="p-2.5 md:p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all">
              <Mic size={20} />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto px-4 md:px-12 py-6 md:py-10 custom-scrollbar bg-zinc-50 dark:bg-[#050505] relative w-full">
          <div className="max-w-3xl mx-auto flex flex-col gap-6 md:gap-12 pb-32">
            {messages.length === 0 && !isLoading ? (
              <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 md:space-y-8 animate-vibe-in">
                <Logo className="w-16 h-16 md:w-24 md:h-24" animated />
                <div className="space-y-3">
                  <h2 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase leading-none">Vibe with Mr. Cute</h2>
                  <p className="text-[13px] md:text-sm font-medium text-zinc-500 max-w-xs mx-auto">He's ready. Send a message or tap the microphone to start talking!</p>
                </div>
              </div>
            ) : messages.map((msg, idx) => (
              <div key={msg.id} className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-vibe-in`} style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className={`flex items-end gap-2 md:gap-3 max-w-[95%] sm:max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-[0.8rem] md:rounded-[1rem] bg-blue-500/10 flex items-center justify-center text-lg md:text-xl shrink-0 overflow-hidden shadow-sm border border-zinc-100 dark:border-white/5">
                      <span>{currentPersonality.emoji}</span>
                    </div>
                  )}
                  <div className={`flex flex-col gap-1.5 md:gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-3 md:px-6 md:py-4 rounded-[1.5rem] md:rounded-[2.2rem] shadow-lg text-[14px] md:text-[1rem] leading-relaxed font-bold transition-all relative
                      ${msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none shadow-blue-500/10' 
                        : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-100 dark:border-white/5 rounded-bl-none shadow-zinc-200/50 dark:shadow-black/20'}`}>
                      {msg.image && <div className="mb-3 md:mb-4 rounded-xl md:rounded-2xl overflow-hidden shadow-2xl border border-zinc-100 dark:border-white/10"><img src={msg.image} alt="Snapshot" className="w-full h-auto max-h-[300px] md:max-h-[400px] object-cover" /></div>}
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                    
                    <div className={`flex items-center gap-3 md:gap-4 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                       <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                       <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <button onClick={() => handleReaction(msg.id, 'like')} title="Like" className={`p-1.5 rounded-full transition-all ${msg.reaction === 'like' ? 'text-blue-500 bg-blue-500/10' : 'text-zinc-400 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                            <ThumbsUp size={12} fill={msg.reaction === 'like' ? 'currentColor' : 'none'} />
                          </button>
                          <button onClick={() => handleCopy(msg.text)} title="Copy" className="p-1.5 rounded-full text-zinc-400 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                            <Copy size={12} />
                          </button>
                          <button onClick={() => handleShare(msg.text)} title="Share" className="p-1.5 rounded-full text-zinc-400 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                            <Share size={12} />
                          </button>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && <TypingIndicator personality={currentPersonality} />}
            <div ref={bottomRef} className="h-32" />
          </div>
        </main>

        {/* Input Bar */}
        <footer className="px-4 py-6 md:py-8 pointer-events-none absolute bottom-0 left-0 right-0 z-[200]">
          <div className="max-w-2xl mx-auto flex items-center gap-3 pointer-events-auto w-full">
            <div className="flex-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl flex items-center rounded-[2.5rem] px-4 md:px-6 py-1 border-2 border-zinc-200 dark:border-white/10 focus-within:border-blue-500 transition-all shadow-[0_10px_30px_-5px_rgba(0,0,0,0.15)]">
              <button onClick={() => fileInputRef.current?.click()} className="text-zinc-400 hover:text-blue-500 transition-colors p-2" title="Attach visual"><ImageIcon size={20} /></button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => handleSendToAI("", { data: (reader.result as string).split(',')[1], mimeType: file.type, fileName: file.name }); reader.readAsDataURL(file); } }} />
              <input 
                type="text" 
                placeholder="Say anything..." 
                value={inputText} 
                onChange={e => setInputText(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} 
                className="w-full bg-transparent py-4 md:py-5 px-2 md:px-3 font-bold outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-[15px]" 
              />
              <button 
                onClick={() => handleSendToAI(inputText)} 
                disabled={!inputText.trim() || isLoading || apiStatus === 'error'} 
                className="ml-1 text-blue-600 disabled:opacity-30 hover:scale-110 active:scale-95 transition-transform p-2"
              >
                <Send size={24} strokeWidth={2.5}/>
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Config Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 md:p-6">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-xl animate-fade-in" onClick={() => setIsProfileModalOpen(false)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 shadow-3xl animate-vibe-in max-h-[95vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8 md:mb-12">
              <div className="flex items-center gap-3 md:gap-4"><Logo className="w-8 h-8 md:w-10 md:h-10" /><h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white leading-none">Vibe Config</h2></div>
              <button onClick={() => setIsProfileModalOpen(false)} className="p-2 md:p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-900 dark:text-white hover:bg-rose-500 hover:text-white transition-all"><X size={24} strokeWidth={3} /></button>
            </div>
            
            <div className="space-y-10 md:space-y-12">
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="relative group">
                  <img src={user?.avatarUrl} className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] md:rounded-[3rem] shadow-2xl border-4 border-white dark:border-zinc-800 transition-transform group-hover:scale-105" alt="Avatar" />
                  <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-xl shadow-lg border-2 border-white dark:border-zinc-900">
                    <Camera size={14} />
                  </div>
                </div>
                
                <div className="w-full space-y-4 md:space-y-6 text-left">
                  <div className="space-y-2 px-1">
                    <label className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 block">Personal Name</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={editUserName} 
                        onChange={e => setEditUserName(e.target.value)} 
                        className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-3.5 md:py-4 px-5 md:px-6 font-bold outline-none text-zinc-900 dark:text-white transition-all text-sm md:text-base"
                      />
                      <button onClick={handleUpdateUser} className="bg-blue-600 text-white px-5 rounded-2xl hover:bg-blue-500 transition-all active:scale-95 shadow-lg">
                        <Check size={20} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 md:p-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-[2.2rem] border border-zinc-100 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 block">AI Vibe Connection</label>
                      <div className={`w-3 h-3 rounded-full ${apiStatus === 'connected' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-rose-500 animate-pulse'}`} />
                    </div>
                    <button onClick={handleSelectApiKey} className="w-full flex items-center justify-center gap-3 bg-zinc-900 dark:bg-white text-white dark:text-black py-4 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-[0.1em] shadow-xl hover:scale-[1.02] transition-all">
                      <RefreshCw size={14} className={apiStatus === 'checking' ? 'animate-spin' : ''} />
                      Reconnect AI Project
                    </button>
                    <p className={`text-[9px] font-black uppercase tracking-[0.1em] text-center ${apiStatus === 'error' ? 'text-rose-500' : 'text-zinc-400'}`}>
                      Connection status: {apiStatus.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <label className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 px-1">Essence (Personality)</label>
                <div className="grid grid-cols-2 gap-3 md:gap-4 max-h-[35vh] md:max-h-none overflow-y-auto custom-scrollbar">
                  {Object.values(PERSONALITIES).map(p => (
                    <button key={p.id} onClick={() => { setSettings({...settings, personalityId: p.id, voiceName: p.voiceName}); showToast(`${p.name} loaded! ✨`, "success"); }} className={`flex items-center gap-3 md:gap-4 p-4 md:p-5 rounded-[2rem] border-2 transition-all shadow-sm ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-[1.03]' : 'bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}>
                      <span className="text-xl md:text-2xl">{p.emoji}</span>
                      <p className="font-black text-[10px] md:text-xs uppercase tracking-tight leading-none text-left truncate">{p.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <button onClick={handleLogOut} className="w-full py-5 md:py-6 text-[11px] md:text-[12px] text-rose-500 font-black uppercase tracking-[0.4em] hover:bg-rose-500/10 rounded-3xl transition-all border-2 border-rose-500/20">Log Out</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
