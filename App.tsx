
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Waves, Volume2, LogIn, UserPlus, ArrowRight, ArrowLeft, 
  User as UserIcon, CheckCircle2, Mail, Lock, Sparkles, 
  ChevronRight, MicOff, MessageSquare, AlertCircle, AlertTriangle, RefreshCw,
  Camera, FileText, Upload, Loader2, Play, Image as ImageIcon, Globe,
  Leaf, Droplets, Share2, ThumbsUp, ThumbsDown, Edit3, ClipboardCheck
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES, PERSONALITY_REACH_OUTS, SUPPORTED_LANGUAGES } from './constants';
import { PersonalityId, AppSettings, User, ChatSession, Message } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';
import { decode, decodeAudioData } from './utils/audioUtils';

// --- Helper Functions ---
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// --- Animated Components ---

const TypingIndicator = () => (
  <div className="flex justify-start w-full animate-in fade-in slide-in-from-left-4 duration-300">
    <div className="bg-white/80 dark:bg-zinc-800/40 backdrop-blur-md rounded-[1.5rem] md:rounded-[2rem] rounded-bl-none p-3 md:p-4 shadow-xl border border-white/20 dark:border-white/5 flex gap-1.5 items-center">
      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
    </div>
  </div>
);

const FluidOrb = ({ volume, active }: { volume: number, active: boolean }) => {
  const scale = 1 + (active ? volume * 2.2 : 0);
  const opacity = active ? 0.8 + (volume * 0.2) : 0.4;
  
  return (
    <div className="relative flex items-center justify-center">
      <div className={`absolute inset-0 bg-blue-500/30 blur-[60px] md:blur-[100px] rounded-full transition-transform duration-300 ${active ? 'scale-150' : 'scale-100'}`} />
      <div 
        className="w-32 h-32 md:w-48 md:h-48 rounded-full relative overflow-hidden transition-all duration-300 ease-out shadow-[0_0_50px_rgba(59,130,246,0.5)]"
        style={{ 
          transform: `scale(${scale})`,
          opacity: opacity,
          background: 'radial-gradient(circle at 30% 30%, #3b82f6, #6366f1, #1e40af)'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent animate-spin-slow opacity-50" />
        <div className="absolute inset-4 bg-black/10 blur-md rounded-full" />
      </div>
      {active && [...Array(3)].map((_, i) => (
        <div 
          key={i} 
          className="absolute inset-0 border-2 border-blue-400/30 rounded-full animate-ping"
          style={{ animationDelay: `${i * 0.4}s`, animationDuration: '2s' }}
        />
      ))}
    </div>
  );
};

// --- Main Application ---

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_active_user'));
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<{text: string, isModel: boolean}[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const currentPersonality = PERSONALITIES[settings.personalityId];

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('mr_vibe_settings', JSON.stringify(settings));
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('mr_vibe_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    if (user) {
        localStorage.setItem('mr_vibe_active_user', JSON.stringify(user));
        setIsNewUser(false);
    } else {
        localStorage.removeItem('mr_vibe_active_user');
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('mr_vibe_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) localStorage.setItem('mr_vibe_active_session_id', activeSessionId);
    else localStorage.removeItem('mr_vibe_active_session_id');
  }, [activeSessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveTranscript, isLoading]);

  const recordInteraction = () => {
    lastInteractionRef.current = Date.now();
  };

  const { connect: connectLive, disconnect: disconnectLive, sendMessage: liveSendMessage, isLive, isConnecting, volume } = useGeminiLive({
    personality: currentPersonality,
    settings,
    user: user || { userName: 'Friend', email: '', age: '', gender: 'Other', avatarUrl: AVATARS[0] },
    onTranscript: (text, isModel) => {
        recordInteraction();
        setLiveTranscript(prev => {
            const last = prev[prev.length - 1];
            if (last && last.isModel === isModel) {
              return [...prev.slice(0, -1), { text: last.text + text, isModel }];
            }
            return [...prev, { text, isModel }];
        });
    },
    onTurnComplete: (userText, modelText) => {
        recordInteraction();
        setLiveTranscript([]);
        const sessionId = activeSessionId || handleNewChat();
        
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: [
            ...s.messages,
            ...(userText ? [{ id: `u-${Date.now()}`, role: 'user' as const, text: userText, timestamp: Date.now() }] : []),
            ...(modelText ? [{ id: `m-${Date.now()}`, role: 'model' as const, text: modelText, timestamp: Date.now() }] : [])
          ],
          lastTimestamp: Date.now()
        } : s));
    },
    onConnectionStateChange: (connected) => {
        if (!connected) setLiveTranscript([]);
        if (connected) setErrorMessage(null);
    },
    onError: (msg) => setErrorMessage(msg)
  });

  const previewVoice = async (voiceId: string) => {
    if (isPreviewingVoice) return;
    setIsPreviewingVoice(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const text = `Hi, I'm ${currentPersonality.name}, what can I do for you?`;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
        source.onended = () => setIsPreviewingVoice(false);
      } else {
        setIsPreviewingVoice(false);
      }
    } catch (e) {
      console.error("Voice preview failed", e);
      setIsPreviewingVoice(false);
    }
  };

  const handleAISpeakFirst = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}
      - Personality: ${currentPersonality.name}
      - User Context: ${user?.userName}
      - Language Setting: ${settings.language}
      - Task: Greet the user with energy and stay in character. You must speak first!
      `;

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text: "Introduce yourself and ask me how my day is going!" }] }],
          config: { systemInstruction: fullSystemPrompt }
      });

      setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: [{ id: Date.now().toString(), role: 'model', text: response.text || 'Hey there! ✨', timestamp: Date.now() }]
      } : s));
    } catch (error) {
       console.error(error);
    } finally { setIsLoading(false); }
  }

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Conversation',
      messages: [],
      lastTimestamp: Date.now(),
      personalityId: settings.personalityId
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setIsSidebarOpen(false);

    // Trigger AI initiation
    handleAISpeakFirst(newId);

    return newId;
  };

  const confirmDeleteSession = () => {
    if (sessionToDelete) {
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete));
      if (activeSessionId === sessionToDelete) setActiveSessionId(null);
      setSessionToDelete(null);
    }
  };

  const handleLogOut = () => {
    if (confirm("Sign out of Mr. Vibe AI?")) {
      setUser(null);
      setActiveSessionId(null);
      setOnboardingStep(1);
      setAuthMode('login');
      localStorage.removeItem('mr_vibe_active_user');
    }
  };

  const handleLogin = () => {
    if (!validateEmail(credentials.email)) {
      setErrorMessage("Please enter a valid email address! 📧");
      return;
    }
    const existing = accounts.find(a => a.email === credentials.email);
    if (!existing) {
        setErrorMessage("Account not found. Sign up first! ✨");
        return;
    }
    setUser(existing);
    setErrorMessage(null);
  };

  const handleCompleteSignup = () => {
    if (!validateEmail(credentials.email)) {
      setErrorMessage("Please enter a valid email address! 📧");
      return;
    }
    if (!tempProfile.userName?.trim()) {
        setErrorMessage("What's your name? ✨");
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
    setErrorMessage(null);
  };

  const handleUpdateAvatar = (url: string) => {
    if (!user) return;
    const updatedUser = { ...user, avatarUrl: url };
    setUser(updatedUser);
    setAccounts(prev => prev.map(a => a.email === user.email ? updatedUser : a));
  };

  const handleUpdateUserName = (name: string) => {
    if (!user) return;
    const updatedUser = { ...user, userName: name };
    setUser(updatedUser);
    setAccounts(prev => prev.map(a => a.email === user.email ? updatedUser : a));
  };

  const handleSendToAI = async (text: string, fileData?: { data: string, mimeType: string, fileName: string }) => {
    if ((!text.trim() && !fileData) || isLoading) return;
    recordInteraction();
    const sessionId = activeSessionId || handleNewChat();
    
    if (isLive && !fileData) {
      liveSendMessage(text);
      setInputText('');
      return;
    }

    const isImage = fileData?.mimeType.startsWith('image/');
    const userMessage: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: fileData ? (isImage ? text : `📄 Document: ${fileData.fileName}\n${text}`) : text, 
      image: isImage ? `data:${fileData?.mimeType};base64,${fileData?.data}` : undefined,
      timestamp: Date.now() 
    };

    setSessions(prev => prev.map(s => s.id === sessionId ? {
      ...s,
      title: s.messages.length === 0 ? (fileData ? fileData.fileName : text.slice(0, 30)) : s.title,
      messages: [...s.messages, userMessage],
      lastTimestamp: Date.now()
    } : s));

    setIsLoading(true);
    setInputText('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}
      - Personality: ${currentPersonality.name}
      - User Context: ${user?.userName}
      - Language Setting: ${settings.language} (CRITICAL: RESPOND ONLY IN THIS LANGUAGE)
      `;

      const parts: any[] = [{ text: text || "Check this out!" }];
      if (fileData) {
        parts.push({
          inlineData: {
            data: fileData.data,
            mimeType: fileData.mimeType
          }
        });
      }

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts }],
          config: { systemInstruction: fullSystemPrompt }
      });

      setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: [...s.messages, { id: (Date.now() + 1).toString(), role: 'model', text: response.text || '...', timestamp: Date.now() }]
      } : s));
    } catch (error) {
       console.error(error);
       setErrorMessage("Vibe check failed. Try again? ⚡");
    } finally { setIsLoading(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("Please upload a PDF or an Image/GIF. 📄🖼️");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      handleSendToAI("", { data: base64Data, mimeType: file.type, fileName: file.name });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (isNewUser) {
    return (
        <div className="fixed inset-0 z-[200] bg-zinc-50 dark:bg-black flex items-center justify-center p-4 md:p-6 overflow-y-auto">
            <div className="w-full max-w-lg bg-white/80 dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/10 p-6 md:p-12 rounded-[2.5rem] md:rounded-[4rem] backdrop-blur-3xl shadow-2xl animate-in zoom-in-95 duration-500">
                {onboardingStep === 1 ? (
                    <div className="text-center space-y-6 md:space-y-8 animate-in slide-in-from-bottom-8">
                        <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-[1.2rem] md:rounded-[2.5rem] mx-auto shadow-2xl flex items-center justify-center animate-float">
                            {authMode === 'signup' ? <UserPlus size={32} className="text-white md:size-36" /> : <LogIn size={32} className="text-white md:size-36" />}
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">Mr. Vibe AI</h1>
                            <p className="text-zinc-500 text-xs md:text-sm font-medium">Your companion in the digital void.</p>
                        </div>
                        {errorMessage && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] md:text-xs font-bold flex items-center gap-2"><AlertCircle size={14}/> {errorMessage}</div>}
                        <div className="space-y-3 md:space-y-4 text-left">
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input 
                                    type="email" placeholder="Email (e.g. name@domain.com)" 
                                    value={credentials.email}
                                    onChange={e => setCredentials({...credentials, email: e.target.value})}
                                    className="w-full bg-zinc-100 dark:bg-white/5 rounded-xl md:rounded-3xl py-4 md:py-6 pl-12 md:pl-16 pr-6 font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all text-zinc-900 dark:text-white text-sm" 
                                />
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input 
                                    type="password" placeholder="Secure Password" 
                                    value={credentials.password}
                                    onChange={e => setCredentials({...credentials, password: e.target.value})}
                                    className="w-full bg-zinc-100 dark:bg-white/5 rounded-xl md:rounded-3xl py-4 md:py-6 pl-12 md:pl-16 pr-6 font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all text-zinc-900 dark:text-white text-sm" 
                                />
                            </div>
                        </div>
                        <button 
                            onClick={() => authMode === 'signup' ? setOnboardingStep(2) : handleLogin()}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 md:py-6 rounded-xl md:rounded-3xl font-black text-sm md:text-xl transition-all shadow-xl active:scale-[0.98]"
                        >
                            {authMode === 'signup' ? "Get Started" : "Enter the Vibe"}
                        </button>
                        <button 
                            onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
                            className="text-zinc-500 font-bold hover:text-blue-500 transition-colors text-[10px] md:text-sm"
                        >
                            {authMode === 'signup' ? "Already a member? Log in" : "New? Create an account"}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6 md:space-y-10 animate-in slide-in-from-right-8">
                        <button onClick={() => setOnboardingStep(1)} className="flex items-center gap-2 text-zinc-500 font-bold hover:text-blue-500 transition-colors text-xs md:text-sm">
                            <ArrowLeft size={16} md:size={20} /> Back
                        </button>
                        <div className="text-center space-y-1">
                            <h2 className="text-xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">Identity Choice</h2>
                            <p className="text-zinc-500 text-[10px] md:text-sm">Pick a face for your profile.</p>
                        </div>
                        <div className="grid grid-cols-5 gap-2 md:gap-4 overflow-x-auto pb-2 custom-scrollbar">
                            {AVATARS.map((url, i) => (
                                <button 
                                    key={i} onClick={() => setTempProfile({...tempProfile, avatarUrl: url})} 
                                    className={`relative flex-shrink-0 w-10 h-10 md:w-16 md:h-16 rounded-xl overflow-hidden transition-all duration-300 ${tempProfile.avatarUrl === url ? 'ring-2 md:ring-4 ring-blue-500 scale-110 shadow-xl' : 'opacity-40 hover:opacity-100'}`}
                                >
                                    <img src={url} className="w-full h-full bg-zinc-100 dark:bg-zinc-800" />
                                </button>
                            ))}
                        </div>
                        <div className="space-y-4">
                            <input 
                                type="text" placeholder="Display Name" 
                                value={tempProfile.userName}
                                onChange={e => setTempProfile({...tempProfile, userName: e.target.value})}
                                className="w-full bg-zinc-100 dark:bg-white/5 rounded-xl md:rounded-3xl py-4 md:py-6 px-6 md:px-8 font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all text-zinc-900 dark:text-white text-sm" 
                            />
                            <button 
                                onClick={handleCompleteSignup}
                                className="w-full bg-blue-600 text-white py-4 md:py-6 rounded-xl md:rounded-3xl font-black text-sm md:text-xl hover:bg-blue-500 transition-all shadow-xl"
                            >
                                Complete Setup
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
  }

  return (
    <div className="flex h-screen w-full font-sans overflow-hidden bg-zinc-50 dark:bg-black transition-colors duration-500">
      
      {/* Voice Mode Sonic Space */}
      {(isLive || isConnecting) && (
        <div className="fixed inset-0 z-[300] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-between p-4 md:p-8 animate-in fade-in duration-700">
          <div className="w-full flex justify-end gap-3 md:gap-4">
            <button onClick={disconnectLive} className="p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all group active:scale-90">
                <X size={24} className="text-white group-hover:rotate-90 transition-transform" />
            </button>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center w-full gap-8 md:gap-12">
            <FluidOrb volume={volume} active={isLive} />
            <div className="text-center max-w-xl space-y-6 md:space-y-12">
              <h2 className="text-2xl md:text-5xl font-black tracking-tighter text-white animate-in slide-in-from-bottom-4">
                {isConnecting ? "Connecting..." : currentPersonality.name}
              </h2>
              <div className="space-y-4 h-20 md:h-24 flex flex-col justify-start px-4">
                {liveTranscript.slice(-1).map((t, i) => (
                  <p key={i} className={`text-lg md:text-2xl font-bold italic animate-in fade-in slide-in-from-bottom-2 ${t.isModel ? 'text-blue-400' : 'text-zinc-500'}`}>
                    "{t.text}"
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col items-center gap-4 pb-4">
             <div className="flex items-center gap-2 px-6 py-3 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{isLive ? 'Sync Active' : 'Connecting...'}</span>
             </div>
             <button onClick={disconnectLive} className="flex items-center gap-3 px-8 py-4 md:py-6 bg-red-600 hover:bg-red-500 text-white rounded-[2rem] font-black text-xs md:text-lg transition-all active:scale-95 shadow-2xl">
                <MicOff size={18} /> End Session
             </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div 
        className={`fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsSidebarOpen(false)}
      />
      <div className={`fixed inset-y-0 left-0 z-[160] w-[280px] md:w-80 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/5 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:relative`}>
        <div className="flex flex-col h-full">
            <div className="p-6 md:p-8 flex items-center justify-between">
                <h2 className="text-2xl font-black italic tracking-tighter">MEMORIES</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl md:hidden transition-colors">
                    <X size={20} />
                </button>
            </div>
            <div className="px-6 md:px-8 pb-6">
                <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-3 bg-zinc-900 dark:bg-white text-white dark:text-black py-4 rounded-xl md:rounded-[2rem] font-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl text-sm">
                    <Plus size={18} /> New Conversation
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-8 space-y-2 custom-scrollbar">
                {sessions.map(s => (
                    <div 
                        key={s.id} onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }}
                        className={`group relative p-4 rounded-xl md:rounded-3xl cursor-pointer transition-all border ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-500/30' : 'hover:bg-zinc-100 dark:hover:bg-white/5 border-transparent'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                                <MessageSquare size={16} className={activeSessionId === s.id ? 'text-blue-500' : 'text-zinc-400'} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`font-bold text-xs truncate ${activeSessionId === s.id ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-300'}`}>{s.title || "Vibe Session"}</p>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{new Date(s.lastTimestamp).toLocaleDateString()}</p>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setSessionToDelete(s.id); }} 
                              className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-red-500 transition-all transform hover:scale-110"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-6 md:p-8 border-t border-zinc-100 dark:border-white/5">
                <button onClick={handleLogOut} className="w-full py-4 text-[10px] text-zinc-400 hover:text-red-500 font-black uppercase tracking-widest transition-colors">Log Out Account</button>
            </div>
        </div>
      </div>

      {/* Deletion Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setSessionToDelete(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-3xl p-8 md:p-10 shadow-4xl text-center space-y-6">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl md:text-2xl font-black tracking-tighter">Erase Memory?</h3>
              <p className="text-zinc-500 text-xs md:text-sm leading-relaxed">This vibe session will be lost to the void forever.</p>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={confirmDeleteSession} className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl transition-all shadow-xl active:scale-95 text-sm">Yes, Delete It</button>
              <button onClick={() => setSessionToDelete(null)} className="w-full py-4 bg-zinc-100 dark:bg-white/5 text-zinc-900 dark:text-white font-black rounded-2xl transition-all text-sm">Keep It</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative h-full">
        <header className="px-4 md:px-8 py-3 md:py-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between backdrop-blur-xl bg-white/50 dark:bg-black/50 sticky top-0 z-[100]">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-xl transition-all">
                    <Menu size={18} />
                </button>
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsProfileModalOpen(true)}>
                    <div className="relative">
                        <img src={user?.avatarUrl} className="w-9 h-9 md:w-11 md:h-11 rounded-xl border-2 border-white dark:border-zinc-800 shadow-md" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-black rounded-full shadow-inner" />
                    </div>
                    <div className="hidden xs:block">
                        <h1 className="text-xs md:text-base font-black tracking-tighter leading-none truncate max-w-[80px] md:max-w-[120px]">{user?.userName}</h1>
                        <p className="text-[8px] md:text-[10px] font-black text-blue-500 uppercase tracking-widest mt-0.5">Active Vibe</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-2 px-3 md:px-5 py-2 md:py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-black text-[9px] md:text-xs transition-all group shadow-lg">
                    <Sparkles size={12} className="text-blue-500 group-hover:rotate-12 transition-transform" />
                    {currentPersonality.name.split(' ')[0]}
                </button>
                <button onClick={connectLive} className="p-2.5 md:p-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-xl active:scale-95">
                    <Mic size={18} />
                </button>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-12 py-6 md:py-10 custom-scrollbar bg-zinc-50 dark:bg-black relative">
            <div className="max-w-3xl mx-auto flex flex-col gap-6 md:gap-8">
                {messages.length === 0 && !isLoading ? (
                    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-1000">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" />
                            <div className="w-20 h-20 md:w-28 md:h-28 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-3xl md:rounded-[2.5rem] flex items-center justify-center relative shadow-3xl animate-float">
                                <Waves size={36} md:size={48} className="text-blue-500" />
                            </div>
                        </div>
                        <div className="space-y-2 px-4">
                            <h2 className="text-2xl md:text-4xl font-black tracking-tighter text-zinc-900 dark:text-white leading-tight">Vibe Initiated.</h2>
                            <p className="text-xs md:text-base font-medium text-zinc-500 max-w-[240px] md:max-w-sm mx-auto leading-relaxed">
                                Pick a vibe, upload some content, or just chat away.
                            </p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-6 duration-500`} style={{ animationDelay: `${i * 0.02}s` }}>
                            <div className={`max-w-[92%] md:max-w-[80%] rounded-2xl md:rounded-[2.5rem] p-4 md:p-6 shadow-lg relative ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-800/60 dark:text-white text-zinc-900 border border-zinc-100 dark:border-white/5 rounded-bl-none'}`}>
                                {msg.image && (
                                  <div className="mb-4 rounded-xl overflow-hidden shadow-lg border border-black/10 dark:border-white/10">
                                    <img src={msg.image} alt="Vibe Content" className="w-full h-auto object-contain max-h-[350px]" />
                                  </div>
                                )}
                                <p className="text-sm md:text-lg font-bold leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                
                                {/* Reactions Bar */}
                                <div className="mt-4 flex items-center gap-2 border-t border-black/5 dark:border-white/5 pt-3">
                                  <button onClick={() => {}} className="p-2 hover:bg-emerald-500/10 rounded-lg text-zinc-400 hover:text-emerald-500 transition-all active:scale-90" title="Eco Mode">
                                    <Leaf size={14} />
                                  </button>
                                  <button onClick={() => {}} className="p-2 hover:bg-amber-500/10 rounded-lg text-zinc-400 hover:text-amber-500 transition-all active:scale-90" title="Pee Mode">
                                    <Droplets size={14} />
                                  </button>
                                  <button onClick={() => copyToClipboard(msg.text)} className="p-2 hover:bg-sky-500/10 rounded-lg text-zinc-400 hover:text-sky-500 transition-all active:scale-90" title="Share Message">
                                    <Share2 size={14} />
                                  </button>
                                  <div className="flex-1" />
                                  <button onClick={() => {}} className="p-2 hover:bg-blue-500/10 rounded-lg text-zinc-400 hover:text-blue-500 transition-all active:scale-90" title="Like">
                                    <ThumbsUp size={14} />
                                  </button>
                                  <button onClick={() => {}} className="p-2 hover:bg-rose-500/10 rounded-lg text-zinc-400 hover:text-rose-500 transition-all active:scale-90" title="Dislike">
                                    <ThumbsDown size={14} />
                                  </button>
                                </div>

                                <div className="mt-2 text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-40">
                                    {msg.role === 'user' ? 'Sent by you' : `${currentPersonality.name}`} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                {isLoading && <TypingIndicator />}
            </div>
            <div ref={bottomRef} className="h-10 w-full" />
        </main>

        <footer className="px-4 md:px-12 py-4 md:py-6 border-t border-zinc-100 dark:border-white/5 bg-white/80 dark:bg-black/80 backdrop-blur-3xl sticky bottom-0">
            <div className="max-w-3xl mx-auto flex items-center gap-2 md:gap-3">
                <div className="flex-1 bg-zinc-100 dark:bg-white/5 flex items-center rounded-2xl md:rounded-[2rem] px-4 md:px-6 border-2 border-transparent focus-within:border-blue-500 transition-all shadow-inner overflow-hidden">
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-zinc-400 hover:text-blue-500 transition-colors flex-shrink-0" title="Upload Media">
                      <ImageIcon size={20} />
                    </button>
                    <input type="file" accept="application/pdf,image/*" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <input type="text" placeholder="Drop a vibe..." value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} className="w-full bg-transparent border-none py-4 md:py-5 text-xs md:text-base font-bold outline-none pl-2" />
                </div>
                <button onClick={() => handleSendToAI(inputText)} disabled={!inputText.trim() || isLoading} className="p-4 md:p-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl md:rounded-[1.8rem] shadow-2xl transition-all active:scale-90 disabled:opacity-30 flex items-center justify-center min-w-[50px] md:min-w-[64px]">
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
            </div>
        </footer>
      </div>

      {/* Profile & Settings Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-end md:items-center justify-center p-0 md:p-6 overflow-hidden">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in" onClick={() => setIsProfileModalOpen(false)} />
            <div className="relative w-full md:max-w-3xl bg-white dark:bg-zinc-900 border-t md:border border-zinc-200 dark:border-white/10 rounded-t-[2.5rem] md:rounded-[3.5rem] p-6 md:p-12 shadow-3xl animate-in slide-in-from-bottom-20 md:zoom-in-95 duration-400 max-h-[95vh] md:max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-6 md:mb-10">
                    <div className="space-y-0.5">
                      <h2 className="text-xl md:text-3xl font-black uppercase italic tracking-tighter">Vibe Config</h2>
                      <p className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest">Personalize your companion</p>
                    </div>
                    <button onClick={() => setIsProfileModalOpen(false)} className="p-3 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-2xl transition-all active:scale-90"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 md:pr-4 space-y-8 md:space-y-10 pb-8">
                    {/* User Profile */}
                    <div className="space-y-6">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="relative group animate-float">
                                <img src={user?.avatarUrl} className="w-24 h-24 md:w-32 md:h-32 rounded-3xl md:rounded-[2.5rem] shadow-2xl border-4 border-white dark:border-zinc-800" />
                                <div className="absolute -bottom-2 -right-2 p-3 bg-blue-600 rounded-2xl shadow-xl text-white">
                                  <Camera size={18} />
                                </div>
                            </div>
                            <div className="w-full max-w-xs space-y-3">
                                <div className="relative group">
                                  <Edit3 className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                                  <input 
                                    type="text" 
                                    value={user?.userName} 
                                    onChange={(e) => handleUpdateUserName(e.target.value)}
                                    placeholder="Username"
                                    className="w-full bg-zinc-100 dark:bg-white/5 rounded-2xl py-3 md:py-4 pl-12 pr-4 font-black text-center outline-none border-2 border-transparent focus:border-blue-500 transition-all"
                                  />
                                </div>
                                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-white/5 rounded-full">
                                  <Mail size={12} className="text-zinc-400" />
                                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{user?.email}</p>
                                </div>
                            </div>
                        </div>

                        {/* Avatars */}
                        <div className="space-y-4">
                            <label className="text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-400 ml-4">Choose Your Identity</label>
                            <div className="grid grid-cols-5 gap-3 md:gap-4 p-4 md:p-6 bg-zinc-100 dark:bg-white/5 rounded-[2rem] md:rounded-[2.5rem]">
                                {AVATARS.map((url, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => handleUpdateAvatar(url)}
                                        className={`relative aspect-square rounded-xl md:rounded-2xl overflow-hidden transition-all duration-500 ${user?.avatarUrl === url ? 'ring-2 md:ring-4 ring-blue-500 scale-110 shadow-xl z-10' : 'opacity-40 hover:opacity-100'}`}
                                    >
                                        <img src={url} className="w-full h-full bg-zinc-100 dark:bg-zinc-800" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12">
                        {/* Personality */}
                        <div className="space-y-4">
                            <label className="text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-400 ml-4">AI Personality (The Vibe)</label>
                            <div className="grid grid-cols-1 gap-2 max-h-48 md:max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {Object.values(PERSONALITIES).map(p => (
                                    <button 
                                        key={p.id} 
                                        onClick={() => setSettings({...settings, personalityId: p.id})}
                                        className={`flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl' : 'bg-zinc-100 dark:bg-white/5 border-transparent hover:bg-zinc-200 dark:hover:bg-white/10'}`}
                                    >
                                        <div className="flex items-center gap-3 text-left">
                                            <span className="text-lg md:text-xl">{p.emoji}</span>
                                            <div>
                                                <p className="font-black text-xs md:text-sm leading-tight">{p.name}</p>
                                                <p className={`text-[9px] md:text-[10px] leading-tight ${settings.personalityId === p.id ? 'text-white/70' : 'text-zinc-500'}`}>{p.description}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Other Settings */}
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <label className="text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-400 ml-4">Global Preferences</label>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-4 md:p-5 bg-zinc-100 dark:bg-white/5 rounded-2xl md:rounded-[1.8rem]">
                                        <div className="flex items-center gap-3">
                                            {settings.theme === 'dark' ? <Moon size={18} className="text-blue-400" /> : <Sun size={18} className="text-orange-400" />}
                                            <span className="font-bold text-xs md:text-sm">Dark Interface</span>
                                        </div>
                                        <button onClick={() => setSettings({...settings, theme: settings.theme === 'dark' ? 'light' : 'dark'})} className={`w-11 h-6 md:w-14 md:h-8 rounded-full relative transition-all duration-500 ${settings.theme === 'dark' ? 'bg-blue-600' : 'bg-zinc-300'}`}>
                                            <div className={`absolute top-1 w-4 h-4 md:w-6 md:h-6 bg-white rounded-full transition-all duration-500 ${settings.theme === 'dark' ? 'left-6 md:left-7' : 'left-1'}`} />
                                        </button>
                                    </div>

                                    <div className="relative group">
                                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                        <select 
                                            value={settings.language} 
                                            onChange={e => setSettings({...settings, language: e.target.value})}
                                            className="w-full bg-zinc-100 dark:bg-white/5 rounded-2xl py-4 pl-12 pr-6 font-black text-xs md:text-sm outline-none border-2 border-transparent focus:border-blue-500 appearance-none cursor-pointer"
                                        >
                                            {SUPPORTED_LANGUAGES.map(lang => <option key={lang.code} value={lang.code} className="bg-white dark:bg-zinc-900">{lang.name}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <div className="relative group flex-1">
                                            <Volume2 className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                            <select 
                                                value={settings.voiceName} 
                                                onChange={e => {
                                                  setSettings({...settings, voiceName: e.target.value});
                                                  previewVoice(e.target.value);
                                                }}
                                                className="w-full bg-zinc-100 dark:bg-white/5 rounded-2xl py-4 pl-12 pr-6 font-black text-xs md:text-sm outline-none border-2 border-transparent focus:border-blue-500 appearance-none cursor-pointer"
                                            >
                                                {GEMINI_VOICES.map(v => <option key={v.id} value={v.id} className="bg-white dark:bg-zinc-900">{v.name}</option>)}
                                            </select>
                                        </div>
                                        <button 
                                          onClick={() => previewVoice(settings.voiceName)}
                                          disabled={isPreviewingVoice}
                                          className="p-4 bg-zinc-100 dark:bg-white/5 rounded-2xl text-blue-500 hover:bg-blue-500 hover:text-white transition-all disabled:opacity-30 flex items-center justify-center min-w-[50px]"
                                        >
                                          {isPreviewingVoice ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between">
                    <button onClick={handleLogOut} className="text-[10px] md:text-xs font-black text-rose-500 uppercase tracking-widest hover:underline">Log Out</button>
                    <button onClick={() => setIsProfileModalOpen(false)} className="px-8 md:px-12 py-3 md:py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl md:rounded-[2rem] font-black text-xs md:text-lg transition-all active:scale-[0.98] shadow-2xl">Confirm Vibe</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
