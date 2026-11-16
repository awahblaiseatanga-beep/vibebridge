/**
 * Automated Verification Suite for ExpoAudioEngine (Milestone 2)
 *
 * Runs in Node using Babel transpilation of the actual production TypeScript source.
 * Simulates native Android ExoPlayer / expo-audio callbacks to thoroughly verify:
 * - Bundled audio asset handling
 * - Local URI handling
 * - Loading, playing, paused, stopped, and error states
 * - Play, pause, resume, stop, and seek operations
 * - Authoritative playback clock precision and status event dispatching
 */

const assert = require('assert');
const babel = require('@babel/core');
const vm = require('vm');
const path = require('path');

// 1. Mock native expo-audio module
class MockAudioPlayer {
  constructor(source, options) {
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
      handlers.forEach((fn) => fn(payload));
    }
  }

  play() {
    this.playing = true;
    this.paused = false;
    this.emit('playbackStatusUpdate', {
      isLoaded: true,
      playing: true,
      currentTime: this.currentTime,
      duration: this.duration,
      isBuffering: false,
      playbackRate: 1.0,
      didJustFinish: false,
      error: null,
    });
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
      playbackRate: 1.0,
      didJustFinish: false,
      error: null,
    });
  }

  async seekTo(seconds) {
    this.currentTime = seconds;
    this.emit('playbackStatusUpdate', {
      isLoaded: true,
      playing: this.playing,
      currentTime: this.currentTime,
      duration: this.duration,
      isBuffering: false,
      playbackRate: 1.0,
      didJustFinish: false,
      error: null,
    });
  }

  remove() {
    this.removed = true;
    this.listeners.clear();
  }
}

let lastCreatedPlayer = null;

const mockExpoAudio = {
  createAudioPlayer: (source, options) => {
    lastCreatedPlayer = new MockAudioPlayer(source, options);
    return lastCreatedPlayer;
  },
};

// 2. Transpile production source file
const transpiled = babel.transformFileSync('src/engines/audio/ExpoAudioEngine.ts', {
  presets: ['babel-preset-expo'],
  filename: 'src/engines/audio/ExpoAudioEngine.ts',
});

// 3. Execute in isolated VM context with mocked expo-audio
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
};

vm.createContext(sandbox);
vm.runInContext(transpiled.code, sandbox);

const { ExpoAudioEngine } = sandbox.exports;
assert.ok(ExpoAudioEngine, 'ExpoAudioEngine class should be exported');

