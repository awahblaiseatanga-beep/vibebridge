import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  NativeAudioDecodeProgress,
  NativeAudioDecodeRequest,
  NativeAudioDecodeResponse,
  NativeAudioDecoderAvailability,
  NativeAudioProbeResult,
  NativePcmChunk,
  NativePcmDecodeSession,
} from './types';

interface RawNativePcmChunk extends Omit<NativePcmChunk, 'pcmData'> {
  pcmData?: Uint8Array | number[] | ArrayBuffer | null;
}

interface VibeBridgeAudioDecoderNativeModule {
  isAvailable?: () => boolean;
  getAvailabilityAsync?: () => Promise<NativeAudioDecoderAvailability>;
  probeAudioFileAsync?: (uri: string) => Promise<NativeAudioProbeResult>;
  openDecodeSessionAsync?: (
    uri: string,
    chunkDurationMs?: number,
    maxChunkBytes?: number
  ) => Promise<NativePcmDecodeSession>;
  readNextPcmChunkAsync?: (sessionId: string) => Promise<RawNativePcmChunk>;
  cancelDecodeSessionAsync?: (sessionId: string) => Promise<boolean>;
  closeDecodeSessionAsync?: (sessionId: string) => Promise<boolean>;
}

function getNativeModule(): VibeBridgeAudioDecoderNativeModule | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  try {
    return requireOptionalNativeModule<VibeBridgeAudioDecoderNativeModule>(
      'VibeBridgeAudioDecoder'
    );
  } catch {
    return null;
  }
}

function normalizePcmBytes(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) {
    return raw;
  }
  if (raw instanceof ArrayBuffer) {
    return new Uint8Array(raw);
  }
  if (ArrayBuffer.isView(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  }
  if (Array.isArray(raw)) {
    return Uint8Array.from(raw);
  }
  return new Uint8Array(0);
}

/**
 * Queries real native MediaCodec audio decoder availability without simulating decoding.
 * Safely reports `moduleInstalled: false` when running inside Expo Go or on non-Android platforms.
 */
export async function checkAudioDecoderAvailability(): Promise<NativeAudioDecoderAvailability> {
  if (Platform.OS !== 'android') {
    return {
      moduleInstalled: false,
      moduleAvailable: false,
      capabilitySupported: false,
      decoderImplemented: false,
      status: 'unsupported',
      supportedFormats: [],
      codecDetails: {},
      errorCode: 'UNSUPPORTED_PLATFORM',
      error: `Native MediaCodec decoder is Android-only (current platform: ${Platform.OS}).`,
    };
  }

  const nativeModule = getNativeModule();
  if (!nativeModule || typeof nativeModule.getAvailabilityAsync !== 'function') {
    return {
      moduleInstalled: false,
      moduleAvailable: false,
      capabilitySupported: false,
      decoderImplemented: false,
      status: 'unavailable',
      supportedFormats: [],
      codecDetails: {},
      errorCode: 'UNAVAILABLE',
      error:
        'VibeBridgeAudioDecoder native module is not installed in this runtime (Expo Go). Custom development build required.',
    };
  }

  try {
    const result = await nativeModule.getAvailabilityAsync();
    return {
      ...result,
      moduleInstalled: Boolean(result?.moduleInstalled ?? true),
      moduleAvailable: Boolean(result?.moduleAvailable),
      capabilitySupported: Boolean(result?.capabilitySupported),
      decoderImplemented: Boolean(result?.decoderImplemented ?? false),
      status: result?.status ?? 'executed',
      supportedFormats: Array.isArray(result?.supportedFormats) ? result.supportedFormats : [],
      codecDetails: result?.codecDetails ?? {},
    };
  } catch (err: any) {
    return {
      moduleInstalled: true,
      moduleAvailable: false,
      capabilitySupported: false,
      decoderImplemented: false,
      status: 'failed',
      supportedFormats: [],
      codecDetails: {},
      errorCode: 'DECODE_ERROR',
      error: err?.message || 'Failed querying VibeBridgeAudioDecoder availability.',
    };
  }
}

/**
 * Probes an audio file using Android MediaExtractor + MediaCodec container/MIME inspection.
 * Never infers codec support from filename extensions alone.
 */
