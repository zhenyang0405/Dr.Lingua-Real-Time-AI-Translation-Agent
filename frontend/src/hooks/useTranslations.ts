import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../components/AuthProvider";
import { TranslationDoc } from "../types/messages";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export function useTranslations(uid: string | null, docName: string | null) {
  const [translations, setTranslations] = useState<TranslationDoc[]>([]);
  const { getIdToken } = useAuth();
  const signedUrlCache = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!uid || !docName) return;

    const q = query(
      collection(db, "translations", uid, docName),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TranslationDoc[];

      // Find docs with gcs_path that need fresh signed URLs
      const needsSigning = docs.some(
        (d) => d.gcs_path && !signedUrlCache.current[d.id]
      );

      if (needsSigning) {
        try {
          const token = await getIdToken();
          const res = await fetch(
            `${API_URL}/api/documents/translations/${encodeURIComponent(docName)}/sign-urls`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.ok) {
            const data = await res.json();
            signedUrlCache.current = {
              ...signedUrlCache.current,
              ...data.signed_urls,
            };
          }
        } catch (e) {
          console.error("[useTranslations] Failed to re-sign URLs:", e);
        }
      }

      // Apply cached signed URLs
      const enriched = docs.map((d) => {
        if (d.gcs_path && signedUrlCache.current[d.id]) {
          return { ...d, image_url: signedUrlCache.current[d.id] };
        }
        return d;
      });

      setTranslations(enriched);
    }, (error) => {
      console.error("[useTranslations] Firestore listener error:", error);
    });

    return () => unsubscribe();
  }, [uid, docName, getIdToken]);

  return translations;
}
