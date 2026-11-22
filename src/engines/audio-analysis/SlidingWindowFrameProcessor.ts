/**
 * SlidingWindowFrameProcessor
 * Stage B-LIVE.5 — Isolated Signal Analysis Foundation
 *
 * Implements:
 * 1. Dual contiguous arena storage (rawArena and filteredArena) pre-allocated to 16,384 floats.
 * 2. Invariant-based continuous frame alignment across buffer boundaries and variable lengths.
 * 3. Continuous 2nd-order low-pass IIR filtering with DC blocking, preserving state across buffers.
 * 4. Bounded 8-slot staging pool for deferred low-frequency measurements.
 * 5. Strict sample continuity tracking and transport interruption heuristics.
 */

import {
  AudioBufferMetadata,
  AudioSignalFoundationConfig,
  DeferredLowFrequencyMeasurement,
  RawAcousticFrame,
  TransportDiagnostics,
} from './types';

export interface StagingSlot {
  readonly slotIndex: number;
  inUse: boolean;
  candidateId: number;
  onsetGlobalSample: number;      // k
  startGlobalSample: number;      // physical start sample (max(0, k - 256))
  targetGlobalSample: number;     // k + 1279 (last sample inclusive)
  samplesAccumulated: number;     // in [0, 1536]
  readonly buffer: Float32Array;  // pre-allocated Float32Array(1536)
  createdAtWallTimeMs: number;
}

export interface FrameProcessingCallbacks {
  onFrame: (
    rawSlice: Float32Array,
    filteredSlice: Float32Array,
    frameIndex: number,
    globalSamplePosition: number,
    bufferSampleOffset: number,
    streamTimeSec: number
  ) => void;
  onDeferredResolved: (
    candidateId: number,
    measurement: DeferredLowFrequencyMeasurement
  ) => void;
}

export class SlidingWindowFrameProcessor {
  // Configuration
  private readonly windowSize: number;
  private readonly hopSize: number;
  private readonly lowPassCutoffHz: number;
  private readonly deferredSlotCount: number;
  private readonly deferredWindowSamples: number;

  // Dual contiguous arenas (Capacity 16,384 floats = 64 KB RAM each)
  private arenaCapacity = 16384;
  private rawArena: Float32Array;
  private filteredArena: Float32Array;
  private tailLength = 0;
  private currentArenaValidSamples = 0;

  // Stream state & global counters
  private globalIngestedSamples = 0;
  private nextFrameStartGlobal = 0;
  private frameIndex = 0;
  private sampleRate = 48000;

  // Continuous IIR filter state (DC block + 2nd-order Butterworth low-pass)
  private dcInPrev = 0;
  private dcOutPrev = 0;
  private lpState1 = 0;
  private lpState2 = 0;

  // Bounded deferred staging pool
  private stagingSlots: StagingSlot[];

  // Transport & Continuity diagnostics
  private jsCallbackSequence = 0;
  private lastNativeTimestampSec = -1;
  private lastCallbackWallTimeMs = -1;
  private suspectedTransportGaps = 0;
  private streamRestartsDetected = 0;
  private continuityBreaksDetected = 0;
  private slotsInvalidatedByDiscontinuity = 0;
  private deferredQueueOverflows = 0;
  private arenaReallocations = 0;

  constructor(config?: AudioSignalFoundationConfig) {
    this.windowSize = config?.windowSize ?? 512;
    this.hopSize = config?.hopSize ?? 128;
    this.lowPassCutoffHz = config?.lowPassCutoffHz ?? 180;
    this.deferredSlotCount = config?.deferredSlotCount ?? 8;
    this.deferredWindowSamples = config?.deferredWindowSamples ?? 1536;

    this.rawArena = new Float32Array(this.arenaCapacity);
    this.filteredArena = new Float32Array(this.arenaCapacity);

    this.stagingSlots = [];
    for (let i = 0; i < this.deferredSlotCount; i++) {
      this.stagingSlots.push({
        slotIndex: i,
        inUse: false,
        candidateId: -1,
        onsetGlobalSample: 0,
        startGlobalSample: 0,
        targetGlobalSample: 0,
        samplesAccumulated: 0,
        buffer: new Float32Array(this.deferredWindowSamples),
        createdAtWallTimeMs: 0,
      });
    }
  }

