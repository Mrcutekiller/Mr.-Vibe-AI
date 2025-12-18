
import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { Personality, AppSettings, User } from '../types';
import { BASE_SYSTEM_PROMPT } from '../constants';

interface UseGeminiLiveProps {
  personality: Personality;
  settings: AppSettings;
  user: User;
  onTranscript: (text: string, isModel: boolean, isInterim: boolean) => void;
  onTurnComplete: (userText: string, modelText: string) => void;
  onConnectionStateChange: (isConnected: boolean) => void;
  onError: (error: string) => void;
}

export const useGeminiLive = ({
  personality,
  settings,
  user,
  onTranscript,
  onTurnComplete,
  onConnectionStateChange,
  onError,
}: UseGeminiLiveProps) => {
  const [isLive, setIsLive] = useState(false);
  const [volume, setVolume] = useState(0); 
  const [isConnecting, setIsConnecting] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionRef = useRef<any>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentInputText = useRef('');
  const currentOutputText = useRef('');

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
    } catch (e) {
      console.error("Audio Init Failed", e);
      throw new Error("Microphone or Audio context blocked.");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (streamRef.current) { 
      streamRef.current.getTracks().forEach(track => track.stop()); 
      streamRef.current = null; 
    }
    if (processorRef.current && sourceRef.current) { 
      sourceRef.current.disconnect(); 
      processorRef.current.disconnect(); 
      processorRef.current = null; 
      sourceRef.current = null; 
    }
    if (sessionRef.current) {
        try { sessionRef.current.close(); } catch(e) {}
        sessionRef.current = null;
    }
    sessionPromiseRef.current = null;
    sourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    currentInputText.current = '';
    currentOutputText.current = '';
    setIsLive(false);
    setIsConnecting(false);
    onConnectionStateChange(false);
    setVolume(0);
  }, [onConnectionStateChange]);

  const sendMessage = useCallback((text: string) => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => {
        session.sendRealtimeInput({ text });
      });
    }
  }, []);

  const connect = useCallback(async () => {
    if (isLive || isConnecting) return;

    try {
      setIsConnecting(true);
      await initAudio();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}
      - Personality: ${personality.name}
      - Context: ${personality.prompt}
      - User: ${user.userName}
      Rules: Be concise, friendly, and stay in character. 
      IMPORTANT: You are the initiator. When the session starts, speak first to greet the user warmly!`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: fullSystemPrompt,
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.voiceName || personality.voiceName } }, 
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsLive(true);
            setIsConnecting(false);
            onConnectionStateChange(true);
            
            // AI Greets First
            sessionPromise.then(session => {
              session.sendRealtimeInput({ text: "I'm ready! Introduce yourself and greet me warmly based on your personality!" });
            });

            if (!inputAudioContextRef.current) return;
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const vol = Math.sqrt(sum / inputData.length);
              setVolume(vol);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then((session) => { 
                  sessionRef.current = session;
                  session.sendRealtimeInput({ media: pcmBlob }); 
              });
            };
            
            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
            sourceRef.current = source;
            processorRef.current = processor;
          },
          onmessage: async (message: LiveServerMessage) => {
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && audioContextRef.current) {
                const ctx = audioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                try {
                  const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(ctx.destination);
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  sourcesRef.current.add(source);
                  source.onended = () => sourcesRef.current.delete(source);
                } catch (err) { console.error("Audio output error", err); }
             }

             if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                currentInputText.current += text;
                onTranscript(text, false, true);
             }
             if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                currentOutputText.current += text;
                onTranscript(text, true, true);
             }
             if (message.serverContent?.turnComplete) {
                onTurnComplete(currentInputText.current, currentOutputText.current);
                currentInputText.current = '';
                currentOutputText.current = '';
             }
             if (message.serverContent?.interrupted) {
               sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
               sourcesRef.current.clear();
               nextStartTimeRef.current = 0;
             }
          },
          onclose: () => disconnect(),
          onerror: (e) => {
            onError("Network error. Checking connection...");
            disconnect();
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (error: any) { 
      onError(error.message || "Failed to establish connection.");
      disconnect(); 
    }
  }, [personality, settings, user, isLive, isConnecting, onConnectionStateChange, onTranscript, onTurnComplete, initAudio, disconnect, onError]);

  return { connect, disconnect, sendMessage, isLive, isConnecting, volume };
};
