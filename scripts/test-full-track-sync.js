/**
 * Full-Track Sensory Synchronization Verification Suite
 *
 * Verifies production TypeScript modules end-to-end:
 * - AutomaticRhythmAnalyzer (streaming MP3 & WAV full-track analysis)
 * - PriorityEventScheduler (rolling look-ahead window replenishment)
 * - trackScoreScheduler (FEEL & SEE timestamp equality & payload parity)
 * - ExpoHapticEngine (FEEL) & VisualRhythmEngine (SEE)
 *
 * Covers all 8 required verification scenarios:
 * 1. Track longer than 60 seconds with events distributed throughout its full duration
 * 2. Continuous rolling-window event scheduling beyond the 17-second boundary
 * 3. Exact haptic and visual targetTimestampMs equality
 * 4. Pause and resume after 20 seconds without losing or repeating cues
 * 5. Forward and backward seeking across a long track
 * 6. Track completion and end-of-track rest cleanup (no premature 11.8s cutoff)
 * 7. Low-confidence rhythm analysis (honest fallback, no invented beats)
 * 8. Long-track MP3 (with ID3v2 + Side Info global_gain & short blocks) and WAV streaming analysis
 *    plus independent FEEL mute preserving SEE visual rhythm.
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

// 1. Transpile production dependencies in topological order
const latencyCode = transpile('src/engines/synchronization/LatencyManager.ts');
const schedulerCode = transpile('src/engines/event-scheduler/PriorityEventScheduler.ts');
const hapticCode = transpile('src/engines/haptic/ExpoHapticEngine.ts');
const mapperCode = transpile('src/engines/visual/VisualEventMapper.ts');
const visualCode = transpile('src/engines/visual/VisualRhythmEngine.ts');
const trackSchedulerCode = transpile('src/features/rhythm/trackScoreScheduler.ts');
const processorCode = transpile('src/engines/audio-analysis/SlidingWindowFrameProcessor.ts');
const energyCode = transpile('src/engines/audio-analysis/SubBandEnergyCalculator.ts');
const onsetCode = transpile('src/engines/audio-analysis/TransientOnsetCandidateDetector.ts');
const foundationCode = transpile('src/engines/audio-analysis/AudioSignalFoundation.ts');
const analyzerCode = transpile('src/engines/audio-analysis/AutomaticRhythmAnalyzer.ts');

// Shared mock master clock for synchronization tests
class DeterministicMasterClock {
  constructor(durationMs = 90000) {
    this.clock = {
      positionMs: 0,
      durationMs,
      status: 'paused',
      rate: 1.0,
      isBuffering: false,
      errorMessage: null,
      updatedAtMs: 1000,
      timelineRevision: 1,
    };
    this.estimatedMs = 0;
    this.statusListeners = new Set();
    this.clockListeners = new Set();
  }
  getClock() {
    return { ...this.clock };
  }
  getEstimatedPositionMs() {
    return this.estimatedMs;
  }
  onClockUpdate(fn) {
    this.clockListeners.add(fn);
    return () => this.clockListeners.delete(fn);
  }
  onStatusChange(fn) {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }
  setTime(ms) {
    this.estimatedMs = ms;
    this.clock.positionMs = ms;
    this.clockListeners.forEach((fn) => fn({ ...this.clock }));
  }
  setStatus(status) {
    this.clock.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }
  seek(targetMs) {
    this.clock.timelineRevision++;
    this.estimatedMs = targetMs;
    this.clock.positionMs = targetMs;
    this.clockListeners.forEach((fn) => fn({ ...this.clock }));
  }
}

const mockClock = new DeterministicMasterClock(90000);
const exportedSync = {};
const exportedScheduler = {};
const exportedHaptic = {};
const exportedVisualMapper = {};
const exportedVisual = {};
const exportedRhythm = {};
const exportedProcessor = {};
const exportedEnergy = {};
const exportedOnset = {};
const exportedFoundation = {};

const mockTheme = {
  theme: {
    colors: {
      sensory: { see: '#4657D5', feel: '#159E98', read: '#EB943B' },
      status: { warning: '#EB943B', success: '#159E98' },
      text: { primary: '#FFFFFF', secondary: '#8A94A6' },
    },
  },
};

const mockExpoHaptics = {
  ImpactFeedbackStyle: { Heavy: 'heavy', Medium: 'medium', Light: 'light', Soft: 'soft', Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: async () => {},
  notificationAsync: async () => {},
  selectionAsync: async () => {},
};

function runModule(code, extraRequire = () => null) {
  const sandbox = {
    require: (id) => {
      const overridden = extraRequire(id);
      if (overridden !== null && overridden !== undefined) return overridden;
      if (id.includes('LatencyManager') || id === '@/engines/synchronization') return exportedSync;
      if (id.includes('event-scheduler') || id.includes('PriorityEventScheduler')) return exportedScheduler;
      if (id.includes('expo-haptics')) return mockExpoHaptics;
      if (id.includes('@/engines/haptic')) return exportedHaptic;
      if (id.includes('VisualEventMapper')) return exportedVisualMapper;
      if (id.includes('@/engines/visual')) return exportedVisual;
      if (id.includes('@/features/rhythm')) return exportedRhythm;
      if (id.includes('@/theme')) return mockTheme;
      if (id.includes('SlidingWindowFrameProcessor')) return exportedProcessor;
      if (id.includes('SubBandEnergyCalculator')) return exportedEnergy;
      if (id.includes('TransientOnsetCandidateDetector')) return exportedOnset;
      if (id.includes('AudioSignalFoundation')) return exportedFoundation;
      if (id.includes('expo-file-system')) return { File: class {}, FileMode: { ReadOnly: 'r' } };
      if (id.startsWith('@/types') || id.endsWith('/types') || id === './types') return {};
      return require(id);
    },
    exports: {},
    module: { exports: {} },
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance: { now: () => 1000 },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.exports;
}

Object.assign(exportedSync, runModule(latencyCode), {
  masterClock: mockClock,
});
exportedSync.latencyManager = new exportedSync.LatencyManager({
  audioOffsetMs: 0,
  hapticOffsetMs: 0,
  visualOffsetMs: 0,
  lyricsOffsetMs: 0,
});

Object.assign(exportedScheduler, runModule(schedulerCode));
Object.assign(exportedHaptic, runModule(hapticCode));
Object.assign(exportedVisualMapper, runModule(mapperCode));
Object.assign(exportedVisual, runModule(visualCode));
Object.assign(exportedRhythm, runModule(trackSchedulerCode));
Object.assign(exportedProcessor, runModule(processorCode));
Object.assign(exportedEnergy, runModule(energyCode));
Object.assign(exportedOnset, runModule(onsetCode));
Object.assign(exportedFoundation, runModule(foundationCode));
const { AutomaticRhythmAnalyzer } = runModule(analyzerCode);

// Helper to write bits into an MPEG frame buffer (MSB first)
function writeBits(buf, bitOffset, bitLength, value) {
  for (let i = 0; i < bitLength; i++) {
    const absBit = bitOffset + i;
    const byteIdx = absBit >> 3;
    const bitInByte = 7 - (absBit & 7);
    const bit = (value >> (bitLength - 1 - i)) & 1;
    if (bit) buf[byteIdx] |= 1 << bitInByte;
    else buf[byteIdx] &= ~(1 << bitInByte);
  }
}

/**
 * Generates a synthetic valid MPEG-1 Layer III MP3 stream with ID3v2 header,
 * encoding real `global_gain` envelopes + `window_switching_flag=1, block_type=2`
 * short-block transients at exact musical beat times across the full duration.
 */
