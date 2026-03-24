"use client";

import React from "react";
import { Transcript, VisualNounCard } from "@/types/messages";
import InlineImageRow from "@/components/InlineImageRow";

interface MessageBubbleProps {
  transcript: Transcript;
  sender: string;
  icon: string;
  delay: number;
  onThumbClick: (card: VisualNounCard) => void;
  onStackClick: (cards: VisualNounCard[]) => void;
}

export default function MessageBubble({
  transcript,
  sender,
  icon,
  delay,
  onThumbClick,
  onStackClick,
}: MessageBubbleProps) {
  const time = new Date(transcript.timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  // Detect if text is CJK-heavy for font hint
  const isCJK = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(transcript.text);

  return (
    <div
      className="mb-5"
      style={{ animation: `fadeUp 0.4s ease both`, animationDelay: `${delay}s` }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[13px] font-medium text-gray-400 uppercase tracking-wider">
          {sender}
        </span>
        <span className="text-[13px] text-gray-400">{time}</span>
        <span className="text-[13px]">{icon}</span>
      </div>
      <div
        className={`text-[18px] leading-relaxed text-gray-900 ${
          isCJK ? "font-[system-ui,'Noto_Sans_JP',sans-serif]" : ""
        }`}
      >
        {transcript.text}
      </div>
      {transcript.cards && transcript.cards.length > 0 && (
        <InlineImageRow
          cards={transcript.cards}
          onThumbClick={onThumbClick}
          onStackClick={onStackClick}
        />
      )}
    </div>
  );
}
