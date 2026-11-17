/**
 * Engine: Lyrics (READ Pillar)
 *
 * Responsibilities:
 * - Deterministic timestamped lyrics validation and timeline management.
 * - Clock-anchored active line resolution in O(log n) time.
 * - Reactive state machine distinguishing active lines and instrumental gaps.
 * - Boundary event scheduling on the 'lyrics' sensory channel.
 */

export * from './types';
export * from './LyricsValidator';
export * from './LyricsTimeline';
export * from './LyricsEngine';