function buildSyntheticMp3Stream(durationSec, bpm, silentBreakdownRangeSec = null) {
  const sampleRate = 44100;
  const bitrate = 128000;
  const frameBytes = Math.floor((144 * bitrate) / sampleRate); // 417 bytes
  const frameDurationSec = 1152 / sampleRate; // 0.0261224s
  const frameCount = Math.ceil(durationSec / frameDurationSec);
  const id3Size = 64;
  const totalBytes = 10 + id3Size + frameCount * frameBytes;
  const buf = new Uint8Array(totalBytes);

  // ID3v2 header
  buf[0] = 0x49; buf[1] = 0x44; buf[2] = 0x33; // "ID3"
  buf[3] = 0x03; buf[4] = 0x00;
  buf[9] = id3Size;

  const beatIntervalSec = 60 / bpm;

  for (let f = 0; f < frameCount; f++) {
    const offset = 10 + id3Size + f * frameBytes;
    // MPEG-1 Layer III, no CRC, 128kbps (idx 9), 44100Hz (idx 0), padding 0, Joint Stereo
    buf[offset] = 0xff;
    buf[offset + 1] = 0xfb;
    buf[offset + 2] = 0x90;
    buf[offset + 3] = 0x64;

    const frameStartSec = f * frameDurationSec;
    const inSilence =
      silentBreakdownRangeSec &&
      frameStartSec >= silentBreakdownRangeSec[0] &&
      frameStartSec <= silentBreakdownRangeSec[1];

    // Write 2 granules (2 channels each) starting at bit offset 32 + 9 + 3 + 8 = 52
    let bitCursor = 32 + 9 + 3 + 8;
    for (let g = 0; g < 2; g++) {
      const granuleSec = frameStartSec + (g * frameDurationSec) / 2;
      const distToBeat = granuleSec % beatIntervalSec;
      const isBeatOnset = !inSilence && distToBeat < 0.020;

      const globalGain = inSilence ? 95 : isBeatOnset ? 235 : 155;
      const windowSwitching = isBeatOnset ? 1 : 0;
      const blockType = isBeatOnset ? 2 : 0;
      const part23 = isBeatOnset ? 1100 : 400;

      for (let ch = 0; ch < 2; ch++) {
        const frameView = buf.subarray(offset, offset + frameBytes);
        writeBits(frameView, bitCursor, 12, part23);
        writeBits(frameView, bitCursor + 21, 8, globalGain);
        writeBits(frameView, bitCursor + 33, 1, windowSwitching);
        if (windowSwitching) {
          writeBits(frameView, bitCursor + 34, 2, blockType);
        }
        bitCursor += 59;
      }
    }
  }

  return buf;
}

