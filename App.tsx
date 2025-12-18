
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Waves, Volume2, LogIn, UserPlus, ArrowRight, ArrowLeft, 
  User as UserIcon, CheckCircle2, Mail, Lock, Sparkles, 
  ChevronRight, MicOff, MessageSquare, AlertCircle, AlertTriangle, RefreshCw,
  Camera, FileText, Upload, Loader2, Play, Image as ImageIcon, Globe,
  Leaf, Droplets, Share2, ThumbsUp, ThumbsDown, Edit3, Check, Zap, ExternalLink, Activity, Key, Bell
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES, SUPPORTED_LANGUAGES } from './constants';
import { PersonalityId, AppSettings, User, ChatSession, Message, ReactionType, GroundingSource, ApiStatus } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';
import { decode, decodeAudioData } from './utils/audioUtils';

// --- Utility Functions ---

const validateEmail = (email: string) => {
  return String(email)
    .toLowerCase()
    .match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
};

// --- Branding Components ---

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
  <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[500] animate-vibe-in">
    <div className={`px-6 py-3 rounded-full shadow-2xl backdrop-blur-3xl border flex items-center gap-3 font-bold text-xs uppercase tracking-widest ${
      type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
      type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
      'bg-blue-500/10 border-blue-500/20 text-blue-500'
    }`}>
      {type === 'success' ? <Check size={14} /> : type === 'error' ? <AlertCircle size={14} /> : <Bell size={14} />}
      {message}
      <button onClick={onClose} className="ml-2 hover:opacity-50"><X size={14}/></button>
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
  const scale = 1 + (active ? volume * 2.2 : 0);
  return (
    <div className="relative flex items-center justify-center transition-all duration-500">
      <div className={`absolute inset-0 bg-blue-500/20 blur-[60px] md:blur-[100px] rounded-full transition-transform duration-700 ${active ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}`} />
      <div className="w-32 h-32 md:w-48 md:h-48 rounded-full relative overflow-hidden transition-all duration-300 shadow-[0_0_50px_rgba(59,130,246,0.3)]"
        style={{ transform: `scale(${scale})`, opacity: active ? 0.9 : 0.4, background: 'radial-gradient(circle at 30% 30%, #3b82f6, #6366f1, #1e40af)' }}>
        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent animate-spin-slow opacity-30" />
      </div>
      {active && [...Array(2)].map((_, i) => <div key={i} className="absolute inset-0 border-2 border-blue-400/20 rounded-full animate-ping" style={{ animationDelay: `${i * 0.5}s`, animationDuration: '3s' }} />)}
    </div>
  );
};

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_active_user'));
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3 | 4>(1);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [isVibeGenerating, setIsVibeGenerating] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const [toast, setToast] = useState<{message: string, type: 'info' | 'success' | 'error'} | null>(null);
  
  const [accounts, setAccounts] = useState<User[]>(() => JSON.parse(localStorage.getItem('mr_vibe_accounts') || '[]'));
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('mr_vibe_active_user') || 'null'));
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [tempProfile, setTempProfile] = useState<Partial<User>>({ userName: '', avatarUrl: AVATARS[0], personalityId: PersonalityId.FUNNY, apiKey: '' });
  const [settings, setSettings] = useState<AppSettings>(() => JSON.parse(localStorage.getItem('mr_vibe_settings') || '{"language":"English","theme":"dark","personalityId":"FUNNY","voiceName":"Puck"}'));
  const [sessions, setSessions] = useState<ChatSession[]>(() => JSON.parse(localStorage.getItem('mr_vibe_sessions') || '[]'));
  const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('mr_vibe_active_session_id'));

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

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getApiKey = () => user?.apiKey || tempProfile.apiKey || (typeof process !== 'undefined' ? process.env.API_KEY : '') || '';

  const checkApiConnection = async (keyToTest?: string, retryCount = 0): Promise<boolean> => {
    const key = keyToTest || getApiKey();
    if (!key) { if (user || onboardingStep === 3) setApiStatus('error'); return false; }
    setApiStatus('checking');
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ role: 'user', parts: [{ text: "ping" }] }], config: { maxOutputTokens: 2, thinkingConfig: { thinkingBudget: 0 } } });
      if (response && response.candidates) { setApiStatus('connected'); setErrorMessage(null); return true; }
      throw new Error("Bad key");
    } catch (error: any) {
      if (retryCount < 2 && error.message?.includes("Rpc failed")) { await new Promise(r => setTimeout(r, 1000)); return checkApiConnection(keyToTest, retryCount + 1); }
      setApiStatus('error'); setErrorMessage("Vibe Key Error ⚡"); return false;
    }
  };

  useEffect(() => { checkApiConnection(); }, [user?.apiKey]);

  const handleAISpeakFirst = async (sessionId: string) => {
    if (isLoading) return;
    const apiKey = getApiKey();
    if (!apiKey) return;
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}\n- Personality: ${currentPersonality.name}\n- Context: ${currentPersonality.prompt}\n- User: ${user?.userName}`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ role: 'user', parts: [{ text: "Wake up and say hi!" }] }], config: { systemInstruction: fullSystemPrompt, thinkingConfig: { thinkingBudget: 0 } } });
      const aiMessage: Message = { id: `ai-greet-${Date.now()}`, role: 'model', text: response.text || 'Hey! ✨', timestamp: Date.now() };
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage], lastTimestamp: Date.now() } : s));
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { id: newId, title: 'New Vibe', messages: [], lastTimestamp: Date.now(), personalityId: settings.personalityId };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setIsSidebarOpen(false);
    setTimeout(() => handleAISpeakFirst(newId), 300);
    return newId;
  };

  const handleDeleteSession = (id: string) => {
    if (confirm("Delete this vibe session?")) {
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) setActiveSessionId(null);
      showToast("Vibe Deleted", "info");
    }
  };

  const handleReaction = (messageId: string, type: ReactionType) => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === messageId ? { ...m, reaction: m.reaction === type ? null : type } : m) } : s));
  };

  const handleUpdateUserName = (newName: string) => {
    if (!user) return;
    const updatedUser = { ...user, userName: newName };
    setUser(updatedUser);
    setAccounts(prev => prev.map(a => a.email === user.email ? updatedUser : a));
  };

  const previewVoice = async (voiceId: string) => {
    if (isPreviewingVoice) return;
    const apiKey = getApiKey();
    if (!apiKey) { showToast("Key required", "error"); return; }
    setIsPreviewingVoice(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({ model: "gemini-2.5-flash-preview-tts", contents: [{ parts: [{ text: `Vibe check!` }] }], config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } } } } });
      const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (audioPart?.inlineData?.data) {
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const ctx = audioContextRef.current;
        const audioBuffer = await decodeAudioData(decode(audioPart.inlineData.data), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
        source.onended = () => setIsPreviewingVoice(false);
      }
    } catch (e) { setIsPreviewingVoice(false); }
  };

  const { connect: connectLive, disconnect: disconnectLive, sendMessage: liveSendMessage, isLive, isConnecting, volume } = useGeminiLive({
    apiKey: getApiKey(), personality: currentPersonality, settings, user: user || { userName: 'Friend', email: '', age: '', gender: 'Other', avatarUrl: AVATARS[0], personalityId: PersonalityId.FUNNY },
    onTranscript: (text, isModel) => { setLiveTranscript(prev => { const last = prev[prev.length - 1]; if (last && last.isModel === isModel) return [...prev.slice(0, -1), { text: last.text + text, isModel }]; return [...prev, { text, isModel }]; }); },
    onTurnComplete: (userText, modelText) => { setLiveTranscript([]); const sessionId = activeSessionId || handleNewChat(); setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, ...(userText.trim() ? [{ id: `u-${Date.now()}`, role: 'user' as const, text: userText, timestamp: Date.now() }] : []), ...(modelText.trim() ? [{ id: `m-${Date.now() + 1}`, role: 'model' as const, text: modelText, timestamp: Date.now() + 1 }] : [])], lastTimestamp: Date.now() } : s)); },
    onConnectionStateChange: (connected) => { if (!connected) setLiveTranscript([]); },
    onError: (msg) => showToast(msg, "error")
  });

  useEffect(() => { localStorage.setItem('mr_vibe_settings', JSON.stringify(settings)); document.documentElement.classList.toggle('dark', settings.theme === 'dark'); }, [settings]);
  useEffect(() => { localStorage.setItem('mr_vibe_accounts', JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { if (user) { localStorage.setItem('mr_vibe_active_user', JSON.stringify(user)); setIsNewUser(false); if (sessions.length === 0) handleNewChat(); } }, [user]);
  useEffect(() => { localStorage.setItem('mr_vibe_sessions', JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { if (activeSessionId) localStorage.setItem('mr_vibe_active_session_id', activeSessionId); }, [activeSessionId]);
  useEffect(() => { const timer = setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 150); return () => clearTimeout(timer); }, [messages, liveTranscript, isLoading, activeSessionId, isLive]);

  const handleLogOut = () => { if (confirm("Log out?")) { setUser(null); setActiveSessionId(null); setIsNewUser(true); if (isLive) disconnectLive(); setIsProfileModalOpen(false); localStorage.removeItem('mr_vibe_active_user'); showToast("Logged Out", "info"); } };

  const handleSendToAI = async (text: string, fileData?: { data: string, mimeType: string, fileName: string }) => {
    if ((!text.trim() && !fileData) || isLoading) return;
    const apiKey = getApiKey();
    if (!apiKey) { showToast("Key Missing", "error"); return; }
    const sessionId = activeSessionId || handleNewChat();
    if (isLive && !fileData) { liveSendMessage(text); setInputText(''); return; }
    const isImageGenerationRequested = text.toLowerCase().includes("generate") || text.toLowerCase().includes("show me a vibe");
    const isInputImage = fileData?.mimeType.startsWith('image/');
    const userMessage: Message = { id: `user-${Date.now()}`, role: 'user', text: fileData ? (isInputImage ? text : `📄 Doc: ${fileData.fileName}\n${text}`) : text, image: isInputImage ? `data:${fileData?.mimeType};base64,${fileData?.data}` : undefined, timestamp: Date.now() };
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, userMessage], lastTimestamp: Date.now() } : s));
    setIsLoading(true); setInputText(''); setErrorMessage(null);
    try {
      const ai = new GoogleGenAI({ apiKey });
      if (isImageGenerationRequested) {
        setIsVibeGenerating(true);
        const imageResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: [{ parts: [{ text: `Generate visual: ${text}.` }] }], config: { imageConfig: { aspectRatio: "1:1" } } });
        let img: string | undefined;
        for (const p of imageResponse.candidates[0].content.parts) if (p.inlineData) img = `data:image/png;base64,${p.inlineData.data}`;
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, { id: `ai-img-${Date.now()}`, role: 'model', text: `Vibe check pass! 🎨`, image: img, timestamp: Date.now() }] } : s));
        setIsVibeGenerating(false);
      } else {
        const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}\n- Personality: ${currentPersonality.name}\n- Context: ${currentPersonality.prompt}`;
        const parts: any[] = [{ text: text || "Hi!" }];
        if (fileData) parts.push({ inlineData: { data: fileData.data, mimeType: fileData.mimeType } });
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ role: 'user', parts }], config: { systemInstruction: fullSystemPrompt, tools: [{ googleSearch: {} }], thinkingConfig: { thinkingBudget: 0 } } });
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, { id: `ai-${Date.now()}`, role: 'model', text: response.text || '...', timestamp: Date.now() }] } : s));
      }
    } catch (e) { setErrorMessage("Vibe error ⚡"); } finally { setIsLoading(false); setIsVibeGenerating(false); }
  };

  if (isNewUser) {
    return (
      <div className="fixed inset-0 z-[200] bg-zinc-50 dark:bg-[#030303] flex items-center justify-center p-4 overflow-y-auto transition-colors duration-500">
        <div className="w-full max-w-lg bg-white/95 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 p-10 rounded-[3rem] backdrop-blur-3xl shadow-3xl animate-scale-in text-center">
          {onboardingStep === 1 ? (
            <div className="space-y-10 animate-slide-up">
              <Logo className="w-24 h-24 mx-auto" animated />
              <div className="space-y-3"><h1 className="text-4xl font-black text-zinc-900 dark:text-white italic tracking-tighter">Mr. Vibe AI</h1><p className="text-zinc-500 font-medium">Your AI best friend. Born to vibe.</p></div>
              {errorMessage && <div className="p-4 bg-red-500/10 border-red-500/20 text-red-500 rounded-2xl text-xs font-bold">{errorMessage}</div>}
              <div className="space-y-4 text-left">
                <div className="relative"><Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={20} /><input type="email" placeholder="Email" value={credentials.email} onChange={e => setCredentials({...credentials, email: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 pl-16 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white" /></div>
                <div className="relative"><Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={20} /><input type="password" placeholder="Password" value={credentials.password} onChange={e => setCredentials({...credentials, password: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 pl-16 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white" /></div>
              </div>
              <button onClick={() => { if (!validateEmail(credentials.email)) { setErrorMessage("Enter a valid email! 📧"); return; } setOnboardingStep(2); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Get Started</button>
              <button onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')} className="text-zinc-500 font-bold text-xs uppercase tracking-widest block w-full hover:text-blue-500">{authMode === 'signup' ? "Have an account? Log in" : "New vibe? Sign up"}</button>
            </div>
          ) : onboardingStep === 2 ? (
            <div className="space-y-10 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(1)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-3xl font-black italic text-zinc-900 dark:text-white">Profile Identity</h2>
              <div className="flex justify-center gap-4">
                {AVATARS.map((url, i) => (
                  <button key={i} onClick={() => setTempProfile({...tempProfile, avatarUrl: url})} className={`w-16 h-16 md:w-20 md:h-20 rounded-[2rem] overflow-hidden transition-all shadow-lg ${tempProfile.avatarUrl === url ? 'ring-4 ring-blue-500 scale-110' : 'opacity-40 hover:opacity-100'}`}>
                    <img src={url} className="w-full h-full" alt="A" />
                  </button>
                ))}
              </div>
              <input type="text" placeholder="What's your name?" value={tempProfile.userName} onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 px-8 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white text-center" />
              <button onClick={() => { if (!tempProfile.userName?.trim()) { setErrorMessage("What's your name? ✨"); return; } setOnboardingStep(3); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Next</button>
            </div>
          ) : onboardingStep === 3 ? (
            <div className="space-y-10 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(2)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-3xl font-black italic text-zinc-900 dark:text-white">The Vibe Key</h2>
              <p className="text-zinc-500 text-sm">Input your Gemini API Key to wake up Mr. Cute.</p>
              <div className="relative"><Key className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400" size={20} /><input type="password" placeholder="Gemini API Key" value={tempProfile.apiKey} onChange={e => setTempProfile({...tempProfile, apiKey: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl py-5 pl-16 font-bold outline-none border-2 border-transparent focus:border-blue-500 text-zinc-900 dark:text-white" /></div>
              <button onClick={() => { if (!tempProfile.apiKey?.trim()) { setErrorMessage("Key is required! 🔑"); return; } setOnboardingStep(4); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Setup Vibe</button>
              <p className="text-[10px] text-zinc-400 text-center uppercase tracking-[0.2em]">Get one at <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-500 underline">Google AI Studio</a></p>
            </div>
          ) : (
            <div className="space-y-10 animate-slide-in-right">
              <button onClick={() => setOnboardingStep(3)} className="flex items-center gap-2 text-zinc-500 font-bold text-xs uppercase tracking-widest"><ArrowLeft size={16} /> Back</button>
              <h2 className="text-3xl font-black italic text-zinc-900 dark:text-white">Match Your Vibe</h2>
              <div className="grid grid-cols-2 gap-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {Object.values(PERSONALITIES).map(p => (
                  <button key={p.id} onClick={() => { setTempProfile({...tempProfile, personalityId: p.id}); setSettings(prev => ({ ...prev, personalityId: p.id, voiceName: p.voiceName })); }} className={`p-5 rounded-[2rem] border-2 transition-all text-left shadow-sm ${tempProfile.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-[1.02]' : 'bg-zinc-100 dark:bg-white/5 border-transparent hover:bg-zinc-200'}`}>
                    <span className="text-3xl">{p.emoji}</span><p className="font-black text-xs mt-2 uppercase tracking-tight">{p.name}</p>
                  </button>
                ))}
              </div>
              <button onClick={() => { setUser({ email: credentials.email, userName: tempProfile.userName || 'User', avatarUrl: tempProfile.avatarUrl || AVATARS[0], age: '18', gender: 'Other', personalityId: tempProfile.personalityId || PersonalityId.FUNNY, apiKey: tempProfile.apiKey }); showToast("Vibe Ready! ✨", "success"); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95">Start Exploring</button>
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
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-between p-8 animate-fade-in">
          <div className="w-full flex justify-end"><button onClick={disconnectLive} className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"><X size={24}/></button></div>
          <div className="flex-1 flex flex-col items-center justify-center gap-8"><FluidOrb volume={volume} active={isLive} /><h2 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter uppercase">{isConnecting ? "Waking Up..." : currentPersonality.name}</h2>{liveTranscript.slice(-1).map((t, i) => <p key={i} className={`text-xl md:text-2xl font-bold italic max-w-2xl text-center leading-relaxed ${t.isModel ? 'text-blue-400' : 'text-zinc-500'}`}>"{t.text}"</p>)}</div>
          <button onClick={disconnectLive} className="px-10 py-5 bg-rose-600 text-white rounded-[2.5rem] font-black shadow-3xl hover:bg-rose-500 transition-all active:scale-95 flex items-center gap-3">
            <MicOff size={22} /> Stop Vibe
          </button>
        </div>
      )}

      {/* Sidebar - High Contrast Controls */}
      <div className={`fixed inset-y-0 left-0 z-[300] w-80 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/5 transition-transform duration-500 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:relative shadow-2xl md:shadow-none`}>
        <div className="flex flex-col h-full">
          <div className="p-8 flex items-center justify-between">
            <div className="flex items-center gap-3"><Logo className="w-8 h-8" /><h2 className="text-2xl font-black italic tracking-tighter uppercase text-zinc-900 dark:text-white">Vibes</h2></div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-900 dark:text-white p-3 bg-zinc-100 dark:bg-white/10 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-md border dark:border-white/10">
              <X size={24} strokeWidth={3} />
            </button>
          </div>
          <div className="px-8 pb-6"><button onClick={handleNewChat} className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-500 transition-all active:scale-95"><Plus size={18} /> New Vibe</button></div>
          <div className="flex-1 overflow-y-auto px-6 space-y-3 custom-scrollbar">
            {sessions.map(s => (
              <div key={s.id} className="group relative">
                <div onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }} className={`p-4 pr-14 rounded-[1.8rem] cursor-pointer transition-all border ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-500/30 shadow-md ring-1 ring-blue-500/10' : 'hover:bg-zinc-100 dark:hover:bg-white/5 border-transparent'}`}>
                  <div className="flex items-center gap-3"><MessageSquare size={16} className={activeSessionId === s.id ? 'text-blue-500' : 'text-zinc-400'} /><p className={`font-bold text-xs truncate ${activeSessionId === s.id ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-300'}`}>{s.title}</p></div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-rose-500 hover:bg-rose-500/20 rounded-xl transition-all shadow-sm opacity-60 hover:opacity-100">
                  <Trash2 size={18} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Header - Transparent & Modern */}
        <header className="px-6 py-4 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-white/40 dark:bg-black/40 backdrop-blur-2xl sticky top-0 z-[100]">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-zinc-100 dark:bg-white/10 rounded-2xl md:hidden text-zinc-900 dark:text-white shadow-sm"><Menu size={20} /></button>
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setIsProfileModalOpen(true)}>
              <div className="relative">
                <img src={user?.avatarUrl} className="w-11 h-11 rounded-[1.2rem] border-2 border-white dark:border-zinc-800 shadow-lg group-hover:scale-105 transition-transform" alt="Avatar" />
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm ${apiStatus === 'connected' ? 'bg-green-500' : 'bg-rose-500 animate-pulse'}`} />
              </div>
              <div className="hidden xs:block">
                <div className="flex items-center gap-2"><h1 className="text-sm font-black text-zinc-900 dark:text-white leading-none tracking-tight">{user?.userName}</h1></div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">Vibe Level: 100</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsProfileModalOpen(true)} className="px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-black text-[10px] shadow-xl uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2">
              <Activity size={14} className={apiStatus === 'connected' ? 'text-green-500' : 'text-rose-500'} />
              {currentPersonality.name}
            </button>
            <button onClick={connectLive} className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all">
              <Mic size={20} />
            </button>
          </div>
        </header>

        {/* Chat Feed - Modern Layout */}
        <main className="flex-1 overflow-y-auto px-4 md:px-12 py-10 custom-scrollbar bg-zinc-50 dark:bg-[#050505] relative">
          <div className="max-w-3xl mx-auto flex flex-col gap-10">
            {messages.length === 0 && !isLoading ? (
              <div className="min-h-[65vh] flex flex-col items-center justify-center text-center space-y-8 animate-vibe-in">
                <Logo className="w-24 h-24" animated />
                <div className="space-y-3">
                  <h2 className="text-4xl font-black text-zinc-900 dark:text-white italic tracking-tighter">Mr. Cute is ready.</h2>
                  <p className="text-sm font-medium text-zinc-500 max-w-sm mx-auto">Selected Vibe: <span className="text-blue-500 font-bold uppercase tracking-widest text-xs">{currentPersonality.name}</span>. Start typing or tap the mic!</p>
                </div>
              </div>
            ) : messages.map((msg, idx) => (
              <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-vibe-in`} style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className={`flex items-end gap-3 max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'model' && (
                    <div className="w-10 h-10 rounded-[1rem] bg-blue-500/10 flex items-center justify-center text-xl shrink-0 overflow-hidden shadow-sm border dark:border-white/5">
                      <span>{currentPersonality.emoji}</span>
                    </div>
                  )}
                  <div className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-5 py-4 rounded-[2.2rem] shadow-lg text-sm md:text-[1rem] leading-relaxed font-bold transition-all relative
                      ${msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none shadow-blue-500/10' 
                        : 'bg-white dark:bg-zinc-900/80 dark:text-white border dark:border-white/5 rounded-bl-none shadow-black/5'}`}>
                      {msg.image && <div className="mb-4 rounded-2xl overflow-hidden shadow-2xl border dark:border-white/10"><img src={msg.image} alt="Vibe" className="w-full h-auto max-h-[400px] object-cover" /></div>}
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                    <div className="flex items-center gap-3 px-2">
                       <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                       {msg.role === 'model' && (
                         <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleReaction(msg.id, 'like')} className={`hover:text-blue-500 transition-colors ${msg.reaction === 'like' ? 'text-blue-500' : 'text-zinc-500'}`}><ThumbsUp size={12}/></button>
                            <button onClick={() => { navigator.clipboard.writeText(msg.text); showToast("Copied!", "success"); }} className="text-zinc-500 hover:text-blue-500"><Share2 size={12}/></button>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && <TypingIndicator personality={currentPersonality} />}
            {isVibeGenerating && (
              <div className="flex justify-start animate-vibe-in">
                <div className="flex items-end gap-2 w-full max-w-[80%]">
                   <div className="w-10 h-10 rounded-[1rem] bg-blue-500/10 flex items-center justify-center text-xl shrink-0"><span className="animate-spin text-2xl">🎨</span></div>
                   <div className="flex-1 p-6 bg-blue-600/5 dark:bg-white/5 rounded-[2rem] rounded-bl-none border-2 border-dashed border-blue-500/20 flex items-center justify-center gap-3">
                      <Loader2 size={20} className="animate-spin text-blue-500" />
                      <span className="text-xs font-black uppercase tracking-widest text-blue-500 animate-pulse">Brewing Vibe Visuals...</span>
                   </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} className="h-32" />
          </div>
        </main>

        {/* Footer - Floating Modern Bar */}
        <footer className="px-4 py-8 pointer-events-none absolute bottom-0 left-0 right-0 z-[200]">
          <div className="max-w-2xl mx-auto flex items-center gap-3 pointer-events-auto">
            <div className="flex-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-3xl flex items-center rounded-[2.5rem] px-6 py-1 border-2 border-black/5 dark:border-white/10 focus-within:border-blue-500 transition-all shadow-2xl">
              <button onClick={() => fileInputRef.current?.click()} className="text-zinc-400 hover:text-blue-500 transition-colors p-2"><ImageIcon size={22} /></button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => handleSendToAI("", { data: (reader.result as string).split(',')[1], mimeType: file.type, fileName: file.name }); reader.readAsDataURL(file); } }} />
              <input type="text" placeholder="Send a vibe..." value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} className="w-full bg-transparent py-5 px-3 font-bold outline-none text-zinc-900 dark:text-white" />
              <button onClick={() => handleSendToAI(inputText)} disabled={!inputText.trim() || isLoading || apiStatus !== 'connected'} className="ml-2 text-blue-600 disabled:opacity-30 hover:scale-110 transition-transform"><Send size={24} strokeWidth={2.5}/></button>
            </div>
          </div>
        </footer>
      </div>

      {/* Config Modal - Refined */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-fade-in" onClick={() => setIsProfileModalOpen(false)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-[3rem] p-10 shadow-3xl animate-vibe-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4"><Logo className="w-10 h-10" /><h2 className="text-3xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white">Vibe Config</h2></div>
              <button onClick={() => setIsProfileModalOpen(false)} className="p-3 bg-zinc-100 dark:bg-white/10 rounded-2xl text-zinc-900 dark:text-white hover:bg-rose-500 hover:text-white transition-all"><X size={24} strokeWidth={3} /></button>
            </div>
            
            <div className="space-y-10">
              <div className="flex flex-col items-center gap-8">
                <div className="relative group">
                  <img src={user?.avatarUrl} className="w-32 h-32 rounded-[2.5rem] shadow-2xl border-4 border-white dark:border-zinc-800 transition-transform group-hover:scale-105" alt="A" />
                  <div className="absolute -top-2 -right-2 p-3 bg-blue-600 text-white rounded-2xl shadow-lg animate-bounce-slow"><Sparkles size={20}/></div>
                </div>
                <div className="w-full space-y-4">
                  <input type="text" value={user?.userName} onChange={(e) => handleUpdateUserName(e.target.value)} className="w-full bg-zinc-100 dark:bg-white/5 rounded-2xl py-5 px-6 font-black text-center text-zinc-900 dark:text-white text-2xl border-2 border-transparent focus:border-blue-500 outline-none" />
                  <div className="relative group">
                    <Key className={`absolute left-5 top-1/2 -translate-y-1/2 ${apiStatus === 'connected' ? 'text-green-500' : 'text-zinc-400'}`} size={20} />
                    <input type="password" value={user?.apiKey || ''} placeholder="Update Vibe Key" onChange={(e) => { if (!user) return; setUser({ ...user, apiKey: e.target.value }); }} className="w-full bg-zinc-100 dark:bg-white/5 rounded-2xl py-5 pl-14 pr-6 font-bold text-sm text-zinc-900 dark:text-white border-2 border-transparent focus:border-blue-500 outline-none" />
                  </div>
                  <div className="flex justify-between px-2 items-center">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${apiStatus === 'connected' ? 'text-green-500' : 'text-rose-500'}`}>Status: {apiStatus}</span>
                    <button onClick={() => { checkApiConnection(); showToast("Re-verifying Key...", "info"); }} className="text-[10px] font-black uppercase text-blue-500 tracking-widest hover:underline">Verify Connection</button>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 px-2">Vibe Personalities</label>
                <div className="grid grid-cols-2 gap-4">
                  {Object.values(PERSONALITIES).map(p => (
                    <button key={p.id} onClick={() => { setSettings({...settings, personalityId: p.id, voiceName: p.voiceName}); showToast(`${p.name} Active`, "success"); }} className={`flex items-center gap-4 p-5 rounded-[2rem] border-2 transition-all shadow-sm ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-105' : 'bg-zinc-100 dark:bg-white/5 border-transparent dark:text-white hover:bg-zinc-200'}`}>
                      <span className="text-3xl">{p.emoji}</span>
                      <p className="font-black text-xs uppercase tracking-tight">{p.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 px-2">System Vibes</label>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-5 bg-zinc-100 dark:bg-white/5 rounded-[2rem]">
                    <span className="font-bold text-sm dark:text-white">Dark Mode</span>
                    <button onClick={() => setSettings({...settings, theme: settings.theme === 'dark' ? 'light' : 'dark'})} className={`w-14 h-7 rounded-full relative transition-colors ${settings.theme === 'dark' ? 'bg-blue-600' : 'bg-zinc-300'}`}>
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${settings.theme === 'dark' ? 'left-8' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <select value={settings.voiceName} onChange={e => setSettings({...settings, voiceName: e.target.value})} className="flex-1 bg-zinc-100 dark:bg-white/5 rounded-[2rem] py-5 px-8 font-black text-sm text-zinc-900 dark:text-white outline-none border-2 border-transparent focus:border-blue-500 appearance-none">
                      {GEMINI_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                    <button onClick={() => previewVoice(settings.voiceName)} disabled={isPreviewingVoice} className="p-5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-[2rem] hover:scale-110 active:scale-95 transition-all shadow-lg">
                      {isPreviewingVoice ? <Loader2 size={24} className="animate-spin" /> : <Play size={24} />}
                    </button>
                  </div>
                </div>
              </div>

              <button onClick={handleLogOut} className="w-full py-6 text-[11px] text-rose-500 font-black uppercase tracking-[0.4em] hover:bg-rose-500/10 rounded-3xl transition-all">Sign Out Mr. Vibe</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
