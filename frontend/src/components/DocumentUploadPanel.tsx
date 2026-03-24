"use client";
import React, { useRef, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";

export interface UploadedDoc {
  id: string;
  name: string;
  pages: string[]; // base64 JPEG strings, one per page
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

interface DocumentUploadPanelProps {
  docs: UploadedDoc[];
  activeDocId: string | null;
  onDocAdded: (doc: UploadedDoc) => void;
  onDocClick: (doc: UploadedDoc) => void;
  onDocsLoaded: (docs: UploadedDoc[]) => void;
}

/** Render a PDF (fetched from a signed URL) into an array of base64 JPEG strings. */
async function renderPdfPages(pdfUrl: string): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  // Use the locally-served worker (copied from node_modules to public/)
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    pages.push(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
  }
  return pages;
}

/** Fetch an image from a signed URL and convert to base64. */
async function renderImagePage(signedUrl: string): Promise<string[]> {
  const res = await fetch(signedUrl);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const b64 = (e.target?.result as string).split(",")[1];
      resolve([b64]);
    };
    reader.readAsDataURL(blob);
  });
}

export const DocumentUploadPanel: React.FC<DocumentUploadPanelProps> = ({
  docs,
  activeDocId,
  onDocAdded,
  onDocClick,
  onDocsLoaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingDocId, setLoadingDocId] = React.useState<string | null>(null);
  const { getIdToken } = useAuth();

  // Load existing docs on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch(`${API_URL}/api/documents`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        // Return stubs — pages will be loaded lazily when clicked
        const stubs: UploadedDoc[] = (data.documents ?? []).map(
          (d: { doc_id: string; filename: string }) => ({
            id: d.doc_id,
            name: d.filename,
            pages: [], // loaded on click
          })
        );
        if (stubs.length > 0) onDocsLoaded(stubs);
      } catch {
        // Silently ignore — backend may not be running locally
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Upload the file to the backend, get signed URL, render pages. */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const token = await getIdToken();

      // 1. Upload to GCS via backend
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch(`${API_URL}/api/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.detail ?? "Upload failed");
      }
      const { doc_id, filename } = await uploadRes.json();

      // 2. Get signed URL
      const urlRes = await fetch(
        `${API_URL}/api/documents/${encodeURIComponent(doc_id)}/url`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!urlRes.ok) throw new Error("Failed to get signed URL");
      const { signed_url } = await urlRes.json();

      // 3. Render pages from the signed URL
      let pages: string[];
      if (file.type === "application/pdf") {
        pages = await renderPdfPages(signed_url);
      } else {
        pages = await renderImagePage(signed_url);
      }

      const doc: UploadedDoc = { id: doc_id, name: filename, pages };
      onDocAdded(doc);
      onDocClick(doc);
    } catch (err) {
      console.error("Document upload failed:", err);
      alert(`Upload failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /** Load pages for a stub doc (loaded from the existing-docs list) on click. */
  const handleDocClick = async (doc: UploadedDoc) => {
    if (doc.pages.length > 0) {
      onDocClick(doc);
      return;
    }
    // Lazily fetch pages for existing doc
    setLoadingDocId(doc.id);
    try {
      const token = await getIdToken();
      const urlRes = await fetch(
        `${API_URL}/api/documents/${encodeURIComponent(doc.id)}/url`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!urlRes.ok) throw new Error("Failed to get signed URL");
      const { signed_url } = await urlRes.json();

      const isPdf = doc.name.toLowerCase().endsWith(".pdf");
      const pages = isPdf
        ? await renderPdfPages(signed_url)
        : await renderImagePage(signed_url);

      const loaded: UploadedDoc = { ...doc, pages };
      onDocAdded(loaded); // update parent state
      onDocClick(loaded);
    } catch (err) {
      console.error("Failed to load document pages:", err);
    } finally {
      setLoadingDocId(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded transition-colors whitespace-nowrap ${
            loading
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 text-white"
          }`}
        >
          {loading ? (
            <><span className="animate-spin">⏳</span> Uploading...</>
          ) : (
            <>📄 Upload Doc</>
          )}
        </button>
        {docs.length === 0 && !loading && (
          <span className="text-xs text-gray-400">PDF or image</span>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Document list */}
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => handleDocClick(doc)}
              disabled={loadingDocId === doc.id}
              title={doc.name}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left transition-colors max-w-[200px] ${
                activeDocId === doc.id
                  ? "bg-indigo-100 text-indigo-800 font-semibold border border-indigo-300"
                  : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-200"
              } ${loadingDocId === doc.id ? "opacity-60 cursor-wait" : ""}`}
            >
              <span className="shrink-0">
                {loadingDocId === doc.id ? "⏳" : doc.name.toLowerCase().endsWith(".pdf") ? "📄" : "🖼️"}
              </span>
              <span className="truncate">{doc.name}</span>
              {doc.pages.length > 0 && (
                <span className="ml-auto shrink-0 text-gray-400 pl-1">{doc.pages.length}p</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

