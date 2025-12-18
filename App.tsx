
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Waves, Volume2, LogIn, UserPlus, ArrowRight, ArrowLeft, 
  User as UserIcon, CheckCircle2, Mail, Lock, Sparkles, 
  ChevronRight, MicOff, MessageSquare, AlertCircle, AlertTriangle, RefreshCw,
  Camera, FileText, Upload, Loader2, Play, Image as ImageIcon, Globe,
  Leaf, Droplets, Share2, ThumbsUp, ThumbsDown, Edit3, Check, Zap, ExternalLink, Activity, Bell, Music, Film, Heart, GraduationCap, Users, Copy, Share, LogOut
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES, DISCOVERY_DATA } from './constants';
import { PersonalityId, AppSettings, User, ChatSession, Message, ReactionType, GroundingSource, ApiStatus, Gender } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';
import { decode, decodeAudioData } from './utils/audioUtils';

// --- Utility Components ---

const validateEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
  <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[1000] animate-vibe-in">
    <div className={`px-6 py-4 rounded-[2rem] shadow-2xl backdrop-blur-3xl border flex items-center gap-3 font-bold text-sm uppercase tracking-widest ${
      type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' :
      type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400' :
      'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400'
    }`}>
      {type === 'success' ? <Check size={18} /> : type === 'error' ? <AlertCircle size={18} /> : <Bell size={18} />}
      {message}
      <button onClick={onClose} className="ml-2 hover:opacity-50"><X size={18}/></button>
    </div>
  </div>
);

