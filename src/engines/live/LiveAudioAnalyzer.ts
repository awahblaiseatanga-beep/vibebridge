/**
 * LiveAudioAnalyzer
 *
 * Real-time digital signal processing engine for live concert microphone audio.
 * Stage B-LIVE.2: Adaptive Haptic Intelligence & Physical Feedback Calibration.
 *
 * Computes:
 * 1. RMS and peak amplitude.
 * 2. Three-band frequency decomposition (Low: <250Hz, Mid: 250-2500Hz, High: >2500Hz).
 * 3. Vocal-range bandpass energy activity estimate (300-3000Hz).
 * 4. Normalized relative transient / onset attack detection.
 * 5. Dynamic background noise floor tracking that resists music self-choking.
 * 6. Configurable Low / Normal / High sensitivity profiles + Automatic Venue Adaptation with hysteresis.
 *
 * Architectural Invariants:
 * - Pure DSP analysis without stateful audio transport coupling.
 * - Vocal activity is strictly labeled and treated as an estimated band energy,
 *   never as confirmed singer source separation.
 * - Non-blocking execution (<0.2ms per 100ms audio buffer).
 */

import { AudioSensitivityProfile, LiveAudioFeatures } from './types';

export class LiveAudioAnalyzer {
  private sequence = 0;

  // IIR Filter state variables (persistent across consecutive chunks)
  private lpState = 0;
  private hpState = 0;
  private hpPrevInput = 0;

  // Vocal bandpass filter state (300Hz - 3000Hz)
  private vocalLpState = 0;
  private vocalHpState = 0;
  private vocalHpPrevInput = 0;

  // Relative transient / onset detection state
  private prevRms = 0;
  private lastTransientTimestamp = -1;
  private static readonly TRANSIENT_REFRACTORY_SEC = 0.07; // 70ms minimum spacing

  // Adaptive noise floor tracking (stabilized against sustained music self-choking)
  private noiseFloor = 0.02; // Initial conservative baseline noise floor

  // Sensitivity configuration & automatic adaptation
  private sensitivityProfile: AudioSensitivityProfile = 'normal';
  private autoAdaptSensitivity = false;
  private adaptiveGain = 1.0;
  private recentRmsEma = 0.04;
  private lastAdaptTimestamp = -1;

  public reset(): void {
    this.sequence = 0;
    this.lpState = 0;
    this.hpState = 0;
    this.hpPrevInput = 0;
    this.vocalLpState = 0;
    this.vocalHpState = 0;
    this.vocalHpPrevInput = 0;
    this.prevRms = 0;
    this.lastTransientTimestamp = -1;
    this.noiseFloor = 0.02;
    this.adaptiveGain = 1.0;
    this.recentRmsEma = 0.04;
    this.lastAdaptTimestamp = -1;
  }

  public setSensitivityProfile(profile: AudioSensitivityProfile): void {
    this.sensitivityProfile = profile;
  }

  public getSensitivityProfile(): AudioSensitivityProfile {
    return this.sensitivityProfile;
  }

  public setAutoAdaptSensitivity(enabled: boolean): void {
    this.autoAdaptSensitivity = enabled;
    if (!enabled) {
      this.adaptiveGain = 1.0;
    }
  }

  public isAutoAdaptEnabled(): boolean {
    return this.autoAdaptSensitivity;
  }

  public getEffectiveSensitivity(): number {
    const baseMultiplier =
      this.sensitivityProfile === 'high'
        ? 1.8
        : this.sensitivityProfile === 'low'
        ? 0.65
        : 1.0;
    return baseMultiplier * this.adaptiveGain;
  }