  public reset(): void {
    this.tailLength = 0;
    this.currentArenaValidSamples = 0;
    this.globalIngestedSamples = 0;
    this.nextFrameStartGlobal = 0;
    this.frameIndex = 0;
    this.dcInPrev = 0;
    this.dcOutPrev = 0;
    this.lpState1 = 0;
    this.lpState2 = 0;

    for (let i = 0; i < this.stagingSlots.length; i++) {
      this.stagingSlots[i].inUse = false;
      this.stagingSlots[i].samplesAccumulated = 0;
    }

    this.jsCallbackSequence = 0;
    this.lastNativeTimestampSec = -1;
    this.lastCallbackWallTimeMs = -1;
    this.suspectedTransportGaps = 0;
    this.streamRestartsDetected = 0;
    this.continuityBreaksDetected = 0;
    this.slotsInvalidatedByDiscontinuity = 0;
    this.deferredQueueOverflows = 0;
    this.arenaReallocations = 0;
  }

  /**
   * Returns the current arena global start sample (index 0 of current working arena).
   */
  public getArenaGlobalStartSample(): number {
    return this.globalIngestedSamples - this.tailLength;
  }

  /**
   * Ingests a native PCM buffer, filters the stream, evaluates aligned sliding frames,
   * updates deferred staging slots, and retains the unconsumed tail.
   */
  public processBuffer(
    incomingData: Float32Array,
    metadata: AudioBufferMetadata,
    callerWallTimeMs: number,
    callbacks: FrameProcessingCallbacks
  ): void {
    this.jsCallbackSequence++;
    this.sampleRate = metadata.sampleRate > 0 ? metadata.sampleRate : this.sampleRate;
    const incomingLen = incomingData.length;

    // 1. Transport & Continuity Heuristic Checks
    this.evaluateContinuityHeuristics(metadata, callerWallTimeMs, callbacks);

    // 2. Ensure Arena Capacity
    const requiredSpan = this.tailLength + incomingLen;
    if (requiredSpan > this.arenaCapacity) {
      this.growArena(requiredSpan);
    }

    // 3. Stage Incoming Samples in Raw Arena
    this.rawArena.set(incomingData, this.tailLength);

    // 4. Continuous Low-Pass Filtering (Sub-200 Hz) on Incoming Slice
    this.filterIncomingSamples(this.tailLength, incomingLen);

    const totalValidSamples = this.tailLength + incomingLen;
    this.currentArenaValidSamples = totalValidSamples;
    const arenaGlobalStart = this.globalIngestedSamples - this.tailLength;
    const arenaGlobalEnd = arenaGlobalStart + totalValidSamples - 1;

    // 5. Append Samples to Active Deferred Staging Slots
    this.appendSamplesToPendingSlots(arenaGlobalStart, arenaGlobalEnd, totalValidSamples, callbacks);

    // 6. Sliding-Window Frame Loop
    while (this.nextFrameStartGlobal + this.windowSize <= arenaGlobalStart + totalValidSamples) {
      const localOffset = this.nextFrameStartGlobal - arenaGlobalStart;
      const rawSlice = this.rawArena.subarray(localOffset, localOffset + this.windowSize);
      const filteredSlice = this.filteredArena.subarray(localOffset, localOffset + this.windowSize);
      const streamTimeSec = this.nextFrameStartGlobal / this.sampleRate;
      const bufferSampleOffset = localOffset - this.tailLength;

      callbacks.onFrame(
        rawSlice,
        filteredSlice,
        this.frameIndex++,
        this.nextFrameStartGlobal,
        bufferSampleOffset,
        streamTimeSec
      );

      this.nextFrameStartGlobal += this.hopSize;
    }

    // 7. Dynamic Tail Retention for Next Buffer
    const retainedStartLocal = this.nextFrameStartGlobal - arenaGlobalStart;
    const newTailLength = totalValidSamples - retainedStartLocal;

    if (newTailLength > 0 && retainedStartLocal < totalValidSamples) {
      this.rawArena.copyWithin(0, retainedStartLocal, totalValidSamples);
      this.filteredArena.copyWithin(0, retainedStartLocal, totalValidSamples);
      this.tailLength = newTailLength;
    } else {
      this.tailLength = 0;
    }
    this.currentArenaValidSamples = this.tailLength;

    // 8. Commit Global Ingested Sample Count
    this.globalIngestedSamples += incomingLen;
  }