const TypingIndicator = ({ personality }: { personality: any }) => (
  <div className="flex justify-start w-full animate-vibe-in">
    <div className="flex items-end gap-2 max-w-[80%]">
      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-lg shrink-0 overflow-hidden shadow-sm">
        <span className="animate-pulse">{personality.emoji}</span>
      </div>
      <div className="bg-white/80 dark:bg-zinc-800/40 backdrop-blur-md rounded-[1.5rem] rounded-bl-none px-4 py-3 shadow-sm border border-black/5 dark:border-white/5 flex gap-1.5 items-center">
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
    setTimeout(() => setToast(null), 3000);
  };

  async function checkApiConnection() {
    if (!process.env.API_KEY) {
      setApiStatus('error');
      addNotification("API Key Missing. Please select a key in Profile.", "error");
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
        addNotification("API Connected successfully! ✨", "success");
        return true; 
      }
      throw new Error("Invalid response received from the Vibe server.");
    } catch (error: any) {
      const errorMsg = error.message || "Unknown Vibe Error";
      let userFriendlyMsg = "Vibe Connection Failed. Check your network or API key.";
      
      if (errorMsg.includes("403") || errorMsg.includes("API_KEY_INVALID")) {
        userFriendlyMsg = "Invalid API Key. Please select a valid key in Config.";
      } else if (errorMsg.includes("429") || errorMsg.includes("Quota")) {
        userFriendlyMsg = "Vibe Limit Reached. Take a break and try later!";
      } else if (errorMsg.includes("Failed to fetch") || errorMsg.includes("network")) {
        userFriendlyMsg = "Network Vibe Lost. Check your internet connection.";
      }

      setApiStatus('error');
      showToast(userFriendlyMsg, "error");
      return false;
    }
  }

  const handleSelectApiKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      showToast("Waiting for Vibe Key selection...", "info");
      // Give a moment for the injection to occur
      setTimeout(checkApiConnection, 1500);
    } else {
      showToast("API selection not available. Use environment variables.", "error");
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
    if (confirm("End this vibe session?")) {
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) setActiveSessionId(null);
      showToast("Vibe Deleted", "error");
    }
  };

  const handleLogOut = () => { 
    if (confirm("Are you sure you want to log out of Mr. Vibe AI?")) { 
      setUser(null); 
      setActiveSessionId(null); 
      setIsNewUser(true); 
      setOnboardingStep(1); 
      localStorage.removeItem('mr_vibe_active_user'); 
      showToast("Logged out of Mr. Cute. Catch you later! 👋", "info"); 
    } 
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Vibe Copied!", "success");
  };

  const handleShare = (text: string) => {
    if (navigator.share) {
      navigator.share({ title: 'A vibe from Mr. Cute', text }).catch(() => handleCopy(text));
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
      if (!isOk) return; // checkApiConnection handles the error toast
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
      const msg = e.message || "";
      if (msg.includes("429")) showToast("Whoa, too fast! Vibe limit reached. 🛑", "error");
      else showToast("Vibe interrupted. Check connection! ⚡", "error");
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
    showToast("Profile identity updated! ✨", "success");
  };

  useEffect(() => { localStorage.setItem('mr_vibe_settings', JSON.stringify(settings)); document.documentElement.classList.toggle('dark', settings.theme === 'dark'); }, [settings]);
  useEffect(() => { if (user) { localStorage.setItem('mr_vibe_active_user', JSON.stringify(user)); setIsNewUser(false); if (sessions.length === 0) handleNewChat(); } }, [user]);
  useEffect(() => { localStorage.setItem('mr_vibe_sessions', JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { if (activeSessionId) localStorage.setItem('mr_vibe_active_session_id', activeSessionId); }, [activeSessionId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, liveTranscript, isLoading]);

  if (isNewUser) {
    const DiscoveryStep = ({ title, options, current, onSelect, multi = false, onNext }: any) => (
      <div className="space-y-8 animate-slide-in-right">
        <button onClick={() => setOnboardingStep(onboardingStep - 1)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500"><ArrowLeft size={16} /> Back</button>
        <h2 className="text-3xl font-black italic text-zinc-900 dark:text-white tracking-tighter">{title}</h2>
        <div className="grid grid-cols-2 gap-3 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
          {options.map((opt: any) => {
            const optId = opt.id || opt;
            const isSelected = multi ? (current as string[]).includes(optId) : current === optId;
            return (
              <button 
                key={optId} 
                onClick={() => onSelect(optId)} 
                className={`p-5 rounded-[2rem] border-2 transition-all text-center shadow-sm ${isSelected ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-[1.05]' : 'bg-zinc-100 dark:bg-zinc-800/40 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white'}`}
              >
                {opt.emoji && <span className="text-3xl block mb-1">{opt.emoji}</span>}
                <p className="font-black text-xs uppercase">{opt.label || opt}</p>
              </button>
            );
          })}
        </div>
        <button onClick={onNext} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">Next <ArrowRight size={20}/></button>
      </div>
    );

    return (
      <div className="fixed inset-0 z-[200] bg-zinc-50 dark:bg-[#030303] flex items-center justify-center p-4 overflow-y-auto transition-colors duration-500">
        <div className="w-full max-w-lg bg-white/95 dark:bg-zinc-900/70 border border-zinc-200 dark:border-white/10 p-10 rounded-[3rem] backdrop-blur-3xl shadow-3xl animate-scale-in text-center">
          {onboardingStep === 1 ? (
            <div className="space-y-10 animate-slide-up">
              <Logo className="w-24 h-24 mx-auto" animated />
              <div className="space-y-3">
                <h1 className="text-4xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase leading-none">Mr. Vibe AI</h1>
                <p className="text-zinc-500 font-medium">Meet Mr. Cute. Born to Vibe.</p>
              </div>
              <div className="space-y-4 text-left">
                <div className="relative">
                  <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input type="email" placeholder="Email Address" value={credentials.email} onChange={e => setCredentials({...credentials, email: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 pl-16 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input type="password" placeholder="Password" value={credentials.password} onChange={e => setCredentials({...credentials, password: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 pl-16 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white" />
                </div>
              </div>
              <button onClick={() => { if (!validateEmail(credentials.email)) { showToast("Enter a valid email! 📧", "error"); return; } setOnboardingStep(2); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Start Vibe Check</button>
            </div>
          ) : onboardingStep === 2 ? (
            <div className="space-y-10 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(1)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-3xl font-black italic text-zinc-900 dark:text-white tracking-tighter">Choose Visual</h2>
              <div className="flex justify-center gap-4">
                {AVATARS.map((url) => (
                  <button key={url} onClick={() => setTempProfile({...tempProfile, avatarUrl: url})} className={`w-16 h-16 md:w-20 md:h-20 rounded-[2rem] overflow-hidden transition-all shadow-lg ${tempProfile.avatarUrl === url ? 'ring-4 ring-blue-500 scale-110' : 'opacity-40 hover:opacity-100'}`}>
                    <img src={url} className="w-full h-full" alt="Avatar Choice" />
                  </button>
                ))}
              </div>
              <input type="text" placeholder="What's your name?" value={tempProfile.userName} onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 px-8 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-center" />
              <button onClick={() => { if (!tempProfile.userName?.trim()) { showToast("Tell me your name! ✨", "error"); return; } setOnboardingStep(4); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Next</button>
            </div>
          ) : onboardingStep === 4 ? (
            <div className="space-y-10 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(2)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-3xl font-black italic text-zinc-900 dark:text-white tracking-tighter text-center">Select Essence</h2>
              <div className="grid grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {Object.values(PERSONALITIES).map(p => (
                  <button key={p.id} onClick={() => { setTempProfile({...tempProfile, personalityId: p.id}); setSettings(prev => ({ ...prev, personalityId: p.id, voiceName: p.voiceName })); }} className={`p-4 rounded-[1.5rem] border-2 transition-all text-left ${tempProfile.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-[1.02]' : 'bg-zinc-100 dark:bg-zinc-800/40 border-transparent text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}>
                    <span className="text-2xl">{p.emoji}</span><p className="font-black text-[10px] mt-1 uppercase leading-none">{p.name}</p>
                  </button>
                ))}
              </div>
              <button onClick={() => setOnboardingStep(5)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Next</button>
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
              <button onClick={() => setOnboardingStep(9)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest hover:text-blue-500"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-3xl font-black italic text-zinc-900 dark:text-white tracking-tighter text-center">Final Detail</h2>
              <div className="space-y-4">
                <p className="text-zinc-500 font-bold text-sm uppercase tracking-widest">How old are you?</p>
                <input type="number" value={tempProfile.age} onChange={e => setTempProfile({...tempProfile, age: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 px-8 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-5xl text-center" />
              </div>
              <button onClick={() => setUser(tempProfile as User)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Complete Discovery</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full font-sans overflow-hidden bg-zinc-50 dark:bg-[#050505] transition-colors duration-500">
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}
      
      {(isLive || isConnecting) && (
        <div className="fixed inset-0 z-[500] bg-white dark:bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-between p-8 animate-fade-in transition-colors duration-500">
          <div className="w-full flex justify-end">
            <button onClick={disconnectLive} className="p-4 bg-zinc-900/10 dark:bg-white/10 hover:bg-rose-500 text-zinc-900 dark:text-white hover:text-white rounded-full transition-all">
              <X size={24}/>
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-10 text-center">
            <FluidOrb volume={volume} active={isLive} />
            <div className="space-y-4">
              <h2 className="text-4xl md:text-6xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase leading-none">
                {isConnecting ? "Tuning In..." : currentPersonality.name}
              </h2>
              <p className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest text-xs animate-pulse">
                {isLive ? "Live Voice Stream Active" : "Initializing Vibe..."}
              </p>
            </div>
            <div className="max-w-2xl px-6">
              {liveTranscript.slice(-2).map((t, i) => (
                <p key={i} className={`text-xl md:text-2xl font-black italic leading-tight mb-4 ${t.isModel ? 'text-zinc-900 dark:text-white opacity-100' : 'text-zinc-400 dark:text-zinc-500 opacity-60'}`}>
                  {t.text}
                </p>
              ))}
            </div>
          </div>
          <button onClick={disconnectLive} className="px-12 py-6 bg-rose-600 text-white rounded-[2.5rem] font-black shadow-3xl hover:bg-rose-500 transition-all active:scale-95 flex items-center gap-3">
            <MicOff size={24} /> Stop Talking
          </button>
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[300] w-80 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/5 transition-transform duration-500 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:relative shadow-2xl md:shadow-none`}>
        <div className="flex flex-col h-full">
          <div className="p-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo className="w-8 h-8" />
              <h2 className="text-2xl font-black italic tracking-tighter uppercase text-zinc-900 dark:text-white leading-none">History</h2>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-900 dark:text-white p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-md">
              <X size={24}/>
            </button>
          </div>
          <div className="px-8 pb-6">
            <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-4 rounded-xl font-black shadow-xl hover:bg-blue-500 transition-all active:scale-95">
              <Plus size={18} /> New Vibe
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 space-y-3 custom-scrollbar">
            {sessions.map(s => (
              <div key={s.id} className="group relative">
                <div onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }} className={`p-4 pr-14 rounded-[1.8rem] cursor-pointer transition-all border ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-500/30 shadow-md ring-1 ring-blue-500/10' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/40 border-transparent'}`}>
                  <div className="flex items-center gap-3">
                    <MessageSquare size={16} className={activeSessionId === s.id ? 'text-blue-500' : 'text-zinc-500'} />
                    <p className={`font-bold text-xs truncate ${activeSessionId === s.id ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                      {s.title}
                    </p>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-all shadow-md md:opacity-0 group-hover:opacity-100">
                  <Trash2 size={16} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
          <div className="p-8 border-t border-zinc-100 dark:border-white/5 space-y-4">
             <button onClick={() => setSettings(s => ({...s, theme: s.theme === 'dark' ? 'light' : 'dark'}))} className="w-full flex items-center justify-between p-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-black text-[10px] uppercase tracking-widest text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all">
                {settings.theme === 'dark' ? <><Moon size={16} /> Night Mode</> : <><Sun size={16} /> Day Mode</>}
             </button>
             <button onClick={handleLogOut} className="w-full flex items-center gap-3 p-4 bg-rose-500/10 text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">
                <LogOut size={16} /> End Journey
             </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        <header className="px-6 py-4 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-white/40 dark:bg-black/40 backdrop-blur-2xl sticky top-0 z-[100]">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl md:hidden text-zinc-900 dark:text-white shadow-sm hover:text-blue-500 transition-colors"><Menu size={20} /></button>
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setIsProfileModalOpen(true)}>
              <div className="relative">
                <img src={user?.avatarUrl} className="w-11 h-11 rounded-[1.2rem] border-2 border-white dark:border-zinc-800 shadow-lg group-hover:scale-105 transition-transform" alt="Avatar" />
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm ${apiStatus === 'connected' ? 'bg-green-500' : apiStatus === 'checking' ? 'bg-amber-500' : 'bg-rose-500 animate-pulse'}`} />
              </div>
              <div className="hidden xs:block">
                <div className="flex items-center gap-2"><h1 className="text-sm font-black text-zinc-900 dark:text-white leading-none tracking-tight">{user?.userName}</h1></div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">{user?.personalityId} • Age {user?.age}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)} 
                className={`p-3 rounded-2xl transition-all shadow-sm relative ${isNotifOpen ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-blue-500'}`}
                title="Notifications"
              >
                <Bell size={20} />
                {notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-zinc-800" />}
              </button>
              
              {isNotifOpen && (
                <div className="absolute top-full right-0 mt-4 w-72 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-[2rem] shadow-3xl p-6 z-[200] animate-vibe-in overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">Activity</h3>
                    <button onClick={() => setNotifications([])} className="text-[10px] font-black text-rose-500 uppercase hover:underline">Clear</button>
                  </div>
                  <div className="space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                    {notifications.length === 0 ? (
                      <p className="text-[10px] text-zinc-400 font-medium">No recent logs.</p>
                    ) : notifications.map(n => (
                      <div key={n.id} className="flex gap-3 items-start border-b border-zinc-100 dark:border-white/5 pb-3 last:border-0">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === 'error' ? 'bg-rose-500' : n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`} />
                        <div>
                          <p className="text-[11px] font-bold text-zinc-900 dark:text-zinc-200 leading-tight">{n.text}</p>
                          <p className="text-[9px] text-zinc-400 mt-1 uppercase font-black">{new Date(n.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setIsProfileModalOpen(true)} className="px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-black text-[10px] shadow-xl uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2 border border-zinc-200 dark:border-transparent">
              <Activity size={14} className={apiStatus === 'connected' ? 'text-green-500' : apiStatus === 'checking' ? 'text-amber-500' : 'text-rose-500'} />
              {currentPersonality.name}
            </button>
            <button onClick={connectLive} className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all">
              <Mic size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-12 py-10 custom-scrollbar bg-zinc-50 dark:bg-[#050505] relative">
          <div className="max-w-3xl mx-auto flex flex-col gap-12 pb-32">
            {messages.length === 0 && !isLoading ? (
              <div className="min-h-[65vh] flex flex-col items-center justify-center text-center space-y-8 animate-vibe-in">
                <Logo className="w-24 h-24" animated />
                <div className="space-y-3">
                  <h2 className="text-4xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase leading-none">Start Vibe Session</h2>
                  <p className="text-sm font-medium text-zinc-500 max-w-sm mx-auto">Mr. Cute is analyzing your soul... Send a vibe to begin!</p>
                </div>
              </div>
            ) : messages.map((msg, idx) => (
              <div key={msg.id} className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-vibe-in`} style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className={`flex items-end gap-3 max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'model' && (
                    <div className="w-10 h-10 rounded-[1rem] bg-blue-500/10 flex items-center justify-center text-xl shrink-0 overflow-hidden shadow-sm border border-zinc-100 dark:border-white/5">
                      <span>{currentPersonality.emoji}</span>
                    </div>
                  )}
                  <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-6 py-4 rounded-[2.2rem] shadow-xl text-sm md:text-[1rem] leading-relaxed font-bold transition-all relative
                      ${msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none shadow-blue-500/20' 
                        : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-100 dark:border-white/5 rounded-bl-none shadow-zinc-200/50 dark:shadow-black/5'}`}>
                      {msg.image && <div className="mb-4 rounded-2xl overflow-hidden shadow-2xl border border-zinc-100 dark:border-white/10"><img src={msg.image} alt="Snapshot" className="w-full h-auto max-h-[400px] object-cover" /></div>}
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                    
                    {/* Message Actions */}
                    <div className={`flex items-center gap-4 px-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                       <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                       <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <button onClick={() => handleReaction(msg.id, 'like')} title="Like" className={`p-1.5 rounded-full transition-all ${msg.reaction === 'like' ? 'text-blue-500 bg-blue-500/10' : 'text-zinc-400 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                            <ThumbsUp size={14} fill={msg.reaction === 'like' ? 'currentColor' : 'none'} />
                          </button>
                          <button onClick={() => handleCopy(msg.text)} title="Copy" className="p-1.5 rounded-full text-zinc-400 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                            <Copy size={14} />
                          </button>
                          <button onClick={() => handleShare(msg.text)} title="Share" className="p-1.5 rounded-full text-zinc-400 hover:text-blue-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                            <Share size={14} />
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

        <footer className="px-4 py-8 pointer-events-none absolute bottom-0 left-0 right-0 z-[200]">
          <div className="max-w-2xl mx-auto flex items-center gap-3 pointer-events-auto">
            <div className="flex-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl flex items-center rounded-[2.5rem] px-6 py-1 border-2 border-zinc-200 dark:border-white/10 focus-within:border-blue-500 transition-all shadow-2xl">
              <button onClick={() => fileInputRef.current?.click()} className="text-zinc-400 hover:text-blue-500 transition-colors p-2" title="Attach Vibe"><ImageIcon size={22} /></button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => handleSendToAI("", { data: (reader.result as string).split(',')[1], mimeType: file.type, fileName: file.name }); reader.readAsDataURL(file); } }} />
              <input 
                type="text" 
                placeholder="Send a message..." 
                value={inputText} 
                onChange={e => setInputText(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} 
                className="w-full bg-transparent py-5 px-3 font-bold outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500" 
              />
              <button 
                onClick={() => handleSendToAI(inputText)} 
                disabled={!inputText.trim() || isLoading || apiStatus === 'error'} 
                className="ml-2 text-blue-600 disabled:opacity-30 hover:scale-110 active:scale-95 transition-transform"
                title="Send"
              >
                <Send size={26} strokeWidth={2.5}/>
              </button>
            </div>
          </div>
        </footer>
      </div>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-fade-in" onClick={() => setIsProfileModalOpen(false)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-[3rem] p-10 shadow-3xl animate-vibe-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4"><Logo className="w-10 h-10" /><h2 className="text-3xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white leading-none">Vibe Config</h2></div>
              <button onClick={() => setIsProfileModalOpen(false)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-900 dark:text-white hover:bg-rose-500 hover:text-white transition-all"><X size={24} strokeWidth={3} /></button>
            </div>
            
            <div className="space-y-12">
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="relative group">
                  <img src={user?.avatarUrl} className="w-32 h-32 rounded-[2.5rem] shadow-2xl border-4 border-white dark:border-zinc-800 transition-transform group-hover:scale-105" alt="Vibe Visual" />
                  <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-xl shadow-lg border-2 border-white dark:border-zinc-900">
                    <Camera size={16} />
                  </div>
                </div>
                
                <div className="w-full space-y-4 text-left">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 px-2 block">Identity Name</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={editUserName} 
                        onChange={e => setEditUserName(e.target.value)} 
                        className="flex-1 bg-zinc-100 dark:bg-zinc-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-4 px-6 font-bold outline-none text-zinc-900 dark:text-white transition-all"
                      />
                      <button onClick={handleUpdateUser} className="bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                        <Check size={20} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-[2rem] border border-zinc-100 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 px-2 block">Vibe Connection</label>
                      <div className={`w-3 h-3 rounded-full ${apiStatus === 'connected' ? 'bg-green-500' : apiStatus === 'checking' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                    </div>
                    <button onClick={handleSelectApiKey} className="w-full flex items-center justify-center gap-3 bg-zinc-900 dark:bg-white text-white dark:text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                      <RefreshCw size={14} className={apiStatus === 'checking' ? 'animate-spin' : ''} />
                      Refresh Connection Key
                    </button>
                    <p className={`text-[9px] font-black px-2 uppercase tracking-tighter ${apiStatus === 'error' ? 'text-rose-500' : 'text-zinc-400'}`}>
                      Status: {apiStatus.toUpperCase()}
                    </p>
                  </div>
                  
                  <div className="flex justify-center flex-wrap gap-2 pt-2">
                    <span className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-300 border border-zinc-200 dark:border-white/5">{user?.movieGenre} • {user?.musicGenre}</span>
                    <span className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-300 border border-zinc-200 dark:border-white/5">{user?.educationLevel}</span>
                    <span className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-300 border border-zinc-200 dark:border-white/5">Age {user?.age}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 px-2">Vibe Essence</label>
                <div className="grid grid-cols-2 gap-4">
                  {Object.values(PERSONALITIES).map(p => (
                    <button key={p.id} onClick={() => { setSettings({...settings, personalityId: p.id, voiceName: p.voiceName}); showToast(`${p.name} Essence Loaded! ✨`, "success"); }} className={`flex items-center gap-4 p-5 rounded-[2rem] border-2 transition-all shadow-sm ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-105' : 'bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}>
                      <span className="text-2xl">{p.emoji}</span>
                      <p className="font-black text-xs uppercase tracking-tight leading-none">{p.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <button onClick={handleLogOut} className="w-full py-6 text-[12px] text-rose-500 font-black uppercase tracking-[0.4em] hover:bg-rose-500/10 rounded-3xl transition-all border-2 border-rose-500/20 shadow-xl shadow-rose-500/5">End Vibe Journey</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
