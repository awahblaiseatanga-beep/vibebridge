/**
 * VibeBridge Foundational Type Definitions
 * Strict TypeScript models for domain entities across engines, services, and UI.
 */

export type SensoryMode = 'read' | 'see' | 'feel';

export interface SensoryPillarConfig {
  readEnabled: boolean;
  seeEnabled: boolean;
  feelEnabled: boolean;
  hapticIntensity: number; // 0.0 - 1.0
  visualIntensity: number; // 0.0 - 1.0
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

export interface TrackMetadata {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationMs: number;
  uri: string;
  artworkUri?: string;
  hasLyrics: boolean;
  hasHapticTrack: boolean;
  hasVisualBeats: boolean;
  importedAt: string;
}

export interface LyricLine {
  id: string;
  timestampMs: number;
  text: string;
  translation?: string;
  isChorus?: boolean;
}

export interface HapticCue {
  id: string;
  timestampMs: number;
  intensity: number; // 0.0 - 1.0
  durationMs: number;
  type: 'impact' | 'rumble' | 'pulse' | 'sweep';
}

export interface VisualBeatCue {
  id: string;
  timestampMs: number;
  intensity: number; // 0.0 - 1.0
  frequencyBand: 'sub' | 'low' | 'mid' | 'high';
}

export interface PlaybackClock {
  positionMs: number;
  durationMs: number;
  status: PlaybackStatus;
  rate: number;
  isBuffering: boolean;
  errorMessage?: string | null;
}
