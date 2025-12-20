
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Volume2, CheckCircle2, Sparkles, MicOff, ImageIcon, Globe,
  Edit3, History, LogOut, Clock, MessageSquare, StickyNote,
  UserCheck, Palette, Bell, Eraser, Info, ExternalLink, Activity,
  ChevronDown, MoreHorizontal, User as UserIcon, Copy, Share2, Heart, ThumbsUp, Pin, BookOpen, Key, Save
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
      <div className="flex-1 font-bold text-sm leading-snug">{message}</div>
      <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-all"><X size={16} /></button>
    </div>
  </div>
);

// --- Markdown Component ---
const MarkdownText = ({ text }: { text: string }) => {
  const renderLine = (line: string, key: number) => {
    const parts = line.split(/(\*\*.*?\*\*|`.*?`|https?:\/\/[^\s]+)/g);
    return (
      <p key={key} className="mb-1.5 last:mb-0">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) return <strong key={idx} className="font-extrabold text-white">{part.slice(2, -2)}</strong>;
          if (part.startsWith('`') && part.endsWith('`')) return <code key={idx} className="bg-white/10 px-1 py-0.5 rounded font-mono text-sm">{part.slice(1, -1)}</code>;
          if (part.startsWith('http')) return <a key={idx} href={part} target="_blank" className="text-blue-400 underline">{part}</a>;
          return part;
        })}
      </p>
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
  const [tempProfile, setTempProfile] = useState<Partial<User>>({ userName: '', gender: 'Secret', avatarUrl: AVATARS[0], personalityId: PersonalityId.NORMAL, apiKey: '' });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mr_vibe_settings');
    if (saved) return JSON.parse(saved);
    return { language: "English", theme: "dark", personalityId: PersonalityId.NORMAL, voiceName: "Zephyr", speakingRate: 1.0, speakingPitch: 1.0, customCommands: [] };
  });
  
  const [sessions, setSessions] = useState<ChatSession[]>(() => JSON.parse(localStorage.getItem('mr_vibe_sessions') || '[]'));
  const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('mr_vibe_active_session_id'));
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isVoiceModeSelectOpen, setIsVoiceModeSelectOpen] = useState(false);
  const [isNotifHistoryOpen, setIsNotifHistoryOpen] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);

  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
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
  const journalNotes = useMemo(() => messages.filter(m => m.isNote), [messages]);

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
      setTimeout(() => handleSendToAI("Hi! Introduce yourself shortly as Mr. Cute and ask how my day is going.", true), 500);
    }
    return newId;
  }, [sessions.length, settings.personalityId, currentApiKey]);

  const { connect: connectLive, disconnect: disconnectLive, isLive, isConnecting, volume, outputVolume } = useGeminiLive({
    apiKey: currentApiKey, personality: currentPersonality, settings, user: user as User, mode: selectedVoiceMode,
    onTranscript: (t, iM, isModel) => {
        setLiveTranscript(prev => [...prev, { text: t, isModel }]);
        if (isModel) setIsAiSpeakingGlobal(true);
    },
    onTurnComplete: (u, m) => { 
      setLiveTranscript([]); setIsAiSpeakingGlobal(false);
      const sId = activeSessionId || handleNewChat(false); 
      const isQuestion = u.includes('?');
      // Logic for automatic pinning: if text is long or looks like a summary/list
      const isAutoPinned = selectedVoiceMode === 'note' && (m.length > 100 || m.includes('1.') || m.includes('•'));
      
      setSessions(prev => {
        const updated = prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, 
          { id: `u-${Date.now()}`, role: 'user', text: u, timestamp: Date.now() }, 
          { id: `m-${Date.now() + 1}`, role: 'model', text: m, timestamp: Date.now() + 1, isNote: selectedVoiceMode === 'note', isPinned: isQuestion || isAutoPinned }
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
    if ((!text.trim() && !selectedImage) || isLoading) return;
    if (!currentApiKey) { showToast("No license key detected.", "error"); return; }
    
    let sessionId = activeSessionId || handleNewChat(false);
    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', text, image: selectedImage || undefined, timestamp: Date.now() };
    if (!isAutoGreet) setSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, userMessage], lastTimestamp: Date.now() } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    setIsLoading(true); setInputText(''); setSelectedImage(null);
    if (text.includes('?') || text.length > 50) setAvatarAnimation('thoughtful');

    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const contents: any[] = [{ text: `${BASE_SYSTEM_PROMPT}\n\n${currentPersonality.prompt}\n\nUser: ${text}` }];
      if (userMessage.image) contents.push({ inlineData: { data: userMessage.image.split(',')[1], mimeType: 'image/jpeg' } });
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', contents: { parts: contents },
        config: { tools: text.includes('?') ? [{ googleSearch: {} }] : undefined } 
      });
      const aiText = response.text || 'Thinking...';
      const isAutoPinned = selectedVoiceMode === 'note' && (aiText.length > 100 || aiText.includes('1.') || aiText.includes('•'));
      
      const aiMessage: Message = { 
        id: `ai-${Date.now()}`, role: 'model', text: aiText, timestamp: Date.now(), 
        isNote: selectedVoiceMode === 'note', isPinned: text.includes('?') || isAutoPinned 
      };
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s);
        localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
        return updated;
      });
      if (/(great|good|awesome|yes|perfect|happy|hi|hello|link)/i.test(aiText)) {
        setAvatarAnimation('excited');
        setTimeout(() => setAvatarAnimation('idle'), 2000);
      } else setAvatarAnimation('idle');
    } catch (e: any) { showToast("Vibe link glitched.", "error"); setAvatarAnimation('idle'); } finally { setIsLoading(false); }
  }

  const toggleReaction = (msgId: string, type: ReactionType) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === msgId ? { ...m, reaction: m.reaction === type ? null : type } : m) } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
  };

  const togglePin = (msgId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === msgId ? { ...m, isPinned: !m.isPinned } : m) } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    showToast("Matrix pinning updated", "success");
  };

  const saveEdit = (msgId: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === msgId ? { ...m, text: editingText } : m) } : s);
      localStorage.setItem('mr_vibe_sessions', JSON.stringify(updated));
      return updated;
    });
    setEditingMessageId(null);
    showToast("Insight updated", "success");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to frequency matrix!", "success");
  };

  const shareMessage = async (text: string) => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Mr. Cute Insight', text }); } catch(e) {}
    } else copyToClipboard(text);
  };

  // Proactive Reminders / Follow-ups logic
  useEffect(() => {
    if (!user || sessions.length === 0) return;
    const checkTimer = setTimeout(() => {
      const allMsgs = sessions.flatMap(s => s.messages);
      const keywords = ['test', 'exam', 'exam', 'work', 'project', 'trip', 'dinner', 'pdf', 'summary', 'doctor', 'meeting'];
      const foundKeyword = keywords.find(k => allMsgs.some(m => m.text.toLowerCase().includes(k)));
      
      if (foundKeyword) {
        const lastMention = allMsgs.filter(m => m.text.toLowerCase().includes(foundKeyword)).pop();
        if (lastMention && Date.now() - lastMention.timestamp > 30000) { // If mentioned > 30s ago
          showToast(`Hey ${user.userName}! How did that "${foundKeyword}" go? Mr. Cute wants to know!`, "info");
        }
      }
    }, 20000); // 20s initial delay
    return () => clearTimeout(checkTimer);
  }, [user, sessions.length]);

  useEffect(() => {
    if (!isNewUser && user && sessions.length > 0) {
      setAvatarAnimation('hi');
      setTimeout(() => setAvatarAnimation('idle'), 1200);
      handleSendToAI(`Hey Mr. Cute! ${user.userName} is back. Give me a quick upbeat welcome.`, true);
    } else if (!isNewUser && sessions.length === 0) handleNewChat(true);
  }, []);

  useEffect(() => { localStorage.setItem('mr_vibe_settings', JSON.stringify(settings)); }, [settings]);

  if (isNewUser) {
    return (
      <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-sm bg-zinc-900 rounded-[2.5rem] p-10 text-center shadow-2xl animate-scale-in border border-white/5 my-auto">
           <Logo className="w-20 h-20 mx-auto mb-8" />
           <h1 className="text-3xl font-black mb-2 text-white uppercase tracking-tight">Mr. Vibe AI</h1>
           <p className="text-zinc-500 mb-8 font-bold text-sm uppercase">Enter Identity & License</p>
           
           <div className="space-y-4 mb-8">
             <div className="space-y-1">
               <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest text-left block pl-2">USER LABEL</label>
               <input 
                 type="text" placeholder="Your name..." 
                 value={tempProfile.userName} 
                 onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} 
                 className="w-full bg-white/5 rounded-2xl py-4 px-6 font-bold text-lg text-center outline-none border-2 border-transparent focus:border-blue-500 transition-all text-white" 
               />
             </div>
             
             <div className="space-y-1">
               <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest text-left block pl-2">LICENSE KEY (GEMINI API KEY)</label>
               <div className="relative">
                 <input 
                   type="password" placeholder="AI-XXXXXXXXXXXX" 
                   value={tempProfile.apiKey} 
                   onChange={e => setTempProfile({...tempProfile, apiKey: e.target.value})} 
                   className="w-full bg-white/5 rounded-2xl py-4 px-6 font-bold text-lg text-center outline-none border-2 border-transparent focus:border-blue-500 transition-all text-white" 
                 />
                 <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
               </div>
             </div>

             <div className="space-y-1">
               <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest text-left block pl-2">GENDER FREQUENCY</label>
               <select 
                 value={tempProfile.gender}
                 onChange={e => setTempProfile({...tempProfile, gender: e.target.value as any})}
                 className="w-full bg-white/5 rounded-2xl py-4 px-6 font-bold text-lg text-center outline-none border-2 border-transparent focus:border-blue-500 transition-all text-white appearance-none cursor-pointer"
               >
                 <option value="Male" className="bg-zinc-900">Male</option>
                 <option value="Female" className="bg-zinc-900">Female</option>
                 <option value="Other" className="bg-zinc-900">Other</option>
                 <option value="Secret" className="bg-zinc-900">Secret</option>
               </select>
             </div>
           </div>

           <button 
             onClick={() => { if(tempProfile.userName && tempProfile.apiKey) { 
               const newUser = { ...tempProfile, avatarUrl: AVATARS[0], personalityId: PersonalityId.NORMAL } as User;
               setUser(newUser); 
               localStorage.setItem('mr_vibe_active_user', JSON.stringify(newUser)); 
               setIsNewUser(false); 
               handleNewChat(true); 
             } else { showToast("Name and License Key required.", "error"); } }} 
             className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
           >
             <Sparkles size={20}/> SYNC WITH MR. CUTE
           </button>
           <p className="mt-4 text-[9px] text-zinc-600 leading-relaxed">By syncing, you agree to connect your consciousness with Mr. Cute's neural network.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-zinc-100 relative overflow-hidden ios-safe-top ios-safe-bottom">
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}

      <header className="h-14 px-4 flex items-center justify-between border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md z-50">
        <button onClick={() => setIsHistoryOpen(true)} className="p-2 hover:bg-white/5 rounded-xl"><Menu size={22} /></button>
        <div className="flex items-center gap-2">
          <Logo className="w-6 h-6" />
          <span className="font-black text-sm uppercase tracking-tighter italic">Mr. Vibe</span>
        </div>
        <div className="flex items-center gap-2">
          {journalNotes.length > 0 && (
            <button onClick={() => setIsJournalOpen(true)} className="p-2 text-amber-500 bg-amber-500/10 rounded-xl relative">
              <BookOpen size={18}/>
              <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            </button>
          )}
          <button onClick={() => setIsNotifHistoryOpen(true)} className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 relative">
            <Bell size={20} />
            {notifications.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />}
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
               <h2 className="font-black uppercase tracking-tight flex items-center gap-2"><History size={18}/> History</h2>
               <button onClick={() => setIsHistoryOpen(false)} className="p-2 bg-white/5 rounded-xl"><X size={18}/></button>
            </div>
            <div className="p-4"><button onClick={() => handleNewChat(true)} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-lg"><Plus size={18}/> NEW CHAT</button></div>
            <div className="flex-1 overflow-y-auto px-4 space-y-2 custom-scrollbar">
               {sessions.map(s => (
                 <button key={s.id} onClick={() => { setActiveSessionId(s.id); setIsHistoryOpen(false); }} className={`w-full p-4 rounded-2xl text-left border-2 transition-all ${activeSessionId === s.id ? 'bg-blue-600/10 border-blue-600/50' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                    <div className="font-black text-xs uppercase truncate">{s.title}</div>
                    <div className="text-[10px] text-zinc-500 font-bold mt-1 uppercase italic">{new Date(s.lastTimestamp).toLocaleDateString()}</div>
                 </button>
               ))}
            </div>
         </div>
      </div>

      {/* Main Chat Area */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar space-y-8">
        {pinnedMessages.length > 0 && (
          <div className="bg-blue-600/5 border border-blue-600/20 rounded-3xl p-4 space-y-3 animate-slide-up">
             <div className="text-[10px] font-black uppercase text-blue-400 flex items-center gap-2 mb-2"><Pin size={12}/> Pinned Core Insights</div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {pinnedMessages.map(pm => (
                 <div key={pm.id} className="text-xs bg-white/5 p-3 rounded-2xl relative group">
                    <button onClick={() => togglePin(pm.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                    <div className="text-zinc-100 leading-relaxed line-clamp-3">{pm.text}</div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-30">
            <VibeOrb active={false} isThinking={false} volume={0} outputVolume={0} animationState={avatarAnimation} />
            <div><h3 className="text-xl font-black uppercase tracking-tight">Sync Established</h3><p className="text-xs font-bold uppercase tracking-widest mt-1">Awaiting Consciousness...</p></div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-vibe-in group`}>
              {msg.image && <img src={msg.image} className="max-w-[200px] rounded-2xl border-4 border-white/5 mb-1" alt="Visual" />}
              <div className={`relative px-4 py-3 rounded-2xl shadow-sm text-sm font-semibold leading-relaxed max-w-[85%] ${msg.role === 'user' ? 'bg-zinc-800 text-white rounded-br-none' : 'bg-transparent text-zinc-100 border-none rounded-bl-none'}`}>
                {msg.isPinned && <div className="absolute -top-3 left-0 bg-blue-600 text-white p-1 rounded-full"><Pin size={10}/></div>}
                
                {editingMessageId === msg.id ? (
                  <div className="space-y-2 min-w-[200px]">
                    <textarea 
                      value={editingText} 
                      onChange={e => setEditingText(e.target.value)} 
                      className="w-full bg-white/10 p-2 rounded-xl outline-none border border-white/20 text-white" 
                      rows={4}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingMessageId(null)} className="p-2 text-zinc-400"><X size={14}/></button>
                      <button onClick={() => saveEdit(msg.id)} className="p-2 text-blue-500"><Save size={14}/></button>
                    </div>
                  </div>
                ) : (
                  <MarkdownText text={msg.text} />
                )}
                
                {msg.reaction && <div className="absolute -bottom-3 right-0 bg-zinc-900 border border-white/10 rounded-full px-1.5 py-0.5 text-xs">{msg.reaction}</div>}
              </div>
              
              {!editingMessageId && (
                <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => toggleReaction(msg.id, '👍')} className="p-1.5 text-zinc-500 hover:text-blue-400 transition-all"><ThumbsUp size={14}/></button>
                  <button onClick={() => togglePin(msg.id)} className={`p-1.5 transition-all ${msg.isPinned ? 'text-blue-500' : 'text-zinc-500 hover:text-blue-300'}`}><Pin size={14}/></button>
                  {selectedVoiceMode === 'note' && msg.role === 'model' && (
                    <button onClick={() => { setEditingMessageId(msg.id); setEditingText(msg.text); }} className="p-1.5 text-zinc-500 hover:text-amber-400 transition-all"><Edit3 size={14}/></button>
                  )}
                  <button onClick={() => copyToClipboard(msg.text)} className="p-1.5 text-zinc-500 hover:text-white transition-all"><Copy size={14}/></button>
                  <button onClick={() => shareMessage(msg.text)} className="p-1.5 text-zinc-500 hover:text-white transition-all"><Share2 size={14}/></button>
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && <div className="flex justify-start gap-4 items-center"><div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center animate-thoughtful-wobble"><div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" /></div></div>}
      </main>

      {/* Input / Voice Trigger */}
      <footer className="p-4 bg-gradient-to-t from-black to-transparent">
        <div className="max-w-3xl mx-auto flex items-center gap-2 p-1.5 bg-zinc-900 border border-white/5 rounded-[2rem] shadow-2xl">
          <button onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-500 hover:text-white"><ImageIcon size={22}/></button>
          <input type="file" ref={fileInputRef} onChange={(e) => {
             const file = e.target.files?.[0];
             if (file) {
               const reader = new FileReader();
               reader.onloadend = () => setSelectedImage(reader.result as string);
               reader.readAsDataURL(file);
             }
          }} className="hidden" accept="image/*" />
          <input type="text" placeholder={selectedVoiceMode === 'note' ? "Record an insight..." : "Sync your vibe..."} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} className="flex-1 bg-transparent py-3 px-1 font-bold text-sm outline-none placeholder-zinc-600" />
          <div className="flex items-center gap-1 pr-1">
             <button onClick={() => setIsVoiceModeSelectOpen(true)} className="p-3 bg-white/5 text-zinc-400 rounded-full hover:text-blue-400"><Mic size={20}/></button>
             <button onClick={() => handleSendToAI(inputText)} className={`p-3 rounded-full transition-all ${inputText.trim() ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-600'}`} disabled={!inputText.trim() && !selectedImage}><Send size={20}/></button>
          </div>
        </div>
      </footer>

      {/* Mode Selection */}
      {isVoiceModeSelectOpen && (
        <div className="fixed inset-0 z-[8000] flex items-end justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsVoiceModeSelectOpen(false)} />
          <div className="relative w-full max-w-sm bg-zinc-900 rounded-[3rem] p-8 space-y-6 animate-slide-up border border-white/5">
             <h3 className="text-xl font-black uppercase tracking-tight text-center">Neural Link Mode</h3>
             <div className="grid grid-cols-1 gap-4">
                <button onClick={() => { setSelectedVoiceMode('chat'); connectLive(); setIsVoiceModeSelectOpen(false); }} className={`p-6 rounded-3xl flex items-center justify-between group transition-all ${selectedVoiceMode === 'chat' ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-400 border border-white/10'}`}>
                   <div className="text-left"><div className="font-black text-lg">VOICE CHAT</div><div className="text-[10px] opacity-70">Emotional bestie link.</div></div>
                   <Mic size={28}/>
                </button>
                <button onClick={() => { setSelectedVoiceMode('note'); connectLive(); setIsVoiceModeSelectOpen(false); }} className={`p-6 rounded-3xl flex items-center justify-between group transition-all ${selectedVoiceMode === 'note' ? 'bg-amber-600 text-white' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                   <div className="text-left"><div className="font-black text-lg">NOTE TAKER</div><div className="text-[10px] opacity-70">Utility & Archive mode.</div></div>
                   <StickyNote size={28}/>
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Notification History Modal */}
      {isNotifHistoryOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsNotifHistoryOpen(false)} />
          <div className="relative w-full max-w-md bg-zinc-900 rounded-[3rem] p-8 space-y-6 animate-scale-in border border-white/5 max-h-[70vh] flex flex-col">
             <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <h3 className="text-xl font-black uppercase tracking-tight">Matrix Pulse Feed</h3>
                <button onClick={() => setIsNotifHistoryOpen(false)} className="p-2 bg-white/5 rounded-xl"><X size={20}/></button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar py-4">
                {notifications.length === 0 ? <div className="text-center py-10 opacity-30 text-xs font-black">Feed is clear.</div> : 
                  notifications.map(n => (
                    <div key={n.id} className="p-4 bg-white/5 rounded-2xl space-y-1 hover:bg-white/10 transition-all cursor-pointer">
                       <div className="text-xs font-bold leading-snug">{n.message}</div>
                       <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{new Date(n.timestamp).toLocaleString()}</div>
                    </div>
                  ))
                }
             </div>
             {notifications.length > 0 && (
               <button onClick={() => { setNotifications([]); localStorage.removeItem('mr_vibe_notif_history'); showToast("Pulse feed purged.", "info"); }} className="text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-all text-center pb-2 flex items-center justify-center gap-2"><Eraser size={12}/> Clear Matrix History</button>
             )}
          </div>
        </div>
      )}

      {/* Journal View */}
      {isJournalOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" onClick={() => setIsJournalOpen(false)} />
           <div className="relative w-full max-w-2xl bg-white text-zinc-900 rounded-[2rem] p-10 shadow-3xl animate-scale-in max-h-[85vh] overflow-y-auto flex flex-col font-serif">
              <div className="flex items-center justify-between border-b-2 border-zinc-100 pb-6 mb-8">
                 <div className="space-y-1">
                   <h2 className="text-3xl font-black italic tracking-tighter uppercase font-sans">Memory Archive</h2>
                   <div className="text-[10px] uppercase font-black tracking-widest text-zinc-400 font-sans">Compiled by Mr. Cute AI</div>
                 </div>
                 <button onClick={() => setIsJournalOpen(false)} className="p-3 bg-zinc-100 rounded-full hover:bg-zinc-200 text-zinc-400 font-sans"><X size={20}/></button>
              </div>
              <div className="flex-1 space-y-8 leading-relaxed text-lg">
                 {journalNotes.length === 0 ? <div className="text-center py-20 font-sans opacity-20 italic">No nodes archived yet.</div> : 
                   journalNotes.map((note, idx) => (
                     <div key={note.id} className="space-y-2 border-l-4 border-amber-500/20 pl-6">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans">Node {idx + 1} • {new Date(note.timestamp).toLocaleDateString()}</div>
                        <div className="text-zinc-800">{note.text}</div>
                     </div>
                   ))
                 }
              </div>
           </div>
        </div>
      )}

      {/* Identity Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsProfileModalOpen(false)} />
           <div className="relative w-full max-w-lg bg-zinc-900 rounded-[3rem] p-8 space-y-10 animate-scale-in border border-white/5 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between"><h2 className="text-2xl font-black uppercase tracking-tight italic">Identity Matrix</h2><button onClick={() => setIsProfileModalOpen(false)} className="p-2 bg-white/5 rounded-xl"><X size={20}/></button></div>
              <div className="flex flex-col items-center gap-6">
                 <div className="relative group w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-blue-600/50 shadow-2xl transition-transform hover:scale-110">
                    <img src={user?.avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Edit3 size={24}/></div>
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
                      }} className="w-full bg-white/5 rounded-2xl py-3 px-10 font-bold text-center outline-none border-2 border-transparent focus:border-blue-500 transition-all text-white" />
                      <Key size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    </div>

                    <select 
                      value={user?.gender}
                      onChange={e => {
                        const updated = { ...user!, gender: e.target.value as any };
                        setUser(updated); localStorage.setItem('mr_vibe_active_user', JSON.stringify(updated));
                      }}
                      className="w-full bg-white/5 rounded-2xl py-3 px-6 font-bold text-center outline-none border-2 border-transparent focus:border-blue-500 transition-all text-white appearance-none cursor-pointer"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Secret">Secret</option>
                    </select>
                 </div>
              </div>

              <div className="space-y-6">
                 <div>
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">Choose Neural Shell</h3>
                    <div className="grid grid-cols-5 gap-3">
                       {AVATARS.map(av => (
                         <button key={av} onClick={() => {
                           const updated = { ...user!, avatarUrl: av };
                           setUser(updated); localStorage.setItem('mr_vibe_active_user', JSON.stringify(updated));
                           showToast("Identity shell updated!", "success");
                         }} className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${user?.avatarUrl === av ? 'border-blue-600 ring-4 ring-blue-600/10' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                            <img src={av} className="w-full h-full" alt="av" />
                         </button>
                       ))}
                    </div>
                 </div>

                 <div>
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">Consciousness Archetype</h3>
                    <div className="grid grid-cols-2 gap-3">
                       {Object.values(PERSONALITIES).map((p: Personality) => (
                         <button key={p.id} onClick={() => { setSettings(s => ({ ...s, personalityId: p.id })); showToast(`${p.name} online!`, "success"); }} className={`p-4 rounded-2xl text-left border-2 transition-all ${settings.personalityId === p.id ? 'bg-blue-600/10 border-blue-600/50 text-blue-400' : 'bg-white/5 border-transparent text-zinc-400'}`}>
                            <div className="text-xl mb-1">{p.emoji}</div>
                            <div className="font-black text-[10px] uppercase">{p.name}</div>
                         </button>
                       ))}
                    </div>
                 </div>
              </div>

              <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-4 bg-rose-600/10 text-rose-500 rounded-2xl font-black uppercase text-xs tracking-widest">Wipe Neural Memory & Reset</button>
           </div>
        </div>
      )}
      
      {/* Live Sync View */}
      {(isLive || isConnecting) && (
        <div className="fixed inset-0 z-[7000] bg-black flex flex-col items-center justify-between p-10 animate-fade-in">
          <button onClick={disconnectLive} className="self-end p-4 bg-white/5 rounded-full"><X size={28}/></button>
          <VibeOrb active={isLive} isThinking={isConnecting} isAiSpeaking={isAiSpeakingGlobal} volume={volume} outputVolume={outputVolume} animationState={avatarAnimation} />
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black uppercase italic tracking-tighter">{isConnecting ? "Initiating Pulse..." : "Sync Active"}</h2>
            <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl min-h-[100px] flex items-center justify-center max-w-sm border border-white/5 shadow-2xl">
               <p className="font-bold text-blue-400 italic text-lg leading-relaxed">{liveTranscript.length > 0 ? liveTranscript.slice(-1)[0].text : 'Awaiting consciousness streams...'}</p>
            </div>
          </div>
          <button onClick={disconnectLive} className="px-12 py-5 bg-rose-600 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center gap-2 shadow-xl hover:bg-rose-700 transition-all"><MicOff size={20}/> Sever Neural Link</button>
        </div>
      )}
    </div>
  );
}
