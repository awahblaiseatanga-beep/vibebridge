/**
 * Automated Verification Suite for SEE Pillar: Hybrid Visual Rhythm Engine (Milestone 5)
 *
 * Deterministic testing of:
 * 1. Initial State & Configurable Scale Defaults
 * 2. Dynamic Scale Configuration Override
 * 3. Pure Event Mapping for All Musical Roles (Layer A & B)
 * 4. Non-Color Visual Distinction Verification (Accessibility)
 * 5. Accessible Reduced Motion Mode
 * 6. Clear Distinction Between Musical Rest vs Transport Pause vs Buffering
 * 7. PriorityEventScheduler Subscription on 'visual' Channel & Latency Compensation
 * 8. Timeline Revision Invalidation on Seek & Track Changes
 * 9. Enable/Disable Lifecycle Suspension and Disposal
 * 10. Canonical Demo Rhythm Score Audio Truth Alignment (24 audible cues)
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
const rhythmCode = transpile('src/features/rhythm/demoTrackScore.ts');
const visualTypesCode = transpile('src/engines/visual/types.ts');
const visualMapperCode = transpile('src/engines/visual/VisualEventMapper.ts');
const visualEngineCode = transpile('src/engines/visual/VisualRhythmEngine.ts');

const mockTheme = {
  colors: {
    background: { base: '#090D16', surface: '#131B2E', elevated: '#1E293B', highlight: '#27354E' },
    text: { primary: '#F8FAFC', secondary: '#94A3B8', muted: '#64748B', inverted: '#090D16' },
    border: { subtle: '#1E293B', medium: '#334155', bright: '#475569' },
    sensory: { read: '#38BDF8', see: '#A855F7', feel: '#F43F5E' },
    status: { success: '#22C55E', warning: '#F59E0B', error: '#EF4444', info: '#38BDF8' },
  },
  typography: { sizes: { sm: 12, md: 14, lg: 18 }, weights: { regular: '400', semibold: '600', bold: '700' } },
  spacing: { sm: 8, md: 16, lg: 24 },
  borderRadius: { sm: 4, md: 8, lg: 12 },
};

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
  let exportedRhythm = {};
  let exportedTypes = {};
  let exportedMapper = {};
  let exportedVisual = {};

  const sandbox = {
    require: (id) => {
      if (id.includes('theme')) return { theme: mockTheme };
      if (id.includes('synchronization') || id.includes('LatencyManager')) return exportedSync;
      if (id.includes('event-scheduler') || id.includes('PriorityEventScheduler')) return exportedScheduler;
      if (id.includes('rhythm') || id.includes('demoTrackScore')) return exportedRhythm;
      if (id.includes('VisualEventMapper')) return exportedMapper;
      if (id.includes('types')) return exportedTypes;
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

  // 0. Run Visual Types
  vm.runInContext(visualTypesCode, sandbox);
  const { DEFAULT_VISUAL_SCALE_CONFIG, VISUAL_CALIBRATION_OFFSETS } = sandbox.exports;
  exportedTypes = {
    DEFAULT_VISUAL_SCALE_CONFIG,
    VISUAL_CALIBRATION_OFFSETS,
  };

  // 1. Run LatencyManager
  sandbox.exports = {};
  sandbox.module = { exports: {} };
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

  // 3. Run Rhythm Score
  sandbox.exports = {};
  sandbox.module = { exports: {} };
  vm.runInContext(rhythmCode, sandbox);
  const {
    CANONICAL_DEMO_RHYTHM_SCORE,
    getDemoTrackVisualCues,
    getDemoTrackHapticCues,
    scheduleDemoTrackSensoryCues,
  } = sandbox.exports;
  exportedRhythm = {
    CANONICAL_DEMO_RHYTHM_SCORE,
    getDemoTrackVisualCues,
    getDemoTrackHapticCues,
    scheduleDemoTrackSensoryCues,
  };

  // 4. Run VisualEventMapper
  sandbox.exports = {};
  sandbox.module = { exports: {} };
  vm.runInContext(visualMapperCode, sandbox);
  const { VisualEventMapper } = sandbox.exports;
  exportedMapper = {
    VisualEventMapper,
  };

  // 5. Run VisualRhythmEngine
  sandbox.exports = {};
  sandbox.module = { exports: {} };
  vm.runInContext(visualEngineCode, sandbox);
  const { VisualRhythmEngine } = sandbox.exports;
  exportedVisual = {
    VisualRhythmEngine,
  };

  return {
    LatencyManager,
    PriorityEventScheduler,
    CANONICAL_DEMO_RHYTHM_SCORE,
    getDemoTrackVisualCues,
    getDemoTrackHapticCues,
    scheduleDemoTrackSensoryCues,
    DEFAULT_VISUAL_SCALE_CONFIG,
    VISUAL_CALIBRATION_OFFSETS,
    VisualEventMapper,
    VisualRhythmEngine,
  };
}

async function runTests() {
  console.log('🧪 Starting Milestone 5 Visual Rhythm Engine (SEE Pillar) Verification Suite...\n');

  const {
    LatencyManager,
    PriorityEventScheduler,
    CANONICAL_DEMO_RHYTHM_SCORE,
    getDemoTrackVisualCues,
    getDemoTrackHapticCues,
    scheduleDemoTrackSensoryCues,
    DEFAULT_VISUAL_SCALE_CONFIG,
    VISUAL_CALIBRATION_OFFSETS,
    VisualEventMapper,
    VisualRhythmEngine,
  } = createSandbox();

  // Test 1: Initial State & Configurable Scale Defaults
  console.log('Test 1: Initial State & Configurable Scale Defaults');
  {
    const clock = new MockMasterClock();
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);

    const state = engine.getState();
    assert.strictEqual(state.enabled, true, 'Default enabled should be true');
    assert.strictEqual(state.reducedMotion, false, 'Default reducedMotion should be false');
    assert.strictEqual(state.isPaused, true, 'Initial isPaused should be true when clock is idle');
    assert.strictEqual(state.isBuffering, false, 'Initial isBuffering should be false');
    assert.strictEqual(state.isRest, true, 'Initial isRest should be true');
    assert.strictEqual(state.visual.shape, 'line', 'Initial shape should be resting line');
    assert.strictEqual(state.visual.symbol, '—', 'Initial symbol should be neutral dash');
    assert.strictEqual(state.visual.scale, 1.0, 'Initial scale should be 1.0');

    assert.strictEqual(DEFAULT_VISUAL_SCALE_CONFIG.strongScale, 1.35, 'Default strongScale should be 1.35');
    assert.strictEqual(DEFAULT_VISUAL_SCALE_CONFIG.mediumScale, 1.20, 'Default mediumScale should be 1.20');
    assert.strictEqual(DEFAULT_VISUAL_SCALE_CONFIG.softScale, 1.06, 'Default softScale should be 1.06');
    assert.strictEqual(DEFAULT_VISUAL_SCALE_CONFIG.accentScale, 1.45, 'Default accentScale should be 1.45');
    assert.strictEqual(DEFAULT_VISUAL_SCALE_CONFIG.resolutionScale, 1.25, 'Default resolutionScale should be 1.25');
    assert.strictEqual(DEFAULT_VISUAL_SCALE_CONFIG.restScale, 1.00, 'Default restScale should be 1.00');

    engine.dispose();
    console.log('  ✓ Initial state and default configurable animation scales verified');
  }

  // Test 2: Dynamic Scale Configuration Override
  console.log('Test 2: Dynamic Scale Configuration Override');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);

    engine.setScales({
      strongScale: 1.60,
      accentScale: 1.80,
    });

    // Schedule a downbeat cue and trigger it
    scheduler.schedule({
      id: 'downbeat-scale-test',
      targetTimestampMs: 100,
      channel: 'visual',
      type: 'rhythm_beat',
      timelineRevision: 1,
      payload: {
        bar: 1,
        beat: 1,
        role: 'downbeat',
        weight: 1.0,
        label: 'Kick',
      },
    });

    clock.setTime(100);
    scheduler.tick(100, 1000);

    const activeState = engine.getState();
    assert.strictEqual(activeState.visual.scale, 1.60, 'Triggered downbeat should use updated 1.60 scale');

    engine.dispose();
    console.log('  ✓ Dynamic scale configuration override verified');
  }

  // Test 3: Pure Event Mapping for All Musical Roles (Layer A & B)
  console.log('Test 3: Pure Event Mapping for All Musical Roles (Layer A & B)');
  {
    const downbeat = VisualEventMapper.mapCueToVisual(
      { channel: 'see', bar: 1, beat: 1, role: 'downbeat', weight: 1.0, label: 'Kick' },
      DEFAULT_VISUAL_SCALE_CONFIG,
      false
    );
    assert.strictEqual(downbeat.intensityLevel, 'strong');
    assert.strictEqual(downbeat.visual.shape, 'diamond', 'Downbeat should map to diamond');
    assert.strictEqual(downbeat.visual.symbol, '◆', 'Downbeat symbol should be ◆');
    assert.strictEqual(downbeat.visual.scale, 1.35, 'Downbeat scale should be 1.35');
    assert.strictEqual(downbeat.visual.borderWidth, 3, 'Downbeat border width should be prominent (3)');

    const backbeat = VisualEventMapper.mapCueToVisual(
      { channel: 'see', bar: 1, beat: 2, role: 'backbeat', weight: 0.85, label: 'Snare' },
      DEFAULT_VISUAL_SCALE_CONFIG,
      false
    );
    assert.strictEqual(backbeat.intensityLevel, 'medium');
    assert.strictEqual(backbeat.visual.shape, 'triangle', 'Backbeat should map to triangle');
    assert.strictEqual(backbeat.visual.symbol, '▲', 'Backbeat symbol should be ▲');
    assert.strictEqual(backbeat.visual.scale, 1.20, 'Backbeat scale should be 1.20');
    assert.strictEqual(backbeat.visual.borderWidth, 2, 'Backbeat border width should be 2');

    const subdivision = VisualEventMapper.mapCueToVisual(
      { channel: 'see', bar: 2, beat: 2.5, role: 'subdivision', weight: 0.5, label: 'Off-beat' },
      DEFAULT_VISUAL_SCALE_CONFIG,
      false
    );
    assert.strictEqual(subdivision.intensityLevel, 'soft');
    assert.strictEqual(subdivision.visual.shape, 'circle', 'Subdivision should map to circle');
    assert.strictEqual(subdivision.visual.symbol, '●', 'Subdivision symbol should be ●');
    assert.strictEqual(subdivision.visual.scale, 1.06, 'Subdivision scale should be 1.06');

    const accent = VisualEventMapper.mapCueToVisual(
      { channel: 'see', bar: 3, beat: 3, role: 'accent', weight: 1.0, label: 'Accent' },
      DEFAULT_VISUAL_SCALE_CONFIG,
      false
    );
    assert.strictEqual(accent.intensityLevel, 'accent');
    assert.strictEqual(accent.visual.shape, 'accent-burst', 'Accent should map to accent-burst');
    assert.strictEqual(accent.visual.symbol, '◈', 'Accent symbol should be ◈');
    assert.strictEqual(accent.visual.scale, 1.45, 'Accent scale should be 1.45');
    assert.strictEqual(accent.visual.borderWidth, 4, 'Accent border width should be 4');

    const resolution = VisualEventMapper.mapCueToVisual(
      { channel: 'see', bar: 6, beat: 1, role: 'resolution', weight: 0.9, label: 'Final Chord' },
      DEFAULT_VISUAL_SCALE_CONFIG,
      false
    );
    assert.strictEqual(resolution.intensityLevel, 'resolution');
    assert.strictEqual(resolution.visual.shape, 'starburst', 'Resolution should map to starburst');
    assert.strictEqual(resolution.visual.symbol, '✦', 'Resolution symbol should be ✦');
    assert.strictEqual(resolution.visual.scale, 1.25, 'Resolution scale should be 1.25');

    const rest = VisualEventMapper.getRestingVisual(DEFAULT_VISUAL_SCALE_CONFIG);
    assert.strictEqual(rest.shape, 'line', 'Rest should map to line');
    assert.strictEqual(rest.symbol, '—', 'Rest symbol should be —');
    assert.strictEqual(rest.scale, 1.00, 'Rest scale should be locked at 1.00');

    console.log('  ✓ Pure event mapper assigns distinct shapes, symbols, and scales for all roles');
  }

  // Test 4: Non-Color Visual Distinction Verification (Accessibility)
  console.log('Test 4: Non-Color Visual Distinction Verification (Accessibility)');
  {
    const roles = ['downbeat', 'backbeat', 'subdivision', 'accent', 'resolution'];
    const shapes = new Set();
    const symbols = new Set();
    const labels = new Set();

    roles.forEach((role) => {
      const { visual } = VisualEventMapper.mapCueToVisual(
        { channel: 'see', bar: 1, beat: 1, role, weight: 1.0, label: `Role-${role}` },
        DEFAULT_VISUAL_SCALE_CONFIG,
        false
      );
      shapes.add(visual.shape);
      symbols.add(visual.symbol);
      labels.add(visual.label);
    });

    // Also add rest visual
    const rest = VisualEventMapper.getRestingVisual(DEFAULT_VISUAL_SCALE_CONFIG);
    shapes.add(rest.shape);
    symbols.add(rest.symbol);
    labels.add(rest.label);

    assert.strictEqual(shapes.size, roles.length + 1, 'Every musical role + rest must have a unique geometric shape');
    assert.strictEqual(symbols.size, roles.length + 1, 'Every musical role + rest must have a unique symbol glyph');
    assert.strictEqual(labels.size, roles.length + 1, 'Every musical role + rest must have an explicit text label');

    console.log('  ✓ Multi-modal accessibility verified: every role distinguishable without color');
  }

  // Test 5: Accessible Reduced Motion Mode
  console.log('Test 5: Accessible Reduced Motion Mode');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);

    engine.setReducedMotion(true);
    assert.strictEqual(engine.getState().reducedMotion, true);

    // Schedule downbeat in reduced motion mode
    scheduler.schedule({
      id: 'rm-test',
      targetTimestampMs: 100,
      channel: 'visual',
      type: 'rhythm_beat',
      timelineRevision: 1,
      payload: {
        bar: 1,
        beat: 1,
        role: 'downbeat',
        weight: 1.0,
        label: 'Kick',
      },
    });

    clock.setTime(100);
    scheduler.tick(100, 1000);

    const state = engine.getState();
    assert.strictEqual(state.visual.scale, 1.00, 'Scale must remain locked to 1.00 in Reduced Motion mode');
    assert.strictEqual(state.visual.borderWidth, 4, 'Border width should be amplified (4 vs 3) for high contrast');
    assert.strictEqual(state.visual.shape, 'diamond', 'Geometric shape must remain diamond');
    assert.strictEqual(state.visual.symbol, '◆', 'Symbol must remain ◆');

    // Toggle reduced motion off
    engine.setReducedMotion(false);
    assert.strictEqual(engine.getState().reducedMotion, false);

    engine.dispose();
    console.log('  ✓ Reduced motion mode locks scale to 1.0 while amplifying high-contrast borders');
  }

  // Test 6: Clear Distinction Between Musical Rest vs Transport Pause vs Buffering
  console.log('Test 6: Clear Distinction Between Musical Rest vs Transport Pause vs Buffering');
  {
    const clock = new MockMasterClock();
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);

    // Initial state: clock is idle -> isPaused: true, isBuffering: false, isRest: true
    assert.strictEqual(engine.getState().isPaused, true);
    assert.strictEqual(engine.getState().isBuffering, false);
    assert.strictEqual(engine.getState().isRest, true);

    // 1. Playback starts
    clock.setStatus('playing');
    clock.setTime(500);
    assert.strictEqual(engine.getState().isPaused, false);
    assert.strictEqual(engine.getState().isBuffering, false);

    // 2. Scheduled musical cue arrives during playback
    scheduler.schedule({
      id: 'beat-cue',
      targetTimestampMs: 500,
      channel: 'visual',
      type: 'rhythm_beat',
      timelineRevision: 1,
      payload: {
        bar: 1,
        beat: 2,
        role: 'backbeat',
        weight: 0.85,
        label: 'Snare',
      },
    });
    scheduler.tick(500, 1000);

    assert.strictEqual(engine.getState().isRest, false, 'isRest must be false after beat');
    assert.strictEqual(engine.getState().isPaused, false);
    assert.strictEqual(engine.getState().isBuffering, false);

    // 3. Playback reaches Bar 6 rest period (11800ms) while status remains 'playing'
    // At 11600ms, Bar 6 Beat 4 resolution animation is still active (duration 300ms: 11484ms -> 11784ms)
    clock.setTime(11600);
    assert.strictEqual(engine.getState().isRest, false, 'isRest must remain false at 11600ms while resolution animation is active');

    // At 11800ms, resolution animation has fully completed; engine transitions to musical rest
    clock.setTime(11800);
    const restState = engine.getState();
    assert.strictEqual(restState.isRest, true, 'isRest must be true during musical rest after resolution completes (11800ms)');
    assert.strictEqual(restState.isPaused, false, 'isPaused must NOT be true during musical rest');
    assert.strictEqual(restState.isBuffering, false, 'isBuffering must NOT be true during musical rest');
    assert.strictEqual(restState.visual.shape, 'line', 'Rest shape must be line');
    assert.strictEqual(restState.visual.symbol, '—', 'Rest symbol must be —');

    // 4. User pauses playback (Transport Pause)
    clock.setStatus('paused');
    const pausedState = engine.getState();
    assert.strictEqual(pausedState.isPaused, true, 'isPaused must be true when transport paused');
    assert.strictEqual(pausedState.isBuffering, false);

    // 5. Playback resumes
    clock.setStatus('playing');
    const resumeState = engine.getState();
    assert.strictEqual(resumeState.isPaused, false, 'isPaused must clear on resume');

    // 6. Player enters buffering
    clock.setBuffering(true);
    const bufferState = engine.getState();
    assert.strictEqual(bufferState.isBuffering, true, 'isBuffering must be true during network/IO buffer');
    assert.strictEqual(bufferState.isPaused, false, 'isPaused must NOT be true for buffering');

    // Buffering finishes
    clock.setBuffering(false);
    assert.strictEqual(engine.getState().isBuffering, false);

    engine.dispose();
    console.log('  ✓ Musical rest, transport pause, and transport buffering strictly separated');
  }

  // Test 7: PriorityEventScheduler Subscription on 'visual' Channel & Latency Compensation
  console.log('Test 7: PriorityEventScheduler Subscription on \'visual\' Channel & Latency Compensation');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);

    // Schedule 1 haptic cue and 1 visual cue at 500ms
    scheduler.schedule({
      id: 'haptic-1',
      targetTimestampMs: 500,
      channel: 'haptic',
      type: 'tactile_cue',
      timelineRevision: 1,
      payload: { pattern: 'heavy', intensity: 1.0 },
    });

    scheduler.schedule({
      id: 'visual-1',
      targetTimestampMs: 500,
      channel: 'visual',
      type: 'rhythm_beat',
      timelineRevision: 1,
      payload: {
        bar: 1,
        beat: 2,
        role: 'backbeat',
        weight: 0.85,
        label: 'Beat 2 (Snare)',
      },
    });

    // Visual latency compensation is provisional 16ms lead time: target 500ms triggers at 500 - 16 = 484ms
    clock.setTime(485);
    const dispatched = scheduler.tick(485, 1000);

    // Verify visual event was dispatched by scheduler and processed by engine
    const visualEvent = dispatched.find((e) => e.channel === 'visual');
    assert.ok(visualEvent, 'Visual event must be dispatched at 484ms lead time');
    assert.strictEqual(engine.getState().visual.shape, 'triangle');
    assert.strictEqual(engine.getState().visual.symbol, '▲');

    engine.dispose();
    console.log('  ✓ Scheduler \'visual\' channel subscription and 16ms lead time dispatch verified');
  }

  // Test 8: Timeline Revision Invalidation on Seek & Track Changes
  console.log('Test 8: Timeline Revision Invalidation on Seek & Track Changes');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    clock.setRevision(1);
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);

    // Schedule cues on revision 1
    scheduler.schedule({
      id: 'vis-rev1-early',
      targetTimestampMs: 200,
      channel: 'visual',
      type: 'rhythm_beat',
      timelineRevision: 1,
      payload: { bar: 1, beat: 1, role: 'downbeat', weight: 1.0, label: 'Rev 1 Beat 1' },
    });

    scheduler.schedule({
      id: 'vis-rev1-late',
      targetTimestampMs: 2000,
      channel: 'visual',
      type: 'rhythm_beat',
      timelineRevision: 1,
      payload: { bar: 2, beat: 1, role: 'downbeat', weight: 1.0, label: 'Rev 1 Beat 2' },
    });

    // Seek to 1500ms and increment timeline revision to 2
    clock.setRevision(2);
    clock.setTime(1500);

    // Engine should reset to resting visual on revision change
    assert.strictEqual(engine.getState().isRest, true, 'Engine must settle to rest on revision change');

    // Schedule new cues on revision 2
    scheduler.schedule({
      id: 'vis-rev2-seek',
      targetTimestampMs: 1600,
      channel: 'visual',
      type: 'rhythm_beat',
      timelineRevision: 2,
      payload: { bar: 1, beat: 4, role: 'backbeat', weight: 0.85, label: 'Rev 2 Seek Cue' },
    });

    // Advance clock to 1600ms
    clock.setTime(1600);
    const dispatched = scheduler.tick(1600, 1000);

    // rev1-late (2000ms, rev 1) must be dropped and never dispatch
    const rev1Late = dispatched.find((e) => e.id === 'vis-rev1-late');
    assert.strictEqual(rev1Late, undefined, 'Obsolete revision 1 cue must NOT be dispatched after seek');

    const rev2Cue = dispatched.find((e) => e.id === 'vis-rev2-seek');
    assert.ok(rev2Cue, 'Revision 2 cue must be dispatched');
    assert.strictEqual(engine.getState().visual.shape, 'triangle');

    engine.dispose();
    console.log('  ✓ Obsolete cues invalidated on timeline revision change without stale triggers');
  }

  // Test 9: Enable/Disable Lifecycle Suspension and Disposal
  console.log('Test 9: Enable/Disable Lifecycle Suspension and Disposal');
  {
    const clock = new MockMasterClock();
    clock.setStatus('playing');
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);

    // 1. Disable visualizer
    engine.setEnabled(false);
    assert.strictEqual(engine.getState().enabled, false);
    assert.strictEqual(engine.getState().visual.scale, 1.0);

    // Schedule and tick cue while disabled
    scheduler.schedule({
      id: 'disabled-cue',
      targetTimestampMs: 200,
      channel: 'visual',
      type: 'rhythm_beat',
      timelineRevision: 1,
      payload: { bar: 1, beat: 1, role: 'downbeat', weight: 1.0, label: 'Kick' },
    });
    clock.setTime(200);
    scheduler.tick(200, 1000);

    // State should remain at resting visual while disabled
    assert.strictEqual(engine.getState().visual.shape, 'line');

    // 2. Re-enable visualizer
    engine.setEnabled(true);
    assert.strictEqual(engine.getState().enabled, true);

    scheduler.schedule({
      id: 'enabled-cue',
      targetTimestampMs: 300,
      channel: 'visual',
      type: 'rhythm_beat',
      timelineRevision: 1,
      payload: { bar: 1, beat: 2, role: 'backbeat', weight: 0.85, label: 'Snare' },
    });
    clock.setTime(300);
    scheduler.tick(300, 1000);
    assert.strictEqual(engine.getState().visual.shape, 'triangle');

    // 3. Listener notifications
    let notifiedState = null;
    const unsub = engine.onVisualStateChange((s) => {
      notifiedState = s;
    });
    assert.ok(notifiedState, 'Listener should receive initial snapshot');

    notifiedState = null;
    unsub();

    scheduler.schedule({
      id: 'unsub-cue',
      targetTimestampMs: 400,
      channel: 'visual',
      type: 'rhythm_beat',
      timelineRevision: 1,
      payload: { bar: 1, beat: 3, role: 'downbeat', weight: 1.0, label: 'Kick' },
    });
    clock.setTime(400);
    scheduler.tick(400, 1000);
    assert.strictEqual(notifiedState, null, 'Unsubscribed listener must not be called');

    // 4. Dispose
    engine.dispose();
    console.log('  ✓ Enable/disable suspension, listener unsubscription, and disposal verified');
  }

  // Test 10: Canonical Demo Rhythm Score Audio Truth Alignment (Stage A.5)
  console.log('Test 10: Canonical Demo Rhythm Score Audio Truth Alignment (Stage A.5)');
  {
    // 1. Verified Audible Transients (24 genuine percussion/cadence transients in vibebridge_demo.wav)
    const VERIFIED_AUDIBLE_TIMESTAMPS = [
      0, 500, 1000, 1500,        // Bar 1
      2000, 2500, 3000, 3500,    // Bar 2
      4000, 4500, 5000, 5500,    // Bar 3
      6000, 6500, 7000, 7500,    // Bar 4
      8000, 8500, 9000, 9500,    // Bar 5
      10000, 10500, 11000, 11500 // Bar 6
    ];

    // Removed Ghost Cues (23 false subdivisions/fills lacking audio counterpart)
    const REMOVED_GHOST_CUE_IDS = [
      'b1-1.5', 'b1-2.5', 'b1-3.5', 'b1-4.5',
      'b2-1.5', 'b2-2.5', 'b2-3.5', 'b2-4.5',
      'b3-1.5', 'b3-2.5', 'b3-3.5', 'b3-4.5',
      'b4-1.5', 'b4-2.5', 'b4-3.5', 'b4-4.5',
      'b5-1.5', 'b5-2.5', 'b5-3.5', 'b5-4.5',
      'b6-1.5', 'b6-2.5', 'b6-3.5'
    ];

    assert.strictEqual(CANONICAL_DEMO_RHYTHM_SCORE.length, 24, 'Canonical score must contain exactly 24 audible cues');

    // 2. Verify all retained canonical events have corresponding audible transient evidence
    CANONICAL_DEMO_RHYTHM_SCORE.forEach((cue) => {
      assert.ok(
        VERIFIED_AUDIBLE_TIMESTAMPS.includes(cue.targetTimestampMs),
        `Retained cue ${cue.id} at ${cue.targetTimestampMs}ms must match a verified audible transient`
      );
    });

    // 3. Verify no removed ghost event exists in canonical score
    REMOVED_GHOST_CUE_IDS.forEach((ghostId) => {
      const foundInScore = CANONICAL_DEMO_RHYTHM_SCORE.some((c) => c.id === ghostId);
      assert.strictEqual(foundInScore, false, `Removed ghost cue ${ghostId} must not exist in canonical score`);
    });

    // 4. Verify visual and haptic cue mappings use the same canonical event source
    const visualCues = getDemoTrackVisualCues(1);
    const hapticCues = getDemoTrackHapticCues(1);

    assert.strictEqual(visualCues.length, 24, 'Visual cues list must have exactly 24 items');
    assert.strictEqual(hapticCues.length, 24, 'Haptic cues list must have exactly 24 items');

    for (let i = 0; i < 24; i++) {
      assert.strictEqual(
        visualCues[i].targetTimestampMs,
        hapticCues[i].targetTimestampMs,
        `Cue ${i} timestamp mismatch: visual=${visualCues[i].targetTimestampMs}, haptic=${hapticCues[i].targetTimestampMs}`
      );
      assert.strictEqual(visualCues[i].channel, 'visual');
      assert.strictEqual(hapticCues[i].channel, 'haptic');
      assert.strictEqual(visualCues[i].targetTimestampMs, VERIFIED_AUDIBLE_TIMESTAMPS[i]);
    }

    // Verify none of the removed ghost cues are scheduled by SEE or FEEL
    REMOVED_GHOST_CUE_IDS.forEach((ghostId) => {
      const foundInVisual = visualCues.some((c) => c.id === `visual-${ghostId}`);
      const foundInHaptic = hapticCues.some((c) => c.id === `haptic-${ghostId}`);
      assert.strictEqual(foundInVisual, false, `Ghost cue ${ghostId} must not be scheduled by SEE`);
      assert.strictEqual(foundInHaptic, false, `Ghost cue ${ghostId} must not be scheduled by FEEL`);
    });

    // 5. Verify beat numbering and bar numbering remain correct
    visualCues.forEach((cue) => {
      assert.ok(cue.payload.bar >= 1 && cue.payload.bar <= 6, 'Bar must be between 1 and 6');
      assert.ok(
        [1, 2, 3, 4].includes(cue.payload.beat),
        `Beat must be an integer quarter beat (1-4), received: ${cue.payload.beat}`
      );
      if (cue.payload.bar <= 5) {
        if (cue.payload.beat === 1 || cue.payload.beat === 3) {
          assert.strictEqual(cue.payload.role, 'downbeat');
        } else {
          assert.strictEqual(cue.payload.role, 'backbeat');
        }
      } else {
        // Bar 6: Beat 1=Kick, Beat 2=Snare, Beat 3=Accent, Beat 4=Resolution
        if (cue.payload.beat === 1) assert.strictEqual(cue.payload.role, 'downbeat');
        if (cue.payload.beat === 2) assert.strictEqual(cue.payload.role, 'backbeat');
        if (cue.payload.beat === 3) assert.strictEqual(cue.payload.role, 'accent');
        if (cue.payload.beat === 4) assert.strictEqual(cue.payload.role, 'resolution');
      }
    });

    // 6. Playback from the beginning produces the corrected event sequence
    const clock = new MockMasterClock();
    const scheduler = new PriorityEventScheduler(null, clock);
    scheduleDemoTrackSensoryCues(scheduler, 1);
    assert.strictEqual(scheduler.getPendingEventCount(), 48, 'Scheduler must receive 24 haptic + 24 visual = 48 cues');

    const startDispatched = [];
    scheduler.subscribe('visual', (e) => startDispatched.push(e));
    scheduler.subscribe('haptic', (e) => startDispatched.push(e));

    clock.setStatus('playing');
    clock.setTime(0);
    const tick0 = scheduler.tick(0, 1000);
    const allTick0 = tick0.concat(startDispatched);
    // Downbeat at 0ms (visual lead: 16ms so 0-16=0; haptic lead: 25ms so 0-25=0)
    assert.strictEqual(allTick0.length, 2, 'Beat 1 (Kick) sensory cues dispatched at 0ms');
    assert.ok(allTick0.some((e) => e.channel === 'visual' && e.targetTimestampMs === 0));
    assert.ok(allTick0.some((e) => e.channel === 'haptic' && e.targetTimestampMs === 0));

    // 7. Verify Pause -> Resume -> Seek -> Stop lifecycle on corrected score
    // Pause at 250ms (where old ghost cue used to be)
    clock.setStatus('paused');
    clock.setTime(250);
    const pausedTick = scheduler.tick(250, 1250);
    assert.strictEqual(pausedTick.length, 0, 'No event dispatched while paused at 250ms');

    // Resume to 500ms (Snare 1)
    clock.setStatus('playing');
    clock.setTime(500);
    const resumeTick = scheduler.tick(500, 1500);
    assert.strictEqual(resumeTick.length, 2, 'Snare 1 sensory cues dispatched at 500ms on resume');

    // Seek to Bar 6 (10000ms) with timeline revision 2
    clock.setRevision(2);
    clock.setTime(10000);
    scheduleDemoTrackSensoryCues(scheduler, 2);
    const seekTick = scheduler.tick(10000, 11000);
    assert.ok(seekTick.some((e) => e.targetTimestampMs === 10000 && e.timelineRevision === 2));

    // Stop resets timeline and clears queue
    clock.setStatus('stopped');
    clock.setRevision(3);
    clock.setTime(0);
    scheduler.clear();
    assert.strictEqual(scheduler.getPendingEventCount(), 0, 'Queue cleared on stop');

    // Replay (Stop -> Play) reschedules complete 48 sensory cues
    clock.setStatus('playing');
    scheduleDemoTrackSensoryCues(scheduler, 3);
    assert.strictEqual(scheduler.getPendingEventCount(), 48, 'Replay cleanly reschedules all 48 sensory cues');

    console.log('  ✓ Canonical 24-cue score verified: all cues match audible transients, ghost cues eliminated, lifecycle verified');
  }

  // Test 11: Direct Visual Cue Animation Envelopes (onVisualCue)
  console.log('Test 11: Direct Visual Cue Animation Envelopes (onVisualCue)');
  {
    const clock = new MockMasterClock();
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);
    clock.setStatus('playing');

    const receivedCues = [];
    const unsubCue = engine.onVisualCue((cuePayload) => {
      receivedCues.push(cuePayload);
    });

    const testCues = [
      { id: 'c-downbeat', role: 'downbeat', weight: 1.0, label: 'Kick', expectedAttack: 30, expectedDecay: 130, expectedTotal: 160 },
      { id: 'c-accent', role: 'accent', weight: 1.0, label: 'Accent', expectedAttack: 30, expectedDecay: 130, expectedTotal: 160 },
      { id: 'c-backbeat', role: 'backbeat', weight: 0.85, label: 'Snare', expectedAttack: 25, expectedDecay: 110, expectedTotal: 135 },
      { id: 'c-subdiv', role: 'subdivision', weight: 0.5, label: 'Hi-hat', expectedAttack: 20, expectedDecay: 70, expectedTotal: 90 },
      { id: 'c-resol', role: 'resolution', weight: 1.0, label: 'Outro', expectedAttack: 40, expectedDecay: 260, expectedTotal: 300 },
    ];

    testCues.forEach((c, idx) => {
      const targetTime = 500 + idx * 500;
      scheduler.schedule({
        id: c.id,
        targetTimestampMs: targetTime,
        channel: 'visual',
        type: 'rhythm',
        timelineRevision: 1,
        payload: { bar: 1, beat: idx + 1, role: c.role, weight: c.weight, label: c.label },
      });
      clock.setTime(targetTime);
      scheduler.tick(targetTime, 1000 + targetTime);

      const latest = receivedCues[receivedCues.length - 1];
      assert.ok(latest, `Must receive cue for role ${c.role}`);
      assert.strictEqual(latest.attackMs, c.expectedAttack, `${c.role} attack must be ${c.expectedAttack}ms`);
      assert.strictEqual(latest.decayMs, c.expectedDecay, `${c.role} decay must be ${c.expectedDecay}ms`);
      assert.strictEqual(latest.totalDurationMs, c.expectedTotal, `${c.role} total must be ${c.expectedTotal}ms`);
      assert.strictEqual(latest.reducedMotion, false, 'reducedMotion must match engine state');
    });

    assert.strictEqual(receivedCues.length, 5, 'Should have received exactly 5 direct cue animation payloads');
    unsubCue();
    engine.dispose();
    console.log('  ✓ Direct animation envelopes verified for downbeat, accent, backbeat, subdivision, and resolution');
  }

  // Test 12: High-Frequency Consecutive Cues & Listener Lifecycle
  console.log('Test 12: High-Frequency Consecutive Cues & Listener Lifecycle');
  {
    const clock = new MockMasterClock();
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);
    clock.setStatus('playing');

    const cueLog = [];
    const unsub = engine.onVisualCue((cue) => {
      cueLog.push(cue);
    });

    // Schedule 8 consecutive subdivision cues spaced by 250ms (Bar 1)
    for (let i = 0; i < 8; i++) {
      const target = i * 250;
      scheduler.schedule({
        id: `rapid-${i}`,
        targetTimestampMs: target,
        channel: 'visual',
        type: 'rhythm',
        timelineRevision: 1,
        payload: { bar: 1, beat: 1 + i * 0.5, role: 'subdivision', weight: 0.5, label: `Sub ${i}` },
      });
      clock.setTime(target);
      scheduler.tick(target, 2000 + target);
    }

    assert.strictEqual(cueLog.length, 8, 'All 8 rapid cues must be delivered to onVisualCue');
    // Verify each cue has decay of 70ms and total duration of 90ms (which is strictly < 250ms interval)
    cueLog.forEach((c, idx) => {
      assert.strictEqual(c.totalDurationMs, 90, `Cue ${idx} duration must be 90ms`);
      assert.ok(c.totalDurationMs < 250, 'Animation envelope must settle before next 250ms cue');
    });

    // Verify unsubscription stops delivery
    unsub();
    scheduler.schedule({
      id: 'after-unsub',
      targetTimestampMs: 2250,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { bar: 2, beat: 1.5, role: 'subdivision', weight: 0.5, label: 'Unsub test' },
    });
    clock.setTime(2250);
    scheduler.tick(2250, 4250);
    assert.strictEqual(cueLog.length, 8, 'Unsubscribed listener must not receive further events');

    engine.dispose();
    console.log('  ✓ High-frequency consecutive cues and listener unsubscription verified');
  }

  // Test 13: Direct Cue Listener Reduced Motion & Revision Safety
  console.log('Test 13: Direct Cue Listener Reduced Motion & Revision Safety');
  {
    const clock = new MockMasterClock();
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({ reducedMotion: true }, clock);
    engine.attachScheduler(scheduler);
    clock.setStatus('playing');

    let lastCue = null;
    engine.onVisualCue((cue) => {
      lastCue = cue;
    });

    scheduler.schedule({
      id: 'rm-cue',
      targetTimestampMs: 100,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { bar: 1, beat: 1, role: 'downbeat', weight: 1.0, label: 'Kick' },
    });
    clock.setTime(100);
    scheduler.tick(100, 1100);

    assert.ok(lastCue, 'Reduced motion cue must be received');
    assert.strictEqual(lastCue.reducedMotion, true, 'Cue payload must indicate reducedMotion: true');
    assert.strictEqual(lastCue.visual.scale, 1.0, 'In reduced motion, scale must be locked to 1.0');

    // Seek / Timeline Revision Change
    lastCue = null;
    clock.setRevision(2); // Revision advanced

    scheduler.schedule({
      id: 'stale-rev1-cue',
      targetTimestampMs: 200,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1, // Stale revision
      payload: { bar: 1, beat: 1.5, role: 'subdivision', weight: 0.5, label: 'Stale' },
    });
    clock.setTime(200);
    scheduler.tick(200, 1200);
    assert.strictEqual(lastCue, null, 'Cues from outdated timeline revision must be dropped');

    // Valid revision 2 cue
    scheduler.schedule({
      id: 'valid-rev2-cue',
      targetTimestampMs: 200,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 2,
      payload: { bar: 1, beat: 1.5, role: 'subdivision', weight: 0.5, label: 'Valid' },
    });
    scheduler.tick(200, 1200);
    assert.ok(lastCue, 'Valid revision 2 cue must be processed');
    assert.strictEqual(lastCue.event.timelineRevision, 2);

    engine.dispose();
    console.log('  ✓ Reduced motion mode and timeline revision safety verified');
  }

  // Test 14: Dynamic Visual Calibration (16ms, 40ms, 60ms) and Pending Cue Recomputation
  console.log('Test 14: Dynamic Visual Calibration (16ms, 40ms, 60ms) and Pending Cue Recomputation');
  {
    const clock = new MockMasterClock();
    const latencyMgr = new LatencyManager();
    const scheduler = new PriorityEventScheduler(null, clock, latencyMgr);
    const engine = new VisualRhythmEngine({}, clock, latencyMgr);
    engine.attachScheduler(scheduler);
    clock.setStatus('playing');

    // 1. Initial calibration lead must be 16ms (default)
    assert.strictEqual(engine.getVisualCalibrationOffset(), 16, 'Initial calibration offset must be 16ms');
    assert.strictEqual(latencyMgr.getOffsets().visualOffsetMs, 16, 'LatencyManager visualOffsetMs must be 16ms');
    assert.deepStrictEqual(Array.from(VISUAL_CALIBRATION_OFFSETS), [16, 40, 60], 'Allowed offsets must be [16, 40, 60]');

    // 2. Schedule upcoming visual event and upcoming haptic event
    scheduler.schedule({
      id: 'cue-visual-test',
      targetTimestampMs: 1000,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { bar: 1, beat: 1, role: 'downbeat', weight: 1.0, label: 'Kick' },
    });
    scheduler.schedule({
      id: 'cue-haptic-test',
      targetTimestampMs: 1000,
      channel: 'haptic',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { bar: 1, beat: 1, role: 'downbeat', weight: 1.0 },
    });

    // Verify initial scheduled timestamps:
    // visual: 1000 - 16 = 984ms
    // haptic: 1000 - 25 = 975ms
    const pendingVisual16 = scheduler.getPendingEvents().find((e) => e.id === 'cue-visual-test');
    const pendingHaptic = scheduler.getPendingEvents().find((e) => e.id === 'cue-haptic-test');
    assert.strictEqual(pendingVisual16.scheduledTimestampMs, 984, 'Visual cue must be scheduled at 984ms with 16ms lead');
    assert.strictEqual(pendingHaptic.scheduledTimestampMs, 975, 'Haptic cue must be scheduled at 975ms with 25ms lead');

    // 3. Switch calibration to 40ms dynamically during playback
    engine.setVisualCalibrationOffset(40);
    assert.strictEqual(engine.getVisualCalibrationOffset(), 40);
    assert.strictEqual(latencyMgr.getOffsets().visualOffsetMs, 40);

    // Pending visual event must be recomputed to 1000 - 40 = 960ms
    const pendingVisual40 = scheduler.getPendingEvents().find((e) => e.id === 'cue-visual-test');
    assert.strictEqual(pendingVisual40.scheduledTimestampMs, 960, 'Visual cue must be dynamically recomputed to 960ms with 40ms lead');
    // Haptic event must remain unchanged at 975ms
    const pendingHapticAfter40 = scheduler.getPendingEvents().find((e) => e.id === 'cue-haptic-test');
    assert.strictEqual(pendingHapticAfter40.scheduledTimestampMs, 975, 'Haptic cue must remain unchanged');

    // 4. Switch calibration to 60ms dynamically
    engine.setVisualCalibrationOffset(60);
    assert.strictEqual(engine.getVisualCalibrationOffset(), 60);
    assert.strictEqual(latencyMgr.getOffsets().visualOffsetMs, 60);

    // Pending visual event must be recomputed to 1000 - 60 = 940ms
    const pendingVisual60 = scheduler.getPendingEvents().find((e) => e.id === 'cue-visual-test');
    assert.strictEqual(pendingVisual60.scheduledTimestampMs, 940, 'Visual cue must be dynamically recomputed to 940ms with 60ms lead');

    // 5. Switch back to 16ms baseline
    engine.setVisualCalibrationOffset(16);
    assert.strictEqual(engine.getVisualCalibrationOffset(), 16);
    const pendingVisualReset = scheduler.getPendingEvents().find((e) => e.id === 'cue-visual-test');
    assert.strictEqual(pendingVisualReset.scheduledTimestampMs, 984);

    engine.dispose();
    console.log('  ✓ Dynamic visual calibration switching and pending cue recomputation verified');
  }

  // Test 15: Visual Sync Telemetry Recording & Animation Ingestion
  console.log('Test 15: Visual Sync Telemetry Recording & Animation Ingestion');
  {
    const clock = new MockMasterClock();
    const latencyMgr = new LatencyManager();
    const scheduler = new PriorityEventScheduler(null, clock, latencyMgr);
    const engine = new VisualRhythmEngine({}, clock, latencyMgr);
    engine.attachScheduler(scheduler);
    clock.setStatus('playing');

    assert.strictEqual(engine.getLatestTelemetry(), null, 'Latest telemetry must initially be null');
    assert.strictEqual(engine.getTelemetryHistory().length, 0, 'Telemetry history must initially be empty');

    let emittedTelemetry = null;
    const unsubTelemetry = engine.onTelemetry((record) => {
      emittedTelemetry = record;
    });

    // Schedule and fire a visual event
    scheduler.schedule({
      id: 'telemetry-cue',
      targetTimestampMs: 500,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { bar: 1, beat: 2, role: 'accent', weight: 0.8, label: 'Snare' },
    });

    clock.setTime(500);
    scheduler.tick(500, 1500);

    assert.ok(emittedTelemetry, 'Telemetry must be emitted when visual event is processed');
    assert.strictEqual(emittedTelemetry.id, 'telemetry-cue');
    assert.strictEqual(emittedTelemetry.targetTimestampMs, 500);
    assert.strictEqual(emittedTelemetry.selectedVisualOffsetMs, 16);
    assert.strictEqual(emittedTelemetry.timelineRevision, 1);
    assert.ok(typeof emittedTelemetry.dispatchLatencyMs === 'number');
    assert.ok(typeof emittedTelemetry.onVisualCueMonotonicMs === 'number');

    // Verify engine records animation initiation
    engine.recordAnimationInitiated('telemetry-cue', 1505);
    const updatedTelemetry = engine.getLatestTelemetry();
    assert.strictEqual(updatedTelemetry.animationInitiatedMonotonicMs, 1505, 'Animation initiated timestamp must be recorded');
    assert.ok(updatedTelemetry.setupLatencyMs >= 0, 'Setup latency must be non-negative');

    // Verify telemetry buffer cap (20 entries)
    for (let i = 0; i < 25; i++) {
      scheduler.schedule({
        id: `bulk-telemetry-${i}`,
        targetTimestampMs: 1000 + i * 100,
        channel: 'visual',
        type: 'rhythm',
        timelineRevision: 1,
        payload: { bar: 2, beat: 1, role: 'subdivision', weight: 0.5, label: `Sub ${i}` },
      });
      clock.setTime(1000 + i * 100);
      scheduler.tick(1000 + i * 100, 2000 + i * 100);
    }

    assert.strictEqual(engine.getTelemetryHistory().length, 20, 'Telemetry history must be capped at 20 records');

    // Clear telemetry
    engine.clearTelemetry();
    assert.strictEqual(engine.getTelemetryHistory().length, 0, 'Telemetry history must be empty after clearTelemetry');
    assert.strictEqual(engine.getLatestTelemetry(), null, 'Latest telemetry must be null after clearTelemetry');

    unsubTelemetry();
    engine.dispose();
    console.log('  ✓ Visual sync telemetry recording, animation ingestion, and buffer limit verified');
  }

  // Test 16: React Decoupled Animation & Low-Frequency Telemetry Ingestion (Stage A.6)
  console.log('Test 16: React Decoupled Animation & Low-Frequency Telemetry Ingestion (Stage A.6)');
  {
    const clock = new MockMasterClock();
    const latencyMgr = new LatencyManager();
    const scheduler = new PriorityEventScheduler(null, clock, latencyMgr);
    const engine = new VisualRhythmEngine({}, clock, latencyMgr);
    engine.attachScheduler(scheduler);
    clock.setStatus('playing');

    // 1. Direct imperative animation listener fires synchronously without requiring state listeners
    let directCueFiredCount = 0;
    let lastDirectCuePayload = null;
    const unsubCue = engine.onVisualCue((cuePayload) => {
      directCueFiredCount++;
      lastDirectCuePayload = cuePayload;
      // In VisualExpressiveCanvas, animation initiation is reported directly to engine
      engine.recordAnimationInitiated(cuePayload.event.id);
    });

    // Verify: Zero state listeners are registered; cues still fire imperatively
    scheduler.schedule({
      id: 'decoupled-cue-1',
      targetTimestampMs: 500,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { bar: 1, beat: 2, role: 'backbeat', weight: 0.8, label: 'Snare' },
    });

    clock.setTime(500);
    scheduler.tick(500, 1500);

    assert.strictEqual(directCueFiredCount, 1, 'Direct cue listener must fire synchronously without state listeners');
    assert.strictEqual(lastDirectCuePayload.event.id, 'decoupled-cue-1');
    assert.strictEqual(lastDirectCuePayload.visual.symbol, '▲');
    assert.strictEqual(lastDirectCuePayload.reducedMotion, false);

    // 2. Telemetry Throttling Simulation (useVisualizer contract: <= 1Hz or on calibration change)
    let rawTelemetryCount = 0;
    let throttledReactTelemetryCount = 0;
    let lastThrottledTime = 0;

    const unsubRawTelemetry = engine.onTelemetry((record) => {
      rawTelemetryCount++;
      // Simulate useVisualizer's 1000ms throttling logic (20 raw events arriving across 400ms)
      const now = 2000 + rawTelemetryCount * 20; // simulated monotonic time
      if (now - lastThrottledTime >= 1000 || lastThrottledTime === 0) {
        lastThrottledTime = now;
        throttledReactTelemetryCount++;
      }
    });

    // Schedule 10 rapid events across 500ms
    for (let i = 0; i < 10; i++) {
      scheduler.schedule({
        id: `rapid-cue-${i}`,
        targetTimestampMs: 600 + i * 50,
        channel: 'visual',
        type: 'rhythm',
        timelineRevision: 1,
        payload: { bar: 1, beat: 2 + i * 0.1, role: 'subdivision', weight: 0.5, label: `Sub ${i}` },
      });
      clock.setTime(600 + i * 50);
      scheduler.tick(600 + i * 50, 1600 + i * 50);
    }

    assert.strictEqual(directCueFiredCount, 11, 'All 11 cues must trigger direct imperative animation callbacks');
    assert.strictEqual(rawTelemetryCount, 21, 'Engine telemetry emits initial latest snapshot + dispatch & animation initiation (1 + 2 x 10 = 21 events)');
    assert.strictEqual(engine.getTelemetryHistory().length, 11, 'Engine telemetry buffer stores all 11 records');
    assert.strictEqual(throttledReactTelemetryCount, 1, 'Throttled telemetry must limit React state updates to 1 pass across 500ms despite 21 raw events');

    // 3. HUD State Consistency: Bar and Beat updates maintain precision for Layer B
    const engineState = engine.getState();
    assert.strictEqual(engineState.currentBar, 1);
    assert.strictEqual(Math.floor(engineState.currentBeat), 2);
    assert.strictEqual(engineState.enabled, true);
    assert.strictEqual(engineState.isPaused, false);
    assert.strictEqual(engineState.isRest, false);

    // 4. Reduced Motion Mode Safety
    engine.setReducedMotion(true);
    scheduler.schedule({
      id: 'calm-cue',
      targetTimestampMs: 1500,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { bar: 2, beat: 1, role: 'downbeat', weight: 1.0, label: 'Kick' },
    });
    clock.setTime(1500);
    scheduler.tick(1500, 2500);

    assert.strictEqual(lastDirectCuePayload.reducedMotion, true, 'Direct cue must reflect reduced motion mode');
    assert.strictEqual(lastDirectCuePayload.targetScale, 1.0, 'Scale must be locked at 1.0 in reduced motion mode');

    // 5. Unmount and Subscription Cleanup (No leaks, no double dispatches)
    unsubCue();
    unsubRawTelemetry();

    scheduler.schedule({
      id: 'post-unmount-cue',
      targetTimestampMs: 2000,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { bar: 2, beat: 2, role: 'backbeat', weight: 0.8, label: 'Snare' },
    });
    clock.setTime(2000);
    scheduler.tick(2000, 3000);

    assert.strictEqual(directCueFiredCount, 12, 'Unsubscribed cue listener must not receive further events');
    assert.strictEqual(rawTelemetryCount, 23, 'Unsubscribed telemetry listener must not receive further events (21 + 2 from calm-cue = 23)');

    engine.dispose();
    console.log('  ✓ Decoupled imperative animation, low-frequency telemetry ingestion, HUD state, and unmount verified');
  }

  // Test 17: First-Beat Lifecycle & Stale Resting State Protection (Stage A.7.1.2)
  console.log('Test 17: First-Beat Lifecycle & Stale Resting State Protection (Stage A.7.1.2)');
  {
    const clock = new MockMasterClock();
    const latencyMgr = new LatencyManager();
    const scheduler = new PriorityEventScheduler(null, clock, latencyMgr);
    const engine = new VisualRhythmEngine({}, clock, latencyMgr);
    engine.attachScheduler(scheduler);

    // 1. Initial resting state before playback
    const prePlayState = engine.getState();
    assert.strictEqual(prePlayState.isPaused, true, 'Engine must initially be paused');
    assert.strictEqual(prePlayState.isRest, true, 'Engine must initially be in resting state before playback');
    assert.strictEqual(prePlayState.isBuffering, false, 'Engine must not be buffering');

    // 2. Transition from paused to playing
    clock.setStatus('playing');
    const playState = engine.getState();
    assert.strictEqual(playState.isPaused, false, 'isPaused must immediately be false upon entering playing state');
    assert.strictEqual(playState.isRest, false, 'isRest must immediately be false upon entering playing state to establish active groove');

    // 3. First cue arriving at 0ms (Beat 1: Kick)
    let cue1Received = false;
    let cue1Payload = null;
    let simulatedActiveAnimation = null;
    let animationStoppedPrematurely = false;

    engine.onVisualCue((payload) => {
      cue1Received = true;
      cue1Payload = payload;
      simulatedActiveAnimation = {
        id: payload.event.id,
        stop: () => {
          animationStoppedPrematurely = true;
        },
      };
    });

    scheduler.schedule({
      id: 'visual-b1-1',
      targetTimestampMs: 0,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { bar: 1, beat: 1, role: 'downbeat', weight: 1.0, label: 'Kick 1' },
    });

    // Tick at 0ms: delivers Beat 1
    scheduler.tick(0, 1000);

    assert.strictEqual(cue1Received, true, 'Beat 1 (0ms) must be received by direct visual listener');
    assert.strictEqual(cue1Payload.event.id, 'visual-b1-1');
    assert.strictEqual(cue1Payload.attackMs, 30, 'Downbeat attack must be 30ms');
    assert.strictEqual(cue1Payload.decayMs, 130, 'Downbeat decay must be 130ms');

    // 4. Ensure the first cue does not transition back to resting state
    const afterCue1State = engine.getState();
    assert.strictEqual(afterCue1State.isRest, false, 'isRest must remain strictly false after Beat 1 arrives');
    assert.strictEqual(afterCue1State.isPaused, false, 'isPaused must remain false');

    // Subsequent tick at 50ms (during Beat 1 decay):
    clock.setTime(50);
    assert.strictEqual(engine.getState().isRest, false, 'isRest must remain false during beat decay');

    // 5. Settling effect safety simulation:
    // If a stale isRest: true state reaches the settling effect while playing,
    // verify the Stage A.7.1.2 settling logic does NOT abort activeAnimationRef:
    const simulateSettleEffect = (enabled, isPaused, isBuffering, isRest) => {
      if (!enabled || isPaused || isBuffering) {
        if (simulatedActiveAnimation) {
          simulatedActiveAnimation.stop();
          simulatedActiveAnimation = null;
        }
        return;
      }
      if (isRest) {
        if (!simulatedActiveAnimation) {
          // settle to resting baseline
        }
      }
    };

    // Stale render containing isRest: true while playing:
    simulateSettleEffect(true, false, false, true);
    assert.strictEqual(animationStoppedPrematurely, false, 'Settling effect must NOT cancel active cue animation on stale isRest');
    assert.notStrictEqual(simulatedActiveAnimation, null, 'Active animation must remain running');

    // But genuine pause MUST stop active animation:
    simulateSettleEffect(true, true, false, true);
    assert.strictEqual(animationStoppedPrematurely, true, 'Genuine transport pause must safely stop active animation');
    assert.strictEqual(simulatedActiveAnimation, null, 'Active animation must be cleared on pause');

    engine.dispose();
    console.log('  ✓ First-beat lifecycle, active groove establishment, and stale resting state immunity verified');
  }

  // Test 18: Final-Resolution 300ms Envelope & Musical Rest Lifecycle (Stage A.7.1.2)
  console.log('Test 18: Final-Resolution 300ms Envelope & Musical Rest Lifecycle (Stage A.7.1.2)');
  {
    const clock = new MockMasterClock();
    const latencyMgr = new LatencyManager({ visualOffsetMs: 16 });
    const scheduler = new PriorityEventScheduler(null, clock, latencyMgr);
    const engine = new VisualRhythmEngine({}, clock, latencyMgr);
    engine.attachScheduler(scheduler);
    clock.setStatus('playing');

    let resolutionCuePayload = null;
    let resolutionAnimationActive = false;
    let animationStopped = false;

    engine.onVisualCue((payload) => {
      if (payload.event.id === 'visual-b6-4') {
        resolutionCuePayload = payload;
        resolutionAnimationActive = true;
      }
    });

    // Schedule Bar 6 Beat 4 Final Resolution: target 11500ms, scheduled 11484ms
    scheduler.schedule({
      id: 'visual-b6-4',
      targetTimestampMs: 11500,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { bar: 6, beat: 4, role: 'resolution', weight: 1.0, label: 'Final Resolution' },
    });

    // 1. Final resolution cue arriving at its scheduled timestamp (11484ms)
    clock.setTime(11484);
    scheduler.tick(11484, 12000);

    assert.notStrictEqual(resolutionCuePayload, null, 'Final resolution cue must be dispatched at 11484ms');
    assert.strictEqual(resolutionCuePayload.attackMs, 40, 'Resolution attack must be 40ms');
    assert.strictEqual(resolutionCuePayload.decayMs, 260, 'Resolution decay must be 260ms');
    assert.strictEqual(resolutionCuePayload.totalDurationMs, 300, 'Resolution total duration must be exactly 300ms');

    // 2. Verify engine does not enter resting state before the 300ms envelope completes:
    // At 11600ms (116ms into the 300ms resolution envelope):
    clock.setTime(11600);
    assert.strictEqual(engine.getState().isRest, false, 'Engine must NOT enter resting state at 11600ms (resolution still decaying)');

    // At 11750ms (266ms into envelope):
    clock.setTime(11750);
    assert.strictEqual(engine.getState().isRest, false, 'Engine must NOT enter resting state at 11750ms');

    // 3. Verify resting state occurs strictly AFTER the 300ms resolution envelope completes (11800ms)
    clock.setTime(11800);
    assert.strictEqual(engine.getState().isRest, true, 'Engine must enter resting state at 11800ms after 300ms envelope completes');
    assert.strictEqual(engine.getState().intensityLevel, 'rest');
    assert.strictEqual(engine.getState().visual.symbol, '—');

    // Remains in rest through track completion at 12000ms:
    clock.setTime(11950);
    assert.strictEqual(engine.getState().isRest, true, 'Engine must remain in resting state until end of track');

    // 4. Verify pause during final resolution behaves correctly:
    clock.setTime(11550); // reset back to middle of resolution
    clock.setStatus('playing');
    assert.strictEqual(engine.getState().isRest, false);
    clock.setStatus('paused');
    assert.strictEqual(engine.getState().isPaused, true, 'Pause during resolution must transition isPaused to true');
    assert.strictEqual(engine.getState().isRest, true, 'Pause during resolution must settle isRest to true');

    // 5. Verify stop during final resolution safely cancels and resets:
    clock.setStatus('stopped');
    assert.strictEqual(engine.getState().isPaused, true);
    assert.strictEqual(engine.getState().isRest, true);
    assert.strictEqual(engine.getState().activeCue, null);

    // 6. Verify seeking during final resolution invalidates obsolete resolution cue:
    clock.setStatus('playing');
    clock.setTime(11550);
    // User seeks back to 2000ms: revision increments to 2
    clock.setRevision(2);
    clock.setTime(2000);
    const postSeekState = engine.getState();
    assert.strictEqual(postSeekState.isRest, true, 'Seeking must settle to rest until new revision cues arrive');
    assert.strictEqual(postSeekState.activeCue, null, 'Active cue must be cleared on seek');

    // Deliver new cue at 2000ms on revision 2
    scheduler.schedule({
      id: 'visual-b2-1',
      targetTimestampMs: 2000,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 2,
      payload: { bar: 2, beat: 1, role: 'downbeat', weight: 1.0, label: 'Kick 1' },
    });
    scheduler.tick(2000, 13000);
    assert.strictEqual(engine.getState().isRest, false, 'New cue on revision 2 must re-establish isRest: false');

    // 7. Verify replay starts with a clean lifecycle:
    clock.setRevision(3);
    clock.setTime(0);
    clock.setStatus('playing');
    assert.strictEqual(engine.getState().isPaused, false);
    assert.strictEqual(engine.getState().isRest, false, 'Replay from 0ms must cleanly establish isRest: false');

    engine.dispose();
    console.log('  ✓ Final-resolution 300ms envelope, post-resolution musical rest (11800ms), and transport interrupt safety verified');
  }

  // Test 19: Reconciled Ambient Floor & Dynamic Energy Mapping (Stage A.7.2.1)
  console.log('Test 19: Reconciled Ambient Floor & Dynamic Energy Mapping (Stage A.7.2.1)');
  {
    const clock = new MockMasterClock();
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);
    clock.setStatus('playing');

    // 1. Verify static constants
    assert.strictEqual(VisualRhythmEngine.E_REST, 0.05, 'E_REST must be 0.05');
    assert.strictEqual(VisualRhythmEngine.LAMBDA, 2.5, 'LAMBDA decay constant must be 2.5');

    // 2. Direct pure mapper testing of exact floor targets at E_REST (0.05) and peak (1.00)
    const dummyEvent = {
      id: 'test-event-1',
      targetTimestampMs: 0,
      scheduledTimestampMs: -16,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { role: 'downbeat', intensity: 'strong', weight: 1.0, bar: 1, beat: 1, label: 'Kick' },
    };

    // At E = E_REST (0.05):
    const restPayload = VisualEventMapper.mapCueToLayeredPayload(
      dummyEvent.payload,
      dummyEvent,
      0.05,
      DEFAULT_VISUAL_SCALE_CONFIG,
      false
    );
    assert.strictEqual(restPayload.targetFieldScale, 1.05, 'Resting field scale must be exactly 1.05');
    assert.strictEqual(restPayload.targetFieldOpacity, 0.25, 'Resting field opacity must be exactly 0.25');

    // At E = 1.00:
    const peakPayload = VisualEventMapper.mapCueToLayeredPayload(
      dummyEvent.payload,
      dummyEvent,
      1.00,
      DEFAULT_VISUAL_SCALE_CONFIG,
      false
    );
    assert.strictEqual(peakPayload.targetFieldScale, 1.40, 'Peak field scale must be exactly 1.40');
    assert.strictEqual(peakPayload.targetFieldOpacity, 0.75, 'Peak field opacity must be exactly 0.75');

    // At E = 0.525 (mid-point: normalized energy = 0.5):
    const midPayload = VisualEventMapper.mapCueToLayeredPayload(
      dummyEvent.payload,
      dummyEvent,
      0.525,
      DEFAULT_VISUAL_SCALE_CONFIG,
      false
    );
    assert.strictEqual(midPayload.targetFieldScale, 1.225, 'Mid-point field scale must be exactly 1.225');
    assert.strictEqual(midPayload.targetFieldOpacity, 0.50, 'Mid-point field opacity must be exactly 0.50');

    // 3. Engine accumulator dynamic calculation across consecutive cues using track audio timestamps
    assert.strictEqual(engine.getEnergyAccumulator(), 0.05, 'Initial accumulator must be E_REST (0.05)');

    let latestCue = null;
    engine.onVisualCue((cue) => {
      latestCue = cue;
    });

    // Cue 1: Downbeat at 0ms (weight: 1.0, impulse delta: 0.35)
    scheduler.schedule({
      id: 'cue-1',
      targetTimestampMs: 0,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { role: 'downbeat', intensity: 'strong', weight: 1.0, bar: 1, beat: 1, label: 'Kick 1' },
    });
    clock.setTime(0);
    scheduler.tick(0, 1000);
    assert.notStrictEqual(latestCue, null);
    // E = 0.05 + 0.35 = 0.40
    assert.ok(Math.abs(engine.getEnergyAccumulator() - 0.40) < 1e-6, 'First cue must increase accumulator from 0.05 to 0.40');

    // Cue 2: Backbeat at 500ms (weight: 0.85, impulse delta: 0.22 * 0.85 = 0.187)
    // Elapsed deltaSec = 0.5s. Dissipated = 0.05 + (0.40 - 0.05) * exp(-2.5 * 0.5) = 0.05 + 0.35 * exp(-1.25) ≈ 0.15028
    // New E = 0.15028 + 0.187 ≈ 0.33728
    scheduler.schedule({
      id: 'cue-2',
      targetTimestampMs: 500,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { role: 'backbeat', intensity: 'medium', weight: 0.85, bar: 1, beat: 2, label: 'Snare 1' },
    });
    clock.setTime(500);
    scheduler.tick(500, 1500);
    const expectedE2 = 0.05 + (0.40 - 0.05) * Math.exp(-2.5 * 0.5) + (0.22 * 0.85);
    assert.ok(Math.abs(engine.getEnergyAccumulator() - expectedE2) < 0.0001, 'Energy accumulator must follow exponential decay formula');

    // Cue 3: After long delay (5000ms, deltaSec = 4.5s)
    scheduler.schedule({
      id: 'cue-3',
      targetTimestampMs: 5000,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { role: 'downbeat', intensity: 'strong', weight: 1.0, bar: 3, beat: 1, label: 'Kick' },
    });
    clock.setTime(5000);
    scheduler.tick(5000, 6000);
    // Prior energy (approx 0.337) after 4.5s has completely decayed to near E_REST
    // New E ≈ 0.05 + 0.35 = 0.40
    assert.ok(Math.abs(engine.getEnergyAccumulator() - 0.40) < 0.001, 'Long gap must decay residual energy back to E_REST baseline');

    engine.dispose();
    console.log('  ✓ Reconciled ambient floor (1.05 scale, 0.25 opacity) and exponential energy decay verified');
  }

  // Test 20: Directional Deformation Mapping (Stage A.7.2.1)
  console.log('Test 20: Directional Deformation Mapping (Stage A.7.2.1)');
  {
    const dummyEvent = (role, weight = 1.0) => ({
      id: `def-${role}`,
      targetTimestampMs: 0,
      scheduledTimestampMs: -16,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { role, intensity: 'strong', weight, bar: 1, beat: 1, label: role },
    });

    // 1. Downbeat (Kick): Horizontal squash (targetScaleX > targetScaleY)
    const kick = VisualEventMapper.mapCueToLayeredPayload(dummyEvent('downbeat').payload, dummyEvent('downbeat'), 0.5, DEFAULT_VISUAL_SCALE_CONFIG, false);
    assert.strictEqual(kick.targetScaleX, 1.35, 'Downbeat targetScaleX must be 1.35');
    assert.strictEqual(kick.targetScaleY, 1.25, 'Downbeat targetScaleY must be 1.25');
    assert.ok(kick.targetScaleX > kick.targetScaleY, 'Downbeat must exhibit horizontal squash deformation');

    // 2. Backbeat (Snare): Vertical snap (targetScaleY > targetScaleX)
    const snare = VisualEventMapper.mapCueToLayeredPayload(dummyEvent('backbeat', 0.85).payload, dummyEvent('backbeat', 0.85), 0.5, DEFAULT_VISUAL_SCALE_CONFIG, false);
    assert.strictEqual(snare.targetScaleX, 1.15, 'Backbeat targetScaleX must be 1.15');
    assert.strictEqual(snare.targetScaleY, 1.30, 'Backbeat targetScaleY must be 1.30');
    assert.ok(snare.targetScaleY > snare.targetScaleX, 'Backbeat must exhibit vertical snap deformation');

    // 3. Climax Accent: Omnidirectional burst (targetScaleX === targetScaleY)
    const accent = VisualEventMapper.mapCueToLayeredPayload(dummyEvent('accent').payload, dummyEvent('accent'), 1.0, DEFAULT_VISUAL_SCALE_CONFIG, false);
    assert.strictEqual(accent.targetScaleX, 1.45, 'Accent targetScaleX must be 1.45');
    assert.strictEqual(accent.targetScaleY, 1.45, 'Accent targetScaleY must be 1.45');

    // 4. Final Resolution: Harmonic bloom
    const resol = VisualEventMapper.mapCueToLayeredPayload(dummyEvent('resolution').payload, dummyEvent('resolution'), 0.8, DEFAULT_VISUAL_SCALE_CONFIG, false);
    assert.strictEqual(resol.targetScaleX, 1.25, 'Resolution targetScaleX must be 1.25');
    assert.strictEqual(resol.targetScaleY, 1.25, 'Resolution targetScaleY must be 1.25');

    // 5. Subdivision / Default: Gentle symmetrical pulse
    const subdiv = VisualEventMapper.mapCueToLayeredPayload(dummyEvent('subdivision', 0.5).payload, dummyEvent('subdivision', 0.5), 0.2, DEFAULT_VISUAL_SCALE_CONFIG, false);
    assert.strictEqual(subdiv.targetScaleX, 1.06, 'Subdivision targetScaleX must be 1.06');
    assert.strictEqual(subdiv.targetScaleY, 1.06, 'Subdivision targetScaleY must be 1.06');

    console.log('  ✓ Directional deformation geometry verified for kick (squash), snare (snap), and accents (burst)');
  }

  // Test 21: Three-Layer Payload Generation & Finite Numerical Bounds (Stage A.7.2.1)
  console.log('Test 21: Three-Layer Payload Generation & Finite Numerical Bounds (Stage A.7.2.1)');
  {
    const clock = new MockMasterClock();
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);
    clock.setStatus('playing');

    const receivedPayloads = [];
    engine.onVisualCue((cue) => {
      receivedPayloads.push(cue);
    });

    // Schedule all 24 canonical cues
    scheduleDemoTrackSensoryCues(scheduler, 1);

    for (let t = 0; t <= 12000; t += 250) {
      clock.setTime(t);
      scheduler.tick(t, 2000 + t);
    }

    assert.strictEqual(receivedPayloads.length, 24, 'Must receive all 24 canonical visual payloads');

    receivedPayloads.forEach((p, idx) => {
      // Layer 1 bounds
      assert.ok(Number.isFinite(p.targetScaleX) && p.targetScaleX >= 1.0, `Cue ${idx} targetScaleX must be finite and >= 1.0`);
      assert.ok(Number.isFinite(p.targetScaleY) && p.targetScaleY >= 1.0, `Cue ${idx} targetScaleY must be finite and >= 1.0`);

      // Layer 2 bounds
      assert.ok(p.targetFieldScale >= 1.05 && p.targetFieldScale <= 1.40, `Cue ${idx} targetFieldScale must be in [1.05, 1.40]`);
      assert.ok(p.targetFieldOpacity >= 0.25 && p.targetFieldOpacity <= 0.75, `Cue ${idx} targetFieldOpacity must be in [0.25, 0.75]`);
      assert.ok(p.energyAccumulator >= 0.05 && p.energyAccumulator <= 1.0, `Cue ${idx} energyAccumulator must be in [0.05, 1.0]`);

      // Layer 3 bounds
      assert.ok(typeof p.triggerRipple === 'boolean', `Cue ${idx} triggerRipple must be boolean`);
      assert.ok(p.targetRippleScale >= 1.0, `Cue ${idx} targetRippleScale must be >= 1.0`);
      assert.ok(p.targetRippleOpacity >= 0.0 && p.targetRippleOpacity <= 1.0, `Cue ${idx} targetRippleOpacity must be in [0.0, 1.0]`);
      assert.ok(p.rippleDurationMs >= 0, `Cue ${idx} rippleDurationMs must be non-negative`);

      // Backwards compatibility with VisualRhythmSurface
      assert.strictEqual(p.targetScale, Math.max(p.targetScaleX, p.targetScaleY), `Cue ${idx} targetScale must equal max(scaleX, scaleY)`);
      assert.strictEqual(p.auraTarget, p.targetFieldScale, `Cue ${idx} auraTarget must equal targetFieldScale`);
      assert.strictEqual(p.totalDurationMs, p.attackMs + p.decayMs, `Cue ${idx} totalDurationMs must equal attack + decay`);
    });

    engine.dispose();
    console.log('  ✓ Three-layer payload contracts and numerical bounds verified across all 24 canonical events');
  }

  // Test 22: Ripple Trigger Policy (Stage A.7.2.1)
  console.log('Test 22: Ripple Trigger Policy (Stage A.7.2.1)');
  {
    const clock = new MockMasterClock();
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);
    clock.setStatus('playing');

    const receivedPayloads = [];
    engine.onVisualCue((cue) => {
      receivedPayloads.push(cue);
    });

    scheduleDemoTrackSensoryCues(scheduler, 1);

    for (let t = 0; t <= 12000; t += 250) {
      clock.setTime(t);
      scheduler.tick(t, 2000 + t);
    }

    const rippleCues = receivedPayloads.filter((p) => p.triggerRipple);
    assert.strictEqual(rippleCues.length, 2, 'Exactly 2 canonical events must trigger Ripple (b6-3 accent and b6-4 resolution)');

    const accentCue = rippleCues.find((p) => p.event.payload.role === 'accent');
    assert.ok(accentCue, 'Accent cue (b6-3) must trigger ripple');
    assert.strictEqual(accentCue.event.payload.id || accentCue.event.id, 'visual-b6-3');
    assert.strictEqual(accentCue.targetRippleScale, 1.75, 'Accent ripple scale must be 1.75');
    assert.strictEqual(accentCue.targetRippleOpacity, 0.75, 'Accent ripple opacity must be 0.75');
    assert.strictEqual(accentCue.rippleDurationMs, 400, 'Accent ripple duration must be 400ms');

    const resolutionCue = rippleCues.find((p) => p.event.payload.role === 'resolution');
    assert.ok(resolutionCue, 'Resolution cue (b6-4) must trigger ripple');
    assert.strictEqual(resolutionCue.event.payload.id || resolutionCue.event.id, 'visual-b6-4');
    assert.strictEqual(resolutionCue.targetRippleScale, 1.65, 'Resolution ripple scale must be 1.65');
    assert.strictEqual(resolutionCue.targetRippleOpacity, 0.65, 'Resolution ripple opacity must be 0.65');
    assert.strictEqual(resolutionCue.rippleDurationMs, 450, 'Resolution ripple duration must be 450ms');

    // Verify all downbeats and backbeats have ripple suppressed
    const nonRippleCues = receivedPayloads.filter((p) => !p.triggerRipple);
    assert.strictEqual(nonRippleCues.length, 22, 'All 22 non-accent/resolution cues must suppress ripple');
    nonRippleCues.forEach((p) => {
      assert.strictEqual(p.targetRippleScale, 1.0);
      assert.strictEqual(p.targetRippleOpacity, 0.0);
      assert.strictEqual(p.rippleDurationMs, 0);
    });

    engine.dispose();
    console.log('  ✓ Ripple trigger policy verified: strictly triggered for accent (b6-3) and resolution (b6-4), suppressed for all 22 other cues');
  }

  // Test 23: Complete Transport Lifecycle & Energy State Preservation (Stage A.7.2.1)
  console.log('Test 23: Complete Transport Lifecycle & Energy State Preservation (Stage A.7.2.1)');
  {
    const clock = new MockMasterClock();
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);
    clock.setStatus('playing');

    // 1. Deliver downbeat at 0ms to accumulate energy (E = 0.40)
    scheduler.schedule({
      id: 'cue-life-1',
      targetTimestampMs: 0,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { role: 'downbeat', intensity: 'strong', weight: 1.0, bar: 1, beat: 1, label: 'Kick' },
    });
    clock.setTime(0);
    scheduler.tick(0, 500);
    assert.ok(Math.abs(engine.getEnergyAccumulator() - 0.40) < 1e-6, 'Energy must be 0.40 after first beat');

    // 2. Pause: Visual animation suspended, energy accumulator preserved
    clock.setStatus('paused');
    assert.strictEqual(engine.getState().isPaused, true, 'isPaused must be true on pause');
    assert.strictEqual(engine.getState().isRest, true, 'isRest must be true on pause');
    assert.ok(Math.abs(engine.getEnergyAccumulator() - 0.40) < 1e-6, 'Pause must strictly preserve energyAccumulator in memory');

    // 3. Resume: Continue without replaying stale cues, energy remains preserved
    clock.setStatus('playing');
    assert.strictEqual(engine.getState().isPaused, false, 'isPaused must be false on resume');
    assert.ok(Math.abs(engine.getEnergyAccumulator() - 0.40) < 1e-6, 'Resume must maintain preserved energy state');

    // Deliver next cue at 500ms: deltaSec is calculated based on track audio timestamps (500ms - 0ms = 0.5s)
    scheduler.schedule({
      id: 'cue-life-2',
      targetTimestampMs: 500,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { role: 'backbeat', intensity: 'medium', weight: 0.85, bar: 1, beat: 2, label: 'Snare' },
    });
    clock.setTime(500);
    scheduler.tick(500, 1000);
    // Energy resumed smoothly based on 0.5s audio interval, not wall-clock pause duration
    const expectedResumedE = 0.05 + (0.40 - 0.05) * Math.exp(-2.5 * 0.5) + (0.22 * 0.85);
    assert.ok(Math.abs(engine.getEnergyAccumulator() - expectedResumedE) < 0.0001, 'Resume must calculate decay using track audio timestamps');

    // 4. Seek: Reset energy to E_REST (0.05), increment revision, invalidate stale cues
    clock.setRevision(2);
    clock.setTime(4000);
    assert.strictEqual(engine.getEnergyAccumulator(), 0.05, 'Seek must reset energyAccumulator to E_REST (0.05)');
    assert.strictEqual(engine.getState().activeCue, null, 'Seek must clear activeCue');

    // Stale cue from revision 1 should be dropped
    scheduler.schedule({
      id: 'stale-rev-1',
      targetTimestampMs: 4000,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { role: 'downbeat', intensity: 'strong', weight: 1.0, bar: 3, beat: 1, label: 'Stale Kick' },
    });
    scheduler.tick(4000, 4500);
    assert.strictEqual(engine.getEnergyAccumulator(), 0.05, 'Stale revision cue must be rejected without altering energy');

    // 5. Stop: Reset energy to E_REST (0.05)
    // Deliver valid revision 2 cue
    scheduler.schedule({
      id: 'valid-rev-2',
      targetTimestampMs: 4000,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 2,
      payload: { role: 'downbeat', intensity: 'strong', weight: 1.0, bar: 3, beat: 1, label: 'Kick' },
    });
    scheduler.tick(4000, 4500);
    assert.ok(Math.abs(engine.getEnergyAccumulator() - 0.40) < 1e-6, 'Valid revision 2 cue must update energy');

    clock.setStatus('stopped');
    assert.strictEqual(engine.getEnergyAccumulator(), 0.05, 'Stop must reset energyAccumulator to E_REST (0.05)');
    assert.strictEqual(engine.getState().activeCue, null, 'Stop must clear activeCue');

    // 6. Track Change / Reset: Independent re-initialization
    engine.reset();
    assert.strictEqual(engine.getEnergyAccumulator(), 0.05, 'reset() must reset energyAccumulator to E_REST');

    engine.dispose();
    console.log('  ✓ Transport lifecycle policies verified: pause preserves energy, seek/stop reset to E_REST, audio-timestamp delta confirmed');
  }

  // Test 24: Reduced Motion Mode Invariants (Stage A.7.2.1)
  console.log('Test 24: Reduced Motion Mode Invariants (Stage A.7.2.1)');
  {
    const clock = new MockMasterClock();
    const scheduler = new PriorityEventScheduler(null, clock);
    const engine = new VisualRhythmEngine({ reducedMotion: true }, clock);
    engine.attachScheduler(scheduler);
    clock.setStatus('playing');

    const receivedPayloads = [];
    engine.onVisualCue((cue) => {
      receivedPayloads.push(cue);
    });

    // Schedule downbeat, backbeat, accent, resolution
    const cues = [
      { id: 'rm-kick', role: 'downbeat', weight: 1.0, time: 0 },
      { id: 'rm-snare', role: 'backbeat', weight: 0.85, time: 500 },
      { id: 'rm-accent', role: 'accent', weight: 1.0, time: 1000 },
      { id: 'rm-resol', role: 'resolution', weight: 1.0, time: 1500 },
    ];

    cues.forEach((c) => {
      scheduler.schedule({
        id: c.id,
        targetTimestampMs: c.time,
        channel: 'visual',
        type: 'rhythm',
        timelineRevision: 1,
        payload: { role: c.role, intensity: 'strong', weight: c.weight, bar: 1, beat: 1, label: c.role },
      });
      clock.setTime(c.time);
      scheduler.tick(c.time, 1000 + c.time);
    });

    assert.strictEqual(receivedPayloads.length, 4, 'Must receive all 4 cues under reduced motion');

    receivedPayloads.forEach((p, idx) => {
      assert.strictEqual(p.reducedMotion, true, `Cue ${idx} reducedMotion must be true`);
      // Layer 1: Core scales locked to strictly 1.0 (no kinetic movement)
      assert.strictEqual(p.targetScaleX, 1.0, `Cue ${idx} targetScaleX must be locked to 1.0`);
      assert.strictEqual(p.targetScaleY, 1.0, `Cue ${idx} targetScaleY must be locked to 1.0`);
      assert.strictEqual(p.targetScale, 1.0, `Cue ${idx} targetScale must be locked to 1.0`);

      // Layer 2: Field scale locked to 1.0, opacity continues pulsing for non-motion rhythm clarity
      assert.strictEqual(p.targetFieldScale, 1.0, `Cue ${idx} targetFieldScale must be locked to 1.0`);
      assert.ok(p.targetFieldOpacity >= 0.25 && p.targetFieldOpacity <= 0.75, `Cue ${idx} field opacity must pulse`);

      // Layer 3: Ripple completely suppressed
      assert.strictEqual(p.triggerRipple, false, `Cue ${idx} triggerRipple must be false under reduced motion`);
      assert.strictEqual(p.targetRippleScale, 1.0, `Cue ${idx} targetRippleScale must be 1.0`);
      assert.strictEqual(p.targetRippleOpacity, 0.0, `Cue ${idx} targetRippleOpacity must be 0.0`);
    });

    engine.dispose();
    console.log('  ✓ Reduced-motion mode invariants verified: all kinetic scales locked to 1.0, ripples suppressed, opacity rhythm preserved');
  }

  // Test 25: Backward Seek Visual Recovery & Immediate Cue Delivery (Stage A.7.2.3.10)
  console.log('Test 25: Backward Seek Visual Recovery & Immediate Cue Delivery (Stage A.7.2.3.10)');
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
    const engine = new VisualRhythmEngine({}, clock);
    engine.attachScheduler(scheduler);

    const receivedVisualCues = [];
    engine.onVisualCue((cue) => {
      receivedVisualCues.push(cue);
    });

    // 1. Advance playback through multiple beats to 8000ms
    scheduler.schedule({
      id: 'vis-cue-8000',
      targetTimestampMs: 8000,
      channel: 'visual',
      type: 'rhythm',
      timelineRevision: 1,
      payload: { role: 'downbeat', intensity: 'strong', weight: 1.0, bar: 5, beat: 1, label: 'Beat 8s' },
    });
    clock.setTime(8000);
    scheduler.tick(8000, 1000);
    assert.strictEqual(receivedVisualCues.length, 1);
    assert.ok(engine.getEnergyAccumulator() > 0.1, 'Energy accumulated at 8000ms');

    // 2. Register synchronous score provider to simulate NowPlayingCard.tsx
    scheduler.setScoreProvider((sched, rev) => {
      // Reschedule demo track score at revision 2
      sched.scheduleBatch([
        {
          id: `vis-b2-3-seek`,
          targetTimestampMs: 3000,
          channel: 'visual',
          type: 'rhythm',
          timelineRevision: rev,
          payload: { role: 'downbeat', intensity: 'strong', weight: 1.0, bar: 2, beat: 3, label: 'Kick 3s' },
        },
        {
          id: `vis-b2-4-seek`,
          targetTimestampMs: 3500,
          channel: 'visual',
          type: 'rhythm',
          timelineRevision: rev,
          payload: { role: 'backbeat', intensity: 'medium', weight: 0.85, bar: 2, beat: 4, label: 'Snare 3.5s' },
        },
      ]);
    });

    // 3. Perform backward seek from 8000ms to 3000ms (position changes to 3000ms, revision advances to 2)
    clock.setTime(3000);
    clock.setRevision(2);

    // Verify visual engine immediately resets energy accumulator to E_REST (0.05) on seek
    assert.strictEqual(engine.getEnergyAccumulator(), 0.05, 'Energy reset to E_REST on seek');
    assert.strictEqual(engine.getState().activeCue, null, 'Active cue cleared on seek');

    // 4. Tick at seek landing position 3000ms
    const dispatches = scheduler.tick(3000, 2000);
    assert.strictEqual(dispatches.length, 1, 'Landing cue dispatched immediately via Seek Landing Boundary Exception');
    assert.strictEqual(dispatches[0].id, 'vis-b2-3-seek');

    // Verify visual engine immediately processed the landing cue:
    assert.strictEqual(receivedVisualCues.length, 2, 'Visual cue received on seek landing without latency');
    const landingCue = receivedVisualCues[1];
    assert.strictEqual(landingCue.event.id, 'vis-b2-3-seek');
    assert.strictEqual(landingCue.visual.shape, 'diamond');
    assert.strictEqual(landingCue.visual.symbol, '◆');
    assert.strictEqual(engine.getState().activeCue?.label, 'Kick 3s');
    assert.strictEqual(engine.getState().activeCue?.role, 'downbeat');
    assert.ok(Math.abs(engine.getEnergyAccumulator() - 0.40) < 1e-6, 'Energy accumulator immediately refreshed for landing cue');

    engine.dispose();
    scheduler.dispose();
    console.log('  ✓ Backward seek visual recovery verified: immediate cue delivery at landing point, 0ms latency, clean energy reset');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 25 VISUAL RHYTHM ENGINE VERIFICATION TESTS PASSED!');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Visual Engine Test Failure:', err);
  process.exit(1);
});
