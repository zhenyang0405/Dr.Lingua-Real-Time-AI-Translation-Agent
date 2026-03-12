import React, { useRef, useState, useEffect } from 'react';
import { useWebSocketContext } from './WebSocketManager';

export const ScreenSharePanel: React.FC = () => {
  const { sendMessage, isConnected } = useWebSocketContext();
  const [isSharing, setIsSharing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isSharing) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = videoRef.current;
    
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
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex bg-gray-50 border-b border-gray-200 p-3 justify-between items-center">
         <h2 className="font-semibold text-gray-700 items-center justify-center flex gap-2">📺 Screen Share</h2>
         <button 
           onClick={isSharing ? stopSharing : startSharing}
           disabled={!isConnected}
           className={`px-4 py-2 font-semibold text-white rounded text-sm transition-colors ${
             !isConnected ? 'bg-gray-400 cursor-not-allowed' :
             isSharing ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
           }`}
         >
           {isSharing ? 'Stop Sharing' : 'Share Screen'}
         </button>
      </div>

      <div className="flex-1 min-h-[400px] relative bg-slate-900 group flex items-center justify-center overflow-hidden">
         {!isSharing && (
           <div className="text-gray-400 font-medium">
             Share your screen to get started
           </div>
         )}
         <video 
           ref={videoRef} 
           autoPlay 
           playsInline 
           muted 
           className={`max-w-full max-h-full object-contain ${!isSharing && 'hidden'}`}
         />
         {/* Hidden canvas for image extraction */}
         <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};
