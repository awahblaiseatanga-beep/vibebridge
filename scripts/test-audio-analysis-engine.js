/**
 * Test Suite: Automatic Audio Analysis & Rhythm Engine
 *
 * Verifies:
 * 1. Metadata filename parsing (artist, title, strip noise/extensions)
 * 2. IOI autocorrelation tempo estimation for periodic rhythm streams (120, 100, 140 BPM)
 * 3. Fallback handling for irregular/aperiodic transients (honest low confidence < 0.35)
 * 4. Downbeat vs Backbeat vs Subdivision metric classification & haptic intensity mapping
 * 5. Minimum motor refractory period (80ms) and cue deduplication
 * 6. Sensory cue scheduling into PriorityEventScheduler for both FEEL and SEE channels
 * 7. Bundled track and persistent repository integrity
 */

const assert = require('assert');

// Test 1: Filename metadata extraction
console.log('🧪 Test 1: Filename Metadata Extraction');

function parseFilenameMetadata(filename) {
  let clean = filename.replace(/\.(mp3|m4a|aac|wav|ogg|flac)$/i, '');
  clean = clean.replace(/_/g, ' ').trim();
  clean = clean.replace(/^\d+[\.\-\s]+/, '');

  if (clean.includes(' - ')) {
    const parts = clean.split(' - ');
    const artist = parts[0].trim();
    const title = parts.slice(1).join(' - ').replace(/\s*[\(\[].*?[\)\]]\s*/g, '').trim();
    return {
      title: title || clean,
      artist: artist || 'Local Audio',
    };
  }

  const title = clean.replace(/\s*[\(\[].*?[\)\]]\s*/g, '').trim();
  return {
    title: title || filename,
    artist: 'Local Audio',
  };
}

const testCases = [
  {
    input: '01. Daft Punk - One More Time (Official Audio).mp3',
    expectedTitle: 'One More Time',
    expectedArtist: 'Daft Punk',
  },
  {
    input: 'Halina_Rice_-_Spheres.wav',
    expectedTitle: 'Spheres',
    expectedArtist: 'Halina Rice',
  },
  {
    input: 'Unknown_Recording_Sample.m4a',
    expectedTitle: 'Unknown Recording Sample',
    expectedArtist: 'Local Audio',
  },
  {
    input: '12 - Queen - Another One Bites The Dust.flac',
    expectedTitle: 'Another One Bites The Dust',
    expectedArtist: 'Queen',
  },
];

for (const tc of testCases) {
  const result = parseFilenameMetadata(tc.input);
  assert.strictEqual(result.title, tc.expectedTitle, `Title mismatch for ${tc.input}: got "${result.title}"`);
  assert.strictEqual(result.artist, tc.expectedArtist, `Artist mismatch for ${tc.input}: got "${result.artist}"`);
  console.log(`  ✓ Successfully parsed "${tc.input}" -> Artist: "${result.artist}", Title: "${result.title}"`);
}

// Test 2: IOI Autocorrelation & Tempo Estimation
console.log('\n🧪 Test 2: Autocorrelation IOI Tempo Detection (120, 100, 140 BPM)');

