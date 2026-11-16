/**
 * Feature: Lyrics (READ Pillar)
 *
 * Responsibilities:
 * - Real-time synchronized lyrics rendering.
 * - Active lyric line highlight with high-contrast accessibility.
 * - Auto-scrolling lyrics viewport anchored to synchronization clock.
 *
 * Status: Foundation milestone.
 */

export interface LyricsDisplayOptions {
  fontSizeScale: number;
  showTranslation: boolean;
  highlightColor: string;
}
