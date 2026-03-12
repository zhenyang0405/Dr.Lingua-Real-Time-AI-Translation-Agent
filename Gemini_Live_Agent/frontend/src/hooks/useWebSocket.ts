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
  const [agentStatus, setAgentStatus] = useState<"idle" | "speaking" | "thinking">("idle");
  const [error, setError] = useState<string | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const maxReconnects = 3;
  const connectionId = useRef(0);

  const audioQueueRef = useRef<string[]>([]);
  const [audioTrigger, setAudioTrigger] = useState(0);

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
                 setTranscripts(prev => [...prev, {
                    role: msg.role,
                    text: msg.text,
                    timestamp: Date.now()
                 }]);
                 if(msg.role === "user") setAgentStatus("thinking");
              }
              break;
            case "turn_complete":
              setAgentStatus("idle");
              break;
            case "interrupted":
              setAgentStatus("idle");
              break;
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
    audioQueue: audioQueueRef.current,
    clearAudioQueue,
    audioTrigger
  };
}
