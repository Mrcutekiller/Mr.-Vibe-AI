
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

// Defined the missing TypingIndicator component used in the chat view to show model activity.
const TypingIndicator = () => (
  <div className="flex justify-start w-full">
    <div className="bg-white dark:bg-zinc-800/50 rounded-[2.5rem] rounded-bl-none p-6 shadow-2xl border border-zinc-100 dark:border-white/5 flex gap-2 items-center">
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_active_user'));
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  
  // Database of all users on this machine
  const [accounts, setAccounts] = useState<User[]>(() => {
    const saved = localStorage.getItem('mr_vibe_accounts');
    return saved ? JSON.parse(saved) : [];
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('mr_vibe_active_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [tempProfile, setTempProfile] = useState<Partial<User>>({
    userName: '',
    avatarUrl: AVATARS[0],
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

  // Fix: Light mode requires removing "dark" class from the html element
  useEffect(() => {
    localStorage.setItem('mr_vibe_settings', JSON.stringify(settings));
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  useEffect(() => {
    localStorage.setItem('mr_vibe_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    if (user) {
        localStorage.setItem('mr_vibe_active_user', JSON.stringify(user));
        setIsNewUser(false);
    } else {
        localStorage.removeItem('mr_vibe_active_user');
        setIsNewUser(true);
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('mr_vibe_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) localStorage.setItem('mr_vibe_active_session_id', activeSessionId);
    else localStorage.removeItem('mr_vibe_active_session_id');
  }, [activeSessionId]);

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
    if (confirm("Log out?")) {
      setUser(null);
      setActiveSessionId(null);
      setOnboardingStep(1);
      setAuthMode('login');
    }
  };

  const handleLogin = () => {
    const existing = accounts.find(a => a.email === credentials.email);
    if (!existing) {
        alert("Account not found. Please sign up first! ✨");
        return;
    }
    setUser(existing);
  };

  const handleCompleteSignup = () => {
    if (!tempProfile.userName?.trim()) {
        alert("Choose a name! ✨");
        return;
    }
    const newUser: User = {
        email: credentials.email,
        userName: tempProfile.userName,
        avatarUrl: tempProfile.avatarUrl || AVATARS[0],
        age: '18',
        gender: 'Other'
    };
    setAccounts(prev => [...prev, newUser]);
    setUser(newUser);
    requestNotifications();
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
    setFile(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}\n- Personality: ${currentPersonality.name}\n- User: ${user?.userName}`;

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text }] }],
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

  if (isNewUser) {
    return (
        <div className="fixed inset-0 z-[200] bg-zinc-50 dark:bg-[#030303] flex items-center justify-center p-6 overflow-y-auto">
            <div className="w-full max-w-lg bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/10 p-10 sm:p-14 rounded-[4rem] backdrop-blur-3xl shadow-2xl animate-in zoom-in-95 duration-700">
                
                {onboardingStep === 1 ? (
                    <div className="text-center animate-in slide-in-from-left-6 duration-500">
                        <div className="w-24 h-24 bg-blue-600 rounded-[2rem] mx-auto shadow-2xl shadow-blue-500/20 flex items-center justify-center animate-float mb-12">
                            {authMode === 'signup' ? <UserPlus size={48} className="text-white" /> : <LogIn size={48} className="text-white" />}
                        </div>
                        
                        <h1 className="text-4xl font-extrabold tracking-tighter mb-4 text-zinc-900 dark:text-white">
                            {authMode === 'signup' ? "Join Mr. Vibe AI" : "Welcome Back"}
                        </h1>
                        <p className="text-zinc-500 text-base mb-12 leading-relaxed max-w-xs mx-auto">
                            {authMode === 'signup' ? "Create an account to save your vibes." : "Log in to pick up where you left off."}
                        </p>

                        <div className="space-y-4 text-left">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-5">Email Address</label>
                                <div className="bg-zinc-100 dark:bg-white/5 flex items-center rounded-3xl px-6 border border-transparent focus-within:border-blue-500 transition-all">
                                    <Mail size={20} className="text-zinc-400 mr-4" />
                                    <input 
                                        type="email" placeholder="you@vibe.ai" 
                                        value={credentials.email}
                                        onChange={e => setCredentials({...credentials, email: e.target.value})}
                                        className="w-full bg-transparent border-none py-6 text-sm font-semibold outline-none dark:text-white text-zinc-900" 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-5">Password</label>
                                <div className="bg-zinc-100 dark:bg-white/5 flex items-center rounded-3xl px-6 border border-transparent focus-within:border-blue-500 transition-all">
                                    <Lock size={20} className="text-zinc-400 mr-4" />
                                    <input 
                                        type="password" placeholder="••••••••" 
                                        value={credentials.password}
                                        onChange={e => setCredentials({...credentials, password: e.target.value})}
                                        className="w-full bg-transparent border-none py-6 text-sm font-semibold outline-none dark:text-white text-zinc-900" 
                                    />
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => {
                                if (authMode === 'signup') setOnboardingStep(2);
                                else handleLogin();
                            }}
                            className="w-full bg-blue-600 dark:bg-white dark:text-black text-white py-6 rounded-3xl font-black text-lg mt-12 hover:scale-[1.03] active:scale-[0.97] transition-all shadow-2xl flex items-center justify-center gap-3"
                        >
                            {authMode === 'signup' ? "Continue" : "Log In"}
                            <ArrowRight size={22} />
                        </button>

                        <div className="mt-12 pt-10 border-t border-zinc-100 dark:border-white/5">
                            <button 
                                onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
                                className="text-sm font-bold text-zinc-500 hover:text-blue-500 transition-colors"
                            >
                                {authMode === 'signup' ? "Already have an account? Log In" : "New here? Create Account"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="animate-in slide-in-from-right-6 duration-500">
                        <button onClick={() => setOnboardingStep(1)} className="mb-8 flex items-center gap-3 text-zinc-500 hover:text-blue-500 text-[11px] font-black uppercase tracking-[0.2em] transition-colors group">
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back
                        </button>

                        <h2 className="text-3xl font-extrabold tracking-tighter text-center mb-10 text-zinc-900 dark:text-white">Step 2: Profile</h2>
                        
                        <div className="space-y-10">
                            <div className="space-y-6">
                                <label className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] text-center block">Pick Your Style</label>
                                <div className="grid grid-cols-5 gap-4">
                                    {AVATARS.map((url, i) => (
                                        <button 
                                            key={i} onClick={() => setTempProfile({...tempProfile, avatarUrl: url})} 
                                            className={`relative group rounded-3xl overflow-hidden transition-all duration-500 ${tempProfile.avatarUrl === url ? 'scale-110 shadow-2xl ring-4 ring-blue-500' : 'opacity-30 hover:opacity-100 hover:scale-105'}`}
                                        >
                                            <img src={url} className="w-full aspect-square bg-zinc-200 dark:bg-zinc-800" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] ml-5">Display Name</label>
                                <div className="bg-zinc-100 dark:bg-white/5 flex items-center rounded-3xl px-6 border border-transparent focus-within:border-blue-500 transition-all">
                                    <UserIcon size={20} className="text-zinc-400 mr-4" />
                                    <input 
                                        type="text" placeholder="e.g. VibeMaster" 
                                        value={tempProfile.userName}
                                        onChange={e => setTempProfile({...tempProfile, userName: e.target.value})}
                                        className="w-full bg-transparent border-none py-6 text-sm font-semibold outline-none dark:text-white text-zinc-900" 
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleCompleteSignup}
                                className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-lg hover:scale-[1.03] active:scale-[0.97] transition-all shadow-2xl shadow-blue-500/20 flex items-center justify-center gap-3"
                            >
                                Start Chatting
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
    <div className="flex flex-col h-screen font-sans overflow-hidden transition-colors duration-500 dark:bg-[#030303] bg-zinc-50 text-zinc-900 dark:text-white">
      {/* Main UI Container */}
      <div className="max-w-5xl mx-auto w-full flex flex-col h-full glass sm:rounded-[4rem] sm:my-4 overflow-hidden border-zinc-200 dark:border-white/10 relative shadow-2xl">
        {/* Header */}
        <header className="px-8 py-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between z-10 backdrop-blur-xl">
            <div className="flex items-center gap-6">
                <button onClick={() => setIsSidebarOpen(true)} className="p-4 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-2xl transition-all"><Menu size={22} /></button>
                <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setIsProfileModalOpen(true)}>
                    <img src={user?.avatarUrl} className="w-12 h-12 rounded-2xl border border-zinc-200 dark:border-white/20 p-1 group-hover:border-blue-500 transition-all shadow-lg" />
                    <div>
                        <h1 className="text-base font-black tracking-tight uppercase">Mr. Cute</h1>
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">{currentPersonality.name}</p>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={connectLive} className="p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all shadow-2xl active:scale-95"><Mic size={22} /></button>
                <button onClick={() => setIsSettingsModalOpen(true)} className="p-4 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-2xl transition-all"><Settings size={22} /></button>
            </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto px-8 py-10 custom-scrollbar relative">
            {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center space-y-10 text-center animate-in fade-in zoom-in duration-1000">
                    <div className="w-32 h-32 glass dark:bg-zinc-800/50 bg-white rounded-[3rem] flex items-center justify-center relative z-10 animate-float shadow-3xl">
                        <Waves className="text-blue-500" size={56} />
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-4xl font-black tracking-tighter">Ready for a vibe?</h2>
                        <p className="text-zinc-500 text-base max-w-sm mx-auto leading-relaxed">I'm Mr. Cute. Choose a vibe and let's talk.</p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-10">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] sm:max-w-[75%] rounded-[2.5rem] p-7 shadow-2xl relative ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-800/50 dark:text-white text-zinc-900 border border-zinc-100 dark:border-white/5 rounded-bl-none'}`}>
                                <p className="text-[16px] font-semibold leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && <TypingIndicator />}
                </div>
            )}
            <div ref={bottomRef} className="h-10 w-full" />
        </main>

        {/* Footer Input */}
        <footer className="p-8 border-t border-zinc-100 dark:border-white/5 backdrop-blur-3xl dark:bg-black/30 bg-white/50">
            <div className="max-w-4xl mx-auto flex items-center gap-4">
                <div className="flex-1 bg-zinc-100 dark:bg-white/5 flex items-center rounded-3xl px-7 border border-transparent focus-within:border-blue-500 transition-all shadow-lg">
                    <input 
                        type="text" placeholder="Say something..." value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)}
                        className="w-full bg-transparent border-none py-5 text-base font-bold outline-none"
                    />
                </div>
                <button 
                    onClick={() => handleSendToAI(inputText)} 
                    disabled={!inputText.trim()}
                    className="p-5 bg-blue-600 text-white rounded-3xl shadow-3xl hover:bg-blue-500 transition-all active:scale-90 disabled:opacity-40"
                >
                    <Send size={24} />
                </button>
            </div>
        </footer>
      </div>

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setIsSettingsModalOpen(false)} />
            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-[3rem] p-10 shadow-3xl animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">Vibe Config</h2>
                    <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl"><X /></button>
                </div>

                <div className="space-y-8">
                    <div className="flex items-center justify-between p-8 dark:bg-white/5 bg-zinc-50 rounded-[2.5rem] border dark:border-white/5 border-zinc-100">
                        <div className="flex items-center gap-5">
                            {settings.theme === 'dark' ? <Moon size={24} className="text-blue-400" /> : <Sun size={24} className="text-orange-400" />}
                            <span className="font-black text-base uppercase tracking-tight">Dark Mode</span>
                        </div>
                        <button onClick={() => setSettings({...settings, theme: settings.theme === 'dark' ? 'light' : 'dark'})} className={`w-16 h-10 rounded-full relative transition-all duration-500 ${settings.theme === 'dark' ? 'bg-blue-600' : 'bg-zinc-300'}`}>
                            <div className={`absolute top-1.5 w-7 h-7 bg-white rounded-full transition-all duration-500 ${settings.theme === 'dark' ? 'left-8' : 'left-1.5'} shadow-lg`} />
                        </button>
                    </div>

                    <button onClick={handleLogOut} className="w-full text-red-500 text-[11px] font-black uppercase tracking-[0.2em] py-5 border border-red-500/20 rounded-3xl hover:bg-red-500/10 transition-all">
                        Log Out Session
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Sidebar (History) */}
      <div className={`fixed inset-0 z-[120] ${isSidebarOpen ? 'visible' : 'invisible'}`}>
        <div className={`absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-500 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsSidebarOpen(false)} />
        <div className={`absolute top-0 bottom-0 left-0 w-80 dark:bg-zinc-950 bg-white border-r border-zinc-200 dark:border-white/5 transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-10 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
              <h2 className="text-2xl font-black italic tracking-tighter">HISTORY</h2>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl"><X /></button>
            </div>
            <div className="p-8">
              <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-3xl font-black shadow-2xl active:scale-95 transition-all">
                <Plus size={22} /> New Vibe
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-4 custom-scrollbar">
              {sessions.map(s => (
                <div key={s.id} onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }} className={`p-6 rounded-3xl cursor-pointer transition-all border ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-500/50' : 'hover:bg-zinc-100 dark:hover:bg-white/5 border-transparent'}`}>
                  <span className="font-bold text-sm block truncate">{s.title}</span>
                </div>
              ))}
            </div>
        </div>
      </div>
    </div>
  );
}
