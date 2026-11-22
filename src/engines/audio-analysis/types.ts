/**
 * VibeBridge Audio Signal Foundation Types
 * Stage B-LIVE.5 — Isolated Signal Analysis Foundation
 *
 * Strongly typed contracts separating transport metadata, acoustic frames,
 * heuristic candidate onsets, deferred low-frequency measurements, and diagnostics.
 * Strictly free of musical instrument classifications (no Kick, Snare, Hi-Hat labels).
 */

export interface AudioBufferMetadata {
  /** Sequential buffer index incremented for each JavaScript callback arrival */
  readonly sequenceNumber?: number;
  /** Audio sampling rate in Hz (e.g. 48000) */
  readonly sampleRate: number;
  /** Number of interleaved channels (1 for mono, 2 for stereo) */
  readonly channelCount: number;
  /** Number of valid audio samples in the buffer */
  readonly sampleCount: number;
  /** Native wall-clock timestamp in seconds when buffer capture finished */
  readonly nativeTimestampSec: number;
}

export interface AudioSignalFoundationConfig {
  /** Analysis window size N in samples. Default: 512 (10.67 ms at 48 kHz) */
  readonly windowSize?: number;
  /** Analysis hop size H in samples. Default: 128 (2.67 ms at 48 kHz) */
  readonly hopSize?: number;
  /** RMS envelope window size in samples. Default: 32 (0.667 ms at 48 kHz) */
  readonly envelopeWindowSize?: number;
  /** Envelope search step size in samples. Default: 8 (0.167 ms at 48 kHz) */
  readonly envelopeStep?: number;
  /**
   * Provisional empirical offset in samples subtracted from the 15% envelope crossing
   * to estimate onset attack start. Default: 4 samples (0.083 ms at 48 kHz). Range: [0, 16].
   */
  readonly attackWindowCorrectionSamples?: number;
  /**
   * Provisional silence RMS threshold below which candidate onsets are rejected.
   * Default: 0.008. Range: [0.002, 0.025].
   */
  readonly silenceThreshold?: number;
  /** Cutoff frequency in Hz for continuous low-pass filter. Default: 180 Hz */
  readonly lowPassCutoffHz?: number;
  /** Maximum number of concurrent deferred measurement slots. Default: 8 */
  readonly deferredSlotCount?: number;
  /** Target sample count for complete low-frequency measurement. Default: 1536 */
  readonly deferredWindowSamples?: number;
}

export interface SubBandEnergy {
  /** Low-band energy (< 200 Hz) normalized to [0, 1] */
  readonly low: number;
  /** Mid-band energy (200 Hz - 2500 Hz) normalized to [0, 1] */
  readonly mid: number;
  /** High-band energy (> 2500 Hz) normalized to [0, 1] */
  readonly high: number;
  /** Positive first-order energy flux (rise) in low band */
  readonly lowFlux: number;
  /** Positive first-order energy flux (rise) in mid band */
  readonly midFlux: number;
  /** Positive first-order energy flux (rise) in high band */
  readonly highFlux: number;
}

export interface RawAcousticFrame {
  /** Sequential frame index within the continuous stream */
  readonly frameIndex: number;
  /** Zero-based sample offset of window start relative to current buffer */
  readonly bufferSampleOffset: number;
  /** Continuous 64-bit safe global sample position of window start */
  readonly globalSamplePosition: number;
  /** Continuous stream time in seconds from stream origin (globalSamplePosition / sampleRate) */
  readonly streamTimeSec: number;
  /** Root-mean-square amplitude over the window [0, 1] */
  readonly rms: number;
  /** Peak absolute amplitude over the window [0, 1] */
  readonly peak: number;
  /** Sub-band energies and temporal fluxes */
  readonly bands: SubBandEnergy;
  /** Zero-crossing rate over the window [0, 1] */
  readonly zeroCrossingRate: number;
}

export type DominantBand = 'low' | 'mid' | 'high' | 'broadband';

export type DeferredMeasurementStatus =
  | 'complete'    // Evaluated over exactly 1,536 samples
  | 'truncated'   // Evaluated over 1 to 1,535 samples due to stream stop/flush
  | 'cancelled'   // 0 samples available before stream stopped
  | 'invalidated' // Discarded due to native sample-clock discontinuity / restart
  | 'expired';    // Discarded due to delivery timeout (> 500 ms)

