/**
 * Automated Verification Suite for FEEL Pillar: Haptic Feedback Engine (Milestone 4)
 *
 * Deterministic testing of:
 * 1. Initial State & Configuration
 * 2. Master Enable / Disable Toggle
 * 3. Intensity Scaling & Dynamic Tier Remapping
 * 4. Pattern Mapping (Heavy, Medium, Light, Soft, Rigid, Pulse, Double, Silence)
 * 5. Anti-Spam Throttling (Motor Fatigue Safeguards, 40ms limit)
 * 6. PriorityEventScheduler Channel Subscription & Isolation
 * 7. Safe Pause / Resume / Seek Timeline Synchronization
 * 8. Bundled 120 BPM Demo Track Score Verification
 * 9. Lifecycle Cleanup & Disposal
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

const latencyManagerCode = transpile('src/engines/synchronization/LatencyManager.ts');
const schedulerCode = transpile('src/engines/event-scheduler/PriorityEventScheduler.ts');
const hapticEngineCode = transpile('src/engines/haptic/ExpoHapticEngine.ts');
const demoHapticsCode = transpile('src/features/haptics/demoTrackHaptics.ts');

// Mock Expo Haptics constants
const MockExpoHaptics = {
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
    Soft: 'Soft',
    Rigid: 'Rigid',
  },
  NotificationFeedbackType: {
    Success: 'Success',
    Warning: 'Warning',
    Error: 'Error',
  },
};

// Mock Driver Recording calls
class MockHapticDriver {
  constructor() {
    this.impactCalls = [];
    this.notificationCalls = [];
    this.selectionCalls = [];
  }

  async impactAsync(style) {
    this.impactCalls.push(style);
  }

  async notificationAsync(type) {
    this.notificationCalls.push(type);
  }

  async selectionAsync() {
    this.selectionCalls.push(true);
  }

  clear() {
    this.impactCalls = [];
    this.notificationCalls = [];
    this.selectionCalls = [];
  }
}

// Sandbox Setup
const sandbox = {
  require: (id) => {
    if (id === 'expo-haptics') return MockExpoHaptics;
    if (id.includes('synchronization')) return exportedSync;
    if (id.includes('event-scheduler')) return exportedScheduler;
    if (id.includes('haptic')) return exportedHaptics;
    if (id.startsWith('@/types') || id.endsWith('types')) return {};
    return require(id);
  },
  exports: {},
  module: { exports: {} },
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
};

vm.createContext(sandbox);

// 1. Load LatencyManager
vm.runInContext(latencyManagerCode, sandbox);
const { LatencyManager, DEFAULT_LATENCY_OFFSETS } = sandbox.exports;

const exportedSync = {
  LatencyManager,
  DEFAULT_LATENCY_OFFSETS,
  latencyManager: new LatencyManager(),
  masterClock: {
    getClock: () => ({ timelineRevision: 0, status: 'idle', durationMs: 0 }),
    getEstimatedPositionMs: () => 0,
    onClockUpdate: () => () => {},
    onStatusChange: () => () => {},
  },
};

// 2. Load PriorityEventScheduler
sandbox.exports = {};
sandbox.module = { exports: {} };
vm.runInContext(schedulerCode, sandbox);
const { PriorityEventScheduler } = sandbox.exports;

const exportedScheduler = {
  PriorityEventScheduler,
  eventScheduler: new PriorityEventScheduler(),
};

// 3. Load ExpoHapticEngine
sandbox.exports = {};
sandbox.module = { exports: {} };
vm.runInContext(hapticEngineCode, sandbox);
const { ExpoHapticEngine } = sandbox.exports;

const exportedHaptics = {
  ExpoHapticEngine,
};

// 4. Load demoTrackHaptics
sandbox.exports = {};
sandbox.module = { exports: {} };
vm.runInContext(demoHapticsCode, sandbox);
const { DEMO_TRACK_HAPTIC_CUES, scheduleDemoTrackHaptics } = sandbox.exports;

// Mock Clock for Scheduler Testing
class MockMasterClock {
  constructor() {
    this.clock = {
      positionMs: 0,
      durationMs: 12000,
      status: 'playing',
      rate: 1.0,
      isBuffering: false,
      errorMessage: null,
      updatedAtMs: 1000.0,
      timelineRevision: 1,
    };
    this.estimatedPositionMs = 0;
    this.statusListeners = new Set();
    this.clockListeners = new Set();
  }

  getClock() {
    return { ...this.clock };
  }

  getEstimatedPositionMs() {
    return this.estimatedPositionMs;
  }

  onClockUpdate(fn) {
    this.clockListeners.add(fn);
    return () => this.clockListeners.delete(fn);
  }

  onStatusChange(fn) {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  setTime(posMs) {
    this.estimatedPositionMs = posMs;
    this.clock.positionMs = posMs;
  }

  setStatus(status) {
    this.clock.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }

  setRevision(rev) {
    this.clock.timelineRevision = rev;
    this.clockListeners.forEach((fn) => fn({ ...this.clock }));
  }

  setBuffering(buffering) {
    this.clock.isBuffering = buffering;
  }
}

async function runHapticTests() {
  console.log('🧪 Starting Milestone 4 Haptic Engine (FEEL Pillar) Verification Suite...\n');

  // --- Test 1: Initial State & Configuration ---
  console.log('Test 1: Initial State & Configuration');
  const mockDriver = new MockHapticDriver();
  const engine = new ExpoHapticEngine({ enabled: true, intensity: 1.0, minIntervalMs: 40 }, mockDriver);

  let state = engine.getState();
  assert.strictEqual(state.enabled, true, 'Default enabled should be true');
  assert.strictEqual(state.intensity, 1.0, 'Default intensity should be 1.0');
  assert.strictEqual(state.minIntervalMs, 40, 'Default throttle interval should be 40ms');
  assert.strictEqual(state.totalVibrationsTriggered, 0);
  assert.strictEqual(state.totalVibrationsThrottled, 0);
  console.log('  ✓ Initial state and configuration initialized correctly');

  // --- Test 2: Master Enable / Disable Toggle ---
  console.log('Test 2: Master Enable / Disable Toggle');
  engine.setEnabled(false);
  assert.strictEqual(engine.getState().enabled, false);

  const disabledResult = await engine.trigger('heavy');
  assert.strictEqual(disabledResult, false, 'Trigger when disabled must return false');
  assert.strictEqual(mockDriver.impactCalls.length, 0, 'No driver calls should be made when disabled');

  engine.setEnabled(true);
  assert.strictEqual(engine.getState().enabled, true);
  const enabledResult = await engine.trigger('heavy');
  assert.strictEqual(enabledResult, true, 'Trigger when enabled should succeed');
  assert.strictEqual(mockDriver.impactCalls.length, 1, 'Driver impactAsync should be called once');
  assert.strictEqual(mockDriver.impactCalls[0], 'Heavy');
  mockDriver.clear();
  engine.reset();
  console.log('  ✓ Master enable/disable toggle strictly gates tactile driver actuation');

  // --- Test 3: Pattern Mapping to Driver Feedback Styles ---
  console.log('Test 3: Pattern Mapping to Driver Feedback Styles');
  // Delay helper to ensure we do not hit throttle in sequential tests
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 'heavy'
  mockDriver.clear();
  await engine.trigger('heavy');
  assert.strictEqual(mockDriver.impactCalls[0], 'Heavy');

  // 'medium'
  await delay(45);
  mockDriver.clear();
  await engine.trigger('medium');
  assert.strictEqual(mockDriver.impactCalls[0], 'Medium');

  // 'light'
  await delay(45);
  mockDriver.clear();
  await engine.trigger('light');
  assert.strictEqual(mockDriver.impactCalls[0], 'Light');

  // 'soft'
  await delay(45);
  mockDriver.clear();
  await engine.trigger('soft');
  assert.strictEqual(mockDriver.impactCalls[0], 'Soft');

  // 'rigid'
  await delay(45);
  mockDriver.clear();
  await engine.trigger('rigid');
  assert.strictEqual(mockDriver.impactCalls[0], 'Rigid');

  // 'pulse'
  await delay(45);
  mockDriver.clear();
  await engine.trigger('pulse');
  assert.strictEqual(mockDriver.notificationCalls[0], 'Success');

  // 'double'
  await delay(45);
  mockDriver.clear();
  await engine.trigger('double');
  assert.strictEqual(mockDriver.selectionCalls.length, 1);

  // 'silence'
  await delay(45);
  mockDriver.clear();
  const silenceResult = await engine.trigger('silence');
  assert.strictEqual(silenceResult, false);
  assert.strictEqual(mockDriver.impactCalls.length, 0);
  assert.strictEqual(mockDriver.notificationCalls.length, 0);
  assert.strictEqual(mockDriver.selectionCalls.length, 0);
  console.log('  ✓ All 8 tactile patterns correctly mapped to Expo Haptics driver calls');

  // --- Test 4: Intensity Scaling & Dynamic Tier Remapping ---
  console.log('Test 4: Intensity Scaling & Dynamic Tier Remapping');
  // At user intensity = 1.0, heavy pattern -> Heavy
  engine.setIntensity(1.0);
  await delay(45);
  mockDriver.clear();
  await engine.trigger('heavy');
  assert.strictEqual(mockDriver.impactCalls[0], 'Heavy');

  // At user intensity = 0.5, heavy pattern scales down to Medium
  engine.setIntensity(0.5);
  await delay(45);
  mockDriver.clear();
  await engine.trigger('heavy');
  assert.strictEqual(mockDriver.impactCalls[0], 'Medium', 'Heavy scaled down to Medium at 50% intensity');

  // At user intensity = 0.25, heavy pattern scales down to Light
  engine.setIntensity(0.25);
  await delay(45);
  mockDriver.clear();
  await engine.trigger('heavy');
  assert.strictEqual(mockDriver.impactCalls[0], 'Light', 'Heavy scaled down to Light at 25% intensity');

  // At user intensity = 0.1, heavy pattern scales down to Soft
  engine.setIntensity(0.1);
  await delay(45);
  mockDriver.clear();
  await engine.trigger('heavy');
  assert.strictEqual(mockDriver.impactCalls[0], 'Soft', 'Heavy scaled down to Soft at 10% intensity');

  // At user intensity = 0.0, trigger returns false and emits nothing
  engine.setIntensity(0.0);
  await delay(45);
  mockDriver.clear();
  const zeroResult = await engine.trigger('heavy');
  assert.strictEqual(zeroResult, false);
  assert.strictEqual(mockDriver.impactCalls.length, 0);

  // Reset intensity to 1.0
  engine.setIntensity(1.0);
  console.log('  ✓ Dynamic tactile tier remapping adapts discrete styles to continuous user intensity');

  // --- Test 5: Event-Rate Safeguard (40ms Limit) ---
  console.log('Test 5: Event-Rate Safeguard (40ms Limit)');
  engine.reset();
  mockDriver.clear();

  // First vibration fires immediately
  const hit1 = await engine.trigger('heavy');
  assert.strictEqual(hit1, true, 'First pulse must succeed');

  // Consecutive pulse immediately after (0ms elapsed) must be throttled!
  const hit2 = await engine.trigger('medium');
  assert.strictEqual(hit2, false, 'Immediate second pulse (<40ms) must be throttled by event-rate safeguard');

  const hit3 = await engine.trigger('light');
  assert.strictEqual(hit3, false, 'Immediate third pulse (<40ms) must be throttled');

  const throttleState = engine.getState();
  assert.strictEqual(throttleState.totalVibrationsTriggered, 1, 'Only 1 pulse should have reached driver');
  assert.strictEqual(throttleState.totalVibrationsThrottled, 2, '2 rapid pulses must be counted as throttled');
  assert.strictEqual(mockDriver.impactCalls.length, 1);

  // After >= 40ms elapses, next pulse fires cleanly
  await delay(45);
  const hit4 = await engine.trigger('heavy');
  assert.strictEqual(hit4, true, 'Pulse after 45ms must succeed');
  assert.strictEqual(engine.getState().totalVibrationsTriggered, 2);
  console.log('  ✓ 40ms event-rate safeguard limits rapid trigger bursts without claiming fatigue/overheating protection');

  // --- Test 6: PriorityEventScheduler Subscription & Channel Isolation ---
  console.log('Test 6: PriorityEventScheduler Subscription & Channel Isolation');
  const mockClock = new MockMasterClock();
  const latencyZero = new LatencyManager({ audioOffsetMs: 0, hapticOffsetMs: 0, visualOffsetMs: 0, lyricsOffsetMs: 0 });
  const scheduler = new PriorityEventScheduler({ lookAheadWindowMs: 100 }, mockClock, latencyZero);

  engine.reset();
  mockDriver.clear();
  engine.attachScheduler(scheduler);

  // Schedule events across multiple channels at 100ms
  scheduler.scheduleBatch([
    { id: 'haptic-cue-1', targetTimestampMs: 100, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy', weight: 1.0 } },
    { id: 'visual-cue-1', targetTimestampMs: 100, channel: 'visual', type: 'pulse', payload: { band: 'sub' } },
    { id: 'lyrics-cue-1', targetTimestampMs: 100, channel: 'lyrics', type: 'line', payload: { text: 'Feel the rhythm' } },
  ]);

  // Tick scheduler at 100ms
  scheduler.tick(100, 1000);

  // Only haptic cue should have actuated the engine
  assert.strictEqual(mockDriver.impactCalls.length, 1);
  assert.strictEqual(mockDriver.impactCalls[0], 'Heavy');

  // Test disabling haptics removes / suspends subscription correctly
  engine.setEnabled(false);
  mockDriver.clear();
  scheduler.schedule({ id: 'haptic-cue-disabled', targetTimestampMs: 150, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy' } });
  scheduler.tick(150, 1500);
  assert.strictEqual(mockDriver.impactCalls.length, 0, 'Disabled engine must not receive or process dispatched events');

  // Test re-enabling haptics restores subscription without duplication
  engine.setEnabled(true);
  await delay(45);
  mockDriver.clear();
  scheduler.schedule({ id: 'haptic-cue-restored', targetTimestampMs: 200, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy' } });
  scheduler.tick(200, 2000);
  assert.strictEqual(mockDriver.impactCalls.length, 1, 'Re-enabled engine must receive exactly one event (no duplicate listeners)');

  // Detach scheduler
  engine.detachScheduler();
  await delay(45);
  mockDriver.clear();

  // Schedule third haptic cue at 250ms
  scheduler.schedule({ id: 'haptic-cue-3', targetTimestampMs: 250, channel: 'haptic', type: 'beat', payload: { pattern: 'medium' } });
  scheduler.tick(250, 2500);

  // Since detached, driver should not have received the cue
  assert.strictEqual(mockDriver.impactCalls.length, 0, 'Detached engine must not receive dispatched cues');
  console.log('  ✓ Scheduler channel subscription, disable suspension, restore without duplication, and detachment verified');

  // --- Test 7: Timeline Revision Seeking & Pause Safety ---
  console.log('Test 7: Timeline Revision Seeking & Pause Safety');
  engine.reset();
  mockDriver.clear();
  engine.attachScheduler(scheduler);
  scheduler.clear();

  mockClock.setRevision(1);
  mockClock.setStatus('playing');
  mockClock.setTime(0);

  // Schedule cue for timeline 1 at 300ms
  scheduler.schedule({ id: 't1-cue', targetTimestampMs: 300, channel: 'haptic', type: 'beat', payload: { pattern: 'heavy' } });

  // User pauses playback
  mockClock.setStatus('paused');
  mockClock.setTime(290);
  scheduler.tick(); // Tick without position override while paused
  assert.strictEqual(mockDriver.impactCalls.length, 0, 'No haptic actuation while paused');

  // Buffering state prevents vibration
  mockClock.setStatus('playing');
  mockClock.setBuffering(true);
  scheduler.tick();
  assert.strictEqual(mockDriver.impactCalls.length, 0, 'No haptic actuation while buffering');
  mockClock.setBuffering(false);

  // User seeks forward: revision increments to 2
  mockClock.setRevision(2);
  mockClock.setTime(1000);
  mockClock.setStatus('playing');
  scheduler.stop(); // Stop automatic interval timer so we can step deterministically

  // Outdated revision 1 cue at 300ms must be discarded; schedule new cue at 1050ms
  scheduler.scheduleBatch([
    { id: 't2-cue', targetTimestampMs: 1050, channel: 'haptic', type: 'beat', payload: { pattern: 'medium' } },
  ]);

  await delay(45);
  mockDriver.clear();
  const res = scheduler.tick(1050, 3000);

  assert.strictEqual(mockDriver.impactCalls.length, 1, 'Only revision 2 cue should fire');
  assert.strictEqual(mockDriver.impactCalls[0], 'Medium');

  // Track change increments revision to 3 and invalidates old cues
  mockClock.setRevision(3);
  mockClock.setTime(0);
  scheduler.scheduleBatch([
    { id: 't3-track-cue', targetTimestampMs: 100, channel: 'haptic', type: 'beat', payload: { pattern: 'light' } },
  ]);
  await delay(45);
  mockDriver.clear();
  scheduler.tick(100, 4000);
  assert.strictEqual(mockDriver.impactCalls.length, 1, 'Track change cue dispatched cleanly');
  assert.strictEqual(mockDriver.impactCalls[0], 'Light');
  console.log('  ✓ Haptic output cleanly suspends during pause/buffer and drops outdated cues on seek/track change');

  // --- Test 8: Bundled 120 BPM Demo Track Score Verification ---
  console.log('Test 8: Bundled 120 BPM Demo Track Score Verification');
  assert.ok(Array.isArray(DEMO_TRACK_HAPTIC_CUES), 'DEMO_TRACK_HAPTIC_CUES must be an array');
  assert.strictEqual(DEMO_TRACK_HAPTIC_CUES.length > 20, true, 'Score must contain full 6-bar rhythm cues');

  // Verify all cues are well-formed
  const seenIds = new Set();
  for (const cue of DEMO_TRACK_HAPTIC_CUES) {
    assert.ok(cue.id, 'Every cue must have an ID');
    assert.ok(!seenIds.has(cue.id), `Duplicate cue ID: ${cue.id}`);
    seenIds.add(cue.id);
    assert.strictEqual(cue.channel, 'haptic', 'Every demo cue must belong to haptic channel');
    assert.ok(cue.targetTimestampMs >= 0 && cue.targetTimestampMs <= 12000, 'Timestamp within 12s track');
    assert.ok(cue.payload.pattern, 'Pattern must be defined');
    assert.ok(cue.payload.weight >= 0 && cue.payload.weight <= 1.0, 'Weight between 0 and 1');
  }

  // Downbeat kick verification at 0ms, 1000ms, 2000ms
  const kick0 = DEMO_TRACK_HAPTIC_CUES.find((c) => c.targetTimestampMs === 0);
  const kick1000 = DEMO_TRACK_HAPTIC_CUES.find((c) => c.targetTimestampMs === 1000);
  const snare500 = DEMO_TRACK_HAPTIC_CUES.find((c) => c.targetTimestampMs === 500);

  assert.strictEqual(kick0.payload.pattern, 'heavy');
  assert.strictEqual(kick1000.payload.pattern, 'heavy');
  assert.strictEqual(snare500.payload.pattern, 'medium');

  // Test scheduleDemoTrackHaptics helper at start of track (position 0ms)
  scheduler.clear();
  mockClock.setTime(0);
  scheduleDemoTrackHaptics(scheduler, 5);
  assert.strictEqual(scheduler.getPendingEventCount(), DEMO_TRACK_HAPTIC_CUES.length);
  console.log(`  ✓ Demo score verified: ${DEMO_TRACK_HAPTIC_CUES.length} cues scheduled with downbeats and snares`);

  // --- Test 9: Engine Disposal ---
  console.log('Test 9: Engine Disposal');
  engine.dispose();
  assert.strictEqual(engine.getState().totalVibrationsTriggered, 0);
  assert.strictEqual(engine.getState().totalVibrationsThrottled, 0);
  console.log('  ✓ Engine dispose() cleanly releases subscriptions and state');

  // --- Test 10: Preview Controls vs Master Settings & Queue Integrity ---
  console.log('Test 10: Preview Controls vs Master Settings & Queue Integrity');
  const testEngine = new ExpoHapticEngine({ enabled: true }, mockDriver);
  mockDriver.clear();
  scheduler.clear();
  mockClock.setTime(500);

  // 1. Preview button does not bypass master disabled setting
  testEngine.setEnabled(false);
  const previewDisabled = await testEngine.trigger('heavy');
  assert.strictEqual(previewDisabled, false, 'Preview button must not bypass disabled master setting');
  assert.strictEqual(mockDriver.impactCalls.length, 0);

  // 2. Preview button does not pollute or mutate scheduler event queue
  testEngine.setEnabled(true);
  const queueBefore = scheduler.getPendingEventCount();
  const revBefore = mockClock.getClock().timelineRevision;
  await delay(45);
  const previewEnabled = await testEngine.trigger('heavy');
  assert.strictEqual(previewEnabled, true, 'Preview button triggers vibration when enabled');
  assert.strictEqual(mockDriver.impactCalls.length, 1);
  assert.strictEqual(scheduler.getPendingEventCount(), queueBefore, 'Preview trigger must not mutate scheduler queue');
  assert.strictEqual(mockClock.getClock().timelineRevision, revBefore, 'Preview trigger must not change timelineRevision');
  testEngine.dispose();
  console.log('  ✓ Direct preview controls respect master enable setting and preserve scheduler queue integrity');

  console.log('\n================================================================');
  console.log('🎉 ALL 10 HAPTIC ENGINE VERIFICATION TESTS PASSED!');
  console.log('================================================================');
}

runHapticTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
