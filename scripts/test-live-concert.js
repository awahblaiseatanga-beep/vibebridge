/**
 * Live Concert Audio Capture & Real-Time Haptic Translation Verification Suite
 *
 * Stage B-LIVE.2: Adaptive Haptic Intelligence, Physical Feedback Calibration & Haptic Testing Studio
 *
 * Verifies:
 * 1. LiveAudioAnalyzer DSP calculations (RMS, peak, 3-band energy, vocal estimation, relative transients).
 * 2. Stabilized noise-floor tracking that prevents quiet music self-choking.
 * 3. Configurable sensitivity profiles (Low, Normal, High) and automatic venue adaptation with hysteresis.
 * 4. Calibrated physical intensity profiles (Subtle, Balanced, Strong via React Native Vibration API).
 * 5. Haptic Testing Studio manual test triggering without microphone dependency.
 * 6. Non-destructive feature prioritization and interleaving (vocals not starved by bass).
 * 7. Immediate tactile cancellation and mute controls.
 * 8. LiveConcertAudioEngine lifecycle and orchestration.
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

const liveTypesCode = transpile('src/engines/live/types.ts');
const liveAnalyzerCode = transpile('src/engines/live/LiveAudioAnalyzer.ts');
const liveTranslatorCode = transpile('src/engines/live/LiveHapticTranslator.ts');
const liveEngineCode = transpile('src/engines/live/LiveConcertAudioEngine.ts');

const MockExpoHaptics = {
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  selectionAsync: async () => {},
  impactAsync: async () => {},
  notificationAsync: async () => {},
};

class MockHapticDriver {
  constructor() {
    this.calls = [];
  }
  async impactAsync(style) {
    this.calls.push({ method: 'impactAsync', style, time: Date.now() });
  }
  async notificationAsync(type) {
    this.calls.push({ method: 'notificationAsync', type, time: Date.now() });
  }
  async selectionAsync() {
    this.calls.push({ method: 'selectionAsync', time: Date.now() });
  }
  reset() {
    this.calls = [];
  }
}

class MockVibrationDriver {
  constructor() {
    this.calls = [];
    this.cancelled = false;
  }
  vibrate(pattern) {
    this.calls.push({ method: 'vibrate', pattern, time: Date.now() });
  }
  cancel() {
    this.cancelled = true;
    this.calls.push({ method: 'cancel', time: Date.now() });
  }
  reset() {
    this.calls = [];
    this.cancelled = false;
  }
}

const globalMockVibration = new MockVibrationDriver();

// Module sandbox
let exportedTypes = {};
let exportedAnalyzer = {};
let exportedTranslator = {};
let exportedEngine = {};

const mockAudioModule = {
  AudioStream: class MockAudioStream {
    constructor(options) {
      this.options = options;
      this.id = 'mock-stream-id';
      this.isStreaming = false;
      this.sampleRate = options.sampleRate || 48000;
      this.channels = options.channels || 1;
      this.listeners = new Map();
    }
    addListener(event, cb) {
      if (!this.listeners.has(event)) this.listeners.set(event, new Set());
      this.listeners.get(event).add(cb);
      return {
        remove: () => {
          this.listeners.get(event)?.delete(cb);
        },
      };
    }
    emit(event, payload) {
      this.listeners.get(event)?.forEach((cb) => cb(payload));
    }
    async start() {
      this.isStreaming = true;
      this.emit('audioStreamStatus', { isStreaming: true });
    }
    stop() {
      this.isStreaming = false;
      this.emit('audioStreamStatus', { isStreaming: false });
    }
  },
};

const mockExpoAudio = {
  getRecordingPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  requestRecordingPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  default: mockAudioModule,
};

const sandbox = {
  require: (id) => {
    if (id === 'react-native') return { Vibration: globalMockVibration };
    if (id === 'expo-haptics') return MockExpoHaptics;
    if (id === 'expo-audio') return mockExpoAudio;
    if (id === 'expo-audio/build/AudioModule') return mockAudioModule;
    if (id.includes('types')) return exportedTypes;
    if (id.includes('LiveAudioAnalyzer')) return exportedAnalyzer;
    if (id.includes('LiveHapticTranslator')) return exportedTranslator;
    if (id.includes('ExpoHapticEngine')) return { HapticDriver: {} };
    return require(id);
  },
  exports: {},
  module: { exports: {} },
  console,
  setTimeout,
  clearTimeout,
  performance: { now: () => Date.now() },
  Date,
  Math,
  Float32Array,
  Int16Array,
  ArrayBuffer,
  Set,
  Map,
};

function runInSandbox(code) {
  sandbox.module.exports = {};
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(code, sandbox);
  return sandbox.module.exports;
}

exportedTypes = runInSandbox(liveTypesCode);
exportedAnalyzer = runInSandbox(liveAnalyzerCode);
exportedTranslator = runInSandbox(liveTranslatorCode);
exportedEngine = runInSandbox(liveEngineCode);

const { LiveAudioAnalyzer } = exportedAnalyzer;
const { LiveHapticTranslator } = exportedTranslator;
const { LiveConcertAudioEngine } = exportedEngine;

/**
 * Generates an ArrayBuffer of synthetic sine wave float32 PCM samples.
 */
