"use client";
import React, { createContext, useContext, useRef, useState, useEffect, ReactNode } from 'react';
import { useWebSocketContext } from './WebSocketManager';

interface ScreenShareContextProps {
  isSharing: boolean;
  startSharing: () => Promise<void>;
  stopSharing: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

const ScreenShareContext = createContext<ScreenShareContextProps | undefined>(undefined);

export const ScreenShareProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { sendMessage, isConnected } = useWebSocketContext();
  const [isSharing, setIsSharing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use a second ref to stay in sync with state for the interval closure
  const isSharingRef = useRef(false);
  useEffect(() => {
    isSharingRef.current = isSharing;
  }, [isSharing]);

  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsSharing(true);

      // Handle native "Stop Sharing"
      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };

      intervalRef.current = setInterval(captureFrame, 1000);
    } catch (err) {
      console.error("Error starting screen share", err);
    }
  };

  const stopSharing = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
  };

  const captureFrame = () => {
    if (!videoRef.current || !isSharingRef.current) return;

    // Create canvas if it doesn't exist (using a ref-less approach for the invisible canvas)
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      (canvasRef as any).current = canvas;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    
    // Target 768x768
    canvas.width = 768;
    canvas.height = 768;

    // Calculate aspect ratio crop/fit
    const hRatio = canvas.width / video.videoWidth;
    const vRatio = canvas.height / video.videoHeight;
    const ratio = Math.min(hRatio, vRatio);

    const centerShift_x = (canvas.width - video.videoWidth * ratio) / 2;
    const centerShift_y = (canvas.height - video.videoHeight * ratio) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight,
      centerShift_x, centerShift_y, video.videoWidth * ratio, video.videoHeight * ratio);

    const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    sendMessage({ type: "screen_frame", data: base64Data });
  };

  useEffect(() => {
    return () => {
      stopSharing();
    };
  }, []);

  return (
    <ScreenShareContext.Provider value={{ isSharing, startSharing, stopSharing, videoRef }}>
      {children}
      {/* Hidden video element to hold the stream for capturing */}
      <video ref={videoRef} autoPlay playsInline muted
        className="fixed top-0 left-0 w-px h-px opacity-0 pointer-events-none" />
    </ScreenShareContext.Provider>
  );
};

export const useScreenShare = () => {
  const context = useContext(ScreenShareContext);
  if (context === undefined) {
    throw new Error('useScreenShare must be used within a ScreenShareProvider');
  }
  return context;
};
