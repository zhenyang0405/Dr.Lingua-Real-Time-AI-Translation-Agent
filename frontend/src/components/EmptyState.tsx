"use client";

import React from "react";

export default function EmptyState() {
  return (
    <div className="text-center mb-8">
      <div className="bg-[#E1F5EE] p-6 rounded-full mb-6 inline-block">
        <span className="text-5xl">🎙️</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Ready to Translate</h2>
      <p className="text-gray-500 max-w-md mx-auto text-sm leading-relaxed">
        Start speaking and the interpreter will translate in real-time.
        Culturally-specific terms will appear as visual cards.
      </p>
    </div>
  );
}