export async function probeAudioFileNative(uri: string): Promise<NativeAudioProbeResult> {
  if (Platform.OS !== 'android') {
    return {
      moduleInstalled: false,
      moduleAvailable: false,
      capabilitySupported: false,
      decoderImplemented: false,
      supported: false,
      status: 'unsupported',
      errorCode: 'UNSUPPORTED_PLATFORM',
      error: `Native MediaExtractor probe is Android-only (current platform: ${Platform.OS}).`,
    };
  }

  const nativeModule = getNativeModule();
  if (!nativeModule || typeof nativeModule.probeAudioFileAsync !== 'function') {
    return {
      moduleInstalled: false,
      moduleAvailable: false,
      capabilitySupported: false,
      decoderImplemented: false,
      supported: false,
      status: 'unavailable',
      errorCode: 'UNAVAILABLE',
      error: 'VibeBridgeAudioDecoder PCM probe is not available in this runtime.',
    };
  }

  try {
    const res = await nativeModule.probeAudioFileAsync(uri);
    return {
      ...res,
      moduleInstalled: Boolean(res?.moduleInstalled ?? true),
      moduleAvailable: Boolean(res?.moduleAvailable ?? true),
      capabilitySupported: Boolean(res?.capabilitySupported),
      decoderImplemented: Boolean(res?.decoderImplemented ?? true),
      supported: Boolean(res?.supported && res?.status === 'executed'),
      status: res?.status ?? 'failed',
    };
  } catch (err: any) {
    return {
      moduleInstalled: true,
      moduleAvailable: true,
      capabilitySupported: false,
      decoderImplemented: true,
      supported: false,
      status: 'failed',
      errorCode: 'DECODE_ERROR',
      error: err?.message || 'Native audio probe threw an unexpected exception.',
    };
  }
}

export async function openAudioDecodeSessionNative(
  request: NativeAudioDecodeRequest
): Promise<NativePcmDecodeSession> {
  if (Platform.OS !== 'android') {
    return {
      moduleInstalled: false,
      moduleAvailable: false,
      capabilitySupported: false,
      decoderImplemented: false,
      status: 'unsupported',
      sampleRate: 0,
      channelCount: 0,
      pcmEncoding: 'int16',
      durationMs: 0,
      errorCode: 'UNSUPPORTED_PLATFORM',
      error: `Native PCM decoding is Android-only (current platform: ${Platform.OS}).`,
    };
  }

  const nativeModule = getNativeModule();
  if (
    !nativeModule ||
    typeof nativeModule.openDecodeSessionAsync !== 'function' ||
    typeof nativeModule.readNextPcmChunkAsync !== 'function'
  ) {
    return {
      moduleInstalled: false,
      moduleAvailable: false,
      capabilitySupported: false,
      decoderImplemented: false,
      status: 'unavailable',
      sampleRate: 0,
      channelCount: 0,
      pcmEncoding: 'int16',
      durationMs: 0,
      errorCode: 'UNAVAILABLE',
      error:
        'VibeBridgeAudioDecoder streaming session API is not installed in this runtime.',
    };
  }

  try {
    const session = await nativeModule.openDecodeSessionAsync(
      request.uri,
      request.chunkDurationMs,
      request.maxChunkBytes
    );
    return {
      ...session,
      moduleInstalled: Boolean(session?.moduleInstalled ?? true),
      moduleAvailable: Boolean(session?.moduleAvailable ?? true),
      capabilitySupported: Boolean(session?.capabilitySupported),
      decoderImplemented: Boolean(session?.decoderImplemented ?? true),
      status: session?.status ?? 'failed',
      sampleRate: Number(session?.sampleRate ?? 0),
      channelCount: Number(session?.channelCount ?? 0),
      pcmEncoding: session?.pcmEncoding ?? 'int16',
      durationMs: Number(session?.durationMs ?? 0),
    };
  } catch (err: any) {
    return {
      moduleInstalled: true,
      moduleAvailable: true,
      capabilitySupported: false,
      decoderImplemented: true,
      status: 'failed',
      sampleRate: 0,
      channelCount: 0,
      pcmEncoding: 'int16',
      durationMs: 0,
      errorCode: 'DECODE_ERROR',
      error: err?.message || 'Failed opening native PCM decode session.',
    };
  }
}

