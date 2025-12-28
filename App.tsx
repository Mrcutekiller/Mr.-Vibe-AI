import React, { useState, useLayoutEffect, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Send, MessageSquare, StickyNote, Mic, Gamepad2, User as UserIcon, 
  Plus, Settings, Search, Filter, ArrowRight, Check, X,
  Trophy, Flame, Zap, Paperclip, ChevronRight, Lock, 
  Cpu, Database, Shield, Smartphone, Laptop, LogOut,
  Clock, Share2, Copy, Link as LinkIcon, Volume2, Mic2, Eye, EyeOff, Mail, UserCircle,
  Pause, Keyboard, MoreVertical, ChevronLeft, FileText, Image as ImageIcon,
  RotateCcw, Sun, Moon, Briefcase, User as UserSmall, Lightbulb, Trash2,
  Save, Key, Edit3, Smile, ExternalLink, Frown, PartyPopper, Hand, History, Terminal
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, PERSONALITY_STYLES } from './constants';
import { PersonalityId, AppSettings, User, ChatSession, Message, FileAttachment, Personality, AIProvider } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';

type Tab = 'chat' | 'notes' | 'voice' | 'arcade' | 'profile';

interface Note {
  id: string;
  title: string;
  category: 'Work' | 'Personal' | 'Ideas';
  content: string;
  timestamp: number;
  isSummarized?: boolean;
}

