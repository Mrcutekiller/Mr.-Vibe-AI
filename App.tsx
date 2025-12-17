
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, FileText, Paperclip,
  Waves, Volume2, LogIn, UserPlus, Bell, ArrowRight, ArrowLeft, Check, User as UserIcon,
  CheckCircle2, Mail, Lock
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES, PERSONALITY_REACH_OUTS } from './constants';
import { Personality, PersonalityId, Message, AppSettings, User, ChatSession } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';

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

  // Inactivity Reach Out
  useEffect(() => {
    const checkInactivity = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastInteractionRef.current;
      
      if (idleTime > 180000 && notificationStatus === 'granted' && user) {
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
      localStorage.clear();
      setUser(null);
      setIsNewUser(true);
      setOnboardingStep(1);
      setAuthMode('signup');
      window.location.reload(); // Force reload to clear all states
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
      // Fix: Use process.env.API_KEY directly in the constructor as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
        alert("Give me a name to call you! ✨");
        return;
    }
    const finalUser = {
        userName: tempUser.userName,
        avatarUrl: tempUser.avatarUrl || AVATARS[0],
        email: tempUser.email || 'friend@vibe.ai',
        age: '18',
        gender: 'Other'
    } as User;
    setUser(finalUser);
    setIsNewUser(false);
    requestNotifications();
  };

  if (isNewUser) {
    return (
        <div className="fixed inset-0 z-[200] bg-[#030303] flex items-center justify-center p-6 overflow-y-auto" onMouseMove={updateInteraction}>
            <div className="w-full max-w-lg bg-zinc-900/40 border border-white/10 p-10 sm:p-14 rounded-[4rem] backdrop-blur-3xl shadow-2xl animate-in zoom-in-95 duration-700">
                
                {onboardingStep === 1 ? (
                    <div className="text-center animate-in slide-in-from-left-6 duration-500">
                        <div className="w-24 h-24 bg-blue-600 rounded-[2rem] mx-auto shadow-2xl shadow-blue-500/20 flex items-center justify-center animate-float mb-12">
                            {authMode === 'signup' ? <UserPlus size={48} className="text-white" /> : <LogIn size={48} className="text-white" />}
                        </div>
                        
                        <h1 className="text-4xl font-extrabold tracking-tighter mb-4">
                            {authMode === 'signup' ? "Join Mr. Vibe AI" : "Welcome Back"}
                        </h1>
                        <p className="text-zinc-500 text-base mb-12 leading-relaxed max-w-xs mx-auto">
                            {authMode === 'signup' ? "Your AI best friend is waiting for you." : "Sign in to catch up with Mr. Cute."}
                        </p>

                        <div className="space-y-4 text-left">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-5">Email Address</label>
                                <div className="glass flex items-center rounded-3xl px-6 border-white/5 focus-within:border-blue-500 transition-all">
                                    <Mail size={20} className="text-zinc-600 mr-4" />
                                    <input 
                                        type="email" placeholder="you@vibe.ai" 
                                        value={tempUser.email}
                                        onChange={e => setTempUser({...tempUser, email: e.target.value})}
                                        className="w-full bg-transparent border-none py-6 text-sm font-semibold outline-none" 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-5">Secure Password</label>
                                <div className="glass flex items-center rounded-3xl px-6 border-white/5 focus-within:border-blue-500 transition-all">
                                    <Lock size={20} className="text-zinc-600 mr-4" />
                                    <input type="password" placeholder="••••••••" className="w-full bg-transparent border-none py-6 text-sm font-semibold outline-none" />
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => {
                                if (authMode === 'signup') setOnboardingStep(2);
                                else handleCompleteOnboarding();
                            }}
                            className="w-full bg-white text-black py-6 rounded-3xl font-black text-lg mt-12 hover:scale-[1.03] active:scale-[0.97] transition-all shadow-2xl flex items-center justify-center gap-3"
                        >
                            {authMode === 'signup' ? "Create Account" : "Log In"}
                            <ArrowRight size={22} />
                        </button>

                        <div className="mt-12 pt-10 border-t border-white/5">
                            <button 
                                onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
                                className="text-sm font-bold text-zinc-400 hover:text-blue-500 transition-colors"
                            >
                                {authMode === 'signup' ? "Already a member? Log In" : "New vibe? Sign up here"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in slide-in-from-right-6 duration-500">
                        <button onClick={() => setOnboardingStep(1)} className="mb-8 flex items-center gap-3 text-zinc-500 hover:text-white text-[11px] font-black uppercase tracking-[0.2em] transition-colors group">
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back
                        </button>

                        <h2 className="text-3xl font-extrabold tracking-tighter text-center mb-10">Step 2: Profile</h2>
                        
                        <div className="space-y-10">
                            <div className="space-y-6">
                                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] text-center block">Pick Your Identity</label>
                                <div className="grid grid-cols-4 gap-5">
                                    {AVATARS.map((url, i) => (
                                        <button 
                                            key={i} onClick={() => setTempUser({...tempUser, avatarUrl: url})} 
                                            className={`relative group rounded-[2rem] overflow-hidden transition-all duration-500 ${tempUser.avatarUrl === url ? 'scale-110 shadow-2xl shadow-blue-500/40 ring-4 ring-blue-500' : 'opacity-30 hover:opacity-100 hover:scale-105'}`}
                                        >
                                            <img src={url} className="w-full aspect-square bg-zinc-800" />
                                            {tempUser.avatarUrl === url && (
                                                <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1 animate-in zoom-in">
                                                    <Check size={12} className="text-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-5">Preferred Display Name</label>
                                <div className="glass flex items-center rounded-3xl px-6 border-white/5 focus-within:border-blue-500 transition-all">
                                    <UserIcon size={20} className="text-zinc-600 mr-4" />
                                    <input 
                                        type="text" placeholder="e.g. Alex" 
                                        value={tempUser.userName}
                                        onChange={e => setTempUser({...tempUser, userName: e.target.value})}
                                        className="w-full bg-transparent border-none py-6 text-sm font-semibold outline-none" 
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleCompleteOnboarding}
                                className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-lg hover:scale-[1.03] active:scale-[0.97] transition-all shadow-2xl shadow-blue-500/20 flex items-center justify-center gap-3"
                            >
                                Finish Setup
                                <CheckCircle2 size={22} />
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
                <div className={`w-48 h-48 rounded-[3rem] glass flex items-center justify-center relative transition-transform duration-300 ${volume > 0.05 ? 'scale-110' : 'scale-100'}`}>
                    <img src={user?.avatarUrl} className="w-40 h-40 rounded-[2.5rem] border-4 border-blue-500/30" />
                    <div className="absolute inset-0 rounded-[3rem] border-4 border-blue-500 animate-pulse-slow opacity-20" />
                </div>
                {/* Wave Visualizer */}
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 h-14">
                    {[1,2,3,4,5,6,7,8,9,10].map(i => (
                        <div key={i} className="w-2 bg-blue-500 rounded-full transition-all duration-75" style={{ height: `${Math.max(12, volume * 400 * (Math.random() * 0.5 + 0.5))}px` }} />
                    ))}
                </div>
            </div>

            <div className="text-center max-w-md space-y-6">
                <h2 className="text-4xl font-black tracking-tighter">
                    {isConnecting ? "Waking up Mr. Cute..." : `Talking to ${currentPersonality.name}`}
                </h2>
                <div className="space-y-4 min-h-[120px]">
                    {liveTranscript.map((t, i) => (
                        <div key={i} className={`text-base font-bold animate-in slide-in-from-bottom-2 duration-300 ${t.isModel ? 'text-blue-400' : 'text-zinc-500'}`}>
                            {t.isModel ? "Mr. Cute: " : "You: "} {t.text}
                        </div>
                    ))}
                    {liveTranscript.length === 0 && !isConnecting && (
                        <p className="text-zinc-600 italic animate-pulse">Speak naturally, I'm listening...</p>
                    )}
                </div>
            </div>

            <div className="mt-auto flex items-center gap-4 text-zinc-600 text-[11px] font-black uppercase tracking-[0.2em]">
                <Volume2 size={18} /> <span>Hifi Voice Active</span>
            </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-0 z-[120] ${isSidebarOpen ? 'visible' : 'invisible'}`}>
        <div className={`absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-500 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsSidebarOpen(false)} />
        <div className={`absolute top-0 bottom-0 left-0 w-80 glass border-r border-white/5 transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-10 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-2xl font-black italic tracking-tighter uppercase">Vibe History</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors"><X size={24} /></button>
            </div>
            
            <div className="p-8">
              <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-3xl font-black transition-all shadow-2xl shadow-blue-500/20 active:scale-95">
                <Plus size={22} /> New Vibe
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-4 custom-scrollbar">
              {sessions.map(s => (
                <div 
                  key={s.id} onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }}
                  className={`group relative p-6 rounded-3xl cursor-pointer transition-all border ${activeSessionId === s.id ? 'bg-white/10 border-white/20' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em]">{PERSONALITIES[s.personalityId]?.name}</span>
                    <span className="font-bold text-sm truncate text-white/90">{s.title}</span>
                  </div>
                  <button onClick={(e) => handleDeleteSession(s.id, e)} className="absolute right-5 top-1/2 -translate-y-1/2 p-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>

            <div className="p-8 border-t border-white/5">
               <button onClick={handleClearHistory} className="w-full text-zinc-600 hover:text-red-500 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-colors">
                 <Trash2 size={16} /> Wipe Memory
               </button>
            </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto w-full flex flex-col h-full glass sm:rounded-[4rem] sm:my-4 overflow-hidden border-white/10 relative">
        {/* Header */}
        <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between z-10">
            <div className="flex items-center gap-6">
                <button onClick={() => setIsSidebarOpen(true)} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"><Menu size={22} /></button>
                <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setIsProfileModalOpen(true)}>
                    <div className="relative">
                        <img src={user?.avatarUrl} className="w-12 h-12 rounded-2xl border border-white/20 p-1 group-hover:border-blue-500 transition-all shadow-lg" />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-black rounded-full" />
                    </div>
                    <div>
                        <h1 className="text-base font-black tracking-tight uppercase">Mr. Cute</h1>
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">{currentPersonality.name}</p>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {notificationStatus !== 'granted' && (
                  <button onClick={requestNotifications} className="p-4 bg-white/5 hover:bg-white/10 text-orange-400 rounded-2xl transition-all animate-pulse"><Bell size={22} /></button>
                )}
                <button onClick={connectLive} className="p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all shadow-2xl shadow-blue-500/30 active:scale-95"><Mic size={22} /></button>
                <button onClick={() => setIsSettingsModalOpen(true)} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"><Settings size={22} /></button>
            </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto px-8 py-10 custom-scrollbar relative">
            {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center space-y-10 text-center animate-in fade-in zoom-in duration-1000">
                    <div className="relative">
                      <div className="absolute inset-0 bg-blue-500 rounded-full animate-aura-pulse blur-3xl opacity-30" />
                      <div className="w-32 h-32 glass rounded-[3rem] flex items-center justify-center relative z-10 animate-float shadow-3xl shadow-blue-500/20">
                          <Waves className="text-blue-500" size={56} />
                      </div>
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-4xl font-black tracking-tighter">What's the vibe today?</h2>
                        <p className="text-zinc-500 text-base max-w-sm mx-auto leading-relaxed">
                            I'm <span className="text-white font-black italic">Mr. Cute</span>. Your personal AI sidekick. Roast me, talk to me, or send a PDF. ✨
                        </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="px-5 py-2.5 glass rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 border-white/5">Ultra Fast</div>
                      <div className="px-5 py-2.5 glass rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 border-white/5">Hifi Voice</div>
                      <div className="px-5 py-2.5 glass rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 border-white/5">Emotional</div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-10">
                    {messages.map((msg, index) => {
                        const isFirstAI = index === 1 && msg.role === 'model';
                        return (
                          <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] sm:max-w-[75%] rounded-[2.5rem] p-7 shadow-2xl relative overflow-hidden ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none shadow-blue-500/20 message-enter-user' : 'glass text-white rounded-bl-none message-enter-model'} ${isFirstAI ? 'celestial-glow shimmer-effect' : ''}`}>
                                  {isFirstAI && <div className="absolute inset-0 pointer-events-none shimmer-effect opacity-20" />}
                                  {msg.image && (
                                      msg.image.startsWith('data:application/pdf') ? (
                                          <div className="flex items-center gap-5 p-5 bg-black/40 rounded-3xl mb-4 border border-white/10">
                                              <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500"><FileText size={28}/></div>
                                              <div className="flex-1 overflow-hidden"><p className="text-sm font-black truncate uppercase tracking-tight">Vibe_document.pdf</p></div>
                                          </div>
                                      ) : <img src={msg.image} className="rounded-3xl mb-5 max-h-96 w-full object-cover shadow-3xl border border-white/10" />
                                  )}
                                  <p className="text-[16px] font-semibold leading-relaxed whitespace-pre-wrap relative z-10">{msg.text}</p>
                                  <div className="mt-4 text-[11px] font-black opacity-40 uppercase tracking-[0.2em] flex items-center gap-2 relative z-10">
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
        <footer className="p-8 border-t border-white/5 backdrop-blur-3xl bg-black/30">
            <div className="max-w-4xl mx-auto flex items-center gap-4">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if(f) { const r = new FileReader(); r.onloadend = () => setFile({data: (r.result as string).split(',')[1], mimeType: f.type}); r.readAsDataURL(f); }
                }} />
                <button onClick={() => fileInputRef.current?.click()} className="p-5 glass hover:bg-white/10 text-zinc-500 rounded-3xl transition-all active:scale-90"><Paperclip size={24}/></button>
                <div className="flex-1 glass flex items-center rounded-3xl px-7 border-white/5 focus-within:border-blue-500 transition-all shadow-lg">
                    <input 
                        type="text" placeholder="Drop a vibe here..." value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)}
                        className="w-full bg-transparent border-none py-5 text-base font-bold outline-none"
                    />
                    {file && (
                        <div className="bg-blue-600 text-[10px] font-black px-4 py-2 rounded-2xl flex items-center gap-2 animate-in zoom-in border border-white/20">
                            {file.mimeType.includes('pdf') ? 'PDF READY' : 'IMAGE READY'}
                            <button onClick={() => setFile(null)} className="hover:rotate-90 transition-transform"><X size={12}/></button>
                        </div>
                    )}
                </div>
                <button 
                    onClick={() => handleSendToAI(inputText)} 
                    disabled={!inputText.trim() && !file}
                    className="p-5 bg-white text-black rounded-3xl shadow-3xl hover:bg-zinc-200 transition-all active:scale-90 disabled:opacity-40"
                >
                    <Send size={24} />
                </button>
            </div>
        </footer>
      </div>

      {/* Profile Modal */}
      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="My Vibe Identity">
          <div className="space-y-10">
              <div className="flex flex-col items-center gap-8">
                <div className="grid grid-cols-4 gap-4">
                    {AVATARS.map(url => (
                        <button key={url} onClick={() => setUser({...user!, avatarUrl: url})} className={`rounded-2xl overflow-hidden border-4 p-1 transition-all duration-300 ${user?.avatarUrl === url ? 'border-blue-500 scale-110 shadow-2xl shadow-blue-500/30' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                            <img src={url} className="w-16 h-16 bg-zinc-800" />
                        </button>
                    ))}
                </div>
                <p className="text-[11px] font-black text-zinc-600 uppercase tracking-[0.2em]">Switch Your Look</p>
              </div>
              <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Display Name</label>
                    <div className="glass flex items-center rounded-2xl px-6 border-white/5">
                        <UserIcon size={20} className="text-zinc-600 mr-4" />
                        <input type="text" value={user?.userName} onChange={e => setUser({...user!, userName: e.target.value})} className="w-full bg-transparent border-none py-5 font-black outline-none" />
                    </div>
                  </div>
              </div>
              
              <div className="flex flex-col gap-4">
                <button onClick={() => setIsProfileModalOpen(false)} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/20 active:scale-95 transition-all">Save Changes</button>
                <button 
                  onClick={handleLogOut}
                  className="w-full text-red-500 text-[11px] font-black uppercase tracking-[0.2em] py-5 border border-red-500/20 rounded-3xl hover:bg-red-500/10 transition-all"
                >
                  Terminate Session (Log Out)
                </button>
              </div>
          </div>
      </Modal>

      {/* Settings Modal */}
      <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Vibe Settings">
          <div className="space-y-10">
              <div className="space-y-6">
                  <label className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Personality Mode</label>
                  <div className="grid grid-cols-2 gap-4 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                      {Object.values(PERSONALITIES).map(p => (
                          <button key={p.id} onClick={() => setSettings({...settings, personalityId: p.id})} className={`p-5 rounded-3xl border text-left flex items-center gap-4 transition-all duration-300 ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-400 shadow-2xl shadow-blue-500/30' : 'glass border-white/5 hover:bg-white/5'}`}>
                              <span className="text-2xl">{p.emoji}</span>
                              <span className="text-[12px] font-black uppercase tracking-tight leading-none">{p.name}</span>
                          </button>
                      ))}
                  </div>
              </div>
              <div className="space-y-6">
                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Voice Tone</label>
                <div className="glass rounded-3xl overflow-hidden px-4">
                  <select value={settings.voiceName} onChange={e => setSettings({...settings, voiceName: e.target.value})} className="w-full bg-transparent border-none py-5 font-black outline-none appearance-none cursor-pointer">
                      {GEMINI_VOICES.map(v => <option key={v.id} value={v.id} className="bg-zinc-900 text-white">{v.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between p-8 glass rounded-[2.5rem] border-white/5">
                <div className="flex items-center gap-5">
                    {settings.theme === 'dark' ? <Moon size={24} className="text-blue-400" /> : <Sun size={24} className="text-orange-400" />}
                    <span className="font-black text-base tracking-tight uppercase">Dark Mode</span>
                </div>
                <button onClick={() => setSettings({...settings, theme: settings.theme === 'dark' ? 'light' : 'dark'})} className={`w-16 h-10 rounded-full relative transition-all duration-500 ${settings.theme === 'dark' ? 'bg-blue-600' : 'bg-zinc-700'}`}>
                    <div className={`absolute top-1.5 w-7 h-7 bg-white rounded-full transition-all duration-500 ${settings.theme === 'dark' ? 'left-8' : 'left-1.5'} shadow-lg`} />
                </button>
              </div>
          </div>
      </Modal>
    </div>
  );
}