export async function readNextPcmChunkNative(
  sessionId: string
): Promise<NativePcmChunk> {
  const nativeModule = getNativeModule();
  if (!nativeModule || typeof nativeModule.readNextPcmChunkAsync !== 'function') {
    return {
      moduleInstalled: false,
      moduleAvailable: false,
      capabilitySupported: false,
      decoderImplemented: false,
      status: 'unavailable',
      errorCode: 'UNAVAILABLE',
      error: 'Native PCM chunk reader unavailable.',
      sessionId,
      chunkIndex: 0,
      sampleRate: 0,
      channelCount: 0,
      pcmEncoding: 'int16',
      frameCount: 0,
      byteLength: 0,
      pcmData: new Uint8Array(0),
      startTimeMs: 0,
      endTimeMs: 0,
      rms: 0,
      peak: 0,
      progress: 0,
      isLastChunk: true,
      cancelled: false,
    };
  }

  try {
    const raw = await nativeModule.readNextPcmChunkAsync(sessionId);
    const pcmData = normalizePcmBytes(raw?.pcmData);
    return {
      ...raw,
      moduleInstalled: Boolean(raw?.moduleInstalled ?? true),
      moduleAvailable: Boolean(raw?.moduleAvailable ?? true),
      capabilitySupported: Boolean(raw?.capabilitySupported ?? true),
      decoderImplemented: Boolean(raw?.decoderImplemented ?? true),
      status: raw?.status ?? 'executed',
      sessionId: raw?.sessionId ?? sessionId,
      chunkIndex: Number(raw?.chunkIndex ?? 0),
      sampleRate: Number(raw?.sampleRate ?? 0),
      channelCount: Number(raw?.channelCount ?? 0),
      pcmEncoding: raw?.pcmEncoding ?? 'int16',
      frameCount: Number(raw?.frameCount ?? 0),
      byteLength: Number(raw?.byteLength ?? pcmData.byteLength),
      pcmData,
      startTimeMs: Number(raw?.startTimeMs ?? 0),
      endTimeMs: Number(raw?.endTimeMs ?? 0),
      rms: Number(raw?.rms ?? 0),
      peak: Number(raw?.peak ?? 0),
      progress: Number(raw?.progress ?? 0),
      isLastChunk: Boolean(raw?.isLastChunk),
      cancelled: Boolean(raw?.cancelled),
    };
  } catch (err: any) {
    return {
      moduleInstalled: true,
      moduleAvailable: true,
      capabilitySupported: false,
      decoderImplemented: true,
      status: 'failed',
      errorCode: 'DECODE_ERROR',
      error: err?.message || 'Native PCM chunk read threw an exception.',
      sessionId,
      chunkIndex: 0,
      sampleRate: 0,
      channelCount: 0,
      pcmEncoding: 'int16',
      frameCount: 0,
      byteLength: 0,
      pcmData: new Uint8Array(0),
      startTimeMs: 0,
      endTimeMs: 0,
      rms: 0,
      peak: 0,
      progress: 0,
      isLastChunk: true,
      cancelled: false,
    };
  }
}

export async function cancelAudioDecodeSessionNative(sessionId: string): Promise<boolean> {
  const nativeModule = getNativeModule();
  if (!nativeModule || typeof nativeModule.cancelDecodeSessionAsync !== 'function') {
    return false;
  }
  try {
    return Boolean(await nativeModule.cancelDecodeSessionAsync(sessionId));
  } catch {
    return false;
  }
}

export async function closeAudioDecodeSessionNative(sessionId: string): Promise<boolean> {
  const nativeModule = getNativeModule();
  if (!nativeModule || typeof nativeModule.closeDecodeSessionAsync !== 'function') {
    return false;
  }
  try {
    return Boolean(await nativeModule.closeDecodeSessionAsync(sessionId));
  } catch {
    return false;
  }
}

export interface StreamDecodeOptions {
  onChunk?: (chunk: NativePcmChunk) => void | Promise<void>;
  onProgress?: (progress: NativeAudioDecodeProgress) => void;
  isCancelled?: () => boolean;
}

/**
 * Streams an entire audio track through MediaExtractor + MediaCodec in bounded PCM chunks,
 * preserving the native decoded sample rate & channel count, reporting progress, and
 * guaranteeing native codec/extractor cleanup even on error or cancellation.
 */
