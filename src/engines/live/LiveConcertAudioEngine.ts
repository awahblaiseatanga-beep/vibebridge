/**
 * LiveConcertAudioEngine
 *
 * Dedicated live concert microphone capture and tactile translation orchestrator.
 * Stage B-LIVE.2: Adaptive Haptic Intelligence & Physical Feedback Calibration.
 * Designed for Deaf and hard-of-hearing music fans at live concert venues.
 *
 * Architectural Invariants:
 * 1. Completely decoupled from prepared ExoPlayer playback and MasterClock.
 * 2. Transparent runtime microphone permission handling (prompted only on user start).
 * 3. Continuous zero-copy PCM ingestion from AudioStream.
 * 4. Real-time audio feature intelligence via LiveAudioAnalyzer.
 * 5. Prioritized, calibrated physical tactile translation via LiveHapticTranslator.
 * 6. Independent manual testing studio invocation without audio capture requirements.
 * 7. Clean lifecycle and immediate vibration cancellation upon stop or mute.
 */

import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import AudioModule from 'expo-audio/build/AudioModule';
import { LiveAudioAnalyzer } from './LiveAudioAnalyzer';
import { LiveHapticTranslator } from './LiveHapticTranslator';
import {
  AudioSensitivityProfile,
  HapticIntensityProfile,
  LiveAudioFeatures,
  LiveCaptureState,
  LiveConcertState,
  LiveFeaturesListener,
  LiveHapticConfig,
  LiveHapticEvent,
  LiveHapticEventType,
  LiveHapticListener,
  LivePermissionStatus,
  LiveStateListener,
} from './types';

export class LiveConcertAudioEngine {
  private analyzer = new LiveAudioAnalyzer();
  private translator: LiveHapticTranslator;

  private stream: any = null;
  private bufferSubscription: { remove: () => void } | null = null;
  private statusSubscription: { remove: () => void } | null = null;

  private captureState: LiveCaptureState = 'idle';
  private permissionStatus: LivePermissionStatus = 'undetermined';
  private sampleRate = 48000;
  private channels = 1;
  private packetsReceived = 0;
  private errorMessage: string | null = null;
  private lastHapticEvent: LiveHapticEvent | null = null;

  private latestFeatures: LiveAudioFeatures = {
    sequence: 0,
    timestamp: 0,
    sampleRate: 48000,
    channels: 1,
    rms: 0,
    peak: 0,
    lowEnergy: 0,
    midEnergy: 0,
    highEnergy: 0,
    vocalActivityEstimate: 0,
    isTransient: false,
    noiseFloor: 0.02,
    snrDb: 0,
    effectiveSensitivity: 1.0,
  };

  private stateListeners = new Set<LiveStateListener>();
  private featureListeners = new Set<LiveFeaturesListener>();
  private hapticListeners = new Set<LiveHapticListener>();

  constructor(hapticConfig?: Partial<LiveHapticConfig>, translator?: LiveHapticTranslator) {
    this.translator = translator ?? new LiveHapticTranslator(hapticConfig);
    // Align initial analyzer profile with haptic config
    const cfg = this.translator.getConfig();
    this.analyzer.setSensitivityProfile(cfg.sensitivityProfile);
    this.analyzer.setAutoAdaptSensitivity(cfg.autoAdaptSensitivity);
  }

  public async checkPermission(): Promise<LivePermissionStatus> {
    try {
      const response = await getRecordingPermissionsAsync();
      if (response.granted) {
        this.permissionStatus = 'granted';
      } else if (response.canAskAgain) {
        this.permissionStatus = 'undetermined';
      } else {
        this.permissionStatus = 'denied';
      }
    } catch (e) {
      console.warn('[LiveConcertAudioEngine] Check permission error:', e);
      this.permissionStatus = 'undetermined';
    }
    this.notifyState();
    return this.permissionStatus;
  }

  public async requestPermission(): Promise<boolean> {
    this.permissionStatus = 'requesting';
    this.notifyState();

    try {
      const response = await requestRecordingPermissionsAsync();
      if (response.granted) {
        this.permissionStatus = 'granted';
        this.errorMessage = null;
        this.notifyState();
        return true;
      } else {
        this.permissionStatus = 'denied';
        this.errorMessage = 'Microphone permission was denied. Please enable microphone access in settings.';
        this.notifyState();
        return false;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.permissionStatus = 'denied';
      this.errorMessage = `Failed to request microphone permission: ${msg}`;
      this.notifyState();
      return false;
    }
  }

  public async start(): Promise<void> {
    if (this.captureState === 'capturing' || this.captureState === 'starting') {
      return;
    }

    this.captureState = 'starting';
    this.errorMessage = null;
    this.notifyState();

    // 1. Ensure microphone permission is granted
    const hasPermission = await this.checkPermission();
    if (hasPermission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) {
        this.captureState = 'error';
        this.notifyState();
        return;
      }
    }

    try {
      this.analyzer.reset();
      this.translator.reset();
      this.packetsReceived = 0;

      // 2. Instantiate native AudioStream for continuous live microphone PCM capture
      const streamInstance = new AudioModule.AudioStream({
        sampleRate: 48000,
        channels: 1,
        encoding: 'float32',
      });
      this.stream = streamInstance;

      // 3. Attach listeners
      this.statusSubscription = streamInstance.addListener(
        'audioStreamStatus',
        (status: { isStreaming: boolean }) => {
          if (status.isStreaming) {
            this.captureState = 'capturing';
          } else if (this.captureState === 'capturing') {
            this.captureState = 'stopped';
          }
          this.notifyState();
        }
      );

      this.bufferSubscription = streamInstance.addListener(
        'audioStreamBuffer',
        (buffer: { data: ArrayBuffer; sampleRate: number; channels: number; timestamp: number }) => {
          this.handleIncomingBuffer(buffer);
        }
      );

      // 4. Start native recording
      await streamInstance.start();
      this.sampleRate = streamInstance.sampleRate || 48000;
      this.channels = streamInstance.channels || 1;
      this.captureState = 'capturing';
      this.notifyState();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.captureState = 'error';
      this.errorMessage = `Failed to start microphone capture: ${msg}`;
      this.cleanupStream();
      this.notifyState();
    }
  }

