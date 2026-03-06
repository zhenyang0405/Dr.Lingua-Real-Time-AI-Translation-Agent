import { useCallback, useRef, useState } from 'react';
import { TanjiroCanvas } from './components/TanjiroCanvas';
import { TanjiroController } from './pixi/TanjiroController';
import { useWebSocket } from './hooks/useWebSocket';
import { AudioCapture } from './audio/AudioCapture';
import { AudioPlayback } from './audio/AudioPlayback';
import './App.css';

function App() {
  const controllerRef = useRef<TanjiroController | null>(null);
  const audioCaptureRef = useRef<AudioCapture | null>(null);
  const audioPlaybackRef = useRef<AudioPlayback | null>(null);

  const [talking, setTalking] = useState(false);
  const [thinking, setThinking] = useState(false);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    switch (data.type) {
      case 'state':
        switch (data.state) {
          case 'talking':
            setTalking(true);
            setThinking(false);
            controllerRef.current?.setTalking(true);
            break;
          case 'thinking':
            setThinking(true);
            setTalking(false);
            controllerRef.current?.setThinking(true);
            break;
          case 'happy':
            setTalking(false);
            setThinking(false);
            controllerRef.current?.playHappy();
            break;
          case 'blink':
          default:
            setTalking(false);
            setThinking(false);
            controllerRef.current?.setTalking(false);
            controllerRef.current?.setThinking(false);
            break;
        }
        break;
      case 'audio':
        audioPlaybackRef.current?.enqueue(data.data as string);
        break;
      case 'text':
        controllerRef.current?.addText(data.data as string);
        break;
      case 'interrupted':
        audioPlaybackRef.current?.flush();
        break;
      case 'turn_complete':
        controllerRef.current?.scheduleClear(1000);
        break;
    }
  }, []);

  const { connectionState, connect, disconnect, sendAudio } = useWebSocket(handleMessage);

  const handleConnect = async () => {
    if (connectionState !== 'disconnected') return;

    const userId = 'tanjiro-user';
    const sessionId = crypto.randomUUID();

    const playback = new AudioPlayback();
    audioPlaybackRef.current = playback;

    connect(userId, sessionId);

    const capture = new AudioCapture();
    capture.onData = (base64) => sendAudio(base64);
    await capture.start();
    audioCaptureRef.current = capture;
  };

  const handleDisconnect = () => {
    audioCaptureRef.current?.stop();
    audioCaptureRef.current = null;

    audioPlaybackRef.current?.close();
    audioPlaybackRef.current = null;

    disconnect();

    setTalking(false);
    setThinking(false);
    controllerRef.current?.setTalking(false);
    controllerRef.current?.setThinking(false);
  };

  // Debug controls
  const toggleTalking = () => {
    const next = !talking;
    setTalking(next);
    if (next) setThinking(false);
    controllerRef.current?.setTalking(next);
  };

  const toggleThinking = () => {
    const next = !thinking;
    setThinking(next);
    if (next) setTalking(false);
    controllerRef.current?.setThinking(next);
  };

  const triggerHappy = () => {
    setTalking(false);
    setThinking(false);
    controllerRef.current?.playHappy();
  };

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  return (
    <div className="app-container">
      <TanjiroCanvas onReady={(c) => { controllerRef.current = c; }} />

      {/* Connection status */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        display: 'flex', alignItems: 'center', gap: 8,
        color: '#fff', fontSize: 14,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: isConnected ? '#2ecc71' : isConnecting ? '#f39c12' : '#e74c3c',
        }} />
        {connectionState}
      </div>

      {/* Controls */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%',
        transform: 'translateX(-50%)', display: 'flex', gap: 12,
      }}>
        {/* Main connect/disconnect button */}
        <button
          onClick={isConnected || isConnecting ? handleDisconnect : handleConnect}
          style={{
            padding: '10px 24px', fontSize: 16, cursor: 'pointer',
            borderRadius: 8, border: 'none',
            background: isConnected ? '#e74c3c' : '#2ecc71',
            color: '#fff',
          }}
        >
          {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Talk to Tanjiro'}
        </button>

        {/* Debug buttons */}
        <button onClick={toggleTalking} style={{
          padding: '10px 24px', fontSize: 16, cursor: 'pointer',
          borderRadius: 8, border: 'none',
          background: talking ? '#e74c3c' : '#2ecc71', color: '#fff', opacity: 0.6,
        }}>
          {talking ? 'Stop Talk' : 'Talk'}
        </button>
        <button onClick={toggleThinking} style={{
          padding: '10px 24px', fontSize: 16, cursor: 'pointer',
          borderRadius: 8, border: 'none',
          background: thinking ? '#e74c3c' : '#3498db', color: '#fff', opacity: 0.6,
        }}>
          {thinking ? 'Stop Think' : 'Think'}
        </button>
        <button onClick={triggerHappy} style={{
          padding: '10px 24px', fontSize: 16, cursor: 'pointer',
          borderRadius: 8, border: 'none',
          background: '#f39c12', color: '#fff', opacity: 0.6,
        }}>
          Happy!
        </button>
      </div>
    </div>
  );
}

export default App;