export async function streamDecodeAudioFileNative(
  request: NativeAudioDecodeRequest,
  options: StreamDecodeOptions = {}
): Promise<NativeAudioDecodeResponse> {
  options.onProgress?.({
    phase: 'opening',
    progress: 0,
    decodedDurationMs: 0,
    totalDurationMs: 0,
    chunksDecoded: 0,
    totalFramesDecoded: 0,
    totalPcmBytesDecoded: 0,
    sampleRate: 0,
    channelCount: 0,
  });

  const session = await openAudioDecodeSessionNative(request);
  if (session.status !== 'executed' || !session.sessionId) {
    options.onProgress?.({
      phase: 'error',
      progress: 0,
      decodedDurationMs: 0,
      totalDurationMs: session.durationMs ?? 0,
      chunksDecoded: 0,
      totalFramesDecoded: 0,
      totalPcmBytesDecoded: 0,
      sampleRate: session.sampleRate ?? 0,
      channelCount: session.channelCount ?? 0,
      mimeType: session.mimeType,
      codecName: session.codecName,
    });
    return {
      moduleInstalled: session.moduleInstalled,
      moduleAvailable: session.moduleAvailable,
      capabilitySupported: session.capabilitySupported,
      decoderImplemented: session.decoderImplemented,
      status: session.status,
      androidSdkInt: session.androidSdkInt,
      deviceModel: session.deviceModel,
      mimeType: session.mimeType,
      codecName: session.codecName,
      sampleRate: session.sampleRate,
      channelCount: session.channelCount,
      durationMs: session.durationMs,
      errorCode: session.errorCode,
      error: session.error || 'Failed to open native decode session.',
    };
  }

  const sessionId = session.sessionId;
  let chunksDecoded = 0;
  let totalFramesDecoded = 0;
  let totalSamplesDecoded = 0;
  let totalPcmBytesDecoded = 0;
  let maxChunkBytesObserved = 0;
  let decodedDurationMs = 0;
  let firstTimestampMs: number | null = null;
  let lastTimestampMs: number | null = null;
  let reachedEos = false;
  let observedSampleRate = session.sampleRate;
  let observedChannels = session.channelCount;
  let peakAmplitude = 0;
  let rmsWeightedSum = 0;
  let nonSilentChunks = 0;
  let wasCancelled = false;

  try {
    while (true) {
      if (options.isCancelled?.()) {
        wasCancelled = true;
        await cancelAudioDecodeSessionNative(sessionId);
        break;
      }

      const chunk = await readNextPcmChunkNative(sessionId);
      if (chunk.cancelled) {
        wasCancelled = true;
        break;
      }

      if (chunk.status !== 'executed') {
        options.onProgress?.({
          phase: 'error',
          progress: chunk.progress,
          decodedDurationMs,
          totalDurationMs: session.durationMs,
          chunksDecoded,
          totalFramesDecoded,
          totalPcmBytesDecoded,
          sampleRate: observedSampleRate,
          channelCount: observedChannels,
          mimeType: session.mimeType,
          codecName: session.codecName,
        });
        return {
          moduleInstalled: true,
          moduleAvailable: true,
          capabilitySupported: false,
          decoderImplemented: true,
          status: chunk.status,
          androidSdkInt: session.androidSdkInt,
          deviceModel: session.deviceModel,
          mimeType: session.mimeType,
          codecName: session.codecName,
          sampleRate: observedSampleRate,
          channelCount: observedChannels,
          durationMs: session.durationMs,
          decodedDurationMs,
          chunksDecoded,
          totalFramesDecoded,
          totalSamplesDecoded,
          totalPcmBytesDecoded,
          maxChunkBytesObserved,
          firstTimestampMs,
          lastTimestampMs,
          reachedEos: false,
          errorCode: chunk.errorCode || 'DECODE_ERROR',
          error: chunk.error || 'Error while decoding PCM chunk.',
        };
      }

      if (chunk.sampleRate > 0) observedSampleRate = chunk.sampleRate;
      if (chunk.channelCount > 0) observedChannels = chunk.channelCount;

      if (chunk.frameCount > 0 && chunk.byteLength > 0) {
        if (firstTimestampMs === null) {
          firstTimestampMs = chunk.startTimeMs;
        }
        lastTimestampMs = chunk.endTimeMs;
        chunksDecoded++;
        totalFramesDecoded += chunk.frameCount;
        totalSamplesDecoded += chunk.frameCount * Math.max(1, chunk.channelCount);
        totalPcmBytesDecoded += chunk.byteLength;
        if (chunk.byteLength > maxChunkBytesObserved) {
          maxChunkBytesObserved = chunk.byteLength;
        }
        decodedDurationMs = Math.max(decodedDurationMs, chunk.endTimeMs);
        if (chunk.peak > peakAmplitude) peakAmplitude = chunk.peak;
        rmsWeightedSum += chunk.rms * chunk.frameCount;
        if (chunk.rms > 0.001) nonSilentChunks++;

        if (options.onChunk) {
          await options.onChunk(chunk);
        }
      }

      options.onProgress?.({
        phase: chunk.isLastChunk ? 'completed' : 'decoding',
        progress: chunk.isLastChunk ? 1 : chunk.progress,
        decodedDurationMs,
        totalDurationMs: session.durationMs > 0 ? session.durationMs : decodedDurationMs,
        chunksDecoded,
        totalFramesDecoded,
        totalPcmBytesDecoded,
        sampleRate: observedSampleRate,
        channelCount: observedChannels,
        mimeType: session.mimeType,
        codecName: session.codecName,
      });

      if (chunk.isLastChunk) {
        reachedEos = true;
        break;
      }
    }

    if (wasCancelled) {
      options.onProgress?.({
        phase: 'cancelled',
        progress: session.durationMs > 0 ? Math.min(1, decodedDurationMs / session.durationMs) : 0,
        decodedDurationMs,
        totalDurationMs: session.durationMs,
        chunksDecoded,
        totalFramesDecoded,
        totalPcmBytesDecoded,
        sampleRate: observedSampleRate,
        channelCount: observedChannels,
        mimeType: session.mimeType,
        codecName: session.codecName,
      });

      return {
        moduleInstalled: true,
        moduleAvailable: true,
        capabilitySupported: true,
        decoderImplemented: true,
        status: 'failed',
        errorCode: 'CANCELLED',
        error: 'Audio decode session was cancelled.',
        cancelled: true,
        androidSdkInt: session.androidSdkInt,
        deviceModel: session.deviceModel,
        mimeType: session.mimeType,
        codecName: session.codecName,
        sampleRate: observedSampleRate,
        channelCount: observedChannels,
        pcmEncoding: session.pcmEncoding,
        nativePcmEncoding: session.nativePcmEncoding,
        durationMs: session.durationMs,
        decodedDurationMs,
        chunksDecoded,
        totalFramesDecoded,
        totalSamplesDecoded,
        totalPcmBytesDecoded,
        maxChunkBytesObserved,
        firstTimestampMs,
        lastTimestampMs,
        reachedEos: false,
      };
    }

    const meanRms = totalFramesDecoded > 0 ? rmsWeightedSum / totalFramesDecoded : 0;

    return {
      moduleInstalled: true,
      moduleAvailable: true,
      capabilitySupported: true,
      decoderImplemented: true,
      status: 'executed',
      androidSdkInt: session.androidSdkInt,
      deviceModel: session.deviceModel,
      mimeType: session.mimeType,
      codecName: session.codecName,
      sampleRate: observedSampleRate,
      channelCount: observedChannels,
      pcmEncoding: session.pcmEncoding,
      nativePcmEncoding: session.nativePcmEncoding,
      durationMs: session.durationMs > 0 ? session.durationMs : Math.round(decodedDurationMs),
      decodedDurationMs: Math.round(decodedDurationMs),
      chunksDecoded,
      totalFramesDecoded,
      totalSamplesDecoded,
      totalPcmBytesDecoded,
      maxChunkBytesObserved,
      firstTimestampMs,
      lastTimestampMs,
      reachedEos,
      peakAmplitude: Number(peakAmplitude.toFixed(4)),
      meanRms: Number(meanRms.toFixed(4)),
      nonSilentChunks,
      cancelled: false,
    };
  } finally {
    await closeAudioDecodeSessionNative(sessionId);
  }
}

/**
 * Convenience single-call wrapper that streams the full file through native MediaCodec
 * and returns the verified PCM summary without holding decoded samples in RAM.
 */
export async function decodeAudioFileNative(
  request: NativeAudioDecodeRequest
): Promise<NativeAudioDecodeResponse> {
  return streamDecodeAudioFileNative(request);
}