  /**
   * Registers a new candidate onset for deferred low-frequency measurement over [k - 256, k + 1279].
   * If all required samples are already present in the current arena, resolves immediately.
   * If onsetGlobalSample < 256, physical start is clamped to 0 and resolves as 'truncated'.
   */
  public registerDeferredCandidate(
    candidateId: number,
    onsetGlobalSample: number,
    callerWallTimeMs: number,
    onDeferredResolved: (candidateId: number, measurement: DeferredLowFrequencyMeasurement) => void
  ): boolean {
    const physicalStartGlobal = Math.max(0, onsetGlobalSample - 256);
    const targetGlobal = onsetGlobalSample + (this.deferredWindowSamples - 256 - 1); // k + 1279
    const isOriginTruncated = onsetGlobalSample < 256;
    const requiredSamples = targetGlobal - physicalStartGlobal + 1;

    const arenaGlobalStart = this.getArenaGlobalStartSample();
    const currentValidSamples = this.currentArenaValidSamples;
    const arenaGlobalEnd = arenaGlobalStart + currentValidSamples - 1;

    // Check if fully contained in current arena
    if (physicalStartGlobal >= arenaGlobalStart && targetGlobal <= arenaGlobalEnd) {
      const localStart = physicalStartGlobal - arenaGlobalStart;
      const filteredSlice = this.filteredArena.subarray(localStart, localStart + requiredSamples);
      const rms = this.calculateRms(filteredSlice);

      onDeferredResolved(candidateId, {
        status: isOriginTruncated ? 'truncated' : 'complete',
        isComplete: !isOriginTruncated,
        samplesEvaluated: requiredSamples,
        targetSamples: this.deferredWindowSamples,
        sub200HzRms: rms,
        isTruncated: isOriginTruncated,
      });
      return true;
    }

    // Find an available staging slot
    let slot: StagingSlot | null = null;
    for (let i = 0; i < this.stagingSlots.length; i++) {
      if (!this.stagingSlots[i].inUse) {
        slot = this.stagingSlots[i];
        break;
      }
    }

    if (!slot) {
      this.deferredQueueOverflows++;
      return false; // Queue full
    }

    // Initialize slot
    slot.inUse = true;
    slot.candidateId = candidateId;
    slot.onsetGlobalSample = onsetGlobalSample;
    slot.startGlobalSample = physicalStartGlobal;
    slot.targetGlobalSample = targetGlobal;
    slot.samplesAccumulated = 0;
    slot.createdAtWallTimeMs = callerWallTimeMs;

    // Extract available samples up to current arena end
    if (physicalStartGlobal <= arenaGlobalEnd) {
      const copyStartGlobal = Math.max(physicalStartGlobal, arenaGlobalStart);
      const copyEndGlobal = Math.min(targetGlobal, arenaGlobalEnd);
      const count = copyEndGlobal - copyStartGlobal + 1;

      if (count > 0) {
        const arenaOffset = copyStartGlobal - arenaGlobalStart;
        slot.buffer.set(this.filteredArena.subarray(arenaOffset, arenaOffset + count), slot.samplesAccumulated);
        slot.samplesAccumulated += count;
      }
    }

    return true;
  }

  /**
   * Flushes all active deferred staging slots (called on engine.stop() or engine.flush()).
   */
  public flush(onDeferredResolved: (candidateId: number, measurement: DeferredLowFrequencyMeasurement) => void): void {
    for (let i = 0; i < this.stagingSlots.length; i++) {
      const slot = this.stagingSlots[i];
      if (!slot.inUse) continue;

      if (slot.samplesAccumulated === 0) {
        onDeferredResolved(slot.candidateId, {
          status: 'cancelled',
          isComplete: false,
          samplesEvaluated: 0,
          targetSamples: this.deferredWindowSamples,
          sub200HzRms: null,
          isTruncated: false,
        });
      } else {
        const slice = slot.buffer.subarray(0, slot.samplesAccumulated);
        const rms = this.calculateRms(slice);
        onDeferredResolved(slot.candidateId, {
          status: 'truncated',
          isComplete: false,
          samplesEvaluated: slot.samplesAccumulated,
          targetSamples: this.deferredWindowSamples,
          sub200HzRms: rms,
          isTruncated: true,
        });
      }

      slot.inUse = false;
      slot.samplesAccumulated = 0;
    }
  }

