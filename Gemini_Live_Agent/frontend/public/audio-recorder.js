class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._resampleRatio = sampleRate / 16000;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const float32Data = input[0];

      // Downsample from native sample rate to 16kHz
      const outputLength = Math.floor(float32Data.length / this._resampleRatio);
      if (outputLength === 0) return true;

      const pcmData = new Int16Array(outputLength);
      for (let i = 0; i < outputLength; i++) {
        const srcIndex = Math.floor(i * this._resampleRatio);
        const val = Math.max(-1, Math.min(1, float32Data[srcIndex]));
        pcmData[i] = val < 0 ? val * 0x8000 : val * 0x7FFF;
      }

      // Send the raw PCM Int16 array buffer to the main thread
      this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
    }

    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
