/**
 * LyricsValidator
 *
 * Enforces strict validation of timestamped lyrics metadata.
 * Explicitly rejects invalid timestamps, overlapping segments, empty text,
 * and mismatched track IDs without silent modification or repair.
 */

import { LyricSegment, TrackLyrics } from './types';

export class LyricsValidationError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(`[LyricsValidationError] ${message}`);
    this.name = 'LyricsValidationError';
  }
}

export interface LyricsValidationResult {
  valid: boolean;
  errors: string[];
}

export class LyricsValidator {
  /**
   * Strictly validates a TrackLyrics payload.
   * Throws LyricsValidationError if any rule is violated.
   */
  public static validate(lyrics: TrackLyrics): void {
    const result = this.check(lyrics);
    if (!result.valid) {
      throw new LyricsValidationError(
        `Validation failed with ${result.errors.length} error(s):\n- ${result.errors.join('\n- ')}`,
        { errors: result.errors, trackId: lyrics?.trackId }
      );
    }
  }

  /**
   * Performs non-throwing validation and returns all encountered errors.
   */
  public static check(lyrics: TrackLyrics): LyricsValidationResult {
    const errors: string[] = [];

    if (!lyrics || typeof lyrics !== 'object') {
      return { valid: false, errors: ['TrackLyrics must be a non-null object.'] };
    }

    // 1. Track ID validation
    if (typeof lyrics.trackId !== 'string' || lyrics.trackId.trim().length === 0) {
      errors.push('trackId must be a non-empty string.');
    }

    // 2. Track Duration validation
    if (typeof lyrics.durationMs !== 'number' || !Number.isFinite(lyrics.durationMs) || lyrics.durationMs <= 0) {
      errors.push(`durationMs must be a positive finite number (received: ${lyrics.durationMs}).`);
    }

    // 3. Segments array validation
    if (!Array.isArray(lyrics.segments)) {
      errors.push('segments must be an array.');
      return { valid: false, errors };
    }

    const seenIds = new Set<string>();

    for (let i = 0; i < lyrics.segments.length; i++) {
      const seg = lyrics.segments[i];
      const prefix = `Segment[${i}]`;

      if (!seg || typeof seg !== 'object') {
        errors.push(`${prefix}: Must be an object.`);
        continue;
      }

      // ID validation
      if (typeof seg.id !== 'string' || seg.id.trim().length === 0) {
        errors.push(`${prefix}: id must be a non-empty string.`);
      } else if (seenIds.has(seg.id)) {
        errors.push(`${prefix}: Duplicate segment id '${seg.id}'.`);
      } else {
        seenIds.add(seg.id);
      }

      // Track ID association
      if (seg.trackId !== lyrics.trackId) {
        errors.push(
          `${prefix}: Mismatched trackId '${seg.trackId}' does not match container trackId '${lyrics.trackId}'.`
        );
      }

      // Text validation
      if (typeof seg.text !== 'string' || seg.text.trim().length === 0) {
        errors.push(`${prefix}: text must be a non-empty string.`);
      }

      // Timestamps validation
      if (typeof seg.startMs !== 'number' || !Number.isFinite(seg.startMs) || seg.startMs < 0) {
        errors.push(`${prefix}: startMs must be a non-negative finite number (received: ${seg.startMs}).`);
      }

      if (typeof seg.endMs !== 'number' || !Number.isFinite(seg.endMs)) {
        errors.push(`${prefix}: endMs must be a finite number.`);
      } else if (seg.endMs <= seg.startMs) {
        errors.push(
          `${prefix}: endMs (${seg.endMs}ms) must be strictly greater than startMs (${seg.startMs}ms).`
        );
      }

      if (
        typeof lyrics.durationMs === 'number' &&
        lyrics.durationMs > 0 &&
        typeof seg.endMs === 'number' &&
        seg.endMs > lyrics.durationMs
      ) {
        errors.push(
          `${prefix}: endMs (${seg.endMs}ms) extends beyond track duration (${lyrics.durationMs}ms).`
        );
      }

      // Ordering and Overlap validation relative to previous segment
      if (i > 0) {
        const prevSeg = lyrics.segments[i - 1];
        if (
          typeof prevSeg?.startMs === 'number' &&
          typeof seg.startMs === 'number' &&
          seg.startMs < prevSeg.startMs
        ) {
          errors.push(
            `${prefix}: Out of chronological order. startMs (${seg.startMs}ms) is before previous startMs (${prevSeg.startMs}ms).`
          );
        }

        if (
          typeof prevSeg?.endMs === 'number' &&
          typeof seg.startMs === 'number' &&
          seg.startMs < prevSeg.endMs
        ) {
          errors.push(
            `${prefix}: Overlapping segment detected. startMs (${seg.startMs}ms) occurs before previous endMs (${prevSeg.endMs}ms).`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
