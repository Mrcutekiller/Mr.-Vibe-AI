
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Waves, Volume2, LogIn, UserPlus, ArrowRight, ArrowLeft, 
  User as UserIcon, CheckCircle2, Mail, Lock, Sparkles, 
  ChevronRight, MicOff, MessageSquare, AlertCircle, AlertTriangle, RefreshCw,
  Camera, FileText, Upload, Loader2, Play, Image as ImageIcon, Globe,
  Leaf, Droplets, Share2, ThumbsUp, ThumbsDown, Edit3, Check
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES, SUPPORTED_LANGUAGES } from './constants';
import { PersonalityId, AppSettings, User, ChatSession, Message, ReactionType } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';
import { decode, decodeAudioData } from './utils/audioUtils';

// --- Helper Functions ---
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const TypingIndicator = () => (
  <div className="flex justify-start w-full animate-slide-up">
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
    <div className="relative flex items-center justify-center transition-all duration-500">
      <div className={`absolute inset-0 bg-blue-500/30 blur-[60px] md:blur-[100px] rounded-full transition-transform duration-700 ${active ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}`} />
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

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_active_user'));
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  
  const [accounts, setAccounts] = useState<User[]>(() => {
    const saved = localStorage.getItem('mr_vibe_accounts');
    return saved ? JSON.parse(saved) : [];
  });

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('mr_vibe_active_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [emailValidationError, setEmailValidationError] = useState<string | null>(null);
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
  const [liveTranscript, setLiveTranscript] = useState<{text: string, isModel: boolean}[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const currentPersonality = PERSONALITIES[settings.personalityId];

  // --- Functions ---

  const handleAISpeakFirst = async (sessionId: string) => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}
      - Personality: ${currentPersonality.name}
      - Context: ${currentPersonality.prompt}
      - User: ${user?.userName}
      - Language Setting: ${settings.language}
      - Task: You are starting a new conversation. Greet the user for the first time in ${settings.language} using your personality. Be extremely cute and friendly.
      `;

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text: "Hello! Introduce yourself to me." }] }],
          config: { systemInstruction: fullSystemPrompt }
      });

      const aiMessage: Message = { 
        id: `ai-greet-${Date.now()}`, 
        role: 'model', 
        text: response.text || 'Hey there! Let’s vibe! ✨', 
        timestamp: Date.now() 
      };

      setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: [...s.messages, aiMessage],
          lastTimestamp: Date.now()
      } : s));
    } catch (error) {
       console.error("Greeting Error:", error);
       setErrorMessage("Vibe failure. Make sure your API_KEY is set in Vercel! ⚡");
    } finally { setIsLoading(false); }
  };

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
    
    // AI greets first
    setTimeout(() => handleAISpeakFirst(newId), 300);
    
    return newId;
  };

  const handleReaction = (messageId: string, type: ReactionType) => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => s.id === activeSessionId ? {
      ...s,
      messages: s.messages.map(m => m.id === messageId ? { 
        ...m, 
        reaction: m.reaction === type ? null : type 
      } : m)
    } : s));
  };

  const handleUpdateUserName = (newName: string) => {
    if (!user) return;
    const updatedUser = { ...user, userName: newName };
    setUser(updatedUser);
    setAccounts(prev => prev.map(a => a.email === user.email ? updatedUser : a));
  };

  const previewVoice = async (voiceId: string) => {
    if (isPreviewingVoice) return;
    setIsPreviewingVoice(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const text = `Vibe check! I'm using the ${voiceId} voice. How do I sound?`;
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

  const { connect: connectLive, disconnect: disconnectLive, sendMessage: liveSendMessage, isLive, isConnecting, volume } = useGeminiLive({
    personality: currentPersonality,
    settings,
    user: user || { userName: 'Friend', email: '', age: '', gender: 'Other', avatarUrl: AVATARS[0] },
    onTranscript: (text, isModel) => {
        setLiveTranscript(prev => {
            const last = prev[prev.length - 1];
            if (last && last.isModel === isModel) {
              return [...prev.slice(0, -1), { text: last.text + text, isModel }];
            }
            return [...prev, { text, isModel }];
        });
    },
    onTurnComplete: (userText, modelText) => {
        setLiveTranscript([]);
        const sessionId = activeSessionId || handleNewChat();
        
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: [
            ...s.messages,
            ...(userText.trim() ? [{ id: `u-${Date.now()}`, role: 'user' as const, text: userText, timestamp: Date.now() }] : []),
            ...(modelText.trim() ? [{ id: `m-${Date.now() + 1}`, role: 'model' as const, text: modelText, timestamp: Date.now() + 1 }] : [])
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

  // Persistence and Logic Effects
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
        if (sessions.length === 0) handleNewChat();
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('mr_vibe_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) localStorage.setItem('mr_vibe_active_session_id', activeSessionId);
  }, [activeSessionId]);

  // Auto-scroll
  useEffect(() => {
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 150);
    return () => clearTimeout(timer);
  }, [messages, liveTranscript, isLoading, activeSessionId, isLive]);

  const handleLogOut = () => {
    if (confirm("Sign out of Mr. Vibe AI?")) {
      setUser(null);
      setActiveSessionId(null);
      setIsNewUser(true);
      if (isLive) disconnectLive();
      setIsProfileModalOpen(false);
      localStorage.removeItem('mr_vibe_active_user');
    }
  };

  const handleSendToAI = async (text: string, fileData?: { data: string, mimeType: string, fileName: string }) => {
    if ((!text.trim() && !fileData) || isLoading) return;
    const sessionId = activeSessionId || handleNewChat();
    
    if (isLive && !fileData) {
      liveSendMessage(text);
      setInputText('');
      return;
    }

    const isImage = fileData?.mimeType.startsWith('image/');
    const userMessage: Message = { 
      id: `user-${Date.now()}`, 
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
    setErrorMessage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}
      - Personality: ${currentPersonality.name}
      - Context: ${currentPersonality.prompt}
      - User Context: ${user?.userName}
      - Language Setting: ${settings.language}
      `;

      const parts: any[] = [{ text: text || "Hey, check this out!" }];
      if (fileData) {
        parts.push({ inlineData: { data: fileData.data, mimeType: fileData.mimeType } });
      }

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts }],
          config: { systemInstruction: fullSystemPrompt }
      });

      setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: [...s.messages, { id: `ai-${Date.now()}`, role: 'model', text: response.text || '...', timestamp: Date.now() }]
      } : s));
    } catch (error) {
       console.error(error);
       setErrorMessage("Vibe failure. Is your API_KEY correct in Vercel? ⚡");
    } finally { setIsLoading(false); }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(id);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleEmailChange = (val: string) => {
    setCredentials({...credentials, email: val});
    setErrorMessage(null);
    if (val && !validateEmail(val)) {
      setEmailValidationError("Please enter a valid email address (e.g., user@example.com)");
    } else {
      setEmailValidationError(null);
    }
  };

  if (isNewUser) {
    return (
        <div className="fixed inset-0 z-[200] bg-zinc-50 dark:bg-[#030303] flex items-center justify-center p-4 md:p-6 overflow-y-auto transition-colors duration-500">
            <div className="w-full max-w-lg bg-white/90 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/10 p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-scale-in">
                {onboardingStep === 1 ? (
                    <div className="text-center space-y-8 animate-slide-up">
                        <div className="w-20 h-20 md:w-28 md:h-28 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-[1.8rem] md:rounded-[2.8rem] mx-auto shadow-2xl flex items-center justify-center animate-float group">
                            {authMode === 'signup' ? <UserPlus size={40} className="text-white group-hover:scale-110 transition-transform" /> : <LogIn size={40} className="text-white group-hover:scale-110 transition-transform" />}
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-zinc-900 dark:text-white italic">Mr. Vibe AI</h1>
                            <p className="text-zinc-500 text-sm md:text-base font-medium">Your companion in the digital void.</p>
                        </div>
                        
                        {errorMessage && (
                          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 animate-bounce">
                            <AlertCircle size={16}/> {errorMessage}
                          </div>
                        )}

                        <div className="space-y-4 text-left">
                            <div className="relative group">
                                <Mail className={`absolute left-5 top-1/2 -translate-y-1/2 transition-all duration-300 ${emailValidationError ? 'text-red-500 scale-110' : 'text-zinc-400 group-focus-within:text-blue-500'}`} size={20} />
                                <input 
                                    type="email" 
                                    placeholder="Email address" 
                                    value={credentials.email}
                                    onChange={e => handleEmailChange(e.target.value)}
                                    className={`w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl md:rounded-[2rem] py-5 md:py-6 pl-14 md:pl-16 pr-6 font-bold outline-none border-2 transition-all duration-300 text-zinc-900 dark:text-white text-sm md:text-base ${emailValidationError ? 'border-red-500 bg-red-500/5' : 'border-transparent focus:border-blue-500'}`} 
                                />
                                {emailValidationError && (
                                  <p className="mt-2 ml-4 text-[10px] md:text-xs font-bold text-red-500 animate-slide-up">
                                    {emailValidationError}
                                  </p>
                                )}
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                                <input 
                                    type="password" 
                                    placeholder="Secure password" 
                                    value={credentials.password}
                                    onChange={e => { setCredentials({...credentials, password: e.target.value}); setErrorMessage(null); }}
                                    className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl md:rounded-[2rem] py-5 md:py-6 pl-14 md:pl-16 pr-6 font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all text-zinc-900 dark:text-white text-sm md:text-base" 
                                />
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <button 
                                onClick={() => {
                                  if (!validateEmail(credentials.email)) { setErrorMessage("Enter a real email! 📧"); return; }
                                  if (!credentials.password || credentials.password.length < 4) { setErrorMessage("Password too short! 🔒"); return; }
                                  authMode === 'signup' ? setOnboardingStep(2) : (accounts.find(a => a.email === credentials.email) ? setUser(accounts.find(a => a.email === credentials.email)!) : setErrorMessage("No account here! ✨"));
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-500 hover:scale-[1.02] active:scale-95 text-white py-5 md:py-6 rounded-2xl md:rounded-[2rem] font-black text-base md:text-xl transition-all shadow-[0_10px_25px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                                disabled={!!emailValidationError}
                            >
                                {authMode === 'signup' ? <><UserPlus size={22}/> Create Account</> : <><LogIn size={22}/> Log In</>}
                            </button>
                            <button 
                                onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setErrorMessage(null); setEmailValidationError(null); }}
                                className="text-zinc-500 font-bold hover:text-blue-500 hover:scale-105 active:scale-95 transition-all text-xs md:text-sm uppercase tracking-widest"
                            >
                                {authMode === 'signup' ? "Got an account? Log in" : "New vibe? Sign up"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 md:space-y-12 animate-slide-in-right">
                        <button onClick={() => setOnboardingStep(1)} className="flex items-center gap-2 text-zinc-500 font-bold hover:text-blue-500 hover:-translate-x-1 transition-all text-xs md:text-sm uppercase tracking-widest">
                            <ArrowLeft size={16} /> Back
                        </button>
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl md:text-4xl font-black tracking-tighter text-zinc-900 dark:text-white italic">Profile Identity</h2>
                            <p className="text-zinc-500 text-sm md:text-base">Choose how you look to Mr. Cute.</p>
                        </div>
                        <div className="grid grid-cols-5 gap-3 md:gap-4 overflow-x-auto pb-4 custom-scrollbar px-1">
                            {AVATARS.map((url, i) => (
                                <button key={i} onClick={() => setTempProfile({...tempProfile, avatarUrl: url})} className={`relative flex-shrink-0 w-12 h-12 md:w-20 md:h-20 rounded-2xl overflow-hidden transition-all duration-300 transform ${tempProfile.avatarUrl === url ? 'ring-4 ring-blue-500 scale-110 shadow-xl' : 'opacity-40 hover:opacity-100 hover:scale-105 bg-zinc-100 dark:bg-zinc-800'}`}>
                                    <img src={url} className="w-full h-full" alt="Avatar" />
                                </button>
                            ))}
                        </div>
                        <div className="space-y-6">
                            <div className="relative group">
                                <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                                <input 
                                    type="text" 
                                    placeholder="What should I call you?" 
                                    value={tempProfile.userName}
                                    onChange={e => setTempProfile({...tempProfile, userName: e.target.value})}
                                    className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl md:rounded-[2rem] py-5 md:py-6 pl-14 md:pl-16 pr-6 font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all text-zinc-900 dark:text-white text-sm md:text-base" 
                                />
                            </div>
                            <button 
                                onClick={() => {
                                  if (!tempProfile.userName?.trim()) { setErrorMessage("What's your name? ✨"); return; }
                                  const newUser: User = { 
                                      email: credentials.email, 
                                      userName: tempProfile.userName, 
                                      avatarUrl: tempProfile.avatarUrl || AVATARS[0], 
                                      age: '18', 
                                      gender: 'Other' 
                                  };
                                  setAccounts([...accounts, newUser]);
                                  setUser(newUser);
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-500 hover:scale-[1.02] active:scale-95 text-white py-5 md:py-6 rounded-2xl md:rounded-[2rem] font-black text-base md:text-xl transition-all shadow-[0_10px_25px_rgba(37,99,235,0.4)] flex items-center justify-center gap-3"
                            >
                                Let's Vibe <ArrowRight size={22}/>
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
        <div className="fixed inset-0 z-[300] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-between p-4 md:p-8 animate-fade-in">
          <div className="w-full flex justify-end">
            <button onClick={disconnectLive} className="p-4 bg-white/10 hover:bg-white/20 hover:rotate-90 rounded-full transition-all active:scale-90">
                <X size={24} className="text-white" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center w-full gap-8 md:gap-12">
            <FluidOrb volume={volume} active={isLive} />
            <div className="text-center max-w-xl space-y-4">
              <h2 className="text-2xl md:text-5xl font-black tracking-tighter text-white animate-pulse">
                {isConnecting ? "Connecting..." : currentPersonality.name}
              </h2>
              {liveTranscript.slice(-1).map((t, i) => (
                <p key={i} className={`text-lg md:text-2xl font-bold italic animate-slide-up ${t.isModel ? 'text-blue-400' : 'text-zinc-500'}`}>
                  "{t.text}"
                </p>
              ))}
            </div>
          </div>
          <div className="w-full flex flex-col items-center gap-4 pb-4">
             <button onClick={disconnectLive} className="flex items-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-500 hover:scale-105 text-white rounded-[2rem] font-black text-sm transition-all active:scale-95 shadow-2xl">
                <MicOff size={18} /> End Session
             </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[160] w-80 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/5 transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:relative shadow-2xl md:shadow-none`}>
        <div className="flex flex-col h-full">
            <div className="p-8 flex items-center justify-between">
                <h2 className="text-2xl font-black italic tracking-tighter uppercase text-zinc-900 dark:text-white">Memories</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-white/5 hover:rotate-90 rounded-xl md:hidden transition-all">
                    <X size={20} className="text-zinc-900 dark:text-white" />
                </button>
            </div>
            <div className="px-8 pb-6">
                <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-3 bg-zinc-900 dark:bg-white text-white dark:text-black py-4 rounded-xl font-black transition-all hover:scale-[1.02] active:scale-95 shadow-xl text-sm group">
                    <Plus size={18} className="group-hover:rotate-180 transition-all duration-500" /> New Vibe
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-2 custom-scrollbar">
                {sessions.map(s => (
                    <div 
                        key={s.id} onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }}
                        className={`group relative p-4 rounded-3xl cursor-pointer transition-all duration-300 border animate-fade-in ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-500/30 scale-[1.02] shadow-md' : 'hover:bg-zinc-100 dark:hover:bg-white/5 border-transparent hover:scale-[1.01]'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-blue-500/10 transition-colors">
                                <MessageSquare size={16} className={activeSessionId === s.id ? 'text-blue-500' : 'text-zinc-400 group-hover:text-blue-400'} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`font-bold text-xs truncate transition-colors ${activeSessionId === s.id ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-300'}`}>{s.title || "Vibe Session"}</p>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{new Date(s.lastTimestamp).toLocaleDateString()}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setSessions(sessions.filter(ses => ses.id !== s.id)); if (activeSessionId === s.id) setActiveSessionId(null); }} className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-red-500 transition-all hover:scale-125">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-8 border-t border-zinc-100 dark:border-white/5">
                <button onClick={handleLogOut} className="w-full py-4 text-[10px] text-zinc-400 hover:text-red-500 font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Sign Out</button>
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative h-full">
        <header className="px-4 md:px-8 py-4 md:py-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between backdrop-blur-xl bg-white/50 dark:bg-black/50 sticky top-0 z-[100] transition-colors duration-500">
            <div className="flex items-center gap-2 md:gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 hover:scale-110 active:scale-90 rounded-xl md:hidden transition-all">
                    <Menu size={18} className="text-zinc-900 dark:text-white" />
                </button>
                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setIsProfileModalOpen(true)}>
                    <div className="relative">
                      <img src={user?.avatarUrl} className="w-10 h-10 md:w-11 md:h-11 rounded-xl border-2 border-white dark:border-zinc-800 shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-300" alt="Profile" />
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 border-2 border-white dark:border-black rounded-full animate-pulse" />
                    </div>
                    <div className="hidden xs:block">
                        <h1 className="text-sm md:text-base font-black tracking-tighter leading-none text-zinc-900 dark:text-white group-hover:text-blue-500 transition-colors">{user?.userName}</h1>
                        <p className="text-[8px] md:text-[10px] font-black text-blue-500 uppercase tracking-widest mt-0.5">Vibe Partner</p>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center gap-2 px-3 md:px-5 py-2.5 md:py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-black text-[10px] md:text-xs transition-all hover:scale-105 active:scale-95 group shadow-lg truncate max-w-[120px] md:max-w-none">
                    <Sparkles size={12} className="text-blue-500 group-hover:animate-spin flex-shrink-0" /> {currentPersonality.name}
                </button>
                <button onClick={connectLive} className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-xl hover:scale-110 active:scale-90 animate-pulse-slow">
                    <Mic size={18} />
                </button>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-12 py-10 custom-scrollbar bg-zinc-50 dark:bg-black relative transition-colors duration-500">
            <div className="max-w-3xl mx-auto flex flex-col gap-8">
                {errorMessage && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-xs font-black flex items-center gap-2 animate-slide-up shadow-lg">
                    <AlertTriangle size={16} /> {errorMessage}
                    <button onClick={() => setErrorMessage(null)} className="ml-auto opacity-50 hover:opacity-100 hover:scale-125 transition-all"><X size={14} /></button>
                  </div>
                )}

                {messages.length === 0 && !isLoading ? (
                    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center space-y-8 animate-scale-in duration-1000">
                        <Waves size={48} className="text-blue-500 animate-float" />
                        <div className="space-y-2 px-4">
                            <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-zinc-900 dark:text-white leading-tight">Start the Vibe.</h2>
                            <p className="text-sm font-medium text-zinc-500 max-w-sm mx-auto leading-relaxed">
                                I'm Mr. Cute. Born to vibe. Talk to me!
                            </p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                            <div className={`max-w-[92%] md:max-w-[80%] rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-6 shadow-lg relative transition-all duration-500 hover:shadow-2xl hover:scale-[1.01]
                                ${msg.reaction === 'eco' ? 'border-2 border-green-500/50 bg-green-50/10 dark:bg-green-900/10' : ''} 
                                ${msg.reaction === 'pee' ? 'border-2 border-yellow-500/50 bg-yellow-50/10 dark:bg-yellow-900/10' : ''} 
                                ${msg.reaction === 'like' ? 'border-2 border-blue-500/50' : ''}
                                ${msg.reaction === 'dislike' ? 'border-2 border-red-500/50' : ''}
                                ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none shadow-blue-500/20' : 'bg-white dark:bg-zinc-800/60 dark:text-white text-zinc-900 border border-zinc-100 dark:border-white/5 rounded-bl-none shadow-black/5'}`}>
                                {msg.image && (
                                  <div className="mb-4 rounded-2xl overflow-hidden shadow-lg animate-scale-in">
                                    <img src={msg.image} alt="Vibe Content" className="w-full h-auto object-contain max-h-[300px] hover:scale-105 transition-transform duration-700" />
                                  </div>
                                )}
                                <p className="text-sm md:text-lg font-bold leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                
                                {/* Reaction Buttons */}
                                <div className={`mt-4 flex items-center gap-2 border-t pt-3 transition-all duration-300 ${msg.role === 'user' ? 'border-white/10 opacity-60' : 'border-black/5 dark:border-white/5 opacity-40 hover:opacity-100'}`}>
                                  <button onClick={() => handleReaction(msg.id, 'eco')} className={`p-2 rounded-lg transition-all hover:scale-125 active:scale-90 ${msg.reaction === 'eco' ? 'text-green-500 bg-green-500/20' : 'text-zinc-400 hover:text-green-500'}`} title="Eco Vibe">
                                    <Leaf size={14} />
                                  </button>
                                  <button onClick={() => handleReaction(msg.id, 'pee')} className={`p-2 rounded-lg transition-all hover:scale-125 active:scale-90 ${msg.reaction === 'pee' ? 'text-yellow-500 bg-yellow-500/20' : 'text-zinc-400 hover:text-yellow-500'}`} title="Pee Vibe">
                                    <Droplets size={14} />
                                  </button>
                                  <button onClick={() => copyToClipboard(msg.text, msg.id)} className={`p-2 rounded-lg transition-all hover:scale-125 active:scale-90 ${copyFeedback === msg.id ? 'text-blue-500 bg-blue-500/10' : 'text-zinc-400 hover:text-blue-500'}`} title="Share">
                                    {copyFeedback === msg.id ? <Check size={14} className="animate-scale-in" /> : <Share2 size={14} />}
                                  </button>
                                  <div className="flex-1" />
                                  <button onClick={() => handleReaction(msg.id, 'like')} className={`p-2 rounded-lg transition-all hover:scale-125 active:scale-90 ${msg.reaction === 'like' ? 'text-blue-500 bg-blue-500/20' : 'text-zinc-400 hover:text-blue-500'}`} title="Like">
                                    <ThumbsUp size={14} />
                                  </button>
                                  <button onClick={() => handleReaction(msg.id, 'dislike')} className={`p-2 rounded-lg transition-all hover:scale-125 active:scale-90 ${msg.reaction === 'dislike' ? 'text-red-500 bg-red-500/20' : 'text-zinc-400 hover:text-red-500'}`} title="Dislike">
                                    <ThumbsDown size={14} />
                                  </button>
                                </div>
                                <div className="mt-2 text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-40">
                                    {msg.role === 'user' ? 'You' : `${currentPersonality.name}`} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                {liveTranscript.map((t, i) => (
                    <div key={`live-${i}`} className={`flex w-full ${t.isModel ? 'justify-start' : 'justify-end'} animate-slide-up`}>
                        <div className={`max-w-[80%] rounded-[2rem] p-4 italic font-medium transition-all ${t.isModel ? 'bg-zinc-100 dark:bg-white/5 text-blue-500 shadow-sm' : 'bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'}`}>
                            {t.text}
                        </div>
                    </div>
                ))}
                {isLoading && <TypingIndicator />}
                <div ref={bottomRef} className="h-20 w-full" />
            </div>
        </main>

        <footer className="px-3 md:px-12 py-4 md:py-6 border-t border-zinc-100 dark:border-white/5 bg-white/80 dark:bg-black/80 backdrop-blur-3xl sticky bottom-0 transition-colors duration-500">
            <div className="max-w-3xl mx-auto flex items-center gap-2 md:gap-3">
                <div className="flex-1 bg-zinc-100 dark:bg-white/5 flex items-center rounded-[2rem] px-4 md:px-6 border-2 border-transparent focus-within:border-blue-500 focus-within:shadow-xl transition-all duration-300 shadow-inner overflow-hidden">
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-zinc-400 hover:text-blue-500 hover:scale-125 transition-all flex-shrink-0" title="Upload Media"><ImageIcon size={18} md:size={20} /></button>
                    <input type="file" accept="application/pdf,image/*" ref={fileInputRef} className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          const base64Data = (reader.result as string).split(',')[1];
                          handleSendToAI("", { data: base64Data, mimeType: file.type, fileName: file.name });
                        };
                        reader.readAsDataURL(file);
                      }
                    }} />
                    <input 
                      type="text" 
                      placeholder="Type your vibe..." 
                      value={inputText} 
                      onChange={e => setInputText(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} 
                      className="w-full bg-transparent border-none py-4 md:py-5 text-sm md:text-base font-bold outline-none pl-2 text-zinc-900 dark:text-white placeholder-zinc-400" 
                    />
                </div>
                <button onClick={() => handleSendToAI(inputText)} disabled={!inputText.trim() || isLoading} className="p-4 md:p-5 bg-blue-600 hover:bg-blue-500 hover:scale-110 active:scale-90 text-white rounded-[1.8rem] shadow-2xl transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center min-w-[56px] md:min-w-[64px] group">
                    {isLoading ? <Loader2 size={18} md:size={20} className="animate-spin" /> : <Send size={18} md:size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                </button>
            </div>
        </footer>
      </div>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-end md:items-center justify-center p-0 md:p-6 overflow-hidden">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-fade-in" onClick={() => setIsProfileModalOpen(false)} />
            <div className="relative w-full md:max-w-3xl bg-white dark:bg-zinc-900 border-t md:border border-zinc-200 dark:border-white/10 rounded-t-[2.5rem] md:rounded-[3.5rem] p-6 md:p-12 shadow-3xl animate-slide-up duration-400 h-[90dvh] md:h-auto md:max-h-[95vh] flex flex-col">
                <div className="flex justify-between items-center mb-6 md:mb-10">
                    <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white">Vibe Config</h2>
                    <button onClick={() => setIsProfileModalOpen(false)} className="p-2.5 md:p-3 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:rotate-90 rounded-2xl transition-all"><X size={20} className="text-zinc-900 dark:text-white" /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar md:pr-4 space-y-8 md:space-y-10 pb-20 md:pb-8 px-1">
                    <div className="flex flex-col items-center gap-6">
                        <div className="relative group">
                          <img src={user?.avatarUrl} className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl border-4 border-white dark:border-zinc-800 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500" alt="Avatar" />
                          <div className="absolute inset-0 bg-blue-500/20 rounded-[2rem] md:rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </div>
                        <div className="w-full max-w-xs space-y-3 text-center">
                            <input 
                              type="text" 
                              value={user?.userName} 
                              onChange={(e) => handleUpdateUserName(e.target.value)} 
                              placeholder="Username" 
                              className="w-full bg-zinc-100 dark:bg-white/5 rounded-2xl py-3.5 md:py-4 px-6 font-black text-center outline-none border-2 border-transparent focus:border-blue-500 focus:shadow-lg transition-all text-zinc-900 dark:text-white" 
                            />
                            <div className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-white/5 rounded-full hover:bg-blue-500/5 transition-colors group">
                                <Mail size={12} className="text-zinc-400 group-hover:text-blue-500" />
                                <p className="text-[10px] font-black text-zinc-500 uppercase truncate max-w-[150px] md:max-w-none">{user?.email}</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                        <div className="space-y-4">
                            <label className="text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-400 ml-4">Personality Vibe</label>
                            <div className="grid grid-cols-1 gap-2 max-h-[300px] md:max-h-60 overflow-y-auto pr-1 md:pr-2 custom-scrollbar p-1">
                                {Object.values(PERSONALITIES).map(p => (
                                    <button key={p.id} onClick={() => setSettings({...settings, personalityId: p.id})} className={`flex items-center gap-3 p-3.5 md:p-4 rounded-2xl border-2 transition-all transform ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-[1.03]' : 'bg-zinc-100 dark:bg-white/5 border-transparent hover:bg-zinc-200 dark:hover:bg-white/10 hover:translate-x-1 text-left text-zinc-900 dark:text-white'}`}>
                                        <span className={`text-xl transition-transform duration-500 ${settings.personalityId === p.id ? 'scale-125' : ''}`}>{p.emoji}</span>
                                        <div className="truncate">
                                          <p className="font-black text-[11px] md:text-xs leading-tight">{p.name}</p>
                                          <p className="text-[9px] md:text-[10px] opacity-70 truncate">{p.description}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <label className="text-[10px] md:text-xs font-black uppercase tracking-widest text-zinc-400 ml-4">Settings</label>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3.5 md:p-4 bg-zinc-100 dark:bg-white/5 rounded-2xl hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors">
                                        <div className="flex items-center gap-3 text-zinc-900 dark:text-white transition-all transform group-hover:scale-105">{settings.theme === 'dark' ? <Moon size={16} className="text-blue-400" /> : <Sun size={16} className="text-yellow-500" />}<span className="font-bold text-[11px] md:text-xs">Dark Mode</span></div>
                                        <button onClick={() => setSettings({...settings, theme: settings.theme === 'dark' ? 'light' : 'dark'})} className={`w-11 md:w-12 h-6 md:h-7 rounded-full relative transition-all duration-500 ${settings.theme === 'dark' ? 'bg-blue-600' : 'bg-zinc-300'}`}><div className={`absolute top-0.5 md:top-1 w-5 h-5 bg-white rounded-full transition-all duration-500 shadow-md ${settings.theme === 'dark' ? 'left-5 md:left-6' : 'left-0.5 md:left-1'}`} /></button>
                                    </div>
                                    <select value={settings.language} onChange={e => setSettings({...settings, language: e.target.value})} className="w-full bg-zinc-100 dark:bg-white/5 rounded-2xl py-3.5 md:py-4 px-6 font-black text-[11px] md:text-xs outline-none appearance-none cursor-pointer text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors">
                                        {SUPPORTED_LANGUAGES.map(lang => <option key={lang.code} value={lang.code} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">{lang.name}</option>)}
                                    </select>
                                    <div className="flex items-center gap-2">
                                        <select value={settings.voiceName} onChange={e => setSettings({...settings, voiceName: e.target.value})} className="flex-1 bg-zinc-100 dark:bg-white/5 rounded-2xl py-3.5 md:py-4 px-6 font-black text-[11px] md:text-xs outline-none appearance-none cursor-pointer text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors">
                                            {GEMINI_VOICES.map(v => <option key={v.id} value={v.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">{v.name}</option>)}
                                        </select>
                                        <button onClick={() => previewVoice(settings.voiceName)} disabled={isPreviewingVoice} className="p-3.5 md:p-4 bg-zinc-100 dark:bg-white/5 rounded-2xl text-blue-500 hover:bg-blue-500 hover:text-white hover:scale-110 active:scale-90 transition-all shadow-md">
                                            {isPreviewingVoice ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 md:relative border-t md:border-none bg-white dark:bg-zinc-900 flex flex-col md:flex-row items-center justify-between gap-4 border-zinc-100 dark:border-white/5">
                    <button onClick={handleLogOut} className="text-[10px] md:text-xs font-black text-rose-500 uppercase tracking-widest hover:underline hover:scale-105 transition-all order-2 md:order-1">Log Out Account</button>
                    <button onClick={() => setIsProfileModalOpen(false)} className="w-full md:w-auto px-10 md:px-12 py-4 md:py-5 bg-blue-600 hover:bg-blue-500 hover:scale-[1.03] active:scale-95 text-white rounded-[2rem] font-black text-base md:text-lg transition-all shadow-2xl order-1 md:order-2">Confirm Vibe</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
