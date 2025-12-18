
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Waves, Volume2, LogIn, UserPlus, ArrowRight, ArrowLeft, 
  User as UserIcon, CheckCircle2, Mail, Lock, Sparkles, 
  ChevronRight, MicOff, MessageSquare, AlertCircle, AlertTriangle, RefreshCw,
  Camera, FileText, Upload, Loader2, Play, Image as ImageIcon, Globe,
  Leaf, Droplets, Share2, ThumbsUp, ThumbsDown, Edit3, Check, Zap, ExternalLink, Activity
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES, SUPPORTED_LANGUAGES } from './constants';
import { PersonalityId, AppSettings, User, ChatSession, Message, ReactionType, GroundingSource, ApiStatus } from './types';
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
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3>(1);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isVibeGenerating, setIsVibeGenerating] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  
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
    personalityId: PersonalityId.FUNNY
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

  // --- API Connection Check ---
  const checkApiConnection = async () => {
    setApiStatus('checking');
    try {
      if (!process.env.API_KEY) {
        setApiStatus('error');
        return;
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Minor lightweight call to verify key
      await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: "hi" }] }],
        config: { maxOutputTokens: 1, thinkingConfig: { thinkingBudget: 0 } }
      });
      setApiStatus('connected');
    } catch (error) {
      console.error("API Status Check Failed:", error);
      setApiStatus('error');
    }
  };

  useEffect(() => {
    checkApiConnection();
    // Re-check periodically
    const interval = setInterval(checkApiConnection, 60000);
    return () => clearInterval(interval);
  }, []);

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
      - Task: Greet the user in character. Be warm.
      `;

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text: "Introduce yourself to me." }] }],
          config: { systemInstruction: fullSystemPrompt, thinkingConfig: { thinkingBudget: 0 } }
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
       setErrorMessage("Vibe fail. Check API Key! ⚡");
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
    user: user || { userName: 'Friend', email: '', age: '', gender: 'Other', avatarUrl: AVATARS[0], personalityId: PersonalityId.FUNNY },
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

    const isImageGenerationRequested = text.toLowerCase().includes("generate") || text.toLowerCase().includes("show me a vibe") || text.toLowerCase().includes("create an image");

    const isInputImage = fileData?.mimeType.startsWith('image/');
    const userMessage: Message = { 
      id: `user-${Date.now()}`, 
      role: 'user', 
      text: fileData ? (isInputImage ? text : `📄 Document: ${fileData.fileName}\n${text}`) : text, 
      image: isInputImage ? `data:${fileData?.mimeType};base64,${fileData?.data}` : undefined,
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
      
      if (isImageGenerationRequested) {
        setIsVibeGenerating(true);
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: [{ parts: [{ text: `Generate a visual representation of this vibe: ${text}. Make it artistic, high-quality, and fitting for ${currentPersonality.name}.` }] }],
          config: { imageConfig: { aspectRatio: "1:1" } }
        });

        let generatedImage: string | undefined;
        for (const part of imageResponse.candidates[0].content.parts) {
          if (part.inlineData) {
            generatedImage = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }

        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: [...s.messages, { 
            id: `ai-img-${Date.now()}`, 
            role: 'model', 
            text: `Check out this vibe I cooked up for you! 🎨✨`, 
            image: generatedImage,
            timestamp: Date.now() 
          }]
        } : s));
        setIsVibeGenerating(false);
      } else {
        const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}
        - Personality: ${currentPersonality.name}
        - Context: ${currentPersonality.prompt}
        - User Context: ${user?.userName}
        - Language Setting: ${settings.language}
        - Rules: If user asks for facts or news, use Google Search.
        `;

        const parts: any[] = [{ text: text || "Hey, check this out!" }];
        if (fileData) {
          parts.push({ inlineData: { data: fileData.data, mimeType: fileData.mimeType } });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts }],
            config: { 
              systemInstruction: fullSystemPrompt,
              tools: [{ googleSearch: {} }] 
            }
        });

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        const sources: GroundingSource[] = groundingChunks?.map((chunk: any) => ({
          title: chunk.web?.title || 'Source',
          uri: chunk.web?.uri || '#'
        })).filter((s: any) => s.uri !== '#') || [];

        setSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s,
            messages: [...s.messages, { 
              id: `ai-${Date.now()}`, 
              role: 'model', 
              text: response.text || 'Thinking...', 
              timestamp: Date.now(),
              sources: sources.length > 0 ? sources : undefined
            }]
        } : s));
      }
    } catch (error) {
       console.error(error);
       setErrorMessage("Vibe failure. Is your API_KEY correct? ⚡");
    } finally { 
      setIsLoading(false); 
      setIsVibeGenerating(false);
    }
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
      setEmailValidationError("Enter a valid email (user@example.com)");
    } else {
      setEmailValidationError(null);
    }
  };

  if (isNewUser) {
    return (
        <div className="fixed inset-0 z-[200] bg-zinc-50 dark:bg-[#030303] flex items-center justify-center p-4 overflow-y-auto transition-colors duration-500">
            <div className="w-full max-w-lg bg-white/90 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/10 p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] backdrop-blur-3xl shadow-2xl animate-scale-in">
                {onboardingStep === 1 ? (
                    <div className="text-center space-y-8 animate-slide-up">
                        <div className="w-20 h-20 md:w-28 md:h-28 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-[1.8rem] md:rounded-[2.8rem] mx-auto shadow-2xl flex items-center justify-center animate-float">
                            {authMode === 'signup' ? <UserPlus size={40} className="text-white" /> : <LogIn size={40} className="text-white" />}
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-zinc-900 dark:text-white italic">Mr. Vibe AI</h1>
                            <p className="text-zinc-500 text-sm font-medium">Your companion in the digital void.</p>
                        </div>
                        
                        {errorMessage && (
                          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-xs font-bold flex items-center justify-center gap-2">
                            <AlertCircle size={16}/> {errorMessage}
                          </div>
                        )}

                        <div className="space-y-4 text-left">
                            <div className="relative group">
                                <Mail className={`absolute left-5 top-1/2 -translate-y-1/2 ${emailValidationError ? 'text-red-500' : 'text-zinc-400 group-focus-within:text-blue-500'}`} size={20} />
                                <input 
                                    type="email" 
                                    placeholder="Email address" 
                                    value={credentials.email}
                                    onChange={e => handleEmailChange(e.target.value)}
                                    className={`w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 pl-14 font-bold outline-none border-2 transition-all text-zinc-900 dark:text-white ${emailValidationError ? 'border-red-500' : 'border-transparent focus:border-blue-500'}`} 
                                />
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500" size={20} />
                                <input 
                                    type="password" 
                                    placeholder="Secure password" 
                                    value={credentials.password}
                                    onChange={e => setCredentials({...credentials, password: e.target.value})}
                                    className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 pl-14 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white" 
                                />
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <button 
                                onClick={() => {
                                  if (!validateEmail(credentials.email)) { setErrorMessage("Enter a real email! 📧"); return; }
                                  if (credentials.password.length < 4) { setErrorMessage("Password too short! 🔒"); return; }
                                  authMode === 'signup' ? setOnboardingStep(2) : (accounts.find(a => a.email === credentials.email) ? setUser(accounts.find(a => a.email === credentials.email)!) : setErrorMessage("No account here! ✨"));
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white py-5 rounded-2xl font-black text-lg transition-all shadow-xl disabled:opacity-50"
                                disabled={!!emailValidationError}
                            >
                                {authMode === 'signup' ? "Create Account" : "Log In"}
                            </button>
                            <button onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')} className="text-zinc-500 font-bold hover:text-blue-500 text-xs uppercase tracking-widest">
                                {authMode === 'signup' ? "Got an account? Log in" : "New vibe? Sign up"}
                            </button>
                        </div>
                    </div>
                ) : onboardingStep === 2 ? (
                    <div className="space-y-8 animate-slide-in-right">
                        <button onClick={() => setOnboardingStep(1)} className="flex items-center gap-2 text-zinc-500 font-bold hover:text-blue-500 transition-all text-xs uppercase tracking-widest">
                            <ArrowLeft size={16} /> Back
                        </button>
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl md:text-4xl font-black italic text-zinc-900 dark:text-white">Profile Identity</h2>
                            <p className="text-zinc-500 text-sm">Choose how you look to Mr. Cute.</p>
                        </div>
                        <div className="grid grid-cols-5 gap-3 overflow-x-auto pb-4 custom-scrollbar">
                            {AVATARS.map((url, i) => (
                                <button key={i} onClick={() => setTempProfile({...tempProfile, avatarUrl: url})} className={`relative flex-shrink-0 w-12 h-12 md:w-20 md:h-20 rounded-2xl overflow-hidden transition-all ${tempProfile.avatarUrl === url ? 'ring-4 ring-blue-500 scale-110' : 'opacity-40 hover:opacity-100 bg-zinc-100 dark:bg-zinc-800'}`}>
                                    <img src={url} className="w-full h-full" alt="Avatar" />
                                </button>
                            ))}
                        </div>
                        <div className="space-y-6">
                            <input 
                                type="text" 
                                placeholder="What's your name?" 
                                value={tempProfile.userName}
                                onChange={e => setTempProfile({...tempProfile, userName: e.target.value})}
                                className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 px-6 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white" 
                            />
                            <button onClick={() => {
                                  if (!tempProfile.userName?.trim()) { setErrorMessage("What's your name? ✨"); return; }
                                  setOnboardingStep(3);
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white py-5 rounded-2xl font-black text-lg shadow-xl"
                            >
                                Next Step <ArrowRight size={22} className="inline ml-2"/>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-slide-in-right">
                        <button onClick={() => setOnboardingStep(2)} className="flex items-center gap-2 text-zinc-500 font-bold hover:text-blue-500 transition-all text-xs uppercase tracking-widest">
                            <ArrowLeft size={16} /> Back
                        </button>
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl md:text-4xl font-black italic text-zinc-900 dark:text-white">Match Your Vibe</h2>
                            <p className="text-zinc-500 text-sm">Choose who Mr. Cute will be for you.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                            {Object.values(PERSONALITIES).map(p => (
                                <button 
                                  key={p.id} 
                                  onClick={() => {
                                    setTempProfile({...tempProfile, personalityId: p.id});
                                    setSettings(prev => ({ ...prev, personalityId: p.id, voiceName: p.voiceName }));
                                  }} 
                                  className={`flex flex-col gap-2 p-4 rounded-2xl border-2 transition-all text-left ${tempProfile.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-[1.02]' : 'bg-zinc-100 dark:bg-white/5 border-transparent hover:bg-zinc-200 dark:hover:bg-white/10 dark:text-white'}`}
                                >
                                    <span className="text-2xl">{p.emoji}</span>
                                    <div>
                                      <p className="font-black text-xs">{p.name}</p>
                                      <p className="text-[10px] opacity-70 leading-tight mt-1">{p.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="pt-4">
                           <button onClick={() => {
                                  const newUser: User = { 
                                    email: credentials.email, 
                                    userName: tempProfile.userName || 'User', 
                                    avatarUrl: tempProfile.avatarUrl || AVATARS[0], 
                                    age: '18', 
                                    gender: 'Other',
                                    personalityId: tempProfile.personalityId || PersonalityId.FUNNY
                                  };
                                  setAccounts([...accounts, newUser]);
                                  setUser(newUser);
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white py-5 rounded-2xl font-black text-lg shadow-xl"
                            >
                                Start Vibe Exploration <CheckCircle2 size={22} className="inline ml-2"/>
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
      
      {/* Voice Space */}
      {(isLive || isConnecting) && (
        <div className="fixed inset-0 z-[300] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-between p-8 animate-fade-in">
          <div className="w-full flex justify-end">
            <button onClick={disconnectLive} className="p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all">
                <X size={24} className="text-white" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center w-full gap-8">
            <FluidOrb volume={volume} active={isLive} />
            <div className="text-center max-w-xl space-y-4">
              <h2 className="text-2xl md:text-5xl font-black text-white animate-pulse">
                {isConnecting ? "Waking up..." : currentPersonality.name}
              </h2>
              {liveTranscript.slice(-1).map((t, i) => (
                <p key={i} className={`text-lg md:text-2xl font-bold italic ${t.isModel ? 'text-blue-400' : 'text-zinc-500'}`}>
                  "{t.text}"
                </p>
              ))}
            </div>
          </div>
          <button onClick={disconnectLive} className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-[2rem] font-black shadow-2xl transition-all">
             <MicOff size={18} className="inline mr-2" /> End Vibe
          </button>
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[160] w-80 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/5 transition-transform duration-500 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:relative shadow-2xl md:shadow-none`}>
        <div className="flex flex-col h-full">
            <div className="p-8 flex items-center justify-between">
                <h2 className="text-2xl font-black italic tracking-tighter uppercase text-zinc-900 dark:text-white">Sessions</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="md:hidden"><X size={20}/></button>
            </div>
            <div className="px-8 pb-6">
                <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-3 bg-zinc-900 dark:bg-white text-white dark:text-black py-4 rounded-xl font-black shadow-xl">
                    <Plus size={18} /> New Vibe
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 space-y-2 custom-scrollbar">
                {sessions.map(s => (
                    <div key={s.id} onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }} className={`p-4 rounded-3xl cursor-pointer transition-all border ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-500/30 shadow-md' : 'hover:bg-zinc-100 dark:hover:bg-white/5 border-transparent'}`}>
                        <div className="flex items-center gap-3">
                            <MessageSquare size={16} className={activeSessionId === s.id ? 'text-blue-500' : 'text-zinc-400'} />
                            <p className={`font-bold text-xs truncate ${activeSessionId === s.id ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-300'}`}>{s.title}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        <header className="px-4 md:px-8 py-4 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-black/50 backdrop-blur-xl sticky top-0 z-[100]">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-zinc-100 dark:bg-white/5 rounded-xl md:hidden">
                    <Menu size={18} />
                </button>
                <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setIsProfileModalOpen(true)}>
                    <img src={user?.avatarUrl} className="w-10 h-10 rounded-xl border-2 dark:border-zinc-800" alt="Profile" />
                    <div className="hidden xs:block">
                        <h1 className="text-sm font-black text-zinc-900 dark:text-white leading-none">{user?.userName}</h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Verified</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'connected' ? 'bg-green-500 animate-pulse' : apiStatus === 'checking' ? 'bg-yellow-500 animate-bounce' : 'bg-red-500'} shadow-lg`} title={`API Status: ${apiStatus}`} />
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setIsProfileModalOpen(true)} className="px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-black text-xs shadow-lg flex items-center gap-2">
                    <Activity size={14} className={apiStatus === 'connected' ? 'text-green-500' : 'text-red-500'} />
                    {currentPersonality.name}
                </button>
                <button onClick={connectLive} className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xl animate-pulse-slow">
                    <Mic size={18} />
                </button>
            </div>
        </header>

        {apiStatus === 'error' && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md px-4 animate-slide-up">
            <div className="bg-red-500 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4">
              <AlertTriangle size={24} className="shrink-0" />
              <div>
                <p className="font-bold text-sm">Vibe Connection Lost</p>
                <p className="text-[10px] opacity-80 uppercase tracking-wider font-black">Verify your API Key environment variable.</p>
              </div>
              <button onClick={checkApiConnection} className="ml-auto p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 md:px-12 py-10 custom-scrollbar bg-zinc-50 dark:bg-black relative">
            <div className="max-w-3xl mx-auto flex flex-col gap-8">
                {messages.length === 0 && !isLoading ? (
                    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
                        <Waves size={48} className="text-blue-500 animate-float" />
                        <h2 className="text-3xl font-black text-zinc-900 dark:text-white">Mr. Cute is here.</h2>
                        <p className="text-sm font-medium text-zinc-500 max-w-sm">Personality Locked: <b>{currentPersonality.name}</b>. Born to vibe. Born to chill. What's on your mind?</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                            <div className={`max-w-[90%] md:max-w-[80%] rounded-[2rem] p-5 shadow-lg relative transition-all
                                ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-800/60 dark:text-white text-zinc-900 border dark:border-white/5 rounded-bl-none'}`}>
                                {msg.image && (
                                  <div className="mb-4 rounded-2xl overflow-hidden shadow-lg border dark:border-white/10">
                                    <img src={msg.image} alt="Vibe" className="w-full h-auto max-h-[400px] object-contain" />
                                  </div>
                                )}
                                <p className="text-sm md:text-lg font-bold leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                
                                {msg.sources && (
                                  <div className="mt-4 flex flex-wrap gap-2 border-t dark:border-white/10 pt-3">
                                    {msg.sources.map((src, idx) => (
                                      <a key={idx} href={src.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-white/5 hover:bg-blue-500/10 rounded-full transition-all group">
                                        <Globe size={10} className="text-blue-500" />
                                        <span className="text-[10px] font-black uppercase truncate max-w-[120px] dark:text-zinc-400 group-hover:text-blue-500">{src.title}</span>
                                        <ExternalLink size={8} className="text-zinc-400" />
                                      </a>
                                    ))}
                                  </div>
                                )}

                                <div className="mt-4 flex items-center gap-3 opacity-40 hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleReaction(msg.id, 'like')} className={`p-1 ${msg.reaction === 'like' ? 'text-blue-500' : ''}`}><ThumbsUp size={14}/></button>
                                  <button onClick={() => copyToClipboard(msg.text, msg.id)}><Share2 size={14}/></button>
                                  <div className="flex-1" />
                                  <span className="text-[10px] font-black uppercase tracking-tighter">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
                {isLoading && <TypingIndicator />}
                {isVibeGenerating && (
                  <div className="flex justify-start animate-slide-up">
                    <div className="p-6 bg-gradient-to-tr from-blue-600/10 to-indigo-600/10 dark:from-blue-600/5 dark:to-indigo-600/5 rounded-3xl border-2 border-dashed border-blue-500/30 flex flex-col items-center gap-4 w-full">
                       <div className="relative">
                          <Zap size={32} className="text-blue-500 animate-pulse" />
                          <Loader2 size={48} className="text-blue-500/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
                       </div>
                       <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500 animate-pulse">Brewing your visual vibe...</p>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} className="h-20" />
            </div>
        </main>

        <footer className="px-3 md:px-12 py-6 border-t border-zinc-100 dark:border-white/5 bg-white/80 dark:bg-black/80 backdrop-blur-3xl sticky bottom-0">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
                <div className="flex-1 bg-zinc-100 dark:bg-white/5 flex items-center rounded-[2rem] px-5 border-2 border-transparent focus-within:border-blue-500 transition-all shadow-inner">
                    <button onClick={() => fileInputRef.current?.click()} className="text-zinc-400 hover:text-blue-500"><ImageIcon size={20} /></button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => handleSendToAI("", { data: (reader.result as string).split(',')[1], mimeType: file.type, fileName: file.name });
                        reader.readAsDataURL(file);
                      }
                    }} />
                    <input 
                      type="text" 
                      placeholder="Type your vibe..." 
                      value={inputText} 
                      onChange={e => setInputText(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} 
                      className="w-full bg-transparent py-5 px-3 font-bold outline-none text-zinc-900 dark:text-white" 
                    />
                </div>
                <button onClick={() => handleSendToAI(inputText)} disabled={!inputText.trim() || isLoading || apiStatus !== 'connected'} className="p-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.8rem] shadow-2xl transition-all disabled:opacity-30">
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
            </div>
        </footer>
      </div>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setIsProfileModalOpen(false)} />
            <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-3xl animate-slide-up max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white">Vibe Config</h2>
                    <button onClick={() => setIsProfileModalOpen(false)} className="p-3 bg-zinc-100 dark:bg-white/5 rounded-2xl hover:rotate-90 transition-all"><X size={20}/></button>
                </div>
                
                <div className="space-y-10">
                    <div className="flex flex-col items-center gap-6">
                        <img src={user?.avatarUrl} className="w-24 h-24 md:w-32 md:h-32 rounded-[2.5rem] shadow-2xl border-4 border-white dark:border-zinc-800" alt="Avatar" />
                        <input type="text" value={user?.userName} onChange={(e) => handleUpdateUserName(e.target.value)} className="bg-zinc-100 dark:bg-white/5 rounded-2xl py-4 px-6 font-black text-center border-2 border-transparent focus:border-blue-500 transition-all text-zinc-900 dark:text-white" />
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Switch Personality</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.values(PERSONALITIES).map(p => (
                                <button key={p.id} onClick={() => setSettings({...settings, personalityId: p.id, voiceName: p.voiceName})} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl' : 'bg-zinc-100 dark:bg-white/5 border-transparent hover:bg-zinc-200 text-left dark:text-white'}`}>
                                    <span className="text-xl">{p.emoji}</span>
                                    <div>
                                      <p className="font-black text-xs">{p.name}</p>
                                      <p className="text-[10px] opacity-70 truncate leading-none mt-1">{p.description}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Audio & Visuals</label>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-center justify-between p-4 bg-zinc-100 dark:bg-white/5 rounded-2xl">
                                <span className="font-bold text-xs dark:text-white">Dark Mode</span>
                                <button onClick={() => setSettings({...settings, theme: settings.theme === 'dark' ? 'light' : 'dark'})} className={`w-12 h-6 rounded-full relative transition-all ${settings.theme === 'dark' ? 'bg-blue-600' : 'bg-zinc-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.theme === 'dark' ? 'left-7' : 'left-1'}`} /></button>
                            </div>
                            <div className="flex items-center gap-2">
                                <select value={settings.voiceName} onChange={e => setSettings({...settings, voiceName: e.target.value})} className="flex-1 bg-zinc-100 dark:bg-white/5 rounded-2xl py-4 px-6 font-black text-xs outline-none text-zinc-900 dark:text-white">
                                    {GEMINI_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                                <button onClick={() => previewVoice(settings.voiceName)} disabled={isPreviewingVoice} className="p-4 bg-zinc-100 dark:bg-white/5 rounded-2xl text-blue-500 hover:bg-blue-500 hover:text-white transition-all">
                                    {isPreviewingVoice ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <button onClick={handleLogOut} className="w-full py-4 text-[10px] text-rose-500 font-black uppercase tracking-[0.3em] hover:underline">Log Out Account</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
