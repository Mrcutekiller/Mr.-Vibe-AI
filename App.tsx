
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
  Users, Crown, Flame, ArrowRight, ArrowLeft, Copy, Share2,
  Sun, Moon, List, Swords, Dices
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, PERSONALITY_STYLES } from './constants';
import { PersonalityId, AppSettings, User, ChatSession, Message, FileAttachment, GroundingChunk, GameResult, GameDifficulty } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';

interface PendingFile extends FileAttachment {
  id: string;
  progress: number;
  isUploading: boolean;
  reader?: FileReader;
}

const XP_PER_LEVEL = 500;

const Logo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M20 35C20 35 25 75 50 75C75 75 80 35 80 35" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
    <path d="M40 60C45 65 55 65 60 60" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <circle cx="82" cy="20" r="8" fill="currentColor" opacity="0.6" />
  </svg>
);

const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => (
  <div className="group relative flex items-center justify-center">
    {children}
    <div className="absolute bottom-full mb-3 hidden group-hover:block z-[15000] pointer-events-none">
      <div className="bg-zinc-900 dark:bg-zinc-800 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-2xl border border-white/10 dark:border-white/5 whitespace-nowrap animate-fade-in flex items-center gap-2">
        <Sparkles size={10} className="text-blue-400" />
        {text}
      </div>
    </div>
  </div>
);

const BadgeItem = ({ name, icon: Icon, unlocked, description }: { name: string, icon: any, unlocked: boolean, description: string }) => (
  <Tooltip text={description}>
    <div className={`flex flex-col items-center gap-2 p-4 rounded-3xl border transition-all w-full ${unlocked ? 'bg-blue-600/10 border-blue-500/30 text-blue-600 dark:text-white shadow-lg' : 'bg-zinc-100 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 text-zinc-400 dark:text-zinc-700 grayscale'}`}>
      <div className={`p-3 rounded-2xl ${unlocked ? 'bg-blue-500/20' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
        <Icon size={24} />
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest text-center">{name}</span>
    </div>
  </Tooltip>
);

const VibeOrb = ({ active, isThinking, volume, outputVolume, personalityId, isGaming }: { 
  active: boolean, 
  isThinking: boolean, 
  volume: number,
  outputVolume: number,
  personalityId: PersonalityId,
  isGaming?: boolean
}) => {
  const currentVol = active ? outputVolume || volume : 0;
  const scale = active ? 1 + currentVol * 1.8 : 1;
  const style = PERSONALITY_STYLES[personalityId] || PERSONALITY_STYLES[PersonalityId.STUDENT];
  
  return (
    <div className={`relative flex items-center justify-center w-40 h-40 md:w-64 md:h-64 transition-all duration-300 ${isThinking ? 'animate-pulse-orb' : ''} ${isGaming ? 'animate-hi-pulse' : ''}`}>
      <div 
        className={`absolute inset-0 rounded-full blur-3xl transition-opacity duration-700 ${active || isThinking ? 'opacity-60' : 'opacity-20'}`} 
        style={{ backgroundColor: style.glow }}
      />
      <div 
        className={`relative w-24 h-24 md:w-40 md:h-40 rounded-full transition-all duration-75 ease-out flex items-center justify-center shadow-2xl ${active ? `bg-gradient-to-br ${style.gradient} text-white` : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600'}`}
        style={{ transform: `scale(${scale})`, boxShadow: active ? `0 0 50px ${style.glow}` : 'none' }}
      >
        {isGaming ? <Swords className="w-1/2 h-1/2 animate-bounce" /> : <Logo className="w-1/2 h-1/2" />}
        <div className={`absolute inset-0 rounded-full bg-white/10 ${active ? 'animate-orb-float' : ''}`} />
      </div>
    </div>
  );
};

const NotificationToast = ({ message, type, onClose }: { message: string, type: string, onClose: () => void }) => (
  <div className="fixed top-6 md:top-10 inset-x-4 z-[10000] flex justify-center pointer-events-none">
    <div 
      className={`w-full max-w-sm mb-4 bg-white dark:bg-zinc-900 shadow-2xl rounded-[32px] border flex items-center gap-4 p-5 pointer-events-auto animate-slide-up ${
        type === 'success' ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' :
        type === 'error' ? 'border-rose-500/30 text-rose-600 dark:text-rose-400' :
        'border-blue-500/30 text-blue-600 dark:text-blue-400'
      }`}
    >
      <div className="flex-1 font-bold text-[12px] leading-tight">{message}</div>
      <button onClick={onClose} className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-all text-zinc-400">
        <X size={16} />
      </button>
    </div>
  </div>
);

const MarkdownText = ({ text }: { text: string }) => {
  const renderLine = (line: string, key: number) => {
    if (line.startsWith('###')) {
      return <h3 key={key} className="text-blue-600 dark:text-blue-500 font-black text-base mt-4 mb-2 flex items-center gap-2">
        <Activity size={16} /> {line.replace('###', '').trim()}
      </h3>;
    }
    const parts = line.split(/(\*\*.*?\*\*|`.*?`|https?:\/\/[^\s]+)/g);
    return (
      <div key={key} className="mb-1 last:mb-0 text-zinc-700 dark:text-zinc-300">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) return <strong key={idx} className="font-extrabold text-blue-600 dark:text-blue-400/90">{part.slice(2, -2)}</strong>;
          if (part.startsWith('`') && part.endsWith('`')) return <code key={idx} className="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono text-[11px] border border-black/5 dark:border-white/5">{part.slice(1, -1)}</code>;
          if (part.startsWith('http')) return <a key={idx} href={part} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-500 underline hover:no-underline transition-all">{part}</a>;
          return <span key={idx}>{part}</span>;
        })}
      </div>
    );
  };
  return <div className="leading-relaxed whitespace-pre-wrap">{text.split('\n').map((l, i) => renderLine(l, i))}</div>;
};

