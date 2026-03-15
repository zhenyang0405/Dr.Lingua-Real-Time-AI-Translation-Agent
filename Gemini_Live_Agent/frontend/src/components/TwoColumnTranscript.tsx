"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Transcript, VisualNounCard } from "@/types/messages";
import { detectLanguageBadge } from "@/utils/detectLanguageBadge";
import ColumnHeader from "@/components/ColumnHeader";
import MessageBubble from "@/components/MessageBubble";
import TypingIndicator from "@/components/TypingIndicator";
import { ImageLightbox, GalleryLightbox } from "@/components/ImageLightbox";

interface TwoColumnTranscriptProps {
  transcripts: Transcript[];
  agentStatus: string;
}

export default function TwoColumnTranscript({ transcripts, agentStatus }: TwoColumnTranscriptProps) {
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const [lightboxCard, setLightboxCard] = useState<VisualNounCard | null>(null);
  const [galleryCards, setGalleryCards] = useState<VisualNounCard[] | null>(null);

  // Route transcripts by backend-detected language
  const leftTranscripts = useMemo(() => transcripts.filter(t => t.language === "EN"), [transcripts]);
  const rightTranscripts = useMemo(() => transcripts.filter(t => t.language !== "EN"), [transcripts]);

  const leftBadge = useMemo(() => {
    const first = leftTranscripts[0];
    return first ? detectLanguageBadge(first.text) : "";
  }, [leftTranscripts]);

  const rightBadge = useMemo(() => {
    const first = rightTranscripts[0];
    return first ? detectLanguageBadge(first.text) : "";
  }, [rightTranscripts]);

  // Auto-scroll both columns
  useEffect(() => {
    if (leftScrollRef.current) {
      leftScrollRef.current.scrollTop = leftScrollRef.current.scrollHeight;
    }
    if (rightScrollRef.current) {
      rightScrollRef.current.scrollTop = rightScrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  const isThinking = agentStatus === "thinking";

  return (
    <>
      <div className="flex-1 grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] overflow-hidden">
        {/* Left column — User (Speaker A) */}
        <div className="flex flex-col overflow-hidden">
          <ColumnHeader
            badge={leftBadge}
            badgeColor="en"
            title={leftBadge ? `${leftBadge} stream` : "Speaker A"}
          />
          <div ref={leftScrollRef} className="flex-1 overflow-y-auto px-5 pb-4">
            {leftTranscripts.map((t, idx) => (
              <MessageBubble
                key={`l-${t.timestamp}-${idx}`}
                transcript={t}
                sender={t.role === "user" ? "Original" : "Translation"}
                icon={t.role === "user" ? "🎤" : "🔄"}
                delay={idx * 0.05}
                onThumbClick={setLightboxCard}
                onStackClick={setGalleryCards}
              />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="bg-gray-200 relative"></div>

        {/* Right column — Agent (Speaker B) */}
        <div className="flex flex-col overflow-hidden">
          <ColumnHeader
            badge={rightBadge}
            badgeColor="jp"
            title={rightBadge ? `${rightBadge} stream` : "Speaker B"}
          />
          <div ref={rightScrollRef} className="flex-1 overflow-y-auto px-5 pb-4">
            {rightTranscripts.map((t, idx) => (
              <MessageBubble
                key={`r-${t.timestamp}-${idx}`}
                transcript={t}
                sender={t.role === "user" ? "Original" : "Translation"}
                icon={t.role === "user" ? "🎤" : "🔄"}
                delay={idx * 0.05}
                onThumbClick={setLightboxCard}
                onStackClick={setGalleryCards}
              />
            ))}
            {isThinking && <TypingIndicator />}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxCard && (
        <ImageLightbox card={lightboxCard} onClose={() => setLightboxCard(null)} />
      )}
      {galleryCards && (
        <GalleryLightbox
          cards={galleryCards}
          onClose={() => setGalleryCards(null)}
          onSelect={(card) => {
            setGalleryCards(null);
            setLightboxCard(card);
          }}
        />
      )}
    </>
  );
}
