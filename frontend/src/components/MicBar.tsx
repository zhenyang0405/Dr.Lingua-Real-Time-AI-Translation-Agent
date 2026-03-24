"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useWebSocketContext } from "@/components/VisualNounWebSocketProvider";

export default function MicBar() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const {
    sendMessage,
    isConnected,
    agentStatus,
    audioQueue,
    clearAudioQueue,
    audioTrigger,
    setAgentStatus,
    isTurnComplete,
  } = useWebSocketContext();

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);

  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule("/audio-recorder.js");

      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;

      const workletNode = new AudioWorkletNode(audioContext, "audio-recorder-processor");
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        const msg = event.data;

        // VAD messages update visual feedback only (wave bar animation)
        if (msg.type === "vad") {
          setIsSpeaking(msg.speaking);
          return;
        }

        if (msg.type === "audio") {
          const buffer = new Uint8Array(msg.buffer);
          let binary = "";
          const chunkSize = 8192;
          for (let i = 0; i < buffer.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, Array.from(buffer.slice(i, i + chunkSize)));
          }
          const base64Data = btoa(binary);
          sendMessage({ type: "audio", data: base64Data });
        }
      };

      sourceNode.connect(workletNode);
      workletNode.connect(audioContext.destination);
      setIsListening(true);

      // Push-to-talk: mic on = activity starts
      sendMessage({ type: "activity_start" });
    } catch (err) {
      console.error("Error starting microphone", err);
    }
  };

  const stopMicrophone = () => {
    // Push-to-talk: mic off = activity ends
    sendMessage({ type: "activity_end" });

    if (workletNodeRef.current && audioContextRef.current) {
      workletNodeRef.current.disconnect();
      sourceNodeRef.current?.disconnect();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsListening(false);
    setIsSpeaking(false);
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

  // Cleanup mic on unmount
  useEffect(() => {
    return () => {
      if (workletNodeRef.current) workletNodeRef.current.disconnect();
      if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) audioContextRef.current.close();
      if (playbackContextRef.current) playbackContextRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (!playbackContextRef.current || playbackContextRef.current.state === "closed") {
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }
  }, []);

  const playQueue = useCallback(async () => {
    if (!playbackContextRef.current || playbackContextRef.current.state === "closed" || audioQueue.length === 0) return;
    if (playbackContextRef.current.state === "suspended") {
      await playbackContextRef.current.resume();
    }
    while (audioQueue.length > 0) {
      const base64Data = audioQueue.shift();
      if (!base64Data) continue;
      try {
        const arrayBuffer = base64ToArrayBuffer(base64Data);
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
          nextStartTimeRef.current = currentTime + 0.05;
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

  // When the turn is complete, wait for remaining audio to finish, then go idle
  useEffect(() => {
    if (isTurnComplete && agentStatus === "speaking") {
      const ctx = playbackContextRef.current;
      if (ctx) {
        const remaining = Math.max(0, nextStartTimeRef.current - ctx.currentTime);
        const timer = setTimeout(() => {
          playbackQueueRef.current = [];
          nextStartTimeRef.current = 0;
          setAgentStatus("idle");
        }, remaining * 1000 + 150); // small buffer for safety
        return () => clearTimeout(timer);
      } else {
        setAgentStatus("idle");
      }
    }
  }, [isTurnComplete, agentStatus, setAgentStatus]);

  // Force-stop audio only on interruption (user barge-in)
  useEffect(() => {
    if (agentStatus === "interrupted") {
      playbackQueueRef.current.forEach((node) => {
        try { node.stop(); } catch (e) {}
        node.disconnect();
      });
      playbackQueueRef.current = [];
      nextStartTimeRef.current = 0;
      clearAudioQueue();
    }
  }, [agentStatus, clearAudioQueue]);

  const waveBars = [8, 14, 20, 12, 6];

  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-gray-200 bg-white shrink-0">
      {/* Left wave bars (green) — animate only when VAD detects speech */}
      <div className="flex items-center gap-0.5 h-5">
        {isListening &&
          waveBars.map((h, i) => (
            <span
              key={`l-${i}`}
              className="w-[3px] rounded-sm bg-[#5DCAA5]"
              style={{
                height: isSpeaking ? `${h}px` : "3px",
                animation: isSpeaking ? "wave 0.8s ease-in-out infinite" : "none",
                animationDelay: `${i * 0.1}s`,
                transition: "height 0.15s ease",
              }}
            />
          ))}
      </div>

      {/* Mic button */}
      <button
        onClick={isListening ? stopMicrophone : startMicrophone}
        disabled={!isConnected}
        className={`w-11 h-11 rounded-full border-none text-white flex items-center justify-center transition-transform hover:scale-110 ${
          !isConnected
            ? "bg-gray-400 cursor-not-allowed"
            : isListening
            ? "bg-red-500"
            : "bg-[#1D9E75]"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-[18px] h-[18px]"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>

      {/* Right wave bars (orange) — animate only when VAD detects speech */}
      <div className="flex items-center gap-0.5 h-5">
        {isListening &&
          waveBars.map((h, i) => (
            <span
              key={`r-${i}`}
              className="w-[3px] rounded-sm bg-[#F0997B]"
              style={{
                height: isSpeaking ? `${h}px` : "3px",
                animation: isSpeaking ? "wave 0.8s ease-in-out infinite" : "none",
                animationDelay: `${i * 0.1}s`,
                transition: "height 0.15s ease",
              }}
            />
          ))}
      </div>

      {/* Status label */}
      <span className="text-[12px] text-gray-500 ml-1">
        {!isConnected
          ? "Disconnected"
          : isListening
          ? agentStatus === "speaking"
            ? "Translating"
            : agentStatus === "thinking"
            ? "Processing"
            : "Listening"
          : "Press to start"}
      </span>
    </div>
  );
}
