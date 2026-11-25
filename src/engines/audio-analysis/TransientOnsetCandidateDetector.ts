/**
 * TransientOnsetCandidateDetector
 * Stage B-LIVE.5 — Isolated Signal Analysis Foundation
 *
 * Implements:
 * 1. Normalized spectral and energy surge Onset Detection Function (ODF).
 * 2. Adaptive dynamic baseline and standard-deviation thresholding.
 * 3. 3-point local maxima peak picking confirmed on the subsequent hop.
 * 4. Deterministic onset back-projection using a globally fixed 8-sample envelope grid
 *    with a centered 32-sample RMS window and configurable window extent correction.
 * 5. Multiplicative SNR gating with monotonic clipping confidence penalty.
 * 6. Dominant frequency band identification without musical instrument classification.
 */

import {
  AudioSignalFoundationConfig,
  CandidateOnsetObservation,
  DominantBand,
  RawAcousticFrame,
} from './types';

interface PendingCandidateFrame {
  frame: RawAcousticFrame;
  odfValue: number;
  prevOdfValue: number;
  threshold: number;
}

export class TransientOnsetCandidateDetector {
  private candidateIdCounter = 0;

  // Configuration
  private readonly attackWindowCorrectionSamples: number;
  private readonly silenceThreshold: number;
  private readonly envelopeStep: number;
  private readonly envelopeWindowSize: number;

  // Adaptive baseline and dynamic threshold state
  private baselineMean = 0.02;
  private baselineDev = 0.01;
  private prevRms = 0;
  private prevOdf = 0;

  // Noise floor follower (asymmetric two-rate leaky follower)
  private noiseFloor = 0.005;

  // 3-point local maximum pending candidate awaiting confirmation on frame m+1
  private pendingCandidate: PendingCandidateFrame | null = null;

  // Actuator/Acoustic refractory spacing (70 ms minimum between detected candidates)
  private lastConfirmedSample = -100000;
  private sampleRate = 48000;

  constructor(config?: AudioSignalFoundationConfig) {
    this.attackWindowCorrectionSamples = config?.attackWindowCorrectionSamples ?? 4;
    this.silenceThreshold = config?.silenceThreshold ?? 0.008;
    this.envelopeStep = config?.envelopeStep ?? 8;
    this.envelopeWindowSize = config?.envelopeWindowSize ?? 32;
  }

  public setSampleRate(sampleRate: number): void {
    if (sampleRate > 0) {
      this.sampleRate = sampleRate;
    }
  }

  public reset(): void {
    this.candidateIdCounter = 0;
    this.sampleRate = 48000;
    this.baselineMean = 0.02;
    this.baselineDev = 0.01;
    this.prevRms = 0;
    this.prevOdf = 0;
    this.noiseFloor = 0.005;
    this.pendingCandidate = null;
    this.lastConfirmedSample = -100000;
  }

  /**
   * Processes a newly computed raw acoustic frame, evaluates ODF, and checks for local maxima.
   * Returns a CandidateOnsetObservation if frame m-1 was confirmed as a local maximum peak.
   *
   * @param frame Raw acoustic frame evaluated at hop m
   * @param rawArena Direct reference to the raw working arena for envelope back-projection
   * @param arenaGlobalStart Global sample index corresponding to index 0 of rawArena
   * @param arenaLength Total valid samples in rawArena
   * @param callerWallTimeMs Caller-supplied monotonic timestamp in ms
   */
  public evaluateFrame(
    frame: RawAcousticFrame,
    rawArena: Float32Array,
    arenaGlobalStart: number,
    arenaLength: number,
    callerWallTimeMs: number
  ): CandidateOnsetObservation | null {
    // 1. Asymmetric Noise Floor Tracking
    this.updateNoiseFloor(frame.rms, Boolean(this.pendingCandidate));

    // 2. Compute Onset Detection Function (ODF)
    const rmsRise = Math.max(0, frame.rms - this.prevRms);
    const relativeRmsSurge = rmsRise / Math.max(this.prevRms, 0.01);
    this.prevRms = frame.rms;

    const odf =
      0.45 * frame.bands.highFlux +
      0.35 * frame.bands.midFlux +
      0.2 * relativeRmsSurge;

    // 3. Update Adaptive Dynamic Baseline & Threshold
    this.baselineMean = 0.985 * this.baselineMean + 0.015 * odf;
    this.baselineDev = 0.985 * this.baselineDev + 0.015 * Math.abs(odf - this.baselineMean);
    const threshold = this.baselineMean + 3.2 * this.baselineDev + 0.015;

    let confirmedObservation: CandidateOnsetObservation | null = null;

    // 4. Evaluate Pending Candidate (3-Point Local Maximum Check: m-1 vs m)
    if (this.pendingCandidate) {
      const pendingOdf = this.pendingCandidate.odfValue;
      // Local maximum condition: pendingOdf >= currentOdf
      if (pendingOdf >= odf) {
        // Confirmed local maximum!
        confirmedObservation = this.constructCandidateObservation(
          this.pendingCandidate,
          rawArena,
          arenaGlobalStart,
          arenaLength,
          callerWallTimeMs
        );
      }
      this.pendingCandidate = null;
    }

    // 5. Check if Current Frame is a Candidate Peak (ODF > threshold and ODF >= prevOdf)
    const timeSinceLast = frame.globalSamplePosition - this.lastConfirmedSample;
    const isAboveRefractory = timeSinceLast >= this.sampleRate * 0.035;
    const isAboveSilence = frame.rms > this.silenceThreshold;

    if (odf > threshold && odf >= this.prevOdf && isAboveRefractory && isAboveSilence) {
      this.pendingCandidate = {
        frame,
        odfValue: odf,
        prevOdfValue: this.prevOdf,
        threshold,
      };
    }

    this.prevOdf = odf;
    return confirmedObservation;
  }

