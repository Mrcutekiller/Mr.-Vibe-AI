
import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createPcmBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { Personality, AppSettings, User, PersonalityId } from '../types';
import { BASE_SYSTEM_PROMPT, GEMINI_VOICES } from '../constants';

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

  const currentInputText = useRef('');
  const currentOutputText = useRef('');

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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
      throw new Error("Microphone access denied.");
    }
  }, []);

  useEffect(() => {
    let animationFrame: number;
    const updateOutputVolume = () => {
      if (outputAnalyserRef.current && isLive) {
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
    currentInputText.current = '';
    currentOutputText.current = '';
    setIsLive(false);
    setIsConnecting(false);
    onConnectionStateChange(false);
    setVolume(0);
    setOutputVolume(0);
    nextStartTimeRef.current = 0;
  }, [onConnectionStateChange]);

  const connect = useCallback(async () => {
    if (isLive || isConnecting) return;

    const apiKey = localStorage.getItem('mr_vibe_neural_pass') || process.env.API_KEY || '';
    if (!apiKey) {
      onError(new Error("No API key available."));
      return;
    }

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

      const ai = new GoogleGenAI({ apiKey });

      const voiceControlFunctions: FunctionDeclaration[] = [
        {
          name: 'change_voice',
          description: 'Change the voice of the AI.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              voice_id: { type: Type.STRING, description: 'Voice ID (Puck, Charon, Fenrir, Kore, Aoede, Zephyr).' }
            },
            required: ['voice_id']
          }
        }
      ];

      const voicesList = GEMINI_VOICES.map(v => `${v.name} (id: ${v.id})`).join(', ');
      
      const modeInstruction = mode === 'note' 
        ? "STRICT NOTE TAKER: Your ONLY job is to listen and create a bulleted summary of everything the user says. Be concise and smart."
        : `BESTIE CHAT: You are Mr. Cute, a warm, expressive AI best friend. Your personality is ${personality.name}.`;

      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}
      - MODE PROTOCOL: ${modeInstruction}
      - USER: ${user.userName} (Gender: ${user.gender})
      - ARCHETYPE: ${personality.name} (${personality.prompt})
      
      AVAILABLE TOOLS:
      - change_voice: Change voice to one of: ${voicesList}.
      
      Rules: Always refer to yourself as Mr. Cute. No robot talk.`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: fullSystemPrompt,
            tools: [{ functionDeclarations: voiceControlFunctions }],
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
            
            sessionPromise.then(session => {
              session.sendRealtimeInput({ text: "establishing neural link..." });
            });

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
             if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                  onCommand(fc.name, fc.args);
                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } }
                    });
                  });
                }
             }

             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && audioContextRef.current) {
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
                } catch (err) { console.error("Audio output error", err); }
             }

             if (message.serverContent?.inputTranscription) {
                onTranscript(message.serverContent.inputTranscription.text, false, false);
                currentInputText.current += message.serverContent.inputTranscription.text;
             }
             if (message.serverContent?.outputTranscription) {
                onTranscript(message.serverContent.outputTranscription.text, false, true);
                currentOutputText.current += message.serverContent.outputTranscription.text;
             }
             if (message.serverContent?.turnComplete) {
                if (currentInputText.current.trim() || currentOutputText.current.trim()) {
                  onTurnComplete(currentInputText.current.trim(), currentOutputText.current.trim());
                }
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
            onError(e);
            disconnect();
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (error: any) { 
      onError(error);
      disconnect(); 
    }
  }, [personality, settings, user, mode, isLive, isConnecting, onConnectionStateChange, onTranscript, onTurnComplete, onCommand, initAudio, disconnect, onError]);

  return { connect, disconnect, isLive, isConnecting, volume, outputVolume };
};
