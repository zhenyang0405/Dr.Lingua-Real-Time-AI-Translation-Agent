import React, { useEffect, useRef } from 'react';
import { useWebSocketContext } from './WebSocketManager';
import { AnnotationCard } from './AnnotationCard';

export const AnnotationPanel: React.FC = () => {
  const { annotations } = useWebSocketContext();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto scroll to bottom when new annotations arrive
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [annotations]);

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-white border-b border-gray-200 p-3 z-10">
        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
          <span>🧠</span> Concept Annotations
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
        {annotations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
             <div className="text-4xl">📚</div>
             <p className="text-gray-500 text-sm">
               Translations will appear here.<br/>
               Ask Dr. Lingua to translate a section of your document or explain a diagram label.
             </p>
          </div>
        ) : (
          <div className="space-y-4">
            {annotations.map((item) => (
              <AnnotationCard key={item.id} item={item} />
            ))}
            <div ref={bottomRef} className="h-4" />
          </div>
        )}
      </div>
    </div>
  );
};
