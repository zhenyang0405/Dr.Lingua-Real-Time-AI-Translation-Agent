"use client";
import React, { useEffect, useRef, useState } from "react";
import { useWebSocketContext } from "./WebSocketManager";
import { UploadedDoc } from "./DocumentUploadPanel";

interface DocumentViewerPanelProps {
  doc: UploadedDoc;
  onClose: () => void;
}

interface Selection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export const DocumentViewerPanel: React.FC<DocumentViewerPanelProps> = ({
  doc,
  onClose,
}) => {
  const { sendMessage, isConnected } = useWebSocketContext();
  const [currentPage, setCurrentPage] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const sendFrameRef = useRef<(() => void) | undefined>(undefined);

  const totalPages = doc.pages.length;
  const currentBase64 = doc.pages[currentPage];

  // Notify backend of active document
  useEffect(() => {
    if (isConnected) {
      sendMessage({ type: "set_document", doc_name: doc.name });
    }
  }, [doc.name, isConnected, sendMessage]);

  // Send document frame to backend on interval
  useEffect(() => {
    if (!isConnected) return;

    const sendFrame = () => {
      if (!doc.pages[currentPage]) return;
      const base64Image = doc.pages[currentPage];

      // Compute normalized selection coords for backend cropping
      const selectionCoords = selection ? {
        x: Math.min(selection.startX, selection.endX),
        y: Math.min(selection.startY, selection.endY),
        width: Math.abs(selection.endX - selection.startX),
        height: Math.abs(selection.endY - selection.startY),
      } : undefined;

      if (!selection) {
        sendMessage({ type: "document_frame", data: base64Image });
        return;
      }

      // Draw box on canvas so the Live agent can see the selection visually
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Draw selection box
        const x = Math.min(selection.startX, selection.endX) * img.width;
        const y = Math.min(selection.startY, selection.endY) * img.height;
        const width = Math.abs(selection.endX - selection.startX) * img.width;
        const height = Math.abs(selection.endY - selection.startY) * img.height;

        ctx.fillStyle = "rgba(255, 255, 0, 0.3)"; // Yellow semi-transparent
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
        ctx.lineWidth = Math.max(2, img.width * 0.005);
        ctx.strokeRect(x, y, width, height);

        const newBase64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
        sendMessage({ type: "document_frame", data: newBase64, selection: selectionCoords });
      };
      img.src = `data:image/jpeg;base64,${base64Image}`;
    };

    sendFrameRef.current = sendFrame;
    sendFrame();

    intervalRef.current = setInterval(() => {
      // Don't auto-send while actively drawing the selection
      if (sendFrameRef.current && !isDrawing) {
        sendFrameRef.current();
      }
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isConnected, doc, currentPage, sendMessage, selection, isDrawing]);

  // Handle page changes gracefully without causing cascading renders in effect
  const [prevDocInfo, setPrevDocInfo] = useState({ id: doc.id, page: currentPage });
  if (prevDocInfo.id !== doc.id || prevDocInfo.page !== currentPage) {
    setSelection(null);
    setIsDrawing(false);
    setPrevDocInfo({ id: doc.id, page: currentPage });
  }

  const goToPrev = () => setCurrentPage((p) => Math.max(0, p - 1));
  const goToNext = () =>
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));

  const zoomIn = () => setScale((s) => Math.min(s + 0.1, 3.0));
  const zoomOut = () => setScale((s) => Math.max(s - 0.1, 0.5));
  const resetZoom = () => setScale(1.0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageContainerRef.current) return;
    // Right click clears selection
    if (e.button === 2) {
      setSelection(null);
      setTimeout(() => sendFrameRef.current?.(), 0);
      return;
    }
    
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setSelection({ startX: x, startY: y, endX: x, endY: y });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !selection || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setSelection({ ...selection, endX: x, endY: y });
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      // Clear if it was just a tiny click without drag
      if (
        selection &&
        Math.abs(selection.endX - selection.startX) < 0.01 &&
        Math.abs(selection.endY - selection.startY) < 0.01
      ) {
        setSelection(null);
      }
      setTimeout(() => sendFrameRef.current?.(), 0);
    }
  };

  const clearSelection = () => {
    setSelection(null);
    setTimeout(() => sendFrameRef.current?.(), 0);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex bg-gray-50 border-b border-gray-200 p-3 justify-between items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">📄</span>
          <h2
            className="font-semibold text-gray-700 truncate text-sm"
            title={doc.name}
          >
            {doc.name}
          </h2>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {selection && (
            <button
              onClick={clearSelection}
              className="px-2 py-1 text-xs font-semibold bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition-colors"
              title="Clear Selection"
            >
              Clear
            </button>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-r border-gray-300 pr-2 mr-1">
            <button
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className="p-1 px-2 text-xs font-bold bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
              title="Zoom Out"
            >
              −
            </button>
            <button
              onClick={resetZoom}
              className="px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded min-w-[45px] text-center"
              title="Reset Zoom"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              disabled={scale >= 3.0}
              className="p-1 px-2 text-xs font-bold bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40"
              title="Zoom In"
            >
              +
            </button>
          </div>

          {/* Page navigation */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrev}
                disabled={currentPage === 0}
                className="px-2 py-1 text-xs font-semibold bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹ Prev
              </button>
              <span className="text-xs text-gray-500 font-medium px-1">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={goToNext}
                disabled={currentPage === totalPages - 1}
                className="px-2 py-1 text-xs font-semibold bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next ›
              </button>
            </div>
          )}

          {/* Live frame indicator */}
          {isConnected && (
            <div className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
              </span>
              Sending
            </div>
          )}
        </div>
      </div>

      {/* Document preview */}
      <div 
        className="flex-1 relative bg-slate-100 flex overflow-auto p-4 select-none"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        {currentBase64 ? (
          <div 
            ref={imageContainerRef}
            className="relative cursor-crosshair shadow-md transition-transform duration-200 ease-out origin-top inline-block m-auto"
            style={{ transform: `scale(${scale})` }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            draggable={false}
          >
            <img
              src={`data:image/jpeg;base64,${currentBase64}`}
              alt={`Page ${currentPage + 1} of ${doc.name}`}
              className="max-w-full max-h-full object-contain rounded block"
              draggable={false}
            />
            {selection && (
              <div 
                style={{
                  position: 'absolute',
                  left: `${Math.min(selection.startX, selection.endX) * 100}%`,
                  top: `${Math.min(selection.startY, selection.endY) * 100}%`,
                  width: `${Math.abs(selection.endX - selection.startX) * 100}%`,
                  height: `${Math.abs(selection.endY - selection.startY) * 100}%`,
                  backgroundColor: 'rgba(255, 255, 0, 0.3)',
                  border: '2px solid rgba(255, 255, 0, 0.8)',
                  pointerEvents: 'none'
                }} 
              />
            )}
          </div>
        ) : (
          <div className="text-gray-400 font-medium">
            No content to display
          </div>
        )}
      </div>
    </div>
  );
};
