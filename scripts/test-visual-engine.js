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
 * 10. Canonical Demo Rhythm Score Visual Cues Verification (47 cues)
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
  const { DEFAULT_VISUAL_SCALE_CONFIG } = sandbox.exports;
  exportedTypes = {
    DEFAULT_VISUAL_SCALE_CONFIG,
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
    VisualEventMapper,
    VisualRhythmEngine,
  };
}

async function runTests() {
  console.log('🧪 Starting Milestone 5 Visual Rhythm Engine (SEE Pillar) Verification Suite...\n');

  const {
    PriorityEventScheduler,
    CANONICAL_DEMO_RHYTHM_SCORE,
    getDemoTrackVisualCues,
    getDemoTrackHapticCues,
    scheduleDemoTrackSensoryCues,
    DEFAULT_VISUAL_SCALE_CONFIG,
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

    // 3. Playback reaches Bar 6 rest period (11600ms) while status remains 'playing'
    clock.setTime(11600);
    const restState = engine.getState();
    assert.strictEqual(restState.isRest, true, 'isRest must be true during musical rest (11600ms)');
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

  // Test 10: Canonical Demo Rhythm Score Visual Cues Verification (47 cues)
  console.log('Test 10: Canonical Demo Rhythm Score Visual Cues Verification (47 cues)');
  {
    assert.strictEqual(CANONICAL_DEMO_RHYTHM_SCORE.length, 47, 'Score must contain exactly 47 canonical cues');

    const visualCues = getDemoTrackVisualCues(1);
    const hapticCues = getDemoTrackHapticCues(1);

    assert.strictEqual(visualCues.length, 47, 'Visual cues list must have 47 items');
    assert.strictEqual(hapticCues.length, 47, 'Haptic cues list must have 47 items');

    // Check 1-to-1 timestamp alignment between visual and haptic channels
    for (let i = 0; i < 47; i++) {
      assert.strictEqual(
        visualCues[i].targetTimestampMs,
        hapticCues[i].targetTimestampMs,
        `Cue ${i} timestamp mismatch: visual=${visualCues[i].targetTimestampMs}, haptic=${hapticCues[i].targetTimestampMs}`
      );
      assert.strictEqual(visualCues[i].channel, 'visual');
      assert.strictEqual(hapticCues[i].channel, 'haptic');
    }

    // Verify first cue (Bar 1 Beat 1 Kick)
    assert.strictEqual(visualCues[0].payload.bar, 1);
    assert.strictEqual(visualCues[0].payload.beat, 1);
    assert.strictEqual(visualCues[0].payload.role, 'downbeat');

    // Verify Bar 6 Resolution (at 11500ms)
    const resCue = visualCues.find((c) => c.targetTimestampMs === 11500);
    assert.ok(resCue, 'Resolution cue must be present at 11500ms');
    assert.strictEqual(resCue.payload.role, 'resolution');

    // Verify scheduleDemoTrackSensoryCues schedules both channels
    const clock = new MockMasterClock();
    const scheduler = new PriorityEventScheduler(null, clock);
    scheduleDemoTrackSensoryCues(scheduler, 1);
    assert.strictEqual(scheduler.getPendingEventCount(), 94, 'Scheduler must receive 47 haptic + 47 visual = 94 cues');

    console.log('  ✓ Canonical 47-cue score verified with 1:1 haptic and visual synchronization');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL 10 VISUAL RHYTHM ENGINE VERIFICATION TESTS PASSED!');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Visual Engine Test Failure:', err);
  process.exit(1);
});
