/**
 * Automated Verification Suite for Master Synchronization Engine & Event Scheduler (Milestone 3)
 *
 * Uses deterministic injectable clocks for reproducible, non-flaky testing of:
 * 1. Event ordering (strictly chronological dispatch)
 * 2. Duplicate prevention (zero repeat firings)
 * 3. Event cancellation
 * 4. Look-ahead window scheduling
 * 5. Timeline revision invalidation (dropping outdated cues)
 * 6. Seeking during pending events
 * 7. Pausing and resuming lifecycle
 * 8. Track transitions & queue resets
 * 9. Track completion boundaries
 * 10. Latency compensation calculations (audio, haptics, visuals)
 * 11. Multiple consumers & channel subscriptions
 * 12. Scheduler disposal & lifecycle cleanup
 */

const assert = require('assert');
const babel = require('@babel/core');
const vm = require('vm');

// 1. Transpile production source files
function transpile(filePath) {
  return babel.transformFileSync(filePath, {
    presets: ['babel-preset-expo'],
    filename: filePath,
  }).code;
}

const latencyManagerCode = transpile('src/engines/synchronization/LatencyManager.ts');
const schedulerCode = transpile('src/engines/event-scheduler/PriorityEventScheduler.ts');

// 2. Set up isolated test execution sandbox
const sandbox = {
  require: (id) => {
    if (id.startsWith('@/types') || id.endsWith('types')) return {};
    if (id.includes('synchronization')) return exportedSync;
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

// Load LatencyManager
vm.runInContext(latencyManagerCode, sandbox);
const { LatencyManager, DEFAULT_LATENCY_OFFSETS } = sandbox.exports;

// Expose sync module for scheduler import
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

// Load PriorityEventScheduler
sandbox.exports = {};
sandbox.module = { exports: {} };
vm.runInContext(schedulerCode, sandbox);
const { PriorityEventScheduler } = sandbox.exports;

assert.ok(LatencyManager, 'LatencyManager should be exported');
assert.ok(PriorityEventScheduler, 'PriorityEventScheduler should be exported');

// 3. Deterministic Mock Master Clock
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

  // Deterministic control helpers
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

async function runTests() {
  console.log('🧪 Starting Milestone 3 Synchronization & Scheduling Verification Suite...\n');

  // --- Test 1: Latency Compensation Calculations ---
  console.log('Test 1: Latency Compensation Calculations');
  const latency = new LatencyManager({
    audioOffsetMs: 0,
    hapticOffsetMs: 25,
    visualOffsetMs: 16,
    lyricsOffsetMs: 0,
  });

  // Target: 5000ms drum beat.
  // Haptic output delay: 25ms. Audio delay: 0ms. Lead time = 25ms.
  // Trigger must occur at 5000 - 25 = 4975ms.
  const hapticTrigger = latency.computeTriggerTimestamp(5000, 'haptic');
  assert.strictEqual(hapticTrigger, 4975, 'Haptic trigger must fire 25ms early for 25ms motor spin-up');

  // Visual frame delay: 16ms. Lead time = 16ms.
  const visualTrigger = latency.computeTriggerTimestamp(5000, 'visual');
  assert.strictEqual(visualTrigger, 4984, 'Visual trigger must fire 16ms early for 60Hz frame render');

  // Audio channel with Bluetooth buffer delay of 120ms
  latency.setOffsets({ audioOffsetMs: 120 });
  // Perceived audio delay = 120ms. Haptic delay = 25ms. Lead time = 25 - 120 = -95ms.
  // Trigger must occur at 5000 - (-95) = 5095ms.
  const btHapticTrigger = latency.computeTriggerTimestamp(5000, 'haptic');
  assert.strictEqual(btHapticTrigger, 5095, 'With 120ms BT delay, haptic triggers at 5095ms to match delayed acoustic output');

  // Clamping at zero: target at 10ms with 25ms haptic delay
  latency.setOffsets({ audioOffsetMs: 0 });
  const clampedTrigger = latency.computeTriggerTimestamp(10, 'haptic');
  assert.strictEqual(clampedTrigger, 0, 'Trigger timestamp must be clamped to 0ms (no negative triggers)');
  console.log('  ✓ Latency compensation formulas and sign conventions verified for all channels');

  // --- Test 2: Chronological Event Ordering ---
  console.log('Test 2: Chronological Event Ordering');
  const mockClock = new MockMasterClock();
  const latencyZero = new LatencyManager({ audioOffsetMs: 0, hapticOffsetMs: 0, visualOffsetMs: 0, lyricsOffsetMs: 0 });
  const scheduler = new PriorityEventScheduler({ lookAheadWindowMs: 100 }, mockClock, latencyZero);

  // Submit out-of-order events within the 100ms lookahead window [200ms, 300ms]
  scheduler.scheduleBatch([
    { id: 'cue-3', targetTimestampMs: 250, type: 'beat', channel: 'visual', payload: {} },
    { id: 'cue-1', targetTimestampMs: 200, type: 'beat', channel: 'haptic', payload: {} },
    { id: 'cue-4', targetTimestampMs: 280, type: 'beat', channel: 'visual', payload: {} },
    { id: 'cue-2', targetTimestampMs: 220, type: 'beat', channel: 'lyrics', payload: {} },
  ]);

  // Tick at 200ms with 100ms lookahead window covering up to 200 + 100 = 300ms
  const dispatchedOrder = scheduler.tick(200, 1000);
  assert.strictEqual(dispatchedOrder.length, 4);
  assert.strictEqual(dispatchedOrder[0].id, 'cue-1', 'First dispatched must be cue-1 (200ms)');
  assert.strictEqual(dispatchedOrder[1].id, 'cue-2', 'Second dispatched must be cue-2 (220ms)');
  assert.strictEqual(dispatchedOrder[2].id, 'cue-3', 'Third dispatched must be cue-3 (250ms)');
  assert.strictEqual(dispatchedOrder[3].id, 'cue-4', 'Fourth dispatched must be cue-4 (280ms)');
  console.log('  ✓ Events submitted out-of-order dispatched in strictly sorted chronological order');

  // --- Test 3: Duplicate Prevention ---
  console.log('Test 3: Duplicate Prevention');
  // Re-ticking at the same or higher position must not re-fire already dispatched events
  const duplicateTick = scheduler.tick(200, 1010);
  assert.strictEqual(duplicateTick.length, 0, 'No duplicate events should fire on repeat ticks');
  console.log('  ✓ Duplicate prevention verified: 0 re-dispatches');

  // --- Test 4: Event Cancellation ---
  console.log('Test 4: Event Cancellation');
  scheduler.clear();
  scheduler.schedule({ id: 'cancel-me', targetTimestampMs: 600, type: 'beat', channel: 'haptic', payload: {} });
  assert.strictEqual(scheduler.getPendingEventCount(), 1);

  const cancelled = scheduler.cancel('cancel-me');
  assert.strictEqual(cancelled, true, 'cancel() should return true for existing event');
  assert.strictEqual(scheduler.getPendingEventCount(), 0, 'Queue should be empty after cancellation');

  const dispatchedAfterCancel = scheduler.tick(700, 1100);
  assert.strictEqual(dispatchedAfterCancel.length, 0, 'Cancelled event must never dispatch');
  console.log('  ✓ Event successfully cancelled and confirmed not dispatched');

  // --- Test 5: Look-Ahead Window Scheduling ---
  console.log('Test 5: Look-Ahead Window Scheduling');
  scheduler.clear();
  // Configured look-ahead window = 100ms
  scheduler.scheduleBatch([
    { id: 'near-cue', targetTimestampMs: 250, type: 'beat', channel: 'haptic', payload: {} },
    { id: 'far-cue', targetTimestampMs: 450, type: 'beat', channel: 'haptic', payload: {} },
  ]);

  // Player at 180ms. Look-ahead horizon = 180 + 100 = 280ms.
  // 'near-cue' (250ms) <= 280ms -> DISPATCH
  // 'far-cue' (450ms) > 280ms -> REMAIN PENDING
  const tick180 = scheduler.tick(180, 1200);
  assert.strictEqual(tick180.length, 1);
  assert.strictEqual(tick180[0].id, 'near-cue');
  assert.strictEqual(scheduler.getPendingEventCount(), 1, 'Far cue must remain in pending queue');

  // Player advances to 360ms. Horizon = 360 + 100 = 460ms.
  // 'far-cue' (450ms) <= 460ms -> DISPATCH
  const tick360 = scheduler.tick(360, 1300);
  assert.strictEqual(tick360.length, 1);
  assert.strictEqual(tick360[0].id, 'far-cue');
  assert.strictEqual(scheduler.getPendingEventCount(), 0);
  console.log('  ✓ Look-ahead window (100ms) correctly throttles near vs far events');

  // --- Test 6: Timeline Revision Invalidation (Seeking) ---
  console.log('Test 6: Timeline Revision Invalidation on Seek');
  scheduler.clear();
  mockClock.setRevision(1);

  scheduler.scheduleBatch([
    { id: 'rev1-cue1', targetTimestampMs: 1000, type: 'beat', channel: 'haptic', payload: {} },
    { id: 'rev1-cue2', targetTimestampMs: 2000, type: 'beat', channel: 'visual', payload: {} },
  ]);

  // User seeks forward to 3180ms: revision increments to 2
  mockClock.setRevision(2);
  mockClock.setTime(3180);

  // New events scheduled for revision 2 timeline
  scheduler.scheduleBatch([
    { id: 'rev2-cue1', targetTimestampMs: 3200, type: 'beat', channel: 'haptic', payload: {} },
  ]);

  const tickAfterSeek = scheduler.tick(3180, 1400);
  assert.strictEqual(tickAfterSeek.length, 1, 'Only revision 2 events must fire');
  assert.strictEqual(tickAfterSeek[0].id, 'rev2-cue1');
  assert.strictEqual(scheduler.getPendingEventCount(), 0, 'Outdated revision 1 cues must be discarded');
  console.log('  ✓ Revision change instantly dropped outdated cues and preserved new timeline cues');

  // --- Test 7: Paused & Buffering Clock Behavior ---
  console.log('Test 7: Paused & Buffering Clock Behavior');
  scheduler.clear();
  mockClock.setTime(450);
  mockClock.setStatus('paused');
  scheduler.schedule({ id: 'pause-test', targetTimestampMs: 500, type: 'beat', channel: 'haptic', payload: {} });

  // When clock status is 'paused' and tick() runs without override
  const tickPaused = scheduler.tick();
  assert.strictEqual(tickPaused.length, 0, 'No events should fire while paused');

  // When clock is buffering
  mockClock.setStatus('playing');
  mockClock.setBuffering(true);
  const tickBuffering = scheduler.tick();
  assert.strictEqual(tickBuffering.length, 0, 'No events should fire while buffering');

  // Resume playing with buffering cleared
  mockClock.setBuffering(false);
  const tickResumed = scheduler.tick();
  assert.strictEqual(tickResumed.length, 1, 'Event fires cleanly when resumed and not buffering');
  assert.strictEqual(tickResumed[0].id, 'pause-test');
  console.log('  ✓ Event dispatch strictly freezes while paused or buffering, and resumes without loss');

  // --- Test 8: Track Completion Boundaries ---
  console.log('Test 8: Track Completion Boundaries');
  scheduler.clear();
  mockClock.clock.durationMs = 12000;
  mockClock.setTime(12000); // Track finished
  mockClock.setStatus('stopped');

  scheduler.schedule({ id: 'post-track-cue', targetTimestampMs: 12500, type: 'beat', channel: 'haptic', payload: {} });
  const tickCompleted = scheduler.tick();
  assert.strictEqual(tickCompleted.length, 0, 'No events should fire past track completion');
  console.log('  ✓ Events beyond duration never fire after track completion');

  // --- Test 9: Multiple Consumers & Channel Filtering ---
  console.log('Test 9: Multiple Consumers & Channel Filtering');
  scheduler.clear();
  mockClock.setStatus('playing');
  mockClock.setTime(0);

  const hapticConsumerA = [];
  const hapticConsumerB = [];
  const visualConsumer = [];
  const globalConsumer = [];

  const unsubHapticA = scheduler.subscribe('haptic', (e) => hapticConsumerA.push(e.id));
  const unsubHapticB = scheduler.subscribe('haptic', (e) => hapticConsumerB.push(e.id));
  const unsubVisual = scheduler.subscribe('visual', (e) => visualConsumer.push(e.id));
  const unsubGlobal = scheduler.subscribeAll((e) => globalConsumer.push(e.id));

  scheduler.scheduleBatch([
    { id: 'haptic-beat-1', targetTimestampMs: 100, type: 'beat', channel: 'haptic', payload: { intensity: 0.8 } },
    { id: 'visual-beat-1', targetTimestampMs: 100, type: 'pulse', channel: 'visual', payload: { band: 'sub' } },
  ]);

  scheduler.tick(100, 2000);

  // Both haptic consumers received haptic event
  assert.deepStrictEqual(hapticConsumerA, ['haptic-beat-1']);
  assert.deepStrictEqual(hapticConsumerB, ['haptic-beat-1']);

  // Visual consumer only received visual event
  assert.deepStrictEqual(visualConsumer, ['visual-beat-1']);

  // Global consumer received both
  assert.deepStrictEqual(globalConsumer, ['haptic-beat-1', 'visual-beat-1']);

  // Test unsubscribe
  unsubHapticA();
  scheduler.schedule({ id: 'haptic-beat-2', targetTimestampMs: 300, type: 'beat', channel: 'haptic', payload: {} });
  scheduler.tick(300, 2100);

  assert.deepStrictEqual(hapticConsumerA, ['haptic-beat-1'], 'Consumer A unsubscribed, must not receive second event');
  assert.deepStrictEqual(hapticConsumerB, ['haptic-beat-1', 'haptic-beat-2'], 'Consumer B still subscribed');
  console.log('  ✓ Multi-consumer fan-out, channel isolation, and unsubscription verified');

  // --- Test 10: Scheduler Disposal & Lifecycle Cleanup ---
  console.log('Test 10: Scheduler Lifecycle Cleanup & Disposal');
  scheduler.schedule({ id: 'pending-cue', targetTimestampMs: 9000, type: 'beat', channel: 'haptic', payload: {} });
  assert.strictEqual(scheduler.getPendingEventCount(), 1);

  scheduler.dispose();
  assert.strictEqual(scheduler.getPendingEventCount(), 0, 'Disposal must clear queue');
  assert.strictEqual(scheduler.tick(9500).length, 0, 'Disposed scheduler must not dispatch events');
  console.log('  ✓ Scheduler dispose() completely releases queues, timers, and listeners');

  // --- Test 11: Late-Event Handling Policy & Staleness Dropping ---
  console.log('Test 11: Late-Event Handling Policy & Staleness Dropping');
  const lateClock = new MockMasterClock();
  lateClock.setStatus('playing');
  lateClock.setTime(1000); // Playback position at 1000ms
  const lateScheduler = new PriorityEventScheduler(
    { lookAheadWindowMs: 80, maxLatenessToleranceMs: 50 },
    lateClock,
    latencyZero
  );

  // 1. Manually queue events before tick to test lateness evaluation during tick
  // Event A: target at 970ms (30ms in the past -> within 50ms tolerance -> DISPATCH)
  // Event B: target at 920ms (80ms in the past -> older than 50ms tolerance -> DROP AS STALE)
  // We pause clock briefly to schedule without upfront discard, then set to 1000ms
  lateClock.setStatus('paused');
  lateClock.setTime(0);
  lateScheduler.scheduleBatch([
    { id: 'timely-late-cue', targetTimestampMs: 970, type: 'beat', channel: 'haptic', payload: {} },
    { id: 'stale-cue', targetTimestampMs: 920, type: 'beat', channel: 'haptic', payload: {} },
    { id: 'future-cue', targetTimestampMs: 1040, type: 'beat', channel: 'haptic', payload: {} },
  ]);

  lateClock.setStatus('playing');
  lateClock.setTime(1000); // Now jump to 1000ms

  // Tick at 1000ms
  const lateDispatched = lateScheduler.tick(1000, 3000);

  // 'timely-late-cue' (970ms >= 1000 - 50 = 950ms) -> DISPATCH
  // 'future-cue' (1040ms <= 1000 + 80 = 1080ms) -> DISPATCH
  // 'stale-cue' (920ms < 950ms) -> DROPPED AS STALE
  assert.strictEqual(lateDispatched.length, 2, 'Must dispatch exactly timely-late-cue and future-cue');
  assert.strictEqual(lateDispatched[0].id, 'timely-late-cue');
  assert.strictEqual(lateDispatched[1].id, 'future-cue');
  assert.strictEqual(lateScheduler.getPendingEventCount(), 0, 'Stale cue must be dropped and removed');

  // 2. Upfront schedule discard when already playing and stale
  lateScheduler.schedule({ id: 'immediate-stale', targetTimestampMs: 800, type: 'beat', channel: 'haptic', payload: {} });
  assert.strictEqual(
    lateScheduler.getPendingEventCount(),
    0,
    'Upfront schedule of stale cue (>50ms in the past while playing) must be discarded immediately'
  );
  lateScheduler.dispose();
  console.log('  ✓ Late-event policy verified: events within 50ms tolerance dispatched; stale events dropped');

  // --- Test 12: Clamped Latency Lead Time Staleness ---
  console.log('Test 12: Clamped Latency Lead Time Staleness');
  const clampedLatency = new LatencyManager({ audioOffsetMs: 0, hapticOffsetMs: 50 });
  const clampedClock = new MockMasterClock();
  clampedClock.setStatus('playing');
  const clampedScheduler = new PriorityEventScheduler(
    { lookAheadWindowMs: 80, maxLatenessToleranceMs: 50 },
    clampedClock,
    clampedLatency
  );

  // Target at 20ms with 50ms haptic lead time -> clamped to 0ms trigger
  // If current position is 100ms (100 - 50 = 50ms min threshold), trigger at 0ms is stale
  clampedClock.setTime(100);
  clampedScheduler.schedule({ id: 'clamped-stale', targetTimestampMs: 20, channel: 'haptic', type: 'beat', payload: {} });
  assert.strictEqual(clampedScheduler.getPendingEventCount(), 0, 'Clamped 0ms trigger is stale at position 100ms');

  // If current position is 30ms (30 - 50 = -20ms min threshold), trigger at 0ms is within tolerance
  clampedClock.setTime(30);
  clampedScheduler.schedule({ id: 'clamped-fresh', targetTimestampMs: 20, channel: 'haptic', type: 'beat', payload: {} });
  assert.strictEqual(clampedScheduler.getPendingEventCount(), 1, 'Clamped 0ms trigger is within tolerance at position 30ms');
  const clampedDispatched = clampedScheduler.tick(30, 4000);
  assert.strictEqual(clampedDispatched.length, 1);
  assert.strictEqual(clampedDispatched[0].id, 'clamped-fresh');
  clampedScheduler.dispose();
  console.log('  ✓ Zero-clamped latency triggers correctly evaluated against lateness threshold');

  console.log('\n================================================================');
  console.log('🎉 ALL 12 SYNCHRONIZATION & EVENT SCHEDULER TESTS PASSED!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
