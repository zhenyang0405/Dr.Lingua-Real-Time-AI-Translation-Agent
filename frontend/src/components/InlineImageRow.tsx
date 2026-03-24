"use client";

import React from "react";
import { VisualNounCard } from "@/types/messages";

interface InlineImageRowProps {
  cards: VisualNounCard[];
  onThumbClick: (card: VisualNounCard) => void;
  onStackClick: (cards: VisualNounCard[]) => void;
}

export default function InlineImageRow({ cards, onThumbClick, onStackClick }: InlineImageRowProps) {
  const visible = cards.slice(0, 2);
  const overflow = cards.length > 2 ? cards.slice(2) : null;

  return (
    <div className="flex gap-1.5 mt-2 items-start flex-nowrap">
      {visible.map((card) => (
        <div
          key={card.id}
          className="w-[90px] h-[90px] rounded-lg overflow-hidden cursor-pointer relative border border-gray-200 shrink-0 transition-transform hover:scale-105"
          onClick={() => onThumbClick(card)}
        >
          {card.imageUrl ? (
            <img
              src={card.imageUrl}
              alt={card.translatedTerm}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1D9E75]" />
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-center text-white text-[10px] font-medium leading-tight"
            style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.65))" }}
          >
            {card.translatedTerm}
          </div>
        </div>
      ))}

      {overflow && overflow.length > 0 && (
        <div
          className="relative w-[90px] h-[90px] shrink-0 cursor-pointer"
          onClick={() => onStackClick(cards)}
        >
          {/* Back card */}
          <div className="absolute top-1 left-1 w-[90px] h-[90px] rounded-lg overflow-hidden border border-gray-200 bg-gray-400" />
          {/* Front card */}
          <div className="absolute top-0 left-0 w-[90px] h-[90px] rounded-lg overflow-hidden border border-gray-200">
            {overflow[0].imageUrl ? (
              <img
                src={overflow[0].imageUrl}
                alt={overflow[0].translatedTerm}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-100" />
            )}
            <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-center text-white text-[10px] font-medium leading-tight"
              style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.65))" }}
            >
              {overflow[0].translatedTerm}
            </div>
          </div>
          {/* Badge */}
          <div className="absolute -top-1 -right-1 z-10 bg-[#D85A30] text-white text-[10px] font-medium w-5 h-5 rounded-full flex items-center justify-center">
            +{overflow.length}
          </div>
        </div>
      )}
    </div>
  );
}