  public getDiagnostics(sampleRate: number): TransportDiagnostics {
    const sRate = sampleRate > 0 ? sampleRate : 48000;
    return {
      jsCallbackSequence: this.jsCallbackSequence,
      sampleCount: this.globalIngestedSamples,
      totalSamplesIngested: this.globalIngestedSamples,
      sampleTimeSec: this.globalIngestedSamples / sRate,
      nativeTimestampSec: this.lastNativeTimestampSec,
      callbackArrivalDeltaMs: this.lastCallbackWallTimeMs > 0 ? this.lastCallbackWallTimeMs : 0,
      suspectedTransportGaps: this.suspectedTransportGaps,
      streamRestartsDetected: this.streamRestartsDetected,
      continuityBreaksDetected: this.continuityBreaksDetected,
      slotsInvalidatedByDiscontinuity: this.slotsInvalidatedByDiscontinuity,
      deferredQueueOverflows: this.deferredQueueOverflows,
      arenaReallocations: this.arenaReallocations,
    };
  }

  /**
   * Returns a direct view of the raw arena for envelope back-projection.
   */
  public getRawArena(): Float32Array {
    return this.rawArena;
  }

  // --- PRIVATE HELPERS ---

  private evaluateContinuityHeuristics(
    metadata: AudioBufferMetadata,
    callerWallTimeMs: number,
    callbacks: FrameProcessingCallbacks
  ): void {
    if (this.lastCallbackWallTimeMs > 0) {
      const wallDelta = callerWallTimeMs - this.lastCallbackWallTimeMs;
      if (metadata.nativeTimestampSec > 0 && this.lastNativeTimestampSec > 0) {
        const nativeDelta = metadata.nativeTimestampSec - this.lastNativeTimestampSec;

        // 1. Timestamp Regression (Stream Restart)
        if (nativeDelta < -0.05) {
          this.streamRestartsDetected++;
          this.invalidateActiveSlots(callbacks);
        }
        // 2. Severe Delivery Gap (> 350 ms for nominal 100 ms)
        else if (nativeDelta > 0.35) {
          this.suspectedTransportGaps++;
          this.continuityBreaksDetected++;
          this.invalidateActiveSlots(callbacks);
        }
      }
    }

    this.lastNativeTimestampSec = metadata.nativeTimestampSec;
    this.lastCallbackWallTimeMs = callerWallTimeMs;

    // Check expiration on pending slots (> 500 ms without completion)
    for (let i = 0; i < this.stagingSlots.length; i++) {
      const slot = this.stagingSlots[i];
      if (slot.inUse && callerWallTimeMs - slot.createdAtWallTimeMs >= 500) {
        callbacks.onDeferredResolved(slot.candidateId, {
          status: 'expired',
          isComplete: false,
          samplesEvaluated: slot.samplesAccumulated,
          targetSamples: this.deferredWindowSamples,
          sub200HzRms: null,
          isTruncated: false,
        });
        slot.inUse = false;
        slot.samplesAccumulated = 0;
      }
    }
  }

  private invalidateActiveSlots(callbacks: FrameProcessingCallbacks): void {
    for (let i = 0; i < this.stagingSlots.length; i++) {
      const slot = this.stagingSlots[i];
      if (slot.inUse) {
        this.slotsInvalidatedByDiscontinuity++;
        callbacks.onDeferredResolved(slot.candidateId, {
          status: 'invalidated',
          isComplete: false,
          samplesEvaluated: slot.samplesAccumulated,
          targetSamples: this.deferredWindowSamples,
          sub200HzRms: null,
          isTruncated: false,
        });
        slot.inUse = false;
        slot.samplesAccumulated = 0;
      }
    }
  }

