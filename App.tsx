
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Send, Menu, Plus, Trash2, 
  X, Pin, Brain, Settings,
  Cpu, Database, ShieldCheck, RefreshCcw, 
  LogOut, User as UserIcon, ChevronRight,
  FileText, Paperclip, Headset, BookOpenCheck,
  Lightbulb, GraduationCap as QuizIcon, Sparkles,
  History, Activity, Key, CheckCircle2, Mic, StickyNote,
  UserCircle, Lock, Zap, Shield, Trophy, Star, Medal, Target,
  Users, Crown, Flame
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, PERSONALITY_STYLES } from './constants';
import { PersonalityId, AppSettings, User, ChatSession, Message, FileAttachment, GroundingChunk } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';

interface PendingFile extends FileAttachment {
  id: string;
  progress: number;
  isUploading: boolean;
  reader?: FileReader;
}

const XP_PER_LEVEL = 500;

const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => (
  <div className="group relative flex items-center justify-center">
    {children}
    <div className="absolute bottom-full mb-3 hidden group-hover:block z-[15000] pointer-events-none">
      <div className="bg-zinc-900 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-2xl border border-white/10 whitespace-nowrap animate-fade-in flex items-center gap-2">
        <Sparkles size={10} className="text-blue-400" />
        {text}
      </div>
    </div>
  </div>
);

const BadgeItem = ({ name, icon: Icon, unlocked, description }: { name: string, icon: any, unlocked: boolean, description: string }) => (
  <Tooltip text={description}>
    <div className={`flex flex-col items-center gap-2 p-4 rounded-3xl border transition-all w-full ${unlocked ? 'bg-blue-600/10 border-blue-500/30 text-white shadow-lg' : 'bg-zinc-900/50 border-white/5 text-zinc-700 grayscale'}`}>
      <div className={`p-3 rounded-2xl ${unlocked ? 'bg-blue-500/20' : 'bg-zinc-800'}`}>
        <Icon size={24} />
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest text-center">{name}</span>
    </div>
  </Tooltip>
);

const VibeOrb = ({ active, isThinking, volume, outputVolume, personalityId }: { 
  active: boolean, 
  isThinking: boolean, 
  volume: number,
  outputVolume: number,
  personalityId: PersonalityId
}) => {
  const currentVol = active ? outputVolume || volume : 0;
  const scale = active ? 1 + currentVol * 1.8 : 1;
  const style = PERSONALITY_STYLES[personalityId] || PERSONALITY_STYLES[PersonalityId.STUDENT];
  
  return (
    <div className={`relative flex items-center justify-center w-40 h-40 md:w-64 md:h-64 transition-all duration-300 ${isThinking ? 'animate-pulse-orb' : ''}`}>
      <div 
        className={`absolute inset-0 rounded-full blur-3xl transition-opacity duration-700 ${active || isThinking ? 'opacity-60' : 'opacity-20'}`} 
        style={{ backgroundColor: style.glow }}
      />
      <div 
        className={`relative w-24 h-24 md:w-40 md:h-40 rounded-full transition-all duration-75 ease-out flex items-center justify-center shadow-2xl ${active ? `bg-gradient-to-br ${style.gradient}` : 'bg-zinc-800'}`}
        style={{ transform: `scale(${scale})`, boxShadow: active ? `0 0 50px ${style.glow}` : 'none' }}
      >
        <div className={`w-full h-full rounded-full bg-white/10 ${active ? 'animate-orb-float' : ''}`} />
      </div>
    </div>
  );
};

const NotificationToast = ({ message, type, onClose }: { message: string, type: string, onClose: () => void }) => (
  <div className="fixed top-6 md:top-10 inset-x-4 z-[10000] flex justify-center pointer-events-none">
    <div 
      className={`w-full max-w-sm mb-4 bg-zinc-900 shadow-2xl rounded-[32px] border flex items-center gap-4 p-5 pointer-events-auto animate-slide-up ${
        type === 'success' ? 'border-emerald-500/30 text-emerald-400' :
        type === 'error' ? 'border-rose-500/30 text-rose-400' :
        'border-blue-500/30 text-blue-400'
      }`}
    >
      <div className="flex-1 font-bold text-[12px] leading-tight">{message}</div>
      <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-zinc-500">
        <X size={16} />
      </button>
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
      <div key={key} className="mb-1 last:mb-0 text-zinc-300">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) return <strong key={idx} className="font-extrabold text-blue-400/90">{part.slice(2, -2)}</strong>;
          if (part.startsWith('`') && part.endsWith('`')) return <code key={idx} className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[11px] border border-white/5">{part.slice(1, -1)}</code>;
          if (part.startsWith('http')) return <a key={idx} href={part} target="_blank" rel="noreferrer" className="text-blue-500 underline decoration-blue-500/30 hover:decoration-blue-500 transition-all">{part}</a>;
          return <span key={idx}>{part}</span>;
        })}
      </div>
    );
  };
  return <div className="leading-relaxed whitespace-pre-wrap">{text.split('\n').map((l, i) => renderLine(l, i))}</div>;
};