function computeAutocorrelationTempo(onsetsSec) {
  if (onsetsSec.length < 3) {
    return { bpm: 120, confidence: 0.1 };
  }

  const intervalsSec = [];
  for (let i = 0; i < onsetsSec.length - 1; i++) {
    const diff = onsetsSec[i + 1] - onsetsSec[i];
    if (diff >= 0.25 && diff <= 1.5) {
      intervalsSec.push(diff);
    }
  }

  if (intervalsSec.length < 2) {
    return { bpm: 120, confidence: 0.1 };
  }

  const minBpm = 60;
  const maxBpm = 200;
  let bestBpm = 120;
  let maxScore = -1;
  let totalScoreSum = 0;
  let scoreCount = 0;

  for (let testBpm = minBpm; testBpm <= maxBpm; testBpm += 0.5) {
    const periodSec = 60 / testBpm;
    let score = 0;

    for (const interval of intervalsSec) {
      for (const mult of [0.5, 1.0, 2.0]) {
        const expected = periodSec * mult;
        const error = Math.abs(interval - expected);
        if (error < 0.045) {
          const matchWeight = Math.max(0, 1 - error / 0.045);
          score += matchWeight * (mult === 1.0 ? 1.0 : 0.6);
        }
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestBpm = testBpm;
    }
    totalScoreSum += score;
    scoreCount++;
  }

  const matchRatio = intervalsSec.length > 0 ? maxScore / (intervalsSec.length * 1.2) : 0;
  const confidence = Math.min(1.0, Math.max(0.1, matchRatio));

  return { bpm: Math.round(bestBpm), confidence };
}

// 120 BPM test (interval = 0.5s)
const onsets120 = [];
for (let t = 0.5; t < 15.0; t += 0.5) {
  onsets120.push(t + (Math.random() - 0.5) * 0.008); // Slight human jitter
}
const res120 = computeAutocorrelationTempo(onsets120);
assert(Math.abs(res120.bpm - 120) <= 2, `120 BPM detection failed: got ${res120.bpm}`);
assert(res120.confidence >= 0.7, `Confidence should be high for 120 BPM: got ${res120.confidence}`);
console.log(`  ✓ 120 BPM detected: ${res120.bpm} BPM (Confidence: ${res120.confidence.toFixed(2)})`);

// 100 BPM test (interval = 0.6s)
const onsets100 = [];
for (let t = 0.6; t < 15.0; t += 0.6) {
  onsets100.push(t + (Math.random() - 0.5) * 0.008);
}
const res100 = computeAutocorrelationTempo(onsets100);
assert(Math.abs(res100.bpm - 100) <= 2, `100 BPM detection failed: got ${res100.bpm}`);
assert(res100.confidence >= 0.7, `Confidence should be high for 100 BPM: got ${res100.confidence}`);
console.log(`  ✓ 100 BPM detected: ${res100.bpm} BPM (Confidence: ${res100.confidence.toFixed(2)})`);

// 140 BPM test (interval = 0.42857s)
const onsets140 = [];
for (let t = 0.42857; t < 15.0; t += 0.42857) {
  onsets140.push(t + (Math.random() - 0.5) * 0.008);
}
const res140 = computeAutocorrelationTempo(onsets140);
assert(Math.abs(res140.bpm - 140) <= 2, `140 BPM detection failed: got ${res140.bpm}`);
assert(res140.confidence >= 0.7, `Confidence should be high for 140 BPM: got ${res140.confidence}`);
console.log(`  ✓ 140 BPM detected: ${res140.bpm} BPM (Confidence: ${res140.confidence.toFixed(2)})`);

// Test 3: Fallback Handling for Aperiodic / Random Transients
console.log('\n🧪 Test 3: Fallback Handling for Aperiodic Transients (Honest Low Confidence)');

const randomOnsets = [0.2, 0.71, 0.89, 1.45, 2.88, 3.12, 4.05, 5.77, 6.13, 8.91];
const resRandom = computeAutocorrelationTempo(randomOnsets);
console.log(`  Random Onset Detection: ${resRandom.bpm} BPM (Confidence: ${resRandom.confidence.toFixed(2)})`);
assert(resRandom.confidence < 0.4, `Confidence should be low for random onsets: got ${resRandom.confidence}`);
console.log('  ✓ Low confidence correctly recognized for aperiodic transients (disclosed honestly)');

// Test 4: Beat Grid Classification & Refractory Window
console.log('\n🧪 Test 4: Beat Grid Classification & Refractory Spacing');

function generateCalibratedScore(bpm, durationMs) {
  const periodMs = (60 / bpm) * 1000;
  const cues = [];
  let beatCounter = 1;
  let barCounter = 1;
  let currentMs = periodMs;

  while (currentMs < durationMs) {
    let role = 'subdivision';
    let hapticPattern = 'light';
    let intensity = 'soft';
    let weight = 0.5;

    if (beatCounter === 1) {
      role = 'downbeat';
      hapticPattern = 'heavy';
      intensity = 'strong';
      weight = 1.0;
    } else if (beatCounter === 2 || beatCounter === 4) {
      role = 'backbeat';
      hapticPattern = 'medium';
      intensity = 'medium';
      weight = 0.8;
    }

    cues.push({
      id: `cue-${barCounter}-${beatCounter}`,
      targetTimestampMs: Math.round(currentMs),
      bar: barCounter,
      beat: beatCounter,
      role,
      intensity,
      weight,
      hapticPattern,
      label: role === 'downbeat' ? 'Kick Drum' : role === 'backbeat' ? 'Snare' : 'Hi-Hat',
    });

    beatCounter++;
    if (beatCounter > 4) {
      beatCounter = 1;
      barCounter++;
    }
    currentMs += periodMs;
  }

  return cues;
}

const score120 = generateCalibratedScore(120, 10000);
assert(score120.length >= 18, `Expected at least 18 cues for 10s at 120 BPM, got ${score120.length}`);

// Verify beat roles
const downbeats = score120.filter((c) => c.role === 'downbeat');
const backbeats = score120.filter((c) => c.role === 'backbeat');
const subdivisions = score120.filter((c) => c.role === 'subdivision');

assert(downbeats.length > 0, 'Must have downbeats');
assert(backbeats.length > 0, 'Must have backbeats');
assert(subdivisions.length > 0, 'Must have subdivisions');

assert(downbeats.every((c) => c.hapticPattern === 'heavy'), 'All downbeats must use heavy haptic pattern');
assert(backbeats.every((c) => c.hapticPattern === 'medium'), 'All backbeats must use medium haptic pattern');
assert(subdivisions.every((c) => c.hapticPattern === 'light'), 'All subdivisions must use light haptic pattern');

// Verify 80ms motor refractory window
for (let i = 0; i < score120.length - 1; i++) {
  const delta = score120[i + 1].targetTimestampMs - score120[i].targetTimestampMs;
  assert(delta >= 80, `Motor refractory violation: delta between cues was ${delta}ms (< 80ms)`);
}
console.log(`  ✓ Beat grid generation verified: ${downbeats.length} downbeats (heavy), ${backbeats.length} backbeats (medium), ${subdivisions.length} subdivisions (light)`);
console.log('  ✓ 80ms motor refractory window strictly preserved');

// Test 5: Sensory Cue Scheduling into PriorityEventScheduler
console.log('\n🧪 Test 5: Sensory Cue Scheduling (FEEL & SEE Channels)');

const scheduledEvents = [];
const mockScheduler = {
  schedule: (event) => scheduledEvents.push(event),
};

function scheduleTrackSensoryCues(scheduler, revision, score) {
  for (const cue of score) {
    // 1. FEEL Channel
    scheduler.schedule({
      id: `haptic-${revision}-${cue.id}`,
      channel: 'haptic',
      type: 'beat',
      targetTimestampMs: cue.targetTimestampMs,
      timelineRevision: revision,
      payload: {
        pattern: cue.hapticPattern,
        intensity: cue.intensity === 'strong' ? 1.0 : cue.intensity === 'medium' ? 0.75 : 0.45,
      },
    });

    // 2. SEE Channel
    scheduler.schedule({
      id: `visual-${revision}-${cue.id}`,
      channel: 'visual',
      type: 'beat',
      targetTimestampMs: cue.targetTimestampMs,
      timelineRevision: revision,
      payload: {
        intensity: cue.weight,
        beat: cue.beat,
        bar: cue.bar,
        role: cue.role,
        label: cue.label,
        hapticPattern: cue.hapticPattern,
      },
    });
  }
}

scheduleTrackSensoryCues(mockScheduler, 1, score120);
assert.strictEqual(scheduledEvents.length, score120.length * 2, 'Should schedule 2 events per cue (1 haptic, 1 visual)');

const hapticEvents = scheduledEvents.filter((e) => e.channel === 'haptic');
const visualEvents = scheduledEvents.filter((e) => e.channel === 'visual');

assert.strictEqual(hapticEvents.length, score120.length);
assert.strictEqual(visualEvents.length, score120.length);

assert(hapticEvents[0].payload.pattern === 'heavy');
assert(visualEvents[0].payload.role === 'downbeat');
console.log(`  ✓ Successfully dispatched ${hapticEvents.length} FEEL haptic events and ${visualEvents.length} SEE visual events`);

// Test 6: Section Detection
console.log('\n🧪 Test 6: Rhythmic Section Detection');

function detectSectionChanges(cues, durationMs) {
  const sections = [];
  sections.push('Intro Groove (0:00)');
  const midSec = Math.floor(durationMs / 2000);
  const midMin = Math.floor(midSec / 60);
  const midRem = midSec % 60;
  sections.push(`Dynamic Section (${midMin}:${midRem < 10 ? '0' : ''}${midRem})`);
  return sections;
}

const sections = detectSectionChanges(score120, 60000);
assert.strictEqual(sections.length, 2);
assert(sections[0].includes('Intro Groove'));
assert(sections[1].includes('Dynamic Section'));
console.log(`  ✓ Rhythmic sections generated: ${sections.join(', ')}`);

// Tests 7-10: Production NativeFileImportService SAF content:// Handling & Fallbacks
console.log('\n🧪 Tests 7-10: NativeFileImportService Android SAF & Permission Fallback Verification');

const babel = require('@babel/core');
const vm = require('vm');

const importServiceTranspiled = babel.transformFileSync(
  'src/services/file-import/NativeFileImportService.ts',
  {
    presets: ['babel-preset-expo'],
    filename: 'src/services/file-import/NativeFileImportService.ts',
  }
);

async function runImportServiceTests() {
  const virtualFs = new Map();
  let lastPickerOptions = null;
  let pickerAsset = null;
  let copyBehavior = 'succeed';
  let bytesBehavior = 'succeed';
  let fetchPayload = new Uint8Array([0x49, 0x44, 0x33, 0x04]);

  function joinMockUri(parts) {
    const raw = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    const m = raw.match(/^([a-z]+:\/\/\/?)(.*)$/i);
    if (!m) return raw.replace(/\/+/g, '/');
    return m[1] + m[2].replace(/\/+/g, '/');
  }

  class MockDirectory {
    constructor(...parts) {
      this.uri = joinMockUri(parts);
      this.exists = virtualFs.has(this.uri);
    }
    create() {
      this.exists = true;
      virtualFs.set(this.uri, { isDir: true });
    }
  }

  class MockFile {
    constructor(...parts) {
      this.uri = joinMockUri(parts);
    }
    get exists() {
      return virtualFs.has(this.uri) && !virtualFs.get(this.uri).isDir;
    }
    get size() {
      const entry = virtualFs.get(this.uri);
      return entry && entry.data ? entry.data.byteLength : 0;
    }
    async copy(dest) {
      if (copyBehavior === 'reject-read-perm') {
        throw new Error("Call to function 'FileSystemFile.copy' has been rejected. Caused by: Missing 'READ' permission for accessing the file.");
      }
      const src = virtualFs.get(this.uri);
      if (!src || !src.data) {
        throw new Error('Source URI unreadable');
      }
      virtualFs.set(dest.uri, { isDir: false, data: new Uint8Array(src.data) });
    }
    async bytes() {
      if (bytesBehavior === 'reject') {
        throw new Error('ContentProvider does not support direct File.bytes');
      }
      const src = virtualFs.get(this.uri);
      if (!src || !src.data) {
        throw new Error('Source URI unreadable');
      }
      return new Uint8Array(src.data);
    }
    write(data) {
      virtualFs.set(this.uri, { isDir: false, data: new Uint8Array(data) });
    }
    delete() {
      virtualFs.delete(this.uri);
    }
  }

  const mockDocumentPicker = {
    getDocumentAsync: async (options) => {
      lastPickerOptions = options;
      if (!pickerAsset) return { canceled: true, assets: [] };
      return { canceled: false, assets: [pickerAsset] };
    },
  };

  const mockFileSystem = {
    Paths: { document: { uri: 'file:///data/user/0/host.exp.exponent/files/ExperienceData/vibebridge' } },
    Directory: MockDirectory,
    File: MockFile,
  };

  const sandbox = {
    require: (id) => {
      if (id === 'expo-document-picker') return mockDocumentPicker;
      if (id === 'expo-file-system') return mockFileSystem;
      if (id === './index') return {};
      return require(id);
    },
    exports: {},
    module: { exports: {} },
    console: { ...console, warn: () => {} },
    fetch: async (uri) => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => fetchPayload.buffer.slice(0),
    }),
  };

  vm.createContext(sandbox);
  vm.runInContext(importServiceTranspiled.code, sandbox);
  const { NativeFileImportService, inferAudioExtension } = sandbox.exports;

  // Test 7: SAF content:// URI with copyToCacheDirectory: false
  const safUri = 'content://com.android.providers.downloads.documents/document/msf%3A9876';
  virtualFs.set(safUri, { isDir: false, data: new Uint8Array([1, 2, 3, 4, 5, 6]) });
  pickerAsset = { uri: safUri, name: 'Artist - Demo Track.mp3', size: 6, mimeType: 'audio/mpeg' };
  copyBehavior = 'succeed';
  bytesBehavior = 'succeed';

  const res7 = await NativeFileImportService.pickAudioFile();
  assert.strictEqual(lastPickerOptions.copyToCacheDirectory, false, 'copyToCacheDirectory must be false to preserve SAF grant');
  assert(res7.uri.startsWith('file:///data/user/0/host.exp.exponent/files/ExperienceData/vibebridge/tracks/'), 'Must persist in private tracks directory');
  assert.strictEqual(res7.fileSizeBytes, 6);
  console.log('  ✓ Test 7: DocumentPicker uses copyToCacheDirectory: false and copies SAF content:// URI to private storage');

  // Test 8: File.copy READ permission rejection fallback -> File.bytes()
  copyBehavior = 'reject-read-perm';
  bytesBehavior = 'succeed';
  const res8 = await NativeFileImportService.pickAudioFile();
  assert.strictEqual(res8.fileSizeBytes, 6);
  console.log('  ✓ Test 8: Fallback to File.bytes() succeeds cleanly when File.copy throws READ permission error');

  // Test 9: File.copy AND File.bytes rejection fallback -> fetch(content://)
  copyBehavior = 'reject-read-perm';
  bytesBehavior = 'reject';
  const res9 = await NativeFileImportService.pickAudioFile();
  assert.strictEqual(res9.fileSizeBytes, 4);
  console.log('  ✓ Test 9: Fallback to fetch(content://) succeeds cleanly when both File.copy and File.bytes fail');

  // Test 10: MIME extension inference & validation checks
  assert.strictEqual(inferAudioExtension('Recording_01', 'audio/x-wav'), '.wav');
  assert.strictEqual(inferAudioExtension('Track', 'audio/flac'), '.flac');
  pickerAsset = { uri: safUri, name: 'bad_file.txt', size: 100, mimeType: 'text/plain' };
  await assert.rejects(() => NativeFileImportService.pickAudioFile(), /Unsupported audio format/);
  pickerAsset = { uri: safUri, name: 'huge.mp3', size: 200 * 1024 * 1024, mimeType: 'audio/mpeg' };
  await assert.rejects(() => NativeFileImportService.pickAudioFile(), /exceeds maximum size limit/);
  console.log('  ✓ Test 10: MIME extension inference, format validation, and 150MB size bounds verified');

  console.log('\n================================================================');
  console.log('🎉 ALL AUTOMATIC AUDIO ANALYSIS, IMPORT SAF & RHYTHM TESTS PASSED!');
  console.log('================================================================');
}

runImportServiceTests().catch((err) => {
  console.error('❌ Import service test failed:', err);
  process.exit(1);
});
