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
        ? "SYNC SCRIBE MODE: You are the designated AI scribe for Mr. Vibe. Your primary function is to transcribe user speech with high accuracy. DO NOT GENERATE AUDIO (strictly silent). Output only text. Organize speech into structured sections. If the user asks a question, answer it concisely in the text stream while continuing the transcription. Capture every single vibe, even short phrases."
        : `BESTIE VOICE MODE: You are Mr. Cute, a high-energy best friend AI. Personality: ${personality.name}. Be charming, fun, and use voice output to bond with ${user.userName}.`;

      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}
      - MODE: ${modeInstruction}
      - SYNC TARGET: ${user.userName}
      - NOTE: Even if the user says only one or two words, ensure they are recorded in the transcript history.`;

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
          },
          onmessage: async (message: LiveServerMessage) => {
             const base64Audio = message.serverContent?.modelTurn?.parts?.find(p => p.inlineData)?.inlineData?.data;
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
                accumulatedInputText.current += message.serverContent.inputTranscription.text;
                onTranscript(accumulatedInputText.current, true, false);
             }
             if (message.serverContent?.outputTranscription) {
                accumulatedOutputText.current += message.serverContent.outputTranscription.text;
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
            onError(new Error("Sync Disconnected. Check your network or API key!"));
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
