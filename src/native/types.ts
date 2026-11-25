/**
 * Unified native module interfaces & capability status contracts (Stage 2).
 *
 * Strictly distinguishes:
 * - moduleInstalled: native module binary exists in the running runtime (Custom Dev Build vs Expo Go)
 * - moduleAvailable: native service/subsystem is accessible
 * - capabilitySupported: device hardware/codecs support the requested feature
 * - status: 'executed' | 'unsupported' | 'unavailable' | 'failed'
 */

export type NativeOperationStatus =
  | 'executed'
  | 'unsupported'
  | 'unavailable'
  | 'failed';

export type NativePcmEncoding = 'int16' | 'float32';

export type NativeAudioErrorCode =
  | 'UNAVAILABLE'
  | 'UNSUPPORTED_PLATFORM'
  | 'FILE_NOT_FOUND'
  | 'NO_AUDIO_TRACK'
  | 'UNSUPPORTED_CODEC'
  | 'CORRUPT_OR_INVALID_AUDIO'
  | 'DECODE_ERROR'
  | 'CANCELLED'
  | 'INVALID_SESSION';

export interface NativeBaseStatus {
  moduleInstalled: boolean;
  moduleAvailable: boolean;
  capabilitySupported: boolean;
  status: NativeOperationStatus;
  androidSdkInt?: number;
  deviceModel?: string;
  note?: string;
  error?: string;
  errorCode?: NativeAudioErrorCode | string;
}

export interface NativeAudioDecoderAvailability extends NativeBaseStatus {
  decoderImplemented: boolean;
  supportedFormats: string[];
  codecDetails: Record<string, boolean>;
}

export interface NativeAudioProbeResult extends NativeBaseStatus {
  decoderImplemented: boolean;
  supported: boolean;
  mimeType?: string;
  codecName?: string;
  sampleRate?: number;
  channelCount?: number;
  nativePcmEncoding?: string;
  durationMs?: number;
}

export interface NativeAudioDecodeRequest {
  uri: string;
  chunkDurationMs?: number;
  maxChunkBytes?: number;
}

export interface NativePcmDecodeSession extends NativeBaseStatus {
  decoderImplemented: boolean;
  sessionId?: string;
  mimeType?: string;
  codecName?: string;
  sampleRate: number;
  channelCount: number;
  pcmEncoding: NativePcmEncoding;
  nativePcmEncoding?: string;
  durationMs: number;
  chunkDurationMs?: number;
  maxChunkBytes?: number;
}

export interface NativePcmChunk extends NativeBaseStatus {
  decoderImplemented: boolean;
  sessionId: string;
  chunkIndex: number;
  sampleRate: number;
  channelCount: number;
  pcmEncoding: NativePcmEncoding;
  nativePcmEncoding?: string;
  frameCount: number;
  byteLength: number;
  pcmData: Uint8Array;
  startTimeMs: number;
  endTimeMs: number;
  rms: number;
  peak: number;
  progress: number;
  isLastChunk: boolean;
  cancelled: boolean;
}

export type NativeAudioDecodePhase =
  | 'opening'
  | 'decoding'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface NativeAudioDecodeProgress {
  phase: NativeAudioDecodePhase;
  progress: number; // 0.0 - 1.0
  decodedDurationMs: number;
  totalDurationMs: number;
  chunksDecoded: number;
  totalFramesDecoded: number;
  totalPcmBytesDecoded: number;
  sampleRate: number;
  channelCount: number;
  mimeType?: string;
  codecName?: string;
}

export interface NativeAudioDecodeResponse extends NativeBaseStatus {
  decoderImplemented: boolean;
  mimeType?: string;
  codecName?: string;
  sampleRate?: number;
  channelCount?: number;
  pcmEncoding?: NativePcmEncoding;
  nativePcmEncoding?: string;
  durationMs?: number;
  decodedDurationMs?: number;
  chunksDecoded?: number;
  totalFramesDecoded?: number;
  totalSamplesDecoded?: number;
  totalPcmBytesDecoded?: number;
  maxChunkBytesObserved?: number;
  firstTimestampMs?: number | null;
  lastTimestampMs?: number | null;
  reachedEos?: boolean;
  peakAmplitude?: number;
  meanRms?: number;
  nonSilentChunks?: number;
  cancelled?: boolean;
}

export interface NativeHapticsCapabilities extends NativeBaseStatus {
  hasVibrator: boolean;
  hasAmplitudeControl: boolean;
  supportsPrimitives: boolean;
  supportedPrimitives: Record<string, boolean>;
  rendererImplemented: boolean;
}

export interface NativeHapticPatternRequest {
  timingsMs: number[];
  amplitudes?: number[];
}

export interface NativeHapticRenderResponse extends NativeBaseStatus {
  rendererImplemented: false;
}
