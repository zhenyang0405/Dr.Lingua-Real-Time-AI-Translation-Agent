class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // VAD state (visual feedback only — does NOT gate audio)
    this._speaking = false;
    this._speechOnsetCounter = 0;
    this._silenceCounter = 0;

    // Adaptive noise floor
    this._noiseFloor = 0;
    this._noiseFloorAlpha = 0.002;
    this._speechMultiplier = 6.0;
    this._minSpeechThreshold = 0.05;
    this._frameCount = 0;
    // Frame timing: 128 samples/frame at 16kHz = 8ms/frame
    this._warmupFrames = 25; // ~200ms — skip mic activation artifacts
    this._calibrationEnd = 100; // ~800ms total
    this._calibrationSamples = [];

    // Hysteresis for visual feedback
    this._speechOnsetFramesRequired = 4; // ~32ms
    this._silenceFramesRequired = 25; // ~200ms (shorter for visual responsiveness)

    // Debug
    this._logInterval = 125;
    this._lastLogFrame = 0;

    // Bandpass filter for speech detection (300Hz – 3500Hz at 16kHz)
    this._initBandpassFilter();
  }

  _initBandpassFilter() {
    const fs = 16000;
    const PI = Math.PI;

    // High-pass at 300Hz (biquad, Butterworth Q=0.707)
    const hpFreq = 300;
    const hpW0 = 2 * PI * hpFreq / fs;
    const hpAlpha = Math.sin(hpW0) / (2 * 0.707);
    const hpCosW0 = Math.cos(hpW0);
    const hpA0 = 1 + hpAlpha;
    this._hp = {
      b0: ((1 + hpCosW0) / 2) / hpA0,
      b1: (-(1 + hpCosW0)) / hpA0,
      b2: ((1 + hpCosW0) / 2) / hpA0,
      a1: (-2 * hpCosW0) / hpA0,
      a2: (1 - hpAlpha) / hpA0,
      x1: 0, x2: 0, y1: 0, y2: 0,
    };

    // Low-pass at 3500Hz (biquad, Butterworth Q=0.707)
    const lpFreq = 3500;
    const lpW0 = 2 * PI * lpFreq / fs;
    const lpAlpha = Math.sin(lpW0) / (2 * 0.707);
    const lpCosW0 = Math.cos(lpW0);
    const lpA0 = 1 + lpAlpha;
    this._lp = {
      b0: ((1 - lpCosW0) / 2) / lpA0,
      b1: (1 - lpCosW0) / lpA0,
      b2: ((1 - lpCosW0) / 2) / lpA0,
      a1: (-2 * lpCosW0) / lpA0,
      a2: (1 - lpAlpha) / lpA0,
      x1: 0, x2: 0, y1: 0, y2: 0,
    };
  }

  _applyBiquad(filter, sample) {
    const out = filter.b0 * sample + filter.b1 * filter.x1 + filter.b2 * filter.x2
              - filter.a1 * filter.y1 - filter.a2 * filter.y2;
    filter.x2 = filter.x1;
    filter.x1 = sample;
    filter.y2 = filter.y1;
    filter.y1 = out;
    return out;
  }

  _speechBandRMS(float32Data) {
    let sum = 0;
    for (let i = 0; i < float32Data.length; i++) {
      const hp = this._applyBiquad(this._hp, float32Data[i]);
      const filtered = this._applyBiquad(this._lp, hp);
      sum += filtered * filtered;
    }
    return Math.sqrt(sum / float32Data.length);
  }

  _toInt16PCM(float32Data) {
    const pcmData = new Int16Array(float32Data.length);
    for (let i = 0; i < float32Data.length; i++) {
      const val = Math.max(-1, Math.min(1, float32Data[i]));
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
    if (this._calibrationSamples.length === 0) {
      this._noiseFloor = 0.005;
      return;
    }
    this._calibrationSamples.sort((a, b) => a - b);
    const medianIndex = Math.floor(this._calibrationSamples.length / 2);
    this._noiseFloor = this._calibrationSamples[medianIndex];
    this._calibrationSamples = null;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const float32Data = input[0];
    const rms = this._speechBandRMS(float32Data);
    this._frameCount++;

    // Skip warmup (mic activation artifacts)
    if (this._frameCount <= this._warmupFrames) {
      return true;
    }

    // Convert and always send audio (push-to-talk — mic button controls flow)
    const pcmData = this._toInt16PCM(float32Data);
    this.port.postMessage({ type: "audio", buffer: pcmData.buffer }, [pcmData.buffer]);

    // Calibration phase — collect RMS for noise floor
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

    // Adaptive noise floor: update only when not speaking
    if (!this._speaking) {
      if (rms < this._noiseFloor * 2.0) {
        this._noiseFloor += (rms - this._noiseFloor) * this._noiseFloorAlpha;
      }
    }

    // VAD for visual feedback only (wave bar animation)
    if (!this._speaking) {
      if (rms > speechThreshold) {
        this._speechOnsetCounter++;
        if (this._speechOnsetCounter >= this._speechOnsetFramesRequired) {
          this._speaking = true;
          this._silenceCounter = 0;
          this._speechOnsetCounter = 0;
          this.port.postMessage({ type: "vad", speaking: true });
        }
      } else {
        this._speechOnsetCounter = 0;
      }
    } else {
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
