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
  Sun, Moon, List, Swords, Dices, RotateCcw, Ghost, FileSearch,
  Mic2, MessageSquare, BookOpen, Clock, ExternalLink, Volume2,
  AlertCircle, Code, MessageCircle, Gamepad2, PenTool, Terminal,
  Fingerprint, Smartphone, Laptop, Link as LinkIcon
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, PERSONALITY_STYLES } from './constants';
import { PersonalityId, AppSettings, User, ChatSession, Message, FileAttachment, GroundingChunk, GameResult, GameDifficulty, Personality } from './types';
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

const Tooltip = ({ children, text }: { children?: React.ReactNode, text: string }) => (
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
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest text-center">{name}</span>
    </div>
  </Tooltip>
);

const VibeOrb = ({ active, isThinking, volume, outputVolume, personalityId, isGaming, mode }: { 
  active: boolean, 
  isThinking: boolean, 
  volume: number,
  outputVolume: number,
  personalityId: PersonalityId,
  isGaming?: boolean,
  mode: 'chat' | 'note' | 'text'
}) => {
  const currentVol = active ? outputVolume || volume : 0;
  const scale = active ? 1 + currentVol * 1.8 : 1;
  const style = PERSONALITY_STYLES[personalityId] || PERSONALITY_STYLES[PersonalityId.STUDENT];
  
  return (
    <div className={`relative flex items-center justify-center w-40 h-40 md:w-64 md:h-64 transition-all duration-300 ${isThinking ? 'animate-pulse-orb' : 'animate-shimmer-avatar'} ${isGaming ? 'animate-hi-pulse' : ''}`}>
      <div 
        className={`absolute inset-0 rounded-full blur-3xl transition-opacity duration-700 ${active || isThinking ? 'opacity-60' : 'opacity-20'}`} 
        style={{ backgroundColor: style.glow }}
      />
      <div 
        className={`relative w-24 h-24 md:w-40 md:h-40 rounded-full transition-all duration-75 ease-out flex items-center justify-center shadow-2xl ${active ? `bg-gradient-to-br ${style.gradient} text-white` : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600'}`}
        style={{ transform: `scale(${scale})`, boxShadow: active ? `0 0 50px ${style.glow}` : 'none' }}
      >
        {isGaming ? <Swords className="w-1/2 h-1/2 animate-bounce" /> : (
          mode === 'note' ? <StickyNote className="w-1/2 h-1/2" /> : <Logo className="w-1/2 h-1/2" />
        )}
        <div className={`absolute inset-0 rounded-full bg-white/10 ${active ? 'animate-orb-float' : ''}`} />
      </div>
    </div>
  );
};