/**
 * Generates a synthetic valid 16-bit mono 44100Hz WAV stream with impulses at exact beat intervals.
 */
function buildSyntheticWavStream(durationSec, bpm) {
  const sampleRate = 44100;
  const totalSamples = Math.floor(durationSec * sampleRate);
  const dataSize = totalSamples * 2;
  const buf = new Uint8Array(44 + dataSize);
  const view = new DataView(buf.buffer);

  // RIFF / WAVE
  buf.set([0x52, 0x49, 0x46, 0x46], 0);
  view.setUint32(4, 36 + dataSize, true);
  buf.set([0x57, 0x41, 0x56, 0x45], 8);
  // fmt
  buf.set([0x66, 0x6d, 0x74, 0x20], 12);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  // data
  buf.set([0x64, 0x61, 0x74, 0x61], 36);
  view.setUint32(40, dataSize, true);

  const beatSamples = Math.round((60 / bpm) * sampleRate);
  for (let s = 0; s < totalSamples; s++) {
    const posInBeat = s % beatSamples;
    let sampleVal = 0.002;
    if (posInBeat < 600) {
      sampleVal = 0.9 * Math.exp(-posInBeat / 160) * Math.sin((2 * Math.PI * 150 * posInBeat) / sampleRate);
    }
    const int16 = Math.max(-32767, Math.min(32767, Math.round(sampleVal * 32767)));
    view.setInt16(44 + s * 2, int16, true);
  }

  return buf;
}