const Logo = () => (
  <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center shadow-lg shadow-brand/40 animate-pulse-slow">
    <Volume2 className="text-white w-8 h-8" />
  </div>
);

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });
};

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-950 shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-zinc-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{language || 'code'}</span>
        </div>
        <button onClick={copyCode} className="text-zinc-500 hover:text-white transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="p-4 overflow-x-auto custom-scrollbar">
        <pre className="text-sm font-mono text-zinc-300 leading-relaxed whitespace-pre">
          {code}
        </pre>
      </div>
    </div>
  );
};

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(```[\s\S]*?```|#{1,6}\s.*?\n|\n\n)/g);

  return (
    <div className="space-y-1">
      {parts.map((part, i) => {
        if (!part) return null;

        if (part.startsWith('```') && part.endsWith('```')) {
          const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          const lang = match?.[1] || '';
          const code = match?.[2]?.trim() || '';
          return <CodeBlock key={i} code={code} language={lang} />;
        }

        if (part.startsWith('#')) {
          const level = part.match(/^#+/)?.[0].length || 1;
          const content = part.replace(/^#+\s*/, '').trim();
          const sizes = ['', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs'];
          const size = sizes[level] || 'text-base';
          return (
            <h3 key={i} className={`font-black tracking-tight my-2 text-brand dark:text-brand-light ${size}`}>
              <RichTextSpan content={content} />
            </h3>
          );
        }

        if (part === '\n\n') {
          return <div key={i} className="h-2" />;
        }

        const lines = part.split('\n').filter(l => l.trim() !== '');
        if (lines.length === 0) return null;

        return (
          <div key={i} className="space-y-2">
            {lines.map((line, lIdx) => {
              const listMatch = line.trim().match(/^([-*]|\d+\.)\s+(.*)$/);
              if (listMatch) {
                return (
                  <div key={lIdx} className="flex gap-2 ml-2 items-start">
                    <span className="text-brand font-black mt-1.5">•</span>
                    <p className="flex-1 text-sm md:text-base leading-relaxed">
                      <RichTextSpan content={listMatch[2]} />
                    </p>
                  </div>
                );
              }

              return (
                <p key={lIdx} className="text-sm md:text-base leading-relaxed">
                  <RichTextSpan content={line} />
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const RichTextSpan: React.FC<{ content: string }> = ({ content }) => {
  const parts = content.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\)|https?:\/\/\S+)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-extrabold text-brand dark:text-brand-light">{part.slice(2, -2)}</strong>;
        }

        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-white/10 text-brand dark:text-brand-light font-mono text-[0.9em]">
              {part.slice(1, -1)}
            </code>
          );
        }

        const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
          return (
            <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-brand dark:text-brand-light font-bold underline decoration-2 underline-offset-2 hover:opacity-80 transition-opacity">
              {linkMatch[1]}
            </a>
          );
        }

        if (part.startsWith('http')) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-brand dark:text-brand-light font-bold underline decoration-2 underline-offset-2 hover:opacity-80 transition-opacity break-all">
              {part}
            </a>
          );
        }

        return part;
      })}
    </>
  );
};

const App = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('mr_vibe_theme');
    if (saved) return saved as 'light' | 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  const [onboardingStep, setOnboardingStep] = useState<number>(() => {
    return localStorage.getItem('mr_vibe_active_user') ? -1 : 0;
  });
  
  const [regData, setRegData] = useState({ fullName: '', nickname: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('google');
  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityId>(PersonalityId.STUDENT);

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('mr_vibe_active_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(user);
  const [showProfilePass, setShowProfilePass] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>(() => 
    JSON.parse(localStorage.getItem('mr_vibe_sessions') || '[]')
  );
  
  const [notes, setNotes] = useState<Note[]>(() => 
    JSON.parse(localStorage.getItem('mr_vibe_notes') || '[]')
  );
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    localStorage.getItem('mr_vibe_active_session_id')
  );
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<FileAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rpsScore, setRpsScore] = useState({ user: 0, ai: 0 });
  const [rpsGameState, setRpsGameState] = useState<'idle' | 'countdown' | 'reveal'>('idle');
  const [rpsCountdown, setRpsCountdown] = useState(3);
  const [userChoice, setUserChoice] = useState<string | null>(null);
  const [aiChoice, setAiChoice] = useState<string | null>(null);
  const [gameResult, setGameResult] = useState<'win' | 'loss' | 'draw' | null>(null);
  const [vibeReactionText, setVibeReactionText] = useState<string>('');

  const [isRecordingNote, setIsRecordingNote] = useState(false);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  
  // Refined Transcript Management
  const [liveTranscriptHistory, setLiveTranscriptHistory] = useState<{ role: 'user' | 'model', text: string, time: string }[]>([]);
  const [activeUserTurn, setActiveUserTurn] = useState('');
  const [activeModelTurn, setActiveModelTurn] = useState('');

  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<number | null>(null);
  const [noteToReview, setNoteToReview] = useState<Note | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveEndRef = useRef<HTMLDivElement>(null);
  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const currentPersonality = user ? PERSONALITIES[user.personalityId] : PERSONALITIES[PersonalityId.STUDENT];

  useLayoutEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('mr_vibe_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleShare = (text: string, chunks?: any[]) => {
    const shareUrl = chunks?.[0]?.web?.uri || chunks?.[0]?.maps?.uri;
    if (navigator.share) {
      navigator.share({
        title: 'Mr. Vibe Sync',
        text: text,
        url: shareUrl || window.location.href,
      }).catch(() => {});
    } else {
      handleCopy('share', shareUrl || text);
    }
  };

  const handleNewChat = useCallback((title = 'New Sync') => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { 
      id: newId, 
      title, 
      messages: [], 
      lastTimestamp: Date.now(), 
      personalityId: user?.personalityId || PersonalityId.STUDENT 
    };
    setSessions(prev => {
      const updated = [newSession, ...prev];
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    setActiveSessionId(newId);
    localStorage.setItem('mr_vibe_active_session_id', newId);
    setActiveTab('chat');
    return newId;
  }, [user]);

  const { 
    connect: connectLive, 
    disconnect: disconnectLive, 
    isLive, 
    isConnecting, 
    volume, 
    outputVolume 
  } = useGeminiLive({
    personality: currentPersonality,
    settings: { 
      theme: theme, 
      voiceName: currentPersonality.voiceName, 
      speakingRate: 1.0, 
      speakingPitch: 1.0, 
      personalityId: user?.personalityId || PersonalityId.STUDENT,
      language: 'English',
      customCommands: [],
      preferredProvider: 'google',
      gameDifficulty: 'medium'
    },
    user: user as User,
    mode: isRecordingNote ? 'note' : 'chat',
    onTranscript: (text, isInterim, isModel) => {
      if (isModel) setActiveModelTurn(text);
      else setActiveUserTurn(text);
    },
    onTurnComplete: (u, m) => {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const updates: { role: 'user' | 'model', text: string, time: string }[] = [];
      if (u) updates.push({ role: 'user', text: u, time: timeStr });
      if (m) updates.push({ role: 'model', text: m, time: timeStr });
      
      setLiveTranscriptHistory(prev => [...prev, ...updates]);
      setActiveUserTurn('');
      setActiveModelTurn('');
    },
    onConnectionStateChange: () => {},
    onCommand: () => {},
    onError: (e) => console.error("Live Error", e)
  });

  const startNoteRecording = () => {
    setIsRecordingNote(true);
    setLiveTranscriptHistory([]);
    setActiveUserTurn('');
    setActiveModelTurn('');
    setRecordingSeconds(0);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = window.setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    connectLive();
  };

  const startVoiceSync = () => {
    setIsVoiceChatActive(true);
    setLiveTranscriptHistory([]);
    setActiveUserTurn('');
    setActiveModelTurn('');
    setRecordingSeconds(0);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = window.setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    connectLive();
  };

  const stopAndSaveLiveSession = (saveAsNote: boolean) => {
    disconnectLive();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    
    // Auto-save logic: combine history with any currently active (interim) text
    const finalHistory = [...liveTranscriptHistory];
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (activeUserTurn.trim()) finalHistory.push({ role: 'user', text: activeUserTurn, time: timeStr });
    if (activeModelTurn.trim()) finalHistory.push({ role: 'model', text: activeModelTurn, time: timeStr });

    setTimeout(() => {
      if (finalHistory.length > 0) {
        if (saveAsNote) {
          const fullText = finalHistory.map(t => `${t.role === 'user' ? (user?.userName || 'User') : 'Mr. Cute'}: ${t.text}`).join('\n\n');
          const firstUserUtterance = finalHistory.find(t => t.role === 'user')?.text || 'New Sync Vibe';
          
          const newNote: Note = {
            id: Date.now().toString(),
            title: firstUserUtterance.slice(0, 35) + (firstUserUtterance.length > 35 ? '...' : ''),
            category: 'Personal',
            content: fullText,
            timestamp: Date.now(),
            isSummarized: true
          };
          setNoteToReview(newNote);
        } else {
          const sId = handleNewChat(`Voice Sync - ${new Date().toLocaleDateString()}`);
          const now = Date.now();
          const newMessages: Message[] = finalHistory.map((t, idx) => ({
            id: `v-${idx}-${now}`,
            role: t.role,
            text: t.text,
            timestamp: now + idx
          }));
          
          setSessions(prev => {
            const updated = prev.map(s => s.id === sId ? { ...s, messages: newMessages, lastTimestamp: Date.now() } : s);
            localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
            return updated;
          });
        }
      }
      setIsRecordingNote(false);
      setIsVoiceChatActive(false);
      setActiveUserTurn('');
      setActiveModelTurn('');
      if (!saveAsNote) setActiveTab('chat');
    }, 400);
  };

  const finalizeNoteReview = (finalNote: Note | null) => {
    if (finalNote) {
      const updatedNotes = [finalNote, ...notes];
      setNotes(updatedNotes);
      localStorage.setItem('mr_vibe_notes', JSON.stringify(updatedNotes));
      setActiveTab('notes');
    }
    setNoteToReview(null);
  };

  const handleSaveProfile = () => {
    if (editUser) {
      setUser(editUser);
      localStorage.setItem('mr_vibe_active_user', JSON.stringify(editUser));
      setIsEditingProfile(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: FileAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await fileToBase64(file);
        newAttachments.push({
            name: file.name,
            type: file.type,
            data: base64
        });
    }
    setPendingFiles(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const sendToAI = async (text: string) => {
    if ((!text.trim() && pendingFiles.length === 0) || isLoading) return;
    const sId = activeSessionId || handleNewChat();
    const now = Date.now();
    
    const userMsg: Message = { 
      id: `u-${now}`, 
      role: 'user', 
      text, 
      timestamp: now,
      files: pendingFiles.length > 0 ? [...pendingFiles] : undefined
    };

    setSessions(prev => {
        const updated = prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, userMsg], lastTimestamp: now } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
    });

    const currentFiles = [...pendingFiles];
    const userKey = user?.googleApiKey || process.env.API_KEY;
    setInputText('');
    setPendingFiles([]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: userKey });
      const parts: any[] = [];
      if (text.trim()) parts.push({ text: text.trim() });
      currentFiles.forEach(f => {
        parts.push({
          inlineData: {
            data: f.data,
            mimeType: f.type
          }
        });
      });

      const nickname = user?.nickname || user?.userName || 'Bestie';
      const promptMod = `Address me as **${nickname}**. 
      - Clean, informative, Bestie-vibes only.
      - Use markdown for bolding and code blocks.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts },
        config: { 
          systemInstruction: `${BASE_SYSTEM_PROMPT}\n\n${promptMod}\n\n${currentPersonality.prompt}`,
          tools: [{ googleSearch: {} }] 
        }
      });
      
      const aiMsg: Message = { 
        id: `ai-${Date.now()}`, 
        role: 'model', 
        text: response.text || '...', 
        timestamp: Date.now(),
        groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
      };
      
      setSessions(prev => {
          const updated = prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, aiMsg], lastTimestamp: Date.now() } : s);
          localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
          return updated;
      });
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const playRPS = async (choice: string) => {
    if (rpsGameState !== 'idle') return;
    setUserChoice(choice);
    setRpsGameState('countdown');
    setRpsCountdown(3);
    
    setVibeReactionText("I can feel your move through the neural link!");

    const interval = setInterval(() => {
      setRpsCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 800);

    setTimeout(() => {
      const options = ['rock', 'paper', 'scissors'];
      const ai = options[Math.floor(Math.random() * 3)];
      setAiChoice(ai);
      
      let result: 'win' | 'loss' | 'draw' = 'draw';
      if (choice === ai) result = 'draw';
      else if ((choice === 'rock' && ai === 'scissors') || (choice === 'paper' && ai === 'rock') || (choice === 'scissors' && ai === 'paper')) result = 'win';
      else result = 'loss';
      
      setGameResult(result);
      setRpsGameState('reveal');

      const nickname = user?.nickname || user?.userName || 'Bestie';
      if (result === 'win') {
        setVibeReactionText(`OMG ${nickname}! You literally crushed me! +50 XP 🏆`);
        setRpsScore(prev => ({ ...prev, user: prev.user + 1 }));
        if (user) {
          const updated = { ...user, xp: user.xp + 50 };
          setUser(updated);
          localStorage.setItem('mr_vibe_active_user', JSON.stringify(updated));
        }
      } else if (result === 'loss') {
        setVibeReactionText(`Too slow, ${nickname}! Mr. Vibe takes the W! 😏`);
        setRpsScore(prev => ({ ...prev, ai: prev.ai + 1 }));
      } else {
        setVibeReactionText(`A tie?! Twins for real! 👯‍♂️`);
      }
    }, 2800);
  };

  const resetRps = () => { setRpsGameState('idle'); setUserChoice(null); setAiChoice(null); setGameResult(null); setVibeReactionText(''); };

  const finalizeOnboarding = () => {
    const newUser: User = {
        userName: regData.fullName || 'Alex',
        nickname: regData.nickname || regData.fullName || 'Bestie',
        email: regData.email,
        password: regData.password,
        gender: 'Secret',
        avatarUrl: AVATARS[0],
        personalityId: selectedPersonality,
        preferredProvider: selectedProvider,
        xp: 1250,
        level: 1,
        badges: [],
        gameHistory: [],
        googleApiKey: selectedProvider === 'google' ? apiKey : undefined,
        openaiApiKey: selectedProvider === 'openai' ? apiKey : undefined
    };
    setUser(newUser);
    localStorage.setItem('mr_vibe_active_user', JSON.stringify(newUser));
    setOnboardingStep(-1);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [sessions, isLoading]);
  useEffect(() => { liveEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [liveTranscriptHistory, activeUserTurn, activeModelTurn]);

  // UI Components mapping transcript state
  const CombinedTranscript = useMemo(() => {
    const combined = [...liveTranscriptHistory];
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (activeUserTurn) combined.push({ role: 'user', text: activeUserTurn, time: timeStr });
    if (activeModelTurn) combined.push({ role: 'model', text: activeModelTurn, time: timeStr });
    return combined;
  }, [liveTranscriptHistory, activeUserTurn, activeModelTurn]);

  if (onboardingStep === 0) return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-brand-dark relative overflow-hidden text-zinc-900 dark:text-white transition-colors duration-300">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.15)_0%,transparent_70%)]" />
      <div className="z-10 flex flex-col items-center text-center">
        <Logo />
        <h1 className="text-4xl font-extrabold mt-8 tracking-tighter">Mr. Vibe AI</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-4 max-w-xs font-medium leading-relaxed">Your ultimate companion for intelligent chat, voice notes, and interactive games.</p>
        <button onClick={() => setOnboardingStep(1)} className="mt-16 w-full py-5 bg-brand rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-brand/90 transition-all active:scale-95 shadow-lg shadow-brand/20 text-white">
          Get Started <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );

  // Sign up screens (1, 2, 3) skipped for brevity - they are unchanged.
  if (onboardingStep === 1) return (
    <div className="h-full flex flex-col p-6 bg-slate-50 dark:bg-brand-dark ios-safe-top overflow-y-auto text-zinc-900 dark:text-white transition-colors duration-300">
      <div className="flex items-center gap-2 mb-8">
        <button onClick={() => setOnboardingStep(0)} className="p-2 -ml-2 text-zinc-500 dark:text-zinc-400"><ChevronLeft size={24} /></button>
        <span className="font-bold text-sm text-zinc-500 uppercase tracking-widest">Sign Up</span>
      </div>
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-brand/10 border-4 border-brand p-1 mb-8">
          <div className="w-full h-full rounded-full bg-brand/20 flex items-center justify-center text-brand"><Volume2 size={32} /></div>
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Join Mr. Vibe AI</h2>
        <p className="text-zinc-500 font-medium mt-2 mb-10">Unlock your personal AI assistant for chat, notes, and more.</p>
      </div>
      <div className="space-y-6 flex-1">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">Full Name</label>
          <div className="bg-white dark:bg-brand-input rounded-2xl p-4 flex items-center gap-3 border border-zinc-200 dark:border-white/5 shadow-sm">
            <UserCircle size={18} className="text-zinc-400 dark:text-zinc-600" />
            <input value={regData.fullName} onChange={e => setRegData({...regData, fullName: e.target.value})} placeholder="Jane Doe" className="bg-transparent border-none outline-none font-bold flex-1 placeholder:text-zinc-300 dark:placeholder:text-zinc-500" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">Nickname (I'll call you this)</label>
          <div className="bg-white dark:bg-brand-input rounded-2xl p-4 flex items-center gap-3 border border-zinc-200 dark:border-white/5 shadow-sm">
            <Smile size={18} className="text-zinc-400 dark:text-zinc-600" />
            <input value={regData.nickname} onChange={e => setRegData({...regData, nickname: e.target.value})} placeholder="Bestie, King, Alex..." className="bg-transparent border-none outline-none font-bold flex-1 placeholder:text-zinc-300 dark:placeholder:text-zinc-500" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">Email Address</label>
          <div className="bg-white dark:bg-brand-input rounded-2xl p-4 flex items-center gap-3 border border-zinc-200 dark:border-white/5 shadow-sm">
            <Mail size={18} className="text-zinc-400 dark:text-zinc-600" />
            <input value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} placeholder="jane@example.com" className="bg-transparent border-none outline-none font-bold flex-1 placeholder:text-zinc-300 dark:placeholder:text-zinc-500" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">Password</label>
          <div className="bg-white dark:bg-brand-input rounded-2xl p-4 flex items-center gap-3 border border-zinc-200 dark:border-white/5 shadow-sm">
            <Lock size={18} className="text-zinc-400 dark:text-zinc-600" />
            <input type={showPassword ? 'text' : 'password'} value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} placeholder="Min. 8 characters" className="bg-transparent border-none outline-none font-bold flex-1 placeholder:text-zinc-300 dark:placeholder:text-zinc-500" />
            <button onClick={() => setShowPassword(!showPassword)} className="text-zinc-400">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
        </div>
      </div>
      <button 
        disabled={!regData.fullName || !regData.email || regData.password.length < 8}
        onClick={() => setOnboardingStep(2)} 
        className="mt-8 w-full py-5 bg-brand rounded-2xl font-bold hover:bg-brand/90 transition-all active:scale-95 mb-8 disabled:opacity-50 disabled:grayscale text-white"
      >
        Continue
      </button>
    </div>
  );

  if (onboardingStep === 2) return (
    <div className="h-full flex flex-col p-6 bg-slate-50 dark:bg-brand-dark ios-safe-top text-zinc-900 dark:text-white transition-colors duration-300">
      <div className="flex items-center gap-2 mb-8">
        <button onClick={() => setOnboardingStep(1)} className="p-2 -ml-2 text-zinc-500 dark:text-zinc-400"><ChevronLeft size={24} /></button>
        <span className="font-bold text-sm text-zinc-500 uppercase tracking-widest">Setup API Access</span>
      </div>
      <div className="flex-1 flex flex-col items-center">
        <div className="w-24 h-24 rounded-full bg-brand/20 flex items-center justify-center text-brand relative mb-8">
            <Lock size={40} />
        </div>
        <h2 className="text-3xl font-bold mt-2 text-center px-4 tracking-tight">Unlock Mr. Vibe's Full Potential</h2>
        <div className="mt-12 w-full space-y-6">
          <div className="flex gap-2 p-1 bg-white dark:bg-brand-input rounded-2xl border border-zinc-200 dark:border-white/5 shadow-sm">
            <button onClick={() => setSelectedProvider('openai')} className={`flex-1 py-4 rounded-xl flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest transition-all ${selectedProvider === 'openai' ? 'bg-brand text-white shadow-lg' : 'text-zinc-400 dark:text-zinc-500'}`}><Database size={16}/> OpenAI</button>
            <button onClick={() => setSelectedProvider('google')} className={`flex-1 py-4 rounded-xl flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest transition-all ${selectedProvider === 'google' ? 'bg-brand text-white shadow-lg' : 'text-zinc-400 dark:text-zinc-500'}`}><Cpu size={16}/> Gemini</button>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-2">API Key</label>
            <div className="bg-white dark:bg-brand-input rounded-2xl p-4 flex items-center gap-3 border border-zinc-200 dark:border-white/5 shadow-sm">
                <Lock size={18} className="text-zinc-400 dark:text-zinc-600" />
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Key..." className="bg-transparent border-none outline-none font-bold flex-1 placeholder:text-zinc-300 dark:placeholder:text-zinc-500" />
                <button className="text-brand text-xs font-black uppercase tracking-widest px-2">Paste</button>
            </div>
          </div>
        </div>
      </div>
      <button 
        disabled={!apiKey}
        onClick={() => setOnboardingStep(3)} 
        className="w-full py-5 bg-brand rounded-2xl font-bold hover:bg-brand/90 transition-all active:scale-95 shadow-xl shadow-brand/20 mb-12 disabled:opacity-50 text-white"
      >
        Continue
      </button>
    </div>
  );

  if (onboardingStep === 3) return (
    <div className="h-full flex flex-col p-6 bg-slate-50 dark:bg-brand-dark ios-safe-top text-zinc-900 dark:text-white transition-colors duration-300">
      <div className="flex items-center gap-2 mb-8">
        <button onClick={() => setOnboardingStep(2)} className="p-2 -ml-2 text-zinc-500 dark:text-zinc-400"><ChevronLeft size={24} /></button>
        <span className="font-bold text-sm text-zinc-500 uppercase tracking-widest">Select Personality</span>
      </div>
      <h2 className="text-3xl font-bold mt-4 tracking-tight">Select default bestie vibe</h2>
      <div className="mt-10 grid grid-cols-2 gap-4 flex-1 overflow-y-auto custom-scrollbar pb-10">
        {Object.values(PERSONALITIES).map(p => (
          <button key={p.id} onClick={() => setSelectedPersonality(p.id)} className={`p-6 rounded-[32px] border-2 text-left flex flex-col gap-6 relative transition-all duration-300 h-64 ${selectedPersonality === p.id ? 'bg-brand/10 border-brand shadow-xl' : 'bg-white dark:bg-brand-input border-zinc-200 dark:border-white/5'}`}>
            {selectedPersonality === p.id && <div className="absolute top-4 right-4 bg-brand rounded-full p-1 shadow-lg text-white"><Check size={12} strokeWidth={4} /></div>}
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-4xl mx-auto shadow-inner">{p.emoji}</div>
            <div className="text-center">
              <p className="font-extrabold text-lg leading-tight">{p.name}</p>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed font-bold">{p.description}</p>
            </div>
          </button>
        ))}
      </div>
      <button onClick={finalizeOnboarding} className="mt-6 w-full py-5 bg-brand rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-brand/20 mb-8 text-white">Next <ArrowRight size={18}/></button>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-brand-dark text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden transition-colors duration-300">
      
      {/* Sync History Drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex justify-end animate-fade-in" onClick={() => setShowHistory(false)}>
          <div className="w-80 h-full glass-card border-l border-brand/10 p-6 flex flex-col shadow-2xl animate-vibe-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-2">
                 <History size={20} className="text-brand" />
                 <h3 className="text-xl font-bold">Sync History</h3>
               </div>
               <button onClick={() => setShowHistory(false)} className="p-2 bg-zinc-100 dark:bg-white/5 rounded-xl text-zinc-500"><X size={20}/></button>
            </div>
            <button onClick={() => { handleNewChat(); setShowHistory(false); }} className="w-full py-4 bg-brand/10 text-brand rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 mb-6 hover:bg-brand hover:text-white transition-all">
               <Plus size={16} /> New Sync
            </button>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
               {sessions.map(s => (
                 <div key={s.id} onClick={() => { setActiveSessionId(s.id); setShowHistory(false); }} className={`p-4 rounded-[24px] border transition-all cursor-pointer relative group ${activeSessionId === s.id ? 'bg-brand/10 border-brand shadow-lg' : 'bg-zinc-50 dark:bg-white/5 border-transparent'}`}>
                    <p className="font-bold text-sm truncate pr-6">{s.title}</p>
                    <p className="text-[10px] text-zinc-500 font-medium mt-1">{new Date(s.lastTimestamp).toLocaleDateString()} • {s.messages.length} vibes</p>
                    <button onClick={(e) => deleteSession(e, s.id)} className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                       <Trash2 size={14} />
                    </button>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )}

      {/* Note Review Modal */}
      {noteToReview && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="w-full max-w-lg glass-card rounded-[40px] p-8 space-y-8 shadow-2xl border-brand/20 animate-vibe-in overflow-hidden relative">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-brand/20 text-brand rounded-2xl"><StickyNote size={24} /></div>
                <div>
                  <h3 className="text-xl font-extrabold tracking-tight italic uppercase">Review Sync</h3>
                  <p className="text-[10px] font-black text-brand uppercase tracking-widest">Auto-saved Note</p>
                </div>
              </div>
              <button onClick={() => setNoteToReview(null)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors"><Trash2 size={24} /></button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Vibe Title</label>
              <input value={noteToReview.title} onChange={e => setNoteToReview({...noteToReview, title: e.target.value})} className="w-full bg-zinc-100 dark:bg-brand-input rounded-2xl p-4 font-bold border border-zinc-200 dark:border-white/5 outline-none focus:border-brand transition-all text-zinc-800 dark:text-white" />
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Select Vibe Type</label>
              <div className="grid grid-cols-3 gap-3">
                {[{ id: 'Work', icon: Briefcase, color: 'text-brand bg-brand/10' }, { id: 'Personal', icon: UserSmall, color: 'text-pink-500 bg-pink-500/10' }, { id: 'Ideas', icon: Lightbulb, color: 'text-amber-500 bg-amber-500/10' }].map(cat => (
                  <button key={cat.id} onClick={() => setNoteToReview({...noteToReview, category: cat.id as any})} className={`flex flex-col items-center gap-2 p-4 rounded-[28px] border-2 transition-all ${noteToReview.category === cat.id ? 'border-brand bg-brand/5 shadow-lg' : 'border-transparent bg-zinc-100 dark:bg-brand-input'}`}>
                    <cat.icon className={cat.color + " p-2 rounded-xl"} size={32} />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{cat.id}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Sync Content</label>
              <div className="max-h-48 overflow-y-auto custom-scrollbar bg-zinc-100 dark:bg-brand-input p-4 rounded-2xl border border-zinc-200 dark:border-white/5">
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium whitespace-pre-wrap">{noteToReview.content}</p>
              </div>
            </div>
            <button onClick={() => finalizeNoteReview(noteToReview)} className="w-full py-6 bg-brand text-white rounded-[32px] font-black text-xl shadow-2xl shadow-brand/30 active:scale-95 transition-all flex items-center justify-center gap-3"><Check size={28} /> Keep this Vibe</button>
          </div>
        </div>
      )}

      {/* Live Voice Recording UI */}
      {(isRecordingNote || isVoiceChatActive) && (
        <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-brand-dark flex flex-col animate-fade-in ios-safe-top text-zinc-900 dark:text-white">
          <header className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center"><Mic size={24} className="text-brand animate-pulse" /></div>
              <div>
                <h3 className="text-xl font-bold italic uppercase">{isRecordingNote ? 'Note Scribing' : 'Voice Mode'}</h3>
                <p className="text-brand font-black tracking-widest text-[10px] mt-0.5 uppercase">{formatTime(recordingSeconds)}</p>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar">
            {CombinedTranscript.map((t, idx) => (
              <div key={idx} className={`flex gap-3 ${t.role === 'user' ? 'flex-row-reverse' : ''} animate-vibe-in`}>
                <div className="w-9 h-9 rounded-full bg-white dark:bg-brand-input shrink-0 overflow-hidden border border-zinc-200 dark:border-white/5 shadow-lg"><img src={t.role === 'user' ? user?.avatarUrl : AVATARS[2]} alt="avatar" /></div>
                <div className={`flex flex-col gap-1 max-w-[75%] ${t.role === 'user' ? 'items-end' : ''}`}>
                  <span className={`text-[10px] font-bold text-zinc-500`}>{t.role === 'model' ? 'Mr. Cute' : user?.userName}</span>
                  <div className={`p-4 rounded-2xl shadow-md ${t.role === 'user' ? 'bg-brand text-white rounded-tr-none' : 'bg-white dark:bg-brand-card border border-zinc-200 dark:border-white/5 rounded-tl-none'}`}>
                    <FormattedText text={t.text} />
                  </div>
                </div>
              </div>
            ))}
            <div ref={liveEndRef} />
          </main>
          <footer className="p-8 bg-gradient-to-t from-slate-50 dark:from-brand-dark via-slate-50/95 dark:via-brand-dark/95 to-transparent flex flex-col items-center gap-8">
            <div className="flex gap-1.5 h-12 items-center justify-center">
              {[1, 0.5, 1.5, 0.8, 2, 1.2, 0.6, 1.8].map((h, i) => (
                <div key={i} className={`w-2 rounded-full bg-brand shadow-[0_0_12px_rgba(139,92,246,0.5)] animate-pulse`} style={{ height: `${h * 1.5}rem`, animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <button onClick={() => stopAndSaveLiveSession(isRecordingNote)} className="px-10 py-6 bg-red-500 text-white rounded-[32px] font-black text-xl flex items-center gap-3 shadow-2xl shadow-red-500/30 active:scale-95 transition-all"><X size={24} /> End & Auto-Save</button>
          </footer>
        </div>
      )}

      {/* Main Header */}
      <header className="px-6 pt-12 pb-4 flex items-center justify-between ios-safe-top">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={user?.avatarUrl} className="w-10 h-10 rounded-full border-2 border-brand bg-white dark:bg-transparent" alt="me" />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-50 dark:border-brand-dark shadow-sm" />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate max-w-[120px]">{user?.userName} AI</p>
            <p className="text-[10px] font-black text-brand uppercase tracking-widest">Neural Link Active</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowHistory(true)} className="p-2 bg-white dark:bg-brand-input rounded-xl hover:bg-brand/10 transition-colors shadow-lg border border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-zinc-400 relative">
             <History size={20}/>
             {sessions.length > 0 && <div className="absolute -top-1 -right-1 w-2 h-2 bg-brand rounded-full animate-pulse" />}
          </button>
          <button onClick={() => { setActiveTab('profile'); setEditUser(user); setIsEditingProfile(false); }} className="p-2 bg-white dark:bg-brand-input rounded-xl hover:bg-brand/10 transition-colors shadow-lg border border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-zinc-400"><Settings size={20}/></button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col">
            <div className="px-6 py-2 flex items-center justify-between border-b border-brand/5">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-brand rounded-full" />
                 <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 truncate max-w-[200px]">
                   {activeSession ? activeSession.title : 'New Sync Session'}
                 </p>
               </div>
               <button onClick={() => handleNewChat()} className="text-[10px] font-black text-brand uppercase tracking-widest hover:underline flex items-center gap-1">
                 <Plus size={12} /> New Chat
               </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8 custom-scrollbar">
              {(!activeSession || activeSession.messages.length === 0) ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-10 animate-fade-in py-20">
                  <Logo />
                  <h3 className="mt-8 text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 italic uppercase tracking-tighter">OMG HI BESTIE! 🌟</h3>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-4 leading-relaxed font-medium italic">
                    I'm **Mr. Cute**, your AI bestie. I'm literally ready to analyze trends or just roast your outfits. What's the move?
                  </p>
                </div>
              ) : (
                activeSession?.messages.map(m => (
                  <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''} animate-vibe-in group`}>
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-brand-input shrink-0 overflow-hidden border border-zinc-200 dark:border-white/5 shadow-lg"><img src={m.role === 'user' ? user?.avatarUrl : AVATARS[2]} alt="avatar" /></div>
                    <div className={`flex flex-col gap-2 max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-2 text-[10px] font-bold text-zinc-500 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <span>{m.role === 'model' ? 'Mr. Cute' : user?.userName}</span>
                        <span>•</span>
                        <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={`p-4 rounded-3xl shadow-sm transition-all ${m.role === 'user' ? 'bg-brand text-white rounded-tr-none' : 'bg-white dark:bg-brand-card border border-zinc-200 dark:border-white/5 rounded-tl-none text-zinc-800 dark:text-zinc-100'}`}>
                          <FormattedText text={m.text} />
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-6">
              <div className="bg-white dark:bg-brand-input rounded-[32px] p-2 flex items-center gap-2 border border-zinc-200 dark:border-white/5 shadow-2xl">
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} accept="image/*,application/pdf,text/plain"/>
                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-400 hover:text-brand transition-colors"><Plus size={20}/></button>
                <input value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendToAI(inputText)} placeholder="Message Mr. Cute..." className="flex-1 bg-transparent border-none outline-none font-medium text-zinc-800 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600" />
                <button onClick={startVoiceSync} className="p-3 text-zinc-400 hover:text-brand transition-colors"><Mic size={20}/></button>
                <button onClick={() => sendToAI(inputText)} className={`p-3 rounded-2xl transition-all duration-300 ${(inputText.trim() || pendingFiles.length > 0) ? 'bg-brand text-white shadow-lg' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600'}`}><ArrowRight size={20}/></button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar">
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white italic uppercase">Sup, <span className="text-brand">{user?.nickname || user?.userName}</span></h1>
            <p className="text-zinc-500 font-bold mt-2 italic">You have {notes.length} vibes auto-saved.</p>
            <div className="mt-8 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
              <input placeholder="Find a past vibe..." className="w-full bg-white dark:bg-brand-input rounded-2xl py-4 pl-12 pr-4 font-bold border border-zinc-200 dark:border-white/5 outline-none focus:border-brand/50 transition-all shadow-sm text-zinc-800 dark:text-white" />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 pb-32">
              {notes.map(note => (
                <div key={note.id} className="glass-card p-6 rounded-[32px] space-y-4 hover:border-brand/30 transition-all cursor-pointer group shadow-xl">
                  <div className="flex justify-between items-center">
                    <div className={`flex items-center gap-2 text-xs font-black tracking-widest ${note.category === 'Work' ? 'text-brand' : 'text-pink-500'}`}><StickyNote size={14}/> {note.category.toUpperCase()}</div>
                    <span className="text-zinc-500 text-[10px] font-bold">{new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <h4 className="text-xl font-extrabold tracking-tight group-hover:text-brand transition-colors text-zinc-900 dark:text-zinc-100">{note.title}</h4>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed line-clamp-2">{note.content}</p>
                </div>
              ))}
            </div>
            <button onClick={startNoteRecording} className="fixed bottom-32 right-6 w-16 h-16 bg-brand rounded-[24px] shadow-2xl shadow-brand/40 flex items-center justify-center text-white active:scale-90 transition-all z-10"><Plus size={32} strokeWidth={3}/></button>
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-brand-dark relative animate-fade-in text-zinc-900 dark:text-white">
            <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-center">
              <div className="w-56 h-56 rounded-full bg-brand flex items-center justify-center shadow-2xl shadow-brand/50 relative">
                <div className="absolute inset-0 rounded-full bg-brand animate-ping opacity-10" />
                <Mic size={80} className="text-white drop-shadow-lg" />
              </div>
              <h2 className="mt-12 text-5xl font-black tracking-tighter uppercase italic">Ready</h2>
              <p className="mt-4 text-zinc-500 font-bold uppercase tracking-widest text-xs italic">Sync Link Primed</p>
            </div>
            <div className="w-full flex items-center justify-center gap-10 mb-8 mt-12 px-6">
               <button onClick={() => setActiveTab('chat')} className="p-6 glass-card rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-all shadow-lg active:scale-90"><X size={32}/></button>
               <button onClick={startVoiceSync} className="flex-1 py-7 bg-brand rounded-full text-white text-xl font-black shadow-2xl shadow-brand/40 active:scale-95 transition-all">Start Sync</button>
            </div>
          </div>
        )}

        {/* Arcade and Profile tabs (omitted unchanged parts) */}
        {activeTab === 'arcade' && (
          <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar animate-fade-in">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white italic uppercase tracking-tighter">RPS Arcade</h1>
              <div className="flex items-center gap-2 px-4 py-1.5 bg-brand/10 border border-brand/20 rounded-full text-brand text-[10px] font-black uppercase tracking-widest shadow-sm">
                 <Flame size={14} className="animate-pulse" /> Streak: 0
              </div>
            </div>
            <div className="p-8 glass-card rounded-[40px] grid grid-cols-2 relative shadow-2xl mb-8 border-2 border-brand/5 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent opacity-50" />
              <div className="text-center relative z-10">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Player</p>
                <p className="text-6xl font-black mt-2 text-brand drop-shadow-lg scale-110">{rpsScore.user}</p>
                <p className="text-[10px] font-bold text-zinc-500 mt-2 truncate">{user?.userName}</p>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-black text-zinc-300 dark:text-white/5 italic">VS</div>
              <div className="text-center relative z-10">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Mr. Cute</p>
                <p className="text-6xl font-black mt-2 text-zinc-400 dark:text-white/80 drop-shadow-lg scale-110">{rpsScore.ai}</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center py-6 min-h-[400px]">
              {rpsGameState === 'idle' && (
                <div className="text-center animate-fade-in w-full">
                  <div className="w-48 h-48 rounded-[56px] bg-white dark:bg-brand-input flex items-center justify-center border-4 border-brand/20 shadow-[0_20px_50px_rgba(139,92,246,0.15)] mx-auto group hover:scale-105 transition-all">
                    <Gamepad2 size={90} className="text-brand/40 group-hover:text-brand transition-colors animate-float" />
                  </div>
                  <h3 className="mt-10 text-xl font-extrabold uppercase tracking-widest text-zinc-400 dark:text-white/30 italic">Pick your move, Bestie!</h3>
                  <div className="mt-12 flex gap-4 w-full px-4">
                    {[
                      { id: 'rock', icon: '🪨', label: 'ROCK', color: 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 border-indigo-500/30' },
                      { id: 'paper', icon: '📄', label: 'PAPER', color: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/30' },
                      { id: 'scissors', icon: '✂️', label: 'SCISSORS', color: 'bg-pink-500/10 hover:bg-pink-500/20 text-pink-500 border-pink-500/30' }
                    ].map(move => (
                      <button key={move.id} onClick={() => playRPS(move.id)} className={`flex-1 aspect-square glass-card rounded-[36px] flex flex-col items-center justify-center gap-4 border-2 transition-all active:scale-90 shadow-xl ${move.color} group`}>
                        <span className="text-5xl group-hover:scale-125 transition-transform duration-300 drop-shadow-md">{move.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{move.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {rpsGameState === 'countdown' && (
                <div className="flex flex-col items-center justify-center animate-vibe-in">
                  <span className="text-9xl font-black text-brand relative z-10 drop-shadow-2xl animate-vibe-in">{rpsCountdown > 0 ? rpsCountdown : 'GO!'}</span>
                  <p className="mt-10 font-black text-brand uppercase tracking-[0.3em] text-sm animate-pulse">{vibeReactionText}</p>
                </div>
              )}
              {rpsGameState === 'reveal' && (
                <div className="w-full flex flex-col items-center animate-fade-in relative">
                  <div className={`mt-14 px-12 py-6 rounded-[32px] font-black text-4xl uppercase tracking-[0.2em] shadow-[0_20px_60px_rgba(0,0,0,0.2)] animate-vibe-in flex items-center gap-4 ${
                    gameResult === 'win' ? 'bg-green-500 text-white' : 
                    gameResult === 'loss' ? 'bg-red-500 text-white' : 'bg-zinc-700 text-white'
                  }`}>
                    {gameResult === 'win' ? 'YOU WIN!' : gameResult === 'loss' ? 'LOSE!' : 'DRAW!'}
                  </div>
                  <button onClick={resetRps} className="mt-12 p-6 bg-brand text-white hover:bg-brand/90 rounded-full transition-all active:scale-90 shadow-2xl shadow-brand/40 flex items-center gap-3">
                    <RotateCcw size={32} />
                    <span className="font-black text-sm uppercase tracking-widest mr-2">Play Again</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar">
            <div className="flex flex-col items-center mt-8 relative">
              <div className="w-36 h-36 rounded-full border-4 border-brand p-1 relative shadow-2xl shadow-brand/20">
                <img src={user?.avatarUrl} className="w-full h-full rounded-full object-cover shadow-inner bg-white dark:bg-transparent" alt="me" />
              </div>
              <h2 className="text-3xl font-black mt-8 tracking-tight italic text-zinc-900 dark:text-zinc-100 uppercase tracking-tighter">{user?.userName}</h2>
              <p className="text-brand font-black uppercase text-[10px] tracking-[0.3em] mt-1">aka {user?.nickname || 'Bestie'}</p>
            </div>
            <div className="mt-14 space-y-6">
              <div className="flex items-center justify-between p-6 glass-card rounded-[32px] shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">{theme === 'dark' ? <Moon size={24}/> : <Sun size={24}/>}</div>
                  <div><p className="font-bold text-zinc-900 dark:text-zinc-100">Display Mode</p><p className="text-xs text-zinc-500 uppercase font-black tracking-widest">{theme} theme</p></div>
                </div>
                <button onClick={toggleTheme} className="w-14 h-8 bg-zinc-200 dark:bg-brand-input rounded-full p-1 transition-all relative border border-zinc-300 dark:border-white/5"><div className={`w-6 h-6 rounded-full bg-white dark:bg-brand shadow-lg transition-all transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} /></button>
              </div>
            </div>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="mt-14 w-full py-7 bg-rose-500/10 text-rose-500 rounded-[36px] font-black uppercase tracking-[0.2em] border border-rose-500/20 flex items-center justify-center gap-4 hover:bg-rose-500/20 transition-all shadow-lg active:scale-95 mb-10"><LogOut size={24} /> Log Out & Delete Sync</button>
          </div>
        )}
      </main>

      {/* Main Tab Navigation */}
      <nav className="tab-bar px-6 pt-5 pb-10 flex items-center justify-between ios-safe-bottom">
        {[
          { id: 'chat', icon: <MessageSquare size={24}/>, label: 'Chat' },
          { id: 'notes', icon: <StickyNote size={24}/>, label: 'Notes' },
          { id: 'voice', icon: <Mic2 size={24}/>, label: 'Voice' },
          { id: 'arcade', icon: <Gamepad2 size={24}/>, label: 'Arcade' },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id as Tab); setIsEditingProfile(false); }} className={`flex flex-col items-center gap-2 transition-all duration-300 ${activeTab === tab.id ? 'text-brand scale-110 translate-y-[-4px]' : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'}`}>
            <div className={`transition-all duration-300 ${activeTab === tab.id ? 'drop-shadow-[0_0_12px_rgba(139,92,246,0.5)]' : ''}`}>{tab.icon}</div>
            <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
