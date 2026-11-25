/**
 * Native Foundation & Milestone 1 PCM Decoder Bridge Verification Suite
 *
 * Verifies:
 * - Expo Go fallback (optional native module absent -> unavailable)
 * - Non-Android platform -> unsupported
 * - Installed Custom Dev Build capability inspection (AudioDecoder + Haptics)
 * - Milestone 1 pull-based PCM streaming bridge:
 *   - Sample rate & channel preservation (44100 Hz & 48000 Hz without downsampling)
 *   - Multi-chunk progress tracking, non-zero RMS/peak, Uint8Array PCM forwarding, session close
 *   - Mid-stream cancellation + guaranteed native cancel & close cleanup
 *   - Corrupt/unsupported MIME error propagation without fabricated success
 */

const assert = require('assert');
const babel = require('@babel/core');
const vm = require('vm');

function transpile(filePath) {
  return babel.transformFileSync(filePath, {
    presets: ['babel-preset-expo'],
    filename: filePath,
  }).code;
}

const decoderCode = transpile('src/native/VibeBridgeAudioDecoder.ts');
const hapticsCode = transpile('src/native/VibeBridgeHaptics.ts');

function loadWithMocks({ platformOS, optionalModules }) {
  const exported = {};
  const load = (code) => {
    const sandbox = {
      require: (id) => {
        if (id === 'react-native') return { Platform: { OS: platformOS } };
        if (id === 'expo-modules-core') {
          return {
            requireOptionalNativeModule: (name) => optionalModules[name] ?? null,
          };
        }
        if (id === './types') return {};
        return require(id);
      },
      exports: {},
      module: { exports: {} },
      console,
      Uint8Array,
      ArrayBuffer,
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.exports;
  };
  Object.assign(exported, load(decoderCode), load(hapticsCode));
  return exported;
}

function makeInt16SineChunk(sampleRate, channelCount, frames, freqHz = 440) {
  const buf = new Uint8Array(frames * channelCount * 2);
  const view = new DataView(buf.buffer);
  for (let i = 0; i < frames; i++) {
    const val = Math.round(Math.sin((2 * Math.PI * freqHz * i) / sampleRate) * 16000);
    for (let c = 0; c < channelCount; c++) {
      view.setInt16((i * channelCount + c) * 2, val, true);
    }
  }
  return buf;
}

async function runTests() {
  console.log('🧪 Starting Native Foundation & Milestone 1 PCM Decoder Verification Suite...\n');

  // 1. Expo Go runtime (Android, modules missing)
  {
    const expoGoRuntime = loadWithMocks({ platformOS: 'android', optionalModules: {} });
    const dec = await expoGoRuntime.checkAudioDecoderAvailability();
    assert.strictEqual(dec.moduleInstalled, false);
    assert.strictEqual(dec.decoderImplemented, false);
    assert.strictEqual(dec.status, 'unavailable');

    const probe = await expoGoRuntime.probeAudioFileNative('file:///track.mp3');
    assert.strictEqual(probe.supported, false);
    assert.strictEqual(probe.status, 'unavailable');

    const stream = await expoGoRuntime.streamDecodeAudioFileNative({ uri: 'file:///track.mp3' });
    assert.strictEqual(stream.status, 'unavailable');
    assert.strictEqual(stream.errorCode, 'UNAVAILABLE');

    const hap = await expoGoRuntime.checkNativeHapticsCapabilities();
    assert.strictEqual(hap.moduleInstalled, false);
    assert.strictEqual(hap.rendererImplemented, false);
    assert.strictEqual(hap.status, 'unavailable');
    console.log('  ✓ Expo Go missing-module fallback verified across probe/decode/haptics');
  }

  // 2. Non-Android runtime
  {
    const webRuntime = loadWithMocks({ platformOS: 'web', optionalModules: {} });
    const dec = await webRuntime.checkAudioDecoderAvailability();
    assert.strictEqual(dec.status, 'unsupported');
    const stream = await webRuntime.streamDecodeAudioFileNative({ uri: 'file:///track.mp3' });
    assert.strictEqual(stream.status, 'unsupported');
    const hap = await webRuntime.checkNativeHapticsCapabilities();
    assert.strictEqual(hap.status, 'unsupported');
    console.log('  ✓ Non-Android platform check verified (reports unsupported)');
  }

  // 3. Custom Development Build — Streaming Decode preserving 48kHz stereo PCM
  {
    const closedSessions = [];
    const chunk0 = makeInt16SineChunk(48000, 2, 24000, 120); // 500ms
    const chunk1 = makeInt16SineChunk(48000, 2, 24000, 440); // 500ms
    let readCount = 0;

    const devRuntime = loadWithMocks({
      platformOS: 'android',
      optionalModules: {
        VibeBridgeAudioDecoder: {
          isAvailable: () => true,
          getAvailabilityAsync: async () => ({
            moduleInstalled: true,
            moduleAvailable: true,
            capabilitySupported: true,
            decoderImplemented: true,
            status: 'executed',
            supportedFormats: ['mp3', 'm4a', 'aac', 'flac', 'ogg', 'wav'],
            codecDetails: { mp3: true, m4a: true, aac: true, flac: true, ogg: true, wav: true },
            androidSdkInt: 35,
            deviceModel: 'Xiaomi 25028RN03A',
          }),
          probeAudioFileAsync: async () => ({
            moduleInstalled: true,
            moduleAvailable: true,
            capabilitySupported: true,
            decoderImplemented: true,
            supported: true,
            status: 'executed',
            mimeType: 'audio/mpeg',
            codecName: 'c2.android.mp3.decoder',
            sampleRate: 48000,
            channelCount: 2,
            durationMs: 1000,
          }),
          openDecodeSessionAsync: async () => ({
            moduleInstalled: true,
            moduleAvailable: true,
            capabilitySupported: true,
            decoderImplemented: true,
            status: 'executed',
            sessionId: 'sess-48k',
            mimeType: 'audio/mpeg',
            codecName: 'c2.android.mp3.decoder',
            sampleRate: 48000,
            channelCount: 2,
            pcmEncoding: 'int16',
            nativePcmEncoding: 'int16',
            durationMs: 1000,
          }),
          readNextPcmChunkAsync: async () => {
            if (readCount === 0) {
              readCount++;
              return {
                status: 'executed',
                sessionId: 'sess-48k',
                chunkIndex: 0,
                sampleRate: 48000,
                channelCount: 2,
                pcmEncoding: 'int16',
                frameCount: 24000,
                byteLength: chunk0.byteLength,
                pcmData: chunk0,
                startTimeMs: 0,
                endTimeMs: 500,
                rms: 0.34,
                peak: 0.48,
                progress: 0.5,
                isLastChunk: false,
                cancelled: false,
              };
            }
            readCount++;
            return {
              status: 'executed',
              sessionId: 'sess-48k',
              chunkIndex: 1,
              sampleRate: 48000,
              channelCount: 2,
              pcmEncoding: 'int16',
              frameCount: 24000,
              byteLength: chunk1.byteLength,
              pcmData: chunk1,
              startTimeMs: 500,
              endTimeMs: 1000,
              rms: 0.35,
              peak: 0.49,
              progress: 1.0,
              isLastChunk: true,
              cancelled: false,
            };
          },
          closeDecodeSessionAsync: async (id) => {
            closedSessions.push(id);
            return true;
          },
        },
        VibeBridgeHaptics: {
          isAvailable: () => true,
          getCapabilitiesAsync: async () => ({
            moduleInstalled: true,
            moduleAvailable: true,
            capabilitySupported: true,
            hasVibrator: true,
            hasAmplitudeControl: false,
            supportsPrimitives: false,
            supportedPrimitives: {},
            rendererImplemented: false,
            status: 'executed',
          }),
        },
      },
    });

    const probe = await devRuntime.probeAudioFileNative('file:///song.mp3');
    assert.strictEqual(probe.supported, true);
    assert.strictEqual(probe.sampleRate, 48000);
    assert.strictEqual(probe.codecName, 'c2.android.mp3.decoder');

    const observedChunks = [];
    const progressEvents = [];
    const res = await devRuntime.streamDecodeAudioFileNative(
      { uri: 'file:///song.mp3' },
      {
        onChunk: (chunk) => {
          assert(chunk.pcmData instanceof Uint8Array);
          assert.strictEqual(chunk.sampleRate, 48000);
          observedChunks.push(chunk);
        },
        onProgress: (p) => progressEvents.push(p),
      }
    );

    assert.strictEqual(res.status, 'executed');
    assert.strictEqual(res.sampleRate, 48000); // Preserved verbatim (no 24kHz downsampling)
    assert.strictEqual(res.channelCount, 2);
    assert.strictEqual(res.chunksDecoded, 2);
    assert.strictEqual(res.totalFramesDecoded, 48000);
    assert.strictEqual(res.totalSamplesDecoded, 96000);
    assert.strictEqual(res.totalPcmBytesDecoded, chunk0.byteLength + chunk1.byteLength);
    assert.strictEqual(res.maxChunkBytesObserved, chunk0.byteLength);
    assert.strictEqual(res.firstTimestampMs, 0);
    assert.strictEqual(res.lastTimestampMs, 1000);
    assert.strictEqual(res.reachedEos, true);
    assert(res.meanRms > 0.3);
    assert(res.peakAmplitude > 0.4);
    assert.strictEqual(observedChunks.length, 2);
    assert.strictEqual(progressEvents[0].phase, 'opening');
    assert.strictEqual(progressEvents[progressEvents.length - 1].phase, 'completed');
    assert.deepStrictEqual(closedSessions, ['sess-48k']);

    const hapResp = await devRuntime.renderNativeHapticWaveform({ timingsMs: [0, 50] });
    assert.strictEqual(hapResp.status, 'unsupported');
    assert.strictEqual(hapResp.rendererImplemented, false);
    console.log('  ✓ Streaming MediaCodec PCM bridge verified (48 kHz preserved, progress, cleanup)');
  }

  // 4. Mid-stream Cancellation & Corrupt File Error Handling
  {
    const cancelledIds = [];
    const closedIds = [];
    let shouldCancel = false;
    let reads = 0;

    const runtime = loadWithMocks({
      platformOS: 'android',
      optionalModules: {
        VibeBridgeAudioDecoder: {
          openDecodeSessionAsync: async (uri) => {
            if (uri.includes('corrupt')) {
              return {
                moduleInstalled: true,
                moduleAvailable: true,
                capabilitySupported: false,
                decoderImplemented: true,
                status: 'failed',
                errorCode: 'CORRUPT_OR_INVALID_AUDIO',
                error: 'Container header corrupt.',
                sampleRate: 0,
                channelCount: 0,
                pcmEncoding: 'int16',
                durationMs: 0,
              };
            }
            return {
              moduleInstalled: true,
              moduleAvailable: true,
              capabilitySupported: true,
              decoderImplemented: true,
              status: 'executed',
              sessionId: 'sess-cancel',
              mimeType: 'audio/flac',
              codecName: 'c2.android.flac.decoder',
              sampleRate: 44100,
              channelCount: 2,
              pcmEncoding: 'int16',
              durationMs: 5000,
            };
          },
          readNextPcmChunkAsync: async () => {
            reads++;
            shouldCancel = true;
            return {
              status: 'executed',
              sessionId: 'sess-cancel',
              chunkIndex: 0,
              sampleRate: 44100,
              channelCount: 2,
              pcmEncoding: 'int16',
              frameCount: 22050,
              byteLength: 88200,
              pcmData: new Uint8Array(88200),
              startTimeMs: 0,
              endTimeMs: 500,
              rms: 0.2,
              peak: 0.4,
              progress: 0.1,
              isLastChunk: false,
              cancelled: false,
            };
          },
          cancelDecodeSessionAsync: async (id) => {
            cancelledIds.push(id);
            return true;
          },
          closeDecodeSessionAsync: async (id) => {
            closedIds.push(id);
            return true;
          },
        },
      },
    });

    const cancelRes = await runtime.streamDecodeAudioFileNative(
      { uri: 'file:///long.flac' },
      { isCancelled: () => shouldCancel }
    );
    assert.strictEqual(cancelRes.status, 'failed');
    assert.strictEqual(cancelRes.errorCode, 'CANCELLED');
    assert.strictEqual(cancelRes.cancelled, true);
    assert.strictEqual(reads, 1);
    assert.deepStrictEqual(cancelledIds, ['sess-cancel']);
    assert.deepStrictEqual(closedIds, ['sess-cancel']);

    const corruptRes = await runtime.streamDecodeAudioFileNative({ uri: 'file:///corrupt.mp3' });
    assert.strictEqual(corruptRes.status, 'failed');
    assert.strictEqual(corruptRes.errorCode, 'CORRUPT_OR_INVALID_AUDIO');
    console.log('  ✓ Mid-stream cancellation & corrupt container handling verified');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL NATIVE FOUNDATION & MILESTONE 1 DECODER TESTS PASSED!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('❌ Native decoder test failed:', err);
  process.exit(1);
});
