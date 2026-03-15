"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useWebSocketContext } from "@/components/VisualNounWebSocketProvider";
import EmptyState from "@/components/EmptyState";
import MicBar from "@/components/MicBar";
import TwoColumnTranscript from "@/components/TwoColumnTranscript";
import ConversationHistoryList from "@/components/ConversationHistoryList";
import { useConversationHistory } from "@/hooks/useConversationHistory";
import { Transcript } from "@/types/messages";

export default function ConversationContent() {
  const { transcripts, agentStatus } = useWebSocketContext();
  const { getIdToken } = useAuth();
  const { conversations, loading, error, fetchConversations, fetchConversation } = useConversationHistory();
  const [selectedTranscripts, setSelectedTranscripts] = useState<Transcript[] | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load conversation list on mount
  useEffect(() => {
    getIdToken().then(fetchConversations).catch(console.error);
  }, [getIdToken, fetchConversations]);

  const handleSelect = useCallback(async (sessionId: string) => {
    setLoadingDetail(true);
    try {
      const token = await getIdToken();
      const transcripts = await fetchConversation(token, sessionId);
      setSelectedTranscripts(transcripts);
    } catch (e) {
      console.error("Failed to load conversation:", e);
    } finally {
      setLoadingDetail(false);
    }
  }, [getIdToken, fetchConversation]);

  const handleBack = useCallback(() => {
    setSelectedTranscripts(null);
  }, []);

  // Live conversation active — show live view
  if (transcripts.length > 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TwoColumnTranscript transcripts={transcripts} agentStatus={agentStatus} />
        <MicBar />
      </div>
    );
  }

  // Viewing a past conversation
  if (selectedTranscripts) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="text-sm text-[#1D9E75] hover:text-[#167a5b] font-medium flex items-center gap-1"
          >
            <span>&larr;</span> Back
          </button>
          <span className="text-sm text-gray-400">Past Conversation</span>
        </div>
        <TwoColumnTranscript transcripts={selectedTranscripts} agentStatus="idle" />
      </div>
    );
  }

  // Empty state + history list
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <EmptyState />
        {loadingDetail ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1D9E75]" />
          </div>
        ) : (
          <ConversationHistoryList
            conversations={conversations}
            loading={loading}
            error={error}
            onSelect={handleSelect}
          />
        )}
      </div>
      <MicBar />
    </div>
  );
}
