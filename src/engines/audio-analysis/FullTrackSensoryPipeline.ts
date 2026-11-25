/**
 * FullTrackSensoryPipeline
 *
 * Stage 2, Milestone 2 Core Pipeline:
 * Orchestrates unified native PCM audio decoding, DSP feature extraction via AudioSignalFoundation,
 * full-track tempo & rhythm generation, and atomic crash-safe Sensory Timeline persistence.
 *
 * Invariants:
 * 1. Decodes 100% of compressed audio (MP3, M4A, AAC, FLAC, OGG, WAV) into bounded-memory PCM chunks.
 * 2. Original audio sample rate is strictly preserved (no automatic downsampling to 24 kHz).
 * 3. Energy confidence, onset confidence, and BPM/rhythm confidence remain strictly independent.
 * 4. Does not fabricate synthetic beats during silence or when rhythm is uncertain; anchors on verified transients.
 * 5. Two-phase atomic persistence guarantees a failed/interrupted re-analysis never corrupts previous valid data.
 * 6. Publishes honest, measurable progress updates across all 6 lifecycle stages.
 */

import {
  TrackMetadata,
  TrackAnalysisStatus,
  TrackProcessingProgress,
  SensoryTimeline,
} from '@/types';
import {
  checkAudioDecoderAvailability,
  streamDecodeAudioFileNative,
  NativePcmChunk,
  probeAudioFileNative,
} from '@/native';
import { LocalTrackRepository } from '@/services/tracks';
import { CanonicalRhythmCue } from '@/features/rhythm';
import { AudioSignalFoundation } from './AudioSignalFoundation';
import {
  AutomaticRhythmAnalyzer,
  DetectedOnset,
} from './AutomaticRhythmAnalyzer';
import { CandidateOnsetObservation } from './types';

