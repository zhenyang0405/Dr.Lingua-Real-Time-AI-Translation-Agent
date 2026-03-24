"use client";

import React from "react";
import { VisualNounCard } from "@/types/messages";

/* ─── Single image lightbox ─── */

interface ImageLightboxProps {
  card: VisualNounCard;
  onClose: () => void;
}

export function ImageLightbox({ card, onClose }: ImageLightboxProps) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl p-5 max-w-[460px] w-full shadow-2xl">
        <div
          className="text-[13px] text-gray-500 cursor-pointer text-right mb-2 hover:text-gray-800"
          onClick={onClose}
        >
          Close
        </div>
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt={card.translatedTerm}
            className="w-full rounded-lg mb-3"
          />
        ) : (
          <div className="w-full h-[200px] bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D9E75]" />
          </div>
        )}
        <div className="text-[15px] font-medium text-gray-900 mb-0.5">
          {card.translatedTerm}
        </div>
        <div className="text-[13px] text-gray-500">
          {card.term} — {card.briefExplanation}
        </div>
      </div>
    </div>
  );
}

/* ─── Gallery lightbox ─── */

interface GalleryLightboxProps {
  cards: VisualNounCard[];
  onClose: () => void;
  onSelect: (card: VisualNounCard) => void;
}

export function GalleryLightbox({ cards, onClose, onSelect }: GalleryLightboxProps) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl p-5 max-w-[460px] w-full shadow-2xl">
        <div
          className="text-[13px] text-gray-500 cursor-pointer text-right mb-2 hover:text-gray-800"
          onClick={onClose}
        >
          Close
        </div>
        <p className="text-[15px] font-medium mb-3">All visual references</p>
        <div className="grid grid-cols-3 gap-1.5">
          {cards.map((card) => (
            <div
              key={card.id}
              className="aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:opacity-85 relative"
              onClick={() => onSelect(card)}
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
              <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-center text-white text-[9px] font-medium"
                style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.65))" }}
              >
                {card.translatedTerm}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
