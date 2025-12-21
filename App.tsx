
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Volume2, CheckCircle2, Sparkles, MicOff, ImageIcon, Globe,
  Edit3, History, LogOut, Clock, MessageSquare, StickyNote,
  UserCheck, Palette, Bell, Eraser, Info, ExternalLink, Activity,
  ChevronDown, MoreHorizontal, User as UserIcon, Copy, Share2, Heart, ThumbsUp, Pin, BookOpen, Key, Save, ListFilter,
  Check, AlertTriangle, FileText, File, TrendingUp, Brain, ShieldAlert,
  Headphones, BarChart3, Calculator, Zap, Square, CheckSquare, Search, VolumeX, RefreshCw, Paperclip, FileIcon,
  MessageCircle, Link2
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES } from './constants';
import { PersonalityId, Personality, AppSettings, User, ChatSession, Message, ReactionType, Notification, FileAttachment } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';

// Move AIStudio definition into declare global to resolve potential conflicts with existing declarations
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const VibeOrb = ({ active, isThinking, isAiSpeaking, volume, outputVolume, animationState }: { 
  active: boolean, 
  isThinking: boolean, 
  isAiSpeaking?: boolean,
  volume: number,
  outputVolume: number,
  animationState?: OrbAnimationState
}) => {
  const currentVol = isAiSpeaking ? outputVolume : volume;
  const scale = active ? 1 + currentVol * 1.8 : 1;
  
  const getAnimationClass = () => {
    if (animationState === 'hi') return 'animate-hi-pulse';
    if (animationState === 'excited') return 'animate-excited-bounce';
    if (animationState === 'thoughtful') return 'animate-thoughtful-wobble';
    if (isThinking) return 'animate-pulse-orb';
    return '';
  };

  return (
    <div className={`relative flex items-center justify-center w-40 h-40 md:w-56 md:h-56 transition-all duration-300 ${getAnimationClass()}`}>
      <div className={`absolute inset-0 rounded-full bg-blue-500/10 blur-3xl transition-opacity duration-500 ${isThinking || animationState !== 'idle' ? 'opacity-100' : 'opacity-50'}`} />
      <div 
        className={`relative w-20 h-20 md:w-28 md:h-28 rounded-full transition-all duration-75 ease-out flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.5)] ${active || animationState !== 'idle' ? 'bg-gradient-to-br from-blue-400 to-indigo-600' : 'bg-zinc-800'}`}
        style={{ transform: `scale(${scale})` }}
      >
        <div className={`w-full h-full rounded-full bg-white/10 ${active ? 'animate-orb-float' : ''}`} />
      </div>
    </div>
  );
};

const NotificationToast = ({ message, type, onClose, onAction }: { message: string, type: 'info' | 'success' | 'error', onClose: () => void, onAction?: () => void }) => (
  <div className="fixed top-4 md:top-8 inset-x-4 z-[10000] flex justify-center pointer-events-none">
    <div className={`w-full max-w-sm bg-zinc-900 shadow-2xl rounded-[28px] border flex flex-col p-5 pointer-events-auto animate-slide-up ${
      type === 'success' ? 'border-emerald-500/20 text-emerald-400' :
      type === 'error' ? 'border-rose-500/20 text-rose-400' :
      'border-blue-500/20 text-blue-400'
    }`}>
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-white/5"><Bell size={18} /></div>
        <div className="flex-1 font-bold text-[11px] leading-snug">{message}</div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-zinc-500"><X size={16} /></button>
      </div>
      {onAction && (
        <button onClick={() => { onAction(); onClose(); }} className="mt-4 w-full py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
          <MessageCircle size={12} /> Reply (New Chat)
        </button>
      )}
    </div>
  </div>
);

const MarkdownText = ({ text }: { text: string }) => {
  const renderLine = (line: string, key: number) => {
    if (line.startsWith('###')) {
      return <h3 key={key} className="text-blue-500 font-black text-base mt-4 mb-2 flex items-center gap-2">
        <Activity size={16} /> {line.replace('###', '').trim()}
      </h3>;
    }
    const parts = line.split(/(\*\*.*?\*\*|`.*?`|https?:\/\/[^\s]+)/g);
    return (
      <div key={key} className="mb-1 last:mb-0">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) return <strong key={idx} className="font-extrabold text-blue-400/90">{part.slice(2, -2)}</strong>;
          if (part.startsWith('`') && part.endsWith('`')) return <code key={idx} className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[10px] border border-white/5">{part.slice(1, -1)}</code>;
          if (part.startsWith('http')) return <a key={idx} href={part} target="_blank" className="text-blue-500 underline decoration-blue-500/30 hover:decoration-blue-500 transition-all">{part}</a>;
          return <span key={idx}>{part}</span>;
        })}
      </div>
    );
  };
  return <div className="leading-relaxed whitespace-pre-wrap">{text.split('\n').map((l, i) => renderLine(l, i))}</div>;
};

