
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { 
  Send, Mic, Settings, X, Moon, Sun, Menu, Plus, Trash2, 
  Waves, Volume2, LogIn, UserPlus, ArrowRight, ArrowLeft, 
  User as UserIcon, CheckCircle2, Mail, Lock, Sparkles, 
  ChevronRight, MicOff, MessageSquare, AlertCircle, AlertTriangle, RefreshCw,
  Camera, FileText, Upload, Loader2, Play, Image as ImageIcon, Globe,
  Leaf, Droplets, Share2, ThumbsUp, ThumbsDown, Edit3, Check, Zap, ExternalLink, Activity, Bell, Music, Film, Heart, GraduationCap, Users, Copy, Share, LogOut, AlertOctagon, Key, Wand2, Info, HelpCircle, Eye, EyeOff, Smile, Rocket, Eraser, Pin, StickyNote, ListFilter, Mic2, UserCheck, ShieldCheck, Palette, FastForward, Sliders, BookOpen, PenTool, Hash, Info as InfoIcon, Lightbulb
} from 'lucide-react';
import { PERSONALITIES, BASE_SYSTEM_PROMPT, AVATARS, GEMINI_VOICES, DISCOVERY_DATA } from './constants';
import { PersonalityId, Personality, AppSettings, User, ChatSession, Message, ReactionType, GroundingSource, ApiStatus, Gender, CustomCommand } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';
import { decode, decodeAudioData } from './utils/audioUtils';

// --- Components ---

const validateEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

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

