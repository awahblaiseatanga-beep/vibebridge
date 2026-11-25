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

/**
 * Authoritative Track Lifecycle States:
 * importing -> decoding -> analyzing -> saving -> ready -> playing
 * Also includes 'failed' (explicit error with retry) and legacy 'complete' / 'fallback' aliases.
 */
export type TrackAnalysisStatus =
  | 'none'
  | 'importing'
  | 'decoding'
  | 'analyzing'
  | 'saving'
  | 'ready'
  | 'playing'
  | 'failed'
  | 'fallback'
  | 'complete';

export function isTrackPlayable(status?: TrackAnalysisStatus): boolean {
  return status === 'ready' || status === 'complete' || status === 'playing';
}

export interface TrackProcessingProgress {
  trackId: string;
  stage: 'importing' | 'decoding' | 'analyzing' | 'saving' | 'ready' | 'failed';
  processedDurationMs: number;
  totalDurationMs: number;
  percent: number; // 0.0 - 1.0 (or -1 if indeterminate)
  sampleRate?: number;
  channelCount?: number;
  totalSamplesDecoded?: number;
  detailMessage: string;
  error?: string;
}

export interface SensoryTimeline {
  version: 1;
  trackId: string;
  durationMs: number;
  sampleRate: number;
  channelCount: number;
  bpm: number;
  bpmConfidence: number; // 0.0 - 1.0
  energyConfidence: number; // 0.0 - 1.0 (independent from bpmConfidence)
  onsetConfidence: number; // 0.0 - 1.0 (independent from bpmConfidence)
  timeSignature: '4/4' | '3/4';
  energyEnvelope: number[]; // 500ms bins normalized [0..1]
  cues: any[]; // CanonicalRhythmCue[] driving FEEL & SEE
  rhythmicChanges: string[];
  summaryNote: string;
  timelinePath?: string;
  createdAt: string;
}

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
  fileSizeBytes?: number;
  mimeType?: string;
  isLocalImport?: boolean;
  analysisStatus?: TrackAnalysisStatus;
  bpm?: number;
  bpmConfidence?: number; // 0.0 - 1.0
  energyConfidence?: number; // 0.0 - 1.0
  onsetConfidence?: number; // 0.0 - 1.0
  rhythmScore?: any[];
  rhythmicChanges?: string[];
  summaryNote?: string;
  timelinePath?: string;
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
  updatedAtMs: number; // Monotonic timestamp (via performance.now()) when positionMs was read/anchored
  timelineRevision: number; // Monotonically increasing generation counter incremented on track loads and seeks
}