const NotificationToast = ({ message, type, onClose }: { message: string, type: string, onClose: () => void }) => (
  <div className="fixed top-6 md:top-10 inset-x-4 z-[10000] flex justify-center pointer-events-none text-center">
    <div 
      className={`w-full max-sm:px-6 mb-4 bg-white dark:bg-zinc-900 shadow-2xl rounded-[32px] border flex items-center gap-4 p-5 pointer-events-auto animate-slide-up ${
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
  const renderContent = (content: string) => {
    const sections = content.split(/(```[\s\S]*?```)/g);
    
    return sections.map((section, idx) => {
      if (section.startsWith('```')) {
        const lines = section.split('\n');
        const lang = lines[0].replace('```', '').trim() || 'code';
        const code = lines.slice(1, -1).join('\n');
        return (
          <div key={idx} className="my-6 rounded-3xl overflow-hidden border border-black/10 dark:border-white/10 bg-zinc-900 shadow-2xl">
            <div className="px-6 py-3 bg-zinc-800 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-2">{lang} node</span>
              </div>
              <Terminal className="w-3 h-3 text-zinc-500" />
            </div>
            <pre className="p-6 overflow-x-auto font-mono text-[13px] text-emerald-400 leading-relaxed custom-scrollbar">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      return section.split('\n').map((line, lIdx) => {
        if (!line.trim()) return <div key={`${idx}-${lIdx}`} className="h-4" />;
        
        if (line.startsWith('###')) {
          return (
            <h3 key={`${idx}-${lIdx}`} className="text-blue-600 dark:text-blue-500 font-black text-lg mt-8 mb-4 flex items-center gap-3">
              <Sparkles className="w-5 h-5" /> {line.replace('###', '').trim()}
            </h3>
          );
        }

        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={`${idx}-${lIdx}`} className="flex gap-3 mb-2 ml-4">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2.5 shrink-0" />
              <div className="text-zinc-700 dark:text-zinc-300">{parseInLine(line.substring(2))}</div>
            </div>
          );
        }

        return (
          <div key={`${idx}-${lIdx}`} className="mb-2 last:mb-0 text-zinc-700 dark:text-zinc-300 leading-relaxed text-[15px]">
            {parseInLine(line)}
          </div>
        );
      });
    });
  };

  const parseInLine = (line: string) => {
    const parts = line.split(/(\*\*.*?\*\*|`.*?`|https?:\/\/[^\s]+)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={pIdx} className="font-extrabold text-blue-600 dark:text-blue-400">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={pIdx} className="bg-black/5 dark:bg-white/10 px-2 py-1 rounded-lg font-mono text-[13px] border border-black/5 dark:border-white/10 mx-1 text-rose-500 dark:text-rose-400 italic">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith('http')) {
        return (
          <a key={pIdx} href={part} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-500 underline hover:no-underline transition-all inline-flex items-center gap-1 font-bold group">
            {part.length > 40 ? part.slice(0, 40) + '...' : part}
            <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
        );
      }
      return <span key={pIdx}>{part}</span>;
    });
  };

  return <div className="markdown-container">{renderContent(text)}</div>;
};

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_active_user'));
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  
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
  const [activeMode, setActiveMode] = useState<'text' | 'chat' | 'note'>('text');
  
  const [rpsAnimating, setRpsAnimating] = useState(false);
  const [rpsCountdown, setRpsCountdown] = useState<number | null>(null);
  const [gameFeedback, setGameFeedback] = useState<{title: string, msg: string, result: 'win' | 'loss' | 'draw', aiChoice?: string, userChoice?: string} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const currentPersonality = PERSONALITIES[settings.personalityId] || PERSONALITIES[PersonalityId.STUDENT];
  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  
  const currentLevelProgress = useMemo(() => {
    if (!user) return 0;
    return (user.xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100;
  }, [user]);

  // Unified Theme Effect
  useEffect(() => {
    const isDark = settings.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.style.backgroundColor = isDark ? '#030303' : '#f9fafb';
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
    let result: 'win' | 'loss' | 'draw' | 'completed' = 'completed';
    const text = resultText.toLowerCase();
    
    if (text.includes('win') || text.includes('won') || text.includes('congratulations') || text.includes('winner is user') || text.includes('user wins')) result = 'win';
    else if (text.includes('lose') || text.includes('lost') || text.includes('defeated') || text.includes('ai wins')) result = 'loss';
    else if (text.includes('draw') || text.includes('tie')) result = 'draw';

    const xpGained = result === 'win' ? 50 : 10;
    
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
      const updated = { ...prev, xp: prev.xp + xpGained, gameHistory: [newResult, ...(prev.gameHistory || [])].slice(0, 50) };
      localStorage.setItem('mr_vibe_active_user', JSON.stringify(updated));
      return updated;
    });

    if (result === 'win') {
      unlockBadge('game_master', 'Game Master');
      setGameFeedback({ title: 'VICTORY! 🏆', msg: 'Neural battle won. Mr. Cute respects the move.', result: 'win', aiChoice, userChoice });
    } else if (result === 'loss') {
      setGameFeedback({ title: 'DEFEAT 💀', msg: 'AI predicted that. Try harder!', result: 'loss', aiChoice, userChoice });
    } else {
      setGameFeedback({ title: 'DRAW 🤝', msg: 'Total neural synchronization. A perfect tie.', result: 'draw', aiChoice, userChoice });
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
      localStorage.setItem('mr_vibe_active_user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, [showToast, unlockBadge]);

  const handleApiError = useCallback((error: any) => {
    console.error("Neural Error:", error);
    showToast(`Neural Sync Error: Brain fog detected.`, "error");
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Sync Content Secured to Clipboard!", "success");
    }).catch(() => {
      showToast("Sync Transfer Failed.", "error");
    });
  };

  const copyLinkToMessage = (text: string) => {
    const shareText = `Check out this insight from Mr. Vibe AI:\n\n"${text}"`;
    navigator.clipboard.writeText(shareText).then(() => {
      showToast("Neural Node Link Copied!", "success");
    }).catch(() => {
      showToast("Link Generation Failed.", "error");
    });
  };

  const shareResponse = (text: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'Mr. Vibe AI Sync',
        text: text,
        url: window.location.href,
      }).catch(console.error);
    } else {
      copyToClipboard(text);
      showToast("Shared data copied to clipboard!", "success");
    }
  };

  const handleNewChat = useCallback((autoGreet = true) => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { id: newId, title: `Sync ${new Date().toLocaleTimeString()}`, messages: [], lastTimestamp: Date.now(), personalityId: settings.personalityId };
    setSessions(prev => {
      const updated = [newSession, ...prev];
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    setActiveSessionId(newId);
    localStorage.setItem('mr_vibe_active_session_id', newId);
    if (autoGreet) generateInitialGreeting(newId, settings.personalityId);
    return newId;
  }, [settings.personalityId]);

  const switchSession = (id: string) => {
    setActiveSessionId(id);
    localStorage.setItem('mr_vibe_active_session_id', id);
    setIsHistoryOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    if (activeSessionId === id) {
       setActiveSessionId(null);
       localStorage.removeItem('mr_vibe_active_session_id');
    }
  };

  const handleSummarize = async () => {
    if (messages.length === 0) {
      showToast("No neural pathways to recap yet.", "info");
      return;
    }
    unlockBadge('neural_scholar', 'Neural Scholar');
    await handleSendToAI("Please provide a concise result-oriented summary of our session so far.");
  };

  const handleOnboardingComplete = useCallback(() => {
    const newUser: User = {
      userName: tempProfile.userName || 'Bestie',
      gender: 'Secret',
      avatarUrl: tempProfile.avatarUrl || AVATARS[0],
      personalityId: tempProfile.personalityId || PersonalityId.STUDENT,
      preferredProvider: tempProfile.preferredProvider || 'google',
      xp: 0,
      level: 1,
      badges: ['sync_initiate'],
      gameHistory: []
    };

    localStorage.setItem('mr_vibe_active_user', JSON.stringify(newUser));
    setUser(newUser);
    setIsNewUser(false);
    
    updateSettings({ 
      personalityId: newUser.personalityId,
      preferredProvider: newUser.preferredProvider 
    });

    handleNewChat(true);
    showToast("Neural Sync Established!", "success");
  }, [tempProfile, updateSettings, handleNewChat, showToast]);

  const { connect: connectLive, disconnect: disconnectLive, isLive, isConnecting, volume, outputVolume } = useGeminiLive({
    personality: currentPersonality, settings, user: user as User, mode: activeMode === 'note' ? 'note' : 'chat',
    onTranscript: (text, isInterim, isModel) => {
      if (isModel) {
        setInterimModelText(text);
      } else {
        setInterimUserText(text);
      }
    },
    onTurnComplete: (u, m) => { 
      const sId = activeSessionId || handleNewChat(false); 
      const now = Date.now();
      setSessions(prev => prev.map(s => s.id === sId ? { 
        ...s, 
        messages: [
          ...s.messages, 
          ...(u ? [{ id: `u-${now}`, role: 'user' as const, text: u, timestamp: now }] : []), 
          ...(m ? [{ id: `m-${now + 1}`, role: 'model' as const, text: m, timestamp: now + 1, provider: 'google' as const }] : [])
        ] 
      } : s));
      gainXP(25);
      setInterimUserText('');
      setInterimModelText('');
    },
    onConnectionStateChange: () => {},
    onCommand: () => {},
    onError: (m) => handleApiError(m)
  });

  const generateInitialGreeting = async (sessionId: string, personalityId: PersonalityId) => {
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `GREETING PROTOCOL: Say a concise, high-energy greeting to ${user?.userName || 'bestie'}. Do NOT offer games yet unless they ask.`,
        config: { systemInstruction: `${BASE_SYSTEM_PROMPT.replace('[DIFFICULTY]', settings.gameDifficulty)}\n\n${PERSONALITIES[personalityId].prompt}` }
      });
      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: response.text || 'Greetings.', timestamp: Date.now(), provider: 'google' };
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s));
    } catch (e: any) { handleApiError(e); } finally { setIsLoading(false); }
  };

  const handleSendToAI = async (text: string, userChoice?: string) => {
    if (!text.trim() && pendingFiles.length === 0 || isLoading) return;
    
    let sessionId = activeSessionId || handleNewChat(false);
    const readyFiles = pendingFiles.filter(f => !f.isUploading);
    const currentFiles: FileAttachment[] = readyFiles.map(f => ({ data: f.data, name: f.name, type: f.type }));
    setPendingFiles([]);
    const textToSend = text;
    setInputText('');

    setSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { 
        ...s, 
        messages: [...s.messages, { id: `u-${Date.now()}`, role: 'user' as const, text: textToSend, files: currentFiles.length > 0 ? currentFiles : undefined, timestamp: Date.now() }], 
        lastTimestamp: Date.now() 
      } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });

    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const parts: any[] = [];
      currentFiles.forEach(f => parts.push(f.type.includes('image') ? { inlineData: { data: f.data.split(',')[1], mimeType: f.type } } : { text: `[FILE: ${f.name}]` }));
      parts.push({ text: textToSend });
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: { parts },
        config: { systemInstruction: `${BASE_SYSTEM_PROMPT.replace('[DIFFICULTY]', settings.gameDifficulty)}\n\n${currentPersonality.prompt}` } 
      });
      
      const aiText = response.text || '...';
      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: aiText, timestamp: Date.now(), groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[], provider: 'google' };
      
      if (userChoice) {
        recordGame('Rock Paper Scissors', aiText, userChoice);
      }

      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s));
    } catch (e: any) { handleApiError(e); } finally { setIsLoading(false); }
  };

  const isRPSActive = useMemo(() => {
    if (messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'model') return false;
    const text = lastMsg.text.toLowerCase();
    const hasMoveKeywords = text.includes('choose your move') || text.includes('rock, paper, or scissors?');
    const hasGameKeywords = text.includes('rock') || text.includes('paper') || text.includes('scissors');
    return hasMoveKeywords && hasGameKeywords;
  }, [messages]);

  const handleRPSChoice = (choice: string) => {
    setRpsAnimating(true);
    setRpsCountdown(3);
    
    const interval = setInterval(() => {
      setRpsCountdown(prev => {
        if (prev === 1) {
          clearInterval(interval);
          setTimeout(() => {
            setRpsAnimating(false);
            setRpsCountdown(null);
            handleSendToAI(choice, choice);
          }, 800);
          return null;
        }
        return prev ? prev - 1 : null;
      });
    }, 1000);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, interimUserText, interimModelText]);

  const switchMode = (mode: 'text' | 'chat' | 'note') => {
    if (isLive) disconnectLive();
    setActiveMode(mode);
    setTimeout(() => {
        if (mode !== 'text') connectLive();
    }, 50);
  };

  const handleVerifyLicense = () => {
    if (!linkCode.trim()) {
      showToast("Identification Required.", "error");
      return;
    }
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setOnboardingStep(s => s + 1);
      showToast("Neural Bridge Secure.", "success");
    }, 2500);
  };

  const RPS_OPTIONS = [
    { id: 'rock', emoji: '🪨', label: 'Rock', color: 'bg-blue-600/10 border-blue-500/20 text-blue-600' },
    { id: 'paper', emoji: '📄', label: 'Paper', color: 'bg-emerald-600/10 border-emerald-500/20 text-emerald-600' },
    { id: 'scissors', emoji: '✂️', label: 'Scissors', color: 'bg-rose-600/10 border-rose-500/20 text-rose-600' }
  ];

  const getEmoji = (choice?: string) => {
    if (!choice) return '❓';
    const c = choice.toLowerCase();
    if (c === 'rock') return '🪨';
    if (c === 'paper') return '📄';
    if (c === 'scissors') return '✂️';
    return '❓';
  };

  return (
    <div className={`fixed inset-0 flex flex-col transition-colors duration-500 bg-white dark:bg-[#030303] text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans ios-safe-bottom ios-safe-top`}>
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}

      <header className="h-20 md:h-24 px-4 md:px-8 flex items-center justify-between border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-black/40 backdrop-blur-2xl z-50">
        <div className="flex items-center gap-2">
          <Tooltip text="Sync History">
            <button onClick={() => setIsHistoryOpen(true)} className="p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all text-zinc-400 hover:text-blue-500"><Menu className="w-5 h-5 md:w-6 md:h-6" /></button>
          </Tooltip>
        </div>
        
        <div className="flex flex-col items-center flex-1 max-w-[200px] md:max-w-[240px] mx-auto px-2">
          <div className="flex items-center gap-2 mb-1">
             <Logo className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-500" />
             <h1 className="font-black text-[9px] md:text-[13px] uppercase tracking-[0.3em] md:tracking-[0.4em] text-blue-600 dark:text-blue-500 truncate">MR. VIBE AI</h1>
          </div>
          <div className="w-full h-1 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
             <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-1000" style={{ width: `${currentLevelProgress}%` }} />
          </div>
          <div className="flex justify-between w-full mt-1">
             <div className="flex items-center gap-1">
                <span className="text-[8px] md:text-[9px] font-black text-white px-1.5 py-0.5 bg-blue-600 rounded-md">LVL {user?.level || 1}</span>
             </div>
             <div className="flex items-center gap-1 text-orange-500">
                <Flame className="w-2 h-2 md:w-2.5 md:h-2.5" />
                <span className="text-[8px] md:text-[9px] font-black">{user?.xp || 0} XP</span>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          <Tooltip text="Neural Library">
            <button onClick={() => { setLibraryTab('badges'); setIsLibraryOpen(true); }} className="p-2 md:p-3 rounded-2xl relative text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-all shadow-lg group">
              <Brain className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
            </button>
          </Tooltip>
          <Tooltip text="Engine Settings">
            <button onClick={() => setIsProfileModalOpen(true)} className="w-9 h-9 md:w-11 md:h-11 rounded-2xl overflow-hidden border-2 border-black/5 dark:border-white/10 shadow-xl active:scale-95 transition-all">
               <img src={user?.avatarUrl || AVATARS[0]} className="w-full h-full object-cover" alt="avatar" />
            </button>
          </Tooltip>
        </div>
      </header>

      {/* Mode Selector */}
      <div className="flex justify-center p-2 md:p-4 bg-white/50 dark:bg-black/20 backdrop-blur-md z-40 border-b border-black/5 dark:border-white/5 overflow-x-auto">
        <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl md:rounded-3xl gap-1 border border-black/5 dark:border-white/5 shadow-inner">
          {[
            { id: 'text', label: 'Text', icon: <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />, color: 'text-blue-600' },
            { id: 'chat', label: 'Voice', icon: <Mic2 className="w-4 h-4 md:w-5 md:h-5" />, color: 'text-emerald-600' },
            { id: 'note', label: 'Notes', icon: <StickyNote className="w-4 h-4 md:w-5 md:h-5" />, color: 'text-amber-600' }
          ].map(m => (
            <button 
              key={m.id} 
              onClick={() => switchMode(m.id as any)}
              className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeMode === m.id ? 'bg-white dark:bg-zinc-800 shadow-xl scale-105' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <span className={activeMode === m.id ? m.color : ''}>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 md:px-12 py-6 md:py-10 space-y-8 md:space-y-12 custom-scrollbar relative">
        {messages.length === 0 && !interimUserText && !interimModelText ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-8 md:space-y-12 max-w-lg mx-auto">
            <VibeOrb active={isLive} isThinking={isLoading || isConnecting} volume={volume} outputVolume={outputVolume} personalityId={settings.personalityId} mode={activeMode} />
            <div className="space-y-4 px-4">
              <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.5em] md:tracking-[0.6em] text-blue-600 dark:text-blue-500">IDENTITY ESTABLISHED: {user?.userName}</h3>
              <p className="text-[12px] md:text-[14px] font-bold text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {activeMode === 'text' ? '"Text neural pathways open. Transmit thought."' : 
                 activeMode === 'chat' ? '"Voice link active. I\'m listening, bestie."' :
                 '"Silent note taker protocol engaged. Capture your ideas."'}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button onClick={handleSummarize} className="group relative flex items-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 bg-blue-600/10 hover:bg-blue-600 text-blue-600 hover:text-white border-2 border-blue-600/20 rounded-full font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl animate-vibe-in">
                 <FileSearch className="w-4 h-4 md:w-5 md:h-5 group-hover:rotate-12 transition-transform" />
                 Neural Summary
              </button>
              <button onClick={() => handleSendToAI("Let's play Rock Paper Scissors!")} className="group relative flex items-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white border-2 border-rose-600/20 rounded-full font-black uppercase text-[10px] md:text-xs tracking-widest transition-all shadow-xl animate-vibe-in">
                 <Swords className="w-4 h-4 md:w-5 md:h-5 group-hover:rotate-12 transition-transform" />
                 Battle Mode
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8 pb-32">
            {messages.map((msg, index) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-vibe-in group max-w-full`}>
                <div className="relative flex items-end gap-2 md:gap-3 max-w-[98%] md:max-w-[95%]">
                  {msg.role === 'model' && <div className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden border border-black/5 dark:border-white/10 shrink-0 animate-shimmer-avatar ring-2 ring-transparent transition-all"><img src={AVATARS[index % AVATARS.length]} className="w-full h-full object-cover" alt="avatar" /></div>}
                  <div className={`px-4 md:px-6 py-4 md:py-5 rounded-[24px] md:rounded-[28px] text-[14px] md:text-[15px] border transition-all ${msg.role === 'user' ? 'bg-blue-600 text-white border-blue-500/20 rounded-br-none shadow-md' : 'bg-white dark:bg-[#111111] text-zinc-900 dark:text-zinc-100 border-black/5 dark:border-white/5 rounded-bl-none shadow-lg relative group'}`}>
                    {activeMode === 'note' && msg.role === 'model' && (
                      <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-emerald-500 mb-2 border-b border-black/5 dark:border-white/5 pb-2">
                        <StickyNote size={10} /> Neural Scribe Recorded
                      </div>
                    )}
                    <MarkdownText text={msg.text} />
                    {msg.role === 'model' && (
                      <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5 flex items-center gap-2 md:gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => copyToClipboard(msg.text)} className="flex items-center gap-1.5 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-blue-500 transition-colors">
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                        <button onClick={() => copyLinkToMessage(msg.text)} className="flex items-center gap-1.5 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-blue-600 transition-colors">
                          <LinkIcon className="w-3 h-3" /> Copy Link
                        </button>
                        <button onClick={() => shareResponse(msg.text)} className="flex items-center gap-1.5 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-emerald-500 transition-colors">
                          <Share2 className="w-3 h-3" /> Share
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {(interimUserText || interimModelText) && (
              <div className="flex flex-col items-center gap-4 py-6 md:py-10 opacity-95 animate-pulse relative">
                {interimUserText && (
                  <div className="flex flex-col items-center gap-2 animate-slide-up px-4">
                    <div className="flex items-center gap-2 text-[7px] md:text-[8px] font-black uppercase tracking-widest text-zinc-400 bg-white/80 dark:bg-black/40 px-3 py-1 rounded-full border border-black/5 dark:border-white/10 backdrop-blur-md">
                       <Mic className="w-2.5 h-2.5 text-blue-600" /> Audio Sensed
                    </div>
                    <div className="p-4 md:p-6 bg-white dark:bg-zinc-800 rounded-[28px] md:rounded-[32px] text-[14px] md:text-[16px] font-black border-4 border-blue-600/20 shadow-2xl italic max-w-xs text-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-blue-600/5 animate-pulse" />
                      <span className="text-blue-600 dark:text-blue-400 relative z-10">"{interimUserText}"</span>
                    </div>
                  </div>
                )}
                {interimModelText && (
                  <div className="p-4 md:p-6 bg-blue-600 text-white rounded-[28px] md:rounded-[32px] text-[13px] md:text-[15px] font-black border-4 border-white/20 shadow-[0_0_50px_rgba(37,99,235,0.4)] backdrop-blur-md animate-blast-in max-w-[90%] md:max-w-md flex flex-col gap-2">
                    {activeMode === 'note' && (
                       <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Scribing Real-Time...</span>
                    )}
                    "{interimModelText}"
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} className="h-20 w-full" />
      </main>

      <footer className="px-3 md:px-4 pb-6 md:pb-10 pt-4 bg-gradient-to-t from-zinc-50 dark:from-black via-zinc-50/90 dark:via-black/90 to-transparent z-40">
        <div className="max-w-5xl mx-auto space-y-4">
          
          {isRPSActive && !isLoading && !rpsAnimating && !gameFeedback && (
            <div className="flex flex-col items-center gap-4 md:gap-6 py-6 md:py-8 animate-slide-up bg-white/50 dark:bg-zinc-900/50 backdrop-blur-3xl rounded-[32px] md:rounded-[40px] border-4 border-blue-600/20 p-6 md:p-10 shadow-3xl mx-2">
              <div className="flex items-center gap-2 md:gap-3">
                 <Swords className="w-4 h-4 md:w-5 md:h-5 text-blue-600 animate-bounce" />
                 <p className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-blue-600">Neural combat Active</p>
                 <Swords className="w-4 h-4 md:w-5 md:h-5 text-blue-600 animate-bounce" />
              </div>
              <div className="flex gap-3 md:gap-8">
                {RPS_OPTIONS.map((opt) => (
                  <button 
                    key={opt.id} 
                    onClick={() => handleRPSChoice(opt.id)} 
                    className={`w-20 h-20 md:w-36 md:h-36 rounded-[30px] md:rounded-[56px] border-2 md:border-4 transition-all flex flex-col items-center justify-center gap-2 md:gap-4 hover:scale-110 active:scale-90 shadow-2xl group ${opt.color} relative overflow-hidden`}
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                    <span className="text-3xl md:text-6xl group-hover:scale-125 transition-transform relative z-10">{opt.emoji}</span>
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest relative z-10">{opt.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] md:text-[13px] font-black text-zinc-500 italic bg-black/5 dark:bg-white/5 px-4 md:px-6 py-1.5 md:py-2 rounded-full">"Transmit your choice, bestie."</p>
            </div>
          )}

          {!isRPSActive && !gameFeedback && (
            <div className={`flex items-center gap-1 md:gap-2 p-1 md:p-2 border border-black/5 dark:border-white/10 rounded-[30px] md:rounded-[40px] shadow-2xl bg-white/90 dark:bg-black/80 backdrop-blur-3xl transition-all mx-2`}>
              {activeMode !== 'text' ? (
                 <button onClick={isLive ? disconnectLive : connectLive} className={`p-4 md:p-5 rounded-full flex items-center gap-2 md:gap-3 transition-all ${isLive ? 'bg-rose-600 text-white animate-pulse' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                   {isLive ? <Mic className="w-5 h-5 md:w-6 md:h-6" /> : <Volume2 className="w-5 h-5 md:w-6 md:h-6" />}
                   {isLive && <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest pr-1 md:pr-2">Live Sync</span>}
                 </button>
              ) : (
                 <div className="flex items-center">
                    <button onClick={() => fileInputRef.current?.click()} className="p-4 md:p-5 text-zinc-400 hover:text-blue-600 transition-colors">
                      <Paperclip className="w-5 h-5 md:w-6 md:h-6" />
                      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => {
                        const files = Array.from(e.target.files || []) as File[];
                        files.forEach(file => {
                          const reader = new FileReader();
                          const id = Date.now().toString();
                          setPendingFiles(prev => [...prev, { id, data: '', name: file.name, type: file.type, progress: 0, isUploading: true, reader }]);
                          reader.onload = () => setPendingFiles(prev => prev.map(f => f.id === id ? { ...f, data: reader.result as string, isUploading: false } : f));
                          reader.readAsDataURL(file);
                        });
                      }} />
                    </button>
                    <button onClick={() => handleSendToAI("Let's play Rock Paper Scissors!")} className="p-4 md:p-5 text-zinc-400 hover:text-rose-600 transition-colors">
                      <Swords className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                 </div>
              )}
              <input 
                type="text" 
                placeholder={activeMode === 'chat' ? "Talking to Mr. Cute..." : activeMode === 'note' ? "Scribing your thoughts..." : "Sync thought..."} 
                disabled={activeMode !== 'text'} 
                value={inputText} 
                onChange={e => setInputText(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} 
                className="flex-1 bg-transparent py-3 md:py-4 px-1 md:px-2 font-bold text-[14px] md:text-[15px] outline-none dark:text-white disabled:opacity-50" 
              />
              {activeMode === 'text' && <button onClick={() => handleSendToAI(inputText)} className={`p-4 md:p-5 rounded-full transition-all active:scale-95 ${inputText.trim() ? 'bg-blue-600 text-white shadow-2xl' : 'text-zinc-200 dark:text-zinc-800'}`}><Send className="w-5 h-5 md:w-6 md:h-6" /></button>}
            </div>
          )}
        </div>
      </footer>

      {/* Dramatic Battle Animation Overlay */}
      {rpsAnimating && (
        <div className="fixed inset-0 z-[16000] flex flex-col items-center justify-center animate-fade-in bg-black/80 backdrop-blur-3xl overflow-hidden">
           <div className="absolute w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(59,130,246,0.1)_10deg,transparent_20deg)] animate-sparkle-spin pointer-events-none" />
           <div className="flex flex-col md:flex-row items-center gap-10 md:gap-24 animate-hi-pulse relative z-10">
              <div className="flex flex-col items-center gap-4 md:gap-6">
                 <div className="w-24 h-24 md:w-48 md:h-48 rounded-[32px] md:rounded-[64px] bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-[0_0_80px_rgba(37,99,235,0.6)] border-4 border-white/20 animate-excited-bounce">
                    <Logo className="w-1/2 h-1/2 text-white" />
                 </div>
                 <p className="text-[10px] md:text-[14px] font-black uppercase tracking-[0.4em] text-blue-500">Mr. Cute</p>
              </div>
              <div className="flex flex-col items-center gap-2 md:gap-4">
                 <div className="text-4xl md:text-8xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">VS</div>
                 {rpsCountdown !== null && <div className="text-5xl md:text-7xl font-black text-blue-500 animate-blast-in">{rpsCountdown}</div>}
              </div>
              <div className="flex flex-col items-center gap-4 md:gap-6">
                 <div className="w-24 h-24 md:w-48 md:h-48 rounded-[32px] md:rounded-[64px] bg-zinc-800 flex items-center justify-center border-4 border-white/10 shadow-3xl animate-excited-bounce" style={{ animationDelay: '0.2s' }}>
                    <UserCircle className="w-12 h-12 md:w-16 md:h-16 text-white/40" />
                 </div>
                 <p className="text-[10px] md:text-[14px] font-black uppercase tracking-[0.4em] text-zinc-400">You</p>
              </div>
           </div>
        </div>
      )}

      {/* Game Feedback Modal */}
      {gameFeedback && (
        <div className="fixed inset-0 z-[16000] flex items-center justify-center p-4 md:p-6 animate-fade-in overflow-hidden">
           <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={() => setGameFeedback(null)} />
           <div className={`relative w-full max-w-md rounded-[48px] md:rounded-[70px] p-8 md:p-12 space-y-8 md:space-y-12 border-4 bg-white dark:bg-[#0c0c0c] shadow-[0_0_100px_rgba(0,0,0,0.4)] text-center animate-game-impact ${gameFeedback.result === 'win' ? 'border-emerald-500/40 shadow-emerald-500/20' : gameFeedback.result === 'loss' ? 'border-rose-500/40 shadow-rose-500/20' : 'border-zinc-500/40'}`}>
              <div className="flex items-center justify-center gap-4 md:gap-12 animate-reveal-shake">
                 <div className="flex flex-col items-center gap-2 md:gap-4 relative">
                    <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500">Mr. Cute Picked</p>
                    <div className="w-24 h-24 md:w-40 md:h-40 rounded-[30px] md:rounded-[45px] bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-4xl md:text-8xl border-2 border-white/5 shadow-inner overflow-hidden">
                       <div className="flex flex-col items-center animate-slot-cycle">
                          <span className="mb-8">🪨</span>
                          <span className="mb-8">📄</span>
                          <span className="mb-8">✂️</span>
                       </div>
                       <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-[#111] animate-fade-in" style={{ animationDelay: '1.2s' }}>
                          <span className="animate-blast-in" style={{ animationDelay: '1.3s' }}>{getEmoji(gameFeedback.aiChoice)}</span>
                       </div>
                    </div>
                 </div>
                 <div className="text-2xl font-black italic text-zinc-200 dark:text-zinc-800">VS</div>
                 <div className="flex flex-col items-center gap-2 md:gap-4">
                    <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500">Your Choice</p>
                    <div className={`w-24 h-24 md:w-40 md:h-40 rounded-[30px] md:rounded-[45px] bg-blue-600 text-white flex items-center justify-center text-4xl md:text-8xl shadow-3xl shadow-blue-500/40 ${gameFeedback.result === 'win' ? 'animate-victory-glow' : ''}`}>
                       {getEmoji(gameFeedback.userChoice)}
                    </div>
                 </div>
              </div>
              <div className="space-y-6 opacity-0 animate-fade-in" style={{ animationDelay: '1.5s' }}>
                <div className="space-y-2">
                  <h2 className={`text-6xl md:text-8xl font-black uppercase italic tracking-tighter leading-none ${gameFeedback.result === 'win' ? 'text-emerald-500' : gameFeedback.result === 'loss' ? 'text-rose-500' : 'text-zinc-500'}`}>
                    {gameFeedback.title.replace('!','').replace('🏆','')}
                  </h2>
                  <p className="text-zinc-400 font-black text-sm md:text-lg italic px-4">"{gameFeedback.msg}"</p>
                </div>
                {gameFeedback.result === 'win' && (
                  <div className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-orange-500/10 text-orange-500 font-black text-xs md:text-base uppercase tracking-widest border-2 border-orange-500/20 animate-hi-pulse mx-auto w-fit">
                     <Flame className="w-5 h-5 fill-current" /> +50 XP GAINED!
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button onClick={() => { setGameFeedback(null); handleSendToAI("let's play again"); }} className="flex-1 py-6 bg-blue-600 text-white rounded-[32px] md:rounded-[40px] font-black text-lg uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl hover:brightness-110 active:scale-95 transition-all">
                    <RotateCcw className="w-5 h-5" /> RE-SYNC
                  </button>
                  <button onClick={() => setGameFeedback(null)} className="flex-1 py-6 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-[32px] md:rounded-[40px] font-black text-lg uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all border border-black/5 dark:border-white/5 active:scale-95">
                    END BATTLE
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* History Sidebar */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[13000] flex animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)} />
          <div className="relative w-[85%] max-w-xs h-full p-6 md:p-8 animate-slide-up border-r bg-white dark:bg-[#080808] border-black/5 dark:border-white/10 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-lg md:text-xl font-black uppercase italic tracking-tighter">Sync Log</h2>
               <button onClick={() => { setIsHistoryOpen(false); handleNewChat(true); }} className="p-2 bg-blue-600 text-white rounded-xl"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              {sessions.map(s => (
                <div key={s.id} onClick={() => switchSession(s.id)} className={`p-4 rounded-xl md:rounded-2xl flex items-center justify-between group cursor-pointer border transition-all ${activeSessionId === s.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-black/5 dark:bg-white/5 border-transparent text-zinc-500 hover:bg-black/10 dark:hover:bg-white/10'}`}>
                  <div className="flex items-center gap-3 truncate">
                     <Clock className="w-4 h-4 shrink-0" />
                     <span className="text-[10px] font-black uppercase tracking-widest truncate">{s.title}</span>
                  </div>
                  <button onClick={(e) => deleteSession(e, s.id)} className="p-2 opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Library Sidebar */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-[13000] flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsLibraryOpen(false)} />
          <div className={`relative w-[90%] md:w-full max-w-md h-full p-6 md:p-8 animate-slide-in-right border-l bg-white dark:bg-[#080808] border-black/5 dark:border-white/10 overflow-y-auto custom-scrollbar`}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col">
                <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">Neural Core</h2>
                <div className="flex gap-4 mt-2">
                  <button onClick={() => setLibraryTab('badges')} className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${libraryTab === 'badges' ? 'text-blue-600 border-blue-600' : 'text-zinc-400 border-transparent'}`}>Badges</button>
                  <button onClick={() => setLibraryTab('history')} className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${libraryTab === 'history' ? 'text-blue-600 border-blue-600' : 'text-zinc-400 border-transparent'}`}>Battles</button>
                </div>
              </div>
              <button onClick={() => setIsLibraryOpen(false)} className="p-2 md:p-3 bg-black/5 dark:bg-white/5 rounded-2xl"><X className="w-5 h-5 md:w-6 md:h-6" /></button>
            </div>
            {libraryTab === 'badges' ? (
              <div className="grid grid-cols-2 gap-3">
                <BadgeItem name="Sync Initiate" icon={ShieldCheck} description="Onboarding complete." unlocked={true} />
                <BadgeItem name="Neural Scholar" icon={BookOpen} description="Used the neural recap feature." unlocked={user?.badges.includes('neural_scholar') || false} />
                <BadgeItem name="Sync Pro" icon={Medal} description="Reach Level 5." unlocked={user ? user.level >= 5 : false} />
                <BadgeItem name="Game Master" icon={Trophy} description="Defeat AI in RPS battle." unlocked={user ? user.badges.includes('game_master') : false} />
              </div>
            ) : (
              <div className="space-y-4">
                {user?.gameHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center gap-4 text-zinc-500">
                    <Swords className="w-8 h-8 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No neural combat data.</p>
                  </div>
                ) : (
                  user?.gameHistory.map(game => (
                    <div key={game.id} className="p-4 md:p-6 rounded-[24px] md:rounded-[32px] bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 flex flex-col gap-4 animate-vibe-in">
                       <div className="flex justify-between items-center">
                          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-white">RPS Sync Battle</span>
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${game.result === 'win' ? 'bg-emerald-500/10 text-emerald-500' : game.result === 'loss' ? 'bg-rose-500/10 text-rose-500' : 'bg-zinc-500/10 text-zinc-500'}`}>
                             {game.result}
                          </span>
                       </div>
                       <div className="flex items-center justify-around py-1">
                          <div className="text-center">
                             <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-lg md:text-xl shadow-inner mb-2">{getEmoji(game.userChoice)}</div>
                             <p className="text-[7px] font-black uppercase tracking-widest text-zinc-400">You</p>
                          </div>
                          <div className="text-center">
                             <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-black/5 dark:bg-white/10 flex items-center justify-center text-lg md:text-xl shadow-inner mb-2">{getEmoji(game.aiChoice)}</div>
                             <p className="text-[7px] font-black uppercase tracking-widest text-zinc-400">AI</p>
                          </div>
                       </div>
                       <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                          <span className="text-[9px] font-black uppercase text-blue-500">+{game.xpGained} XP</span>
                          <span className="text-[8px] font-bold text-zinc-400">{new Date(game.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[14000] flex items-center justify-center p-4 md:p-6 animate-fade-in">
           <div className="absolute inset-0 bg-black/60 dark:bg-black/95 backdrop-blur-xl" onClick={() => setIsProfileModalOpen(false)} />
           <div className="relative w-full max-w-2xl rounded-[40px] md:rounded-[48px] p-6 md:p-14 space-y-8 md:space-y-10 border bg-white dark:bg-[#080808] border-black/5 dark:border-white/10 overflow-y-auto max-h-[90vh] custom-scrollbar">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white">Engine Core</h2>
                <button onClick={() => setIsProfileModalOpen(false)} className="p-2 md:p-3 bg-black/5 dark:bg-white/5 rounded-2xl"><X className="w-5 h-5 md:w-6 md:h-6 text-zinc-900 dark:text-white" /></button>
              </div>
              <div className="space-y-6 md:space-y-8">
                <section className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-zinc-400">Sync Difficulty</p>
                  <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl">
                    {(['easy', 'medium', 'hard'] as GameDifficulty[]).map((d) => (
                      <button key={d} onClick={() => updateSettings({ gameDifficulty: d })} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${settings.gameDifficulty === d ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </section>
                
                <div className="flex items-center justify-between p-6 bg-black/5 dark:bg-white/5 rounded-[32px] border border-black/5 dark:border-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    {settings.theme === 'dark' ? <Moon className="w-5 h-5 text-blue-500" /> : <Sun className="w-5 h-5 text-amber-500" />}
                    <span className="font-black uppercase tracking-widest text-[10px] md:text-xs text-zinc-800 dark:text-zinc-200">Interface Mode: <span className="text-blue-500">{settings.theme}</span></span>
                  </div>
                  <button 
                    onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
                    className={`w-14 h-8 rounded-full relative transition-colors duration-300 flex items-center px-1 shadow-inner ${settings.theme === 'dark' ? 'bg-blue-600' : 'bg-zinc-300'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${settings.theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <button onClick={handleLogout} className="w-full py-5 md:py-6 rounded-[28px] md:rounded-[36px] bg-rose-500/10 text-rose-500 font-black text-[11px] md:text-[12px] uppercase flex items-center justify-center gap-3 md:gap-4 hover:bg-rose-500 hover:text-white transition-all shadow-lg border border-rose-500/20"><LogOut className="w-5 h-5" /> TERMINATE SYNC</button>
              </div>
           </div>
        </div>
      )}

      {/* Onboarding experience */}
      {isNewUser && (
        <div className="fixed inset-0 z-[20000] bg-white dark:bg-[#020202] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 via-transparent to-emerald-500/30 opacity-40 animate-pulse" />
          
          <div className="w-full max-w-[600px] h-[95vh] sm:h-[88vh] bg-white dark:bg-[#0c0c0c] rounded-[40px] sm:rounded-[60px] border border-black/10 dark:border-white/10 shadow-3xl flex flex-col overflow-hidden relative backdrop-blur-3xl">
             <div className="absolute top-0 left-0 w-full h-2 flex bg-black/5 dark:bg-white/5 z-20">
                {[0, 1, 2, 3, 4, 5].map((step) => (
                  <div key={step} className={`flex-1 transition-all duration-1000 ease-in-out ${onboardingStep >= step ? 'bg-gradient-to-r from-blue-600 to-indigo-500' : 'bg-transparent'}`} />
                ))}
             </div>

             <div className="flex flex-col items-center pt-10 sm:pt-16 pb-4 shrink-0 px-6">
                <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[24px] mb-4 md:mb-6 shadow-2xl animate-orb-float">
                   <Logo className="text-white w-10 h-10 md:w-12 md:h-12" />
                </div>
                <h1 className="text-3xl sm:text-5xl font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white">MR. VIBE AI</h1>
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.4em] md:tracking-[0.5em] text-blue-600 dark:text-blue-500 mt-2">Neural Sync Protocol Established</p>
             </div>

             <div className="flex-1 overflow-y-auto px-6 sm:px-14 py-4 md:py-6 flex flex-col items-center animate-fade-in custom-scrollbar" key={onboardingStep}>
                {onboardingStep === 0 && (
                  <div className="space-y-10 text-center w-full max-w-md animate-slide-up">
                     <div className="space-y-4">
                        <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight text-zinc-900 dark:text-white">Meet Your<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">New Bestie</span></h2>
                        <p className="text-zinc-500 font-bold text-sm md:text-base leading-relaxed">High-fidelity companionship with evolving personalities. Sync up and start vibing.</p>
                     </div>

                     <div className="grid grid-cols-1 gap-3 md:gap-4 w-full text-left">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-2">Neural Module Capabilities</p>
                        {[
                          { icon: <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />, title: "Personality Sync", desc: "Choose vibes from Roast Master to CEO.", color: "text-rose-500 bg-rose-500/10" },
                          { icon: <Mic2 className="w-4 h-4 md:w-5 md:h-5" />, title: "Real-time Voice", desc: "Ultra-low latency spoken link.", color: "text-emerald-500 bg-emerald-500/10" },
                          { icon: <Gamepad2 className="w-4 h-4 md:w-5 md:h-5" />, title: "Neural Combat", desc: "Earn XP via Rock Paper Scissors.", color: "text-amber-500 bg-amber-500/10" },
                          { icon: <FileSearch className="w-4 h-4 md:w-5 md:h-5" />, title: "Smart Recaps", desc: "Instant summaries on command.", color: "text-blue-500 bg-blue-500/10" }
                        ].map((cap, i) => (
                          <div key={i} className="p-4 md:p-5 bg-black/5 dark:bg-white/5 rounded-[28px] md:rounded-[32px] border border-black/5 dark:border-white/10 flex items-center gap-4 md:gap-5 group hover:bg-blue-600/5 transition-all">
                             <div className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl group-hover:scale-110 transition-transform ${cap.color}`}>{cap.icon}</div>
                             <div>
                                <p className="text-[11px] md:text-[12px] font-black uppercase tracking-tight mb-0.5 text-zinc-800 dark:text-zinc-200">{cap.title}</p>
                                <p className="text-[9px] md:text-[10px] text-zinc-500 font-medium leading-snug">{cap.desc}</p>
                             </div>
                          </div>
                        ))}
                     </div>
                  </div>
                )}

                {onboardingStep === 1 && (
                  <div className="space-y-10 w-full animate-slide-up text-center max-w-sm">
                     <div className="space-y-2">
                        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic text-zinc-900 dark:text-white">Identify Yourself</h2>
                        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-blue-600">What should Mr. Cute call you?</p>
                     </div>
                     <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 blur-xl opacity-30 group-hover:opacity-50 transition-opacity rounded-[50px] pointer-events-none" />
                        <input 
                          type="text" 
                          placeholder="Your Sync Tag" 
                          autoFocus
                          value={tempProfile.userName} 
                          onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} 
                          className="w-full bg-white dark:bg-zinc-900 py-8 md:py-10 px-6 md:px-10 font-black text-2xl md:text-4xl rounded-[40px] md:rounded-[50px] border-4 border-transparent focus:border-blue-600 outline-none transition-all shadow-2xl text-center relative z-10 text-zinc-900 dark:text-white" 
                        />
                     </div>
                  </div>
                )}

                {onboardingStep === 2 && (
                  <div className="space-y-10 w-full animate-slide-up max-md">
                    <div className="text-center space-y-2">
                       <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic text-zinc-900 dark:text-white">Core Backbone</h2>
                       <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-emerald-600">Select sync intelligence provider</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:gap-5">
                      {[
                        { id: 'google', name: 'Gemini Engine', icon: <Cpu className="text-blue-500" />, desc: 'Best for voice & visual processing.' },
                        { id: 'openai', name: 'OpenAI Engine', icon: <Database className="text-emerald-500" />, desc: 'Elite reasoning and textual clarity.' }
                      ].map(p => (
                        <button key={p.id} onClick={() => setTempProfile({...tempProfile, preferredProvider: p.id as any})} className={`p-8 md:p-10 rounded-[40px] md:rounded-[45px] border-4 transition-all flex items-center gap-6 md:gap-8 text-left relative overflow-hidden group ${tempProfile.preferredProvider === p.id ? 'bg-zinc-900 border-blue-600 text-white shadow-3xl' : 'bg-white dark:bg-white/5 border-black/5 dark:border-white/10 text-zinc-500 hover:border-blue-600/40'}`}>
                           <div className={`p-4 md:p-6 rounded-2xl md:rounded-3xl shrink-0 transition-all group-hover:scale-110 ${tempProfile.preferredProvider === p.id ? 'bg-blue-600/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>{p.icon}</div>
                           <div className="flex-1">
                             <p className="font-black uppercase text-sm md:text-base tracking-widest">{p.name}</p>
                             <p className={`text-[10px] md:text-[11px] font-medium mt-1 md:mt-2 leading-relaxed ${tempProfile.preferredProvider === p.id ? 'text-zinc-400' : 'text-zinc-500'}`}>{p.desc}</p>
                           </div>
                           <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-4 flex items-center justify-center shrink-0 transition-all ${tempProfile.preferredProvider === p.id ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}>
                             {tempProfile.preferredProvider === p.id && <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" strokeWidth={3} />}
                           </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {onboardingStep === 3 && (
                  <div className="space-y-10 w-full animate-slide-up text-center max-w-md py-4">
                     <div className="space-y-2">
                        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic text-zinc-900 dark:text-white">Neural Bridge</h2>
                        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-blue-600">Secure link initiation</p>
                     </div>
                     
                     <div className="p-8 bg-black/5 dark:bg-white/5 rounded-[40px] border-2 border-dashed border-black/10 dark:border-white/10 space-y-6 relative overflow-hidden group">
                        <div className="flex flex-col items-center gap-4 py-4">
                           <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center transition-all duration-700 ${isVerifying ? 'bg-blue-600 text-white animate-spin-slow' : 'bg-blue-600/10 text-blue-600 shadow-xl'}`}>
                              {isVerifying ? <RefreshCcw className="w-10 h-10" /> : <Laptop className="w-10 h-10" />}
                           </div>
                           <div className="space-y-4 w-full">
                              <p className="text-[12px] font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">Bridge Access Key</p>
                              <div className="relative group/input">
                                <input 
                                  type="text" 
                                  placeholder="Type or paste bridge code..." 
                                  value={linkCode}
                                  onChange={e => setLinkCode(e.target.value)}
                                  className="w-full bg-white dark:bg-zinc-800/50 py-4 px-6 rounded-2xl border-2 border-black/5 dark:border-white/5 focus:border-blue-600 outline-none transition-all text-center font-bold text-sm"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within/input:text-blue-600">
                                   <Smartphone className="w-4 h-4" />
                                </div>
                              </div>
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-3 p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-left">
                           <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />
                           <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold leading-relaxed italic">Bridge detected. Your personal sync code helps secure the high-fidelity neural tunnel.</p>
                        </div>

                        <button 
                           onClick={handleVerifyLicense} 
                           disabled={isVerifying || !linkCode.trim()}
                           className="w-full py-6 rounded-3xl bg-blue-600 text-white font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-30"
                        >
                           {isVerifying ? 'Synchronizing...' : 'Establish Link'}
                        </button>
                     </div>
                  </div>
                )}

                {onboardingStep === 4 && (
                  <div className="space-y-8 w-full animate-slide-up">
                     <div className="text-center space-y-2">
                        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter italic text-zinc-900 dark:text-white">Archetype choice</h2>
                        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-blue-600">Select default bestie vibe</p>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                        {(Object.values(PERSONALITIES) as Personality[]).map(p => (
                          <button key={p.id} onClick={() => setTempProfile({...tempProfile, personalityId: p.id})} className={`p-6 md:p-8 rounded-[35px] md:rounded-[40px] border-4 transition-all flex flex-col items-center text-center gap-4 md:gap-5 group ${tempProfile.personalityId === p.id ? 'bg-blue-600 border-blue-400 text-white shadow-2xl scale-[1.03]' : 'bg-white dark:bg-white/5 border-black/5 dark:border-white/10 text-zinc-500 hover:bg-blue-600/5 hover:border-blue-600/30'}`}>
                            <div className="text-4xl md:text-5xl group-hover:scale-125 transition-transform duration-500 drop-shadow-2xl">{p.emoji}</div>
                            <div>
                               <p className="text-[11px] md:text-[13px] font-black uppercase tracking-widest mb-1.5">{p.name}</p>
                               <p className={`text-[9px] md:text-[10px] font-bold leading-relaxed px-2 ${tempProfile.personalityId === p.id ? 'text-white/80' : 'text-zinc-500'}`}>{p.description}</p>
                            </div>
                          </button>
                        ))}
                     </div>
                  </div>
                )}

                {onboardingStep === 5 && (
                   <div className="space-y-10 md:space-y-12 w-full animate-slide-up text-center py-6">
                      <div className="relative w-40 h-40 md:w-48 md:h-48 mx-auto">
                         <div className="absolute inset-0 bg-blue-600 blur-[80px] md:blur-[100px] opacity-50 animate-pulse" />
                         <div className="relative w-full h-full rounded-full border-8 border-blue-600 p-2 md:p-3 overflow-hidden shadow-3xl bg-white dark:bg-zinc-900 z-10 ring-4 ring-white/10">
                            <img src={tempProfile.avatarUrl} className="w-full h-full object-cover rounded-full" alt="profile" />
                         </div>
                      </div>
                      
                      <div className="space-y-4 md:space-y-6">
                        <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-zinc-900 dark:text-white">Final Sync</h2>
                        <div className="p-6 md:p-8 bg-black/5 dark:bg-zinc-900 rounded-[40px] md:rounded-[50px] border border-black/5 dark:border-white/10 space-y-3 md:space-y-4 shadow-inner">
                           <div className="flex justify-between items-center text-[10px] md:text-[12px] font-black uppercase tracking-widest border-b border-black/5 dark:border-white/5 pb-3 md:pb-4">
                              <span className="text-zinc-500">Subject:</span>
                              <span className="text-blue-600">{tempProfile.userName}</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px] md:text-[12px] font-black uppercase tracking-widest border-b border-black/5 dark:border-white/5 pb-3 md:pb-4">
                              <span className="text-zinc-500">Engine:</span>
                              <span className="text-emerald-500 uppercase">{tempProfile.preferredProvider}</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px] md:text-[12px] font-black uppercase tracking-widest">
                              <span className="text-zinc-500">Archetype:</span>
                              <span className="text-amber-500">{PERSONALITIES[tempProfile.personalityId!].name}</span>
                           </div>
                        </div>
                      </div>
                      
                      <p className="text-zinc-500 font-bold text-sm md:text-base italic px-6 md:px-10 leading-relaxed">
                         "Initiate neural link, Node <span className="text-blue-600">{tempProfile.userName}</span>. I'm ready to vibe."
                      </p>
                   </div>
                )}
             </div>

             <div className="p-6 md:p-14 pt-4 flex gap-4 md:gap-6 bg-zinc-50/50 dark:bg-black/40 backdrop-blur-3xl border-t border-black/5 dark:border-white/5 shrink-0 z-30">
                {onboardingStep > 0 && (
                  <button 
                    onClick={() => setOnboardingStep(s => s - 1)} 
                    className="p-6 md:p-8 rounded-[30px] md:rounded-[40px] bg-black/5 dark:bg-white/5 text-zinc-400 border-2 border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-all flex items-center justify-center active:scale-90 shadow-lg"
                  >
                    <ArrowLeft className="w-8 h-8" strokeWidth={4} />
                  </button>
                )}
                <button 
                  onClick={() => onboardingStep < 5 ? setOnboardingStep(s => s + 1) : handleOnboardingComplete()} 
                  disabled={(onboardingStep === 1 && !tempProfile.userName) || (onboardingStep === 3)} 
                  className={`flex-1 py-6 md:py-8 rounded-[30px] md:rounded-[40px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-lg sm:text-2xl uppercase tracking-[0.2em] shadow-3xl shadow-blue-500/40 flex items-center justify-center gap-3 md:gap-5 active:scale-95 hover:brightness-110 transition-all disabled:opacity-30 relative overflow-hidden group ${(onboardingStep === 3) ? 'hidden' : ''}`}
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-700 ease-out" />
                  <span className="relative z-10">{onboardingStep < 5 ? 'Next' : 'Sync'}</span>
                  <Zap className="w-7 h-7 relative z-10 group-hover:scale-125 transition-transform animate-pulse" strokeWidth={3} />
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}