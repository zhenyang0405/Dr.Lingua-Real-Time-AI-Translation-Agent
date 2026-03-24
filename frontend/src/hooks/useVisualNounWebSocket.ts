import { useState, useEffect, useCallback, useRef } from "react";
import { config } from "../lib/config";
import { UpstreamMessage, VisualNounCard, VisualNounDownstreamMessage, Transcript } from "../types/messages";

export function useVisualNounWebSocket(token: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [visualNounCards, setVisualNounCards] = useState<VisualNounCard[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [agentStatus, setAgentStatus] = useState<"idle" | "speaking" | "thinking" | "interrupted">("idle");
  const interruptedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTurnComplete, setIsTurnComplete] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const maxReconnects = 3;
  const connectionId = useRef(0);

  const audioQueueRef = useRef<string[]>([]);
  const [audioTrigger, setAudioTrigger] = useState(0);

  // Counter for generating unique card IDs
  const cardIdCounter = useRef(0);

  // Buffer transcription tokens until turn_complete
  const inputTranscriptBuffer = useRef("");
  const inputLanguageBuffer = useRef("");
  const outputTranscriptBuffer = useRef("");
  const outputLanguageBuffer = useRef("");

  // Track whether the current turn has been flushed (for late transcriptions)
  const turnFlushedRef = useRef(false);

  // Pending visual noun cards for the current turn
  const pendingCardsRef = useRef<VisualNounCard[]>([]);

  const connect = useCallback(() => {
    if (!token || ws.current?.readyState === WebSocket.OPEN) return;

    const thisConnectionId = ++connectionId.current;

    try {
      const socket = new WebSocket(`${config.visualNounUrl}/ws`);
      ws.current = socket;

      socket.onopen = () => {
        if (connectionId.current !== thisConnectionId) return;
        console.log("Visual Noun WebSocket connection established");
        setIsConnected(true);
        setError(null);
        reconnectAttempt.current = 0;
        socket.send(JSON.stringify({ type: "auth", token }));
      };

      socket.onmessage = (event) => {
        if (connectionId.current !== thisConnectionId) return;
        try {
          const msg = JSON.parse(event.data) as VisualNounDownstreamMessage;

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
              if (msg.name === "show_visual_noun") {
                const newCard: VisualNounCard = {
                  id: `vn_${++cardIdCounter.current}_${Date.now()}`,
                  term: msg.args.term || "",
                  translatedTerm: msg.args.translated_term || "",
                  briefExplanation: msg.args.brief_explanation || "",
                  imageUrl: null,
                  timestamp: Date.now(),
                };
                pendingCardsRef.current.push(newCard);
                setVisualNounCards(prev => [...prev, newCard]);
              }
              break;

            case "visual_noun_card":
              if (msg.data && msg.data.term) {
                const imageUrl = msg.data.status === "success" ? (msg.data.image_url || null) : null;

                // Update in pending cards
                const pendingIdx = pendingCardsRef.current.findIndex(
                  c => c.term === msg.data.term && c.imageUrl === null
                );
                if (pendingIdx >= 0) {
                  pendingCardsRef.current[pendingIdx] = {
                    ...pendingCardsRef.current[pendingIdx],
                    imageUrl,
                  };
                }

                // Update in flat visualNounCards array
                setVisualNounCards(prev => {
                  const idx = prev.findIndex(
                    c => c.term === msg.data.term && c.imageUrl === null
                  );
                  if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], imageUrl };
                    return updated;
                  }
                  return prev;
                });

                // Update in already-flushed transcripts (image may arrive after turn_complete)
                setTranscripts(prev => {
                  let changed = false;
                  const updated = prev.map(t => {
                    if (!t.cards) return t;
                    const cardIdx = t.cards.findIndex(
                      c => c.term === msg.data.term && c.imageUrl === null
                    );
                    if (cardIdx >= 0) {
                      changed = true;
                      const newCards = [...t.cards];
                      newCards[cardIdx] = { ...newCards[cardIdx], imageUrl };
                      return { ...t, cards: newCards };
                    }
                    return t;
                  });
                  return changed ? updated : prev;
                });
              }
              break;

            case "transcription":
              console.log("[WS] transcription received:", msg.role, msg.language, msg.text?.substring(0, 50));
              if (msg.text.trim()) {
                if (msg.role === "user") {
                  inputTranscriptBuffer.current = msg.text;
                  inputLanguageBuffer.current = msg.language;
                  turnFlushedRef.current = false;
                  setAgentStatus("thinking");
                } else {
                  if (turnFlushedRef.current) {
                    // Late output transcription arrived after turn_complete — append directly
                    setTranscripts(prev => [...prev, {
                      role: "agent" as const,
                      language: msg.language,
                      text: msg.text,
                      timestamp: Date.now(),
                    }]);
                  } else {
                    outputTranscriptBuffer.current = msg.text;
                    outputLanguageBuffer.current = msg.language;
                  }
                }
              }
              break;

            case "turn_complete": {
              const inputText = inputTranscriptBuffer.current.trim();
              const inputLang = inputLanguageBuffer.current || "EN";
              const outputText = outputTranscriptBuffer.current.trim();
              const outputLang = outputLanguageBuffer.current || "EN";
              const cardsForTurn = pendingCardsRef.current.length > 0
                ? [...pendingCardsRef.current]
                : undefined;

              if (inputText || outputText) {
                setTranscripts(prev => {
                  const next = [...prev];
                  if (inputText) next.push({ role: "user", language: inputLang, text: inputText, timestamp: Date.now() });
                  if (outputText) next.push({ role: "agent", language: outputLang, text: outputText, timestamp: Date.now(), cards: cardsForTurn });
                  return next;
                });
              }
              inputTranscriptBuffer.current = "";
              inputLanguageBuffer.current = "";
              outputTranscriptBuffer.current = "";
              outputLanguageBuffer.current = "";
              pendingCardsRef.current = [];
              turnFlushedRef.current = true;
              setIsTurnComplete(true);
              break;
            }

            case "interrupted": {
              const intInputText = inputTranscriptBuffer.current.trim();
              const intInputLang = inputLanguageBuffer.current || "EN";
              const intOutputText = outputTranscriptBuffer.current.trim();
              const intOutputLang = outputLanguageBuffer.current || "EN";
              const intCards = pendingCardsRef.current.length > 0
                ? [...pendingCardsRef.current]
                : undefined;

              if (intInputText || intOutputText) {
                setTranscripts(prev => {
                  const next = [...prev];
                  if (intInputText) next.push({ role: "user", language: intInputLang, text: intInputText, timestamp: Date.now() });
                  if (intOutputText) next.push({ role: "agent", language: intOutputLang, text: intOutputText, timestamp: Date.now(), cards: intCards });
                  return next;
                });
              }
              inputTranscriptBuffer.current = "";
              inputLanguageBuffer.current = "";
              outputTranscriptBuffer.current = "";
              outputLanguageBuffer.current = "";
              pendingCardsRef.current = [];
              turnFlushedRef.current = true;
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
          }, 2000);
        }
      };

      socket.onerror = (err) => {
        console.error("Visual Noun WebSocket Error", err);
      };
    } catch (err) {
      console.error("Failed to establish websocket connection", err);
    }
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      connectionId.current++;
      if (ws.current) {
        ws.current.onclose = null;
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
    if (ws.current) {
      ws.current.close();
    }
  }, []);

  const clearAudioQueue = useCallback(() => {
    audioQueueRef.current = [];
  }, []);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setVisualNounCards([]);
  }, []);

  return {
    isConnected,
    isAuthenticated,
    uid,
    sessionId,
    sendMessage,
    visualNounCards,
    transcripts,
    agentStatus,
    setAgentStatus,
    error,
    disconnect,
    audioQueue: audioQueueRef.current,
    clearAudioQueue,
    clearTranscripts,
    audioTrigger,
    isTurnComplete,
  };
}
