import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { SYSTEM_INSTRUCTION, BOOK_APPOINTMENT_TOOL, LOG_TICKET_TOOL } from '../constants';
import { ConnectionState, ActionLog } from '../types';

interface UseGeminiLiveProps {
  onAction: (action: ActionLog) => void;
}

export const useGeminiLive = ({ onAction }: UseGeminiLiveProps) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isTalking, setIsTalking] = useState(false);
  
  // Keep the latest callback in a ref to avoid stale closures in event listeners
  const onActionRef = useRef(onAction);
  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<Promise<any> | null>(null);
  const connectedRef = useRef<boolean>(false);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Refs for volume visualization
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [volume, setVolume] = useState(0);

  const cleanup = useCallback(() => {
    // Stop all playing sources
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current.clear();

    // Close audio contexts
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Disconnect processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close session
    sessionRef.current?.then(session => {
        try { session.close(); } catch(e) {}
    });
    sessionRef.current = null;
    connectedRef.current = false;

    setConnectionState(ConnectionState.DISCONNECTED);
    setIsTalking(false);
    setVolume(0);
    nextStartTimeRef.current = 0;
  }, []);

  const connect = async () => {
    try {
      setConnectionState(ConnectionState.CONNECTING);

      // Initialize API Client
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      // Output Context - Let browser decide sample rate to prevent hardware incompatibility
      const outputCtx = new AudioContextClass();
      await outputCtx.resume();
      audioContextRef.current = outputCtx;
      
      // Input Context
      const inputCtx = new AudioContextClass(); 
      await inputCtx.resume();
      inputAudioContextRef.current = inputCtx;

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      // Input Processing Pipeline
      const source = inputCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      
      // Add Gain Node to boost volume if needed
      const gainNode = inputCtx.createGain();
      gainNode.gain.value = 1.5;
      gainNodeRef.current = gainNode;
      source.connect(gainNode);

      // Volume Analysis
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 32;
      gainNode.connect(analyser);
      analyserRef.current = analyser;

      // Script Processor
      const scriptProcessor = inputCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (e) => {
        if (!connectedRef.current || !sessionRef.current) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createBlob(inputData, inputCtx.sampleRate);
        
        if (analyserRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
            setVolume(avg);
        }

        sessionRef.current.then(session => {
          try {
            session.sendRealtimeInput({ media: pcmBlob });
          } catch (e) {
            console.error("Error sending input:", e);
          }
        });
      };

      gainNode.connect(scriptProcessor);
      scriptProcessor.connect(inputCtx.destination);

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Connection Opened');
            setConnectionState(ConnectionState.CONNECTED);
            connectedRef.current = true;
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              setIsTalking(true);
              const ctx = audioContextRef.current;
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              try {
                const audioBuffer = await decodeAudioData(
                  decode(base64Audio),
                  ctx,
                  24000,
                  1
                );
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                
                source.addEventListener('ended', () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) {
                      setIsTalking(false);
                  }
                });
                
                source.start(nextStartTimeRef.current);
                sourcesRef.current.add(source);
                nextStartTimeRef.current += audioBuffer.duration;
              } catch (err) {
                console.error("Error decoding audio:", err);
              }
            }

            // Handle Interruptions
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(source => source.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsTalking(false);
            }

            // Handle Tool Calls
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                console.log('Tool Call:', fc.name, fc.args);
                
                let result = { result: "Action failed" };
                const callId = fc.id;

                if (fc.name === 'book_sales_appointment') {
                    const recipient = "info@riyadah.com.eg";
                    const subject = `New Appointment Request: ${fc.args.name}`;
                    const body = `Customer: ${fc.args.name}\nCompany: ${fc.args.company || 'N/A'}\nPhone: ${fc.args.phone}\nInterest: ${fc.args.interest}\n\nGenerated by Riyadah AI Assistant.`;

                    // Use the ref to ensure we have the latest callback
                    onActionRef.current({
                        id: Math.random().toString(36).substr(2, 9),
                        type: 'booking',
                        title: 'Appointment Scheduled',
                        message: `Appointment created for ${fc.args.name}. Processing...`,
                        timestamp: new Date(),
                        details: fc.args,
                        emailDraft: { recipient, subject, body },
                        status: 'pending' 
                    });
                    result = { result: "Success. Appointment logged and processing." };
                } else if (fc.name === 'log_support_ticket') {
                    const recipient = "info@riyadah.com.eg";
                    const subject = `Support Ticket [${fc.args.urgency}]: ${fc.args.client_name}`;
                    const body = `Client: ${fc.args.client_name}\nPhone: ${fc.args.phone_number}\nUrgency: ${fc.args.urgency}\nIssue: ${fc.args.issue_description}\n\nGenerated by Riyadah AI Assistant.`;

                    onActionRef.current({
                        id: Math.random().toString(36).substr(2, 9),
                        type: 'ticket',
                        title: 'Support Ticket Logged',
                        message: `Ticket created for ${fc.args.client_name}. Processing...`,
                        timestamp: new Date(),
                        details: fc.args,
                        emailDraft: { recipient, subject, body },
                        status: 'pending'
                    });
                    result = { result: "Success. Ticket logged and processing." };
                }

                // Send Response
                sessionRef.current?.then(session => {
                  session.sendToolResponse({
                    functionResponses: {
                      name: fc.name,
                      id: callId,
                      response: result
                    }
                  });
                });
              }
            }
          },
          onclose: () => {
            console.log('Session closed');
            setConnectionState(ConnectionState.DISCONNECTED);
            connectedRef.current = false;
          },
          onerror: (err) => {
            console.error('Session error:', err);
            setConnectionState(ConnectionState.ERROR);
            connectedRef.current = false;
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          tools: [
              { functionDeclarations: [BOOK_APPOINTMENT_TOOL, LOG_TICKET_TOOL] }
          ]
        }
      });

      sessionRef.current = sessionPromise;

    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionState(ConnectionState.ERROR);
      cleanup();
    }
  };

  const disconnect = () => {
    cleanup();
  };

  return {
    connect,
    disconnect,
    connectionState,
    isTalking,
    volume
  };
};