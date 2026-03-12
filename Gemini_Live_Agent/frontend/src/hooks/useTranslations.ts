import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { TranslationDoc } from "../types/messages";

export function useTranslations(uid: string | null, docName: string | null) {
  const [translations, setTranslations] = useState<TranslationDoc[]>([]);

  useEffect(() => {
    console.log(`[useTranslations] Effect triggered. uid=${uid}, docName=${docName}`);
    if (!uid || !docName) {
      console.log("[useTranslations] Missing uid or docName. Not setting up listener.");
      return;
    }

    // Path: translations/{uid}/{docName}
    console.log(`[useTranslations] Setting up Firestore listener for path: translations/${uid}/${docName}`);
    const q = query(
      collection(db, "translations", uid, docName),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[useTranslations] Received snapshot with size: ${snapshot.size}`);
      const docs = snapshot.docs.map((doc) => {
        const data = doc.data();
        console.log(`[useTranslations] Doc ${doc.id}:`, data);
        return {
          id: doc.id,
          ...data,
        };
      }) as TranslationDoc[];
      setTranslations(docs);
    }, (error) => {
      console.error("[useTranslations] Firestore listener error:", error);
    });

    return () => unsubscribe();
  }, [uid, docName]);

  return translations;
}
