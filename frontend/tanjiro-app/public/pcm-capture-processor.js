class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._resampleRatio = sampleRate / 16000;
    this._resampleBuffer = [];
    this._resampleIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const float32Data = input[0];

    // Downsample from native sample rate to 16kHz
    const outputLength = Math.floor(float32Data.length / this._resampleRatio);
    if (outputLength === 0) return true;

    const int16Data = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = Math.floor(i * this._resampleRatio);
      const sample = Math.max(-1, Math.min(1, float32Data[srcIndex]));
      int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    this.port.postMessage(int16Data.buffer, [int16Data.buffer]);
    return true;
  }
}

registerProcessor('pcm-capture-processor', PCMCaptureProcessor);