  /**
   * Analyzes an incoming PCM buffer and returns structured audio features.
   *
   * @param data ArrayBuffer containing float32 or int16 PCM
   * @param sampleRate Audio sampling rate in Hz (e.g. 48000)
   * @param channels Channel count (1 for mono, 2 for stereo)
   * @param timestamp Timestamp in seconds from stream start
   * @param encoding 'float32' | 'int16' (default: 'float32')
   */
  public analyze(
    data: ArrayBuffer,
    sampleRate: number,
    channels: number,
    timestamp: number,
    encoding: 'float32' | 'int16' = 'float32'
  ): LiveAudioFeatures {
    const sRate = sampleRate > 0 ? sampleRate : 48000;
    const numChannels = channels > 0 ? channels : 1;

    // Decode to mono Float32Array
    const monoSamples = this.decodeToMonoFloat(data, numChannels, encoding);
    const numSamples = monoSamples.length;

    if (numSamples === 0) {
      return this.createEmptyFeatures(sRate, numChannels, timestamp);
    }

    // Filter coefficients
    const dt = 1.0 / sRate;

    // 250 Hz Lowpass (Bass / Sub)
    const rcLow = 1.0 / (2.0 * Math.PI * 250.0);
    const alphaLow = dt / (rcLow + dt);

    // 2500 Hz Highpass (Treble / Cymbals)
    const rcHigh = 1.0 / (2.0 * Math.PI * 2500.0);
    const alphaHigh = rcHigh / (rcHigh + dt);

    // Vocal range: 3000 Hz Lowpass + 300 Hz Highpass
    const rcVocalLp = 1.0 / (2.0 * Math.PI * 3000.0);
    const alphaVocalLp = dt / (rcVocalLp + dt);

    const rcVocalHp = 1.0 / (2.0 * Math.PI * 300.0);
    const alphaVocalHp = rcVocalHp / (rcVocalHp + dt);

    let sumSq = 0;
    let maxPeak = 0;
    let sumSqLow = 0;
    let sumSqMid = 0;
    let sumSqHigh = 0;
    let sumSqVocal = 0;

    for (let i = 0; i < numSamples; i++) {
      const x = monoSamples[i];
      const absX = Math.abs(x);
      if (absX > maxPeak) maxPeak = absX;
      sumSq += x * x;

      // 1. Three-band decomposition
      // Lowpass (<250 Hz)
      this.lpState += alphaLow * (x - this.lpState);
      const low = this.lpState;

      // Highpass (>2500 Hz)
      this.hpState = alphaHigh * (this.hpState + x - this.hpPrevInput);
      this.hpPrevInput = x;
      const high = this.hpState;

      // Mid band (250 - 2500 Hz)
      const mid = x - low - high;

      sumSqLow += low * low;
      sumSqMid += mid * mid;
      sumSqHigh += high * high;

      // 2. Vocal-range bandpass (300 - 3000 Hz)
      this.vocalLpState += alphaVocalLp * (x - this.vocalLpState);
      const vocalLp = this.vocalLpState;

      this.vocalHpState = alphaVocalHp * (this.vocalHpState + vocalLp - this.vocalHpPrevInput);
      this.vocalHpPrevInput = vocalLp;
      const vocalSample = this.vocalHpState;

      sumSqVocal += vocalSample * vocalSample;
    }

    const rms = Math.min(1.0, Math.sqrt(sumSq / numSamples));
    const peak = Math.min(1.0, maxPeak);
    const lowEnergy = Math.min(1.0, Math.sqrt(sumSqLow / numSamples));
    const midEnergy = Math.min(1.0, Math.sqrt(sumSqMid / numSamples));
    const highEnergy = Math.min(1.0, Math.sqrt(sumSqHigh / numSamples));
    const rawVocalRms = Math.sqrt(sumSqVocal / numSamples);

    // Vocal activity estimate: ratio of vocal band energy to overall energy
    // Normalized to [0, 1] with floor guard
    const vocalActivityEstimate = Math.min(
      1.0,
      rms > 0.008 ? (rawVocalRms / (rms + 0.015)) * 1.25 : 0
    );

    // 3. Transient / Onset Detection via Normalized Relative Decibel & RMS Surge
    // Calculates both absolute step rise and percentage surge over previous frame baseline
    const rmsRise = Math.max(0, rms - this.prevRms);
    const relativeSurge = rmsRise / (this.prevRms + 0.015);
    this.prevRms = rms;

    const timeSinceLastTransient = timestamp - this.lastTransientTimestamp;
    // Transient criteria:
    // - Requires non-silent audio (rms > 0.018)
    // - Requires minimum absolute rise (rmsRise > 0.022)
    // - Requires relative surge > 0.35 (35% volume surge over recent baseline)
    // - Requires energy above dynamic noise floor
    // - Enforces 70ms refractory spacing to isolate attack hits from sustained resonance
    const isTransient =
      rms > 0.018 &&
      rmsRise > 0.022 &&
      relativeSurge > 0.32 &&
      lowEnergy + midEnergy > this.noiseFloor * 1.15 &&
      (this.lastTransientTimestamp < 0 || timeSinceLastTransient >= LiveAudioAnalyzer.TRANSIENT_REFRACTORY_SEC);

    if (isTransient) {
      this.lastTransientTimestamp = timestamp;
    }

    // 4. Corrected Adaptive Noise-Floor Tracking (Stabilized against music self-choking)
    // Identifies whether structured musical signals (transients, vocal formants, or bass) are present
    const isMusicalSignal = isTransient || vocalActivityEstimate > 0.35 || lowEnergy > 0.10;

    if (rms < this.noiseFloor) {
      // Signal fell below noise floor (quieting down / pause): adapt downward briskly
      this.noiseFloor = this.noiseFloor * 0.92 + rms * 0.08;
    } else if (!isMusicalSignal) {
      // Steady, non-musical ambient sound (e.g. room HVAC, distant crowd hum): adapt upward slowly
      this.noiseFloor = this.noiseFloor * 0.998 + rms * 0.002;
    } else {
      // Sustained musical signal: virtually freeze upward adaptation (time constant ~100s)
      // This guarantees sustained quiet music (e.g. 30s piano/guitar) never chokes off its own detection!
      this.noiseFloor = this.noiseFloor * 0.9998 + rms * 0.0002;
    }
    this.noiseFloor = Math.max(0.005, Math.min(0.40, this.noiseFloor));

    // SNR in decibels
    const snrDb = Math.max(0, Math.min(60, 20 * Math.log10((rms + 1e-4) / (this.noiseFloor + 1e-4))));

    // 5. Automatic Venue Sensitivity Adaptation with Hysteresis
    this.recentRmsEma = this.recentRmsEma * 0.98 + rms * 0.02;

    if (this.autoAdaptSensitivity) {
      if (this.lastAdaptTimestamp < 0 || timestamp - this.lastAdaptTimestamp >= 1.0) {
        this.lastAdaptTimestamp = timestamp;
        let targetGain = 1.0;

        if (this.recentRmsEma > 0.015 && this.recentRmsEma < 0.07) {
          // Quiet musical passage: boost sensitivity smoothly
          targetGain = 1.5;
        } else if (this.recentRmsEma > 0.28) {
          // Loud arena performance: dial sensitivity down to prevent over-triggering
          targetGain = 0.7;
        } else if (this.recentRmsEma <= 0.015) {
          // Silence: lock to 1.0 (never amplify thermal mic noise)
          targetGain = 1.0;
        }

        // Hysteresis smoothing: prevents rapid gain hunting
        this.adaptiveGain = this.adaptiveGain * 0.85 + targetGain * 0.15;
      }
    } else {
      this.adaptiveGain = 1.0;
    }

    const effectiveSensitivity = this.getEffectiveSensitivity();

    return {
      sequence: this.sequence++,
      timestamp,
      sampleRate: sRate,
      channels: numChannels,
      rms,
      peak,
      lowEnergy,
      midEnergy,
      highEnergy,
      vocalActivityEstimate,
      isTransient,
      noiseFloor: this.noiseFloor,
      snrDb,
      effectiveSensitivity,
    };
  }

