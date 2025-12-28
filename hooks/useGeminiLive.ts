import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { Personality, AppSettings, User } from '../types';
import { BASE_SYSTEM_PROMPT } from '../constants';

interface UseGeminiLiveProps {
  personality: Personality;
  settings: AppSettings;
  user: User;
  mode: 'note' | 'chat';
  onTranscript: (text: string, isInterim: boolean, isModel: boolean) => void;
  onTurnComplete: (userText: string, modelText: string) => void;
  onConnectionStateChange: (isConnected: boolean) => void;
  onCommand: (command: string, args?: any) => void;
  onError: (error: any) => void;
}

export const useGeminiLive = ({
  personality,
  settings,
  user,
  mode,
  onTranscript,
  onTurnComplete,
  onConnectionStateChange,
  onCommand,
  onError,
}: UseGeminiLiveProps) => {
  const [isLive, setIsLive] = useState(false);
  const [volume, setVolume] = useState(0); 
  const [outputVolume, setOutputVolume] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const accumulatedInputText = useRef('');
  const accumulatedOutputText = useRef('');

  const settingsRef = useRef(settings);
  const modeRef = useRef(mode);
  
  useEffect(() => {
    settingsRef.current = settings;
    modeRef.current = mode;
  }, [settings, mode]);

  const initAudio = useCallback(async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (!inputAudioContextRef.current) {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      if (inputAudioContextRef.current.state === 'suspended') await inputAudioContextRef.current.resume();

      if (!outputAnalyserRef.current && audioContextRef.current) {
        outputAnalyserRef.current = audioContextRef.current.createAnalyser();
        outputAnalyserRef.current.fftSize = 256;
        outputAnalyserRef.current.connect(audioContextRef.current.destination);
      }
    } catch (e) {
      console.error("Audio Init Failed", e);
      throw new Error("Microphone access denied. Please check permissions.");
    }
  }, []);

  useEffect(() => {
    let animationFrame: number;
    const updateOutputVolume = () => {
      if (outputAnalyserRef.current && isLive && modeRef.current !== 'note') {
        const dataArray = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
        outputAnalyserRef.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setOutputVolume(rms);
      } else {
        setOutputVolume(0);
      }
      animationFrame = requestAnimationFrame(updateOutputVolume);
    };
    updateOutputVolume();
    return () => cancelAnimationFrame(animationFrame);
  }, [isLive]);

  const disconnect = useCallback(() => {
    if (processorRef.current) { 
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect(); 
      processorRef.current = null; 
    }
    if (streamRef.current) { 
      streamRef.current.getTracks().forEach(track => track.stop()); 
      streamRef.current = null; 
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    sessionPromiseRef.current?.then(session => {
        try { session.close(); } catch(e) {}
    });
    sessionPromiseRef.current = null;

    sourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    accumulatedInputText.current = '';
    accumulatedOutputText.current = '';
    setIsLive(false);
    setIsConnecting(false);
    onConnectionStateChange(false);
    setVolume(0);
    setOutputVolume(0);
    nextStartTimeRef.current = 0;
  }, [onConnectionStateChange]);

  const connect = useCallback(async () => {
    if (isLive || isConnecting) return;

    try {
      setIsConnecting(true);
      await initAudio();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          noiseSuppression: true, 
          echoCancellation: true, 
          autoGainControl: true, 
          channelCount: 1,
          sampleRate: 16000
        } 
      });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const modeInstruction = modeRef.current === 'note' 
        ? "SILENT REAL-TIME SCRIBE PROTOCOL: You are Mr. Cute. Your mission is to precisely transcribe, organize, and highlight everything the user says. YOU MUST NOT SPEAK (total audio silence). Instead, you must continuously generate TEXT parts in your model turn. If the user asks a question, identify it with '❓ Question detected' and answer it immediately in text. Use clear headers: ### 📝 Meeting Notes, ### 💡 Key Insights, ### ✅ Action Items. Keep your text updates flowing as the user speaks."
        : `BESTIE VOICE MODE: You are Mr. Cute, a vibrant AI persona. Personality: ${personality.name}. Treat the user as your best friend. Be responsive, funny, and engage in high-energy voice sync.`;

      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}
      - MODE: ${modeInstruction}
      - IDENTITY: Mr. Cute (Personality sync: ${personality.name})
      - SYNC TARGET: ${user.userName}
      - KEY RULE: Always acknowledge greetings (like 'hi') with high enthusiasm immediately.`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: fullSystemPrompt,
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: settingsRef.current.voiceName || personality.voiceName } }, 
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsLive(true);
            setIsConnecting(false);
            onConnectionStateChange(true);
            
            if (!inputAudioContextRef.current) return;
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              if (!sessionPromiseRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const vol = Math.sqrt(sum / inputData.length);
              setVolume(vol);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then((session) => { 
                  session.sendRealtimeInput({ media: pcmBlob }); 
              });
            };
            
            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
            sourceRef.current = source;
            processorRef.current = processor;

            // Immediate forced greeting nudge
            sessionPromise.then(session => {
              session.sendRealtimeInput({ text: `[SYSTEM: Link Established with ${user.userName}. Respond with your character's signature greeting now.]` });
            });
          },
          onmessage: async (message: LiveServerMessage) => {
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             const textPart = message.serverContent?.modelTurn?.parts?.find(p => p.text)?.text;
             
             if (textPart) {
                accumulatedOutputText.current += textPart;
                onTranscript(accumulatedOutputText.current, true, true);
             }

             if (base64Audio && audioContextRef.current && modeRef.current !== 'note') {
                const ctx = audioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                try {
                  const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.playbackRate.value = settingsRef.current.speakingRate;
                  if (outputAnalyserRef.current) source.connect(outputAnalyserRef.current);
                  else source.connect(ctx.destination);
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  sourcesRef.current.add(source);
                  source.onended = () => sourcesRef.current.delete(source);
                } catch (err) { console.error("Audio playback error:", err); }
             }

             if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                accumulatedInputText.current += text;
                onTranscript(accumulatedInputText.current, true, false);
             }
             if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                accumulatedOutputText.current += text;
                onTranscript(accumulatedOutputText.current, true, true);
             }
             if (message.serverContent?.turnComplete) {
                const u = accumulatedInputText.current.trim();
                const m = accumulatedOutputText.current.trim();
                if (u || m) {
                  onTurnComplete(u, m);
                }
                accumulatedInputText.current = '';
                accumulatedOutputText.current = '';
             }
             if (message.serverContent?.interrupted) {
               sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
               sourcesRef.current.clear();
               nextStartTimeRef.current = 0;
             }
          },
          onclose: () => disconnect(),
          onerror: (e) => {
            console.error("Live session error:", e);
            onError(new Error("Sync Disconnected: The neural link was interrupted."));
            disconnect();
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (error: any) { 
      onError(error);
      disconnect(); 
    }
  }, [personality, user, isLive, isConnecting, onConnectionStateChange, onTranscript, onTurnComplete, onCommand, initAudio, disconnect, onError]);

  return { connect, disconnect, isLive, isConnecting, volume, outputVolume };
};