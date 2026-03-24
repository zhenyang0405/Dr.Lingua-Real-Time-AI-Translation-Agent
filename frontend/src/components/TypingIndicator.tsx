"use client";

import React from "react";

export default function TypingIndicator() {
  return (
    <div className="inline-flex gap-1 items-center py-1.5">
      {[0, 0.15, 0.3].map((delay, i) => (
        <span
          key={i}
          className="w-[5px] h-[5px] rounded-full bg-gray-400"
          style={{ animation: `typeBounce 1.2s infinite`, animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}
