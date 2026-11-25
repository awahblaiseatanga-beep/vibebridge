/**
 * AudioSignalFoundation
 * Stage B-LIVE.5 — Isolated Signal Analysis Foundation
 *
 * Unified facade orchestrating:
 * 1. SlidingWindowFrameProcessor (Continuous dual arenas, frame alignment, deferred staging pool).
 * 2. SubBandEnergyCalculator (Zero-allocation 3-band energy and flux calculations).
 * 3. TransientOnsetCandidateDetector (ODF, dynamic thresholding, envelope back-projection, SNR gating).
 *
 * Invariant:
 * Completely decoupled from UI, prepared playback, and musical instrument classification.
 */

import { SlidingWindowFrameProcessor } from './SlidingWindowFrameProcessor';
import { SubBandEnergyCalculator } from './SubBandEnergyCalculator';
import { TransientOnsetCandidateDetector } from './TransientOnsetCandidateDetector';
import {
  AudioBufferMetadata,
  AudioSignalFoundationConfig,
  CandidateOnsetObservation,
  DeferredLowFrequencyMeasurement,
  RawAcousticFrame,
  TransportDiagnostics,
} from './types';

export class AudioSignalFoundation {
  private processor: SlidingWindowFrameProcessor;
  private energyCalculator: SubBandEnergyCalculator;
  private onsetDetector: TransientOnsetCandidateDetector;

  private sampleRate = 48000;
  private candidateListeners = new Set<(candidate: CandidateOnsetObservation) => void>();
  private frameListeners = new Set<(frame: RawAcousticFrame) => void>();
  private deferredListeners = new Set<(candidateId: number, measurement: DeferredLowFrequencyMeasurement) => void>();

  // Map of active candidate observations awaiting deferred low-frequency measurement
  private activeCandidates = new Map<number, CandidateOnsetObservation>();

  constructor(config?: AudioSignalFoundationConfig) {
    this.processor = new SlidingWindowFrameProcessor(config);
    this.energyCalculator = new SubBandEnergyCalculator();
    this.onsetDetector = new TransientOnsetCandidateDetector(config);
  }

  public reset(): void {
    this.sampleRate = 48000;
    this.processor.reset();
    this.energyCalculator.reset();
    this.onsetDetector.reset();
    this.onsetDetector.setSampleRate(48000);
    this.activeCandidates.clear();
  }

  public onCandidateOnset(listener: (candidate: CandidateOnsetObservation) => void): () => void {
    this.candidateListeners.add(listener);
    return () => this.candidateListeners.delete(listener);
  }