export class FullTrackSensoryPipeline {
  /**
   * Unified single-entry analysis pipeline.
   * Advances track lifecycle through:
   * importing -> decoding -> analyzing -> saving -> ready (or failed)
   */
  public static async processTrack(
    track: TrackMetadata,
    onProgress?: (progress: TrackProcessingProgress) => void
  ): Promise<{ track: TrackMetadata; timeline: SensoryTimeline }> {
    const notify = (p: TrackProcessingProgress) => {
      try {
        onProgress?.(p);
      } catch (err) {
        console.warn('[FullTrackSensoryPipeline] Progress callback error:', err);
      }
    };

    let totalDurationMs = track.durationMs || 0;
    let targetSampleRate = 44100;
    let targetChannels = 2;

    try {
      // -------------------------------------------------------------
      // STAGE 1: IMPORTING (Verifying file presence and header probe)
      // -------------------------------------------------------------
      notify({
        trackId: track.id,
        stage: 'importing',
        processedDurationMs: 0,
        totalDurationMs,
        percent: 0,
        detailMessage: 'Validating audio file...',
      });

      const availability = await checkAudioDecoderAvailability();
      const nativeAvailable = Boolean(availability.decoderImplemented && availability.moduleAvailable);

      // If native decoder is available, probe audio header for exact duration and container metadata
      if (nativeAvailable) {
        try {
          const probe = await probeAudioFileNative(track.uri);
          if (probe.status === 'executed' && probe.durationMs && probe.durationMs > 0) {
            totalDurationMs = probe.durationMs;
            targetSampleRate = probe.sampleRate || targetSampleRate;
            targetChannels = probe.channelCount || targetChannels;
          }
        } catch {
          // Probe failure is non-fatal; decoder will report parameters on first chunk
        }
      }

      // -------------------------------------------------------------
      // STAGE 2: DECODING (Streaming native MediaCodec PCM chunks)
      // -------------------------------------------------------------
      notify({
        trackId: track.id,
        stage: 'decoding',
        processedDurationMs: 0,
        totalDurationMs,
        percent: 0,
        sampleRate: targetSampleRate,
        channelCount: targetChannels,
        detailMessage: 'Decoding audio into PCM samples...',
      });

      const onsets: DetectedOnset[] = [];
      const energyEnvelope: number[] = [];
      let totalSamplesDecoded = 0;
      let lastReportedSec = -1;

      // Check whether native decoder is supported in current environment
      if (nativeAvailable) {
        const signalFoundation = new AudioSignalFoundation({
          windowSize: 512,
          hopSize: 256,
          lowPassCutoffHz: 200,
        });

        // Register candidate onset listener
        signalFoundation.onCandidateOnset((candidate: CandidateOnsetObservation) => {
          const tsMs = Math.round(candidate.estimatedOnsetTimeSec * 1000);
          const isLowBand =
            candidate.dominantBand === 'low' ||
            (candidate.bandFlux ? candidate.bandFlux.low > candidate.bandFlux.mid : false);
          const energy = Number(Math.max(0.1, Math.min(1.0, candidate.peakRms * 3.5)).toFixed(3));
          const confidence = Number(Math.max(0.1, Math.min(1.0, candidate.confidence)).toFixed(2));

          onsets.push({
            timestampMs: tsMs,
            energy,
            isLowBand,
            confidence,
          });
        });

        // Stream decode through MediaCodec in bounded chunks
        const decodeResult = await streamDecodeAudioFileNative(
          { uri: track.uri },
          {
            onChunk: (chunk: NativePcmChunk) => {
              targetSampleRate = chunk.sampleRate;
              targetChannels = chunk.channelCount;
              totalSamplesDecoded += chunk.frameCount;

              // Ensure clean ArrayBuffer copy for DSP foundation (Hermes safe, no ArrayBuffer.prototype.slice)
              const cleanBuffer = new ArrayBuffer(chunk.pcmData.byteLength);
              new Uint8Array(cleanBuffer).set(chunk.pcmData);

              // Ingest raw 16-bit PCM chunk into DSP foundation
              signalFoundation.ingestBuffer(
                cleanBuffer,
                {
                  sampleRate: chunk.sampleRate,
                  channelCount: chunk.channelCount,
                  sampleCount: chunk.frameCount,
                  nativeTimestampSec: chunk.startTimeMs / 1000,
                },
                Date.now(),
                'int16'
              );

              // Update 500ms energy envelope bins
              const ptsMs = chunk.startTimeMs;
              const binIdx = Math.max(0, Math.floor(ptsMs / 500));
              while (energyEnvelope.length <= binIdx) energyEnvelope.push(0);

              const chunkRms = chunk.rms > 0 ? chunk.rms : 0;
              const normEnergy = Math.min(1.0, chunkRms * 3.5);
              if (normEnergy > energyEnvelope[binIdx]) {
                energyEnvelope[binIdx] = Number(normEnergy.toFixed(3));
              }

              // Report progress if at least 1 second has advanced
              const currentSec = Math.floor(ptsMs / 1000);
              if (currentSec !== lastReportedSec) {
                lastReportedSec = currentSec;
                const percent = totalDurationMs > 0 ? Math.min(0.95, ptsMs / totalDurationMs) : -1;
                notify({
                  trackId: track.id,
                  stage: 'decoding',
                  processedDurationMs: ptsMs,
                  totalDurationMs,
                  percent,
                  sampleRate: chunk.sampleRate,
                  channelCount: chunk.channelCount,
                  totalSamplesDecoded,
                  detailMessage: `Decoding PCM: ${Math.floor(ptsMs / 1000)}s${
                    totalDurationMs > 0 ? ` / ${Math.floor(totalDurationMs / 1000)}s` : ''
                  }`,
                });
              }
            },
          }
        );

        signalFoundation.flush();

        if (decodeResult.status !== 'executed') {
          throw new Error(
            decodeResult.error || `PCM decoding failed with code: ${decodeResult.errorCode}`
          );
        }

        if (decodeResult.durationMs && decodeResult.durationMs > 0) {
          totalDurationMs = Math.max(totalDurationMs, decodeResult.durationMs);
        }
      } else {
        // Fallback for non-Android / unit test environments: use AutomaticRhythmAnalyzer directly
        const fallbackRes = await AutomaticRhythmAnalyzer.analyzeAudioFile(
          track.uri,
          totalDurationMs
        );
        totalDurationMs = fallbackRes.durationMs > 0 ? fallbackRes.durationMs : totalDurationMs;
        // Seed onsets from fallback result
        for (const cue of fallbackRes.rhythmScore) {
          onsets.push({
            timestampMs: cue.targetTimestampMs,
            energy: cue.weight,
            isLowBand: cue.role === 'downbeat',
            confidence: 0.8,
          });
        }
      }

      // -------------------------------------------------------------
      // STAGE 3: ANALYZING (DSP tempo, independent confidences, grid)
      // -------------------------------------------------------------
      notify({
        trackId: track.id,
        stage: 'analyzing',
        processedDurationMs: totalDurationMs,
        totalDurationMs,
        percent: 0.95,
        detailMessage: 'Analyzing musical tempo, onsets, and section boundaries...',
      });

      // 1. Calculate independent Energy Confidence from envelope dynamic range
      let energySum = 0;
      let nonZeroBins = 0;
      for (const e of energyEnvelope) {
        energySum += e;
        if (e > 0.05) nonZeroBins++;
      }
      const meanEnergy = energyEnvelope.length > 0 ? energySum / energyEnvelope.length : 0;
      const energyConfidence = Number(
        Math.min(1.0, Math.max(0.1, meanEnergy * 2.0 + (nonZeroBins / Math.max(1, energyEnvelope.length)) * 0.4)).toFixed(2)
      );

      // 2. Calculate independent Onset Confidence
      const onsetDensity = totalDurationMs > 0 ? (onsets.length / (totalDurationMs / 1000)) : 0;
      const onsetConfidence = Number(
        Math.min(1.0, Math.max(0.1, Math.min(onsets.length / 20, 1.0) * 0.6 + Math.min(onsetDensity / 3, 1.0) * 0.4)).toFixed(2)
      );

      // 3. Calculate Tempo & Rhythm Confidence via Autocorrelation
      let bpm = 120;
      let bpmConfidence = 0.1;
      let beatIntervalMs = 500;
      let phaseOffsetMs = 0;

      if (onsets.length >= 6) {
        const tempoEst = AutomaticRhythmAnalyzer.estimateTempoFromOnsets(onsets);
        bpm = tempoEst.bpm;
        bpmConfidence = Number(tempoEst.confidence.toFixed(2));
        beatIntervalMs = tempoEst.beatIntervalMs;
        phaseOffsetMs = tempoEst.phaseOffsetMs;
      }

      // 4. Generate Authoritative Canonical Sensory Cues (Shared by FEEL and SEE)
      let cues: CanonicalRhythmCue[] = [];
      let summaryNote = '';

      if (bpmConfidence >= 0.35 && onsets.length >= 6) {
        // High periodic confidence: phase-aligned grid, activity-gated (no fake beats during silences)
        cues = AutomaticRhythmAnalyzer.generateGridScore(
          onsets,
          energyEnvelope,
          bpm,
          beatIntervalMs,
          phaseOffsetMs,
          totalDurationMs
        );
        summaryNote = `Calibrated rhythm sync locked at ${bpm} BPM (${Math.round(
          bpmConfidence * 100
        )}% rhythmic match, ${cues.length} cues).`;
      } else if (onsets.length > 0) {
        // Low periodic confidence: follow physical onsets strictly (never manufacture false rhythms)
        cues = AutomaticRhythmAnalyzer.generateAdaptiveTransientScore(onsets);
        summaryNote = `Adaptive transient sync (${cues.length} verified physical peaks). Low periodic tempo confidence (${Math.round(
          bpmConfidence * 100
        )}%).`;
      } else {
        // Total silence or no detected events
        cues = [];
        summaryNote = 'Digital silence or minimal acoustic activity detected.';
      }

      // 5. Detect Rhythmic Section Changes
      const rhythmicChanges = AutomaticRhythmAnalyzer.detectRhythmicChanges(
        energyEnvelope,
        totalDurationMs,
        beatIntervalMs
      );

      // -------------------------------------------------------------
      // STAGE 4: SAVING (Atomic, crash-safe timeline persistence)
      // -------------------------------------------------------------
      notify({
        trackId: track.id,
        stage: 'saving',
        processedDurationMs: totalDurationMs,
        totalDurationMs,
        percent: 0.98,
        detailMessage: 'Saving persistent Sensory Timeline...',
      });

      const timeline: SensoryTimeline = {
        version: 1,
        trackId: track.id,
        durationMs: totalDurationMs,
        sampleRate: targetSampleRate,
        channelCount: targetChannels,
        bpm,
        bpmConfidence,
        energyConfidence,
        onsetConfidence,
        timeSignature: '4/4',
        energyEnvelope,
        cues,
        rhythmicChanges,
        summaryNote,
        createdAt: new Date().toISOString(),
      };

      // Two-phase atomic write to <trackId>.timeline.json
      const timelinePath = await LocalTrackRepository.saveTimelineAtomic(track.id, timeline);
      timeline.timelinePath = timelinePath;

      // -------------------------------------------------------------
      // STAGE 5: READY (Authoritative lifecycle state ready for playback)
      // -------------------------------------------------------------
      const updatedTrack = await LocalTrackRepository.updateTrackAnalysis(track.id, {
        analysisStatus: 'ready',
        durationMs: totalDurationMs,
        bpm: bpm > 0 ? bpm : undefined,
        bpmConfidence,
        energyConfidence,
        onsetConfidence,
        rhythmScore: cues,
        rhythmicChanges,
        summaryNote,
        timelinePath,
      });

      const finalTrack = updatedTrack || {
        ...track,
        analysisStatus: 'ready' as TrackAnalysisStatus,
        durationMs: totalDurationMs,
        bpm,
        bpmConfidence,
        energyConfidence,
        onsetConfidence,
        rhythmScore: cues,
        rhythmicChanges,
        summaryNote,
        timelinePath,
      };

      notify({
        trackId: track.id,
        stage: 'ready',
        processedDurationMs: totalDurationMs,
        totalDurationMs,
        percent: 1.0,
        sampleRate: targetSampleRate,
        channelCount: targetChannels,
        totalSamplesDecoded,
        detailMessage: `Ready to Play • ${bpm > 0 ? `${bpm} BPM` : 'Adaptive Sync'}`,
      });

      return { track: finalTrack, timeline };
    } catch (err: any) {
      console.warn('[FullTrackSensoryPipeline] Pipeline failure:', err?.message || err);
      console.warn('[FullTrackSensoryPipeline] Pipeline failure stack:', err?.stack);

      // -------------------------------------------------------------
      // EXPLICIT FAILED STATE (With retry mechanism support)
      // -------------------------------------------------------------
      const failedNote = `Analysis error: ${err?.message || 'Audio decoding failure'}`;
      await LocalTrackRepository.updateTrackAnalysis(track.id, {
        analysisStatus: 'failed',
        summaryNote: failedNote,
      });

      notify({
        trackId: track.id,
        stage: 'failed',
        processedDurationMs: 0,
        totalDurationMs,
        percent: 0,
        detailMessage: 'Analysis failed. Tap to retry.',
        error: err?.message || 'Audio decoding failure',
      });

      throw err;
    }
  }
}