const MarkdownText = ({ text }: { text: string }) => {
  const lines = text.split('\n');
  const renderedBlocks: any[] = [];
  let currentList: { listType: 'ul' | 'ol', items: string[] } | null = null;
  let inCodeBlock = false;
  let codeBuffer = '';

  lines.forEach((line) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        renderedBlocks.push({ type: 'code', content: codeBuffer.trim() });
        codeBuffer = '';
        inCodeBlock = false;
      } else {
        if (currentList) {
          renderedBlocks.push({ type: 'list', ...currentList });
          currentList = null;
        }
        inCodeBlock = true;
      }
      return;
    }
    if (inCodeBlock) {
      codeBuffer += line + '\n';
      return;
    }
    const ulMatch = line.match(/^[\s]*[-*•][\s]+(.*)/);
    const olMatch = line.match(/^[\s]*\d+\.[\s]+(.*)/);
    if (ulMatch || olMatch) {
      const listType = ulMatch ? 'ul' : 'ol';
      const content = ulMatch ? ulMatch[1] : olMatch![1];
      if (currentList && currentList.listType === listType) {
        currentList.items.push(content);
      } else {
        if (currentList) renderedBlocks.push({ type: 'list', ...currentList });
        currentList = { listType, items: [content] };
      }
      return;
    }
    if (currentList) {
      renderedBlocks.push({ type: 'list', ...currentList });
      currentList = null;
    }
    if (line.trim()) {
      renderedBlocks.push({ type: 'paragraph', content: line });
    }
  });

  if (currentList) renderedBlocks.push({ type: 'list', ...currentList });
  if (inCodeBlock) renderedBlocks.push({ type: 'code', content: codeBuffer.trim() });

  const renderInline = (input: string) => {
    const regex = /(\[.*?\]\(.*?\)|https?:\/\/[^\s]+|\*\*.*?\*\*|`.*?`)/g;
    const parts = input.split(regex);
    return parts.map((part, idx) => {
      if (!part) return null;
      if (part.startsWith('[') && part.includes('](')) {
        const match = part.match(/\[(.*?)\]\((.*?)\)/);
        if (match) {
          return (
            <a key={idx} href={match[2]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 font-black decoration-2 underline-offset-2 underline decoration-blue-500/20 hover:decoration-blue-500/50 transition-all">
              <Globe size={14} className="shrink-0" />
              <span>{match[1]}</span>
              <ExternalLink size={10} className="shrink-0 opacity-40" />
            </a>
          );
        }
      }
      if (part.startsWith('http')) {
        return (
          <a key={idx} href={part} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 font-black decoration-2 underline-offset-2 underline decoration-blue-500/20 hover:decoration-blue-500/50 transition-all break-all">
            <Globe size={14} className="shrink-0" />
            <span>{part.length > 25 ? part.substring(0, 25) + '...' : part}</span>
            <ExternalLink size={10} className="shrink-0 opacity-40" />
          </a>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-black text-zinc-900 dark:text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={idx} className="bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-md font-mono text-[0.85em] font-bold border border-blue-500/10">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-3">
      {renderedBlocks.map((block, i) => {
        if (block.type === 'code') return <div key={i} className="my-2 bg-black rounded-lg p-3 text-xs font-mono text-blue-300 overflow-x-auto">{block.content}</div>;
        if (block.type === 'list') {
          const ListTag = block.listType === 'ul' ? 'ul' : 'ol';
          return (
            <ListTag key={i} className={`space-y-2.5 ml-6 ${block.listType === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-blue-500`}>
              {block.items.map((item: string, idx: number) => (
                <li key={idx} className="pl-2 text-zinc-700 dark:text-zinc-300 leading-snug">
                  {renderInline(item)}
                </li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={i} className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {renderInline(block.content)}
          </p>
        );
      })}
    </div>
  );
};

const NotificationToast = ({ message, type, onClose }: { message: string, type: 'info' | 'success' | 'error', onClose: () => void }) => (
  <div className="fixed top-4 md:top-8 inset-x-0 z-[10000] flex justify-center px-4 pointer-events-none">
    <div className={`w-full max-w-[400px] animate-vibe-in rounded-[2rem] shadow-xl backdrop-blur-3xl border flex items-center gap-3 p-4 pointer-events-auto ${
      type === 'success' ? 'bg-white/95 dark:bg-zinc-900/95 border-green-500/30 text-green-600' :
      type === 'error' ? 'bg-rose-50/95 dark:bg-rose-950/95 border-rose-500/30 text-rose-600' :
      'bg-white/95 dark:bg-zinc-900/95 border-blue-500/30 text-blue-600'
    }`}>
      <div className="flex-1 font-bold text-sm leading-snug">{message}</div>
      <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all"><X size={18} /></button>
    </div>
  </div>
);

const AIVibeAvatar = ({ volume, outputVolume, active, isThinking, personality, isAiSpeaking, animationState }: { volume: number, outputVolume: number, active: boolean, isThinking: boolean, personality: Personality, isAiSpeaking?: boolean, animationState: 'idle' | 'nod' | 'tilt' | 'wake' | 'laugh' }) => {
  const scale = 1 + (active ? (isAiSpeaking ? (0.05 + outputVolume * 0.2) : volume * 1.5) : isThinking ? 0.05 : 0);
  
  const getVibeColor = () => {
    const id = personality.id;
    if (id === PersonalityId.ROAST || id === PersonalityId.CRAZY) return '#f43f5e';
    if (id === PersonalityId.RIZZ_GOD || id === PersonalityId.GIRLFRIEND) return '#d946ef';
    if (id === PersonalityId.WISDOM_GURU) return '#10b981';
    return '#3b82f6';
  };

  const vibeColor = getVibeColor();

  return (
    <div className={`relative perspective preserve-3d flex items-center justify-center transition-all duration-500 ${animationState === 'laugh' ? 'animate-laugh' : ''}`}>
      {/* Background Glow */}
      <div className={`absolute inset-0 blur-[100px] rounded-full transition-all duration-700 ${active || isThinking ? 'scale-150 opacity-40' : 'scale-100 opacity-0'}`}
        style={{ backgroundColor: vibeColor }} />
      
      <div className={`relative flex flex-col items-center gap-2 transition-transform duration-150 ${isAiSpeaking ? 'animate-speaking-vibes' : 'animate-float'}`}
        style={{ transform: `scale(${scale})` }}>
        
        {/* Head Layer */}
        <div className={`w-32 h-32 md:w-52 md:h-52 rounded-[3.5rem] relative z-20 flex items-center justify-center shadow-2xl border-4 border-white/20 transition-all duration-300 ${animationState === 'tilt' ? 'rotate-12' : animationState === 'nod' ? 'translate-y-4' : ''}`}
             style={{ background: `radial-gradient(circle at 30% 30%, ${vibeColor}, #000000)` }}>
           
           <div className="absolute inset-0 bg-white/5 rounded-[3.5rem] opacity-40 animate-pulse" />
           
           {/* Eyes */}
           <div className="flex gap-8 md:gap-16 mb-4 md:mb-8">
              <div className="w-2.5 h-2.5 md:w-5 md:h-5 bg-white rounded-full shadow-[0_0_15px_white] animate-eye-blink" />
              <div className="w-2.5 h-2.5 md:w-5 md:h-5 bg-white rounded-full shadow-[0_0_15px_white] animate-eye-blink" />
           </div>

           <div className="absolute text-3xl md:text-6xl -top-2 md:-top-6 transform transition-transform">
             {isThinking ? '🧠' : personality.emoji}
           </div>

           {/* Dynamic Mouth - Lip Sync */}
           <div className="absolute bottom-10 md:bottom-16 w-full flex justify-center overflow-hidden">
              <div 
                className={`bg-white/95 rounded-full transition-all duration-75 shadow-[0_0_15px_white]`} 
                style={{ 
                  height: `${isAiSpeaking ? (4 + outputVolume * 60) : (active && volume > 0.01 ? 4 : 2)}px`, 
                  width: `${isAiSpeaking ? (20 + outputVolume * 20) : (animationState === 'laugh' ? 35 : 24)}px`,
                  opacity: isAiSpeaking || animationState === 'laugh' ? 1 : 0.6
                }}
              />
           </div>
        </div>

        {/* Torso */}
        <div className="w-20 h-16 md:w-36 md:h-28 bg-zinc-800 dark:bg-zinc-900 rounded-[2rem] shadow-xl relative z-10 border-2 border-white/5">
           <div className="absolute inset-2 bg-blue-500/10 rounded-[1.5rem] flex items-center justify-center">
             <div className={`w-3 h-3 rounded-full ${active ? 'bg-blue-500 animate-ping' : 'bg-zinc-700'}`} />
           </div>

           {/* Arms */}
           <div className="absolute -left-4 md:-left-10 top-2 w-6 h-12 md:w-10 md:h-24 bg-zinc-800 dark:bg-zinc-900 rounded-full animate-arm-swing-left border border-white/5" />
           <div className="absolute -right-4 md:-right-10 top-2 w-6 h-12 md:w-10 md:h-24 bg-zinc-800 dark:bg-zinc-900 rounded-full animate-arm-swing-right border border-white/5" />
        </div>

        {/* Legs */}
        <div className="flex gap-6 md:gap-12 -mt-4">
           <div className="w-4 h-10 md:w-8 md:h-20 bg-zinc-800 dark:bg-zinc-900 rounded-full animate-leg-bounce border border-white/5" style={{ animationDelay: '0s' }} />
           <div className="w-4 h-10 md:w-8 md:h-20 bg-zinc-800 dark:bg-zinc-900 rounded-full animate-leg-bounce border border-white/5" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [isNewUser, setIsNewUser] = useState<boolean>(() => !localStorage.getItem('mr_vibe_active_user'));
  const [apiStatus, setApiStatus] = useState<ApiStatus>('connected'); 
  const [toast, setToast] = useState<{message: string, type: 'info' | 'success' | 'error'} | null>(null);
  
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('mr_vibe_active_user') || 'null'));
  const [manualApiKey, setManualApiKey] = useState(() => localStorage.getItem('mr_vibe_manual_api_key') || '');
  
  const [tempProfile, setTempProfile] = useState<Partial<User>>({ 
    userName: '', 
    avatarUrl: AVATARS[0], 
    personalityId: PersonalityId.NORMAL, 
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('mr_vibe_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        speakingRate: parsed.speakingRate || 1.0,
        speakingPitch: parsed.speakingPitch || 1.0,
        wakeWordEnabled: parsed.wakeWordEnabled ?? true,
        customCommands: parsed.customCommands || []
      };
    }
    return {
      language: "English",
      theme: "dark",
      personalityId: PersonalityId.NORMAL,
      voiceName: "Zephyr",
      speakingRate: 1.0,
      speakingPitch: 1.0,
      wakeWordEnabled: true,
      customCommands: []
    };
  });
  
  const [sessions, setSessions] = useState<ChatSession[]>(() => JSON.parse(localStorage.getItem('mr_vibe_sessions') || '[]'));
  const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('mr_vibe_active_session_id'));

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<{text: string, isModel: boolean}[]>([]);
  const [isAiSpeakingGlobal, setIsAiSpeakingGlobal] = useState(false);
  const [avatarAnimation, setAvatarAnimation] = useState<'idle' | 'nod' | 'tilt' | 'wake' | 'laugh'>('idle');

  // Voice Selection States
  const [isVoiceSelectionOpen, setIsVoiceSelectionOpen] = useState(false);
  const [selectedVoiceMode, setSelectedVoiceMode] = useState<'note' | 'chat'>('chat');

  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
  const messages = activeSession?.messages || [];
  const currentPersonality = PERSONALITIES[settings.personalityId];
  const currentApiKey = useMemo(() => manualApiKey.trim() || (process.env.API_KEY || ''), [manualApiKey]);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleNewChat = useCallback(() => {
    const newId = Date.now().toString();
    const newSession: ChatSession = { id: newId, title: 'Session ' + (sessions.length + 1), messages: [], lastTimestamp: Date.now(), personalityId: settings.personalityId };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    localStorage.setItem('mr_vibe_active_session_id', newId);
    return newId;
  }, [sessions.length, settings.personalityId]);

  const handleClearCurrentChat = useCallback(() => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [] } : s));
    showToast("Chat cleared! ✨", "success");
    setAvatarAnimation('nod');
    setTimeout(() => setAvatarAnimation('idle'), 1000);
  }, [activeSessionId]);

  const { connect: connectLive, disconnect: disconnectLive, isLive, isConnecting, volume, outputVolume } = useGeminiLive({
    apiKey: currentApiKey, 
    personality: currentPersonality, 
    settings, 
    user: user || tempProfile as User,
    mode: selectedVoiceMode,
    onTranscript: (t, iM, isModel) => {
        setLiveTranscript(prev => [...prev, { text: t, isModel }]);
        if (isModel) {
          setIsAiSpeakingGlobal(true);
        } else {
          const lower = t.toLowerCase();
          if (t.includes('?')) {
            setAvatarAnimation('tilt');
            setTimeout(() => setAvatarAnimation('idle'), 1200);
          } else if (/(haha|funny|joke|lol|rofl|lmao)/.test(lower)) {
            setAvatarAnimation('laugh');
            setTimeout(() => setAvatarAnimation('idle'), 2000);
          }
        }
    },
    onTurnComplete: (u, m) => { 
      setLiveTranscript([]); 
      setIsAiSpeakingGlobal(false);
      const sId = activeSessionId || handleNewChat(); 
      const isQuestion = u.trim().endsWith('?') || u.toLowerCase().startsWith('what') || u.toLowerCase().startsWith('how');
      setSessions(prev => prev.map(s => s.id === sId ? { ...s, messages: [...s.messages, { id: `u-${Date.now()}`, role: 'user', text: u, timestamp: Date.now(), isQuestion }, { id: `m-${Date.now() + 1}`, role: 'model', text: m, timestamp: Date.now() + 1, isNote: isQuestion }] } : s)); 
    },
    onConnectionStateChange: (c) => { !c && setLiveTranscript([]); },
    onCommand: (cmd, args) => {
      if (cmd === 'summarize_board') handleSummarize();
      if (cmd === 'create_new_session') handleNewChat();
      if (cmd === 'clear_current_board') handleClearCurrentChat();
      if (cmd === 'clear_notifications') setToast(null);
      if (cmd === 'change_voice') {
        const voiceId = args.voice_id;
        const found = GEMINI_VOICES.find(v => v.id.toLowerCase() === voiceId.toLowerCase() || v.name.toLowerCase().includes(voiceId.toLowerCase()));
        if (found) {
          setSettings(prev => ({ ...prev, voiceName: found.id }));
          showToast(`Voice updated to ${found.name}! 🎤`, "success");
        }
      }
      if (cmd === 'change_user_name') {
        const newName = args.new_name;
        if (newName && user) {
          setUser(prev => prev ? ({ ...prev, userName: newName }) : null);
          showToast(`Name updated to ${newName}! ✨`, "success");
        }
      }
      setAvatarAnimation('nod');
      setTimeout(() => setAvatarAnimation('idle'), 1000);
    },
    onError: (m) => showToast(m, "error")
  });

  async function handleSummarize() {
    if (!activeSession) return;
    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const transcript = messages.slice(-20).map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: `Summarize highlights of this conversation. SNAPPY VIBE ONLY.\n\n${transcript}`, 
        config: { systemInstruction: "Brief bullet points with emojis.", thinkingConfig: { thinkingBudget: 0 } } 
      });
      const summaryMessage: Message = { id: `sum-${Date.now()}`, role: 'model', text: response.text || 'Synthesis failed.', timestamp: Date.now(), isNote: true };
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, summaryMessage] } : s));
    } catch (e: any) { showToast("Synthesis glitch.", "error"); }
  }

  async function handleSendToAI(text: string) {
    if (!text.trim() || isLoading) return;
    let sessionId = activeSessionId || handleNewChat();
    const isQuestion = text.trim().endsWith('?');
    const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', text, timestamp: Date.now(), isQuestion };
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, userMessage], lastTimestamp: Date.now() } : s));
    setIsLoading(true); setInputText('');
    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}\n\n${PERSONALITIES[settings.personalityId].prompt}`;
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: text, config: { systemInstruction: fullSystemPrompt, thinkingConfig: { thinkingBudget: 0 } } });
      const aiMessage: Message = { id: `ai-${Date.now()}`, role: 'model', text: response.text || '...vibe lost...', timestamp: Date.now(), isNote: isQuestion };
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: [...s.messages, aiMessage] } : s));
    } catch (e: any) { showToast("Soul link lost.", "error"); } finally { setIsLoading(false); }
  }

  useEffect(() => {
    localStorage.setItem('mr_vibe_settings', JSON.stringify(settings));
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('mr_vibe_active_user', JSON.stringify(user));
      setIsNewUser(false);
    }
  }, [user]);

  useEffect(() => { localStorage.setItem('mr_vibe_sessions', JSON.stringify(sessions)); }, [sessions]);

  if (isNewUser) {
    return (
      <div className="fixed inset-0 z-[2000] bg-zinc-50 dark:bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-[4rem] p-12 text-center shadow-2xl animate-scale-in">
           <Logo className="w-24 h-24 mx-auto mb-8" animated />
           <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2 text-zinc-900 dark:text-white">Mr. Vibe AI</h1>
           <p className="text-zinc-500 font-bold mb-8">CHOOSE YOUR IDENTITY TO LINK SOUL.</p>
           <input type="text" placeholder="Identity Name..." value={tempProfile.userName} onChange={e => setTempProfile({...tempProfile, userName: e.target.value})} className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-3xl py-6 px-10 font-black text-2xl text-center outline-none mb-6 border-4 border-transparent focus:border-blue-500 transition-all text-zinc-900 dark:text-white" />
           <button onClick={() => { if(tempProfile.userName) setUser(tempProfile as User); }} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-xl shadow-xl active:scale-95">Connect Link</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full bg-zinc-50 dark:bg-[#050505] transition-colors overflow-hidden">
      {toast && <NotificationToast {...toast} onClose={() => setToast(null)} />}

      {isVoiceSelectionOpen && (
        <div className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 animate-fade-in" onClick={() => setIsVoiceSelectionOpen(false)}>
           <div className="w-full max-w-2xl space-y-8 animate-vibe-in" onClick={e => e.stopPropagation()}>
              <div className="text-center space-y-2 mb-12">
                 <h2 className="text-4xl md:text-6xl font-black italic text-white tracking-tighter uppercase">Choose Mode</h2>
                 <p className="text-zinc-400 font-bold tracking-widest uppercase text-xs">How should Mr. Cute listen today?</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <button 
                   onClick={() => { setSelectedVoiceMode('note'); setIsVoiceSelectionOpen(false); connectLive(); }}
                   className="group bg-white/5 border-2 border-white/10 hover:border-amber-500/50 p-8 rounded-[3rem] transition-all hover:scale-105 active:scale-95 text-left space-y-4"
                 >
                    <div className="w-16 h-16 bg-amber-500/20 rounded-3xl flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform"><BookOpen size={32}/></div>
                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Smart Note Taker</h3>
                    <p className="text-zinc-400 text-sm font-bold leading-relaxed">Focuses strictly on facts and answers questions instantly. Optimized for utility.</p>
                 </button>
                 <button 
                   onClick={() => { setSelectedVoiceMode('chat'); setIsVoiceSelectionOpen(false); connectLive(); }}
                   className="group bg-white/5 border-2 border-white/10 hover:border-blue-500/50 p-8 rounded-[3rem] transition-all hover:scale-105 active:scale-95 text-left space-y-4"
                 >
                    <div className="w-16 h-16 bg-blue-500/20 rounded-3xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform"><Sparkles size={32}/></div>
                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Main Character Chat</h3>
                    <p className="text-zinc-400 text-sm font-bold leading-relaxed">Full expressive personality. Greeted warmly based on your selected archetype.</p>
                 </button>
              </div>
           </div>
        </div>
      )}
      
      {(isLive || isConnecting) && (
        <div className="fixed inset-0 z-[7000] bg-zinc-950 flex flex-col items-center justify-between p-8 animate-fade-in">
          <button onClick={disconnectLive} className="self-end p-4 bg-white/10 rounded-full text-white hover:bg-rose-500 transition-all"><X size={24}/></button>
          <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center w-full max-w-2xl">
             <AIVibeAvatar 
               volume={volume} 
               outputVolume={outputVolume} 
               active={isLive} 
               isThinking={isConnecting} 
               personality={currentPersonality} 
               isAiSpeaking={isAiSpeakingGlobal}
               animationState={avatarAnimation}
             />
             <div className="space-y-2">
                <h2 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter uppercase">
                  {isConnecting ? "Tuning Link..." : isAiSpeakingGlobal ? "Mr. Cute Talking" : "Listening..."}
                </h2>
                <div className="flex items-center gap-2 justify-center text-[10px] font-black uppercase tracking-widest text-blue-500 animate-pulse">
                   <Activity size={12}/> {selectedVoiceMode === 'note' ? 'Utility Mode Active' : 'Personality Mode Active'}
                </div>
             </div>
             <div className="bg-white/5 p-6 rounded-[2rem] w-full min-h-[100px] flex items-center justify-center">
                <p className="text-white font-bold italic text-lg leading-tight">
                  {liveTranscript.length > 0 ? liveTranscript.slice(-1)[0].text : 'Ready for your vibe...'}
                </p>
             </div>
          </div>
          <button onClick={disconnectLive} className="w-full md:w-auto px-12 py-5 bg-rose-600 text-white rounded-3xl font-black shadow-xl active:scale-95 flex items-center justify-center gap-3"><MicOff size={24}/> End Session</button>
        </div>
      )}

      {/* Main UI */}
      <div className="flex-1 flex flex-col relative h-full">
        <header className="h-[72px] px-8 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-white/80 dark:bg-black/80 backdrop-blur-3xl sticky top-0 z-[300]">
          <div className="flex items-center gap-3">
             <Logo className="w-8 h-8" />
             <h1 className="text-xl font-black italic tracking-tighter uppercase text-zinc-900 dark:text-white">Mr. Vibe AI</h1>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => setIsProfileModalOpen(true)} className="w-10 h-10 rounded-xl overflow-hidden shadow-md border border-white/10 active:scale-95 transition-transform"><img src={user?.avatarUrl} alt="User" /></button>
             <button onClick={() => setIsVoiceSelectionOpen(true)} className="h-12 px-6 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-600/30 flex items-center gap-2 active:scale-95 transition-all"><Mic size={18}/> Voice Lab</button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-12 py-8 bg-zinc-50 dark:bg-[#050505]">
          <div className="max-w-3xl mx-auto space-y-6 pb-32">
            {messages.map((msg, idx) => (
              <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-vibe-in`} style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.isNote && (
                    <div className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-500/20 mb-1 flex items-center gap-1.5"><StickyNote size={10}/> Smart Insight</div>
                  )}
                  <div className={`px-5 py-3 rounded-[1.8rem] shadow-lg font-bold text-[15px] ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-100 dark:border-white/5 rounded-bl-none'}`}>
                    <MarkdownText text={msg.text} />
                  </div>
                  <span className="text-[9px] font-black text-zinc-400 uppercase mt-1 px-1">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start animate-pulse"><div className="w-12 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full" /></div>
            )}
          </div>
        </main>

        <footer className="px-6 py-6 absolute bottom-0 left-0 right-0 z-[200] pointer-events-none">
          <div className="max-w-3xl mx-auto flex items-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl rounded-[2.5rem] p-2 border-2 border-zinc-200 dark:border-white/10 shadow-2xl pointer-events-auto">
             <input 
               type="text" placeholder="Note your thoughts..." 
               value={inputText} onChange={e => setInputText(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && handleSendToAI(inputText)}
               className="w-full bg-transparent py-4 px-6 font-bold outline-none text-zinc-900 dark:text-white"
             />
             <button onClick={() => handleSendToAI(inputText)} className="h-14 w-14 bg-blue-600 text-white rounded-full flex items-center justify-center active:scale-90 transition-transform"><Send size={24}/></button>
          </div>
        </footer>
      </div>

      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-6">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setIsProfileModalOpen(false)} />
           <div className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-[3rem] p-10 animate-vibe-in border border-white/5">
              <div className="flex justify-between items-center mb-10">
                 <h2 className="text-2xl font-black italic tracking-tighter uppercase text-zinc-900 dark:text-white">Profile Sync</h2>
                 <button onClick={() => setIsProfileModalOpen(false)} className="p-3 bg-zinc-100 dark:bg-white/5 rounded-2xl"><X size={20}/></button>
              </div>
              <div className="space-y-8">
                 <div className="flex flex-col items-center gap-4">
                    <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-white dark:border-zinc-800 shadow-xl"><img src={user?.avatarUrl} className="w-full h-full object-cover" /></div>
                    <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase">{user?.userName}</h3>
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500"> Archetype Frequency</label>
                    <div className="grid grid-cols-2 gap-3">
                       {Object.values(PERSONALITIES).slice(0, 4).map(p => (
                         <button 
                           key={p.id} 
                           onClick={() => setSettings({...settings, personalityId: p.id})}
                           className={`p-4 rounded-2xl border-2 transition-all font-bold text-xs text-center flex items-center gap-2 justify-center ${settings.personalityId === p.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-50 dark:bg-white/5 border-transparent text-zinc-500'}`}
                         >
                           <span>{p.emoji}</span> {p.name}
                         </button>
                       ))}
                    </div>
                 </div>
                 <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-5 bg-rose-500/10 text-rose-500 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all">Break Soul Link</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