async function runTests() {
  console.log('🧪 Starting Milestone 2 Audio Engine Automated Test Suite...\n');

  const engine = new ExpoAudioEngine();
  const statusHistory = [];
  const clockHistory = [];

  engine.onStatusChange((s) => statusHistory.push(s));
  engine.onClockUpdate((c) => clockHistory.push(c.positionMs));

  // --- Test 1: Initial State ---
  console.log('Test 1: Initial State Inspection');
  const initialClock = engine.getClock();
  assert.strictEqual(initialClock.status, 'idle', 'Initial status must be idle');
  assert.strictEqual(initialClock.positionMs, 0, 'Initial position must be 0');
  console.log('  ✓ Initial status is "idle" with position 0ms');

  // --- Test 2: Bundled Audio Asset Loading ---
  console.log('Test 2: Bundled Demo Audio Asset Loading');
  const dummyAssetId = 101;
  await engine.load({
    type: 'bundle',
    assetId: dummyAssetId,
    name: 'VibeBridge Demo',
    durationMs: 12000,
  });

  assert.ok(lastCreatedPlayer, 'Native player should be instantiated');
  assert.strictEqual(lastCreatedPlayer.source, dummyAssetId, 'Bundled assetId passed to native player');
  assert.strictEqual(engine.getClock().status, 'paused', 'Status after loading should be ready (paused)');
  assert.strictEqual(engine.getClock().durationMs, 12000, 'Duration should reflect 12000ms');
  console.log('  ✓ Bundled asset loaded successfully into native player (status: paused, duration: 12000ms)');

  // --- Test 3: Playback Start (play / resume) ---
  console.log('Test 3: Play & Resume');
  await engine.play();
  assert.strictEqual(engine.getClock().status, 'playing', 'Status should be playing');
  assert.strictEqual(lastCreatedPlayer.playing, true, 'Native player should be playing');
  console.log('  ✓ engine.play() sets status to "playing" and invokes native play()');

  // Simulate native clock ticks while playing
  lastCreatedPlayer.currentTime = 2.5;
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: true,
    playing: true,
    currentTime: 2.5,
    duration: 12.0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: null,
  });

  assert.strictEqual(engine.getClock().positionMs, 2500, 'Position should update to 2500ms');
  console.log('  ✓ Native position tick (2.5s) correctly parsed into authoritative clock (2500ms)');

  // --- Test 4: Pause ---
  console.log('Test 4: Pause');
  await engine.pause();
  assert.strictEqual(engine.getClock().status, 'paused', 'Status should be paused');
  assert.strictEqual(lastCreatedPlayer.paused, true, 'Native player should be paused');
  assert.strictEqual(engine.getClock().positionMs, 2500, 'Position maintained at 2500ms after pause');
  console.log('  ✓ engine.pause() sets status to "paused" and preserves position (2500ms)');

  // --- Test 5: Resume ---
  console.log('Test 5: Resume');
  await engine.resume();
  assert.strictEqual(engine.getClock().status, 'playing', 'Status should be playing after resume');
  console.log('  ✓ engine.resume() resumes playback');

  // --- Test 6: Seeking ---
  console.log('Test 6: Seeking & Clock Precision');
  await engine.seek(6000); // Seek to 6 seconds
  assert.strictEqual(lastCreatedPlayer.currentTime, 6.0, 'Native seekTo called with 6.0 seconds');
  assert.strictEqual(engine.getClock().positionMs, 6000, 'Authoritative clock updated immediately to 6000ms');

  // Seek clamping (negative seek clamped to 0)
  await engine.seek(-500);
  assert.strictEqual(lastCreatedPlayer.currentTime, 0, 'Negative seek clamped to 0s');
  assert.strictEqual(engine.getClock().positionMs, 0, 'Clock position clamped to 0ms');
  console.log('  ✓ engine.seek() converts ms to seconds, immediately updates clock, and clamps out-of-bounds');

  // --- Test 7: Stopping & Resetting State ---
  console.log('Test 7: Stop & Reset');
  await engine.play();
  await engine.stop();
  assert.strictEqual(engine.getClock().status, 'stopped', 'Status should be stopped');
  assert.strictEqual(engine.getClock().positionMs, 0, 'Position reset to 0ms on stop');
  assert.strictEqual(lastCreatedPlayer.currentTime, 0, 'Native player seeked to 0 on stop');
  console.log('  ✓ engine.stop() pauses, seeks to 0, and sets status to "stopped"');

  // --- Test 8: Track End (didJustFinish) ---
  console.log('Test 8: Automatic Track Completion');
  await engine.play();
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
  assert.strictEqual(engine.getClock().status, 'stopped', 'Status transitions to stopped on didJustFinish');
  console.log('  ✓ Track completion event automatically transitions status to "stopped"');

  // --- Test 9: Local URI Handling ---
  console.log('Test 9: Local File URI Handling');
  const localFileUri = 'file:///data/user/0/com.vibebridge.app/files/custom_track.mp3';
  await engine.load({
    type: 'uri',
    uri: localFileUri,
    name: 'Imported User Track',
  });
  assert.strictEqual(lastCreatedPlayer.source.uri, localFileUri, 'Local URI correctly passed as { uri } to native player');
  console.log('  ✓ Local file URI correctly resolved and passed to native audio player');

  // --- Test 10: Error Handling ---
  console.log('Test 10: Native Error Handling');
  lastCreatedPlayer.emit('playbackStatusUpdate', {
    isLoaded: false,
    playing: false,
    currentTime: 0,
    duration: 0,
    isBuffering: false,
    playbackRate: 1.0,
    didJustFinish: false,
    error: 'AUDIO_CODEC_NOT_SUPPORTED',
  });
  assert.strictEqual(engine.getClock().status, 'error', 'Status transitions to error');
  assert.strictEqual(engine.getClock().errorMessage, 'AUDIO_CODEC_NOT_SUPPORTED', 'Error message recorded');
  console.log('  ✓ Native error event transitions engine to "error" and records message');

  // --- Test 11: Unload & Resource Cleanup ---
  console.log('Test 11: Unload & Memory Disposal');
  await engine.unload();
  assert.strictEqual(lastCreatedPlayer.removed, true, 'Native player.remove() called to free memory');
  assert.strictEqual(engine.getClock().status, 'idle', 'Status reset to idle');
  assert.strictEqual(engine.getClock().positionMs, 0, 'Clock reset to 0');
  console.log('  ✓ engine.unload() removes native player and resets clock to "idle"');

  console.log('\n======================================================');
  console.log('🎉 ALL 11 AUDIO ENGINE UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
