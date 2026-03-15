class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._resampleRatio = sampleRate / 16000;

    // VAD state
    this._speaking = false;
    this._silenceCounter = 0;
    this._speechOnsetCounter = 0;

    // Adaptive noise floor
    this._noiseFloor = 0;
    this._noiseFloorAlpha = 0.002; // Very slow EMA for runtime adaptation
    this._speechMultiplier = 6.0; // Speech must be 6x above noise floor
    this._minSpeechThreshold = 0.05; // Absolute minimum
    this._frameCount = 0;
    this._warmupFrames = 75; // ~200ms — skip mic activation artifacts
    this._calibrationEnd = 300; // ~800ms total — collect samples after warmup
    this._calibrationSamples = []; // Collect RMS values during calibration

    // Hysteresis
    this._speechOnsetFramesRequired = 12; // ~32ms sustained
    this._silenceFramesRequired = 55; // ~1.1s

    // Prefix buffer
    this._prefixBuffer = [];
    this._prefixBufferSize = 15;

    // Debug
    this._logInterval = 375;
    this._lastLogFrame = 0;
  }

  _calculateRMS(float32Data) {
    let sum = 0;
    for (let i = 0; i < float32Data.length; i++) {
      sum += float32Data[i] * float32Data[i];
    }
    return Math.sqrt(sum / float32Data.length);
  }

  _resample(float32Data) {
    const outputLength = Math.floor(float32Data.length / this._resampleRatio);
    if (outputLength === 0) return null;

    const pcmData = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = Math.floor(i * this._resampleRatio);
      const val = Math.max(-1, Math.min(1, float32Data[srcIndex]));
      pcmData[i] = val < 0 ? val * 0x8000 : val * 0x7FFF;
    }
    return pcmData;
  }

  _getSpeechThreshold() {
    return Math.max(this._minSpeechThreshold, this._noiseFloor * this._speechMultiplier);
  }

  _getSilenceThreshold() {
    return Math.max(this._minSpeechThreshold * 0.5, this._noiseFloor * 3.0);
  }

  _finalizeCalibration() {
    // Use the 50th percentile (median) of collected samples as noise floor
    // This is robust against outlier spikes from mic activation
    if (this._calibrationSamples.length === 0) {
      this._noiseFloor = 0.005;
      return;
    }
    this._calibrationSamples.sort((a, b) => a - b);
    const medianIndex = Math.floor(this._calibrationSamples.length / 2);
    this._noiseFloor = this._calibrationSamples[medianIndex];
    this._calibrationSamples = null; // Free memory
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const float32Data = input[0];
    const rms = this._calculateRMS(float32Data);
    this._frameCount++;

    // Phase 1: Skip warmup (mic activation artifacts)
    if (this._frameCount <= this._warmupFrames) {
      return true;
    }

    // Resample to 16kHz PCM
    const pcmData = this._resample(float32Data);
    if (!pcmData) return true;

    // Phase 2: Calibration — collect RMS samples, don't do VAD yet
    if (this._frameCount <= this._calibrationEnd) {
      this._calibrationSamples.push(rms);
      if (this._frameCount === this._calibrationEnd) {
        this._finalizeCalibration();
      }
      return true;
    }

    const speechThreshold = this._getSpeechThreshold();
    const silenceThreshold = this._getSilenceThreshold();

    // Debug logging every ~1s
    if (this._frameCount - this._lastLogFrame >= this._logInterval) {
      this._lastLogFrame = this._frameCount;
      this.port.postMessage({
        type: "debug",
        rms: rms.toFixed(5),
        noiseFloor: this._noiseFloor.toFixed(5),
        speechThreshold: speechThreshold.toFixed(5),
        silenceThreshold: silenceThreshold.toFixed(5),
        speaking: this._speaking,
      });
    }

    // Adaptive noise floor: update only when NOT speaking
    if (!this._speaking) {
      // Only adapt if rms is close to current noise floor (not a speech spike)
      if (rms < this._noiseFloor * 2.0) {
        this._noiseFloor += (rms - this._noiseFloor) * this._noiseFloorAlpha;
      }
    }

    if (!this._speaking) {
      // Buffer audio for prefix padding
      this._prefixBuffer.push(pcmData.buffer.slice(0));
      if (this._prefixBuffer.length > this._prefixBufferSize) {
        this._prefixBuffer.shift();
      }

      // Check for speech onset with hysteresis
      if (rms > speechThreshold) {
        this._speechOnsetCounter++;
        if (this._speechOnsetCounter >= this._speechOnsetFramesRequired) {
          this._speaking = true;
          this._silenceCounter = 0;
          this._speechOnsetCounter = 0;
          this.port.postMessage({ type: "vad", speaking: true });

          // Flush prefix buffer
          for (const buf of this._prefixBuffer) {
            this.port.postMessage({ type: "audio", buffer: buf }, [buf]);
          }
          this._prefixBuffer = [];

          this.port.postMessage({ type: "audio", buffer: pcmData.buffer }, [pcmData.buffer]);
        }
      } else {
        this._speechOnsetCounter = 0;
      }
    } else {
      // Currently speaking — send audio
      this.port.postMessage({ type: "audio", buffer: pcmData.buffer }, [pcmData.buffer]);

      // Check for silence
      if (rms < silenceThreshold) {
        this._silenceCounter++;
        if (this._silenceCounter >= this._silenceFramesRequired) {
          this._speaking = false;
          this._silenceCounter = 0;
          this.port.postMessage({ type: "vad", speaking: false });
        }
      } else {
        this._silenceCounter = 0;
      }
    }

    return true;
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
