import React, { useEffect, useState } from 'react';
import { useWebSocketContext } from './WebSocketManager';
import { Transcript } from '../hooks/useWebSocket';

export const TranscriptDisplay: React.FC = () => {
  const { transcripts, agentStatus } = useWebSocketContext();
  const [activeTranscripts, setActiveTranscripts] = useState<Transcript[]>([]);
  const [showInterrupted, setShowInterrupted] = useState(false);
  
  // Only show recent transcripts (fade out after 5 seconds)
  useEffect(() => {
    setActiveTranscripts(transcripts.slice(-2)); // Keep max 2
    
    // Auto-clear logic: remove items older than 5 seconds
    const interval = setInterval(() => {
        const now = Date.now();
        setActiveTranscripts(prev => prev.filter(t => now - t.timestamp < 5000));
    }, 1000);

    return () => clearInterval(interval);
  }, [transcripts]);

  useEffect(() => {
    if (agentStatus === "interrupted") {
      setShowInterrupted(true);
      const timer = setTimeout(() => setShowInterrupted(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [agentStatus]);

  if (activeTranscripts.length === 0 && !showInterrupted) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 pointer-events-none flex justify-center z-50">
      <div className="bg-black/80 backdrop-blur text-white px-6 py-3 rounded-full shadow-lg max-w-4xl w-full mx-auto flex gap-6 items-center flex-wrap animate-in slide-in-from-bottom duration-300">
         {showInterrupted && (
           <div className="flex gap-2 items-center text-red-400 font-medium animate-pulse">
             <span>✋</span>
             <span>Agent interrupted</span>
           </div>
         )}
         {activeTranscripts.map((t, idx) => (
             <div 
               key={t.timestamp + idx} 
               className={`flex-1 flex gap-2 overflow-hidden ${t.role === 'user' ? 'text-gray-300 border-r border-gray-600 pr-6' : 'text-green-400 pl-2 font-medium'}`}
             >
                 <span className="shrink-0">{t.role === 'user' ? '🎤' : '🔊'}</span>
                 <span className="truncate" title={t.text}>{t.text}</span>
             </div>
         ))}
      </div>
    </div>
  );
};
