
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Volume2, CheckCircle2, Sparkles, MicOff, ImageIcon, Globe,
  Edit3, History, LogOut, Clock, MessageSquare, StickyNote,
  UserCheck, Palette, Bell, Eraser, Info, ExternalLink, Activity,
  ChevronDown, MoreHorizontal, User as UserIcon, Copy, Share2, Heart, ThumbsUp, Pin, BookOpen, Key, Save, ListFilter,
  Check, AlertTriangle, FileText, File, TrendingUp, Brain, ShieldAlert,
  Headphones, BarChart3, Calculator, Zap, Square, CheckSquare, Search, VolumeX
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES } from './constants';
import { PersonalityId, Personality, AppSettings, User, ChatSession, Message, ReactionType, Notification } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';

// --- Modern AI Orb Component ---
type OrbAnimationState = 'idle' | 'hi' | 'thoughtful' | 'excited';

const VibeOrb = ({ active, isThinking, isAiSpeaking, volume, outputVolume, animationState }: { 
  active: boolean, 
  isThinking: boolean, 
  isAiSpeaking?: boolean,
  volume: number,
  outputVolume: number,
  animationState?: OrbAnimationState
}) => {
  const currentVol = isAiSpeaking ? outputVolume : volume;
  const scale = active ? 1 + currentVol * 1.5 : 1;
  
  const getAnimationClass = () => {
    if (animationState === 'hi') return 'animate-hi-pulse';
    if (animationState === 'excited') return 'animate-excited-bounce';
    if (animationState === 'thoughtful') return 'animate-thoughtful-wobble';
    if (isThinking) return 'animate-pulse-orb';
    return '';
  };

  return (
    <div className={`relative flex items-center justify-center w-48 h-48 md:w-64 md:h-64 transition-all duration-300 ${getAnimationClass()}`}>
      <div className={`absolute inset-0 rounded-full bg-blue-500/10 blur-3xl transition-opacity duration-500 ${isThinking || animationState !== 'idle' ? 'opacity-100' : 'opacity-50'}`} />
      <div 
        className={`relative w-24 h-24 md:w-32 md:h-32 rounded-full transition-all duration-75 ease-out flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.5)] ${active || animationState !== 'idle' ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-zinc-800'}`}
        style={{ transform: `scale(${scale})` }}
      >
        <div className={`w-full h-full rounded-full bg-white/10 ${active ? 'animate-orb-float' : ''}`} />
        <div className="absolute inset-2 rounded-full border border-white/20" />
      </div>
      {isThinking && (
        <div className="absolute inset-0 border-2 border-blue-500/20 rounded-full animate-ping" />
      )}
    </div>
  );
};

// --- Professional Toast Notification ---
const NotificationToast = ({ message, type, onClose }: { message: string, type: 'info' | 'success' | 'error', onClose: () => void }) => (
  <div className="fixed top-4 md:top-8 inset-x-4 z-[10000] flex justify-center pointer-events-none">
    <div className={`w-full max-w-sm bg-[#1e1e1e] shadow-2xl rounded-2xl border flex items-center gap-3 p-4 pointer-events-auto animate-slide-up ${
      type === 'success' ? 'border-emerald-500/20 text-emerald-400' :
      type === 'error' ? 'border-rose-500/20 text-rose-400' :
      'border-blue-500/20 text-blue-400'
    }`}>
      <div className="p-2 rounded-xl bg-white/5"><Bell size={18} /></div>
      <div className="flex-1 font-bold text-xs leading-snug">{message}</div>
      <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-all text-zinc-500"><X size={16} /></button>
    </div>
  </div>
);

// --- Markdown Component ---
const MarkdownText = ({ text }: { text: string }) => {
  const renderLine = (line: string, key: number) => {
    // Basic H3 detection for trade headers
    if (line.startsWith('###')) {
      return <h3 key={key} className="text-blue-400 font-black text-lg mt-4 mb-2 flex items-center gap-2">
        <Activity size={18} /> {line.replace('###', '').trim()}
      </h3>;
    }

    const parts = line.split(/(\*\*.*?\*\*|`.*?`|https?:\/\/[^\s]+)/g);
    return (
      <div key={key} className="mb-1.5 last:mb-0">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) return <strong key={idx} className="font-extrabold text-white">{part.slice(2, -2)}</strong>;
          if (part.startsWith('`') && part.endsWith('`')) return <code key={idx} className="bg-white/10 px-1 py-0.5 rounded font-mono text-[10px]">{part.slice(1, -1)}</code>;
          if (part.startsWith('http')) return <a key={idx} href={part} target="_blank" className="text-blue-400 underline">{part}</a>;
          return <span key={idx}>{part}</span>;
        })}
      </div>
    );
  };
  return <div className="text-zinc-200">{text.split('\n').map((l, i) => renderLine(l, i))}</div>;
};

