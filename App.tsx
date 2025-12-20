
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Volume2, CheckCircle2, Sparkles, MicOff, ImageIcon, Globe,
  Edit3, History, LogOut, Clock, MessageSquare, StickyNote,
  UserCheck, Palette, Bell, Eraser, Info, ExternalLink, Activity,
  ChevronDown, MoreHorizontal, User as UserIcon
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES } from './constants';
import { PersonalityId, Personality, AppSettings, User, ChatSession, Message } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';

// --- Modern AI Orb Component ---

const VibeOrb = ({ active, isThinking, isAiSpeaking, volume, outputVolume }: { 
  active: boolean, 
  isThinking: boolean, 
  isAiSpeaking?: boolean,
  volume: number,
  outputVolume: number
}) => {
  const currentVol = isAiSpeaking ? outputVolume : volume;
  const scale = active ? 1 + currentVol * 1.5 : 1;
  
  return (
    <div className="relative flex items-center justify-center w-48 h-48 md:w-64 md:h-64">
      {/* Outer Glows */}
      <div className={`absolute inset-0 rounded-full bg-blue-500/10 blur-3xl transition-opacity duration-500 ${isThinking ? 'animate-pulse' : 'opacity-50'}`} />
      
      {/* Dynamic Core */}
      <div 
        className={`relative w-24 h-24 md:w-32 md:h-32 rounded-full transition-all duration-75 ease-out flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.5)] ${active ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-zinc-800'}`}
        style={{ transform: `scale(${scale})` }}
      >
        <div className={`w-full h-full rounded-full bg-white/10 ${active ? 'animate-orb-float' : ''}`} />
        <div className="absolute inset-2 rounded-full border border-white/20" />
      </div>

      {/* Thinking Rings */}
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
      <div className="p-2 rounded-xl bg-white/5">
        <Bell size={18} />
      </div>
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
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('mr_vibe_active_user') || 'null'));
  const [tempProfile, setTempProfile] = useState<Partial<User>>({ userName: '', avatarUrl: AVATARS[0], personalityId: PersonalityId.NORMAL });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mr_vibe_settings');
    if (saved) return JSON.parse(saved);
    return { language: "English", theme: "dark", personalityId: PersonalityId.NORMAL, voiceName: "Zephyr", speakingRate: 1.0, speakingPitch: 1.0, customCommands: [] };
  });
  
  const [sessions, setSessions] = useState<ChatSession[]>(() => JSON.parse(localStorage.getItem('mr_vibe_sessions') || '[]'));
  const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('mr_vibe_active_session_id'));
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{text: string, isModel: boolean}[]>([]);
  const [isAiSpeakingGlobal, setIsAiSpeakingGlobal] = useState(false);
  const [selectedVoiceMode, setSelectedVoiceMode] = useState<'note' | 'chat'>('chat');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentApiKey = process.env.API_KEY || '';
  const currentPersonality = PERSONALITIES[settings.personalityId];
  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, liveTranscript, isLoading]);

  const handleNewChat = useCallback((autoGreet = true) => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { 
      id: newId, 
      title: 'Session ' + (sessions.length + 1), 
      messages: [], 
      lastTimestamp: Date.now(), 
      personalityId: settings.personalityId 
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    localStorage.setItem('mr_vibe_active_session_id', newId);
    setIsHistoryOpen(false);
    
    if (autoGreet) {
      setTimeout(() => {
        handleSendToAI("Hi! Introduce yourself shortly and ask how my day is going.", true);
      }, 500);
    }
    return newId;
  }, [sessions.length, settings.personalityId]);

  const { connect: connectLive, disconnect: disconnectLive, isLive, isConnecting, volume, outputVolume } = useGeminiLive({
    apiKey: currentApiKey, personality: currentPersonality, settings, user: user as User, mode: selectedVoiceMode,
    onTranscript: (t, iM, isModel) => {
        setLiveTranscript(prev => [...prev, { text: t, isModel }]);
        if (isModel) setIsAiSpeakingGlobal(true);
    },
    onTurnComplete: (u, m) => { 
      setLiveTranscript([]); setIsAiSpeakingGlobal(false);
      const sId = activeSessionId || handleNewChat(false); 
      setSessions(prev => prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, { id: `u-${Date.now()}`, role: 'user', text: u, timestamp: Date.now() }, { id: `m-${Date.now() + 1}`, role: 'model', text: m, timestamp: Date.now() + 1 }] } : s)); 
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
    let sessionId = activeSessionId || handleNewChat(false);
    
    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', text, image: selectedImage || undefined, timestamp: Date.now() };
    if (!isAutoGreet) setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, userMessage], lastTimestamp: Date.now() } : s));
    
    setIsLoading(true); setInputText(''); setSelectedImage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const contents: any[] = [{ text: `${BASE_SYSTEM_PROMPT}\n\n${currentPersonality.prompt}\n\nUser: ${text}` }];
      if (userMessage.image) contents.push({ inlineData: { data: userMessage.image.split(',')[1], mimeType: 'image/jpeg' } });

      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', contents: { parts: contents },
        config: { tools: text.includes('?') ? [{ googleSearch: {} }] : undefined } 
      });

      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: response.text || 'Thinking...', timestamp: Date.now(), isNote: text.includes('?') };
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s));
    } catch (e: any) { showToast("Vibe link glitched. Retrying...", "error"); } finally { setIsLoading(false); }
  }

  // Proactive check-in notification logic
  useEffect(() => {
    if (!user || sessions.length === 0) return;
    const timer = setTimeout(() => {
      const lastSession = sessions[0];
      const lastMsg = lastSession.messages[lastSession.messages.length - 1];
      if (lastMsg && lastMsg.role === 'model') {
        const keywords = ['test', 'exam', 'work', 'project', 'plan', 'trip', 'dinner'];
        const found = keywords.find(k => lastSession.messages.some(m => m.text.toLowerCase().includes(k)));
        if (found) {
          showToast(`Hey ${user.userName}! Remembering your mention of "${found}"... How did that go?`, "info");
        }
      }
    }, 10000); // 10 seconds after load
    return () => clearTimeout(timer);
  }, [user, sessions.length]);

  useEffect(() => { localStorage.setItem('mr_vibe_settings', JSON.stringify(settings)); }, [settings]);

  if (isNewUser) {
    return (
      <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-zinc-900 rounded-[2.5rem] p-10 text-center shadow-2xl animate-scale-in border border-white/5">
           <Logo className="w-20 h-20 mx-auto mb-8" />
           <h1 className="text-3xl font-black mb-2 text-white uppercase tracking-tight">Mr. Vibe AI</h1>
           <p className="text-zinc-500 mb-10 font-bold text-sm">SET YOUR IDENTITY.</p>
           <input 
             type="text" placeholder="Your name..." 
             value={tempProfile.userName} 
             onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} 
             className="w-full bg-white/5 rounded-2xl py-4 px-6 font-bold text-lg text-center outline-none mb-8 border-2 border-transparent focus:border-blue-500 transition-all text-white" 
           />
           <button 
             onClick={() => { if(tempProfile.userName) { setUser(tempProfile as User); localStorage.setItem('mr_vibe_active_user', JSON.stringify(tempProfile)); setIsNewUser(false); handleNewChat(true); } }} 
             className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-blue-700 active:scale-95 transition-all"
           >
             ESTABLISH LINK
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0d0d] text-zinc-100 relative overflow-hidden ios-safe-top ios-safe-bottom">
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}

      {/* Modern Header */}
      <header className="h-14 px-4 flex items-center justify-between border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md z-50">
        <button onClick={() => setIsHistoryOpen(true)} className="p-2 hover:bg-white/5 rounded-xl"><Menu size={22} /></button>
        <div className="flex items-center gap-2">
          <Logo className="w-6 h-6" />
          <span className="font-black text-sm uppercase tracking-tighter italic">Mr. Vibe</span>
        </div>
        <button onClick={() => setIsProfileModalOpen(true)} className="w-8 h-8 rounded-full overflow-hidden border-2 border-blue-500/30">
          <img src={user?.avatarUrl} className="w-full h-full object-cover" alt="User" />
        </button>
      </header>

      {/* History Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-[1000] w-72 bg-zinc-900 transition-transform duration-300 transform ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl`}>
         <div className="flex flex-col h-full">
            <div className="p-6 flex items-center justify-between border-b border-white/5">
               <h2 className="font-black uppercase tracking-tight flex items-center gap-2"><History size={18}/> History</h2>
               <button onClick={() => setIsHistoryOpen(false)} className="p-2 bg-white/5 rounded-xl"><X size={18}/></button>
            </div>
            <div className="p-4">
               <button onClick={() => handleNewChat(true)} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-lg">
                  <Plus size={18}/> NEW CHAT
               </button>
            </div>
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

      {/* Chat Messages */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-30">
            <Logo className="w-16 h-16" />
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">Soul Link Idle</h3>
              <p className="text-xs font-bold uppercase tracking-widest mt-1">Upload context or type to sync.</p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-vibe-in`}>
              <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.image && <img src={msg.image} className="max-w-[200px] rounded-2xl border-4 border-white/5 mb-1" alt="Visual" />}
                <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm font-semibold leading-relaxed ${msg.role === 'user' ? 'bg-zinc-800 text-white rounded-br-none' : 'bg-transparent text-zinc-100 border-none rounded-bl-none'}`}>
                  <MarkdownText text={msg.text} />
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && <div className="flex justify-start"><div className="w-8 h-4 bg-white/5 rounded-full animate-pulse" /></div>}
        
        {/* Voice Mode Live Transcription */}
        {isLive && liveTranscript.length > 0 && (
          <div className="flex justify-center py-4">
             <div className="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-2xl text-xs font-bold italic animate-pulse">
                {liveTranscript.slice(-1)[0].text}
             </div>
          </div>
        )}
      </main>

      {/* Live Voice Screen */}
      {(isLive || isConnecting) && (
        <div className="fixed inset-0 z-[7000] bg-black flex flex-col items-center justify-between p-10 animate-fade-in">
          <button onClick={disconnectLive} className="self-end p-4 bg-white/5 rounded-full"><X size={28}/></button>
          <VibeOrb active={isLive} isThinking={isConnecting} isAiSpeaking={isAiSpeakingGlobal} volume={volume} outputVolume={outputVolume} />
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black uppercase italic tracking-tighter">
               {isConnecting ? "Connecting Soul..." : "Link Active"}
            </h2>
            <div className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl min-h-[100px] flex items-center justify-center max-w-sm">
               <p className="font-bold text-blue-400 italic">
                  {liveTranscript.length > 0 ? liveTranscript.slice(-1)[0].text : 'Listening for your vibe...'}
               </p>
            </div>
          </div>
          <button onClick={disconnectLive} className="px-12 py-5 bg-rose-600 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center gap-2"><MicOff size={20}/> End Session</button>
        </div>
      )}

      {/* Modern Footer Input */}
      <footer className="p-4 bg-gradient-to-t from-black to-transparent">
        <div className="max-w-3xl mx-auto flex items-center gap-2 p-1.5 bg-zinc-900 border border-white/5 rounded-[2rem] shadow-2xl focus-within:border-blue-500/50 transition-all">
          <button onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-500 hover:text-white transition-all"><ImageIcon size={22}/></button>
          <input type="file" ref={fileInputRef} onChange={(e) => {
             const file = e.target.files?.[0];
             if (file) {
               const reader = new FileReader();
               reader.onloadend = () => setSelectedImage(reader.result as string);
               reader.readAsDataURL(file);
             }
          }} className="hidden" accept="image/*" />
          
          <input 
            type="text" placeholder="Drop your vibe..." value={inputText} 
            onChange={e => setInputText(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)} 
            className="flex-1 bg-transparent py-3 px-1 font-bold text-sm outline-none placeholder-zinc-600" 
          />
          
          <div className="flex items-center gap-1 pr-1">
             <button onClick={() => { setSelectedVoiceMode('chat'); connectLive(); }} className="p-3 bg-white/5 text-zinc-400 rounded-full hover:text-blue-400"><Mic size={20}/></button>
             <button onClick={() => handleSendToAI(inputText)} className={`p-3 rounded-full transition-all ${inputText.trim() ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-600'}`} disabled={!inputText.trim() && !selectedImage}><Send size={20}/></button>
          </div>
        </div>
        {selectedImage && (
          <div className="mt-2 flex justify-center">
             <div className="relative inline-block">
               <img src={selectedImage} className="w-12 h-12 rounded-xl border border-white/20" alt="Preview" />
               <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-rose-600 rounded-full p-1"><X size={10}/></button>
             </div>
          </div>
        )}
      </footer>

      {/* Personality/Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsProfileModalOpen(false)} />
           <div className="relative w-full max-w-lg bg-zinc-900 rounded-[3rem] p-8 space-y-8 animate-scale-in border border-white/5 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between">
                 <h2 className="text-2xl font-black uppercase tracking-tight">Identity</h2>
                 <button onClick={() => setIsProfileModalOpen(false)} className="p-2 bg-white/5 rounded-xl"><X size={20}/></button>
              </div>
              
              <div className="space-y-6">
                 <div>
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">Linked Core</h3>
                    <div className="grid grid-cols-2 gap-3">
                       {Object.values(PERSONALITIES).map((p: Personality) => (
                         <button key={p.id} onClick={() => { setUser(prev => ({ ...prev!, personalityId: p.id })); setSettings(s => ({ ...s, personalityId: p.id })); showToast(`${p.name} personality active!`, "success"); }} className={`p-4 rounded-2xl text-left border-2 transition-all ${settings.personalityId === p.id ? 'bg-blue-600/10 border-blue-600/50 text-blue-400' : 'bg-white/5 border-transparent text-zinc-400'}`}>
                            <div className="text-xl mb-1">{p.emoji}</div>
                            <div className="font-black text-[10px] uppercase">{p.name}</div>
                         </button>
                       ))}
                    </div>
                 </div>
                 
                 <div>
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">Vocal Matrix</h3>
                    <div className="grid grid-cols-2 gap-3">
                       {GEMINI_VOICES.map(v => (
                         <button key={v.id} onClick={() => { setSettings(s => ({ ...s, voiceName: v.id })); showToast(`Voice: ${v.name}`, "info"); }} className={`p-3 rounded-xl text-[10px] font-bold uppercase ${settings.voiceName === v.id ? 'bg-blue-600 text-white' : 'bg-white/5 text-zinc-500'}`}>
                           {v.name.split(' ')[0]}
                         </button>
                       ))}
                    </div>
                 </div>
              </div>
              
              <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-4 bg-rose-600/10 text-rose-500 rounded-2xl font-black uppercase text-xs tracking-widest">Terminate Soul Link</button>
           </div>
        </div>
      )}
    </div>
  );
}
