/**
 * Feature: Lyrics (READ Pillar)
 *
 * Responsibilities:
 * - Real-time synchronized lyrics rendering.
 * - Active lyric line highlight with high-contrast accessibility.
 * - Previous line and upcoming preview lines.
 * - Explicit instrumental gap / transition indicators.
 * - Transparent demonstration disclosure for instrumental audio.
 */

export interface LyricsDisplayOptions {
  fontSizeScale: number;
  showTranslation: boolean;
  highlightColor: string;
}

export * from './demoTrackLyrics';
export * from './useLyrics';
export { LyricsCard } from './components/LyricsCard';
export * from '@/engines/lyrics';