  private growArena(requiredCapacity: number): void {
    let newCap = this.arenaCapacity;
    while (newCap < requiredCapacity) {
      newCap *= 2;
    }
    const newRaw = new Float32Array(newCap);
    const newFilt = new Float32Array(newCap);

    newRaw.set(this.rawArena.subarray(0, this.tailLength));
    newFilt.set(this.filteredArena.subarray(0, this.tailLength));

    this.rawArena = newRaw;
    this.filteredArena = newFilt;
    this.arenaCapacity = newCap;
    this.arenaReallocations++;
  }

  private filterIncomingSamples(startOffset: number, count: number): void {
    const sRate = this.sampleRate > 0 ? this.sampleRate : 48000;
    const dt = 1.0 / sRate;

    // DC Blocking single-pole filter (~10 Hz cutoff)
    const rcDc = 1.0 / (2.0 * Math.PI * 10.0);
    const alphaDc = rcDc / (rcDc + dt);

    // 2nd-order Butterworth low-pass filter (180 Hz)
    const fc = this.lowPassCutoffHz;
    const rcLp = 1.0 / (2.0 * Math.PI * fc);
    const alphaLp = dt / (rcLp + dt);

    for (let i = 0; i < count; i++) {
      const x = this.rawArena[startOffset + i];

      // DC blocking
      const yDc = alphaDc * (this.dcOutPrev + x - this.dcInPrev);
      this.dcInPrev = x;
      this.dcOutPrev = yDc;

      // Cascaded 2-pole lowpass
      this.lpState1 += alphaLp * (yDc - this.lpState1);
      this.lpState2 += alphaLp * (this.lpState1 - this.lpState2);

      this.filteredArena[startOffset + i] = this.lpState2;
    }
  }

  private appendSamplesToPendingSlots(
    arenaGlobalStart: number,
    arenaGlobalEnd: number,
    totalValidSamples: number,
    callbacks: FrameProcessingCallbacks
  ): void {
    for (let i = 0; i < this.stagingSlots.length; i++) {
      const slot = this.stagingSlots[i];
      if (!slot.inUse) continue;

      const requiredSamples = slot.targetGlobalSample - slot.startGlobalSample + 1;
      if (slot.samplesAccumulated >= requiredSamples) continue;

      const neededGlobalStart = slot.startGlobalSample + slot.samplesAccumulated;
      const neededGlobalEnd = slot.targetGlobalSample;

      if (neededGlobalStart <= arenaGlobalEnd && neededGlobalEnd >= arenaGlobalStart) {
        const copyStartGlobal = Math.max(neededGlobalStart, arenaGlobalStart);
        const copyEndGlobal = Math.min(neededGlobalEnd, arenaGlobalEnd);
        const count = copyEndGlobal - copyStartGlobal + 1;

        if (count > 0) {
          const arenaOffset = copyStartGlobal - arenaGlobalStart;
          slot.buffer.set(this.filteredArena.subarray(arenaOffset, arenaOffset + count), slot.samplesAccumulated);
          slot.samplesAccumulated += count;

          // Check if slot has reached required target samples
          if (slot.samplesAccumulated >= requiredSamples) {
            const isOriginTruncated = slot.onsetGlobalSample < 256;
            const evalSlice = slot.buffer.subarray(0, requiredSamples);
            const rms = this.calculateRms(evalSlice);
            callbacks.onDeferredResolved(slot.candidateId, {
              status: isOriginTruncated ? 'truncated' : 'complete',
              isComplete: !isOriginTruncated,
              samplesEvaluated: requiredSamples,
              targetSamples: this.deferredWindowSamples,
              sub200HzRms: rms,
              isTruncated: isOriginTruncated,
            });
            slot.inUse = false;
            slot.samplesAccumulated = 0;
          }
        }
      }
    }
  }

  private calculateRms(buffer: Float32Array): number {
    const len = buffer.length;
    if (len === 0) return 0;
    let sumSq = 0;
    for (let i = 0; i < len; i++) {
      sumSq += buffer[i] * buffer[i];
    }
    return Math.sqrt(sumSq / len);
  }
}