function generatePcmBuffer(sampleRate, durationSec, frequenciesWithAmplitudes) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (const [freq, amp] of frequenciesWithAmplitudes) {
      sample += amp * Math.sin(2 * Math.PI * freq * t);
    }
    buffer[i] = Math.max(-1.0, Math.min(1.0, sample));
  }

  return buffer.buffer;
}

/**
 * Generates an ArrayBuffer of synthetic 16-bit signed PCM samples.
 */
function generateInt16PcmBuffer(sampleRate, durationSec, frequenciesWithAmplitudes) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new Int16Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (const [freq, amp] of frequenciesWithAmplitudes) {
      sample += amp * Math.sin(2 * Math.PI * freq * t);
    }
    const clamped = Math.max(-1.0, Math.min(1.0, sample));
    buffer[i] = Math.round(clamped * 32767);
  }

  return buffer.buffer;
}

async function runTests() {
  console.log('🧪 Starting Stage B-LIVE.2 Adaptive Haptic Intelligence & Verification Suite...\n');
  let testCount = 0;
  const sampleRate = 48000;

  // --- Test 1: Silent PCM Buffer Analysis ---
  testCount++;
  console.log(`Test ${testCount}: Silent PCM Buffer Analysis`);
  {
    const analyzer = new LiveAudioAnalyzer();
    const silentBuffer = new Float32Array(4800).buffer;
    const features = analyzer.analyze(silentBuffer, sampleRate, 1, 0.1, 'float32');

    assert.strictEqual(features.rms, 0, 'Silent buffer must produce RMS = 0');
    assert.strictEqual(features.peak, 0, 'Silent buffer must produce Peak = 0');
    assert.strictEqual(features.lowEnergy, 0, 'Silent buffer must produce lowEnergy = 0');
    assert.strictEqual(features.midEnergy, 0, 'Silent buffer must produce midEnergy = 0');
    assert.strictEqual(features.highEnergy, 0, 'Silent buffer must produce highEnergy = 0');
    assert.strictEqual(features.isTransient, false, 'Silence must not trigger transient');
    assert.strictEqual(features.vocalActivityEstimate, 0, 'Silence must produce vocalActivityEstimate = 0');
    console.log('  ✓ Silent buffer yields zero energy and no false transients');
  }

  // --- Test 2: Low-Frequency Bass Tone Analysis ---
  testCount++;
  console.log(`Test ${testCount}: Low-Frequency Bass Tone Analysis`);
  {
    const analyzer = new LiveAudioAnalyzer();
    const bassBuffer = generatePcmBuffer(sampleRate, 0.1, [[80, 0.8]]);
    const features = analyzer.analyze(bassBuffer, sampleRate, 1, 0.1, 'float32');

    assert(features.rms > 0.4, `Expected RMS > 0.4, got ${features.rms}`);
    assert(features.lowEnergy > features.highEnergy * 3, `Low energy (${features.lowEnergy}) must dominate high energy for 80 Hz bass`);
    assert(features.lowEnergy > features.midEnergy, `Low energy must exceed mid energy for 80 Hz bass`);
    console.log(`  ✓ 80 Hz sub-bass correctly concentrated in lowEnergy (${features.lowEnergy.toFixed(3)})`);
  }

  // --- Test 3: High-Frequency Treble Tone Analysis ---
  testCount++;
  console.log(`Test ${testCount}: High-Frequency Treble Tone Analysis`);
  {
    const analyzer = new LiveAudioAnalyzer();
    const trebleBuffer = generatePcmBuffer(sampleRate, 0.1, [[6000, 0.7]]);
    const features = analyzer.analyze(trebleBuffer, sampleRate, 1, 0.1, 'float32');

    assert(features.highEnergy > features.lowEnergy * 3, 'High energy must dominate low energy for 6000 Hz');
    console.log(`  ✓ 6000 Hz tone correctly concentrated in highEnergy (${features.highEnergy.toFixed(3)})`);
  }

  // --- Test 4: Vocal-Range Activity Estimation ---
  testCount++;
  console.log(`Test ${testCount}: Vocal-Range Activity Estimation`);
  {
    const analyzer = new LiveAudioAnalyzer();
    const vocalBuffer = generatePcmBuffer(sampleRate, 0.1, [[1000, 0.6]]);
    const features = analyzer.analyze(vocalBuffer, sampleRate, 1, 0.1, 'float32');

    assert(features.vocalActivityEstimate > 0.5, `Expected vocal activity > 0.5, got ${features.vocalActivityEstimate}`);
    console.log(`  ✓ 1000 Hz tone yields strong vocal-range activity estimate (${features.vocalActivityEstimate.toFixed(3)})`);
  }

  // --- Test 5: Normalized Relative Transient Onset Detection ---
  testCount++;
  console.log(`Test ${testCount}: Normalized Relative Transient Onset Detection`);
  {
    const analyzer = new LiveAudioAnalyzer();
    // Quiet background (RMS ~0.02)
    const quietBuffer = generatePcmBuffer(sampleRate, 0.1, [[100, 0.02]]);
    const feat1 = analyzer.analyze(quietBuffer, sampleRate, 1, 0.1, 'float32');
    assert.strictEqual(feat1.isTransient, false, 'Quiet background should not trigger transient');

    // Sudden attack: quiet rimshot / beat rising from 0.02 to 0.08
    const quietAttackBuffer = generatePcmBuffer(sampleRate, 0.1, [[800, 0.11]]);
    const feat2 = analyzer.analyze(quietAttackBuffer, sampleRate, 1, 0.2, 'float32');
    assert.strictEqual(feat2.isTransient, true, 'Quiet attack surge must trigger relative transient');

    // Sustained continuation of the sound
    const feat3 = analyzer.analyze(quietAttackBuffer, sampleRate, 1, 0.3, 'float32');
    assert.strictEqual(feat3.isTransient, false, 'Sustained continuous tone must not trigger continuous transients');
    console.log('  ✓ Relative transient onset attack correctly detected on subtle volume surge and settles on sustain');
  }

  // --- Test 6: Int16 vs Float32 PCM Decoding Parity ---
  testCount++;
  console.log(`Test ${testCount}: Int16 vs Float32 PCM Decoding Parity`);
  {
    const analyzerFloat = new LiveAudioAnalyzer();
    const analyzerInt = new LiveAudioAnalyzer();

    const floatBuf = generatePcmBuffer(sampleRate, 0.1, [[440, 0.5]]);
    const intBuf = generateInt16PcmBuffer(sampleRate, 0.1, [[440, 0.5]]);

    const fRes = analyzerFloat.analyze(floatBuf, sampleRate, 1, 0.1, 'float32');
    const iRes = analyzerInt.analyze(intBuf, sampleRate, 1, 0.1, 'int16');

    assert(Math.abs(fRes.rms - iRes.rms) < 0.02);
    assert(Math.abs(fRes.peak - iRes.peak) < 0.02);
    console.log(`  ✓ Int16 and Float32 decoding produce identical normalized amplitude (float=${fRes.rms.toFixed(3)}, int=${iRes.rms.toFixed(3)})`);
  }

  // --- Test 7: Corrected Noise Floor Tracking & Sustained Quiet Music Stability ---
  testCount++;
  console.log(`Test ${testCount}: Corrected Noise Floor Stability on Sustained Quiet Music`);
  {
    const analyzer = new LiveAudioAnalyzer();
    // Simulate 30 buffers (3.0 seconds) of continuous quiet acoustic music (RMS ~0.045)
    for (let i = 0; i < 30; i++) {
      const musicBuf = generatePcmBuffer(sampleRate, 0.1, [[220, 0.04], [440, 0.03]]);
      analyzer.analyze(musicBuf, sampleRate, 1, i * 0.1, 'float32');
    }
    const finalFeatures = analyzer.analyze(
      generatePcmBuffer(sampleRate, 0.1, [[220, 0.04], [440, 0.03]]),
      sampleRate,
      1,
      3.1,
      'float32'
    );

    // Noise floor must NOT have tracked all the way up to music level (0.045)
    assert(finalFeatures.noiseFloor < 0.025, `Noise floor should remain low during music, got ${finalFeatures.noiseFloor}`);
    assert(finalFeatures.snrDb > 4, `SNR should remain positive for quiet music, got ${finalFeatures.snrDb}`);
    console.log(`  ✓ Noise floor successfully stabilized against music self-choking (${finalFeatures.noiseFloor.toFixed(3)}, SNR=${finalFeatures.snrDb.toFixed(1)} dB)`);
  }

  // --- Test 8: Acoustic Sensitivity Profiles (Low, Normal, High) ---
  testCount++;
  console.log(`Test ${testCount}: Acoustic Sensitivity Profiles`);
  {
    const analyzer = new LiveAudioAnalyzer();

    analyzer.setSensitivityProfile('low');
    assert.strictEqual(analyzer.getEffectiveSensitivity(), 0.65);

    analyzer.setSensitivityProfile('normal');
    assert.strictEqual(analyzer.getEffectiveSensitivity(), 1.0);

    analyzer.setSensitivityProfile('high');
    assert.strictEqual(analyzer.getEffectiveSensitivity(), 1.8);
    console.log('  ✓ Low (0.65x), Normal (1.0x), and High (1.8x) sensitivity profiles accurately scaled');
  }

  // --- Test 9: Automatic Venue Sensitivity Adaptation with Hysteresis ---
  testCount++;
  console.log(`Test ${testCount}: Automatic Venue Sensitivity Adaptation`);
  {
    const analyzer = new LiveAudioAnalyzer();
    analyzer.setAutoAdaptSensitivity(true);

    // Feed quiet musical passage for 2 seconds
    for (let i = 0; i < 25; i++) {
      const quietPassage = generatePcmBuffer(sampleRate, 0.1, [[300, 0.04]]);
      analyzer.analyze(quietPassage, sampleRate, 1, i * 0.1, 'float32');
    }

    const quietSens = analyzer.getEffectiveSensitivity();
    assert(quietSens > 1.05, `Auto-adapt should boost sensitivity for quiet music, got ${quietSens}`);

    // Now feed loud concert arena audio for 2.5 seconds
    for (let i = 25; i < 50; i++) {
      const loudPassage = generatePcmBuffer(sampleRate, 0.1, [[100, 0.8], [1000, 0.6]]);
      analyzer.analyze(loudPassage, sampleRate, 1, i * 0.1, 'float32');
    }

    const loudSens = analyzer.getEffectiveSensitivity();
    assert(loudSens < quietSens, `Auto-adapt should reduce sensitivity for loud passages (${loudSens} < ${quietSens})`);
    console.log(`  ✓ Auto-adapt dynamically boosted sensitivity in quiet (${quietSens.toFixed(2)}x) and dampened in loud (${loudSens.toFixed(2)}x)`);
  }

  // --- Test 10: Physical Intensity Profiles (Subtle, Balanced, Strong) ---
  testCount++;
  console.log(`Test ${testCount}: Physical Intensity Profiles & Driver Mapping`);
  {
    const mockHaptic = new MockHapticDriver();
    const mockVib = new MockVibrationDriver();

    const translator = new LiveHapticTranslator(
      { enabled: true, intensityProfile: 'subtle', cooldownMs: 0 },
      mockHaptic,
      mockVib
    );

    // 1. Subtle profile -> invokes ExpoHaptics Medium / Light
    await translator.testTrigger('bass_punch');
    assert.strictEqual(mockHaptic.calls.length, 1);
    assert.strictEqual(mockHaptic.calls[0].style, 'medium');
    assert.strictEqual(mockVib.calls.length, 0);

    // 2. Balanced profile -> invokes ExpoHaptics Heavy
    mockHaptic.reset();
    mockVib.reset();
    translator.setIntensityProfile('balanced');
    await translator.testTrigger('bass_punch');
    assert.strictEqual(mockHaptic.calls.length, 1);
    assert.strictEqual(mockHaptic.calls[0].style, 'heavy');
    assert.strictEqual(mockVib.calls.length, 0);

    // 3. Strong profile -> invokes Native Vibration with 60ms pulse
    mockHaptic.reset();
    mockVib.reset();
    translator.setIntensityProfile('strong');
    await translator.testTrigger('bass_punch');
    assert.strictEqual(mockHaptic.calls.length, 0, 'ExpoHaptics must not be called in Strong mode');
    assert.strictEqual(mockVib.calls.length, 1, 'Native Vibration must be called in Strong mode');
    assert.strictEqual(mockVib.calls[0].pattern, 60, 'Strong bass punch must be exactly 60ms pulse');
    console.log('  ✓ Subtle, Balanced, and Strong physical profiles correctly route to platform and hardware drivers');
  }

  // --- Test 11: Haptic Testing Studio Manual Triggers ---
  testCount++;
  console.log(`Test ${testCount}: Haptic Testing Studio Manual Pattern Triggers`);
  {
    const mockHaptic = new MockHapticDriver();
    const mockVib = new MockVibrationDriver();

    const translator = new LiveHapticTranslator(
      { enabled: true, intensityProfile: 'strong', cooldownMs: 0 },
      mockHaptic,
      mockVib
    );

    // Test Percussion Snap
    const percEvent = await translator.testTrigger('percussion_snap');
    assert.strictEqual(percEvent.type, 'percussion_snap');
    assert.strictEqual(percEvent.durationMs, 30);
    assert.strictEqual(mockVib.calls[0].pattern, 30);

    // Test Vocal Pulse
    const vocalEvent = await translator.testTrigger('vocal_pulse');
    assert.strictEqual(vocalEvent.type, 'vocal_pulse');
    assert.strictEqual(vocalEvent.durationMs, 18);
    assert.strictEqual(mockVib.calls[1].pattern, 18);

    // Test Melodic Sparkle
    const melEvent = await translator.testTrigger('melody_tick');
    assert.strictEqual(melEvent.type, 'melody_tick');
    assert.deepStrictEqual(Array.from(mockVib.calls[2].pattern), [0, 15, 30, 15]);

    console.log('  ✓ Haptic Testing Studio triggers distinct bounded physical patterns (30ms snap, 18ms pulse, double-tap sparkle)');
  }

  // --- Test 12: Non-Destructive Event Prioritization (Vocals Not Starved by Bass) ---
  testCount++;
  console.log(`Test ${testCount}: Non-Destructive Event Prioritization & Vocal Interleaving`);
  {
    const mockHaptic = new MockHapticDriver();
    const mockVib = new MockVibrationDriver();

    const translator = new LiveHapticTranslator(
      { enabled: true, intensityProfile: 'balanced', cooldownMs: 0 },
      mockHaptic,
      mockVib
    );

    const bassAndVocal = {
      sequence: 1,
      timestamp: 0.1,
      sampleRate: 48000,
      channels: 1,
      rms: 0.35,
      peak: 0.5,
      lowEnergy: 0.25,
      midEnergy: 0.20,
      highEnergy: 0.05,
      vocalActivityEstimate: 0.65, // Strong vocal presence
      isTransient: false,
      noiseFloor: 0.02,
      snrDb: 25,
      effectiveSensitivity: 1.0,
    };

    // Hit 1 -> Bass takes slot
    const ev1 = await translator.translate(bassAndVocal);
    assert.strictEqual(ev1.type, 'bass_punch');

    // Hit 2 -> Bass takes slot
    const ev2 = await translator.translate(bassAndVocal);
    assert.strictEqual(ev2.type, 'bass_punch');

    // Hit 3 -> Vocal interleaves into slot instead of being starved
    const ev3 = await translator.translate(bassAndVocal);
    assert.strictEqual(ev3.type, 'vocal_pulse', 'Vocal presence must interleave after consecutive sustained bass hits');
    console.log('  ✓ Vocal presence successfully interleaves during sustained bass passages without permanent starvation');
  }

  // --- Test 13: Immediate Tactile Mute and Cancellation ---
  testCount++;
  console.log(`Test ${testCount}: Immediate Tactile Mute and Cancellation`);
  {
    const mockHaptic = new MockHapticDriver();
    const mockVib = new MockVibrationDriver();

    const translator = new LiveHapticTranslator(
      { enabled: true, intensityProfile: 'strong', cooldownMs: 0 },
      mockHaptic,
      mockVib
    );

    // Call cancelAll
    translator.cancelAll();
    assert.strictEqual(mockVib.cancelled, true, 'cancelAll must invoke vibrationDriver.cancel()');

    // setEnabled(false) must also cancel
    mockVib.cancelled = false;
    translator.setEnabled(false);
    assert.strictEqual(mockVib.cancelled, true, 'Disabling haptics must immediately cancel ongoing vibrations');

    console.log('  ✓ Immediate tactile mute and cancellation successfully halts active hardware vibrations');
  }

  // --- Test 14: Actuator Cooldown Rate Safeguard ---
  testCount++;
  console.log(`Test ${testCount}: Actuator Cooldown Rate Safeguard`);
  {
    const mockHaptic = new MockHapticDriver();
    const mockVib = new MockVibrationDriver();
    const translator = new LiveHapticTranslator(
      { enabled: true, intensityProfile: 'balanced', cooldownMs: 45 },
      mockHaptic,
      mockVib
    );

    const kick = {
      sequence: 4,
      timestamp: 0.4,
      sampleRate: 48000,
      channels: 1,
      rms: 0.5,
      peak: 0.7,
      lowEnergy: 0.4,
      midEnergy: 0.1,
      highEnergy: 0.05,
      vocalActivityEstimate: 0.1,
      isTransient: true,
      noiseFloor: 0.02,
      snrDb: 25,
      effectiveSensitivity: 1.0,
    };

    // First trigger -> should actuate
    const event1 = await translator.translate(kick);
    assert.strictEqual(event1.type, 'bass_punch');
    assert.strictEqual(mockHaptic.calls.length, 1);

    // Immediate second trigger (0ms later) -> must be throttled
    const event2 = await translator.translate(kick);
    assert.strictEqual(event2.type, 'none', 'Immediate second event must be throttled by cooldown');
    assert.strictEqual(mockHaptic.calls.length, 1, 'Driver must not be called when throttled');

    const stats = translator.getStats();
    assert.strictEqual(stats.totalTriggers, 1);
    assert.strictEqual(stats.totalThrottled, 1);
    console.log('  ✓ Rapid consecutive triggers strictly throttled by 45ms cooldown safeguard');
  }

  // --- Test 15: LiveConcertAudioEngine Lifecycle & Orchestration ---
  testCount++;
  console.log(`Test ${testCount}: LiveConcertAudioEngine Lifecycle & Orchestration`);
  {
    const mockHaptic = new MockHapticDriver();
    const mockVib = new MockVibrationDriver();
    const translator = new LiveHapticTranslator(
      { enabled: true, intensityProfile: 'balanced', cooldownMs: 0 },
      mockHaptic,
      mockVib
    );
    const engine = new LiveConcertAudioEngine(undefined, translator);

    const initialState = engine.getState();
    assert.strictEqual(initialState.captureState, 'idle');
    assert.strictEqual(initialState.packetsReceived, 0);

    // Start engine -> requests permission, starts stream, transitions to capturing
    await engine.start();
    assert.strictEqual(engine.getState().captureState, 'capturing');
    assert.strictEqual(engine.getState().permissionStatus, 'granted');

    // Test studio pattern invocation via engine
    const testEv = await engine.testPattern('percussion_snap');
    assert.strictEqual(testEv.type, 'percussion_snap');
    assert.strictEqual(engine.getState().lastHapticEvent.type, 'percussion_snap');

    // Feed a simulated incoming buffer from microphone
    let featureEventReceived = false;
    let hapticEventReceived = false;

    engine.onFeatures(() => { featureEventReceived = true; });
    engine.onHapticEvent(() => { hapticEventReceived = true; });

    const kickBuffer = generatePcmBuffer(sampleRate, 0.1, [[80, 0.9]]);
    engine.handleIncomingBuffer({
      data: kickBuffer,
      sampleRate: 48000,
      channels: 1,
      timestamp: 0.1,
    });

    assert.strictEqual(engine.getState().packetsReceived, 1);
    assert.strictEqual(featureEventReceived, true);

    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(hapticEventReceived, true);

    // Stop engine -> cancels vibrations
    await engine.stop();
    assert.strictEqual(engine.getState().captureState, 'stopped');
    assert.strictEqual(mockVib.cancelled, true, 'Engine stop must cancel any ongoing vibrations');

    console.log('  ✓ LiveConcertAudioEngine starts, translates buffers, tests patterns, and stops cleanly with tactile cancellation');
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${testCount} STAGE B-LIVE.2 CONCERT AUDIO & HAPTIC TESTS PASSED!`);
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUNNER FAILURE:', err);
  process.exit(1);
});
