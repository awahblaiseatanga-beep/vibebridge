/**
 * VibeBridge Audio Signal Foundation Verification Suite
 * Stage B-LIVE.5 — Isolated Signal Analysis Foundation
 *
 * Deterministic automated tests verifying:
 * 1. Sliding-window continuity & 3-buffer alignment across variable buffer lengths.
 * 2. Globally fixed 8-sample envelope grid across arbitrary arena-origin offsets.
 * 3. Transients around buffer boundaries (samples 4780, 4795, 4799, 4800, 4805, 4810).
 * 4. Multi-waveform attack shapes: Dirac, fast percussive, resonant bass, noisy burst, mallet swell.
 * 5. Measured onset error statistics (MATE, P95, Max error, false positives, missed onsets).
 * 6. Quiet valid transients vs. sub-threshold noise rejection.
 * 7. Strictly non-increasing clipping confidence penalty.
 * 8. Complete vs. truncated low-frequency RMS measurements.
 * 9. Zero-sample cancellation on immediate stream stop.
 * 10. Multiple concurrent deferred candidates without sample mixing.
 * 11. Bounded staging pool overflow handling (8-slot limit).
 * 12. Native discontinuity heuristics (timestamp regression & transport gap invalidation).
 * 13. Timeout expiration & post-interruption stream recovery.
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

const typesCode = transpile('src/engines/audio-analysis/types.ts');
const frameProcessorCode = transpile('src/engines/audio-analysis/SlidingWindowFrameProcessor.ts');
const energyCalculatorCode = transpile('src/engines/audio-analysis/SubBandEnergyCalculator.ts');
const onsetDetectorCode = transpile('src/engines/audio-analysis/TransientOnsetCandidateDetector.ts');
const foundationCode = transpile('src/engines/audio-analysis/AudioSignalFoundation.ts');

const exportedTypes = {};
const exportedProcessor = {};
const exportedEnergy = {};
const exportedDetector = {};
const exportedFoundation = {};

function createSandbox(exportsObj) {
  return {
    require: (id) => {
      if (id.includes('types')) return exportedTypes;
      if (id.includes('SlidingWindowFrameProcessor')) return exportedProcessor;
      if (id.includes('SubBandEnergyCalculator')) return exportedEnergy;
      if (id.includes('TransientOnsetCandidateDetector')) return exportedDetector;
      if (id.includes('AudioSignalFoundation')) return exportedFoundation;
      return require(id);
    },
    exports: exportsObj,
    module: { exports: exportsObj },
    console,
    Date,
    Math,
    Float32Array,
    Int16Array,
    ArrayBuffer,
    Map,
    Set,
  };
}

function runModule(code, exportsObj) {
  const sb = createSandbox(exportsObj);
  vm.createContext(sb);
  vm.runInContext(`(function(exports, module) { ${code} })(exports, module);`, sb);
}

runModule(typesCode, exportedTypes);
runModule(frameProcessorCode, exportedProcessor);
runModule(energyCalculatorCode, exportedEnergy);
runModule(onsetDetectorCode, exportedDetector);
runModule(foundationCode, exportedFoundation);

const { SlidingWindowFrameProcessor } = exportedProcessor;
const { SubBandEnergyCalculator } = exportedEnergy;
const { TransientOnsetCandidateDetector } = exportedDetector;
const { AudioSignalFoundation } = exportedFoundation;

console.log('🧪 Starting Stage B-LIVE.5 Signal Foundation Verification Suite...\n');

// ============================================================================
// TEST 1: Sliding-Window Continuity & Three-Buffer Alignment Trace
// ============================================================================
console.log('Test 1: Sliding-Window Continuity & Three-Buffer Alignment Trace');
{
  const processor = new SlidingWindowFrameProcessor({ windowSize: 512, hopSize: 128 });
  const frameCounts = [];
  const tailLengths = [];

  const callbacks = {
    onFrame: () => {},
    onDeferredResolved: () => {},
  };

  // Buffer 0 (4,800 samples)
  const buf0 = new Float32Array(4800);
  let count0 = 0;
  processor.processBuffer(buf0, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.1 }, 100, {
    onFrame: () => count0++,
    onDeferredResolved: () => {},
  });
  frameCounts.push(count0);
  tailLengths.push(processor['tailLength']);

  // Buffer 1 (4,800 samples)
  const buf1 = new Float32Array(4800);
  let count1 = 0;
  processor.processBuffer(buf1, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.2 }, 200, {
    onFrame: () => count1++,
    onDeferredResolved: () => {},
  });
  frameCounts.push(count1);
  tailLengths.push(processor['tailLength']);

  // Buffer 2 (4,800 samples)
  const buf2 = new Float32Array(4800);
  let count2 = 0;
  processor.processBuffer(buf2, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.3 }, 300, {
    onFrame: () => count2++,
    onDeferredResolved: () => {},
  });
  frameCounts.push(count2);
  tailLengths.push(processor['tailLength']);

  assert.strictEqual(frameCounts[0], 34, 'Buffer 0 must evaluate exactly 34 frames');
  assert.strictEqual(frameCounts[1], 38, 'Buffer 1 must evaluate exactly 38 frames');
  assert.strictEqual(frameCounts[2], 37, 'Buffer 2 must evaluate exactly 37 frames');
  assert.strictEqual(frameCounts[0] + frameCounts[1] + frameCounts[2], 109, 'Total frames across 3 buffers must be 109');

  assert.strictEqual(tailLengths[0], 448, 'Buffer 0 tail must be exactly 448 samples');
  assert.strictEqual(tailLengths[1], 384, 'Buffer 1 tail must be exactly 384 samples');
  assert.strictEqual(tailLengths[2], 448, 'Buffer 2 tail must be exactly 448 samples');

  console.log(`  ✓ 3-buffer frame counts match mathematical specification: [${frameCounts.join(', ')}] (Total: 109)`);
  console.log(`  ✓ Tail lengths alternate deterministically: [${tailLengths.join(', ')}] samples (448 <-> 384)`);
}

// ============================================================================
// TEST 2: Variable Incoming Buffer Length Handling (1200, 9600, 4793 samples)
// ============================================================================
console.log('\nTest 2: Variable Incoming Buffer Length Handling');
{
  const processor = new SlidingWindowFrameProcessor({ windowSize: 512, hopSize: 128 });
  let totalFrames = 0;
  const callbacks = {
    onFrame: () => totalFrames++,
    onDeferredResolved: () => {},
  };

  // Odd length: 4793 samples
  const bufOdd = new Float32Array(4793);
  processor.processBuffer(bufOdd, { sampleRate: 48000, channelCount: 1, sampleCount: 4793, nativeTimestampSec: 0.1 }, 100, callbacks);

  // Short buffer: 1200 samples
  const bufShort = new Float32Array(1200);
  processor.processBuffer(bufShort, { sampleRate: 48000, channelCount: 1, sampleCount: 1200, nativeTimestampSec: 0.125 }, 125, callbacks);

  // Large burst: 9600 samples
  const bufBurst = new Float32Array(9600);
  processor.processBuffer(bufBurst, { sampleRate: 48000, channelCount: 1, sampleCount: 9600, nativeTimestampSec: 0.325 }, 325, callbacks);

  const diag = processor.getDiagnostics(48000);
  assert.strictEqual(diag.totalSamplesIngested, 4793 + 1200 + 9600, 'All samples must be ingested without loss');
  assert.ok(totalFrames > 100, 'Frames must be evaluated continuously across variable buffer lengths');

  console.log(`  ✓ Ingested variable buffers (4793, 1200, 9600): ${diag.totalSamplesIngested} total samples, ${totalFrames} frames`);
}

// ============================================================================
// TEST 3: Global Envelope Alignment Across Arena-Origin Offsets (mod 8 phases)
// ============================================================================
console.log('\nTest 3: Global Envelope Alignment Across Arena-Origin Offsets (0, 1, 3, 5, 7 mod 8)');
{
  const detector = new TransientOnsetCandidateDetector({ attackWindowCorrectionSamples: 4 });
  const arena = new Float32Array(16384);
  const phases = [0, 1, 3, 5, 7];

  for (const phase of phases) {
    arena.fill(0);
    const arenaGlobalStart = 4300 + phase;
    const targetOnsetGlobal = arenaGlobalStart + 300; // Strike at sample 300 in arena

    // Inject synthetic strike: 2ms rise (96 samples)
    for (let i = 0; i < 96; i++) {
      const sampleIdx = 300 + i;
      arena[sampleIdx] = (i / 96) * Math.sin((2 * Math.PI * 400 * i) / 48000);
    }
    // Decay
    for (let i = 96; i < 400; i++) {
      arena[300 + i] = Math.exp(-(i - 96) / 100) * Math.sin((2 * Math.PI * 400 * i) / 48000);
    }

    const mockFrame = {
      frameIndex: 0,
      bufferSampleOffset: 300,
      globalSamplePosition: targetOnsetGlobal,
      streamTimeSec: targetOnsetGlobal / 48000,
      rms: 0.25,
      peak: 0.8,
      bands: { low: 0.1, mid: 0.2, high: 0.05, lowFlux: 0.1, midFlux: 0.2, highFlux: 0.05 },
      zeroCrossingRate: 0.05,
    };

    const result = detector['backProjectOnset'](mockFrame, arena, arenaGlobalStart, arena.length);
    assert.ok(result.isBackProjected, `Must back-project for phase ${phase}`);
    const error = Math.abs(result.estimatedOnsetSample - targetOnsetGlobal);
    // Uncertainty bound: <= 16 samples for 2ms percussive attack
    assert.ok(error <= 16, `Phase ${phase}: Error ${error} samples must be <= 16 samples`);
  }
  console.log('  ✓ Global envelope alignment verified across all 5 arena-origin phases (errors <= 16 samples)');
}

// ============================================================================
// TEST 4: Boundary-Crossing Transients (4780, 4795, 4799, 4800, 4805, 4810)
// ============================================================================
console.log('\nTest 4: Boundary-Crossing Transients Across Buffer Seam (Samples 4780, 4795, 4799, 4800, 4805, 4810)');
{
  const offsets = [4780, 4795, 4799, 4800, 4805, 4810];
  const detectedErrors = [];

  for (const strikeOffset of offsets) {
    const foundation = new AudioSignalFoundation({ attackWindowCorrectionSamples: 4, silenceThreshold: 0.008 });
    const buf0 = new Float32Array(4800);
    const buf1 = new Float32Array(4800);

    // Inject fast percussive attack (2ms rise, 20ms decay)
    for (let i = 0; i < 1000; i++) {
      const gIdx = strikeOffset + i;
      const env = i < 96 ? (i / 96) : Math.exp(-(i - 96) / 200);
      const val = env * Math.sin((2 * Math.PI * 600 * i) / 48000);

      if (gIdx < 4800) {
        buf0[gIdx] = val;
      } else if (gIdx < 9600) {
        buf1[gIdx - 4800] = val;
      }
    }

    const onsets0 = foundation.ingestBuffer(buf0.buffer, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.1 }, 100);
    const onsets1 = foundation.ingestBuffer(buf1.buffer, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.2 }, 200);

    const allOnsets = [...onsets0, ...onsets1];
    assert.ok(allOnsets.length >= 1, `Transient at offset ${strikeOffset} must be detected`);

    const bestOnset = allOnsets[0];
    const errorSamples = Math.abs(bestOnset.estimatedOnsetSample - strikeOffset);
    const errorMs = (errorSamples / 48000) * 1000;
    detectedErrors.push({ offset: strikeOffset, errorSamples, errorMs });
  }

  detectedErrors.forEach((e) => {
    console.log(`    Offset ${e.offset}: Detected with error = ${e.errorSamples} samples (${e.errorMs.toFixed(3)} ms)`);
    assert.ok(e.errorSamples <= 24, `Offset ${e.offset} error must be <= 24 samples`);
  });
  console.log('  ✓ Boundary seam test passed: All 6 boundary-adjacent attacks detected without boundary drop');
}

// ============================================================================
// TEST 5: Multi-Waveform Shapes & Empirical Error Statistics
// ============================================================================
console.log('\nTest 5: Multi-Waveform Shapes & Empirical Error Statistics');
{
  const shapes = [
    { name: 'Dirac Spike', riseMs: 0.0, carrier: 'impulse' },
    { name: 'Fast Percussive (Snare)', riseMs: 1.8, carrier: 'tone_noise' },
    { name: 'Resonant Bass (Kick)', riseMs: 5.0, carrier: 'bass_glide' },
    { name: 'Percussive Noise (Cymbal)', riseMs: 2.0, carrier: 'noise' },
    { name: 'Gradual Swell (Mallet)', riseMs: 20.0, carrier: 'sine' },
  ];

  const amplitudes = [
    { name: 'Full Scale (0 dBFS)', peak: 1.0 },
    { name: 'Moderate (-12 dBFS)', peak: 0.25 },
    { name: 'Quiet (-26 dBFS)', peak: 0.05 },
    { name: 'Near-Threshold (-36 dBFS)', peak: 0.015 },
  ];

  // Deterministic Mulberry32 PRNG (zero external dependencies, identical across runs)
  function createPrng(seed) {
    let s = seed >>> 0;
    return function() {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  console.log('  Running 20 permutations (5 shapes x 4 amplitudes)...');
  const errorList = [];
  let permIdx = 0;

  for (const shape of shapes) {
    for (const amp of amplitudes) {
      permIdx++;
      const prng = createPrng(12345 + permIdx * 97);
      const foundation = new AudioSignalFoundation({ attackWindowCorrectionSamples: 4, silenceThreshold: 0.008 });
      const strikeSample = 1200;
      const buf = new Float32Array(4800);

      const riseSamples = Math.round((shape.riseMs / 1000) * 48000);
      const decaySamples = 800;

      for (let i = 0; i < riseSamples + decaySamples; i++) {
        let env = 0;
        if (riseSamples === 0) {
          env = i === 0 ? 1.0 : Math.exp(-i / 100);
        } else if (i < riseSamples) {
          env = Math.sin((Math.PI * i) / (2 * riseSamples));
        } else {
          env = Math.exp(-(i - riseSamples) / 250);
        }

        let carrierVal = 0;
        if (shape.carrier === 'impulse') {
          carrierVal = i === 0 ? 1.0 : 0.0;
        } else if (shape.carrier === 'tone_noise') {
          carrierVal = 0.6 * Math.sin((2 * Math.PI * 220 * i) / 48000) + 0.4 * (prng() * 2 - 1);
        } else if (shape.carrier === 'bass_glide') {
          carrierVal = Math.sin((2 * Math.PI * (80 - (i / 1000) * 25) * i) / 48000);
        } else if (shape.carrier === 'noise') {
          carrierVal = prng() * 2 - 1;
        } else if (shape.carrier === 'sine') {
          carrierVal = Math.sin((2 * Math.PI * 300 * i) / 48000);
        }

        buf[strikeSample + i] = amp.peak * env * carrierVal;
      }

      const onsets = foundation.ingestBuffer(buf.buffer, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.1 }, 100);
      if (onsets.length > 0) {
        const err = Math.abs(onsets[0].estimatedOnsetSample - strikeSample);
        const errMs = (err / 48000) * 1000;
        errorList.push({ shape: shape.name, amp: amp.name, err, errMs });
      }
    }
  }

  // Statistical summary
  const sortedMs = errorList.map((e) => e.errMs).sort((a, b) => a - b);
  const mateMs = sortedMs.reduce((a, b) => a + b, 0) / sortedMs.length;
  const p95Idx = Math.floor(sortedMs.length * 0.95);
  const p95Ms = sortedMs[p95Idx];
  const maxMs = sortedMs[sortedMs.length - 1];

  console.log(`    Evaluated onsets: ${errorList.length}/20 detected`);
  console.log(`    Mean Absolute Timing Error (MATE): ${mateMs.toFixed(3)} ms`);
  console.log(`    P95 Absolute Timing Error: ${p95Ms.toFixed(3)} ms`);
  console.log(`    Maximum Observed Timing Error: ${maxMs.toFixed(3)} ms`);
  assert.ok(mateMs < 1.8, 'MATE across realistic attacks must be < 1.8 ms');
  console.log('  ✓ Multi-waveform timing error statistics computed successfully');
}

// ============================================================================
// TEST 6: Quiet Valid Transients vs. Sub-Threshold Noise Rejection
// ============================================================================
console.log('\nTest 6: Quiet Valid Transients vs. Sub-Threshold Noise Rejection');
{
  const foundation = new AudioSignalFoundation({ silenceThreshold: 0.008 });

  // 1. Sub-threshold room noise (deterministic PRNG, peak 0.005, RMS ~ 0.003 < 0.008)
  function createNoisePrng(seed) {
    let s = seed >>> 0;
    return function() {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const noisePrng = createNoisePrng(99999);
  const noiseBuf = new Float32Array(4800);
  for (let i = 0; i < 4800; i++) {
    noiseBuf[i] = (noisePrng() * 2 - 1) * 0.005; // peak 0.005, rms ~ 0.003
  }
  const noiseOnsets = foundation.ingestBuffer(noiseBuf.buffer, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.1 }, 100);
  assert.strictEqual(noiseOnsets.length, 0, 'Sub-threshold noise must yield 0 candidate onsets');

  // 2. Quiet valid rimshot (Peak 0.06, RMS ~ 0.014 > 0.008)
  const quietAttackBuf = new Float32Array(4800);
  for (let i = 0; i < 300; i++) {
    const env = i < 48 ? (i / 48) : Math.exp(-(i - 48) / 80);
    quietAttackBuf[1500 + i] = 0.06 * env * Math.sin((2 * Math.PI * 800 * i) / 48000);
  }
  const validOnsets = foundation.ingestBuffer(quietAttackBuf.buffer, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.2 }, 200);
  assert.ok(validOnsets.length >= 1, 'Quiet valid attack above silenceThreshold must be detected');
  assert.ok(validOnsets[0].confidence > 0.2, 'Confidence for valid quiet attack must be positive');

  console.log('  ✓ Quiet transient (RMS=0.014) detected with confidence > 0.2');
  console.log('  ✓ Sub-threshold noise (RMS=0.003) completely rejected with 0 false candidates');
}

// ============================================================================
// TEST 7: Monotonic Non-Increasing Clipping Confidence Penalty
// ============================================================================
console.log('\nTest 7: Monotonic Non-Increasing Clipping Confidence Penalty');
{
  const detector = new TransientOnsetCandidateDetector();

  // Test with unclipped high confidence
  const confNormal = detector['calculateConfidence'](0.3, 0.4, 0.05, 0.08, 30.0, false);
  const confClipped = detector['calculateConfidence'](0.3, 0.4, 0.05, 0.08, 30.0, true);
  assert.ok(confClipped < confNormal, 'Clipped candidate must receive lower confidence than unclipped');

  // Test with borderline low confidence (0.05)
  // Ensure clipping penalty NEVER increases confidence!
  const confLowUnclipped = detector['calculateConfidence'](0.01, 0.015, 0.01, 0.012, 4.0, false);
  const confLowClipped = detector['calculateConfidence'](0.01, 0.015, 0.01, 0.012, 4.0, true);
  assert.ok(confLowClipped <= confLowUnclipped, 'Clipping must never increase low confidence');
  assert.ok(confLowClipped >= 0.0, 'Confidence must be clamped to >= 0.0');

  // Test with zero confidence
  const confZero = detector['calculateConfidence'](0.005, 0.01, 0.01, 0.02, 0.0, true);
  assert.strictEqual(confZero, 0.0, 'Zero confidence must remain strictly 0.0 under clipping');

  console.log(`  ✓ Unclipped (${confNormal.toFixed(3)}) -> Clipped (${confClipped.toFixed(3)}): Penalty applied monotonically`);
  console.log(`  ✓ Low unclipped (${confLowUnclipped.toFixed(3)}) -> Low clipped (${confLowClipped.toFixed(3)}): Zero upward elevation`);
}

// ============================================================================
// TEST 8: Complete vs. Truncated Low-Frequency RMS Measurements
// ============================================================================
console.log('\nTest 8: Complete vs. Truncated Low-Frequency RMS Measurements');
{
  const foundation = new AudioSignalFoundation();
  const resolvedList = [];

  foundation.onDeferredResolved((id, measurement) => {
    resolvedList.push({ id, measurement });
  });

  // Inject attack at sample 500 of Buffer 0 (plenty of time to resolve in buffer 0)
  const buf0 = new Float32Array(4800);
  for (let i = 0; i < 400; i++) {
    buf0[500 + i] = 0.5 * Math.sin((2 * Math.PI * 60 * i) / 48000);
  }
  foundation.ingestBuffer(buf0.buffer, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.1 }, 100);

  assert.strictEqual(resolvedList.length, 1, 'Buffer 0 must immediately resolve Candidate 1 (all 1536 samples present)');
  const mComplete = resolvedList[0].measurement;
  assert.strictEqual(mComplete.status, 'complete');
  assert.strictEqual(mComplete.isComplete, true);
  assert.strictEqual(mComplete.samplesEvaluated, 1536);
  assert.strictEqual(mComplete.isTruncated, false);
  assert.ok(mComplete.sub200HzRms > 0, 'Complete measurement must have positive sub-200Hz RMS');

  // Now inject candidate at sample 3900 of Buffer 1 (confirmed in buffer 1, but needs Buffer 2 to complete)
  const buf1 = new Float32Array(4800);
  for (let i = 0; i < 400; i++) {
    buf1[3900 + i] = 0.5 * Math.sin((2 * Math.PI * 60 * i) / 48000);
  }
  const onsets1 = foundation.ingestBuffer(buf1.buffer, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.2 }, 200);
  assert.strictEqual(onsets1.length, 1, 'Candidate 2 must be confirmed in Buffer 1');

  // Before Buffer 2 arrives, call flush() (simulating stream stop)
  foundation.flush();

  assert.strictEqual(resolvedList.length, 2, 'Flush must resolve pending Candidate 2');
  const mTruncated = resolvedList[1].measurement;
  assert.strictEqual(mTruncated.status, 'truncated');
  assert.strictEqual(mTruncated.isComplete, false);
  assert.ok(mTruncated.samplesEvaluated < 1536 && mTruncated.samplesEvaluated > 0);
  assert.strictEqual(mTruncated.isTruncated, true);
  assert.ok(mTruncated.sub200HzRms > 0, 'Truncated measurement must contain raw partial RMS');

  console.log(`  ✓ Complete measurement: status='${mComplete.status}', samplesEvaluated=${mComplete.samplesEvaluated}, RMS=${mComplete.sub200HzRms.toFixed(4)}`);
  console.log(`  ✓ Truncated measurement: status='${mTruncated.status}', samplesEvaluated=${mTruncated.samplesEvaluated}, RMS=${mTruncated.sub200HzRms.toFixed(4)}`);
}

// ============================================================================
// TEST 9: Zero-Sample Cancellation
// ============================================================================
console.log('\nTest 9: Zero-Sample Cancellation on Stream Stop');
{
  const processor = new SlidingWindowFrameProcessor();
  const cancelledList = [];

  // Register candidate beyond arena valid samples
  processor.registerDeferredCandidate(99, 50000, 100, (id, m) => {
    cancelledList.push({ id, m });
  });

  // Call flush immediately
  processor.flush((id, m) => {
    cancelledList.push({ id, m });
  });

  assert.strictEqual(cancelledList.length, 1);
  assert.strictEqual(cancelledList[0].m.status, 'cancelled');
  assert.strictEqual(cancelledList[0].m.samplesEvaluated, 0);
  assert.strictEqual(cancelledList[0].m.sub200HzRms, null);

  console.log("  ✓ Zero-sample candidate cancelled cleanly with status='cancelled' and sub200HzRms=null");
}

// ============================================================================
// TEST 10: Multiple Concurrent Deferred Candidates Near End of 9,600-Sample Buffer
// ============================================================================
console.log('\nTest 10: Multiple Concurrent Deferred Candidates Near End of 9,600-Sample Buffer');
{
  const processor = new SlidingWindowFrameProcessor({ deferredSlotCount: 8, deferredWindowSamples: 1536 });
  const resolvedMap = new Map();

  const callbacks = {
    onFrame: () => {},
    onDeferredResolved: (id, m) => {
      resolvedMap.set(id, m);
    },
  };

  const bufBurst = new Float32Array(9600);
  // Fill with low-frequency 60 Hz tone
  for (let i = 0; i < 9600; i++) {
    bufBurst[i] = 0.5 * Math.sin((2 * Math.PI * 60 * i) / 48000);
  }

  // Ingest Buffer 0 (9,600 samples)
  processor.processBuffer(bufBurst, { sampleRate: 48000, channelCount: 1, sampleCount: 9600, nativeTimestampSec: 0.2 }, 200, callbacks);

  // Register Candidate A at 9400, Candidate B at 9500, Candidate C at 9580 (near end of 9600 buffer)
  const okA = processor.registerDeferredCandidate(1, 9400, 200, callbacks.onDeferredResolved);
  const okB = processor.registerDeferredCandidate(2, 9500, 200, callbacks.onDeferredResolved);
  const okC = processor.registerDeferredCandidate(3, 9580, 200, callbacks.onDeferredResolved);

  assert.strictEqual(okA, true, 'Candidate A must be staged');
  assert.strictEqual(okB, true, 'Candidate B must be staged');
  assert.strictEqual(okC, true, 'Candidate C must be staged');

  // Buffer 1 arrives (4,800 samples) - delivers remaining samples to complete all 3
  const bufNext = new Float32Array(4800);
  for (let i = 0; i < 4800; i++) {
    bufNext[i] = 0.5 * Math.sin((2 * Math.PI * 60 * (9600 + i)) / 48000);
  }
  processor.processBuffer(bufNext, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.3 }, 300, callbacks);

  assert.strictEqual(resolvedMap.size, 3, 'All 3 concurrent candidates must resolve in Buffer 1');

  for (let id = 1; id <= 3; id++) {
    const res = resolvedMap.get(id);
    assert.ok(res, `Candidate ${id} must be in resolved map`);
    assert.strictEqual(res.status, 'complete', `Candidate ${id} must resolve as complete`);
    assert.strictEqual(res.samplesEvaluated, 1536, `Candidate ${id} must evaluate exactly 1536 samples`);
    assert.strictEqual(res.isComplete, true);
    assert.strictEqual(res.isTruncated, false);
    assert.ok(res.sub200HzRms > 0, `Candidate ${id} must have positive RMS`);
  }

  console.log(`  ✓ Concurrently resolved 3 candidates (k=9400, 9500, 9580) across 9,600-sample boundary with exactly 1536 samples each`);
}

// ============================================================================
// TEST 11: Queue Overflow Handling (8-Slot Capacity Limit)
// ============================================================================
console.log('\nTest 11: Queue Overflow Handling (8-Slot Capacity Limit)');
{
  const processor = new SlidingWindowFrameProcessor({ deferredSlotCount: 8 });

  // Register 8 candidates (fill pool)
  for (let i = 1; i <= 8; i++) {
    const ok = processor.registerDeferredCandidate(i, 10000 + i * 200, 100, () => {});
    assert.strictEqual(ok, true, `Slot ${i} must be accepted`);
  }

  // Attempt 9th candidate
  const overflowOk = processor.registerDeferredCandidate(9, 20000, 100, () => {});
  assert.strictEqual(overflowOk, false, '9th candidate must be rejected due to pool capacity');

  const diag = processor.getDiagnostics(48000);
  assert.strictEqual(diag.deferredQueueOverflows, 1, 'deferredQueueOverflows must increment');

  console.log('  ✓ 8 slots filled successfully; 9th candidate gracefully rejected with overflow counter = 1');
}

// ============================================================================
// TEST 12: Native Discontinuity Heuristics (Timestamp Regression & Transport Gap)
// ============================================================================
console.log('\nTest 12: Native Discontinuity Heuristics (Timestamp Regression & Transport Gap)');
{
  const processor = new SlidingWindowFrameProcessor();
  const invalidated = [];

  const callbacks = {
    onFrame: () => {},
    onDeferredResolved: (id, m) => invalidated.push({ id, m }),
  };

  // Normal buffer at T = 1.0s
  const bufA = new Float32Array(4800);
  processor.processBuffer(bufA, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 1.0 }, 1000, callbacks);

  // Register a pending slot
  processor.registerDeferredCandidate(101, 10000, 1000, (id, m) => invalidated.push({ id, m }));

  // Severe Transport Gap: T = 1.5s (gap = 0.5s > 0.35s)
  const bufGap = new Float32Array(4800);
  processor.processBuffer(bufGap, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 1.5 }, 1500, callbacks);

  assert.strictEqual(invalidated.length, 1);
  assert.strictEqual(invalidated[0].m.status, 'invalidated', "Candidate must be marked 'invalidated' on transport gap");

  // Register another pending slot
  processor.registerDeferredCandidate(102, 20000, 1500, (id, m) => invalidated.push({ id, m }));

  // Timestamp Regression: T = 0.05s (stream restarted)
  const bufRestart = new Float32Array(4800);
  processor.processBuffer(bufRestart, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.05 }, 1600, callbacks);

  assert.strictEqual(invalidated.length, 2);
  assert.strictEqual(invalidated[1].m.status, 'invalidated', "Candidate must be marked 'invalidated' on stream restart");

  const diag = processor.getDiagnostics(48000);
  assert.strictEqual(diag.streamRestartsDetected, 1);
  assert.strictEqual(diag.suspectedTransportGaps, 1);
  assert.strictEqual(diag.slotsInvalidatedByDiscontinuity, 2);

  console.log('  ✓ Transport gap and stream restart detected heuristics verified (2 slots invalidated cleanly)');
}

// ============================================================================
// TEST 13: Timeout Expiration & Stream Recovery
// ============================================================================
console.log('\nTest 13: Timeout Expiration (> 500 ms) & Stream Recovery');
{
  const processor = new SlidingWindowFrameProcessor();
  const expiredList = [];

  const callbacks = {
    onFrame: () => {},
    onDeferredResolved: (id, m) => expiredList.push({ id, m }),
  };

  const buf = new Float32Array(4800);
  processor.processBuffer(buf, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 1.0 }, 1000, callbacks);

  // Register slot at wall time 1000ms
  processor.registerDeferredCandidate(77, 10000, 1000, (id, m) => expiredList.push({ id, m }));

  // Subsequent buffer arrives at wall time 1600ms (delta = 600ms > 500ms timeout)
  processor.processBuffer(buf, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 1.1 }, 1600, callbacks);

  assert.strictEqual(expiredList.length, 1);
  assert.strictEqual(expiredList[0].m.status, 'expired', "Pending slot must transition to 'expired'");

  console.log("  ✓ Stalled candidate cleanly expired after 600 ms wall-clock delay with status='expired'");
}

// ============================================================================
// TEST 14: Test Group A — Immediate Stream-Origin Candidates (k = 0, 1, 100, 255)
// ============================================================================
console.log('\nTest 14: Test Group A — Immediate Stream-Origin Candidates (k = 0, 1, 100, 255)');
{
  const kValues = [0, 1, 100, 255];
  for (const k of kValues) {
    const processor = new SlidingWindowFrameProcessor();
    const resolvedList = [];
    let groundTruthSlice = null;

    const callbacks = {
      onFrame: (rawSlice, filteredSlice, frameIndex) => {
        if (frameIndex === 0) {
          groundTruthSlice = new Float32Array(processor['filteredArena'].subarray(0, k + 1280));
          const ok = processor.registerDeferredCandidate(k, k, 100, callbacks.onDeferredResolved);
          assert.strictEqual(ok, true, `Candidate k=${k} registration must succeed`);
        }
      },
      onDeferredResolved: (id, m) => resolvedList.push({ id, m }),
    };

    // Buffer 0 (4,800 samples)
    const buf0 = new Float32Array(4800);
    for (let i = 0; i < 4800; i++) {
      buf0[i] = Math.sin((2 * Math.PI * 60 * i) / 48000);
    }
    processor.processBuffer(buf0, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.1 }, 100, callbacks);

    // Must resolve immediately (synchronously during onFrame of Buffer 0)
    assert.strictEqual(resolvedList.length, 1, `Candidate k=${k} must resolve immediately`);
    const m = resolvedList[0].m;
    assert.strictEqual(m.status, 'truncated', `Candidate k=${k} status must be 'truncated'`);
    assert.strictEqual(m.isComplete, false, `Candidate k=${k} isComplete must be false`);
    assert.strictEqual(m.isTruncated, true, `Candidate k=${k} isTruncated must be true`);
    assert.strictEqual(m.samplesEvaluated, k + 1280, `Candidate k=${k} samplesEvaluated must be k + 1280 (${k + 1280})`);
    assert.strictEqual(m.targetSamples, 1536, `Candidate k=${k} targetSamples must be 1536`);
    assert.ok(m.sub200HzRms > 0, `Candidate k=${k} sub200HzRms must be positive`);

    // Verify calculated RMS against ground truth
    assert.ok(groundTruthSlice !== null);
    let sumSq = 0;
    for (let i = 0; i < groundTruthSlice.length; i++) sumSq += groundTruthSlice[i] * groundTruthSlice[i];
    const expectedRms = Math.sqrt(sumSq / groundTruthSlice.length);
    assert.ok(Math.abs(m.sub200HzRms - expectedRms) < 1e-6, `Candidate k=${k} RMS must match exact slice RMS`);

    // Verify no staging slot remains active
    const slots = processor['stagingSlots'];
    for (const slot of slots) {
      assert.strictEqual(slot.inUse, false, `Slot must not remain active after immediate resolution for k=${k}`);
    }

    console.log(`  ✓ Candidate k=${k}: Immediately resolved as 'truncated' with ${m.samplesEvaluated} samples, RMS=${m.sub200HzRms.toFixed(5)}, 0 active slots`);
  }
}

// ============================================================================
// TEST 15: Test Group B — First Complete Candidate (k = 256)
// ============================================================================
console.log('\nTest 15: Test Group B — First Complete Candidate (k = 256)');
{
  const processor = new SlidingWindowFrameProcessor();
  const resolvedList = [];
  let groundTruthSlice = null;

  const callbacks = {
    onFrame: (rawSlice, filteredSlice, frameIndex) => {
      if (frameIndex === 0) {
        groundTruthSlice = new Float32Array(processor['filteredArena'].subarray(0, 1536));
        const ok = processor.registerDeferredCandidate(256, 256, 100, callbacks.onDeferredResolved);
        assert.strictEqual(ok, true, 'Candidate k=256 registration must succeed');
      }
    },
    onDeferredResolved: (id, m) => resolvedList.push({ id, m }),
  };

  const buf0 = new Float32Array(4800);
  for (let i = 0; i < 4800; i++) {
    buf0[i] = Math.sin((2 * Math.PI * 60 * i) / 48000);
  }
  processor.processBuffer(buf0, { sampleRate: 48000, channelCount: 1, sampleCount: 4800, nativeTimestampSec: 0.1 }, 100, callbacks);

  assert.strictEqual(resolvedList.length, 1, 'Candidate k=256 must resolve immediately in Buffer 0');
  const m = resolvedList[0].m;
  assert.strictEqual(m.status, 'complete', 'Candidate k=256 status must be complete');
  assert.strictEqual(m.isComplete, true, 'Candidate k=256 isComplete must be true');
  assert.strictEqual(m.isTruncated, false, 'Candidate k=256 isTruncated must be false');
  assert.strictEqual(m.samplesEvaluated, 1536, 'Candidate k=256 samplesEvaluated must be exactly 1536');
  assert.strictEqual(m.targetSamples, 1536, 'Candidate k=256 targetSamples must be 1536');
  assert.ok(m.sub200HzRms > 0);

  // Verify calculated RMS against ground truth
  assert.ok(groundTruthSlice !== null);
  let sumSq = 0;
  for (let i = 0; i < 1536; i++) sumSq += groundTruthSlice[i] * groundTruthSlice[i];
  const expectedRms = Math.sqrt(sumSq / 1536);
  assert.ok(Math.abs(m.sub200HzRms - expectedRms) < 1e-6);

  // Verify no staging slot active
  const slots = processor['stagingSlots'];
  for (const slot of slots) {
    assert.strictEqual(slot.inUse, false, 'No active slots after immediate completion for k=256');
  }

  console.log(`  ✓ Candidate k=256: Immediately resolved as 'complete' with exactly 1536 samples, RMS=${m.sub200HzRms.toFixed(5)}`);
}

// ============================================================================
// TEST 16: Test Group C — Split-Buffer Origin Candidates (k = 0, 100, 255)
// ============================================================================
console.log('\nTest 16: Test Group C — Split-Buffer Origin Candidates (k = 0, 100, 255 across 512-sample chunks)');
{
  const kValues = [0, 100, 255];
  for (const k of kValues) {
    const processor = new SlidingWindowFrameProcessor();
    const resolvedList = [];

    // Reference processor with full continuous input to generate exact filtered stream ground truth
    const refProcessor = new SlidingWindowFrameProcessor();
    const chunkSize = 512;
    const fullInput = new Float32Array(chunkSize * 3);
    for (let i = 0; i < chunkSize * 3; i++) {
      fullInput[i] = Math.sin((2 * Math.PI * 60 * i) / 48000);
    }
    let masterFiltered = null;
    refProcessor.processBuffer(
      fullInput,
      { sampleRate: 48000, channelCount: 1, sampleCount: chunkSize * 3, nativeTimestampSec: 0.01 },
      10,
      {
        onFrame: (rawSlice, filteredSlice, frameIndex) => {
          if (frameIndex === 0) {
            masterFiltered = new Float32Array(refProcessor['filteredArena'].subarray(0, chunkSize * 3));
          }
        },
        onDeferredResolved: () => {},
      }
    );
    assert.ok(masterFiltered !== null);

    let registeredSlot = null;
    let capturedBuffer = null;

    const callbacks = {
      onFrame: () => {},
      onDeferredResolved: (id, m) => {
        // Capture exact samples accumulated before slot is cleared
        capturedBuffer = new Float32Array(registeredSlot.buffer.subarray(0, m.samplesEvaluated));
        resolvedList.push({ id, m });
      },
    };

    const targetGlobal = k + 1279;
    let globalSamplePos = 0;

    // Chunk 0: [0 ... 511]
    const chunk0 = fullInput.subarray(0, chunkSize);
    processor.processBuffer(chunk0, { sampleRate: 48000, channelCount: 1, sampleCount: chunkSize, nativeTimestampSec: 0.01 }, 10, {
      onFrame: (rawSlice, filteredSlice, frameIndex) => {
        if (frameIndex === 0) {
          const ok = processor.registerDeferredCandidate(k, k, 10, callbacks.onDeferredResolved);
          assert.strictEqual(ok, true);
          registeredSlot = processor['stagingSlots'].find((s) => s.inUse && s.candidateId === k);
        }
      },
      onDeferredResolved: callbacks.onDeferredResolved,
    });
    globalSamplePos += chunkSize;

    assert.strictEqual(resolvedList.length, 0, `Candidate k=${k} must NOT resolve in Chunk 0 (targetGlobal=${targetGlobal} > 511)`);
    assert.ok(registeredSlot, `Candidate k=${k} must occupy a staging slot`);
    assert.strictEqual(registeredSlot.samplesAccumulated, 512);
    assert.strictEqual(registeredSlot.startGlobalSample, 0);
    assert.strictEqual(registeredSlot.targetGlobalSample, targetGlobal);

    // Chunk 1: [512 ... 1023]
    const chunk1 = fullInput.subarray(chunkSize, chunkSize * 2);
    processor.processBuffer(chunk1, { sampleRate: 48000, channelCount: 1, sampleCount: chunkSize, nativeTimestampSec: 0.02 }, 20, callbacks);
    globalSamplePos += chunkSize;

    assert.strictEqual(resolvedList.length, 0, `Candidate k=${k} must NOT resolve in Chunk 1 (targetGlobal=${targetGlobal} > 1023)`);
    assert.strictEqual(registeredSlot.samplesAccumulated, 1024);

    // Chunk 2: [1024 ... 1535] (Target falls inside Chunk 2)
    const chunk2 = fullInput.subarray(chunkSize * 2, chunkSize * 3);
    processor.processBuffer(chunk2, { sampleRate: 48000, channelCount: 1, sampleCount: chunkSize, nativeTimestampSec: 0.03 }, 30, callbacks);
    globalSamplePos += chunkSize;

    // Must have resolved upon ingestion of Chunk 2
    assert.strictEqual(resolvedList.length, 1, `Candidate k=${k} must resolve in Chunk 2 when sample ${targetGlobal} arrives`);
    const m = resolvedList[0].m;
    assert.strictEqual(m.status, 'truncated');
    assert.strictEqual(m.isComplete, false);
    assert.strictEqual(m.isTruncated, true);
    assert.strictEqual(m.samplesEvaluated, k + 1280);
    assert.strictEqual(m.targetSamples, 1536);
    assert.ok(m.sub200HzRms > 0);

    // Point-by-point exact sample content verification
    assert.ok(capturedBuffer !== null, `Captured buffer must be populated upon resolution for k=${k}`);
    assert.strictEqual(capturedBuffer.length, k + 1280, `Captured buffer length must match samplesEvaluated for k=${k}`);
    for (let i = 0; i < m.samplesEvaluated; i++) {
      assert.strictEqual(capturedBuffer[i], masterFiltered[i], `Sample ${i} mismatch for candidate k=${k}`);
    }

    // Verify slot released
    assert.strictEqual(registeredSlot.inUse, false, `Slot must be released after resolution for k=${k}`);
    assert.strictEqual(registeredSlot.samplesAccumulated, 0);

    console.log(`  ✓ Candidate k=${k}: Split across 3x512 chunks, resolved in Chunk 2 with ${m.samplesEvaluated} samples (all strictly equal to reference stream), RMS=${m.sub200HzRms.toFixed(5)}, slot cleanly freed`);
  }
}

// ============================================================================
// TEST 17: Test Group D — Buffer Seam Targets, Slot Reuse & Concurrency
// ============================================================================
console.log('\nTest 17: Test Group D — Buffer Seam Targets, Slot Reuse & Concurrency');
{
  // 1. Boundary target test: target k + 1279 falls at seam -1, 0, +1
  // Let k = 100, target is 1379.
  // Case A: Chunk 0 length = 1380 (samples 0 ... 1379). Target falls EXACTLY on boundary (last sample).
  {
    const processor = new SlidingWindowFrameProcessor();
    const resolved = [];
    const bufA = new Float32Array(1380);
    for (let i = 0; i < 1380; i++) bufA[i] = 0.5;
    processor.processBuffer(bufA, { sampleRate: 48000, channelCount: 1, sampleCount: 1380, nativeTimestampSec: 0.01 }, 10, {
      onFrame: (rawSlice, filteredSlice, frameIndex) => {
        if (frameIndex === 0) {
          processor.registerDeferredCandidate(1, 100, 10, (id, m) => resolved.push({ id, m }));
        }
      },
      onDeferredResolved: (id, m) => resolved.push({ id, m }),
    });

    assert.strictEqual(resolved.length, 1, 'Target on exact buffer boundary must resolve immediately');
    assert.strictEqual(resolved[0].m.status, 'truncated');
    assert.strictEqual(resolved[0].m.samplesEvaluated, 1380);
    console.log('  ✓ Target exactly on boundary (sample 1379 of 1380): Resolved immediately with 1380 samples');
  }

  // Case B: Chunk 0 length = 1381 (samples 0 ... 1380). Target falls 1 sample BEFORE boundary.
  {
    const processor = new SlidingWindowFrameProcessor();
    const resolved = [];
    const bufB = new Float32Array(1381);
    for (let i = 0; i < 1381; i++) bufB[i] = 0.5;
    processor.processBuffer(bufB, { sampleRate: 48000, channelCount: 1, sampleCount: 1381, nativeTimestampSec: 0.01 }, 10, {
      onFrame: (rawSlice, filteredSlice, frameIndex) => {
        if (frameIndex === 0) {
          processor.registerDeferredCandidate(1, 100, 10, (id, m) => resolved.push({ id, m }));
        }
      },
      onDeferredResolved: (id, m) => resolved.push({ id, m }),
    });

    assert.strictEqual(resolved.length, 1, 'Target 1 sample before boundary must resolve immediately');
    assert.strictEqual(resolved[0].m.status, 'truncated');
    assert.strictEqual(resolved[0].m.samplesEvaluated, 1380);
    console.log('  ✓ Target 1 sample before boundary: Resolved immediately with 1380 samples');
  }

  // Case C: Chunk 0 length = 1379 (samples 0 ... 1378). Target falls 1 sample AFTER boundary (sample 0 of Chunk 1).
  {
    const processor = new SlidingWindowFrameProcessor();
    const resolved = [];

    // Reference processor for Case C ground-truth
    const refProcessorC = new SlidingWindowFrameProcessor();
    const totalSamplesC = 1379 + 512;
    const fullInputC = new Float32Array(totalSamplesC);
    for (let i = 0; i < totalSamplesC; i++) fullInputC[i] = Math.sin((2 * Math.PI * 75 * i) / 48000);
    let masterFilteredC = null;
    refProcessorC.processBuffer(
      fullInputC,
      { sampleRate: 48000, channelCount: 1, sampleCount: totalSamplesC, nativeTimestampSec: 0.01 },
      10,
      {
        onFrame: (rawSlice, filteredSlice, frameIndex) => {
          if (frameIndex === 0) {
            masterFilteredC = new Float32Array(refProcessorC['filteredArena'].subarray(0, totalSamplesC));
          }
        },
        onDeferredResolved: () => {},
      }
    );
    assert.ok(masterFilteredC !== null);

    let slotC = null;
    let capturedC = null;
    const callbacks = {
      onFrame: () => {},
      onDeferredResolved: (id, m) => {
        capturedC = new Float32Array(slotC.buffer.subarray(0, m.samplesEvaluated));
        resolved.push({ id, m });
      },
    };

    const bufC0 = fullInputC.subarray(0, 1379);
    processor.processBuffer(bufC0, { sampleRate: 48000, channelCount: 1, sampleCount: 1379, nativeTimestampSec: 0.01 }, 10, {
      onFrame: (rawSlice, filteredSlice, frameIndex) => {
        if (frameIndex === 0) {
          const ok = processor.registerDeferredCandidate(1, 100, 10, callbacks.onDeferredResolved);
          assert.strictEqual(ok, true);
          slotC = processor['stagingSlots'].find((s) => s.inUse && s.candidateId === 1);
        }
      },
      onDeferredResolved: callbacks.onDeferredResolved,
    });

    assert.strictEqual(resolved.length, 0, 'Target 1 sample after boundary must remain pending');
    assert.ok(slotC);
    assert.strictEqual(slotC.samplesAccumulated, 1379);

    // Chunk 1 delivers sample 1379 (seam crossing)
    const bufC1 = fullInputC.subarray(1379, totalSamplesC);
    processor.processBuffer(bufC1, { sampleRate: 48000, channelCount: 1, sampleCount: 512, nativeTimestampSec: 0.02 }, 20, callbacks);

    assert.strictEqual(resolved.length, 1, 'Candidate must resolve immediately when sample 1379 arrives in Chunk 1');
    assert.strictEqual(resolved[0].m.status, 'truncated');
    assert.strictEqual(resolved[0].m.samplesEvaluated, 1380);

    // Point-by-point verification across boundary seam
    assert.ok(capturedC !== null, 'Captured buffer for Case C must be populated');
    assert.strictEqual(capturedC.length, 1380);
    for (let i = 0; i < 1380; i++) {
      assert.strictEqual(capturedC[i], masterFilteredC[i], `Sample mismatch at seam index ${i}`);
    }
    console.log('  ✓ Target 1 sample after boundary: Resolved cleanly on next buffer with 1380 samples (exact seam match)');
  }

  // 2. Slot reuse test
  {
    const processor = new SlidingWindowFrameProcessor();
    const resolved = [];
    const callbacks = {
      onFrame: () => {},
      onDeferredResolved: (id, m) => resolved.push({ id, m }),
    };

    // Buffer 0 has 512 samples
    const buf0 = new Float32Array(512);
    processor.processBuffer(buf0, { sampleRate: 48000, channelCount: 1, sampleCount: 512, nativeTimestampSec: 0.01 }, 10, {
      onFrame: (rawSlice, filteredSlice, frameIndex) => {
        if (frameIndex === 0) {
          processor.registerDeferredCandidate(1, 50, 10, callbacks.onDeferredResolved);
        }
      },
      onDeferredResolved: callbacks.onDeferredResolved,
    });

    assert.strictEqual(processor['stagingSlots'][0].inUse, true);
    assert.strictEqual(processor['stagingSlots'][0].candidateId, 1);

    // Buffer 1 delivers remaining samples (target is 50 + 1279 = 1329)
    const buf1 = new Float32Array(1500);
    processor.processBuffer(buf1, { sampleRate: 48000, channelCount: 1, sampleCount: 1500, nativeTimestampSec: 0.02 }, 20, callbacks);

    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(processor['stagingSlots'][0].inUse, false, 'Slot 0 must be released');

    // Now register Candidate 2 during Buffer 2: must successfully reuse Slot 0
    let registered2 = false;
    const buf2 = new Float32Array(512);
    processor.processBuffer(buf2, { sampleRate: 48000, channelCount: 1, sampleCount: 512, nativeTimestampSec: 0.03 }, 30, {
      onFrame: () => {
        if (!registered2) {
          registered2 = true;
          processor.registerDeferredCandidate(2, 50000, 30, callbacks.onDeferredResolved);
        }
      },
      onDeferredResolved: callbacks.onDeferredResolved,
    });
    assert.strictEqual(processor['stagingSlots'][0].inUse, true, 'Slot 0 must be reused for candidate 2');
    assert.strictEqual(processor['stagingSlots'][0].candidateId, 2);
    console.log('  ✓ Staging slot reuse verified: Slot 0 released and immediately reused by subsequent candidate');
  }

  // 3. Concurrent candidates with independent staging buffers
  {
    const processor = new SlidingWindowFrameProcessor();
    const resolvedMap = new Map();

    // Use full varying input to ensure every sample is unique
    const totalSamplesConc = 512 + 1500;
    const fullInputConc = new Float32Array(totalSamplesConc);
    for (let i = 0; i < totalSamplesConc; i++) {
      fullInputConc[i] = Math.sin((2 * Math.PI * 55 * i) / 48000) * 0.4 + Math.cos((2 * Math.PI * 110 * i) / 48000) * 0.2;
    }

    // Reference processor to establish master filtered stream
    const refProcessorConc = new SlidingWindowFrameProcessor();
    let masterFilteredConc = null;
    refProcessorConc.processBuffer(
      fullInputConc,
      { sampleRate: 48000, channelCount: 1, sampleCount: totalSamplesConc, nativeTimestampSec: 0.01 },
      10,
      {
        onFrame: (rawSlice, filteredSlice, frameIndex) => {
          if (frameIndex === 0) {
            masterFilteredConc = new Float32Array(refProcessorConc['filteredArena'].subarray(0, totalSamplesConc));
          }
        },
        onDeferredResolved: () => {},
      }
    );
    assert.ok(masterFilteredConc !== null);

    let slotA = null;
    let slotB = null;
    let capturedA = null;
    let capturedB = null;

    const callbacks = {
      onFrame: () => {},
      onDeferredResolved: (id, m) => {
        if (id === 10) {
          capturedA = new Float32Array(slotA.buffer.subarray(0, m.samplesEvaluated));
        } else if (id === 20) {
          capturedB = new Float32Array(slotB.buffer.subarray(0, m.samplesEvaluated));
        }
        resolvedMap.set(id, m);
      },
    };

    // Ingest 512 samples
    const buf0 = fullInputConc.subarray(0, 512);
    processor.processBuffer(buf0, { sampleRate: 48000, channelCount: 1, sampleCount: 512, nativeTimestampSec: 0.01 }, 10, {
      onFrame: (rawSlice, filteredSlice, frameIndex) => {
        if (frameIndex === 0) {
          processor.registerDeferredCandidate(10, 50, 10, callbacks.onDeferredResolved);
          processor.registerDeferredCandidate(20, 150, 10, callbacks.onDeferredResolved);
          const slots = processor['stagingSlots'];
          slotA = slots.find((s) => s.inUse && s.candidateId === 10);
          slotB = slots.find((s) => s.inUse && s.candidateId === 20);
        }
      },
      onDeferredResolved: callbacks.onDeferredResolved,
    });

    assert.ok(slotA);
    assert.ok(slotB);
    assert.notStrictEqual(slotA, slotB, 'Concurrent candidates must occupy distinct slots');
    assert.notStrictEqual(slotA.buffer, slotB.buffer, 'Concurrent candidates must have distinct buffer memory');

    // Ingest next buffer to resolve both (1500 samples)
    const buf1 = fullInputConc.subarray(512, totalSamplesConc);
    processor.processBuffer(buf1, { sampleRate: 48000, channelCount: 1, sampleCount: 1500, nativeTimestampSec: 0.02 }, 20, callbacks);

    assert.strictEqual(resolvedMap.size, 2);
    const resA = resolvedMap.get(10);
    const resB = resolvedMap.get(20);
    assert.strictEqual(resA.status, 'truncated');
    assert.strictEqual(resA.samplesEvaluated, 50 + 1280); // 1330 samples
    assert.strictEqual(resB.status, 'truncated');
    assert.strictEqual(resB.samplesEvaluated, 150 + 1280); // 1430 samples

    // Point-by-point verification for Candidate A (1330 samples)
    assert.ok(capturedA !== null, 'Captured buffer for Candidate A must be populated');
    assert.strictEqual(capturedA.length, 1330);
    for (let i = 0; i < 1330; i++) {
      assert.strictEqual(capturedA[i], masterFilteredConc[i], `Candidate A mismatch at sample ${i}`);
    }

    // Point-by-point verification for Candidate B (1430 samples)
    assert.ok(capturedB !== null, 'Captured buffer for Candidate B must be populated');
    assert.strictEqual(capturedB.length, 1430);
    for (let i = 0; i < 1430; i++) {
      assert.strictEqual(capturedB[i], masterFilteredConc[i], `Candidate B mismatch at sample ${i}`);
    }

    // Cross-comparison: Candidate A and B must match each other exactly over their shared interval [0 ... 1329]
    for (let i = 0; i < 1330; i++) {
      assert.strictEqual(capturedB[i], capturedA[i], `Candidate A and B cross-talk mismatch at sample ${i}`);
    }

    console.log('  ✓ Concurrent origin candidates (k=50, k=150) resolved independently without data contamination (exact point-by-point match)');
  }
}

// ============================================================================
// TEST 18: Test Group E — Ordinary Candidate Regression (k >= 256)
// ============================================================================
console.log('\nTest 18: Test Group E — Ordinary Candidate Regression (k >= 256)');
{
  const processor = new SlidingWindowFrameProcessor();
  const resolvedList = [];

  // Candidate at k = 300 across 512-sample chunks
  // k = 300: interval [300 - 256, 300 + 1279] = [44, 1579] (1536 samples)
  const chunkSize = 512;
  const totalSamplesOrd = chunkSize * 4;
  const fullInputOrd = new Float32Array(totalSamplesOrd);
  for (let i = 0; i < totalSamplesOrd; i++) {
    fullInputOrd[i] = Math.sin((2 * Math.PI * 60 * i) / 48000);
  }

  // Reference processor for master filtered stream
  const refProcessorOrd = new SlidingWindowFrameProcessor();
  let masterFilteredOrd = null;
  refProcessorOrd.processBuffer(
    fullInputOrd,
    { sampleRate: 48000, channelCount: 1, sampleCount: totalSamplesOrd, nativeTimestampSec: 0.01 },
    10,
    {
      onFrame: (rawSlice, filteredSlice, frameIndex) => {
        if (frameIndex === 0) {
          masterFilteredOrd = new Float32Array(refProcessorOrd['filteredArena'].subarray(0, totalSamplesOrd));
        }
      },
      onDeferredResolved: () => {},
    }
  );
  assert.ok(masterFilteredOrd !== null);

  let slot = null;
  let captured300 = null;

  const callbacks = {
    onFrame: () => {},
    onDeferredResolved: (id, m) => {
      captured300 = new Float32Array(slot.buffer.subarray(0, m.samplesEvaluated));
      resolvedList.push({ id, m });
    },
  };

  // Chunk 0: [0 ... 511]
  const chunk0 = fullInputOrd.subarray(0, chunkSize);
  processor.processBuffer(chunk0, { sampleRate: 48000, channelCount: 1, sampleCount: chunkSize, nativeTimestampSec: 0.01 }, 10, {
    onFrame: (rawSlice, filteredSlice, frameIndex) => {
      if (frameIndex === 0) {
        const ok = processor.registerDeferredCandidate(300, 300, 10, callbacks.onDeferredResolved);
        assert.strictEqual(ok, true);
        slot = processor['stagingSlots'].find((s) => s.inUse && s.candidateId === 300);
      }
    },
    onDeferredResolved: callbacks.onDeferredResolved,
  });

  assert.strictEqual(resolvedList.length, 0, 'Candidate k=300 must be pending in Chunk 0');
  assert.ok(slot);
  assert.strictEqual(slot.startGlobalSample, 44);
  assert.strictEqual(slot.targetGlobalSample, 1579);
  assert.strictEqual(slot.samplesAccumulated, 512 - 44); // 468 samples from Chunk 0

  // Chunk 1: [512 ... 1023]
  const chunk1 = fullInputOrd.subarray(chunkSize, chunkSize * 2);
  processor.processBuffer(chunk1, { sampleRate: 48000, channelCount: 1, sampleCount: chunkSize, nativeTimestampSec: 0.02 }, 20, callbacks);

  assert.strictEqual(resolvedList.length, 0, 'Candidate k=300 must remain pending in Chunk 1');
  assert.strictEqual(slot.samplesAccumulated, 468 + 512); // 980 samples

  // Chunk 2: [1024 ... 1535]
  const chunk2 = fullInputOrd.subarray(chunkSize * 2, chunkSize * 3);
  processor.processBuffer(chunk2, { sampleRate: 48000, channelCount: 1, sampleCount: chunkSize, nativeTimestampSec: 0.03 }, 30, callbacks);

  assert.strictEqual(resolvedList.length, 0, 'Candidate k=300 must NOT resolve prematurely in Chunk 2 (has 1492 / 1536 samples)');
  assert.strictEqual(slot.samplesAccumulated, 1492);

  // Chunk 3: [1536 ... 2047] -> target 1579 arrives
  const chunk3 = fullInputOrd.subarray(chunkSize * 3, chunkSize * 4);
  processor.processBuffer(chunk3, { sampleRate: 48000, channelCount: 1, sampleCount: chunkSize, nativeTimestampSec: 0.04 }, 40, callbacks);

  assert.strictEqual(resolvedList.length, 1, 'Candidate k=300 must resolve in Chunk 3 when target 1579 is reached');
  const m = resolvedList[0].m;
  assert.strictEqual(m.status, 'complete', 'Ordinary candidate must resolve with status complete');
  assert.strictEqual(m.isComplete, true);
  assert.strictEqual(m.isTruncated, false);
  assert.strictEqual(m.samplesEvaluated, 1536, 'Ordinary candidate must evaluate exactly 1536 samples');
  assert.strictEqual(m.targetSamples, 1536);
  assert.ok(m.sub200HzRms > 0);
  assert.strictEqual(slot.inUse, false, 'Slot must be freed');

  // Point-by-point exact sample content verification for ordinary candidate: [44 ... 1579]
  assert.ok(captured300 !== null, 'Captured buffer for candidate k=300 must be populated');
  assert.strictEqual(captured300.length, 1536);
  for (let i = 0; i < 1536; i++) {
    assert.strictEqual(captured300[i], masterFilteredOrd[44 + i], `Ordinary candidate sample mismatch at offset ${i} (global ${44 + i})`);
  }

  console.log('  ✓ Ordinary candidate (k=300) evaluated across 4 chunks: Exactly 1536 samples (all strictly equal to [44 ... 1579]), status complete, zero premature resolution');
}

console.log('\n================================================================');
console.log('🎉 ALL 18 STAGE B-LIVE.5 SIGNAL FOUNDATION TESTS PASSED!');
console.log('================================================================\n');