// --- Logo ---
const Logo = ({ className }: { className?: string }) => (
  <div className={`${className} flex items-center justify-center`}>
    <Sparkles className="text-blue-500 w-full h-full drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
  </div>
);

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_active_user'));
  const [toast, setToast] = useState<{message: string, type: 'info' | 'success' | 'error'} | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>(() => JSON.parse(localStorage.getItem('mr_vibe_notif_history') || '[]'));
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('mr_vibe_active_user') || 'null'));
  const [tempProfile, setTempProfile] = useState<Partial<User>>({ userName: '', gender: 'Secret', avatarUrl: AVATARS[0], personalityId: PersonalityId.STUDENT, apiKey: '' });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mr_vibe_settings');
    if (saved) return JSON.parse(saved);
    return { language: "English", theme: "dark", personalityId: PersonalityId.STUDENT, voiceName: "Zephyr", speakingRate: 1.0, speakingPitch: 1.0, customCommands: [] };
  });
  
  const [sessions, setSessions] = useState<ChatSession[]>(() => JSON.parse(localStorage.getItem('mr_vibe_sessions') || '[]'));
  const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('mr_vibe_active_session_id'));
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isVoiceModeSelectOpen, setIsVoiceModeSelectOpen] = useState(false);
  const [isNotifHistoryOpen, setIsNotifHistoryOpen] = useState(false);
  const [isPinnedViewOpen, setIsPinnedViewOpen] = useState(false);

  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<{data: string, name: string, type: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{text: string, isModel: boolean}[]>([]);
  const [isAiSpeakingGlobal, setIsAiSpeakingGlobal] = useState(false);
  const [selectedVoiceMode, setSelectedVoiceMode] = useState<'note' | 'chat'>('chat');
  const [avatarAnimation, setAvatarAnimation] = useState<OrbAnimationState>('idle');
  
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentApiKey = user?.apiKey || process.env.API_KEY || '';
  const currentPersonality = PERSONALITIES[settings.personalityId];
  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const pinnedMessages = useMemo(() => messages.filter(m => m.isPinned), [messages]);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    const newNotif: Notification = { id: Date.now().toString(), message, type, timestamp: Date.now() };
    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, 50);
      localStorage.setItem('mr_vibe_notif_history', JSON.stringify(updated));
      return updated;
    });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, liveTranscript, isLoading]);

  const handleNewChat = useCallback((autoGreet = true) => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { 
      id: newId, title: 'Session ' + (sessions.length + 1), messages: [], lastTimestamp: Date.now(), personalityId: settings.personalityId 
    };
    setSessions(prev => {
      const updated = [newSession, ...prev];
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    setActiveSessionId(newId);
    localStorage.setItem('mr_vibe_active_session_id', newId);
    setIsHistoryOpen(false);
    if (autoGreet) {
      setAvatarAnimation('hi');
      setTimeout(() => setAvatarAnimation('idle'), 1200);
      let greeting = "Hi! How are you?";
      if (selectedVoiceMode === 'note') {
        greeting = "Initialize strictly: Note Taker online. Awaiting data.";
      } else {
        switch(settings.personalityId) {
          case PersonalityId.TRADE:
            greeting = "Market's open. Risk managed. Mr. Cute is online. Ready for trade setups?";
            break;
          case PersonalityId.ROAST:
            greeting = "Oh, it's you again. Ready for your daily humbling? Say something.";
            break;
          case PersonalityId.RIZZ:
            greeting = "The main character has arrived. Mr. Cute is here to upgrade your charm. Who's the target?";
            break;
          case PersonalityId.STUDENT:
            greeting = "Study buddy online. Let's master something today. What's on the syllabus?";
            break;
          default:
            greeting = "Hi! Say hello as Mr. Cute and ask how I am!";
        }
      }
      setTimeout(() => handleSendToAI(greeting, true), 500);
    }
    return newId;
  }, [sessions.length, settings.personalityId, currentApiKey, selectedVoiceMode]);

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    if (activeSessionId === id) setActiveSessionId(null);
    showToast("Session purged.", "info");
  };

  const deleteSelectedSessions = () => {
    if (selectedSessionIds.size === 0) return;
    if (confirm(`Purge ${selectedSessionIds.size} session frequencies?`)) {
      setSessions(prev => {
        const updated = prev.filter(s => !selectedSessionIds.has(s.id));
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
      if (activeSessionId && selectedSessionIds.has(activeSessionId)) {
        setActiveSessionId(null);
      }
      setSelectedSessionIds(new Set());
      setIsSelectionMode(false);
      showToast("Selected frequencies purged.", "info");
    }
  };

  const clearAllHistory = () => {
    if (confirm("Wipe all neural memories?")) {
      setSessions([]);
      localStorage.setItem('mr_vibe_sessions', '[]');
      setActiveSessionId(null);
      showToast("Memory matrix cleared.", "error");
    }
  };

  const deleteMessage = (msgId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.filter(m => m.id !== msgId) } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    showToast("Frequencies deleted.", "info");
  };

  const detectCreation = (text: string) => {
    const keywords = ['plan', 'list', 'summary', 'recipe', 'code', 'guide', 'draft', 'steps', 'creation', 'test', 'exam', 'medical', 'risk', 'trade', 'analysis'];
    return keywords.some(k => text.toLowerCase().includes(k)) && text.length > 80;
  };

  const { connect: connectLive, disconnect: disconnectLive, isLive, isConnecting, volume, outputVolume } = useGeminiLive({
    apiKey: currentApiKey, personality: currentPersonality, settings, user: user as User, mode: selectedVoiceMode,
    onTranscript: (t, iM, isModel) => {
        setLiveTranscript(prev => [...prev, { text: t, isModel }]);
        if (isModel) setIsAiSpeakingGlobal(true);
    },
    onTurnComplete: (u, m) => { 
      setLiveTranscript([]); setIsAiSpeakingGlobal(false);
      const sId = activeSessionId || handleNewChat(false); 
      const isAutoPinned = selectedVoiceMode === 'note' && (m.length > 150 || detectCreation(m));
      
      setSessions(prev => {
        const updated = prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, 
          { id: `u-${Date.now()}`, role: 'user', text: u, timestamp: Date.now() }, 
          { id: `m-${Date.now() + 1}`, role: 'model', text: m, timestamp: Date.now() + 1, isNote: selectedVoiceMode === 'note', isPinned: isAutoPinned }
        ] } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      }); 
    },
    onConnectionStateChange: (c) => { if(!c) setLiveTranscript([]); },
    onCommand: (cmd, args) => {
      if (cmd === 'change_voice') {
        const found = GEMINI_VOICES.find(v => v.id.toLowerCase() === args.voice_id?.toLowerCase());
        if (found) { setSettings(prev => ({ ...prev, voiceName: found.id })); showToast(`Voice synced: ${found.name}`, "success"); }
      }
    },
    onError: (m) => showToast(m, "error")
  });

  async function handleSendToAI(text: string, isAutoGreet = false) {
    if ((!text.trim() && !selectedFile) || isLoading) return;
    if (!currentApiKey) { showToast("No license key detected.", "error"); return; }
    
    let sessionId = activeSessionId || handleNewChat(false);
    
    const contextHeader = pinnedMessages.length > 0 
      ? `\n[CORE ANCHORS - REMEMBER THESE]:\n${pinnedMessages.map(pm => `- ${pm.text}`).join('\n')}\n`
      : "";

    const userMessage: Message = { 
      id: `u-${Date.now()}`, 
      role: 'user', 
      text, 
      image: selectedFile?.type.startsWith('image/') ? selectedFile.data : undefined, 
      timestamp: Date.now() 
    };

    if (!isAutoGreet) setSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, userMessage], lastTimestamp: Date.now() } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    
    setIsLoading(true); setInputText('');
    if (text.includes('?') || text.length > 40) setAvatarAnimation('thoughtful');

    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const modePrompt = selectedVoiceMode === 'note' 
        ? "STRICT NOTE TAKER MODE: Answer questions, summarize data, or take notes ONLY. Do not chat. Be short. Always look for key points to highlight."
        : `BESTIE CHAT MODE: Stay strictly in your chosen neural archetype (${currentPersonality.name}). Be expressive and friendly.`;
        
      const contents: any[] = [{ text: `${BASE_SYSTEM_PROMPT}\n\n${modePrompt}\n\n${currentPersonality.prompt}${contextHeader}\n\nUser: ${text}` }];
      
      if (selectedFile) {
        contents.push({ inlineData: { data: selectedFile.data.split(',')[1], mimeType: selectedFile.type } });
      }

      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: { parts: contents },
        config: { tools: text.includes('?') || selectedFile?.type === 'application/pdf' ? [{ googleSearch: {} }] : undefined } 
      });

      let aiText = response.text || '...';
      
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks && Array.isArray(groundingChunks)) {
        const urls = groundingChunks
          .map((chunk: any) => chunk.web?.uri || chunk.maps?.uri)
          .filter(Boolean);
        
        if (urls.length > 0) {
          aiText += "\n\n**Sources:**\n" + Array.from(new Set(urls)).map(url => `- ${url}`).join('\n');
        }
      }

      const isAutoPinned = selectedVoiceMode === 'note' && (aiText.length > 150 || detectCreation(aiText));
      
      const aiMessage: Message = { 
        id: `ai-${Date.now()}`, role: 'model', text: aiText, timestamp: Date.now(), 
        isNote: selectedVoiceMode === 'note', isPinned: isAutoPinned 
      };
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
      setSelectedFile(null);
      setAvatarAnimation(/(great|good|yes|happy|hi|link)/i.test(aiText) ? 'excited' : 'idle');
      if (aiText.length > 0) setTimeout(() => setAvatarAnimation('idle'), 2000);
    } catch (e: any) { showToast("Link glitch.", "error"); setAvatarAnimation('idle'); } finally { setIsLoading(false); }
  }

  const togglePin = (msgId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === msgId ? { ...m, isPinned: !m.isPinned } : m) } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    showToast("Core Archive updated.", "success");
  };

  const saveEdit = (msgId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === msgId ? { ...m, text: editingText } : m) } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    setEditingMessageId(null);
    showToast("Note synced and saved.", "success");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard.", "success");
  };

  const shareMessage = (text: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'Mr. Vibe AI Message',
        text: text,
      }).catch(err => console.error('Error sharing:', err));
    } else {
      copyToClipboard(text);
      showToast("Sharing not supported, copied to clipboard instead.", "info");
    }
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('mr_vibe_settings', JSON.stringify(updated));
  };

  useEffect(() => {
    if (!user || sessions.length === 0) return;
    const interval = setInterval(() => {
      const allMsgs = sessions.flatMap(s => s.messages);
      const reminderKeys = [
        { key: 'test', ask: 'How was that test you mentioned earlier?' },
        { key: 'exam', ask: 'Did you finish that exam? How did it go?' },
        { key: 'doctor', ask: 'Hope your doctor appointment went well!' },
        { key: 'trip', ask: 'Excited for your trip! Any updates?' },
        { key: 'meeting', ask: 'How did the meeting go?' },
        { key: 'presentation', ask: 'I bet you crushed that presentation!' },
        { key: 'trade', ask: 'Checking the charts. Did you manage the risk on that position?' },
      ];

      const found = reminderKeys.find(rk => allMsgs.some(m => m.text.toLowerCase().includes(rk.key)));
      if (found) {
        const lastMsg = allMsgs.filter(m => m.text.toLowerCase().includes(found.key)).pop();
        if (lastMsg && Date.now() - lastMsg.timestamp > 300000 && Date.now() - lastMsg.timestamp < 86400000) {
           let msg = `Hey ${user.userName}! Mr. Cute here. ${found.ask} 💖`;
           if (settings.personalityId === PersonalityId.TRADE) {
             msg = `Trader! Mr. Cute checking in. Market's moving. ${found.ask} 📉`;
           }
           if (!notifications.some(n => n.message === msg)) {
             showToast(msg, "info");
           }
        }
      }
    }, 60000); 
    return () => clearInterval(interval);
  }, [user, sessions, notifications, settings.personalityId]);

  useEffect(() => {
    if (!isNewUser && user && sessions.length > 0) {
      setAvatarAnimation('hi');
      setTimeout(() => setAvatarAnimation('idle'), 1200);
      handleSendToAI(`Hi Mr. Cute! ${user.userName} is back. Give a quick greeting in your archetype.`, true);
    } else if (!isNewUser && sessions.length === 0) handleNewChat(true);
  }, []);

  if (isNewUser) {
    return (
      <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center p-6 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-lg bg-zinc-900 rounded-[2.5rem] p-10 text-center shadow-2xl animate-scale-in border border-white/5 my-auto">
           <Logo className="w-16 h-16 mx-auto mb-6" />
           <h1 className="text-2xl font-black mb-1 text-white uppercase tracking-tight">Mr. Vibe AI</h1>
           <p className="text-zinc-500 mb-8 font-bold text-[10px] uppercase tracking-widest leading-relaxed">Neural Interface Initialization</p>
           
           <div className="space-y-6 mb-8 text-left">
             <div className="space-y-1">
               <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest block pl-2">USER LABEL</label>
               <input 
                 type="text" placeholder="Your name..." 
                 value={tempProfile.userName} 
                 onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} 
                 className="w-full bg-white/5 rounded-2xl py-4 px-6 font-bold text-lg outline-none border-2 border-transparent focus:border-blue-500 transition-all text-white" 
               />
             </div>
             
             <div className="space-y-1">
               <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest block pl-2">LICENSE KEY (API KEY)</label>
               <div className="relative">
                 <input 
                   type="password" placeholder="AI-XXXXXXXXXXXX" 
                   value={tempProfile.apiKey} 
                   onChange={e => setTempProfile({...tempProfile, apiKey: e.target.value})} 
                   className="w-full bg-white/5 rounded-2xl py-4 px-6 font-bold text-lg outline-none border-2 border-transparent focus:border-blue-500 transition-all text-white" 
                 />
                 <Key size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500" />
               </div>
             </div>

             <div className="space-y-1">
               <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest block pl-2">SELECT NEURAL ARCHETYPE</label>
               <div className="grid grid-cols-2 gap-3">
                  {Object.values(PERSONALITIES).map((p) => (
                    <button 
                      key={p.id} 
                      onClick={() => setTempProfile({...tempProfile, personalityId: p.id})}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${tempProfile.personalityId === p.id ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-white/5 border-transparent opacity-60'}`}
                    >
                      <div className="text-xl mb-1">{p.emoji}</div>
                      <div className="font-black text-[10px] uppercase tracking-tighter text-white">{p.name}</div>
                      <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-1 line-clamp-1">{p.description}</div>
                    </button>
                  ))}
               </div>
             </div>
           </div>

           <button 
             onClick={() => { if(tempProfile.userName && tempProfile.apiKey) { 
               const newUser = { ...tempProfile, avatarUrl: AVATARS[0] } as User;
               setUser(newUser); 
               setSettings(s => ({ ...s, personalityId: tempProfile.personalityId! }));
               localStorage.setItem('mr_vibe_active_user', JSON.stringify(newUser)); 
               setIsNewUser(false); 
               handleNewChat(true); 
             } else { showToast("Label and License Key required.", "error"); } }} 
             className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
           >
             <Sparkles size={18}/> INITIALIZE VIBE
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-zinc-100 relative overflow-hidden ios-safe-top ios-safe-bottom">
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}

      <header className="h-14 px-4 flex items-center justify-between border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md z-50">
        <button onClick={() => setIsHistoryOpen(true)} className="p-2 hover:bg-white/5 rounded-xl"><Menu size={20} /></button>
        <div className="flex items-center gap-2">
          <Logo className="w-5 h-5" />
          <span className="font-black text-sm uppercase tracking-tighter italic">Mr. Vibe AI</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsPinnedViewOpen(true)} className={`p-2 rounded-xl relative transition-all ${pinnedMessages.length > 0 ? 'bg-blue-600 text-white' : 'text-zinc-500 bg-white/5'}`}>
            <Pin size={18}/>
            {pinnedMessages.length > 0 && <span className="absolute -top-1 -right-1 bg-white text-blue-600 text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-blue-600">{pinnedMessages.length}</span>}
          </button>
          <button onClick={() => setIsNotifHistoryOpen(true)} className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 relative">
            <Bell size={20} />
            {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
          </button>
          <button onClick={() => setIsProfileModalOpen(true)} className="w-8 h-8 rounded-full overflow-hidden border-2 border-blue-500/30">
            <img src={user?.avatarUrl} className="w-full h-full object-cover" alt="User" />
          </button>
        </div>
      </header>

      {/* History Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[1000] w-72 bg-zinc-900 transition-transform duration-300 transform ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl border-r border-white/5`}>
         <div className="flex flex-col h-full">
            <div className="p-6 flex items-center justify-between border-b border-white/5">
               <div className="flex flex-col">
                 <h2 className="font-black uppercase tracking-tight flex items-center gap-2 text-sm"><History size={16}/> Matrix Hub</h2>
                 {isSelectionMode && <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{selectedSessionIds.size} Selected</span>}
               </div>
               <div className="flex items-center gap-1">
                 <button 
                  onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedSessionIds(new Set()); }} 
                  className={`p-2 rounded-xl text-[10px] font-black uppercase transition-all ${isSelectionMode ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-500 hover:text-white'}`}
                 >
                   {isSelectionMode ? 'Cancel' : 'Select'}
                 </button>
                 <button onClick={() => setIsHistoryOpen(false)} className="p-2 bg-white/5 rounded-xl"><X size={16}/></button>
               </div>
            </div>
            
            {!isSelectionMode && (
              <div className="p-4 space-y-2">
                <button onClick={() => handleNewChat(true)} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-lg uppercase tracking-widest"><Plus size={16}/> NEW SESSION</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 custom-scrollbar">
               {sessions.map(s => {
                 const isSelected = selectedSessionIds.has(s.id);
                 return (
                   <div 
                    key={s.id} 
                    onClick={() => { 
                      if (isSelectionMode) {
                        setSelectedSessionIds(prev => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        });
                      } else {
                        setActiveSessionId(s.id); 
                        setIsHistoryOpen(false); 
                      }
                    }} 
                    className={`group w-full p-4 rounded-2xl text-left border-2 transition-all cursor-pointer relative ${
                      activeSessionId === s.id && !isSelectionMode ? 'bg-blue-600/10 border-blue-600/50' : 
                      isSelected && isSelectionMode ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.1)]' :
                      'bg-transparent border-transparent hover:bg-white/5'
                    }`}
                   >
                      <div className="flex items-center gap-3">
                        {isSelectionMode && (
                          <div className={`transition-all ${isSelected ? 'text-blue-500' : 'text-zinc-700'}`}>
                            {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-black text-xs uppercase truncate pr-6">{s.title}</div>
                          <div className="text-[8px] text-zinc-600 font-bold mt-1 uppercase italic tracking-widest">{new Date(s.lastTimestamp).toLocaleDateString()}</div>
                        </div>
                      </div>
                      
                      {!isSelectionMode && (
                        <button onClick={(e) => deleteSession(s.id, e)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-rose-500 transition-all"><Trash2 size={14}/></button>
                      )}
                   </div>
                 );
               })}
            </div>

            <div className="p-4 border-t border-white/5 bg-zinc-900/50 backdrop-blur-xl">
               {isSelectionMode ? (
                 <button 
                  onClick={deleteSelectedSessions} 
                  disabled={selectedSessionIds.size === 0}
                  className={`w-full py-4 rounded-xl font-black flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest transition-all ${selectedSessionIds.size > 0 ? 'bg-rose-600 text-white shadow-lg' : 'bg-white/5 text-zinc-700 cursor-not-allowed'}`}
                 >
                   <Trash2 size={14}/> Purge {selectedSessionIds.size} Selected
                 </button>
               ) : (
                 <button onClick={clearAllHistory} className="w-full py-3 bg-white/5 text-zinc-500 hover:text-rose-500 rounded-xl font-bold flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest transition-all"><Eraser size={14}/> Wipe All Memories</button>
               )}
            </div>
         </div>
      </div>

      {/* Main Chat Area */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar space-y-8">
        {selectedVoiceMode === 'note' && (
          <div className="max-w-lg mx-auto flex flex-col gap-3 animate-fade-in mb-6">
            <div className="flex items-center justify-between bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl shadow-xl">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center ring-2 ring-amber-500/20"><StickyNote size={18} className="text-amber-500" /></div>
                 <div>
                   <div className="text-[10px] font-black uppercase text-amber-500 tracking-widest leading-none">Note Taker Hub</div>
                   <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter mt-1">Structured capture protocol.</div>
                 </div>
               </div>
               <button onClick={() => setIsPinnedViewOpen(true)} className="flex items-center gap-2 bg-amber-500/20 text-amber-500 px-3 py-1.5 rounded-xl hover:bg-amber-500/30 transition-all text-[8px] font-black uppercase tracking-widest border border-amber-500/10">
                 <Pin size={12} /> View Pins
               </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
               <button onClick={() => handleSendToAI("Summarize the main points discussed in this session so far in a bulleted list.")} className="flex items-center justify-center gap-2 bg-zinc-900 border border-white/5 p-3 rounded-xl hover:bg-zinc-800 transition-all group">
                  <FileText size={14} className="text-blue-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black uppercase text-zinc-400">Gen Summary</span>
               </button>
               <button onClick={() => handleSendToAI("Review the session and suggest 3 study questions based on the key facts.")} className="flex items-center justify-center gap-2 bg-zinc-900 border border-white/5 p-3 rounded-xl hover:bg-zinc-800 transition-all group">
                  <Search size={14} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black uppercase text-zinc-400">Key Review</span>
               </button>
            </div>
          </div>
        )}

        {settings.personalityId === PersonalityId.TRADE && selectedVoiceMode !== 'note' && (
          <div className="flex flex-col gap-4 max-w-lg mx-auto animate-fade-in mb-4">
            <div className="grid grid-cols-2 gap-2">
               <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <span className="text-[9px] font-black uppercase text-emerald-500">Market Ideas</span>
               </div>
               <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-center gap-2">
                  <Brain size={14} className="text-blue-500" />
                  <span className="text-[9px] font-black uppercase text-blue-500">Psychology</span>
               </div>
               <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl flex items-center gap-2">
                  <ShieldAlert size={14} className="text-rose-500" />
                  <span className="text-[9px] font-black uppercase text-rose-500">Risk Manager</span>
               </div>
               <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center gap-2">
                  <Info size={14} className="text-amber-500" />
                  <span className="text-[9px] font-black uppercase text-amber-500">Explanations</span>
               </div>
            </div>
            
            {/* Interactive Trade Actions */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              <button 
                onClick={() => handleSendToAI("Give me a fresh trade setup for BTC/USD. Include Entry, Stop-Loss, Targets, and Risk/Reward.")}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 bg-blue-600/10 border border-blue-500/20 rounded-xl hover:bg-blue-600/20 transition-all text-[10px] font-black uppercase tracking-widest text-blue-400"
              >
                <BarChart3 size={14} /> Request Setup
              </button>
              <button 
                onClick={() => handleSendToAI("I need a psychological check. I'm feeling FOMO or revenge trading. Help me reset.")}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 bg-rose-600/10 border border-rose-500/20 rounded-xl hover:bg-rose-600/20 transition-all text-[10px] font-black uppercase tracking-widest text-rose-400"
              >
                <ShieldAlert size={14} /> Psychology Sync
              </button>
              <button 
                onClick={() => handleSendToAI("How should I manage my risk if my total capital is $1000 and I want to lose no more than $10 per trade?")}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 bg-amber-600/10 border border-amber-500/20 rounded-xl hover:bg-amber-600/20 transition-all text-[10px] font-black uppercase tracking-widest text-amber-400"
              >
                <Calculator size={14} /> Risk Protocol
              </button>
              <button 
                onClick={() => handleSendToAI("Search for the latest news on Ethereum and provide a market sentiment analysis.")}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 bg-emerald-600/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-600/20 transition-all text-[10px] font-black uppercase tracking-widest text-emerald-400"
              >
                <Zap size={14} /> Market News
              </button>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-30">
            <VibeOrb active={false} isThinking={false} volume={0} outputVolume={0} animationState={avatarAnimation} />
            <div><h3 className="text-lg font-black uppercase tracking-tight">Vibe Matrix Ready</h3><p className="text-[9px] font-black uppercase tracking-widest mt-1">Initialize link to start sync...</p></div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-vibe-in group`}>
              {msg.image && <img src={msg.image} className="max-w-[160px] rounded-2xl border-2 border-white/5 mb-2" alt="Visual" />}
              <div className={`relative px-5 py-4 rounded-3xl shadow-sm text-sm font-semibold leading-relaxed max-w-[85%] transition-all ${
                msg.role === 'user' ? 'bg-zinc-800 text-white rounded-br-none' : 
                `bg-transparent text-zinc-100 border-none rounded-bl-none ${msg.isPinned ? 'ring-2 ring-blue-500/50 bg-blue-500/5' : ''}`
              }`}>
                {msg.isPinned && <div className="absolute -top-3 -left-3 bg-blue-600 text-white p-2 rounded-full shadow-2xl border-2 border-zinc-900 animate-scale-in"><Pin size={12}/></div>}
                
                {editingMessageId === msg.id ? (
                  <div className="space-y-3 min-w-[280px] p-1">
                    <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Edit3 size={10}/> Manual Override Active</div>
                    <textarea 
                      value={editingText} 
                      onChange={e => setEditingText(e.target.value)} 
                      className="w-full bg-white/5 p-4 rounded-2xl outline-none border-2 border-blue-500/20 text-white font-medium text-xs leading-relaxed focus:border-blue-500/60 transition-all custom-scrollbar" 
                      rows={8}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingMessageId(null)} className="px-5 py-2.5 text-zinc-500 text-[10px] font-black uppercase hover:text-white transition-colors">Discard</button>
                      <button onClick={() => saveEdit(msg.id)} className="px-6 py-2.5 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase flex items-center gap-2 hover:bg-blue-700 shadow-xl transition-all active:scale-95"><Save size={14}/> Save Note</button>
                    </div>
                  </div>
                ) : (
                  <MarkdownText text={msg.text} />
                )}
              </div>
              
              {!editingMessageId && (
                <div className="flex items-center gap-1 mt-2 px-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => togglePin(msg.id)} className={`p-2 flex items-center gap-1.5 rounded-xl transition-all border ${msg.isPinned ? 'text-blue-400 bg-blue-400/10 border-blue-400/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'text-zinc-600 hover:text-blue-300 border-transparent hover:bg-white/5'}`}>
                    <Pin size={14}/>
                    <span className="text-[8px] font-black uppercase">{msg.isPinned ? 'Anchored' : 'Anchor'}</span>
                  </button>
                  {selectedVoiceMode === 'note' && msg.role === 'model' && (
                    <button onClick={() => { setEditingMessageId(msg.id); setEditingText(msg.text); }} className="p-2 flex items-center gap-1.5 text-zinc-600 hover:text-amber-400 border border-transparent hover:border-amber-400/20 hover:bg-amber-400/10 rounded-xl transition-all">
                      <Edit3 size={14}/>
                      <span className="text-[8px] font-black uppercase">Edit</span>
                    </button>
                  )}
                  <div className="w-px h-3 bg-white/5 mx-1" />
                  <button onClick={() => deleteMessage(msg.id)} className="p-2 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"><Trash2 size={14}/></button>
                  <button onClick={() => copyToClipboard(msg.text)} className="p-2 text-zinc-600 hover:text-white hover:bg-white/5 rounded-xl transition-all"><Copy size={14}/></button>
                  <button onClick={() => shareMessage(msg.text)} className="p-2 text-zinc-600 hover:text-white hover:bg-white/5 rounded-xl transition-all"><Share2 size={14}/></button>
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && <div className="flex justify-start gap-4 items-center pl-4"><div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center animate-thoughtful-wobble ring-1 ring-blue-500/20"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" /></div></div>}
      </main>

      {/* Input / Voice Trigger */}
      <footer className="p-4 bg-gradient-to-t from-black to-transparent z-40">
        {selectedFile && (
          <div className="max-w-3xl mx-auto mb-2 flex items-center gap-3 p-2.5 bg-white/5 rounded-2xl border border-white/10 animate-fade-in backdrop-blur-xl">
             {selectedFile.type.startsWith('image/') ? (
               <img src={selectedFile.data} className="w-10 h-10 rounded-xl object-cover" />
             ) : (
               <div className="w-10 h-10 bg-rose-600/20 rounded-xl flex items-center justify-center"><FileText className="text-rose-500" size={20} /></div>
             )}
             <div className="flex-1 text-[10px] font-black uppercase truncate text-zinc-300">{selectedFile.name}</div>
             <button onClick={() => setSelectedFile(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-zinc-500 hover:text-white"><X size={14} /></button>
          </div>
        )}
        <div className="max-w-3xl mx-auto flex items-center gap-2 p-1.5 bg-zinc-900/90 border border-white/10 rounded-[2.5rem] shadow-3xl backdrop-blur-3xl focus-within:border-blue-500/50 transition-all">
          <button onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-all"><ImageIcon size={20}/></button>
          <input type="file" ref={fileInputRef} onChange={(e) => {
             const file = e.target.files?.[0];
             if (file) {
               const reader = new FileReader();
               reader.onloadend = () => setSelectedFile({ data: reader.result as string, name: file.name, type: file.type });
               reader.readAsDataURL(file);
             }
          }} className="hidden" accept="image/*,.pdf" />
          <input type="text" placeholder={selectedVoiceMode === 'note' ? "Sync a note or summary point..." : "Sync vibe with Mr. Cute..."} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} className="flex-1 bg-transparent py-3 px-1 font-bold text-sm outline-none placeholder-zinc-700 text-white" />
          <div className="flex items-center gap-1 pr-1">
             <button onClick={() => setIsVoiceModeSelectOpen(true)} className={`p-3 rounded-full transition-all ${isLive ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] animate-hi-pulse' : 'bg-white/5 text-zinc-500 hover:text-blue-400'}`}><Mic size={20}/></button>
             <button onClick={() => handleSendToAI(inputText)} className={`p-3 rounded-full transition-all ${inputText.trim() || selectedFile ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-zinc-700'}`} disabled={!inputText.trim() && !selectedFile}><Send size={20}/></button>
          </div>
        </div>
      </footer>

      {/* Mode Selection Overlay */}
      {isVoiceModeSelectOpen && (
        <div className="fixed inset-0 z-[8000] flex items-end justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsVoiceModeSelectOpen(false)} />
          <div className="relative w-full max-w-sm bg-zinc-900 rounded-[3rem] p-8 space-y-6 animate-slide-up border border-white/10 shadow-3xl">
             <div className="flex flex-col items-center gap-1 mb-2">
               <div className="w-12 h-1.5 bg-white/10 rounded-full mb-4" />
               <h3 className="text-xl font-black uppercase tracking-tight text-center italic text-white">Neural Protocol</h3>
               <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Select sync frequency</p>
             </div>
             <div className="grid grid-cols-1 gap-4">
                <button onClick={() => { setSelectedVoiceMode('chat'); connectLive(); setIsVoiceModeSelectOpen(false); }} className={`p-6 rounded-3xl flex items-center justify-between group transition-all border-2 ${selectedVoiceMode === 'chat' ? 'bg-blue-600/10 border-blue-600 text-white shadow-[0_0_25px_rgba(59,130,246,0.2)]' : 'bg-white/5 text-zinc-500 border-transparent hover:bg-white/10'}`}>
                   <div className="text-left"><div className="font-black text-lg group-hover:text-white transition-colors">BESTIE SYNC</div><div className="text-[9px] opacity-70 uppercase tracking-widest font-bold mt-1">Full expressive neural archetypes</div></div>
                   <Mic size={28} className={selectedVoiceMode === 'chat' ? 'text-blue-400' : ''} />
                </button>
                <button onClick={() => { setSelectedVoiceMode('note'); connectLive(); setIsVoiceModeSelectOpen(false); }} className={`p-6 rounded-3xl flex items-center justify-between group transition-all border-2 ${selectedVoiceMode === 'note' ? 'bg-amber-600/10 border-amber-600 text-white shadow-[0_0_25px_rgba(245,158,11,0.2)]' : 'bg-white/5 text-zinc-500 border-transparent hover:bg-white/10'}`}>
                   <div className="text-left"><div className="font-black text-lg group-hover:text-white transition-colors">NOTE SYNC</div><div className="text-[9px] opacity-70 uppercase tracking-widest font-bold mt-1">Functional capture & distillation</div></div>
                   <StickyNote size={28} className={selectedVoiceMode === 'note' ? 'text-amber-400' : ''} />
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Live Sync View */}
      {(isLive || isConnecting) && (
        <div className="fixed inset-0 z-[7000] bg-black flex flex-col items-center justify-between p-10 animate-fade-in backdrop-blur-3xl bg-black/90">
          <button onClick={disconnectLive} className="self-end p-4 bg-white/5 rounded-full text-white/50 hover:text-white transition-all hover:bg-white/10 hover:scale-110"><X size={24}/></button>
          
          <div className="absolute top-10 left-10 flex items-center gap-3 animate-fade-in">
             <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2">
                <VolumeX size={16} className="text-emerald-500" />
                <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.1em]">Noise Suppression Active</span>
             </div>
          </div>

          <div className="flex flex-col items-center gap-8">
            <VibeOrb active={isLive} isThinking={isConnecting} isAiSpeaking={isAiSpeakingGlobal} volume={volume} outputVolume={outputVolume} animationState={avatarAnimation} />
            <div className="text-center space-y-4 w-full max-w-md">
              <div className="flex items-center justify-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`} />
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">{isConnecting ? "Initiating Frequency..." : "Live Link Active"}</h2>
              </div>
              <div className="bg-white/5 backdrop-blur-3xl p-8 rounded-[2.5rem] min-h-[160px] flex items-center justify-center border border-white/10 shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30" />
                 <p className="font-bold text-blue-400 italic text-xl leading-relaxed text-center drop-shadow-[0_0_10px_rgba(59,130,246,0.2)]">{liveTranscript.length > 0 ? liveTranscript.slice(-1)[0].text : 'Awaiting signal...'}</p>
              </div>
              <div className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Archiving spoken frequency to session matrix...</div>
            </div>
          </div>
          <button onClick={disconnectLive} className="px-14 py-6 bg-rose-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] flex items-center gap-3 shadow-[0_0_30px_rgba(225,29,72,0.4)] hover:bg-rose-700 active:scale-95 transition-all mb-10"><MicOff size={20}/> Terminate Frequency</button>
        </div>
      )}

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" onClick={() => setIsProfileModalOpen(false)} />
           <div className="relative w-full max-w-lg bg-zinc-900 rounded-[3rem] p-10 space-y-10 animate-scale-in border border-white/10 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <h2 className="text-2xl font-black uppercase tracking-tighter italic text-white flex items-center gap-3"><UserIcon size={24} className="text-blue-500" /> Identity Matrix</h2>
                <button onClick={() => setIsProfileModalOpen(false)} className="p-2.5 bg-white/5 rounded-2xl hover:bg-white/10 transition-all"><X size={20}/></button>
              </div>
              <div className="flex flex-col items-center gap-8">
                 <div className="relative group w-36 h-36 rounded-[3rem] overflow-hidden border-4 border-blue-600/40 shadow-2xl transition-all hover:scale-105 hover:border-blue-500">
                    <img src={user?.avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"><Edit3 size={24} className="text-white" /></div>
                 </div>
                 <div className="w-full space-y-6">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] pl-2">User Frequency</label>
                      <input type="text" value={user?.userName} onChange={e => {
                        const updated = { ...user!, userName: e.target.value };
                        setUser(updated); localStorage.setItem('mr_vibe_active_user', JSON.stringify(updated));
                      }} className="text-3xl font-black text-center bg-white/5 rounded-3xl py-4 outline-none border-2 border-transparent focus:border-blue-600 transition-all uppercase w-full shadow-inner" />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] pl-2">Neural Key</label>
                      <div className="relative">
                        <input type="password" value={user?.apiKey} placeholder="License Key" onChange={e => {
                          const updated = { ...user!, apiKey: e.target.value };
                          setUser(updated); localStorage.setItem('mr_vibe_active_user', JSON.stringify(updated));
                        }} className="w-full bg-white/5 rounded-3xl py-4 px-12 font-bold text-center outline-none border-2 border-transparent focus:border-blue-500 transition-all text-white text-sm shadow-inner" />
                        <Key size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" />
                      </div>
                    </div>
                 </div>
              </div>

              {/* Neural Archetype Section */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 pl-2"><Sparkles size={14} className="text-amber-500" /> Neural Archetype</h3>
                <div className="grid grid-cols-2 gap-4">
                    {Object.values(PERSONALITIES).map((p) => (
                      <button key={p.id} onClick={() => { updateSettings({ personalityId: p.id }); showToast(`${p.name} personality online.`, "success"); }} className={`p-5 rounded-[2rem] text-left border-2 transition-all group ${settings.personalityId === p.id ? 'bg-blue-600/15 border-blue-600 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'bg-white/5 border-transparent text-zinc-500 hover:bg-white/10 hover:border-white/5'}`}>
                        <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">{p.emoji}</div>
                        <div className="font-black text-[10px] uppercase tracking-widest">{p.name}</div>
                        <div className="text-[8px] font-bold opacity-50 mt-1 uppercase tracking-tighter truncate">{p.description}</div>
                      </button>
                    ))}
                </div>
              </div>

              <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-5 bg-rose-600/10 text-rose-500 hover:bg-rose-600/20 rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] transition-all border border-rose-500/20 shadow-xl">Purge User Matrix</button>
           </div>
        </div>
      )}
      
      {/* Pinned Insights Drawer */}
      {isPinnedViewOpen && (
        <div className="fixed inset-0 z-[8500] flex justify-end">
           <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsPinnedViewOpen(false)} />
           <div className="relative w-full max-w-sm bg-[#0a0a0a] h-full shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-slide-in-right flex flex-col border-l border-white/10">
              <div className="p-8 border-b border-white/10 flex items-center justify-between bg-zinc-900/40 backdrop-blur-2xl">
                 <div className="flex flex-col gap-1">
                   <h3 className="text-base font-black uppercase tracking-tighter flex items-center gap-2 italic text-white"><Pin size={20} className="text-blue-500" /> Core Archive</h3>
                   <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em]">Neural Anchor Points</span>
                 </div>
                 <button onClick={() => setIsPinnedViewOpen(false)} className="p-3 hover:bg-white/5 rounded-2xl transition-all"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-black/60">
                 {pinnedMessages.length === 0 ? (
                   <div className="text-center py-32 opacity-20 italic space-y-6">
                     <div className="relative mx-auto w-24 h-24">
                       <Pin size={64} className="mx-auto text-zinc-600 absolute inset-0 m-auto" />
                       <div className="w-full h-full border-2 border-dashed border-zinc-700 rounded-full animate-spin-slow" />
                     </div>
                     <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">No nodes archived.</div>
                   </div>
                 ) : (
                   pinnedMessages.map(pm => (
                     <div key={pm.id} className="p-6 bg-zinc-900/80 border border-white/5 rounded-[2rem] relative group hover:border-blue-500/40 transition-all shadow-2xl backdrop-blur-xl">
                        <div className="flex items-center justify-between mb-4">
                           <div className="bg-blue-600/20 text-blue-500 text-[8px] font-black uppercase px-2 py-1 rounded-lg border border-blue-500/20 flex items-center gap-1"><Pin size={8}/> Anchored</div>
                           <button onClick={() => togglePin(pm.id)} className="p-2 text-zinc-600 hover:text-rose-500 transition-colors bg-white/5 rounded-xl"><Trash2 size={12}/></button>
                        </div>
                        <div className="text-zinc-200 leading-relaxed text-[13px] font-medium"><MarkdownText text={pm.text} /></div>
                        <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center opacity-40">
                           <span className="text-[8px] font-black uppercase tracking-widest">{new Date(pm.timestamp).toLocaleDateString()}</span>
                           <button onClick={() => copyToClipboard(pm.text)} className="hover:text-white transition-colors"><Copy size={12}/></button>
                        </div>
                     </div>
                   ))
                 )}
              </div>
              <div className="p-6 border-t border-white/10 bg-zinc-900/30">
                 <button 
                   onClick={() => { copyToClipboard(pinnedMessages.map(p => p.text).join('\n\n---\n\n')); showToast("Full Archive copied.", "success"); }}
                   disabled={pinnedMessages.length === 0}
                   className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl disabled:opacity-20 transition-all active:scale-95"
                 >
                   Export Core Archive
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Pulse Feed Modal */}
      {isNotifHistoryOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-lg" onClick={() => setIsNotifHistoryOpen(false)} />
          <div className="relative w-full max-w-md bg-zinc-900 rounded-[3rem] p-10 space-y-8 animate-scale-in border border-white/10 max-h-[70vh] flex flex-col shadow-3xl">
             <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-black uppercase tracking-tighter italic text-white flex items-center gap-2"><Bell size={20} className="text-blue-500" /> Pulse Matrix</h3>
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em]">Sync History</span>
                </div>
                <button onClick={() => setIsNotifHistoryOpen(false)} className="p-2.5 bg-white/5 rounded-2xl transition-all"><X size={20}/></button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar py-2">
                {notifications.length === 0 ? <div className="text-center py-24 opacity-10 text-[10px] font-black uppercase tracking-[0.3em]">Matrix silent.</div> : 
                  notifications.map(n => (
                    <div key={n.id} className="p-5 bg-white/5 rounded-3xl space-y-2 hover:bg-white/10 transition-all border border-transparent hover:border-blue-500/30 group">
                       <div className="flex items-center gap-2 mb-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${n.type === 'error' ? 'bg-rose-500' : n.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                          <div className="text-xs font-bold leading-snug text-zinc-200 group-hover:text-white transition-colors">{n.message}</div>
                       </div>
                       <div className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em]">{new Date(n.timestamp).toLocaleString()}</div>
                    </div>
                  ))
                }
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
