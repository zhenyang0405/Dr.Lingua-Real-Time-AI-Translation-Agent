export class AudioCapture {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  public onData: ((base64: string) => void) | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.audioContext = new AudioContext();
    await this.audioContext.audioWorklet.addModule('/pcm-capture-processor.js');

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-capture-processor');

    this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (this.onData) {
        const bytes = new Uint8Array(event.data);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        this.onData(btoa(binary));
      }
    };

    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);
  }

  stop(): void {
    this.workletNode?.disconnect();
    this.sourceNode?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close();
    this.workletNode = null;
    this.sourceNode = null;
    this.stream = null;
    this.audioContext = null;
  }
}