async function runTests() {
  console.log('🧪 Starting Full-Track Sensory Synchronization Verification Suite...\n');

  // --- Test 1 & Test 8A: Full-track 75s MP3 analysis (with ID3v2 + silent breakdown 35s..42s) ---
  console.log('Test 1 & 8A: Long-Track MP3 Analysis Coverage (75s, 120 BPM, ID3v2, Silent Breakdown)');
  const mp3Bytes = buildSyntheticMp3Stream(75, 120, [35, 42]);
  const mp3Analysis = await AutomaticRhythmAnalyzer.analyzeMp3Buffer(mp3Bytes);

  assert.strictEqual(mp3Analysis.status, 'complete', '75s periodic MP3 must classify as complete');
  assert(Math.abs(mp3Analysis.bpm - 120) <= 2, `Expected ~120 BPM, got ${mp3Analysis.bpm}`);
  assert(mp3Analysis.durationMs >= 74000 && mp3Analysis.durationMs <= 76000, `Expected ~75000ms duration, got ${mp3Analysis.durationMs}`);
  assert(mp3Analysis.rhythmScore.length > 110, `Expected >110 cues across 75s (got ${mp3Analysis.rhythmScore.length})`);

  const firstCueMs = mp3Analysis.rhythmScore[0].targetTimestampMs;
  const lastCueMs = mp3Analysis.rhythmScore[mp3Analysis.rhythmScore.length - 1].targetTimestampMs;
  assert(firstCueMs < 1000, `First cue should be near start, got ${firstCueMs}ms`);
  assert(lastCueMs > 70000, `Last cue must extend near end of 75s song, got ${lastCueMs}ms`);

  // Verify silent breakdown (36s..41s) does NOT get stamped with fake cues
  const breakdownCues = mp3Analysis.rhythmScore.filter(
    (c) => c.targetTimestampMs >= 36500 && c.targetTimestampMs <= 41000
  );
  assert.strictEqual(breakdownCues.length, 0, `Silent breakdown should not emit ghost beats (got ${breakdownCues.length})`);
  console.log(`  ✓ MP3 parsed: ${mp3Analysis.durationMs}ms, ${mp3Analysis.bpm} BPM (conf ${mp3Analysis.bpmConfidence}), ${mp3Analysis.rhythmScore.length} cues [${firstCueMs}ms .. ${lastCueMs}ms], silent break gated cleanly`);

  // --- Test 8B: Long-track 65s WAV streaming PCM analysis ---
  console.log('\nTest 8B: Long-Track WAV Streaming Analysis Coverage (65s, 100 BPM)');
  const wavBytes = buildSyntheticWavStream(65, 100);
  const wavAnalysis = await AutomaticRhythmAnalyzer.analyzeWavBuffer(wavBytes);

  assert.strictEqual(wavAnalysis.status, 'complete', '65s periodic WAV must classify as complete');
  assert(Math.abs(wavAnalysis.bpm - 100) <= 2, `Expected ~100 BPM, got ${wavAnalysis.bpm}`);
  assert(wavAnalysis.durationMs >= 64500 && wavAnalysis.durationMs <= 65500, `Expected ~65000ms duration, got ${wavAnalysis.durationMs}`);
  const lastWavCueMs = wavAnalysis.rhythmScore[wavAnalysis.rhythmScore.length - 1].targetTimestampMs;
  assert(lastWavCueMs > 60000, `Last WAV cue must exceed 60s, got ${lastWavCueMs}ms`);
  console.log(`  ✓ WAV streamed: ${wavAnalysis.durationMs}ms, ${wavAnalysis.bpm} BPM, ${wavAnalysis.rhythmScore.length} cues up to ${lastWavCueMs}ms`);

  // --- Test 2 & Test 3: Continuous Rolling Window Scheduling beyond 17s & Haptic/Visual Equality ---
  console.log('\nTest 2 & 3: Continuous Rolling Replenishment Beyond 17s + Haptic/Visual Equality');
  mockClock.clock.durationMs = mp3Analysis.durationMs;
  mockClock.clock.timelineRevision = 1;
  mockClock.setTime(0);
  mockClock.setStatus('playing');

  const scheduler = new exportedScheduler.PriorityEventScheduler(
    { lookAheadWindowMs: 80, pollingIntervalMs: 20 },
    mockClock,
    exportedSync.latencyManager
  );

  let hapticTriggerCount = 0;
  let visualCueCount = 0;
  const firedHapticTimestamps = [];
  const firedVisualTimestamps = [];
  const visualWeights = [];

  const mockDriver = {
    impactAsync: async () => { hapticTriggerCount++; },
    notificationAsync: async () => { hapticTriggerCount++; },
    selectionAsync: async () => { hapticTriggerCount++; },
  };
  const hapticEngine = new exportedHaptic.ExpoHapticEngine(
    { enabled: true, intensity: 1.0, minIntervalMs: 40 },
    mockDriver
  );
  hapticEngine.attachScheduler(scheduler);

  const visualEngine = new exportedVisual.VisualRhythmEngine(
    { enabled: true, reducedMotion: false },
    mockClock,
    exportedSync.latencyManager
  );
  visualEngine.attachScheduler(scheduler);

  scheduler.subscribe('haptic', (evt) => firedHapticTimestamps.push(evt.targetTimestampMs));
  scheduler.subscribe('visual', (evt) => {
    firedVisualTimestamps.push(evt.targetTimestampMs);
    visualWeights.push(evt.payload.weight);
  });

  // Register rolling windowed provider (15s look-ahead window, 5s replenish threshold)
  scheduler.setWindowedScoreProvider(
    (sched, rev, startMs, endMs) => {
      exportedRhythm.scheduleTrackSensoryCuesInWindow(
        sched,
        rev,
        mp3Analysis.rhythmScore,
        startMs,
        endMs
      );
    },
    15000,
    5000
  );

  // Verify initial window only buffered first ~15s (not entire 75s upfront)
  const initialPending = scheduler.getPendingEventCount();
  assert(initialPending > 0 && initialPending < mp3Analysis.rhythmScore.length * 2, 'Initial rolling window should queue only upcoming window slice');

  // Step through entire 75s song in 20ms increments (matching PriorityEventScheduler pollingIntervalMs)
  let monoNow = 1000;
  for (let t = 0; t <= 74000; t += 20) {
    mockClock.setTime(t);
    monoNow += 20;
    scheduler.tick(t, monoNow);
    await Promise.resolve();
  }

  assert.strictEqual(firedHapticTimestamps.length, firedVisualTimestamps.length, 'Haptic and Visual must fire identical event counts');
  for (let i = 0; i < firedHapticTimestamps.length; i++) {
    assert.strictEqual(
      firedHapticTimestamps[i],
      firedVisualTimestamps[i],
      `Timestamp mismatch at index ${i}: haptic=${firedHapticTimestamps[i]} vs visual=${firedVisualTimestamps[i]}`
    );
  }
  assert(visualWeights.every((w) => typeof w === 'number' && !Number.isNaN(w)), 'Visual weights must never be NaN');
  assert(!Number.isNaN(visualEngine.getEnergyAccumulator()), 'Visual energyAccumulator must remain valid numeric value');

  const post17sHaptics = firedHapticTimestamps.filter((t) => t > 17000);
  const post60sHaptics = firedHapticTimestamps.filter((t) => t > 60000);
  assert(post17sHaptics.length > 50, `Haptics must continue well beyond 17s (got ${post17sHaptics.length})`);
  assert(post60sHaptics.length > 15, `Haptics must continue beyond 60s (got ${post60sHaptics.length})`);
  assert.strictEqual(visualEngine.getState().isRest, false, 'Visual engine must NOT freeze into resting state at 11.8s');
  console.log(`  ✓ Stepped 0s..74s: ${firedHapticTimestamps.length} FEEL == ${firedVisualTimestamps.length} SEE events, ${post60sHaptics.length} events after 60s, energy valid (${visualEngine.getEnergyAccumulator().toFixed(2)})`);

  // --- Test 4: Pause & Resume after 20 seconds ---
  console.log('\nTest 4: Pause & Resume Synchronization After 20s');
  mockClock.seek(20000);
  mockClock.setTime(20000);
  scheduler.tick(20000, (monoNow += 100));
  const countBeforePause = firedHapticTimestamps.length;

  // Pause playback at 22s
  mockClock.setStatus('paused');
  assert.strictEqual(visualEngine.getState().isPaused, true);
  // Ticking during pause without explicit test override does not dispatch
  for (let i = 0; i < 5; i++) {
    scheduler.tick(undefined, (monoNow += 50));
  }
  assert.strictEqual(firedHapticTimestamps.length, countBeforePause, 'No haptic events may dispatch while paused');

  // Resume playback from 22,000ms
  mockClock.setTime(22000);
  mockClock.setStatus('playing');
  for (let t = 22000; t <= 25000; t += 20) {
    mockClock.setTime(t);
    scheduler.tick(t, (monoNow += 20));
  }
  const resumedEvents = firedHapticTimestamps.slice(countBeforePause);
  assert(resumedEvents.length >= 4, 'Events must resume cleanly after 22s');
  assert(resumedEvents.every((ts) => ts >= 21900), 'Resumed events must not replay stale pre-pause timestamps');
  console.log(`  ✓ Pause at 22s suspended both channels cleanly; resumed with ${resumedEvents.length} events`);

  // --- Test 5: Forward & Backward Seeking ---
  console.log('\nTest 5: Forward & Backward Seeking Timeline Integrity');
  // Forward seek to 55,000ms
  mockClock.seek(55000);
  const countAtSeek55 = firedHapticTimestamps.length;
  for (let t = 55000; t <= 58000; t += 20) {
    mockClock.setTime(t);
    scheduler.tick(t, (monoNow += 20));
  }
  const forwardEvents = firedHapticTimestamps.slice(countAtSeek55);
  assert(forwardEvents.some((t) => t >= 55000 && t <= 58000), 'Forward seek to 55s must replenish and fire cues in 55s..58s');

  // Backward seek to 10,000ms
  mockClock.seek(10000);
  const countAtSeek10 = firedHapticTimestamps.length;
  for (let t = 10000; t <= 13000; t += 20) {
    mockClock.setTime(t);
    scheduler.tick(t, (monoNow += 20));
  }
  const backwardEvents = firedHapticTimestamps.slice(countAtSeek10);
  assert(backwardEvents.some((t) => t >= 10000 && t <= 13000), 'Backward seek to 10s must clear history and fire cues in 10s..13s');
  console.log(`  ✓ Forward seek (55s) fired ${forwardEvents.length} cues; Backward seek (10s) fired ${backwardEvents.length} cues`);

  // --- Test 6: Independent FEEL Mute Without Interrupting SEE ---
  console.log('\nTest 6A: Disabling FEEL Stops Haptics Without Interrupting SEE');
  const hapticsBeforeMute = hapticTriggerCount;
  const visualBeforeMute = firedVisualTimestamps.length;
  hapticEngine.setEnabled(false);

  for (let t = 13100; t <= 15500; t += 20) {
    mockClock.setTime(t);
    scheduler.tick(t, (monoNow += 20));
    await Promise.resolve();
  }
  assert.strictEqual(hapticTriggerCount, hapticsBeforeMute, 'Muted FEEL must trigger zero vibrations');
  assert(firedVisualTimestamps.length > visualBeforeMute, 'SEE visuals must continue firing while FEEL is muted');
  hapticEngine.setEnabled(true);
  console.log(`  ✓ FEEL muted cleanly while SEE continued (${firedVisualTimestamps.length - visualBeforeMute} visual cues fired)`);

  // --- Test 6B: Track Completion & Cleanup ---
  console.log('\nTest 6B: Track Completion Rest Transition & Cleanup');
  mockClock.setTime(mp3Analysis.durationMs - 100);
  assert.strictEqual(visualEngine.getState().isRest, true, 'Visual engine transitions to rest at real track end');
  const countAtEnd = firedVisualTimestamps.length;
  scheduler.tick(mp3Analysis.durationMs, (monoNow += 100));
  assert.strictEqual(firedVisualTimestamps.length, countAtEnd, 'No cues may dispatch at or after durationMs');
  scheduler.dispose();
  hapticEngine.dispose();
  visualEngine.dispose();
  console.log('  ✓ End-of-track rest state and engine disposal verified cleanly');

  // --- Test 7: Low-Confidence Rhythm Analysis (Does NOT Invent Beats) ---
  console.log('\nTest 7: Low-Confidence / Silent MP3 Analysis Does Not Invent Fake Grid');
  // Silent / very low-gain MP3 stream (30s)
  const silentMp3 = buildSyntheticMp3Stream(30, 120, [0, 30]);
  const silentRes = await AutomaticRhythmAnalyzer.analyzeMp3Buffer(silentMp3);
  assert.strictEqual(silentRes.rhythmScore.length, 0, 'Silent track must emit 0 invented beats');
  assert(silentRes.bpmConfidence < 0.35, 'Silent track confidence must stay below threshold');

  // Irregular random onsets (not periodic)
  const irregularOnsets = [
    { timestampMs: 310, energy: 0.7, isLowBand: true, confidence: 0.8 },
    { timestampMs: 1120, energy: 0.6, isLowBand: false, confidence: 0.7 },
    { timestampMs: 1490, energy: 0.8, isLowBand: true, confidence: 0.9 },
    { timestampMs: 3810, energy: 0.5, isLowBand: false, confidence: 0.6 },
    { timestampMs: 4290, energy: 0.75, isLowBand: true, confidence: 0.8 },
    { timestampMs: 7920, energy: 0.65, isLowBand: false, confidence: 0.7 },
    { timestampMs: 11410, energy: 0.85, isLowBand: true, confidence: 0.9 },
  ];
  const tempoRes = AutomaticRhythmAnalyzer.estimateTempoFromOnsets(irregularOnsets);
  assert(tempoRes.confidence < 0.35, `Irregular onsets must yield low confidence (<0.35), got ${tempoRes.confidence}`);
  console.log(`  ✓ Silent MP3 emitted 0 fake beats; irregular onsets flagged honestly (confidence ${tempoRes.confidence.toFixed(2)})`);

  console.log('\n================================================================');
  console.log('🎉 ALL FULL-TRACK SENSORY SYNCHRONIZATION TESTS PASSED!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('❌ Full-track synchronization test failed:', err);
  process.exit(1);
});
