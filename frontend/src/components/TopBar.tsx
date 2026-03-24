"use client";

import React from "react";
import Link from "next/link";
import { useWebSocketContext } from "@/components/VisualNounWebSocketProvider";

export default function TopBar() {
  const { isConnected, isAuthenticated, agentStatus } = useWebSocketContext();

  const statusLabel = !isConnected
    ? "Disconnected"
    : !isAuthenticated
    ? "Connecting..."
    : agentStatus === "speaking"
    ? "Translating"
    : agentStatus === "thinking"
    ? "Processing"
    : "Listening";

  const isActive = isConnected && isAuthenticated;

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white shrink-0">
      <div className="flex items-center gap-2.5">
        <Link
          href="/"
          className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
          title="Back to home"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="w-2.5 h-2.5 rounded-full bg-[#1D9E75] inline-block" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#D85A30] inline-block" />
        <h1 className="text-[15px] font-medium tracking-tight text-gray-900">
          Live interpreter
        </h1>
      </div>
      <div
        className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
          isActive
            ? "bg-[#E1F5EE] text-[#0F6E56]"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: isActive ? "#1D9E75" : "#9CA3AF",
            animation: isActive ? "pulse 2s infinite" : "none",
          }}
        />
        {statusLabel}
      </div>
    </header>
  );
}
