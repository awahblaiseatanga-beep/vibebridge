import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, theme } from '@/theme';
import {
  checkAudioDecoderAvailability,
  checkNativeHapticsCapabilities,
} from '@/native';

export default function RootLayout() {
  useEffect(() => {
    Promise.all([
      checkAudioDecoderAvailability(),
      checkNativeHapticsCapabilities(),
    ])
      .then(([decoder, haptics]) => {
        console.log('[VibeBridge NativeFoundation]', JSON.stringify({ decoder, haptics }));
      })
      .catch((err) => {
        console.warn('[VibeBridge NativeFoundation] Probe error:', err);
      });
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider initialMode="dark">
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: theme.colors.background.base,
            },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="learn" />
          <Stack.Screen name="player" />
          <Stack.Screen name="progress" />
          <Stack.Screen name="settings" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
