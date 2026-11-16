/**
 * Engine: Lyrics (READ Pillar)
 *
 * Responsibilities:
 * - Parsing standard synchronized lyric formats (LRC, enhanced LRC, JSON).
 * - Fast binary-search index lookup for active lyric line given current timecode.
 * - Emitting line change and character-level karaoke highlight events.
 *
 * Status: Interface defined.
 */

import { LyricLine } from '@/types';

export interface LyricsEngine {
  parse(rawLyrics: string, format: 'lrc' | 'json'): LyricLine[];
  getActiveLine(positionMs: number): LyricLine | null;
  getNextLine(positionMs: number): LyricLine | null;
}
