/**
 * VibeBridge Application Constants
 */

export const APP_CONFIG = {
  name: 'VibeBridge',
  slug: 'vibebridge',
  packageId: 'com.vibebridge.app',
  version: '1.0.0',
  tagline: 'Translating music into synchronized tactile, visual, and lyrical experiences.',
  targetPlatform: 'Android (CIMFEST APK)',
} as const;

/**
 * The Three Sensory Pillars of VibeBridge
 */
export const SENSORY_CHANNELS = {
  READ: {
    key: 'read',
    label: 'READ',
    description: 'Synchronized real-time lyrics',
    colorKey: 'read',
  },
  SEE: {
    key: 'see',
    label: 'SEE',
    description: 'Rhythm and intensity visualizer',
    colorKey: 'see',
  },
  FEEL: {
    key: 'feel',
    label: 'FEEL',
    description: 'Beat-synchronized tactile haptics',
    colorKey: 'feel',
  },
} as const;

export type SensoryChannelKey = keyof typeof SENSORY_CHANNELS;

/**
 * Local Storage Keys
 */
export const STORAGE_KEYS = {
  USER_PREFERENCES: '@vibebridge/preferences',
  RECENT_TRACKS: '@vibebridge/recent_tracks',
  OFFLINE_LIBRARY: '@vibebridge/library_index',
} as const;
