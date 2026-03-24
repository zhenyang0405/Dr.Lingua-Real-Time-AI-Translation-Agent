import React, { createContext, useContext, ReactNode } from 'react';
import { useVisualNounWebSocket } from '../hooks/useVisualNounWebSocket';
import { UpstreamMessage, VisualNounCard, Transcript } from '../types/messages';

interface WebSocketContextProps {
  isConnected: boolean;
  isAuthenticated: boolean;
  uid: string | null;
  sessionId: string | null;
  sendMessage: (msg: UpstreamMessage) => void;
  transcripts: Transcript[];
  visualNounCards: VisualNounCard[];
  agentStatus: "idle" | "speaking" | "thinking" | "interrupted";
  setAgentStatus: (status: "idle" | "speaking" | "thinking" | "interrupted") => void;
  error: string | null;
  disconnect: () => void;
  audioTrigger: number;
  audioQueue: string[];
  clearAudioQueue: () => void;
  clearTranscripts: () => void;
  isTurnComplete: boolean;
}

const WebSocketContext = createContext<WebSocketContextProps | undefined>(undefined);

export const VisualNounWebSocketProvider: React.FC<{ children: ReactNode; token: string | null }> = ({ children, token }) => {
  const wsState = useVisualNounWebSocket(token);

  const context: WebSocketContextProps = {
    isConnected: wsState.isConnected,
    isAuthenticated: wsState.isAuthenticated,
    uid: wsState.uid,
    sessionId: wsState.sessionId,
    sendMessage: wsState.sendMessage,
    transcripts: wsState.transcripts,
    visualNounCards: wsState.visualNounCards,
    agentStatus: wsState.agentStatus,
    setAgentStatus: wsState.setAgentStatus,
    error: wsState.error,
    disconnect: wsState.disconnect,
    audioTrigger: wsState.audioTrigger,
    audioQueue: wsState.audioQueue,
    clearAudioQueue: wsState.clearAudioQueue,
    clearTranscripts: wsState.clearTranscripts,
    isTurnComplete: wsState.isTurnComplete,
  };

  return (
    <WebSocketContext.Provider value={context}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a VisualNounWebSocketProvider');
  }
  return context;
};