  // --- PRIVATE ONSET BACK-PROJECTION & CONFIDENCE MATH ---

  private constructCandidateObservation(
    candidate: PendingCandidateFrame,
    rawArena: Float32Array,
    arenaGlobalStart: number,
    arenaLength: number,
    callerWallTimeMs: number
  ): CandidateOnsetObservation {
    const frame = candidate.frame;
    const peakGlobalSample = frame.globalSamplePosition;
    this.lastConfirmedSample = peakGlobalSample;

    // 1. Determine Dominant Band
    const dominantBand = this.resolveDominantBand(frame.bands);

    // 2. Envelope Back-Projection on Globally Fixed 8-Sample Grid
    const { estimatedOnsetSample, isBackProjected } = this.backProjectOnset(
      frame,
      rawArena,
      arenaGlobalStart,
      arenaLength
    );

    // 3. SNR Calculation
    const snrDb = Math.max(
      0,
      Math.min(60, 20 * Math.log10(Math.max(frame.rms, 1e-5) / Math.max(this.noiseFloor, 1e-5)))
    );

    // 4. Calculate Heuristic Confidence (Monotonic Gating & Clipping Penalty)
    const isClipped = frame.peak >= 0.999;
    const confidence = this.calculateConfidence(
      frame.rms,
      candidate.odfValue,
      candidate.prevOdfValue,
      candidate.threshold,
      snrDb,
      isClipped
    );

    const surgeRatio = Math.max(0, candidate.odfValue - candidate.threshold) / Math.max(candidate.threshold, 0.01);
    const estimatedOnsetTimeSec = estimatedOnsetSample / (this.sampleRate > 0 ? this.sampleRate : 48000);

    return {
      id: ++this.candidateIdCounter,
      estimatedOnsetSample,
      estimatedOnsetTimeSec,
      confirmationWallTimeMs: callerWallTimeMs,
      peakRms: frame.rms,
      peakAmplitude: frame.peak,
      surgeRatio,
      snrDb,
      dominantBand,
      bandFlux: {
        low: frame.bands.lowFlux,
        mid: frame.bands.midFlux,
        high: frame.bands.highFlux,
      },
      confidence,
      isBackProjected,
      isClipped,
    };
  }

