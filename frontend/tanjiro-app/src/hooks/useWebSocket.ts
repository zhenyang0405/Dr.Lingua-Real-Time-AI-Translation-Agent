import { useCallback, useRef, useState } from 'react';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export type MessageHandler = (data: Record<string, unknown>) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(
    (userId: string, sessionId: string) => {
      if (wsRef.current) return;

      setConnectionState('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${userId}/${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setConnectionState('disconnected');
      };

      ws.onerror = () => {
        ws.close();
      };
    },
    [onMessage],
  );

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionState('disconnected');
  }, []);

  const sendAudio = useCallback((base64: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ audio: base64 }));
    }
  }, []);

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text }));
    }
  }, []);

  return { connectionState, connect, disconnect, sendAudio, sendText };
}
