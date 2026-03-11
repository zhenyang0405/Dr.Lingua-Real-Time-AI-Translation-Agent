export class AudioPlayback {
  private audioContext: AudioContext;
  private primaryGain: GainNode;
  private nextPlayTime = 0;
  private scheduledSources: AudioBufferSourceNode[] = [];

  constructor() {
    this.audioContext = new window.AudioContext({ sampleRate: 24000 });
    this.primaryGain = this.audioContext.createGain();
    this.primaryGain.connect(this.audioContext.destination);
  }

  enqueue(base64: string): void {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.primaryGain);

    const now = this.audioContext.currentTime;
    const startTime = Math.max(now, this.nextPlayTime);
    source.start(startTime);
    this.nextPlayTime = startTime + audioBuffer.duration;

    this.scheduledSources.push(source);
    source.onended = () => {
      const idx = this.scheduledSources.indexOf(source);
      if (idx !== -1) this.scheduledSources.splice(idx, 1);
    };
  }

  flush(): void {
    const sourcesToStop = [...this.scheduledSources];
    this.scheduledSources = [];
    this.nextPlayTime = 0;

    // Hard disconnect the gain node. Even if a buffer source ignores stop(), its output is severed instantly.
    this.primaryGain.disconnect();
    this.primaryGain = this.audioContext.createGain();
    this.primaryGain.connect(this.audioContext.destination);

    for (const source of sourcesToStop) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // already stopped
      }
    }
  }

  async pause(): Promise<void> {
    if (this.audioContext.state === 'running') {
      await this.audioContext.suspend();
    }
  }

  async resume(): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async close(): Promise<void> {
    this.flush();
    await this.audioContext.close();
  }
}
