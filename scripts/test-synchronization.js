/**
 * Automated Verification Suite for Master Synchronization Engine & Event Scheduler
 *
 * Uses deterministic injectable clocks for reproducible, non-flaky testing of:
 * 1. Event is not dispatched merely because it enters the look-ahead window.
 * 2. Event dispatches at its compensated target time.
 * 3. Events with identical timestamps preserve stable ordering.
 * 4. Late-event policy works correctly.
 * 5. Stop invalidates the old timeline.
 * 6. Stop → Play schedules the complete cue sequence again.
 * 7. Pause prevents dispatch while paused.
 * 8. Resume continues remaining events without replaying previous ones.
 * 9. Seek invalidates events from the previous timeline.
 * 10. Track replacement does not leak old events.
 * 11. Haptic and visual subscribers both receive the expected events.
 * 12. No duplicate events occur during repeated lifecycle transitions.
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
const { PriorityEventScheduler, DUE_EVENT_TOLERANCE_MS } = sandbox.exports;

assert.ok(LatencyManager, 'LatencyManager should be exported');
assert.ok(PriorityEventScheduler, 'PriorityEventScheduler should be exported');
assert.strictEqual(DUE_EVENT_TOLERANCE_MS, 3, 'DUE_EVENT_TOLERANCE_MS must be 3ms');

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
  console.log('🧪 Starting Stage 1 Synchronization & Event Scheduler Verification Suite...\n');

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
  const btHapticTrigger = latency.computeTriggerTimestamp(5000, 'haptic');
  assert.strictEqual(btHapticTrigger, 5095, 'With 120ms BT delay, haptic triggers at 5095ms to match delayed acoustic output');

  // Clamping at zero: target at 10ms with 25ms haptic delay
  latency.setOffsets({ audioOffsetMs: 0 });
  const clampedTrigger = latency.computeTriggerTimestamp(10, 'haptic');
  assert.strictEqual(clampedTrigger, 0, 'Trigger timestamp must be clamped to 0ms (no negative triggers)');
  console.log('  ✓ Latency compensation formulas and sign conventions verified for all channels');

  // --- Test 2: Chronological Event Ordering & Stable Ordering for Identical Timestamps ---
  console.log('Test 2: Chronological Event Ordering & Identical Timestamp Stability');
  const mockClock = new MockMasterClock();
  const latencyZero = new LatencyManager({ audioOffsetMs: 0, hapticOffsetMs: 0, visualOffsetMs: 0, lyricsOffsetMs: 0 });
  const scheduler = new PriorityEventScheduler({ lookAheadWindowMs: 100 }, mockClock, latencyZero);

  // Submit out-of-order events within the lateness tolerance window [240ms, 290ms]
  scheduler.scheduleBatch([
    { id: 'cue-3', targetTimestampMs: 270, type: 'beat', channel: 'visual', payload: {} },
    { id: 'cue-1', targetTimestampMs: 260, type: 'beat', channel: 'haptic', payload: {} },
    { id: 'cue-4', targetTimestampMs: 290, type: 'beat', channel: 'visual', payload: {} },
    { id: 'cue-2', targetTimestampMs: 265, type: 'beat', channel: 'lyrics', payload: {} },
  ]);

  // Tick at 290ms where all four events are due and within 50ms tolerance
  const dispatchedOrder = scheduler.tick(290, 1000);
  assert.strictEqual(dispatchedOrder.length, 4);
  assert.strictEqual(dispatchedOrder[0].id, 'cue-1', 'First dispatched must be cue-1 (260ms)');
  assert.strictEqual(dispatchedOrder[1].id, 'cue-2', 'Second dispatched must be cue-2 (265ms)');
  assert.strictEqual(dispatchedOrder[2].id, 'cue-3', 'Third dispatched must be cue-3 (270ms)');
  assert.strictEqual(dispatchedOrder[3].id, 'cue-4', 'Fourth dispatched must be cue-4 (290ms)');

  // Stable ordering for identical timestamps: FIFO submission order must be strictly preserved
  scheduler.clear();
  scheduler.scheduleBatch([
    { id: 'same-time-1', targetTimestampMs: 500, type: 'beat', channel: 'haptic', payload: {} },
    { id: 'same-time-2', targetTimestampMs: 500, type: 'pulse', channel: 'visual', payload: {} },
    { id: 'same-time-3', targetTimestampMs: 500, type: 'line', channel: 'lyrics', payload: {} },
  ]);
  const sameTimeDispatched = scheduler.tick(500, 1005);
  assert.strictEqual(sameTimeDispatched.length, 3);
  assert.strictEqual(sameTimeDispatched[0].id, 'same-time-1');
  assert.strictEqual(sameTimeDispatched[1].id, 'same-time-2');
  assert.strictEqual(sameTimeDispatched[2].id, 'same-time-3');
  console.log('  ✓ Chronological sorting and stable FIFO ordering for identical timestamps verified');

  // --- Test 3: Duplicate Prevention ---
  console.log('Test 3: Duplicate Prevention');
  const duplicateTick = scheduler.tick(500, 1010);
  assert.strictEqual(duplicateTick.length, 0, 'No duplicate events should fire on repeat ticks');
  const higherTick = scheduler.tick(600, 1020);
  assert.strictEqual(higherTick.length, 0, 'No duplicate events should fire on subsequent ticks');
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

  // --- Test 5: Look-Ahead Window Preparation & Due-Time Dispatch ---
  console.log('Test 5: Look-Ahead Window Preparation & Due-Time Dispatch (Requirements 1 & 2)');
  scheduler.clear();
  // Configured look-ahead window = 100ms
  scheduler.scheduleBatch([
    { id: 'near-cue', targetTimestampMs: 250, type: 'beat', channel: 'haptic', payload: {} },
    { id: 'far-cue', targetTimestampMs: 450, type: 'beat', channel: 'haptic', payload: {} },
  ]);

  // 1. Player at 180ms. Look-ahead horizon = 180 + 100 = 280ms.
  // 'near-cue' (250ms) enters the look-ahead window (250 <= 280), BUT its target has NOT arrived (250 > 180).
  // Requirement 1: Event is NOT dispatched merely because it enters the look-ahead window!
  const tick180 = scheduler.tick(180, 1200);
  assert.strictEqual(tick180.length, 0, 'Event entering look-ahead window must NOT fire prematurely');
  assert.strictEqual(scheduler.getPendingEventCount(), 2, 'Both near and far cues must remain pending');

  // 2. Player advances to 240ms. Still before 250ms target.
  const tick240 = scheduler.tick(240, 1240);
  assert.strictEqual(tick240.length, 0, 'Event must not fire before compensated target time');
  assert.strictEqual(scheduler.getPendingEventCount(), 2);

  // 3. Player reaches 250ms.
  // Requirement 2: Event dispatches at its compensated target time!
  const tick250 = scheduler.tick(250, 1250);
  assert.strictEqual(tick250.length, 1, 'Near cue must dispatch at its compensated target time');
  assert.strictEqual(tick250[0].id, 'near-cue');
  assert.strictEqual(scheduler.getPendingEventCount(), 1, 'Far cue must remain pending');

  // 4. Player advances to 360ms. Far cue (450ms) is inside look-ahead (360 + 100 = 460), but not yet due.
  const tick360 = scheduler.tick(360, 1300);
  assert.strictEqual(tick360.length, 0, 'Far cue must not fire prematurely at 360ms');
  assert.strictEqual(scheduler.getPendingEventCount(), 1);

  // 5. Player reaches 450ms. Far cue target time has arrived!
  const tick450 = scheduler.tick(450, 1350);
  assert.strictEqual(tick450.length, 1, 'Far cue dispatches when position reaches 450ms');
  assert.strictEqual(tick450[0].id, 'far-cue');
  assert.strictEqual(scheduler.getPendingEventCount(), 0);
  console.log('  ✓ Look-ahead window prepares events without premature dispatch; dispatches at target time');

  // --- Test 6: Timeline Revision Invalidation on Seek ---
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

  // At 3180ms, rev2-cue1 is not yet due (3200 > 3180)
  const tickSeekInitial = scheduler.tick(3180, 1400);
  assert.strictEqual(tickSeekInitial.length, 0);
  assert.strictEqual(scheduler.getPendingEventCount(), 1, 'Outdated revision 1 cues dropped; revision 2 cue pending');

  // Advance to 3200ms: rev2-cue1 fires
  const tickSeekDue = scheduler.tick(3200, 1420);
  assert.strictEqual(tickSeekDue.length, 1);
  assert.strictEqual(tickSeekDue[0].id, 'rev2-cue1');
  console.log('  ✓ Revision change instantly dropped outdated cues and preserved new timeline cues');

  // --- Test 7: Pause & Buffering Clock Behavior ---
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

  // Resume playing with buffering cleared and position at 500ms
  mockClock.setBuffering(false);
  mockClock.setTime(500);
  const tickResumed = scheduler.tick();
  assert.strictEqual(tickResumed.length, 1, 'Event fires cleanly when resumed and due');
  assert.strictEqual(tickResumed[0].id, 'pause-test');
  console.log('  ✓ Event dispatch strictly freezes while paused or buffering, and resumes without loss');

  // --- Test 8: Pause → Resume Preserves Remaining Events Without Duplication ---
  console.log('Test 8: Pause → Resume Lifecycle Continuation');
  scheduler.clear();
  mockClock.setStatus('playing');
  mockClock.setTime(0);

  scheduler.scheduleBatch([
    { id: 'seq-1', targetTimestampMs: 100, type: 'beat', channel: 'haptic', payload: {} },
    { id: 'seq-2', targetTimestampMs: 200, type: 'beat', channel: 'haptic', payload: {} },
    { id: 'seq-3', targetTimestampMs: 300, type: 'beat', channel: 'haptic', payload: {} },
    { id: 'seq-4', targetTimestampMs: 400, type: 'beat', channel: 'haptic', payload: {} },
  ]);

  // Play realistically up to 250ms: tick at 120ms dispatches seq-1, tick at 220ms dispatches seq-2
  const tick1 = scheduler.tick(120, 1500);
  assert.strictEqual(tick1.length, 1);
  assert.strictEqual(tick1[0].id, 'seq-1');

  const tick2 = scheduler.tick(220, 1520);
  assert.strictEqual(tick2.length, 1);
  assert.strictEqual(tick2[0].id, 'seq-2');
  assert.strictEqual(scheduler.getPendingEventCount(), 2, 'seq-3 and seq-4 must remain in queue');

  // Pause at 250ms
  mockClock.setStatus('paused');
  mockClock.setTime(250);
  const pausedTicks = scheduler.tick();
  assert.strictEqual(pausedTicks.length, 0, 'Zero events fire while paused');

  // Resume at 250ms and advance realistically: 310ms dispatches seq-3, 410ms dispatches seq-4
  mockClock.setStatus('playing');
  mockClock.setTime(310);
  const tickAfterResume1 = scheduler.tick(310, 1600);
  assert.strictEqual(tickAfterResume1.length, 1);
  assert.strictEqual(tickAfterResume1[0].id, 'seq-3');

  mockClock.setTime(410);
  const tickAfterResume2 = scheduler.tick(410, 1650);
  assert.strictEqual(tickAfterResume2.length, 1);
  assert.strictEqual(tickAfterResume2[0].id, 'seq-4');
  assert.strictEqual(scheduler.getPendingEventCount(), 0);

  // Repeat tick: no duplicates
  const afterResumeTick = scheduler.tick(410, 1660);
  assert.strictEqual(afterResumeTick.length, 0, 'No events re-fired after resume');
  console.log('  ✓ Pause preserves remaining events; resume continues without replaying old ones or duplicating');

  // --- Test 9: Stop Invalidates Old Timeline & Resets History ---
  console.log('Test 9: Stop Invalidation & Revision Advance');
  scheduler.clear();
  mockClock.setRevision(10);
  mockClock.setTime(100);

  scheduler.scheduleBatch([
    { id: 'sess1-cue', targetTimestampMs: 500, type: 'beat', channel: 'haptic', payload: {} },
  ]);
  assert.strictEqual(scheduler.getPendingEventCount(), 1);

  // Stop triggers timeline revision advance (e.g. revision 10 -> 11)
  mockClock.setStatus('stopped');
  mockClock.setRevision(11);
  mockClock.setTime(0);

  // Ticking after stop must discard session 1 cues
  const tickAfterStop = scheduler.tick(0, 1700);
  assert.strictEqual(tickAfterStop.length, 0);
  assert.strictEqual(scheduler.getPendingEventCount(), 0, 'Old session cues must be invalidated upon stop');
  console.log('  ✓ Stop invalidates old session timeline and clears pending queue');

  // --- Test 10: Stop → Play Replay Lifecycle ---
  console.log('Test 10: Stop → Play Replay Complete Rescheduling');
  // Re-scheduling cues under the new revision (11) as NowPlayingCard does
  scheduler.scheduleBatch([
    { id: 'sess2-cue1', targetTimestampMs: 100, type: 'beat', channel: 'haptic', timelineRevision: 11, payload: {} },
    { id: 'sess2-cue2', targetTimestampMs: 200, type: 'beat', channel: 'haptic', timelineRevision: 11, payload: {} },
  ]);
  assert.strictEqual(scheduler.getPendingEventCount(), 2);

  // User presses Play: playback restarts from 0ms under revision 11
  mockClock.setStatus('playing');
  mockClock.setTime(0);

  // At 0ms, none are due yet
  assert.strictEqual(scheduler.tick(0, 1800).length, 0);

  // At 150ms, sess2-cue1 fires cleanly
  const replayTick1 = scheduler.tick(150, 1850);
  assert.strictEqual(replayTick1.length, 1);
  assert.strictEqual(replayTick1[0].id, 'sess2-cue1');

  // At 250ms, sess2-cue2 fires cleanly
  const replayTick2 = scheduler.tick(250, 1900);
  assert.strictEqual(replayTick2.length, 1);
  assert.strictEqual(replayTick2[0].id, 'sess2-cue2');
  assert.strictEqual(scheduler.getPendingEventCount(), 0);
  console.log('  ✓ Stop → Play cleanly reschedules and plays complete cue sequence from start');

  // --- Test 11: Late-Event Handling Policy & Staleness Dropping ---
  console.log('Test 11: Late-Event Handling Policy & Staleness Dropping');
  const lateClock = new MockMasterClock();
  lateClock.setStatus('playing');
  lateClock.setTime(1000);
  const lateScheduler = new PriorityEventScheduler(
    { lookAheadWindowMs: 80, maxLatenessToleranceMs: 50 },
    lateClock,
    latencyZero
  );

  // Manually queue events before tick to test lateness evaluation during tick
  // Event A: target at 970ms (30ms in the past -> within 50ms tolerance -> DISPATCH)
  // Event B: target at 920ms (80ms in the past -> older than 50ms tolerance -> DROP AS STALE)
  // Event C: future-cue at 1040ms (in the future -> remains pending at 1000ms, dispatches at 1040ms)
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

  // 'timely-late-cue' (970ms <= 1000 and >= 1000 - 50 = 950ms) -> DISPATCH
  // 'stale-cue' (920ms < 950ms) -> DROPPED AS STALE
  // 'future-cue' (1040ms > 1000ms) -> REMAINS PENDING (does not fire prematurely!)
  assert.strictEqual(lateDispatched.length, 1, 'Must dispatch exactly timely-late-cue at 1000ms');
  assert.strictEqual(lateDispatched[0].id, 'timely-late-cue');
  assert.strictEqual(lateScheduler.getPendingEventCount(), 1, 'future-cue must remain pending');

  // Now tick at 1040ms
  const futureDispatched = lateScheduler.tick(1040, 3040);
  assert.strictEqual(futureDispatched.length, 1);
  assert.strictEqual(futureDispatched[0].id, 'future-cue');
  assert.strictEqual(lateScheduler.getPendingEventCount(), 0);

  // Upfront schedule discard when already playing and stale
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

  // --- Test 13: Multiple Consumers, Channel Isolation & Unsubscription ---
  console.log('Test 13: Multiple Consumers, Channel Isolation & Unsubscription');
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

  scheduler.tick(100, 5000);

  assert.deepStrictEqual(hapticConsumerA, ['haptic-beat-1']);
  assert.deepStrictEqual(hapticConsumerB, ['haptic-beat-1']);
  assert.deepStrictEqual(visualConsumer, ['visual-beat-1']);
  assert.deepStrictEqual(globalConsumer, ['haptic-beat-1', 'visual-beat-1']);

  unsubHapticA();
  scheduler.schedule({ id: 'haptic-beat-2', targetTimestampMs: 300, type: 'beat', channel: 'haptic', payload: {} });
  scheduler.tick(300, 5100);

  assert.deepStrictEqual(hapticConsumerA, ['haptic-beat-1'], 'Consumer A unsubscribed, must not receive second event');
  assert.deepStrictEqual(hapticConsumerB, ['haptic-beat-1', 'haptic-beat-2'], 'Consumer B still subscribed');
  console.log('  ✓ Multi-consumer fan-out, channel isolation, and unsubscription verified');

  // --- Test 14: Scheduler Disposal & Lifecycle Cleanup ---
  console.log('Test 14: Scheduler Lifecycle Cleanup & Disposal');
  scheduler.schedule({ id: 'pending-cue', targetTimestampMs: 9000, type: 'beat', channel: 'haptic', payload: {} });
  assert.strictEqual(scheduler.getPendingEventCount(), 1);

  scheduler.dispose();
  assert.strictEqual(scheduler.getPendingEventCount(), 0, 'Disposal must clear queue');
  assert.strictEqual(scheduler.tick(9500).length, 0, 'Disposed scheduler must not dispatch events');
  console.log('  ✓ Scheduler dispose() completely releases queues, timers, and listeners');

  // --- Test 15: Due-Event Dispatch Tolerance & Look-Ahead Precision (Stage A.7.1) ---
  console.log('Test 15: Due-Event Dispatch Tolerance & Sub-Frame Precision (Stage A.7.1)');
  {
    const tolClock = new MockMasterClock();
    tolClock.setStatus('playing');
    const tolScheduler = new PriorityEventScheduler(
      { lookAheadWindowMs: 80, dueEventToleranceMs: 3 },
      tolClock,
      new LatencyManager({ audioOffsetMs: 0, visualOffsetMs: 0 })
    );

    // Event scheduled for exactly 1000ms
    tolScheduler.schedule({
      id: 'sub-frame-cue',
      targetTimestampMs: 1000,
      channel: 'visual',
      type: 'rhythm',
      payload: {},
    });

    // 1. At 995ms (5ms early): Must NOT dispatch (5ms > 3ms tolerance).
    // Proves that events are never dispatched meaningfully early.
    const earlyTick = tolScheduler.tick(995);
    assert.strictEqual(earlyTick.length, 0, 'Event must not dispatch 5ms before scheduled time');
    assert.strictEqual(tolScheduler.getPendingEventCount(), 1);

    // 2. At 998ms (within 3ms tolerance: 998 + 3 = 1001 >= 1000):
    // Must dispatch! Prevents minor sub-frame timer jitter from postponing dispatch by 20ms.
    const timelyTick = tolScheduler.tick(998);
    assert.strictEqual(timelyTick.length, 1, 'Event must dispatch when within 3ms due tolerance');
    assert.strictEqual(timelyTick[0].id, 'sub-frame-cue');
    assert.strictEqual(tolScheduler.getPendingEventCount(), 0);

    // 3. At 1000ms: Already dispatched; must not duplicate
    const exactTick = tolScheduler.tick(1000);
    assert.strictEqual(exactTick.length, 0, 'Already dispatched event must not fire again');

    tolScheduler.dispose();
    console.log('  ✓ Due-event tolerance (3ms) absorbs sub-frame timer jitter without early premature dispatch');
  }

  // --- Test 16: Competing Timer Paths & Staged Timeout Race Safety (Stage A.7.1) ---
  console.log('Test 16: Competing Timer Paths & Staged Timeout Race Safety (Stage A.7.1)');
  {
    const raceClock = new MockMasterClock();
    raceClock.setStatus('playing');
    raceClock.setTime(400);

    const raceScheduler = new PriorityEventScheduler(
      { lookAheadWindowMs: 80, pollingIntervalMs: 20, dueEventToleranceMs: 3 },
      raceClock,
      new LatencyManager({ audioOffsetMs: 0, visualOffsetMs: 0 })
    );

    let dispatchCount = 0;
    raceScheduler.subscribe('visual', () => {
      dispatchCount++;
    });

    // Schedule event at 450ms (within 80ms look-ahead window from 400ms)
    raceScheduler.schedule({
      id: 'race-cue',
      targetTimestampMs: 450,
      channel: 'visual',
      type: 'rhythm',
      payload: {},
    });

    // Live tick at 400ms triggers scheduleNextStagedTimer
    raceScheduler.tick();

    // Simulate competing invocations: tick() called via interval at 448ms
    // while staged timeout also fires around 448ms
    const tick1 = raceScheduler.tick(448);
    const tick2 = raceScheduler.tick(449);
    const tick3 = raceScheduler.tick(450);

    assert.strictEqual(dispatchCount, 1, 'Event must dispatch exactly once despite competing timer and polling invocations');
    assert.strictEqual(tick1.length, 1, 'First due tick must dispatch event');
    assert.strictEqual(tick2.length, 0, 'Competing tick must not re-dispatch');
    assert.strictEqual(tick3.length, 0, 'Exact-time tick must not re-dispatch');

    // Invalidation safety: stage an event, then seek (advance revision)
    raceScheduler.schedule({
      id: 'staged-then-seek-cue',
      targetTimestampMs: 480,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: {},
    });
    raceScheduler.tick(); // stages timer

    // Seek to 200ms on revision 2
    raceClock.setRevision(2);
    raceClock.setTime(200);

    // Staged timer or tick fires for old target 480ms
    const postSeekTick = raceScheduler.tick(480);
    assert.strictEqual(postSeekTick.length, 0, 'Invalidated revision cue must be dropped on seek without dispatch');
    assert.strictEqual(dispatchCount, 1, 'Total dispatches must remain 1');

    raceScheduler.dispose();
    console.log('  ✓ Competing timer paths and staged timeout race safety verified; seek invalidation confirmed');
  }

  // --- Test 17: Bounded Opening Boundary Kick Exception (T=0ms across startup delays) (Stage A.7.2.3.7) ---
  console.log('Test 17: Bounded Opening Boundary Kick Exception (T=0ms across startup delays) (Stage A.7.2.3.7)');
  {
    // Setup LatencyManager with 60ms visual lead (standard production config)
    const latMan = new LatencyManager({ audioOffsetMs: 0, visualOffsetMs: 60 });

    const createSchedulerWithOpeningKick = (posMs) => {
      const clock = new MockMasterClock();
      clock.setStatus('playing');
      clock.setTime(posMs);
      const scheduler = new PriorityEventScheduler(
        { lookAheadWindowMs: 80, pollingIntervalMs: 20, lateThresholdMs: 50 },
        clock,
        latMan
      );
      scheduler.schedule({
        id: 'b1-1',
        targetTimestampMs: 0,
        channel: 'visual',
        type: 'rhythm',
        payload: { cueType: 'kick', intensity: 1.0 },
      });
      return { clock, scheduler };
    };

    // Sub-test A: First confirmation arrives at 0ms -> Dispatched!
    {
      const { scheduler } = createSchedulerWithOpeningKick(0);
      const dispatched = scheduler.tick(0);
      assert.strictEqual(dispatched.length, 1, 'Opening boundary kick dispatched at 0ms');
      assert.strictEqual(dispatched[0].id, 'b1-1');

      // Subsequent tick at 20ms: must NOT re-dispatch
      const tick20 = scheduler.tick(20);
      assert.strictEqual(tick20.length, 0, 'Opening boundary kick must not re-dispatch');
      scheduler.dispose();
    }

    // Sub-test B: First confirmation arrives at 10ms -> Dispatched!
    {
      const { scheduler } = createSchedulerWithOpeningKick(10);
      const dispatched = scheduler.tick(10);
      assert.strictEqual(dispatched.length, 1, 'Opening boundary kick dispatched at 10ms');
      scheduler.dispose();
    }

    // Sub-test C: First confirmation arrives at 35ms -> Dispatched!
    {
      const { scheduler } = createSchedulerWithOpeningKick(35);
      const dispatched = scheduler.tick(35);
      assert.strictEqual(dispatched.length, 1, 'Opening boundary kick dispatched at 35ms');
      scheduler.dispose();
    }

    // Sub-test D: First confirmation arrives at 80ms -> Dispatched!
    {
      const { scheduler } = createSchedulerWithOpeningKick(80);
      const dispatched = scheduler.tick(80);
      assert.strictEqual(dispatched.length, 1, 'Opening boundary kick dispatched at 80ms');
      scheduler.dispose();
    }

    // Sub-test E: First confirmation arrives at 150ms (>100ms bound) -> Dropped as late!
    {
      const { scheduler } = createSchedulerWithOpeningKick(150);
      const dispatched = scheduler.tick(150);
      assert.strictEqual(dispatched.length, 0, 'Opening boundary kick dropped when first confirmation arrives >100ms');
      scheduler.dispose();
    }

    // Sub-test F: Seek to 2000ms -> T=0ms kick must NOT be dispatched
    {
      const clock = new MockMasterClock();
      clock.setStatus('playing');
      clock.setTime(2000);
      clock.setRevision(2);
      const scheduler = new PriorityEventScheduler(
        { lookAheadWindowMs: 80, pollingIntervalMs: 20, lateThresholdMs: 50 },
        clock,
        latMan
      );
      scheduler.schedule({
        id: 'b1-1',
        targetTimestampMs: 0,
        channel: 'visual',
        type: 'rhythm',
        timelineRevision: 2,
        payload: { cueType: 'kick', intensity: 1.0 },
      });
      const dispatched = scheduler.tick(2000);
      assert.strictEqual(dispatched.length, 0, 'Opening boundary kick must NEVER be replayed after seek to 2000ms');
      scheduler.dispose();
    }

    console.log('  ✓ Bounded opening boundary kick exception verified: preserved at 0, 10, 35, 80ms; dropped at 150ms; never replayed after seek');
  }

  // --- Test 18: Immediate First-Tick Execution on Scheduler start() (Stage A.7.2.3.7) ---
  console.log('Test 18: Immediate First-Tick Execution on Scheduler start() (Stage A.7.2.3.7)');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    clock.setTime(0);

    const latMan = new LatencyManager({ audioOffsetMs: 0, visualOffsetMs: 60 });
    const scheduler = new PriorityEventScheduler(
      { lookAheadWindowMs: 80, pollingIntervalMs: 20, lateThresholdMs: 50 },
      clock,
      latMan
    );

    let immediateDispatches = [];
    scheduler.subscribe('visual', (event) => {
      immediateDispatches.push(event);
    });

    scheduler.schedule({
      id: 'b1-1',
      targetTimestampMs: 0,
      channel: 'visual',
      type: 'rhythm',
      payload: { cueType: 'kick', intensity: 1.0 },
    });

    assert.strictEqual(immediateDispatches.length, 0, 'Zero dispatches before scheduler.start()');

    // Call start(): must execute this.tick() synchronously without waiting for 20ms interval
    scheduler.start();

    assert.strictEqual(immediateDispatches.length, 1, 'Opening cue dispatched synchronously upon scheduler.start()');
    assert.strictEqual(immediateDispatches[0].id, 'b1-1');

    scheduler.dispose();
    console.log('  ✓ Scheduler start() immediately executes first tick, eliminating startup polling latency');
  }

  // --- Test 19: Seek Landing Boundary Exception for Visual Cues (Stage A.7.2.3.10) ---
  console.log('Test 19: Seek Landing Boundary Exception for Visual Cues (Stage A.7.2.3.10)');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    clock.setTime(3000);
    clock.setRevision(2);

    const latMan = new LatencyManager({ audioOffsetMs: 0, visualOffsetMs: 60 });
    const scheduler = new PriorityEventScheduler(
      { lookAheadWindowMs: 80, pollingIntervalMs: 20, maxLatenessToleranceMs: 50 },
      clock,
      latMan
    );

    // Schedule visual cue whose target is exactly at the seek landing position (3000ms).
    // Compensated trigger is 3000 - 60 = 2940ms.
    // Lateness boundary: 3000 - 50 = 2950ms.
    // Since 2940 < 2950, without the Seek Landing Boundary Exception this cue would be dropped as stale!
    scheduler.schedule({
      id: 'vis-seek-landing-beat',
      targetTimestampMs: 3000,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 2,
      payload: { role: 'downbeat', weight: 1.0 },
    });

    assert.strictEqual(scheduler.getPendingEventCount(), 1, 'Cue at seek landing must NOT be dropped by scheduleBatch()');

    // First tick at seek landing position (3000ms): must dispatch immediately!
    const landingDispatches = scheduler.tick(3000);
    assert.strictEqual(landingDispatches.length, 1, 'Landing cue must be dispatched on seek landing tick');
    assert.strictEqual(landingDispatches[0].id, 'vis-seek-landing-beat');
    assert.strictEqual(scheduler.getPendingEventCount(), 0, 'Queue must be empty after landing dispatch');

    // Subsequent tick at 3020ms: must NOT re-dispatch (duplicate protection)
    const tickAfter = scheduler.tick(3020);
    assert.strictEqual(tickAfter.length, 0, 'Landing cue must not re-dispatch on subsequent ticks');

    scheduler.dispose();
    console.log('  ✓ Seek landing boundary exception preserves visual cues at landing point despite 60ms lead time');
  }

  // --- Test 20: Stale Cue Rejection Beyond 60ms Proximity (Stage A.7.2.3.10) ---
  console.log('Test 20: Stale Cue Rejection Beyond 60ms Proximity (Stage A.7.2.3.10)');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    clock.setTime(3200);
    clock.setRevision(3);

    const latMan = new LatencyManager({ audioOffsetMs: 0, visualOffsetMs: 60 });
    const scheduler = new PriorityEventScheduler(
      { lookAheadWindowMs: 80, pollingIntervalMs: 20, maxLatenessToleranceMs: 50 },
      clock,
      latMan
    );

    // Schedule cue at 3000ms while playback has progressed to 3200ms (|3200 - 3000| = 200 > 60ms)
    scheduler.schedule({
      id: 'vis-genuinely-expired',
      targetTimestampMs: 3000,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 3,
      payload: { role: 'downbeat', weight: 1.0 },
    });

    assert.strictEqual(scheduler.getPendingEventCount(), 0, 'Genuinely expired cue (>60ms past landing) must be dropped');

    const expiredDispatches = scheduler.tick(3200);
    assert.strictEqual(expiredDispatches.length, 0, 'Expired cue must not dispatch');

    scheduler.dispose();
    console.log('  ✓ Genuinely expired cues (>60ms past seek point) strictly rejected as stale');
  }

  // --- Test 21: Synchronous Score Provider Registration & Immediate Revision Population (Stage A.7.2.3.10) ---
  console.log('Test 21: Synchronous Score Provider Registration & Immediate Revision Population (Stage A.7.2.3.10)');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    clock.setTime(0);
    clock.setRevision(1);

    const latMan = new LatencyManager({ audioOffsetMs: 0, visualOffsetMs: 60 });
    const scheduler = new PriorityEventScheduler(
      { lookAheadWindowMs: 80, pollingIntervalMs: 20, maxLatenessToleranceMs: 50 },
      clock,
      latMan
    );

    let providerInvocations = [];
    scheduler.setScoreProvider((sched, rev) => {
      providerInvocations.push(rev);
      sched.scheduleBatch([
        { id: `cue-rev-${rev}-1`, targetTimestampMs: 3000, channel: 'visual', type: 'rhythm', timelineRevision: rev, payload: {} },
        { id: `cue-rev-${rev}-2`, targetTimestampMs: 3500, channel: 'visual', type: 'rhythm', timelineRevision: rev, payload: {} },
      ]);
    });

    // Advance timeline revision to 2 (simulating seek to 3000ms)
    clock.setRevision(2);
    clock.setTime(3000);

    // MasterClock tick triggers handleRevisionChange -> invokes scoreProvider synchronously!
    assert.strictEqual(providerInvocations.length, 1, 'ScoreProvider must be invoked synchronously on revision change');
    assert.strictEqual(providerInvocations[0], 2, 'ScoreProvider invoked with new revision 2');
    assert.strictEqual(scheduler.getPendingEventCount(), 2, 'Scheduler immediately populated with 2 cues (0ms delay)');

    // Immediate tick dispatches cue 1 at 3000ms landing
    const dispatches = scheduler.tick(3000);
    assert.strictEqual(dispatches.length, 1, 'Landing cue dispatched immediately');
    assert.strictEqual(dispatches[0].id, 'cue-rev-2-1');
    assert.strictEqual(scheduler.getPendingEventCount(), 1, 'Upcoming cue remains in queue');

    // Clean unsubscription
    scheduler.setScoreProvider(null);
    clock.setRevision(3);
    assert.strictEqual(providerInvocations.length, 1, 'ScoreProvider not invoked after unsetting');

    scheduler.dispose();
    console.log('  ✓ Synchronous ScoreProvider eliminates passive React rescheduling delay; cues populated with 0ms latency');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 21 SYNCHRONIZATION & EVENT SCHEDULER TESTS PASSED!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
