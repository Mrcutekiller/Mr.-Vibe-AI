
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Volume2, CheckCircle2, Sparkles, MicOff, ImageIcon, Globe,
  Edit3, History, LogOut, Clock, MessageSquare, StickyNote,
  UserCheck, Palette, Bell, Eraser, Info, ExternalLink, Activity,
  ChevronDown, MoreHorizontal, User as UserIcon, Copy, Share2, Heart, ThumbsUp, Pin, BookOpen, Key, Save, ListFilter,
  Check, AlertTriangle, FileText, File, TrendingUp, Brain, ShieldAlert,
  Headphones, BarChart3, Calculator, Zap
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
        ? "STRICT NOTE TAKER MODE: Answer questions, summarize data, or take notes ONLY. Do not chat. Be short."
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
    showToast("Note synced.", "success");
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
               <h2 className="font-black uppercase tracking-tight flex items-center gap-2 text-sm"><History size={16}/> Matrix Hub</h2>
               <button onClick={() => setIsHistoryOpen(false)} className="p-2 bg-white/5 rounded-xl"><X size={16}/></button>
            </div>
            <div className="p-4 space-y-2">
              <button onClick={() => handleNewChat(true)} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-lg uppercase tracking-widest"><Plus size={16}/> NEW SESSION</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
               {sessions.map(s => (
                 <div key={s.id} onClick={() => { setActiveSessionId(s.id); setIsHistoryOpen(false); }} className={`group w-full p-4 rounded-2xl text-left border-2 transition-all cursor-pointer relative ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-600/50' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                    <div className="font-black text-xs uppercase truncate pr-6">{s.title}</div>
                    <div className="text-[8px] text-zinc-600 font-bold mt-1 uppercase italic tracking-widest">{new Date(s.lastTimestamp).toLocaleDateString()}</div>
                    <button onClick={(e) => deleteSession(s.id, e)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-rose-500 transition-all"><Trash2 size={14}/></button>
                 </div>
               ))}
            </div>
            <div className="p-4 border-t border-white/5">
               <button onClick={clearAllHistory} className="w-full py-3 bg-white/5 text-zinc-500 hover:text-rose-500 rounded-xl font-bold flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest transition-all"><Eraser size={14}/> Wipe Memories</button>
            </div>
         </div>
      </div>

      {/* Main Chat Area */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar space-y-8">
        {selectedVoiceMode === 'note' && (
          <div className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/10 p-3 rounded-2xl animate-fade-in mx-auto max-w-lg">
             <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center"><StickyNote size={14} className="text-amber-500" /></div>
             <div>
               <div className="text-[10px] font-black uppercase text-amber-500 tracking-widest leading-none">Note Taker Protocol</div>
               <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">strictly functional. pins & summaries only.</div>
             </div>
          </div>
        )}

        {settings.personalityId === PersonalityId.TRADE && (
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
                onClick={() => handleSendToAI("Give me a fresh trade setup for BTC/USD with risk/reward analysis.")}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 bg-blue-600/10 border border-blue-500/20 rounded-xl hover:bg-blue-600/20 transition-all text-[10px] font-black uppercase tracking-widest text-blue-400"
              >
                <BarChart3 size={14} /> Trade BTC
              </button>
              <button 
                onClick={() => handleSendToAI("I'm feeling FOMO about a recent pump. Give me some discipline advice and a risk check.")}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 bg-rose-600/10 border border-rose-500/20 rounded-xl hover:bg-rose-600/20 transition-all text-[10px] font-black uppercase tracking-widest text-rose-400"
              >
                <ShieldAlert size={14} /> Psychology Check
              </button>
              <button 
                onClick={() => handleSendToAI("Explain position sizing for a $1000 account with 1% risk per trade.")}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 bg-amber-600/10 border border-amber-500/20 rounded-xl hover:bg-amber-600/20 transition-all text-[10px] font-black uppercase tracking-widest text-amber-400"
              >
                <Calculator size={14} /> Risk Calc
              </button>
              <button 
                onClick={() => handleSendToAI("What's the current overall market sentiment? Use Google Search.")}
                className="whitespace-nowrap flex items-center gap-2 px-4 py-2.5 bg-emerald-600/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-600/20 transition-all text-[10px] font-black uppercase tracking-widest text-emerald-400"
              >
                <Zap size={14} /> Market Pulse
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
              <div className={`relative px-4 py-3 rounded-2xl shadow-sm text-sm font-semibold leading-relaxed max-w-[85%] transition-all ${
                msg.role === 'user' ? 'bg-zinc-800 text-white rounded-br-none' : 
                `bg-transparent text-zinc-100 border-none rounded-bl-none ${msg.isPinned ? 'ring-1 ring-blue-500/30 bg-blue-500/5' : ''}`
              }`}>
                {msg.isPinned && <div className="absolute -top-3 left-0 bg-blue-600 text-white p-1 rounded-full shadow-lg"><Pin size={10}/></div>}
                
                {editingMessageId === msg.id ? (
                  <div className="space-y-3 min-w-[260px] p-1">
                    <textarea 
                      value={editingText} 
                      onChange={e => setEditingText(e.target.value)} 
                      className="w-full bg-white/5 p-3 rounded-xl outline-none border border-white/10 text-white font-medium text-xs leading-relaxed focus:border-blue-500/50 transition-all" 
                      rows={6}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingMessageId(null)} className="px-4 py-2 text-zinc-500 text-[10px] font-black uppercase hover:text-white">Discard</button>
                      <button onClick={() => saveEdit(msg.id)} className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase flex items-center gap-1.5 hover:bg-blue-700 transition-all"><Check size={12}/> Sync Edit</button>
                    </div>
                  </div>
                ) : (
                  <MarkdownText text={msg.text} />
                )}
              </div>
              
              {!editingMessageId && (
                <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => togglePin(msg.id)} className={`p-2 flex items-center gap-1.5 rounded-lg transition-all ${msg.isPinned ? 'text-blue-400 bg-blue-400/10' : 'text-zinc-600 hover:text-blue-300'}`}>
                    <Pin size={14}/>
                    <span className="text-[8px] font-black uppercase">{msg.isPinned ? 'Pinned' : 'Pin'}</span>
                  </button>
                  {selectedVoiceMode === 'note' && msg.role === 'model' && (
                    <button onClick={() => { setEditingMessageId(msg.id); setEditingText(msg.text); }} className="p-2 flex items-center gap-1.5 text-zinc-600 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-all">
                      <Edit3 size={14}/>
                      <span className="text-[8px] font-black uppercase">Edit</span>
                    </button>
                  )}
                  <button onClick={() => deleteMessage(msg.id)} className="p-2 text-zinc-600 hover:text-rose-500 transition-all"><Trash2 size={14}/></button>
                  <button onClick={() => copyToClipboard(msg.text)} className="p-2 text-zinc-600 hover:text-white transition-all"><Copy size={14}/></button>
                  <button onClick={() => shareMessage(msg.text)} className="p-2 text-zinc-600 hover:text-white transition-all"><Share2 size={14}/></button>
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && <div className="flex justify-start gap-4 items-center"><div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center animate-thoughtful-wobble"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" /></div></div>}
      </main>

      {/* Input / Voice Trigger */}
      <footer className="p-4 bg-gradient-to-t from-black to-transparent">
        {selectedFile && (
          <div className="max-w-3xl mx-auto mb-2 flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/10 animate-fade-in">
             {selectedFile.type.startsWith('image/') ? (
               <img src={selectedFile.data} className="w-10 h-10 rounded-lg object-cover" />
             ) : (
               <div className="w-10 h-10 bg-rose-600/20 rounded-lg flex items-center justify-center"><FileText className="text-rose-500" size={20} /></div>
             )}
             <div className="flex-1 text-[10px] font-black uppercase truncate">{selectedFile.name}</div>
             <button onClick={() => setSelectedFile(null)} className="p-1.5 hover:bg-white/10 rounded-full"><X size={14} /></button>
          </div>
        )}
        <div className="max-w-3xl mx-auto flex items-center gap-2 p-1.5 bg-zinc-900 border border-white/5 rounded-[2rem] shadow-2xl">
          <button onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-500 hover:text-white"><ImageIcon size={20}/></button>
          <input type="file" ref={fileInputRef} onChange={(e) => {
             const file = e.target.files?.[0];
             if (file) {
               const reader = new FileReader();
               reader.onloadend = () => setSelectedFile({ data: reader.result as string, name: file.name, type: file.type });
               reader.readAsDataURL(file);
             }
          }} className="hidden" accept="image/*,.pdf" />
          <input type="text" placeholder={selectedVoiceMode === 'note' ? "Strict: note or summarize..." : "Speak or type to sync vibe..."} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} className="flex-1 bg-transparent py-3 px-1 font-bold text-sm outline-none placeholder-zinc-700" />
          <div className="flex items-center gap-1 pr-1">
             <button onClick={() => setIsVoiceModeSelectOpen(true)} className={`p-3 rounded-full transition-all ${isLive ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-white/5 text-zinc-500 hover:text-blue-400'}`}><Mic size={20}/></button>
             <button onClick={() => handleSendToAI(inputText)} className={`p-3 rounded-full transition-all ${inputText.trim() || selectedFile ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-700'}`} disabled={!inputText.trim() && !selectedFile}><Send size={20}/></button>
          </div>
        </div>
      </footer>

      {/* Mode Selection Overlay */}
      {isVoiceModeSelectOpen && (
        <div className="fixed inset-0 z-[8000] flex items-end justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsVoiceModeSelectOpen(false)} />
          <div className="relative w-full max-w-sm bg-zinc-900 rounded-[3rem] p-8 space-y-6 animate-slide-up border border-white/5">
             <h3 className="text-xl font-black uppercase tracking-tight text-center italic">Link Protocol</h3>
             <div className="grid grid-cols-1 gap-4">
                <button onClick={() => { setSelectedVoiceMode('chat'); connectLive(); setIsVoiceModeSelectOpen(false); }} className={`p-6 rounded-3xl flex items-center justify-between group transition-all ${selectedVoiceMode === 'chat' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-white/5 text-zinc-500 border border-white/5 hover:bg-white/10'}`}>
                   <div className="text-left"><div className="font-black text-lg">BESTIE SYNC</div><div className="text-[9px] opacity-70 uppercase tracking-widest font-bold mt-1">Chat in your chosen archetype</div></div>
                   <Mic size={28}/>
                </button>
                <button onClick={() => { setSelectedVoiceMode('note'); connectLive(); setIsVoiceModeSelectOpen(false); }} className={`p-6 rounded-3xl flex items-center justify-between group transition-all ${selectedVoiceMode === 'note' ? 'bg-amber-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20'}`}>
                   <div className="text-left"><div className="font-black text-lg">NOTE SYNC</div><div className="text-[9px] opacity-70 uppercase tracking-widest font-bold mt-1">Strict functional mode.</div></div>
                   <StickyNote size={28}/>
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Live Sync View */}
      {(isLive || isConnecting) && (
        <div className="fixed inset-0 z-[7000] bg-black flex flex-col items-center justify-between p-10 animate-fade-in">
          <button onClick={disconnectLive} className="self-end p-4 bg-white/5 rounded-full text-white/50 hover:text-white transition-colors"><X size={24}/></button>
          <VibeOrb active={isLive} isThinking={isConnecting} isAiSpeaking={isAiSpeakingGlobal} volume={volume} outputVolume={outputVolume} animationState={avatarAnimation} />
          <div className="text-center space-y-6 w-full max-w-md">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white/80">{isConnecting ? "Initiating Frequency..." : "Live Link Active"}</h2>
            <div className="bg-white/5 backdrop-blur-3xl p-6 rounded-3xl min-h-[140px] flex items-center justify-center border border-white/5 shadow-3xl">
               <p className="font-bold text-blue-400 italic text-lg leading-relaxed">{liveTranscript.length > 0 ? liveTranscript.slice(-1)[0].text : 'Streaming data...'}</p>
            </div>
          </div>
          <button onClick={disconnectLive} className="px-12 py-5 bg-rose-600/90 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-2xl hover:bg-rose-600 active:scale-95 transition-all"><MicOff size={18}/> Terminate Link</button>
        </div>
      )}

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsProfileModalOpen(false)} />
           <div className="relative w-full max-w-lg bg-zinc-900 rounded-[3rem] p-8 space-y-10 animate-scale-in border border-white/5 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between"><h2 className="text-xl font-black uppercase tracking-tight italic">Identity Matrix</h2><button onClick={() => setIsProfileModalOpen(false)} className="p-2 bg-white/5 rounded-xl"><X size={18}/></button></div>
              <div className="flex flex-col items-center gap-6">
                 <div className="relative group w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-blue-600/50 shadow-2xl transition-transform hover:scale-110">
                    <img src={user?.avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                 </div>
                 <div className="w-full space-y-4">
                    <input type="text" value={user?.userName} onChange={e => {
                      const updated = { ...user!, userName: e.target.value };
                      setUser(updated); localStorage.setItem('mr_vibe_active_user', JSON.stringify(updated));
                    }} className="text-3xl font-black text-center bg-transparent outline-none border-b-4 border-transparent focus:border-blue-600 transition-all uppercase w-full pb-2" />
                    
                    <div className="relative">
                      <input type="password" value={user?.apiKey} placeholder="License Key" onChange={e => {
                        const updated = { ...user!, apiKey: e.target.value };
                        setUser(updated); localStorage.setItem('mr_vibe_active_user', JSON.stringify(updated));
                      }} className="w-full bg-white/5 rounded-2xl py-3 px-10 font-bold text-center outline-none border-2 border-transparent focus:border-blue-500 transition-all text-white text-sm" />
                      <Key size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                    </div>
                 </div>
              </div>

              {/* Neural Archetype Section */}
              <div>
                <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-4 flex items-center gap-2"><Sparkles size={12}/> Neural Archetype</h3>
                <div className="grid grid-cols-2 gap-3">
                    {Object.values(PERSONALITIES).map((p) => (
                      <button key={p.id} onClick={() => { updateSettings({ personalityId: p.id }); showToast(`${p.name} online.`, "success"); }} className={`p-4 rounded-2xl text-left border-2 transition-all ${settings.personalityId === p.id ? 'bg-blue-600/10 border-blue-600/40 text-blue-400' : 'bg-white/5 border-transparent text-zinc-500 hover:bg-white/10'}`}>
                        <div className="text-lg mb-1">{p.emoji}</div>
                        <div className="font-black text-[9px] uppercase tracking-widest">{p.name}</div>
                      </button>
                    ))}
                </div>
              </div>

              {/* Voice Selection Section */}
              <div>
                <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-4 flex items-center gap-2"><Headphones size={12}/> Neural Vocalizer</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {GEMINI_VOICES.map((v) => (
                    <button 
                      key={v.id} 
                      onClick={() => { updateSettings({ voiceName: v.id }); showToast(`Vocal frequency: ${v.name}`, "success"); }}
                      className={`px-3 py-4 rounded-xl text-center border transition-all ${settings.voiceName === v.id ? 'bg-emerald-600/10 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/5 text-zinc-600 hover:text-zinc-400 hover:bg-white/10'}`}
                    >
                      <div className="font-black text-[10px] uppercase tracking-tighter">{v.name.split(' ')[0]}</div>
                      <div className="text-[8px] font-bold opacity-60 mt-1 uppercase truncate">{v.id}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-4 bg-rose-600/10 text-rose-500 hover:bg-rose-600/20 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all">Sever Neural Link</button>
           </div>
        </div>
      )}
      
      {/* Pinned Insights Drawer */}
      {isPinnedViewOpen && (
        <div className="fixed inset-0 z-[8500] flex justify-end">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPinnedViewOpen(false)} />
           <div className="relative w-full max-w-sm bg-[#111] h-full shadow-3xl animate-slide-in-right flex flex-col border-l border-white/5">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                 <div className="flex flex-col">
                   <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2"><Pin size={16} className="text-blue-500" /> Core Archive</h3>
                   <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Permanent data store</span>
                 </div>
                 <button onClick={() => setIsPinnedViewOpen(false)} className="p-2 hover:bg-white/5 rounded-xl"><X size={18}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gradient-to-b from-transparent to-black/40">
                 {pinnedMessages.length === 0 ? (
                   <div className="text-center py-24 opacity-10 italic space-y-4">
                     <Pin size={48} className="mx-auto text-zinc-600" />
                     <div className="text-[10px] font-black uppercase tracking-widest">No anchored nodes.</div>
                   </div>
                 ) : (
                   pinnedMessages.map(pm => (
                     <div key={pm.id} className="p-5 bg-zinc-900 border border-white/5 rounded-[1.5rem] relative group hover:border-blue-500/40 transition-all shadow-lg">
                        <button onClick={() => togglePin(pm.id)} className="absolute top-4 right-4 text-zinc-700 hover:text-rose-500 transition-colors"><Trash2 size={14}/></button>
                        <div className="text-zinc-100 leading-relaxed text-xs font-medium"><MarkdownText text={pm.text} /></div>
                     </div>
                   ))
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Pulse Feed Modal */}
      {isNotifHistoryOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsNotifHistoryOpen(false)} />
          <div className="relative w-full max-w-md bg-zinc-900 rounded-[2.5rem] p-8 space-y-6 animate-scale-in border border-white/5 max-h-[70vh] flex flex-col">
             <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex flex-col">
                  <h3 className="text-lg font-black uppercase tracking-tight italic">Pulse Matrix</h3>
                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Neural follow-ups</span>
                </div>
                <button onClick={() => setIsNotifHistoryOpen(false)} className="p-2 bg-white/5 rounded-xl"><X size={18}/></button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar py-2">
                {notifications.length === 0 ? <div className="text-center py-12 opacity-10 text-[10px] font-black uppercase">Matrix silent.</div> : 
                  notifications.map(n => (
                    <div key={n.id} className="p-4 bg-white/5 rounded-2xl space-y-1.5 hover:bg-white/10 transition-all border border-transparent hover:border-blue-500/20">
                       <div className="text-xs font-bold leading-snug">{n.message}</div>
                       <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">{new Date(n.timestamp).toLocaleString()}</div>
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
