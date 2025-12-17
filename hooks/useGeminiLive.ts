
import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { Personality, AppSettings, User } from '../types';
import { BASE_SYSTEM_PROMPT } from '../constants';

interface UseGeminiLiveProps {
  apiKey: string;
  personality: Personality;
  settings: AppSettings;
  user: User;
  onTranscript: (text: string, isModel: boolean) => void;
  onConnectionStateChange: (isConnected: boolean) => void;
}

export const useGeminiLive = ({
  apiKey,
  personality,
  settings,
  user,
  onTranscript,
  onConnectionStateChange,
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
  
  const aiClientRef = useRef<GoogleGenAI | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const initAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (!inputAudioContextRef.current) {
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    // Force resume
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
    if (inputAudioContextRef.current.state === 'suspended') await inputAudioContextRef.current.resume();
  }, []);

  const disconnect = useCallback(() => {
    console.log("Disconnecting voice...");
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
    sourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsLive(false);
    setIsConnecting(false);
    onConnectionStateChange(false);
    setVolume(0);
  }, [onConnectionStateChange]);

  const connect = useCallback(async () => {
    if (isLive || isConnecting) return;

    try {
      setIsConnecting(true);
      await initAudio();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      aiClientRef.current = new GoogleGenAI({ apiKey });

      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}
      
      CURRENT CONFIGURATION:
      - Selected Personality: ${personality.name}
      - Personality Rules: ${personality.prompt}
      - User Name: ${user.userName || 'Friend'}

      VOICE MODE SPECIFIC RULES:
      - You are in a real-time voice conversation.
      - Be brief, conversational, and stay in character.
      - If user says hi, respond warmly as Mr. Cute.
      `;

      const sessionPromise = aiClientRef.current.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: fullSystemPrompt,
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: settings.voiceName || personality.voiceName } }, 
            },
            inputAudioTranscription: { model: 'gemini-2.5-flash-native-audio-preview-09-2025' },
        },
        callbacks: {
          onopen: () => {
            console.log("Voice session opened");
            setIsLive(true);
            setIsConnecting(false);
            onConnectionStateChange(true);
            
            if (!inputAudioContextRef.current) return;
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolume(Math.sqrt(sum / inputData.length));
              
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then((session: any) => { 
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
             // Handle Model Speech
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && audioContextRef.current) {
                const ctx = audioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                try {
                  const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(ctx.destination);
                  source.addEventListener('ended', () => { sourcesRef.current.delete(source); });
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  sourcesRef.current.add(source);
                } catch (err) { console.error("Audio playback error", err); }
             }

             // Handle User Transcription (for UI feedback)
             if (message.serverContent?.inputTranscription?.text) {
                 onTranscript(message.serverContent.inputTranscription.text, false);
             }

             // Handle Model Response Text (for UI feedback)
             const modelText = message.serverContent?.modelTurn?.parts?.find(p => p.text)?.text;
             if (modelText) {
                 onTranscript(modelText, true);
             }
          },
          onclose: (e) => { 
            console.log("Session closed", e);
            disconnect(); 
          },
          onerror: (e) => { 
            console.error("Session error", e);
            disconnect(); 
          }
        }
      });
    } catch (error) { 
      console.error("Connection failed", error);
      disconnect(); 
    }
  }, [apiKey, personality, settings, user, isLive, isConnecting, onConnectionStateChange, onTranscript, initAudio, disconnect]);

  return { connect, disconnect, isLive, isConnecting, volume };
};
