
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Part, Content } from '@google/genai';
import { 
  Send, Mic, Image as ImageIcon, Settings, X, MoreVertical, 
  Copy, ThumbsUp, ThumbsDown, User as UserIcon, Activity, Moon, Sun, 
  ChevronRight, Lock, Mail, CheckCircle2, Menu, Plus, Trash2, MessageSquare, History, FileText, Paperclip,
  Waves, Headset, Volume2, LogIn, UserPlus, Bell, ArrowRight, ArrowLeft, Camera, Check
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES, PERSONALITY_REACH_OUTS } from './constants';
import { Personality, PersonalityId, Message, AppSettings, User, Theme, ChatSession } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';

const API_KEY = process.env.API_KEY || '';

// --- Components ---

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900/90 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="flex items-center justify-between p-7 border-b border-white/5">
          <h2 className="text-2xl font-extrabold tracking-tight text-white">{title}</h2>
          <button onClick={onClose} className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-7 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

const TypingIndicator = () => (
  <div className="flex justify-start items-end gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div className="glass rounded-2xl px-6 py-4 flex gap-1.5 items-center">
      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-typing-dot [animation-delay:-0.32s]" />
      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-typing-dot [animation-delay:-0.16s]" />
      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-typing-dot" />
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_user'));
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('mr_vibe_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [tempUser, setTempUser] = useState<Partial<User>>({
    userName: '',
    avatarUrl: AVATARS[0],
    email: '',
    gender: 'Other',
    age: '18'
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mr_vibe_settings');
    return saved ? JSON.parse(saved) : { 
      language: 'English', 
      theme: 'dark', 
      personalityId: PersonalityId.FUNNY,
      voiceName: 'Puck'
    };
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('mr_vibe_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem('mr_vibe_active_session_id');
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [file, setFile] = useState<{data: string, mimeType: string} | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<{text: string, isModel: boolean}[]>([]);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastInteractionRef = useRef<number>(Date.now());

  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const currentPersonality = PERSONALITIES[activeSession?.personalityId || settings.personalityId];

  useEffect(() => {
    localStorage.setItem('mr_vibe_settings', JSON.stringify(settings));
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings]);

  useEffect(() => {
    if (user) localStorage.setItem('mr_vibe_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('mr_vibe_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) localStorage.setItem('mr_vibe_active_session_id', activeSessionId);
    else localStorage.removeItem('mr_vibe_active_session_id');
  }, [activeSessionId]);

  // Inactivity Logic
  useEffect(() => {
    const checkInactivity = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastInteractionRef.current;
      
      if (idleTime > 120000 && notificationStatus === 'granted' && user) {
        const reachOut = PERSONALITY_REACH_OUTS[currentPersonality.id];
        new Notification("Mr. Cute wants a vibe check!", {
          body: reachOut,
          icon: user.avatarUrl
        });
        lastInteractionRef.current = now;
      }
    }, 60000);

    return () => clearInterval(checkInactivity);
  }, [user, currentPersonality, notificationStatus]);

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);
  };

  const updateInteraction = () => {
    lastInteractionRef.current = Date.now();
  };

  const { connect: connectLive, disconnect: disconnectLive, isLive, isConnecting, volume } = useGeminiLive({
    apiKey: API_KEY,
    personality: currentPersonality,
    settings,
    user: user || { userName: 'Friend', email: '', age: '', gender: 'Other', avatarUrl: AVATARS[0] },
    onTranscript: (text, isModel) => {
        setLiveTranscript(prev => [...prev.slice(-4), { text, isModel }]);
    },
    onConnectionStateChange: (connected) => {
        if (!connected) setLiveTranscript([]);
    }
  });

  useEffect(() => {
    const scrollTimeout = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
    return () => clearTimeout(scrollTimeout);
  }, [messages, isLoading]);

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Vibe Session',
      messages: [],
      lastTimestamp: Date.now(),
      personalityId: settings.personalityId
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setIsSidebarOpen(false);
    setTimeout(() => handleSendToAI("Hi", true, newId), 100);
  };

  const handleClearHistory = () => {
    if (confirm("Reset Mr. Vibe AI? This wipes everything. 🌪️")) {
      setSessions([]);
      setActiveSessionId(null);
      setIsSidebarOpen(false);
    }
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const handleLogOut = () => {
    if (confirm("Log out of Mr. Vibe AI?")) {
      localStorage.removeItem('mr_vibe_user');
      localStorage.removeItem('mr_vibe_sessions');
      localStorage.removeItem('mr_vibe_active_session_id');
      setUser(null);
      setIsNewUser(true);
      setOnboardingStep(1);
      setAuthMode('signup');
    }
  };

  const handleSendToAI = async (text: string, isGreeting = false, targetSessionId?: string) => {
    updateInteraction();
    const sessionId = targetSessionId || activeSessionId;
    if (!sessionId) { handleNewChat(); return; }
    if ((!text.trim() && !file) || (isLoading && !isGreeting)) return;
    
    if (!isGreeting) {
       setSessions(prev => prev.map(s => s.id === sessionId ? {
         ...s,
         title: s.messages.length === 1 ? text.slice(0, 30) + (text.length > 30 ? '...' : '') : s.title,
         messages: [...s.messages, {
           id: Date.now().toString(), role: 'user', text,
           image: file ? `data:${file.mimeType};base64,${file.data}` : undefined,
           timestamp: Date.now()
         }],
         lastTimestamp: Date.now()
       } : s));
    }

    setIsLoading(true);
    setInputText('');
    const tempFile = file;
    setFile(null);

    try {
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}\n- Personality: ${currentPersonality.name}\n- User: ${user?.userName}`;

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text }, ...(tempFile ? [{ inlineData: { mimeType: tempFile.mimeType, data: tempFile.data } }] : [])] }],
          config: { systemInstruction: fullSystemPrompt }
      });

      setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: [...s.messages, {
            id: Date.now().toString(), role: 'model', text: response.text || '...', timestamp: Date.now()
          }]
      } : s));
    } catch (error) {
       setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: [...s.messages, { id: Date.now().toString(), role: 'model', text: "Ouch! My brain glitched. Try again? ⚡", timestamp: Date.now() }]
       } : s));
    } finally { setIsLoading(false); }
  };

  const handleCompleteOnboarding = () => {
    if (!tempUser.userName?.trim()) {
        alert("Enter your name so I know what to call you! ✨");
        return;
    }
    const finalUser = {
        ...tempUser,
        email: tempUser.email || 'vibe@user.com',
        age: tempUser.age || '18',
        gender: tempUser.gender || 'Other',
        avatarUrl: tempUser.avatarUrl || AVATARS[0]
    } as User;
    setUser(finalUser);
    setIsNewUser(false);
    requestNotifications();
  };

  if (isNewUser) {
    return (
        <div className="fixed inset-0 z-[200] bg-[#030303] flex items-center justify-center p-6 overflow-y-auto">
            <div className="w-full max-w-lg bg-zinc-900/40 border border-white/10 p-8 sm:p-12 rounded-[3.5rem] backdrop-blur-3xl shadow-2xl animate-in zoom-in-95 duration-500">
                
                {onboardingStep === 1 ? (
                    <div className="text-center animate-in slide-in-from-left-4 duration-500">
                        <div className="w-20 h-20 bg-blue-600 rounded-[1.5rem] mx-auto shadow-2xl shadow-blue-500/20 flex items-center justify-center animate-float mb-10">
                            {authMode === 'signup' ? <UserPlus size={40} className="text-white" /> : <LogIn size={40} className="text-white" />}
                        </div>
                        
                        <h1 className="text-4xl font-extrabold tracking-tighter mb-3">
                            {authMode === 'signup' ? "Join Mr. Vibe AI" : "Welcome Back"}
                        </h1>
                        <p className="text-zinc-500 text-sm mb-10 leading-relaxed">
                            {authMode === 'signup' ? "Create an account to start your vibe journey." : "Sign in to pick up where you left off."}
                        </p>

                        <div className="space-y-4 text-left">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Email Address</label>
                                <div className="glass flex items-center rounded-2xl px-5 border-white/5 focus-within:border-blue-500 transition-all">
                                    <Mail size={18} className="text-zinc-600 mr-3" />
                                    <input 
                                        type="email" placeholder="you@vibe.com" 
                                        value={tempUser.email}
                                        onChange={e => setTempUser({...tempUser, email: e.target.value})}
                                        className="w-full bg-transparent border-none py-5 text-sm font-medium outline-none" 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Secure Password</label>
                                <div className="glass flex items-center rounded-2xl px-5 border-white/5 focus-within:border-blue-500 transition-all">
                                    <Lock size={18} className="text-zinc-600 mr-3" />
                                    <input type="password" placeholder="••••••••" className="w-full bg-transparent border-none py-5 text-sm font-medium outline-none" />
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => {
                                if (authMode === 'signup') setOnboardingStep(2);
                                else handleCompleteOnboarding(); // Simple login bypass
                            }}
                            className="w-full bg-white text-black py-5 rounded-[1.5rem] font-bold text-lg mt-10 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-3"
                        >
                            {authMode === 'signup' ? "Continue to Profile" : "Log In"}
                            <ArrowRight size={20} />
                        </button>

                        <div className="mt-10 pt-8 border-t border-white/5">
                            <button 
                                onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
                                className="text-sm font-bold text-zinc-400 hover:text-white transition-colors"
                            >
                                {authMode === 'signup' ? "Already a member? Log In" : "New here? Create Account"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in slide-in-from-right-4 duration-500">
                        <button onClick={() => setOnboardingStep(1)} className="mb-6 flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors">
                            <ArrowLeft size={14} /> Back
                        </button>

                        <h2 className="text-3xl font-extrabold tracking-tighter text-center mb-8">Personalize Your Vibe</h2>
                        
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 text-center block">Pick Your Avatar</label>
                                <div className="grid grid-cols-4 gap-4 p-2">
                                    {AVATARS.map((url, i) => (
                                        <button 
                                            key={i} onClick={() => setTempUser({...tempUser, avatarUrl: url})} 
                                            className={`relative group rounded-3xl overflow-hidden transition-all duration-300 ${tempUser.avatarUrl === url ? 'scale-110 shadow-2xl shadow-blue-500/40 ring-4 ring-blue-500' : 'opacity-40 hover:opacity-100 hover:scale-105'}`}
                                        >
                                            <img src={url} className="w-full aspect-square bg-zinc-800" />
                                            {tempUser.avatarUrl === url && (
                                                <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-1 animate-in zoom-in">
                                                    <Check size={10} className="text-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">What should I call you?</label>
                                <div className="glass flex items-center rounded-2xl px-5 border-white/5 focus-within:border-blue-500 transition-all">
                                    <UserIcon size={18} className="text-zinc-600 mr-3" />
                                    <input 
                                        type="text" placeholder="Display Name" 
                                        value={tempUser.userName}
                                        onChange={e => setTempUser({...tempUser, userName: e.target.value})}
                                        className="w-full bg-transparent border-none py-5 text-sm font-medium outline-none" 
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleCompleteOnboarding}
                                className="w-full bg-blue-600 text-white py-5 rounded-[1.5rem] font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3"
                            >
                                Get Started
                                <CheckCircle2 size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen font-sans overflow-hidden transition-colors ${settings.theme === 'dark' ? 'text-white' : 'text-zinc-900'}`} onMouseMove={updateInteraction} onKeyDown={updateInteraction}>
      
      {/* Voice Mode Overlay */}
      {(isLive || isConnecting) && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
            <div className="absolute top-8 right-8">
                <button onClick={disconnectLive} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-colors"><X size={32} /></button>
            </div>
            
            <div className="relative mb-12">
                <div className={`w-40 h-40 rounded-full glass flex items-center justify-center relative transition-transform duration-300 ${volume > 0.05 ? 'scale-110' : 'scale-100'}`}>
                    <img src={user?.avatarUrl} className="w-32 h-32 rounded-full border-4 border-blue-500/30" />
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-pulse-slow opacity-20" />
                </div>
                {/* Wave Visualizer */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 h-12">
                    {[1,2,3,4,5,6,7,8].map(i => (
                        <div key={i} className="w-1.5 bg-blue-500 rounded-full transition-all duration-75" style={{ height: `${Math.max(10, volume * 300 * (Math.random() * 0.5 + 0.5))}px` }} />
                    ))}
                </div>
            </div>

            <div className="text-center max-w-md space-y-6">
                <h2 className="text-3xl font-extrabold tracking-tight">
                    {isConnecting ? "Connecting to Mr. Cute..." : `Talking to ${currentPersonality.name}`}
                </h2>
                <div className="space-y-3 min-h-[100px]">
                    {liveTranscript.map((t, i) => (
                        <div key={i} className={`text-sm font-medium animate-in slide-in-from-bottom-2 ${t.isModel ? 'text-blue-400' : 'text-zinc-400'}`}>
                            {t.isModel ? "Mr. Cute: " : "You: "} {t.text}
                        </div>
                    ))}
                    {liveTranscript.length === 0 && !isConnecting && (
                        <p className="text-zinc-500 italic animate-pulse">Say "Hi" or ask a question...</p>
                    )}
                </div>
            </div>

            <div className="mt-auto flex items-center gap-4 text-zinc-500 text-xs font-bold uppercase tracking-widest">
                <Volume2 size={16} /> <span>Live Voice Active</span>
            </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-0 z-[120] ${isSidebarOpen ? 'visible' : 'invisible'}`}>
        <div className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-500 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsSidebarOpen(false)} />
        <div className={`absolute top-0 bottom-0 left-0 w-80 glass border-r border-white/5 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-2xl font-black italic tracking-tighter">HISTORY</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X size={24} /></button>
            </div>
            
            <div className="p-6">
              <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/20 active:scale-95">
                <Plus size={20} /> Start New Vibe
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 custom-scrollbar">
              {sessions.map(s => (
                <div 
                  key={s.id} onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }}
                  className={`group relative p-5 rounded-2xl cursor-pointer transition-all border ${activeSessionId === s.id ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest">{PERSONALITIES[s.personalityId]?.name}</span>
                    <span className="font-bold text-sm truncate text-white/90">{s.title}</span>
                  </div>
                  <button onClick={(e) => handleDeleteSession(s.id, e)} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-white/5">
               <button onClick={handleClearHistory} className="w-full text-zinc-500 hover:text-red-400 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">
                 <Trash2 size={14} /> Wipe Memory
               </button>
            </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto w-full flex flex-col h-full glass sm:rounded-[3rem] sm:my-4 overflow-hidden border-white/10 relative">
        {/* Header */}
        <header className="px-6 py-5 border-b border-white/5 flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"><Menu size={20} /></button>
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setIsProfileModalOpen(true)}>
                    <div className="relative">
                        <img src={user?.avatarUrl} className="w-10 h-10 rounded-2xl border border-white/20 p-0.5 group-hover:border-blue-500 transition-all" />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-[#0a0a0a] rounded-full" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black tracking-tight">MR. CUTE</h1>
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">{currentPersonality.name}</p>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {notificationStatus !== 'granted' && (
                  <button onClick={requestNotifications} className="p-3 bg-white/5 hover:bg-white/10 text-orange-400 rounded-2xl transition-all"><Bell size={20} /></button>
                )}
                <button onClick={connectLive} className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"><Mic size={20} /></button>
                <button onClick={() => setIsSettingsModalOpen(true)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"><Settings size={20} /></button>
            </div>
        </header>

        {/* Chat */}
        <main className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar relative">
            {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center space-y-8 text-center animate-in fade-in zoom-in duration-1000">
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500 rounded-full animate-aura-pulse blur-2xl" />
                      <div className="w-24 h-24 glass rounded-[2rem] flex items-center justify-center relative z-10 animate-float shadow-2xl shadow-blue-500/20">
                          <Waves className="text-blue-500" size={40} />
                      </div>
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-3xl font-black tracking-tighter">Ready to vibe?</h2>
                        <p className="text-zinc-400 text-sm max-w-xs mx-auto leading-relaxed">I'm <span className="text-white font-bold">Mr. Cute</span>. Ask me anything, or let me Roast you for a bit. 🔥</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="px-4 py-2 glass rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-500">Fast</div>
                      <div className="px-4 py-2 glass rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-500">Smart</div>
                      <div className="px-4 py-2 glass rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-500">Vibey</div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-8">
                    {messages.map((msg, index) => {
                        const isFirstModelMsg = index === 1 && msg.role === 'model';
                        return (
                          <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] sm:max-w-[75%] rounded-[2rem] p-6 shadow-xl relative overflow-hidden ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none shadow-blue-500/10 message-enter-user' : 'glass text-white rounded-bl-none message-enter-model'} ${isFirstModelMsg ? 'shimmer-effect ring-2 ring-blue-500/20 shadow-blue-500/20' : ''}`}>
                                  {isFirstModelMsg && <div className="absolute inset-0 pointer-events-none shimmer-effect opacity-30" />}
                                  {msg.image && (
                                      msg.image.startsWith('data:application/pdf') ? (
                                          <div className="flex items-center gap-4 p-4 bg-black/40 rounded-2xl mb-3 border border-white/5">
                                              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center text-red-400"><FileText size={24}/></div>
                                              <div className="flex-1 overflow-hidden"><p className="text-xs font-black truncate">DOCUMENT.PDF</p></div>
                                          </div>
                                      ) : <img src={msg.image} className="rounded-2xl mb-4 max-h-80 w-full object-cover shadow-2xl border border-white/10" />
                                  )}
                                  <p className="text-[15px] font-medium leading-relaxed whitespace-pre-wrap relative z-10">{msg.text}</p>
                                  <div className="mt-3 text-[10px] font-black opacity-30 uppercase tracking-widest flex items-center gap-1.5 relative z-10">
                                    {msg.role === 'model' ? currentPersonality.name : 'You'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                              </div>
                          </div>
                        );
                    })}
                    {isLoading && <TypingIndicator />}
                </div>
            )}
            <div ref={bottomRef} className="h-10 w-full" />
        </main>

        {/* Footer Input */}
        <footer className="p-6 border-t border-white/5 backdrop-blur-3xl bg-black/20">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if(f) { const r = new FileReader(); r.onloadend = () => setFile({data: (r.result as string).split(',')[1], mimeType: f.type}); r.readAsDataURL(f); }
                }} />
                <button onClick={() => fileInputRef.current?.click()} className="p-4 glass hover:bg-white/10 text-zinc-400 rounded-2xl transition-all active:scale-95"><Paperclip size={20}/></button>
                <div className="flex-1 glass flex items-center rounded-2xl px-5 border-white/5 focus-within:border-blue-500 transition-all">
                    <input 
                        type="text" placeholder="Type a message..." value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)}
                        className="w-full bg-transparent border-none py-4 text-sm font-medium outline-none"
                    />
                    {file && (
                        <div className="bg-blue-600 text-[9px] font-black px-3 py-1.5 rounded-xl flex items-center gap-2 animate-in zoom-in">
                            {file.mimeType.includes('pdf') ? 'PDF' : 'IMG'}
                            <button onClick={() => setFile(null)}><X size={10}/></button>
                        </div>
                    )}
                </div>
                <button 
                    onClick={() => handleSendToAI(inputText)} 
                    disabled={!inputText.trim() && !file}
                    className="p-4 bg-white text-black rounded-2xl shadow-2xl hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50"
                >
                    <Send size={20} />
                </button>
            </div>
        </footer>
      </div>

      {/* Modals */}
      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="PROFILE">
          <div className="space-y-8">
              <div className="flex flex-col items-center gap-6">
                <div className="grid grid-cols-4 gap-3">
                    {AVATARS.map(url => (
                        <button key={url} onClick={() => setUser({...user!, avatarUrl: url})} className={`rounded-2xl overflow-hidden border-2 p-0.5 transition-all ${user?.avatarUrl === url ? 'border-blue-500 scale-110' : 'border-transparent opacity-50'}`}>
                            <img src={url} className="w-14 h-14" />
                        </button>
                    ))}
                </div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Update Your Identity</p>
              </div>
              <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Display Name</label>
                    <input type="text" value={user?.userName} onChange={e => setUser({...user!, userName: e.target.value})} className="w-full glass border-none rounded-2xl py-4 px-5 outline-none font-bold" />
                  </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <button onClick={() => setIsProfileModalOpen(false)} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Save Changes</button>
                <button 
                  onClick={handleLogOut}
                  className="w-full text-red-500 text-xs font-black uppercase tracking-widest py-4 border border-red-500/20 rounded-2xl hover:bg-red-500/10 transition-all"
                >
                  Log Out
                </button>
              </div>
          </div>
      </Modal>

      <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="VIBE SETTINGS">
          <div className="space-y-8">
              <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">AI Personality</label>
                  <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                      {Object.values(PERSONALITIES).map(p => (
                          <button key={p.id} onClick={() => setSettings({...settings, personalityId: p.id})} className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/20' : 'glass border-white/5 hover:bg-white/5'}`}>
                              <span className="text-xl">{p.emoji}</span>
                              <span className="text-[11px] font-black uppercase tracking-tighter leading-none">{p.name}</span>
                          </button>
                      ))}
                  </div>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Voice Configuration</label>
                <select value={settings.voiceName} onChange={e => setSettings({...settings, voiceName: e.target.value})} className="w-full glass border-none rounded-2xl py-4 px-5 outline-none font-bold appearance-none">
                    {GEMINI_VOICES.map(v => <option key={v.id} value={v.id} className="bg-zinc-900">{v.name}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between p-6 glass rounded-[2rem] border-white/5">
                <div className="flex items-center gap-4">
                    {settings.theme === 'dark' ? <Moon size={22} className="text-blue-400" /> : <Sun size={22} className="text-orange-400" />}
                    <span className="font-bold text-sm tracking-tight">Dark Mode</span>
                </div>
                <button onClick={() => setSettings({...settings, theme: settings.theme === 'dark' ? 'light' : 'dark'})} className={`w-14 h-8 rounded-full relative transition-all duration-500 ${settings.theme === 'dark' ? 'bg-blue-600' : 'bg-zinc-700'}`}>
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-500 ${settings.theme === 'dark' ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
          </div>
      </Modal>
    </div>
  );
}
