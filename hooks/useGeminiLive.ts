
import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { createPcmBlob, decode, decodeAudioData } from '../utils/audioUtils';
// Removed 'CustomCommand' as it is not exported from '../types' and is not used in this file.
import { Personality, AppSettings, User } from '../types';
import { BASE_SYSTEM_PROMPT, GEMINI_VOICES } from '../constants';

interface UseGeminiLiveProps {
  apiKey: string;
  personality: Personality;
  settings: AppSettings;
  user: User;
  mode: 'note' | 'chat';
  onTranscript: (text: string, isInterim: boolean, isModel: boolean) => void;
  onTurnComplete: (userText: string, modelText: string) => void;
  onConnectionStateChange: (isConnected: boolean) => void;
  onCommand: (command: string, args?: any) => void;
  onError: (error: string) => void;
}

export const useGeminiLive = ({
  apiKey,
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
      processorRef.current.onaudioprocess = null; // Prevent aborted error from trailing process events
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
    nextStartTimeRef.current = 0;
    currentInputText.current = '';
    currentOutputText.current = '';
    setIsLive(false);
    setIsConnecting(false);
    onConnectionStateChange(false);
    setVolume(0);
    setOutputVolume(0);
  }, [onConnectionStateChange]);

  const connect = useCallback(async () => {
    if (isLive || isConnecting || !apiKey) {
      if (!apiKey) onError("No API Key linked.");
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
          sampleRate: 16000
        } 
      });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey });

      const voiceControlFunctions: FunctionDeclaration[] = [
        {
          name: 'summarize_board',
          description: 'Summarize the current conversation and board into a Vibe Report.',
          parameters: { type: Type.OBJECT, properties: {} }
        },
        {
          name: 'create_new_session',
          description: 'Start a completely new chat board or session.',
          parameters: { type: Type.OBJECT, properties: {} }
        },
        {
          name: 'clear_current_board',
          description: 'Clear all messages on the current active board.',
          parameters: { type: Type.OBJECT, properties: {} }
        },
        {
          name: 'change_voice',
          description: 'Change the voice of the AI.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              voice_id: {
                type: Type.STRING,
                description: 'The ID of the voice to switch to (e.g., Puck, Charon, Fenrir, Kore, Aoede, Zephyr).',
              }
            },
            required: ['voice_id']
          }
        },
        {
          name: 'change_user_name',
          description: 'Update the user profile name.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              new_name: {
                type: Type.STRING,
                description: 'The new name for the user.',
              }
            },
            required: ['new_name']
          }
        },
        {
          name: 'clear_notifications',
          description: 'Clear any active notifications on the screen.',
          parameters: { type: Type.OBJECT, properties: {} }
        }
      ];

      const customShortcuts = settings.customCommands.map(c => `If I say "${c.trigger}", interpret it as "${c.action}"`).join('\n');

      const modeInstruction = mode === 'note' 
        ? "You are now in SMART NOTE TAKER mode. Focus strictly on utility. If the user asks a question, provide ONLY the direct answer concisely. If they share info, briefly acknowledge it. No unnecessary fluff."
        : `You are in MAIN CHARACTER CHAT mode. Be your full expressive self. Greet the user as their bestie using the ${personality.name} archetype. Engage deeply.`;

      const voicesList = GEMINI_VOICES.map(v => `${v.name} (id: ${v.id})`).join(', ');

      const fullSystemPrompt = `${BASE_SYSTEM_PROMPT}
      - CURRENT MODE: ${modeInstruction}
      - Personality: ${personality.name}
      - Context: ${personality.prompt}
      - User: ${user.userName}
      
      VOICE COMMANDS (YOU CAN CONTROL THE UI):
      - "Change your voice to [Voice Name]" -> use change_voice(voice_id)
        Available Voices: ${voicesList}
      - "Call me [New Name]" -> use change_user_name(new_name)
      - "New session" or "Start fresh" -> use create_new_session
      - "Clear the board" or "Reset everything" -> use clear_current_board
      - "Clear notifications" or "Close messages" -> use clear_notifications

      USER DEFINED SHORTCUTS:
      ${customShortcuts || "No custom shortcuts defined."}

      Rules: Be concise in Note Taker mode, stay in character in Chat mode, and ALWAYS help with notes.`;

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
              const greetingPrompt = mode === 'note' 
                ? "Briefly acknowledge you're ready to take smart notes." 
                : "Introduce yourself and greet me warmly in your selected persona. Let's chat!";
              session.sendRealtimeInput({ text: greetingPrompt });
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
                  
                  const speedMultiplier = settingsRef.current.speakingRate * settingsRef.current.speakingPitch;
                  source.playbackRate.value = speedMultiplier;

                  if (outputAnalyserRef.current) {
                    source.connect(outputAnalyserRef.current);
                  } else {
                    source.connect(ctx.destination);
                  }

                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += (audioBuffer.duration / speedMultiplier);
                  
                  sourcesRef.current.add(source);
                  source.onended = () => sourcesRef.current.delete(source);
                } catch (err) { console.error("Audio output error", err); }
             }

             if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                currentInputText.current += text;
                onTranscript(text, false, false);
             }
             if (message.serverContent?.outputTranscription) {
                const text = message.serverContent.outputTranscription.text;
                currentOutputText.current += text;
                onTranscript(text, false, true);
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
            onError("Connection dropped. Resetting soul link...");
            disconnect();
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (error: any) { 
      onError(error.message || "Vibe connection failed.");
      disconnect(); 
    }
  }, [apiKey, personality, settings, user, mode, isLive, isConnecting, onConnectionStateChange, onTranscript, onTurnComplete, onCommand, initAudio, disconnect, onError]);

  return { connect, disconnect, isLive, isConnecting, volume, outputVolume };
};
