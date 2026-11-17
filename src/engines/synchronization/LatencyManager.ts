/**
 * LatencyManager
 *
 * Manages configurable cross-sensory latency compensation profiles.
 *
 * PROVISIONAL CALIBRATION NOTICE:
 * The default offset values below (audio: 0ms, haptic: 25ms, visual: 16ms, lyrics: 0ms)
 * are provisional, configurable baseline values intended for initial development and testing.
 * They are NOT measured characteristics of specific Android device hardware.
 * Physical latencies vary widely across Android manufacturers, motor types (LRA vs ERM),
 * display refresh rates (60Hz vs 120Hz), and Bluetooth codecs (SBC, AAC, LDAC).
 * The LatencyManager is designed to be calibrated per device/profile.
 *
 * Sign Convention:
 * Positive offset (+L ms) represents the latency from electrical trigger to physical perception.
 *   - hapticOffsetMs: Physical motor spin-up delay (default: 25ms)
 *   - visualOffsetMs: Display frame composition / rasterization delay (default: 16ms)
 *   - audioOffsetMs: Bluetooth or external buffer transport delay (default: 0ms)
 *   - lyricsOffsetMs: Text reading / cognitive processing lead (default: 0ms)
 *
 * Trigger Timestamp Formula:
 *   leadTimeMs = channelOffsetMs - audioOffsetMs
 *   triggerTimestampMs = Math.max(0, targetTimestampMs - leadTimeMs)
 */

import { LatencyOffsets, SensoryChannel } from './types';

export const DEFAULT_LATENCY_OFFSETS: LatencyOffsets = {
  audioOffsetMs: 0,
  hapticOffsetMs: 25,
  visualOffsetMs: 16,
  lyricsOffsetMs: 0,
};

export class LatencyManager {
  private offsets: LatencyOffsets;

  constructor(initialOffsets?: Partial<LatencyOffsets>) {
    this.offsets = {
      ...DEFAULT_LATENCY_OFFSETS,
      ...initialOffsets,
    };
  }

  public getOffsets(): LatencyOffsets {
    return { ...this.offsets };
  }

  public setOffsets(newOffsets: Partial<LatencyOffsets>): void {
    this.offsets = {
      ...this.offsets,
      ...newOffsets,
    };
  }

  public reset(): void {
    this.offsets = { ...DEFAULT_LATENCY_OFFSETS };
  }

  private getChannelOffset(channel: SensoryChannel): number {
    switch (channel) {
      case 'haptic':
        return this.offsets.hapticOffsetMs;
      case 'visual':
        return this.offsets.visualOffsetMs;
      case 'lyrics':
        return this.offsets.lyricsOffsetMs;
      case 'audio':
      default:
        return this.offsets.audioOffsetMs;
    }
  }

  /**
   * Computes the latency-compensated trigger timestamp for a given sensory channel.
   * Clamped to non-negative values.
   */
  public computeTriggerTimestamp(targetTimestampMs: number, channel: SensoryChannel): number {
    const channelDelay = this.getChannelOffset(channel);
    const audioDelay = this.offsets.audioOffsetMs;

    // leadTime is how much earlier the electrical command must be sent relative to audio
    const leadTimeMs = channelDelay - audioDelay;

    return Math.max(0, targetTimestampMs - leadTimeMs);
  }
}

export const latencyManager = new LatencyManager();