const Logo = ({ className }: { className?: string }) => (
  <div className={`${className} flex items-center justify-center`}>
    <Sparkles className="text-blue-500 w-full h-full drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
  </div>
);

type OrbAnimationState = 'idle' | 'hi' | 'thoughtful' | 'excited';

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_active_user'));
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [toast, setToast] = useState<{id: string, message: string, type: 'info' | 'success' | 'error', onAction?: () => void} | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(() => JSON.parse(localStorage.getItem('mr_vibe_notif_history') || '[]'));
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('mr_vibe_active_user') || 'null'));
  const [tempProfile, setTempProfile] = useState<Partial<User>>({ userName: '', gender: 'Male', avatarUrl: AVATARS[0], personalityId: PersonalityId.STUDENT });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mr_vibe_settings');
    if (saved) return JSON.parse(saved);
    return { language: "English", theme: "dark", personalityId: PersonalityId.STUDENT, voiceName: "Zephyr", speakingRate: 1.0, speakingPitch: 1.0, customCommands: [] };
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(settings.theme || 'dark');

  useEffect(() => {
    document.documentElement.className = theme;
    updateSettings({ theme });
  }, [theme]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const active = await window.aistudio.hasSelectedApiKey();
        setHasKey(active);
      }
    };
    checkKey();
  }, []);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('mr_vibe_settings', JSON.stringify(updated));
      return updated;
    });
  };
  
  const [sessions, setSessions] = useState<ChatSession[]>(() => JSON.parse(localStorage.getItem('mr_vibe_sessions') || '[]'));
  const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('mr_vibe_active_session_id'));
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isVoiceModeSelectOpen, setIsVoiceModeSelectOpen] = useState(false);
  const [isNotifLogOpen, setIsNotifLogOpen] = useState(false);

  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileAttachment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{text: string, isModel: boolean}[]>([]);
  const [isAiSpeakingGlobal, setIsAiSpeakingGlobal] = useState(false);
  const [selectedVoiceMode, setSelectedVoiceMode] = useState<'note' | 'chat'>('chat');
  const [avatarAnimation, setAvatarAnimation] = useState<OrbAnimationState>('idle');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentPersonality = PERSONALITIES[settings.personalityId];
  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info', onAction?: () => void) => {
    const id = Date.now().toString();
    setToast({ id, message, type, onAction });
    const newNotif: Notification = { id, message, type, timestamp: Date.now() };
    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, 50);
      localStorage.setItem('mr_vibe_notif_history', JSON.stringify(updated));
      return updated;
    });
    // Auto-hide only if not an error that needs reading
    if (type !== 'error') {
       setTimeout(() => setToast(current => current?.id === id ? null : current), 6000);
    }
  };

  const handleLinkKey = async () => {
    try {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        setHasKey(true);
        showToast("Neural link established. Frequency clear.", "success");
      }
    } catch (e) {
      showToast("Key linking failed. Protocol interrupted.", "error");
    }
  };

  const handleNewChat = useCallback((autoGreet = true) => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { 
      id: newId, title: 'Linking...', messages: [], lastTimestamp: Date.now(), personalityId: settings.personalityId 
    };
    setSessions(prev => {
      const updated = [newSession, ...prev];
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    setActiveSessionId(newId);
    localStorage.setItem('mr_vibe_active_session_id', newId);
    setIsHistoryOpen(false);
    setIsNotifLogOpen(false);
    
    if (autoGreet) {
      setAvatarAnimation('hi');
      setTimeout(() => setAvatarAnimation('idle'), 1200);
      let greeting = `Yo! Mr. Cute is here. Ready to vibe, ${user?.gender === 'Male' ? 'bro' : user?.gender === 'Female' ? 'bestie' : 'fam'}?`;
      handleSendToAI(greeting, true);
    }
    return newId;
  }, [sessions.length, settings.personalityId, user]);

  const generateChatTitle = async (sessionId: string, firstMessage: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Based on this first user message: "${firstMessage}", generate a catchy, professional 2-word title for the chat. No quotes.`
      });
      const title = response.text?.trim() || "New Chat";
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, title } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
    } catch (e) {
      console.error("Title generation failed", e);
    }
  };

  const { connect: connectLive, disconnect: disconnectLive, isLive, isConnecting, volume, outputVolume } = useGeminiLive({
    personality: currentPersonality, settings, user: user as User, mode: selectedVoiceMode,
    onTranscript: (t, iM, isModel) => {
        setLiveTranscript(prev => [...prev, { text: t, isModel }]);
        if (isModel) setIsAiSpeakingGlobal(true);
    },
    onTurnComplete: (u, m) => { 
      setLiveTranscript([]); setIsAiSpeakingGlobal(false);
      const sId = activeSessionId || handleNewChat(false); 
      setSessions(prev => {
        const updated = prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, 
          { id: `u-${Date.now()}`, role: 'user', text: u, timestamp: Date.now() }, 
          { id: `m-${Date.now() + 1}`, role: 'model', text: m, timestamp: Date.now() + 1, isNote: selectedVoiceMode === 'note' }
        ] } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      }); 
    },
    onConnectionStateChange: (c) => { if(!c) setLiveTranscript([]); },
    onCommand: (cmd, args) => {
      if (cmd === 'change_voice') {
        const found = GEMINI_VOICES.find(v => v.id.toLowerCase() === args.voice_id?.toLowerCase());
        if (found) { updateSettings({ voiceName: found.id }); showToast(`Voice Synced: ${found.name}`, "success"); }
      }
    },
    onError: (m) => showToast(m, "error", () => handleNewChat(true))
  });

  async function handleSendToAI(text: string, isAutoGreet = false) {
    if ((!text.trim() && !selectedFile) || isLoading) return;
    if (!hasKey && !isAutoGreet) {
      showToast("Access Denied: Please link your neural API key.", "error", () => setIsProfileModalOpen(true));
      return;
    }
    
    let sessionId = activeSessionId || handleNewChat(false);
    const sessionRef = sessions.find(s => s.id === sessionId);
    const isFirstMessage = !sessionRef || sessionRef.messages.length === 0;
    
    const userMsgFile = selectedFile ? { ...selectedFile } : undefined;

    if (!isAutoGreet) {
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, { id: `u-${Date.now()}`, role: 'user', text, file: userMsgFile, timestamp: Date.now() }], lastTimestamp: Date.now() } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
      if (isFirstMessage) generateChatTitle(sessionId, text);
    }
    
    setIsLoading(true); setInputText('');
    setAvatarAnimation('thoughtful');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const contents: any[] = [{ text: `${BASE_SYSTEM_PROMPT}\n\nProtocol Header: ${isFirstMessage ? "FIRST MESSAGE OF SESSION - INTRODUCTION ALLOWED" : "SESSION ACTIVE - NO NAME INTRODUCTIONS"}\n\nUser Input: ${text}\n(User Gender Context: ${user?.gender})` }];
      if (userMsgFile?.type.startsWith('image/')) {
        contents.push({ inlineData: { data: userMsgFile.data.split(',')[1], mimeType: userMsgFile.type } });
      }

      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: { parts: contents },
        config: { tools: [{ googleSearch: {} }] } 
      });

      let aiText = response.text || '...';
      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: aiText, timestamp: Date.now() };
      
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
      setSelectedFile(null);
      setAvatarAnimation('idle');
    } catch (e: any) { 
      showToast("Frequency Interruption. Starting New Session.", "error", () => handleNewChat(true)); 
      setAvatarAnimation('idle'); 
    } finally { 
      setIsLoading(false); 
    }
  }

  const deleteNotification = (id: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      localStorage.setItem('mr_vibe_notif_history', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className={`flex flex-col h-full w-full transition-colors duration-500 ${theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-zinc-50 text-black'} relative overflow-hidden ios-safe-top ios-safe-bottom font-sans`}>
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} onAction={toast.onAction} />}

      <header className={`h-20 px-8 flex items-center justify-between border-b ${theme === 'dark' ? 'border-white/5 bg-black/40' : 'border-black/5 bg-white/40'} backdrop-blur-3xl z-50`}>
        <div className="flex items-center gap-5">
          <button onClick={() => setIsHistoryOpen(true)} className={`p-3 rounded-2xl transition-all active:scale-90 ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-400' : 'hover:bg-black/5 text-zinc-500'}`}><Menu size={24} /></button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-3 rounded-2xl transition-all active:scale-90 ${theme === 'dark' ? 'hover:bg-white/5 text-yellow-400' : 'hover:bg-black/5 text-blue-600'}`}>
            {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
          </button>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-black text-[11px] uppercase tracking-[0.4em] text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">Mr. Vibe AI</span>
          <span className={`text-[9px] font-black flex items-center gap-1.5 uppercase tracking-widest mt-1 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
             <span className={`w-1.5 h-1.5 rounded-full ${hasKey ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-bounce'}`} /> {hasKey ? 'Neural Sync Active' : 'Offline'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsNotifLogOpen(true)} className={`p-3 rounded-2xl relative transition-all active:scale-90 ${theme === 'dark' ? 'hover:bg-white/5 text-zinc-400' : 'hover:bg-black/5 text-zinc-500'}`}>
            <Bell size={22} />
            {notifications.length > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-black" />}
          </button>
          <button onClick={() => setIsProfileModalOpen(true)} className={`w-11 h-11 rounded-2xl overflow-hidden border-2 ${theme === 'dark' ? 'border-white/10' : 'border-black/10'} ring-4 ring-blue-500/10 shadow-2xl active:scale-95 transition-all`}><img src={user?.avatarUrl} className="w-full h-full object-cover" /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-10 space-y-8 custom-scrollbar scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-10 opacity-40">
            <VibeOrb active={false} isThinking={false} volume={0} outputVolume={0} animationState={avatarAnimation} />
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-[0.4em] text-blue-500">Frequency Awaiting</h3>
              <p className="text-[11px] font-bold italic text-zinc-500 uppercase tracking-widest">Connect your key and drop a vibe to start.</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-vibe-in group`}>
              {msg.file && (
                <div className={`mb-3 max-w-[85%] rounded-[30px] overflow-hidden border shadow-2xl ${theme === 'dark' ? 'border-white/10' : 'border-black/5 shadow-zinc-200/40'}`}>
                  {msg.file.type.startsWith('image/') ? (
                    <img src={msg.file.data} alt="Vibe Content" className="w-full h-auto object-cover max-h-[400px]" />
                  ) : (
                    <div className={`flex items-center gap-4 p-5 ${theme === 'dark' ? 'bg-[#121212]' : 'bg-white'}`}>
                      <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500 shadow-inner"><FileIcon size={28} /></div>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="font-black text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Neural Data</div>
                        <div className="font-bold text-xs truncate">{msg.file.name}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className={`relative px-6 py-4.5 rounded-[32px] text-sm font-semibold max-w-[88%] shadow-2xl border transition-all duration-300 ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-800 text-white rounded-tr-none border-blue-400/20 shadow-blue-900/10' 
                  : theme === 'dark' ? 'bg-[#121212] text-zinc-100 rounded-tl-none border-white/5' : 'bg-white text-zinc-900 rounded-tl-none border-black/5'
              }`}>
                <MarkdownText text={msg.text} />
              </div>
              <div className={`flex items-center gap-5 mt-3 px-2 opacity-0 group-hover:opacity-100 transition-all duration-500 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest opacity-60">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <button onClick={() => { navigator.clipboard.writeText(msg.text); showToast("Neural Link Copied", "success"); }} className="p-2 text-zinc-500 hover:text-white transition-colors"><Copy size={16}/></button>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-start animate-pulse">
            <div className={`px-7 py-5 rounded-[32px] rounded-tl-none border shadow-xl ${theme === 'dark' ? 'bg-[#121212] border-white/5' : 'bg-white border-black/5'}`}>
              <div className="flex gap-2.5">
                <div className="w-2 h-2 bg-blue-500/80 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-blue-500/80 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-blue-500/80 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className={`p-6 bg-gradient-to-t ${theme === 'dark' ? 'from-black via-black/90' : 'from-zinc-50 via-zinc-50/90'} to-transparent z-40`}>
        {selectedFile && (
          <div className="max-w-3xl mx-auto mb-4 animate-slide-up">
            <div className={`relative inline-flex items-center gap-4 p-4 rounded-[28px] border shadow-2xl ${theme === 'dark' ? 'bg-[#121212] border-white/10' : 'bg-white border-black/10'}`}>
              <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 shadow-inner">
                {selectedFile.type.startsWith('image/') ? <img src={selectedFile.data} alt="Preview" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-blue-500/10 flex items-center justify-center text-blue-500"><FileIcon size={24}/></div>}
              </div>
              <div className="flex-1 pr-12 min-w-0">
                <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Awaiting Transmission</div>
                <div className="text-[11px] font-bold truncate max-w-[200px]">{selectedFile.name}</div>
              </div>
              <button onClick={() => setSelectedFile(null)} className="absolute top-3 right-3 p-2 hover:bg-white/10 rounded-xl text-zinc-500 transition-all"><X size={16} /></button>
            </div>
          </div>
        )}
        <div className={`max-w-4xl mx-auto flex items-center gap-3 p-2.5 border rounded-[36px] shadow-2xl backdrop-blur-[40px] transition-all duration-500 ${theme === 'dark' ? 'bg-[#111111]/90 border-white/10 ring-1 ring-white/5' : 'bg-white border-black/10 ring-1 ring-black/5'}`}>
          <button onClick={() => fileInputRef.current?.click()} className={`p-4 rounded-full transition-all active:scale-90 ${theme === 'dark' ? 'text-zinc-500 hover:bg-white/5 hover:text-blue-500' : 'text-zinc-500 hover:bg-black/5 hover:text-blue-600'}`}>
            <Paperclip size={24}/>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={(e) => {
               const file = e.target.files?.[0]; if (!file) return;
               const reader = new FileReader(); reader.onload = () => setSelectedFile({ data: reader.result as string, name: file.name, type: file.type });
               reader.readAsDataURL(file); e.target.value = '';
            }} />
          </button>
          <input 
            type="text" 
            placeholder="Link frequencies..." 
            value={inputText} 
            onChange={e => setInputText(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} 
            className={`flex-1 bg-transparent py-4 px-3 font-bold text-sm outline-none transition-colors ${theme === 'dark' ? 'text-white placeholder-zinc-700' : 'text-black placeholder-zinc-400'}`} 
          />
          <div className="flex items-center gap-2.5 pr-2.5">
             <button onClick={() => setIsVoiceModeSelectOpen(true)} className={`p-4 rounded-full transition-all active:scale-90 ${isLive ? 'bg-blue-600 text-white animate-pulse shadow-blue-500/40 shadow-xl' : theme === 'dark' ? 'bg-white/5 text-zinc-500 hover:text-blue-400' : 'bg-black/5 text-zinc-500 hover:text-blue-600'}`}><Mic size={24}/></button>
             <button onClick={() => handleSendToAI(inputText)} disabled={!inputText.trim() && !selectedFile} className={`p-4 rounded-full transition-all duration-500 active:scale-95 ${(inputText.trim() || selectedFile) ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/40 scale-105' : 'bg-zinc-500/10 text-zinc-500/20'}`}><Send size={24}/></button>
          </div>
        </div>
      </footer>

      {/* History Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[1000] w-80 transition-transform duration-700 cubic-bezier(0.16, 1, 0.3, 1) transform ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'} shadow-[0_0_100px_rgba(0,0,0,0.5)] border-r ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-black/5'}`}>
         <div className="flex flex-col h-full">
            <div className={`p-10 flex items-center justify-between border-b ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
               <h2 className="font-black uppercase tracking-[0.4em] text-[10px] flex items-center gap-3 text-zinc-600"><History size={18}/> Vibe Archive</h2>
               <button onClick={() => setIsHistoryOpen(false)} className={`p-3 rounded-2xl ${theme === 'dark' ? 'bg-white/5 text-zinc-500' : 'bg-black/5 text-zinc-600'}`}><X size={18}/></button>
            </div>
            <div className="p-8">
               <button onClick={() => handleNewChat(true)} className="w-full py-5 bg-blue-600 text-white rounded-[26px] font-black flex items-center justify-center gap-3 text-[11px] uppercase tracking-widest shadow-2xl shadow-blue-600/30 hover:shadow-blue-600/50 active:scale-95 transition-all"><Plus size={20}/> New Session</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 space-y-3 custom-scrollbar pb-12">
               {sessions.length === 0 ? <div className="text-center py-20 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-800 italic">No Frequency Logs</div> : sessions.map(s => (
                 <div key={s.id} onClick={() => { setActiveSessionId(s.id); setIsHistoryOpen(false); }} className={`group w-full p-5 rounded-[28px] text-left border-2 transition-all cursor-pointer relative ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-600/50' : 'bg-transparent border-transparent hover:bg-black/5'}`}>
                   <div className={`font-black text-xs truncate pr-10 ${activeSessionId === s.id ? 'text-blue-500' : theme === 'dark' ? 'text-zinc-400' : 'text-zinc-700'}`}>{s.title}</div>
                   <div className="text-[9px] font-black text-zinc-600 mt-2 uppercase tracking-widest opacity-60 flex items-center gap-2"><Clock size={10}/> {new Date(s.lastTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                   <button onClick={(e) => { e.stopPropagation(); setSessions(prev => prev.filter(x => x.id !== s.id)); if(activeSessionId === s.id) setActiveSessionId(null); }} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2.5 text-zinc-600 hover:text-rose-500 transition-all"><Trash2 size={16}/></button>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* Identity Stream Sidebar */}
      <div className={`fixed inset-y-0 right-0 z-[1000] w-80 transition-transform duration-700 transform ${isNotifLogOpen ? 'translate-x-0' : '-translate-x-full'} shadow-[0_0_100px_rgba(0,0,0,0.5)] border-l ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-black/5'}`}>
         <div className="flex flex-col h-full">
            <div className={`p-10 flex items-center justify-between border-b ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
               <h2 className="font-black uppercase tracking-[0.4em] text-[10px] flex items-center gap-3 text-zinc-600"><Bell size={18}/> Identity Stream</h2>
               <button onClick={() => setIsNotifLogOpen(false)} className={`p-3 rounded-2xl ${theme === 'dark' ? 'bg-white/5 text-zinc-500' : 'bg-black/5 text-zinc-600'}`}><X size={18}/></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-5 custom-scrollbar">
               {notifications.length === 0 ? <div className="text-center py-20 text-[10px] font-black uppercase text-zinc-800">Void Protocol Active</div> : notifications.map(n => (
                 <div key={n.id} className="p-6 rounded-[32px] bg-white/5 border border-white/5 space-y-4 shadow-xl relative group">
                   <button onClick={() => deleteNotification(n.id)} className="absolute top-4 right-4 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/5 rounded-lg text-zinc-600 transition-all"><X size={12}/></button>
                   <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${n.type === 'error' ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'}`}><Bell size={16}/></div>
                      <div className="flex-1 text-[11px] font-bold leading-relaxed">{n.message}</div>
                   </div>
                   <button onClick={() => handleNewChat(true)} className="w-full py-3.5 bg-blue-600/10 text-blue-500 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white transition-all shadow-inner">Reply (New Chat)</button>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* Identity Matrix (Settings/Profile) */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-6">
           <div className="absolute inset-0 bg-black/95 backdrop-blur-[60px]" onClick={() => setIsProfileModalOpen(false)} />
           <div className={`relative w-full max-w-xl rounded-[60px] p-12 space-y-10 animate-scale-in border shadow-[0_0_120px_rgba(59,130,246,0.15)] max-h-[90vh] overflow-y-auto custom-scrollbar ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-4"><UserIcon size={26} className="text-blue-500" /> Identity Matrix</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Calibration Profile</p>
                </div>
                <button onClick={() => setIsProfileModalOpen(false)} className={`p-4 rounded-3xl transition-all active:scale-90 ${theme === 'dark' ? 'bg-white/5 text-zinc-500' : 'bg-black/5 text-zinc-600'}`}><X size={24}/></button>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-12 items-start">
                 <div className="relative group mx-auto lg:mx-0">
                    <div className="w-36 h-36 rounded-[48px] overflow-hidden border-4 border-blue-600/20 shadow-2xl transition-all duration-500 group-hover:scale-105 group-hover:rotate-2"><img src={user?.avatarUrl} className="w-full h-full object-cover" /></div>
                    <button className="absolute -bottom-3 -right-3 p-3 bg-blue-600 text-white rounded-[20px] shadow-2xl hover:scale-110 active:scale-90 transition-all"><Edit3 size={18}/></button>
                 </div>
                 
                 <div className="flex-1 w-full space-y-10">
                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Human Label</label>
                       <input 
                        type="text" 
                        value={user?.userName} 
                        onChange={e => setUser(u => u ? ({...u, userName: e.target.value}) : null)}
                        onBlur={() => localStorage.setItem('mr_vibe_active_user', JSON.stringify(user))}
                        className={`w-full py-5 px-8 rounded-[28px] font-black text-lg border-2 transition-all outline-none ${theme === 'dark' ? 'bg-white/5 border-white/5 focus:border-blue-500/50 text-white' : 'bg-black/5 border-transparent focus:border-blue-600/20 text-black'}`} 
                       />
                    </div>

                    <div className="space-y-4">
                       <div className="flex justify-between items-center ml-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Neural Link Security</label>
                          <span className={`text-[9px] font-black uppercase tracking-widest ${hasKey ? 'text-emerald-500' : 'text-rose-500'}`}>{hasKey ? 'Linked' : 'Disconnected'}</span>
                       </div>
                       <button onClick={handleLinkKey} className={`w-full py-5 px-8 rounded-[28px] font-black text-sm uppercase tracking-widest border-2 flex items-center justify-between transition-all ${hasKey ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-blue-600 text-white border-transparent shadow-xl shadow-blue-600/20'}`}>
                          <span className="flex items-center gap-3"><Key size={18} /> {hasKey ? 'Update API Key' : 'Link API Key'}</span>
                          <Link2 size={18} />
                       </button>
                    </div>

                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Vibe Preference (Gender Slang)</label>
                       <div className="grid grid-cols-3 gap-4">
                          {['Male', 'Female', 'Other'].map(g => (
                             <button key={g} onClick={() => {
                                setUser(u => u ? ({...u, gender: g as any}) : null);
                                localStorage.setItem('mr_vibe_active_user', JSON.stringify({...user, gender: g}));
                             }} className={`py-4 rounded-[24px] font-black text-[11px] uppercase tracking-[0.1em] border-2 transition-all shadow-xl active:scale-95 ${user?.gender === g ? 'bg-blue-600 border-blue-500 text-white shadow-blue-600/30' : theme === 'dark' ? 'bg-white/5 border-transparent text-zinc-600' : 'bg-black/5 border-transparent text-zinc-400'}`}>{g}</button>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Neural Archetype</label>
                       <div className="grid grid-cols-2 gap-4">
                          {Object.values(PERSONALITIES).map(p => (
                             <button key={p.id} onClick={() => { updateSettings({ personalityId: p.id }); showToast(`Archetype Synced: ${p.name}`, "info"); }} className={`py-5 px-6 rounded-[30px] font-black text-[10px] uppercase tracking-widest border-2 transition-all text-left flex items-center gap-4 ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-2xl' : theme === 'dark' ? 'bg-white/5 border-transparent text-zinc-600' : 'bg-black/5 border-transparent text-zinc-500'}`}>
                               <span className="text-2xl">{p.emoji}</span>
                               <span>{p.name}</span>
                             </button>
                          ))}
                       </div>
                    </div>

                    <button onClick={() => { if(confirm("Wipe all frequencies?")) { localStorage.clear(); window.location.reload(); } }} className="w-full py-6 bg-rose-600/10 text-rose-500 border border-rose-500/10 rounded-[32px] font-black uppercase text-[10px] tracking-[0.3em] hover:bg-rose-600 hover:text-white transition-all duration-500 mt-6 shadow-inner">Destroy Persona</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Onboarding / Setup */}
      {isNewUser && (
        <div className="fixed inset-0 z-[9000] bg-black flex items-center justify-center p-8 overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-2xl bg-[#080808] rounded-[64px] p-16 text-center shadow-[0_0_150px_rgba(59,130,246,0.1)] border border-white/5 animate-scale-in my-auto">
             <Logo className="w-20 h-20 mx-auto mb-10" />
             <h1 className="text-4xl font-black mb-2 uppercase italic tracking-tighter text-white">Mr. Vibe AI</h1>
             <p className="text-zinc-700 mb-16 text-[12px] font-black uppercase tracking-[0.5em]">System Initialization</p>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-left mb-16">
               <div className="space-y-4">
                 <label className="text-[11px] font-black text-zinc-800 uppercase tracking-widest ml-4">Human Label</label>
                 <input type="text" placeholder="Identity..." value={tempProfile.userName} onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} className="w-full bg-white/5 rounded-[32px] py-6 px-9 font-bold text-xl outline-none border-2 border-transparent focus:border-blue-600 transition-all text-white placeholder-zinc-900 shadow-inner" />
               </div>

               <div className="space-y-4">
                 <label className="text-[11px] font-black text-zinc-800 uppercase tracking-widest ml-4">Neural Key Protocol</label>
                 <button onClick={handleLinkKey} className={`w-full py-6 px-9 rounded-[32px] font-black text-sm uppercase tracking-widest border-2 transition-all flex items-center justify-between ${hasKey ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-blue-600 text-white border-transparent shadow-2xl shadow-blue-600/30'}`}>
                    {hasKey ? 'Key Linked' : 'Link API Key'} <Key size={20}/>
                 </button>
               </div>

               <div className="space-y-4 col-span-1 md:col-span-2">
                 <label className="text-[11px] font-black text-zinc-800 uppercase tracking-widest ml-4 text-center block">Vibe & Archetype Selection</label>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.values(PERSONALITIES).map(p => (
                      <button key={p.id} onClick={() => setTempProfile({...tempProfile, personalityId: p.id})} className={`p-6 rounded-[36px] font-black text-[10px] uppercase tracking-widest border-2 transition-all flex flex-col items-center gap-3 ${tempProfile.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-2xl' : 'bg-white/5 border-transparent text-zinc-700 hover:text-zinc-500'}`}>
                        <span className="text-3xl">{p.emoji}</span>
                        <span>{p.name}</span>
                      </button>
                    ))}
                 </div>
               </div>
             </div>

             <button onClick={() => { 
                if(tempProfile.userName && hasKey) { 
                  const newUser = { ...tempProfile, avatarUrl: AVATARS[Math.floor(Math.random()*AVATARS.length)] } as User; 
                  setUser(newUser); 
                  updateSettings({ personalityId: tempProfile.personalityId });
                  localStorage.setItem('mr_vibe_active_user', JSON.stringify(newUser)); 
                  setIsNewUser(false); 
                  handleNewChat(true); 
                } else if(!hasKey) {
                  showToast("Access Restricted: Neural key linkage is mandatory.", "error", () => handleLinkKey());
                } else { 
                  showToast("Human label required.", "error"); 
                } 
             }} className="w-full py-7 bg-blue-600 text-white rounded-[40px] font-black text-xl uppercase tracking-[0.3em] shadow-[0_20px_60px_rgba(59,130,246,0.4)] active:scale-95 transition-all duration-500">Initiate Link</button>
          </div>
        </div>
      )}

      {/* Full-Screen Voice Interaction Overlay */}
      {(isLive || isConnecting) && (
        <div className="fixed inset-0 z-[7000] bg-black/98 flex flex-col items-center justify-between p-16 animate-fade-in backdrop-blur-3xl text-white">
          <button onClick={disconnectLive} className="self-end p-6 text-white/20 hover:text-white transition-all bg-white/5 rounded-3xl active:scale-90"><X size={32}/></button>
          <div className="flex flex-col items-center gap-16 w-full max-w-lg">
            <VibeOrb active={isLive} isThinking={isConnecting} isAiSpeaking={isAiSpeakingGlobal} volume={volume} outputVolume={outputVolume} animationState={avatarAnimation} />
            <div className="bg-white/5 p-12 rounded-[56px] min-h-[180px] w-full border border-white/5 flex items-center justify-center shadow-[0_0_80px_rgba(59,130,246,0.15)] ring-1 ring-white/5">
                 <p className="font-bold text-blue-400 italic text-3xl text-center leading-relaxed drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]">
                    {liveTranscript.length > 0 ? liveTranscript.slice(-1)[0].text : 'Syncing frequencies...'}
                 </p>
            </div>
          </div>
          <button onClick={disconnectLive} className="px-24 py-8 bg-rose-600 text-white rounded-[44px] font-black uppercase text-xs tracking-[0.3em] flex items-center gap-5 shadow-[0_0_60px_rgba(225,29,72,0.4)] active:scale-90 transition-all group overflow-hidden relative">
            <span className="relative z-10 flex items-center gap-4"><MicOff size={24}/> Sever Link</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          </button>
        </div>
      )}
    </div>
  );
}
