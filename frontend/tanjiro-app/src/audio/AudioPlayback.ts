export class AudioPlayback {
  private audioContext: AudioContext;
  private nextPlayTime = 0;
  private scheduledSources: AudioBufferSourceNode[] = [];

  constructor() {
    this.audioContext = new AudioContext({ sampleRate: 24000 });
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
    source.connect(this.audioContext.destination);

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
    for (const source of this.scheduledSources) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    this.scheduledSources = [];
    this.nextPlayTime = 0;
  }

  async close(): Promise<void> {
    this.flush();
    await this.audioContext.close();
  }
}