  public onFrame(listener: (frame: RawAcousticFrame) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  public onDeferredResolved(
    listener: (candidateId: number, measurement: DeferredLowFrequencyMeasurement) => void
  ): () => void {
    this.deferredListeners.add(listener);
    return () => this.deferredListeners.delete(listener);
  }

  /**
   * Ingests a native PCM buffer, executes continuous analysis, and returns any confirmed onsets.
   *
   * @param data ArrayBuffer containing float32 or int16 PCM audio
   * @param metadata Audio buffer transport metadata
   * @param callerWallTimeMs Optional monotonic caller timestamp in milliseconds
   * @param encoding 'float32' | 'int16' (default: 'float32')
   */
  public ingestBuffer(
    data: ArrayBuffer,
    metadata: AudioBufferMetadata,
    callerWallTimeMs: number = Date.now(),
    encoding: 'float32' | 'int16' = 'float32'
  ): CandidateOnsetObservation[] {
    this.sampleRate = metadata.sampleRate > 0 ? metadata.sampleRate : this.sampleRate;
    this.onsetDetector.setSampleRate(this.sampleRate);
    const floatSamples = this.decodeToMonoFloat(data, metadata.channelCount, encoding);

    const emittedCandidates: CandidateOnsetObservation[] = [];

    this.processor.processBuffer(
      floatSamples,
      metadata,
      callerWallTimeMs,
      {
        onFrame: (rawSlice, filteredSlice, frameIndex, globalSamplePosition, bufferSampleOffset, streamTimeSec) => {
          // 1. Calculate Sub-Band Energy, RMS, Peak, and Flux
          const calc = this.energyCalculator.calculate(rawSlice, filteredSlice, this.sampleRate);

          const frame: RawAcousticFrame = {
            frameIndex,
            bufferSampleOffset,
            globalSamplePosition,
            streamTimeSec,
            rms: calc.rms,
            peak: calc.peak,
            bands: calc.bands,
            zeroCrossingRate: calc.zeroCrossingRate,
          };

          // Notify Frame Listeners
          this.frameListeners.forEach((listener) => {
            try {
              listener(frame);
            } catch (e) {
              console.error('[AudioSignalFoundation] Frame listener error:', e);
            }
          });

          // 2. Evaluate Onset Candidate Detection
          const candidate = this.onsetDetector.evaluateFrame(
            frame,
            this.processor.getRawArena(),
            this.processor.getArenaGlobalStartSample(),
            this.processor.getRawArena().length,
            callerWallTimeMs
          );

          if (candidate) {
            emittedCandidates.push(candidate);
            this.activeCandidates.set(candidate.id, candidate);

            // Register for deferred low-frequency measurement
            this.processor.registerDeferredCandidate(
              candidate.id,
              candidate.estimatedOnsetSample,
              callerWallTimeMs,
              (id, measurement) => this.handleDeferredResolved(id, measurement)
            );

            // Notify Candidate Listeners
            this.candidateListeners.forEach((listener) => {
              try {
                listener(candidate);
              } catch (e) {
                console.error('[AudioSignalFoundation] Candidate listener error:', e);
              }
            });
          }
        },
        onDeferredResolved: (candidateId, measurement) => {
          this.handleDeferredResolved(candidateId, measurement);
        },
      }
    );

    return emittedCandidates;
  }

  /**
   * Immediately flushes all active deferred staging slots (on stream stop/pause).
   */
  public flush(): void {
    this.processor.flush((candidateId, measurement) => {
      this.handleDeferredResolved(candidateId, measurement);
    });
  }

  public getDiagnostics(): TransportDiagnostics {
    return this.processor.getDiagnostics(this.sampleRate);
  }

  private handleDeferredResolved(candidateId: number, measurement: DeferredLowFrequencyMeasurement): void {
    const candidate = this.activeCandidates.get(candidateId);
    if (candidate) {
      candidate.deferredMeasurement = measurement;
      this.activeCandidates.delete(candidateId);
    }

    this.deferredListeners.forEach((listener) => {
      try {
        listener(candidateId, measurement);
      } catch (e) {
        console.error('[AudioSignalFoundation] Deferred listener error:', e);
      }
    });
  }

  private decodeToMonoFloat(
    data: ArrayBuffer,
    channels: number,
    encoding: 'float32' | 'int16'
  ): Float32Array {
    const numChannels = channels > 0 ? channels : 1;

    if (encoding === 'float32') {
      const floatView = new Float32Array(data);
      if (numChannels <= 1) {
        return floatView;
      }
      const monoLen = Math.floor(floatView.length / numChannels);
      const mono = new Float32Array(monoLen);
      for (let i = 0; i < monoLen; i++) {
        let sum = 0;
        for (let c = 0; c < numChannels; c++) {
          sum += floatView[i * numChannels + c];
        }
        mono[i] = sum / numChannels;
      }
      return mono;
    } else {
      const int16View = new Int16Array(data);
      const monoLen = Math.floor(int16View.length / numChannels);
      const mono = new Float32Array(monoLen);
      for (let i = 0; i < monoLen; i++) {
        if (numChannels <= 1) {
          mono[i] = int16View[i] / 32768.0;
        } else {
          let sum = 0;
          for (let c = 0; c < numChannels; c++) {
            sum += int16View[i * numChannels + c] / 32768.0;
          }
          mono[i] = sum / numChannels;
        }
      }
      return mono;
    }
  }
}
