"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { VisualNounWebSocketProvider } from "@/components/VisualNounWebSocketProvider";
import TopBar from "@/components/TopBar";
import ConversationContent from "@/components/ConversationContent";

export default function ConversationPage() {
  const { uid, loading, getIdToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (uid && !loading) {
      getIdToken().then(setToken).catch(console.error);
    }
  }, [uid, loading, getIdToken]);

  if (loading || !token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] text-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1D9E75]"></div>
        <p className="mt-4 font-medium text-gray-500">Authenticating...</p>
      </main>
    );
  }

  return (
    <VisualNounWebSocketProvider token={token}>
      <main className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden">
        <TopBar />
        <ConversationContent />
      </main>
    </VisualNounWebSocketProvider>
  );
}
