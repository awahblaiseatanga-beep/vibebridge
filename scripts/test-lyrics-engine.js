/**
 * Automated Verification Suite for READ Pillar: Synchronized Lyrics Engine (Milestone 6)
 *
 * Deterministic testing of:
 * 1. Strict Metadata Validation (timestamps, overlaps, empty text, ordering, mismatched IDs)
 * 2. Lyrics Timeline Binary-Search Resolution (before, active, gaps, boundaries, after)
 * 3. Initial State & No-Lyrics / Unloaded Fallback
 * 4. Active Lyric Highlighting & Context Tracking (previous, active, upcoming)
 * 5. Explicit Instrumental Gap & Transition Handling
 * 6. Playback Synchronization: Pause, Resume, and Monotonic Clock Freezing
 * 7. Seeking (Forward & Backward) and Timeline Revision Invalidation
 * 8. Track Replacement, Unload, and Playback Completion
 * 9. Resilience to Delayed / Dropped JS Events (Clock-Authoritative Recovery)
 * 10. Lifecycle: Subscription Cleanup, No Duplicates, and Disposal
 * 11. Original Demo Track Lyrics Integrity (4 segments, 12s, transparency disclosure)
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
const lyricsTypesCode = transpile('src/engines/lyrics/types.ts');
const lyricsValidatorCode = transpile('src/engines/lyrics/LyricsValidator.ts');
const lyricsTimelineCode = transpile('src/engines/lyrics/LyricsTimeline.ts');
const lyricsEngineCode = transpile('src/engines/lyrics/LyricsEngine.ts');
const demoLyricsCode = transpile('src/features/lyrics/demoTrackLyrics.ts');

class MockMasterClock {
  constructor() {
    this.clock = {
      positionMs: 0,
      durationMs: 12000,
      status: 'idle',
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
    this.clockListeners.forEach((fn) => fn({ ...this.clock }));
  }

  setStatus(status) {
    this.clock.status = status;
    this.statusListeners.forEach((fn) => fn(status));
    this.clockListeners.forEach((fn) => fn({ ...this.clock }));
  }

  setRevision(rev) {
    this.clock.timelineRevision = rev;
    this.clockListeners.forEach((fn) => fn({ ...this.clock }));
  }

  setBuffering(buffering) {
    this.clock.isBuffering = buffering;
    this.clockListeners.forEach((fn) => fn({ ...this.clock }));
  }
}

function createSandbox() {
  let exportedSync = {};
  let exportedScheduler = {};
  let exportedLyrics = {};

  const sandbox = {
    require: (id) => {
      if (id.includes('synchronization') || id.includes('LatencyManager')) return exportedSync;
      if (id.includes('event-scheduler') || id.includes('PriorityEventScheduler')) return exportedScheduler;
      if (id.includes('lyrics') || id.includes('Lyrics')) return exportedLyrics;
      if (id.includes('types')) return {};
      return require(id);
    },
    exports: {},
    module: { exports: {} },
    console,
    performance: { now: () => 1000 },
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (cb, ms) => setInterval(cb, ms),
    clearInterval: (id) => clearInterval(id),
  };

  vm.createContext(sandbox);

  // 1. Run LatencyManager
  vm.runInContext(latencyManagerCode, sandbox);
  const { LatencyManager, DEFAULT_LATENCY_OFFSETS } = sandbox.exports;
  const mockClockInstance = new MockMasterClock();
  exportedSync = {
    LatencyManager,
    DEFAULT_LATENCY_OFFSETS,
    latencyManager: new LatencyManager(),
    masterClock: mockClockInstance,
  };

  // 2. Run PriorityEventScheduler
  sandbox.exports = {};
  sandbox.module = { exports: {} };
  vm.runInContext(schedulerCode, sandbox);
  const { PriorityEventScheduler } = sandbox.exports;
  exportedScheduler = {
    PriorityEventScheduler,
    eventScheduler: new PriorityEventScheduler(null, mockClockInstance),
  };

  // 3. Run Lyrics Types & Validator
  sandbox.exports = {};
  sandbox.module = { exports: {} };
  vm.runInContext(lyricsValidatorCode, sandbox);
  const { LyricsValidator, LyricsValidationError } = sandbox.exports;

  // 4. Run LyricsTimeline
  sandbox.exports = {};
  sandbox.module = { exports: {} };
  exportedLyrics = {
    LyricsValidator,
    LyricsValidationError,
  };
  vm.runInContext(lyricsTimelineCode, sandbox);
  const { LyricsTimeline } = sandbox.exports;

  // 5. Run LyricsEngine
  sandbox.exports = {};
  sandbox.module = { exports: {} };
  exportedLyrics = {
    LyricsValidator,
    LyricsValidationError,
    LyricsTimeline,
  };
  vm.runInContext(lyricsEngineCode, sandbox);
  const { LyricsEngine } = sandbox.exports;

  // 6. Run Demo Lyrics
  sandbox.exports = {};
  sandbox.module = { exports: {} };
  vm.runInContext(demoLyricsCode, sandbox);
  const { DEMO_TRACK_LYRICS, DEMO_TRACK_ID } = sandbox.exports;

  return {
    PriorityEventScheduler,
    LyricsValidator,
    LyricsValidationError,
    LyricsTimeline,
    LyricsEngine,
    DEMO_TRACK_LYRICS,
    DEMO_TRACK_ID,
  };
}

async function runTests() {
  console.log('🧪 Starting Milestone 6 Synchronized Lyrics Engine (READ Pillar) Verification Suite...\n');

  const {
    PriorityEventScheduler,
    LyricsValidator,
    LyricsValidationError,
    LyricsTimeline,
    LyricsEngine,
    DEMO_TRACK_LYRICS,
    DEMO_TRACK_ID,
  } = createSandbox();

  // Test 1: Strict Metadata Validation
  console.log('Test 1: Strict Metadata Validation (Timestamps, Overlaps, Ordering, Empty Text)');
  {
    // Valid track passes check
    const validResult = LyricsValidator.check(DEMO_TRACK_LYRICS);
    assert.strictEqual(validResult.valid, true, 'Valid demo lyrics must pass check');
    assert.strictEqual(validResult.errors.length, 0);

    // Negative start time rejected
    const negativeStart = {
      trackId: 't1',
      durationMs: 5000,
      segments: [{ id: 's1', trackId: 't1', startMs: -100, endMs: 2000, text: 'Hello' }],
    };
    assert.strictEqual(LyricsValidator.check(negativeStart).valid, false);

    // endMs <= startMs rejected
    const invalidEnd = {
      trackId: 't1',
      durationMs: 5000,
      segments: [{ id: 's1', trackId: 't1', startMs: 2000, endMs: 2000, text: 'Hello' }],
    };
    assert.strictEqual(LyricsValidator.check(invalidEnd).valid, false);

    // Overlapping segments rejected
    const overlapping = {
      trackId: 't1',
      durationMs: 10000,
      segments: [
        { id: 's1', trackId: 't1', startMs: 1000, endMs: 3000, text: 'Line 1' },
        { id: 's2', trackId: 't1', startMs: 2500, endMs: 4500, text: 'Line 2' }, // starts before s1 ends!
      ],
    };
    const overlapResult = LyricsValidator.check(overlapping);
    assert.strictEqual(overlapResult.valid, false);
    assert.ok(overlapResult.errors.some((e) => e.includes('Overlapping segment')));

    // Out of order segments rejected
    const outOfOrder = {
      trackId: 't1',
      durationMs: 10000,
      segments: [
        { id: 's1', trackId: 't1', startMs: 4000, endMs: 6000, text: 'Line 2' },
        { id: 's2', trackId: 't1', startMs: 1000, endMs: 3000, text: 'Line 1' },
      ],
    };
    assert.strictEqual(LyricsValidator.check(outOfOrder).valid, false);

    // Empty text rejected
    const emptyText = {
      trackId: 't1',
      durationMs: 5000,
      segments: [{ id: 's1', trackId: 't1', startMs: 1000, endMs: 3000, text: '   ' }],
    };
    assert.strictEqual(LyricsValidator.check(emptyText).valid, false);

    // Mismatched track ID rejected
    const mismatchedId = {
      trackId: 't1',
      durationMs: 5000,
      segments: [{ id: 's1', trackId: 'different-track', startMs: 1000, endMs: 3000, text: 'Line 1' }],
    };
    assert.strictEqual(LyricsValidator.check(mismatchedId).valid, false);

    // LyricsValidator.validate throws LyricsValidationError
    assert.throws(
      () => LyricsValidator.validate(overlapping),
      LyricsValidationError,
      'LyricsValidator.validate must throw LyricsValidationError'
    );

    console.log('  ✓ Strict validator rejects overlaps, invalid timestamps, empty text, and ordering without silent repair');
  }

  // Test 2: Lyrics Timeline Binary-Search Resolution
  console.log('Test 2: Lyrics Timeline Binary-Search Resolution (Before, Active, Gaps, Boundaries, After)');
  {
    const sampleLyrics = {
      trackId: 'sample-track',
      durationMs: 10000,
      segments: [
        { id: 's1', trackId: 'sample-track', startMs: 1000, endMs: 3000, text: 'Line One' },
        { id: 's2', trackId: 'sample-track', startMs: 4000, endMs: 7000, text: 'Line Two' },
        { id: 's3', trackId: 'sample-track', startMs: 8000, endMs: 9500, text: 'Line Three' },
      ],
    };

    const timeline = new LyricsTimeline(sampleLyrics);

    // 1. Before first lyric (0ms - 999ms)
    const beforeRes = timeline.resolveAt(500);
    assert.strictEqual(beforeRes.status, 'before_lyrics');
    assert.strictEqual(beforeRes.activeSegment, null);
    assert.strictEqual(beforeRes.activeIndex, -1);
    assert.strictEqual(beforeRes.upcomingSegments.length, 3);
    assert.strictEqual(beforeRes.upcomingSegments[0].id, 's1');

    // 2. Exact start boundary (1000ms - inclusive)
    const startBoundary = timeline.resolveAt(1000);
    assert.strictEqual(startBoundary.status, 'active');
    assert.strictEqual(startBoundary.activeIndex, 0);
    assert.strictEqual(startBoundary.activeSegment?.id, 's1');

    // 3. Middle of segment (2000ms)
    const midSegment = timeline.resolveAt(2000);
    assert.strictEqual(midSegment.status, 'active');
    assert.strictEqual(midSegment.activeSegment?.id, 's1');

    // 4. Exact end boundary (3000ms - exclusive -> enters gap between s1 and s2)
    const endBoundary = timeline.resolveAt(3000);
    assert.strictEqual(endBoundary.status, 'instrumental_gap');
    assert.strictEqual(endBoundary.activeSegment, null);
    assert.strictEqual(endBoundary.previousSegment?.id, 's1');
    assert.strictEqual(endBoundary.upcomingSegments[0]?.id, 's2');

    // 5. Inside instrumental gap (3500ms)
    const insideGap = timeline.resolveAt(3500);
    assert.strictEqual(insideGap.status, 'instrumental_gap');
    assert.strictEqual(insideGap.activeSegment, null);
    assert.strictEqual(insideGap.previousSegment?.id, 's1');
    assert.strictEqual(insideGap.upcomingSegments[0]?.id, 's2');

    // 6. Second line active (5000ms)
    const secondLine = timeline.resolveAt(5000);
    assert.strictEqual(secondLine.status, 'active');
    assert.strictEqual(secondLine.activeIndex, 1);
    assert.strictEqual(secondLine.activeSegment?.id, 's2');
    assert.strictEqual(secondLine.previousSegment?.id, 's1');
    assert.strictEqual(secondLine.upcomingSegments[0]?.id, 's3');

    // 7. After final segment (9600ms)
    const afterRes = timeline.resolveAt(9600);
    assert.strictEqual(afterRes.status, 'after_lyrics');
    assert.strictEqual(afterRes.activeSegment, null);
    assert.strictEqual(afterRes.previousSegment?.id, 's3');
    assert.strictEqual(afterRes.upcomingSegments.length, 0);

    console.log('  ✓ Binary-search timeline correctly resolves exact boundaries, gaps, and contexts');
  }

  // Test 3: Initial State & No-Lyrics / Unloaded Fallback
  console.log('Test 3: Initial State & No-Lyrics / Unloaded Fallback');
  {
    const clock = new MockMasterClock();
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new LyricsEngine(null, clock, scheduler);

    const state = engine.getState();
    assert.strictEqual(state.hasLyrics, false, 'Initial state hasLyrics must be false when null loaded');
    assert.strictEqual(state.status, 'no_lyrics');
    assert.strictEqual(state.activeSegment, null);
    assert.strictEqual(state.previousSegment, null);
    assert.strictEqual(state.upcomingSegments.length, 0);
    assert.strictEqual(state.segments.length, 0);
    assert.strictEqual(state.totalSegmentsCount, 0);

    // Queries on empty track return null safely without exceptions
    assert.strictEqual(engine.getActiveSegment(), null);
    assert.strictEqual(engine.getActiveSegment(5000), null);

    engine.dispose();
    console.log('  ✓ Empty/null track gracefully initializes without crashes');
  }

  // Test 4: Active Lyric Highlighting & Context Tracking
  console.log('Test 4: Active Lyric Highlighting & Context Tracking (Previous, Active, Upcoming)');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new LyricsEngine(DEMO_TRACK_LYRICS, clock, scheduler);

    const state = engine.getState();
    assert.strictEqual(state.hasLyrics, true);
    assert.strictEqual(state.isDemonstration, true);
    assert.strictEqual(state.demonstrationLabel, 'Demo Lyrics · Synchronized to 120 BPM Stem');
    assert.strictEqual(state.totalSegmentsCount, 4);

    // Move to 1000ms: Segment 1 is active (500ms - 3500ms)
    clock.setTime(1000);

    const activeState = engine.getState();
    assert.strictEqual(activeState.status, 'active');
    assert.strictEqual(activeState.activeIndex, 0);
    assert.strictEqual(activeState.activeSegment?.text, 'Feel the pulse begin, deep in your hands');
    assert.strictEqual(activeState.previousSegment, null);
    assert.strictEqual(activeState.upcomingSegments.length, 3);
    assert.strictEqual(activeState.upcomingSegments[0].text, 'See the colors rise, dancing with the beat');

    // Move to 5000ms: Segment 2 is active (4000ms - 6500ms)
    clock.setTime(5000);

    const state2 = engine.getState();
    assert.strictEqual(state2.status, 'active');
    assert.strictEqual(state2.activeIndex, 1);
    assert.strictEqual(state2.activeSegment?.text, 'See the colors rise, dancing with the beat');
    assert.strictEqual(state2.previousSegment?.text, 'Feel the pulse begin, deep in your hands');
    assert.strictEqual(state2.upcomingSegments[0].text, 'Sound and motion moving as one');

    engine.dispose();
    console.log('  ✓ Active line prominently tracked with accurate previous and upcoming context');
  }

  // Test 5: Explicit Instrumental Gap & Transition Handling
  console.log('Test 5: Explicit Instrumental Gap & Transition Handling');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new LyricsEngine(DEMO_TRACK_LYRICS, clock, scheduler);

    // Demo lyrics timing:
    // Line 1: 500ms - 3500ms
    // Gap 1: 3500ms - 4000ms
    // Line 2: 4000ms - 6500ms

    // Position in gap between Line 1 and Line 2
    clock.setTime(3800);

    const gapState = engine.getState();
    assert.strictEqual(gapState.status, 'instrumental_gap', 'Status must be instrumental_gap');
    assert.strictEqual(gapState.activeSegment, null, 'No active segment should be highlighted during gap');
    assert.strictEqual(gapState.activeIndex, -1);
    assert.strictEqual(gapState.previousSegment?.id, 'demo-line-1', 'Previous segment must be line 1');
    assert.strictEqual(gapState.upcomingSegments[0]?.id, 'demo-line-2', 'Upcoming segment must be line 2');

    // Advance into Line 2 at 4000ms
    clock.setTime(4000);
    assert.strictEqual(engine.getState().status, 'active');
    assert.strictEqual(engine.getState().activeSegment?.id, 'demo-line-2');

    engine.dispose();
    console.log('  ✓ Instrumental gaps explicitly detected and rendered without stale highlights');
  }

  // Test 6: Playback Synchronization: Pause, Resume, and Monotonic Freezing
  console.log('Test 6: Playback Synchronization: Pause, Resume, and Monotonic Freezing');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    clock.setTime(2000); // Line 1 active
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new LyricsEngine(DEMO_TRACK_LYRICS, clock, scheduler);

    assert.strictEqual(engine.getState().isPaused, false);
    assert.strictEqual(engine.getState().activeSegment?.id, 'demo-line-1');

    // 1. Pause playback
    clock.setStatus('paused');
    const pausedState = engine.getState();
    assert.strictEqual(pausedState.isPaused, true, 'isPaused must be true when transport paused');
    assert.strictEqual(pausedState.activeSegment?.id, 'demo-line-1', 'Active line must freeze in place');

    // 2. Resume playback
    clock.setStatus('playing');
    const resumeState = engine.getState();
    assert.strictEqual(resumeState.isPaused, false);
    assert.strictEqual(resumeState.activeSegment?.id, 'demo-line-1');

    // 3. Buffering freeze
    clock.setBuffering(true);
    assert.strictEqual(engine.getState().isBuffering, true);
    clock.setBuffering(false);
    assert.strictEqual(engine.getState().isBuffering, false);

    engine.dispose();
    console.log('  ✓ Pause, resume, and buffering states synchronize cleanly with clock');
  }

  // Test 7: Seeking (Forward & Backward) and Timeline Revision Invalidation
  console.log('Test 7: Seeking (Forward & Backward) and Timeline Revision Invalidation');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    clock.setRevision(1);
    clock.setTime(1000); // Line 1
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new LyricsEngine(DEMO_TRACK_LYRICS, clock, scheduler);

    assert.strictEqual(engine.getState().activeSegment?.id, 'demo-line-1');

    // 1. Forward seek to 8000ms (Line 3: 7500ms - 9500ms) with timeline revision 2
    clock.setRevision(2);
    clock.setTime(8000);

    const fwdState = engine.getState();
    assert.strictEqual(fwdState.status, 'active');
    assert.strictEqual(fwdState.activeSegment?.id, 'demo-line-3', 'Must immediately update to Line 3');
    assert.strictEqual(fwdState.previousSegment?.id, 'demo-line-2');

    // 2. Backward seek to 2000ms (Line 1: 500ms - 3500ms) with timeline revision 3
    clock.setRevision(3);
    clock.setTime(2000);

    const backState = engine.getState();
    assert.strictEqual(backState.status, 'active');
    assert.strictEqual(backState.activeSegment?.id, 'demo-line-1', 'Must immediately update back to Line 1');
    assert.strictEqual(backState.previousSegment, null);

    // 3. Seek into instrumental gap at 3800ms
    clock.setRevision(4);
    clock.setTime(3800);

    const gapSeekState = engine.getState();
    assert.strictEqual(gapSeekState.status, 'instrumental_gap');
    assert.strictEqual(gapSeekState.activeSegment, null);

    engine.dispose();
    console.log('  ✓ Forward and backward seeking immediately re-resolves correct line with zero stale residue');
  }

  // Test 8: Track Replacement, Unload, and Playback Completion
  console.log('Test 8: Track Replacement, Unload, and Playback Completion');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new LyricsEngine(DEMO_TRACK_LYRICS, clock, scheduler);

    assert.strictEqual(engine.getState().hasLyrics, true);

    // 1. Replace with another track's lyrics
    const otherTrack = {
      trackId: 'other-track-id',
      durationMs: 20000,
      segments: [
        { id: 'other-1', trackId: 'other-track-id', startMs: 2000, endMs: 8000, text: 'Other Track Song' },
      ],
    };

    engine.loadLyrics(otherTrack);
    assert.strictEqual(engine.getState().trackId, 'other-track-id');
    assert.strictEqual(engine.getState().totalSegmentsCount, 1);
    assert.strictEqual(engine.getState().isDemonstration, false);

    // 2. Track unload / clear
    engine.clearLyrics();
    assert.strictEqual(engine.getState().hasLyrics, false);
    assert.strictEqual(engine.getState().trackId, null);
    assert.strictEqual(engine.getState().segments.length, 0);

    // 3. Playback completion: stopped status
    clock.setStatus('stopped');
    assert.strictEqual(engine.getState().isEnded, true);

    engine.dispose();
    console.log('  ✓ Track replacement, clearing, and completion transitions verified');
  }

  // Test 9: Resilience to Delayed / Dropped JS Events (Clock-Authoritative Recovery)
  console.log('Test 9: Resilience to Delayed / Dropped JS Events (Clock-Authoritative Recovery)');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    clock.setTime(500); // Start of line 1
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new LyricsEngine(DEMO_TRACK_LYRICS, clock, scheduler);

    assert.strictEqual(engine.getState().activeSegment?.id, 'demo-line-1');

    // Simulate JS thread being frozen or blocked through multiple lines,
    // jumping clock from 500ms to 8500ms (Line 3: 7500ms - 9500ms) without intermediate ticks
    clock.setTime(8500);

    // Engine immediately recovers authoritative active line directly from clock position
    const recoveredState = engine.getState();
    assert.strictEqual(recoveredState.status, 'active');
    assert.strictEqual(recoveredState.activeSegment?.id, 'demo-line-3');
    assert.strictEqual(recoveredState.activeSegment?.text, 'Sound and motion moving as one');

    engine.dispose();
    console.log('  ✓ Authoritative clock resolution guarantees recovery from delayed JS execution');
  }

  // Test 10: Lifecycle: Subscription Cleanup, No Duplicates, and Disposal
  console.log('Test 10: Lifecycle: Subscription Cleanup, No Duplicates, and Disposal');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new LyricsEngine(DEMO_TRACK_LYRICS, clock, scheduler);

    let notificationCount = 0;
    let lastReceivedState = null;

    const unsubscribe = engine.onLyricsStateChange((state) => {
      notificationCount++;
      lastReceivedState = state;
    });

    // Initial subscription emits once immediately
    assert.strictEqual(notificationCount, 1);
    assert.ok(lastReceivedState);

    // Time update triggering line change
    clock.setTime(1000);
    assert.strictEqual(lastReceivedState.activeSegment?.id, 'demo-line-1');

    // Unsubscribe
    unsubscribe();
    const countBeforeNewTick = notificationCount;

    clock.setTime(5000);
    assert.strictEqual(notificationCount, countBeforeNewTick, 'Unsubscribed listener must not be called');

    // Dispose
    engine.dispose();
    assert.strictEqual(engine.getState().hasLyrics, false);

    console.log('  ✓ Subscription cleanup, listener isolation, and disposal release verified');
  }

  // Test 11: Original Demo Track Lyrics Integrity
  console.log('Test 11: Original Demo Track Lyrics Integrity (4 segments, 12s, transparency disclosure)');
  {
    assert.strictEqual(DEMO_TRACK_LYRICS.trackId, DEMO_TRACK_ID);
    assert.strictEqual(DEMO_TRACK_LYRICS.durationMs, 12000);
    assert.strictEqual(DEMO_TRACK_LYRICS.isDemonstration, true);
    assert.strictEqual(DEMO_TRACK_LYRICS.demonstrationLabel, 'Demo Lyrics · Synchronized to 120 BPM Stem');
    assert.strictEqual(DEMO_TRACK_LYRICS.segments.length, 4);

    // Segment 1 (500 - 3500ms)
    assert.strictEqual(DEMO_TRACK_LYRICS.segments[0].startMs, 500);
    assert.strictEqual(DEMO_TRACK_LYRICS.segments[0].endMs, 3500);

    // Segment 2 (4000 - 6500ms)
    assert.strictEqual(DEMO_TRACK_LYRICS.segments[1].startMs, 4000);
    assert.strictEqual(DEMO_TRACK_LYRICS.segments[1].endMs, 6500);

    // Segment 3 (7500 - 9500ms)
    assert.strictEqual(DEMO_TRACK_LYRICS.segments[2].startMs, 7500);
    assert.strictEqual(DEMO_TRACK_LYRICS.segments[2].endMs, 9500);

    // Segment 4 (10000 - 11500ms)
    assert.strictEqual(DEMO_TRACK_LYRICS.segments[3].startMs, 10000);
    assert.strictEqual(DEMO_TRACK_LYRICS.segments[3].endMs, 11500);

    console.log('  ✓ Demo track lyrics verified: 4 lines, accurate 12s timestamps, transparency disclosure');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 11 SYNCHRONIZED LYRICS ENGINE VERIFICATION TESTS PASSED!');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Lyrics Engine Test Failure:', err);
  process.exit(1);
});