const MOCK_LEADERBOARD = [
  { name: 'VibeLord', level: 42, avatar: AVATARS[1], rank: 1 },
  { name: 'SyncQueen', level: 38, avatar: AVATARS[2], rank: 2 },
  { name: 'NeuralNomad', level: 31, avatar: AVATARS[3], rank: 3 },
  { name: 'GeminiGod', level: 25, avatar: AVATARS[4], rank: 4 },
];

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_active_user'));
  const [googleLicense, setGoogleLicense] = useState<string>(() => localStorage.getItem('mr_vibe_google_pass') || '');
  const [openaiLicense, setOpenaiLicense] = useState<string>(() => localStorage.getItem('mr_vibe_openai_pass') || '');
  
  const [toast, setToast] = useState<{id: string, message: string, type: string} | null>(null);
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('mr_vibe_active_user') || 'null'));
  
  const [tempProfile, setTempProfile] = useState<Partial<User> & { googleKey?: string, openaiKey?: string }>({ 
    userName: '', 
    avatarUrl: AVATARS[0], 
    personalityId: PersonalityId.STUDENT,
    preferredProvider: 'google',
    googleKey: '',
    openaiKey: ''
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mr_vibe_settings');
    if (saved) return JSON.parse(saved);
    return { language: "English", theme: "dark", personalityId: PersonalityId.STUDENT, voiceName: "Aoede", speakingRate: 1.0, speakingPitch: 1.0, customCommands: [], preferredProvider: 'google' };
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('mr_vibe_active_session_id'));
  const [sessions, setSessions] = useState<ChatSession[]>(() => JSON.parse(localStorage.getItem('mr_vibe_sessions') || '[]'));
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const [inputText, setInputText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVoiceMode, setSelectedVoiceMode] = useState<'chat' | 'note'>('chat');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const currentPersonality = PERSONALITIES[settings.personalityId] || PERSONALITIES[PersonalityId.STUDENT];
  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  
  const allPinnedMessages = useMemo(() => {
    return sessions.flatMap(s => s.messages.filter(m => m.isPinned).map(m => ({ ...m, sessionId: s.id })));
  }, [sessions]);

  const activeProvider = settings.preferredProvider;

  const currentLevelProgress = useMemo(() => {
    if (!user) return 0;
    return (user.xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100;
  }, [user]);

  const showToast = useCallback((message: string, type: string = 'info') => {
    const id = Date.now().toString();
    setToast({ id, message, type });
    setTimeout(() => setToast(curr => curr?.id === id ? null : curr), 4000);
  }, []);

  const unlockBadge = useCallback((badgeId: string, badgeName: string) => {
    setUser(prev => {
      if (!prev || prev.badges.includes(badgeId)) return prev;
      showToast(`ACHIEVEMENT UNLOCKED: ${badgeName}! 🏆`, "success");
      const updatedUser = { ...prev, badges: [...prev.badges, badgeId] };
      localStorage.setItem('mr_vibe_active_user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, [showToast]);

  const gainXP = useCallback((amount: number) => {
    setUser(prev => {
      if (!prev) return null;
      const newXP = prev.xp + amount;
      const newLevel = Math.floor(newXP / XP_PER_LEVEL) + 1;
      
      const updatedUser = { ...prev, xp: newXP, level: newLevel };
      
      if (newLevel > prev.level) {
        showToast(`LEVEL UP! You are now Level ${newLevel}! 🔥`, "success");
        if (newLevel === 5) unlockBadge('sync_pro', 'Sync Pro');
      }
      
      if (newXP >= 1000) unlockBadge('high_vibe', 'High Vibe');

      localStorage.setItem('mr_vibe_active_user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, [showToast, unlockBadge]);

  const checkMilestones = useCallback(() => {
    if (!user) return;
    const totalMessages = sessions.reduce((acc, s) => acc + s.messages.length, 0);
    if (totalMessages >= 50) unlockBadge('chat_champion', 'Chat Champion');
    if (allPinnedMessages.length >= 10) unlockBadge('librarian', 'Neural Librarian');
  }, [user, sessions, allPinnedMessages.length, unlockBadge]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    checkMilestones();
  }, [messages, isLoading, checkMilestones]);

  const handleApiError = useCallback((error: any) => {
    console.error("Neural Error:", error);
    showToast(`Neural Sync Error: ${error?.message || "Brain fog detected."}`, "error");
  }, [showToast]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('mr_vibe_settings', JSON.stringify(updated));
      return updated;
    });
    if (newSettings.personalityId) {
      setUser(prev => {
        if (!prev) return null;
        const updated = { ...prev, personalityId: newSettings.personalityId as PersonalityId };
        localStorage.setItem('mr_vibe_active_user', JSON.stringify(updated));
        return updated;
      });
    }
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.clear();
    window.location.reload();
  }, []);

  const togglePin = useCallback((messageId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? {
        ...s,
        messages: s.messages.map(m => m.id === messageId ? { ...m, isPinned: !m.isPinned } : m)
      } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    showToast("Neural Node Pinned! 🧠", "success");
    gainXP(5);
  }, [activeSessionId, showToast, gainXP]);

  const handleNewChat = useCallback((autoGreet = true) => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { id: newId, title: 'New Neural Sync...', messages: [], lastTimestamp: Date.now(), personalityId: settings.personalityId };
    setSessions(prev => {
      const updated = [newSession, ...prev];
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    setActiveSessionId(newId);
    localStorage.setItem('mr_vibe_active_session_id', newId);
    setIsLibraryOpen(false);
    setIsHistoryOpen(false);
    if (autoGreet) generateInitialGreeting(newId, settings.personalityId);
    return newId;
  }, [settings.personalityId]);

  const generateInitialGreeting = async (sessionId: string, personalityId: PersonalityId) => {
    setIsLoading(true);
    try {
      const currentGooglePass = localStorage.getItem('mr_vibe_google_pass');
      if (activeProvider === 'google' && currentGooglePass) {
        const ai = new GoogleGenAI({ apiKey: currentGooglePass });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ text: `GREETING PROTOCOL: Just say a short hi to ${user?.userName || 'bestie'}. Offer to play a game if they are bored.` }],
          config: { systemInstruction: `${BASE_SYSTEM_PROMPT}\n\n${PERSONALITIES[personalityId].prompt}` }
        });
        const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: response.text || 'Yo!', timestamp: Date.now(), provider: 'google' };
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s));
      }
    } catch (e: any) { handleApiError(e); } finally { setIsLoading(false); }
  };

  const handleSendToAI = async (text: string, customSystemInstruction?: string) => {
    const currentGooglePass = localStorage.getItem('mr_vibe_google_pass');
    const currentOpenaiPass = localStorage.getItem('mr_vibe_openai_pass');

    if (!currentGooglePass && !currentOpenaiPass) { 
      showToast("Neural License Required.", "error"); 
      setIsProfileModalOpen(true); 
      return; 
    }
    
    const readyFiles = pendingFiles.filter(f => !f.isUploading);
    if ((!text.trim() && readyFiles.length === 0) || isLoading) return;
    
    let sessionId = activeSessionId || handleNewChat(false);
    const currentFiles: FileAttachment[] = readyFiles.map(f => ({ data: f.data, name: f.name, type: f.type }));
    setPendingFiles([]);
    const textToSend = text;
    setInputText('');

    gainXP(10);

    setSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { 
        ...s, 
        messages: [...s.messages, { id: `u-${Date.now()}`, role: 'user' as const, text: textToSend, files: currentFiles.length > 0 ? currentFiles : undefined, timestamp: Date.now() }], 
        lastTimestamp: Date.now() 
      } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });

    const instruction = customSystemInstruction || `${BASE_SYSTEM_PROMPT}\n\n${currentPersonality.prompt}`;
    setIsLoading(true);

    try {
      if (activeProvider === 'google' && currentGooglePass) {
        const ai = new GoogleGenAI({ apiKey: currentGooglePass });
        const parts: any[] = [];
        currentFiles.forEach(f => parts.push(f.type.includes('image') ? { inlineData: { data: f.data.split(',')[1], mimeType: f.type } } : { text: `[FILE: ${f.name}]` }));
        parts.push({ text: textToSend });
        const response = await ai.models.generateContent({ 
          model: 'gemini-3-flash-preview', 
          contents: { parts },
          config: { systemInstruction: instruction, tools: [{ googleSearch: {} }] } 
        });
        const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: response.text || '...', timestamp: Date.now(), groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[], provider: 'google' };
        
        // Reward game winners explicitly based on text
        const winSignals = ['you won', 'you win', 'congrats', 'perfect guess', 'you got it'];
        if (winSignals.some(sig => response.text?.toLowerCase().includes(sig))) {
          gainXP(50);
          showToast("+50 XP! Winner winner! 🏆", "success");
          unlockBadge('game_master', 'Game Master');
        }

        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s));
      } else if (activeProvider === 'openai' && currentOpenaiPass) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentOpenaiPass}` },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: instruction },
              { role: 'user', content: textToSend }
            ]
          })
        });
        const data = await response.json();
        const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: data.choices[0].message.content || '...', timestamp: Date.now(), provider: 'openai' };
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s));
      }
    } catch (e: any) { handleApiError(e); } finally { setIsLoading(false); }
  };

  const { connect: connectLive, isLive, volume, outputVolume } = useGeminiLive({
    personality: currentPersonality, settings, user: user as User, mode: selectedVoiceMode,
    onTranscript: () => {},
    onTurnComplete: (u, m) => { 
      const sId = activeSessionId || handleNewChat(false); 
      setSessions(prev => prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, { id: `u-${Date.now()}`, role: 'user', text: u, timestamp: Date.now() }, { id: `m-${Date.now() + 1}`, role: 'model', text: m, timestamp: Date.now() + 1, provider: 'google' }] } : s));
      gainXP(25);
      unlockBadge('voice_viber', 'Voice Viber');
    },
    onConnectionStateChange: () => {},
    onCommand: () => {},
    onError: (m) => handleApiError(m)
  });

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      const id = Date.now().toString();
      setPendingFiles(prev => [...prev, { id, data: '', name: file.name, type: file.type, progress: 0, isUploading: true, reader }]);
      reader.onload = () => setPendingFiles(prev => prev.map(f => f.id === id ? { ...f, data: reader.result as string, isUploading: false } : f));
      reader.readAsDataURL(file);
    });
  };

  const handleOnboardingComplete = () => {
    if (tempProfile.userName && (tempProfile.googleKey || tempProfile.openaiKey)) {
      const newUser = { ...tempProfile, googleApiKey: tempProfile.googleKey, openaiApiKey: tempProfile.openaiKey, xp: 0, level: 1, badges: ['sync_initiate'] } as User;
      localStorage.setItem('mr_vibe_active_user', JSON.stringify(newUser));
      if (tempProfile.googleKey) { 
        localStorage.setItem('mr_vibe_google_pass', tempProfile.googleKey); 
        setGoogleLicense(tempProfile.googleKey); 
      }
      if (tempProfile.openaiKey) { 
        localStorage.setItem('mr_vibe_openai_pass', tempProfile.openaiKey); 
        setOpenaiLicense(tempProfile.openaiKey); 
      }
      setUser(newUser); setIsNewUser(false); handleNewChat(true);
    }
  };

  const handleSaveLicense = (type: 'google' | 'openai', val: string) => {
    const key = type === 'google' ? 'mr_vibe_google_pass' : 'mr_vibe_openai_pass';
    localStorage.setItem(key, val);
    if (type === 'google') setGoogleLicense(val);
    else setOpenaiLicense(val);
    showToast(`${type === 'google' ? 'Gemini' : 'OpenAI'} Neural License Secured!`, "success");
  };

  const handleResetLicense = (type: 'google' | 'openai') => {
    const key = type === 'google' ? 'mr_vibe_google_pass' : 'mr_vibe_openai_pass';
    localStorage.removeItem(key);
    if (type === 'google') setGoogleLicense('');
    else setOpenaiLicense('');
    showToast(`${type === 'google' ? 'Gemini' : 'OpenAI'} link severed.`, "info");
  };

  return (
    <div className={`fixed inset-0 flex flex-col bg-[#030303] text-zinc-100 overflow-hidden w-full h-full font-sans`}>
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}

      <header className="h-24 px-4 md:px-8 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-2xl z-50 pt-2">
        <Tooltip text="Sync History">
          <button onClick={() => setIsHistoryOpen(true)} className="p-3 rounded-2xl hover:bg-white/5 transition-all text-zinc-400 hover:text-white"><Menu size={24} /></button>
        </Tooltip>
        
        <div className="flex flex-col items-center flex-1 max-w-[240px] mx-auto px-4">
          <div className="flex items-center gap-2 mb-1">
             <h1 className="font-black text-[11px] md:text-[13px] uppercase tracking-[0.4em] text-blue-500">MR. VIBE AI</h1>
             {user && user.level >= 10 && <Crown size={12} className="text-amber-500" />}
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
             <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-400 transition-all duration-1000" style={{ width: `${currentLevelProgress}%` }} />
          </div>
          <div className="flex justify-between w-full mt-1.5">
             <div className="flex items-center gap-1">
                <span className="text-[9px] font-black text-white px-1.5 py-0.5 bg-blue-600 rounded-md">LVL {user?.level || 1}</span>
             </div>
             <div className="flex items-center gap-1">
                <Flame size={10} className="text-orange-500" />
                <span className="text-[9px] font-black text-zinc-400">{user?.xp || 0} XP</span>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip text="Neural Library & Achievements">
            <button onClick={() => setIsLibraryOpen(true)} className="p-3 rounded-2xl relative text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-all shadow-lg group">
              <Brain size={24} className="group-hover:scale-110 transition-transform" />
              {user && user.badges.length > 1 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black border-2 border-black">
                   {user.badges.length}
                </span>
              )}
            </button>
          </Tooltip>
          <Tooltip text="Engine Core Settings">
            <button onClick={() => setIsProfileModalOpen(true)} className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white/10 shadow-xl active:scale-95 transition-all">
               <img src={user?.avatarUrl || AVATARS[0]} className="w-full h-full object-cover" alt="avatar" />
            </button>
          </Tooltip>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 md:px-12 py-10 space-y-12 custom-scrollbar relative">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-12 max-w-lg mx-auto">
            <VibeOrb active={isLive} isThinking={isLoading} volume={volume} outputVolume={outputVolume} personalityId={settings.personalityId} />
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.6em] text-blue-500">IDENTITY ESTABLISHED: {user?.userName}</h3>
              <p className="text-[14px] font-bold text-zinc-500">"The Engine is ready. What's the move today, bestie?"</p>
              <div className="flex justify-center gap-3 mt-4">
                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/10 border border-blue-600/20 text-[9px] font-black uppercase tracking-widest text-blue-400">
                    <Medal size={12} /> Sync Initiate
                 </div>
                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-600/10 border border-amber-600/20 text-[9px] font-black uppercase tracking-widest text-amber-400">
                    <Trophy size={12} /> {user?.badges.includes('game_master') ? 'Game Master' : 'Game Initiate'}
                 </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 w-full">
              <Tooltip text="Direct Voice Sync (Voice Chat)">
                <button onClick={() => { setSelectedVoiceMode('chat'); connectLive(); }} className="w-full flex flex-col items-center gap-4 p-10 rounded-[48px] bg-blue-600/10 border border-blue-600/20 hover:bg-blue-600 hover:text-white transition-all group shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3"><Zap size={14} className="text-blue-500/30" /></div>
                  <Headset size={48} className="text-blue-500 group-hover:text-white transition-all" />
                  <span className="text-[10px] font-black uppercase tracking-widest mt-2">VOICE LINK</span>
                </button>
              </Tooltip>
              <Tooltip text="Engage Game Session (Earn XP)">
                <button onClick={() => handleSendToAI("let's play a game")} className="w-full flex flex-col items-center gap-4 p-10 rounded-[48px] bg-amber-600/10 border border-amber-600/20 hover:bg-amber-600 hover:text-white transition-all group shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3"><Star size={14} className="text-amber-500/30" /></div>
                  <Trophy size={48} className="text-amber-500 group-hover:text-white transition-all" />
                  <span className="text-[10px] font-black uppercase tracking-widest mt-2">GAME MODE</span>
                </button>
              </Tooltip>
            </div>

            <div className="p-6 bg-zinc-900/50 rounded-[40px] border border-white/5 w-full flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500"><Target size={20} /></div>
                  <div className="text-left">
                     <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Daily Objective</p>
                     <p className="text-[11px] font-bold text-white">Send 5 messages to Mr. Cute</p>
                  </div>
               </div>
               <div className="text-right">
                  <span className="text-[10px] font-black text-blue-500">+50 XP</span>
               </div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-vibe-in group max-w-full`}>
              {msg.files && (
                <div className="flex flex-wrap gap-2 mb-3 justify-end max-w-[85%]">
                  {msg.files.map((file, fIdx) => (
                    <div key={fIdx} className="rounded-[24px] overflow-hidden border border-white/10 bg-zinc-900 shadow-xl">
                      {file.type.startsWith('image/') ? <img src={file.data} className="w-48 h-auto" alt="attachment" /> : <div className="flex items-center gap-3 p-4 font-bold text-[11px]"><FileText size={20} className="text-blue-500" /> {file.name}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div className="relative flex items-end gap-3 max-w-[95%]">
                {msg.role === 'model' && <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 shrink-0"><img src={AVATARS[index % AVATARS.length]} className="w-full h-full object-cover" alt="avatar" /></div>}
                <div className={`px-6 py-5 rounded-[28px] text-[15px] border transition-all ${msg.role === 'user' ? 'bg-blue-600 text-white border-blue-500/20 rounded-br-none' : 'bg-[#111111] text-zinc-100 border-white/5 rounded-bl-none shadow-lg'}`}>
                  <MarkdownText text={msg.text} />
                  
                  {msg.role === 'model' && msg.groundingChunks && msg.groundingChunks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                        <Sparkles size={12} className="text-blue-500" />
                        Verification Sources
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.groundingChunks.map((chunk, cIdx) => chunk.web && (
                          <a 
                            key={cIdx} 
                            href={chunk.web.uri} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                          >
                            <ChevronRight size={10} />
                            {chunk.web.title || 'Source Reference'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between opacity-30 group-hover:opacity-100 transition-opacity">
                    <span className="text-[8px] font-black uppercase tracking-widest">{msg.provider || 'Neural'} Node</span>
                    {msg.role === 'model' && (
                      <div className="flex items-center gap-3">
                        <Tooltip text={msg.isPinned ? "Unpin Knowledge" : "Pin to Library"}>
                          <button onClick={() => togglePin(msg.id)} className={`p-1 hover:text-blue-400 ${msg.isPinned ? 'text-blue-500' : ''}`}><Pin size={12} /></button>
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && <div className="flex gap-2 p-6"><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" /><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" /><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" /></div>}
        <div ref={messagesEndRef} className="h-20 w-full" />
      </main>

      <footer className="px-4 pb-10 pt-4 bg-gradient-to-t from-black via-black/90 to-transparent z-40">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
             <div className="flex bg-white/5 rounded-[20px] p-1 border border-white/10 backdrop-blur-3xl">
               <Tooltip text="Activate Gemini Engine">
                 <button onClick={() => updateSettings({ preferredProvider: 'google' })} className={`px-5 py-2.5 rounded-[16px] text-[10px] font-black uppercase tracking-widest transition-all ${activeProvider === 'google' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>GEMINI</button>
               </Tooltip>
               <Tooltip text="Activate GPT Engine">
                 <button onClick={() => updateSettings({ preferredProvider: 'openai' })} className={`px-5 py-2.5 rounded-[16px] text-[10px] font-black uppercase tracking-widest transition-all ${activeProvider === 'openai' ? 'bg-zinc-800 text-zinc-300 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>GPT-4O</button>
               </Tooltip>
             </div>
             <div className="flex-1 flex justify-center gap-2">
                <Tooltip text="Instant Voice Link">
                   <button onClick={() => { setSelectedVoiceMode('chat'); connectLive(); }} className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all shadow-lg"><Mic size={20}/></button>
                </Tooltip>
                <Tooltip text="Play a Game (+50 XP)">
                   <button onClick={() => handleSendToAI("let's play a game")} className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white transition-all shadow-lg animate-pulse"><Trophy size={20}/></button>
                </Tooltip>
                <Tooltip text="Instant Note Sync">
                   <button onClick={() => { setSelectedVoiceMode('note'); connectLive(); }} className="p-4 bg-zinc-900 rounded-2xl border border-white/10 text-zinc-500 hover:text-white transition-all shadow-lg"><StickyNote size={20}/></button>
                </Tooltip>
             </div>
             <Tooltip text="Reset Sync Session">
               <button onClick={() => handleNewChat()} className="p-4 bg-white/5 rounded-2xl border border-white/10 text-zinc-500 hover:text-white transition-all shadow-xl"><Plus size={24}/></button>
             </Tooltip>
          </div>

          <div className={`flex items-center gap-2 p-2 border border-white/10 rounded-[40px] shadow-2xl bg-black/80 backdrop-blur-3xl transition-all`}>
            <Tooltip text="Sync Knowledge Files">
              <button onClick={() => fileInputRef.current?.click()} className="p-5 text-zinc-500 hover:text-blue-500 transition-colors"><Paperclip size={24}/><input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFilesUpload} /></button>
            </Tooltip>
            <input type="text" placeholder="Transmit thoughts..." value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} className="flex-1 bg-transparent py-4 px-2 font-bold text-[15px] outline-none text-white placeholder-zinc-700" />
            <Tooltip text="Transmit Signal">
              <button onClick={() => handleSendToAI(inputText)} className={`p-5 rounded-full transition-all active:scale-95 ${inputText.trim() ? 'bg-blue-600 text-white shadow-2xl' : 'text-zinc-800'}`}><Send size={24}/></button>
            </Tooltip>
          </div>
        </div>
      </footer>

      {/* History Sidebar */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[13000] flex animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)} />
          <div className="relative w-80 h-full p-8 bg-[#080808] border-r border-white/10 animate-slide-in-right">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-2"><History size={20} className="text-blue-500"/> Sync History</h2>
              <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-white/5 rounded-xl"><X size={20}/></button>
            </div>
            <div className="space-y-3 overflow-y-auto h-[calc(100%-120px)] custom-scrollbar">
              {sessions.map(s => (
                <button key={s.id} onClick={() => { setActiveSessionId(s.id); setIsHistoryOpen(false); }} className={`w-full p-4 rounded-2xl text-left border transition-all ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                  <div className="font-black text-[12px] truncate text-zinc-100">{s.messages[0]?.text || 'Untitled Sync'}</div>
                  <div className="text-[9px] font-bold text-zinc-500 uppercase mt-1 tracking-widest">{new Date(s.lastTimestamp).toLocaleDateString()}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Neural Library Sidebar - Badges & Stats */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-[13000] flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsLibraryOpen(false)} />
          <div className={`relative w-full max-w-md h-full p-8 animate-slide-in-right border-l bg-[#080808] border-white/10 overflow-y-auto custom-scrollbar`}>
            <div className="flex items-center justify-between mb-10">
              <div className="flex flex-col">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">Neural Library</h2>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">SYNC PERFORMANCE & ACHIEVEMENTS</span>
              </div>
              <button onClick={() => setIsLibraryOpen(false)} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all"><X size={24}/></button>
            </div>

            {/* User Stat Cards */}
            <div className="grid grid-cols-2 gap-4 mb-10">
               <div className="p-6 rounded-[32px] bg-blue-600/5 border border-blue-500/10 flex flex-col items-center gap-2">
                  <Flame size={20} className="text-orange-500" />
                  <span className="text-xl font-black text-white">{user?.xp}</span>
                  <span className="text-[9px] font-black uppercase text-zinc-500">Total XP</span>
               </div>
               <div className="p-6 rounded-[32px] bg-emerald-600/5 border border-emerald-500/10 flex flex-col items-center gap-2">
                  <Target size={20} className="text-emerald-500" />
                  <span className="text-xl font-black text-white">{sessions.length}</span>
                  <span className="text-[9px] font-black uppercase text-zinc-500">Total Sessions</span>
               </div>
            </div>

            {/* Badges Section */}
            <section className="mb-12">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-6 flex items-center gap-2 px-2">
                 <Medal size={14} className="text-blue-500" /> Global Achievements
               </h3>
               <div className="grid grid-cols-3 gap-3">
                 <BadgeItem name="Sync Initiate" icon={ShieldCheck} description="Completed the engine onboarding process." unlocked={true} />
                 <BadgeItem name="Sync Pro" icon={Medal} description="Achieve Level 5 to unlock." unlocked={user ? user.level >= 5 : false} />
                 <BadgeItem name="High Vibe" icon={Zap} description="Cross 1,000 XP milestone." unlocked={user ? user.xp >= 1000 : false} />
                 <BadgeItem name="Game Master" icon={Trophy} description="Defeat Mr. Cute in a game." unlocked={user ? user.badges.includes('game_master') : false} />
                 <BadgeItem name="Librarian" icon={BookOpenCheck} description="Pin at least 10 knowledge nodes." unlocked={user ? user.badges.includes('librarian') : false} />
                 <BadgeItem name="Voice Viber" icon={Headset} description="Used Voice Link for the first time." unlocked={user ? user.badges.includes('voice_viber') : false} />
                 <BadgeItem name="Night Sync" icon={Activity} description="Chatted with Mr. Cute after midnight." unlocked={user ? user.badges.includes('night_sync') : false} />
                 <BadgeItem name="Social Legend" icon={Crown} description="Top 1% of global syncers." unlocked={false} />
                 <BadgeItem name="Chat Champ" icon={Users} description="Sent over 50 messages total." unlocked={user ? user.badges.includes('chat_champion') : false} />
               </div>
            </section>
            
            <div className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 flex items-center gap-2 px-2">
                 <Pin size={14} className="text-blue-500" /> Pinned Nodes ({allPinnedMessages.length})
               </h3>
              {allPinnedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-30 bg-white/5 rounded-[40px] border border-dashed border-white/10">
                  <Brain size={48} className="text-zinc-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest leading-loose">No pinned data found.</p>
                </div>
              ) : (
                allPinnedMessages.map(m => (
                  <div key={m.id} className="group p-6 rounded-[32px] bg-white/5 border border-white/5 hover:border-blue-500/30 transition-all relative">
                    <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase tracking-widest text-blue-400">
                      <Pin size={12} fill="currentColor" /> {new Date(m.timestamp).toLocaleDateString()}
                    </div>
                    <div className="text-[14px] leading-relaxed font-medium mb-4 text-zinc-400">
                      {m.text.slice(0, 300)}{m.text.length > 300 ? '...' : ''}
                    </div>
                    <div className="flex items-center justify-between">
                      <button onClick={() => { setActiveSessionId(m.sessionId as string); setIsLibraryOpen(false); }} className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-zinc-500 hover:text-blue-500 transition-all">View Context <ChevronRight size={14}/></button>
                      <button onClick={() => togglePin(m.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Engine Core Settings Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[14000] flex items-center justify-center p-6 animate-fade-in">
           <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl" onClick={() => setIsProfileModalOpen(false)} />
           <div className="relative w-full max-w-2xl rounded-[48px] p-8 md:p-14 space-y-10 animate-scale-in border bg-[#080808] border-white/10 overflow-y-auto max-h-[92vh] custom-scrollbar">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 shadow-lg">
                    <Settings size={24} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter">Engine Core</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 mt-1">SYSTEM CONFIGURATION</p>
                  </div>
                </div>
                <button onClick={() => setIsProfileModalOpen(false)} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all"><X size={22}/></button>
              </div>

              <div className="space-y-10">
                {/* Identity & Stats Section */}
                <section className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 rounded-[40px] p-8 border border-blue-500/20 shadow-xl">
                   <div className="flex flex-col sm:flex-row items-center gap-8">
                      <div className="relative group">
                         <div className="w-32 h-32 rounded-full border-4 border-blue-500/30 p-1.5 transition-transform group-hover:scale-105">
                            <img src={user?.avatarUrl} className="w-full h-full object-cover rounded-full" alt="avatar" />
                         </div>
                         <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center font-black text-lg border-4 border-black shadow-xl">
                            {user?.level}
                         </div>
                      </div>
                      <div className="flex-1 space-y-4 w-full text-center sm:text-left">
                         <div>
                            <h3 className="text-3xl font-black text-white">{user?.userName}</h3>
                            <p className="text-[10px] font-black uppercase text-blue-500 tracking-[0.3em] mt-1">Status: Level {user?.level} Syncer</p>
                         </div>
                         <div className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest px-1">
                               <span className="text-zinc-500">{user?.xp} TOTAL XP</span>
                               <span className="text-blue-500">{(user?.level || 1) * XP_PER_LEVEL - (user?.xp || 0)} XP TO NEXT</span>
                            </div>
                            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden shadow-inner">
                               <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-400 transition-all duration-1000" style={{ width: `${currentLevelProgress}%` }} />
                            </div>
                         </div>
                      </div>
                   </div>
                </section>

                {/* Social Leaderboard Preview */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                       <Users size={16} className="text-blue-500" /> Global Sync Board
                    </div>
                    <span className="text-[9px] font-black text-blue-500/50 uppercase tracking-widest">Season 1 Active</span>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-[40px] overflow-hidden">
                     {MOCK_LEADERBOARD.map((p, idx) => (
                       <div key={idx} className={`flex items-center justify-between p-6 border-b border-white/5 last:border-0 ${idx === 0 ? 'bg-amber-500/5' : ''}`}>
                          <div className="flex items-center gap-4">
                             <span className={`w-6 text-center text-sm font-black ${idx === 0 ? 'text-amber-500' : 'text-zinc-700'}`}>{idx + 1}</span>
                             <img src={p.avatar} className="w-10 h-10 rounded-xl border border-white/10" alt="rank" />
                             <div>
                                <p className="text-sm font-black text-white">{p.name}</p>
                                <p className="text-[9px] font-black uppercase text-zinc-600">LVL {p.level}</p>
                             </div>
                          </div>
                          {idx === 0 && <Crown size={16} className="text-amber-500" />}
                       </div>
                     ))}
                     {/* User's position */}
                     <div className="flex items-center justify-between p-6 bg-blue-600/20 border-t-2 border-blue-500/30">
                        <div className="flex items-center gap-4">
                           <span className="w-6 text-center text-sm font-black text-blue-400">#99+</span>
                           <img src={user?.avatarUrl} className="w-10 h-10 rounded-xl border-2 border-blue-500" alt="rank" />
                           <div>
                              <p className="text-sm font-black text-white">{user?.userName} (You)</p>
                              <p className="text-[9px] font-black uppercase text-blue-400">LVL {user?.level}</p>
                           </div>
                        </div>
                        <Target size={16} className="text-blue-500 animate-pulse" />
                     </div>
                  </div>
                </section>

                {/* Archetype Section */}
                <section className="space-y-6">
                  <div className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest px-2">
                    <UserIcon size={16} /> Archetype Profile
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-[40px] p-8 space-y-4 shadow-xl">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.values(PERSONALITIES).map(p => (
                        <button 
                          key={p.id} 
                          onClick={() => updateSettings({ personalityId: p.id })}
                          className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 text-[10px] font-black uppercase tracking-widest ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-600/20' : 'bg-white/5 border-transparent text-zinc-500 hover:bg-white/10'}`}
                        >
                          <span className="text-2xl">{p.emoji}</span> {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Neural License Management Section */}
                <section className="space-y-6">
                  <div className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest px-2">
                    <ShieldCheck size={16} className="text-emerald-500" /> Neural Licenses
                  </div>
                  
                  <div className="grid gap-6">
                    {/* Google License */}
                    <div className="bg-white/5 border border-white/5 rounded-[40px] p-8 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Cpu size={20} className="text-blue-500" />
                          <span className="text-[14px] font-black uppercase tracking-widest">Google Gemini License</span>
                        </div>
                        {googleLicense && <CheckCircle2 size={18} className="text-emerald-500 shadow-emerald-500/50" />}
                      </div>
                      <div className="relative">
                        <input 
                          type="password" 
                          value={googleLicense} 
                          placeholder="Paste Gemini Neural License..." 
                          onChange={e => handleSaveLicense('google', e.target.value)}
                          className="w-full py-5 pl-8 pr-16 rounded-[24px] bg-black/40 border border-white/5 focus:border-blue-500 outline-none font-mono text-[13px] transition-all text-white placeholder-zinc-800" 
                        />
                        <Key className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-700" size={20} />
                      </div>
                      <div className="flex items-center justify-between px-2">
                         <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">AUTO-SYNC ON PASTE</p>
                         <button onClick={() => handleResetLicense('google')} className="text-[10px] font-black text-rose-500/60 uppercase tracking-widest hover:text-rose-500 transition-all flex items-center gap-2"><RefreshCcw size={12}/> Sever Link</button>
                      </div>
                    </div>

                    {/* OpenAI License */}
                    <div className="bg-white/5 border border-white/5 rounded-[40px] p-8 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Database size={20} className="text-emerald-500" />
                          <span className="text-[14px] font-black uppercase tracking-widest">OpenAI GPT-4 License</span>
                        </div>
                        {openaiLicense && <CheckCircle2 size={18} className="text-emerald-500 shadow-emerald-500/50" />}
                      </div>
                      <div className="relative">
                        <input 
                          type="password" 
                          value={openaiLicense} 
                          placeholder="Paste OpenAI Neural License..." 
                          onChange={e => handleSaveLicense('openai', e.target.value)}
                          className="w-full py-5 pl-8 pr-16 rounded-[24px] bg-black/40 border border-white/5 focus:border-emerald-500 outline-none font-mono text-[13px] transition-all text-white placeholder-zinc-800" 
                        />
                        <Key className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-700" size={20} />
                      </div>
                      <div className="flex items-center justify-between px-2">
                         <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">AUTO-SYNC ON PASTE</p>
                         <button onClick={() => handleResetLicense('openai')} className="text-[10px] font-black text-rose-500/60 uppercase tracking-widest hover:text-rose-500 transition-all flex items-center gap-2"><RefreshCcw size={12}/> Sever Link</button>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="pt-10 border-t border-white/5 flex flex-col items-center gap-8">
                  <button onClick={handleLogout} className="w-full py-6 rounded-[36px] bg-rose-500/10 text-rose-500 font-black text-[12px] uppercase flex items-center justify-center gap-4 hover:bg-rose-500 hover:text-white transition-all group shadow-lg">
                    <LogOut size={20} className="group-hover:rotate-12 transition-transform" /> TERMINATE ALL NEURAL PATHWAYS
                  </button>
                  <p className="text-[10px] font-black uppercase text-center text-zinc-800 tracking-[0.5em]">MR. VIBE ENGINE v2.5 PRO</p>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Onboarding Flow - Unchanged logic, just ensure types match */}
      {isNewUser && (
        <div className="fixed inset-0 z-[20000] bg-[#020202] flex items-center justify-center overflow-y-auto custom-scrollbar p-2 sm:p-6">
          <div className="flex w-full max-w-[450px] min-h-[750px] relative">
            <div className="flex-1 bg-[#0a0a0a] rounded-[60px] border border-white/5 shadow-2xl p-8 flex flex-col relative overflow-hidden">
               <div className="flex flex-col items-center mt-6 mb-12">
                  <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)] mb-8">
                    <Zap size={32} className="text-blue-500 fill-blue-500/10" />
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tighter text-white leading-none mb-4 text-center">MR. VIBE AI</h1>
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-blue-500 text-center">INITIALIZE YOUR<br/>INTELLIGENCE</p>
               </div>
               <div className="flex-1 space-y-10">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                       <UserCircle size={16} className="text-blue-500" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Neural Alias</span>
                    </div>
                    <div className="bg-white/5 rounded-[30px] p-1 border border-white/5">
                       <input type="text" placeholder="Whats your name?" value={tempProfile.userName} onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} className="w-full bg-transparent py-5 px-8 font-bold text-[18px] text-white outline-none placeholder-zinc-700" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                       <Shield size={16} className="text-emerald-500" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Neural Licenses</span>
                    </div>
                    <div className="space-y-3">
                       <div className="bg-white/5 rounded-[30px] p-1 border border-white/5 flex items-center">
                          <div className="pl-6 text-blue-500/40"><Cpu size={18} /></div>
                          <input type="password" placeholder="Link Gemini..." value={tempProfile.googleKey} onChange={e => setTempProfile({...tempProfile, googleKey: e.target.value})} className="w-full bg-transparent py-4 px-4 font-mono text-[14px] text-white outline-none placeholder-zinc-800" />
                       </div>
                       <div className="bg-white/5 rounded-[30px] p-1 border border-white/5 flex items-center">
                          <div className="pl-6 text-emerald-500/40"><Database size={18} /></div>
                          <input type="password" placeholder="Link OpenAI..." value={tempProfile.openaiKey} onChange={e => setTempProfile({...tempProfile, openaiKey: e.target.value})} className="w-full bg-transparent py-4 px-4 font-mono text-[14px] text-white outline-none placeholder-zinc-800" />
                       </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                       <Zap size={16} className="text-amber-500" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Archetype</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
                       {Object.values(PERSONALITIES).map(p => (
                         <button key={p.id} onClick={() => setTempProfile({...tempProfile, personalityId: p.id})} className={`shrink-0 p-5 rounded-[28px] border transition-all flex flex-col items-center gap-2 min-w-[100px] ${tempProfile.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-transparent text-zinc-600'}`}>
                           <span className="text-2xl">{p.emoji}</span>
                           <span className="text-[8px] font-black uppercase truncate">{p.name.split(' ')[0]}</span>
                         </button>
                       ))}
                    </div>
                  </div>
               </div>
               <div className="mt-10 mb-4">
                  <button onClick={handleOnboardingComplete} disabled={!tempProfile.userName || (!tempProfile.googleKey && !tempProfile.openaiKey)} className={`w-full py-6 rounded-[35px] font-black text-lg uppercase tracking-widest transition-all ${tempProfile.userName && (tempProfile.googleKey || tempProfile.openaiKey) ? 'bg-blue-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.3)] active:scale-95' : 'bg-zinc-900 text-zinc-800'}`}>Establish Link</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