  /**
   * Back-projects the attack onset sample using a centered 32-sample RMS envelope on an 8-sample grid.
   */
  private backProjectOnset(
    frame: RawAcousticFrame,
    rawArena: Float32Array,
    arenaGlobalStart: number,
    arenaLength: number
  ): { estimatedOnsetSample: number; isBackProjected: boolean } {
    const frameGlobalStart = frame.globalSamplePosition;
    const searchLimitGlobal = Math.max(0, frameGlobalStart - 256);
    const searchEndGlobal = frameGlobalStart + 512;

    // First and last envelope grid points (G_grid = 8 * p)
    const pStart = Math.ceil(searchLimitGlobal / this.envelopeStep);
    const pEnd = Math.floor(searchEndGlobal / this.envelopeStep);

    if (pEnd <= pStart) {
      return { estimatedOnsetSample: frameGlobalStart, isBackProjected: false };
    }

    const envelopeCount = pEnd - pStart + 1;
    // Compute envelope points using centered 32-sample window: [8p - 16 .. 8p + 15]
    const envPoints: number[] = new Array(envelopeCount);

    let maxEnv = 0;
    let maxPIndex = 0;

    for (let i = 0; i < envelopeCount; i++) {
      const p = pStart + i;
      const centerGlobal = p * this.envelopeStep;
      const windowStartLocal = centerGlobal - 16 - arenaGlobalStart;

      if (windowStartLocal < 0 || windowStartLocal + 32 > arenaLength) {
        envPoints[i] = 0;
        continue;
      }

      let sumSq = 0;
      for (let j = 0; j < 32; j++) {
        const val = rawArena[windowStartLocal + j];
        sumSq += val * val;
      }
      const valRms = Math.sqrt(sumSq / 32);
      envPoints[i] = valRms;

      if (valRms > maxEnv) {
        maxEnv = valRms;
        maxPIndex = i;
      }
    }

    if (maxEnv <= 1e-4) {
      return { estimatedOnsetSample: frameGlobalStart, isBackProjected: false };
    }

    // Baseline calculation: first 16 envelope points (or up to peak)
    const baselinePoints = Math.min(16, maxPIndex);
    let baselineSum = 0;
    for (let i = 0; i < baselinePoints; i++) {
      baselineSum += envPoints[i];
    }
    const baselineEnv = baselinePoints > 0 ? baselineSum / baselinePoints : 0;

    // 15% Rise Threshold
    const riseThreshold = baselineEnv + 0.15 * (maxEnv - baselineEnv);

    // Search backwards from peak
    let pCrossLocal = -1;
    for (let i = maxPIndex; i >= 0; i--) {
      if (envPoints[i] <= riseThreshold) {
        pCrossLocal = i;
        break;
      }
    }

    if (pCrossLocal < 0) {
      return { estimatedOnsetSample: frameGlobalStart, isBackProjected: false };
    }

    const valAtCross = envPoints[pCrossLocal];
    const valNext = envPoints[pCrossLocal + 1] ?? maxEnv;
    const denom = Math.abs(valNext - valAtCross) + 1e-6;
    const fraction = Math.max(0, Math.min(1.0, (riseThreshold - valAtCross) / denom));

    const pInterp = pStart + pCrossLocal + fraction;
    const rawEstimatedSample = pInterp * this.envelopeStep - this.attackWindowCorrectionSamples;
    const estimatedOnsetSample = Math.max(0, Math.round(rawEstimatedSample));

    return { estimatedOnsetSample, isBackProjected: true };
  }

  private calculateConfidence(
    rms: number,
    odf: number,
    prevOdf: number,
    threshold: number,
    snrDb: number,
    isClipped: boolean
  ): number {
    // Step 1: Quiet Signal Rejection
    if (rms <= this.silenceThreshold) {
      return 0.0;
    }

    // Step 2: Multiplicative SNR Gate & Base Heuristic
    const gSnr = Math.max(0, Math.min(1.0, (snrDb - 3.0) / 18.0));
    const sSurge = Math.max(0, Math.min(1.0, (odf - threshold) / Math.max(threshold, 0.01)));
    const sSteep = Math.max(0, Math.min(1.0, (odf - prevOdf) / (2.0 * Math.max(prevOdf, 0.015))));

    const baseConfidence = gSnr * (0.6 * sSurge + 0.4 * sSteep);

    // Step 3: Strictly Non-Increasing Clipping Penalty
    let penalizedConfidence = baseConfidence;
    if (isClipped) {
      penalizedConfidence = Math.max(0.0, baseConfidence - 0.2) * 0.85;
    }

    // Step 4: Final Bounded Clamp
    return Math.max(0.0, Math.min(1.0, penalizedConfidence));
  }

  private resolveDominantBand(bands: { lowFlux: number; midFlux: number; highFlux: number }): DominantBand {
    const l = bands.lowFlux;
    const m = bands.midFlux;
    const h = bands.highFlux;

    if (l === 0 && m === 0 && h === 0) return 'broadband';

    const max = Math.max(l, m, h);
    const min = Math.min(l, m, h);

    if (max > 0 && (max - min) / max < 0.2) {
      return 'broadband';
    }

    if (h >= m && h >= l) return 'high';
    if (m >= l && m >= h) return 'mid';
    return 'low';
  }

  private updateNoiseFloor(rms: number, inTransient: boolean): void {
    if (inTransient) return;

    if (rms < this.noiseFloor) {
      this.noiseFloor = 0.95 * this.noiseFloor + 0.05 * rms;
    } else {
      this.noiseFloor = 0.999 * this.noiseFloor + 0.001 * rms;
    }
    this.noiseFloor = Math.max(0.002, Math.min(0.2, this.noiseFloor));
  }
}
