import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocketContext } from './WebSocketManager';

export const AudioManager: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const { sendMessage, isConnected, agentStatus, audioQueue, clearAudioQueue, audioTrigger, setAgentStatus } = useWebSocketContext();
  
  // Microphone Capture
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Playback
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);

  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Load the worklet script from the public folder
      await audioContext.audioWorklet.addModule('/audio-recorder.js');

      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;

      const workletNode = new AudioWorkletNode(audioContext, 'audio-recorder-processor');
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        const pcmBuffer = event.data;
        const buffer = new Uint8Array(pcmBuffer);
        
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < buffer.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, Array.from(buffer.slice(i, i + chunkSize)));
        }
        const base64Data = btoa(binary);

        console.log("Sending audio chunk, size:", base64Data.length);
        sendMessage({ type: "audio", data: base64Data });
      };

      sourceNode.connect(workletNode);
      workletNode.connect(audioContext.destination);
      setIsListening(true);
      
    } catch (err) {
      console.error("Error starting microphone", err);
    }
  };

  const stopMicrophone = () => {
    if (workletNodeRef.current && audioContextRef.current) {
        workletNodeRef.current.disconnect();
        sourceNodeRef.current?.disconnect();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsListening(false);
  };

  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  useEffect(() => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
  }, []);

  const playQueue = useCallback(async () => {
    if (!playbackContextRef.current || audioQueue.length === 0) return;
    
    // Resume context if needed
    if (playbackContextRef.current.state === 'suspended') {
      await playbackContextRef.current.resume();
    }
    
    while (audioQueue.length > 0) {
      const base64Data = audioQueue.shift();
      if (!base64Data) continue;
      
      try {
        const arrayBuffer = base64ToArrayBuffer(base64Data);
        // Process Int16 array buffer to Float32 sample data manually, decodeAudioData doesn't take raw PCM
        const int16View = new Int16Array(arrayBuffer);
        const audioBuffer = playbackContextRef.current.createBuffer(1, int16View.length, 24000);
        const float32View = audioBuffer.getChannelData(0);
        
        for (let i = 0; i < int16View.length; i++) {
            float32View[i] = int16View[i] / 32768.0;
        }

        const sourceNode = playbackContextRef.current.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(playbackContextRef.current.destination);
        
        const currentTime = playbackContextRef.current.currentTime;
        if (nextStartTimeRef.current < currentTime) {
            nextStartTimeRef.current = currentTime + 0.05; // slight buffer buffer latency 
        }

        sourceNode.start(nextStartTimeRef.current);
        nextStartTimeRef.current += audioBuffer.duration;
        playbackQueueRef.current.push(sourceNode);

      } catch (e) {
        console.error("Error decoding playback audio data", e);
      }
    }
  }, [audioQueue]);

  useEffect(() => {
     playQueue();
  }, [audioTrigger, playQueue]);


  // Clean up interrupted audio
  useEffect(() => {
     if(agentStatus === "idle") {
         playbackQueueRef.current.forEach(node => {
             try { node.stop(); } catch(e) {}
             node.disconnect();
         });
         playbackQueueRef.current = [];
         nextStartTimeRef.current = 0;
         clearAudioQueue();
     }
  }, [agentStatus, clearAudioQueue]);

  return (
    <div className="flex border rounded-lg p-2 gap-4 items-center bg-gray-50 shadow-sm w-full">
      <div className="flex bg-white rounded-md p-2 gap-4 flex-1 outline outline-1 outline-gray-200">
          <div className="font-semibold px-2 py-1 flex items-center gap-2">
            Status: 
            {agentStatus === "idle" && <span className="text-gray-500">💤 Idle</span>}
            {agentStatus === "speaking" && <span className="text-green-600 animate-pulse">🔊 Speaking...</span>}
            {agentStatus === "thinking" && <span className="text-amber-500">⏳ Thinking...</span>}
          </div>
      </div>
      <div>
        <button 
          onClick={isListening ? stopMicrophone : startMicrophone}
          disabled={!isConnected}
          className={`px-4 py-2 font-semibold text-white rounded shadow-sm flex gap-2 items-center transition-colors min-w-44 justify-center ${
            !isConnected ? 'bg-gray-400 cursor-not-allowed' :
            isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isListening ? '🎤 Stop Recording' : '🎤 Start Conversation'}
        </button>
      </div>
    </div>
  );
};