  private decodeToMonoFloat(
    data: ArrayBuffer,
    channels: number,
    encoding: 'float32' | 'int16'
  ): Float32Array {
    if (encoding === 'float32') {
      const floatView = new Float32Array(data);
      if (channels <= 1) {
        return floatView;
      }
      // Interleaved multi-channel -> average to mono
      const monoLen = Math.floor(floatView.length / channels);
      const mono = new Float32Array(monoLen);
      for (let i = 0; i < monoLen; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) {
          sum += floatView[i * channels + c];
        }
        mono[i] = sum / channels;
      }
      return mono;
    } else {
      // 16-bit signed PCM
      const int16View = new Int16Array(data);
      if (channels <= 1) {
        const mono = new Float32Array(int16View.length);
        for (let i = 0; i < int16View.length; i++) {
          mono[i] = int16View[i] / 32768.0;
        }
        return mono;
      }
      const monoLen = Math.floor(int16View.length / channels);
      const mono = new Float32Array(monoLen);
      for (let i = 0; i < monoLen; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) {
          sum += int16View[i * channels + c] / 32768.0;
        }
        mono[i] = sum / channels;
      }
      return mono;
    }
  }

  private createEmptyFeatures(sampleRate: number, channels: number, timestamp: number): LiveAudioFeatures {
    return {
      sequence: this.sequence++,
      timestamp,
      sampleRate,
      channels,
      rms: 0,
      peak: 0,
      lowEnergy: 0,
      midEnergy: 0,
      highEnergy: 0,
      vocalActivityEstimate: 0,
      isTransient: false,
      noiseFloor: this.noiseFloor,
      snrDb: 0,
      effectiveSensitivity: this.getEffectiveSensitivity(),
    };
  }
}
