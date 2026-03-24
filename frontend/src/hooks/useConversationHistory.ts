import { useState, useCallback } from "react";
import { config } from "../lib/config";
import { Transcript, VisualNounCard } from "../types/messages";

export interface ConversationSummary {
  session_id: string;
  summary: string;
  created_at: any;
  message_count: number;
  card_count: number;
}

interface Turn {
  input?: {
    role: string;
    language: string;
    text: string;
    timestamp: number;
  };
  output?: {
    role: string;
    language: string;
    text: string;
    timestamp: number;
    cards?: Array<{
      term: string;
      translated_term: string;
      brief_explanation: string;
      gcs_path: string;
      image_url?: string;
    }>;
  };
}

function turnsToTranscripts(turns: Turn[]): Transcript[] {
  const transcripts: Transcript[] = [];
  for (const turn of turns) {
    if (turn.input?.text) {
      transcripts.push({
        role: "user",
        language: turn.input.language,
        text: turn.input.text,
        timestamp: turn.input.timestamp,
      });
    }
    if (turn.output?.text) {
      const cards: VisualNounCard[] | undefined = turn.output.cards?.map((c, i) => ({
        id: `history_${i}_${turn.output!.timestamp}`,
        term: c.term,
        translatedTerm: c.translated_term,
        briefExplanation: c.brief_explanation,
        imageUrl: c.image_url || null,
        timestamp: turn.output!.timestamp,
      }));
      transcripts.push({
        role: "agent",
        language: turn.output.language,
        text: turn.output.text,
        timestamp: turn.output.timestamp,
        cards: cards && cards.length > 0 ? cards : undefined,
      });
    }
  }
  return transcripts;
}

export function useConversationHistory() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${config.apiUrl}/api/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConversation = useCallback(async (token: string, sessionId: string): Promise<Transcript[]> => {
    const res = await fetch(`${config.apiUrl}/api/conversations/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return turnsToTranscripts(data.turns || []);
  }, []);

  return { conversations, loading, error, fetchConversations, fetchConversation };
}
