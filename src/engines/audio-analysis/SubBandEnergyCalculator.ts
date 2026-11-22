/**
 * SubBandEnergyCalculator
 * Stage B-LIVE.5 — Isolated Signal Analysis Foundation
 *
 * Implements:
 * 1. Zero-allocation 3-band energy decomposition:
 *    - Low Band (< 200 Hz) using the pre-filtered continuous low-pass stream.
 *    - High Band (> 2500 Hz) using a continuous 1-pole high-pass filter.
 *    - Mid Band (200 Hz - 2500 Hz) as complementary residual.
 * 2. Root-mean-square (RMS) and peak absolute amplitude calculations.
 * 3. Zero-crossing rate (ZCR).
 * 4. Rectified first-order energy flux (rise rate) per band.
 */

import { SubBandEnergy } from './types';

export class SubBandEnergyCalculator {
  // Continuous high-pass filter state (> 2500 Hz)
  private hpState = 0;
  private hpPrevInput = 0;

  // Previous frame band energy for rectified flux calculations
  private prevLowEnergy = 0;
  private prevMidEnergy = 0;
  private prevHighEnergy = 0;

  public reset(): void {
    this.hpState = 0;
    this.hpPrevInput = 0;
    this.prevLowEnergy = 0;
    this.prevMidEnergy = 0;
    this.prevHighEnergy = 0;
  }

  /**
   * Calculates sub-band energies, peak, RMS, zero-crossing rate, and fluxes for an analysis window.
   *
   * @param rawSlice Analysis window of raw audio samples (length N)
   * @param filteredSlice Pre-filtered sub-200Hz samples (length N)
   * @param sampleRate Audio sampling rate in Hz (e.g. 48000)
   */
  public calculate(
    rawSlice: Float32Array,
    filteredSlice: Float32Array,
    sampleRate: number
  ): {
    rms: number;
    peak: number;
    zeroCrossingRate: number;
    bands: SubBandEnergy;
  } {
    const N = rawSlice.length;
    if (N === 0) {
      return {
        rms: 0,
        peak: 0,
        zeroCrossingRate: 0,
        bands: {
          low: 0,
          mid: 0,
          high: 0,
          lowFlux: 0,
          midFlux: 0,
          highFlux: 0,
        },
      };
    }

    const sRate = sampleRate > 0 ? sampleRate : 48000;
    const dt = 1.0 / sRate;

    // 2500 Hz High-Pass Filter (Treble / Cymbals / Stick Attack)
    const rcHigh = 1.0 / (2.0 * Math.PI * 2500.0);
    const alphaHigh = rcHigh / (rcHigh + dt);

    let sumSqTotal = 0;
    let maxPeak = 0;
    let sumSqLow = 0;
    let sumSqMid = 0;
    let sumSqHigh = 0;
    let zeroCrossings = 0;

    let prevSign = rawSlice[0] >= 0;

    for (let i = 0; i < N; i++) {
      const x = rawSlice[i];
      const absX = Math.abs(x);
      if (absX > maxPeak) maxPeak = absX;
      sumSqTotal += x * x;

      // Zero-crossing check
      const currentSign = x >= 0;
      if (currentSign !== prevSign) {
        zeroCrossings++;
        prevSign = currentSign;
      }

      // Low band: from pre-filtered stream (< 200 Hz)
      const low = filteredSlice[i];
      sumSqLow += low * low;

      // High band (> 2500 Hz): single-pole highpass
      this.hpState = alphaHigh * (this.hpState + x - this.hpPrevInput);
      this.hpPrevInput = x;
      const high = this.hpState;
      sumSqHigh += high * high;

      // Mid band (200 Hz - 2500 Hz): complementary signal
      const mid = x - low - high;
      sumSqMid += mid * mid;
    }

    const rms = Math.min(1.0, Math.sqrt(sumSqTotal / N));
    const peak = Math.min(1.0, maxPeak);
    const zeroCrossingRate = N > 1 ? zeroCrossings / (N - 1) : 0;

    const lowEnergy = Math.min(1.0, Math.sqrt(sumSqLow / N));
    const midEnergy = Math.min(1.0, Math.sqrt(sumSqMid / N));
    const highEnergy = Math.min(1.0, Math.sqrt(sumSqHigh / N));

    // Positive rectified first-order energy flux (rise)
    const lowFlux = Math.max(0, lowEnergy - this.prevLowEnergy);
    const midFlux = Math.max(0, midEnergy - this.prevMidEnergy);
    const highFlux = Math.max(0, highEnergy - this.prevHighEnergy);

    this.prevLowEnergy = lowEnergy;
    this.prevMidEnergy = midEnergy;
    this.prevHighEnergy = highEnergy;

    return {
      rms,
      peak,
      zeroCrossingRate,
      bands: {
        low: lowEnergy,
        mid: midEnergy,
        high: highEnergy,
        lowFlux,
        midFlux,
        highFlux,
      },
    };
  }
}