export interface DeferredLowFrequencyMeasurement {
  readonly status: DeferredMeasurementStatus;
  readonly isComplete: boolean;
  /** Number of pre-filtered samples actually evaluated (e.g. 1536, 456, or 0) */
  readonly samplesEvaluated: number;
  /** Target sample count (1536) */
  readonly targetSamples: number;
  /**
   * Root-mean-square amplitude of sub-200 Hz filtered signal.
   * Defined as sqrt( (1 / samplesEvaluated) * sum( y_low[i]^2 ) ).
   * Strictly null if status is 'cancelled' or 'invalidated'.
   */
  readonly sub200HzRms: number | null;
  /** Diagnostic flag indicating whether measurement was truncated */
  readonly isTruncated: boolean;
}

export interface CandidateOnsetObservation {
  /** Unique monotonic identifier for the candidate observation */
  readonly id: number;
  /**
   * 1. Sample-Accurate Acoustic Position (Timeline Anchor)
   * The integer sample index in the continuous audio stream where the attack rise began.
   */
  readonly estimatedOnsetSample: number;
  /**
   * 2. Timeline Time in Seconds (Media Time)
   * Derived mathematically: estimatedOnsetSample / sampleRate.
   */
  readonly estimatedOnsetTimeSec: number;
  /**
   * 3. JavaScript Confirmation Wall Time in Milliseconds
   * Monotonic timestamp at the exact instant frame m + 1 confirmed the peak at frame m.
   */
  readonly confirmationWallTimeMs: number;
  /**
   * 4. Haptic Command Dispatch Wall Time (Optional future telemetry)
   */
  readonly hapticCommandWallTimeMs?: number;
  /** Measured peak RMS during the onset window */
  readonly peakRms: number;
  /** Peak absolute amplitude during the onset window */
  readonly peakAmplitude: number;
  /** Relative energy surge ratio over local background baseline */
  readonly surgeRatio: number;
  /** Estimated signal-to-noise ratio in decibels */
  readonly snrDb: number;
  /** Frequency band exhibiting the highest normalized energy flux */
  readonly dominantBand: DominantBand;
  /** Vector of normalized flux across all three bands */
  readonly bandFlux: {
    readonly low: number;
    readonly mid: number;
    readonly high: number;
  };
  /** Heuristic quality score bounded in [0.0, 1.0] (uncalibrated ranking score) */
  readonly confidence: number;
  /** Whether the onset sample was resolved via envelope back-projection */
  readonly isBackProjected: boolean;
  /** Whether digital ADC peak clipping was detected */
  readonly isClipped: boolean;
  /** Resolved deferred low-frequency measurement if completed in this pass */
  deferredMeasurement?: DeferredLowFrequencyMeasurement;
}

export interface TransportDiagnostics {
  /** JavaScript-maintained sequential arrival counter */
  readonly jsCallbackSequence: number;
  /** Actual number of audio samples received in this buffer */
  readonly sampleCount: number;
  /** Cumulative audio samples received across stream lifetime */
  readonly totalSamplesIngested: number;
  /** Stream time derived strictly from sample count: totalSamplesIngested / sampleRate */
  readonly sampleTimeSec: number;
  /** Native reported timestamp in seconds */
  readonly nativeTimestampSec: number;
  /** Measured wall-clock arrival interval between consecutive JS callbacks in ms */
  readonly callbackArrivalDeltaMs: number;
  /** Cumulative count of suspected transport gaps */
  readonly suspectedTransportGaps: number;
  /** Cumulative count of detected native stream restarts */
  readonly streamRestartsDetected: number;
  /** Cumulative count of sample continuity breaks */
  readonly continuityBreaksDetected: number;
  /** Count of deferred staging slots invalidated due to discontinuity */
  readonly slotsInvalidatedByDiscontinuity: number;
  /** Count of candidate onsets where deferred slot allocation overflowed */
  readonly deferredQueueOverflows: number;
  /** Count of times the working arena had to be resized */
  readonly arenaReallocations: number;
}