  public async stop(): Promise<void> {
    if (this.captureState === 'idle' || this.captureState === 'stopped') {
      this.translator.cancelAll();
      return;
    }

    this.captureState = 'stopped';
    this.cleanupStream();
    this.translator.cancelAll();
    this.notifyState();
  }

  /**
   * Immediately halts any active hardware vibration pulses.
   */
  public cancelHaptics(): void {
    this.translator.cancelAll();
    this.lastHapticEvent = null;
    this.notifyState();
  }

  /**
   * Triggers a manual tactile pattern for the Haptic Testing Studio.
   * Completely bypasses microphone audio.
   */
  public async testPattern(type: LiveHapticEventType): Promise<LiveHapticEvent> {
    const event = await this.translator.testTrigger(type);
    if (event.type !== 'none') {
      this.lastHapticEvent = event;
      this.hapticListeners.forEach((listener) => {
        try {
          listener(event);
        } catch (e) {
          console.error('[LiveConcertAudioEngine] Haptic test listener error:', e);
        }
      });
    }
    this.notifyState();
    return event;
  }

  private handleIncomingBuffer(buffer: {
    data: ArrayBuffer;
    sampleRate: number;
    channels: number;
    timestamp: number;
  }): void {
    if (this.captureState !== 'capturing') return;

    this.packetsReceived++;
    this.sampleRate = buffer.sampleRate || this.sampleRate;
    this.channels = buffer.channels || this.channels;

    // 1. Compute real-time audio features
    const features = this.analyzer.analyze(
      buffer.data,
      this.sampleRate,
      this.channels,
      buffer.timestamp,
      'float32'
    );
    this.latestFeatures = features;

    // 2. Dispatch features to visual UI listeners
    this.featureListeners.forEach((listener) => {
      try {
        listener(features);
      } catch (e) {
        console.error('[LiveConcertAudioEngine] Feature listener error:', e);
      }
    });

    // 3. Translate to haptic feedback
    this.translator.translate(features).then((hapticEvent) => {
      if (hapticEvent.type !== 'none') {
        this.lastHapticEvent = hapticEvent;
        this.hapticListeners.forEach((listener) => {
          try {
            listener(hapticEvent);
          } catch (e) {
            console.error('[LiveConcertAudioEngine] Haptic listener error:', e);
          }
        });
      }
    }).catch((e) => {
      console.warn('[LiveConcertAudioEngine] Translation error:', e);
    });

    this.notifyState();
  }

  private cleanupStream(): void {
    if (this.bufferSubscription) {
      this.bufferSubscription.remove();
      this.bufferSubscription = null;
    }
    if (this.statusSubscription) {
      this.statusSubscription.remove();
      this.statusSubscription = null;
    }
    if (this.stream) {
      try {
        this.stream.stop();
      } catch (e) {
        console.warn('[LiveConcertAudioEngine] Warning during stream stop:', e);
      }
      this.stream = null;
    }
  }

  public setHapticConfig(config: Partial<LiveHapticConfig>): void {
    this.translator.setConfig(config);
    if (config.sensitivityProfile) {
      this.analyzer.setSensitivityProfile(config.sensitivityProfile);
    }
    if (config.autoAdaptSensitivity !== undefined) {
      this.analyzer.setAutoAdaptSensitivity(config.autoAdaptSensitivity);
    }
    this.notifyState();
  }

  public setIntensityProfile(profile: HapticIntensityProfile): void {
    this.translator.setIntensityProfile(profile);
    this.notifyState();
  }

  public setSensitivityProfile(profile: AudioSensitivityProfile): void {
    this.translator.setSensitivityProfile(profile);
    this.analyzer.setSensitivityProfile(profile);
    this.notifyState();
  }

  public setAutoAdaptSensitivity(enabled: boolean): void {
    this.translator.setAutoAdaptSensitivity(enabled);
    this.analyzer.setAutoAdaptSensitivity(enabled);
    this.notifyState();
  }

  public getHapticConfig(): LiveHapticConfig {
    return this.translator.getConfig();
  }

  public getState(): LiveConcertState {
    return {
      captureState: this.captureState,
      permissionStatus: this.permissionStatus,
      sampleRate: this.sampleRate,
      channels: this.channels,
      packetsReceived: this.packetsReceived,
      features: this.latestFeatures,
      lastHapticEvent: this.lastHapticEvent,
      errorMessage: this.errorMessage,
      hapticStats: this.translator.getStats(),
      hapticConfig: this.translator.getConfig(),
    };
  }

  public onStateChange(listener: LiveStateListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public onFeatures(listener: LiveFeaturesListener): () => void {
    this.featureListeners.add(listener);
    return () => {
      this.featureListeners.delete(listener);
    };
  }

  public onHapticEvent(listener: LiveHapticListener): () => void {
    this.hapticListeners.add(listener);
    return () => {
      this.hapticListeners.delete(listener);
    };
  }

  private notifyState(): void {
    const state = this.getState();
    this.stateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        console.error('[LiveConcertAudioEngine] State listener error:', e);
      }
    });
  }
}

// Global live concert engine singleton
export const liveConcertEngine = new LiveConcertAudioEngine();
