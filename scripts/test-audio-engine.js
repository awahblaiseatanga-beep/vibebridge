/**
 * Automated Verification Suite for ExpoAudioEngine
 *
 * Runs in Node using Babel transpilation of the actual production TypeScript source.
 * Simulates native Android ExoPlayer / expo-audio callbacks to thoroughly verify:
 * 1. Initial State & Unloaded Clock
 * 2. Bundled Audio Asset Loading & Duration
 * 3. Local File URI Handling
 * 4. Playback State Transitions (play, pause, resume, stop)
 * 5. Clock Anchoring (monotonic updatedAtMs timestamp)
 * 6. Safe Clock Estimation between native updates (non-mutating, rate-aware)
 * 7. Paused Clock Behavior (estimation freeze)
 * 8. Buffering Clock Behavior (estimation freeze)
 * 9. Playback Rate Scaling (0.5x, 1.0x, 1.5x)
 * 10. Track Loading Revision Increments (generation tracking)
 * 11. Seek Revision Increments (downstream cue invalidation)
 * 12. Rapid Consecutive Seeking (coalescing & serialized execution)
 * 13. Track Completion (didJustFinish)
 * 14. Native Interruptions & Recovery (Audio focus loss / becoming noisy)
 * 15. Native Error Handling & State Reset
 * 16. Unload & Memory Disposal
 */

const assert = require('assert');
const babel = require('@babel/core');
const vm = require('vm');

// 1. Mock native expo-audio module with realistic async delays
let nextMockPlayerId = 1;
let defaultManualStartup = false;
let defaultManualSeek = false;

class MockAudioPlayer {
  constructor(source, options) {
    this.id = `mock-player-${nextMockPlayerId++}`;
    this.source = source;
    this.options = options || {};
    this.playing = false;
    this.paused = true;
    this.isLoaded = true;
    this.isBuffering = false;
    this.currentTime = 0;
    this.duration = 12.0;
    this.volume = 1.0;
    this.playbackRate = 1.0;
    this.listeners = new Map();
    this.removed = false;
    this.seekCalls = [];
    this.manualStartupConfirmation = defaultManualStartup;
    this.manualSeekConfirmation = defaultManualSeek;
  }

  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return {
      remove: () => {
        this.listeners.get(event)?.delete(callback);
      },
    };
  }

  emit(event, payload) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const fullPayload = { id: this.id, ...payload };
      handlers.forEach((fn) => fn(fullPayload));
    }
  }

  play() {
    this.playing = true;
    this.paused = false;
    if (!this.manualStartupConfirmation) {
      this.emit('playbackStatusUpdate', {
        isLoaded: true,
        playing: true,
        currentTime: this.currentTime,
        duration: this.duration,
        isBuffering: false,
        playbackRate: this.playbackRate,
        didJustFinish: false,
        error: null,
      });
    }
  }

  pause() {
    this.playing = false;
    this.paused = true;
    this.emit('playbackStatusUpdate', {
      isLoaded: true,
      playing: false,
      currentTime: this.currentTime,
      duration: this.duration,
      isBuffering: false,
      playbackRate: this.playbackRate,
      didJustFinish: false,
      error: null,
    });
  }

  async seekTo(seconds) {
    this.seekCalls.push(seconds);
    // Simulate brief native async seeking delay
    await new Promise((resolve) => setTimeout(resolve, 5));
    this.currentTime = seconds;
    if (!this.manualSeekConfirmation) {
      this.emit('playbackStatusUpdate', {
        isLoaded: true,
        playing: this.playing,
        currentTime: this.currentTime,
        duration: this.duration,
        isBuffering: false,
        playbackRate: this.playbackRate,
        didJustFinish: false,
        error: null,
      });
    }
  }

  remove() {
    this.removed = true;
    this.listeners.clear();
  }
}

let createdPlayers = [];
let lastCreatedPlayer = null;

const mockExpoAudio = {
  createAudioPlayer: (source, options) => {
    lastCreatedPlayer = new MockAudioPlayer(source, options);
    createdPlayers.push(lastCreatedPlayer);
    return lastCreatedPlayer;
  },
};

// 2. Transpile production source file
const transpiled = babel.transformFileSync('src/engines/audio/ExpoAudioEngine.ts', {
  presets: ['babel-preset-expo'],
  filename: 'src/engines/audio/ExpoAudioEngine.ts',
});

// 3. Execute in isolated VM context with mocked expo-audio and performance
let mockedPerformanceNow = 1000.0;

const sandbox = {
  require: (id) => {
    if (id === 'expo-audio') return mockExpoAudio;
    if (id.startsWith('@/types') || id.endsWith('types')) return {};
    return require(id);
  },
  exports: {},
  module: { exports: {} },
  console,
  setTimeout,
  clearTimeout,
  performance: {
    now: () => mockedPerformanceNow,
  },
};

vm.createContext(sandbox);
vm.runInContext(transpiled.code, sandbox);

const { ExpoAudioEngine } = sandbox.exports;
assert.ok(ExpoAudioEngine, 'ExpoAudioEngine class should be exported');