// Component to list URLs from grounding metadata as required by guidelines
const GroundingLinks = ({ chunks }: { chunks?: GroundingChunk[] }) => {
  if (!chunks || chunks.length === 0) return null;
  const links = chunks.filter(c => c.web?.uri);
  if (links.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 flex items-center gap-2">
        <Database size={12} /> Source Grounding
      </p>
      <div className="flex flex-wrap gap-2">
        {links.map((link, idx) => (
          <a
            key={idx}
            href={link.web!.uri}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-bold bg-blue-600/5 dark:bg-blue-600/10 hover:bg-blue-600/10 dark:hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full border border-blue-500/10 transition-all flex items-center gap-1.5"
          >
            <ShieldCheck size={10} /> {link.web!.title || 'Source'}
          </a>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_active_user'));
  const [onboardingStep, setOnboardingStep] = useState(0);
  
  const [toast, setToast] = useState<{id: string, message: string, type: string} | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('mr_vibe_active_user');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (!parsed.gameHistory) parsed.gameHistory = [];
    return parsed;
  });
  
  const [tempProfile, setTempProfile] = useState<Partial<User>>({ 
    userName: '', 
    avatarUrl: AVATARS[0], 
    personalityId: PersonalityId.STUDENT,
    preferredProvider: 'google'
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mr_vibe_settings');
    if (saved) return JSON.parse(saved);
    return { language: "English", theme: "dark", personalityId: PersonalityId.STUDENT, voiceName: "Aoede", speakingRate: 1.0, speakingPitch: 1.0, customCommands: [], preferredProvider: 'google', gameDifficulty: 'medium' };
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('mr_vibe_active_session_id'));
  const [sessions, setSessions] = useState<ChatSession[]>(() => JSON.parse(localStorage.getItem('mr_vibe_sessions') || '[]'));
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<'badges' | 'history'>('badges');

  const [inputText, setInputText] = useState('');
  const [interimUserText, setInterimUserText] = useState('');
  const [interimModelText, setInterimModelText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVoiceMode, setSelectedVoiceMode] = useState<'chat' | 'note'>('chat');
  
  const [rpsAnimating, setRpsAnimating] = useState(false);

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

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

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

  const recordGame = useCallback((gameName: string, resultText: string, userChoice?: string) => {
    let result: GameResult['result'] = 'completed';
    const text = resultText.toLowerCase();
    if (text.includes('win') || text.includes('won') || text.includes('congratulations')) result = 'win';
    else if (text.includes('lose') || text.includes('lost') || text.includes('defeated')) result = 'loss';
    else if (text.includes('draw') || text.includes('tie')) result = 'draw';

    const xpGained = result === 'win' ? 50 : 10;
    
    // Extract AI choice if RPS
    let aiChoice: string | undefined;
    if (gameName === 'Rock Paper Scissors') {
      if (text.includes('rock')) aiChoice = 'rock';
      else if (text.includes('paper')) aiChoice = 'paper';
      else if (text.includes('scissors')) aiChoice = 'scissors';
    }

    const newResult: GameResult = {
      id: Date.now().toString(),
      gameName,
      result,
      userChoice,
      aiChoice,
      xpGained,
      timestamp: Date.now()
    };

    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, gameHistory: [newResult, ...(prev.gameHistory || [])].slice(0, 50) };
      localStorage.setItem('mr_vibe_active_user', JSON.stringify(updated));
      return updated;
    });

    if (result === 'win') {
      unlockBadge('game_master', 'Game Master');
    }
  }, [unlockBadge]);

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

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, interimUserText, interimModelText]);

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

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Neural Node Copied! 📋", "success");
  }, [showToast]);

  const handleShare = useCallback((text: string) => {
    const dummyLink = `https://mrvibe.ai/share/${activeSessionId || Math.random().toString(36).substring(7)}`;
    const shareText = `${text}\n\nShared from Mr. Vibe AI ✨\nNeural Link: ${dummyLink}`;
    navigator.clipboard.writeText(shareText);
    showToast("Neural Share Link Copied! 🔗", "success");
  }, [activeSessionId, showToast]);

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
      const apiKey = process.env.API_KEY;
      if (activeProvider === 'google' && apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `GREETING PROTOCOL: Say a short hi to ${user?.userName || 'bestie'}. Offer to play Rock Paper Scissors or Guess the Number.`,
          config: { systemInstruction: `${BASE_SYSTEM_PROMPT.replace('[DIFFICULTY]', settings.gameDifficulty)}\n\n${PERSONALITIES[personalityId].prompt}` }
        });
        const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: response.text || 'Yo!', timestamp: Date.now(), provider: 'google' };
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s));
      }
    } catch (e: any) { handleApiError(e); } finally { setIsLoading(false); }
  };

  const handleSendToAI = async (text: string, userChoice?: string) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) { 
      showToast("Neural License Required.", "error"); 
      return; 
    }
    
    if (!text.trim() && pendingFiles.length === 0 || isLoading) return;
    
    let sessionId = activeSessionId || handleNewChat(false);
    const readyFiles = pendingFiles.filter(f => !f.isUploading);
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

    const instruction = `${BASE_SYSTEM_PROMPT.replace('[DIFFICULTY]', settings.gameDifficulty)}\n\n${currentPersonality.prompt}`;
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const parts: any[] = [];
      currentFiles.forEach(f => parts.push(f.type.includes('image') ? { inlineData: { data: f.data.split(',')[1], mimeType: f.type } } : { text: `[FILE: ${f.name}]` }));
      parts.push({ text: textToSend });
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: { parts },
        config: { systemInstruction: instruction, tools: [{ googleSearch: {} }] } 
      });
      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: response.text || '...', timestamp: Date.now(), groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[], provider: 'google' };
      
      // Game Result Logic
      const lowText = response.text?.toLowerCase() || '';
      if (userChoice && (lowText.includes('rock') || lowText.includes('paper') || lowText.includes('scissors'))) {
        recordGame('Rock Paper Scissors', response.text || '', userChoice);
      } else if (lowText.includes('won the game') || lowText.includes('correct number') || lowText.includes('guessed the concept')) {
        recordGame('AI Challenge', response.text || '');
      }

      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s));
    } catch (e: any) { handleApiError(e); } finally { setIsLoading(false); }
  };

  const { connect: connectLive, isLive, volume, outputVolume } = useGeminiLive({
    personality: currentPersonality, settings, user: user as User, mode: selectedVoiceMode,
    onTranscript: (text, isInterim, isModel) => {
      if (isModel) setInterimModelText(prev => prev + text);
      else setInterimUserText(prev => prev + text);
    },
    onTurnComplete: (u, m) => { 
      const sId = activeSessionId || handleNewChat(false); 
      setSessions(prev => prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, { id: `u-${Date.now()}`, role: 'user', text: u, timestamp: Date.now() }, { id: `m-${Date.now() + 1}`, role: 'model', text: m, timestamp: Date.now() + 1, provider: 'google' }] } : s));
      gainXP(25);
      unlockBadge('voice_viber', 'Voice Viber');
      setInterimUserText('');
      setInterimModelText('');
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
    if (tempProfile.userName) {
      const newUser = { ...tempProfile, xp: 100, level: 1, badges: ['sync_initiate'], gameHistory: [] } as User;
      localStorage.setItem('mr_vibe_active_user', JSON.stringify(newUser));
      setUser(newUser); setIsNewUser(false); handleNewChat(true);
      showToast("Sync Established. Welcome.", "success");
    }
  };

  const isRPSActive = useMemo(() => {
    if (messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'model') return false;
    const text = lastMsg.text.toLowerCase();
    const gameContext = text.includes('rock paper scissors') || text.includes('choose rock');
    const alreadyResponded = messages.slice(-1)[0].role === 'user' && ['rock', 'paper', 'scissors'].includes(messages.slice(-1)[0].text.toLowerCase());
    return gameContext && !alreadyResponded;
  }, [messages]);

  const handleRPSChoice = (choice: string) => {
    setRpsAnimating(true);
    setTimeout(() => {
      setRpsAnimating(false);
      handleSendToAI(choice, choice);
    }, 1200);
  };

  return (
    <div className={`fixed inset-0 flex flex-col bg-zinc-50 dark:bg-[#030303] text-zinc-900 dark:text-zinc-100 overflow-hidden w-full h-full font-sans transition-colors duration-500`}>
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}

      <header className="h-24 px-4 md:px-8 flex items-center justify-between border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-black/40 backdrop-blur-2xl z-50 pt-2">
        <Tooltip text="Sync History">
          <button onClick={() => setIsHistoryOpen(true)} className="p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all text-zinc-400 hover:text-blue-500"><Menu size={24} /></button>
        </Tooltip>
        
        <div className="flex flex-col items-center flex-1 max-w-[240px] mx-auto px-4">
          <div className="flex items-center gap-2 mb-1">
             <Logo className="w-5 h-5 text-blue-600 dark:text-blue-500" />
             <h1 className="font-black text-[11px] md:text-[13px] uppercase tracking-[0.4em] text-blue-600 dark:text-blue-500">MR. VIBE AI</h1>
             {user && user.level >= 10 && <Crown size={12} className="text-amber-500" />}
          </div>
          <div className="w-full h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
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
            <button onClick={() => { setLibraryTab('badges'); setIsLibraryOpen(true); }} className="p-3 rounded-2xl relative text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-all shadow-lg group">
              <Brain size={24} className="group-hover:scale-110 transition-transform" />
              {user && (user.badges.length > 1 || user.gameHistory.length > 0) && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black border-2 border-white dark:border-black">
                   {user.badges.length + (user.gameHistory.length > 0 ? 1 : 0)}
                </span>
              )}
            </button>
          </Tooltip>
          <Tooltip text="Engine Core Settings">
            <button onClick={() => setIsProfileModalOpen(true)} className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-black/5 dark:border-white/10 shadow-xl active:scale-95 transition-all">
               <img src={user?.avatarUrl || AVATARS[0]} className="w-full h-full object-cover" alt="avatar" />
            </button>
          </Tooltip>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 md:px-12 py-10 space-y-12 custom-scrollbar relative">
        {messages.length === 0 && !interimUserText && !interimModelText ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-12 max-w-lg mx-auto">
            <VibeOrb active={isLive} isThinking={isLoading} volume={volume} outputVolume={outputVolume} personalityId={settings.personalityId} isGaming={rpsAnimating} />
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.6em] text-blue-600 dark:text-blue-500">IDENTITY ESTABLISHED: {user?.userName}</h3>
              <p className="text-[14px] font-bold text-zinc-500">"Engine is synced. Want to play a game, bestie?"</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 w-full">
              <button onClick={() => handleSendToAI("let's play rock paper scissors")} className="w-full flex flex-col items-center gap-4 p-8 rounded-[48px] bg-blue-600/5 dark:bg-blue-600/10 border border-blue-600/10 hover:bg-blue-600 hover:text-white transition-all group shadow-2xl relative overflow-hidden">
                < Swords size={32} className="text-blue-500 group-hover:text-white transition-all" />
                <span className="text-[9px] font-black uppercase tracking-widest mt-2 text-center">Rock Paper<br/>Scissors</span>
              </button>
              <button onClick={() => handleSendToAI("let's play guess the number")} className="w-full flex flex-col items-center gap-4 p-8 rounded-[48px] bg-emerald-600/5 dark:bg-emerald-600/10 border border-emerald-600/10 hover:bg-emerald-600 hover:text-white transition-all group shadow-2xl relative overflow-hidden">
                < Dices size={32} className="text-emerald-500 group-hover:text-white transition-all" />
                <span className="text-[9px] font-black uppercase tracking-widest mt-2 text-center">Guess the<br/>Number</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-vibe-in group max-w-full`}>
                <div className="relative flex items-end gap-3 max-w-[95%]">
                  {msg.role === 'model' && <div className="w-8 h-8 rounded-full overflow-hidden border border-black/5 dark:border-white/10 shrink-0"><img src={AVATARS[index % AVATARS.length]} className="w-full h-full object-cover" alt="avatar" /></div>}
                  <div className={`px-6 py-5 rounded-[28px] text-[15px] border transition-all ${msg.role === 'user' ? 'bg-blue-600 text-white border-blue-500/20 rounded-br-none shadow-md' : 'bg-white dark:bg-[#111111] text-zinc-900 dark:text-zinc-100 border-black/5 dark:border-white/5 rounded-bl-none shadow-lg relative group'}`}>
                    <MarkdownText text={msg.text} />
                    {msg.groundingChunks && <GroundingLinks chunks={msg.groundingChunks} />}
                    <div className="mt-4 flex items-center justify-between opacity-30 group-hover:opacity-100 transition-opacity">
                      <span className="text-[8px] font-black uppercase tracking-widest">{msg.provider || 'Neural'} Node</span>
                      {msg.role === 'model' && (
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleCopy(msg.text)} className="p-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><Copy size={12} /></button>
                          <button onClick={() => togglePin(msg.id)} className={`p-1 hover:text-blue-600 dark:hover:text-blue-400 ${msg.isPinned ? 'text-blue-600 dark:text-blue-500' : ''}`}><Pin size={12} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isRPSActive && !isLoading && !rpsAnimating && (
              <div className="flex flex-col items-center gap-6 py-10 animate-slide-up w-full">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-600 dark:text-blue-500">Establish Choice</p>
                  <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">TAP TO PLAY</p>
                </div>
                <div className="flex gap-4">
                  {[
                    { id: 'rock', emoji: '🪨', label: 'ROCK', color: 'hover:bg-blue-600 shadow-blue-500/10' },
                    { id: 'paper', emoji: '📄', label: 'PAPER', color: 'hover:bg-emerald-600 shadow-emerald-500/10' },
                    { id: 'scissors', emoji: '✂️', label: 'SCISSORS', color: 'hover:bg-rose-600 shadow-rose-500/10' }
                  ].map((btn) => (
                    <button 
                      key={btn.id}
                      onClick={() => handleRPSChoice(btn.id)}
                      className={`w-24 h-24 md:w-28 md:h-28 rounded-[40px] bg-white dark:bg-[#111111] border border-black/5 dark:border-white/5 flex flex-col items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-2xl group ${btn.color}`}
                    >
                      <span className="text-3xl md:text-4xl group-hover:animate-bounce">{btn.emoji}</span>
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] group-hover:text-white transition-colors text-zinc-400 dark:text-zinc-600">{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {rpsAnimating && (
              <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-pulse">
                <Swords size={64} className="text-blue-600 dark:text-blue-500 animate-hi-pulse" />
                <p className="text-xl font-black uppercase italic tracking-tighter text-blue-600 dark:text-blue-500">"VIBE CHECK..."</p>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} className="h-20 w-full" />
      </main>

      <footer className="px-4 pb-10 pt-4 bg-gradient-to-t from-zinc-50 dark:from-black via-zinc-50/90 dark:via-black/90 to-transparent z-40">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex items-center gap-2 p-2 border border-black/5 dark:border-white/10 rounded-[40px] shadow-2xl bg-white/90 dark:bg-black/80 backdrop-blur-3xl transition-all">
            <button onClick={() => fileInputRef.current?.click()} className="p-5 text-zinc-400 dark:text-zinc-500 hover:text-blue-600 transition-colors"><Paperclip size={24}/><input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFilesUpload} /></button>
            <input type="text" placeholder="Transmit thoughts..." value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} className="flex-1 bg-transparent py-4 px-2 font-bold text-[15px] outline-none text-zinc-900 dark:text-white placeholder-zinc-300 dark:placeholder-zinc-700" />
            <button onClick={() => handleSendToAI(inputText)} className={`p-5 rounded-full transition-all active:scale-95 ${inputText.trim() ? 'bg-blue-600 text-white shadow-2xl' : 'text-zinc-200 dark:text-zinc-800'}`}><Send size={24}/></button>
          </div>
        </div>
      </footer>

      {/* Neural Library Sidebar */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-[13000] flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsLibraryOpen(false)} />
          <div className={`relative w-full max-md:max-w-full max-w-md h-full p-8 animate-slide-in-right border-l bg-white dark:bg-[#080808] border-black/5 dark:border-white/10 overflow-y-auto custom-scrollbar`}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col">
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white">Neural Library</h2>
                <div className="flex gap-4 mt-2">
                  <button onClick={() => setLibraryTab('badges')} className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${libraryTab === 'badges' ? 'text-blue-600 dark:text-blue-500 border-blue-600 dark:border-blue-500' : 'text-zinc-400 border-transparent'}`}>Achievements</button>
                  <button onClick={() => setLibraryTab('history')} className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${libraryTab === 'history' ? 'text-blue-600 dark:text-blue-500 border-blue-600 dark:border-blue-500' : 'text-zinc-400 border-transparent'}`}>Game Log</button>
                </div>
              </div>
              <button onClick={() => setIsLibraryOpen(false)} className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl hover:bg-black/10 dark:hover:bg-white/10 transition-all text-zinc-900 dark:text-white"><X size={24}/></button>
            </div>

            {libraryTab === 'badges' ? (
              <section className="space-y-10">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 rounded-[32px] bg-blue-600/5 border border-blue-500/10 flex flex-col items-center gap-2">
                      <Flame size={20} className="text-orange-500" />
                      <span className="text-xl font-black text-zinc-900 dark:text-white">{user?.xp}</span>
                      <span className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500">Total XP</span>
                  </div>
                  <div className="p-6 rounded-[32px] bg-emerald-600/5 border border-emerald-500/10 flex flex-col items-center gap-2">
                      <Swords size={20} className="text-emerald-500" />
                      <span className="text-xl font-black text-zinc-900 dark:text-white">{user?.gameHistory.length}</span>
                      <span className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500">Total Games</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <BadgeItem name="Sync Initiate" icon={ShieldCheck} description="Completed the engine onboarding process." unlocked={true} />
                  <BadgeItem name="Sync Pro" icon={Medal} description="Achieve Level 5 to unlock." unlocked={user ? user.level >= 5 : false} />
                  <BadgeItem name="High Vibe" icon={Zap} description="Cross 1,000 XP milestone." unlocked={user ? user.xp >= 1000 : false} />
                  <BadgeItem name="Game Master" icon={Trophy} description="Defeat Mr. Cute in a game." unlocked={user ? user.badges.includes('game_master') : false} />
                  <BadgeItem name="Librarian" icon={BookOpenCheck} description="Pin at least 10 knowledge nodes." unlocked={user ? user.badges.includes('librarian') : false} />
                  <BadgeItem name="Voice Viber" icon={Headset} description="Used Voice Link for the first time." unlocked={user ? user.badges.includes('voice_viber') : false} />
                </div>
              </section>
            ) : (
              <section className="space-y-4">
                {user?.gameHistory.length === 0 ? (
                  <div className="text-center py-20 opacity-20">
                    <History size={48} className="mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No game data establishes yet.</p>
                  </div>
                ) : (
                  user?.gameHistory.map(game => (
                    <div key={game.id} className="p-5 rounded-[28px] bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-[11px] font-black text-zinc-900 dark:text-white uppercase tracking-tighter">{game.gameName}</p>
                          <p className="text-[8px] font-bold text-zinc-400 uppercase mt-0.5">{new Date(game.timestamp).toLocaleString()}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          game.result === 'win' ? 'bg-emerald-500/20 text-emerald-600' : 
                          game.result === 'loss' ? 'bg-rose-500/20 text-rose-600' : 
                          'bg-zinc-500/20 text-zinc-600'
                        }`}>
                          {game.result}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 py-3 border-y border-black/5 dark:border-white/5 my-2">
                        <div className="flex-1 text-center">
                          <p className="text-[7px] font-black text-zinc-400 uppercase">You</p>
                          <p className="text-lg uppercase">{game.userChoice || '❓'}</p>
                        </div>
                        <Swords size={12} className="text-zinc-300" />
                        <div className="flex-1 text-center">
                          <p className="text-[7px] font-black text-zinc-400 uppercase">Mr. Cute</p>
                          <p className="text-lg uppercase">{game.aiChoice || '❓'}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[9px] font-black text-blue-600 dark:text-blue-500">+{game.xpGained} XP</span>
                        <Tooltip text="Neural Sync Verified">
                          <CheckCircle2 size={12} className="text-emerald-500 opacity-50" />
                        </Tooltip>
                      </div>
                    </div>
                  ))
                )}
              </section>
            )}
          </div>
        </div>
      )}

      {/* Engine Core Settings Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[14000] flex items-center justify-center p-6 animate-fade-in">
           <div className="absolute inset-0 bg-black/60 dark:bg-black/95 backdrop-blur-xl dark:backdrop-blur-3xl" onClick={() => setIsProfileModalOpen(false)} />
           <div className="relative w-full max-w-2xl rounded-[48px] p-8 md:p-14 space-y-10 animate-scale-in border bg-white dark:bg-[#080808] border-black/5 dark:border-white/10 overflow-y-auto max-h-[92vh] custom-scrollbar">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-600 dark:text-blue-500 shadow-lg"><Settings size={24} /></div>
                  <div>
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white">Engine Core</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 dark:text-blue-500 mt-1">SYSTEM CONFIGURATION</p>
                  </div>
                </div>
                <button onClick={() => setIsProfileModalOpen(false)} className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl hover:bg-black/10 dark:hover:bg-white/10 transition-all text-zinc-900 dark:text-white"><X size={22}/></button>
              </div>
              
              <div className="space-y-10">
                <section className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 rounded-[40px] p-8 border border-blue-500/20 shadow-xl">
                   <div className="flex flex-col sm:flex-row items-center gap-8">
                      <div className="relative group">
                         <div className="w-32 h-32 rounded-full border-4 border-blue-500/30 p-1.5 transition-transform group-hover:scale-105">
                            <img src={user?.avatarUrl} className="w-full h-full object-cover rounded-full" alt="avatar" />
                         </div>
                         <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center font-black text-lg border-4 border-black shadow-xl">{user?.level}</div>
                      </div>
                      <div className="flex-1 space-y-4 w-full text-center sm:text-left">
                         <h3 className="text-3xl font-black text-zinc-900 dark:text-white">{user?.userName}</h3>
                         <div className="w-full h-3 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-400 transition-all duration-1000" style={{ width: `${currentLevelProgress}%` }} />
                         </div>
                      </div>
                   </div>
                </section>

                <section className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500 px-2 flex items-center gap-2">
                    {/* Fixed typo: changed lowercase swords to capitalized Swords */}
                    <Swords size={14} className="text-amber-500" /> Neural Challenges
                  </h3>
                  <div className="p-6 bg-black/5 dark:bg-white/5 rounded-[32px] border border-black/5 dark:border-white/5 space-y-4">
                    <p className="text-[11px] font-bold text-zinc-900 dark:text-white uppercase">Game Difficulty</p>
                    <div className="flex bg-zinc-200 dark:bg-zinc-800 p-1 rounded-2xl">
                      {(['easy', 'medium', 'hard'] as GameDifficulty[]).map((d) => (
                        <button 
                          key={d}
                          onClick={() => updateSettings({ gameDifficulty: d })}
                          className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${settings.gameDifficulty === d ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500 px-2 flex items-center gap-2">
                    <Zap size={14} className="text-amber-500" /> Interface
                  </h3>
                  <div className="p-6 bg-black/5 dark:bg-white/5 rounded-[32px] border border-black/5 dark:border-white/5 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-500"><Moon size={18} /></div>
                          <div>
                             <p className="text-[11px] font-bold text-zinc-900 dark:text-white leading-none">Dark Mode</p>
                          </div>
                       </div>
                       <button 
                        onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
                        className={`w-14 h-8 rounded-full p-1 transition-all flex items-center ${settings.theme === 'dark' ? 'bg-blue-600 justify-end' : 'bg-zinc-200 dark:bg-zinc-800 justify-start'}`}
                       >
                         <div className={`w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center`}>
                           {settings.theme === 'dark' ? <Moon size={12} className="text-blue-600" /> : <Sun size={12} className="text-amber-500" />}
                         </div>
                       </button>
                  </div>
                </section>

                <button onClick={handleLogout} className="w-full py-6 rounded-[36px] bg-rose-500/10 text-rose-600 dark:text-rose-500 font-black text-[12px] uppercase flex items-center justify-center gap-4 hover:bg-rose-500 hover:text-white transition-all shadow-lg"><LogOut size={20} /> TERMINATE ALL NEURAL PATHWAYS</button>
              </div>
           </div>
        </div>
      )}

      {isNewUser && (
        <div className="fixed inset-0 z-[20000] bg-white dark:bg-[#020202] flex items-center justify-center overflow-hidden p-0 sm:p-6">
          <div className="flex w-full max-w-[480px] h-full sm:h-[85vh] relative animate-scale-in">
            <div className="flex-1 bg-zinc-50 dark:bg-[#0a0a0a] rounded-none sm:rounded-[60px] border-0 sm:border border-black/5 dark:border-white/5 shadow-2xl flex flex-col relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full flex h-1.5 bg-white/5 z-50">
                  {/* Updated onboarding steps count to exclude API key collection */}
                  {[0, 1, 2].map((step) => (
                    <div key={step} className={`flex-1 transition-all duration-500 ${onboardingStep >= step ? 'bg-blue-600' : 'bg-transparent'}`} />
                  ))}
               </div>
               <div className="flex flex-col items-center pt-16 pb-8 shrink-0">
                  <div className={`w-14 h-14 bg-blue-600/10 rounded-full flex items-center justify-center border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)] mb-4 transition-transform duration-700 ${onboardingStep === 0 ? 'scale-125' : 'scale-100'}`}>
                    <Logo className="w-10 h-10 text-blue-600 dark:text-blue-500" />
                  </div>
                  <h1 className="text-3xl font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white leading-none">MR. VIBE AI</h1>
               </div>
               <div className="flex-1 overflow-y-auto px-10 pb-10 flex flex-col justify-center animate-fade-in custom-scrollbar" key={onboardingStep}>
                  {onboardingStep === 0 && (
                    <div className="space-y-8 text-center animate-slide-up">
                       <Logo className="w-24 h-24 mx-auto text-blue-600 dark:text-blue-500 opacity-20" />
                       <h2 className="text-4xl font-black text-zinc-900 dark:text-white leading-tight">Welcome to the<br/><span className="text-blue-600 dark:text-blue-500">Neural Network</span></h2>
                       <p className="text-zinc-500 font-medium leading-relaxed">Establish a high-fidelity sync with Mr. Cute, your intelligent archetype. Real-time engagement, gamified.</p>
                    </div>
                  )}
                  {onboardingStep === 1 && (
                    <div className="space-y-10 animate-slide-up">
                       <div className="text-center space-y-2">
                          <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Neural Identity</h2>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 dark:text-blue-500">Identify Yourself</p>
                       </div>
                       <div className="space-y-4">
                         <div className="bg-white dark:bg-white/5 rounded-[35px] p-2 border border-black/5 dark:border-white/10 shadow-inner focus-within:border-blue-500/50 transition-all">
                            <input type="text" placeholder="What is your name?" autoFocus value={tempProfile.userName} onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} className="w-full bg-transparent py-5 px-8 font-black text-[20px] text-zinc-900 dark:text-white outline-none placeholder-zinc-300 dark:placeholder-zinc-800" />
                         </div>
                       </div>
                    </div>
                  )}
                  {/* API Key step removed as per guidelines - environment variable process.env.API_KEY is used exclusively */}
                  {onboardingStep === 2 && (
                    <div className="space-y-8 animate-slide-up">
                       <div className="text-center space-y-2">
                          <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter">Neural Archetype</h2>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 dark:text-amber-500">Define the Vibe</p>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          {Object.values(PERSONALITIES).map(p => (
                            <button key={p.id} onClick={() => setTempProfile({...tempProfile, personalityId: p.id})} className={`p-6 rounded-[35px] border transition-all flex flex-col items-center gap-3 relative overflow-hidden ${tempProfile.personalityId === p.id ? 'bg-blue-600 border-blue-400 text-white shadow-xl scale-[1.02]' : 'bg-white dark:bg-white/5 border-black/5 dark:border-white/5 text-zinc-700'}`}>
                              <span className="text-3xl">{p.emoji}</span>
                              <span className="text-[9px] font-black uppercase tracking-widest">{p.name.split(' ')[0]}</span>
                            </button>
                          ))}
                       </div>
                    </div>
                  )}
               </div>
               <div className="p-10 shrink-0 flex items-center gap-4">
                  {onboardingStep > 0 && <button onClick={() => setOnboardingStep(s => s - 1)} className="p-6 rounded-[35px] bg-black/5 dark:bg-white/5 text-zinc-400 border border-black/5 dark:border-white/5"><ArrowLeft size={24} /></button>}
                  {onboardingStep < 2 ? (
                    <button onClick={() => setOnboardingStep(s => s + 1)} disabled={onboardingStep === 1 && !tempProfile.userName} className={`flex-1 py-6 rounded-[35px] font-black text-lg uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${onboardingStep === 1 && !tempProfile.userName ? 'bg-zinc-200 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-800' : 'bg-blue-600 text-white'}`}>Next Step <ArrowRight size={20} /></button>
                  ) : (
                    <button onClick={handleOnboardingComplete} disabled={!tempProfile.userName} className={`flex-1 py-6 rounded-[35px] font-black text-lg uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${!tempProfile.userName ? 'bg-zinc-200 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-800' : 'bg-blue-600 text-white shadow-[0_10px_40px_rgba(37,99,235,0.4)]'}`}>Establish Link <Sparkles size={20} /></button>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
