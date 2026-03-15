"use client";

import React from "react";
import { ConversationSummary } from "@/hooks/useConversationHistory";

interface ConversationHistoryListProps {
  conversations: ConversationSummary[];
  loading: boolean;
  error: string | null;
  onSelect: (sessionId: string) => void;
}

function formatTimestamp(ts: any): string {
  if (!ts) return "";
  // Firestore timestamps come as {_seconds, _nanoseconds} or ISO string
  const date = ts._seconds
    ? new Date(ts._seconds * 1000)
    : new Date(ts);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConversationHistoryList({
  conversations,
  loading,
  error,
  onSelect,
}: ConversationHistoryListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1D9E75]" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-400 text-center py-4">
        Failed to load history: {error}
      </p>
    );
  }

  if (conversations.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        No past conversations yet.
      </p>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto mt-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Past Conversations
      </h3>
      <div className="space-y-2">
        {conversations.map((c) => (
          <button
            key={c.session_id}
            onClick={() => onSelect(c.session_id)}
            className="w-full text-left px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-[#1D9E75] hover:shadow-sm transition-all group"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-gray-800 font-medium truncate flex-1">
                {c.summary || "Untitled conversation"}
              </p>
              <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                {formatTimestamp(c.created_at)}
              </span>
            </div>
            <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
              <span>{Math.floor(c.message_count / 2)} turns</span>
              {c.card_count > 0 && <span>{c.card_count} cards</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
