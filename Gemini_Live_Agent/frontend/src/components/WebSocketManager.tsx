import React, { createContext, useContext, ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { UpstreamMessage, AnnotationItem } from '../types/messages';
import { Transcript } from '../hooks/useWebSocket';

interface WebSocketContextProps {
  isConnected: boolean;
  isAuthenticated: boolean;
  sendMessage: (msg: UpstreamMessage) => void;
  annotations: AnnotationItem[];
  transcripts: Transcript[];
  agentStatus: "idle" | "speaking" | "thinking";
  setAgentStatus: (status: "idle" | "speaking" | "thinking") => void;
  error: string | null;
  disconnect: () => void;
  audioTrigger: number;
  audioQueue: string[];
  clearAudioQueue: () => void;
}

const WebSocketContext = createContext<WebSocketContextProps | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode; token: string | null }> = ({ children, token }) => {
  const wsState = useWebSocket(token);

  return (
    <WebSocketContext.Provider value={wsState}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};