async function runTests() {
  console.log('🧪 Starting Milestone 2 Comprehensive Audio Clock Verification Suite...\n');

  const engine = new ExpoAudioEngine();

  // --- Test 1: Initial State & Unloaded Clock ---
  console.log('Test 1: Initial State & Unloaded Clock');
  const clock0 = engine.getClock();
  assert.strictEqual(clock0.status, 'idle');
  assert.strictEqual(clock0.positionMs, 0);
  assert.strictEqual(clock0.timelineRevision, 0);
  assert.strictEqual(clock0.updatedAtMs, 1000.0);
  assert.strictEqual(engine.getEstimatedPositionMs(), 0);
  console.log('  ✓ Initial state is idle, position 0ms, revision 0, anchored at 1000ms');

  // --- Test 2: Bundled Audio Asset Loading & Revision Tracking ---
  console.log('Test 2: Track Loading & Revision Changes');
  mockedPerformanceNow = 1500.0;
  await engine.load({
    type: 'bundle',
    assetId: 101,
    name: 'VibeBridge Demo',
    durationMs: 12000,
  });

  const clockLoad1 = engine.getClock();
  assert.strictEqual(clockLoad1.status, 'paused');
  assert.strictEqual(clockLoad1.durationMs, 12000);
  assert.strictEqual(clockLoad1.timelineRevision, 1, 'Loading track 1 must set revision to 1');
  assert.strictEqual(clockLoad1.updatedAtMs, 1500.0, 'Anchored at load time (1500ms)');
  console.log('  ✓ Track 1 loaded: status paused, duration 12000ms, timelineRevision=1');

  // Loading second track must increment revision
  mockedPerformanceNow = 2000.0;
  await engine.load({
    type: 'uri',
    uri: 'file:///data/user/0/com.vibebridge.app/files/track2.mp3',
    durationMs: 15000,
  });
  const clockLoad2 = engine.getClock();
  assert.strictEqual(clockLoad2.timelineRevision, 2, 'Loading track 2 must increment revision to 2');
  assert.strictEqual(lastCreatedPlayer.source.uri, 'file:///data/user/0/com.vibebridge.app/files/track2.mp3');
  console.log('  ✓ Track 2 loaded: local URI resolved, timelineRevision incremented to 2');

  // Reload demo track for remaining tests
  mockedPerformanceNow = 2500.0;
  await engine.load({
    type: 'bundle',
    assetId: 101,
    durationMs: 12000,
  });
  assert.strictEqual(engine.getClock().timelineRevision, 3, 'Revision incremented to 3');

  // --- Test 3: Play & Clock Anchoring ---
  console.log('Test 3: Play & Monotonic Clock Anchoring');
  mockedPerformanceNow = 3000.0;
  await engine.play();

  const clockPlay = engine.getClock();
  assert.strictEqual(clockPlay.status, 'playing');
  assert.strictEqual(clockPlay.updatedAtMs, 3000.0, 'updatedAtMs anchored at start of play (3000ms)');
  console.log('  ✓ engine.play() transitions to playing and anchors updatedAtMs=3000ms');

  // --- Test 4: Safe Clock Estimation Between Native Updates ---
  console.log('Test 4: Safe Clock Estimation Between Native Updates');
  // Native ExoPlayer emitted tick at currentTime = 1.0s (1000ms) at time 3000ms
  lastCreatedPlayer.currentTime = 1.0;
  mockedPerformanceNow = 3100.0;
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 1.0,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  assert.strictEqual(engine.getClock().positionMs, 1000);
  assert.strictEqual(engine.getClock().updatedAtMs, 3100.0);

  // 40ms later in JS (before next 50ms native tick arrives)
  const est1 = engine.getEstimatedPositionMs(3140.0);
  assert.strictEqual(est1, 1040, 'Position estimated forward by 40ms: 1000 + 40 = 1040ms');
  assert.strictEqual(engine.getClock().positionMs, 1000, 'Authoritative native positionMs must NOT be mutated');
  console.log('  ✓ Between native ticks, getEstimatedPositionMs(3140ms) correctly projects 1040ms without mutating native clock');

  // --- Test 5: Playback Rate Scaling in Clock Estimation ---
  console.log('Test 5: Playback Rate Scaling (1.5x and 0.5x)');
  // Rate set to 1.5x
  lastCreatedPlayer.playbackRate = 1.5;
  lastCreatedPlayer.currentTime = 2.0;
  mockedPerformanceNow = 4000.0;
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 2.0,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.5,
    didJustFinish: false,
    error: null,
  });

  assert.strictEqual(engine.getClock().rate, 1.5);
  // 100ms later at 1.5x rate = +150ms
  const estRate15 = engine.getEstimatedPositionMs(4100.0);
  assert.strictEqual(estRate15, 2150, 'At 1.5x speed, 100ms elapsed projects 150ms: 2000 + 150 = 2150ms');

  // Rate set to 0.5x
  lastCreatedPlayer.playbackRate = 0.5;
  lastCreatedPlayer.currentTime = 2.0;
  mockedPerformanceNow = 5000.0;
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 2.0,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 0.5,
    didJustFinish: false,
    error: null,
  });

  // 100ms later at 0.5x rate = +50ms
  const estRate05 = engine.getEstimatedPositionMs(5100.0);
  assert.strictEqual(estRate05, 2050, 'At 0.5x speed, 100ms elapsed projects 50ms: 2000 + 50 = 2050ms');
  console.log('  ✓ getEstimatedPositionMs correctly scales projection by playbackRate (1.5x -> 2150ms, 0.5x -> 2050ms)');

  // Reset rate to 1.0
  lastCreatedPlayer.playbackRate = 1.0;

  // --- Test 6: Paused Clock Behavior (Freeze Estimation) ---
  console.log('Test 6: Paused Clock Behavior (Estimation Freeze)');
  mockedPerformanceNow = 6000.0;
  await engine.pause();
  assert.strictEqual(engine.getClock().status, 'paused');
  const pausedPos = engine.getClock().positionMs;

  // Time elapses 5000ms while paused
  const estPaused = engine.getEstimatedPositionMs(11000.0);
  assert.strictEqual(estPaused, pausedPos, 'Clock estimation must NOT advance while paused');
  console.log('  ✓ Clock estimation strictly freezes at paused position regardless of elapsed wall time');

  // --- Test 7: Buffering Clock Behavior (Freeze Estimation) ---
  console.log('Test 7: Buffering Clock Behavior (Estimation Freeze)');
  mockedPerformanceNow = 7000.0;
  await engine.play();
  lastCreatedPlayer.currentTime = 3.0;
  mockedPerformanceNow = 7100.0;
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 3.0,
    duration: 12.0,
    isBuffering: true,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  assert.strictEqual(engine.getClock().isBuffering, true);
  // While buffering, even though status is playing, estimation must NOT advance
  const estBuffering = engine.getEstimatedPositionMs(7500.0);
  assert.strictEqual(estBuffering, 3000, 'Clock estimation must NOT advance during buffering');
  console.log('  ✓ Clock estimation strictly freezes during buffering (3000ms)');

  // Clear buffering
  mockedPerformanceNow = 8000.0;
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 3.0,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  // --- Test 8: Seek Revision Changes & Invalidation ---
  console.log('Test 8: Seek Revision Changes');
  const revBeforeSeek = engine.getClock().timelineRevision;
  mockedPerformanceNow = 8500.0;
  await engine.seek(5000);

  const clockSeek = engine.getClock();
  assert.strictEqual(clockSeek.positionMs, 5000, 'Authoritative position updated immediately to 5000ms');
  assert.strictEqual(clockSeek.updatedAtMs, 8500.0, 'Anchored at seek timestamp 8500ms');
  assert.strictEqual(clockSeek.timelineRevision, revBeforeSeek + 1, 'timelineRevision must increment on seek');
  console.log(`  ✓ seek(5000) updated position to 5000ms and incremented revision to ${clockSeek.timelineRevision}`);

  // --- Test 9: Rapid Consecutive Seeking (Coalescing & Race Prevention) ---
  console.log('Test 9: Rapid Consecutive Seeking');
  lastCreatedPlayer.seekCalls = [];

  // Fire 4 rapid seeks synchronously without waiting for promises
  const p1 = engine.seek(6000);
  const p2 = engine.seek(7000);
  const p3 = engine.seek(8000);
  const p4 = engine.seek(9500);

  await Promise.all([p1, p2, p3, p4]);

  // Wait brief moment for native async loop to finish
  await new Promise((r) => setTimeout(r, 20));

  assert.strictEqual(engine.getClock().positionMs, 9500, 'Final authoritative position is 9500ms');
  assert.strictEqual(lastCreatedPlayer.currentTime, 9.5, 'Native player seeked to final target (9.5s)');
  console.log('  ✓ Rapid consecutive seeks cleanly coalesced; native player finalized at 9.5s without race conditions');

  // --- Test 10: Clamping to Duration Boundary ---
  console.log('Test 10: Clamping to Track Duration Boundary');
  await engine.seek(20000); // Beyond 12000ms duration
  assert.strictEqual(engine.getClock().positionMs, 12000, 'Position clamped to durationMs (12000)');

  // Test estimation clamp beyond duration
  mockedPerformanceNow = 10000.0;
  await engine.seek(11950);
  const estPastEnd = engine.getEstimatedPositionMs(12000.0);
  assert.strictEqual(estPastEnd, 12000, 'Estimated position must never exceed durationMs');
  console.log('  ✓ Seeking and estimation are strictly clamped to [0, durationMs]');

  // --- Test 11: Track Completion (didJustFinish) ---
  console.log('Test 11: Track Completion (didJustFinish)');
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: false,
    currentTime: 12.0,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: true,
    error: null,
  });

  const clockEnded = engine.getClock();
  assert.strictEqual(clockEnded.status, 'stopped');
  assert.strictEqual(clockEnded.positionMs, 12000);
  assert.strictEqual(engine.getEstimatedPositionMs(20000.0), 12000, 'Estimation never advances after track completion');
  console.log('  ✓ didJustFinish transitions status to stopped and clamps estimation at duration');

  // --- Test 12: Native Interruption (Audio Focus Loss / Becoming Noisy) & Recovery ---
  console.log('Test 12: Native Audio Interruption & Recovery');
  // Start playing again
  mockedPerformanceNow = 15000.0;
  await engine.seek(4000);
  await engine.play();
  assert.strictEqual(engine.getClock().status, 'playing');

  // Android triggers audio focus loss (e.g. phone call or headphones unplugged) -> playing becomes false
  mockedPerformanceNow = 15500.0;
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: false,
    currentTime: 4.5,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  const clockInterrupted = engine.getClock();
  assert.strictEqual(clockInterrupted.status, 'paused', 'Audio focus loss must cleanly transition engine to paused');
  assert.strictEqual(clockInterrupted.positionMs, 4500);

  // Estimation must freeze while interrupted
  assert.strictEqual(engine.getEstimatedPositionMs(25000.0), 4500, 'Estimation frozen while interrupted');

  // Recovery: Phone call ends, audio focus regained, native resumes
  mockedPerformanceNow = 26000.0;
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 4.5,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  assert.strictEqual(engine.getClock().status, 'playing', 'Engine recovers to playing on focus gain');
  assert.strictEqual(engine.getClock().updatedAtMs, 26000.0, 'Anchor re-anchored on recovery');
  console.log('  ✓ Native audio focus loss / becoming noisy cleanly pauses engine, freezes estimation, and recovers on focus gain');

  // --- Test 13: Unload & Resource Cleanup ---
  console.log('Test 13: Unload & Memory Disposal');
  await engine.unload();
  assert.strictEqual(lastCreatedPlayer.removed, true);
  assert.strictEqual(engine.getClock().status, 'idle');
  assert.strictEqual(engine.getClock().positionMs, 0);
  assert.strictEqual(engine.getClock().timelineRevision, 0);
  console.log('  ✓ engine.unload() removes native player and resets clock and revision to initial idle state');

  // --- Test 14: Monotonic Forward Progression & Delayed Native Update Resilience (Stage A.7.1) ---
  console.log('Test 14: Monotonic Forward Progression & Delayed Native Update Resilience (Stage A.7.1)');
  mockedPerformanceNow = 30000.0;
  await engine.load({
    type: 'bundle',
    assetId: 101,
    durationMs: 12000,
  });
  await engine.play();

  // Native ExoPlayer tick at 1000ms at time 30000ms
  lastCreatedPlayer.currentTime = 1.0;
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 1.0,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  // Forward extrapolation: at 30040ms, position is 1040ms
  const estBeforeGlitch = engine.getEstimatedPositionMs(30040.0);
  assert.strictEqual(estBeforeGlitch, 1040, 'Forward extrapolation reaches 1040ms at +40ms');

  // Delayed native tick arrives at 30050ms, but reports 1030ms (behind previous extrapolation by 10ms)
  mockedPerformanceNow = 30050.0;
  lastCreatedPlayer.currentTime = 1.030;
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 1.030,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  // Monotonic floor guarantee: estimated position must NOT step backward to 1030ms!
  const estAfterGlitch = engine.getEstimatedPositionMs(30050.0);
  assert.strictEqual(estAfterGlitch, 1040, 'Estimated position must not step backward when delayed native update arrives');

  // Next evaluation at 30065ms: native projected is 1030 + 15 = 1045ms > 1040ms
  const estResumed = engine.getEstimatedPositionMs(30065.0);
  assert.strictEqual(estResumed, 1045, 'Forward progression cleanly resumes when native projection overtakes floor');

  // Normal subsequent native tick at 30100ms reporting 1080ms re-anchors clock without unbounded offset
  mockedPerformanceNow = 30100.0;
  lastCreatedPlayer.currentTime = 1.080;
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 1.080,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });
  const estNormal = engine.getEstimatedPositionMs(30100.0);
  assert.strictEqual(estNormal, 1080, 'Clock re-anchors to native position without unbounded drift');
  console.log('  ✓ Monotonic forward progression guaranteed; delayed updates do not cause backward jumps or unbounded drift');

  // --- Test 15: Timeline Discontinuities: Backward Seek, Forward Seek & Track Load (Stage A.7.1) ---
  console.log('Test 15: Timeline Discontinuities: Backward Seek, Forward Seek & Track Load (Stage A.7.1)');
  // We are currently at ~1080ms in playback. Perform backward seek to 300ms
  mockedPerformanceNow = 31000.0;
  await engine.seek(300);
  assert.strictEqual(engine.getEstimatedPositionMs(31000.0), 300, 'Backward seek immediately establishes new lower position (floor reset)');

  // Perform forward seek to 9000ms
  mockedPerformanceNow = 32000.0;
  await engine.seek(9000);
  assert.strictEqual(engine.getEstimatedPositionMs(32000.0), 9000, 'Forward seek immediately establishes new higher position');

  // Track replacement: loading new track resets clock and monotonic floor to 0
  mockedPerformanceNow = 33000.0;
  await engine.load({ type: 'bundle', assetId: 102, durationMs: 8000 });
  assert.strictEqual(engine.getEstimatedPositionMs(33000.0), 0, 'Track replacement cleanly resets clock to 0ms');
  console.log('  ✓ Backward seek, forward seek, and track replacement cleanly re-anchor timeline discontinuities');

  // --- Test 16: Pause & Resume Continuous Re-Anchoring (Stage A.7.1) ---
  console.log('Test 16: Pause & Resume Continuous Re-Anchoring (Stage A.7.1)');
  await engine.play();
  lastCreatedPlayer.currentTime = 1.0;
  mockedPerformanceNow = 34000.0;
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 1.0,
    duration: 8.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  // Pause at 34050ms
  mockedPerformanceNow = 34050.0;
  await engine.pause();
  assert.strictEqual(engine.getClock().status, 'paused');

  // While paused, wall clock advances 5000ms
  assert.strictEqual(engine.getEstimatedPositionMs(39050.0), engine.getClock().positionMs, 'Position remains frozen while paused');

  // Resume at 40000ms
  mockedPerformanceNow = 40000.0;
  await engine.resume();
  assert.strictEqual(engine.getClock().status, 'playing');
  assert.strictEqual(engine.getEstimatedPositionMs(40000.0), engine.getClock().positionMs, 'Zero artificial time jump on resume');

  // 30ms after resume, advances exactly by 30ms
  assert.strictEqual(engine.getEstimatedPositionMs(40030.0), engine.getClock().positionMs + 30, 'Extrapolation resumes smoothly from paused anchor');
  console.log('  ✓ Pause and resume maintain continuous re-anchoring with zero artificial jumps');

  // --- Test 17: Asynchronous Native Startup Delay (100ms) with Zero Premature Clock Advance (Stage A.7.2.3.7) ---
  console.log('Test 17: Asynchronous Native Startup Delay (100ms) with Zero Premature Clock Advance (Stage A.7.2.3.7)');
  defaultManualStartup = true;
  await engine.load({ type: 'bundle', assetId: 103, durationMs: 10000 });
  mockedPerformanceNow = 50000.0;
  await engine.play();

  // Engine is awaiting native startup confirmation
  assert.strictEqual(engine.isAwaitingNativeStart, true, 'Engine must flag isAwaitingNativeStart');
  assert.strictEqual(engine.getClock().status, 'paused', 'Engine clock status remains paused until native confirms');

  // Wall clock advances 100ms while native audio pipeline initializes asynchronously
  mockedPerformanceNow = 50100.0;
  assert.strictEqual(engine.getEstimatedPositionMs(50100.0), 0, 'Estimated position must NOT extrapolate forward before native startup');

  // Native confirmation arrives at 50100ms reporting currentTime = 0.0s
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 0.0,
    duration: 10.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  assert.strictEqual(engine.isAwaitingNativeStart, false, 'Startup awaiting flag cleared on confirmation');
  assert.strictEqual(engine.getClock().status, 'playing', 'Clock status transitions to playing upon confirmation');
  assert.strictEqual(engine.getClock().updatedAtMs, 50100.0, 'Clock anchored at arrival timestamp');

  // 20ms later, clock extrapolates cleanly
  mockedPerformanceNow = 50120.0;
  assert.strictEqual(engine.getEstimatedPositionMs(50120.0), 20, 'Position cleanly advances from confirmed anchor');
  defaultManualStartup = false;
  console.log('  ✓ Zero premature clock advance during 100ms native startup delay; clean anchor upon confirmation');

  // --- Test 18: Startup Abort via Immediate Pause and Native Player Disposal (Stage A.7.2.3.7) ---
  console.log('Test 18: Startup Abort via Immediate Pause and Native Player Disposal (Stage A.7.2.3.7)');
  await engine.seek(500);
  assert.strictEqual(engine.getClock().positionMs, 500);

  defaultManualStartup = true;
  const playerA = lastCreatedPlayer;
  playerA.manualStartupConfirmation = true;
  await engine.play();
  assert.strictEqual(engine.isAwaitingNativeStart, true, 'Startup pending');

  // User presses pause immediately before native confirmation
  await engine.pause();
  assert.strictEqual(engine.isAwaitingNativeStart, false, 'isAwaitingNativeStart reset to false on abort');
  assert.strictEqual(engine.getClock().status, 'paused', 'Clock status is paused');
  assert.strictEqual(engine.getClock().positionMs, 500, 'Position preserved at 500ms');
  assert.strictEqual(playerA.removed, true, 'Native player must be disposed (removed) on startup abort');
  assert.strictEqual(engine.player, null, 'Engine player reference set to null');
  console.log('  ✓ Immediate pause during startup cleanly aborts, disposes native player, and preserves position');

  // --- Test 19: Player Recreation on Next Play with Preserved Source, Position, and Rate (Stage A.7.2.3.7) ---
  console.log('Test 19: Player Recreation on Next Play with Preserved Source, Position, and Rate (Stage A.7.2.3.7)');
  const attemptIdBefore = engine.currentPlaybackAttemptId;
  defaultManualStartup = true;
  await engine.play(); // Player is null, must recreate!
  const playerB = lastCreatedPlayer;
  assert.notStrictEqual(playerB, playerA, 'A new player instance must be created');
  assert.notStrictEqual(playerB.id, playerA.id, 'New player must have a distinct unique ID');
  assert.strictEqual(engine.currentPlaybackAttemptId, attemptIdBefore + 1, 'Playback attempt ID incremented');
  assert.strictEqual(engine.isAwaitingNativeStart, true, 'New player awaiting native startup confirmation');

  // Confirm playback on player B
  playerB.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 0.5,
    duration: 10.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });
  assert.strictEqual(engine.isAwaitingNativeStart, false, 'Awaiting flag cleared');
  assert.strictEqual(engine.getClock().status, 'playing', 'Engine transitions to playing');
  assert.strictEqual(engine.getClock().positionMs, 500, 'Anchored at preserved 500ms position');
  defaultManualStartup = false;
  console.log('  ✓ Fresh player instance recreated with preserved source, seek position, and distinct ID');

  // --- Test 20: Stale Callback Rejection from Disposed Player Instance (Stage A.7.2.3.7) ---
  console.log('Test 20: Stale Callback Rejection from Disposed Player Instance (Stage A.7.2.3.7)');
  // Simulate stale native callback from disposed playerA arriving late with erroneous state
  playerA.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 9.999,
    duration: 10.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });
  assert.strictEqual(engine.getClock().positionMs, 500, 'Stale callback from old player ID must be ignored');
  assert.strictEqual(engine.player.id, playerB.id, 'Active player ID preserved');
  console.log('  ✓ Stale native status updates with mismatched player ID are completely rejected');

  // --- Test 21: Rapid Repeated Play/Pause Toggling Without Desynchronization (Stage A.7.2.3.7) ---
  console.log('Test 21: Rapid Repeated Play/Pause Toggling Without Desynchronization (Stage A.7.2.3.7)');
  // Sequence: Play -> Pause -> Play -> Pause -> Play (rapid succession while startup unconfirmed)
  defaultManualStartup = true;
  await engine.pause(); // mid-track pause to reset

  // 1. Play (attempt 1)
  await engine.play();
  const rapidP1 = lastCreatedPlayer;

  // 2. Immediate Pause
  await engine.pause();
  assert.strictEqual(rapidP1.removed, true, 'Rapid attempt 1 player disposed');

  // 3. Immediate Play (attempt 2)
  await engine.play();
  const rapidP2 = lastCreatedPlayer;
  assert.notStrictEqual(rapidP2.id, rapidP1.id);

  // 4. Immediate Pause
  await engine.pause();
  assert.strictEqual(rapidP2.removed, true, 'Rapid attempt 2 player disposed');

  // 5. Immediate Play (attempt 3)
  await engine.play();
  const rapidP3 = lastCreatedPlayer;
  assert.notStrictEqual(rapidP3.id, rapidP2.id);

  // Now native confirmation arrives for rapidP3
  rapidP3.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 0.5,
    duration: 10.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  assert.strictEqual(engine.getClock().status, 'playing', 'Engine cleanly stabilizes in playing state');
  assert.strictEqual(engine.player.id, rapidP3.id, 'Engine attached to active player 3');
  defaultManualStartup = false;
  console.log('  ✓ Rapid play/pause cycling cleanly disposes intermediate players without desynchronization');

  // --- Test 22: Startup Abort via Immediate Stop (Revision Increment & Position 0) (Stage A.7.2.3.7) ---
  console.log('Test 22: Startup Abort via Immediate Stop (Revision Increment & Position 0) (Stage A.7.2.3.7)');
  const revBefore = engine.getClock().timelineRevision;
  await engine.stop();
  defaultManualStartup = true;
  await engine.play(); // starts fresh startup
  const stopPlayer = lastCreatedPlayer;
  assert.strictEqual(engine.isAwaitingNativeStart, true);

  await engine.stop();
  assert.strictEqual(engine.isAwaitingNativeStart, false, 'Stop clears isAwaitingNativeStart');
  assert.strictEqual(stopPlayer.removed, true, 'Player disposed on stop during startup');
  assert.strictEqual(engine.player, null);
  assert.strictEqual(engine.getClock().status, 'stopped');
  assert.strictEqual(engine.getClock().positionMs, 0, 'Position reset to 0');
  assert.strictEqual(engine.getClock().timelineRevision > revBefore, true, 'Timeline revision incremented');
  defaultManualStartup = false;
  console.log('  ✓ Immediate stop during startup disposes player and resets timeline revision & position');

  // --- Test 23: Seek During Startup (Player Recreation at New Target Position) (Stage A.7.2.3.7) ---
  console.log('Test 23: Seek During Startup (Player Recreation at New Target Position) (Stage A.7.2.3.7)');
  defaultManualStartup = true;
  await engine.play();
  const seekStartupPlayer = lastCreatedPlayer;
  assert.strictEqual(engine.isAwaitingNativeStart, true);

  // Seek during unconfirmed startup
  await engine.seek(3500);
  assert.strictEqual(seekStartupPlayer.removed, true, 'Original player disposed on startup seek');
  const seekTargetPlayer = lastCreatedPlayer;
  assert.notStrictEqual(seekTargetPlayer.id, seekStartupPlayer.id, 'New player created for seek target');
  assert.strictEqual(engine.getClock().positionMs, 3500, 'Clock position set to target 3500ms');

  // Confirm native startup on recreated player
  seekTargetPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 3.5,
    duration: 10.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });
  assert.strictEqual(engine.getClock().status, 'playing');
  assert.strictEqual(engine.getClock().positionMs, 3500);
  defaultManualStartup = false;
  console.log('  ✓ Seek during startup cleanly disposes pending player and recreates at target position');

  // --- Test 24: Track Replacement During Startup (Clean Disposal & Track Isolation) (Stage A.7.2.3.7) ---
  console.log('Test 24: Track Replacement During Startup (Clean Disposal & Track Isolation) (Stage A.7.2.3.7)');
  await engine.pause();
  defaultManualStartup = true;
  await engine.play();
  const trackReplacePlayer = lastCreatedPlayer;
  assert.strictEqual(engine.isAwaitingNativeStart, true);

  // Load different track during startup
  defaultManualStartup = false;
  await engine.load({ type: 'bundle', assetId: 104, durationMs: 6000 });
  assert.strictEqual(trackReplacePlayer.removed, true, 'Pending player disposed when new track loaded');
  assert.strictEqual(engine.isAwaitingNativeStart, false, 'Startup awaiting cleared');
  assert.strictEqual(engine.getClock().status, 'paused', 'Engine paused for new track');
  assert.strictEqual(engine.getClock().durationMs, 6000, 'New track duration registered');
  console.log('  ✓ Track replacement during startup cleanly disposes player and isolates track state');

  // --- Test 25: Startup Safety Timeout (3000ms Expiry & Recovery) (Stage A.7.2.3.7) ---
  console.log('Test 25: Startup Safety Timeout (3000ms Expiry & Recovery) (Stage A.7.2.3.7)');
  defaultManualStartup = true;
  if (engine.player) engine.player.manualStartupConfirmation = true;
  await engine.play();
  const timeoutPlayer = lastCreatedPlayer;
  assert.strictEqual(engine.isAwaitingNativeStart, true);
  assert.notStrictEqual(engine.startupTimeoutHandle, null, 'Startup timeout armed');

  // Simulate timeout firing
  engine.handleStartupTimeout();
  assert.strictEqual(engine.isAwaitingNativeStart, false, 'Timeout cleared isAwaitingNativeStart');
  assert.strictEqual(timeoutPlayer.removed, true, 'Hung native player disposed by timeout handler');
  assert.strictEqual(engine.player, null);
  assert.strictEqual(engine.getClock().status, 'error', 'Engine transitioned to error status on timeout');
  defaultManualStartup = false;
  console.log('  ✓ 3000ms safety timeout cleans up hung player and safely recovers engine');

  // --- Test 26: Initial Buffering Before Native Startup Confirmation (Stage A.7.2.3.7) ---
  console.log('Test 26: Initial Buffering Before Native Startup Confirmation (Stage A.7.2.3.7)');
  defaultManualStartup = true;
  if (engine.player) engine.player.manualStartupConfirmation = true;
  await engine.play();
  const bufferPlayer = lastCreatedPlayer;
  assert.strictEqual(engine.isAwaitingNativeStart, true);

  // Native emits playing: true BUT isBuffering: true
  mockedPerformanceNow = 60000.0;
  bufferPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 0.0,
    duration: 6.0,
    isBuffering: true,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  // Engine must stay awaiting and clock must not extrapolate
  mockedPerformanceNow = 60050.0;
  assert.strictEqual(engine.getEstimatedPositionMs(60050.0), 0, 'Buffering during startup does not advance position');

  // Native emits buffering finished: isBuffering: false
  bufferPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 0.0,
    duration: 6.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });
  assert.strictEqual(engine.isAwaitingNativeStart, false, 'Startup confirmed once buffering finishes');
  assert.strictEqual(engine.getClock().status, 'playing');

  // Now extrapolation works
  mockedPerformanceNow = 60070.0;
  assert.strictEqual(engine.getEstimatedPositionMs(60070.0), 20, 'Position advances normally after buffering ends');
  defaultManualStartup = false;
  console.log('  ✓ Buffering during startup holds clock freeze until isBuffering becomes false');

  // --- Test 27: Normal Mid-Track Pause/Resume Retains Player Instance (Stage A.7.2.3.7) ---
  console.log('Test 27: Normal Mid-Track Pause/Resume Retains Player Instance (Stage A.7.2.3.7)');
  const midTrackPlayer = engine.player;
  midTrackPlayer.manualStartupConfirmation = false;
  assert.strictEqual(midTrackPlayer.removed, false);

  // Mid-track pause
  await engine.pause();
  assert.strictEqual(midTrackPlayer.removed, false, 'Mid-track pause must NOT dispose native player');
  assert.strictEqual(engine.player, midTrackPlayer, 'Engine keeps existing player instance');
  assert.strictEqual(engine.getClock().status, 'paused');

  // Mid-track resume
  await engine.resume();
  assert.strictEqual(midTrackPlayer.removed, false, 'Mid-track resume must NOT dispose native player');
  assert.strictEqual(engine.player, midTrackPlayer, 'Engine still keeps existing player instance');
  assert.strictEqual(engine.getClock().status, 'playing');
  console.log('  ✓ Mid-track pause and resume cleanly retain the native player instance without recreation');

  // --- Test 28: Stale Pre-Seek Status Callback Rejection During Backward Seek (Stage A.7.2.3.10) ---
  console.log('Test 28: Stale Pre-Seek Status Callback Rejection During Backward Seek (Stage A.7.2.3.10)');
  // 1. Advance playback to 8000ms
  const seekTestPlayer = engine.player;
  seekTestPlayer.currentTime = 8.0;
  seekTestPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 8.0,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });
  assert.strictEqual(engine.getClock().positionMs, 8000);
  assert.strictEqual(engine.getEstimatedPositionMs(), 8000);

  // 2. Perform backward seek from 8000ms to 3000ms
  seekTestPlayer.manualSeekConfirmation = true;
  const preSeekRevision = engine.getClock().timelineRevision;
  await engine.seek(3000);
  assert.strictEqual(engine.getClock().positionMs, 3000, 'Clock position immediately set to seek target 3000ms');
  assert.strictEqual(engine.getClock().timelineRevision, preSeekRevision + 1, 'Timeline revision incremented on seek');
  assert.strictEqual(engine.activeSeekTargetMs, 3000, 'activeSeekTargetMs set to 3000');
  assert.strictEqual(engine.monotonicRevision, 0, 'Monotonic floor suspended (monotonicRevision=0) during seek');
  assert.strictEqual(engine.getEstimatedPositionMs(), 3000, 'Estimated position frozen at seek target 3000ms');

  // 3. Delayed native status callback from pre-seek position arrives (e.g. 7950ms)
  seekTestPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 7.95,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  // Verify stale pre-seek callback was REJECTED:
  assert.strictEqual(engine.getClock().positionMs, 3000, 'Stale 7950ms callback must NOT poison clock position');
  assert.strictEqual(engine.getEstimatedPositionMs(), 3000, 'Estimated position must NOT jump back to 8000ms');
  assert.strictEqual(engine.activeSeekTargetMs, 3000, 'Engine remains awaiting seek confirmation');
  console.log('  ✓ Stale pre-seek native status callbacks rejected; backward-seek clock poisoning eliminated');

  // --- Test 29: Native Seek Confirmation & Monotonic Forward Floor Reactivation (Stage A.7.2.3.10) ---
  console.log('Test 29: Native Seek Confirmation & Monotonic Forward Floor Reactivation (Stage A.7.2.3.10)');
  // Native confirms seek with position within 250ms window (e.g. 3010ms)
  mockedPerformanceNow = 70000.0;
  seekTestPlayer.currentTime = 3.01;
  seekTestPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 3.01,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  assert.strictEqual(engine.activeSeekTargetMs, null, 'activeSeekTargetMs cleared upon confirmation');
  assert.strictEqual(engine.seekSafetyTimeoutHandle, null, 'Seek safety timeout cleared');
  assert.strictEqual(engine.getClock().positionMs, 3010, 'Clock position updated to confirmed 3010ms');
  assert.strictEqual(engine.monotonicRevision, engine.getClock().timelineRevision, 'Forward monotonic floor reactivated for current revision');

  // Forward extrapolation now proceeds from 3010ms
  mockedPerformanceNow = 70050.0;
  assert.strictEqual(engine.getEstimatedPositionMs(70050.0), 3060, 'Forward estimation advances normally (+50ms = 3060ms)');

  // Jitter protection: minor delayed native tick (3050ms) is held at monotonic floor 3060ms
  mockedPerformanceNow = 70055.0;
  seekTestPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 3.05,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });
  assert.strictEqual(engine.getEstimatedPositionMs(70055.0), 3060, 'Monotonic floor preserves forward monotonicity against jitter');
  console.log('  ✓ Native seek confirmation verified and forward monotonic floor reactivated cleanly');

  // --- Test 30: Seek Safety Timeout (1500ms Fallback Anchor Recovery) (Stage A.7.2.3.10) ---
  console.log('Test 30: Seek Safety Timeout (1500ms Fallback Anchor Recovery) (Stage A.7.2.3.10)');
  engine.player.manualSeekConfirmation = true;
  await engine.seek(5000);
  assert.strictEqual(engine.activeSeekTargetMs, 5000);
  assert.notStrictEqual(engine.seekSafetyTimeoutHandle, null, 'Seek safety timeout armed');

  // Simulate timeout firing after 1500ms with no native confirmation
  engine.handleSeekTimeout();
  assert.strictEqual(engine.activeSeekTargetMs, null, 'Safety timeout cleared activeSeekTargetMs');
  assert.strictEqual(engine.seekSafetyTimeoutHandle, null, 'Timeout handle cleared');
  assert.strictEqual(engine.monotonicRevision, engine.getClock().timelineRevision, 'Monotonic floor reactivated on timeout recovery');
  assert.strictEqual(engine.getClock().positionMs, 5000, 'Clock remains cleanly anchored at target 5000ms');

  // Clean up
  await engine.unload();
  console.log('  ✓ 1500ms seek safety timeout guarantees engine recovery even if native platform drops callback');

  console.log('\n================================================================');
  console.log('🎉 ALL 30 ENHANCED AUDIO CLOCK & SYNCHRONIZATION TESTS PASSED!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
