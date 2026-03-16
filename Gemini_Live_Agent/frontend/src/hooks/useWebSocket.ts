import { useState, useEffect, useCallback, useRef } from "react";
import { config } from "../lib/config";
import { DownstreamMessage, UpstreamMessage, AnnotationItem } from "../types/messages";

export interface Transcript {
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export function useWebSocket(token: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [agentStatus, setAgentStatus] = useState<"idle" | "speaking" | "thinking" | "interrupted">("idle");
  const [isTurnComplete, setIsTurnComplete] = useState(false);
  const interruptedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const maxReconnects = 3;
  const connectionId = useRef(0);

  const audioQueueRef = useRef<string[]>([]);
  const [audioTrigger, setAudioTrigger] = useState(0);

  // Buffer transcription tokens until turn_complete
  const inputTranscriptBuffer = useRef("");
  const outputTranscriptBuffer = useRef("");

  const connect = useCallback(() => {
    if (!token || ws.current?.readyState === WebSocket.OPEN) return;

    const thisConnectionId = ++connectionId.current;

    try {
      const socket = new WebSocket(`${config.streamingUrl}/ws`);
      ws.current = socket;

      socket.onopen = () => {
        if (connectionId.current !== thisConnectionId) return;
        console.log("WebSocket connection established");
        setIsConnected(true);
        setError(null);
        reconnectAttempt.current = 0;
        // First message must be auth
        console.log("Sending auth token...");
        socket.send(JSON.stringify({ type: "auth", token }));
      };

      socket.onmessage = (event) => {
        if (connectionId.current !== thisConnectionId) return;
        try {
          const msg = JSON.parse(event.data) as DownstreamMessage;

          switch (msg.type) {
            case "auth_success":
              setIsAuthenticated(true);
              setUid(msg.uid);
              setSessionId(msg.session_id);
              break;
            case "audio":
              audioQueueRef.current.push(msg.data);
              setAudioTrigger(prev => prev + 1);
              setAgentStatus("speaking");
              setIsTurnComplete(false);
              break;
            case "tool_call":
              const itemReq: AnnotationItem = {
                id: Math.random().toString(36).substring(7),
                timestamp: Date.now(),
                type: msg.name === "display_translation" ? "translation" : "image_translation",
                args: msg.args as any, // Cast according to type checking rules
              };
              setAnnotations(prev => [...prev, itemReq]);
              break;
            case "transcription":
              if (msg.text.trim()) {
                if (msg.role === "user") {
                  inputTranscriptBuffer.current += msg.text;
                  setAgentStatus("thinking");
                } else {
                  outputTranscriptBuffer.current += msg.text;
                }
              }
              break;
            case "turn_complete": {
              // Flush buffered transcripts as complete sentences
              const inputText = inputTranscriptBuffer.current.trim();
              const outputText = outputTranscriptBuffer.current.trim();
              if (inputText || outputText) {
                setTranscripts(prev => {
                  const next = [...prev];
                  if (inputText) next.push({ role: "user", text: inputText, timestamp: Date.now() });
                  if (outputText) next.push({ role: "agent", text: outputText, timestamp: Date.now() });
                  return next;
                });
              }
              inputTranscriptBuffer.current = "";
              outputTranscriptBuffer.current = "";
              setIsTurnComplete(true);
              break;
            }
            case "interrupted": {
              // Flush any buffered transcripts before marking interrupted
              const intInputText = inputTranscriptBuffer.current.trim();
              const intOutputText = outputTranscriptBuffer.current.trim();
              if (intInputText || intOutputText) {
                setTranscripts(prev => {
                  const next = [...prev];
                  if (intInputText) next.push({ role: "user", text: intInputText, timestamp: Date.now() });
                  if (intOutputText) next.push({ role: "agent", text: intOutputText, timestamp: Date.now() });
                  return next;
                });
              }
              inputTranscriptBuffer.current = "";
              outputTranscriptBuffer.current = "";
              setIsTurnComplete(false);
              if (interruptedTimerRef.current) clearTimeout(interruptedTimerRef.current);
              setAgentStatus("interrupted");
              interruptedTimerRef.current = setTimeout(() => setAgentStatus("idle"), 8000);
              break;
            }
            case "error":
              setError(msg.message);
              break;
          }
        } catch (e) {
          console.error("Failed to parse websocket message", e);
        }
      };

      socket.onclose = () => {
        if (connectionId.current !== thisConnectionId) return;
        setIsConnected(false);
        setIsAuthenticated(false);
        ws.current = null;

        if (reconnectAttempt.current < maxReconnects) {
          reconnectAttempt.current++;
          setTimeout(() => {
            connect();
          }, 2000); // Wait 2s before retry
        }
      };

      socket.onerror = (err) => {
        console.error("WebSocket Error", err);
      };
    } catch (err) {
      console.error("Failed to establish websocket connection", err);
    }
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      connectionId.current++; // Invalidate stale callbacks
      if (ws.current) {
        ws.current.onclose = null; // Prevent reconnect on intentional close
        ws.current.close();
        ws.current = null;
      }
    };
  }, [connect]);

  const sendMessage = useCallback((msg: UpstreamMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && isAuthenticated) {
      ws.current.send(JSON.stringify(msg));
    }
  }, [isAuthenticated]);

  const disconnect = useCallback(() => {
      if(ws.current) {
          ws.current.close();
      }
  }, []);

  const clearAudioQueue = useCallback(() => {
      audioQueueRef.current = [];
  }, []);

  return {
    isConnected,
    isAuthenticated,
    uid,
    sessionId,
    sendMessage,
    annotations,
    transcripts,
    agentStatus,
    setAgentStatus,
    error,
    disconnect,
    isTurnComplete,
    audioQueue: audioQueueRef.current,
    clearAudioQueue,
    audioTrigger
  };
}
